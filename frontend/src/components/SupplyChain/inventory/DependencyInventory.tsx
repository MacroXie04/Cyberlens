import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import type { Dependency } from "../../../types";
import DependencyInventoryTable from "./DependencyInventoryTable";
import { buildDependencyRows, type SortKey, type VulnerabilityFilter } from "./dependencyInventoryUtils";

interface Props {
  dependencies: Dependency[];
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
    return buildDependencyRows(dependencies, search, ecosystemFilter, vulnerabilityFilter, sortKey);
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

      <DependencyInventoryTable rows={rows} />

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
