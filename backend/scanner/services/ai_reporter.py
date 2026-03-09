from google.adk.runners import InMemoryRunner
from .adk_code_pipeline import _build_llm_model
from scanner.models import GitHubScan

from .ai_reporting import SecurityReport, generate_report_service


def generate_report(scan: GitHubScan, user_id: int | None = None):
    """Generate AI-powered risk assessment using Google ADK with Gemini."""
    return generate_report_service(
        scan,
        user_id=user_id,
        runner_cls=InMemoryRunner,
        model_builder=_build_llm_model,
    )


__all__ = ["InMemoryRunner", "SecurityReport", "generate_report"]
