import type { GcpSecurityEvent, LiveMonitorMode } from "../../types";
import { socColors, typography } from "../../theme/theme";

interface Props {
  events: GcpSecurityEvent[];
  mode: LiveMonitorMode;
  replayWindowLabel: string;
  onSelectEvent: (event: GcpSecurityEvent) => void;
  selectedEventId: number | null;
}

const severityColors: Record<string, { text: string; background: string }> = {
  critical: { text: socColors.critical, background: socColors.criticalBg },
  high: { text: socColors.high, background: socColors.highBg },
  medium: { text: socColors.medium, background: socColors.mediumBg },
  low: { text: socColors.low, background: socColors.lowBg },
  info: { text: socColors.info, background: socColors.infoBg },
};

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function prettifyLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export default function LiveEvidenceFeed({
  events,
  mode,
  replayWindowLabel,
  onSelectEvent,
  selectedEventId,
}: Props) {
  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 32,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 360,
      }}
    >
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${socColors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: socColors.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {mode === "live" ? "Live Evidence Feed" : "Evidence Feed"}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
            {mode === "live"
              ? "Streaming and recent parsed security evidence"
              : `Security evidence captured in ${replayWindowLabel}`}
          </div>
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            background: socColors.bgPanel,
            fontSize: 12,
            color: socColors.textDim,
          }}
        >
          {events.length} events
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div
            style={{
              height: "100%",
              minHeight: 240,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              color: socColors.textDim,
              fontSize: 14,
            }}
          >
            No events in the selected replay window
          </div>
        ) : (
          events.map((event) => {
            const selected = selectedEventId === event.id;
            const palette = severityColors[event.severity] || severityColors.info;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event)}
                style={{
                  width: "100%",
                  border: "none",
                  background: selected ? socColors.bgCardHover : "transparent",
                  padding: "16px 20px",
                  borderBottom: `1px solid ${socColors.border}`,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "90px 1fr auto",
                  gap: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-flex",
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: palette.background,
                      color: palette.text,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {event.severity}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      color: socColors.textDim,
                      fontFamily: typography.fontMono,
                    }}
                  >
                    {formatTime(event.timestamp)}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: socColors.text }}>
                      {prettifyLabel(event.category)}
                    </span>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "4px 8px",
                        background: socColors.bgPanel,
                        color: socColors.textMuted,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {prettifyLabel(event.source)}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: socColors.textDim,
                      lineHeight: 1.5,
                    }}
                  >
                    {event.path || event.raw_payload_preview || "Structured event with no request path"}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      fontSize: 12,
                      color: socColors.textMuted,
                    }}
                  >
                    <span>Service {event.service || "n/a"}</span>
                    <span>Region {event.region || "global"}</span>
                    <span>IP {event.source_ip || "unknown"}</span>
                  </div>
                </div>

                <div style={{ minWidth: 96, textAlign: "right" }}>
                  {event.status_code != null && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: socColors.text }}>
                      {event.status_code}
                    </div>
                  )}
                  {event.country && (
                    <div style={{ marginTop: 8, fontSize: 12, color: socColors.textDim }}>
                      {event.country}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
