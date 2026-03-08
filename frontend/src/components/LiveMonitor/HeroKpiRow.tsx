import type { GcpEstateSummary } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  summary: GcpEstateSummary | null;
}

interface KpiCard {
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}

export default function HeroKpiRow({ summary }: Props) {
  const s = summary;

  const cards: KpiCard[] = [
    {
      label: "Active Incidents",
      value: s?.active_incidents ?? 0,
      color: socColors.critical,
      bgColor: socColors.criticalBg,
    },
    {
      label: "Services Under Attack",
      value: s?.services_under_attack ?? 0,
      color: socColors.high,
      bgColor: socColors.highBg,
    },
    {
      label: "Armor Blocks",
      value: s?.armor_blocks_recent ?? 0,
      color: socColors.medium,
      bgColor: socColors.mediumBg,
    },
    {
      label: "Auth Failures",
      value: s?.auth_failures_recent ?? 0,
      color: socColors.high,
      bgColor: socColors.highBg,
    },
    {
      label: "5xx Errors",
      value: s?.error_events_recent ?? 0,
      color: socColors.critical,
      bgColor: socColors.criticalBg,
    },
    {
      label: "Unhealthy Revisions",
      value: s?.unhealthy_revisions ?? 0,
      color: socColors.medium,
      bgColor: socColors.mediumBg,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 12,
      }}
    >
      {cards.map((card, i) => (
        <div
          key={i}
          style={{
            background: socColors.bgCard,
            border: `1px solid ${socColors.border}`,
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: socColors.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {card.label}
          </span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: card.color,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {card.value}
          </span>
        </div>
      ))}
    </div>
  );
}
