import json
import logging
import os
import time

from google.adk import Agent
from google.adk.agents.run_config import StreamingMode
from google.adk.runners import InMemoryRunner, RunConfig
from google.genai import types
from pydantic import BaseModel, Field

from monitor.services.redis_publisher import publish_code_scan_stream
from scanner.models import CodeFinding, GitHubScan

from .github_client import get_source_files as get_github_source_files

logger = logging.getLogger(__name__)

MAX_FILES_TO_SCAN = 50

SINGLE_FILE_INSTRUCTION = """You are a code security expert. Analyze the provided single source file
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
Only report genuine security concerns, not style issues.
If no security issues are found, return an empty findings list."""


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
    description: str = Field(
        description="Detailed explanation of the security issue"
    )
    code_snippet: str = Field(description="The vulnerable code snippet")
    recommendation: str = Field(description="Specific fix recommendation")


class SingleFileSecurityReport(BaseModel):
    findings: list[CodeVulnerability] = Field(
        description="List of security findings, empty if no issues found"
    )
    summary: str = Field(description="Brief security assessment of this file")


def _build_single_file_agent(model: str) -> Agent:
    return Agent(
        name="code_security_scanner_single",
        model=model,
        instruction=SINGLE_FILE_INSTRUCTION,
        output_schema=SingleFileSecurityReport,
        generate_content_config=types.GenerateContentConfig(
            temperature=0.2,
        ),
    )


CROSS_FILE_INSTRUCTION = """You are a code security expert. You are given multiple source files from the same project.
Your job is to find CROSS-FILE security vulnerabilities — issues that span multiple files and cannot be detected
by analyzing each file in isolation.

Focus on:
- Unsanitized user input flowing from one file into dangerous operations (SQL, shell, file I/O) in another
- Authentication/authorization bypasses where middleware in one file is missing or misconfigured for routes in another
- Secrets or credentials defined in one file and exposed or logged in another
- Insecure data flows: sensitive data fetched in one module and passed unprotected to another
- SSRF or injection where URL/path construction uses values from a different module without validation
- Trust boundary violations across modules (e.g., internal API assumes sanitized input from a frontend handler that doesn't sanitize)

Do NOT re-report single-file issues. Only report vulnerabilities that require understanding of how multiple files interact.
If no cross-file issues are found, return an empty findings list."""


def _build_cross_file_agent(model: str) -> Agent:
    return Agent(
        name="code_security_scanner_cross_file",
        model=model,
        instruction=CROSS_FILE_INSTRUCTION,
        output_schema=SingleFileSecurityReport,
        generate_content_config=types.GenerateContentConfig(
            temperature=0.2,
        ),
    )


def _scan_single_file(
    scan_id: int,
    file_path: str,
    content: str,
    file_index: int,
    total_files: int,
    user_id: int | None = None,
    model_name: str = "gemini-2.5-flash",
) -> dict:
    """Scan a single file with streaming and return results + token counts."""
    from cyberlens.utils import log_gemini_call

    input_text = json.dumps(
        {
            "file_path": file_path,
            "content": content,
        }
    )

    agent = _build_single_file_agent(model_name)
    runner = InMemoryRunner(
        agent=agent, app_name="cyberlens_code_scan"
    )

    response_text = ""
    input_tokens = 0
    output_tokens = 0
    total_tokens = 0

    start_time = time.time()

    for event in runner.run(
        user_id="system",
        session_id=f"code-scan-{scan_id}-{file_index}",
        new_message=types.UserContent(
            parts=[types.Part(text=input_text)]
        ),
        run_config=RunConfig(streaming_mode=StreamingMode.SSE),
    ):
        if event.partial and event.content:
            for part in event.content.parts:
                if part.text:
                    publish_code_scan_stream(
                        {
                            "scan_id": scan_id,
                            "type": "chunk",
                            "file_path": file_path,
                            "file_index": file_index,
                            "total_files": total_files,
                            "text": part.text,
                        }
                    )

        if event.is_final_response() and event.content:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

        if hasattr(event, "usage_metadata") and event.usage_metadata:
            meta = event.usage_metadata
            input_tokens = getattr(meta, "prompt_token_count", 0) or 0
            output_tokens = getattr(meta, "candidates_token_count", 0) or 0
            total_tokens = getattr(meta, "total_token_count", 0) or 0

    duration_ms = int((time.time() - start_time) * 1000)

    from cyberlens.utils import clean_json_response

    result = SingleFileSecurityReport.model_validate_json(
        clean_json_response(response_text)
    )

    scan = GitHubScan.objects.get(id=scan_id)
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

    log_gemini_call(
        user_id=user_id,
        service="code_scan_single",
        related_object_id=scan_id,
        model_name=model_name,
        prompt_summary=input_text,
        response_summary=response_text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        status="success",
        duration_ms=duration_ms,
    )

    return {
        "findings_count": len(result.findings),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


def _run_cross_file_scan(
    scan_id: int,
    file_list: list[tuple[str, str]],
    total_files: int,
    user_id: int | None = None,
    model_name: str = "gemini-2.5-flash",
) -> dict:
    """Run cross-file security analysis to find inter-file vulnerabilities."""
    from cyberlens.utils import log_gemini_call

    file_contents = []
    for fpath, content in file_list:
        file_contents.append(f"--- {fpath} ---\n{content}")

    input_text = json.dumps(
        {
            "file_count": len(file_list),
            "files": "\n\n".join(file_contents),
        }
    )

    agent = _build_cross_file_agent(model_name)
    runner = InMemoryRunner(
        agent=agent, app_name="cyberlens_code_scan_cross"
    )

    response_text = ""
    input_tokens = 0
    output_tokens = 0
    total_tokens_count = 0

    start_time = time.time()

    for event in runner.run(
        user_id="system",
        session_id=f"code-scan-{scan_id}-cross",
        new_message=types.UserContent(
            parts=[types.Part(text=input_text)]
        ),
        run_config=RunConfig(streaming_mode=StreamingMode.SSE),
    ):
        if event.partial and event.content:
            for part in event.content.parts:
                if part.text:
                    publish_code_scan_stream(
                        {
                            "scan_id": scan_id,
                            "type": "chunk",
                            "file_path": "(cross-file analysis)",
                            "file_index": total_files,
                            "total_files": total_files + 1,
                            "text": part.text,
                        }
                    )

        if event.is_final_response() and event.content:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

        if hasattr(event, "usage_metadata") and event.usage_metadata:
            meta = event.usage_metadata
            input_tokens = getattr(meta, "prompt_token_count", 0) or 0
            output_tokens = getattr(meta, "candidates_token_count", 0) or 0
            total_tokens_count = (
                getattr(meta, "total_token_count", 0) or 0
            )

    duration_ms = int((time.time() - start_time) * 1000)

    from cyberlens.utils import clean_json_response

    result = SingleFileSecurityReport.model_validate_json(
        clean_json_response(response_text)
    )

    scan = GitHubScan.objects.get(id=scan_id)
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

    log_gemini_call(
        user_id=user_id,
        service="code_scan_cross",
        related_object_id=scan_id,
        model_name=model_name,
        prompt_summary=input_text,
        response_summary=response_text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens_count,
        status="success",
        duration_ms=duration_ms,
    )

    return {
        "findings_count": len(result.findings),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens_count,
    }


def _run_code_scan_per_file(
    scan_id: int,
    source_files: dict[str, str],
    user_id: int | None = None,
    model_name: str = "gemini-2.5-flash",
):
    """Run per-file code security analysis with streaming and token tracking."""
    try:
        scan = GitHubScan.objects.get(id=scan_id)
    except GitHubScan.DoesNotExist:
        return

    file_list = list(source_files.items())
    total_files = len(file_list)

    if total_files > MAX_FILES_TO_SCAN:
        logger.warning(
            "Scan %s: %d files found, capping at %d",
            scan_id,
            total_files,
            MAX_FILES_TO_SCAN,
        )
        publish_code_scan_stream(
            {
                "scan_id": scan_id,
                "type": "warning",
                "message": f"Project has {total_files} files, scanning first {MAX_FILES_TO_SCAN}",
            }
        )
        file_list = file_list[:MAX_FILES_TO_SCAN]
        total_files = MAX_FILES_TO_SCAN

    scan.code_scan_files_total = total_files
    scan.save(update_fields=["code_scan_files_total"])

    publish_code_scan_stream(
        {
            "scan_id": scan_id,
            "type": "scan_start",
            "total_files": total_files,
        }
    )

    cumulative_input = 0
    cumulative_output = 0
    cumulative_total = 0
    total_findings = 0
    files_scanned = 0

    for file_index, (file_path, content) in enumerate(file_list):
        publish_code_scan_stream(
            {
                "scan_id": scan_id,
                "type": "file_start",
                "file_path": file_path,
                "file_index": file_index,
                "total_files": total_files,
            }
        )

        try:
            result = _scan_single_file(
                scan_id,
                file_path,
                content,
                file_index,
                total_files,
                user_id=user_id,
                model_name=model_name,
            )
            files_scanned += 1
            total_findings += result["findings_count"]
            cumulative_input += result["input_tokens"]
            cumulative_output += result["output_tokens"]
            cumulative_total += result["total_tokens"]

            scan.code_scan_input_tokens = cumulative_input
            scan.code_scan_output_tokens = cumulative_output
            scan.code_scan_total_tokens = cumulative_total
            scan.code_scan_files_scanned = files_scanned
            scan.save(
                update_fields=[
                    "code_scan_input_tokens",
                    "code_scan_output_tokens",
                    "code_scan_total_tokens",
                    "code_scan_files_scanned",
                ]
            )

            publish_code_scan_stream(
                {
                    "scan_id": scan_id,
                    "type": "file_complete",
                    "file_path": file_path,
                    "file_index": file_index,
                    "findings_count": result["findings_count"],
                }
            )

            publish_code_scan_stream(
                {
                    "scan_id": scan_id,
                    "type": "token_update",
                    "input_tokens": cumulative_input,
                    "output_tokens": cumulative_output,
                    "total_tokens": cumulative_total,
                    "files_scanned": files_scanned,
                    "total_files": total_files,
                }
            )

        except Exception as e:
            logger.exception(
                "Code scan failed for file %s in scan %s",
                file_path,
                scan_id,
            )
            files_scanned += 1
            publish_code_scan_stream(
                {
                    "scan_id": scan_id,
                    "type": "file_error",
                    "file_path": file_path,
                    "file_index": file_index,
                    "error": str(e),
                }
            )

        # Rate limit: small delay between files to avoid 429
        if file_index < len(file_list) - 1:
            time.sleep(0.5)

    # Phase 2: Cross-file analysis
    if len(file_list) > 1:
        publish_code_scan_stream(
            {
                "scan_id": scan_id,
                "type": "file_start",
                "file_path": "(cross-file analysis)",
                "file_index": total_files,
                "total_files": total_files + 1,
            }
        )

        try:
            cross_result = _run_cross_file_scan(
                scan_id,
                file_list,
                total_files,
                user_id=user_id,
                model_name=model_name,
            )
            total_findings += cross_result["findings_count"]
            cumulative_input += cross_result["input_tokens"]
            cumulative_output += cross_result["output_tokens"]
            cumulative_total += cross_result["total_tokens"]

            scan.code_scan_input_tokens = cumulative_input
            scan.code_scan_output_tokens = cumulative_output
            scan.code_scan_total_tokens = cumulative_total
            scan.save(
                update_fields=[
                    "code_scan_input_tokens",
                    "code_scan_output_tokens",
                    "code_scan_total_tokens",
                ]
            )

            publish_code_scan_stream(
                {
                    "scan_id": scan_id,
                    "type": "file_complete",
                    "file_path": "(cross-file analysis)",
                    "file_index": total_files,
                    "findings_count": cross_result["findings_count"],
                }
            )

            publish_code_scan_stream(
                {
                    "scan_id": scan_id,
                    "type": "token_update",
                    "input_tokens": cumulative_input,
                    "output_tokens": cumulative_output,
                    "total_tokens": cumulative_total,
                    "files_scanned": files_scanned,
                    "total_files": total_files,
                }
            )
        except Exception:
            logger.exception(
                "Cross-file analysis failed for scan %s", scan_id
            )
            publish_code_scan_stream(
                {
                    "scan_id": scan_id,
                    "type": "file_error",
                    "file_path": "(cross-file analysis)",
                    "file_index": total_files,
                    "error": "Cross-file analysis failed",
                }
            )

    publish_code_scan_stream(
        {
            "scan_id": scan_id,
            "type": "scan_summary",
            "input_tokens": cumulative_input,
            "output_tokens": cumulative_output,
            "total_tokens": cumulative_total,
            "files_scanned": files_scanned,
            "total_findings": total_findings,
        }
    )


def scan_code_security_github(
    scan_id: int,
    pat: str,
    repo_full_name: str,
    user_id: int | None = None,
):
    """Scan GitHub repo source code for security vulnerabilities."""
    from cyberlens.utils import get_google_api_key, get_user_gemini_model

    api_key = get_google_api_key()
    model_name = get_user_gemini_model(user_id)
    if not api_key:
        logger.warning(
            "GOOGLE_API_KEY not set, skipping code security scan"
        )
        return

    os.environ["GOOGLE_API_KEY"] = api_key

    source_files = get_github_source_files(pat, repo_full_name)
    if not source_files:
        logger.info(
            "No source files found in GitHub repo for code security scan"
        )
        return

    _run_code_scan_per_file(scan_id, source_files, user_id=user_id, model_name=model_name)




def scan_code_security(scan_id, dir_path, user_id=None):
    """Scan local source code for security vulnerabilities using Google ADK."""
    from .local_client import get_source_files as _local_get_source_files  # noqa: E402
    from cyberlens.utils import get_google_api_key, get_user_gemini_model

    api_key = get_google_api_key()
    model_name = get_user_gemini_model(user_id)
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set, skipping code security scan")
        return

    os.environ["GOOGLE_API_KEY"] = api_key

    try:
        source_files = _local_get_source_files(dir_path)
    except (ValueError, FileNotFoundError) as exc:
        logger.warning("Cannot read source files: %s", exc)
        return

    if not source_files:
        logger.info("No source files found for code security scan")
        return

    _run_code_scan_per_file(scan_id, source_files, user_id=user_id, model_name=model_name)
