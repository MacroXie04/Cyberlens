import { typography } from "../../theme/theme";

import { controlGroupStyle, formatCursorLabel, iconButtonStyle, sliderValue, SPEED_OPTIONS } from "./commandBarUtils";

interface Props {
  replayCursor: string | null;
  timelineStart: string | null;
  timelineEnd: string | null;
  playbackSpeed: number;
  isPlaying: boolean;
  onReplayCursorChange: (value: string) => void;
  onTogglePlayback: () => void;
  onPlaybackSpeedChange: (value: number) => void;
  onJumpStart: () => void;
  onJumpNow: () => void;
}

export default function ReplayControls({
  replayCursor,
  timelineStart,
  timelineEnd,
  playbackSpeed,
  isPlaying,
  onReplayCursorChange,
  onTogglePlayback,
  onPlaybackSpeedChange,
  onJumpStart,
  onJumpNow,
}: Props) {
  const scrubber = sliderValue(replayCursor, timelineStart, timelineEnd);

  return (
    <div style={{ ...controlGroupStyle, flex: "1 1 340px", minWidth: 280 }}>
      <button type="button" onClick={onJumpStart} disabled={scrubber.disabled} style={iconButtonStyle(scrubber.disabled)} aria-label="Jump to range start">
        Start
      </button>
      <button type="button" onClick={onTogglePlayback} disabled={scrubber.disabled} style={iconButtonStyle(scrubber.disabled)} aria-label={isPlaying ? "Pause replay" : "Play replay"}>
        {isPlaying ? "Pause" : "Play"}
      </button>
      <button type="button" onClick={onJumpNow} disabled={scrubber.disabled} style={iconButtonStyle(scrubber.disabled)} aria-label="Jump to most recent timestamp">
        Now
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => onPlaybackSpeedChange(speed)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "6px 8px",
              background: playbackSpeed === speed ? "var(--md-accent-soft, rgba(11,87,208,0.12))" : "transparent",
              color: playbackSpeed === speed ? "var(--md-accent, #0b57d0)" : "var(--soc-text-muted, #64748b)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {speed}x
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 160 }}>
        <input
          aria-label="Replay cursor"
          type="range"
          min={scrubber.min}
          max={scrubber.max}
          step={scrubber.step}
          value={scrubber.value}
          disabled={scrubber.disabled}
          onChange={(event) => onReplayCursorChange(new Date(Number(event.target.value)).toISOString())}
          style={{ width: "100%", accentColor: "var(--md-accent, #0b57d0)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, gap: 12, fontSize: 11, color: "var(--soc-text-dim, #64748b)", fontFamily: typography.fontMono }}>
          <span>{timelineStart ? formatCursorLabel(timelineStart) : "No range"}</span>
          <span>{formatCursorLabel(replayCursor)}</span>
          <span>{timelineEnd ? formatCursorLabel(timelineEnd) : "No range"}</span>
        </div>
      </div>
    </div>
  );
}
