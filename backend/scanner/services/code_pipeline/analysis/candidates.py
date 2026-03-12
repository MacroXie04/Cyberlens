from django.utils import timezone

from scanner.models import AdkTraceEvent, CodeScanCandidate

from ...adk_trace import clip_text_preview, record_phase_metric, record_trace_event, update_scan_phase
from ..llm import build_candidate_agent, build_llm_model
from ..progress import accumulate_totals, publish_token_update
from ..preparation.schemas import CandidateBatch


def batch(items: list[dict], size: int) -> list[list[dict]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def normalize_candidate_key(category: str, chunk_refs: list[str]) -> tuple[str, tuple[str, ...]]:
    return category, tuple(sorted(set(chunk_refs)))


def candidate_sort_key(item: dict) -> tuple[float, int]:
    return item["score"], len(item["chunk_refs"])


def candidate_input_from_chunks(chunks: list) -> list[dict]:
    return [{"chunk_key": chunk.chunk_key, "file_path": chunk.file_index.path, "line_range": [chunk.start_line, chunk.end_line], "entrypoint_type": chunk.summary_json.get("entrypoint_type", "other"), "trust_boundary": chunk.summary_json.get("trust_boundary", "internal"), "security_signals": chunk.summary_json.get("security_signals", []), "suspicion_notes": chunk.summary_json.get("suspicion_notes", ""), "summary": chunk.summary_json.get("summary", ""), "imports": chunk.summary_json.get("imports", []), "symbols": chunk.summary_json.get("symbols", [])} for chunk in chunks]


def generate_candidates(*, scan, chunks: list, profile, user_id: int | None, model_name: str, api_key: str, totals: dict[str, int], run_structured_agent, publish_stream) -> list[CodeScanCandidate]:
    started_at = timezone.now()
    baseline = dict(totals)
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION, kind=AdkTraceEvent.Kind.STAGE_STARTED, status="running", label="Candidate generation", started_at=started_at)
    update_scan_phase(scan, AdkTraceEvent.Phase.CANDIDATE_GENERATION)
    agent = build_candidate_agent(build_llm_model(model_name, api_key))
    batches = batch(candidate_input_from_chunks(chunks), profile.summary_batch_size)
    deduped, total_batches, completed_batches = {}, len(batches) * len(profile.risk_passes), 0
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION, label="Candidate generation progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"completed_batches": 0, "total_batches": total_batches, "risk_categories_total": len(profile.risk_passes), "batches_per_category": len(batches), "selected_candidates": 0})

    for pass_name in profile.risk_passes:
        pass_candidates = []
        for batch_index, batch_items in enumerate(batches, start=1):
            result, metrics, _ = run_structured_agent(scan=scan, agent=agent, phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION, label=f"Candidate pass {pass_name} batch {batch_index}", parent_key=f"{pass_name}:{batch_index}", input_payload={"risk_category": pass_name, "chunks": batch_items, "max_candidates": profile.max_candidates_per_pass}, schema_cls=CandidateBatch, session_id=f"code-scan-{scan.id}-candidates-{pass_name}-{batch_index}", app_name="cyberlens_code_candidates", service_name="code_scan_candidate_generation", user_id=user_id, model_name=model_name, api_key=api_key, publish_stream=publish_stream)
            accumulate_totals(totals, metrics)
            publish_token_update(scan, totals, publish_stream)
            completed_batches += 1
            record_phase_metric(scan, phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION, label="Candidate generation progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"completed_batches": completed_batches, "total_batches": total_batches, "risk_category": pass_name, "batch_index": batch_index, "batches_in_category": len(batches), "current_candidate_hits": len(result.candidates), "deduped_candidates": len(deduped)})
            for candidate in result.candidates:
                item = candidate.model_dump()
                item["category"] = item.get("category") or pass_name
                item["chunk_refs"] = list(dict.fromkeys(ref for ref in item.get("chunk_refs", []) if ref))
                if item["chunk_refs"]:
                    pass_candidates.append(item)
        pass_candidates.sort(key=candidate_sort_key, reverse=True)
        for item in pass_candidates[: profile.max_candidates_per_pass]:
            key = normalize_candidate_key(item["category"], item["chunk_refs"])
            if key not in deduped or item["score"] > deduped[key]["score"]:
                deduped[key] = item

    selected = sorted(deduped.values(), key=candidate_sort_key, reverse=True)[: profile.max_total_candidates]
    created = []
    for item in selected:
        candidate = CodeScanCandidate.objects.create(scan=scan, category=item["category"], label=item.get("label") or item["category"].replace("_", " ").title(), score=item["score"], severity_hint=item.get("severity_hint", "medium"), chunk_refs_json=item["chunk_refs"], rationale=item.get("rationale", ""), status="candidate")
        created.append(candidate)
        record_trace_event(scan, phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION, kind=AdkTraceEvent.Kind.ARTIFACT_CREATED, status="success", label=f"Candidate #{candidate.id} created", parent_key=f"candidate:{candidate.id}", payload_json={"candidate_id": candidate.id, "category": candidate.category, "label": candidate.label, "score": candidate.score, "severity_hint": candidate.severity_hint, "chunk_refs": candidate.chunk_refs_json, "rationale": clip_text_preview(candidate.rationale, limit=400), "status": candidate.status, "verified_finding_id": candidate.verified_finding_id})

    record_phase_metric(scan, phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION, label="Candidate generation progress", status="success", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"completed_batches": completed_batches, "total_batches": total_batches, "selected_candidates": len(created), "deduped_candidates": len(deduped)})
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION, kind=AdkTraceEvent.Kind.STAGE_COMPLETED, status="success", label="Candidate generation completed", input_tokens=totals["input_tokens"] - baseline["input_tokens"], output_tokens=totals["output_tokens"] - baseline["output_tokens"], total_tokens=totals["total_tokens"] - baseline["total_tokens"], duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now(), payload_json={"candidate_count": len(created)})
    update_scan_phase(scan, AdkTraceEvent.Phase.CANDIDATE_GENERATION, {"candidate_count": len(created)})
    return created
