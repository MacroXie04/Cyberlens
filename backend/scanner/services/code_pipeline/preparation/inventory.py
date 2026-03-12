import hashlib
import os
import re

from scanner.models import AdkTraceEvent, CodeScanFileIndex, GitHubScan

from .profiles import FAST_EXCLUDED_PATH_KEYWORDS, FAST_PATH_KEYWORDS

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

MAX_PREVIEW_SNIPPET_CHARS = 1200


def detect_language(file_path: str) -> str:
    return LANGUAGE_BY_EXTENSION.get(os.path.splitext(file_path)[1].lower(), "text")


def extract_imports(file_path: str, content: str) -> list[str]:
    patterns = []
    if file_path.endswith(".py"):
        patterns = [re.compile(r"^\\s*import\\s+([a-zA-Z0-9_\\.]+)", re.MULTILINE), re.compile(r"^\\s*from\\s+([a-zA-Z0-9_\\.]+)\\s+import\\s+", re.MULTILINE)]
    elif file_path.endswith((".js", ".jsx", ".ts", ".tsx")):
        patterns = [re.compile(r"from\\s+['\\\"]([^'\\\"]+)['\\\"]"), re.compile(r"require\\(\\s*['\\\"]([^'\\\"]+)['\\\"]\\s*\\)")]
    imports = [match.group(1) for pattern in patterns for match in pattern.finditer(content)]
    return sorted(set(imports))


def infer_role_flags(file_path: str, content: str) -> list[str]:
    lower_path = file_path.lower()
    lower_content = content.lower()
    flags = set()
    if any(token in lower_path for token in ["route", "controller", "handler", "api"]):
        flags.add("route")
    if "middleware" in lower_path or "next(" in lower_content:
        flags.add("middleware")
    if any(token in lower_path for token in ["config", "settings", ".env", "env"]):
        flags.add("config")
    if "model" in lower_path:
        flags.add("model")
    return sorted(flags or {"helper"})


def fast_path_score(file_path: str, content: str) -> int:
    lower_path = file_path.lower()
    base = os.path.basename(lower_path)
    content_head = content[:4000].lower()
    score = 80 if any(keyword in lower_path for keyword in FAST_PATH_KEYWORDS) else 0
    score += 25 if any(keyword in content_head for keyword in FAST_PATH_KEYWORDS) else 0
    if base in {"package.json", "package-lock.json", "requirements.txt", "pipfile", "pyproject.toml", "go.mod", "pom.xml", "gemfile", "dockerfile", "docker-compose.yml", "docker-compose.yaml"}:
        score += 120
    if any(token in lower_path for token in ("config", "settings", ".env")):
        score += 60
    if lower_path.count("/") <= 2:
        score += 10
    return score


def is_fast_excluded_path(file_path: str) -> bool:
    lower_path = file_path.lower()
    return any(token in lower_path for token in FAST_EXCLUDED_PATH_KEYWORDS)


def select_source_files(source_files: dict[str, str], profile) -> dict[str, str]:
    if profile.mode != GitHubScan.Mode.FAST:
        return dict(sorted(source_files.items()))
    ranked = [(fast_path_score(path, content), path, content) for path, content in source_files.items() if not (is_fast_excluded_path(path) and fast_path_score(path, content) < 80)]
    ranked.sort(key=lambda item: (-item[0], item[1]))
    selected, consumed_lines = {}, 0
    for score, path, content in ranked:
        if profile.source_file_cap is not None and len(selected) >= profile.source_file_cap:
            break
        line_count = max(len(content.splitlines()), 1)
        if profile.source_line_cap is not None and consumed_lines >= profile.source_line_cap and score < 80:
            break
        if profile.source_line_cap is not None and consumed_lines + line_count > profile.source_line_cap and selected and score < 120:
            continue
        selected[path] = content
        consumed_lines += line_count
    return dict(sorted(selected.items())) if selected else dict(sorted(source_files.items()))


def get_snippet(content: str, start_line: int, end_line: int, clip_text_preview, limit: int = MAX_PREVIEW_SNIPPET_CHARS) -> str:
    return clip_text_preview("\n".join(content.splitlines()[start_line - 1 : end_line]), limit=limit)


def create_file_indexes(scan: GitHubScan, source_files: dict[str, str]) -> list[CodeScanFileIndex]:
    return [
        CodeScanFileIndex.objects.create(
            scan=scan,
            path=path,
            language=detect_language(path),
            content_hash=hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest(),
            imports_json=extract_imports(path, content),
            role_flags_json=infer_role_flags(path, content),
            inventory_status="indexed",
        )
        for path, content in sorted(source_files.items())
    ]


def reset_code_scan_state(scan: GitHubScan) -> None:
    scan.code_scan_input_tokens = 0
    scan.code_scan_output_tokens = 0
    scan.code_scan_total_tokens = 0
    scan.code_scan_files_scanned = 0
    scan.code_scan_files_total = 0
    scan.code_scan_phase = AdkTraceEvent.Phase.CODE_INVENTORY
    scan.code_scan_stats_json = {}
    scan.save(update_fields=["code_scan_input_tokens", "code_scan_output_tokens", "code_scan_total_tokens", "code_scan_files_scanned", "code_scan_files_total", "code_scan_phase", "code_scan_stats_json"])
    scan.code_findings.all().delete()
    scan.code_scan_file_indexes.all().delete()
    scan.code_scan_candidates.all().delete()
    scan.adk_trace_events.filter(phase__in=[AdkTraceEvent.Phase.CODE_INVENTORY, AdkTraceEvent.Phase.CHUNK_SUMMARY, AdkTraceEvent.Phase.CANDIDATE_GENERATION, AdkTraceEvent.Phase.EVIDENCE_EXPANSION, AdkTraceEvent.Phase.VERIFICATION, AdkTraceEvent.Phase.REPO_SYNTHESIS]).delete()
