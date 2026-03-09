import type { GcpHistoryStatus, LiveMonitorMode } from "../../types";
import { socColors, typography } from "../../theme/theme";

import { backfillLabel, formatCoverage } from "./commandBarUtils";

interface Props {
  historyStatus: GcpHistoryStatus | null;
  lastSync: string | null;
  mode: LiveMonitorMode;
  projectId: string;
  refreshing?: boolean;
  socketConnected: boolean;
  onModeChange: (mode: LiveMonitorMode) => void;
  onRefresh: () => void;
}

function StatusChip({ label, tone }: { label: string; tone: "critical" | "safe" | "info" | "accent" }) {
  const colorMap = {
    critical: socColors.critical,
    safe: socColors.safe,
    info: socColors.textMuted,
    accent: socColors.accent,
  };
  const backgroundMap = {
    critical: socColors.criticalBg,
    safe: socColors.safeBg,
    info: socColors.infoBg,
    accent: socColors.accentSoft,
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 999, background: backgroundMap[tone], color: colorMap[tone], fontSize: 12, fontWeight: 700 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorMap[tone] }} />
      {label}
    </span>
  );
}

export default function CommandBarHeader({
  historyStatus,
  lastSync,
  mode,
  projectId,
  refreshing,
  socketConnected,
  onModeChange,
  onRefresh,
}: Props) {
  const statusLabel =
    mode === "live"
      ? socketConnected
        ? "Live stream connected"
        : "Live stream reconnecting"
      : backfillLabel(historyStatus);
  const tone =
    mode === "live"
      ? socketConnected
        ? "safe"
        : "critical"
      : historyStatus?.backfill_status?.status === "failed"
        ? "critical"
        : historyStatus?.backfill_status?.status === "running"
          ? "accent"
          : "info";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: typography.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: "0.02em", color: socColors.text }}>
            Live Monitor
          </div>
          <div style={{ fontSize: 13, color: socColors.textMuted, marginTop: 2 }}>
            {projectId || "No project selected"} · Coverage {formatCoverage(historyStatus?.coverage_start ?? null)} to {formatCoverage(historyStatus?.coverage_end ?? null)}
          </div>
        </div>

        <div style={{ display: "inline-flex", padding: 4, borderRadius: 999, background: socColors.bgPanel, border: `1px solid ${socColors.border}` }}>
          {(["history", "live"] as const).map((candidate) => {
            const selected = mode === candidate;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => onModeChange(candidate)}
                style={{
                  border: "none",
                  background: selected ? socColors.bgCard : "transparent",
                  color: selected ? socColors.accent : socColors.textMuted,
                  padding: "10px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: selected ? "0 2px 10px rgba(11, 87, 208, 0.12)" : "none",
                  textTransform: "capitalize",
                }}
              >
                {candidate}
              </button>
            );
          })}
        </div>

        <StatusChip label={statusLabel} tone={tone} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {lastSync && <span style={{ fontSize: 12, color: socColors.textDim }}>Synced {lastSync}</span>}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "11px 18px",
            background: socColors.accent,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1,
            boxShadow: "0 10px 24px rgba(11, 87, 208, 0.18)",
          }}
          aria-label="Refresh Live Monitor"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
