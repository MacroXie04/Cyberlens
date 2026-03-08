import type { CloudRunLogEntry } from "../../types";

type SignalTone = "critical" | "warn" | "info";
type AnalysisTone = SignalTone | "healthy";

interface SignalRule {
  label: string;
  regex: RegExp;
  tone: SignalTone;
  recommendation: string;
}

export interface CloudRunLogSignalMatch {
  label: string;
  tone: SignalTone;
  recommendation: string;
}

export interface CloudRunLogSignal {
  label: string;
  count: number;
  tone: SignalTone;
}

export interface CloudRunLogAnalysis {
  headline: string;
  tone: AnalysisTone;
  counts: {
    total: number;
    error: number;
    warning: number;
    investigate: number;
  };
  insights: string[];
  signals: CloudRunLogSignal[];
  repeatedMessages: Array<{ sample: string; count: number }>;
  recommendations: string[];
}

const ERROR_SEVERITIES = new Set(["ERROR", "CRITICAL", "ALERT", "EMERGENCY"]);
const WARNING_SEVERITIES = new Set(["WARNING"]);

const SIGNAL_RULES: SignalRule[] = [
  {
    label: "Server exceptions",
    regex: /(exception|traceback|panic|fatal|stack trace|internal server error|unhandled)/i,
    tone: "critical",
    recommendation: "Inspect the failing revision and stack traces first. Repeated exceptions usually need a code or config fix, not just a retry.",
  },
  {
    label: "Database issues",
    regex: /(database|postgres|mysql|sqlite|deadlock|connection refused|could not connect|timeout while connecting)/i,
    tone: "critical",
    recommendation: "Check database reachability, pool saturation, and recent schema or credential changes.",
  },
  {
    label: "Auth failures",
    regex: /(unauthoriz|forbidden|invalid credentials|login failed|permission denied|unauthenticated|token expired)/i,
    tone: "warn",
    recommendation: "Review authentication failures for deployment drift, expired tokens, or abusive login traffic.",
  },
  {
    label: "Rate limiting",
    regex: /(rate limit|too many requests|quota exceeded|\b429\b)/i,
    tone: "warn",
    recommendation: "Verify whether rate limits are expected. If not, inspect traffic spikes, bots, and client retry behavior.",
  },
  {
    label: "Suspicious probes",
    regex: /(union select|drop table|<script|%3cscript|(?:\.\.\/)+|%2e%2e|wp-admin|\/\.env|\/etc\/passwd|sqlmap|nikto|acunetix|scanner|nmap)/i,
    tone: "critical",
    recommendation: "Treat these entries as hostile probing until proven otherwise. Check source IPs, WAF rules, and blocklists.",
  },
  {
    label: "Route misses",
    regex: /(\b404\b|not found)/i,
    tone: "info",
    recommendation: "If route misses are climbing, confirm recent path changes and watch for crawler noise.",
  },
];

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8,}/g, "#")
    .replace(/\b\d+\b/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeMessage(message: string, maxLength = 88): string {
  const compact = message.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 3)}...`;
}

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

  const signalCounts = new Map<string, CloudRunLogSignal>();
  const recommendationCounts = new Map<string, number>();
  const fingerprintCounts = new Map<string, { sample: string; count: number }>();

  for (const entry of entries) {
    if (ERROR_SEVERITIES.has(entry.severity)) {
      errorCount += 1;
    } else if (WARNING_SEVERITIES.has(entry.severity)) {
      warningCount += 1;
    }

    const signals = getCloudRunLogSignals(entry);
    if (signals.some((signal) => signal.tone !== "info")) {
      investigateCount += 1;
    }

    const seenLabels = new Set<string>();
    for (const signal of signals) {
      if (seenLabels.has(signal.label)) {
        continue;
      }
      seenLabels.add(signal.label);

      const current = signalCounts.get(signal.label);
      if (current) {
        current.count += 1;
      } else {
        signalCounts.set(signal.label, {
          label: signal.label,
          count: 1,
          tone: signal.tone,
        });
      }
      recommendationCounts.set(
        signal.recommendation,
        (recommendationCounts.get(signal.recommendation) || 0) + 1
      );
    }

    const fingerprint = normalizeMessage(entry.message);
    if (!fingerprint) {
      continue;
    }
    const existing = fingerprintCounts.get(fingerprint);
    if (existing) {
      existing.count += 1;
    } else {
      fingerprintCounts.set(fingerprint, {
        sample: summarizeMessage(entry.message),
        count: 1,
      });
    }
  }

  const signals = Array.from(signalCounts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 4);

  const repeatedMessages = Array.from(fingerprintCounts.values())
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count || a.sample.localeCompare(b.sample))
    .slice(0, 3);

  const recommendations = Array.from(recommendationCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([recommendation]) => recommendation);

  const criticalSignalCount = signals
    .filter((signal) => signal.tone === "critical")
    .reduce((total, signal) => total + signal.count, 0);

  let headline = "Cloud Run logs look stable";
  let tone: AnalysisTone = "healthy";

  if (
    criticalSignalCount > 0 ||
    errorCount >= Math.max(5, Math.ceil(entries.length * 0.2))
  ) {
    headline = "Operational issues detected";
    tone = "critical";
  } else if (investigateCount > 0 || warningCount > 0) {
    headline = "Mixed signals in recent logs";
    tone = "warn";
  }

  const insights: string[] = [];
  if (errorCount > 0) {
    insights.push(`${errorCount} of ${entries.length} entries are error-level or higher.`);
  } else {
    insights.push(`No error-level entries in the current ${entries.length}-line sample.`);
  }

  if (signals[0]) {
    insights.push(`${signals[0].label} appeared in ${signals[0].count} log entries.`);
  }

  if (repeatedMessages[0]) {
    insights.push(`Repeated pattern: "${repeatedMessages[0].sample}" (${repeatedMessages[0].count}x).`);
  } else if (signals.length === 0) {
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
