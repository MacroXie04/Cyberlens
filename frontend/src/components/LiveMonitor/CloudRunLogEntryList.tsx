import type { CloudRunLogEntry } from "../../types";

import { getCloudRunLogSignals } from "./cloudRunLogAnalysis";
import { SEVERITY_COLORS, signalToneColor } from "./cloudRunLogStyles";

interface Props {
  entries: CloudRunLogEntry[];
  fetched: boolean;
  loading: boolean;
}

export default function CloudRunLogEntryList({ entries, fetched, loading }: Props) {
  return (
    <div style={{ maxHeight: 460, overflowY: "auto", background: "var(--md-surface-container)", borderRadius: 8, fontFamily: "var(--md-font-mono)", fontSize: 12, lineHeight: 1.6 }}>
      {loading && !fetched && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
          Loading latest Cloud Run logs...
        </div>
      )}
      {!fetched && !loading && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
          Configure GCP Cloud Logging in Settings and logs will appear here automatically.
        </div>
      )}
      {fetched && entries.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
          No log entries found for the selected filters.
        </div>
      )}
      {entries.map((entry, index) => {
        const entrySignals = getCloudRunLogSignals(entry);
        return (
          <div key={index} style={{ padding: "8px 12px", borderBottom: "1px solid var(--md-outline-variant)", display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span style={{ color: "var(--md-outline)", flexShrink: 0, minWidth: 140 }}>
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
              </span>
              <span style={{ color: SEVERITY_COLORS[entry.severity] || "var(--md-on-surface-variant)", fontWeight: ["ERROR", "CRITICAL", "ALERT", "EMERGENCY"].includes(entry.severity) ? 600 : 400, flexShrink: 0, minWidth: 60 }}>
                {entry.severity}
              </span>
              {entrySignals.map((signal) => (
                <span
                  key={`${entry.timestamp}-${signal.label}`}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                    background: signal.tone === "critical" ? "rgba(239, 83, 80, 0.12)" : signal.tone === "warn" ? "rgba(255, 167, 38, 0.16)" : "rgba(66, 165, 245, 0.12)",
                    color: signalToneColor(signal.tone),
                  }}
                >
                  {signal.label}
                </span>
              ))}
            </div>
            <span style={{ color: "var(--md-on-surface)", wordBreak: "break-all" }}>{entry.message}</span>
          </div>
        );
      })}
    </div>
  );
}
