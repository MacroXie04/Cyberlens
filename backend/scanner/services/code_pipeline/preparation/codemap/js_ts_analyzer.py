"""Regex-based static analysis for JavaScript / TypeScript / React files."""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ReactRoute:
    path: str
    component: str
    file_path: str
    line_number: int


@dataclass
class ApiCall:
    url: str
    component_or_function: str
    file_path: str
    line_number: int


@dataclass
class ComponentImport:
    local_name: str
    source: str
    file_path: str


@dataclass
class JsTsAnalysisResult:
    routes: list[ReactRoute] = field(default_factory=list)
    api_calls: list[ApiCall] = field(default_factory=list)
    component_imports: list[ComponentImport] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Route extraction
# ---------------------------------------------------------------------------

# <Route path="/login" element={<LoginPage />} />
_JSX_ROUTE_RE = re.compile(
    r"""<Route\s+[^>]*?path\s*=\s*["']([^"']+)["'][^>]*?element\s*=\s*\{[^}]*<(\w+)""",
    re.DOTALL,
)

# { path: "/login", element: <LoginPage /> }  or  { path: "/login", Component: LoginPage }
_OBJ_ROUTE_RE = re.compile(
    r"""path\s*:\s*["']([^"']+)["'][^}]*?(?:element\s*:\s*<(\w+)|[Cc]omponent\s*:\s*(\w+))""",
    re.DOTALL,
)


def _extract_routes(file_path: str, content: str) -> list[ReactRoute]:
    routes: list[ReactRoute] = []
    for match in _JSX_ROUTE_RE.finditer(content):
        line = content[: match.start()].count("\n") + 1
        routes.append(ReactRoute(
            path=match.group(1),
            component=match.group(2),
            file_path=file_path,
            line_number=line,
        ))
    for match in _OBJ_ROUTE_RE.finditer(content):
        line = content[: match.start()].count("\n") + 1
        comp = match.group(2) or match.group(3) or ""
        if comp:
            routes.append(ReactRoute(
                path=match.group(1),
                component=comp,
                file_path=file_path,
                line_number=line,
            ))
    return routes


# ---------------------------------------------------------------------------
# API call extraction
# ---------------------------------------------------------------------------

_API_CALL_RE = re.compile(
    r"""(?:fetch|fetchJson|axios\.(?:get|post|put|patch|delete))\s*\(\s*[`"']([^`"']*(?:/api/|/socket\.io)[^`"']*)[`"']""",
    re.IGNORECASE,
)

_TEMPLATE_API_RE = re.compile(
    r"""(?:fetch|fetchJson|axios\.(?:get|post|put|patch|delete))\s*\(\s*`([^`]*\$\{[^}]+\}[^`]*)`""",
    re.IGNORECASE,
)


def _extract_api_calls(file_path: str, content: str) -> list[ApiCall]:
    calls: list[ApiCall] = []
    seen: set[str] = set()
    for match in _API_CALL_RE.finditer(content):
        url = match.group(1)
        if url in seen:
            continue
        seen.add(url)
        line = content[: match.start()].count("\n") + 1
        calls.append(ApiCall(url=url, component_or_function="", file_path=file_path, line_number=line))
    for match in _TEMPLATE_API_RE.finditer(content):
        url = match.group(1)
        # Normalise template literals: ${id} -> :id
        url = re.sub(r"\$\{[^}]+\}", ":param", url)
        if url in seen:
            continue
        seen.add(url)
        line = content[: match.start()].count("\n") + 1
        calls.append(ApiCall(url=url, component_or_function="", file_path=file_path, line_number=line))
    return calls


# ---------------------------------------------------------------------------
# Component import extraction
# ---------------------------------------------------------------------------

_IMPORT_RE = re.compile(
    r"""import\s+(?:\{[^}]*\}|(\w+))\s+from\s+["']([^"']+)["']""",
)


def _extract_component_imports(file_path: str, content: str) -> list[ComponentImport]:
    imports: list[ComponentImport] = []
    for match in _IMPORT_RE.finditer(content):
        default_import = match.group(1)
        source = match.group(2)
        if default_import:
            imports.append(ComponentImport(local_name=default_import, source=source, file_path=file_path))
    return imports


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_js_ts_files(files: dict[str, str]) -> JsTsAnalysisResult:
    result = JsTsAnalysisResult()
    for file_path, content in files.items():
        result.routes.extend(_extract_routes(file_path, content))
        result.api_calls.extend(_extract_api_calls(file_path, content))
        result.component_imports.extend(_extract_component_imports(file_path, content))
    return result
