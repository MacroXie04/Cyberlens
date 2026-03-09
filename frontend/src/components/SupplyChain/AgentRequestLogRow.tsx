import type { AdkTraceEvent } from "../../types";

import { PHASE_COLORS } from "./agentRequestLogUtils";

interface Props {
  event: AdkTraceEvent;
  expanded: boolean;
  onToggle: () => void;
}

export default function AgentRequestLogRow({ event, expanded, onToggle }: Props) {
  const phaseColor = PHASE_COLORS[event.phase] || "var(--md-outline)";
  const isError = event.status === "error";

  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--md-surface-container)",
        cursor: event.text_preview ? "pointer" : "default",
      }}
      onClick={() => {
        if (event.text_preview) onToggle();
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 600,
            background: `${phaseColor}22`,
            color: phaseColor,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {event.phase.replace(/_/g, " ")}
        </span>
        <span style={{ flex: 1, color: "var(--md-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {event.label}
        </span>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: isError ? "var(--md-error)" : "var(--md-safe)", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--md-font-mono)", fontSize: 11, color: "var(--md-on-surface-variant)", whiteSpace: "nowrap", flexShrink: 0 }}>
          {event.input_tokens.toLocaleString()}/{event.output_tokens.toLocaleString()}
        </span>
        <span style={{ fontFamily: "var(--md-font-mono)", fontSize: 11, color: "var(--md-on-surface-variant)", whiteSpace: "nowrap", flexShrink: 0, minWidth: 40, textAlign: "right" }}>
          {(event.duration_ms / 1000).toFixed(1)}s
        </span>
      </div>

      {expanded && event.text_preview && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 6,
            background: "var(--md-surface-container-high)",
            fontSize: 11,
            fontFamily: "var(--md-font-mono)",
            color: "var(--md-on-surface-variant)",
            maxHeight: 120,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.5,
          }}
        >
          {event.text_preview.slice(0, 1000)}
          {event.text_preview.length > 1000 && "..."}
        </div>
      )}
    </div>
  );
}
