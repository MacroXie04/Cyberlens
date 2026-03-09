import * as d3 from "d3";

import type { GeoData } from "../../types";
import { colors } from "../../theme/theme";

export const WORLD_GEOJSON_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

export function renderAttackMap(svgElement: SVGSVGElement, data: GeoData[], land: d3.GeoPermissibleObjects | null) {
  const svg = d3.select(svgElement);
  const width = 800;
  const height = 400;
  const projection = d3.geoNaturalEarth1().scale(140).translate([width / 2, height / 2]);
  const path = d3.geoPath().projection(projection);
  svg.selectAll("*").remove();
  svg.append("rect").attr("width", width).attr("height", height).attr("fill", colors.surfaceContainer).attr("rx", 16);
  svg.append("path").datum(d3.geoGraticule10()).attr("d", path).attr("fill", "none").attr("stroke", colors.outlineVariant).attr("stroke-width", 0.3).attr("stroke-opacity", 0.4);
  if (land) {
    svg.append("path").datum(land).attr("d", path).attr("fill", colors.surfaceContainerHigh).attr("stroke", colors.outlineVariant).attr("stroke-width", 0.5);
  }
  const pointsGroup = svg.append("g");
  data.forEach((point) => {
    if (point.geo_lat == null || point.geo_lng == null) return;
    const projected = projection([point.geo_lng, point.geo_lat]);
    if (!projected) return;
    const [x, y] = projected;
    const isThreat = point.threats > 0;
    const pointColor = isThreat ? colors.error : colors.primary;
    const radius = Math.min(3 + Math.sqrt(point.count) * 2, 20);
    if (isThreat) {
      pointsGroup.append("circle").attr("cx", x).attr("cy", y).attr("r", radius).attr("fill", "none").attr("stroke", pointColor).attr("stroke-width", 1.5).attr("stroke-opacity", 0).append("animate").attr("attributeName", "r").attr("from", String(radius)).attr("to", String(radius * 3)).attr("dur", "2s").attr("repeatCount", "indefinite");
      pointsGroup.select("circle:last-child").append("animate").attr("attributeName", "stroke-opacity").attr("from", "0.8").attr("to", "0").attr("dur", "2s").attr("repeatCount", "indefinite");
      const pulse2 = pointsGroup.append("circle").attr("cx", x).attr("cy", y).attr("r", radius).attr("fill", "none").attr("stroke", pointColor).attr("stroke-width", 1).attr("stroke-opacity", 0);
      pulse2.append("animate").attr("attributeName", "r").attr("from", String(radius)).attr("to", String(radius * 2.5)).attr("dur", "2s").attr("begin", "0.7s").attr("repeatCount", "indefinite");
      pulse2.append("animate").attr("attributeName", "stroke-opacity").attr("from", "0.6").attr("to", "0").attr("dur", "2s").attr("begin", "0.7s").attr("repeatCount", "indefinite");
    }
    pointsGroup.append("circle").attr("cx", x).attr("cy", y).attr("r", radius).attr("fill", pointColor).attr("fill-opacity", 0.7).attr("stroke", pointColor).attr("stroke-width", 1);
    pointsGroup.append("circle").attr("cx", x).attr("cy", y).attr("r", radius * 0.4).attr("fill", "#fff").attr("fill-opacity", 0.8);
  });
  const legend = svg.append("g").attr("transform", "translate(20, 360)");
  legend.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 5).attr("fill", colors.error);
  legend.append("text").attr("x", 12).attr("y", 4).text("Threat Source").attr("fill", colors.onSurface).attr("font-size", 11);
  legend.append("circle").attr("cx", 110).attr("cy", 0).attr("r", 5).attr("fill", colors.primary);
  legend.append("text").attr("x", 122).attr("y", 4).text("Normal Traffic").attr("fill", colors.onSurface).attr("font-size", 11);
}
