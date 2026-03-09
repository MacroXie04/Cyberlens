import { socColors, typography } from "../../theme/theme";
import type { GcpSecurityEvent } from "../../types";

const severityColors: Record<string, { text: string; background: string }> = {
  critical: { text: socColors.critical, background: socColors.criticalBg },
  high: { text: socColors.high, background: socColors.highBg },
  medium: { text: socColors.medium, background: socColors.mediumBg },
  low: { text: socColors.low, background: socColors.lowBg },
  info: { text: socColors.info, background: socColors.infoBg },
};

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

const prettifyLabel = (value: string) => value.replace(/_/g, " ");

export default function LiveEvidenceFeedRow({ event, selected, onSelect }: { event: GcpSecurityEvent; selected: boolean; onSelect: () => void }) {
  const palette = severityColors[event.severity] || severityColors.info;
  return (
    <button type="button" onClick={onSelect} style={{ width: "100%", border: "none", background: selected ? socColors.bgCardHover : "transparent", padding: "16px 20px", borderBottom: `1px solid ${socColors.border}`, textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "90px 1fr auto", gap: 14 }}>
      <div>
        <div style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: palette.background, color: palette.text, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{event.severity}</div>
        <div style={{ marginTop: 10, fontSize: 11, color: socColors.textDim, fontFamily: typography.fontMono }}>{formatTime(event.timestamp)}</div>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: socColors.text }}>{prettifyLabel(event.category)}</span>
          <span style={{ borderRadius: 999, padding: "4px 8px", background: socColors.bgPanel, color: socColors.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{prettifyLabel(event.source)}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: socColors.textDim, lineHeight: 1.5 }}>{event.path || event.raw_payload_preview || "Structured event with no request path"}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: socColors.textMuted }}>
          <span>Service {event.service || "n/a"}</span>
          <span>Region {event.region || "global"}</span>
          <span>IP {event.source_ip || "unknown"}</span>
        </div>
      </div>
      <div style={{ minWidth: 96, textAlign: "right" }}>
        {event.status_code != null ? <div style={{ fontSize: 13, fontWeight: 700, color: socColors.text }}>{event.status_code}</div> : null}
        {event.country ? <div style={{ marginTop: 8, fontSize: 12, color: socColors.textDim }}>{event.country}</div> : null}
      </div>
    </button>
  );
}
