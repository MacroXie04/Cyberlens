import type { GcpSecurityEvent } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  events: GcpSecurityEvent[];
  onSelectEvent: (event: GcpSecurityEvent) => void;
  selectedEventId: number | null;
}

const severityColors: Record<string, string> = {
  critical: socColors.critical,
  high: socColors.high,
  medium: socColors.medium,
  low: socColors.low,
  info: socColors.info,
};

const severityBg: Record<string, string> = {
  critical: socColors.criticalBg,
  high: socColors.highBg,
  medium: socColors.mediumBg,
  low: socColors.lowBg,
  info: socColors.infoBg,
};

const sourceLabels: Record<string, string> = {
  cloud_run_logs: "CR",
  load_balancer: "LB",
  cloud_armor: "CA",
  iam_audit: "IAM",
  iap: "IAP",
  cloud_monitoring: "CM",
};

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function LiveEvidenceFeed({
  events,
  onSelectEvent,
  selectedEventId,
}: Props) {
  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${socColors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: socColors.textDim,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Live Evidence Feed
        </span>
        <span style={{ fontSize: 11, color: socColors.textDim }}>
          {events.length} events
        </span>
      </div>
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: socColors.textDim,
              fontSize: 13,
            }}
          >
            No security events in current time window
          </div>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onSelectEvent(evt)}
              style={{
                display: "grid",
                gridTemplateColumns: "44px 56px 60px 1fr auto auto",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderBottom: `1px solid ${socColors.border}`,
                cursor: "pointer",
                background:
                  selectedEventId === evt.id
                    ? socColors.bgCardHover
                    : "transparent",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => {
                if (selectedEventId !== evt.id) {
                  e.currentTarget.style.background = socColors.bgCardHover;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedEventId !== evt.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {/* Severity badge */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: severityColors[evt.severity] || socColors.info,
                  background: severityBg[evt.severity] || socColors.infoBg,
                  padding: "2px 6px",
                  borderRadius: 4,
                  textAlign: "center",
                }}
              >
                {evt.severity}
              </span>

              {/* Source */}
              <span
                style={{
                  fontSize: 10,
                  color: socColors.accent,
                  fontWeight: 500,
                }}
              >
                {sourceLabels[evt.source] || evt.source}
              </span>

              {/* Time */}
              <span
                style={{
                  fontSize: 10,
                  color: socColors.textDim,
                  fontFamily: "'Noto Sans Mono', monospace",
                }}
              >
                {formatTime(evt.timestamp)}
              </span>

              {/* Category + path */}
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: socColors.text,
                    fontWeight: 500,
                  }}
                >
                  {evt.category.replace(/_/g, " ")}
                </span>
                {evt.path && (
                  <span
                    style={{
                      fontSize: 11,
                      color: socColors.textDim,
                      marginLeft: 6,
                    }}
                  >
                    {evt.path.length > 50
                      ? evt.path.slice(0, 47) + "..."
                      : evt.path}
                  </span>
                )}
              </div>

              {/* Service */}
              <span style={{ fontSize: 10, color: socColors.textMuted }}>
                {evt.service || "—"}
              </span>

              {/* Source IP */}
              <span
                style={{
                  fontSize: 10,
                  color: socColors.textDim,
                  fontFamily: "'Noto Sans Mono', monospace",
                }}
              >
                {evt.source_ip || "—"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
