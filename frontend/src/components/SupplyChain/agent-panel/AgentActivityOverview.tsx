import { useMemo } from "react";

import type { AdkTracePhase, AdkTracePhaseSummary, AdkTraceSnapshot, DerivedAgentActivity } from "../../../types";

import { formatTimestamp, PHASE_ORDER, PHASE_SHORT_LABELS, phaseStatusColor } from "./agentActivityUtils";

interface Props {
  adkTrace: AdkTraceSnapshot;
  activity: DerivedAgentActivity;
}

function ActivityMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
      <span style={{ color: "var(--md-on-surface-variant)" }}>{label}</span>
      <span style={{ color: "var(--md-on-surface)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function AgentActivityOverview({ adkTrace, activity }: Props) {
  const phaseMap = useMemo(() => {
    const map = new Map<AdkTracePhase, AdkTracePhaseSummary>();
    for (const phase of adkTrace.phases) {
      map.set(phase.phase, phase);
    }
    return map;
  }, [adkTrace.phases]);

  return (
    <>
      <div style={{ display: "flex", gap: 4 }}>
        {PHASE_ORDER.map((phase) => {
          const summary = phaseMap.get(phase);
          const status = summary?.status || "pending";
          const isCurrent = phase === activity.phase && status === "running";
          const barColor = phaseStatusColor(status);

          return (
            <div key={phase} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 4, borderRadius: 999, background: barColor, position: "relative", overflow: "hidden" }}>
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                      animation: "shimmer 1.5s infinite",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  fontSize: 9,
                  marginTop: 5,
                  color: isCurrent ? "var(--md-primary)" : "var(--md-on-surface-variant)",
                  fontWeight: isCurrent ? 700 : 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {PHASE_SHORT_LABELS[phase]}
              </div>
            </div>
          );
        })}
      </div>

      <div className="agent-activity-panel-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(240px, 0.8fr)", gap: 16 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background:
              activity.status === "error"
                ? "rgba(198, 40, 40, 0.08)"
                : activity.status === "warning"
                  ? "rgba(245, 124, 0, 0.08)"
                  : "var(--md-surface-container)",
            border:
              activity.status === "error"
                ? "1px solid rgba(198, 40, 40, 0.2)"
                : activity.status === "warning"
                  ? "1px solid rgba(245, 124, 0, 0.2)"
                  : "1px solid var(--md-outline-variant)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--md-primary)" }}>
              Agent Activity
            </div>
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "var(--md-surface-container-high)", color: "var(--md-on-surface)", fontWeight: 600 }}>
              {activity.phase_label}
            </span>
          </div>
          <div style={{ marginTop: 14, fontSize: 18, fontWeight: 700, color: "var(--md-on-surface)" }}>
            {activity.title}
          </div>
          {activity.subject && (
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--md-on-surface)" }}>
              {activity.subject}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
            {activity.progress_text}
          </div>
          {(activity.warning_message || activity.error_message) && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: activity.error_message ? "rgba(198, 40, 40, 0.08)" : "rgba(245, 124, 0, 0.08)",
                color: activity.error_message ? "var(--md-error)" : "var(--md-warning)",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {activity.error_message || activity.warning_message}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: "var(--md-surface-container)",
            border: "1px solid var(--md-outline-variant)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
            Execution Status
          </div>
          <ActivityMeta label="Current phase" value={activity.phase_label} />
          <ActivityMeta label="Last update" value={formatTimestamp(activity.updated_at)} />
          <ActivityMeta label="Event count" value={adkTrace.events.length > 0 ? adkTrace.events.length.toLocaleString() : "0"} />
        </div>
      </div>
    </>
  );
}
