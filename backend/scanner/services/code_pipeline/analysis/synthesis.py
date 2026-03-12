from django.utils import timezone

from scanner.models import AdkTraceEvent

from ...adk_trace import clip_text_preview, record_phase_metric, record_trace_event, update_scan_phase
from ..llm import build_llm_model, build_repo_synthesis_agent
from ..progress import accumulate_totals, publish_token_update, update_scan_token_totals
from ..preparation.schemas import RepoSynthesisReport


def run_repo_synthesis(*, scan, candidates: list, verified_count: int, user_id: int | None, model_name: str, api_key: str, totals: dict[str, int], run_structured_agent, publish_stream) -> None:
    started_at = timezone.now()
    baseline = dict(totals)
    record_trace_event(scan, phase=AdkTraceEvent.Phase.REPO_SYNTHESIS, kind=AdkTraceEvent.Kind.STAGE_STARTED, status="running", label="Repository synthesis", started_at=started_at)
    update_scan_phase(scan, AdkTraceEvent.Phase.REPO_SYNTHESIS)
    findings = list(scan.code_findings.order_by("id"))
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.REPO_SYNTHESIS, label="Repository synthesis progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"candidate_count": len(candidates), "verified_findings": verified_count, "finding_count": len(findings), "summary_ready": False})
    result, metrics, _ = run_structured_agent(scan=scan, agent=build_repo_synthesis_agent(build_llm_model(model_name, api_key)), phase=AdkTraceEvent.Phase.REPO_SYNTHESIS, label="Repository synthesis report", parent_key="repo_synthesis", input_payload={"repository": scan.repo_name, "candidate_count": len(candidates), "verified_findings": verified_count, "findings": [{"id": finding.id, "title": finding.title, "severity": finding.severity, "category": finding.category, "file_path": finding.file_path, "line_number": finding.line_number} for finding in findings]}, schema_cls=RepoSynthesisReport, session_id=f"code-scan-{scan.id}-repo-synthesis", app_name="cyberlens_code_repo_synthesis", service_name="code_scan_repo_synthesis", user_id=user_id, model_name=model_name, api_key=api_key, publish_stream=publish_stream)
    accumulate_totals(totals, metrics)
    update_scan_token_totals(scan, totals, files_scanned=scan.code_scan_files_scanned)
    publish_token_update(scan, totals, publish_stream)
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.REPO_SYNTHESIS, label="Repository synthesis progress", status="success", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"candidate_count": len(candidates), "verified_findings": verified_count, "finding_count": len(findings), "summary_ready": True, "hotspot_count": len(result.hotspots)})
    record_trace_event(scan, phase=AdkTraceEvent.Phase.REPO_SYNTHESIS, kind=AdkTraceEvent.Kind.ARTIFACT_CREATED, status="success", label="Repository synthesis summary", payload_json={"summary": clip_text_preview(result.summary, limit=500), "hotspots": result.hotspots, "verified_findings": result.verified_findings, "candidate_count": result.candidate_count})
    record_trace_event(scan, phase=AdkTraceEvent.Phase.REPO_SYNTHESIS, kind=AdkTraceEvent.Kind.STAGE_COMPLETED, status="success", label="Repository synthesis completed", input_tokens=totals["input_tokens"] - baseline["input_tokens"], output_tokens=totals["output_tokens"] - baseline["output_tokens"], total_tokens=totals["total_tokens"] - baseline["total_tokens"], duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now(), payload_json={"verified_findings": verified_count})
    update_scan_phase(scan, AdkTraceEvent.Phase.REPO_SYNTHESIS, {"repo_summary": clip_text_preview(result.summary, limit=500)})
