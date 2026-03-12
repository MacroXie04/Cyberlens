from django.utils import timezone

from scanner.models import AdkTraceEvent, CodeScanCandidate, GitHubScan

from ..adk_trace import clip_text_preview, record_phase_metric, record_trace_event, update_scan_phase
from .analysis.candidates import generate_candidates
from .analysis.evidence import build_evidence_packs
from .preparation.inventory import create_file_indexes
from .progress import publish_token_update
from .preparation.summarization import summarize_chunks
from .analysis.synthesis import run_repo_synthesis
from .analysis.verification import verify_candidates


def run_code_scan_pipeline_service(scan_id: int, source_files: dict[str, str], profile, user_id: int | None, model_name: str, api_key: str, run_structured_agent, publish_stream) -> None:
    scan = GitHubScan.objects.get(id=scan_id)
    scan.code_scan_files_total = len(source_files)
    scan.code_scan_phase = AdkTraceEvent.Phase.CODE_INVENTORY
    scan.save(update_fields=["code_scan_files_total", "code_scan_phase"])
    publish_stream({"scan_id": scan.id, "type": "scan_start", "total_files": len(source_files)})

    started_at = timezone.now()
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CODE_INVENTORY, kind=AdkTraceEvent.Kind.STAGE_STARTED, status="running", label="Code inventory", started_at=started_at)
    update_scan_phase(scan, AdkTraceEvent.Phase.CODE_INVENTORY)
    file_indexes = create_file_indexes(scan, source_files)
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.CODE_INVENTORY, status="success", label="Indexed source files", payload_json={"indexed_files": len(file_indexes), "total_files": len(source_files)})
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CODE_INVENTORY, kind=AdkTraceEvent.Kind.STAGE_COMPLETED, status="success", label="Code inventory completed", duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now(), payload_json={"indexed_files": len(file_indexes), "total_files": len(source_files)})
    update_scan_phase(scan, AdkTraceEvent.Phase.CODE_INVENTORY, {"indexed_files": len(file_indexes), "total_files": len(source_files)})
    if not file_indexes:
        record_trace_event(scan, phase=AdkTraceEvent.Phase.CHUNK_SUMMARY, kind=AdkTraceEvent.Kind.WARNING, status="warning", label="No source files found", text_preview="No source files found for code security scan")
        publish_stream({"scan_id": scan.id, "type": "scan_summary", "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "files_scanned": 0, "total_findings": 0})
        return

    totals = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    chunks = summarize_chunks(scan=scan, source_files=source_files, file_indexes=file_indexes, profile=profile, user_id=user_id, model_name=model_name, api_key=api_key, totals=totals, run_structured_agent=run_structured_agent, publish_stream=publish_stream)
    candidates = generate_candidates(scan=scan, chunks=chunks, profile=profile, user_id=user_id, model_name=model_name, api_key=api_key, totals=totals, run_structured_agent=run_structured_agent, publish_stream=publish_stream)
    verification_candidates = candidates[: profile.max_verification_candidates] if profile.max_verification_candidates is not None and len(candidates) > profile.max_verification_candidates else candidates
    deferred = candidates[profile.max_verification_candidates :] if profile.max_verification_candidates is not None and len(candidates) > profile.max_verification_candidates else []
    for candidate in deferred:
        candidate.status = "deferred"
    if deferred:
        CodeScanCandidate.objects.bulk_update(deferred, ["status"])
    evidence_packs = build_evidence_packs(scan=scan, candidates=verification_candidates, chunks=chunks, source_files=source_files, clip_text_preview=clip_text_preview)
    verified_count = verify_candidates(scan=scan, candidates=verification_candidates, evidence_packs=evidence_packs, profile=profile, user_id=user_id, model_name=model_name, api_key=api_key, totals=totals, run_structured_agent=run_structured_agent, publish_stream=publish_stream)
    run_repo_synthesis(scan=scan, candidates=candidates, verified_count=verified_count, user_id=user_id, model_name=model_name, api_key=api_key, totals=totals, run_structured_agent=run_structured_agent, publish_stream=publish_stream)
    publish_token_update(scan, totals, publish_stream)
    publish_stream({"scan_id": scan.id, "type": "scan_summary", "input_tokens": totals["input_tokens"], "output_tokens": totals["output_tokens"], "total_tokens": totals["total_tokens"], "files_scanned": scan.code_scan_files_scanned, "total_findings": verified_count})
