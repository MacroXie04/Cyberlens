import { useCallback, useEffect, useMemo, useState } from "react";

import { ensureGcpCollection, ensureGcpHistory, getGcpEstateReplaySnapshot, getGcpEstateServices, getGcpEstateTimeline, triggerGcpRefresh } from "../api";
import type { GcpHistoryStatus, GcpObservedService, GcpReplaySnapshot, GcpTimelineResponse, LiveMonitorMode } from "../types";
import { computeWindowBounds, TIME_RANGE_CONFIG, type WindowBounds, withinBounds } from "../lib/timeWindow";

interface Args {
  mode: LiveMonitorMode;
  replayCursor: string | null;
  replayCursorRef: React.MutableRefObject<string | null>;
  selectedRegion: string;
  selectedService: string;
  selectedSeverity: string;
  selectedSource: string;
  setReplayCursor: (value: string | null) => void;
  timeRange: number;
}

export function useLiveMonitorData({
  mode,
  replayCursor,
  replayCursorRef,
  selectedRegion,
  selectedService,
  selectedSeverity,
  selectedSource,
  setReplayCursor,
  timeRange,
}: Args) {
  const [windowBounds, setWindowBounds] = useState<WindowBounds | null>(null);
  const [timeline, setTimeline] = useState<GcpTimelineResponse | null>(null);
  const [snapshot, setSnapshot] = useState<GcpReplaySnapshot | null>(null);
  const [serviceDirectory, setServiceDirectory] = useState<GcpObservedService[]>([]);
  const [historyStatus, setHistoryStatus] = useState<GcpHistoryStatus | null>(null);
  const [collectionErrors, setCollectionErrors] = useState<Record<string, string>>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const rangeConfig = useMemo(() => TIME_RANGE_CONFIG[timeRange] ?? TIME_RANGE_CONFIG[43200], [timeRange]);

  const applyConfigError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    if (message.includes("GCP project not configured") || message.includes("HTTP 400")) {
      setConfigError("GCP project not configured. Open Settings and provide a project ID plus service account key.");
      return true;
    }
    return false;
  }, []);

  const loadRangeData = useCallback(async (options?: { forceNow?: boolean }) => {
    const nextBounds = computeWindowBounds(timeRange);
    setWindowBounds(nextBounds);
    setLoadingTimeline(true);
    setConfigError(null);

    try {
      await ensureGcpCollection().catch(() => undefined);
      if (mode === "history") {
        const ensured = await ensureGcpHistory(30).catch(() => null);
        if (ensured?.history_status) setHistoryStatus(ensured.history_status);
      }

      const [directory, timelineResponse] = await Promise.all([
        getGcpEstateServices({ cursor: nextBounds.end }),
        getGcpEstateTimeline({ start: nextBounds.start, end: nextBounds.end, bucket: rangeConfig.bucket, ...(selectedService ? { service: selectedService } : {}), ...(selectedRegion ? { region: selectedRegion } : {}) }),
      ]);

      setServiceDirectory(directory);
      setTimeline(timelineResponse);
      setHistoryStatus({ coverage_start: timelineResponse.coverage_start, coverage_end: timelineResponse.coverage_end, history_ready: timelineResponse.history_ready, backfill_status: timelineResponse.backfill_status });
      const nextCursor = options?.forceNow || mode === "live" || !withinBounds(replayCursorRef.current, nextBounds) ? nextBounds.end : replayCursorRef.current;
      setReplayCursor(nextCursor);
    } catch (error) {
      if (!applyConfigError(error)) console.error("Failed to load timeline", error);
    } finally {
      setLoadingTimeline(false);
    }
  }, [applyConfigError, mode, rangeConfig.bucket, replayCursorRef, selectedRegion, selectedService, setReplayCursor, timeRange]);

  const loadSnapshot = useCallback(async () => {
    if (!windowBounds || !replayCursor) return;

    setLoadingSnapshot(true);
    setConfigError(null);
    try {
      const replaySnapshot = await getGcpEstateReplaySnapshot({ start: windowBounds.start, end: windowBounds.end, cursor: replayCursor, window_minutes: rangeConfig.replayWindowMinutes, ...(selectedService ? { service: selectedService } : {}), ...(selectedRegion ? { region: selectedRegion } : {}), ...(selectedSource ? { source: selectedSource } : {}), ...(selectedSeverity ? { severity: selectedSeverity } : {}) });
      setSnapshot(replaySnapshot);
      setCollectionErrors(replaySnapshot.summary.collection_errors ?? {});
      setHistoryStatus(replaySnapshot.history_status);
      setLastSync(new Date().toLocaleTimeString());
    } catch (error) {
      if (!applyConfigError(error)) console.error("Failed to load replay snapshot", error);
    } finally {
      setLoadingSnapshot(false);
    }
  }, [applyConfigError, rangeConfig.replayWindowMinutes, replayCursor, selectedRegion, selectedService, selectedSeverity, selectedSource, windowBounds]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await triggerGcpRefresh().catch(() => undefined);
      await ensureGcpCollection().catch(() => undefined);
      if (mode === "history") await ensureGcpHistory(30).catch(() => undefined);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await loadRangeData({ forceNow: mode === "live" });
    } finally {
      setRefreshing(false);
    }
  }, [loadRangeData, mode]);

  useEffect(() => {
    void loadRangeData({ forceNow: mode === "live" });
  }, [loadRangeData, mode]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (mode !== "live") return;
    const timer = window.setInterval(() => void loadRangeData({ forceNow: true }), 5000);
    return () => window.clearInterval(timer);
  }, [loadRangeData, mode]);

  return { collectionErrors, configError, handleRefresh, historyStatus, lastSync, loadRangeData, loadingSnapshot, loadingTimeline, refreshing, serviceDirectory, setHistoryStatus, setLastSync, setSnapshot, snapshot, timeline, windowBounds };
}
