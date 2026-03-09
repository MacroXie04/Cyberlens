import type { CloudRunLogEntry } from "../../types";

import { normalizeMessage, summarizeMessage } from "./cloudRunLogHelpers";
import {
  type CloudRunLogAnalysis,
  type CloudRunLogSignalMatch,
  ERROR_SEVERITIES,
  SIGNAL_RULES,
  WARNING_SEVERITIES,
} from "./cloudRunLogRules";

export type {
  AnalysisTone,
  CloudRunLogAnalysis,
  CloudRunLogSignal,
  CloudRunLogSignalMatch,
  SignalTone,
} from "./cloudRunLogRules";

export function getCloudRunLogSignals(entry: CloudRunLogEntry): CloudRunLogSignalMatch[] {
  const haystack = `${entry.severity} ${entry.message}`;
  return SIGNAL_RULES.filter((rule) => rule.regex.test(haystack)).map((rule) => ({
    label: rule.label,
    tone: rule.tone,
    recommendation: rule.recommendation,
  }));
}

export function analyzeCloudRunLogs(entries: CloudRunLogEntry[]): CloudRunLogAnalysis {
  if (entries.length === 0) {
    return {
      headline: "No log data yet",
      tone: "info",
      counts: { total: 0, error: 0, warning: 0, investigate: 0 },
      insights: ["Fetch logs to see health signals, repeated failures, and likely root causes."],
      signals: [],
      repeatedMessages: [],
      recommendations: [],
    };
  }

  let errorCount = 0;
  let warningCount = 0;
  let investigateCount = 0;
  const signalCounts = new Map<string, { label: string; count: number; tone: CloudRunLogSignalMatch["tone"] }>();
  const recommendationCounts = new Map<string, number>();
  const fingerprintCounts = new Map<string, { sample: string; count: number }>();

  for (const entry of entries) {
    if (ERROR_SEVERITIES.has(entry.severity)) errorCount += 1;
    else if (WARNING_SEVERITIES.has(entry.severity)) warningCount += 1;

    const signals = getCloudRunLogSignals(entry);
    if (signals.some((signal) => signal.tone !== "info")) {
      investigateCount += 1;
    }

    const seenLabels = new Set<string>();
    for (const signal of signals) {
      if (seenLabels.has(signal.label)) continue;
      seenLabels.add(signal.label);

      const current = signalCounts.get(signal.label);
      if (current) current.count += 1;
      else signalCounts.set(signal.label, { label: signal.label, count: 1, tone: signal.tone });

      recommendationCounts.set(signal.recommendation, (recommendationCounts.get(signal.recommendation) || 0) + 1);
    }

    const fingerprint = normalizeMessage(entry.message);
    if (!fingerprint) continue;

    const existing = fingerprintCounts.get(fingerprint);
    if (existing) existing.count += 1;
    else fingerprintCounts.set(fingerprint, { sample: summarizeMessage(entry.message), count: 1 });
  }

  const signals = Array.from(signalCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 4);
  const repeatedMessages = Array.from(fingerprintCounts.values()).filter((item) => item.count > 1).sort((a, b) => b.count - a.count || a.sample.localeCompare(b.sample)).slice(0, 3);
  const recommendations = Array.from(recommendationCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([recommendation]) => recommendation);
  const criticalSignalCount = signals.filter((signal) => signal.tone === "critical").reduce((total, signal) => total + signal.count, 0);

  const headline =
    criticalSignalCount > 0 || errorCount >= Math.max(5, Math.ceil(entries.length * 0.2))
      ? "Operational issues detected"
      : investigateCount > 0 || warningCount > 0
        ? "Mixed signals in recent logs"
        : "Cloud Run logs look stable";
  const tone =
    headline === "Operational issues detected"
      ? "critical"
      : headline === "Mixed signals in recent logs"
        ? "warn"
        : "healthy";

  const insights = [
    errorCount > 0
      ? `${errorCount} of ${entries.length} entries are error-level or higher.`
      : `No error-level entries in the current ${entries.length}-line sample.`,
    signals[0]
      ? `${signals[0].label} appeared in ${signals[0].count} log entries.`
      : repeatedMessages[0]
        ? `Repeated pattern: "${repeatedMessages[0].sample}" (${repeatedMessages[0].count}x).`
        : "No repeated failure signature stands out in the latest results.",
  ];

  if (repeatedMessages[0] && signals[0]) {
    insights.push(`Repeated pattern: "${repeatedMessages[0].sample}" (${repeatedMessages[0].count}x).`);
  } else if (!signals[0]) {
    insights.push("No repeated failure signature stands out in the latest results.");
  }

  return {
    headline,
    tone,
    counts: {
      total: entries.length,
      error: errorCount,
      warning: warningCount,
      investigate: investigateCount,
    },
    insights,
    signals,
    repeatedMessages,
    recommendations,
  };
}
