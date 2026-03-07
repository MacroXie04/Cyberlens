import { colors } from "../../theme/theme";

interface Props {
  score: number | null;
}

export default function SecurityScore({ score }: Props) {
  const displayScore = score ?? 0;
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (displayScore / 100) * circumference;

  const scoreColor =
    displayScore >= 80
      ? colors.safe
      : displayScore >= 50
        ? colors.warning
        : colors.error;

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Security Score
      </h3>

      {score !== null ? (
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Background circle */}
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="var(--md-outline-variant)"
            strokeWidth="10"
          />
          {/* Score arc */}
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke={scoreColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 90 90)"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
          {/* Score text */}
          <text
            x="90"
            y="85"
            textAnchor="middle"
            fill={scoreColor}
            fontSize="36"
            fontWeight="700"
            fontFamily="var(--md-font-mono)"
          >
            {displayScore}
          </text>
          <text
            x="90"
            y="110"
            textAnchor="middle"
            fill="var(--md-on-surface-variant)"
            fontSize="12"
          >
            / 100
          </text>
        </svg>
      ) : (
        <div
          style={{
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--md-on-surface-variant)",
          }}
        >
          Run a scan to see your score
        </div>
      )}
    </div>
  );
}
