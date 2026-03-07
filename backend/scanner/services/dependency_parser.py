import json
import logging
import re

logger = logging.getLogger(__name__)


def parse_dependencies(filename: str, content: str) -> list[dict]:
    """Parse a dependency manifest file and return a list of {name, version, ecosystem}."""
    parsers = {
        "package.json": _parse_package_json,
        "package-lock.json": _parse_package_lock,
        "requirements.txt": _parse_requirements_txt,
        "pyproject.toml": _parse_pyproject_toml,
        "go.mod": _parse_go_mod,
        "Gemfile": _parse_gemfile,
    }

    parser = parsers.get(filename)
    if parser is None:
        logger.warning("No parser for %s", filename)
        return []

    try:
        return parser(content)
    except Exception:
        logger.exception("Failed to parse %s", filename)
        return []


def _parse_package_json(content: str) -> list[dict]:
    data = json.loads(content)
    deps = []
    for section in ("dependencies", "devDependencies"):
        for name, version in data.get(section, {}).items():
            # Strip semver prefixes like ^, ~, >=
            clean_version = re.sub(r"^[\^~>=<]*", "", version)
            deps.append({"name": name, "version": clean_version, "ecosystem": "npm"})
    return deps


def _parse_package_lock(content: str) -> list[dict]:
    data = json.loads(content)
    deps = []
    packages = data.get("packages", data.get("dependencies", {}))
    for path_or_name, info in packages.items():
        name = path_or_name.split("node_modules/")[-1] if "node_modules/" in path_or_name else path_or_name
        if not name or name == "":
            continue
        version = info.get("version", "")
        if version:
            deps.append({"name": name, "version": version, "ecosystem": "npm"})
    return deps


def _parse_requirements_txt(content: str) -> list[dict]:
    deps = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Match name==version, name>=version, name~=version, etc.
        match = re.match(r"^([a-zA-Z0-9_.-]+)\s*[=~<>!]=?\s*([a-zA-Z0-9_.*-]+)", line)
        if match:
            deps.append({
                "name": match.group(1),
                "version": match.group(2),
                "ecosystem": "PyPI",
            })
        else:
            # Package without version pinning
            match = re.match(r"^([a-zA-Z0-9_.-]+)", line)
            if match:
                deps.append({
                    "name": match.group(1),
                    "version": "",
                    "ecosystem": "PyPI",
                })
    return deps


def _parse_pyproject_toml(content: str) -> list[dict]:
    # Simple regex-based parser for [project] dependencies
    deps = []
    in_deps = False
    for line in content.splitlines():
        if re.match(r"^\s*dependencies\s*=\s*\[", line):
            in_deps = True
            continue
        if in_deps:
            if line.strip() == "]":
                break
            match = re.match(r'\s*"([a-zA-Z0-9_.-]+)\s*([=~<>!]=?\s*[^"]*)?",?', line)
            if match:
                name = match.group(1)
                version = re.sub(r"^[=~<>!]+\s*", "", match.group(2) or "").strip()
                deps.append({"name": name, "version": version, "ecosystem": "PyPI"})
    return deps


def _parse_go_mod(content: str) -> list[dict]:
    deps = []
    in_require = False
    for line in content.splitlines():
        if line.strip().startswith("require ("):
            in_require = True
            continue
        if in_require and line.strip() == ")":
            in_require = False
            continue
        if in_require:
            parts = line.strip().split()
            if len(parts) >= 2:
                deps.append({
                    "name": parts[0],
                    "version": parts[1].lstrip("v"),
                    "ecosystem": "Go",
                })
    return deps


def _parse_gemfile(content: str) -> list[dict]:
    deps = []
    for line in content.splitlines():
        match = re.match(r"""^\s*gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['""])?""", line)
        if match:
            version = re.sub(r"^[~>=<]+\s*", "", match.group(2) or "")
            deps.append({
                "name": match.group(1),
                "version": version,
                "ecosystem": "RubyGems",
            })
    return deps
