from __future__ import annotations

import sys
from pathlib import Path


MAX_LINES = 200
TEXT_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".py",
    ".scss",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".yaml",
    ".yml",
}
TEXT_FILENAMES = {
    ".gitignore",
    "Dockerfile",
    "Makefile",
    "README",
    "README.md",
    "pytest.ini",
}
EXCLUDED_DIRS = {
    ".git",
    ".idea",
    ".next",
    ".pytest_cache",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "venv",
}
EXCLUDED_SUFFIXES = {
    ".db",
    ".gif",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".ppt",
    ".pptx",
    ".pyc",
    ".sqlite3",
    ".svg",
    ".tsbuildinfo",
}
EXCLUDED_BASENAMES = {"package-lock.json"}


def is_excluded(path: Path) -> bool:
    if any(part in EXCLUDED_DIRS for part in path.parts):
        return True
    if path.name in EXCLUDED_BASENAMES:
        return True
    if path.suffix in EXCLUDED_SUFFIXES:
        return True
    if "migrations" in path.parts and path.suffix == ".py":
        return True
    return False


def is_handwritten_text(path: Path) -> bool:
    return path.suffix in TEXT_SUFFIXES or path.name in TEXT_FILENAMES


def iter_offenders(root: Path) -> list[tuple[int, Path]]:
    offenders: list[tuple[int, Path]] = []
    for path in root.rglob("*"):
        if not path.is_file() or is_excluded(path) or not is_handwritten_text(path):
            continue
        try:
            line_count = len(path.read_text(encoding="utf-8").splitlines())
        except UnicodeDecodeError:
            continue
        if line_count > MAX_LINES:
            offenders.append((line_count, path.relative_to(root)))
    offenders.sort(reverse=True)
    return offenders


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    offenders = iter_offenders(root)
    if not offenders:
        print(f"OK: no handwritten files exceed {MAX_LINES} lines.")
        return 0

    print(f"Found {len(offenders)} handwritten files over {MAX_LINES} lines:", file=sys.stderr)
    for line_count, path in offenders:
        print(f"{line_count:>4}  {path}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
