import type { GcpSecurityEvent, GcpEventSource } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  events: GcpSecurityEvent[];
}

const LANES: { source: GcpEventSource; label: string; color: string }[] = [
  { source: "cloud_armor", label: "Cloud Armor", color: socColors.critical },
  { source: "load_balancer", label: "Load Balancer", color: socColors.accent },
  { source: "iam_audit", label: "IAM Audit", color: socColors.high },
  { source: "iap", label: "IAP", color: socColors.medium },
];

const severityDot: Record<string, string> = {
  critical: socColors.critical,
  high: socColors.high,
  medium: socColors.medium,
  low: socColors.low,
  info: socColors.info,
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

export default function PerimeterLanes({ events }: Props) {
  const bySource = new Map<GcpEventSource, GcpSecurityEvent[]>();
  for (const lane of LANES) {
    bySource.set(lane.source, []);
  }
  for (const evt of events) {
    const list = bySource.get(evt.source as GcpEventSource);
    if (list) list.push(evt);
  }

  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${socColors.border}`,
          fontSize: 12,
          color: socColors.textDim,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Perimeter Lanes
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {LANES.map((lane) => {
          const laneEvents = bySource.get(lane.source) || [];
          return (
            <div
              key={lane.source}
              style={{
                borderRight: `1px solid ${socColors.border}`,
                minHeight: 160,
              }}
            >
              {/* Lane header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderBottom: `1px solid ${socColors.border}`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: lane.color,
                  }}
                />
                <span style={{ fontSize: 11, color: socColors.text, fontWeight: 500 }}>
                  {lane.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: laneEvents.length > 0 ? lane.color : socColors.textDim,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {laneEvents.length}
                </span>
              </div>

              {/* Lane events */}
              <div
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  padding: "4px 0",
                }}
              >
                {laneEvents.length === 0 ? (
                  <div
                    style={{
                      padding: "12px",
                      fontSize: 11,
                      color: socColors.textDim,
                      textAlign: "center",
                    }}
                  >
                    No events
                  </div>
                ) : (
                  laneEvents.slice(0, 20).map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 12px",
                        fontSize: 11,
                      }}
                    >
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: severityDot[evt.severity] || socColors.info,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: socColors.textDim, flexShrink: 0 }}>
                        {formatTime(evt.timestamp)}
                      </span>
                      <span
                        style={{
                          color: socColors.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {evt.category.replace(/_/g, " ")}
                      </span>
                      {evt.source_ip && (
                        <span
                          style={{
                            color: socColors.textDim,
                            fontFamily: "'Noto Sans Mono', monospace",
                            fontSize: 10,
                          }}
                        >
                          {evt.source_ip}
                        </span>
                      )}
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
