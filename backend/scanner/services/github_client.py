import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import requests

logger = logging.getLogger(__name__)


class GitHubRepositoryFetchError(RuntimeError):
    """Raised when repository metadata cannot be fetched from GitHub."""

GITHUB_API = "https://api.github.com"

SOURCE_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".go",
    ".rb",
    ".java",
    ".php",
    ".html",
    ".swift",
    ".m",
    ".mm",
    ".h",
    ".c",
    ".cc",
    ".cpp",
    ".kt",
    ".kts",
}
SKIP_PATHS = {"node_modules/", "__pycache__/", ".git/", "dist/", "venv/", ".venv/", "build/", "vendor/"}
MAX_FILE_SIZE = 50 * 1024  # 50KB
MAX_MANIFEST_FILE_SIZE = 512 * 1024  # 512KB
MAX_FETCH_WORKERS = max(1, int(os.getenv("GITHUB_FETCH_WORKERS", "4")))

# Manifest files to look for in repositories
MANIFEST_FILES = [
    "package.json",
    "package-lock.json",
    "requirements.txt",
    "Pipfile",
    "pyproject.toml",
    "go.mod",
    "pom.xml",
    "Gemfile",
]


def _headers(pat: str) -> dict:
    return {
        "Authorization": f"Bearer {pat}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def validate_token(pat: str) -> dict | None:
    try:
        resp = requests.get(f"{GITHUB_API}/user", headers=_headers(pat), timeout=10)
        if resp.status_code == 200:
            return resp.json()
        return None
    except requests.RequestException:
        logger.exception("GitHub token validation failed")
        return None


def list_repos(pat: str, per_page: int = 30) -> list[dict]:
    try:
        resp = requests.get(
            f"{GITHUB_API}/user/repos",
            headers=_headers(pat),
            params={"per_page": per_page, "sort": "updated"},
            timeout=10,
        )
        resp.raise_for_status()
        return [
            {
                "full_name": r["full_name"],
                "name": r["name"],
                "private": r["private"],
                "language": r.get("language"),
                "updated_at": r["updated_at"],
                "description": r.get("description") or "",
                "stargazers_count": r.get("stargazers_count", 0),
                "forks_count": r.get("forks_count", 0),
                "open_issues_count": r.get("open_issues_count", 0),
                "default_branch": r.get("default_branch", "main"),
                "html_url": r.get("html_url", ""),
            }
            for r in resp.json()
        ]
    except requests.RequestException:
        logger.exception("Failed to list repos")
        return []


def get_file_content(pat: str, owner: str, repo: str, path: str) -> str | None:
    try:
        resp = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
            headers={**_headers(pat), "Accept": "application/vnd.github.raw+json"},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.text
        return None
    except requests.RequestException:
        return None


def _get_repo_tree(pat: str, repo_full_name: str) -> list[dict]:
    owner, repo = repo_full_name.split("/", 1)
    try:
        repo_resp = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}",
            headers=_headers(pat),
            timeout=10,
        )
        repo_resp.raise_for_status()
        default_branch = repo_resp.json().get("default_branch", "main")

        tree_resp = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}",
            headers=_headers(pat),
            params={"recursive": "1"},
            timeout=30,
        )
        tree_resp.raise_for_status()
        return tree_resp.json().get("tree", [])
    except requests.RequestException as exc:
        logger.exception("Failed to fetch repo tree for %s", repo_full_name)
        raise GitHubRepositoryFetchError(
            f"Failed to fetch repo tree for {repo_full_name}: {exc}"
        ) from exc


def _should_skip_path(path: str) -> bool:
    return any(skip in path for skip in SKIP_PATHS)


def _fetch_repo_files(pat: str, owner: str, repo: str, paths: list[str]) -> dict[str, str]:
    found = {}
    if not paths:
        return found
    if len(paths) == 1:
        content = get_file_content(pat, owner, repo, paths[0])
        return {paths[0]: content} if content is not None else {}

    with ThreadPoolExecutor(max_workers=min(MAX_FETCH_WORKERS, len(paths))) as executor:
        future_map = {
            executor.submit(get_file_content, pat, owner, repo, path): path
            for path in paths
        }
        for future in as_completed(future_map):
            path = future_map[future]
            try:
                content = future.result()
            except Exception:
                logger.exception("Failed to fetch %s from %s/%s", path, owner, repo)
                continue
            if content is not None:
                found[path] = content
    return {path: found[path] for path in sorted(found)}


def get_dependency_files(pat: str, repo_full_name: str) -> dict[str, str]:
    """Fetch detectable dependency manifest files from any repo subdirectory."""
    owner, repo = repo_full_name.split("/", 1)
    tree = _get_repo_tree(pat, repo_full_name)
    manifest_paths = []
    for item in tree:
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        if _should_skip_path(path):
            continue
        if path.rsplit("/", 1)[-1] not in MANIFEST_FILES:
            continue
        size = item.get("size", 0)
        if size == 0 or size > MAX_MANIFEST_FILE_SIZE:
            continue
        manifest_paths.append(path)
    return _fetch_repo_files(pat, owner, repo, manifest_paths)


def get_source_files(pat: str, repo_full_name: str) -> dict[str, str]:
    """Fetch source code files from a GitHub repo for security analysis."""
    owner, repo = repo_full_name.split("/", 1)
    tree = _get_repo_tree(pat, repo_full_name)
    if not tree:
        return {}

    source_paths = []
    for item in tree:
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        # Skip non-source files
        if not any(path.endswith(ext) for ext in SOURCE_EXTENSIONS):
            continue
        # Skip blacklisted directories
        if _should_skip_path(path):
            continue
        # Skip large files
        size = item.get("size", 0)
        if size > MAX_FILE_SIZE or size == 0:
            continue
        source_paths.append(path)

    return _fetch_repo_files(pat, owner, repo, source_paths)
