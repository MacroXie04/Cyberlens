import type { GcpTimelineMarker } from "../../types";
import { socColors, typography } from "../../theme/theme";

import { formatTooltipLabel, severityColor } from "./threatTimelineUtils";

interface Props {
  markers: GcpTimelineMarker[];
  onSelectTimestamp: (ts: string) => void;
}

export default function ThreatTimelineMarkers({ markers, onSelectTimestamp }: Props) {
  return (
    <div style={{ padding: "0 20px 20px", display: "flex", gap: 10, overflowX: "auto" }}>
      {markers.length === 0 ? (
        <div style={{ borderRadius: 18, background: socColors.bgPanel, padding: "14px 16px", color: socColors.textDim, fontSize: 13 }}>
          No event or incident markers in the selected range
        </div>
      ) : (
        markers.slice(-18).map((marker) => (
          <button
            key={marker.id}
            type="button"
            onClick={() => onSelectTimestamp(marker.ts)}
            style={{
              border: "none",
              minWidth: 170,
              padding: "14px 16px",
              borderRadius: 20,
              background: socColors.bgPanel,
              color: socColors.text,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: severityColor[marker.severity] || socColors.info }} />
              <span style={{ fontSize: 11, color: socColors.textDim, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                {marker.kind}
              </span>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: socColors.text, lineHeight: 1.4 }}>
              {marker.title}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: socColors.textDim, fontFamily: typography.fontMono }}>
              {formatTooltipLabel(marker.ts)}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
