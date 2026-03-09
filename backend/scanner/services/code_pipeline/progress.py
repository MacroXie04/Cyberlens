from django.utils import timezone

from scanner.models import AdkTraceEvent, GitHubScan

from ..adk_trace import record_phase_metric, record_trace_event, update_scan_phase


def update_scan_token_totals(scan: GitHubScan, totals: dict[str, int], files_scanned: int | None = None) -> None:
    scan.code_scan_input_tokens = totals["input_tokens"]
    scan.code_scan_output_tokens = totals["output_tokens"]
    scan.code_scan_total_tokens = totals["total_tokens"]
    if files_scanned is not None:
        scan.code_scan_files_scanned = files_scanned
    scan.save(update_fields=["code_scan_input_tokens", "code_scan_output_tokens", "code_scan_total_tokens", "code_scan_files_scanned"])


def publish_token_update(scan: GitHubScan, totals: dict[str, int], publish_stream, files_scanned: int | None = None) -> None:
    publish_stream({"scan_id": scan.id, "type": "token_update", "input_tokens": totals["input_tokens"], "output_tokens": totals["output_tokens"], "total_tokens": totals["total_tokens"], "files_scanned": scan.code_scan_files_scanned if files_scanned is None else files_scanned, "total_files": scan.code_scan_files_total})


def publish_code_scan_warning(scan: GitHubScan, *, message: str, error: str, publish_stream) -> None:
    publish_stream({"scan_id": scan.id, "type": "warning", "message": message, "error": error, "input_tokens": scan.code_scan_input_tokens, "output_tokens": scan.code_scan_output_tokens, "total_tokens": scan.code_scan_total_tokens, "files_scanned": scan.code_scan_files_scanned, "total_files": scan.code_scan_files_total})


def record_code_inventory_terminal_warning(scan: GitHubScan, *, label: str, detail: str, reason: str, publish_stream, payload_json: dict | None = None) -> None:
    started_at = timezone.now()
    payload = {"indexed_files": 0, "total_files": 0, "skip_reason": reason, "detail": detail, **(payload_json or {})}
    publish_stream({"scan_id": scan.id, "type": "scan_start", "total_files": 0})
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CODE_INVENTORY, kind=AdkTraceEvent.Kind.STAGE_STARTED, status="running", label="Code inventory", started_at=started_at)
    update_scan_phase(scan, AdkTraceEvent.Phase.CODE_INVENTORY, payload)
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.CODE_INVENTORY, label="Code inventory warning", status="warning", payload_json=payload)
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CODE_INVENTORY, kind=AdkTraceEvent.Kind.WARNING, status="warning", label=label, text_preview=detail, payload_json=payload)
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CODE_INVENTORY, kind=AdkTraceEvent.Kind.STAGE_COMPLETED, status="warning", label=f"{label} - code scan skipped", duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now(), payload_json=payload)
    publish_code_scan_warning(scan, message=detail, error=reason, publish_stream=publish_stream)
    publish_token_update(scan, {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}, publish_stream, files_scanned=0)
    publish_stream({"scan_id": scan.id, "type": "scan_summary", "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "files_scanned": 0, "total_findings": 0, "message": detail})


def accumulate_totals(totals: dict[str, int], metrics: dict[str, int]) -> None:
    totals["input_tokens"] += metrics["input_tokens"]
    totals["output_tokens"] += metrics["output_tokens"]
    totals["total_tokens"] += metrics["total_tokens"]
