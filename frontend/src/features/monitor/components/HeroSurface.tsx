import type { GcpHistoryStatus, GcpTimelineResponse, LiveMonitorMode } from "../types";
import { socColors, typography } from "../../../theme/theme";

import { formatTimestamp } from "../lib/timeWindow";

interface Props {
  mode: LiveMonitorMode;
  projectId: string;
  historyStatus: GcpHistoryStatus | null;
  replayCursor: string | null;
  replayWindowLabel: string;
  timeline: GcpTimelineResponse | null;
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.74)", border: `1px solid ${socColors.border}`, borderRadius: 24, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: socColors.textDim, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 14, color: socColors.text, fontWeight: 700, lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

export default function HeroSurface({ mode, projectId, historyStatus, replayCursor, replayWindowLabel, timeline }: Props) {
  const pointsCount = timeline?.points.length ?? 0;
  const markersCount = timeline?.markers.length ?? 0;

  return (
    <div className="live-monitor-hero" style={{ borderRadius: 36, padding: 24, background: "radial-gradient(circle at top left, rgba(232,240,254,0.95) 0%, rgba(255,255,255,0.92) 38%), linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(244,247,252,0.98) 100%)", border: `1px solid ${socColors.border}`, boxShadow: socColors.shadow, display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 0.8fr)", gap: 18 }}>
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, background: socColors.accentSoft, color: socColors.accent, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{mode === "history" ? "Historical posture" : "Live watch"}</div>
        <div style={{ marginTop: 14, fontFamily: typography.fontDisplay, fontSize: 28, lineHeight: 1.2, fontWeight: 700, color: socColors.text }}>{mode === "history" ? "Defaulting to the last 30 days with full-page replay controls." : "Focused on the most recent 15 minutes with live updates enabled."}</div>
        <div style={{ marginTop: 10, fontSize: 14, color: socColors.textMuted, lineHeight: 1.7, maxWidth: 780 }}>{projectId || "No project configured"} · {replayWindowLabel} · Coverage {formatTimestamp(historyStatus?.coverage_start ?? null)} to {formatTimestamp(historyStatus?.coverage_end ?? null)}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <HeroStat label="Replay Cursor" value={formatTimestamp(replayCursor)} />
        <HeroStat label="Backfill State" value={historyStatus?.backfill_status?.status || (historyStatus?.history_ready ? "complete" : "idle")} />
        <HeroStat label="Timeline Buckets" value={String(pointsCount)} />
        <HeroStat label="Markers" value={String(markersCount)} />
      </div>
    </div>
  );
}
