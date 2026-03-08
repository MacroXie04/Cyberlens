import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { GcpTimelineMarker, GcpTimelinePoint } from "../../types";
import { socColors, typography } from "../../theme/theme";

interface Props {
  points: GcpTimelinePoint[];
  markers: GcpTimelineMarker[];
  cursor: string | null;
  loading?: boolean;
  emptyState: string;
  onSelectTimestamp: (ts: string) => void;
}

const severityColor: Record<string, string> = {
  p1: socColors.critical,
  p2: socColors.high,
  p3: socColors.medium,
  p4: socColors.textDim,
  critical: socColors.critical,
  high: socColors.high,
  medium: socColors.medium,
  low: socColors.low,
  info: socColors.info,
};

function formatTick(value: string) {
  try {
    const date = new Date(value);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function formatTooltipLabel(value: string) {
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

export default function GlobalThreatTimeline({
  points,
  markers,
  cursor,
  loading,
  emptyState,
  onSelectTimestamp,
}: Props) {
  const chartData = points.map((point) => ({
    ...point,
    highlight: cursor === point.ts ? point.requests : null,
  }));

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
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: socColors.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Global Threat Timeline
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
            Request pressure, error volume, and incident markers across the selected range
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: socColors.bgPanel,
            borderRadius: 999,
            fontSize: 12,
            color: socColors.textDim,
          }}
        >
          <LegendDot color={socColors.accent} label="Requests" />
          <LegendDot color={socColors.critical} label="Errors" />
          <LegendDot color={socColors.medium} label="Incidents" />
        </div>
      </div>

      <div style={{ padding: "18px 20px 8px", height: 340 }}>
        {loading ? (
          <ChartEmptyState label="Loading 30-day historical posture..." />
        ) : chartData.length === 0 || chartData.every((point) => point.requests === 0 && point.errors === 0 && point.incident_count === 0) ? (
          <ChartEmptyState label={emptyState} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="timeline-requests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={socColors.accent} stopOpacity={0.24} />
                  <stop offset="95%" stopColor={socColors.accent} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="timeline-errors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={socColors.critical} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={socColors.critical} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={socColors.border} strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTick}
                stroke={socColors.textDim}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="traffic"
                stroke={socColors.textDim}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="incidents"
                orientation="right"
                allowDecimals={false}
                stroke={socColors.textDim}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                contentStyle={{
                  background: "#fff",
                  border: `1px solid ${socColors.border}`,
                  borderRadius: 20,
                  boxShadow: socColors.shadow,
                  color: socColors.text,
                }}
              />
              <Bar
                yAxisId="incidents"
                dataKey="incident_count"
                fill={socColors.medium}
                radius={[8, 8, 0, 0]}
                barSize={14}
              />
              <Area
                yAxisId="traffic"
                type="monotone"
                dataKey="requests"
                stroke={socColors.accent}
                strokeWidth={2.2}
                fill="url(#timeline-requests)"
              />
              <Area
                yAxisId="traffic"
                type="monotone"
                dataKey="errors"
                stroke={socColors.critical}
                strokeWidth={1.6}
                fill="url(#timeline-errors)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div
        style={{
          padding: "0 20px 20px",
          display: "flex",
          gap: 10,
          overflowX: "auto",
        }}
      >
        {markers.length === 0 ? (
          <div
            style={{
              borderRadius: 18,
              background: socColors.bgPanel,
              padding: "14px 16px",
              color: socColors.textDim,
              fontSize: 13,
            }}
          >
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
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: severityColor[marker.severity] || socColors.info,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: socColors.textDim,
                    textTransform: "uppercase",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  }}
                >
                  {marker.kind}
                </span>
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: socColors.text,
                  lineHeight: 1.4,
                }}
              >
                {marker.title}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: socColors.textDim,
                  fontFamily: typography.fontMono,
                }}
              >
                {formatTooltipLabel(marker.ts)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 24,
        background: "linear-gradient(180deg, rgba(248,250,252,0.8) 0%, rgba(242,245,250,0.9) 100%)",
        color: socColors.textDim,
        fontSize: 14,
      }}
    >
      {label}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span>{label}</span>
    </span>
  );
}
