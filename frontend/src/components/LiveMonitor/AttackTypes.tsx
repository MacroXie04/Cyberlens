import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { colors } from "../../theme/theme";

interface AttackTypeData {
  type: string;
  count: number;
}

interface Props {
  data: AttackTypeData[];
}

export default function AttackTypes({ data }: Props) {
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
        Attack Types
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" />
            <XAxis type="number" tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }} />
            <YAxis
              dataKey="type"
              type="category"
              tick={{ fill: "var(--md-on-surface-variant)", fontSize: 12 }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                background: "var(--md-surface-container-high)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: 12,
                color: "var(--md-on-surface)",
              }}
            />
            <Bar dataKey="count" fill={colors.primary} radius={[0, 8, 8, 0]} />
          </BarChart>
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
          No attacks detected
        </div>
      )}
    </div>
  );
}
