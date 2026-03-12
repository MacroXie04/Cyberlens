import * as d3 from "d3";

import { colors } from "../../../theme/theme";
import type { Dependency } from "../../../types";
import { buildGraph, nodeColor, nodeRadius, type SimLink, type SimNode } from "./dependencyTreeGraph";

export function renderDependencyTree(svgElement: SVGSVGElement, dependencies: Dependency[]) {
  const width = 800;
  const height = 600;
  const { links, nodes } = buildGraph(dependencies);
  const svg = d3.select(svgElement);

  svg.selectAll("*").remove();

  const simulation = d3
    .forceSimulation<SimNode>(nodes)
    .force(
      "link",
      d3
        .forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance((link) => {
          const source = link.source as SimNode;
          if (source.isCenter) return 150;
          if (source.id.startsWith("eco-")) return 80;
          return 40;
        })
    )
    .force("charge", d3.forceManyBody().strength(-120))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide<SimNode>().radius((node) => nodeRadius(node) + 4));

  const group = svg.append("g");
  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => group.attr("transform", event.transform))
  );

  const linkElements = group
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", colors.outlineVariant)
    .attr("stroke-width", 1)
    .attr("stroke-opacity", 0.4);

  const nodeElements = group
    .append("g")
    .selectAll<SVGGElement, SimNode>("g")
    .data(nodes)
    .join("g")
    .style("cursor", "pointer")
    .call(
      d3
        .drag<SVGGElement, SimNode>()
        .on("start", (event, node) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          node.fx = node.x;
          node.fy = node.y;
        })
        .on("drag", (event, node) => {
          node.fx = event.x;
          node.fy = event.y;
        })
        .on("end", (event, node) => {
          if (!event.active) simulation.alphaTarget(0);
          node.fx = null;
          node.fy = null;
        })
    );

  const defs = svg.append("defs");
  const filter = defs.append("filter").attr("id", "glow");
  filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
  const merge = filter.append("feMerge");
  merge.append("feMergeNode").attr("in", "coloredBlur");
  merge.append("feMergeNode").attr("in", "SourceGraphic");

  nodeElements
    .append("circle")
    .attr("r", (node) => nodeRadius(node))
    .attr("fill", (node) => nodeColor(node))
    .attr("fill-opacity", 0.85)
    .attr("stroke", (node) => nodeColor(node))
    .attr("stroke-width", (node) => (node.isVulnerable ? 2 : 1))
    .attr("filter", (node) => (node.isVulnerable ? "url(#glow)" : null));

  nodeElements
    .filter((node) => node.isCenter || node.id.startsWith("eco-"))
    .append("text")
    .text((node) => node.name)
    .attr("text-anchor", "middle")
    .attr("dy", (node) => nodeRadius(node) + 14)
    .attr("fill", colors.onSurface)
    .attr("font-size", (node) => (node.isCenter ? 13 : 11))
    .attr("font-weight", 500);

  const dependencyLabels = nodeElements
    .filter((node) => !node.isCenter && !node.id.startsWith("eco-"))
    .append("text")
    .text((node) => node.name)
    .attr("fill", colors.onSurface)
    .attr("fill-opacity", 0.85)
    .attr("font-size", 9)
    .attr("font-weight", 400);

  dependencyLabels
    .attr("text-anchor", (node) => ((node.x ?? 0) < width / 2 ? "start" : "end"))
    .attr("dx", (node) => ((node.x ?? 0) < width / 2 ? nodeRadius(node) + 4 : -(nodeRadius(node) + 4)))
    .attr("dy", "0.35em");

  nodeElements
    .filter((node) => !node.isCenter && !node.id.startsWith("eco-"))
    .append("title")
    .text(
      (node) =>
        `${node.fullName}\n${node.ecosystem}${node.isVulnerable ? `\n${node.vulnCount} vulnerabilit${node.vulnCount === 1 ? "y" : "ies"}` : ""}`
    );

  simulation.on("tick", () => {
    linkElements
      .attr("x1", (link) => (link.source as SimNode).x!)
      .attr("y1", (link) => (link.source as SimNode).y!)
      .attr("x2", (link) => (link.target as SimNode).x!)
      .attr("y2", (link) => (link.target as SimNode).y!);

    nodeElements.attr("transform", (node) => `translate(${node.x},${node.y})`);
    dependencyLabels
      .attr("text-anchor", (node) => ((node.x ?? 0) < width / 2 ? "start" : "end"))
      .attr("dx", (node) => ((node.x ?? 0) < width / 2 ? nodeRadius(node) + 4 : -(nodeRadius(node) + 4)));
  });

  const legend = svg.append("g").attr("transform", `translate(16, ${height - 40})`);
  [
    { label: "Safe", color: colors.safe },
    { label: "Vulnerable", color: "#FF7043" },
    { label: "Critical", color: colors.error },
    { label: "Ecosystem", color: colors.onPrimaryContainer },
  ].forEach((item, index) => {
    const groupNode = legend.append("g").attr("transform", `translate(${index * 100}, 0)`);
    groupNode.append("circle").attr("r", 5).attr("fill", item.color);
    groupNode.append("text").attr("x", 10).attr("y", 4).text(item.label).attr("fill", colors.onSurface).attr("font-size", 11);
  });

  return () => {
    simulation.stop();
  };
}
