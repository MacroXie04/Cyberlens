import logging

from django.utils import timezone

from .agent import run_report_agent
from .stages.context import build_report_input, collect_vulnerability_data
from .stages.input_stage import record_dependency_input_stage, reset_dependency_report_state
from .stages.report_stage import (
    create_clean_report,
    mark_api_probe_failure,
    mark_missing_api_key,
    record_report_failure,
    record_report_success,
)
from .schemas import SecurityReport

logger = logging.getLogger(__name__)


def generate_report_service(
    scan,
    *,
    user_id: int | None,
    runner_cls,
    model_builder,
) -> None:
    from cyberlens.utils import (
        clean_json_response,
        get_google_api_key,
        get_user_gemini_model,
        log_gemini_call,
        probe_gemini_api_connection,
    )

    reset_dependency_report_state(scan)
    vuln_data = collect_vulnerability_data(scan)
    record_dependency_input_stage(scan, vuln_data)

    api_key = get_google_api_key(user_id=user_id)
    model_name = get_user_gemini_model(user_id)
    if not api_key:
        mark_missing_api_key(scan, vuln_data)
        return

    api_probe = probe_gemini_api_connection(api_key)
    if not api_probe["success"]:
        mark_api_probe_failure(scan, api_probe)
        return

    if not vuln_data:
        create_clean_report(scan)
        return

    started_at = timezone.now()
    input_data = build_report_input(scan, vuln_data)
    response_text = ""
    metrics = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

    try:
        response_text, metrics, duration_ms = run_report_agent(
            runner_cls=runner_cls,
            model_builder=model_builder,
            scan=scan,
            input_data=input_data,
            model_name=model_name,
            api_key=api_key,
        )
        result = SecurityReport.model_validate_json(clean_json_response(response_text))
        record_report_success(
            scan,
            result,
            vuln_data,
            metrics,
            response_text,
            duration_ms,
            started_at,
        )
        log_gemini_call(
            user_id=user_id,
            service="security_report",
            related_object_id=scan.id,
            model_name=model_name,
            prompt_summary=input_data[:400],
            response_summary=response_text[:400],
            input_tokens=metrics["input_tokens"],
            output_tokens=metrics["output_tokens"],
            total_tokens=metrics["total_tokens"],
            status="success",
            duration_ms=duration_ms,
        )
    except Exception:
        duration_ms = 0
        record_report_failure(
            scan,
            vuln_data,
            metrics,
            response_text,
            duration_ms,
            started_at,
        )
        log_gemini_call(
            user_id=user_id,
            service="security_report",
            related_object_id=scan.id,
            model_name=model_name,
            prompt_summary=input_data[:400],
            response_summary=response_text[:400],
            input_tokens=metrics["input_tokens"],
            output_tokens=metrics["output_tokens"],
            total_tokens=metrics["total_tokens"],
            status="error",
            error_message="AI report generation failed",
            duration_ms=duration_ms,
        )
