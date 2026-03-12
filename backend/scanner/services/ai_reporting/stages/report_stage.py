import logging

from django.utils import timezone

from scanner.models import AiReport, GitHubScan

from ...adk_trace import clip_text_preview, record_phase_metric, record_trace_event

logger = logging.getLogger(__name__)


def mark_missing_api_key(scan: GitHubScan, vuln_data: list[dict]) -> None:
    logger.warning("GOOGLE_API_KEY not set, skipping AI report")
    started_at = timezone.now()
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_started", status="running", label="Dependency ADK report", started_at=started_at)
    record_trace_event(scan, phase="dependency_adk_report", kind="warning", status="warning", label="Missing Google API key", text_preview="GOOGLE_API_KEY not set, skipping AI report")
    record_phase_metric(
        scan,
        phase="dependency_adk_report",
        label="Dependency report skipped",
        status="warning",
        update_scan_stats=False,
        payload_json={"repository": scan.repo_name, "skip_reason": "missing_google_api_key", "vulnerability_count": len(vuln_data)},
    )
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_completed", status="warning", label="Dependency ADK report skipped", duration_ms=0, started_at=started_at, ended_at=timezone.now())


def mark_api_probe_failure(scan: GitHubScan, api_probe: dict) -> None:
    started_at = timezone.now()
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_started", status="running", label="Dependency ADK report", started_at=started_at)
    record_phase_metric(scan, phase="dependency_adk_report", label="Dependency ADK API check", status="warning", update_scan_stats=False, payload_json={"api_probe": api_probe})
    record_trace_event(scan, phase="dependency_adk_report", kind="warning", status="warning", label="Gemini API unavailable", text_preview=str(api_probe["message"]), payload_json={"api_probe": api_probe})
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_completed", status="warning", label="Dependency ADK report skipped", duration_ms=0, started_at=started_at, ended_at=timezone.now())


def create_clean_report(scan: GitHubScan) -> None:
    started_at = timezone.now()
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_started", status="running", label="Dependency ADK report", started_at=started_at)
    AiReport.objects.create(
        scan=scan,
        executive_summary="No vulnerabilities detected. All dependencies appear to be secure.",
        priority_ranking=[],
        remediation_json={"immediate": [], "short_term": [], "long_term": ["Continue regular dependency updates"]},
    )
    scan.security_score = 100
    scan.dependency_score = 100
    scan.save(update_fields=["security_score", "dependency_score"])
    payload = {"batch_index": 1, "batch_size": 0, "vulnerability_count": 0, "security_score": 100, "priority_count": 0}
    record_trace_event(scan, phase="dependency_adk_report", kind="artifact_created", status="success", label="Dependency report stored", payload_json=payload)
    record_phase_metric(scan, phase="dependency_adk_report", label="Dependency report metrics", status="success", update_scan_stats=False, payload_json=payload)
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_completed", status="success", label="Dependency ADK report completed without vulnerabilities", duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now())


def record_report_success(
    scan: GitHubScan,
    result,
    vuln_data: list[dict],
    metrics: dict[str, int],
    response_text: str,
    duration_ms: int,
    started_at,
) -> None:
    scan.security_score = result.security_score
    scan.dependency_score = result.security_score
    scan.save(update_fields=["security_score", "dependency_score"])
    AiReport.objects.create(
        scan=scan,
        executive_summary=result.executive_summary,
        priority_ranking=[item.model_dump() for item in result.priority_ranking],
        remediation_json=result.remediation.model_dump(),
    )
    payload = {
        "batch_index": 1,
        "batch_size": len(vuln_data),
        "vulnerability_count": len(vuln_data),
        "security_score": result.security_score,
        "priority_count": len(result.priority_ranking),
        "summary_preview": clip_text_preview(result.executive_summary, limit=300),
    }
    record_trace_event(scan, phase="dependency_adk_report", kind="llm_completed", status="success", label="Dependency ADK response", input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], text_preview=response_text)
    record_trace_event(scan, phase="dependency_adk_report", kind="artifact_created", status="success", label="Dependency report stored", payload_json=payload)
    record_phase_metric(scan, phase="dependency_adk_report", label="Dependency report metrics", status="success", update_scan_stats=False, input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], payload_json=payload)
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_completed", status="success", label="Dependency ADK report completed", input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], duration_ms=duration_ms, started_at=started_at, ended_at=timezone.now())


def record_report_failure(
    scan: GitHubScan,
    vuln_data: list[dict],
    metrics: dict[str, int],
    response_text: str,
    duration_ms: int,
    started_at,
) -> None:
    logger.exception("AI report generation failed")
    payload = {"repository": scan.repo_name, "vulnerability_count": len(vuln_data)}
    record_trace_event(scan, phase="dependency_adk_report", kind="error", status="error", label="Dependency ADK report failed", input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], duration_ms=duration_ms, text_preview=response_text, payload_json=payload)
    record_phase_metric(scan, phase="dependency_adk_report", label="Dependency report failed", status="error", update_scan_stats=False, input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], payload_json={**payload, "error": "dependency_report_failed"})
    record_trace_event(scan, phase="dependency_adk_report", kind="stage_completed", status="error", label="Dependency ADK report failed", input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], duration_ms=duration_ms, started_at=started_at, ended_at=timezone.now())
