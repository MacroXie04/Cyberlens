from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from collections import defaultdict
from functools import cached_property

from django.utils import timezone
from google.adk import Agent
from google.adk.agents.run_config import StreamingMode
from google.adk.models.google_llm import Gemini
from google.adk.runners import InMemoryRunner, RunConfig
from google.genai import Client, types
from pydantic import BaseModel, Field

from monitor.services.redis_publisher import publish_code_scan_stream
from scanner.models import (
    AdkTraceEvent,
    CodeFinding,
    CodeScanCandidate,
    CodeScanChunk,
    CodeScanFileIndex,
    GitHubScan,
)

from .adk_trace import (
    clip_text_preview,
    record_phase_metric,
    record_trace_event,
    update_scan_phase,
)
from .github_client import get_source_files as get_github_source_files

logger = logging.getLogger(__name__)

CHUNK_LINE_WINDOW = 120
CHUNK_LINE_OVERLAP = 20
SUMMARY_BATCH_SIZE = 25
MAX_EVIDENCE_CHUNKS = 8
MAX_CANDIDATES_PER_PASS = 15
MAX_TOTAL_CANDIDATES = 100
MAX_PREVIEW_SNIPPET_CHARS = 1200

RISK_PASSES = [
    "injection",
    "authz",
    "secrets",
    "file_io",
    "network_ssrf",
    "deserialization",
    "crypto",
]

LANGUAGE_BY_EXTENSION = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".swift": "swift",
    ".m": "objective-c",
    ".mm": "objective-c++",
    ".h": "c",
    ".c": "c",
    ".cc": "cpp",
    ".cpp": "cpp",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".go": "go",
    ".rb": "ruby",
    ".java": "java",
    ".php": "php",
    ".html": "html",
    ".sql": "sql",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
}

CHUNK_SUMMARY_INSTRUCTION = """You are a security-oriented code summarizer.
Analyze the provided code chunk and return only structured JSON.

Focus on:
- symbols declared or referenced
- imports/exports
- whether this chunk is an entrypoint, route, middleware, config, model, or helper
- trust boundary context
- security-relevant signals such as input sources, dangerous sinks, auth logic, secrets,
  network access, file access, deserialization, and crypto usage
- a short suspicion note if this chunk deserves follow-up

Do not report a final vulnerability verdict here. Compress the chunk into retrieval-friendly security metadata."""

CANDIDATE_GENERATION_INSTRUCTION = """You are a security triage agent.
You are given compressed summaries of code chunks and one risk category to focus on.

Return only the strongest candidate vulnerabilities for that category.
Each candidate must:
- reference only chunk_keys present in the input
- explain why the chunks matter
- estimate a score between 0 and 1
- say whether it looks cross-file

Prefer high-recall but avoid inventing chunk references."""

VERIFICATION_INSTRUCTION = """You are a senior application security reviewer.
You are given one candidate issue plus a bounded evidence pack containing code snippets.

Decide whether the issue is real.
Only confirm a finding when the evidence shows a concrete security weakness.
Do not invent files or lines outside the provided evidence pack.

When confirming a finding, follow these requirements precisely:

1. **line_number**: Set to the exact line where the vulnerability is triggered (the sink).

2. **code_snippet**: Include 3-5 lines of surrounding context centered on the vulnerable line.
   Format each line with its number, e.g.:
   ```
   42 |   user_input = request.args.get("q")
   43 |   cursor.execute("SELECT * FROM users WHERE name = '%s'" % user_input)  # <-- vulnerable
   44 |   results = cursor.fetchall()
   ```

3. **dataflow_or_controlflow_explanation**: Describe the complete data or control flow that makes
   this vulnerable. Use specific variable names and line numbers. Example format:
   "User input enters at line 42 via `request.args.get('q')` and is stored in `user_input`.
   At line 43, `user_input` is interpolated directly into an SQL string via `%` formatting
   and passed to `cursor.execute()`, allowing an attacker to inject arbitrary SQL."

4. **recommendation**: Provide an actionable fix with example code showing the secure alternative.

If the issue is not real, explain why it should be rejected."""

REPO_SYNTHESIS_INSTRUCTION = """You are a security report synthesizer.
Summarize the repository-level results of a completed code scan.
Focus on the most important hotspots and what the scan found or did not find.
Return only structured JSON."""


class ChunkSummary(BaseModel):
    symbols: list[str] = Field(default_factory=list)
    imports: list[str] = Field(default_factory=list)
    exports: list[str] = Field(default_factory=list)
    entrypoint_type: str = Field(default="other")
    trust_boundary: str = Field(default="internal")
    security_signals: list[str] = Field(default_factory=list)
    suspicion_notes: str = Field(default="")
    summary: str = Field(default="")


class CandidateSpec(BaseModel):
    category: str
    label: str = Field(default="")
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    severity_hint: str = Field(default="medium")
    chunk_refs: list[str] = Field(default_factory=list)
    rationale: str = Field(default="")
    is_cross_file: bool = Field(default=False)


class CandidateBatch(BaseModel):
    candidates: list[CandidateSpec] = Field(default_factory=list)


class VerificationDecision(BaseModel):
    is_real_issue: bool = Field(default=False)
    decision: str = Field(default="rejected")
    category: str = Field(default="other")
    file_path: str = Field(default="")
    line_number: int = Field(default=0)
    severity: str = Field(default="info")
    title: str = Field(default="")
    description: str = Field(default="")
    code_snippet: str = Field(default="")
    recommendation: str = Field(default="")
    evidence_refs: list[str] = Field(default_factory=list)
    dataflow_or_controlflow_explanation: str = Field(default="")


class RepoSynthesisReport(BaseModel):
    summary: str = Field(default="")
    hotspots: list[str] = Field(default_factory=list)
    verified_findings: int = Field(default=0)
    candidate_count: int = Field(default=0)


class ScopedGemini(Gemini):
    api_key: str

    @cached_property
    def api_client(self) -> Client:
        return Client(
            api_key=self.api_key,
            http_options=types.HttpOptions(
                headers=self._tracking_headers(),
                retry_options=self.retry_options,
                base_url=self.base_url,
            ),
        )

    @cached_property
    def _live_api_client(self) -> Client:
        return Client(
            api_key=self.api_key,
            http_options=types.HttpOptions(
                headers=self._tracking_headers(),
                api_version=self._live_api_version,
            ),
        )


def _build_chunk_summary_agent(model: Gemini) -> Agent:
    return Agent(
        name="code_chunk_summarizer",
        model=model,
        instruction=CHUNK_SUMMARY_INSTRUCTION,
        output_schema=ChunkSummary,
        generate_content_config=types.GenerateContentConfig(temperature=0.2),
    )


def _build_candidate_agent(model: Gemini) -> Agent:
    return Agent(
        name="code_candidate_generator",
        model=model,
        instruction=CANDIDATE_GENERATION_INSTRUCTION,
        output_schema=CandidateBatch,
        generate_content_config=types.GenerateContentConfig(temperature=0.2),
    )


def _build_verifier_agent(model: Gemini) -> Agent:
    return Agent(
        name="code_security_verifier",
        model=model,
        instruction=VERIFICATION_INSTRUCTION,
        output_schema=VerificationDecision,
        generate_content_config=types.GenerateContentConfig(temperature=0.1),
    )


def _build_repo_synthesis_agent(model: Gemini) -> Agent:
    return Agent(
        name="code_repo_synthesizer",
        model=model,
        instruction=REPO_SYNTHESIS_INSTRUCTION,
        output_schema=RepoSynthesisReport,
        generate_content_config=types.GenerateContentConfig(temperature=0.2),
    )


def _detect_language(file_path: str) -> str:
    _, ext = os.path.splitext(file_path)
    return LANGUAGE_BY_EXTENSION.get(ext.lower(), "text")


def _build_llm_model(model_name: str, api_key: str) -> ScopedGemini:
    return ScopedGemini(model=model_name, api_key=api_key)


def _extract_imports(file_path: str, content: str) -> list[str]:
    imports: list[str] = []
    if file_path.endswith(".py"):
        patterns = [
            re.compile(r"^\s*import\s+([a-zA-Z0-9_\.]+)", re.MULTILINE),
            re.compile(r"^\s*from\s+([a-zA-Z0-9_\.]+)\s+import\s+", re.MULTILINE),
        ]
    elif file_path.endswith((".js", ".jsx", ".ts", ".tsx")):
        patterns = [
            re.compile(r"from\s+['\"]([^'\"]+)['\"]"),
            re.compile(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)"),
        ]
    else:
        return imports

    for pattern in patterns:
        imports.extend(match.group(1) for match in pattern.finditer(content))
    return sorted(set(imports))


def _infer_role_flags(file_path: str, content: str) -> list[str]:
    flags = set()
    lower_path = file_path.lower()
    lower_content = content.lower()

    if any(token in lower_path for token in ["route", "controller", "handler", "api"]):
        flags.add("route")
    if "middleware" in lower_path or "next(" in lower_content:
        flags.add("middleware")
    if any(token in lower_path for token in ["config", "settings", ".env", "env"]):
        flags.add("config")
    if "model" in lower_path:
        flags.add("model")
    if not flags:
        flags.add("helper")
    return sorted(flags)


def _iter_chunk_ranges(total_lines: int) -> list[tuple[int, int]]:
    if total_lines <= 0:
        return []
    ranges = []
    start = 1
    while start <= total_lines:
        end = min(total_lines, start + CHUNK_LINE_WINDOW - 1)
        ranges.append((start, end))
        if end == total_lines:
            break
        start = max(end - CHUNK_LINE_OVERLAP + 1, start + 1)
    return ranges


def _get_snippet(
    content: str,
    start_line: int,
    end_line: int,
    limit: int = MAX_PREVIEW_SNIPPET_CHARS,
) -> str:
    lines = content.splitlines()
    snippet = "\n".join(lines[start_line - 1 : end_line])
    return clip_text_preview(snippet, limit=limit)


def _update_scan_token_totals(
    scan: GitHubScan,
    totals: dict[str, int],
    files_scanned: int | None = None,
) -> None:
    scan.code_scan_input_tokens = totals["input_tokens"]
    scan.code_scan_output_tokens = totals["output_tokens"]
    scan.code_scan_total_tokens = totals["total_tokens"]
    if files_scanned is not None:
        scan.code_scan_files_scanned = files_scanned
    scan.save(
        update_fields=[
            "code_scan_input_tokens",
            "code_scan_output_tokens",
            "code_scan_total_tokens",
            "code_scan_files_scanned",
        ]
    )


def _publish_token_update(
    scan: GitHubScan,
    totals: dict[str, int],
    files_scanned: int | None = None,
) -> None:
    publish_code_scan_stream(
        {
            "scan_id": scan.id,
            "type": "token_update",
            "input_tokens": totals["input_tokens"],
            "output_tokens": totals["output_tokens"],
            "total_tokens": totals["total_tokens"],
            "files_scanned": (
                scan.code_scan_files_scanned if files_scanned is None else files_scanned
            ),
            "total_files": scan.code_scan_files_total,
        }
    )


def _reset_code_scan_state(scan: GitHubScan) -> None:
    scan.code_scan_input_tokens = 0
    scan.code_scan_output_tokens = 0
    scan.code_scan_total_tokens = 0
    scan.code_scan_files_scanned = 0
    scan.code_scan_files_total = 0
    scan.code_scan_phase = AdkTraceEvent.Phase.CODE_INVENTORY
    scan.code_scan_stats_json = {}
    scan.save(
        update_fields=[
            "code_scan_input_tokens",
            "code_scan_output_tokens",
            "code_scan_total_tokens",
            "code_scan_files_scanned",
            "code_scan_files_total",
            "code_scan_phase",
            "code_scan_stats_json",
        ]
    )

    scan.code_findings.all().delete()
    scan.code_scan_file_indexes.all().delete()
    scan.code_scan_candidates.all().delete()
    scan.adk_trace_events.filter(
        phase__in=[
            AdkTraceEvent.Phase.CODE_INVENTORY,
            AdkTraceEvent.Phase.CHUNK_SUMMARY,
            AdkTraceEvent.Phase.CANDIDATE_GENERATION,
            AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
            AdkTraceEvent.Phase.VERIFICATION,
            AdkTraceEvent.Phase.REPO_SYNTHESIS,
        ]
    ).delete()


def _publish_code_scan_warning(scan: GitHubScan, *, message: str, error: str = "") -> None:
    publish_code_scan_stream(
        {
            "scan_id": scan.id,
            "type": "warning",
            "message": message,
            "error": error,
            "input_tokens": scan.code_scan_input_tokens,
            "output_tokens": scan.code_scan_output_tokens,
            "total_tokens": scan.code_scan_total_tokens,
            "files_scanned": scan.code_scan_files_scanned,
            "total_files": scan.code_scan_files_total,
        }
    )


def _record_code_inventory_terminal_warning(
    scan: GitHubScan,
    *,
    label: str,
    detail: str,
    reason: str,
    payload_json: dict | None = None,
) -> None:
    started_at = timezone.now()
    payload = {
        "indexed_files": 0,
        "total_files": 0,
        "skip_reason": reason,
        "detail": detail,
        **(payload_json or {}),
    }

    publish_code_scan_stream({"scan_id": scan.id, "type": "scan_start", "total_files": 0})
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CODE_INVENTORY,
        kind=AdkTraceEvent.Kind.STAGE_STARTED,
        status="running",
        label="Code inventory",
        started_at=started_at,
    )
    update_scan_phase(scan, AdkTraceEvent.Phase.CODE_INVENTORY, payload)
    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.CODE_INVENTORY,
        label="Code inventory warning",
        status="warning",
        payload_json=payload,
    )
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CODE_INVENTORY,
        kind=AdkTraceEvent.Kind.WARNING,
        status="warning",
        label=label,
        text_preview=detail,
        payload_json=payload,
    )
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CODE_INVENTORY,
        kind=AdkTraceEvent.Kind.STAGE_COMPLETED,
        status="warning",
        label=f"{label} - code scan skipped",
        duration_ms=int((timezone.now() - started_at).total_seconds() * 1000),
        started_at=started_at,
        ended_at=timezone.now(),
        payload_json=payload,
    )
    _publish_code_scan_warning(scan, message=detail, error=reason)
    _publish_token_update(scan, {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}, files_scanned=0)
    publish_code_scan_stream(
        {
            "scan_id": scan.id,
            "type": "scan_summary",
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "files_scanned": 0,
            "total_findings": 0,
            "message": detail,
        }
    )


def _classify_adk_error(exc: Exception) -> dict[str, str | bool]:
    message = str(exc).strip() or exc.__class__.__name__
    lower = message.lower()
    if any(token in lower for token in ["429", "quota", "resource_exhausted", "rate limit", "too many requests"]):
        return {
            "error_type": "quota_exceeded",
            "label": "Gemini API quota exceeded",
            "should_probe": True,
            "message": message,
        }
    if any(token in lower for token in ["api key", "permission", "forbidden", "unauth", "authentication"]):
        return {
            "error_type": "api_auth_error",
            "label": "Gemini API authentication failed",
            "should_probe": True,
            "message": message,
        }
    return {
        "error_type": "agent_error",
        "label": "ADK agent failed",
        "should_probe": False,
        "message": message,
    }


def _accumulate_totals(totals: dict[str, int], metrics: dict[str, int]) -> None:
    totals["input_tokens"] += metrics["input_tokens"]
    totals["output_tokens"] += metrics["output_tokens"]
    totals["total_tokens"] += metrics["total_tokens"]


def _batch(items: list[dict], size: int) -> list[list[dict]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def _normalize_candidate_key(category: str, chunk_refs: list[str]) -> tuple[str, tuple[str, ...]]:
    return category, tuple(sorted(set(chunk_refs)))


def _candidate_sort_key(item: dict) -> tuple[float, int]:
    return item["score"], len(item["chunk_refs"])


def _run_structured_agent(
    *,
    scan: GitHubScan,
    agent: Agent,
    phase: str,
    label: str,
    parent_key: str,
    input_payload: dict,
    schema_cls,
    session_id: str,
    app_name: str,
    service_name: str,
    user_id: int | None,
    model_name: str,
    api_key: str,
    code_stream_meta: dict | None = None,
) -> tuple[BaseModel, dict[str, int], str]:
    from cyberlens.utils import clean_json_response, log_gemini_call

    input_text = json.dumps(input_payload)
    runner = InMemoryRunner(agent=agent, app_name=app_name)
    runner.auto_create_session = True
    response_text = ""
    metrics = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    start_time = time.time()

    try:
        for event in runner.run(
            user_id="system",
            session_id=session_id,
            new_message=types.UserContent(parts=[types.Part(text=input_text)]),
            run_config=RunConfig(streaming_mode=StreamingMode.SSE),
        ):
            if event.partial and event.content:
                parts = getattr(event.content, "parts", None) or []
                partial_text = "".join(
                    part.text for part in parts if getattr(part, "text", "")
                )
                if partial_text:
                    record_trace_event(
                        scan,
                        phase=phase,
                        kind=AdkTraceEvent.Kind.LLM_PARTIAL,
                        status="running",
                        label=label,
                        parent_key=parent_key,
                        text_preview=partial_text,
                    )
                    if code_stream_meta:
                        publish_code_scan_stream(
                            {
                                "scan_id": scan.id,
                                "type": "chunk",
                                "file_path": code_stream_meta["file_path"],
                                "file_index": code_stream_meta["file_index"],
                                "total_files": code_stream_meta["total_files"],
                                "text": partial_text,
                            }
                        )

            if event.is_final_response() and event.content:
                for part in getattr(event.content, "parts", None) or []:
                    if part.text:
                        response_text += part.text

            if hasattr(event, "usage_metadata") and event.usage_metadata:
                meta = event.usage_metadata
                metrics["input_tokens"] = int(getattr(meta, "prompt_token_count", 0) or 0)
                metrics["output_tokens"] = int(getattr(meta, "candidates_token_count", 0) or 0)
                metrics["total_tokens"] = int(getattr(meta, "total_token_count", 0) or 0)

        record_trace_event(
            scan,
            phase=phase,
            kind=AdkTraceEvent.Kind.LLM_COMPLETED,
            status="success",
            label=label,
            parent_key=parent_key,
            input_tokens=metrics["input_tokens"],
            output_tokens=metrics["output_tokens"],
            total_tokens=metrics["total_tokens"],
            text_preview=response_text,
        )

        cleaned = clean_json_response(response_text)
        if not cleaned:
            logger.warning(
                "%s returned empty response for scan %s, using defaults",
                service_name,
                scan.id,
            )
            parsed = schema_cls()
        else:
            parsed = schema_cls.model_validate_json(cleaned)
        duration_ms = int((time.time() - start_time) * 1000)
        log_gemini_call(
            user_id=user_id,
            service=service_name,
            related_object_id=scan.id,
            model_name=model_name,
            prompt_summary=clip_text_preview(input_text),
            response_summary=clip_text_preview(response_text),
            input_tokens=metrics["input_tokens"],
            output_tokens=metrics["output_tokens"],
            total_tokens=metrics["total_tokens"],
            status="success",
            duration_ms=duration_ms,
        )
        return parsed, metrics, response_text
    except Exception as exc:
        from cyberlens.utils import probe_gemini_api_connection

        duration_ms = int((time.time() - start_time) * 1000)
        error_info = _classify_adk_error(exc)
        api_probe = (
            probe_gemini_api_connection(api_key)
            if error_info["should_probe"]
            else None
        )
        error_payload = {
            "error_type": error_info["error_type"],
            "error_message": clip_text_preview(str(exc), limit=500),
            "recommended_worker_concurrency": 2,
            "recommended_fetch_workers": 2,
        }
        if api_probe:
            error_payload["api_probe"] = api_probe

        logger.exception("%s failed for scan %s", service_name, scan.id)
        record_trace_event(
            scan,
            phase=phase,
            kind=AdkTraceEvent.Kind.ERROR,
            status="error",
            label=str(error_info["label"]),
            parent_key=parent_key,
            input_tokens=metrics["input_tokens"],
            output_tokens=metrics["output_tokens"],
            total_tokens=metrics["total_tokens"],
            duration_ms=duration_ms,
            text_preview=clip_text_preview(str(exc), limit=1000) or response_text,
            payload_json=error_payload,
        )
        _publish_code_scan_warning(
            scan,
            message=(
                api_probe["message"]
                if api_probe
                else f"{error_info['label']}: {clip_text_preview(str(exc), limit=300)}"
            ),
            error=str(error_info["error_type"]),
        )
        log_gemini_call(
            user_id=user_id,
            service=service_name,
            related_object_id=scan.id,
            model_name=model_name,
            prompt_summary=clip_text_preview(input_text),
            response_summary=clip_text_preview(response_text),
            input_tokens=metrics["input_tokens"],
            output_tokens=metrics["output_tokens"],
            total_tokens=metrics["total_tokens"],
            status="error",
            error_message=clip_text_preview(str(exc), limit=500),
            duration_ms=duration_ms,
        )
        raise


def _create_file_indexes(scan: GitHubScan, source_files: dict[str, str]) -> list[CodeScanFileIndex]:
    file_indexes = []
    for file_path, content in sorted(source_files.items()):
        file_indexes.append(
            CodeScanFileIndex.objects.create(
                scan=scan,
                path=file_path,
                language=_detect_language(file_path),
                content_hash=hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest(),
                imports_json=_extract_imports(file_path, content),
                role_flags_json=_infer_role_flags(file_path, content),
                inventory_status="indexed",
            )
        )
    return file_indexes


def _summarize_chunks(
    *,
    scan: GitHubScan,
    source_files: dict[str, str],
    file_indexes: list[CodeScanFileIndex],
    user_id: int | None,
    model_name: str,
    api_key: str,
    totals: dict[str, int],
) -> list[CodeScanChunk]:
    stage_started_at = timezone.now()
    stage_baseline = dict(totals)
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
        kind=AdkTraceEvent.Kind.STAGE_STARTED,
        status="running",
        label="Chunk summary",
        started_at=stage_started_at,
    )
    update_scan_phase(scan, AdkTraceEvent.Phase.CHUNK_SUMMARY)

    agent = _build_chunk_summary_agent(_build_llm_model(model_name, api_key))
    created_chunks: list[CodeScanChunk] = []
    suspicious_chunks = 0
    files_scanned = 0
    total_files = len(file_indexes)
    chunk_ranges_by_file = {
        file_info.id: _iter_chunk_ranges(len(source_files[file_info.path].splitlines()))
        for file_info in file_indexes
    }
    total_chunks = sum(len(ranges) for ranges in chunk_ranges_by_file.values())
    completed_chunks = 0

    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
        label="Chunk summary progress",
        input_tokens=totals["input_tokens"],
        output_tokens=totals["output_tokens"],
        total_tokens=totals["total_tokens"],
        payload_json={
            "completed_files": 0,
            "total_files": total_files,
            "completed_chunks": 0,
            "total_chunks": total_chunks,
            "suspicious_chunks": 0,
        },
    )

    for file_index, file_info in enumerate(file_indexes):
        content = source_files[file_info.path]
        publish_code_scan_stream(
            {
                "scan_id": scan.id,
                "type": "file_start",
                "file_path": file_info.path,
                "file_index": file_index,
                "total_files": total_files,
            }
        )

        total_lines = len(content.splitlines())
        suspicious_for_file = 0

        for start_line, end_line in chunk_ranges_by_file.get(file_info.id, []):
            chunk_key = f"{scan.id}:{file_info.path}:{start_line}-{end_line}"
            snippet = _get_snippet(content, start_line, end_line, limit=4000)
            result, metrics, _ = _run_structured_agent(
                scan=scan,
                agent=agent,
                phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
                label=f"Summarize {file_info.path}:{start_line}-{end_line}",
                parent_key=chunk_key,
                input_payload={
                    "chunk_key": chunk_key,
                    "file_path": file_info.path,
                    "language": file_info.language,
                    "role_flags": file_info.role_flags_json,
                    "start_line": start_line,
                    "end_line": end_line,
                    "code": snippet,
                },
                schema_cls=ChunkSummary,
                session_id=f"code-scan-{scan.id}-chunk-{len(created_chunks)}",
                app_name="cyberlens_code_chunk_summary",
                service_name="code_scan_chunk_summary",
                user_id=user_id,
                model_name=model_name,
                api_key=api_key,
                code_stream_meta={
                    "file_path": file_info.path,
                    "file_index": file_index,
                    "total_files": total_files,
                },
            )
            _accumulate_totals(totals, metrics)
            _publish_token_update(scan, totals, files_scanned=files_scanned)
            summary_dict = result.model_dump()
            chunk = CodeScanChunk.objects.create(
                file_index=file_info,
                chunk_key=chunk_key,
                chunk_kind="window",
                start_line=start_line,
                end_line=end_line,
                summary_json=summary_dict,
                signals_json=summary_dict.get("security_signals", []),
                summary_status="completed",
            )
            created_chunks.append(chunk)
            if summary_dict.get("security_signals") or summary_dict.get("suspicion_notes"):
                suspicious_chunks += 1
                suspicious_for_file += 1
            completed_chunks += 1

            record_trace_event(
                scan,
                phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
                kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
                status="success",
                label=f"Chunk indexed {file_info.path}:{start_line}-{end_line}",
                parent_key=chunk_key,
                payload_json={
                    "chunk_key": chunk_key,
                    "file_path": file_info.path,
                    "line_range": [start_line, end_line],
                    "security_signals": summary_dict.get("security_signals", []),
                    "summary_preview": clip_text_preview(summary_dict.get("summary", ""), limit=300),
                },
            )
            if (
                completed_chunks == 1
                or completed_chunks % 10 == 0
                or completed_chunks == total_chunks
            ):
                record_phase_metric(
                    scan,
                    phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
                    label="Chunk summary progress",
                    input_tokens=totals["input_tokens"],
                    output_tokens=totals["output_tokens"],
                    total_tokens=totals["total_tokens"],
                    payload_json={
                        "completed_files": files_scanned,
                        "total_files": total_files,
                        "completed_chunks": completed_chunks,
                        "total_chunks": total_chunks,
                        "current_file": file_info.path,
                        "current_line_range": [start_line, end_line],
                        "suspicious_chunks": suspicious_chunks,
                    },
                )

        files_scanned += 1
        _update_scan_token_totals(scan, totals, files_scanned=files_scanned)
        publish_code_scan_stream(
            {
                "scan_id": scan.id,
                "type": "file_complete",
                "file_path": file_info.path,
                "file_index": file_index,
                "findings_count": suspicious_for_file,
            }
        )
        _publish_token_update(scan, totals, files_scanned=files_scanned)
        record_phase_metric(
            scan,
            phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
            label="Chunk summary progress",
            input_tokens=totals["input_tokens"],
            output_tokens=totals["output_tokens"],
            total_tokens=totals["total_tokens"],
            payload_json={
                "completed_files": files_scanned,
                "total_files": total_files,
                "completed_chunks": completed_chunks,
                "total_chunks": total_chunks,
                "last_completed_file": file_info.path,
                "suspicious_chunks": suspicious_chunks,
            },
        )

    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
        kind=AdkTraceEvent.Kind.STAGE_COMPLETED,
        status="success",
        label="Chunk summary completed",
        input_tokens=totals["input_tokens"] - stage_baseline["input_tokens"],
        output_tokens=totals["output_tokens"] - stage_baseline["output_tokens"],
        total_tokens=totals["total_tokens"] - stage_baseline["total_tokens"],
        duration_ms=int((timezone.now() - stage_started_at).total_seconds() * 1000),
        started_at=stage_started_at,
        ended_at=timezone.now(),
        payload_json={
            "chunk_count": len(created_chunks),
            "suspicious_chunk_count": suspicious_chunks,
        },
    )
    update_scan_phase(
        scan,
        AdkTraceEvent.Phase.CHUNK_SUMMARY,
        {"chunk_count": len(created_chunks), "suspicious_chunk_count": suspicious_chunks},
    )
    return created_chunks


def _candidate_input_from_chunks(chunks: list[CodeScanChunk]) -> list[dict]:
    summaries = []
    for chunk in chunks:
        summaries.append(
            {
                "chunk_key": chunk.chunk_key,
                "file_path": chunk.file_index.path,
                "line_range": [chunk.start_line, chunk.end_line],
                "entrypoint_type": chunk.summary_json.get("entrypoint_type", "other"),
                "trust_boundary": chunk.summary_json.get("trust_boundary", "internal"),
                "security_signals": chunk.summary_json.get("security_signals", []),
                "suspicion_notes": chunk.summary_json.get("suspicion_notes", ""),
                "summary": chunk.summary_json.get("summary", ""),
                "imports": chunk.summary_json.get("imports", []),
                "symbols": chunk.summary_json.get("symbols", []),
            }
        )
    return summaries


def _generate_candidates(
    *,
    scan: GitHubScan,
    chunks: list[CodeScanChunk],
    user_id: int | None,
    model_name: str,
    api_key: str,
    totals: dict[str, int],
) -> list[CodeScanCandidate]:
    stage_started_at = timezone.now()
    stage_baseline = dict(totals)
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION,
        kind=AdkTraceEvent.Kind.STAGE_STARTED,
        status="running",
        label="Candidate generation",
        started_at=stage_started_at,
    )
    update_scan_phase(scan, AdkTraceEvent.Phase.CANDIDATE_GENERATION)

    agent = _build_candidate_agent(_build_llm_model(model_name, api_key))
    batches = _batch(_candidate_input_from_chunks(chunks), SUMMARY_BATCH_SIZE)
    deduped: dict[tuple[str, tuple[str, ...]], dict] = {}
    total_batches = len(batches) * len(RISK_PASSES)
    completed_batches = 0

    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION,
        label="Candidate generation progress",
        input_tokens=totals["input_tokens"],
        output_tokens=totals["output_tokens"],
        total_tokens=totals["total_tokens"],
        payload_json={
            "completed_batches": 0,
            "total_batches": total_batches,
            "risk_categories_total": len(RISK_PASSES),
            "batches_per_category": len(batches),
            "selected_candidates": 0,
        },
    )

    for pass_name in RISK_PASSES:
        pass_candidates: list[dict] = []
        for batch_index, batch_items in enumerate(batches, start=1):
            result, metrics, _ = _run_structured_agent(
                scan=scan,
                agent=agent,
                phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION,
                label=f"Candidate pass {pass_name} batch {batch_index}",
                parent_key=f"{pass_name}:{batch_index}",
                input_payload={
                    "risk_category": pass_name,
                    "chunks": batch_items,
                    "max_candidates": MAX_CANDIDATES_PER_PASS,
                },
                schema_cls=CandidateBatch,
                session_id=f"code-scan-{scan.id}-candidates-{pass_name}-{batch_index}",
                app_name="cyberlens_code_candidates",
                service_name="code_scan_candidate_generation",
                user_id=user_id,
                model_name=model_name,
                api_key=api_key,
            )
            _accumulate_totals(totals, metrics)
            _publish_token_update(scan, totals)
            completed_batches += 1
            record_phase_metric(
                scan,
                phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION,
                label="Candidate generation progress",
                input_tokens=totals["input_tokens"],
                output_tokens=totals["output_tokens"],
                total_tokens=totals["total_tokens"],
                payload_json={
                    "completed_batches": completed_batches,
                    "total_batches": total_batches,
                    "risk_category": pass_name,
                    "batch_index": batch_index,
                    "batches_in_category": len(batches),
                    "current_candidate_hits": len(result.candidates),
                    "deduped_candidates": len(deduped),
                },
            )
            for candidate in result.candidates:
                candidate_dict = candidate.model_dump()
                candidate_dict["category"] = candidate_dict.get("category") or pass_name
                candidate_dict["chunk_refs"] = list(
                    dict.fromkeys(ref for ref in candidate_dict.get("chunk_refs", []) if ref)
                )
                if candidate_dict["chunk_refs"]:
                    pass_candidates.append(candidate_dict)

        pass_candidates.sort(key=_candidate_sort_key, reverse=True)
        for candidate_dict in pass_candidates[:MAX_CANDIDATES_PER_PASS]:
            key = _normalize_candidate_key(
                candidate_dict["category"], candidate_dict["chunk_refs"]
            )
            if key not in deduped or candidate_dict["score"] > deduped[key]["score"]:
                deduped[key] = candidate_dict

    selected = sorted(deduped.values(), key=_candidate_sort_key, reverse=True)[:MAX_TOTAL_CANDIDATES]
    created_candidates = []
    for candidate_dict in selected:
        candidate = CodeScanCandidate.objects.create(
            scan=scan,
            category=candidate_dict["category"],
            label=candidate_dict.get("label") or candidate_dict["category"].replace("_", " ").title(),
            score=candidate_dict["score"],
            severity_hint=candidate_dict.get("severity_hint", "medium"),
            chunk_refs_json=candidate_dict["chunk_refs"],
            rationale=candidate_dict.get("rationale", ""),
            status="candidate",
        )
        created_candidates.append(candidate)
        record_trace_event(
            scan,
            phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION,
            kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
            status="success",
            label=f"Candidate #{candidate.id} created",
            parent_key=f"candidate:{candidate.id}",
            payload_json={
                "candidate_id": candidate.id,
                "category": candidate.category,
                "label": candidate.label,
                "score": candidate.score,
                "severity_hint": candidate.severity_hint,
                "chunk_refs": candidate.chunk_refs_json,
                "rationale": clip_text_preview(candidate.rationale, limit=400),
                "status": candidate.status,
                "verified_finding_id": candidate.verified_finding_id,
            },
        )

    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION,
        label="Candidate generation progress",
        status="success",
        input_tokens=totals["input_tokens"],
        output_tokens=totals["output_tokens"],
        total_tokens=totals["total_tokens"],
        payload_json={
            "completed_batches": completed_batches,
            "total_batches": total_batches,
            "selected_candidates": len(created_candidates),
            "deduped_candidates": len(deduped),
        },
    )

    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CANDIDATE_GENERATION,
        kind=AdkTraceEvent.Kind.STAGE_COMPLETED,
        status="success",
        label="Candidate generation completed",
        input_tokens=totals["input_tokens"] - stage_baseline["input_tokens"],
        output_tokens=totals["output_tokens"] - stage_baseline["output_tokens"],
        total_tokens=totals["total_tokens"] - stage_baseline["total_tokens"],
        duration_ms=int((timezone.now() - stage_started_at).total_seconds() * 1000),
        started_at=stage_started_at,
        ended_at=timezone.now(),
        payload_json={"candidate_count": len(created_candidates)},
    )
    update_scan_phase(
        scan,
        AdkTraceEvent.Phase.CANDIDATE_GENERATION,
        {"candidate_count": len(created_candidates)},
    )
    return created_candidates


def _find_related_chunk_keys(
    candidate: CodeScanCandidate,
    chunk_map: dict[str, CodeScanChunk],
    file_chunks: dict[int, list[CodeScanChunk]],
    module_index: dict[str, CodeScanFileIndex],
) -> list[str]:
    selected_keys = []
    for chunk_key in candidate.chunk_refs_json:
        if chunk_key in chunk_map and chunk_key not in selected_keys:
            selected_keys.append(chunk_key)

    for chunk_key in list(selected_keys):
        chunk = chunk_map.get(chunk_key)
        if not chunk:
            continue
        chunks_for_file = file_chunks.get(chunk.file_index_id, [])
        position = next(
            (index for index, item in enumerate(chunks_for_file) if item.chunk_key == chunk_key),
            None,
        )
        if position is None:
            continue
        for offset in (-1, 1):
            neighbor_index = position + offset
            if 0 <= neighbor_index < len(chunks_for_file):
                neighbor_key = chunks_for_file[neighbor_index].chunk_key
                if neighbor_key not in selected_keys:
                    selected_keys.append(neighbor_key)
                if len(selected_keys) >= MAX_EVIDENCE_CHUNKS:
                    return selected_keys[:MAX_EVIDENCE_CHUNKS]

        for import_name in chunk.file_index.imports_json:
            candidate_key = import_name.split(".")[-1].replace("./", "").replace("/", "")
            if not candidate_key:
                continue
            related_file = module_index.get(candidate_key)
            if related_file:
                related_chunks = file_chunks.get(related_file.id, [])
                if related_chunks:
                    related_chunk_key = related_chunks[0].chunk_key
                    if related_chunk_key not in selected_keys:
                        selected_keys.append(related_chunk_key)
                    if len(selected_keys) >= MAX_EVIDENCE_CHUNKS:
                        return selected_keys[:MAX_EVIDENCE_CHUNKS]
    return selected_keys[:MAX_EVIDENCE_CHUNKS]


def _build_evidence_packs(
    *,
    scan: GitHubScan,
    candidates: list[CodeScanCandidate],
    chunks: list[CodeScanChunk],
    source_files: dict[str, str],
) -> list[dict]:
    stage_started_at = timezone.now()
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
        kind=AdkTraceEvent.Kind.STAGE_STARTED,
        status="running",
        label="Evidence expansion",
        started_at=stage_started_at,
    )
    update_scan_phase(scan, AdkTraceEvent.Phase.EVIDENCE_EXPANSION)

    chunk_map = {chunk.chunk_key: chunk for chunk in chunks}
    file_chunks: dict[int, list[CodeScanChunk]] = defaultdict(list)
    module_index: dict[str, CodeScanFileIndex] = {}
    file_index_map: dict[int, CodeScanFileIndex] = {}
    for chunk in chunks:
        file_chunks[chunk.file_index_id].append(chunk)
        file_index_map[chunk.file_index_id] = chunk.file_index
    for chunk_list in file_chunks.values():
        chunk_list.sort(key=lambda item: item.start_line)
    for file_index in file_index_map.values():
        stem = os.path.splitext(os.path.basename(file_index.path))[0]
        module_index[stem] = file_index

    evidence_packs = []
    total_packs = len(candidates)
    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
        label="Evidence expansion progress",
        payload_json={
            "completed_packs": 0,
            "total_packs": total_packs,
        },
    )
    for candidate in candidates:
        selected_keys = _find_related_chunk_keys(candidate, chunk_map, file_chunks, module_index)
        members = []
        for chunk_key in selected_keys:
            chunk = chunk_map[chunk_key]
            content = source_files.get(chunk.file_index.path, "")
            members.append(
                {
                    "chunk_key": chunk.chunk_key,
                    "file_path": chunk.file_index.path,
                    "line_range": [chunk.start_line, chunk.end_line],
                    "summary": chunk.summary_json.get("summary", ""),
                    "security_signals": chunk.signals_json,
                    "snippet_preview": _get_snippet(content, chunk.start_line, chunk.end_line),
                }
            )

        evidence_pack = {
            "evidence_pack_id": f"candidate-{candidate.id}",
            "candidate_id": candidate.id,
            "category": candidate.category,
            "score": candidate.score,
            "members": members,
            "line_ranges": [member["line_range"] for member in members],
        }
        evidence_packs.append(evidence_pack)
        record_trace_event(
            scan,
            phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
            kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
            status="success",
            label=f"Evidence pack for candidate #{candidate.id}",
            parent_key=f"candidate:{candidate.id}",
            payload_json=evidence_pack,
        )
        record_phase_metric(
            scan,
            phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
            label="Evidence expansion progress",
            payload_json={
                "completed_packs": len(evidence_packs),
                "total_packs": total_packs,
                "candidate_id": candidate.id,
                "member_count": len(members),
            },
        )

    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
        kind=AdkTraceEvent.Kind.STAGE_COMPLETED,
        status="success",
        label="Evidence expansion completed",
        duration_ms=int((timezone.now() - stage_started_at).total_seconds() * 1000),
        started_at=stage_started_at,
        ended_at=timezone.now(),
        payload_json={"evidence_pack_count": len(evidence_packs)},
    )
    update_scan_phase(
        scan,
        AdkTraceEvent.Phase.EVIDENCE_EXPANSION,
        {"evidence_pack_count": len(evidence_packs)},
    )
    return evidence_packs


def _verify_candidates(
    *,
    scan: GitHubScan,
    candidates: list[CodeScanCandidate],
    evidence_packs: list[dict],
    user_id: int | None,
    model_name: str,
    api_key: str,
    totals: dict[str, int],
) -> int:
    stage_started_at = timezone.now()
    stage_baseline = dict(totals)
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.VERIFICATION,
        kind=AdkTraceEvent.Kind.STAGE_STARTED,
        status="running",
        label="Verification",
        started_at=stage_started_at,
    )
    update_scan_phase(scan, AdkTraceEvent.Phase.VERIFICATION)

    evidence_by_candidate = {pack["candidate_id"]: pack for pack in evidence_packs}
    agent = _build_verifier_agent(_build_llm_model(model_name, api_key))
    verified_count = 0
    reviewed_candidates = 0
    rejected_count = 0
    total_candidates = len(candidates)

    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.VERIFICATION,
        label="Verification progress",
        input_tokens=totals["input_tokens"],
        output_tokens=totals["output_tokens"],
        total_tokens=totals["total_tokens"],
        payload_json={
            "reviewed_candidates": 0,
            "total_candidates": total_candidates,
            "confirmed_findings": 0,
            "rejected_candidates": 0,
        },
    )

    for candidate in candidates:
        evidence_pack = evidence_by_candidate.get(candidate.id)
        if not evidence_pack:
            candidate.status = "rejected"
            candidate.save(update_fields=["status"])
            reviewed_candidates += 1
            rejected_count += 1
            record_phase_metric(
                scan,
                phase=AdkTraceEvent.Phase.VERIFICATION,
                label="Verification progress",
                input_tokens=totals["input_tokens"],
                output_tokens=totals["output_tokens"],
                total_tokens=totals["total_tokens"],
                payload_json={
                    "reviewed_candidates": reviewed_candidates,
                    "total_candidates": total_candidates,
                    "confirmed_findings": verified_count,
                    "rejected_candidates": rejected_count,
                    "candidate_id": candidate.id,
                    "decision": "rejected",
                    "reason": "missing_evidence_pack",
                },
            )
            continue

        result, metrics, _ = _run_structured_agent(
            scan=scan,
            agent=agent,
            phase=AdkTraceEvent.Phase.VERIFICATION,
            label=f"Verify candidate #{candidate.id}",
            parent_key=f"candidate:{candidate.id}",
            input_payload={
                "candidate": {
                    "candidate_id": candidate.id,
                    "category": candidate.category,
                    "label": candidate.label,
                    "score": candidate.score,
                    "severity_hint": candidate.severity_hint,
                    "chunk_refs": candidate.chunk_refs_json,
                    "rationale": candidate.rationale,
                },
                "evidence_pack": evidence_pack,
            },
            schema_cls=VerificationDecision,
            session_id=f"code-scan-{scan.id}-verify-{candidate.id}",
            app_name="cyberlens_code_verifier",
            service_name="code_scan_verification",
            user_id=user_id,
            model_name=model_name,
            api_key=api_key,
        )
        _accumulate_totals(totals, metrics)
        _update_scan_token_totals(scan, totals, files_scanned=scan.code_scan_files_scanned)
        _publish_token_update(scan, totals)

        if result.is_real_issue and result.file_path:
            finding = CodeFinding.objects.create(
                scan=scan,
                file_path=result.file_path,
                line_number=result.line_number,
                severity=result.severity,
                category=result.category,
                title=result.title or candidate.label,
                description=result.description or result.dataflow_or_controlflow_explanation,
                code_snippet=result.code_snippet,
                recommendation=result.recommendation,
                explanation=result.dataflow_or_controlflow_explanation,
            )
            candidate.status = "verified"
            candidate.verified_finding = finding
            candidate.save(update_fields=["status", "verified_finding"])
            verified_count += 1
            payload = {
                "decision": "confirmed",
                "candidate_id": candidate.id,
                "category": finding.category,
                "severity": finding.severity,
                "reason": clip_text_preview(
                    result.dataflow_or_controlflow_explanation or result.description, limit=500
                ),
                "finding_ref": finding.id,
                "file_path": finding.file_path,
                "line_number": finding.line_number,
                "title": finding.title,
                "description": clip_text_preview(finding.description, limit=800),
                "recommendation": clip_text_preview(finding.recommendation, limit=800),
                "code_snippet": clip_text_preview(finding.code_snippet, limit=1500),
                "evidence_refs": result.evidence_refs,
            }
        else:
            candidate.status = "rejected"
            candidate.save(update_fields=["status"])
            rejected_count += 1
            payload = {
                "decision": "rejected",
                "candidate_id": candidate.id,
                "category": result.category or candidate.category,
                "severity": result.severity or candidate.severity_hint,
                "reason": clip_text_preview(
                    result.dataflow_or_controlflow_explanation or result.description, limit=500
                ),
                "finding_ref": None,
                "file_path": result.file_path,
                "line_number": result.line_number,
                "title": result.title or candidate.label,
                "description": clip_text_preview(
                    result.description or result.dataflow_or_controlflow_explanation, limit=800
                ),
                "recommendation": clip_text_preview(result.recommendation, limit=800),
                "code_snippet": clip_text_preview(result.code_snippet, limit=1500),
                "evidence_refs": result.evidence_refs,
            }
        reviewed_candidates += 1

        record_trace_event(
            scan,
            phase=AdkTraceEvent.Phase.VERIFICATION,
            kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
            status="success",
            label=f"Verification result for candidate #{candidate.id}",
            parent_key=f"candidate:{candidate.id}",
            payload_json=payload,
        )
        record_phase_metric(
            scan,
            phase=AdkTraceEvent.Phase.VERIFICATION,
            label="Verification progress",
            input_tokens=totals["input_tokens"],
            output_tokens=totals["output_tokens"],
            total_tokens=totals["total_tokens"],
            payload_json={
                "reviewed_candidates": reviewed_candidates,
                "total_candidates": total_candidates,
                "confirmed_findings": verified_count,
                "rejected_candidates": rejected_count,
                "candidate_id": candidate.id,
                "decision": payload["decision"],
            },
        )

    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.VERIFICATION,
        kind=AdkTraceEvent.Kind.STAGE_COMPLETED,
        status="success",
        label="Verification completed",
        input_tokens=totals["input_tokens"] - stage_baseline["input_tokens"],
        output_tokens=totals["output_tokens"] - stage_baseline["output_tokens"],
        total_tokens=totals["total_tokens"] - stage_baseline["total_tokens"],
        duration_ms=int((timezone.now() - stage_started_at).total_seconds() * 1000),
        started_at=stage_started_at,
        ended_at=timezone.now(),
        payload_json={"verified_findings": verified_count},
    )
    update_scan_phase(
        scan,
        AdkTraceEvent.Phase.VERIFICATION,
        {"verified_findings": verified_count},
    )
    return verified_count


def _run_repo_synthesis(
    *,
    scan: GitHubScan,
    candidates: list[CodeScanCandidate],
    verified_count: int,
    user_id: int | None,
    model_name: str,
    api_key: str,
    totals: dict[str, int],
) -> None:
    stage_started_at = timezone.now()
    stage_baseline = dict(totals)
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.REPO_SYNTHESIS,
        kind=AdkTraceEvent.Kind.STAGE_STARTED,
        status="running",
        label="Repository synthesis",
        started_at=stage_started_at,
    )
    update_scan_phase(scan, AdkTraceEvent.Phase.REPO_SYNTHESIS)

    agent = _build_repo_synthesis_agent(_build_llm_model(model_name, api_key))
    findings = list(scan.code_findings.order_by("id"))
    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.REPO_SYNTHESIS,
        label="Repository synthesis progress",
        input_tokens=totals["input_tokens"],
        output_tokens=totals["output_tokens"],
        total_tokens=totals["total_tokens"],
        payload_json={
            "candidate_count": len(candidates),
            "verified_findings": verified_count,
            "finding_count": len(findings),
            "summary_ready": False,
        },
    )
    result, metrics, _ = _run_structured_agent(
        scan=scan,
        agent=agent,
        phase=AdkTraceEvent.Phase.REPO_SYNTHESIS,
        label="Repository synthesis report",
        parent_key="repo_synthesis",
        input_payload={
            "repository": scan.repo_name,
            "candidate_count": len(candidates),
            "verified_findings": verified_count,
            "findings": [
                {
                    "id": finding.id,
                    "title": finding.title,
                    "severity": finding.severity,
                    "category": finding.category,
                    "file_path": finding.file_path,
                    "line_number": finding.line_number,
                }
                for finding in findings
            ],
        },
        schema_cls=RepoSynthesisReport,
        session_id=f"code-scan-{scan.id}-repo-synthesis",
        app_name="cyberlens_code_repo_synthesis",
        service_name="code_scan_repo_synthesis",
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
    )
    _accumulate_totals(totals, metrics)
    _update_scan_token_totals(scan, totals, files_scanned=scan.code_scan_files_scanned)
    _publish_token_update(scan, totals)
    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.REPO_SYNTHESIS,
        label="Repository synthesis progress",
        status="success",
        input_tokens=totals["input_tokens"],
        output_tokens=totals["output_tokens"],
        total_tokens=totals["total_tokens"],
        payload_json={
            "candidate_count": len(candidates),
            "verified_findings": verified_count,
            "finding_count": len(findings),
            "summary_ready": True,
            "hotspot_count": len(result.hotspots),
        },
    )
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.REPO_SYNTHESIS,
        kind=AdkTraceEvent.Kind.ARTIFACT_CREATED,
        status="success",
        label="Repository synthesis summary",
        payload_json={
            "summary": clip_text_preview(result.summary, limit=500),
            "hotspots": result.hotspots,
            "verified_findings": result.verified_findings,
            "candidate_count": result.candidate_count,
        },
    )
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.REPO_SYNTHESIS,
        kind=AdkTraceEvent.Kind.STAGE_COMPLETED,
        status="success",
        label="Repository synthesis completed",
        input_tokens=totals["input_tokens"] - stage_baseline["input_tokens"],
        output_tokens=totals["output_tokens"] - stage_baseline["output_tokens"],
        total_tokens=totals["total_tokens"] - stage_baseline["total_tokens"],
        duration_ms=int((timezone.now() - stage_started_at).total_seconds() * 1000),
        started_at=stage_started_at,
        ended_at=timezone.now(),
        payload_json={"verified_findings": verified_count},
    )
    update_scan_phase(
        scan,
        AdkTraceEvent.Phase.REPO_SYNTHESIS,
        {"repo_summary": clip_text_preview(result.summary, limit=500)},
    )


def _run_code_scan_pipeline(
    scan_id: int,
    source_files: dict[str, str],
    user_id: int | None,
    model_name: str,
    api_key: str,
) -> None:
    scan = GitHubScan.objects.get(id=scan_id)
    scan.code_scan_files_total = len(source_files)
    scan.code_scan_phase = AdkTraceEvent.Phase.CODE_INVENTORY
    scan.save(
        update_fields=[
            "code_scan_files_total",
            "code_scan_phase",
        ]
    )

    publish_code_scan_stream(
        {
            "scan_id": scan.id,
            "type": "scan_start",
            "total_files": len(source_files),
        }
    )

    inventory_started_at = timezone.now()
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CODE_INVENTORY,
        kind=AdkTraceEvent.Kind.STAGE_STARTED,
        status="running",
        label="Code inventory",
        started_at=inventory_started_at,
    )
    update_scan_phase(scan, AdkTraceEvent.Phase.CODE_INVENTORY)
    file_indexes = _create_file_indexes(scan, source_files)
    record_phase_metric(
        scan,
        phase=AdkTraceEvent.Phase.CODE_INVENTORY,
        status="success",
        label="Indexed source files",
        payload_json={"indexed_files": len(file_indexes), "total_files": len(source_files)},
    )
    record_trace_event(
        scan,
        phase=AdkTraceEvent.Phase.CODE_INVENTORY,
        kind=AdkTraceEvent.Kind.STAGE_COMPLETED,
        status="success",
        label="Code inventory completed",
        duration_ms=int((timezone.now() - inventory_started_at).total_seconds() * 1000),
        started_at=inventory_started_at,
        ended_at=timezone.now(),
        payload_json={"indexed_files": len(file_indexes), "total_files": len(source_files)},
    )
    update_scan_phase(
        scan,
        AdkTraceEvent.Phase.CODE_INVENTORY,
        {"indexed_files": len(file_indexes), "total_files": len(source_files)},
    )

    if not file_indexes:
        record_trace_event(
            scan,
            phase=AdkTraceEvent.Phase.CHUNK_SUMMARY,
            kind=AdkTraceEvent.Kind.WARNING,
            status="warning",
            label="No source files found",
            text_preview="No source files found for code security scan",
        )
        publish_code_scan_stream(
            {
                "scan_id": scan.id,
                "type": "scan_summary",
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "files_scanned": 0,
                "total_findings": 0,
            }
        )
        return

    totals = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    chunks = _summarize_chunks(
        scan=scan,
        source_files=source_files,
        file_indexes=file_indexes,
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
        totals=totals,
    )
    candidates = _generate_candidates(
        scan=scan,
        chunks=chunks,
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
        totals=totals,
    )
    evidence_packs = _build_evidence_packs(
        scan=scan,
        candidates=candidates,
        chunks=chunks,
        source_files=source_files,
    )
    verified_count = _verify_candidates(
        scan=scan,
        candidates=candidates,
        evidence_packs=evidence_packs,
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
        totals=totals,
    )
    _run_repo_synthesis(
        scan=scan,
        candidates=candidates,
        verified_count=verified_count,
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
        totals=totals,
    )

    publish_code_scan_stream(
        {
            "scan_id": scan.id,
            "type": "scan_summary",
            "input_tokens": totals["input_tokens"],
            "output_tokens": totals["output_tokens"],
            "total_tokens": totals["total_tokens"],
            "files_scanned": scan.code_scan_files_scanned,
            "total_findings": verified_count,
        }
    )


def scan_code_security_github(
    scan_id: int,
    pat: str,
    repo_full_name: str,
    user_id: int | None = None,
) -> None:
    from cyberlens.utils import (
        get_google_api_key,
        get_user_gemini_model,
        probe_gemini_api_connection,
    )

    scan = GitHubScan.objects.get(id=scan_id)
    _reset_code_scan_state(scan)
    api_key = get_google_api_key(user_id=user_id)
    model_name = get_user_gemini_model(user_id)
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping code security scan")
        _record_code_inventory_terminal_warning(
            scan,
            label="Missing Google API key",
            detail="GOOGLE_API_KEY not set, skipping code security scan",
            reason="missing_api_key",
        )
        return

    api_probe = probe_gemini_api_connection(api_key)
    if not api_probe["success"]:
        logger.warning("Gemini API unavailable for code security scan: %s", api_probe["message"])
        _record_code_inventory_terminal_warning(
            scan,
            label="Gemini API unavailable",
            detail=str(api_probe["message"]),
            reason=str(api_probe["error_type"] or "api_unavailable"),
            payload_json={"api_probe": api_probe},
        )
        return

    source_files = get_github_source_files(pat, repo_full_name)
    if not source_files:
        logger.info("No source files found in GitHub repo for code security scan")
        _record_code_inventory_terminal_warning(
            scan,
            label="No source files found",
            detail="No source files found in GitHub repo for code security scan",
            reason="no_source_files",
            payload_json={"repository": repo_full_name},
        )
        return

    _run_code_scan_pipeline(
        scan_id,
        source_files,
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
    )


def scan_code_security(scan_id: int, dir_path: str, user_id: int | None = None) -> None:
    from cyberlens.utils import (
        get_google_api_key,
        get_user_gemini_model,
        probe_gemini_api_connection,
    )
    from .local_client import get_source_files as get_local_source_files

    scan = GitHubScan.objects.get(id=scan_id)
    _reset_code_scan_state(scan)
    api_key = get_google_api_key(user_id=user_id)
    model_name = get_user_gemini_model(user_id)
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping code security scan")
        _record_code_inventory_terminal_warning(
            scan,
            label="Missing Google API key",
            detail="GOOGLE_API_KEY not set, skipping code security scan",
            reason="missing_api_key",
        )
        return

    api_probe = probe_gemini_api_connection(api_key)
    if not api_probe["success"]:
        logger.warning("Gemini API unavailable for code security scan: %s", api_probe["message"])
        _record_code_inventory_terminal_warning(
            scan,
            label="Gemini API unavailable",
            detail=str(api_probe["message"]),
            reason=str(api_probe["error_type"] or "api_unavailable"),
            payload_json={"api_probe": api_probe},
        )
        return

    try:
        source_files = get_local_source_files(dir_path)
    except (ValueError, FileNotFoundError) as exc:
        logger.warning("Cannot read source files: %s", exc)
        _record_code_inventory_terminal_warning(
            scan,
            label="Failed to read source files",
            detail=str(exc),
            reason="read_source_files_failed",
        )
        return

    if not source_files:
        logger.info("No source files found for code security scan")
        _record_code_inventory_terminal_warning(
            scan,
            label="No source files found",
            detail="No source files found for code security scan",
            reason="no_source_files",
            payload_json={"directory": dir_path},
        )
        return

    _run_code_scan_pipeline(
        scan_id,
        source_files,
        user_id=user_id,
        model_name=model_name,
        api_key=api_key,
    )
