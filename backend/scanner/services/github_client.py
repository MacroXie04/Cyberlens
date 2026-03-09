import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from .github_client_support import (
    GITHUB_API,
    MANIFEST_FILES,
    MAX_FETCH_WORKERS,
    MAX_FILE_SIZE,
    MAX_MANIFEST_FILE_SIZE,
    GitHubRepositoryFetchError,
    headers as _headers,
    is_source_candidate as _is_source_candidate,
    should_skip_path as _should_skip_path,
)

logger = logging.getLogger(__name__)


def validate_token(pat: str) -> dict | None:
    try:
        response = requests.get(f"{GITHUB_API}/user", headers=_headers(pat), timeout=10)
        return response.json() if response.status_code == 200 else None
    except requests.RequestException:
        logger.exception("GitHub token validation failed")
        return None


def list_repos(pat: str, per_page: int = 30) -> list[dict]:
    try:
        response = requests.get(
            f"{GITHUB_API}/user/repos",
            headers=_headers(pat),
            params={"per_page": per_page, "sort": "updated"},
            timeout=10,
        )
        response.raise_for_status()
        return [
            {
                "full_name": repo["full_name"],
                "name": repo["name"],
                "private": repo["private"],
                "language": repo.get("language"),
                "updated_at": repo["updated_at"],
                "description": repo.get("description") or "",
                "stargazers_count": repo.get("stargazers_count", 0),
                "forks_count": repo.get("forks_count", 0),
                "open_issues_count": repo.get("open_issues_count", 0),
                "default_branch": repo.get("default_branch", "main"),
                "html_url": repo.get("html_url", ""),
            }
            for repo in response.json()
        ]
    except requests.RequestException:
        logger.exception("Failed to list repos")
        return []


def get_file_content(pat: str, owner: str, repo: str, path: str) -> str | None:
    try:
        response = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
            headers={**_headers(pat), "Accept": "application/vnd.github.raw+json"},
            timeout=10,
        )
        return response.text if response.status_code == 200 else None
    except requests.RequestException:
        return None


def _get_repo_tree(pat: str, repo_full_name: str) -> list[dict]:
    owner, repo = repo_full_name.split("/", 1)
    try:
        repo_response = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=_headers(pat), timeout=10)
        repo_response.raise_for_status()
        default_branch = repo_response.json().get("default_branch", "main")
        tree_response = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{default_branch}",
            headers=_headers(pat),
            params={"recursive": "1"},
            timeout=30,
        )
        tree_response.raise_for_status()
        return tree_response.json().get("tree", [])
    except requests.RequestException as exc:
        logger.exception("Failed to fetch repo tree for %s", repo_full_name)
        raise GitHubRepositoryFetchError(f"Failed to fetch repo tree for {repo_full_name}: {exc}") from exc


def _fetch_repo_files(pat: str, owner: str, repo: str, paths: list[str], *, max_workers: int | None = None) -> dict[str, str]:
    if not paths:
        return {}
    if len(paths) == 1:
        content = get_file_content(pat, owner, repo, paths[0])
        return {paths[0]: content} if content is not None else {}
    found = {}
    worker_count = max_workers if max_workers is not None else MAX_FETCH_WORKERS
    with ThreadPoolExecutor(max_workers=min(max(1, worker_count), len(paths))) as executor:
        future_map = {executor.submit(get_file_content, pat, owner, repo, path): path for path in paths}
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
    owner, repo = repo_full_name.split("/", 1)
    manifest_paths = []
    for item in _get_repo_tree(pat, repo_full_name):
        path = item.get("path", "")
        if item.get("type") != "blob" or _should_skip_path(path):
            continue
        if path.rsplit("/", 1)[-1] not in MANIFEST_FILES:
            continue
        if not 0 < item.get("size", 0) <= MAX_MANIFEST_FILE_SIZE:
            continue
        manifest_paths.append(path)
    return _fetch_repo_files(pat, owner, repo, manifest_paths)


def get_source_files(pat: str, repo_full_name: str, *, max_workers: int | None = None) -> dict[str, str]:
    owner, repo = repo_full_name.split("/", 1)
    source_paths = []
    for item in _get_repo_tree(pat, repo_full_name):
        path = item.get("path", "")
        if item.get("type") != "blob" or not _is_source_candidate(path) or _should_skip_path(path):
            continue
        if not 0 < item.get("size", 0) <= MAX_FILE_SIZE:
            continue
        source_paths.append(path)
    return _fetch_repo_files(pat, owner, repo, source_paths, max_workers=max_workers)
