import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type {
  AdkArtifactSummary,
  AdkTraceEvent,
  AdkTracePhase,
  AdkTracePhaseSummary,
  AdkTraceSnapshot,
  CodeScanStreamEvent,
  GitHubScan,
} from "../../types";

interface Props {
  snapshot: AdkTraceSnapshot | null;
  loading?: boolean;
  scan?: GitHubScan | null;
  codeScanStreamEvents?: CodeScanStreamEvent[];
}

interface PhaseProgressInfo {
  percent: number;
  detail: string;
  stats: Array<{ label: string; value: string }>;
}

interface VerificationOutcome {
  eventId: number;
  sequence: number;
  decision: string;
  candidateId: number | null;
  category: string;
  severity: string;
  filePath: string;
  lineNumber: number;
  reason: string;
  findingRef: number | null;
  title: string;
  description: string;
  recommendation: string;
  codeSnippet: string;
  evidenceRefs: string[];
}

const PHASE_ORDER = [
  "dependency_input",
  "dependency_adk_report",
  "code_inventory",
  "chunk_summary",
  "candidate_generation",
  "evidence_expansion",
  "verification",
  "repo_synthesis",
] as const;

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

function statusColor(status: string): string {
  switch (status) {
    case "success":
      return "var(--md-safe)";
    case "warning":
      return "var(--md-warning)";
    case "error":
      return "var(--md-error)";
    case "running":
      return "var(--md-primary)";
    default:
      return "var(--md-outline)";
  }
}

function statusSurface(status: string): string {
  switch (status) {
    case "success":
      return "rgba(46, 125, 50, 0.08)";
    case "warning":
      return "rgba(245, 124, 0, 0.08)";
    case "error":
      return "rgba(198, 40, 40, 0.08)";
    case "running":
      return "rgba(2, 119, 189, 0.08)";
    default:
      return "var(--md-surface-container)";
  }
}

function formatDuration(durationMs: number): string {
  if (!durationMs) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function prettyPrintPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function artifactCounts(artifacts: AdkArtifactSummary, verificationOutcomes: VerificationOutcome[]) {
  return [
    { label: "Verification Events", value: verificationOutcomes.length.toLocaleString() },
    { label: "Candidates", value: artifacts.candidates.length.toLocaleString() },
    { label: "Evidence Packs", value: artifacts.evidence_packs.length.toLocaleString() },
    { label: "Verified Findings", value: artifacts.verified_findings.length.toLocaleString() },
    { label: "Dependency Batches", value: artifacts.dependency_report_batches.length.toLocaleString() },
  ];
}

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

function readStringArray(record: Record<string, unknown> | null, key: string): string[] {
  if (!record) return [];
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function findLatestMetricPayload(
  snapshot: AdkTraceSnapshot,
  phase: AdkTracePhase,
  scan?: GitHubScan | null
): Record<string, unknown> | null {
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

function findLatestTokenEvent(events: CodeScanStreamEvent[]): CodeScanStreamEvent | null {
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

function derivePhaseProgress(
  phase: AdkTracePhaseSummary,
  snapshot: AdkTraceSnapshot,
  scan?: GitHubScan | null,
  codeScanStreamEvents: CodeScanStreamEvent[] = []
): PhaseProgressInfo {
  const metric = findLatestMetricPayload(snapshot, phase.phase, scan);
  const partialCount = snapshot.events.filter(
    (event) => event.phase === phase.phase && event.kind === "llm_partial"
  ).length;

  if (phase.status === "success" && !metric) {
    return {
      percent: 100,
      detail: "Completed",
      stats: [
        { label: "Duration", value: formatDuration(phase.duration_ms) },
        { label: "Tokens", value: phase.total_tokens.toLocaleString() },
      ],
    };
  }

  if (phase.status === "error") {
    return {
      percent: 100,
      detail: "Failed",
      stats: [
        { label: "Errors", value: phase.error_count.toString() },
        { label: "Tokens", value: phase.total_tokens.toLocaleString() },
      ],
    };
  }

  switch (phase.phase) {
    case "dependency_input": {
      const totalDependencies = readNumber(metric, "total_dependencies");
      const vulnerabilityCount = readNumber(metric, "vulnerability_count");
      return {
        percent: phase.status === "pending" ? 0 : phase.status === "running" ? 60 : 100,
        detail:
          vulnerabilityCount != null
            ? `${vulnerabilityCount} vulnerable packages prepared for ADK input`
            : "Collecting dependency risk input",
        stats: [
          { label: "Dependencies", value: (totalDependencies ?? 0).toLocaleString() },
          { label: "Vulnerabilities", value: (vulnerabilityCount ?? 0).toLocaleString() },
        ],
      };
    }
    case "dependency_adk_report": {
      const vulnerabilityCount = readNumber(metric, "vulnerability_count");
      const securityScore = readNumber(metric, "security_score");
      return {
        percent:
          phase.status === "success"
            ? 100
            : phase.status === "warning"
              ? 100
              : phase.status === "running"
                ? Math.min(90, 20 + partialCount * 8)
                : 0,
        detail:
          securityScore != null
            ? `Security score ${securityScore}`
            : partialCount > 0
              ? `Streaming ADK analysis (${partialCount} updates)`
              : "Waiting for dependency ADK response",
        stats: [
          { label: "Vulnerabilities", value: (vulnerabilityCount ?? 0).toLocaleString() },
          { label: "Tokens", value: phase.total_tokens.toLocaleString() },
        ],
      };
    }
    case "code_inventory": {
      const indexedFiles = readNumber(metric, "indexed_files");
      const totalFiles = scan?.code_scan_files_total ?? indexedFiles ?? 0;
      return {
        percent:
          phase.status === "success" ? 100 : phase.status === "running" ? 50 : phase.status === "pending" ? 0 : 100,
        detail:
          indexedFiles != null
            ? `${indexedFiles} source files indexed`
            : "Discovering code files and imports",
        stats: [
          { label: "Indexed", value: (indexedFiles ?? 0).toLocaleString() },
          { label: "Total Files", value: totalFiles.toLocaleString() },
        ],
      };
    }
    case "chunk_summary": {
      const completedChunks = readNumber(metric, "completed_chunks");
      const totalChunks = readNumber(metric, "total_chunks");
      const completedFiles =
        readNumber(metric, "completed_files") ?? scan?.code_scan_files_scanned ?? 0;
      const totalFiles =
        readNumber(metric, "total_files") ?? scan?.code_scan_files_total ?? 0;
      const currentFile =
        readString(metric, "current_file") ||
        readString(metric, "last_completed_file") ||
        codeScanStreamEvents
          .slice()
          .reverse()
          .find((event) => event.type === "file_start" && event.file_path)?.file_path ||
        "";
      const percent =
        completedChunks != null && totalChunks
          ? clampPercent((completedChunks / totalChunks) * 100)
          : totalFiles
            ? clampPercent((completedFiles / totalFiles) * 100)
            : phase.status === "success"
              ? 100
              : phase.status === "running"
                ? 10
                : 0;
      return {
        percent,
        detail: currentFile
          ? `Summarizing ${currentFile}`
          : "Summarizing code chunks for recall",
        stats: [
          {
            label: "Chunks",
            value:
              completedChunks != null && totalChunks != null
                ? `${completedChunks}/${totalChunks}`
                : "-",
          },
          { label: "Files", value: `${completedFiles}/${totalFiles || 0}` },
          {
            label: "Suspicious",
            value: ((readNumber(metric, "suspicious_chunks") ?? 0) as number).toLocaleString(),
          },
        ],
      };
    }
    case "candidate_generation": {
      const completedBatches = readNumber(metric, "completed_batches");
      const totalBatches = readNumber(metric, "total_batches");
      const selectedCandidates = readNumber(metric, "selected_candidates");
      const riskCategory = readString(metric, "risk_category");
      return {
        percent:
          completedBatches != null && totalBatches
            ? clampPercent((completedBatches / totalBatches) * 100)
            : phase.status === "success"
              ? 100
              : phase.status === "running"
                ? 20
                : 0,
        detail: riskCategory
          ? `Triaging ${riskCategory} candidates`
          : "Scoring candidate issues across risk passes",
        stats: [
          {
            label: "Batches",
            value:
              completedBatches != null && totalBatches != null
                ? `${completedBatches}/${totalBatches}`
                : "-",
          },
          { label: "Selected", value: (selectedCandidates ?? 0).toLocaleString() },
          {
            label: "Deduped",
            value: ((readNumber(metric, "deduped_candidates") ?? 0) as number).toLocaleString(),
          },
        ],
      };
    }
    case "evidence_expansion": {
      const completedPacks = readNumber(metric, "completed_packs");
      const totalPacks = readNumber(metric, "total_packs");
      return {
        percent:
          completedPacks != null && totalPacks
            ? clampPercent((completedPacks / Math.max(totalPacks, 1)) * 100)
            : phase.status === "success"
              ? 100
              : phase.status === "running"
                ? 15
                : 0,
        detail: "Building bounded evidence packs for verification",
        stats: [
          {
            label: "Packs",
            value:
              completedPacks != null && totalPacks != null
                ? `${completedPacks}/${totalPacks}`
                : "-",
          },
          {
            label: "Last Candidate",
            value: ((readNumber(metric, "candidate_id") ?? 0) as number).toLocaleString(),
          },
          {
            label: "Members",
            value: ((readNumber(metric, "member_count") ?? 0) as number).toLocaleString(),
          },
        ],
      };
    }
    case "verification": {
      const reviewedCandidates = readNumber(metric, "reviewed_candidates");
      const totalCandidates = readNumber(metric, "total_candidates");
      const confirmedFindings = readNumber(metric, "confirmed_findings");
      const rejectedCandidates = readNumber(metric, "rejected_candidates");
      const decision = readString(metric, "decision");
      return {
        percent:
          reviewedCandidates != null && totalCandidates
            ? clampPercent((reviewedCandidates / Math.max(totalCandidates, 1)) * 100)
            : phase.status === "success"
              ? 100
              : phase.status === "running"
                ? 10
                : 0,
        detail: decision ? `Latest decision: ${decision}` : "Verifying high-risk evidence packs",
        stats: [
          {
            label: "Reviewed",
            value:
              reviewedCandidates != null && totalCandidates != null
                ? `${reviewedCandidates}/${totalCandidates}`
                : "-",
          },
          { label: "Confirmed", value: (confirmedFindings ?? 0).toLocaleString() },
          { label: "Rejected", value: (rejectedCandidates ?? 0).toLocaleString() },
        ],
      };
    }
    case "repo_synthesis": {
      const summaryReady = Boolean(metric?.summary_ready);
      return {
        percent:
          phase.status === "success"
            ? 100
            : phase.status === "running"
              ? summaryReady
                ? 85
                : 35
              : 0,
        detail: summaryReady
          ? "Repository summary generated"
          : "Synthesizing repository-wide conclusions",
        stats: [
          {
            label: "Candidates",
            value: ((readNumber(metric, "candidate_count") ?? 0) as number).toLocaleString(),
          },
          {
            label: "Verified",
            value: ((readNumber(metric, "verified_findings") ?? 0) as number).toLocaleString(),
          },
          {
            label: "Hotspots",
            value: ((readNumber(metric, "hotspot_count") ?? 0) as number).toLocaleString(),
          },
        ],
      };
    }
    default:
      return { percent: 0, detail: "", stats: [] };
  }
}

function deriveOverallProgress(
  phases: AdkTracePhaseSummary[],
  snapshot: AdkTraceSnapshot,
  scan?: GitHubScan | null,
  codeScanStreamEvents: CodeScanStreamEvent[] = []
): number {
  const totals = phases.reduce((sum, phase) => {
    return sum + derivePhaseProgress(phase, snapshot, scan, codeScanStreamEvents).percent;
  }, 0);
  return clampPercent(totals / Math.max(phases.length, 1));
}

function findCurrentPhase(phases: AdkTracePhaseSummary[]): AdkTracePhaseSummary | null {
  return (
    phases.find((phase) => phase.status === "running") ||
    [...phases].reverse().find((phase) => phase.status !== "pending") ||
    null
  );
}

function buildVerificationOutcomes(snapshot: AdkTraceSnapshot): VerificationOutcome[] {
  return snapshot.events
    .filter((event) => event.phase === "verification" && event.kind === "artifact_created")
    .map((event) => {
      const payload = isRecord(event.payload_json) ? event.payload_json : {};
      return {
        eventId: event.id,
        sequence: event.sequence,
        decision: readString(payload, "decision") || "unknown",
        candidateId: readNumber(payload, "candidate_id"),
        category: readString(payload, "category"),
        severity: readString(payload, "severity"),
        filePath: readString(payload, "file_path"),
        lineNumber: readNumber(payload, "line_number") ?? 0,
      reason: readString(payload, "reason"),
      findingRef: readNumber(payload, "finding_ref"),
      title: readString(payload, "title"),
      description: readString(payload, "description"),
      recommendation: readString(payload, "recommendation"),
      codeSnippet: readString(payload, "code_snippet"),
      evidenceRefs: readStringArray(payload, "evidence_refs"),
    };
  })
    .sort((left, right) => right.sequence - left.sequence);
}

function latestAgentEvents(snapshot: AdkTraceSnapshot): AdkTraceEvent[] {
  return [...snapshot.events]
    .filter((event) => event.kind !== "metric")
    .slice(-5)
    .reverse();
}

export default function AdkPipelineView({
  snapshot,
  loading = false,
  scan = null,
  codeScanStreamEvents = [],
}: Props) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!snapshot?.events.length) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId((current) => {
      if (current && snapshot.events.some((event) => event.id === current)) {
        return current;
      }
      return snapshot.events[snapshot.events.length - 1].id;
    });
  }, [snapshot?.events]);

  if (loading && !snapshot) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, color: "var(--md-on-surface-variant)" }}>
          Loading ADK pipeline...
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, color: "var(--md-on-surface-variant)" }}>
          No ADK pipeline trace available yet.
        </div>
      </div>
    );
  }

  const phaseSummaries: AdkTracePhaseSummary[] = PHASE_ORDER.map((phase) => {
    return (
      snapshot.phases.find((item) => item.phase === phase) || {
        phase,
        status: "pending",
        label: PHASE_LABELS[phase],
        started_at: null,
        ended_at: null,
        duration_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        event_count: 0,
        artifact_count: 0,
        error_count: 0,
      }
    );
  });

  const filteredEvents = snapshot.events.filter((event) => {
    if (phaseFilter !== "all" && event.phase !== phaseFilter) return false;
    if (kindFilter !== "all" && event.kind !== kindFilter) return false;
    if (statusFilter !== "all" && event.status !== statusFilter) return false;
    return true;
  });

  const selectedEvent =
    filteredEvents.find((event) => event.id === selectedEventId) ||
    snapshot.events.find((event) => event.id === selectedEventId) ||
    filteredEvents[filteredEvents.length - 1] ||
    snapshot.events[snapshot.events.length - 1] ||
    null;

  const currentPhase = findCurrentPhase(phaseSummaries);
  const overallProgress = deriveOverallProgress(
    phaseSummaries,
    snapshot,
    scan,
    codeScanStreamEvents
  );
  const verificationOutcomes = buildVerificationOutcomes(snapshot);
  const counts = artifactCounts(snapshot.artifacts, verificationOutcomes);
  const liveTokenEvent = findLatestTokenEvent(codeScanStreamEvents);
  const selectedPayload = selectedEvent && isRecord(selectedEvent.payload_json) ? selectedEvent.payload_json : null;
  const recentAgentEvents = latestAgentEvents(snapshot);
  const latestAgentEvent = recentAgentEvents[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--md-on-surface)",
                margin: 0,
              }}
            >
              ADK Pipeline
            </h3>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 4 }}>
              Full scan trace, live progress, and intermediate artifacts across dependency and code ADK
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {currentPhase && (
              <span
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: statusSurface(currentPhase.status),
                  color: statusColor(currentPhase.status),
                  fontWeight: 600,
                }}
              >
                Current: {currentPhase.label || PHASE_LABELS[currentPhase.phase]}
              </span>
            )}
            {loading && (
              <span style={{ fontSize: 12, color: "var(--md-primary)", fontWeight: 600 }}>
                Live trace active
              </span>
            )}
          </div>
        </div>

        <div
          className="adk-pipeline-activity-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)", marginBottom: 10 }}>
              Agent Activity
            </div>
            {!latestAgentEvent ? (
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
                No agent activity yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: statusSurface(latestAgentEvent.status),
                    border: `1px solid ${statusColor(latestAgentEvent.status)}22`,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>
                    {latestAgentEvent.label || PHASE_LABELS[latestAgentEvent.phase]}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
                    {PHASE_LABELS[latestAgentEvent.phase]} · {latestAgentEvent.kind} ·{" "}
                    {formatTimestamp(latestAgentEvent.created_at)}
                  </div>
                  {(latestAgentEvent.text_preview ||
                    readString(
                      isRecord(latestAgentEvent.payload_json) ? latestAgentEvent.payload_json : null,
                      "detail"
                    ) ||
                    readString(
                      isRecord(latestAgentEvent.payload_json) ? latestAgentEvent.payload_json : null,
                      "error_message"
                    )) && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: "var(--md-on-surface)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {latestAgentEvent.text_preview ||
                        readString(
                          isRecord(latestAgentEvent.payload_json) ? latestAgentEvent.payload_json : null,
                          "detail"
                        ) ||
                        readString(
                          isRecord(latestAgentEvent.payload_json) ? latestAgentEvent.payload_json : null,
                          "error_message"
                        )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentAgentEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      style={{
                        border: "1px solid var(--md-outline-variant)",
                        background: "var(--md-surface-container)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)" }}>
                        {event.label}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                        {PHASE_LABELS[event.phase]} · {event.kind} · #{event.sequence}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)", marginBottom: 10 }}>
              Live Token Usage
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 10,
              }}
            >
              <MetricPill
                label="Input"
                value={(
                  liveTokenEvent?.input_tokens ??
                  scan?.code_scan_input_tokens ??
                  0
                ).toLocaleString()}
              />
              <MetricPill
                label="Output"
                value={(
                  liveTokenEvent?.output_tokens ??
                  scan?.code_scan_output_tokens ??
                  0
                ).toLocaleString()}
              />
              <MetricPill
                label="Total"
                value={(
                  liveTokenEvent?.total_tokens ??
                  scan?.code_scan_total_tokens ??
                  0
                ).toLocaleString()}
              />
              <MetricPill
                label="Files"
                value={`${scan?.code_scan_files_scanned ?? 0}/${scan?.code_scan_files_total ?? 0}`}
              />
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "var(--md-on-surface-variant)",
                lineHeight: 1.6,
              }}
            >
              Token totals refresh after each ADK call completes. If the counters stay at zero, inspect the latest
              warning or error to see whether the agent was skipped before any model call started.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: "var(--md-surface-container)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
                Overall pipeline progress
              </div>
              <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)" }}>
                {overallProgress}%
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <MetricPill label="Events" value={snapshot.events.length.toLocaleString()} />
              <MetricPill
                label="Artifacts"
                value={(
                  snapshot.artifacts.candidates.length +
                  snapshot.artifacts.evidence_packs.length +
                  snapshot.artifacts.verified_findings.length +
                  snapshot.artifacts.dependency_report_batches.length
                ).toLocaleString()}
              />
              <MetricPill
                label="Tokens"
                value={(
                  liveTokenEvent?.total_tokens ??
                  scan?.code_scan_total_tokens ??
                  phaseSummaries.reduce((sum, item) => sum + item.total_tokens, 0)
                ).toLocaleString()}
              />
              <MetricPill
                label="Files"
                value={`${scan?.code_scan_files_scanned ?? 0}/${scan?.code_scan_files_total ?? 0}`}
              />
            </div>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "var(--md-surface-container-high)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${overallProgress}%`,
                background: "linear-gradient(90deg, var(--md-primary), var(--md-safe))",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {currentPhase && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
              {derivePhaseProgress(currentPhase, snapshot, scan, codeScanStreamEvents).detail}
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {counts.map((item) => (
            <div
              key={item.label}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--md-surface-container-high)",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{item.label}</div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--md-on-surface)",
                  fontFamily: "var(--md-font-mono)",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {phaseSummaries.map((phase) => {
            const progress = derivePhaseProgress(phase, snapshot, scan, codeScanStreamEvents);
            return (
              <div
                key={phase.phase}
                style={{
                  border: `1px solid ${statusColor(phase.status)}33`,
                  background: statusSurface(phase.status),
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: statusColor(phase.status),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>
                    {phase.label || PHASE_LABELS[phase.phase]}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: "var(--md-on-surface-variant)",
                      fontFamily: "var(--md-font-mono)",
                    }}
                  >
                    {progress.percent}%
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.5)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progress.percent}%`,
                      background: statusColor(phase.status),
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", minHeight: 36 }}>
                  {progress.detail}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                  <span style={{ color: "var(--md-on-surface-variant)" }}>
                    {phase.status.toUpperCase()}
                  </span>
                  <span style={{ color: "var(--md-on-surface-variant)" }}>
                    {formatDuration(phase.duration_ms)}
                  </span>
                  <span style={{ color: "var(--md-on-surface-variant)" }}>
                    {phase.total_tokens.toLocaleString()} tokens
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                    gap: 8,
                  }}
                >
                  {progress.stats.map((item) => (
                    <MetricPill key={`${phase.phase}-${item.label}`} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <FilterSelect
            label="Phase"
            value={phaseFilter}
            onChange={setPhaseFilter}
            options={[
              { value: "all", label: "All phases" },
              ...phaseSummaries.map((phase) => ({
                value: phase.phase,
                label: phase.label || PHASE_LABELS[phase.phase],
              })),
            ]}
          />
          <FilterSelect
            label="Kind"
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { value: "all", label: "All kinds" },
              { value: "stage_started", label: "Stage Started" },
              { value: "stage_completed", label: "Stage Completed" },
              { value: "llm_partial", label: "LLM Partial" },
              { value: "llm_completed", label: "LLM Completed" },
              { value: "artifact_created", label: "Artifact Created" },
              { value: "metric", label: "Metric" },
              { value: "warning", label: "Warning" },
              { value: "error", label: "Error" },
            ]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All statuses" },
              { value: "running", label: "Running" },
              { value: "success", label: "Success" },
              { value: "warning", label: "Warning" },
              { value: "error", label: "Error" },
            ]}
          />
        </div>
      </div>

      <div
        className="adk-pipeline-detail-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
          gap: 16,
        }}
      >
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--md-outline-variant)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--md-on-surface)",
            }}
          >
            Trace Feed ({filteredEvents.length})
          </div>
          <div style={{ maxHeight: 760, overflowY: "auto" }}>
            {filteredEvents.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: "var(--md-on-surface-variant)" }}>
                No events match the current filters.
              </div>
            ) : (
              filteredEvents.map((event, index) => {
                const previousPhase = index > 0 ? filteredEvents[index - 1].phase : null;
                const showHeader = previousPhase !== event.phase;
                return (
                  <div key={event.id}>
                    {showHeader && (
                      <div
                        style={{
                          padding: "10px 16px",
                          background: "var(--md-surface-container-high)",
                          borderBottom: "1px solid var(--md-outline-variant)",
                          fontSize: 11,
                          letterSpacing: 0.8,
                          textTransform: "uppercase",
                          color: "var(--md-primary)",
                          fontWeight: 700,
                        }}
                      >
                        {PHASE_LABELS[event.phase]}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        background:
                          selectedEvent?.id === event.id
                            ? "var(--md-surface-container-high)"
                            : "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--md-outline-variant)",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: statusColor(event.status),
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--md-on-surface)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {event.label || PHASE_LABELS[event.phase]}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--md-on-surface-variant)",
                            fontFamily: "var(--md-font-mono)",
                            flexShrink: 0,
                          }}
                        >
                          #{event.sequence}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          fontSize: 11,
                          color: "var(--md-on-surface-variant)",
                        }}
                      >
                        <span>{event.kind}</span>
                        <span>{event.status}</span>
                        {event.total_tokens > 0 && <span>{event.total_tokens.toLocaleString()} tokens</span>}
                        {event.duration_ms > 0 && <span>{formatDuration(event.duration_ms)}</span>}
                        <span>{formatTimestamp(event.created_at)}</span>
                      </div>
                      {event.text_preview && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--md-on-surface-variant)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            lineHeight: 1.5,
                          }}
                        >
                          {event.text_preview}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>
              Inspector
            </div>
            {selectedEvent && (
              <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                Sequence #{selectedEvent.sequence}
              </div>
            )}
          </div>

          {!selectedEvent ? (
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
              Select an event to inspect its details.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InspectorMeta event={selectedEvent} />
              <IssueInspector event={selectedEvent} payload={selectedPayload} />
              <EvidenceInspector event={selectedEvent} payload={selectedPayload} />
              {selectedEvent.text_preview && (
                <InspectorSection title="Text Preview">
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "var(--md-font-mono)",
                      fontSize: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    {selectedEvent.text_preview}
                  </pre>
                </InspectorSection>
              )}
              <InspectorSection title="Payload JSON">
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "var(--md-font-mono)",
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  {prettyPrintPayload(selectedEvent.payload_json)}
                </pre>
              </InspectorSection>
            </div>
          )}
        </div>
      </div>

      <div
        className="adk-pipeline-artifact-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <ArtifactCard title={`Dependency Report Batches (${snapshot.artifacts.dependency_report_batches.length})`}>
          {snapshot.artifacts.dependency_report_batches.length === 0 ? (
            <EmptyArtifactState label="No dependency batches captured yet." />
          ) : (
            snapshot.artifacts.dependency_report_batches.map((batch, index) => {
              const payload = isRecord(batch) ? batch : {};
              return (
                <ArtifactRow
                  key={`dep-batch-${index}`}
                  title={readString(payload, "label") || `Batch ${index + 1}`}
                  meta={[
                    `${(readNumber(payload, "vulnerability_count") ?? 0).toLocaleString()} vulns`,
                    `${(readNumber(payload, "security_score") ?? 0).toLocaleString()} score`,
                  ]}
                >
                  Repository: {readString(payload, "repository") || "-"}
                </ArtifactRow>
              );
            })
          )}
        </ArtifactCard>

        <ArtifactCard title={`Candidates (${snapshot.artifacts.candidates.length})`}>
          {snapshot.artifacts.candidates.length === 0 ? (
            <EmptyArtifactState label="No candidates generated yet." />
          ) : (
            snapshot.artifacts.candidates.map((candidate) => (
              <ArtifactRow
                key={candidate.candidate_id}
                title={`#${candidate.candidate_id} ${candidate.label || candidate.category}`}
                meta={[
                  `${candidate.score.toFixed(2)} score`,
                  candidate.severity_hint || "severity n/a",
                  candidate.status,
                ]}
              >
                {candidate.chunk_refs.length} chunks linked. {candidate.rationale || "No rationale"}
              </ArtifactRow>
            ))
          )}
        </ArtifactCard>

        <ArtifactCard title={`Evidence Packs (${snapshot.artifacts.evidence_packs.length})`}>
          {snapshot.artifacts.evidence_packs.length === 0 ? (
            <EmptyArtifactState label="No evidence packs built yet." />
          ) : (
            snapshot.artifacts.evidence_packs.map((item, index) => {
              const payload = isRecord(item) ? item : {};
              const members = Array.isArray(payload.members) ? payload.members.length : 0;
              return (
                <ArtifactRow
                  key={`evidence-${index}`}
                  title={String(payload.evidence_pack_id || payload.label || `Evidence ${index + 1}`)}
                  meta={[
                    `${(readNumber(payload, "candidate_id") ?? 0).toLocaleString()} candidate`,
                    `${members} members`,
                  ]}
                  onClick={() => {
                    const eventId = readNumber(payload, "event_id");
                    if (eventId != null) {
                      setSelectedEventId(eventId);
                    }
                  }}
                >
                  Score {(readNumber(payload, "score") ?? 0).toFixed(2)}
                </ArtifactRow>
              );
            })
          )}
        </ArtifactCard>

        <ArtifactCard title={`Verification Outcomes (${verificationOutcomes.length})`}>
          {verificationOutcomes.length === 0 ? (
            <EmptyArtifactState label="No verification outcomes yet." />
          ) : (
            verificationOutcomes.map((outcome) => (
              <ArtifactRow
                key={outcome.eventId}
                title={`#${outcome.candidateId ?? "-"} ${outcome.title || outcome.decision}`}
                meta={[
                  outcome.filePath ? `${outcome.filePath}:${outcome.lineNumber || "?"}` : "location n/a",
                  outcome.category || "category n/a",
                  outcome.severity || "severity n/a",
                  `seq ${outcome.sequence}`,
                ]}
                tone={outcome.decision === "confirmed" ? "success" : outcome.decision === "rejected" ? "warning" : "default"}
                onClick={() => setSelectedEventId(outcome.eventId)}
              >
                {outcome.description || outcome.reason || "No explanation recorded."}
              </ArtifactRow>
            ))
          )}
        </ArtifactCard>

        <ArtifactCard title={`Verified Findings (${snapshot.artifacts.verified_findings.length})`}>
          {snapshot.artifacts.verified_findings.length === 0 ? (
            <EmptyArtifactState label="No findings confirmed yet." />
          ) : (
            snapshot.artifacts.verified_findings.map((finding) => (
              <ArtifactRow
                key={finding.finding_id}
                title={`#${finding.finding_id} ${finding.title}`}
                meta={[finding.category, finding.severity, `${finding.candidate_ids.length} sources`]}
                tone="success"
              >
                {finding.file_path}:{finding.line_number}
              </ArtifactRow>
            ))
          )}
        </ArtifactCard>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .adk-pipeline-detail-grid {
            grid-template-columns: 1fr !important;
          }

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

function MetricPill({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        background: alert ? "rgba(198, 40, 40, 0.08)" : "var(--md-surface-container-high)",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          marginTop: 2,
          fontWeight: 700,
          color: alert ? "var(--md-error)" : "var(--md-on-surface)",
          fontFamily: "var(--md-font-mono)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--md-outline-variant)",
          background: "var(--md-surface-container)",
          color: "var(--md-on-surface)",
          padding: "0 12px",
          fontSize: 13,
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InspectorMeta({ event }: { event: AdkTraceEvent }) {
  const metaItems = [
    ["Phase", PHASE_LABELS[event.phase] || event.phase],
    ["Kind", event.kind],
    ["Status", event.status],
    ["Label", event.label || "-"],
    ["Parent", event.parent_key || "-"],
    ["Started", formatTimestamp(event.started_at)],
    ["Ended", formatTimestamp(event.ended_at)],
    ["Created", formatTimestamp(event.created_at)],
    ["Duration", formatDuration(event.duration_ms)],
    ["Input Tokens", event.input_tokens.toLocaleString()],
    ["Output Tokens", event.output_tokens.toLocaleString()],
    ["Total Tokens", event.total_tokens.toLocaleString()],
  ];

  return (
    <InspectorSection title="Metadata">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {metaItems.map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--md-surface-container)",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--md-on-surface)",
                wordBreak: "break-word",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </InspectorSection>
  );
}

function IssueInspector({
  event,
  payload,
}: {
  event: AdkTraceEvent;
  payload: Record<string, unknown> | null;
}) {
  if (!payload || event.phase !== "verification") {
    return null;
  }

  const title = readString(payload, "title");
  const filePath = readString(payload, "file_path");
  const lineNumber = readNumber(payload, "line_number");
  const category = readString(payload, "category");
  const severity = readString(payload, "severity");
  const reason = readString(payload, "reason");
  const description = readString(payload, "description");
  const recommendation = readString(payload, "recommendation");
  const codeSnippet = readString(payload, "code_snippet");
  const evidenceRefs = readStringArray(payload, "evidence_refs");
  const decision = readString(payload, "decision");
  const findingRef = readNumber(payload, "finding_ref");

  const metaItems = [
    ["Decision", decision || "-"],
    ["Title", title || "-"],
    ["File", filePath || "-"],
    ["Line", lineNumber != null && lineNumber > 0 ? String(lineNumber) : "-"],
    ["Category", category || "-"],
    ["Severity", severity || "-"],
    ["Finding Ref", findingRef != null ? String(findingRef) : "-"],
  ];

  return (
    <>
      <InspectorSection title="Issue Details">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {metaItems.map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--md-surface-container)",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--md-on-surface)",
                  wordBreak: "break-word",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </InspectorSection>

      {(reason || description) && (
        <InspectorSection title="Why It Matters">
          <div style={{ fontSize: 12, color: "var(--md-on-surface)", lineHeight: 1.6 }}>
            {reason || description}
          </div>
          {reason && description && description !== reason && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--md-on-surface-variant)",
                lineHeight: 1.6,
              }}
            >
              {description}
            </div>
          )}
        </InspectorSection>
      )}

      {codeSnippet && (
        <InspectorSection title="Code Snippet">
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--md-font-mono)",
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            {codeSnippet}
          </pre>
        </InspectorSection>
      )}

      {recommendation && (
        <InspectorSection title="Recommended Fix">
          <div style={{ fontSize: 12, color: "var(--md-on-surface)", lineHeight: 1.6 }}>
            {recommendation}
          </div>
        </InspectorSection>
      )}

      {evidenceRefs.length > 0 && (
        <InspectorSection title="Evidence Refs">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {evidenceRefs.map((ref) => (
              <span
                key={ref}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "var(--md-surface-container)",
                  fontSize: 11,
                  fontFamily: "var(--md-font-mono)",
                  color: "var(--md-on-surface)",
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        </InspectorSection>
      )}
    </>
  );
}

function EvidenceInspector({
  event,
  payload,
}: {
  event: AdkTraceEvent;
  payload: Record<string, unknown> | null;
}) {
  if (!payload || event.phase !== "evidence_expansion") {
    return null;
  }

  const members = Array.isArray(payload.members) ? payload.members : [];
  if (members.length === 0) {
    return null;
  }

  return (
    <InspectorSection title="Evidence Pack">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {members.map((member, index) => {
          const record = isRecord(member) ? member : null;
          const filePath = readString(record, "file_path");
          const lineRange = Array.isArray(record?.line_range)
            ? record?.line_range.map((item) => String(item)).join("-")
            : "-";
          const summary = readString(record, "summary");
          const snippetPreview = readString(record, "snippet_preview");
          const signals = Array.isArray(record?.security_signals)
            ? record?.security_signals.map((item) => String(item))
            : [];

          return (
            <div
              key={`${filePath}-${lineRange}-${index}`}
              style={{
                padding: 12,
                borderRadius: 10,
                background: "var(--md-surface-container)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>
                {filePath}:{lineRange}
              </div>
              {signals.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {signals.map((signal) => (
                    <span
                      key={signal}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "var(--md-surface-container-high)",
                        fontSize: 11,
                        color: "var(--md-primary)",
                      }}
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              )}
              {summary && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "var(--md-on-surface)",
                    lineHeight: 1.6,
                  }}
                >
                  {summary}
                </div>
              )}
              {snippetPreview && (
                <pre
                  style={{
                    margin: "10px 0 0 0",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "var(--md-font-mono)",
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {snippetPreview}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </InspectorSection>
  );
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: "var(--md-primary)",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "var(--md-surface-container-high)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ArtifactCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function ArtifactRow({
  title,
  meta,
  children,
  tone = "default",
  onClick,
}: {
  title: string;
  meta: string[];
  children: ReactNode;
  tone?: "default" | "success" | "warning";
  onClick?: () => void;
}) {
  const toneColor =
    tone === "success"
      ? "var(--md-safe)"
      : tone === "warning"
        ? "var(--md-warning)"
        : "var(--md-primary)";
  const toneSurface =
    tone === "success"
      ? "rgba(46, 125, 50, 0.08)"
      : tone === "warning"
        ? "rgba(245, 124, 0, 0.08)"
        : "var(--md-surface-container-high)";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        padding: 12,
        borderRadius: 12,
        background: toneSurface,
        border: `1px solid ${toneColor}22`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>{title}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, fontSize: 11, color: toneColor }}>
        {meta.filter(Boolean).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

function EmptyArtifactState({ label }: { label: string }) {
  return <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>{label}</div>;
}
