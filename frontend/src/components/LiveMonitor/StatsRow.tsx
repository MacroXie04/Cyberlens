import type { StatsOverview } from "../../types";
import { colors } from "../../theme/theme";

interface Props {
  stats: StatsOverview;
}

const statCards = [
  { key: "total_requests" as const, label: "Total Requests", icon: "\u{1F4E1}", color: colors.primary },
  { key: "threats_detected" as const, label: "Threats Detected", icon: "\u26A0\uFE0F", color: colors.warning },
  { key: "malicious_count" as const, label: "Malicious", icon: "\u{1F6A8}", color: colors.error },
  { key: "ai_analyzed" as const, label: "AI Analyzed", icon: "\u{1F916}", color: colors.primary },
];

export default function StatsRow({ stats }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
      }}
    >
      {statCards.map((card, i) => (
        <div
          key={card.key}
          className="card animate-in"
          style={{
            animationDelay: `${i * 80}ms`,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: card.color,
              fontFamily: "var(--md-font-mono)",
            }}
          >
            {stats[card.key].toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--md-on-surface-variant)",
              marginTop: 4,
            }}
          >
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
