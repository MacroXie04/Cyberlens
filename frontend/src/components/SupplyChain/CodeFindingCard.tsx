import type { CodeFinding } from "../../types";

import CodeFindingSnippet from "./CodeFindingSnippet";
import { categoryLabels, parseSnippetLines, severityColors } from "./codeSecurityFindingUtils";

interface Props {
  expanded: boolean;
  finding: CodeFinding;
  onToggle: () => void;
}

function DetailPanel({ title, body, color, background }: { title: string; body: string; color: string; background: string }) {
  return (
    <div style={{ padding: 12, background, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--md-on-surface)", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

export default function CodeFindingCard({ expanded, finding, onToggle }: Props) {
  const snippetLines = finding.code_snippet ? parseSnippetLines(finding.code_snippet, finding.line_number) : [];

  return (
    <div style={{ background: "var(--md-surface-container-high)", borderRadius: "var(--md-radius-list-item)", borderLeft: `3px solid ${severityColors[finding.severity] || "var(--md-outline)"}`, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "var(--md-on-surface)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: severityColors[finding.severity] || "var(--md-outline)", color: finding.severity === "critical" || finding.severity === "high" ? "#fff" : finding.severity === "medium" ? "var(--md-on-primary)" : "var(--md-on-surface)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {finding.severity}
        </span>
        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, background: "var(--md-surface-container)", color: "var(--md-on-surface-variant)" }}>
          {categoryLabels[finding.category] || finding.category}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{finding.title}</span>
        <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "var(--md-font-mono)" }}>
          {finding.file_path}:{finding.line_number}
        </span>
        <span style={{ fontSize: 12 }}>{expanded ? "\u25BC" : "\u25B6"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>{finding.description}</div>
          <CodeFindingSnippet snippet={finding.code_snippet} lineNumber={finding.line_number} lines={snippetLines} />
          {finding.explanation && <DetailPanel title="Why This Is Vulnerable" body={finding.explanation} color="var(--md-error)" background="rgba(198,40,40,0.06)" />}
          {finding.recommendation && <DetailPanel title="Recommendation" body={finding.recommendation} color="var(--md-safe)" background="rgba(129, 199, 132, 0.1)" />}
        </div>
      )}
    </div>
  );
}
