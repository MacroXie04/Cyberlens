import type { GcpObservedService, LiveMonitorMode } from "../../types";
import { socColors } from "../../theme/theme";
import EstateMatrixRow from "./EstateMatrixRow";

interface Props {
  services: GcpObservedService[];
  selectedService: string;
  mode: LiveMonitorMode;
  replayWindowLabel: string;
  onSelectService: (name: string) => void;
  emptyStateMessage?: string;
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
              {services.map((service) => (
                <EstateMatrixRow
                  key={`${service.service_name}-${service.region}`}
                  service={service}
                  selected={selectedService === service.service_name}
                  onSelect={() => onSelectService(service.service_name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
