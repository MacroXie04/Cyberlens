import type { AdkTraceEvent } from "../types";

import { formatDuration, formatTimestamp, PHASE_LABELS } from "../lib/pipelineShared";
import { InspectorSection } from "./PipelineUi";

interface Props {
  event: AdkTraceEvent;
}

export default function InspectorMeta({ event }: Props) {
  const metaItems = [
    ["Phase", PHASE_LABELS[event.phase] || event.phase],
    ["Kind", event.kind],
    ["Status", event.status],
    ["Label", event.label || "-"],
    ["Parent", event.parent_key || "-"],
    ["Started", formatTimestamp(event.started_at)],
    ["Ended", formatTimestamp(event.ended_at)],
    ["Created", formatTimestamp(event.created_at)],
    ["Duration", formatDuration(event.duration_ms)],
    ["Input Tokens", event.input_tokens.toLocaleString()],
    ["Output Tokens", event.output_tokens.toLocaleString()],
    ["Total Tokens", event.total_tokens.toLocaleString()],
  ];

  return (
    <InspectorSection title="Metadata">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {metaItems.map(([label, value]) => (
          <div key={label} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--md-surface-container)" }}>
            <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)", wordBreak: "break-word" }}>{value}</div>
          </div>
        ))}
      </div>
    </InspectorSection>
  );
}
