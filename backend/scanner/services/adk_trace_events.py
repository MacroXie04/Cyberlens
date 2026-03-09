from __future__ import annotations

from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from monitor.services.redis_publisher import publish_adk_trace_stream
from scanner.models import AdkTraceEvent, GitHubScan

MAX_TEXT_PREVIEW = 2000


def clip_text_preview(text: str, limit: int = MAX_TEXT_PREVIEW) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


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
    return scan_or_id if isinstance(scan_or_id, GitHubScan) else GitHubScan.objects.get(id=scan_or_id)


def next_trace_sequence(scan_or_id: GitHubScan | int) -> int:
    scan_id = scan_or_id.id if isinstance(scan_or_id, GitHubScan) else scan_or_id
    with transaction.atomic():
        scan = GitHubScan.objects.select_for_update().get(id=scan_id)
        current_max = scan.adk_trace_events.aggregate(max_seq=Max("sequence")).get("max_seq") or 0
        next_value = max(scan.trace_sequence_counter, current_max) + 1
        scan.trace_sequence_counter = next_value
        scan.save(update_fields=["trace_sequence_counter"])
    return next_value


def record_trace_event(scan_or_id: GitHubScan | int, *, phase: str, kind: str, status: str = "success", label: str = "", parent_key: str = "", input_tokens: int = 0, output_tokens: int = 0, total_tokens: int = 0, duration_ms: int = 0, text_preview: str = "", payload_json: dict[str, Any] | list[Any] | None = None, started_at=None, ended_at=None) -> AdkTraceEvent:
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


def update_scan_phase(scan_or_id: GitHubScan | int, phase: str, stats_patch: dict[str, Any] | None = None) -> None:
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


def record_phase_metric(scan_or_id: GitHubScan | int, *, phase: str, label: str, payload_json: dict[str, Any] | None = None, status: str = "running", input_tokens: int = 0, output_tokens: int = 0, total_tokens: int = 0, update_scan_stats: bool = True) -> AdkTraceEvent:
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
