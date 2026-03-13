import * as d3 from "d3";

import { colors, socColors } from "../../../theme/theme";
import type { CodeMapData } from "../../../types";
import {
  buildCodeMapGraph,
  LAYER_LABELS,
  nodeColor,
  nodeRadius,
  type MapLink,
  type MapNode,
} from "./codeMapGraph";

export function renderCodeMap(
  svgElement: SVGSVGElement,
  data: CodeMapData,
  onNodeSelect?: (nodeId: string | null) => void,
) {
  const width = 1100;
  const height = 700;
  const { nodes, links } = buildCodeMapGraph(data);
  const svg = d3.select(svgElement);
  svg.selectAll("*").remove();

  if (nodes.length === 0) return () => {};

  // Determine which layers are actually present
  const presentLayers = [...new Set(nodes.map((n) => n.layer))].sort((a, b) => a - b);
  const layerCount = presentLayers.length;
  const columnWidth = width / (layerCount + 1);

  // Map each layer to an x position
  const layerX = new Map<number, number>();
  presentLayers.forEach((layer, i) => {
    layerX.set(layer, columnWidth * (i + 1));
  });

  // Assign initial positions by layer
  const layerNodes = new Map<number, MapNode[]>();
  for (const n of nodes) {
    const layer = n.layer;
    if (!layerNodes.has(layer)) layerNodes.set(layer, []);
    layerNodes.get(layer)!.push(n);
  }
  for (const [layer, ns] of layerNodes) {
    const x = layerX.get(layer) ?? width / 2;
    const spacing = Math.min(40, (height - 100) / (ns.length + 1));
    const startY = (height - spacing * (ns.length - 1)) / 2;
    ns.forEach((n, i) => {
      n.x = x;
      n.y = startY + i * spacing;
    });
  }

  const simulation = d3
    .forceSimulation<MapNode>(nodes)
    .force(
      "link",
      d3
        .forceLink<MapNode, MapLink>(links)
        .id((n) => n.id)
        .distance(60)
        .strength(0.3),
    )
    .force("charge", d3.forceManyBody().strength(-50))
    .force(
      "x",
      d3.forceX<MapNode>((n) => layerX.get(n.layer) ?? width / 2).strength(0.8),
    )
    .force("y", d3.forceY(height / 2).strength(0.05))
    .force("collision", d3.forceCollide<MapNode>().radius((n) => nodeRadius(n) + 6));

  const group = svg.append("g");

  // Zoom
  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => group.attr("transform", event.transform)),
  );

  // Layer labels
  const labelGroup = group.append("g").attr("class", "layer-labels");
  for (const [layer, x] of layerX) {
    const label = LAYER_LABELS[layer] ?? `Layer ${layer}`;
    labelGroup
      .append("text")
      .attr("x", x)
      .attr("y", 24)
      .attr("text-anchor", "middle")
      .attr("fill", colors.onSurfaceVariant)
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("opacity", 0.7)
      .text(label);

    // Column background
    labelGroup
      .append("rect")
      .attr("x", x - columnWidth / 2 + 10)
      .attr("y", 36)
      .attr("width", columnWidth - 20)
      .attr("height", height - 70)
      .attr("rx", 12)
      .attr("fill", layer % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent")
      .attr("stroke", "none");
  }

  // Links
  const linkElements = group
    .append("g")
    .selectAll<SVGPathElement, MapLink>("path")
    .data(links)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", colors.outlineVariant)
    .attr("stroke-width", 1)
    .attr("stroke-opacity", 0.4)
    .attr("marker-end", "url(#arrowhead)");

  // Arrowhead marker
  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 14)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-4L10,0L0,4")
    .attr("fill", colors.outlineVariant);

  // Highlighted arrowhead
  defs
    .append("marker")
    .attr("id", "arrowhead-highlight")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 14)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-4L10,0L0,4")
    .attr("fill", socColors.accent);

  // Nodes
  const nodeElements = group
    .append("g")
    .selectAll<SVGGElement, MapNode>("g")
    .data(nodes)
    .join("g")
    .style("cursor", "pointer")
    .call(
      d3
        .drag<SVGGElement, MapNode>()
        .on("start", (event, n) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          n.fx = n.x;
          n.fy = n.y;
        })
        .on("drag", (event, n) => {
          n.fx = event.x;
          n.fy = event.y;
        })
        .on("end", (event, n) => {
          if (!event.active) simulation.alphaTarget(0);
          n.fx = null;
          n.fy = null;
        }),
    );

  nodeElements
    .append("circle")
    .attr("r", (n) => nodeRadius(n))
    .attr("fill", (n) => nodeColor(n))
    .attr("fill-opacity", 0.85)
    .attr("stroke", (n) => nodeColor(n))
    .attr("stroke-width", 1.5);

  // Labels
  nodeElements
    .append("text")
    .text((n) => {
      const lbl = n.label.length > 24 ? n.label.slice(0, 22) + "..." : n.label;
      return n.httpMethods.length > 0 ? `${n.httpMethods.join(",")} ${lbl}` : lbl;
    })
    .attr("dy", (n) => nodeRadius(n) + 12)
    .attr("text-anchor", "middle")
    .attr("fill", colors.onSurface)
    .attr("fill-opacity", 0.85)
    .attr("font-size", 9)
    .attr("font-weight", 400);

  // Tooltips
  nodeElements.append("title").text((n) => {
    let tip = `${n.label}\nType: ${n.nodeType}`;
    if (n.filePath) tip += `\nFile: ${n.filePath}:${n.lineNumber}`;
    if (n.httpMethods.length > 0) tip += `\nMethods: ${n.httpMethods.join(", ")}`;
    return tip;
  });

  // Click handling for highlight + selection
  let selectedId: string | null = null;

  function getConnected(nodeId: string): Set<string> {
    const connected = new Set<string>();
    connected.add(nodeId);
    // BFS to find all connected nodes (up and downstream)
    const queue = [nodeId];
    const visited = new Set<string>([nodeId]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const link of links) {
        const src = typeof link.source === "string" ? link.source : link.source.id;
        const tgt = typeof link.target === "string" ? link.target : link.target.id;
        if (src === current && !visited.has(tgt)) {
          visited.add(tgt);
          connected.add(tgt);
          queue.push(tgt);
        }
        if (tgt === current && !visited.has(src)) {
          visited.add(src);
          connected.add(src);
          queue.push(src);
        }
      }
    }
    return connected;
  }

  function updateHighlight() {
    if (!selectedId) {
      nodeElements.select("circle").attr("opacity", 1);
      nodeElements.selectAll("text").attr("opacity", 1);
      linkElements.attr("stroke-opacity", 0.4).attr("stroke", colors.outlineVariant).attr("stroke-width", 1).attr("marker-end", "url(#arrowhead)");
      return;
    }
    const connected = getConnected(selectedId);
    nodeElements.select<SVGCircleElement>("circle").attr("opacity", (n: MapNode) => (connected.has(n.id) ? 1 : 0.15));
    nodeElements.select<SVGTextElement>("text").attr("opacity", (n: MapNode) => (connected.has(n.id) ? 1 : 0.15));
    linkElements
      .attr("stroke-opacity", (l: MapLink) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return connected.has(src) && connected.has(tgt) ? 0.8 : 0.08;
      })
      .attr("stroke", (l: MapLink) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return connected.has(src) && connected.has(tgt) ? socColors.accent : colors.outlineVariant;
      })
      .attr("stroke-width", (l: MapLink) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return connected.has(src) && connected.has(tgt) ? 2 : 1;
      })
      .attr("marker-end", (l: MapLink) => {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        return connected.has(src) && connected.has(tgt) ? "url(#arrowhead-highlight)" : "url(#arrowhead)";
      });
  }

  nodeElements.on("click", (_event: MouseEvent, n: MapNode) => {
    selectedId = selectedId === n.id ? null : n.id;
    updateHighlight();
    onNodeSelect?.(selectedId);
  });

  // Background click to deselect
  svg.on("click", (event: MouseEvent) => {
    if ((event.target as Element).tagName === "svg" || (event.target as Element).tagName === "rect") {
      selectedId = null;
      updateHighlight();
      onNodeSelect?.(null);
    }
  });

  // Tick
  simulation.on("tick", () => {
    linkElements.attr("d", (l) => {
      const src = l.source as MapNode;
      const tgt = l.target as MapNode;
      const dx = (tgt.x ?? 0) - (src.x ?? 0);
      const dy = (tgt.y ?? 0) - (src.y ?? 0);
      const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
      return `M${src.x},${src.y}A${dr},${dr} 0 0,1 ${tgt.x},${tgt.y}`;
    });
    nodeElements.attr("transform", (n) => `translate(${n.x},${n.y})`);
  });

  // Legend
  const legend = svg.append("g").attr("transform", `translate(16, ${height - 36})`);
  const legendItems = [
    { label: "Route", color: colors.primary },
    { label: "Component", color: socColors.accent },
    { label: "Endpoint", color: colors.onPrimaryContainer },
    { label: "View", color: socColors.high },
    { label: "Service", color: colors.warning },
    { label: "Model", color: colors.safe },
  ];
  legendItems.forEach((item, i) => {
    const g = legend.append("g").attr("transform", `translate(${i * 100}, 0)`);
    g.append("circle").attr("r", 4).attr("fill", item.color);
    g.append("text").attr("x", 8).attr("y", 4).text(item.label).attr("fill", colors.onSurface).attr("font-size", 10);
  });

  return () => {
    simulation.stop();
  };
}
