import type { AdkArtifactSummary, AdkTracePhase, AdkTracePhaseSummary } from "../types";

export interface PhaseProgressInfo {
  percent: number;
  detail: string;
  stats: Array<{ label: string; value: string }>;
}

export interface VerificationOutcome {
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

export const PHASE_ORDER = [
  "dependency_input",
  "dependency_adk_report",
  "code_inventory",
  "chunk_summary",
  "candidate_generation",
  "evidence_expansion",
  "verification",
  "repo_synthesis",
] as const;

export const PHASE_LABELS: Record<AdkTracePhase, string> = {
  dependency_input: "Dependency Input",
  dependency_adk_report: "Dependency ADK Report",
  code_inventory: "Code Inventory",
  chunk_summary: "Chunk Summary",
  candidate_generation: "Candidate Generation",
  evidence_expansion: "Evidence Expansion",
  verification: "Verification",
  repo_synthesis: "Repo Synthesis",
};

export function statusColor(status: string): string {
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

export function statusSurface(status: string): string {
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

export function formatDuration(durationMs: number): string {
  if (!durationMs) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function formatTimestamp(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function prettyPrintPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readNumber(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readString(record: Record<string, unknown> | null, key: string): string {
  if (!record) return "";
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function readStringArray(record: Record<string, unknown> | null, key: string): string[] {
  if (!record) return [];
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export function artifactCounts(artifacts: AdkArtifactSummary, verificationOutcomes: VerificationOutcome[]) {
  return [
    { label: "Verification Events", value: verificationOutcomes.length.toLocaleString() },
    { label: "Candidates", value: artifacts.candidates.length.toLocaleString() },
    { label: "Evidence Packs", value: artifacts.evidence_packs.length.toLocaleString() },
    { label: "Verified Findings", value: artifacts.verified_findings.length.toLocaleString() },
    { label: "Dependency Batches", value: artifacts.dependency_report_batches.length.toLocaleString() },
  ];
}

export function phaseSummaryFor(snapshotPhases: AdkTracePhaseSummary[], phase: AdkTracePhase) {
  return (
    snapshotPhases.find((item) => item.phase === phase) || {
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
}
