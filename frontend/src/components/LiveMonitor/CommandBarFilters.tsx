import { socColors } from "../../theme/theme";

import { controlGroupStyle, SEVERITY_OPTIONS, selectStyle, SOURCE_OPTIONS, TIME_OPTIONS } from "./commandBarUtils";

interface Props {
  selectedRegion: string;
  regions: string[];
  selectedService: string;
  services: string[];
  selectedSource: string;
  selectedSeverity: string;
  timeRange: number;
  onRegionChange: (value: string) => void;
  onServiceChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onTimeRangeChange: (value: number) => void;
}

export default function CommandBarFilters({
  selectedRegion,
  regions,
  selectedService,
  services,
  selectedSource,
  selectedSeverity,
  timeRange,
  onRegionChange,
  onServiceChange,
  onSourceChange,
  onSeverityChange,
  onTimeRangeChange,
}: Props) {
  return (
    <>
      <select aria-label="Region filter" value={selectedRegion} onChange={(event) => onRegionChange(event.target.value)} style={selectStyle}>
        <option value="">All Regions</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>

      <select aria-label="Service filter" value={selectedService} onChange={(event) => onServiceChange(event.target.value)} style={selectStyle}>
        <option value="">All Services</option>
        {services.map((service) => (
          <option key={service} value={service}>
            {service}
          </option>
        ))}
      </select>

      <select aria-label="Source filter" value={selectedSource} onChange={(event) => onSourceChange(event.target.value)} style={selectStyle}>
        {SOURCE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select aria-label="Severity filter" value={selectedSeverity} onChange={(event) => onSeverityChange(event.target.value)} style={selectStyle}>
        {SEVERITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div style={controlGroupStyle}>
        {TIME_OPTIONS.map((option) => {
          const selected = timeRange === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onTimeRangeChange(option.value)}
              style={{
                border: "none",
                background: selected ? socColors.accentSoft : "transparent",
                color: selected ? socColors.accent : socColors.textMuted,
                borderRadius: 999,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: selected ? 700 : 600,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
