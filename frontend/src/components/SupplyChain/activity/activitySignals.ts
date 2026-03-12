import type { AdkTraceEvent, AdkTraceSnapshot, CodeScanStreamEvent } from "../../../types";

import { isRecord, readString } from "./activityReaders";

export function recentActivityEvents(snapshot: AdkTraceSnapshot | null): AdkTraceEvent[] {
  if (!snapshot) return [];
  return [...snapshot.events]
    .filter((event) => event.kind !== "metric" && event.kind !== "llm_partial")
    .slice(-8)
    .reverse();
}

export function latestSignalEvent(
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
