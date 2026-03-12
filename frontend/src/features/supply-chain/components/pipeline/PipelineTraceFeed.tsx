import type { AdkTraceEvent } from "../../types";

import { formatDuration, formatTimestamp, PHASE_LABELS, statusColor } from "../../lib/pipelineShared";

interface Props {
  events: AdkTraceEvent[];
  selectedEventId: number | null;
  onSelectEvent: (eventId: number) => void;
}

export default function PipelineTraceFeed({ events, selectedEventId, onSelectEvent }: Props) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--md-outline-variant)", fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>
        Trace Feed ({events.length})
      </div>
      <div style={{ maxHeight: 760, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: "var(--md-on-surface-variant)" }}>No events match the current filters.</div>
        ) : (
          events.map((event, index) => {
            const previousPhase = index > 0 ? events[index - 1].phase : null;
            const showHeader = previousPhase !== event.phase;
            return (
              <div key={event.id}>
                {showHeader && <div style={{ padding: "10px 16px", background: "var(--md-surface-container-high)", borderBottom: "1px solid var(--md-outline-variant)", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--md-primary)", fontWeight: 700 }}>{PHASE_LABELS[event.phase]}</div>}
                <button type="button" onClick={() => onSelectEvent(event.id)} style={{ width: "100%", padding: "14px 16px", background: selectedEventId === event.id ? "var(--md-surface-container-high)" : "transparent", border: "none", borderBottom: "1px solid var(--md-outline-variant)", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(event.status), flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.label || PHASE_LABELS[event.phase]}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "var(--md-font-mono)", flexShrink: 0 }}>#{event.sequence}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                    <span>{event.kind}</span><span>{event.status}</span>{event.total_tokens > 0 && <span>{event.total_tokens.toLocaleString()} tokens</span>}{event.duration_ms > 0 && <span>{formatDuration(event.duration_ms)}</span>}<span>{formatTimestamp(event.created_at)}</span>
                  </div>
                  {event.text_preview && <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>{event.text_preview}</div>}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
