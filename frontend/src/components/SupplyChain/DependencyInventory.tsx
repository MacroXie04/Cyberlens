import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import type { Dependency } from "../../types";

interface Props {
  dependencies: Dependency[];
}

type VulnerabilityFilter = "all" | "vulnerable" | "safe";
type SortKey = "name" | "ecosystem" | "vulns" | "severity";

const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
  "": -1,
};

function highestSeverity(dependency: Dependency): string {
  const severities = (dependency.vulnerabilities || []).map((item) => item.severity || "");
  return severities.sort((left, right) => (severityRank[right] || 0) - (severityRank[left] || 0))[0] || "";
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "var(--md-error)";
    case "high":
      return "#ff7043";
    case "medium":
      return "var(--md-warning)";
    case "low":
      return "var(--md-primary)";
    default:
      return "var(--md-on-surface-variant)";
  }
}

export default function DependencyInventory({ dependencies }: Props) {
  const [search, setSearch] = useState("");
  const [ecosystemFilter, setEcosystemFilter] = useState("all");
  const [vulnerabilityFilter, setVulnerabilityFilter] = useState<VulnerabilityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("vulns");

  const ecosystems = useMemo(
    () => ["all", ...new Set(dependencies.map((dependency) => dependency.ecosystem).filter(Boolean))],
    [dependencies]
  );

  const rows = useMemo(() => {
    const filtered = dependencies.filter((dependency) => {
      const matchesSearch =
        search.trim() === "" ||
        dependency.name.toLowerCase().includes(search.toLowerCase()) ||
        dependency.version.toLowerCase().includes(search.toLowerCase());
      const matchesEcosystem =
        ecosystemFilter === "all" || dependency.ecosystem === ecosystemFilter;
      const matchesVulnerability =
        vulnerabilityFilter === "all" ||
        (vulnerabilityFilter === "vulnerable" ? dependency.is_vulnerable : !dependency.is_vulnerable);

      return matchesSearch && matchesEcosystem && matchesVulnerability;
    });

    return filtered.sort((left, right) => {
      if (sortKey === "name") return left.name.localeCompare(right.name);
      if (sortKey === "ecosystem") return left.ecosystem.localeCompare(right.ecosystem);
      if (sortKey === "severity") {
        return (severityRank[highestSeverity(right)] || 0) - (severityRank[highestSeverity(left)] || 0);
      }
      return (right.vulnerabilities?.length || 0) - (left.vulnerabilities?.length || 0);
    });
  }, [dependencies, ecosystemFilter, search, sortKey, vulnerabilityFilter]);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)", margin: 0 }}>
            Dependencies
          </h3>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            Inventory of detected packages with vulnerability counts and fix availability.
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
          {rows.length.toLocaleString()} / {dependencies.length.toLocaleString()} packages
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1.4fr) repeat(3, minmax(140px, 0.6fr))",
          gap: 10,
        }}
        className="dependency-inventory-filters"
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search package or version"
          style={inputStyle}
        />
        <select value={ecosystemFilter} onChange={(event) => setEcosystemFilter(event.target.value)} style={inputStyle}>
          {ecosystems.map((ecosystem) => (
            <option key={ecosystem} value={ecosystem}>
              {ecosystem === "all" ? "All ecosystems" : ecosystem}
            </option>
          ))}
        </select>
        <select value={vulnerabilityFilter} onChange={(event) => setVulnerabilityFilter(event.target.value as VulnerabilityFilter)} style={inputStyle}>
          <option value="all">All dependencies</option>
          <option value="vulnerable">Vulnerable only</option>
          <option value="safe">Safe only</option>
        </select>
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} style={inputStyle}>
          <option value="vulns">Sort by vulnerability count</option>
          <option value="severity">Sort by highest severity</option>
          <option value="name">Sort by package name</option>
          <option value="ecosystem">Sort by ecosystem</option>
        </select>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--md-outline-variant)" }}>
              {["Package", "Version", "Ecosystem", "Vulnerabilities", "Highest Severity", "Fix Version"].map((label) => (
                <th
                  key={label}
                  style={{
                    padding: "12px 10px",
                    fontSize: 11,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "28px 10px", textAlign: "center", color: "var(--md-on-surface-variant)" }}>
                  No dependencies match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((dependency) => {
                const fixVersion =
                  dependency.vulnerabilities?.find((item) => item.fixed_version)?.fixed_version || "-";
                const severity = highestSeverity(dependency);
                return (
                  <tr key={dependency.id} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 700, color: "var(--md-on-surface)" }}>{dependency.name}</div>
                    </td>
                    <td style={cellStyle}>{dependency.version || "-"}</td>
                    <td style={cellStyle}>{dependency.ecosystem || "-"}</td>
                    <td style={cellStyle}>{(dependency.vulnerabilities?.length || 0).toLocaleString()}</td>
                    <td style={cellStyle}>
                      <span style={{ color: severityColor(severity), fontWeight: 700 }}>
                        {severity || (dependency.is_vulnerable ? "unknown" : "none")}
                      </span>
                    </td>
                    <td style={cellStyle}>{fixVersion}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .dependency-inventory-filters {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const inputStyle: CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--md-outline-variant)",
  background: "var(--md-surface-container)",
  color: "var(--md-on-surface)",
  padding: "0 12px",
  fontSize: 13,
};

const cellStyle: CSSProperties = {
  padding: "14px 10px",
  fontSize: 13,
  color: "var(--md-on-surface-variant)",
  verticalAlign: "top",
};
