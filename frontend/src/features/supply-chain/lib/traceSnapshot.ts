import type { AdkArtifactSummary, AdkTraceEvent, AdkTracePhase, AdkTracePhaseSummary, AdkTraceSnapshot } from "../types";

export const TRACE_PHASE_LABELS: Record<AdkTracePhase, string> = {
  dependency_input: "Dependency Input",
  dependency_adk_report: "Dependency ADK Report",
  code_map: "Code Map",
  code_inventory: "Code Inventory",
  chunk_summary: "Chunk Summary",
  candidate_generation: "Candidate Generation",
  evidence_expansion: "Evidence Expansion",
  verification: "Verification",
  repo_synthesis: "Repo Synthesis",
};

export const TRACE_PHASE_ORDER: AdkTracePhase[] = ["dependency_input", "dependency_adk_report", "code_map", "code_inventory", "chunk_summary", "candidate_generation", "evidence_expansion", "verification", "repo_synthesis"];

const EMPTY_ARTIFACTS: AdkArtifactSummary = { candidates: [], evidence_packs: [], verified_findings: [], dependency_report_batches: [] };

export function emptyTraceSnapshot(): AdkTraceSnapshot {
  return {
    phases: TRACE_PHASE_ORDER.map((phase) => ({ phase, status: "pending", label: TRACE_PHASE_LABELS[phase], started_at: null, ended_at: null, duration_ms: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, event_count: 0, artifact_count: 0, error_count: 0 })),
    events: [],
    artifacts: EMPTY_ARTIFACTS,
  };
}

function buildTracePhases(events: AdkTraceEvent[]): AdkTracePhaseSummary[] {
  return TRACE_PHASE_ORDER.map((phase) => {
    const phaseEvents = events.filter((event) => event.phase === phase);
    const started = phaseEvents.find((event) => event.kind === "stage_started");
    const completed = [...phaseEvents].reverse().find((event) => event.kind === "stage_completed");

    let status: AdkTracePhaseSummary["status"] = "pending";
    if (phaseEvents.some((event) => event.kind === "error" || event.status === "error")) status = "error";
    else if (phaseEvents.some((event) => event.kind === "warning" || event.status === "warning")) status = "warning";
    else if (completed) status = completed.status as AdkTracePhaseSummary["status"];
    else if (phaseEvents.length > 0) status = "running";

    return {
      phase,
      status,
      label: TRACE_PHASE_LABELS[phase],
      started_at: started?.started_at || started?.created_at || null,
      ended_at: completed?.ended_at || completed?.created_at || (status === "warning" ? phaseEvents[phaseEvents.length - 1]?.created_at || null : null),
      duration_ms: completed?.duration_ms || 0,
      input_tokens: completed?.input_tokens || phaseEvents.filter((event) => event.kind === "llm_completed" || event.kind === "metric").reduce((sum, event) => sum + event.input_tokens, 0),
      output_tokens: completed?.output_tokens || phaseEvents.filter((event) => event.kind === "llm_completed" || event.kind === "metric").reduce((sum, event) => sum + event.output_tokens, 0),
      total_tokens: completed?.total_tokens || phaseEvents.filter((event) => event.kind === "llm_completed" || event.kind === "metric").reduce((sum, event) => sum + event.total_tokens, 0),
      event_count: phaseEvents.length,
      artifact_count: phaseEvents.filter((event) => event.kind === "artifact_created").length,
      error_count: phaseEvents.filter((event) => event.kind === "error").length,
    };
  });
}

function mergeArtifactSummary(previous: AdkArtifactSummary, event: AdkTraceEvent): AdkArtifactSummary {
  if (event.kind !== "artifact_created" || Array.isArray(event.payload_json)) return previous;
  const payload = event.payload_json as Record<string, unknown>;

  if (event.phase === "candidate_generation" && typeof payload.candidate_id === "number") {
    const candidate = { candidate_id: payload.candidate_id, category: String(payload.category || ""), label: String(payload.label || ""), score: Number(payload.score || 0), severity_hint: String(payload.severity_hint || ""), status: String(payload.status || "candidate"), chunk_refs: Array.isArray(payload.chunk_refs) ? payload.chunk_refs.map((ref) => String(ref)) : [], rationale: String(payload.rationale || ""), verified_finding_id: typeof payload.verified_finding_id === "number" ? payload.verified_finding_id : null };
    return { ...previous, candidates: [...previous.candidates.filter((item) => item.candidate_id !== candidate.candidate_id), candidate].sort((a, b) => b.score - a.score) };
  }
  if (event.phase === "evidence_expansion" && payload.evidence_pack_id) {
    const evidencePack = { event_id: event.id, sequence: event.sequence, label: event.label, ...payload };
    const evidenceId = String(payload.evidence_pack_id);
    return { ...previous, evidence_packs: [...previous.evidence_packs.filter((item) => String(item.evidence_pack_id || "") !== evidenceId), evidencePack] };
  }
  if (event.phase === "verification" && payload.decision === "confirmed" && typeof payload.finding_ref === "number") {
    const finding = { finding_id: payload.finding_ref, title: event.label, category: String(payload.category || ""), severity: String(payload.severity || ""), file_path: String(payload.file_path || ""), line_number: Number(payload.line_number || 0), candidate_ids: typeof payload.candidate_id === "number" ? [payload.candidate_id as number] : [] };
    return { ...previous, verified_findings: [...previous.verified_findings.filter((item) => item.finding_id !== finding.finding_id), finding] };
  }
  if ((event.phase === "dependency_input" || event.phase === "dependency_adk_report") && typeof payload.batch_index === "number") {
    const batch = { event_id: event.id, sequence: event.sequence, label: event.label, ...payload };
    const batchIndex = Number(payload.batch_index);
    return { ...previous, dependency_report_batches: [...previous.dependency_report_batches.filter((item) => Number(item.batch_index || 0) !== batchIndex), batch] };
  }
  return previous;
}

export function mergeTraceEvent(previous: AdkTraceSnapshot | null, event: AdkTraceEvent): AdkTraceSnapshot {
  const base = previous || emptyTraceSnapshot();
  if (base.events.some((item) => item.sequence === event.sequence)) return base;
  const events = [...base.events, event].sort((left, right) => left.sequence - right.sequence);
  return { phases: buildTracePhases(events), events, artifacts: mergeArtifactSummary(base.artifacts, event) };
}
