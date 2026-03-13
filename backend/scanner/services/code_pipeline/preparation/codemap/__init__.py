from __future__ import annotations

from scanner.models import CodeMapEdge, CodeMapNode, GitHubScan

from .graph_builder import build_graph
from .js_ts_analyzer import analyze_js_ts_files
from .python_analyzer import analyze_python_files


def build_code_map(
    scan: GitHubScan, source_files: dict[str, str]
) -> tuple[list[CodeMapNode], list[CodeMapEdge]]:
    """Statically analyse *source_files* and persist a CodeMap graph for *scan*."""
    scan.code_map_nodes.all().delete()
    scan.code_map_edges.all().delete()

    py_files = {p: c for p, c in source_files.items() if p.endswith(".py")}
    js_ts_files = {
        p: c
        for p, c in source_files.items()
        if p.endswith((".js", ".jsx", ".ts", ".tsx"))
    }

    py_result = analyze_python_files(py_files)
    js_result = analyze_js_ts_files(js_ts_files)

    return build_graph(scan, py_result, js_result)
