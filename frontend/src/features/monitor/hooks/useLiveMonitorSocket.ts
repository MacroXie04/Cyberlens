import { useCallback } from "react";

import { useSocket } from "../../../hooks/useSocket";
import type { GcpEstateSummary, GcpReplaySnapshot, GcpSecurityEvent, GcpSecurityIncident } from "../types";

interface Args {
  cloudRunUrl?: string | null;
  mode: "history" | "live";
  setSnapshot: React.Dispatch<React.SetStateAction<GcpReplaySnapshot | null>>;
}

export function useLiveMonitorSocket({ cloudRunUrl, mode, setSnapshot }: Args) {
  const onGcpSecurityEvent = useCallback((event: GcpSecurityEvent) => {
    if (mode !== "live") return;
    setSnapshot((current) => current ? { ...current, events: [event, ...current.events].slice(0, 200) } : current);
  }, [mode, setSnapshot]);

  const onGcpIncidentUpdate = useCallback((incident: GcpSecurityIncident) => {
    if (mode !== "live") return;
    setSnapshot((current) => {
      if (!current) return current;
      const index = current.incidents.findIndex((candidate) => candidate.id === incident.id);
      const nextIncidents = [...current.incidents];
      if (index >= 0) nextIncidents[index] = incident;
      else nextIncidents.unshift(incident);
      return { ...current, incidents: nextIncidents.slice(0, 100) };
    });
  }, [mode, setSnapshot]);

  const onGcpEstateSnapshot = useCallback((incoming: GcpEstateSummary) => {
    if (mode !== "live") return;
    setSnapshot((current) => current ? { ...current, summary: { ...current.summary, ...incoming } } : current);
  }, [mode, setSnapshot]);

  return useSocket({ onGcpSecurityEvent, onGcpIncidentUpdate, onGcpEstateSnapshot }, cloudRunUrl, mode === "live");
}
