import { socColors } from "../../theme/theme";

interface Props {
  projectId: string;
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
  onRegionChange: (v: string) => void;
  onServiceChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  onSeverityChange: (v: string) => void;
  onTimeRangeChange: (v: number) => void;
  onRefresh: () => void;
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
  { label: "Load Balancer", value: "load_balancer" },
  { label: "Cloud Armor", value: "cloud_armor" },
  { label: "IAM Audit", value: "iam_audit" },
  { label: "IAP", value: "iap" },
];

const SEVERITY_OPTIONS = [
  { label: "All", value: "" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const selectStyle: React.CSSProperties = {
  background: socColors.bgCard,
  color: socColors.text,
  border: `1px solid ${socColors.border}`,
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 12,
  cursor: "pointer",
  outline: "none",
};

export default function CommandBar({
  projectId,
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
  onRegionChange,
  onServiceChange,
  onSourceChange,
  onSeverityChange,
  onTimeRangeChange,
  onRefresh,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: socColors.bgPanel,
        borderBottom: `1px solid ${socColors.border}`,
        flexWrap: "wrap",
      }}
    >
      {/* Project ID */}
      <span style={{ color: socColors.accent, fontWeight: 600, fontSize: 13 }}>
        {projectId || "No Project"}
      </span>

      <div style={{ width: 1, height: 20, background: socColors.border }} />

      {/* Region filter */}
      <select
        value={selectedRegion}
        onChange={(e) => onRegionChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">All Regions</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      {/* Service filter */}
      <select
        value={selectedService}
        onChange={(e) => onServiceChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">All Services</option>
        {services.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Source filter */}
      <select
        value={selectedSource}
        onChange={(e) => onSourceChange(e.target.value)}
        style={selectStyle}
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Severity filter */}
      <select
        value={selectedSeverity}
        onChange={(e) => onSeverityChange(e.target.value)}
        style={selectStyle}
      >
        {SEVERITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Time range */}
      <div style={{ display: "flex", gap: 2 }}>
        {TIME_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onTimeRangeChange(o.value)}
            style={{
              background:
                timeRange === o.value ? socColors.accent : "transparent",
              color:
                timeRange === o.value ? socColors.bg : socColors.textMuted,
              border: `1px solid ${timeRange === o.value ? socColors.accent : socColors.border}`,
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: timeRange === o.value ? 600 : 400,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Socket status */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: socketConnected ? socColors.safe : socColors.critical,
            boxShadow: socketConnected
              ? `0 0 6px ${socColors.safe}`
              : `0 0 6px ${socColors.critical}`,
          }}
        />
        <span style={{ fontSize: 11, color: socColors.textDim }}>
          {socketConnected ? "LIVE" : "DISCONNECTED"}
        </span>
      </div>

      {/* Last sync */}
      {lastSync && (
        <span style={{ fontSize: 11, color: socColors.textDim }}>
          {lastSync}
        </span>
      )}

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{
          background: "transparent",
          color: refreshing ? socColors.textDim : socColors.accent,
          border: `1px solid ${socColors.border}`,
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 12,
          cursor: refreshing ? "not-allowed" : "pointer",
          opacity: refreshing ? 0.6 : 1,
        }}
      >
        {refreshing ? "Refreshing\u2026" : "Refresh"}
      </button>
    </div>
  );
}
