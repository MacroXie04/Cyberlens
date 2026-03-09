import logging

from monitor.services.redis_publisher import publish_code_scan_stream
from scanner.models import GitHubScan

from .code_pipeline import CandidateBatch, CandidateSpec, ChunkSummary, FAST_SCAN_PROFILE, FULL_SCAN_PROFILE, RepoSynthesisReport, VerificationDecision, get_runtime_scan_profile, get_scan_profile
from .code_pipeline.inventory import reset_code_scan_state, select_source_files
from .code_pipeline.llm import build_llm_model, resolve_model_name
from .code_pipeline.orchestrator import run_code_scan_pipeline_service
from .code_pipeline.progress import record_code_inventory_terminal_warning
from .code_pipeline.runner import run_structured_agent as _run_structured_agent_impl
from .github_client import get_source_files as get_github_source_files

logger = logging.getLogger(__name__)


def _get_runtime_scan_profile(profile, *, database_vendor: str | None = None):
    return get_runtime_scan_profile(profile, database_vendor=database_vendor)


def _build_llm_model(model_name: str, api_key: str):
    return build_llm_model(model_name, api_key)


def _run_structured_agent(*, scan, agent, phase: str, label: str, parent_key: str, input_payload: dict, schema_cls, session_id: str, app_name: str, service_name: str, user_id: int | None, model_name: str, api_key: str, code_stream_meta: dict | None = None):
    return _run_structured_agent_impl(scan=scan, agent=agent, phase=phase, label=label, parent_key=parent_key, input_payload=input_payload, schema_cls=schema_cls, session_id=session_id, app_name=app_name, service_name=service_name, user_id=user_id, model_name=model_name, api_key=api_key, publish_stream=publish_code_scan_stream, code_stream_meta=code_stream_meta)


def _run_code_scan_pipeline(scan_id: int, source_files: dict[str, str], profile, user_id: int | None, model_name: str, api_key: str) -> None:
    return run_code_scan_pipeline_service(scan_id, source_files, profile, user_id, model_name, api_key, run_structured_agent=_run_structured_agent, publish_stream=publish_code_scan_stream)


def _prepare_scan_context(scan_id: int, user_id: int | None):
    from cyberlens.utils import get_google_api_key, probe_gemini_api_connection

    scan = GitHubScan.objects.get(id=scan_id)
    reset_code_scan_state(scan)
    profile = _get_runtime_scan_profile(get_scan_profile(scan.scan_mode))
    api_key = get_google_api_key(user_id=user_id)
    model_name = resolve_model_name(user_id, profile)
    return scan, profile, api_key, model_name, probe_gemini_api_connection


def _handle_scan_prerequisites(scan, api_key: str, probe_fn, *, detail_payload: dict | None = None):
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping code security scan")
        record_code_inventory_terminal_warning(scan, label="Missing Google API key", detail="GOOGLE_API_KEY not set, skipping code security scan", reason="missing_api_key", publish_stream=publish_code_scan_stream)
        return False
    api_probe = probe_fn(api_key)
    if not api_probe["success"]:
        logger.warning("Gemini API unavailable for code security scan: %s", api_probe["message"])
        record_code_inventory_terminal_warning(scan, label="Gemini API unavailable", detail=str(api_probe["message"]), reason=str(api_probe["error_type"] or "api_unavailable"), publish_stream=publish_code_scan_stream, payload_json={"api_probe": api_probe, **(detail_payload or {})})
        return False
    return True


def scan_code_security_github(scan_id: int, pat: str, repo_full_name: str, user_id: int | None = None) -> None:
    scan, profile, api_key, model_name, probe_fn = _prepare_scan_context(scan_id, user_id)
    if not _handle_scan_prerequisites(scan, api_key, probe_fn):
        return
    source_files = select_source_files(get_github_source_files(pat, repo_full_name, max_workers=profile.github_fetch_workers), profile)
    if not source_files:
        logger.info("No source files found in GitHub repo for code security scan")
        record_code_inventory_terminal_warning(scan, label="No source files found", detail="No source files found in GitHub repo for code security scan", reason="no_source_files", publish_stream=publish_code_scan_stream, payload_json={"repository": repo_full_name})
        return
    _run_code_scan_pipeline(scan_id, source_files, profile, user_id=user_id, model_name=model_name, api_key=api_key)


def scan_code_security(scan_id: int, dir_path: str, user_id: int | None = None) -> None:
    from .local_client import get_source_files as get_local_source_files

    scan, profile, api_key, model_name, probe_fn = _prepare_scan_context(scan_id, user_id)
    if not _handle_scan_prerequisites(scan, api_key, probe_fn):
        return
    try:
        source_files = get_local_source_files(dir_path)
    except (ValueError, FileNotFoundError) as exc:
        logger.warning("Cannot read source files: %s", exc)
        record_code_inventory_terminal_warning(scan, label="Failed to read source files", detail=str(exc), reason="read_source_files_failed", publish_stream=publish_code_scan_stream)
        return
    source_files = select_source_files(source_files, profile)
    if not source_files:
        logger.info("No source files found for code security scan")
        record_code_inventory_terminal_warning(scan, label="No source files found", detail="No source files found for code security scan", reason="no_source_files", publish_stream=publish_code_scan_stream, payload_json={"directory": dir_path})
        return
    _run_code_scan_pipeline(scan_id, source_files, profile, user_id=user_id, model_name=model_name, api_key=api_key)


__all__ = [
    "CandidateBatch",
    "CandidateSpec",
    "ChunkSummary",
    "FAST_SCAN_PROFILE",
    "FULL_SCAN_PROFILE",
    "RepoSynthesisReport",
    "VerificationDecision",
    "_build_llm_model",
    "_get_runtime_scan_profile",
    "_run_code_scan_pipeline",
    "_run_structured_agent",
    "get_github_source_files",
    "publish_code_scan_stream",
    "scan_code_security",
    "scan_code_security_github",
]
