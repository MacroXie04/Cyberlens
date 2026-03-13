import type * as d3 from "d3";

import type { CodeMapData, CodeMapNode } from "../../../types";
import { colors, socColors } from "../../../theme/theme";

export interface MapNode extends d3.SimulationNodeDatum {
  id: string;
  nodeType: CodeMapNode["node_type"];
  label: string;
  filePath: string;
  lineNumber: number;
  httpMethods: string[];
  layer: number;
}

export interface MapLink extends d3.SimulationLinkDatum<MapNode> {
  source: MapNode | string;
  target: MapNode | string;
  edgeType: string;
  label: string;
}

export const LAYER_LABELS = [
  "Frontend Routes",
  "Components",
  "API Endpoints",
  "Views",
  "Services",
  "Models",
];

const LAYER_MAP: Record<string, number> = {
  frontend_route: 0,
  component: 1,
  endpoint: 2,
  view: 3,
  service: 4,
  middleware: 4,
  utility: 4,
  model: 5,
};

export function buildCodeMapGraph(data: CodeMapData): { nodes: MapNode[]; links: MapLink[] } {
  const nodeMap = new Map<string, MapNode>();

  for (const n of data.nodes) {
    const layer = (n.metadata_json?.layer as number) ?? LAYER_MAP[n.node_type] ?? 4;
    nodeMap.set(n.node_id, {
      id: n.node_id,
      nodeType: n.node_type,
      label: n.label,
      filePath: n.file_path,
      lineNumber: n.line_number,
      httpMethods: n.http_methods,
      layer,
    });
  }

  const links: MapLink[] = [];
  for (const e of data.edges) {
    if (nodeMap.has(e.source_node_id) && nodeMap.has(e.target_node_id)) {
      links.push({
        source: e.source_node_id,
        target: e.target_node_id,
        edgeType: e.edge_type,
        label: e.label,
      });
    }
  }

  return { nodes: Array.from(nodeMap.values()), links };
}

export function nodeColor(node: MapNode): string {
  switch (node.nodeType) {
    case "frontend_route":
      return colors.primary;
    case "component":
      return socColors.accent;
    case "endpoint":
      return colors.onPrimaryContainer;
    case "view":
      return socColors.high;
    case "service":
    case "middleware":
    case "utility":
      return colors.warning;
    case "model":
      return colors.safe;
    default:
      return colors.outline;
  }
}

export function nodeRadius(node: MapNode): number {
  switch (node.nodeType) {
    case "endpoint":
    case "frontend_route":
      return 10;
    case "view":
    case "component":
      return 8;
    case "service":
    case "middleware":
    case "utility":
      return 7;
    case "model":
      return 6;
    default:
      return 6;
  }
}
