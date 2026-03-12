import { useMemo, useState } from "react";

import type { CodeFinding } from "../../../types";

import CodeFindingCard from "./CodeFindingCard";
import {
  groupFindingsByFile,
  type SeverityFilter,
  SEVERITY_FILTERS,
  severityOrder,
} from "./codeSecurityFindingUtils";

interface Props {
  findings: CodeFinding[];
}

export default function CodeSecurityFindings({ findings }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [groupByFile, setGroupByFile] = useState(false);

  const sorted = useMemo(() => [...findings].sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)), [findings]);
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const finding of findings) counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    return counts;
  }, [findings]);
  const filtered = useMemo(() => severityFilter === "all" ? sorted : sorted.filter((finding) => finding.severity === severityFilter), [severityFilter, sorted]);
  const grouped = useMemo(() => groupByFile ? groupFindingsByFile(filtered) : null, [filtered, groupByFile]);

  const toggle = (id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", margin: 0 }}>Code Security Findings</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {filtered.length > 0 && (
            <>
              <button onClick={() => setExpanded(new Set(filtered.map((finding) => finding.id)))} style={actionStyle}>Expand All</button>
              <button onClick={() => setExpanded(new Set())} style={actionStyle}>Collapse All</button>
            </>
          )}
          <button onClick={() => setGroupByFile((value) => !value)} style={{ ...actionStyle, background: groupByFile ? "var(--md-primary)" : "var(--md-surface-container-high)", color: groupByFile ? "var(--md-on-primary)" : "var(--md-on-surface-variant)" }}>
            Group by File
          </button>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>
            {findings.length} total
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {SEVERITY_FILTERS.map((severity) => {
          const count = severity === "all" ? findings.length : (severityCounts[severity] || 0);
          const active = severityFilter === severity;
          return (
            <button key={severity} onClick={() => setSeverityFilter(severity)} style={{ ...filterStyle, background: active ? "var(--md-primary)" : "var(--md-surface-container-high)", color: active ? "var(--md-on-primary)" : "var(--md-on-surface-variant)", fontWeight: active ? 600 : 400 }}>
              <span style={{ textTransform: "capitalize" }}>{severity}</span>
              <span style={{ fontSize: 10, padding: "0 4px", borderRadius: 6, background: active ? "rgba(255,255,255,0.2)" : "var(--md-surface-container)" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--md-on-surface-variant)", fontSize: 14 }}>
          {findings.length === 0 ? "No code security issues found" : "No findings match the selected filter"}
        </div>
      ) : grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from(grouped.entries()).map(([filePath, fileFindings]) => (
            <div key={filePath}>
              <div style={{ fontSize: 12, fontFamily: "var(--md-font-mono)", color: "var(--md-on-surface-variant)", padding: "6px 0", borderBottom: "1px solid var(--md-surface-container-highest)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>{filePath}</span>
                <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 6, background: "var(--md-surface-container-high)" }}>
                  {fileFindings.length} {fileFindings.length === 1 ? "finding" : "findings"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fileFindings.map((finding) => <CodeFindingCard key={finding.id} finding={finding} expanded={expanded.has(finding.id)} onToggle={() => toggle(finding.id)} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((finding) => <CodeFindingCard key={finding.id} finding={finding} expanded={expanded.has(finding.id)} onToggle={() => toggle(finding.id)} />)}
        </div>
      )}
    </div>
  );
}

const actionStyle = {
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: 6,
  background: "var(--md-surface-container-high)",
  color: "var(--md-on-surface-variant)",
  border: "none",
  cursor: "pointer",
} as const;

const filterStyle = {
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 4,
} as const;
