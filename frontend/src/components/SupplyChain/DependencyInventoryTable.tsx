import type { CSSProperties } from "react";

import type { Dependency } from "../../types";
import { highestSeverity, severityColor } from "./dependencyInventoryUtils";

const cellStyle: CSSProperties = { padding: "14px 10px", fontSize: 13, color: "var(--md-on-surface-variant)", verticalAlign: "top" };

export default function DependencyInventoryTable({ rows }: { rows: Dependency[] }) {
  return (
    <div style={{ marginTop: 16, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--md-outline-variant)" }}>
            {["Package", "Version", "Ecosystem", "Vulnerabilities", "Highest Severity", "Fix Version"].map((label) => <th key={label} style={{ padding: "12px 10px", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--md-on-surface-variant)" }}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: "28px 10px", textAlign: "center", color: "var(--md-on-surface-variant)" }}>No dependencies match the current filters.</td></tr>
          ) : rows.map((dependency) => {
            const severity = highestSeverity(dependency);
            const fixVersion = dependency.vulnerabilities?.find((item) => item.fixed_version)?.fixed_version || "-";
            return (
              <tr key={dependency.id} style={{ borderBottom: "1px solid var(--md-outline-variant)" }}>
                <td style={cellStyle}><div style={{ fontWeight: 700, color: "var(--md-on-surface)" }}>{dependency.name}</div></td>
                <td style={cellStyle}>{dependency.version || "-"}</td>
                <td style={cellStyle}>{dependency.ecosystem || "-"}</td>
                <td style={cellStyle}>{(dependency.vulnerabilities?.length || 0).toLocaleString()}</td>
                <td style={cellStyle}><span style={{ color: severityColor(severity), fontWeight: 700 }}>{severity || (dependency.is_vulnerable ? "unknown" : "none")}</span></td>
                <td style={cellStyle}>{fixVersion}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
