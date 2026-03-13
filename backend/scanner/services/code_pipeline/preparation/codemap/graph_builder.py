"""Assembles CodeMapNode / CodeMapEdge records from analyser output."""
from __future__ import annotations

from scanner.models import CodeMapEdge, CodeMapNode, GitHubScan

from .js_ts_analyzer import JsTsAnalysisResult
from .python_analyzer import PythonAnalysisResult

# Layer assignment for hierarchical layout
LAYER_MAP: dict[str, int] = {
    "frontend_route": 0,
    "component": 1,
    "endpoint": 2,
    "view": 3,
    "service": 4,
    "middleware": 4,
    "utility": 4,
    "model": 5,
}


def _get_or_create_node(
    nodes: dict[str, CodeMapNode],
    scan: GitHubScan,
    node_id: str,
    node_type: str,
    label: str,
    file_path: str = "",
    line_number: int = 0,
    http_methods: list[str] | None = None,
    metadata: dict | None = None,
) -> CodeMapNode:
    if node_id in nodes:
        return nodes[node_id]
    node = CodeMapNode(
        scan=scan,
        node_id=node_id,
        node_type=node_type,
        label=label,
        file_path=file_path,
        line_number=line_number,
        http_methods=http_methods or [],
        metadata_json={**(metadata or {}), "layer": LAYER_MAP.get(node_type, 4)},
    )
    nodes[node_id] = node
    return node


def _classify_callee(callee: str, known_views: set[str], known_models: set[str]) -> str:
    """Decide the node_type for a callee function reference."""
    if callee in known_views:
        return "view"
    if callee in known_models:
        return "model"
    lower = callee.lower()
    if any(kw in lower for kw in ("service", "task", "pipeline", "scan", "generate", "build", "run", "publish")):
        return "service"
    if any(kw in lower for kw in ("middleware", "permission", "auth")):
        return "middleware"
    return "utility"


def build_graph(
    scan: GitHubScan,
    py: PythonAnalysisResult,
    js: JsTsAnalysisResult,
) -> tuple[list[CodeMapNode], list[CodeMapEdge]]:
    nodes: dict[str, CodeMapNode] = {}
    edge_pairs: list[tuple[str, str, str, str]] = []  # (src_id, tgt_id, edge_type, label)

    known_view_names = {v.qualified_name for v in py.views}
    known_model_names = {m.qualified_name for m in py.models}

    # --- Python: URL patterns → endpoint nodes ---
    for pat in py.url_patterns:
        nid = f"endpoint:{pat.url}"
        methods = pat.http_methods or []
        _get_or_create_node(nodes, scan, nid, "endpoint", f"{', '.join(methods) + ' ' if methods else ''}{pat.url}", pat.file_path, pat.line_number, methods)
        if pat.view_ref:
            edge_pairs.append((nid, f"view:{pat.view_ref}", "routes_to", ""))

    # --- Python: view functions ---
    for v in py.views:
        nid = f"view:{v.qualified_name}"
        _get_or_create_node(nodes, scan, nid, "view", v.name, v.file_path, v.line_number, v.http_methods, {"decorators": v.decorators})
        # If an endpoint referenced this view, the edge was already added above.

    # --- Python: call graph (view → service → model) ---
    for call in py.calls:
        caller_type = "view" if call.caller in known_view_names else _classify_callee(call.caller, known_view_names, known_model_names)
        callee_type = _classify_callee(call.callee, known_view_names, known_model_names)
        caller_id = f"{caller_type}:{call.caller}"
        callee_id = f"{callee_type}:{call.callee}"
        _get_or_create_node(nodes, scan, caller_id, caller_type, call.caller.rsplit(".", 1)[-1], call.file_path, call.line_number)
        _get_or_create_node(nodes, scan, callee_id, callee_type, call.callee.rsplit(".", 1)[-1])
        edge_pairs.append((caller_id, callee_id, "calls", ""))

    # --- Python: model nodes ---
    for m in py.models:
        nid = f"model:{m.qualified_name}"
        _get_or_create_node(nodes, scan, nid, "model", m.name, m.file_path, m.line_number)

    # --- JS/TS: routes ---
    for route in js.routes:
        nid = f"frontend_route:{route.path}"
        _get_or_create_node(nodes, scan, nid, "frontend_route", route.path, route.file_path, route.line_number)
        comp_id = f"component:{route.component}"
        _get_or_create_node(nodes, scan, comp_id, "component", route.component, route.file_path, route.line_number)
        edge_pairs.append((nid, comp_id, "renders", ""))

    # --- JS/TS: API calls → link component to endpoint ---
    for api_call in js.api_calls:
        # Try to find a matching endpoint node
        endpoint_id = _match_api_to_endpoint(api_call.url, nodes)
        if endpoint_id:
            # Determine which component/file makes this call
            source_id = _find_component_for_file(api_call.file_path, js, nodes, scan)
            if source_id:
                edge_pairs.append((source_id, endpoint_id, "calls", api_call.url))

    # --- Persist nodes ---
    node_list = list(nodes.values())
    CodeMapNode.objects.bulk_create(node_list)

    # --- Persist edges (deduplicated) ---
    seen_edges: set[tuple[str, str, str]] = set()
    edge_list: list[CodeMapEdge] = []
    for src_id, tgt_id, edge_type, label in edge_pairs:
        if src_id == tgt_id:
            continue
        key = (src_id, tgt_id, edge_type)
        if key in seen_edges:
            continue
        seen_edges.add(key)
        src = nodes.get(src_id)
        tgt = nodes.get(tgt_id)
        if src and tgt:
            edge_list.append(CodeMapEdge(scan=scan, source_node=src, target_node=tgt, edge_type=edge_type, label=label))

    CodeMapEdge.objects.bulk_create(edge_list)
    return node_list, edge_list


def _match_api_to_endpoint(url: str, nodes: dict[str, CodeMapNode]) -> str | None:
    """Find the endpoint node_id that best matches an API URL string."""
    # Normalise: strip base URL prefix, keep path
    path = url
    for prefix in ("/api/", "api/"):
        idx = path.find(prefix)
        if idx >= 0:
            path = path[idx:]
            break
    # Exact match first
    for nid in nodes:
        if nid.startswith("endpoint:") and nid.split(":", 1)[1] in path:
            return nid
    # Prefix match
    best: str | None = None
    best_len = 0
    for nid in nodes:
        if not nid.startswith("endpoint:"):
            continue
        ep_path = nid.split(":", 1)[1]
        if ep_path and ep_path in path and len(ep_path) > best_len:
            best = nid
            best_len = len(ep_path)
    return best


def _find_component_for_file(
    file_path: str,
    js: JsTsAnalysisResult,
    nodes: dict[str, CodeMapNode],
    scan: GitHubScan,
) -> str | None:
    """Determine which component node corresponds to the file making the API call."""
    # Check if there's already a component node for this file
    for nid, node in nodes.items():
        if nid.startswith("component:") and node.file_path == file_path:
            return nid
    # Derive component name from file path
    import os
    basename = os.path.splitext(os.path.basename(file_path))[0]
    if basename == "index":
        basename = os.path.basename(os.path.dirname(file_path))
    comp_id = f"component:{basename}"
    if comp_id in nodes:
        return comp_id
    _get_or_create_node(nodes, scan, comp_id, "component", basename, file_path)
    return comp_id
