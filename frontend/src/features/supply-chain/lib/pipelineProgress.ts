import type { AdkTracePhase, AdkTracePhaseSummary, AdkTraceSnapshot, CodeScanStreamEvent, GitHubScan } from "../types";

import { type PhaseProgressInfo, isRecord, readNumber, readString } from "./pipelineShared";

function findLatestMetricPayload(snapshot: AdkTraceSnapshot, phase: AdkTracePhase, scan?: GitHubScan | null): Record<string, unknown> | null {
  for (let index = snapshot.events.length - 1; index >= 0; index -= 1) {
    const event = snapshot.events[index];
    if (event.phase === phase && event.kind === "metric" && isRecord(event.payload_json)) {
      return event.payload_json;
    }
  }

  const phaseStatsRoot = isRecord(scan?.code_scan_stats_json)
    ? (scan?.code_scan_stats_json.phases as Record<string, unknown> | undefined)
    : undefined;
  const phaseStats = phaseStatsRoot?.[phase];
  return isRecord(phaseStats) ? phaseStats : null;
}

export function findLatestTokenEvent(events: CodeScanStreamEvent[]): CodeScanStreamEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "token_update" || event.type === "scan_summary") {
      return event;
    }
  }
  return null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function derivePhaseProgress(
  phase: AdkTracePhaseSummary,
  snapshot: AdkTraceSnapshot,
  scan?: GitHubScan | null,
  codeScanStreamEvents: CodeScanStreamEvent[] = []
): PhaseProgressInfo {
  const metric = findLatestMetricPayload(snapshot, phase.phase, scan);
  const partialCount = snapshot.events.filter((event) => event.phase === phase.phase && event.kind === "llm_partial").length;
  if (phase.status === "success" && !metric) return { percent: 100, detail: "Completed", stats: [{ label: "Duration", value: phase.duration_ms ? `${(phase.duration_ms / 1000).toFixed(1)}s` : "-" }, { label: "Tokens", value: phase.total_tokens.toLocaleString() }] };
  if (phase.status === "error") return { percent: 100, detail: "Failed", stats: [{ label: "Errors", value: phase.error_count.toString() }, { label: "Tokens", value: phase.total_tokens.toLocaleString() }] };

  switch (phase.phase) {
    case "dependency_input":
      return { percent: phase.status === "pending" ? 0 : phase.status === "running" ? 60 : 100, detail: readNumber(metric, "vulnerability_count") != null ? `${readNumber(metric, "vulnerability_count")} vulnerable packages prepared for ADK input` : "Collecting dependency risk input", stats: [{ label: "Dependencies", value: (readNumber(metric, "total_dependencies") ?? 0).toLocaleString() }, { label: "Vulnerabilities", value: (readNumber(metric, "vulnerability_count") ?? 0).toLocaleString() }] };
    case "dependency_adk_report":

      return { percent: phase.status === "success" || phase.status === "warning" ? 100 : phase.status === "running" ? Math.min(90, 20 + partialCount * 8) : 0, detail: readNumber(metric, "security_score") != null ? `Security score ${readNumber(metric, "security_score")}` : partialCount > 0 ? `Streaming ADK analysis (${partialCount} updates)` : "Waiting for dependency ADK response", stats: [{ label: "Vulnerabilities", value: (readNumber(metric, "vulnerability_count") ?? 0).toLocaleString() }, { label: "Tokens", value: phase.total_tokens.toLocaleString() }] };
    case "code_inventory":
      return { percent: phase.status === "success" ? 100 : phase.status === "running" ? 50 : phase.status === "pending" ? 0 : 100, detail: readNumber(metric, "indexed_files") != null ? `${readNumber(metric, "indexed_files")} source files indexed` : "Discovering code files and imports", stats: [{ label: "Indexed", value: (readNumber(metric, "indexed_files") ?? 0).toLocaleString() }, { label: "Total Files", value: (scan?.code_scan_files_total ?? readNumber(metric, "indexed_files") ?? 0).toLocaleString() }] };
    case "chunk_summary": {
      const completedChunks = readNumber(metric, "completed_chunks");
      const totalChunks = readNumber(metric, "total_chunks");
      const completedFiles = readNumber(metric, "completed_files") ?? scan?.code_scan_files_scanned ?? 0;
      const totalFiles = readNumber(metric, "total_files") ?? scan?.code_scan_files_total ?? 0;
      const currentFile = readString(metric, "current_file") || readString(metric, "last_completed_file") || codeScanStreamEvents.slice().reverse().find((event) => event.type === "file_start" && event.file_path)?.file_path || "";
      return { percent: completedChunks != null && totalChunks ? clampPercent((completedChunks / totalChunks) * 100) : totalFiles ? clampPercent((completedFiles / totalFiles) * 100) : phase.status === "success" ? 100 : phase.status === "running" ? 10 : 0, detail: currentFile ? `Summarizing ${currentFile}` : "Summarizing code chunks for recall", stats: [{ label: "Chunks", value: completedChunks != null && totalChunks != null ? `${completedChunks}/${totalChunks}` : "-" }, { label: "Files", value: `${completedFiles}/${totalFiles || 0}` }, { label: "Suspicious", value: (readNumber(metric, "suspicious_chunks") ?? 0).toLocaleString() }] };
    }
    case "candidate_generation":
      return { percent: readNumber(metric, "completed_batches") != null && readNumber(metric, "total_batches") ? clampPercent(((readNumber(metric, "completed_batches") ?? 0) / (readNumber(metric, "total_batches") ?? 1)) * 100) : phase.status === "success" ? 100 : phase.status === "running" ? 20 : 0, detail: readString(metric, "risk_category") ? `Triaging ${readString(metric, "risk_category")} candidates` : "Scoring candidate issues across risk passes", stats: [{ label: "Batches", value: readNumber(metric, "completed_batches") != null && readNumber(metric, "total_batches") != null ? `${readNumber(metric, "completed_batches")}/${readNumber(metric, "total_batches")}` : "-" }, { label: "Selected", value: (readNumber(metric, "selected_candidates") ?? 0).toLocaleString() }, { label: "Deduped", value: (readNumber(metric, "deduped_candidates") ?? 0).toLocaleString() }] };
    case "evidence_expansion":
      return { percent: readNumber(metric, "completed_packs") != null && readNumber(metric, "total_packs") ? clampPercent(((readNumber(metric, "completed_packs") ?? 0) / Math.max(readNumber(metric, "total_packs") ?? 1, 1)) * 100) : phase.status === "success" ? 100 : phase.status === "running" ? 15 : 0, detail: "Building bounded evidence packs for verification", stats: [{ label: "Packs", value: readNumber(metric, "completed_packs") != null && readNumber(metric, "total_packs") != null ? `${readNumber(metric, "completed_packs")}/${readNumber(metric, "total_packs")}` : "-" }, { label: "Last Candidate", value: (readNumber(metric, "candidate_id") ?? 0).toLocaleString() }, { label: "Members", value: (readNumber(metric, "member_count") ?? 0).toLocaleString() }] };
    case "verification":
      return { percent: readNumber(metric, "reviewed_candidates") != null && readNumber(metric, "total_candidates") ? clampPercent(((readNumber(metric, "reviewed_candidates") ?? 0) / Math.max(readNumber(metric, "total_candidates") ?? 1, 1)) * 100) : phase.status === "success" ? 100 : phase.status === "running" ? 10 : 0, detail: readString(metric, "decision") ? `Latest decision: ${readString(metric, "decision")}` : "Verifying high-risk evidence packs", stats: [{ label: "Reviewed", value: readNumber(metric, "reviewed_candidates") != null && readNumber(metric, "total_candidates") != null ? `${readNumber(metric, "reviewed_candidates")}/${readNumber(metric, "total_candidates")}` : "-" }, { label: "Confirmed", value: (readNumber(metric, "confirmed_findings") ?? 0).toLocaleString() }, { label: "Rejected", value: (readNumber(metric, "rejected_candidates") ?? 0).toLocaleString() }] };
    case "code_map":
      return { percent: phase.status === "success" ? 100 : phase.status === "running" ? 50 : 0, detail: readNumber(metric, "nodes") != null ? `${readNumber(metric, "nodes")} code elements mapped` : "Building architecture map", stats: [{ label: "Nodes", value: (readNumber(metric, "nodes") ?? 0).toLocaleString() }, { label: "Edges", value: (readNumber(metric, "edges") ?? 0).toLocaleString() }] };
    case "repo_synthesis":
      return { percent: phase.status === "success" ? 100 : phase.status === "running" ? (metric?.summary_ready ? 85 : 35) : 0, detail: metric?.summary_ready ? "Repository summary generated" : "Synthesizing repository-wide conclusions", stats: [{ label: "Candidates", value: (readNumber(metric, "candidate_count") ?? 0).toLocaleString() }, { label: "Verified", value: (readNumber(metric, "verified_findings") ?? 0).toLocaleString() }, { label: "Hotspots", value: (readNumber(metric, "hotspot_count") ?? 0).toLocaleString() }] };
  }
  return { percent: 0, detail: "Unknown phase", stats: [] };
}

export function deriveOverallProgress(phases: AdkTracePhaseSummary[], snapshot: AdkTraceSnapshot, scan?: GitHubScan | null, events: CodeScanStreamEvent[] = []) {
  const total = phases.reduce((sum, phase) => sum + derivePhaseProgress(phase, snapshot, scan, events).percent, 0);
  return clampPercent(total / Math.max(phases.length, 1));
}

export function findCurrentPhase(phases: AdkTracePhaseSummary[]) {
  return phases.find((phase) => phase.status === "running") || [...phases].reverse().find((phase) => phase.status !== "pending") || null;
}
