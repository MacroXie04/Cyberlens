"""AST-based static analysis for Python / Django source files."""
from __future__ import annotations

import ast
import os
import re
from dataclasses import dataclass, field


@dataclass
class UrlPattern:
    url: str
    view_ref: str  # dotted reference, e.g. "views.scan"
    name: str
    http_methods: list[str]
    file_path: str
    line_number: int


@dataclass
class ViewFunction:
    qualified_name: str  # e.g. "scanner.views.scan"
    name: str
    http_methods: list[str]
    decorators: list[str]
    file_path: str
    line_number: int


@dataclass
class FunctionCall:
    caller: str  # qualified name
    callee: str  # best-effort qualified name
    file_path: str
    line_number: int


@dataclass
class ModelClass:
    qualified_name: str
    name: str
    file_path: str
    line_number: int


@dataclass
class PythonAnalysisResult:
    url_patterns: list[UrlPattern] = field(default_factory=list)
    views: list[ViewFunction] = field(default_factory=list)
    calls: list[FunctionCall] = field(default_factory=list)
    models: list[ModelClass] = field(default_factory=list)
    import_map: dict[str, dict[str, str]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _module_from_path(file_path: str) -> str:
    """Convert a file path to a dotted module name."""
    module = file_path.replace(os.sep, "/")
    module = re.sub(r"\.py$", "", module)
    module = module.replace("/", ".")
    return module


def _resolve_name(name: str, imports: dict[str, str], module: str) -> str:
    """Resolve a possibly-aliased name using the file's import map."""
    parts = name.split(".")
    head = parts[0]
    if head in imports:
        resolved = imports[head]
        if len(parts) > 1:
            return f"{resolved}.{'.'.join(parts[1:])}"
        return resolved
    if not name.startswith("."):
        return name
    return f"{module}.{name.lstrip('.')}"


# ---------------------------------------------------------------------------
# Import extraction
# ---------------------------------------------------------------------------

def _extract_imports(tree: ast.Module, module: str) -> dict[str, str]:
    """Build {local_alias: fully_qualified_module} from import statements."""
    mapping: dict[str, str] = {}
    package = ".".join(module.split(".")[:-1])
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                mapping[alias.asname or alias.name] = alias.name
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level and package:
                prefix = ".".join(package.split(".")[:max(1, len(package.split(".")) - node.level + 1)])
                base = f"{prefix}.{base}" if base else prefix
            for alias in node.names:
                fqn = f"{base}.{alias.name}" if base else alias.name
                mapping[alias.asname or alias.name] = fqn
    return mapping


# ---------------------------------------------------------------------------
# URL pattern extraction
# ---------------------------------------------------------------------------

def _str_value(node: ast.expr) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _extract_urlpatterns(tree: ast.Module, file_path: str, module: str, imports: dict[str, str]) -> list[UrlPattern]:
    patterns: list[UrlPattern] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not (isinstance(target, ast.Name) and target.id == "urlpatterns"):
                continue
            if not isinstance(node.value, (ast.List, ast.BinOp)):
                continue
            elements = node.value.elts if isinstance(node.value, ast.List) else []
            if isinstance(node.value, ast.BinOp):
                if isinstance(node.value.left, ast.List):
                    elements = node.value.left.elts
                if isinstance(node.value.right, ast.List):
                    elements = list(elements) + node.value.right.elts
            for call in elements:
                if not isinstance(call, ast.Call):
                    continue
                func_name = ""
                if isinstance(call.func, ast.Name):
                    func_name = call.func.id
                elif isinstance(call.func, ast.Attribute):
                    func_name = call.func.attr
                if func_name not in ("path", "re_path", "url"):
                    continue
                url_arg = _str_value(call.args[0]) if call.args else None
                if url_arg is None:
                    continue
                view_ref = ""
                if len(call.args) > 1:
                    v = call.args[1]
                    if isinstance(v, ast.Name):
                        view_ref = _resolve_name(v.id, imports, module)
                    elif isinstance(v, ast.Attribute):
                        view_ref = ast.unparse(v)
                        view_ref = _resolve_name(view_ref, imports, module)
                    elif isinstance(v, ast.Call):
                        # include(...)
                        pass
                for kw in call.keywords:
                    if kw.arg == "view":
                        if isinstance(kw.value, ast.Name):
                            view_ref = _resolve_name(kw.value.id, imports, module)
                name_kw = ""
                for kw in call.keywords:
                    if kw.arg == "name":
                        val = _str_value(kw.value)
                        if val:
                            name_kw = val
                patterns.append(UrlPattern(
                    url=url_arg,
                    view_ref=view_ref,
                    name=name_kw,
                    http_methods=[],
                    file_path=file_path,
                    line_number=call.lineno,
                ))
    return patterns


# ---------------------------------------------------------------------------
# View function extraction
# ---------------------------------------------------------------------------

def _extract_views(tree: ast.Module, file_path: str, module: str) -> list[ViewFunction]:
    views: list[ViewFunction] = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            decorators = []
            http_methods: list[str] = []
            is_view = False
            for dec in node.decorator_list:
                if isinstance(dec, ast.Name):
                    decorators.append(dec.id)
                    if dec.id in ("csrf_exempt", "login_required"):
                        is_view = True
                elif isinstance(dec, ast.Call) and isinstance(dec.func, ast.Name):
                    decorators.append(dec.func.id)
                    if dec.func.id == "api_view" and dec.args:
                        is_view = True
                        if isinstance(dec.args[0], (ast.List, ast.Tuple)):
                            for elt in dec.args[0].elts:
                                val = _str_value(elt)
                                if val:
                                    http_methods.append(val)
                elif isinstance(dec, ast.Attribute):
                    decorators.append(dec.attr)
            if is_view or any(d in ("api_view", "action", "csrf_exempt") for d in decorators):
                views.append(ViewFunction(
                    qualified_name=f"{module}.{node.name}",
                    name=node.name,
                    http_methods=http_methods,
                    decorators=decorators,
                    file_path=file_path,
                    line_number=node.lineno,
                ))
        elif isinstance(node, ast.ClassDef):
            bases = [ast.unparse(b) for b in node.bases]
            is_view_class = any(
                kw in b for b in bases for kw in ("APIView", "ViewSet", "View", "Mixin")
            )
            if is_view_class:
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        method = item.name.upper() if item.name in ("get", "post", "put", "patch", "delete", "head", "options") else ""
                        views.append(ViewFunction(
                            qualified_name=f"{module}.{node.name}.{item.name}",
                            name=f"{node.name}.{item.name}",
                            http_methods=[method] if method else [],
                            decorators=[],
                            file_path=file_path,
                            line_number=item.lineno,
                        ))
    return views


# ---------------------------------------------------------------------------
# Call graph extraction
# ---------------------------------------------------------------------------

class _CallCollector(ast.NodeVisitor):
    def __init__(self, module: str, imports: dict[str, str]):
        self.module = module
        self.imports = imports
        self.current_func: str | None = None
        self.calls: list[FunctionCall] = []
        self._file_path = ""

    def visit_FunctionDef(self, node: ast.FunctionDef):
        prev = self.current_func
        self.current_func = f"{self.module}.{node.name}"
        self.generic_visit(node)
        self.current_func = prev

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Call(self, node: ast.Call):
        if self.current_func:
            callee = ""
            if isinstance(node.func, ast.Name):
                callee = _resolve_name(node.func.id, self.imports, self.module)
            elif isinstance(node.func, ast.Attribute):
                raw = ast.unparse(node.func)
                callee = _resolve_name(raw, self.imports, self.module)
            if callee and not callee.startswith(("builtins.", "str.", "list.", "dict.", "int.", "set.", "super")):
                self.calls.append(FunctionCall(
                    caller=self.current_func,
                    callee=callee,
                    file_path=self._file_path,
                    line_number=node.lineno,
                ))
        self.generic_visit(node)


def _extract_calls(tree: ast.Module, file_path: str, module: str, imports: dict[str, str]) -> list[FunctionCall]:
    collector = _CallCollector(module, imports)
    collector._file_path = file_path
    collector.visit(tree)
    return collector.calls


# ---------------------------------------------------------------------------
# Model class extraction
# ---------------------------------------------------------------------------

def _extract_models(tree: ast.Module, file_path: str, module: str) -> list[ModelClass]:
    models: list[ModelClass] = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            bases = [ast.unparse(b) for b in node.bases]
            if any("Model" in b for b in bases):
                models.append(ModelClass(
                    qualified_name=f"{module}.{node.name}",
                    name=node.name,
                    file_path=file_path,
                    line_number=node.lineno,
                ))
    return models


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_python_files(files: dict[str, str]) -> PythonAnalysisResult:
    result = PythonAnalysisResult()
    for file_path, content in files.items():
        try:
            tree = ast.parse(content, filename=file_path)
        except SyntaxError:
            continue
        module = _module_from_path(file_path)
        imports = _extract_imports(tree, module)
        result.import_map[file_path] = imports
        result.url_patterns.extend(_extract_urlpatterns(tree, file_path, module, imports))
        result.views.extend(_extract_views(tree, file_path, module))
        result.calls.extend(_extract_calls(tree, file_path, module, imports))
        result.models.extend(_extract_models(tree, file_path, module))
    return result
