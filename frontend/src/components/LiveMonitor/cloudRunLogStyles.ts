import type { SignalTone } from "./cloudRunLogAnalysis";

export const AUTO_REFRESH_MS = 3000;

export const SEVERITY_COLORS: Record<string, string> = {
  EMERGENCY: "var(--md-error)",
  ALERT: "var(--md-error)",
  CRITICAL: "var(--md-error)",
  ERROR: "#ef5350",
  WARNING: "#ffa726",
  NOTICE: "#42a5f5",
  INFO: "var(--md-on-surface-variant)",
  DEBUG: "var(--md-outline)",
  DEFAULT: "var(--md-on-surface-variant)",
};

export function analysisToneColor(tone: "critical" | "warn" | "healthy" | "info") {
  return tone === "critical"
    ? "var(--md-error)"
    : tone === "warn"
      ? "#ffa726"
      : tone === "healthy"
        ? "var(--md-safe)"
        : "#42a5f5";
}

export function signalToneColor(tone: SignalTone) {
  return tone === "critical"
    ? "var(--md-error)"
    : tone === "warn"
      ? "#ffa726"
      : "#42a5f5";
}
