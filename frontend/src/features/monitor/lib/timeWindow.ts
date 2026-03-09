import type { GcpEstateSummary, GcpHistoryStatus, GcpObservedService, GcpReplaySnapshot, GcpTimelineResponse } from "../types";

export interface WindowBounds {
  start: string;
  end: string;
}

export const TIME_RANGE_CONFIG: Record<number, { label: string; bucket: "5m" | "1h" | "6h"; replayWindowMinutes: number }> = {
  15: { label: "15m", bucket: "5m", replayWindowMinutes: 60 },
  60: { label: "1h", bucket: "5m", replayWindowMinutes: 60 },
  360: { label: "6h", bucket: "5m", replayWindowMinutes: 60 },
  1440: { label: "24h", bucket: "5m", replayWindowMinutes: 60 },
  10080: { label: "7d", bucket: "1h", replayWindowMinutes: 1440 },
  43200: { label: "30d", bucket: "6h", replayWindowMinutes: 1440 },
};

export function computeWindowBounds(minutes: number): WindowBounds {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function withinBounds(value: string | null, bounds: WindowBounds | null): boolean {
  if (!value || !bounds) return false;
  const ts = new Date(value).getTime();
  return ts >= new Date(bounds.start).getTime() && ts <= new Date(bounds.end).getTime();
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "Unavailable";
  try {
    return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

export function describeReplayWindow(cursor: string | null, minutes: number): string {
  const quantity = minutes >= 1440 ? `${Math.round(minutes / 1440)} day` : `${Math.round(minutes / 60)} hour`;
  const pluralized = quantity.endsWith("1 day") || quantity.endsWith("1 hour") ? quantity : `${quantity}s`;
  return `${pluralized} ending ${formatTimestamp(cursor)}`;
}

export function historyEmptyState(historyStatus: GcpHistoryStatus | null): string {
  if (historyStatus?.backfill_status?.status === "running") return "Backfill in progress. Historical metrics and evidence will appear as collection completes.";
  if (historyStatus?.backfill_status?.status === "failed") return "History backfill failed. Refresh after resolving the collection issue.";
  if (!historyStatus?.history_ready) return "No history collected yet. Trigger a refresh or wait for the first backfill to finish.";
  return "No notable metrics or incident markers in the selected range.";
}

export function projectIdFromState(snapshot: GcpReplaySnapshot | null, summary: GcpEstateSummary | null, directory: GcpObservedService[]): string {
  return snapshot?.summary.project_id || summary?.project_id || directory[0]?.project_id || "";
}

export function replayWindowLabelFor(timeRange: number, replayCursor: string | null, timeline: GcpTimelineResponse | null, snapshot: GcpReplaySnapshot | null) {
  const rangeConfig = TIME_RANGE_CONFIG[timeRange] ?? TIME_RANGE_CONFIG[43200];
  return describeReplayWindow(replayCursor ?? timeline?.end ?? snapshot?.cursor ?? null, rangeConfig.replayWindowMinutes);
}
