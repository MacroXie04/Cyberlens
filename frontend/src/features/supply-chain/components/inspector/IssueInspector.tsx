import type { AdkTraceEvent } from "../../types";

import { readNumber, readString, readStringArray } from "../../lib/pipelineShared";
import { InspectorSection } from "../PipelineUi";

interface Props {
  event: AdkTraceEvent;
  payload: Record<string, unknown> | null;
}

export default function IssueInspector({ event, payload }: Props) {
  if (!payload || event.phase !== "verification") {
    return null;
  }

  const metaItems = [
    ["Decision", readString(payload, "decision") || "-"],
    ["Title", readString(payload, "title") || "-"],
    ["File", readString(payload, "file_path") || "-"],
    ["Line", readNumber(payload, "line_number") != null && (readNumber(payload, "line_number") ?? 0) > 0 ? String(readNumber(payload, "line_number")) : "-"],
    ["Category", readString(payload, "category") || "-"],
    ["Severity", readString(payload, "severity") || "-"],
    ["Finding Ref", readNumber(payload, "finding_ref") != null ? String(readNumber(payload, "finding_ref")) : "-"],
  ];
  const reason = readString(payload, "reason");
  const description = readString(payload, "description");
  const codeSnippet = readString(payload, "code_snippet");
  const recommendation = readString(payload, "recommendation");
  const evidenceRefs = readStringArray(payload, "evidence_refs");

  return (
    <>
      <InspectorSection title="Issue Details">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {metaItems.map(([label, value]) => (
            <div key={label} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--md-surface-container)" }}>
              <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)", wordBreak: "break-word" }}>{value}</div>
            </div>
          ))}
        </div>
      </InspectorSection>

      {(reason || description) && (
        <InspectorSection title="Why It Matters">
          <div style={{ fontSize: 12, color: "var(--md-on-surface)", lineHeight: 1.6 }}>{reason || description}</div>
          {reason && description && description !== reason && <div style={{ marginTop: 10, fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>{description}</div>}
        </InspectorSection>
      )}

      {codeSnippet && <InspectorSection title="Code Snippet"><pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--md-font-mono)", fontSize: 12, lineHeight: 1.55 }}>{codeSnippet}</pre></InspectorSection>}
      {recommendation && <InspectorSection title="Recommended Fix"><div style={{ fontSize: 12, color: "var(--md-on-surface)", lineHeight: 1.6 }}>{recommendation}</div></InspectorSection>}
      {evidenceRefs.length > 0 && <InspectorSection title="Evidence Refs"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{evidenceRefs.map((ref) => <span key={ref} style={{ padding: "6px 10px", borderRadius: 999, background: "var(--md-surface-container)", fontSize: 11, fontFamily: "var(--md-font-mono)", color: "var(--md-on-surface)" }}>{ref}</span>)}</div></InspectorSection>}
    </>
  );
}
