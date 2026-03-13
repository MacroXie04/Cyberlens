import type { AdkTracePhase, AdkTracePhaseSummary } from "../../../types";

export const PHASE_ORDER: AdkTracePhase[] = [
  "dependency_input",
  "dependency_adk_report",
  "code_map",
  "code_inventory",
  "chunk_summary",
  "candidate_generation",
  "evidence_expansion",
  "verification",
  "repo_synthesis",
];

export const PHASE_SHORT_LABELS: Record<AdkTracePhase, string> = {
  dependency_input: "Deps In",
  dependency_adk_report: "Deps ADK",
  code_map: "Code Map",
  code_inventory: "Inventory",
  chunk_summary: "Chunks",
  candidate_generation: "Candidates",
  evidence_expansion: "Evidence",
  verification: "Verify",
  repo_synthesis: "Synthesis",
};

export function phaseStatusColor(status: AdkTracePhaseSummary["status"]): string {
  switch (status) {
    case "success":
      return "var(--md-safe)";
    case "running":
      return "var(--md-primary)";
    case "error":
      return "var(--md-error)";
    case "warning":
      return "var(--md-warning)";
    default:
      return "var(--md-outline)";
  }
}

export function formatTimestamp(value?: string | null): string {
  if (!value) return "No updates yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function eventSummary(eventText: string, fallback: string): string {
  const summary = eventText.trim() || fallback;
  return summary.length > 140 ? `${summary.slice(0, 137)}...` : summary;
}
