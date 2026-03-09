from google.adk import Agent
from google.genai import types
from pydantic import BaseModel, Field

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
    security_score: int = Field(
        description="Overall security score 0-100 (100 = no vulnerabilities)", ge=0, le=100
    )
    executive_summary: str = Field(description="2-3 sentence plain-language assessment")
    priority_ranking: list[PriorityItem] = Field(
        description="Ordered list of which vulnerabilities to fix first"
    )
    remediation: Remediation = Field(description="Categorized remediation actions")


def build_report_agent(model) -> Agent:
    return Agent(
        name="security_reporter",
        model=model,
        instruction=SYSTEM_INSTRUCTION,
        output_schema=SecurityReport,
        generate_content_config=types.GenerateContentConfig(temperature=0.3),
    )
