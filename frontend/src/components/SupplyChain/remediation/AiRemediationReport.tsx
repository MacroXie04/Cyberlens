import type { AiReport } from "../../../types";
import { PriorityActions, RemediationSections } from "./AiRemediationSections";

interface Props {
  report: AiReport | null;
}

export default function AiRemediationReport({ report }: Props) {
  if (!report) {
    return (
      <div className="card" style={{ minHeight: 300 }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, color: "var(--md-on-surface)" }}>
          AI Remediation Report
        </h3>
        <div style={{ textAlign: "center", padding: 40, color: "var(--md-on-surface-variant)" }}>
          Run a scan to generate AI remediation report
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ minHeight: 300 }}>
      <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, color: "var(--md-on-surface)" }}>
        AI Remediation Report
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ padding: 16, background: "var(--md-surface-container-high)", borderRadius: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--md-primary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Executive Summary
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{report.executive_summary}</div>
        </div>
        <PriorityActions report={report} />
        {report.remediation_json ? <RemediationSections report={report} /> : null}
      </div>
    </div>
  );
}
