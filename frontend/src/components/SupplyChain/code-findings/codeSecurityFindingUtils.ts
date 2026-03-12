import type { CodeFinding } from "../../../types";

export const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export const severityColors: Record<string, string> = {
  critical: "var(--md-error)",
  high: "var(--md-warning)",
  medium: "var(--md-primary)",
  low: "var(--md-on-surface-variant)",
  info: "var(--md-outline)",
};

export const categoryLabels: Record<string, string> = {
  sql_injection: "SQL Injection",
  xss: "XSS",
  hardcoded_secret: "Hardcoded Secret",
  path_traversal: "Path Traversal",
  command_injection: "Command Injection",
  insecure_crypto: "Insecure Crypto",
  insecure_deserialization: "Insecure Deserialization",
  ssrf: "SSRF",
  broken_auth: "Broken Auth",
  sensitive_data: "Sensitive Data",
  missing_validation: "Missing Validation",
  insecure_file_ops: "Insecure File Ops",
  other: "Other",
};

export type SeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_FILTERS: SeverityFilter[] = ["all", "critical", "high", "medium", "low", "info"];

function hasEmbeddedLineNumbers(snippet: string): boolean {
  const lines = snippet.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return false;
  const numbered = lines.filter((line) => /^\s*\d+\s*[|:]/.test(line));
  return numbered.length >= lines.length * 0.6;
}

export function parseSnippetLines(snippet: string, baseLineNumber: number) {
  const raw = snippet.split("\n");
  if (hasEmbeddedLineNumbers(snippet)) {
    return raw.map((line) => {
      const match = line.match(/^\s*(\d+)\s*[|:]\s?(.*)/);
      if (match) {
        return { lineNum: parseInt(match[1], 10), text: match[2] };
      }
      return { lineNum: 0, text: line };
    });
  }
  const start = baseLineNumber > 0 ? baseLineNumber : 1;
  return raw.map((line, index) => ({ lineNum: start + index, text: line }));
}

export function groupFindingsByFile(findings: CodeFinding[]) {
  const grouped = new Map<string, CodeFinding[]>();
  for (const finding of findings) {
    const items = grouped.get(finding.file_path) || [];
    items.push(finding);
    grouped.set(finding.file_path, items);
  }
  return grouped;
}
