import json
import logging
import time

from django.utils import timezone
from google.adk import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import BaseModel, Field

from scanner.models import AiReport, GitHubScan

from .adk_trace import clip_text_preview, record_phase_metric, record_trace_event
from .adk_code_pipeline import _build_llm_model

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are a software security expert. Analyze dependency vulnerability data
and generate a comprehensive risk assessment report.

Consider vulnerability severity, exploitability, dependency depth, and attack surface
when prioritizing fixes. Provide actionable remediation guidance with specific upgrade commands."""


def _coerce_token_count(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


class PriorityItem(BaseModel):
    package: str = Field(description="Package name")
    cve: str = Field(description="CVE or OSV identifier")
    severity: str = Field(description="One of: critical, high, medium, low")
    action: str = Field(description="Recommended remediation action")


class Remediation(BaseModel):
    immediate: list[str] = Field(description="Actions to take now")
    short_term: list[str] = Field(description="Actions for this sprint")
    long_term: list[str] = Field(description="Ongoing improvements")


class SecurityReport(BaseModel):
    security_score: int = Field(
        description="Overall security score 0-100 (100 = no vulnerabilities)", ge=0, le=100
    )
    executive_summary: str = Field(description="2-3 sentence plain-language assessment")
    priority_ranking: list[PriorityItem] = Field(
        description="Ordered list of which vulnerabilities to fix first"
    )
    remediation: Remediation = Field(description="Categorized remediation actions")


def _build_report_agent(model) -> Agent:
    return Agent(
        name="security_reporter",
        model=model,
        instruction=SYSTEM_INSTRUCTION,
        output_schema=SecurityReport,
        generate_content_config=types.GenerateContentConfig(
            temperature=0.3,
        ),
    )


def generate_report(scan: GitHubScan, user_id: int | None = None):
    """Generate AI-powered risk assessment using Google ADK with Gemini."""
    from cyberlens.utils import (
        clean_json_response,
        get_google_api_key,
        get_user_gemini_model,
        log_gemini_call,
        probe_gemini_api_connection,
    )

    scan.adk_trace_events.filter(
        phase__in=["dependency_input", "dependency_adk_report"]
    ).delete()
    AiReport.objects.filter(scan=scan).delete()

    dependency_input_started_at = timezone.now()
    record_trace_event(
        scan,
        phase="dependency_input",
        kind="stage_started",
        status="running",
        label="Build dependency risk input",
        started_at=dependency_input_started_at,
    )

    vuln_data = []
    for dep in scan.dependencies.filter(is_vulnerable=True):
        for vuln in dep.vulnerabilities.all():
            vuln_data.append(
                {
                    "package": dep.name,
                    "version": dep.version,
                    "ecosystem": dep.ecosystem,
                    "cve_id": vuln.cve_id,
                    "osv_id": vuln.osv_id,
                    "cvss_score": vuln.cvss_score,
                    "severity": vuln.severity,
                    "summary": vuln.summary,
                    "fixed_version": vuln.fixed_version,
                }
            )

    record_trace_event(
        scan,
        phase="dependency_input",
        kind="artifact_created",
        status="success",
        label="Dependency vulnerability batch",
        payload_json={
            "batch_index": 1,
            "batch_size": len(vuln_data),
            "vulnerability_count": len(vuln_data),
            "repository": scan.repo_name,
        },
    )
    record_phase_metric(
        scan,
        phase="dependency_input",
        label="Dependency input metrics",
        status="success",
        update_scan_stats=False,
        payload_json={
            "total_dependencies": scan.total_deps,
            "vulnerable_dependencies": scan.vulnerable_deps,
            "vulnerability_count": len(vuln_data),
            "repository": scan.repo_name,
        },
    )
    record_trace_event(
        scan,
        phase="dependency_input",
        kind="stage_completed",
        status="success",
        label="Built dependency risk input",
        payload_json={
            "repository": scan.repo_name,
            "total_dependencies": scan.total_deps,
            "vulnerable_dependencies": scan.vulnerable_deps,
            "vulnerability_count": len(vuln_data),
        },
        duration_ms=int((timezone.now() - dependency_input_started_at).total_seconds() * 1000),
        started_at=dependency_input_started_at,
        ended_at=timezone.now(),
    )

    api_key = get_google_api_key(user_id=user_id)
    model_name = get_user_gemini_model(user_id)
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping AI report")
        started_at = timezone.now()
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_started",
            status="running",
            label="Dependency ADK report",
            started_at=started_at,
        )
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="warning",
            status="warning",
            label="Missing Google API key",
            text_preview="GOOGLE_API_KEY not set, skipping AI report",
        )
        record_phase_metric(
            scan,
            phase="dependency_adk_report",
            label="Dependency report skipped",
            status="warning",
            update_scan_stats=False,
            payload_json={
                "repository": scan.repo_name,
                "skip_reason": "missing_google_api_key",
                "vulnerability_count": len(vuln_data),
            },
        )
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_completed",
            status="warning",
            label="Dependency ADK report skipped",
            duration_ms=0,
            started_at=started_at,
            ended_at=timezone.now(),
        )
        return

    api_probe = probe_gemini_api_connection(api_key)
    if not api_probe["success"]:
        started_at = timezone.now()
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_started",
            status="running",
            label="Dependency ADK report",
            started_at=started_at,
        )
        record_phase_metric(
            scan,
            phase="dependency_adk_report",
            label="Dependency ADK API check",
            status="warning",
            update_scan_stats=False,
            payload_json={"api_probe": api_probe},
        )
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="warning",
            status="warning",
            label="Gemini API unavailable",
            text_preview=str(api_probe["message"]),
            payload_json={"api_probe": api_probe},
        )
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_completed",
            status="warning",
            label="Dependency ADK report skipped",
            duration_ms=0,
            started_at=started_at,
            ended_at=timezone.now(),
        )
        return

    if not vuln_data:
        started_at = timezone.now()
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_started",
            status="running",
            label="Dependency ADK report",
            started_at=started_at,
        )
        AiReport.objects.create(
            scan=scan,
            executive_summary="No vulnerabilities detected. All dependencies appear to be secure.",
            priority_ranking=[],
            remediation_json={
                "immediate": [],
                "short_term": [],
                "long_term": ["Continue regular dependency updates"],
            },
        )
        scan.security_score = 100
        scan.dependency_score = 100
        scan.save(update_fields=["security_score", "dependency_score"])
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="artifact_created",
            status="success",
            label="Dependency report stored",
            payload_json={
                "batch_index": 1,
                "batch_size": 0,
                "vulnerability_count": 0,
                "security_score": 100,
            },
        )
        record_phase_metric(
            scan,
            phase="dependency_adk_report",
            label="Dependency report metrics",
            status="success",
            update_scan_stats=False,
            payload_json={
                "batch_index": 1,
                "batch_size": 0,
                "vulnerability_count": 0,
                "security_score": 100,
                "priority_count": 0,
            },
        )
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_completed",
            status="success",
            label="Dependency ADK report completed without vulnerabilities",
            duration_ms=int((timezone.now() - started_at).total_seconds() * 1000),
            started_at=started_at,
            ended_at=timezone.now(),
        )
        return

    stage_started_at = timezone.now()
    record_trace_event(
        scan,
        phase="dependency_adk_report",
        kind="stage_started",
        status="running",
        label="Dependency ADK report",
        started_at=stage_started_at,
    )

    start_time = time.time()
    input_data = json.dumps(
        {
            "repository": scan.repo_name,
            "total_dependencies": scan.total_deps,
            "vulnerable_dependencies": scan.vulnerable_deps,
            "vulnerabilities": vuln_data,
        }
    )
    response_text = ""
    input_tokens = 0
    output_tokens = 0
    total_tokens = 0

    try:
        agent = _build_report_agent(_build_llm_model(model_name, api_key))
        runner = InMemoryRunner(agent=agent, app_name="cyberlens_report")
        runner.auto_create_session = True

        for event in runner.run(
            user_id="system",
            session_id=f"scan-{scan.id}",
            new_message=types.UserContent(parts=[types.Part(text=input_data)]),
        ):
            if event.partial and event.content:
                parts = getattr(event.content, "parts", None) or []
                partial_text = "".join(
                    part.text for part in parts if getattr(part, "text", "")
                )
                if partial_text:
                    record_trace_event(
                        scan,
                        phase="dependency_adk_report",
                        kind="llm_partial",
                        status="running",
                        label="Dependency ADK partial",
                        text_preview=partial_text,
                    )
            if event.is_final_response() and event.content:
                for part in getattr(event.content, "parts", None) or []:
                    if part.text:
                        response_text += part.text
            if hasattr(event, "usage_metadata") and event.usage_metadata:
                meta = event.usage_metadata
                input_tokens = _coerce_token_count(
                    getattr(meta, "prompt_token_count", 0)
                )
                output_tokens = _coerce_token_count(
                    getattr(meta, "candidates_token_count", 0)
                )
                total_tokens = _coerce_token_count(
                    getattr(meta, "total_token_count", 0)
                )

        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="llm_completed",
            status="success",
            label="Dependency ADK response",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            text_preview=response_text,
        )

        result = SecurityReport.model_validate_json(clean_json_response(response_text))

        scan.security_score = result.security_score
        scan.dependency_score = result.security_score
        scan.save(update_fields=["security_score", "dependency_score"])

        AiReport.objects.create(
            scan=scan,
            executive_summary=result.executive_summary,
            priority_ranking=[item.model_dump() for item in result.priority_ranking],
            remediation_json=result.remediation.model_dump(),
        )

        duration_ms = int((time.time() - start_time) * 1000)
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="artifact_created",
            status="success",
            label="Dependency report stored",
            payload_json={
                "batch_index": 1,
                "batch_size": len(vuln_data),
                "vulnerability_count": len(vuln_data),
                "security_score": result.security_score,
                "priority_count": len(result.priority_ranking),
                "summary_preview": clip_text_preview(result.executive_summary, limit=300),
            },
        )
        record_phase_metric(
            scan,
            phase="dependency_adk_report",
            label="Dependency report metrics",
            status="success",
            update_scan_stats=False,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            payload_json={
                "batch_index": 1,
                "batch_size": len(vuln_data),
                "vulnerability_count": len(vuln_data),
                "security_score": result.security_score,
                "priority_count": len(result.priority_ranking),
            },
        )
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_completed",
            status="success",
            label="Dependency ADK report completed",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            duration_ms=duration_ms,
            started_at=stage_started_at,
            ended_at=timezone.now(),
        )

        log_gemini_call(
            user_id=user_id,
            service="security_report",
            related_object_id=scan.id,
            model_name=model_name,
            prompt_summary=clip_text_preview(input_data),
            response_summary=clip_text_preview(response_text),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            status="success",
            duration_ms=duration_ms,
        )

    except Exception:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.exception("AI report generation failed")
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="error",
            status="error",
            label="Dependency ADK report failed",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            duration_ms=duration_ms,
            text_preview=response_text,
            payload_json={
                "repository": scan.repo_name,
                "vulnerability_count": len(vuln_data),
            },
        )
        record_phase_metric(
            scan,
            phase="dependency_adk_report",
            label="Dependency report failed",
            status="error",
            update_scan_stats=False,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            payload_json={
                "repository": scan.repo_name,
                "vulnerability_count": len(vuln_data),
                "error": "dependency_report_failed",
            },
        )
        record_trace_event(
            scan,
            phase="dependency_adk_report",
            kind="stage_completed",
            status="error",
            label="Dependency ADK report failed",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            duration_ms=duration_ms,
            started_at=stage_started_at,
            ended_at=timezone.now(),
        )
        log_gemini_call(
            user_id=user_id,
            service="security_report",
            related_object_id=scan.id,
            model_name=model_name,
            prompt_summary=clip_text_preview(input_data),
            response_summary=clip_text_preview(response_text),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            status="error",
            error_message="AI report generation failed",
            duration_ms=duration_ms,
        )
