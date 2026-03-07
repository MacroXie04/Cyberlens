import logging
import requests

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"

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
