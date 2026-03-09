import type { GcpTimelineMarker, GcpTimelinePoint } from "../../types";
import { socColors } from "../../theme/theme";

import ThreatTimelineChart from "./ThreatTimelineChart";
import ThreatTimelineMarkers from "./ThreatTimelineMarkers";

interface Props {
  points: GcpTimelinePoint[];
  markers: GcpTimelineMarker[];
  cursor: string | null;
  loading?: boolean;
  emptyState: string;
  onSelectTimestamp: (ts: string) => void;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span>{label}</span>
    </span>
  );
}

export default function GlobalThreatTimeline({
  points,
  markers,
  cursor,
  loading,
  emptyState,
  onSelectTimestamp,
}: Props) {
  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 32,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${socColors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: socColors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Global Threat Timeline
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
            Request pressure, error volume, and incident markers across the selected range
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 14px", background: socColors.bgPanel, borderRadius: 999, fontSize: 12, color: socColors.textDim }}>
          <LegendDot color={socColors.accent} label="Requests" />
          <LegendDot color={socColors.critical} label="Errors" />
          <LegendDot color={socColors.medium} label="Incidents" />
        </div>
      </div>

      <div style={{ padding: "18px 20px 8px", height: 340 }}>
        <ThreatTimelineChart points={points} cursor={cursor} loading={loading} emptyState={emptyState} />
      </div>

      <ThreatTimelineMarkers markers={markers} onSelectTimestamp={onSelectTimestamp} />
    </div>
  );
}
