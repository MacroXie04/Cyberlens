import { useState, useCallback, useEffect, useRef } from "react";
import { getCloudRunLogs } from "../../services/api";
import type { CloudRunLogEntry } from "../../types";
import { analyzeCloudRunLogs, getCloudRunLogSignals } from "./cloudRunLogAnalysis";

const AUTO_REFRESH_MS = 3000;

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
  const [hours, setHours] = useState(24);
  const [severity, setSeverity] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeSearchText, setActiveSearchText] = useState("");
  const [fetched, setFetched] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchInFlightRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const runFetch = useCallback(async (
    nextHours: number,
    nextSeverity: string,
    nextSearchText: string,
    options?: { background?: boolean }
  ) => {
    if (fetchInFlightRef.current) {
      return;
    }

    fetchInFlightRef.current = true;
    if (!options?.background) {
      setLoading(true);
    }
    setError("");
    try {
      const result = await getCloudRunLogs({
        hours: nextHours,
        severity: nextSeverity || undefined,
        q: nextSearchText || undefined,
        limit: 200,
      });
      setEntries(result.entries);
      setFetched(true);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      fetchInFlightRef.current = false;
      if (!options?.background) {
        setLoading(false);
      }
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (activeSearchText !== searchText) {
      setActiveSearchText(searchText);
      return;
    }
    await runFetch(hours, severity, activeSearchText);
  }, [activeSearchText, hours, runFetch, searchText, severity]);

  useEffect(() => {
    void runFetch(hours, severity, activeSearchText);

    stopPolling();
    pollRef.current = setInterval(() => {
      void runFetch(hours, severity, activeSearchText, { background: true });
    }, AUTO_REFRESH_MS);

    return () => stopPolling();
  }, [activeSearchText, hours, runFetch, severity, stopPolling]);

  const analysis = analyzeCloudRunLogs(entries);

  const analysisToneColor =
    analysis.tone === "critical"
      ? "var(--md-error)"
      : analysis.tone === "warn"
        ? "#ffa726"
        : analysis.tone === "healthy"
          ? "var(--md-safe)"
          : "#42a5f5";

  const signalToneColor = (tone: "critical" | "warn" | "info") =>
    tone === "critical"
      ? "var(--md-error)"
      : tone === "warn"
        ? "#ffa726"
        : "#42a5f5";

  return (
    <div className="card" style={{ gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", margin: 0 }}>
            Cloud Run Logs
          </h3>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 4 }}>
            {lastUpdated
              ? `Last updated from GCP at ${new Date(lastUpdated).toLocaleTimeString()} • Auto-refresh every 3s`
              : "Connecting to Cloud Run logs with live auto-refresh"}
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

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select
          aria-label="Time window"
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
          <option value={720}>Last 30 days</option>
        </select>

        <select
          aria-label="Severity filter"
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
          aria-label="Search logs"
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

      {fetched && entries.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              background: "var(--md-surface-container)",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 6 }}>
              Log Analysis
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: analysisToneColor }}>
              {analysis.headline}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {[
                { label: "Entries", value: analysis.counts.total },
                { label: "Errors", value: analysis.counts.error },
                { label: "Warnings", value: analysis.counts.warning },
                { label: "Investigate", value: analysis.counts.investigate },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    minWidth: 92,
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "var(--md-surface-container-high)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--md-on-surface)" }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {analysis.insights.map((insight) => (
                <div
                  key={insight}
                  style={{
                    fontSize: 13,
                    color: "var(--md-on-surface)",
                    background: "var(--md-surface-container-high)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  {insight}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "var(--md-surface-container)",
              borderRadius: 8,
              padding: 14,
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 8 }}>
                Key Signals
              </div>
              {analysis.signals.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {analysis.signals.map((signal) => (
                    <div
                      key={signal.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "var(--md-surface-container-high)",
                      }}
                    >
                      <span style={{ color: signalToneColor(signal.tone), fontWeight: 500 }}>
                        {signal.label}
                      </span>
                      <span style={{ color: "var(--md-on-surface-variant)", fontSize: 12 }}>
                        {signal.count} lines
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
                  No strong failure or attack signature was detected in the current sample.
                </div>
              )}
            </div>

            {analysis.repeatedMessages.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 8 }}>
                  Repeated Messages
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {analysis.repeatedMessages.map((item) => (
                    <div
                      key={`${item.sample}-${item.count}`}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "var(--md-surface-container-high)",
                        fontSize: 13,
                        color: "var(--md-on-surface)",
                      }}
                    >
                      <strong style={{ marginRight: 6 }}>{item.count}x</strong>
                      {item.sample}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.recommendations.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 8 }}>
                  Recommended Checks
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {analysis.recommendations.map((recommendation) => (
                    <div
                      key={recommendation}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "var(--md-surface-container-high)",
                        fontSize: 13,
                        color: "var(--md-on-surface)",
                      }}
                    >
                      {recommendation}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log entries */}
      <div
        style={{
          maxHeight: 460,
          overflowY: "auto",
          background: "var(--md-surface-container)",
          borderRadius: 8,
          fontFamily: "var(--md-font-mono)",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {loading && !fetched && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
            Loading latest Cloud Run logs...
          </div>
        )}
        {!fetched && !loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
            Configure GCP Cloud Logging in Settings and logs will appear here automatically.
          </div>
        )}
        {fetched && entries.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--md-on-surface-variant)", fontSize: 13, fontFamily: "inherit" }}>
            No log entries found for the selected filters.
          </div>
        )}
        {entries.map((entry, i) => {
          const entrySignals = getCloudRunLogSignals(entry);
          return (
            <div
              key={i}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--md-outline-variant)",
                display: "grid",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
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
                {entrySignals.map((signal) => (
                  <span
                    key={`${entry.timestamp}-${signal.label}`}
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 500,
                      background:
                        signal.tone === "critical"
                          ? "rgba(239, 83, 80, 0.12)"
                          : signal.tone === "warn"
                            ? "rgba(255, 167, 38, 0.16)"
                            : "rgba(66, 165, 245, 0.12)",
                      color: signalToneColor(signal.tone),
                    }}
                  >
                    {signal.label}
                  </span>
                ))}
              </div>
              <span
                style={{ color: "var(--md-on-surface)", wordBreak: "break-all" }}
              >
                {entry.message}
              </span>
            </div>
          );
        })}
      </div>

      {fetched && entries.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
          Showing {entries.length} log entries from the selected time window
        </div>
      )}
    </div>
  );
}
