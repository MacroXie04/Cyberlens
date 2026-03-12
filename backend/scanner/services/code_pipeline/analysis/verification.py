from concurrent.futures import ThreadPoolExecutor, as_completed

from django.utils import timezone

from scanner.models import AdkTraceEvent, CodeFinding

from ...adk_trace import clip_text_preview, record_phase_metric, record_trace_event, update_scan_phase
from ..llm import build_llm_model, build_verifier_agent
from ..progress import accumulate_totals, publish_token_update, update_scan_token_totals
from ..preparation.schemas import VerificationDecision


def verify_single_candidate(*, scan, candidate, evidence_pack: dict, user_id: int | None, model_name: str, api_key: str, run_structured_agent, publish_stream):
    return run_structured_agent(scan=scan, agent=build_verifier_agent(build_llm_model(model_name, api_key)), phase=AdkTraceEvent.Phase.VERIFICATION, label=f"Verify candidate #{candidate.id}", parent_key=f"candidate:{candidate.id}", input_payload={"candidate": {"candidate_id": candidate.id, "category": candidate.category, "label": candidate.label, "score": candidate.score, "severity_hint": candidate.severity_hint, "chunk_refs": candidate.chunk_refs_json, "rationale": candidate.rationale}, "evidence_pack": evidence_pack}, schema_cls=VerificationDecision, session_id=f"code-scan-{scan.id}-verify-{candidate.id}", app_name="cyberlens_code_verifier", service_name="code_scan_verification", user_id=user_id, model_name=model_name, api_key=api_key, publish_stream=publish_stream)[:2]


def verify_candidates(*, scan, candidates: list, evidence_packs: list[dict], profile, user_id: int | None, model_name: str, api_key: str, totals: dict[str, int], run_structured_agent, publish_stream) -> int:
    started_at = timezone.now()
    baseline = dict(totals)
    record_trace_event(scan, phase=AdkTraceEvent.Phase.VERIFICATION, kind=AdkTraceEvent.Kind.STAGE_STARTED, status="running", label="Verification", started_at=started_at)
    update_scan_phase(scan, AdkTraceEvent.Phase.VERIFICATION)
    evidence_by_candidate = {pack["candidate_id"]: pack for pack in evidence_packs}
    verified_count = reviewed_candidates = rejected_count = 0
    total_candidates = len(candidates)
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.VERIFICATION, label="Verification progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"reviewed_candidates": 0, "total_candidates": total_candidates, "confirmed_findings": 0, "rejected_candidates": 0})
    jobs = []
    for candidate in candidates:
        evidence_pack = evidence_by_candidate.get(candidate.id)
        if not evidence_pack:
            candidate.status = "rejected"
            candidate.save(update_fields=["status"])
            reviewed_candidates += 1
            rejected_count += 1
            record_phase_metric(scan, phase=AdkTraceEvent.Phase.VERIFICATION, label="Verification progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"reviewed_candidates": reviewed_candidates, "total_candidates": total_candidates, "confirmed_findings": verified_count, "rejected_candidates": rejected_count, "candidate_id": candidate.id, "decision": "rejected", "reason": "missing_evidence_pack"})
            continue
        jobs.append((candidate, evidence_pack))
    if profile.verification_workers > 1 and len(jobs) > 1:
        with ThreadPoolExecutor(max_workers=min(profile.verification_workers, len(jobs))) as executor:
            future_map = {
                executor.submit(
                    verify_single_candidate,
                    scan=scan,
                    candidate=candidate,
                    evidence_pack=evidence_pack,
                    user_id=user_id,
                    model_name=model_name,
                    api_key=api_key,
                    run_structured_agent=run_structured_agent,
                    publish_stream=publish_stream,
                ): candidate
                for candidate, evidence_pack in jobs
            }
            results = [
                (future_map[future], *future.result())
                for future in as_completed(future_map)
            ]
    else:
        results = [(candidate, *verify_single_candidate(scan=scan, candidate=candidate, evidence_pack=evidence_pack, user_id=user_id, model_name=model_name, api_key=api_key, run_structured_agent=run_structured_agent, publish_stream=publish_stream)) for candidate, evidence_pack in jobs]
    for candidate, result, metrics in sorted(results, key=lambda item: item[0].id):
        accumulate_totals(totals, metrics)
        update_scan_token_totals(scan, totals, files_scanned=scan.code_scan_files_scanned)
        publish_token_update(scan, totals, publish_stream)
        if result.is_real_issue and result.file_path:
            finding = CodeFinding.objects.create(scan=scan, file_path=result.file_path, line_number=result.line_number, severity=result.severity, category=result.category, title=result.title or candidate.label, description=result.description or result.dataflow_or_controlflow_explanation, code_snippet=result.code_snippet, recommendation=result.recommendation, explanation=result.dataflow_or_controlflow_explanation)
            candidate.status = "verified"
            candidate.verified_finding = finding
            candidate.save(update_fields=["status", "verified_finding"])
            verified_count += 1
            payload = {"decision": "confirmed", "candidate_id": candidate.id, "category": finding.category, "severity": finding.severity, "reason": clip_text_preview(result.dataflow_or_controlflow_explanation or result.description, limit=500), "finding_ref": finding.id, "file_path": finding.file_path, "line_number": finding.line_number, "title": finding.title, "description": clip_text_preview(finding.description, limit=800), "recommendation": clip_text_preview(finding.recommendation, limit=800), "code_snippet": clip_text_preview(finding.code_snippet, limit=1500), "evidence_refs": result.evidence_refs}
        else:
            candidate.status = "rejected"
            candidate.save(update_fields=["status"])
            rejected_count += 1
            payload = {"decision": "rejected", "candidate_id": candidate.id, "category": result.category or candidate.category, "severity": result.severity or candidate.severity_hint, "reason": clip_text_preview(result.dataflow_or_controlflow_explanation or result.description, limit=500), "finding_ref": None, "file_path": result.file_path, "line_number": result.line_number, "title": result.title or candidate.label, "description": clip_text_preview(result.description or result.dataflow_or_controlflow_explanation, limit=800), "recommendation": clip_text_preview(result.recommendation, limit=800), "code_snippet": clip_text_preview(result.code_snippet, limit=1500), "evidence_refs": result.evidence_refs}
        reviewed_candidates += 1
        record_trace_event(scan, phase=AdkTraceEvent.Phase.VERIFICATION, kind=AdkTraceEvent.Kind.ARTIFACT_CREATED, status="success", label=f"Verification result for candidate #{candidate.id}", parent_key=f"candidate:{candidate.id}", payload_json=payload)
        record_phase_metric(scan, phase=AdkTraceEvent.Phase.VERIFICATION, label="Verification progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"reviewed_candidates": reviewed_candidates, "total_candidates": total_candidates, "confirmed_findings": verified_count, "rejected_candidates": rejected_count, "candidate_id": candidate.id, "decision": payload["decision"]})
    record_trace_event(scan, phase=AdkTraceEvent.Phase.VERIFICATION, kind=AdkTraceEvent.Kind.STAGE_COMPLETED, status="success", label="Verification completed", input_tokens=totals["input_tokens"] - baseline["input_tokens"], output_tokens=totals["output_tokens"] - baseline["output_tokens"], total_tokens=totals["total_tokens"] - baseline["total_tokens"], duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now(), payload_json={"verified_findings": verified_count})
    update_scan_phase(scan, AdkTraceEvent.Phase.VERIFICATION, {"verified_findings": verified_count})
    return verified_count
