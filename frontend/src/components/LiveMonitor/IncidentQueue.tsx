import type { GcpSecurityIncident } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  incidents: GcpSecurityIncident[];
  selectedIncidentId: number | null;
  onSelectIncident: (incident: GcpSecurityIncident) => void;
}

const priorityColors: Record<string, string> = {
  p1: socColors.critical,
  p2: socColors.high,
  p3: socColors.medium,
  p4: socColors.p4,
};

const statusLabels: Record<string, string> = {
  open: "OPEN",
  investigating: "INVESTIGATING",
  mitigated: "MITIGATED",
  resolved: "RESOLVED",
  false_positive: "FP",
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
  selectedIncidentId,
  onSelectIncident,
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
          Incident Queue
        </span>
        <span
          style={{
            fontSize: 12,
            color: incidents.length > 0 ? socColors.critical : socColors.safe,
            fontWeight: 600,
          }}
        >
          {incidents.length}
        </span>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {incidents.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: socColors.textDim,
              fontSize: 12,
            }}
          >
            No active incidents
          </div>
        ) : (
          incidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${socColors.border}`,
                cursor: "pointer",
                background:
                  selectedIncidentId === inc.id
                    ? socColors.bgCardHover
                    : "transparent",
                transition: "background 100ms",
                borderLeft: `3px solid ${priorityColors[inc.priority] || socColors.border}`,
              }}
              onMouseEnter={(e) => {
                if (selectedIncidentId !== inc.id) {
                  e.currentTarget.style.background = socColors.bgCardHover;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedIncidentId !== inc.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {/* Top row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: priorityColors[inc.priority] || socColors.text,
                    textTransform: "uppercase",
                  }}
                >
                  {inc.priority}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: socColors.textDim,
                    textTransform: "uppercase",
                  }}
                >
                  {statusLabels[inc.status] || inc.status}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: socColors.textDim,
                  }}
                >
                  {timeAgo(inc.last_seen)}
                </span>
              </div>
              {/* Title */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: socColors.text,
                  marginBottom: 4,
                }}
              >
                {inc.title}
              </div>
              {/* Bottom meta */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 10,
                  color: socColors.textDim,
                }}
              >
                <span>{inc.evidence_count} events</span>
                <span>
                  {inc.services_affected.length} service
                  {inc.services_affected.length !== 1 ? "s" : ""}
                </span>
                <span>
                  {((inc.confidence ?? 0) * 100).toFixed(0)}% confidence
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
