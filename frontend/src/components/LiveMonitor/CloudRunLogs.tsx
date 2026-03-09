import CloudRunLogEntryList from "./CloudRunLogEntryList";
import CloudRunLogFilters from "./CloudRunLogFilters";
import CloudRunLogSummary from "./CloudRunLogSummary";
import { useCloudRunLogs } from "./useCloudRunLogs";

export default function CloudRunLogs() {
  const {
    analysis,
    entries,
    error,
    fetched,
    fetchLogs,
    hours,
    lastUpdated,
    loading,
    searchText,
    setHours,
    setSearchText,
    setSeverity,
    severity,
  } = useCloudRunLogs();

  return (
    <div className="card" style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", margin: 0 }}>Cloud Run Logs</h3>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 4 }}>
            {lastUpdated ? `Last updated from GCP at ${new Date(lastUpdated).toLocaleTimeString()} • Auto-refresh every 3s` : "Connecting to Cloud Run logs with live auto-refresh"}
          </div>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          aria-label="Refresh Cloud Run logs"
          style={{
            padding: "6px 16px",
            borderRadius: "var(--md-radius-button)",
            border: "none",
            background: loading ? "var(--md-surface-container-high)" : "var(--md-primary)",
            color: loading ? "var(--md-on-surface-variant)" : "var(--md-on-primary)",
            fontWeight: 500,
            fontSize: 13,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Loading..." : fetched ? "Refresh" : "Fetch Logs"}
        </button>
      </div>

      <CloudRunLogFilters
        hours={hours}
        severity={severity}
        searchText={searchText}
        onHoursChange={setHours}
        onSeverityChange={setSeverity}
        onSearchTextChange={setSearchText}
        onSearch={fetchLogs}
      />

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, background: "rgba(239, 83, 80, 0.1)", color: "var(--md-error)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {fetched && entries.length > 0 && <CloudRunLogSummary analysis={analysis} />}

      <CloudRunLogEntryList entries={entries} fetched={fetched} loading={loading} />

      {fetched && entries.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
          Showing {entries.length} log entries from the selected time window
        </div>
      )}
    </div>
  );
}
