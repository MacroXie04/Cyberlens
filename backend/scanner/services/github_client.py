import logging
import requests

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"

SOURCE_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rb", ".java", ".php", ".html"}
SKIP_PATHS = {"node_modules/", "__pycache__/", ".git/", "dist/", "venv/", ".venv/", "build/", "vendor/"}
MAX_FILE_SIZE = 50 * 1024  # 50KB

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


def get_dependency_files(pat: str, repo_full_name: str) -> dict[str, str]:
    """Fetch all detectable dependency manifest files from a repository."""
    owner, repo = repo_full_name.split("/", 1)
    found = {}
    for filename in MANIFEST_FILES:
        content = get_file_content(pat, owner, repo, filename)
        if content is not None:
            found[filename] = content
    return found


def get_source_files(pat: str, repo_full_name: str) -> dict[str, str]:
    """Fetch source code files from a GitHub repo for security analysis."""
    owner, repo = repo_full_name.split("/", 1)
    try:
        # Get the default branch
        resp = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}",
            headers=_headers(pat),
            timeout=10,
        )
        resp.raise_for_status()
        default_branch = resp.json().get("default_branch", "main")

        # Get the full file tree
        resp = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}",
            headers=_headers(pat),
            params={"recursive": "1"},
            timeout=30,
        )
        resp.raise_for_status()
        tree = resp.json().get("tree", [])
    except requests.RequestException:
        logger.exception("Failed to fetch repo tree for %s", repo_full_name)
        return {}

    files = {}
    for item in tree:
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        # Skip non-source files
        if not any(path.endswith(ext) for ext in SOURCE_EXTENSIONS):
            continue
        # Skip blacklisted directories
        if any(skip in path for skip in SKIP_PATHS):
            continue
        # Skip large files
        size = item.get("size", 0)
        if size > MAX_FILE_SIZE or size == 0:
            continue

        content = get_file_content(pat, owner, repo, path)
        if content is not None:
            files[path] = content

    return files
