import { useState } from "react";

import type { DerivedAgentActivity } from "../../../types";

import { eventSummary, formatTimestamp } from "./agentActivityUtils";

interface Props {
  activity: DerivedAgentActivity;
}

export default function AgentActivityRecentEvents({ activity }: Props) {
  const [eventsOpen, setEventsOpen] = useState(false);

  if (activity.recent_events.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setEventsOpen((open) => !open)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--md-on-surface-variant)",
          cursor: "pointer",
        }}
      >
        {eventsOpen ? "Hide recent events" : "Show recent events"}
      </button>

      {eventsOpen && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {activity.recent_events.map((event) => (
            <div
              key={event.id}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--md-surface-container)",
                border: "1px solid var(--md-outline-variant)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)" }}>
                  {event.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                  {formatTimestamp(event.created_at)}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.55 }}>
                {eventSummary(event.text_preview || "", event.kind)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
