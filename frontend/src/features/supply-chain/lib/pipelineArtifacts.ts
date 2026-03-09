import type { AdkTraceSnapshot } from "../types";

import { type VerificationOutcome, isRecord, readNumber, readString, readStringArray } from "./pipelineShared";

export function buildVerificationOutcomes(snapshot: AdkTraceSnapshot): VerificationOutcome[] {
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
