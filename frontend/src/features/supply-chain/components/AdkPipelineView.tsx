import { useEffect, useMemo, useState } from "react";

import type { AdkTraceSnapshot, CodeScanStreamEvent, GitHubScan } from "../types";
import { buildVerificationOutcomes } from "../lib/pipelineArtifacts";
import { PHASE_LABELS, PHASE_ORDER, phaseSummaryFor } from "../lib/pipelineShared";
import PipelineFilters from "./PipelineFilters";
import PipelineInspector from "./PipelineInspector";
import PipelineSummary from "./PipelineSummary";
import PipelineTraceFeed from "./PipelineTraceFeed";
import ArtifactCards from "./ArtifactCards";

interface Props {
  snapshot: AdkTraceSnapshot | null;
  loading?: boolean;
  scan?: GitHubScan | null;
  codeScanStreamEvents?: CodeScanStreamEvent[];
}

export default function AdkPipelineView({ snapshot, loading = false, scan = null, codeScanStreamEvents = [] }: Props) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!snapshot?.events.length) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId((current) => current && snapshot.events.some((event) => event.id === current) ? current : snapshot.events[snapshot.events.length - 1].id);
  }, [snapshot?.events]);

  const phaseSummaries = useMemo(() => snapshot ? PHASE_ORDER.map((phase) => phaseSummaryFor(snapshot.phases, phase)) : [], [snapshot]);
  const filteredEvents = useMemo(() => snapshot ? snapshot.events.filter((event) => (phaseFilter === "all" || event.phase === phaseFilter) && (kindFilter === "all" || event.kind === kindFilter) && (statusFilter === "all" || event.status === statusFilter)) : [], [kindFilter, phaseFilter, snapshot, statusFilter]);
  const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) || snapshot?.events.find((event) => event.id === selectedEventId) || filteredEvents[filteredEvents.length - 1] || snapshot?.events[snapshot.events.length - 1] || null;
  const verificationOutcomes = useMemo(() => snapshot ? buildVerificationOutcomes(snapshot) : [], [snapshot]);
  const selectedPayload = selectedEvent && typeof selectedEvent.payload_json === "object" && !Array.isArray(selectedEvent.payload_json) ? selectedEvent.payload_json : null;

  if (loading && !snapshot) return <div className="card" style={{ padding: 20 }}><div style={{ fontSize: 14, color: "var(--md-on-surface-variant)" }}>Loading ADK pipeline...</div></div>;
  if (!snapshot) return <div className="card" style={{ padding: 20 }}><div style={{ fontSize: 14, color: "var(--md-on-surface-variant)" }}>No ADK pipeline trace available yet.</div></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PipelineSummary snapshot={snapshot} loading={loading} phaseSummaries={phaseSummaries} scan={scan} codeScanStreamEvents={codeScanStreamEvents} verificationOutcomes={verificationOutcomes} onSelectEvent={setSelectedEventId} />
      <PipelineFilters phaseFilter={phaseFilter} kindFilter={kindFilter} statusFilter={statusFilter} onPhaseFilterChange={setPhaseFilter} onKindFilterChange={setKindFilter} onStatusFilterChange={setStatusFilter} phaseOptions={phaseSummaries.map((phase) => ({ value: phase.phase, label: phase.label || PHASE_LABELS[phase.phase] }))} />
      <div className="adk-pipeline-detail-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 16 }}>
        <PipelineTraceFeed events={filteredEvents} selectedEventId={selectedEvent?.id ?? null} onSelectEvent={setSelectedEventId} />
        <PipelineInspector event={selectedEvent} payload={selectedPayload} />
      </div>
      <ArtifactCards snapshot={snapshot} verificationOutcomes={verificationOutcomes} onSelectEvent={setSelectedEventId} />

      <style>{`
        @media (max-width: 960px) {
          .adk-pipeline-detail-grid,
          .adk-pipeline-activity-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .adk-pipeline-artifact-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
