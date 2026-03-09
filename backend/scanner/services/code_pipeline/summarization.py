from concurrent.futures import ThreadPoolExecutor, as_completed

from django.utils import timezone

from scanner.models import AdkTraceEvent, CodeScanChunk

from ..adk_trace import clip_text_preview, record_phase_metric, record_trace_event, update_scan_phase
from .inventory import get_snippet
from .llm import build_chunk_summary_agent, build_llm_model
from .progress import accumulate_totals, publish_token_update, update_scan_token_totals


def iter_chunk_ranges(total_lines: int, profile) -> list[tuple[int, int]]:
    if total_lines <= 0:
        return []
    ranges, start = [], 1
    while start <= total_lines:
        end = min(total_lines, start + profile.chunk_line_window - 1)
        ranges.append((start, end))
        if end == total_lines:
            break
        start = max(end - profile.chunk_line_overlap + 1, start + 1)
    return ranges


def summarize_single_chunk(*, scan, file_info, content: str, start_line: int, end_line: int, file_index: int, total_files: int, job_index: int, user_id: int | None, model_name: str, api_key: str, run_structured_agent, publish_stream):
    chunk_key = f"{scan.id}:{file_info.path}:{start_line}-{end_line}"
    result, metrics, _ = run_structured_agent(
        scan=scan,
        agent=build_chunk_summary_agent(build_llm_model(model_name, api_key)),
        phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
        label=f"Summarize {file_info.path}:{start_line}-{end_line}",
        parent_key=chunk_key,
        input_payload={"chunk_key": chunk_key, "file_path": file_info.path, "language": file_info.language, "role_flags": file_info.role_flags_json, "start_line": start_line, "end_line": end_line, "code": get_snippet(content, start_line, end_line, clip_text_preview, limit=4000)},
        schema_cls=__import__("scanner.services.code_pipeline.schemas", fromlist=["ChunkSummary"]).ChunkSummary,
        session_id=f"code-scan-{scan.id}-chunk-{job_index}",
        app_name="cyberlens_code_chunk_summary",
        service_name="code_scan_chunk_summary",
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
        publish_stream=publish_stream,
        code_stream_meta={"file_path": file_info.path, "file_index": file_index, "total_files": total_files},
    )
    return {"chunk_key": chunk_key, "start_line": start_line, "end_line": end_line, "summary": result.model_dump()}, metrics


def summarize_chunks(*, scan, source_files: dict[str, str], file_indexes: list, profile, user_id: int | None, model_name: str, api_key: str, totals: dict[str, int], run_structured_agent, publish_stream) -> list[CodeScanChunk]:
    started_at = timezone.now()
    baseline = dict(totals)
    record_trace_event(scan, phase=AdkTraceEvent.Phase.CHUNK_SUMMARY, kind=AdkTraceEvent.Kind.STAGE_STARTED, status="running", label="Chunk summary", started_at=started_at)
    update_scan_phase(scan, AdkTraceEvent.Phase.CHUNK_SUMMARY)
    created_chunks, suspicious_chunks, files_scanned, completed_chunks, job_counter = [], 0, 0, 0, 0
    total_files = len(file_indexes)
    ranges_by_file = {file_info.id: iter_chunk_ranges(len(source_files[file_info.path].splitlines()), profile) for file_info in file_indexes}
    total_chunks = sum(len(ranges) for ranges in ranges_by_file.values())
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.CHUNK_SUMMARY, label="Chunk summary progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"completed_files": 0, "total_files": total_files, "completed_chunks": 0, "total_chunks": total_chunks, "suspicious_chunks": 0})

    for file_index, file_info in enumerate(file_indexes):
        content = source_files[file_info.path]
        publish_stream({"scan_id": scan.id, "type": "file_start", "file_path": file_info.path, "file_index": file_index, "total_files": total_files})
        jobs = [(start, end, idx) for idx, (start, end) in enumerate(ranges_by_file.get(file_info.id, []), start=job_counter)]
        job_counter += len(jobs)
        if profile.chunk_workers > 1 and len(jobs) > 1:
            with ThreadPoolExecutor(max_workers=min(profile.chunk_workers, len(jobs))) as executor:
                results = [future.result() for future in as_completed({executor.submit(summarize_single_chunk, scan=scan, file_info=file_info, content=content, start_line=start, end_line=end, file_index=file_index, total_files=total_files, job_index=job_idx, user_id=user_id, model_name=model_name, api_key=api_key, run_structured_agent=run_structured_agent, publish_stream=publish_stream): (start, end) for start, end, job_idx in jobs})]
        else:
            results = [summarize_single_chunk(scan=scan, file_info=file_info, content=content, start_line=start, end_line=end, file_index=file_index, total_files=total_files, job_index=job_idx, user_id=user_id, model_name=model_name, api_key=api_key, run_structured_agent=run_structured_agent, publish_stream=publish_stream) for start, end, job_idx in jobs]
        suspicious_for_file = 0
        for summary_result, metrics in sorted(results, key=lambda item: (item[0]["start_line"], item[0]["end_line"])):
            accumulate_totals(totals, metrics)
            publish_token_update(scan, totals, publish_stream, files_scanned=files_scanned)
            summary_dict = summary_result["summary"]
            chunk = CodeScanChunk.objects.create(file_index=file_info, chunk_key=summary_result["chunk_key"], chunk_kind="window", start_line=summary_result["start_line"], end_line=summary_result["end_line"], summary_json=summary_dict, signals_json=summary_dict.get("security_signals", []), summary_status="completed")
            created_chunks.append(chunk)
            if summary_dict.get("security_signals") or summary_dict.get("suspicion_notes"):
                suspicious_chunks += 1
                suspicious_for_file += 1
            completed_chunks += 1
            record_trace_event(scan, phase=AdkTraceEvent.Phase.CHUNK_SUMMARY, kind=AdkTraceEvent.Kind.ARTIFACT_CREATED, status="success", label=f"Chunk indexed {file_info.path}:{summary_result['start_line']}-{summary_result['end_line']}", parent_key=summary_result["chunk_key"], payload_json={"chunk_key": summary_result["chunk_key"], "file_path": file_info.path, "line_range": [summary_result["start_line"], summary_result["end_line"]], "security_signals": summary_dict.get("security_signals", []), "summary_preview": clip_text_preview(summary_dict.get("summary", ""), limit=300)})
            if completed_chunks in {1, total_chunks} or completed_chunks % 10 == 0:
                record_phase_metric(scan, phase=AdkTraceEvent.Phase.CHUNK_SUMMARY, label="Chunk summary progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"completed_files": files_scanned, "total_files": total_files, "completed_chunks": completed_chunks, "total_chunks": total_chunks, "current_file": file_info.path, "current_line_range": [summary_result["start_line"], summary_result["end_line"]], "suspicious_chunks": suspicious_chunks})
        files_scanned += 1
        update_scan_token_totals(scan, totals, files_scanned=files_scanned)
        publish_stream({"scan_id": scan.id, "type": "file_complete", "file_path": file_info.path, "file_index": file_index, "findings_count": suspicious_for_file})
        publish_token_update(scan, totals, publish_stream, files_scanned=files_scanned)
        record_phase_metric(scan, phase=AdkTraceEvent.Phase.CHUNK_SUMMARY, label="Chunk summary progress", input_tokens=totals["input_tokens"], output_tokens=totals["output_tokens"], total_tokens=totals["total_tokens"], payload_json={"completed_files": files_scanned, "total_files": total_files, "completed_chunks": completed_chunks, "total_chunks": total_chunks, "last_completed_file": file_info.path, "suspicious_chunks": suspicious_chunks})

    record_trace_event(scan, phase=AdkTraceEvent.Phase.CHUNK_SUMMARY, kind=AdkTraceEvent.Kind.STAGE_COMPLETED, status="success", label="Chunk summary completed", input_tokens=totals["input_tokens"] - baseline["input_tokens"], output_tokens=totals["output_tokens"] - baseline["output_tokens"], total_tokens=totals["total_tokens"] - baseline["total_tokens"], duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now(), payload_json={"chunk_count": len(created_chunks), "suspicious_chunk_count": suspicious_chunks})
    update_scan_phase(scan, AdkTraceEvent.Phase.CHUNK_SUMMARY, {"chunk_count": len(created_chunks), "suspicious_chunk_count": suspicious_chunks})
    return sorted(created_chunks, key=lambda chunk: (chunk.file_index.path, chunk.start_line, chunk.id))
