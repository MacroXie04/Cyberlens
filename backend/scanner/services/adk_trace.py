from __future__ import annotations

from collections import defaultdict
from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from monitor.services.redis_publisher import publish_adk_trace_stream
from scanner.models import (
    AdkTraceEvent,
    CodeScanCandidate,
    CodeFinding,
    GitHubScan,
)

MAX_TEXT_PREVIEW = 2000
PHASE_ORDER = [choice for choice, _ in AdkTraceEvent.Phase.choices]


def clip_text_preview(text: str, limit: int = MAX_TEXT_PREVIEW) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3]}..."


def serialize_trace_event(event: AdkTraceEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "scan_id": event.scan_id,
        "sequence": event.sequence,
        "phase": event.phase,
        "kind": event.kind,
        "status": event.status,
        "label": event.label,
        "parent_key": event.parent_key,
        "input_tokens": event.input_tokens,
        "output_tokens": event.output_tokens,
        "total_tokens": event.total_tokens,
        "duration_ms": event.duration_ms,
        "text_preview": event.text_preview,
        "payload_json": event.payload_json,
        "started_at": event.started_at.isoformat() if event.started_at else None,
        "ended_at": event.ended_at.isoformat() if event.ended_at else None,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


def _get_scan(scan_or_id: GitHubScan | int) -> GitHubScan:
    if isinstance(scan_or_id, GitHubScan):
        return scan_or_id
    return GitHubScan.objects.get(id=scan_or_id)


def next_trace_sequence(scan_or_id: GitHubScan | int) -> int:
    scan_id = scan_or_id.id if isinstance(scan_or_id, GitHubScan) else scan_or_id
    with transaction.atomic():
        scan = GitHubScan.objects.select_for_update().get(id=scan_id)
        current_max = scan.adk_trace_events.aggregate(max_seq=Max("sequence")).get("max_seq") or 0
        next_value = max(scan.trace_sequence_counter, current_max) + 1
        scan.trace_sequence_counter = next_value
        scan.save(update_fields=["trace_sequence_counter"])
    return next_value


def record_trace_event(
    scan_or_id: GitHubScan | int,
    *,
    phase: str,
    kind: str,
    status: str = "success",
    label: str = "",
    parent_key: str = "",
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    duration_ms: int = 0,
    text_preview: str = "",
    payload_json: dict[str, Any] | list[Any] | None = None,
    started_at=None,
    ended_at=None,
) -> AdkTraceEvent:
    scan = _get_scan(scan_or_id)
    event = AdkTraceEvent.objects.create(
        scan=scan,
        sequence=next_trace_sequence(scan),
        phase=phase,
        kind=kind,
        status=status,
        label=label,
        parent_key=parent_key,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        duration_ms=duration_ms,
        text_preview=clip_text_preview(text_preview),
        payload_json=payload_json or {},
        started_at=started_at,
        ended_at=ended_at,
    )
    publish_adk_trace_stream(serialize_trace_event(event))
    return event


def update_scan_phase(
    scan_or_id: GitHubScan | int,
    phase: str,
    stats_patch: dict[str, Any] | None = None,
) -> None:
    scan = _get_scan(scan_or_id)
    scan.code_scan_phase = phase
    stats = dict(scan.code_scan_stats_json or {})
    if stats_patch:
        phase_stats = dict(stats.get("phases") or {})
        current_phase_stats = dict(phase_stats.get(phase) or {})
        current_phase_stats.update(stats_patch)
        phase_stats[phase] = current_phase_stats
        stats["phases"] = phase_stats
        stats["updated_at"] = timezone.now().isoformat()
    scan.code_scan_stats_json = stats
    scan.save(update_fields=["code_scan_phase", "code_scan_stats_json"])


def record_phase_metric(
    scan_or_id: GitHubScan | int,
    *,
    phase: str,
    label: str,
    payload_json: dict[str, Any] | None = None,
    status: str = "running",
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    update_scan_stats: bool = True,
) -> AdkTraceEvent:
    scan = _get_scan(scan_or_id)
    payload = payload_json or {}
    if update_scan_stats and payload:
        update_scan_phase(scan, phase, payload)
    return record_trace_event(
        scan,
        phase=phase,
        kind=AdkTraceEvent.Kind.METRIC,
        status=status,
        label=label,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        payload_json=payload,
    )


def build_phase_summaries(scan: GitHubScan) -> list[dict[str, Any]]:
    phase_events: dict[str, list[AdkTraceEvent]] = defaultdict(list)
    for event in scan.adk_trace_events.order_by("sequence", "id"):
        phase_events[event.phase].append(event)

    phases = []
    for phase in PHASE_ORDER:
        events = phase_events.get(phase, [])
        started = next((e for e in events if e.kind == AdkTraceEvent.Kind.STAGE_STARTED), None)
        completed = None
        for event in reversed(events):
            if event.kind == AdkTraceEvent.Kind.STAGE_COMPLETED:
                completed = event
                break

        status = "pending"
        if any(
            event.kind == AdkTraceEvent.Kind.ERROR or event.status == "error"
            for event in events
        ):
            status = "error"
        elif any(
            event.kind == AdkTraceEvent.Kind.WARNING or event.status == "warning"
            for event in events
        ):
            status = "warning"
        elif completed:
            status = completed.status or "success"
        elif events:
            status = "running"

        input_tokens = completed.input_tokens if completed else sum(
            event.input_tokens
            for event in events
            if event.kind in {AdkTraceEvent.Kind.LLM_COMPLETED, AdkTraceEvent.Kind.METRIC}
        )
        output_tokens = completed.output_tokens if completed else sum(
            event.output_tokens
            for event in events
            if event.kind in {AdkTraceEvent.Kind.LLM_COMPLETED, AdkTraceEvent.Kind.METRIC}
        )
        total_tokens = completed.total_tokens if completed else sum(
            event.total_tokens
            for event in events
            if event.kind in {AdkTraceEvent.Kind.LLM_COMPLETED, AdkTraceEvent.Kind.METRIC}
        )

        duration_ms = completed.duration_ms if completed else 0
        started_at = started.started_at if started else (events[0].started_at if events else None)
        ended_at = completed.ended_at if completed else (events[-1].ended_at if events else None)
        if not ended_at and status in {"warning", "error"} and events:
            ended_at = events[-1].created_at

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
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "event_count": len(events),
                "artifact_count": sum(
                    1 for event in events if event.kind == AdkTraceEvent.Kind.ARTIFACT_CREATED
                ),
                "error_count": sum(
                    1 for event in events if event.kind == AdkTraceEvent.Kind.ERROR
                ),
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
            "rationale": clip_text_preview(candidate.rationale),
            "verified_finding_id": candidate.verified_finding_id,
        }
        for candidate in scan.code_scan_candidates.all().order_by("-score", "id")
    ]

    evidence_packs = [
        {
            "event_id": event.id,
            "sequence": event.sequence,
            "label": event.label,
            **event.payload_json,
        }
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
        source_candidate_ids = [
            candidate_id
            for candidate_id, candidate_finding in findings_by_candidate.items()
            if candidate_finding and candidate_finding.id == finding.id
        ]
        verified_findings.append(
            {
                "finding_id": finding.id,
                "title": finding.title,
                "category": finding.category,
                "severity": finding.severity,
                "file_path": finding.file_path,
                "line_number": finding.line_number,
                "candidate_ids": source_candidate_ids,
            }
        )

    dependency_report_batches = [
        {
            "event_id": event.id,
            "sequence": event.sequence,
            "label": event.label,
            **event.payload_json,
        }
        for event in scan.adk_trace_events.filter(
            phase__in=[
                AdkTraceEvent.Phase.DEPENDENCY_INPUT,
                AdkTraceEvent.Phase.DEPENDENCY_ADK_REPORT,
            ],
            kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
        ).order_by("sequence", "id")
        if "batch_index" in event.payload_json
    ]

    return {
        "candidates": candidates,
        "evidence_packs": evidence_packs,
        "verified_findings": verified_findings,
        "dependency_report_batches": dependency_report_batches,
    }


def build_trace_snapshot(scan: GitHubScan) -> dict[str, Any]:
    events = [
        serialize_trace_event(event)
        for event in scan.adk_trace_events.order_by("sequence", "id")
    ]
    return {
        "phases": build_phase_summaries(scan),
        "events": events,
        "artifacts": build_artifact_summary(scan),
    }
