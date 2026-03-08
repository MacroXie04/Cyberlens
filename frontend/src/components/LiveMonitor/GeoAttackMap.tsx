import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { GcpGeoThreatPoint } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  data: GcpGeoThreatPoint[];
}

const TOPOLOGY_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function GeoAttackMap({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 600;
    const height = 260;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    const projection = d3
      .geoNaturalEarth1()
      .scale(width / 5.5)
      .translate([width / 2, height / 2]);

    const pathGen = d3.geoPath(projection);

    // Background
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", socColors.bgCard);

    // Graticule
    const grat = d3.geoGraticule10();
    svg
      .append("path")
      .datum(grat)
      .attr("d", pathGen as never)
      .attr("fill", "none")
      .attr("stroke", socColors.border)
      .attr("stroke-width", 0.3);

    // Load world topology
    d3.json(TOPOLOGY_URL).then((topoData: any) => {
      if (!topoData) return;
      // Dynamic import from CDN to avoid bundling topojson-client
      import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm"
      ).then((topojson: any) => {
      let countries;
      try {
        countries = topojson.feature(topoData, topoData.objects.countries);
      } catch {
        return;
      }

      // Draw countries
      svg
        .append("g")
        .selectAll("path")
        .data((countries as any).features)
        .join("path")
        .attr("d", pathGen as never)
        .attr("fill", "#14202e")
        .attr("stroke", socColors.border)
        .attr("stroke-width", 0.4);

      // Attack points — only those with valid coords
      const validPoints = data.filter(
        (p) => p.geo_lat != null && p.geo_lng != null
      );

      const maxCount = d3.max(validPoints, (d) => d.count) || 1;
      const sizeScale = d3.scaleSqrt().domain([0, maxCount]).range([3, 18]);

      // Pulse rings
      const pulseG = svg.append("g");
      validPoints.forEach((p) => {
        const coords = projection([p.geo_lng!, p.geo_lat!]);
        if (!coords) return;

        const isCritical = p.critical > 0;
        const color = isCritical ? socColors.critical : socColors.high;

        pulseG
          .append("circle")
          .attr("cx", coords[0])
          .attr("cy", coords[1])
          .attr("r", sizeScale(p.count) + 4)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 1)
          .attr("opacity", 0.6)
          .style("animation", "pulse-ring 2s ease-out infinite");
      });

      // Attack dots
      const dotsG = svg.append("g");
      validPoints.forEach((p) => {
        const coords = projection([p.geo_lng!, p.geo_lat!]);
        if (!coords) return;

        const isCritical = p.critical > 0;
        const color = isCritical ? socColors.critical : socColors.high;

        dotsG
          .append("circle")
          .attr("cx", coords[0])
          .attr("cy", coords[1])
          .attr("r", sizeScale(p.count))
          .attr("fill", color)
          .attr("fill-opacity", 0.6)
          .attr("stroke", color)
          .attr("stroke-width", 1);

        // Label for large clusters
        if (p.count >= 3 && p.country) {
          dotsG
            .append("text")
            .attr("x", coords[0])
            .attr("y", coords[1] - sizeScale(p.count) - 4)
            .attr("text-anchor", "middle")
            .attr("fill", socColors.text)
            .attr("font-size", 9)
            .text(`${p.country} (${p.count})`);
        }
      });
      });
    });
  }, [data]);

  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${socColors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: socColors.textDim,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Geo Attack Map
        </span>
        <span style={{ fontSize: 11, color: socColors.textDim }}>
          {data.length} sources
        </span>
      </div>
      <svg
        ref={svgRef}
        style={{ width: "100%", height: 260, display: "block" }}
      />
      <style>{`
        @keyframes pulse-ring {
          0% { transform-origin: center; opacity: 0.6; }
          100% { transform-origin: center; opacity: 0; r: 24px; }
        }
      `}</style>
    </div>
  );
}
