import type { GcpSecurityEvent } from "../../types";
import { socColors } from "../../theme/theme";

import { MetaItem, SectionLabel } from "./triageDrawerShared";

interface Props {
  selectedEvent: GcpSecurityEvent;
}

export default function TriageEventView({ selectedEvent }: Props) {
  return (
    <>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: socColors.text }}>
        {selectedEvent.category.replace(/_/g, " ")}
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontSize: 12 }}>
        <MetaItem label="Source" value={selectedEvent.source} />
        <MetaItem label="Severity" value={selectedEvent.severity} />
        <MetaItem label="Service" value={selectedEvent.service || "—"} />
        <MetaItem label="Region" value={selectedEvent.region || "—"} />
        <MetaItem label="IP" value={selectedEvent.source_ip || "—"} />
        <MetaItem label="Country" value={selectedEvent.country || "—"} />
        <MetaItem label="Method" value={selectedEvent.method || "—"} />
        <MetaItem label="Status" value={selectedEvent.status_code?.toString() || "—"} />
      </div>

      {selectedEvent.path && (
        <>
          <SectionLabel>Path</SectionLabel>
          <div style={{ background: socColors.bgCard, padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 12, fontFamily: "'Noto Sans Mono', monospace", color: socColors.text, wordBreak: "break-all" }}>
            {selectedEvent.path}
          </div>
        </>
      )}

      {selectedEvent.raw_payload_preview && (
        <>
          <SectionLabel>Raw Log Preview</SectionLabel>
          <div style={{ background: socColors.bgCard, padding: 10, borderRadius: 6, fontSize: 11, fontFamily: "'Noto Sans Mono', monospace", color: socColors.textMuted, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflowY: "auto" }}>
            {selectedEvent.raw_payload_preview}
          </div>
        </>
      )}
    </>
  );
}
