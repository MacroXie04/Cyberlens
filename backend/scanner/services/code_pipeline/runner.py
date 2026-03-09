import json
import logging
import time

from google.adk.agents.run_config import StreamingMode
from google.adk.runners import InMemoryRunner, RunConfig
from google.genai import types

from scanner.models import AdkTraceEvent, GitHubScan

from ..adk_trace import clip_text_preview, record_trace_event

logger = logging.getLogger(__name__)


def classify_adk_error(exc: Exception) -> dict[str, str | bool]:
    message = str(exc).strip() or exc.__class__.__name__
    lower = message.lower()
    if any(token in lower for token in ["429", "quota", "resource_exhausted", "rate limit", "too many requests"]):
        return {"error_type": "quota_exceeded", "label": "Gemini API quota exceeded", "should_probe": True, "message": message}
    if any(token in lower for token in ["api key", "permission", "forbidden", "unauth", "authentication"]):
        return {"error_type": "api_auth_error", "label": "Gemini API authentication failed", "should_probe": True, "message": message}
    return {"error_type": "agent_error", "label": "ADK agent failed", "should_probe": False, "message": message}


def run_structured_agent(*, scan: GitHubScan, agent, phase: str, label: str, parent_key: str, input_payload: dict, schema_cls, session_id: str, app_name: str, service_name: str, user_id: int | None, model_name: str, api_key: str, publish_stream, code_stream_meta: dict | None = None):
    from cyberlens.utils import clean_json_response, log_gemini_call, probe_gemini_api_connection

    input_text = json.dumps(input_payload)
    runner = InMemoryRunner(agent=agent, app_name=app_name)
    runner.auto_create_session = True
    response_text = ""
    metrics = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    start_time = time.time()

    try:
        for event in runner.run(user_id="system", session_id=session_id, new_message=types.UserContent(parts=[types.Part(text=input_text)]), run_config=RunConfig(streaming_mode=StreamingMode.SSE)):
            if event.partial and event.content:
                partial_text = "".join(part.text for part in getattr(event.content, "parts", None) or [] if getattr(part, "text", ""))
                if partial_text:
                    record_trace_event(scan, phase=phase, kind=AdkTraceEvent.Kind.LLM_PARTIAL, status="running", label=label, parent_key=parent_key, text_preview=partial_text)
                    if code_stream_meta:
                        publish_stream({"scan_id": scan.id, "type": "chunk", "file_path": code_stream_meta["file_path"], "file_index": code_stream_meta["file_index"], "total_files": code_stream_meta["total_files"], "text": partial_text})
            if event.is_final_response() and event.content:
                response_text += "".join(part.text for part in getattr(event.content, "parts", None) or [] if getattr(part, "text", ""))
            if getattr(event, "usage_metadata", None):
                meta = event.usage_metadata
                metrics = {"input_tokens": int(getattr(meta, "prompt_token_count", 0) or 0), "output_tokens": int(getattr(meta, "candidates_token_count", 0) or 0), "total_tokens": int(getattr(meta, "total_token_count", 0) or 0)}

        record_trace_event(scan, phase=phase, kind=AdkTraceEvent.Kind.LLM_COMPLETED, status="success", label=label, parent_key=parent_key, input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], text_preview=response_text)
        parsed = schema_cls() if not clean_json_response(response_text) else schema_cls.model_validate_json(clean_json_response(response_text))
        log_gemini_call(user_id=user_id, service=service_name, related_object_id=scan.id, model_name=model_name, prompt_summary=clip_text_preview(input_text), response_summary=clip_text_preview(response_text), input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], status="success", duration_ms=int((time.time() - start_time) * 1000))
        return parsed, metrics, response_text
    except Exception as exc:
        duration_ms = int((time.time() - start_time) * 1000)
        error_info = classify_adk_error(exc)
        api_probe = probe_gemini_api_connection(api_key) if error_info["should_probe"] else None
        payload = {"error_type": error_info["error_type"], "error_message": clip_text_preview(str(exc), limit=500), "recommended_worker_concurrency": 2, "recommended_fetch_workers": 2}
        if api_probe:
            payload["api_probe"] = api_probe
        logger.exception("%s failed for scan %s", service_name, scan.id)
        record_trace_event(scan, phase=phase, kind=AdkTraceEvent.Kind.ERROR, status="error", label=str(error_info["label"]), parent_key=parent_key, input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], duration_ms=duration_ms, text_preview=clip_text_preview(str(exc), limit=1000) or response_text, payload_json=payload)
        publish_stream({"scan_id": scan.id, "type": "warning", "message": api_probe["message"] if api_probe else f"{error_info['label']}: {clip_text_preview(str(exc), limit=300)}", "error": str(error_info["error_type"]), "input_tokens": scan.code_scan_input_tokens, "output_tokens": scan.code_scan_output_tokens, "total_tokens": scan.code_scan_total_tokens, "files_scanned": scan.code_scan_files_scanned, "total_files": scan.code_scan_files_total})
        log_gemini_call(user_id=user_id, service=service_name, related_object_id=scan.id, model_name=model_name, prompt_summary=clip_text_preview(input_text), response_summary=clip_text_preview(response_text), input_tokens=metrics["input_tokens"], output_tokens=metrics["output_tokens"], total_tokens=metrics["total_tokens"], status="error", error_message=clip_text_preview(str(exc), limit=500), duration_ms=duration_ms)
        raise
