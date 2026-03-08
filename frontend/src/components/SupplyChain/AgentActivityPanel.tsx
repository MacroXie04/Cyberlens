import { useMemo, useState } from "react";

import type { AdkTracePhase, AdkTracePhaseSummary, AdkTraceSnapshot, DerivedAgentActivity } from "../../types";

interface Props {
  adkTrace: AdkTraceSnapshot;
  activity: DerivedAgentActivity;
}

const PHASE_ORDER: AdkTracePhase[] = [
  "dependency_input",
  "dependency_adk_report",
  "code_inventory",
  "chunk_summary",
  "candidate_generation",
  "evidence_expansion",
  "verification",
  "repo_synthesis",
];

const PHASE_SHORT_LABELS: Record<AdkTracePhase, string> = {
  dependency_input: "Deps In",
  dependency_adk_report: "Deps ADK",
  code_inventory: "Inventory",
  chunk_summary: "Chunks",
  candidate_generation: "Candidates",
  evidence_expansion: "Evidence",
  verification: "Verify",
  repo_synthesis: "Synthesis",
};

function phaseStatusColor(status: AdkTracePhaseSummary["status"]): string {
  switch (status) {
    case "success":
      return "var(--md-safe)";
    case "running":
      return "var(--md-primary)";
    case "error":
      return "var(--md-error)";
    case "warning":
      return "var(--md-warning)";
    default:
      return "var(--md-outline)";
  }
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "No updates yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function eventSummary(eventText: string, fallback: string): string {
  const summary = eventText.trim() || fallback;
  return summary.length > 140 ? `${summary.slice(0, 137)}...` : summary;
}

export default function AgentActivityPanel({ adkTrace, activity }: Props) {
  const [eventsOpen, setEventsOpen] = useState(false);

  const phaseMap = useMemo(() => {
    const map = new Map<AdkTracePhase, AdkTracePhaseSummary>();
    for (const phase of adkTrace.phases) {
      map.set(phase.phase, phase);
    }
    return map;
  }, [adkTrace.phases]);

  return (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        {PHASE_ORDER.map((phase) => {
          const summary = phaseMap.get(phase);
          const status = summary?.status || "pending";
          const isCurrent = phase === activity.phase && status === "running";
          const barColor = phaseStatusColor(status);

          return (
            <div key={phase} style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: barColor,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(240px, 0.8fr)",
          gap: 16,
        }}
        className="agent-activity-panel-grid"
      >
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
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: "var(--md-primary)",
              }}
            >
              Agent Activity
            </div>
            <span
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 999,
                background: "var(--md-surface-container-high)",
                color: "var(--md-on-surface)",
                fontWeight: 600,
              }}
            >
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
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--md-on-surface-variant)",
              lineHeight: 1.6,
            }}
          >
            {activity.progress_text}
          </div>
          {(activity.warning_message || activity.error_message) && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background:
                  activity.error_message
                    ? "rgba(198, 40, 40, 0.08)"
                    : "rgba(245, 124, 0, 0.08)",
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
          <ActivityMeta
            label="Event count"
            value={adkTrace.events.length > 0 ? adkTrace.events.length.toLocaleString() : "0"}
          />
        </div>
      </div>

      {activity.recent_events.length > 0 && (
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
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {activity.recent_events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "var(--md-surface-container)",
                    border: "1px solid var(--md-outline-variant)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>
                    {event.label || event.kind}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                    {PHASE_SHORT_LABELS[event.phase]} · #{event.sequence}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: "var(--md-on-surface-variant)",
                      lineHeight: 1.5,
                    }}
                  >
                    {eventSummary(event.text_preview, event.kind)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 880px) {
          .agent-activity-panel-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function ActivityMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>
        {value}
      </div>
    </div>
  );
}
