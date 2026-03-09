import type { CSSProperties } from "react";

import type { GcpHistoryStatus } from "../../types";
import { socColors } from "../../theme/theme";

export const TIME_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
  { label: "7d", value: 10080 },
  { label: "30d", value: 43200 },
];

export const SOURCE_OPTIONS = [
  { label: "All Sources", value: "" },
  { label: "Cloud Run", value: "cloud_run_logs" },
  { label: "Cloud Monitoring", value: "cloud_monitoring" },
  { label: "Load Balancer", value: "load_balancer" },
  { label: "Cloud Armor", value: "cloud_armor" },
  { label: "IAM Audit", value: "iam_audit" },
  { label: "IAP", value: "iap" },
];

export const SEVERITY_OPTIONS = [
  { label: "All Severities", value: "" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Info", value: "info" },
];

export const SPEED_OPTIONS = [1, 4, 16];

export const selectStyle: CSSProperties = {
  minWidth: 132,
  background: socColors.bgCard,
  color: socColors.text,
  border: `1px solid ${socColors.border}`,
  borderRadius: 16,
  padding: "10px 14px",
  fontSize: 13,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
};

export const controlGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 20,
  background: socColors.bgCard,
  border: `1px solid ${socColors.border}`,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

export function formatCoverage(value: string | null): string {
  if (!value) return "No coverage";
  try {
    return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

export function formatCursorLabel(value: string | null): string {
  if (!value) return "Cursor unavailable";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function backfillLabel(historyStatus: GcpHistoryStatus | null): string {
  const status = historyStatus?.backfill_status?.status;
  if (status === "running") return "Backfill running";
  if (status === "failed") return "Backfill failed";
  if (status === "complete" || historyStatus?.history_ready) return "History ready";
  return "Waiting for history";
}

export function sliderValue(replayCursor: string | null, timelineStart: string | null, timelineEnd: string | null) {
  if (!timelineStart || !timelineEnd) {
    return { min: 0, max: 100, value: 100, step: 1, disabled: true };
  }
  const min = new Date(timelineStart).getTime();
  const max = new Date(timelineEnd).getTime();
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { min: 0, max: 100, value: 100, step: 1, disabled: true };
  }
  const rawValue = replayCursor ? new Date(replayCursor).getTime() : max;
  return {
    min,
    max,
    value: Math.max(min, Math.min(max, rawValue)),
    step: Math.max(1, Math.floor((max - min) / 240)),
    disabled: false,
  };
}

export function iconButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 999,
    padding: "8px 12px",
    background: disabled ? socColors.bgPanel : socColors.accentSoft,
    color: disabled ? socColors.textDim : socColors.accent,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
