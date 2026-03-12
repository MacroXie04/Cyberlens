import { useState } from "react";

import type { AdkTraceEvent } from "../../../types";

interface Props {
  requests: AdkTraceEvent[];
}

export default function CodeScanAgentRequestsCompact({ requests }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const recent = requests.slice(-10);

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--md-on-surface-variant)",
          padding: "4px 0",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10 }}>{collapsed ? "\u25B6" : "\u25BC"}</span>
        Recent LLM calls ({requests.length})
      </button>
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
          {recent.map((request) => (
            <div
              key={request.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 6,
                background: "var(--md-surface-container)",
                color: "var(--md-on-surface-variant)",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: request.status === "error" ? "var(--md-error)" : "var(--md-safe)",
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--md-on-surface)" }}>
                {request.label}
              </span>
              <span style={{ fontFamily: "var(--md-font-mono)", flexShrink: 0 }}>
                {request.total_tokens.toLocaleString()} tok
              </span>
              <span style={{ fontFamily: "var(--md-font-mono)", flexShrink: 0 }}>
                {(request.duration_ms / 1000).toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
