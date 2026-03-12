import type { AdkTraceEvent } from "../../../types";

export const PHASE_COLORS: Record<string, string> = {
  chunk_summary: "#42a5f5",
  candidate_generation: "#ab47bc",
  evidence_expansion: "#ff7043",
  verification: "#66bb6a",
  repo_synthesis: "#26c6da",
};

export function summarizeRequests(events: AdkTraceEvent[]) {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let durationMs = 0;

  for (const event of events) {
    inputTokens += event.input_tokens;
    outputTokens += event.output_tokens;
    totalTokens += event.total_tokens;
    durationMs += event.duration_ms;
  }

  return { count: events.length, inputTokens, outputTokens, totalTokens, durationMs };
}
