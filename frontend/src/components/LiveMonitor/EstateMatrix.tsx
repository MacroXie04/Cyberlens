import type { GcpObservedService, LiveMonitorMode } from "../../types";
import { socColors, typography } from "../../theme/theme";

interface Props {
  services: GcpObservedService[];
  selectedService: string;
  mode: LiveMonitorMode;
  replayWindowLabel: string;
  onSelectService: (name: string) => void;
  emptyStateMessage?: string;
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

function formatLatency(value: number, sampleMissing?: boolean): string {
  if (sampleMissing) return "No sample";
  return `${(value ?? 0).toFixed(0)}ms`;
}

export default function EstateMatrix({
  services,
  selectedService,
  mode,
  replayWindowLabel,
  onSelectService,
  emptyStateMessage,
}: Props) {
  return (
    <div
      style={{
        background: socColors.bgCard,
        border: `1px solid ${socColors.border}`,
        borderRadius: 30,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <SectionHeader
        title="Estate Matrix"
        subtitle={
          mode === "live"
            ? "Latest Cloud Run service posture"
            : `Closest health sample before replay cursor · ${replayWindowLabel}`
        }
      />

      {services.length === 0 ? (
        <div
          style={{
            padding: "28px 20px",
            color: socColors.textDim,
            fontSize: 14,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          {emptyStateMessage ||
            "No Cloud Run services discovered yet. Configure GCP access and refresh."}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 940,
            }}
          >
            <thead>
              <tr style={{ background: socColors.bgPanel }}>
                {[
                  "Service",
                  "Region",
                  "Revision",
                  "Instances",
                  "Req / bucket",
                  "Err %",
                  "p50",
                  "p95",
                  "Risk",
                  "Status",
                ].map((column) => (
                  <th
                    key={column}
                    style={{
                      padding: "12px 18px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: socColors.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      textAlign: "left",
                      borderBottom: `1px solid ${socColors.border}`,
                    }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const selected = selectedService === service.service_name;
                return (
                  <tr
                    key={`${service.service_name}-${service.region}`}
                    onClick={() => onSelectService(service.service_name)}
                    style={{
                      background: selected ? socColors.bgCardHover : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <td style={cellStyle(true)}>
                      <div style={{ fontWeight: 700, color: socColors.text }}>
                        {service.service_name}
                      </div>
                      {service.url && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: socColors.textDim,
                            maxWidth: 220,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {service.url}
                        </div>
                      )}
                    </td>
                    <td style={cellStyle()}>{service.region}</td>
                    <td
                      style={{
                        ...cellStyle(),
                        fontFamily: typography.fontMono,
                        color: socColors.textDim,
                      }}
                    >
                      {service.latest_revision?.split("-").pop() || "n/a"}
                    </td>
                    <td style={cellStyle()}>
                      {service.sample_missing ? "Discovery only" : service.instance_count ?? 0}
                    </td>
                    <td style={cellStyle()}>{(service.request_rate ?? 0).toFixed(1)}</td>
                    <td style={{ ...cellStyle(), color: errorColor(service.error_rate ?? 0) }}>
                      {((service.error_rate ?? 0) * 100).toFixed(1)}%
                    </td>
                    <td style={cellStyle()}>{formatLatency(service.p50_latency_ms ?? 0, service.sample_missing)}</td>
                    <td style={cellStyle()}>{formatLatency(service.p95_latency_ms ?? 0, service.sample_missing)}</td>
                    <td style={cellStyle()}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 68,
                            height: 8,
                            borderRadius: 999,
                            overflow: "hidden",
                            background: socColors.bgPanel,
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(6, Math.min(100, (service.risk_score ?? 0) * 100))}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: riskColor(service.risk_score ?? 0),
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: socColors.textDim }}>
                          {Math.round((service.risk_score ?? 0) * 100)}
                        </span>
                      </div>
                    </td>
                    <td style={cellStyle()}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          padding: "6px 10px",
                          background: service.sample_missing
                            ? socColors.infoBg
                            : socColors.safeBg,
                          color: service.sample_missing
                            ? socColors.textMuted
                            : socColors.safe,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: service.sample_missing
                              ? socColors.textDim
                              : socColors.safe,
                          }}
                        />
                        {service.sample_missing ? "No health sample" : "Sampled"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function cellStyle(emphasis = false) {
  return {
    padding: "16px 18px",
    borderBottom: `1px solid ${socColors.border}`,
    fontSize: 13,
    color: emphasis ? socColors.text : socColors.textMuted,
    fontWeight: emphasis ? 600 : 500,
    verticalAlign: "top" as const,
  };
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        padding: "18px 20px 14px",
        borderBottom: `1px solid ${socColors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: socColors.textMuted,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: socColors.textDim }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
