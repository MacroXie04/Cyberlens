import { useMemo, useState } from "react";

import type { AdkTraceEvent } from "../../../types";

import AgentRequestLogRow from "./AgentRequestLogRow";
import { summarizeRequests } from "./agentRequestLogUtils";

interface Props {
  events: AdkTraceEvent[];
  loading?: boolean;
}

export default function AgentRequestLog({ events, loading }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const totals = useMemo(() => summarizeRequests(events), [events]);

  if (events.length === 0 && !loading) return null;

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--md-on-surface)", margin: 0 }}>
          Agent Request Log
          {loading && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--md-primary)", fontWeight: 400 }}>
              streaming...
            </span>
          )}
        </h4>
        {totals.count > 0 && (
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--md-on-surface-variant)" }}>
            <span><strong style={{ color: "var(--md-on-surface)" }}>{totals.count}</strong> requests</span>
            <span><strong style={{ color: "var(--md-on-surface)" }}>{totals.inputTokens.toLocaleString()}</strong> in</span>
            <span><strong style={{ color: "var(--md-on-surface)" }}>{totals.outputTokens.toLocaleString()}</strong> out</span>
            <span><strong style={{ color: "var(--md-primary)" }}>{totals.totalTokens.toLocaleString()}</strong> total</span>
            <span><strong style={{ color: "var(--md-on-surface)" }}>{(totals.durationMs / 1000).toFixed(1)}s</strong></span>
          </div>
        )}
      </div>

      {events.length === 0 && loading && (
        <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", padding: "8px 0" }}>
          Waiting for agent LLM calls...
        </div>
      )}

      {events.length > 0 && (
        <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {events.map((event) => (
            <AgentRequestLogRow
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
