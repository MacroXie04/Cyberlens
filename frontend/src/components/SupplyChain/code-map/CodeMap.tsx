import { useEffect, useRef } from "react";

import type { CodeMapData } from "../../../types";
import { renderCodeMap } from "./codeMapRender";

interface Props {
  data: CodeMapData;
  onNodeSelect?: (nodeId: string | null) => void;
}

export default function CodeMap({ data, onNodeSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    return renderCodeMap(svgRef.current, data, onNodeSelect);
  }, [data, onNodeSelect]);

  return (
    <div className="card" style={{ minHeight: 460 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Architecture Map
        {data.nodes.length > 0 && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "var(--md-on-surface-variant)",
              marginLeft: 8,
            }}
          >
            ({data.nodes.length} nodes, {data.edges.length} connections)
          </span>
        )}
      </h3>
      {data.nodes.length === 0 ? (
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
          Run a scan to visualize the project architecture
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox="0 0 1100 700"
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
