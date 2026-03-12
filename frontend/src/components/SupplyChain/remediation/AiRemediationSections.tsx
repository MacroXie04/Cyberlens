import type { AiReport } from "../../../types";

export function PriorityActions({ report }: { report: AiReport }) {
  if (report.priority_ranking.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--md-primary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
        Priority Actions
      </div>
      {report.priority_ranking.map((item, index) => (
        <div key={index} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 12, background: "var(--md-surface-container-high)", borderRadius: 12, marginBottom: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--md-primary)", color: "var(--md-on-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{index + 1}</span>
          <div>
            <div className="mono" style={{ fontWeight: 500 }}>{item.package} <span style={{ color: "var(--md-on-surface-variant)" }}>{item.cve}</span></div>
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginTop: 2 }}>{item.action}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RemediationSections({ report }: { report: AiReport }) {
  const sections = [
    { key: "immediate", color: "var(--md-error)", label: "Immediate" },
    { key: "short_term", color: "var(--md-warning)", label: "Short Term" },
    { key: "long_term", color: "var(--md-safe)", label: "Long Term" },
  ] as const;
  return (
    <div>
      {sections.map((section) => {
        const steps = report.remediation_json?.[section.key];
        if (!steps?.length) return null;
        return (
          <div key={section.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: section.color, marginBottom: 4 }}>{section.label}</div>
            <ul style={{ paddingLeft: 20, fontSize: 13 }}>
              {steps.map((step, index) => <li key={index} style={{ marginBottom: 4 }}>{step}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
