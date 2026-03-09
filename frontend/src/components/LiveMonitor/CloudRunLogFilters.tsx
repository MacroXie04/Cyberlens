interface Props {
  hours: number;
  severity: string;
  searchText: string;
  onHoursChange: (value: number) => void;
  onSeverityChange: (value: string) => void;
  onSearchTextChange: (value: string) => void;
  onSearch: () => void;
}

export default function CloudRunLogFilters({
  hours,
  severity,
  searchText,
  onHoursChange,
  onSeverityChange,
  onSearchTextChange,
  onSearch,
}: Props) {
  const controlStyle = {
    padding: "6px 10px",
    borderRadius: "var(--md-radius-button)",
    border: "1px solid var(--md-outline-variant)",
    background: "var(--md-surface-container-high)",
    color: "var(--md-on-surface)",
    fontSize: 13,
  } as const;

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      <select aria-label="Time window" value={hours} onChange={(event) => onHoursChange(Number(event.target.value))} style={controlStyle}>
        <option value={1}>Last 1 hour</option>
        <option value={6}>Last 6 hours</option>
        <option value={24}>Last 24 hours</option>
        <option value={72}>Last 3 days</option>
        <option value={168}>Last 7 days</option>
        <option value={720}>Last 30 days</option>
      </select>

      <select aria-label="Severity filter" value={severity} onChange={(event) => onSeverityChange(event.target.value)} style={controlStyle}>
        <option value="">All severities</option>
        <option value="DEBUG">DEBUG+</option>
        <option value="INFO">INFO+</option>
        <option value="WARNING">WARNING+</option>
        <option value="ERROR">ERROR+</option>
        <option value="CRITICAL">CRITICAL+</option>
      </select>

      <input
        aria-label="Search logs"
        type="text"
        value={searchText}
        onChange={(event) => onSearchTextChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onSearch()}
        placeholder="Search logs..."
        style={{ ...controlStyle, flex: 1, minWidth: 150, outline: "none" }}
      />
    </div>
  );
}
