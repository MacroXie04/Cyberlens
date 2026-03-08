import { useState, useEffect } from "react";
import type {
  GcpSecurityIncident,
  GcpSecurityEvent,
} from "../../types";
import { socColors } from "../../theme/theme";
import {
  getGcpSecurityIncidentDetail,
  ackGcpSecurityIncident,
} from "../../services/api";

interface Props {
  incident: GcpSecurityIncident | null;
  selectedEvent: GcpSecurityEvent | null;
  onClose: () => void;
}

const priorityColors: Record<string, string> = {
  p1: socColors.critical,
  p2: socColors.high,
  p3: socColors.medium,
  p4: socColors.p4,
};

const statusColors: Record<string, string> = {
  open: socColors.critical,
  investigating: socColors.high,
  mitigated: socColors.medium,
  resolved: socColors.safe,
  false_positive: socColors.textDim,
};

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function TriageDrawer({
  incident,
  selectedEvent,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<GcpSecurityIncident | null>(null);

  useEffect(() => {
    if (incident?.id) {
      getGcpSecurityIncidentDetail(incident.id)
        .then(setDetail)
        .catch(console.error);
    } else {
      setDetail(null);
    }
  }, [incident?.id]);

  const isOpen = incident != null || selectedEvent != null;

  if (!isOpen) return null;

  const handleAck = async (newStatus: string) => {
    if (!incident) return;
    try {
      await ackGcpSecurityIncident(incident.id, newStatus);
      // Update local state
      if (detail) {
        setDetail({ ...detail, status: newStatus as typeof detail.status });
      }
    } catch (e) {
      console.error("Failed to ack incident:", e);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 440,
        height: "100vh",
        background: socColors.bgPanel,
        borderLeft: `1px solid ${socColors.border}`,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1px solid ${socColors.border}`,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: socColors.text }}>
          {incident ? "Incident Triage" : "Event Detail"}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: socColors.textDim,
            fontSize: 18,
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          x
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* -- Incident View -- */}
        {incident && (
          <>
            {/* Title + priority */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: priorityColors[incident.priority] || socColors.text,
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: `1px solid ${priorityColors[incident.priority] || socColors.border}`,
                  }}
                >
                  {incident.priority}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: statusColors[incident.status] || socColors.textDim,
                    textTransform: "uppercase",
                  }}
                >
                  {incident.status}
                </span>
              </div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: socColors.text,
                }}
              >
                {incident.title}
              </h3>
            </div>

            {/* Meta */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 16,
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ color: socColors.textDim }}>First seen:</span>
                <br />
                <span style={{ color: socColors.text }}>
                  {formatTime(incident.first_seen)}
                </span>
              </div>
              <div>
                <span style={{ color: socColors.textDim }}>Last seen:</span>
                <br />
                <span style={{ color: socColors.text }}>
                  {formatTime(incident.last_seen)}
                </span>
              </div>
              <div>
                <span style={{ color: socColors.textDim }}>Evidence:</span>
                <br />
                <span style={{ color: socColors.text }}>
                  {incident.evidence_count} events
                </span>
              </div>
              <div>
                <span style={{ color: socColors.textDim }}>Confidence:</span>
                <br />
                <span style={{ color: socColors.text }}>
                  {(incident.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Services */}
            {incident.services_affected.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: socColors.textDim,
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  Affected Services
                </span>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    marginTop: 6,
                  }}
                >
                  {incident.services_affected.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: socColors.bgCard,
                        border: `1px solid ${socColors.border}`,
                        color: socColors.text,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Facts section */}
            <SectionLabel>Facts</SectionLabel>
            <div
              style={{
                background: socColors.bgCard,
                border: `1px solid ${socColors.border}`,
                borderRadius: 6,
                padding: 12,
                marginBottom: 16,
                fontSize: 12,
                color: socColors.text,
                lineHeight: 1.6,
              }}
            >
              <div>
                Type: <strong>{incident.incident_type.replace(/_/g, " ")}</strong>
              </div>
              <div>Evidence count: {incident.evidence_count}</div>
              <div>
                Regions:{" "}
                {incident.regions_affected.join(", ") || "Unknown"}
              </div>
            </div>

            {/* AI Inference section */}
            {(incident.narrative || incident.likely_cause) && (
              <>
                <SectionLabel>AI Inference</SectionLabel>
                <div
                  style={{
                    background: socColors.bgCard,
                    border: `1px solid ${socColors.accent}33`,
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 16,
                    fontSize: 12,
                    color: socColors.text,
                    lineHeight: 1.6,
                  }}
                >
                  {incident.narrative && (
                    <p style={{ margin: "0 0 8px" }}>{incident.narrative}</p>
                  )}
                  {incident.likely_cause && (
                    <div>
                      <span style={{ color: socColors.textDim }}>
                        Likely cause:
                      </span>{" "}
                      {incident.likely_cause}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Next steps */}
            {incident.next_steps.length > 0 && (
              <>
                <SectionLabel>Recommended Actions</SectionLabel>
                <div
                  style={{
                    background: socColors.bgCard,
                    border: `1px solid ${socColors.border}`,
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  {incident.next_steps.map((step, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12,
                        color: socColors.text,
                        padding: "3px 0",
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      <span style={{ color: socColors.accent }}>
                        {i + 1}.
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Evidence events */}
            {detail?.events && detail.events.length > 0 && (
              <>
                <SectionLabel>
                  Evidence Events ({detail.events.length})
                </SectionLabel>
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: "auto",
                    marginBottom: 16,
                  }}
                >
                  {detail.events.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        padding: "6px 8px",
                        borderBottom: `1px solid ${socColors.border}`,
                        fontSize: 11,
                        color: socColors.text,
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: socColors.textDim, flexShrink: 0 }}>
                          {formatTime(evt.timestamp)}
                        </span>
                        <span
                          style={{
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
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
                      {evt.raw_payload_preview && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 10,
                            color: socColors.textDim,
                            fontFamily: "'Noto Sans Mono', monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            maxHeight: 60,
                            overflow: "hidden",
                          }}
                        >
                          {evt.raw_payload_preview}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {incident.status === "open" && (
                <ActionButton
                  label="Investigate"
                  color={socColors.accent}
                  onClick={() => handleAck("investigating")}
                />
              )}
              {(incident.status === "open" ||
                incident.status === "investigating") && (
                <>
                  <ActionButton
                    label="Mitigate"
                    color={socColors.medium}
                    onClick={() => handleAck("mitigated")}
                  />
                  <ActionButton
                    label="False Positive"
                    color={socColors.textDim}
                    onClick={() => handleAck("false_positive")}
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* -- Event Detail View (when no incident selected) -- */}
        {!incident && selectedEvent && (
          <>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 15,
                fontWeight: 600,
                color: socColors.text,
              }}
            >
              {selectedEvent.category.replace(/_/g, " ")}
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 16,
                fontSize: 12,
              }}
            >
              <MetaItem label="Source" value={selectedEvent.source} />
              <MetaItem label="Severity" value={selectedEvent.severity} />
              <MetaItem label="Service" value={selectedEvent.service || "—"} />
              <MetaItem label="Region" value={selectedEvent.region || "—"} />
              <MetaItem label="IP" value={selectedEvent.source_ip || "—"} />
              <MetaItem label="Country" value={selectedEvent.country || "—"} />
              <MetaItem label="Method" value={selectedEvent.method || "—"} />
              <MetaItem
                label="Status"
                value={selectedEvent.status_code?.toString() || "—"}
              />
            </div>

            {selectedEvent.path && (
              <>
                <SectionLabel>Path</SectionLabel>
                <div
                  style={{
                    background: socColors.bgCard,
                    padding: 10,
                    borderRadius: 6,
                    marginBottom: 12,
                    fontSize: 12,
                    fontFamily: "'Noto Sans Mono', monospace",
                    color: socColors.text,
                    wordBreak: "break-all",
                  }}
                >
                  {selectedEvent.path}
                </div>
              </>
            )}

            {selectedEvent.raw_payload_preview && (
              <>
                <SectionLabel>Raw Log Preview</SectionLabel>
                <div
                  style={{
                    background: socColors.bgCard,
                    padding: 10,
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "'Noto Sans Mono', monospace",
                    color: socColors.textMuted,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {selectedEvent.raw_payload_preview}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: socColors.textDim,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: socColors.textDim }}>{label}:</span>
      <br />
      <span style={{ color: socColors.text }}>{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        color,
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: "6px 14px",
        fontSize: 12,
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}
