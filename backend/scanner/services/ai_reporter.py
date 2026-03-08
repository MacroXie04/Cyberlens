import json
import logging
import os
from typing import Optional
from pydantic import BaseModel, Field
from google.adk import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types
from scanner.models import GitHubScan, AiReport

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are a software security expert. Analyze dependency vulnerability data
and generate a comprehensive risk assessment report.

Consider vulnerability severity, exploitability, dependency depth, and attack surface
when prioritizing fixes. Provide actionable remediation guidance with specific upgrade commands."""


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
    security_score: int = Field(description="Overall security score 0-100 (100 = no vulnerabilities)", ge=0, le=100)
    executive_summary: str = Field(description="2-3 sentence plain-language assessment")
    priority_ranking: list[PriorityItem] = Field(description="Ordered list of which vulnerabilities to fix first")
    remediation: Remediation = Field(description="Categorized remediation actions")


# Create the security report agent
report_agent = Agent(
    name="security_reporter",
    model="gemini-2.5-flash",
    instruction=SYSTEM_INSTRUCTION,
    output_schema=SecurityReport,
    generate_content_config=types.GenerateContentConfig(
        temperature=0.3,
    ),
)


def generate_report(scan: GitHubScan):
    """Generate AI-powered risk assessment using Google ADK with Gemini."""
    from cyberlens.utils import get_google_api_key
    api_key = get_google_api_key()
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping AI report")
        return

    os.environ["GOOGLE_API_KEY"] = api_key

    # Gather vulnerability data
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

    if not vuln_data:
        AiReport.objects.create(
            scan=scan,
            executive_summary="No vulnerabilities detected. All dependencies appear to be secure.",
            priority_ranking=[],
            remediation_json={"immediate": [], "short_term": [], "long_term": ["Continue regular dependency updates"]},
        )
        scan.security_score = 100
        scan.save()
        return

    try:
        runner = InMemoryRunner(agent=report_agent, app_name="cyberlens_report")

        input_data = json.dumps(
            {
                "repository": scan.repo_name,
                "total_dependencies": scan.total_deps,
                "vulnerable_dependencies": scan.vulnerable_deps,
                "vulnerabilities": vuln_data,
            }
        )

        response_text = ""
        for event in runner.run(
            user_id="system",
            session_id=f"scan-{scan.id}",
            new_message=types.UserContent(
                parts=[types.Part(text=input_data)]
            ),
        ):
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        from cyberlens.utils import clean_json_response
        result = SecurityReport.model_validate_json(clean_json_response(response_text))

        scan.security_score = result.security_score
        scan.save()

        AiReport.objects.create(
            scan=scan,
            executive_summary=result.executive_summary,
            priority_ranking=[item.model_dump() for item in result.priority_ranking],
            remediation_json=result.remediation.model_dump(),
        )

    except Exception:
        logger.exception("AI report generation failed")
