import os


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
    ".json",
    ".sql",
    ".yml",
    ".yaml",
    ".toml",
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
SOURCE_FILENAMES = {
    "package.json",
    "package-lock.json",
    "requirements.txt",
    "Pipfile",
    "pyproject.toml",
    "go.mod",
    "pom.xml",
    "Gemfile",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "tsconfig.json",
}
SKIP_PATHS = {"node_modules/", "__pycache__/", ".git/", "dist/", "venv/", ".venv/", "build/", "vendor/"}
MAX_FILE_SIZE = 50 * 1024
MAX_MANIFEST_FILE_SIZE = 512 * 1024
MAX_FETCH_WORKERS = max(1, int(os.getenv("GITHUB_FETCH_WORKERS", "4")))
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


def headers(pat: str) -> dict:
    return {
        "Authorization": f"Bearer {pat}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def should_skip_path(path: str) -> bool:
    return any(skip in path for skip in SKIP_PATHS)


def is_source_candidate(path: str) -> bool:
    base = path.rsplit("/", 1)[-1]
    return any(path.endswith(ext) for ext in SOURCE_EXTENSIONS) or base in SOURCE_FILENAMES or base.startswith(".env")
