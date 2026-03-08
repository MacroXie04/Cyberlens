import type { GcpObservedService } from "../../types";
import { socColors } from "../../theme/theme";

interface Props {
  services: GcpObservedService[];
  selectedService: string;
  onSelectService: (name: string) => void;
}

function riskColor(score: number): string {
  if (score >= 0.8) return socColors.critical;
  if (score >= 0.5) return socColors.high;
  if (score >= 0.2) return socColors.medium;
  return socColors.safe;
}

function errorColor(rate: number): string {
  if (rate >= 0.1) return socColors.critical;
  if (rate >= 0.05) return socColors.high;
  if (rate >= 0.01) return socColors.medium;
  return socColors.safe;
}

export default function EstateMatrix({
  services,
  selectedService,
  onSelectService,
}: Props) {
  if (services.length === 0) {
    return (
      <div
        style={{
          background: socColors.bgCard,
          border: `1px solid ${socColors.border}`,
          borderRadius: 8,
          padding: 20,
          color: socColors.textDim,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        No Cloud Run services discovered. Configure GCP settings and refresh.
      </div>
    );
  }

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
        Estate Matrix
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${socColors.border}`,
                color: socColors.textDim,
                textAlign: "left",
              }}
            >
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Service</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Region</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Revision</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Instances</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Req/s</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Err %</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>p50</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>p95</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Risk</th>
              <th style={{ padding: "8px 12px", fontWeight: 500 }}>Tags</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr
                key={`${svc.service_name}-${svc.region}`}
                onClick={() => onSelectService(svc.service_name)}
                style={{
                  borderBottom: `1px solid ${socColors.border}`,
                  background:
                    selectedService === svc.service_name
                      ? socColors.bgCardHover
                      : "transparent",
                  cursor: "pointer",
                  color: socColors.text,
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => {
                  if (selectedService !== svc.service_name) {
                    e.currentTarget.style.background = socColors.bgCardHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedService !== svc.service_name) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                  {svc.service_name}
                </td>
                <td style={{ padding: "8px 12px", color: socColors.textMuted }}>
                  {svc.region}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "'Noto Sans Mono', monospace",
                    fontSize: 11,
                    color: socColors.textDim,
                  }}
                >
                  {svc.latest_revision?.split("-").pop() || "—"}
                </td>
                <td style={{ padding: "8px 12px", fontVariantNumeric: "tabular-nums" }}>
                  {svc.instance_count}
                </td>
                <td style={{ padding: "8px 12px", fontVariantNumeric: "tabular-nums" }}>
                  {svc.request_rate.toFixed(1)}
                </td>
                <td style={{ padding: "8px 12px", color: errorColor(svc.error_rate) }}>
                  {(svc.error_rate * 100).toFixed(1)}%
                </td>
                <td style={{ padding: "8px 12px", fontVariantNumeric: "tabular-nums" }}>
                  {svc.p50_latency_ms.toFixed(0)}ms
                </td>
                <td style={{ padding: "8px 12px", fontVariantNumeric: "tabular-nums" }}>
                  {svc.p95_latency_ms.toFixed(0)}ms
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <div
                    style={{
                      display: "inline-block",
                      width: 40,
                      height: 6,
                      borderRadius: 3,
                      background: socColors.border,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, svc.risk_score * 100)}%`,
                        height: "100%",
                        background: riskColor(svc.risk_score),
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(svc.risk_tags || []).map((tag, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: socColors.criticalBg,
                          color: socColors.critical,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
