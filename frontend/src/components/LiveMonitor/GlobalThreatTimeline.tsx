import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { GcpServiceHealth } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  data: GcpServiceHealth[];
}

interface TimePoint {
  time: string;
  requests: number;
  errors: number;
}

export default function GlobalThreatTimeline({ data }: Props) {
  // Aggregate by bucket_end across all services
  const bucketMap = new Map<string, TimePoint>();
  for (const h of data) {
    const key = h.bucket_end;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.requests += h.request_count;
      existing.errors += h.error_count;
    } else {
      bucketMap.set(key, {
        time: key,
        requests: h.request_count,
        errors: h.error_count,
      });
    }
  }

  const chartData = Array.from(bucketMap.values()).sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  const formatTime = (v: string) => {
    try {
      return new Date(v).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return v;
    }
  };

  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${socColors.border}`,
          fontSize: 12,
          color: socColors.textDim,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Global Threat Timeline
      </div>
      <div style={{ padding: "12px 8px 4px", height: 200 }}>
        {chartData.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: socColors.textDim,
              fontSize: 13,
            }}
          >
            No timeseries data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient
                  id="reqGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={socColors.accent}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={socColors.accent}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="errGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={socColors.critical}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={socColors.critical}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={socColors.border}
              />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                stroke={socColors.textDim}
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                stroke={socColors.textDim}
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: socColors.bgPanel,
                  border: `1px solid ${socColors.border}`,
                  borderRadius: 6,
                  color: socColors.text,
                  fontSize: 12,
                }}
                labelFormatter={formatTime}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke={socColors.accent}
                fill="url(#reqGradient)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="errors"
                stroke={socColors.critical}
                fill="url(#errGradient)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
