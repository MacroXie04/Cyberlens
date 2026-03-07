import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimelinePoint } from "../../types";
import { colors } from "../../theme/theme";

interface Props {
  data: TimelinePoint[];
}

export default function TrafficTrend({ data }: Props) {
  return (
    <div className="card" style={{ minHeight: 300 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Traffic & Threat Trend
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" />
            <XAxis
              dataKey="hour"
              tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }}
              tickFormatter={(v: string) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            />
            <YAxis tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "var(--md-surface-container-high)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: 12,
                color: "var(--md-on-surface)",
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={colors.primary}
              fill={colors.primary}
              fillOpacity={0.1}
              name="Total"
            />
            <Area
              type="monotone"
              dataKey="threats"
              stroke={colors.error}
              fill={colors.error}
              fillOpacity={0.1}
              name="Threats"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div
          style={{
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--md-on-surface-variant)",
          }}
        >
          No data yet
        </div>
      )}
    </div>
  );
}
