import { useCallback, useState } from "react";

import type { CodeMapData } from "../../../types";
import CodeMap from "./CodeMap";
import CodeMapDetail from "./CodeMapDetail";

interface Props {
  data: CodeMapData | null;
  loading?: boolean;
}

export default function CodeMapTab({ data, loading }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ padding: 18, color: "var(--md-on-surface-variant)", fontSize: 13 }}>
        Loading architecture map...
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="card" style={{ padding: 18, color: "var(--md-on-surface-variant)", fontSize: 13 }}>
        No architecture data available. Run a scan to generate the code map.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: selectedNodeId ? "minmax(0, 1fr) 320px" : "1fr", gap: 16, alignItems: "start" }}>
      <CodeMap data={data} onNodeSelect={handleNodeSelect} />
      {selectedNodeId && (
        <CodeMapDetail nodeId={selectedNodeId} data={data} onNavigate={handleNodeSelect} />
      )}
    </div>
  );
}
