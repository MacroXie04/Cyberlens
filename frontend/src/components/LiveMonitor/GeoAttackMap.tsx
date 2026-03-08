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
    let cancelled = false;

    async function renderMap() {
      if (!svgRef.current) return;

      const svg = d3.select(svgRef.current);
      const width = svgRef.current.clientWidth || 560;
      const height = 320;

      svg.attr("viewBox", `0 0 ${width} ${height}`);
      svg.selectAll("*").remove();

      svg
        .append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", socColors.bgCard);

      const projection = d3
        .geoNaturalEarth1()
        .scale(width / 5.7)
        .translate([width / 2, height / 2]);

      const pathGen = d3.geoPath(projection);

      svg
        .append("path")
        .datum(d3.geoGraticule10())
        .attr("d", pathGen as never)
        .attr("fill", "none")
        .attr("stroke", socColors.border)
        .attr("stroke-width", 0.6);

      const topoData = await d3.json(TOPOLOGY_URL);
      if (!topoData || cancelled) return;

      const topojson = await import(
        /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm"
      );
      if (cancelled) return;

      const countries = topojson.feature(topoData as never, (topoData as any).objects.countries);
      svg
        .append("g")
        .selectAll("path")
        .data((countries as any).features)
        .join("path")
        .attr("d", pathGen as never)
        .attr("fill", "#e8edf5")
        .attr("stroke", "#cfd7e3")
        .attr("stroke-width", 0.6);

      const validPoints = data.filter(
        (point) => point.geo_lat != null && point.geo_lng != null
      );
      const maxCount = d3.max(validPoints, (point) => point.count) || 1;
      const radiusScale = d3.scaleSqrt().domain([0, maxCount]).range([4, 18]);

      const bubbleGroup = svg.append("g");
      validPoints.forEach((point) => {
        const coords = projection([point.geo_lng!, point.geo_lat!]);
        if (!coords) return;

        const fill = point.critical > 0 ? socColors.critical : socColors.accent;
        bubbleGroup
          .append("circle")
          .attr("cx", coords[0])
          .attr("cy", coords[1])
          .attr("r", radiusScale(point.count) + 4)
          .attr("fill", fill)
          .attr("opacity", 0.12);

        bubbleGroup
          .append("circle")
          .attr("cx", coords[0])
          .attr("cy", coords[1])
          .attr("r", radiusScale(point.count))
          .attr("fill", fill)
          .attr("opacity", 0.82)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5);
      });
    }

    renderMap().catch((error) => {
      if (!cancelled) {
        console.error("Failed to render geo map", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

  const hotSources = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 32,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${socColors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: socColors.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Geo Attack Map
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
            Global origin points observed in the replay window
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 999,
            background: socColors.bgPanel,
            fontSize: 12,
            color: socColors.textDim,
          }}
        >
          <span style={{ color: socColors.text }}>Sources {data.length}</span>
          <span style={{ color: socColors.textDim }}>Events {hotSources}</span>
        </div>
      </div>

      {data.length === 0 ? (
        <div
          style={{
            minHeight: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: socColors.textDim,
            fontSize: 14,
            background:
              "radial-gradient(circle at 20% 20%, rgba(232,240,254,0.8) 0, rgba(255,255,255,0) 42%)",
          }}
        >
          No geo-correlated events in the selected window
        </div>
      ) : (
        <svg
          ref={svgRef}
          style={{ width: "100%", height: 320, display: "block" }}
        />
      )}
    </div>
  );
}
