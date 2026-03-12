import { useEffect, useRef } from "react";

import type { Dependency } from "../../../types";
import { renderDependencyTree } from "./dependencyTreeRender";

interface Props {
  dependencies: Dependency[];
}

export default function DependencyTree({ dependencies }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || dependencies.length === 0) return;
    return renderDependencyTree(svgRef.current, dependencies);
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
