import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GcpSecurityEvent, GcpSecurityIncident, LiveMonitorMode } from "../types";

export function useLiveMonitorControls() {
  const [mode, setMode] = useState<LiveMonitorMode>("history");
  const [timeRange, setTimeRange] = useState(43200);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<GcpSecurityIncident | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<GcpSecurityEvent | null>(null);
  const [replayCursor, setReplayCursor] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const lastHistoryRangeRef = useRef(43200);
  const replayCursorRef = useRef<string | null>(null);

  useEffect(() => {
    replayCursorRef.current = replayCursor;
  }, [replayCursor]);

  const handleModeChange = useCallback((nextMode: LiveMonitorMode) => {
    setIsPlaying(false);
    setSelectedIncident(null);
    setSelectedEvent(null);
    if (nextMode === "live") {
      setMode("live");
      setTimeRange(15);
      return;
    }
    setMode("history");
    setTimeRange(lastHistoryRangeRef.current || 43200);
  }, []);

  const handleTimeRangeChange = useCallback((value: number) => {
    setIsPlaying(false);
    if (value !== 15) lastHistoryRangeRef.current = value;
    if (mode === "live" && value !== 15) setMode("history");
    setTimeRange(value);
  }, [mode]);

  const handleReplayCursorChange = useCallback((value: string) => {
    setIsPlaying(false);
    setReplayCursor(value);
  }, []);

  const handleSelectEvent = useCallback((event: GcpSecurityEvent) => {
    setSelectedEvent(event);
    setSelectedIncident(null);
    setIsPlaying(false);
    setReplayCursor(event.timestamp);
  }, []);

  const handleSelectIncident = useCallback((incident: GcpSecurityIncident) => {
    setSelectedIncident(incident);
    setSelectedEvent(null);
    setIsPlaying(false);
    setReplayCursor(incident.last_seen);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedIncident(null);
    setSelectedEvent(null);
  }, []);

  const actions = useMemo(() => ({
    handleCloseDrawer,
    handleModeChange,
    handleReplayCursorChange,
    handleSelectEvent,
    handleSelectIncident,
    handleTimeRangeChange,
    setIsPlaying,
    setPlaybackSpeed,
    setReplayCursor,
    setSelectedRegion,
    setSelectedService,
    setSelectedSeverity,
    setSelectedSource,
  }), [handleCloseDrawer, handleModeChange, handleReplayCursorChange, handleSelectEvent, handleSelectIncident, handleTimeRangeChange]);

  return {
    actions,
    playbackSpeed,
    replayCursor,
    replayCursorRef,
    selectedEvent,
    selectedIncident,
    selectedRegion,
    selectedService,
    selectedSeverity,
    selectedSource,
    setPlaybackSpeed,
    setReplayCursor,
    setSelectedEvent,
    setSelectedIncident,
    timeRange,
    isPlaying,
    mode,
  };
}
