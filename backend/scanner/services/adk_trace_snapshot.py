from __future__ import annotations

from collections import defaultdict
from typing import Any

from scanner.models import AdkTraceEvent, CodeFinding, GitHubScan

from .adk_trace_events import serialize_trace_event

PHASE_ORDER = [choice for choice, _ in AdkTraceEvent.Phase.choices]


def build_phase_summaries(scan: GitHubScan) -> list[dict[str, Any]]:
    phase_events = defaultdict(list)
    for event in scan.adk_trace_events.order_by("sequence", "id"):
        phase_events[event.phase].append(event)

    phases = []
    for phase in PHASE_ORDER:
        events = phase_events.get(phase, [])
        started = next((event for event in events if event.kind == AdkTraceEvent.Kind.STAGE_STARTED), None)
        completed = next((event for event in reversed(events) if event.kind == AdkTraceEvent.Kind.STAGE_COMPLETED), None)
        status = "pending"
        if any(event.kind == AdkTraceEvent.Kind.ERROR or event.status == "error" for event in events):
            status = "error"
        elif any(event.kind == AdkTraceEvent.Kind.WARNING or event.status == "warning" for event in events):
            status = "warning"
        elif completed:
            status = completed.status or "success"
        elif events:
            status = "running"
        token_events = [event for event in events if event.kind in {AdkTraceEvent.Kind.LLM_COMPLETED, AdkTraceEvent.Kind.METRIC}]
        ended_at = completed.ended_at if completed else (events[-1].ended_at if events else None)
        if not ended_at and status in {"warning", "error"} and events:
            ended_at = events[-1].created_at
        duration_ms = completed.duration_ms if completed else 0
        started_at = started.started_at if started else (events[0].started_at if events else None)
        if not duration_ms and started_at and ended_at:
            duration_ms = int((ended_at - started_at).total_seconds() * 1000)
        phases.append(
            {
                "phase": phase,
                "status": status,
                "label": AdkTraceEvent.Phase(phase).label,
                "started_at": started_at.isoformat() if started_at else None,
                "ended_at": ended_at.isoformat() if ended_at else None,
                "duration_ms": duration_ms,
                "input_tokens": completed.input_tokens if completed else sum(event.input_tokens for event in token_events),
                "output_tokens": completed.output_tokens if completed else sum(event.output_tokens for event in token_events),
                "total_tokens": completed.total_tokens if completed else sum(event.total_tokens for event in token_events),
                "event_count": len(events),
                "artifact_count": sum(1 for event in events if event.kind == AdkTraceEvent.Kind.ARTIFACT_CREATED),
                "error_count": sum(1 for event in events if event.kind == AdkTraceEvent.Kind.ERROR),
            }
        )
    return phases


def build_artifact_summary(scan: GitHubScan) -> dict[str, Any]:
    candidates = [
        {
            "candidate_id": candidate.id,
            "category": candidate.category,
            "label": candidate.label,
            "score": candidate.score,
            "severity_hint": candidate.severity_hint,
            "status": candidate.status,
            "chunk_refs": candidate.chunk_refs_json,
            "rationale": candidate.rationale[:1997] + "..." if len(candidate.rationale) > 2000 else candidate.rationale,
            "verified_finding_id": candidate.verified_finding_id,
        }
        for candidate in scan.code_scan_candidates.all().order_by("-score", "id")
    ]
    evidence_packs = [
        {"event_id": event.id, "sequence": event.sequence, "label": event.label, **event.payload_json}
        for event in scan.adk_trace_events.filter(
            phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
            kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
        ).order_by("sequence", "id")
        if "evidence_pack_id" in event.payload_json
    ]
    findings_by_candidate = {
        candidate.id: candidate.verified_finding
        for candidate in scan.code_scan_candidates.select_related("verified_finding")
        if candidate.verified_finding_id
    }
    verified_findings = []
    for finding in CodeFinding.objects.filter(scan=scan).order_by("id"):
        verified_findings.append(
            {
                "finding_id": finding.id,
                "title": finding.title,
                "category": finding.category,
                "severity": finding.severity,
                "file_path": finding.file_path,
                "line_number": finding.line_number,
                "candidate_ids": [candidate_id for candidate_id, candidate_finding in findings_by_candidate.items() if candidate_finding and candidate_finding.id == finding.id],
            }
        )
    dependency_report_batches = [
        {"event_id": event.id, "sequence": event.sequence, "label": event.label, **event.payload_json}
        for event in scan.adk_trace_events.filter(
            phase__in=[AdkTraceEvent.Phase.DEPENDENCY_INPUT, AdkTraceEvent.Phase.DEPENDENCY_ADK_REPORT],
            kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
        ).order_by("sequence", "id")
        if "batch_index" in event.payload_json
    ]
    return {"candidates": candidates, "evidence_packs": evidence_packs, "verified_findings": verified_findings, "dependency_report_batches": dependency_report_batches}


def build_trace_snapshot(scan: GitHubScan) -> dict[str, Any]:
    return {
        "phases": build_phase_summaries(scan),
        "events": [serialize_trace_event(event) for event in scan.adk_trace_events.order_by("sequence", "id")],
        "artifacts": build_artifact_summary(scan),
    }
