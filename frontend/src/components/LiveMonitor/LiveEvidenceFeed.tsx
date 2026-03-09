import type { GcpSecurityEvent, LiveMonitorMode } from "../../types";
import { socColors } from "../../theme/theme";
import LiveEvidenceFeedRow from "./LiveEvidenceFeedRow";

interface Props {
  events: GcpSecurityEvent[];
  mode: LiveMonitorMode;
  replayWindowLabel: string;
  onSelectEvent: (event: GcpSecurityEvent) => void;
  selectedEventId: number | null;
}

export default function LiveEvidenceFeed({
  events,
  mode,
  replayWindowLabel,
  onSelectEvent,
  selectedEventId,
}: Props) {
  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 32,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 360,
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
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: socColors.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {mode === "live" ? "Live Evidence Feed" : "Evidence Feed"}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
            {mode === "live"
              ? "Streaming and recent parsed security evidence"
              : `Security evidence captured in ${replayWindowLabel}`}
          </div>
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            background: socColors.bgPanel,
            fontSize: 12,
            color: socColors.textDim,
          }}
        >
          {events.length} events
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div
            style={{
              height: "100%",
              minHeight: 240,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              color: socColors.textDim,
              fontSize: 14,
            }}
          >
            No events in the selected replay window
          </div>
        ) : (
          events.map((event) => (
            <LiveEvidenceFeedRow
              key={event.id}
              event={event}
              selected={selectedEventId === event.id}
              onSelect={() => onSelectEvent(event)}
            />
          ))
        )}
      </div>
    </div>
  );
}
