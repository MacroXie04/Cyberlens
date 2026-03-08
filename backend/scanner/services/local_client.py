import logging
import os
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)

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

SOURCE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rb", ".java",
    ".php", ".html", ".sql", ".yml", ".yaml", ".toml",
}

SKIP_DIRS = {
    "node_modules", "__pycache__", ".git", "dist", "venv",
    ".venv", "build", ".next", ".nuxt", "vendor", "env",
}

MAX_FILE_SIZE = 50 * 1024  # 50KB


def validate_local_path(dir_path: str) -> Path:
    """Validate and resolve a local directory path, preventing path traversal."""
    scan_root = Path(settings.LOCAL_SCAN_ROOT).resolve()
    target = (scan_root / dir_path).resolve()

    if not target.is_relative_to(scan_root):
        raise ValueError(f"Path traversal detected: {dir_path}")

    if not target.is_dir():
        raise FileNotFoundError(f"Directory not found: {dir_path}")

    return target


def list_local_projects(base_path: str = "") -> list[dict]:
    """List subdirectories available for scanning under the scan root."""
    scan_root = Path(settings.LOCAL_SCAN_ROOT).resolve()
    target = (scan_root / base_path).resolve() if base_path else scan_root

    if not target.is_relative_to(scan_root):
        return []

    if not target.is_dir():
        return []

    projects = []

    # Check if root itself has manifests
    root_has_manifest = any((target / m).is_file() for m in MANIFEST_FILES)
    if root_has_manifest:
        rel = str(target.relative_to(scan_root))
        projects.append({
            "name": "." if rel == "." else target.name,
            "path": rel,
            "has_manifest": True,
        })

    # List immediate subdirectories
    try:
        for entry in sorted(target.iterdir()):
            if entry.is_dir() and not entry.name.startswith(".") and entry.name not in SKIP_DIRS:
                has_manifest = any((entry / m).is_file() for m in MANIFEST_FILES)
                projects.append({
                    "name": entry.name,
                    "path": str(entry.relative_to(scan_root)),
                    "has_manifest": has_manifest,
                })
    except PermissionError:
        logger.warning("Permission denied listing %s", target)

    return projects


def get_local_dependency_files(dir_path: str) -> dict[str, str]:
    """Read dependency manifest files from a local directory."""
    target = validate_local_path(dir_path)
    found = {}
    for filename in MANIFEST_FILES:
        filepath = target / filename
        if filepath.is_file():
            try:
                content = filepath.read_text(encoding="utf-8")
                found[filename] = content
            except (OSError, UnicodeDecodeError):
                logger.warning("Could not read %s", filepath)
    return found


def get_source_files(dir_path: str) -> dict[str, str]:
    """Read source code files from a local directory for security analysis."""
    target = validate_local_path(dir_path)
    scan_root = Path(settings.LOCAL_SCAN_ROOT).resolve()
    files = {}

    for root, dirs, filenames in os.walk(target):
        # Skip blacklisted directories
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for fname in filenames:
            fpath = Path(root) / fname
            if fpath.suffix not in SOURCE_EXTENSIONS:
                continue
            try:
                size = fpath.stat().st_size
                if size > MAX_FILE_SIZE or size == 0:
                    continue
                rel_path = str(fpath.relative_to(target))
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                files[rel_path] = content
            except (OSError, UnicodeDecodeError):
                continue

    return files
