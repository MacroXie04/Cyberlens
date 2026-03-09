export type SignalTone = "critical" | "warn" | "info";
export type AnalysisTone = SignalTone | "healthy";

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

export const ERROR_SEVERITIES = new Set(["ERROR", "CRITICAL", "ALERT", "EMERGENCY"]);
export const WARNING_SEVERITIES = new Set(["WARNING"]);

export const SIGNAL_RULES: SignalRule[] = [
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
