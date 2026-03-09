import { useCallback, useEffect, useRef, useState } from "react";

import type { CloudRunLogEntry } from "../../types";
import { getCloudRunLogs } from "../../services/api";
import { analyzeCloudRunLogs } from "./cloudRunLogAnalysis";
import { AUTO_REFRESH_MS } from "./cloudRunLogStyles";

export function useCloudRunLogs() {
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

  const runFetch = useCallback(async (nextHours: number, nextSeverity: string, nextSearchText: string, options?: { background?: boolean }) => {
    if (fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;
    if (!options?.background) setLoading(true);
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
      if (!options?.background) setLoading(false);
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

  return {
    activeSearchText,
    analysis: analyzeCloudRunLogs(entries),
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
  };
}
