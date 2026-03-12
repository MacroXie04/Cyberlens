import type { Dependency } from "../../../types";
import { colors } from "../../../theme/theme";

interface Props {
  dependencies: Dependency[];
}

function riskColor(dep: Dependency): string {
  if (!dep.is_vulnerable) return colors.safe;
  const count = dep.vulnerabilities?.length ?? 0;
  if (count >= 3) return colors.error;
  return "#FF7043";
}

export default function DependencyList({ dependencies }: Props) {
  const sorted = [...dependencies].sort((a, b) => {
    if (a.is_vulnerable !== b.is_vulnerable) return a.is_vulnerable ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="card">
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Dependency List
        {dependencies.length > 0 && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "var(--md-on-surface-variant)",
              marginLeft: 8,
            }}
          >
            ({dependencies.length} packages)
          </span>
        )}
      </h3>
      {sorted.length === 0 ? (
        <div
          style={{
            color: "var(--md-on-surface-variant)",
            fontSize: 14,
            padding: "16px 0",
          }}
        >
          No dependencies found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sorted.map((dep) => (
            <div
              key={dep.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--md-on-surface)",
                  }}
                >
                  {dep.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {dep.version}
                </span>
              </div>
              <span
                data-testid={`risk-dot-${dep.id}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: riskColor(dep),
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
