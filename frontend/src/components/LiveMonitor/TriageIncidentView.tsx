import type { GcpSecurityIncident } from "../../types";
import { socColors } from "../../theme/theme";

import { ActionButton, formatTime, priorityColors, SectionLabel, statusColors } from "./triageDrawerShared";

interface Props {
  incident: GcpSecurityIncident;
  detail: GcpSecurityIncident | null;
  onAck: (newStatus: string) => void;
}

export default function TriageIncidentView({ incident, detail, onAck }: Props) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: priorityColors[incident.priority] || socColors.text, padding: "2px 8px", borderRadius: 4, border: `1px solid ${priorityColors[incident.priority] || socColors.border}` }}>
            {incident.priority}
          </span>
          <span style={{ fontSize: 11, color: statusColors[incident.status] || socColors.textDim, textTransform: "uppercase" }}>
            {incident.status}
          </span>
        </div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: socColors.text }}>{incident.title}</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontSize: 12 }}>
        <div><span style={{ color: socColors.textDim }}>First seen:</span><br /><span style={{ color: socColors.text }}>{formatTime(incident.first_seen)}</span></div>
        <div><span style={{ color: socColors.textDim }}>Last seen:</span><br /><span style={{ color: socColors.text }}>{formatTime(incident.last_seen)}</span></div>
        <div><span style={{ color: socColors.textDim }}>Evidence:</span><br /><span style={{ color: socColors.text }}>{incident.evidence_count} events</span></div>
        <div><span style={{ color: socColors.textDim }}>Confidence:</span><br /><span style={{ color: socColors.text }}>{((incident.confidence ?? 0) * 100).toFixed(0)}%</span></div>
      </div>

      {incident.services_affected.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: socColors.textDim, fontWeight: 600, textTransform: "uppercase" }}>Affected Services</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {incident.services_affected.map((service) => (
              <span key={service} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: socColors.bgCard, border: `1px solid ${socColors.border}`, color: socColors.text }}>
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      <SectionLabel>Facts</SectionLabel>
      <div style={{ background: socColors.bgCard, border: `1px solid ${socColors.border}`, borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 12, color: socColors.text, lineHeight: 1.6 }}>
        <div>Type: <strong>{incident.incident_type.replace(/_/g, " ")}</strong></div>
        <div>Evidence count: {incident.evidence_count}</div>
        <div>Regions: {incident.regions_affected.join(", ") || "Unknown"}</div>
      </div>

      {(incident.narrative || incident.likely_cause) && (
        <>
          <SectionLabel>AI Inference</SectionLabel>
          <div style={{ background: socColors.bgCard, border: `1px solid ${socColors.accent}33`, borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 12, color: socColors.text, lineHeight: 1.6 }}>
            {incident.narrative && <p style={{ margin: "0 0 8px" }}>{incident.narrative}</p>}
            {incident.likely_cause && <div><span style={{ color: socColors.textDim }}>Likely cause:</span> {incident.likely_cause}</div>}
          </div>
        </>
      )}

      {incident.next_steps.length > 0 && (
        <>
          <SectionLabel>Recommended Actions</SectionLabel>
          <div style={{ background: socColors.bgCard, border: `1px solid ${socColors.border}`, borderRadius: 6, padding: 12, marginBottom: 16 }}>
            {incident.next_steps.map((step, index) => (
              <div key={index} style={{ fontSize: 12, color: socColors.text, padding: "3px 0", display: "flex", gap: 6 }}>
                <span style={{ color: socColors.accent }}>{index + 1}.</span>
                {step}
              </div>
            ))}
          </div>
        </>
      )}

      {detail?.events && detail.events.length > 0 && (
        <>
          <SectionLabel>Evidence Events ({detail.events.length})</SectionLabel>
          <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
            {detail.events.map((event) => (
              <div key={event.id} style={{ padding: "6px 8px", borderBottom: `1px solid ${socColors.border}`, fontSize: 11, color: socColors.text }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: socColors.textDim, flexShrink: 0 }}>{formatTime(event.timestamp)}</span>
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.category.replace(/_/g, " ")}</span>
                  {event.source_ip && <span style={{ color: socColors.textDim, fontFamily: "'Noto Sans Mono', monospace", fontSize: 10 }}>{event.source_ip}</span>}
                </div>
                {event.raw_payload_preview && (
                  <div style={{ marginTop: 4, fontSize: 10, color: socColors.textDim, fontFamily: "'Noto Sans Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 60, overflow: "hidden" }}>
                    {event.raw_payload_preview}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {incident.status === "open" && <ActionButton label="Investigate" color={socColors.accent} onClick={() => onAck("investigating")} />}
        {(incident.status === "open" || incident.status === "investigating") && (
          <>
            <ActionButton label="Mitigate" color={socColors.medium} onClick={() => onAck("mitigated")} />
            <ActionButton label="False Positive" color={socColors.textDim} onClick={() => onAck("false_positive")} />
          </>
        )}
      </div>
    </>
  );
}
