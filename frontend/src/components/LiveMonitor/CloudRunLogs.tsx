import { useState, useCallback } from "react";
import { getCloudRunLogs } from "../../services/api";
import type { CloudRunLogEntry } from "../../types";

const SEVERITY_COLORS: Record<string, string> = {
  EMERGENCY: "var(--md-error)",
  ALERT: "var(--md-error)",
  CRITICAL: "var(--md-error)",
  ERROR: "#ef5350",
  WARNING: "#ffa726",
  NOTICE: "#42a5f5",
  INFO: "var(--md-on-surface-variant)",
  DEBUG: "var(--md-outline)",
  DEFAULT: "var(--md-on-surface-variant)",
};

export default function CloudRunLogs() {
  const [entries, setEntries] = useState<CloudRunLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hours, setHours] = useState(1);
  const [severity, setSeverity] = useState("");
  const [searchText, setSearchText] = useState("");
  const [fetched, setFetched] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCloudRunLogs({
        hours,
        severity: severity || undefined,
        q: searchText || undefined,
        limit: 200,
      });
      setEntries(result.entries);
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [hours, severity, searchText]);

  return (
    <div className="card" style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", margin: 0 }}>
          Cloud Run Logs
        </h3>
        <button
          onClick={fetchLogs}
          disabled={loading}
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

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          style={{
            padding: "6px 10px",
            borderRadius: "var(--md-radius-button)",
            border: "1px solid var(--md-outline-variant)",
            background: "var(--md-surface-container-high)",
            color: "var(--md-on-surface)",
            fontSize: 13,
          }}
        >
          <option value={1}>Last 1 hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "var(--md-radius-button)",
            border: "1px solid var(--md-outline-variant)",
            background: "var(--md-surface-container-high)",
            color: "var(--md-on-surface)",
            fontSize: 13,
          }}
        >
          <option value="">All severities</option>
          <option value="DEBUG">DEBUG+</option>
          <option value="INFO">INFO+</option>
          <option value="WARNING">WARNING+</option>
          <option value="ERROR">ERROR+</option>
          <option value="CRITICAL">CRITICAL+</option>
        </select>

        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
          placeholder="Search logs..."
          style={{
            flex: 1,
            minWidth: 150,
            padding: "6px 10px",
            borderRadius: "var(--md-radius-button)",
            border: "1px solid var(--md-outline-variant)",
            background: "var(--md-surface-container-high)",
            color: "var(--md-on-surface)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      {error && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            background: "rgba(239, 83, 80, 0.1)",
            color: "var(--md-error)",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Log entries */}
      <div
        style={{
          maxHeight: 400,
          overflowY: "auto",
          background: "var(--md-surface-container)",
          borderRadius: 8,
          fontFamily: "var(--md-font-mono)",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {!fetched && !loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
            Configure GCP Cloud Logging in Settings, then click "Fetch Logs" to view Cloud Run logs.
          </div>
        )}
        {fetched && entries.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
            No log entries found for the selected filters.
          </div>
        )}
        {entries.map((entry, i) => (
          <div
            key={i}
            style={{
              padding: "4px 12px",
              borderBottom: "1px solid var(--md-outline-variant)",
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <span style={{ color: "var(--md-outline)", flexShrink: 0, minWidth: 140 }}>
              {entry.timestamp
                ? new Date(entry.timestamp).toLocaleString(undefined, {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "—"}
            </span>
            <span
              style={{
                color: SEVERITY_COLORS[entry.severity] || "var(--md-on-surface-variant)",
                fontWeight: ["ERROR", "CRITICAL", "ALERT", "EMERGENCY"].includes(entry.severity) ? 600 : 400,
                flexShrink: 0,
                minWidth: 60,
              }}
            >
              {entry.severity}
            </span>
            <span style={{ color: "var(--md-on-surface)", wordBreak: "break-all" }}>
              {entry.message}
            </span>
          </div>
        ))}
      </div>

      {fetched && entries.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
          Showing {entries.length} log entries
        </div>
      )}
    </div>
  );
}
