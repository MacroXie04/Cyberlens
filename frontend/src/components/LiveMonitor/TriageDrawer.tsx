import { useEffect, useState } from "react";

import type { GcpSecurityIncident, GcpSecurityEvent } from "../../types";
import { socColors } from "../../theme/theme";
import { ackGcpSecurityIncident, getGcpSecurityIncidentDetail } from "../../services/api";

import TriageEventView from "./TriageEventView";
import TriageIncidentView from "./TriageIncidentView";

interface Props {
  incident: GcpSecurityIncident | null;
  selectedEvent: GcpSecurityEvent | null;
  onClose: () => void;
}

export default function TriageDrawer({ incident, selectedEvent, onClose }: Props) {
  const [detail, setDetail] = useState<GcpSecurityIncident | null>(null);
  const isOpen = incident != null || selectedEvent != null;

  useEffect(() => {
    if (incident?.id) {
      getGcpSecurityIncidentDetail(incident.id).then(setDetail).catch(console.error);
    } else {
      setDetail(null);
    }
  }, [incident?.id]);

  if (!isOpen) return null;

  const handleAck = async (newStatus: string) => {
    if (!incident) return;
    try {
      await ackGcpSecurityIncident(incident.id, newStatus);
      if (detail) {
        setDetail({ ...detail, status: newStatus as typeof detail.status });
      }
    } catch (error) {
      console.error("Failed to ack incident:", error);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 440, height: "100vh", background: socColors.bgPanel, borderLeft: `1px solid ${socColors.border}`, zIndex: 100, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${socColors.border}` }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: socColors.text }}>
          {incident ? "Incident Triage" : "Event Detail"}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: socColors.textDim, fontSize: 18, cursor: "pointer", padding: "2px 6px" }}>
          x
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {incident ? (
          <TriageIncidentView incident={incident} detail={detail} onAck={handleAck} />
        ) : selectedEvent ? (
          <TriageEventView selectedEvent={selectedEvent} />
        ) : null}
      </div>
    </div>
  );
}
