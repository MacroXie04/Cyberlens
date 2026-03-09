import type { CodeFinding, Dependency, GitHubScan, GitHubScanHistoryItem } from "../types";

export function upsertHistoryItem(previous: GitHubScanHistoryItem[], nextItem: GitHubScanHistoryItem): GitHubScanHistoryItem[] {
  return [...previous.filter((item) => item.id !== nextItem.id), nextItem].sort((left, right) => new Date(right.scanned_at).getTime() - new Date(left.scanned_at).getTime());
}

export function scanToHistoryItem(scan: GitHubScan): GitHubScanHistoryItem {
  return { id: scan.id, repo_name: scan.repo_name, repo_url: scan.repo_url, scan_source: scan.scan_source, scan_mode: scan.scan_mode, scan_status: scan.scan_status, total_deps: scan.total_deps, vulnerable_deps: scan.vulnerable_deps, security_score: scan.security_score, dependency_score: scan.dependency_score, code_security_score: scan.code_security_score, code_findings_count: scan.code_findings_count ?? scan.code_findings?.length ?? 0, code_scan_phase: scan.code_scan_phase, scanned_at: scan.scanned_at, started_at: scan.started_at, completed_at: scan.completed_at ?? null, duration_ms: scan.duration_ms, error_message: scan.error_message };
}

export function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatDuration(durationMs?: number): string {
  if (!durationMs) return "-";
  return durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
}

export function severityCounts(dependencies: Dependency[], findings: CodeFinding[]) {
  const vulnerabilityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const codeCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const dependency of dependencies) for (const vulnerability of dependency.vulnerabilities || []) if (vulnerability.severity in vulnerabilityCounts) vulnerabilityCounts[vulnerability.severity as keyof typeof vulnerabilityCounts] += 1;
  for (const finding of findings) if (finding.severity in codeCounts) codeCounts[finding.severity as keyof typeof codeCounts] += 1;
  return { vulnerabilityCounts, codeCounts };
}

export function statusTone(status: GitHubScanHistoryItem["scan_status"] | GitHubScan["scan_status"] | undefined) {
  if (status === "completed") return { background: "rgba(46, 125, 50, 0.1)", color: "var(--md-safe)", label: "Completed" };
  if (status === "failed") return { background: "rgba(198, 40, 40, 0.1)", color: "var(--md-error)", label: "Failed" };
  if (status === "scanning") return { background: "rgba(2, 119, 189, 0.1)", color: "var(--md-primary)", label: "Scanning" };
  return { background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)", label: "Pending" };
}
