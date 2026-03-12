import type {
  AdkTraceSnapshot,
  CodeScanStreamEvent,
  DerivedAgentActivity,
  GitHubScan,
} from "../../../types";

import {
  describePhase,
  findCurrentPhase,
  findLatestMetricPayload,
  PHASE_LABELS,
} from "./activityPhases";
import { latestSignalEvent, recentActivityEvents } from "./activitySignals";

export { findLatestMetricPayload } from "./activityPhases";

export function deriveAgentActivity(
  snapshot: AdkTraceSnapshot | null,
  scan?: GitHubScan | null,
  streamEvents: CodeScanStreamEvent[] = []
): DerivedAgentActivity {
  const phase = findCurrentPhase(snapshot, scan);
  const phaseLabel = phase ? PHASE_LABELS[phase] : "Idle";
  const recentEvents = recentActivityEvents(snapshot);
  const { warning, error } = latestSignalEvent(snapshot, streamEvents);

  if (!phase && !scan) {
    return {
      status: "idle",
      phase: null,
      phase_label: "Idle",
      title: "Waiting for scan",
      subject: "",
      progress_text: "No scan selected.",
      updated_at: null,
      recent_events: [],
    };
  }

  if (!phase) {
    return {
      status: scan?.scan_status === "failed" ? "error" : "pending",
      phase: null,
      phase_label: "Idle",
      title: scan?.scan_status === "failed" ? "Scan failed" : "Waiting for agent activity",
      subject: "",
      progress_text: scan?.error_message || "The scan has not produced trace activity yet.",
      updated_at: scan?.scanned_at || null,
      warning_message: warning,
      error_message: error,
      recent_events: recentEvents,
    };
  }

  const described = describePhase(phase, findLatestMetricPayload(snapshot, phase, scan), snapshot);
  const currentPhaseSummary = snapshot?.phases.find((item) => item.phase === phase);
  const status = error
    ? "error"
    : warning
      ? "warning"
      : currentPhaseSummary?.status || (scan?.scan_status === "completed" ? "success" : "running");

  return {
    status: status as DerivedAgentActivity["status"],
    phase,
    phase_label: phaseLabel,
    title: described.title,
    subject: described.subject,
    progress_text: described.progress_text,
    updated_at: described.updated_at || scan?.scanned_at || null,
    warning_message: warning || undefined,
    error_message: error || undefined,
    recent_events: recentEvents,
  };
}
