import type { Dependency } from "../../../types";

export type VulnerabilityFilter = "all" | "vulnerable" | "safe";
export type SortKey = "name" | "ecosystem" | "vulns" | "severity";

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0, "": -1 };

export function highestSeverity(dependency: Dependency): string {
  return (dependency.vulnerabilities || []).map((item) => item.severity || "").sort((left, right) => (severityRank[right] || 0) - (severityRank[left] || 0))[0] || "";
}

export function severityColor(severity: string): string {
  if (severity === "critical") return "var(--md-error)";
  if (severity === "high") return "#ff7043";
  if (severity === "medium") return "var(--md-warning)";
  if (severity === "low") return "var(--md-primary)";
  return "var(--md-on-surface-variant)";
}

export function buildDependencyRows(dependencies: Dependency[], search: string, ecosystemFilter: string, vulnerabilityFilter: VulnerabilityFilter, sortKey: SortKey) {
  return dependencies.filter((dependency) => {
    const term = search.toLowerCase();
    const matchesSearch = search.trim() === "" || dependency.name.toLowerCase().includes(term) || dependency.version.toLowerCase().includes(term);
    const matchesEcosystem = ecosystemFilter === "all" || dependency.ecosystem === ecosystemFilter;
    const matchesVulnerability = vulnerabilityFilter === "all" || (vulnerabilityFilter === "vulnerable" ? dependency.is_vulnerable : !dependency.is_vulnerable);
    return matchesSearch && matchesEcosystem && matchesVulnerability;
  }).sort((left, right) => {
    if (sortKey === "name") return left.name.localeCompare(right.name);
    if (sortKey === "ecosystem") return left.ecosystem.localeCompare(right.ecosystem);
    if (sortKey === "severity") return (severityRank[highestSeverity(right)] || 0) - (severityRank[highestSeverity(left)] || 0);
    return (right.vulnerabilities?.length || 0) - (left.vulnerabilities?.length || 0);
  });
}
