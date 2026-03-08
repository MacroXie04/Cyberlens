import type { CSSProperties } from "react";

import type { GcpHistoryStatus, LiveMonitorMode } from "../../types";
import { socColors, typography } from "../../theme/theme";

interface Props {
  projectId: string;
  mode: LiveMonitorMode;
  historyStatus: GcpHistoryStatus | null;
  selectedRegion: string;
  regions: string[];
  selectedService: string;
  services: string[];
  selectedSource: string;
  selectedSeverity: string;
  timeRange: number;
  socketConnected: boolean;
  lastSync: string | null;
  refreshing?: boolean;
  replayCursor: string | null;
  timelineStart: string | null;
  timelineEnd: string | null;
  playbackSpeed: number;
  isPlaying: boolean;
  onModeChange: (mode: LiveMonitorMode) => void;
  onRegionChange: (value: string) => void;
  onServiceChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onTimeRangeChange: (value: number) => void;
  onRefresh: () => void;
  onReplayCursorChange: (value: string) => void;
  onTogglePlayback: () => void;
  onPlaybackSpeedChange: (value: number) => void;
  onJumpStart: () => void;
  onJumpNow: () => void;
}

const TIME_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
  { label: "7d", value: 10080 },
  { label: "30d", value: 43200 },
];

const SOURCE_OPTIONS = [
  { label: "All Sources", value: "" },
  { label: "Cloud Run", value: "cloud_run_logs" },
  { label: "Cloud Monitoring", value: "cloud_monitoring" },
  { label: "Load Balancer", value: "load_balancer" },
  { label: "Cloud Armor", value: "cloud_armor" },
  { label: "IAM Audit", value: "iam_audit" },
  { label: "IAP", value: "iap" },
];

const SEVERITY_OPTIONS = [
  { label: "All Severities", value: "" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
  { label: "Info", value: "info" },
];

const SPEED_OPTIONS = [1, 4, 16];

const selectStyle: CSSProperties = {
  minWidth: 132,
  background: socColors.bgCard,
  color: socColors.text,
  border: `1px solid ${socColors.border}`,
  borderRadius: 16,
  padding: "10px 14px",
  fontSize: 13,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
};

const controlGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 20,
  background: socColors.bgCard,
  border: `1px solid ${socColors.border}`,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

function formatCoverage(value: string | null): string {
  if (!value) return "No coverage";
  try {
    return new Date(value).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function formatCursorLabel(value: string | null): string {
  if (!value) return "Cursor unavailable";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function backfillLabel(historyStatus: GcpHistoryStatus | null): string {
  const status = historyStatus?.backfill_status?.status;
  if (status === "running") return "Backfill running";
  if (status === "failed") return "Backfill failed";
  if (status === "complete") return "History ready";
  if (historyStatus?.history_ready) return "History ready";
  return "Waiting for history";
}

function sliderValue(
  replayCursor: string | null,
  timelineStart: string | null,
  timelineEnd: string | null
): { min: number; max: number; value: number; step: number; disabled: boolean } {
  if (!timelineStart || !timelineEnd) {
    return { min: 0, max: 100, value: 100, step: 1, disabled: true };
  }
  const min = new Date(timelineStart).getTime();
  const max = new Date(timelineEnd).getTime();
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { min: 0, max: 100, value: 100, step: 1, disabled: true };
  }
  const rawValue = replayCursor ? new Date(replayCursor).getTime() : max;
  const value = Math.max(min, Math.min(max, rawValue));
  return {
    min,
    max,
    value,
    step: Math.max(1, Math.floor((max - min) / 240)),
    disabled: false,
  };
}

export default function CommandBar({
  projectId,
  mode,
  historyStatus,
  selectedRegion,
  regions,
  selectedService,
  services,
  selectedSource,
  selectedSeverity,
  timeRange,
  socketConnected,
  lastSync,
  refreshing,
  replayCursor,
  timelineStart,
  timelineEnd,
  playbackSpeed,
  isPlaying,
  onModeChange,
  onRegionChange,
  onServiceChange,
  onSourceChange,
  onSeverityChange,
  onTimeRangeChange,
  onRefresh,
  onReplayCursorChange,
  onTogglePlayback,
  onPlaybackSpeedChange,
  onJumpStart,
  onJumpNow,
}: Props) {
  const scrubber = sliderValue(replayCursor, timelineStart, timelineEnd);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        padding: "20px 20px 14px",
        background:
          "linear-gradient(180deg, rgba(247,249,252,0.98) 0%, rgba(247,249,252,0.94) 70%, rgba(247,249,252,0.84) 100%)",
        backdropFilter: "blur(18px)",
        borderBottom: `1px solid ${socColors.border}`,
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(244,247,252,0.98) 100%)",
          border: `1px solid ${socColors.border}`,
          borderRadius: 32,
          padding: 18,
          boxShadow: socColors.shadow,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div
                style={{
                  fontFamily: typography.fontDisplay,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  color: socColors.text,
                }}
              >
                Live Monitor
              </div>
              <div style={{ fontSize: 13, color: socColors.textMuted, marginTop: 2 }}>
                {projectId || "No project selected"} · Coverage {formatCoverage(historyStatus?.coverage_start ?? null)} to{" "}
                {formatCoverage(historyStatus?.coverage_end ?? null)}
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                padding: 4,
                borderRadius: 999,
                background: socColors.bgPanel,
                border: `1px solid ${socColors.border}`,
              }}
            >
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

            <StatusChip
              label={mode === "live" ? (socketConnected ? "Live stream connected" : "Live stream reconnecting") : backfillLabel(historyStatus)}
              tone={mode === "live" ? (socketConnected ? "safe" : "critical") : historyStatus?.backfill_status?.status === "failed" ? "critical" : historyStatus?.backfill_status?.status === "running" ? "accent" : "info"}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {lastSync && (
              <span style={{ fontSize: 12, color: socColors.textDim }}>
                Synced {lastSync}
              </span>
            )}
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <select
            aria-label="Region filter"
            value={selectedRegion}
            onChange={(event) => onRegionChange(event.target.value)}
            style={selectStyle}
          >
            <option value="">All Regions</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <select
            aria-label="Service filter"
            value={selectedService}
            onChange={(event) => onServiceChange(event.target.value)}
            style={selectStyle}
          >
            <option value="">All Services</option>
            {services.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>

          <select
            aria-label="Source filter"
            value={selectedSource}
            onChange={(event) => onSourceChange(event.target.value)}
            style={selectStyle}
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Severity filter"
            value={selectedSeverity}
            onChange={(event) => onSeverityChange(event.target.value)}
            style={selectStyle}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div style={controlGroupStyle}>
            {TIME_OPTIONS.map((option) => {
              const selected = timeRange === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onTimeRangeChange(option.value)}
                  style={{
                    border: "none",
                    background: selected ? socColors.accentSoft : "transparent",
                    color: selected ? socColors.accent : socColors.textMuted,
                    borderRadius: 999,
                    padding: "8px 10px",
                    fontSize: 12,
                    fontWeight: selected ? 700 : 600,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              ...controlGroupStyle,
              flex: "1 1 340px",
              minWidth: 280,
            }}
          >
            <button
              type="button"
              onClick={onJumpStart}
              disabled={scrubber.disabled}
              style={iconButtonStyle(scrubber.disabled)}
              aria-label="Jump to range start"
            >
              Start
            </button>
            <button
              type="button"
              onClick={onTogglePlayback}
              disabled={scrubber.disabled}
              style={iconButtonStyle(scrubber.disabled)}
              aria-label={isPlaying ? "Pause replay" : "Play replay"}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={onJumpNow}
              disabled={scrubber.disabled}
              style={iconButtonStyle(scrubber.disabled)}
              aria-label="Jump to most recent timestamp"
            >
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
                    background:
                      playbackSpeed === speed ? socColors.accentSoft : "transparent",
                    color:
                      playbackSpeed === speed ? socColors.accent : socColors.textMuted,
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
                onChange={(event) =>
                  onReplayCursorChange(new Date(Number(event.target.value)).toISOString())
                }
                style={{ width: "100%", accentColor: socColors.accent }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                  gap: 12,
                  fontSize: 11,
                  color: socColors.textDim,
                  fontFamily: typography.fontMono,
                }}
              >
                <span>{timelineStart ? formatCursorLabel(timelineStart) : "No range"}</span>
                <span>{formatCursorLabel(replayCursor)}</span>
                <span>{timelineEnd ? formatCursorLabel(timelineEnd) : "No range"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function iconButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 999,
    padding: "8px 12px",
    background: disabled ? socColors.bgPanel : socColors.accentSoft,
    color: disabled ? socColors.textDim : socColors.accent,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "critical" | "safe" | "info" | "accent";
}) {
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
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 999,
        background: backgroundMap[tone],
        color: colorMap[tone],
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: colorMap[tone],
        }}
      />
      {label}
    </span>
  );
}
