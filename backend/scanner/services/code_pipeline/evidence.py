import os
from collections import defaultdict

from django.utils import timezone

from scanner.models import AdkTraceEvent

from ..adk_trace import record_phase_metric, record_trace_event, update_scan_phase
from .inventory import get_snippet

MAX_EVIDENCE_CHUNKS = 8


def find_related_chunk_keys(candidate, chunk_map: dict, file_chunks: dict[int, list], module_index: dict[str, object]) -> list[str]:
    selected = [key for key in candidate.chunk_refs_json if key in chunk_map]
    for chunk_key in list(selected):
        chunk = chunk_map.get(chunk_key)
        if not chunk:
            continue
        chunks_for_file = file_chunks.get(chunk.file_index_id, [])
        position = next((index for index, item in enumerate(chunks_for_file) if item.chunk_key == chunk_key), None)
        if position is None:
            continue
        for offset in (-1, 1):
            neighbor = position + offset
            if 0 <= neighbor < len(chunks_for_file):
                neighbor_key = chunks_for_file[neighbor].chunk_key
                if neighbor_key not in selected:
                    selected.append(neighbor_key)
                if len(selected) >= MAX_EVIDENCE_CHUNKS:
                    return selected[:MAX_EVIDENCE_CHUNKS]
        for import_name in chunk.file_index.imports_json:
            module_key = import_name.split(".")[-1].replace("./", "").replace("/", "")
            related_file = module_index.get(module_key)
            if related_file and file_chunks.get(related_file.id):
                related_chunk_key = file_chunks[related_file.id][0].chunk_key
                if related_chunk_key not in selected:
                    selected.append(related_chunk_key)
                if len(selected) >= MAX_EVIDENCE_CHUNKS:
                    return selected[:MAX_EVIDENCE_CHUNKS]
    return selected[:MAX_EVIDENCE_CHUNKS]


def build_evidence_packs(*, scan, candidates: list, chunks: list, source_files: dict[str, str], clip_text_preview) -> list[dict]:
    started_at = timezone.now()
    record_trace_event(scan, phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION, kind=AdkTraceEvent.Kind.STAGE_STARTED, status="running", label="Evidence expansion", started_at=started_at)
    update_scan_phase(scan, AdkTraceEvent.Phase.EVIDENCE_EXPANSION)
    chunk_map, file_chunks, module_index, file_index_map = {chunk.chunk_key: chunk for chunk in chunks}, defaultdict(list), {}, {}
    for chunk in chunks:
        file_chunks[chunk.file_index_id].append(chunk)
        file_index_map[chunk.file_index_id] = chunk.file_index
    for chunk_list in file_chunks.values():
        chunk_list.sort(key=lambda item: item.start_line)
    for file_index in file_index_map.values():
        module_index[os.path.splitext(os.path.basename(file_index.path))[0]] = file_index

    evidence_packs, total_packs = [], len(candidates)
    record_phase_metric(scan, phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION, label="Evidence expansion progress", payload_json={"completed_packs": 0, "total_packs": total_packs})
    for candidate in candidates:
        members = []
        for chunk_key in find_related_chunk_keys(candidate, chunk_map, file_chunks, module_index):
            chunk = chunk_map[chunk_key]
            members.append({"chunk_key": chunk.chunk_key, "file_path": chunk.file_index.path, "line_range": [chunk.start_line, chunk.end_line], "summary": chunk.summary_json.get("summary", ""), "security_signals": chunk.signals_json, "snippet_preview": get_snippet(source_files.get(chunk.file_index.path, ""), chunk.start_line, chunk.end_line, clip_text_preview)})
        pack = {"evidence_pack_id": f"candidate-{candidate.id}", "candidate_id": candidate.id, "category": candidate.category, "score": candidate.score, "members": members, "line_ranges": [member["line_range"] for member in members]}
        evidence_packs.append(pack)
        record_trace_event(scan, phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION, kind=AdkTraceEvent.Kind.ARTIFACT_CREATED, status="success", label=f"Evidence pack for candidate #{candidate.id}", parent_key=f"candidate:{candidate.id}", payload_json=pack)
        record_phase_metric(scan, phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION, label="Evidence expansion progress", payload_json={"completed_packs": len(evidence_packs), "total_packs": total_packs, "candidate_id": candidate.id, "member_count": len(members)})

    record_trace_event(scan, phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION, kind=AdkTraceEvent.Kind.STAGE_COMPLETED, status="success", label="Evidence expansion completed", duration_ms=int((timezone.now() - started_at).total_seconds() * 1000), started_at=started_at, ended_at=timezone.now(), payload_json={"evidence_pack_count": len(evidence_packs)})
    update_scan_phase(scan, AdkTraceEvent.Phase.EVIDENCE_EXPANSION, {"evidence_pack_count": len(evidence_packs)})
    return evidence_packs
