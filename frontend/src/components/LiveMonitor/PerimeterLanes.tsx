import type { GcpEventSource, GcpSecurityEvent, LiveMonitorMode } from "../../types";
import { socColors, typography } from "../../theme/theme";

interface Props {
  events: GcpSecurityEvent[];
  counts?: Record<string, number>;
  mode: LiveMonitorMode;
  replayWindowLabel: string;
}

const LANES: { source: GcpEventSource; label: string; color: string }[] = [
  { source: "cloud_armor", label: "Cloud Armor", color: socColors.critical },
  { source: "load_balancer", label: "Load Balancer", color: socColors.accent },
  { source: "iam_audit", label: "IAM Audit", color: socColors.high },
  { source: "iap", label: "IAP", color: socColors.medium },
];

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function PerimeterLanes({
  events,
  counts,
  mode,
  replayWindowLabel,
}: Props) {
  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 32,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${socColors.border}`,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: socColors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Perimeter Lanes
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
          {mode === "live"
            ? "North-south telemetry grouped by enforcement layer"
            : `Edge and identity telemetry in ${replayWindowLabel}`}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 0,
        }}
      >
        {LANES.map((lane) => {
          const laneEvents = events.filter((event) => event.source === lane.source).slice(0, 4);
          const count = counts?.[lane.source] ?? laneEvents.length;
          return (
            <div
              key={lane.source}
              style={{
                padding: 18,
                borderRight: `1px solid ${socColors.border}`,
                borderBottom: `1px solid ${socColors.border}`,
                minHeight: 184,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: lane.color,
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: socColors.text }}>
                    {lane.label}
                  </span>
                </div>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: socColors.bgPanel,
                    color: lane.color,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </div>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {laneEvents.length === 0 ? (
                  <div
                    style={{
                      padding: "18px 12px",
                      borderRadius: 18,
                      background: socColors.bgPanel,
                      color: socColors.textDim,
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    No events
                  </div>
                ) : (
                  laneEvents.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        padding: "12px 12px 10px",
                        borderRadius: 18,
                        background: socColors.bgPanel,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: socColors.text }}>
                          {event.category.replace(/_/g, " ")}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: socColors.textDim,
                            fontFamily: typography.fontMono,
                          }}
                        >
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: socColors.textDim }}>
                        {event.source_ip || event.principal || event.path || "Structured perimeter event"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
