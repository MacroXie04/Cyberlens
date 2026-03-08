import type {
  AdkTraceEvent,
  AdkTracePhase,
  AdkTraceSnapshot,
  CodeScanStreamEvent,
  DerivedAgentActivity,
  GitHubScan,
} from "../../types";

const PHASE_LABELS: Record<AdkTracePhase, string> = {
  dependency_input: "Dependency Input",
  dependency_adk_report: "Dependency ADK Report",
  code_inventory: "Code Inventory",
  chunk_summary: "Chunk Summary",
  candidate_generation: "Candidate Generation",
  evidence_expansion: "Evidence Expansion",
  verification: "Verification",
  repo_synthesis: "Repo Synthesis",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readString(record: Record<string, unknown> | null, key: string): string {
  if (!record) return "";
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function findLatestMetricPayload(
  snapshot: AdkTraceSnapshot | null,
  phase: AdkTracePhase | null,
  scan?: GitHubScan | null
): Record<string, unknown> | null {
  if (!phase) return null;

  const events = snapshot?.events || [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
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

function recentActivityEvents(snapshot: AdkTraceSnapshot | null): AdkTraceEvent[] {
  if (!snapshot) return [];
  return [...snapshot.events]
    .filter((event) => event.kind !== "metric" && event.kind !== "llm_partial")
    .slice(-8)
    .reverse();
}

function latestSignalEvent(
  snapshot: AdkTraceSnapshot | null,
  streamEvents: CodeScanStreamEvent[]
): { warning?: string; error?: string } {
  const events = snapshot?.events || [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind === "error" || event.status === "error") {
      return {
        error:
          event.text_preview ||
          event.label ||
          readString(isRecord(event.payload_json) ? event.payload_json : null, "error_message"),
      };
    }
    if (event.kind === "warning" || event.status === "warning") {
      return {
        warning:
          event.text_preview ||
          event.label ||
          readString(isRecord(event.payload_json) ? event.payload_json : null, "detail"),
      };
    }
  }

  for (let index = streamEvents.length - 1; index >= 0; index -= 1) {
    const event = streamEvents[index];
    if (event.type === "warning") {
      return { warning: event.message || event.error || "" };
    }
  }
  return {};
}

function findCurrentPhase(snapshot: AdkTraceSnapshot | null, scan?: GitHubScan | null): AdkTracePhase | null {
  const running =
    snapshot?.phases.find((phase) => phase.status === "running") ||
    [...(snapshot?.phases || [])].reverse().find((phase) => phase.status !== "pending");
  if (running) {
    return running.phase;
  }

  if (scan?.code_scan_phase) {
    return scan.code_scan_phase as AdkTracePhase;
  }

  return null;
}

function fallbackFromLatestEvent(snapshot: AdkTraceSnapshot | null): Pick<
  DerivedAgentActivity,
  "title" | "subject" | "progress_text" | "updated_at"
> {
  const latest = snapshot?.events[snapshot.events.length - 1];
  if (!latest) {
    return {
      title: "Waiting for agent activity",
      subject: "",
      progress_text: "No execution trace available yet.",
      updated_at: null,
    };
  }
  return {
    title: latest.label || PHASE_LABELS[latest.phase],
    subject: latest.phase,
    progress_text: latest.text_preview || latest.kind,
    updated_at: latest.created_at || null,
  };
}

function describePhase(
  phase: AdkTracePhase,
  metric: Record<string, unknown> | null,
  snapshot: AdkTraceSnapshot | null
): Pick<DerivedAgentActivity, "title" | "subject" | "progress_text" | "updated_at"> {
  const latestEvent = [...(snapshot?.events || [])]
    .reverse()
    .find((event) => event.phase === phase);
  const updatedAt = latestEvent?.created_at || null;

  switch (phase) {
    case "dependency_input": {
      const totalDeps = readNumber(metric, "total_dependencies") ?? 0;
      const vulnCount = readNumber(metric, "vulnerability_count") ?? 0;
      return {
        title: "Preparing dependency risk input",
        subject: totalDeps > 0 ? `${totalDeps} dependencies` : "Dependency inventory",
        progress_text: `${vulnCount} vulnerable packages prepared for analysis`,
        updated_at: updatedAt,
      };
    }
    case "dependency_adk_report": {
      const score = readNumber(metric, "security_score");
      return {
        title: score != null ? "Dependency risk assessment complete" : "Generating dependency risk assessment",
        subject: score != null ? `Security score ${score}` : "Gemini dependency analysis",
        progress_text:
          score != null
            ? "Executive summary and remediation priorities are ready."
            : "Reviewing vulnerability batches and ranking fixes.",
        updated_at: updatedAt,
      };
    }
    case "code_inventory": {
      const indexed = readNumber(metric, "indexed_files") ?? 0;
      const total = readNumber(metric, "total_files") ?? indexed;
      return {
        title: "Indexing source files",
        subject: total > 0 ? `${indexed}/${total} files` : "Source inventory",
        progress_text: indexed > 0 ? `Indexed ${indexed} files for downstream analysis.` : "Discovering source files and role flags.",
        updated_at: updatedAt,
      };
    }
    case "chunk_summary": {
      const file = readString(metric, "current_file") || readString(metric, "last_completed_file");
      const completedChunks = readNumber(metric, "completed_chunks") ?? 0;
      const totalChunks = readNumber(metric, "total_chunks") ?? 0;
      return {
        title: file ? `Summarizing ${file}` : "Summarizing code chunks",
        subject: file || "Chunk summary",
        progress_text:
          totalChunks > 0
            ? `${completedChunks}/${totalChunks} chunks summarized`
            : "Compressing source code into retrieval-friendly security metadata.",
        updated_at: updatedAt,
      };
    }
    case "candidate_generation": {
      const riskCategory = readString(metric, "risk_category");
      const batchIndex = readNumber(metric, "batch_index");
      const batchesInCategory = readNumber(metric, "batches_in_category");
      const selected = readNumber(metric, "selected_candidates");
      return {
        title: riskCategory
          ? `Generating ${riskCategory} candidates`
          : "Generating candidate vulnerabilities",
        subject:
          batchIndex != null && batchesInCategory != null
            ? `Batch ${batchIndex}/${batchesInCategory}`
            : "Candidate generation",
        progress_text:
          selected != null
            ? `${selected} high-signal candidates retained so far`
            : "Scoring suspicious code paths across risk categories.",
        updated_at: updatedAt,
      };
    }
    case "evidence_expansion": {
      const candidateId = readNumber(metric, "candidate_id");
      const completed = readNumber(metric, "completed_packs") ?? 0;
      const total = readNumber(metric, "total_packs") ?? 0;
      return {
        title: candidateId != null ? `Building evidence pack for candidate #${candidateId}` : "Building evidence packs",
        subject: candidateId != null ? `Candidate #${candidateId}` : "Evidence expansion",
        progress_text: total > 0 ? `${completed}/${total} evidence packs built` : "Collecting bounded code context for verification.",
        updated_at: updatedAt,
      };
    }
    case "verification": {
      const candidateId = readNumber(metric, "candidate_id");
      const reviewed = readNumber(metric, "reviewed_candidates") ?? 0;
      const total = readNumber(metric, "total_candidates") ?? 0;
      return {
        title: candidateId != null ? `Verifying candidate #${candidateId}` : "Verifying candidates",
        subject: candidateId != null ? `Candidate #${candidateId}` : "Verification",
        progress_text:
          total > 0
            ? `${reviewed}/${total} candidates reviewed`
            : "Confirming whether candidate issues are real exploitable findings.",
        updated_at: updatedAt,
      };
    }
    case "repo_synthesis": {
      const findings = readNumber(metric, "verified_findings") ?? 0;
      return {
        title: "Synthesizing repository summary",
        subject: findings > 0 ? `${findings} verified findings` : "Repository synthesis",
        progress_text: "Generating repository-level hotspots and final analyst summary.",
        updated_at: updatedAt,
      };
    }
    default:
      return fallbackFromLatestEvent(snapshot);
  }
}

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
