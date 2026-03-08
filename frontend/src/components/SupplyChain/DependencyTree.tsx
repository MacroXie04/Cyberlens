import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Dependency } from "../../types";
import { colors } from "../../theme/theme";

interface Props {
  dependencies: Dependency[];
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  fullName: string;
  ecosystem: string;
  isVulnerable: boolean;
  vulnCount: number;
  isCenter: boolean;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
}

export default function DependencyTree({ dependencies }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || dependencies.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 600;

    // Build nodes and links
    // Center node represents the project
    const nodes: SimNode[] = [
      {
        id: "project",
        name: "Project",
        fullName: "Project",
        ecosystem: "",
        isVulnerable: false,
        vulnCount: 0,
        isCenter: true,
      },
    ];

    const links: SimLink[] = [];

    // Group by ecosystem for clustering
    const ecosystems = [...new Set(dependencies.map((d) => d.ecosystem))];
    const ecosystemNodes: SimNode[] = ecosystems.map((eco) => ({
      id: `eco-${eco}`,
      name: eco,
      fullName: eco,
      ecosystem: eco,
      isVulnerable: false,
      vulnCount: 0,
      isCenter: false,
    }));

    nodes.push(...ecosystemNodes);
    ecosystems.forEach((eco) => {
      links.push({ source: "project", target: `eco-${eco}` });
    });

    // Add dependency nodes linked to their ecosystem
    dependencies.forEach((dep) => {
      const vulnCount = dep.vulnerabilities?.length || 0;
      nodes.push({
        id: `dep-${dep.id}`,
        name: dep.name,
        fullName: `${dep.name}@${dep.version}`,
        ecosystem: dep.ecosystem,
        isVulnerable: dep.is_vulnerable,
        vulnCount,
        isCenter: false,
      });
      links.push({ source: `eco-${dep.ecosystem}`, target: `dep-${dep.id}` });
    });

    // Color scale
    function nodeColor(node: SimNode): string {
      if (node.isCenter) return colors.primary;
      if (node.id.startsWith("eco-")) return colors.onPrimaryContainer;
      if (node.isVulnerable) {
        if (node.vulnCount >= 3) return colors.error;
        return "#FF7043"; // orange for moderate
      }
      return colors.safe;
    }

    function nodeRadius(node: SimNode): number {
      if (node.isCenter) return 24;
      if (node.id.startsWith("eco-")) return 16;
      if (node.isVulnerable) return 8 + Math.min(node.vulnCount * 2, 8);
      return 6;
    }

    // Force simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((link) => {
            const src = link.source as SimNode;
            if (src.isCenter) return 150;
            if (src.id.startsWith("eco-")) return 80;
            return 40;
          })
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 4)
      );

    // SVG groups
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Links
    const linkElements = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", colors.outlineVariant)
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.4);

    // Nodes
    const nodeElements = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Glow for vulnerable nodes
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Node circles
    nodeElements
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => nodeColor(d))
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) => nodeColor(d))
      .attr("stroke-width", (d) => (d.isVulnerable ? 2 : 1))
      .attr("stroke-opacity", 1)
      .attr("filter", (d) => (d.isVulnerable ? "url(#glow)" : null));

    // Labels for center and ecosystem nodes
    nodeElements
      .filter((d) => d.isCenter || d.id.startsWith("eco-"))
      .append("text")
      .text((d) => d.name)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 14)
      .attr("fill", colors.onSurface)
      .attr("font-size", (d) => (d.isCenter ? 13 : 11))
      .attr("font-weight", 500);

    // Labels for dependency nodes
    const depLabels = nodeElements
      .filter((d) => !d.isCenter && !d.id.startsWith("eco-"))
      .append("text")
      .text((d) => d.name)
      .attr("text-anchor", (d) => ((d.x ?? 0) < width / 2 ? "start" : "end"))
      .attr("dx", (d) =>
        (d.x ?? 0) < width / 2 ? nodeRadius(d) + 4 : -(nodeRadius(d) + 4)
      )
      .attr("dy", "0.35em")
      .attr("fill", colors.onSurface)
      .attr("fill-opacity", 0.85)
      .attr("font-size", 9)
      .attr("font-weight", 400);

    // Tooltip on hover for dependency nodes
    nodeElements
      .filter((d) => !d.isCenter && !d.id.startsWith("eco-"))
      .append("title")
      .text(
        (d) =>
          `${d.fullName}\n${d.ecosystem}${d.isVulnerable ? `\n${d.vulnCount} vulnerabilit${d.vulnCount === 1 ? "y" : "ies"}` : ""}`
      );

    // Simulation tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);

      nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);

      depLabels
        .attr("text-anchor", (d) => ((d.x ?? 0) < width / 2 ? "start" : "end"))
        .attr("dx", (d) =>
          (d.x ?? 0) < width / 2 ? nodeRadius(d) + 4 : -(nodeRadius(d) + 4)
        );
    });

    // Legend
    const legend = svg.append("g").attr("transform", `translate(16, ${height - 40})`);

    const legendItems = [
      { label: "Safe", color: colors.safe },
      { label: "Vulnerable", color: "#FF7043" },
      { label: "Critical", color: colors.error },
      { label: "Ecosystem", color: colors.onPrimaryContainer },
    ];

    legendItems.forEach((item, i) => {
      const lg = legend.append("g").attr("transform", `translate(${i * 100}, 0)`);
      lg.append("circle").attr("r", 5).attr("fill", item.color);
      lg.append("text")
        .attr("x", 10)
        .attr("y", 4)
        .text(item.label)
        .attr("fill", colors.onSurface)
        .attr("font-size", 11);
    });

    return () => {
      simulation.stop();
    };
  }, [dependencies]);

  return (
    <div className="card" style={{ minHeight: 420 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Dependency Tree
        {dependencies.length > 0 && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "var(--md-on-surface-variant)",
              marginLeft: 8,
            }}
          >
            ({dependencies.length} packages)
          </span>
        )}
      </h3>
      {dependencies.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 280,
            color: "var(--md-on-surface-variant)",
            fontSize: 14,
          }}
        >
          Run a scan to visualize dependencies
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox="0 0 800 600"
          width="100%"
          style={{
            borderRadius: 16,
            overflow: "hidden",
            background: "var(--md-surface-container)",
          }}
        />
      )}
    </div>
  );
}
