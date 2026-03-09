import type { AdkTraceEvent } from "../types";

import { prettyPrintPayload } from "../lib/pipelineShared";
import { InspectorSection } from "./PipelineUi";
import EvidenceInspector from "./EvidenceInspector";
import InspectorMeta from "./InspectorMeta";
import IssueInspector from "./IssueInspector";

interface Props {
  event: AdkTraceEvent | null;
  payload: Record<string, unknown> | null;
}

export default function PipelineInspector({ event, payload }: Props) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>Inspector</div>
        {event && <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>Sequence #{event.sequence}</div>}
      </div>

      {!event ? (
        <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>Select an event to inspect its details.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <InspectorMeta event={event} />
          <IssueInspector event={event} payload={payload} />
          <EvidenceInspector event={event} payload={payload} />
          {event.text_preview && <InspectorSection title="Text Preview"><pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--md-font-mono)", fontSize: 12, lineHeight: 1.55 }}>{event.text_preview}</pre></InspectorSection>}
          <InspectorSection title="Payload JSON"><pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--md-font-mono)", fontSize: 12, lineHeight: 1.55 }}>{prettyPrintPayload(event.payload_json)}</pre></InspectorSection>
        </div>
      )}
    </div>
  );
}
