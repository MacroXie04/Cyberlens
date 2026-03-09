import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { GeoData } from "../../types";
import { WORLD_GEOJSON_URL, renderAttackMap } from "./attackMapRender";

interface Props {
  data: GeoData[];
}

export default function AttackMap({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fetchedRef = useRef(false);
  const landRef = useRef<d3.GeoPermissibleObjects | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      import("https://cdn.jsdelivr.net/npm/topojson-client@3/+esm")
        .then((topojson) => {
          return fetch(WORLD_GEOJSON_URL)
            .then((r) => r.json())
            .then((world) => {
              landRef.current = topojson.feature(
                world,
                world.objects.land
              ) as unknown as d3.GeoPermissibleObjects;
              renderAttackMap(svgRef.current!, data, landRef.current);
            });
        })
        .catch(() => {
          renderAttackMap(svgRef.current!, data, null);
        });
    } else {
      renderAttackMap(svgRef.current, data, landRef.current);
    }
  }, [data]);

  return (
    <div className="card" style={{ minHeight: 300 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Attack Origin Map
      </h3>
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        width="100%"
        style={{ borderRadius: 16, overflow: "hidden" }}
      />
    </div>
  );
}
