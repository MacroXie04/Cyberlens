import type { GcpSecurityIncident, LiveMonitorMode } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  incidents: GcpSecurityIncident[];
  mode: LiveMonitorMode;
  replayWindowLabel: string;
  selectedIncidentId: number | null;
  onSelectIncident: (incident: GcpSecurityIncident) => void;
}

const priorityColors: Record<string, string> = {
  p1: socColors.critical,
  p2: socColors.high,
  p3: socColors.medium,
  p4: socColors.textDim,
};

function timeAgo(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return ts;
  }
}

export default function IncidentQueue({
  incidents,
  mode,
  replayWindowLabel,
  selectedIncidentId,
  onSelectIncident,
}: Props) {
  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 32,
        overflow: "hidden",
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
          gap: 10,
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
            Incident Queue
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
            {mode === "live"
              ? "Open operational and security incidents"
              : `Incidents intersecting ${replayWindowLabel}`}
          </div>
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            background: incidents.length ? socColors.criticalBg : socColors.safeBg,
            color: incidents.length ? socColors.critical : socColors.safe,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {incidents.length}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {incidents.length === 0 ? (
          <div
            style={{
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
            No incidents in the selected window
          </div>
        ) : (
          incidents.map((incident) => {
            const selected = selectedIncidentId === incident.id;
            return (
              <button
                key={incident.id}
                type="button"
                onClick={() => onSelectIncident(incident)}
                style={{
                  border: "none",
                  textAlign: "left",
                  background: selected ? socColors.bgCardHover : "transparent",
                  padding: "18px 20px",
                  borderBottom: `1px solid ${socColors.border}`,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 36,
                        padding: "6px 9px",
                        borderRadius: 999,
                        background: socColors.bgPanel,
                        color: priorityColors[incident.priority] || socColors.text,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {incident.priority}
                    </span>
                    <span style={{ fontSize: 12, color: socColors.textDim, textTransform: "capitalize" }}>
                      {incident.status}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: socColors.textDim }}>
                    {timeAgo(incident.last_seen)}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    color: socColors.text,
                    lineHeight: 1.4,
                  }}
                >
                  {incident.title}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    fontSize: 12,
                    color: socColors.textDim,
                  }}
                >
                  <span>{incident.evidence_count} events</span>
                  <span>{incident.services_affected.length} services</span>
                  <span>{Math.round((incident.confidence ?? 0) * 100)}% confidence</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
