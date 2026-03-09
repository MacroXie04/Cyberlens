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

import { socColors } from "../../theme/theme";
import type { GcpTimelinePoint } from "../../types";
import { formatTick, formatTooltipLabel } from "./threatTimelineUtils";

interface Props {
  points: GcpTimelinePoint[];
  cursor: string | null;
  loading?: boolean;
  emptyState: string;
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

export default function ThreatTimelineChart({ points, cursor, loading, emptyState }: Props) {
  const chartData = points.map((point) => ({
    ...point,
    highlight: cursor === point.ts ? point.requests : null,
  }));
  const empty = chartData.length === 0 || chartData.every((point) => point.requests === 0 && point.errors === 0 && point.incident_count === 0);

  if (loading) {
    return <ChartEmptyState label="Loading 30-day historical posture..." />;
  }

  if (empty) {
    return <ChartEmptyState label={emptyState} />;
  }

  return (
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
        <XAxis dataKey="ts" tickFormatter={formatTick} stroke={socColors.textDim} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis yAxisId="traffic" stroke={socColors.textDim} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis yAxisId="incidents" orientation="right" allowDecimals={false} stroke={socColors.textDim} fontSize={11} tickLine={false} axisLine={false} />
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
        <Bar yAxisId="incidents" dataKey="incident_count" fill={socColors.medium} radius={[8, 8, 0, 0]} barSize={14} />
        <Area yAxisId="traffic" type="monotone" dataKey="requests" stroke={socColors.accent} strokeWidth={2.2} fill="url(#timeline-requests)" />
        <Area yAxisId="traffic" type="monotone" dataKey="errors" stroke={socColors.critical} strokeWidth={1.6} fill="url(#timeline-errors)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
