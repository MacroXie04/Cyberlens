import type { AdkTraceEvent } from "../types";

import { isRecord, readString } from "../lib/pipelineShared";
import { InspectorSection } from "./PipelineUi";

interface Props {
  event: AdkTraceEvent;
  payload: Record<string, unknown> | null;
}

export default function EvidenceInspector({ event, payload }: Props) {
  if (!payload || event.phase !== "evidence_expansion") {
    return null;
  }

  const members = Array.isArray(payload.members) ? payload.members : [];
  if (members.length === 0) return null;

  return (
    <InspectorSection title="Evidence Pack">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {members.map((member, index) => {
          const record = isRecord(member) ? member : null;
          const filePath = readString(record, "file_path");
          const lineRange = Array.isArray(record?.line_range) ? record?.line_range.map((item) => String(item)).join("-") : "-";
          const summary = readString(record, "summary");
          const snippetPreview = readString(record, "snippet_preview");
          const signals = Array.isArray(record?.security_signals) ? record?.security_signals.map((item) => String(item)) : [];

          return (
            <div key={`${filePath}-${lineRange}-${index}`} style={{ padding: 12, borderRadius: 10, background: "var(--md-surface-container)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>{filePath}:{lineRange}</div>
              {signals.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{signals.map((signal) => <span key={signal} style={{ padding: "4px 8px", borderRadius: 999, background: "var(--md-surface-container-high)", fontSize: 11, color: "var(--md-primary)" }}>{signal}</span>)}</div>}
              {summary && <div style={{ marginTop: 8, fontSize: 12, color: "var(--md-on-surface)", lineHeight: 1.6 }}>{summary}</div>}
              {snippetPreview && <pre style={{ margin: "10px 0 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--md-font-mono)", fontSize: 12, lineHeight: 1.55, color: "var(--md-on-surface-variant)" }}>{snippetPreview}</pre>}
            </div>
          );
        })}
      </div>
    </InspectorSection>
  );
}
