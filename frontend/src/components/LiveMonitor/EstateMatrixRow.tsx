import { socColors, typography } from "../../theme/theme";
import type { GcpObservedService } from "../../types";

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
  return sampleMissing ? "No sample" : `${(value ?? 0).toFixed(0)}ms`;
}

function cellStyle(emphasis = false) {
  return { padding: "16px 18px", borderBottom: `1px solid ${socColors.border}`, fontSize: 13, color: emphasis ? socColors.text : socColors.textMuted, fontWeight: emphasis ? 600 : 500, verticalAlign: "top" as const };
}

export default function EstateMatrixRow({ service, selected, onSelect }: { service: GcpObservedService; selected: boolean; onSelect: () => void }) {
  return (
    <tr onClick={onSelect} style={{ background: selected ? socColors.bgCardHover : "transparent", cursor: "pointer" }}>
      <td style={cellStyle(true)}>
        <div style={{ fontWeight: 700, color: socColors.text }}>{service.service_name}</div>
        {service.url ? <div style={{ marginTop: 4, fontSize: 12, color: socColors.textDim, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{service.url}</div> : null}
      </td>
      <td style={cellStyle()}>{service.region}</td>
      <td style={{ ...cellStyle(), fontFamily: typography.fontMono, color: socColors.textDim }}>{service.latest_revision?.split("-").pop() || "n/a"}</td>
      <td style={cellStyle()}>{service.sample_missing ? "Discovery only" : service.instance_count ?? 0}</td>
      <td style={cellStyle()}>{(service.request_rate ?? 0).toFixed(1)}</td>
      <td style={{ ...cellStyle(), color: errorColor(service.error_rate ?? 0) }}>{((service.error_rate ?? 0) * 100).toFixed(1)}%</td>
      <td style={cellStyle()}>{formatLatency(service.p50_latency_ms ?? 0, service.sample_missing)}</td>
      <td style={cellStyle()}>{formatLatency(service.p95_latency_ms ?? 0, service.sample_missing)}</td>
      <td style={cellStyle()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 68, height: 8, borderRadius: 999, overflow: "hidden", background: socColors.bgPanel }}>
            <div style={{ width: `${Math.max(6, Math.min(100, (service.risk_score ?? 0) * 100))}%`, height: "100%", borderRadius: 999, background: riskColor(service.risk_score ?? 0) }} />
          </div>
          <span style={{ fontSize: 12, color: socColors.textDim }}>{Math.round((service.risk_score ?? 0) * 100)}</span>
        </div>
      </td>
      <td style={cellStyle()}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "6px 10px", background: service.sample_missing ? socColors.infoBg : socColors.safeBg, color: service.sample_missing ? socColors.textMuted : socColors.safe, fontSize: 12, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: service.sample_missing ? socColors.textDim : socColors.safe }} />
          {service.sample_missing ? "No health sample" : "Sampled"}
        </span>
      </td>
    </tr>
  );
}
