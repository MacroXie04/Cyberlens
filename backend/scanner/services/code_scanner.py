import json
import logging
import os
from pydantic import BaseModel, Field
from google.adk import Agent
from google.adk.runners import InMemoryRunner
from google.genai import types
from scanner.models import GitHubScan, CodeFinding
from .local_client import get_source_files as get_local_source_files
from .github_client import get_source_files as get_github_source_files

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are a code security expert. Analyze the provided source code files
and identify security vulnerabilities.

Look for:
- SQL injection vulnerabilities
- Cross-site scripting (XSS)
- Hardcoded secrets, API keys, passwords, tokens
- Path traversal vulnerabilities
- Command injection
- Insecure cryptographic usage
- Insecure deserialization
- Server-side request forgery (SSRF)
- Broken authentication patterns
- Sensitive data exposure
- Missing input validation at system boundaries
- Insecure file operations

For each finding, provide the exact file path, line number, a code snippet showing the issue,
and a specific recommendation for fixing it. Be precise and avoid false positives.
Only report genuine security concerns, not style issues."""


class CodeVulnerability(BaseModel):
    file_path: str = Field(description="Relative path to the file")
    line_number: int = Field(description="Line number where the issue occurs")
    severity: str = Field(description="One of: critical, high, medium, low, info")
    category: str = Field(
        description="One of: sql_injection, xss, hardcoded_secret, path_traversal, "
        "command_injection, insecure_crypto, insecure_deserialization, ssrf, "
        "broken_auth, sensitive_data, missing_validation, insecure_file_ops, other"
    )
    title: str = Field(description="Short title describing the vulnerability")
    description: str = Field(description="Detailed explanation of the security issue")
    code_snippet: str = Field(description="The vulnerable code snippet")
    recommendation: str = Field(description="Specific fix recommendation")


class CodeSecurityReport(BaseModel):
    findings: list[CodeVulnerability] = Field(
        description="List of security findings, empty if no issues found"
    )
    summary: str = Field(description="Brief overall security assessment")


code_security_agent = Agent(
    name="code_security_scanner",
    model="gemini-2.5-flash",
    instruction=SYSTEM_INSTRUCTION,
    output_schema=CodeSecurityReport,
    generate_content_config=types.GenerateContentConfig(
        temperature=0.2,
    ),
)


def _run_code_scan(scan_id: int, source_files: dict[str, str]):
    """Run AI code security analysis on the given source files."""
    try:
        scan = GitHubScan.objects.get(id=scan_id)
    except GitHubScan.DoesNotExist:
        return

    file_contents = []
    for fpath, content in source_files.items():
        file_contents.append(f"--- {fpath} ---\n{content}")

    input_text = json.dumps({
        "project": scan.repo_name,
        "file_count": len(source_files),
        "files": "\n\n".join(file_contents),
    })

    try:
        runner = InMemoryRunner(agent=code_security_agent, app_name="cyberlens_code_scan")

        response_text = ""
        for event in runner.run(
            user_id="system",
            session_id=f"code-scan-{scan_id}",
            new_message=types.UserContent(
                parts=[types.Part(text=input_text)]
            ),
        ):
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        from cyberlens.utils import clean_json_response
        result = CodeSecurityReport.model_validate_json(clean_json_response(response_text))

        for finding in result.findings:
            CodeFinding.objects.create(
                scan=scan,
                file_path=finding.file_path,
                line_number=finding.line_number,
                severity=finding.severity,
                category=finding.category,
                title=finding.title,
                description=finding.description,
                code_snippet=finding.code_snippet,
                recommendation=finding.recommendation,
            )

    except Exception:
        logger.exception("Code security scan failed for scan %s", scan_id)


def scan_code_security(scan_id: int, dir_path: str):
    """Scan local source code for security vulnerabilities using Google ADK."""
    from cyberlens.utils import get_google_api_key
    api_key = get_google_api_key()
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping code security scan")
        return

    os.environ["GOOGLE_API_KEY"] = api_key

    try:
        source_files = get_local_source_files(dir_path)
    except (ValueError, FileNotFoundError) as e:
        logger.warning("Cannot read source files: %s", e)
        return

    if not source_files:
        logger.info("No source files found for code security scan")
        return

    _run_code_scan(scan_id, source_files)


def scan_code_security_github(scan_id: int, pat: str, repo_full_name: str):
    """Scan GitHub repo source code for security vulnerabilities."""
    from cyberlens.utils import get_google_api_key
    api_key = get_google_api_key()
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping code security scan")
        return

    os.environ["GOOGLE_API_KEY"] = api_key

    source_files = get_github_source_files(pat, repo_full_name)
    if not source_files:
        logger.info("No source files found in GitHub repo for code security scan")
        return

    _run_code_scan(scan_id, source_files)
