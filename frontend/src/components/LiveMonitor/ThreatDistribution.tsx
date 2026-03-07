import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { colors } from "../../theme/theme";

interface Props {
  safe: number;
  suspicious: number;
  malicious: number;
}

const COLORS = [colors.safe, colors.warning, colors.error];

export default function ThreatDistribution({ safe, suspicious, malicious }: Props) {
  const data = [
    { name: "Safe", value: safe },
    { name: "Suspicious", value: suspicious },
    { name: "Malicious", value: malicious },
  ].filter((d) => d.value > 0);

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
        Threat Distribution
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              stroke="none"
            >
              {data.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--md-surface-container-high)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: 12,
                color: "var(--md-on-surface)",
              }}
            />
            <Legend />
          </PieChart>
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
