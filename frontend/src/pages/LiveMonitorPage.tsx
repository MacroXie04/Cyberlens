import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSocket } from "../hooks/useSocket";
import {
  ensureGcpCollection,
  ensureGcpHistory,
  getGcpEstateReplaySnapshot,
  getGcpEstateServices,
  getGcpEstateTimeline,
  triggerGcpRefresh,
} from "../services/api";
import type {
  GcpEstateSummary,
  GcpHistoryStatus,
  GcpObservedService,
  GcpReplaySnapshot,
  GcpSecurityEvent,
  GcpSecurityIncident,
  GcpTimelineResponse,
  LiveMonitorMode,
} from "../types";
import { socColors, typography } from "../theme/theme";
import CommandBar from "../components/LiveMonitor/CommandBar";
import HeroKpiRow from "../components/LiveMonitor/HeroKpiRow";
import EstateMatrix from "../components/LiveMonitor/EstateMatrix";
import GlobalThreatTimeline from "../components/LiveMonitor/GlobalThreatTimeline";
import PerimeterLanes from "../components/LiveMonitor/PerimeterLanes";
import GeoAttackMap from "../components/LiveMonitor/GeoAttackMap";
import LiveEvidenceFeed from "../components/LiveMonitor/LiveEvidenceFeed";
import IncidentQueue from "../components/LiveMonitor/IncidentQueue";
import TriageDrawer from "../components/LiveMonitor/TriageDrawer";

interface Props {
  cloudRunUrl?: string | null;
}

interface WindowBounds {
  start: string;
  end: string;
}

const TIME_RANGE_CONFIG: Record<
  number,
  { label: string; bucket: "5m" | "1h" | "6h"; replayWindowMinutes: number }
> = {
  15: { label: "15m", bucket: "5m", replayWindowMinutes: 60 },
  60: { label: "1h", bucket: "5m", replayWindowMinutes: 60 },
  360: { label: "6h", bucket: "5m", replayWindowMinutes: 60 },
  1440: { label: "24h", bucket: "5m", replayWindowMinutes: 60 },
  10080: { label: "7d", bucket: "1h", replayWindowMinutes: 1440 },
  43200: { label: "30d", bucket: "6h", replayWindowMinutes: 1440 },
};

function computeWindowBounds(minutes: number): WindowBounds {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function withinBounds(value: string | null, bounds: WindowBounds | null): boolean {
  if (!value || !bounds) return false;
  const ts = new Date(value).getTime();
  const start = new Date(bounds.start).getTime();
  const end = new Date(bounds.end).getTime();
  return ts >= start && ts <= end;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Unavailable";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function describeReplayWindow(cursor: string | null, minutes: number): string {
  const quantity = minutes >= 1440 ? `${Math.round(minutes / 1440)} day` : `${Math.round(minutes / 60)} hour`;
  const pluralized = quantity.endsWith("1 day") || quantity.endsWith("1 hour") ? quantity : `${quantity}s`;
  return `${pluralized} ending ${formatTimestamp(cursor)}`;
}

function historyEmptyState(historyStatus: GcpHistoryStatus | null): string {
  if (historyStatus?.backfill_status?.status === "running") {
    return "Backfill in progress. Historical metrics and evidence will appear as collection completes.";
  }
  if (historyStatus?.backfill_status?.status === "failed") {
    return "History backfill failed. Refresh after resolving the collection issue.";
  }
  if (!historyStatus?.history_ready) {
    return "No history collected yet. Trigger a refresh or wait for the first backfill to finish.";
  }
  return "No notable metrics or incident markers in the selected range.";
}

function projectIdFromState(
  snapshot: GcpReplaySnapshot | null,
  summary: GcpEstateSummary | null,
  directory: GcpObservedService[]
): string {
  return (
    snapshot?.summary.project_id ||
    summary?.project_id ||
    directory[0]?.project_id ||
    ""
  );
}

export default function LiveMonitorPage({ cloudRunUrl }: Props) {
  const [mode, setMode] = useState<LiveMonitorMode>("history");
  const [timeRange, setTimeRange] = useState(43200);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");

  const [windowBounds, setWindowBounds] = useState<WindowBounds | null>(null);
  const [timeline, setTimeline] = useState<GcpTimelineResponse | null>(null);
  const [snapshot, setSnapshot] = useState<GcpReplaySnapshot | null>(null);
  const [serviceDirectory, setServiceDirectory] = useState<GcpObservedService[]>([]);
  const [historyStatus, setHistoryStatus] = useState<GcpHistoryStatus | null>(null);
  const [replayCursor, setReplayCursor] = useState<string | null>(null);
  const [collectionErrors, setCollectionErrors] = useState<Record<string, string>>({});

  const [selectedIncident, setSelectedIncident] =
    useState<GcpSecurityIncident | null>(null);
  const [selectedEvent, setSelectedEvent] =
    useState<GcpSecurityEvent | null>(null);

  const [configError, setConfigError] = useState<string | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const replayCursorRef = useRef<string | null>(null);
  const lastHistoryRangeRef = useRef(43200);

  useEffect(() => {
    replayCursorRef.current = replayCursor;
  }, [replayCursor]);

  const rangeConfig = TIME_RANGE_CONFIG[timeRange] ?? TIME_RANGE_CONFIG[43200];
  const replayWindowLabel = describeReplayWindow(
    replayCursor ?? timeline?.end ?? snapshot?.cursor ?? null,
    rangeConfig.replayWindowMinutes
  );

  const summary = snapshot?.summary ?? null;
  const services = snapshot?.services ?? [];
  const events = snapshot?.events ?? [];
  const incidents = snapshot?.incidents ?? [];
  const geoData = snapshot?.map ?? [];
  const perimeterEvents = events.filter((event) =>
    ["cloud_armor", "load_balancer", "iam_audit", "iap"].includes(event.source)
  );

  const projectId = projectIdFromState(snapshot, summary, serviceDirectory);
  const regionList = useMemo(
    () =>
      [...new Set(serviceDirectory.map((service) => service.region).filter(Boolean))].sort(),
    [serviceDirectory]
  );
  const serviceNameList = useMemo(
    () =>
      [...new Set(serviceDirectory.map((service) => service.service_name).filter(Boolean))].sort(),
    [serviceDirectory]
  );

  const estateEmptyStateMessage =
    collectionErrors.discovery ||
    (Object.keys(collectionErrors).length > 0
      ? "Discovery completed with collection issues. Resolve the errors above and refresh."
      : historyEmptyState(historyStatus));

  const applyConfigError = useCallback((error: unknown) => {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    if (
      message.includes("GCP project not configured") ||
      message.includes("HTTP 400")
    ) {
      setConfigError(
        "GCP project not configured. Open Settings and provide a project ID plus service account key."
      );
      return true;
    }
    return false;
  }, []);

  const loadRangeData = useCallback(
    async (options?: { forceNow?: boolean }) => {
      const nextBounds = computeWindowBounds(timeRange);
      setWindowBounds(nextBounds);
      setLoadingTimeline(true);
      setConfigError(null);

      try {
        await ensureGcpCollection().catch(() => undefined);

        if (mode === "history") {
          const ensured = await ensureGcpHistory(30).catch(() => null);
          if (ensured?.history_status) {
            setHistoryStatus(ensured.history_status);
          }
        }

        const [directory, timelineResponse] = await Promise.all([
          getGcpEstateServices({ cursor: nextBounds.end }),
          getGcpEstateTimeline({
            start: nextBounds.start,
            end: nextBounds.end,
            bucket: rangeConfig.bucket,
            ...(selectedService ? { service: selectedService } : {}),
            ...(selectedRegion ? { region: selectedRegion } : {}),
          }),
        ]);

        setServiceDirectory(directory);
        setTimeline(timelineResponse);
        setHistoryStatus({
          coverage_start: timelineResponse.coverage_start,
          coverage_end: timelineResponse.coverage_end,
          history_ready: timelineResponse.history_ready,
          backfill_status: timelineResponse.backfill_status,
        });

        const nextCursor =
          options?.forceNow ||
          mode === "live" ||
          !withinBounds(replayCursorRef.current, nextBounds)
            ? nextBounds.end
            : replayCursorRef.current;

        setReplayCursor(nextCursor);
      } catch (error) {
        if (!applyConfigError(error)) {
          console.error("Failed to load timeline", error);
        }
      } finally {
        setLoadingTimeline(false);
      }
    },
    [applyConfigError, mode, rangeConfig.bucket, selectedRegion, selectedService, timeRange]
  );

  const loadSnapshot = useCallback(async () => {
    if (!windowBounds || !replayCursor) {
      return;
    }

    setLoadingSnapshot(true);
    setConfigError(null);

    try {
      const replaySnapshot = await getGcpEstateReplaySnapshot({
        start: windowBounds.start,
        end: windowBounds.end,
        cursor: replayCursor,
        window_minutes: rangeConfig.replayWindowMinutes,
        ...(selectedService ? { service: selectedService } : {}),
        ...(selectedRegion ? { region: selectedRegion } : {}),
        ...(selectedSource ? { source: selectedSource } : {}),
        ...(selectedSeverity ? { severity: selectedSeverity } : {}),
      });

      setSnapshot(replaySnapshot);
      setCollectionErrors(replaySnapshot.summary.collection_errors ?? {});
      setHistoryStatus(replaySnapshot.history_status);
      setLastSync(new Date().toLocaleTimeString());
    } catch (error) {
      if (!applyConfigError(error)) {
        console.error("Failed to load replay snapshot", error);
      }
    } finally {
      setLoadingSnapshot(false);
    }
  }, [
    applyConfigError,
    rangeConfig.replayWindowMinutes,
    replayCursor,
    selectedRegion,
    selectedService,
    selectedSeverity,
    selectedSource,
    windowBounds,
  ]);

  useEffect(() => {
    void loadRangeData({ forceNow: mode === "live" });
  }, [loadRangeData, mode]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (mode !== "live") return;

    const timer = window.setInterval(() => {
      void loadRangeData({ forceNow: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [loadRangeData, mode]);

  useEffect(() => {
    if (!isPlaying || !timeline) return;

    const stepMs =
      timeline.bucket === "6h"
        ? 6 * 60 * 60 * 1000
        : timeline.bucket === "1h"
          ? 60 * 60 * 1000
          : 5 * 60 * 1000;
    const maxTs = new Date(timeline.end).getTime();

    const timer = window.setInterval(() => {
      setReplayCursor((current) => {
        const currentTs = current ? new Date(current).getTime() : maxTs;
        const nextTs = Math.min(maxTs, currentTs + stepMs * playbackSpeed);
        if (nextTs >= maxTs) {
          setIsPlaying(false);
        }
        return new Date(nextTs).toISOString();
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, timeline]);

  const onGcpSecurityEvent = useCallback(
    (event: GcpSecurityEvent) => {
      if (mode !== "live") return;
      setSnapshot((current) => {
        if (!current) return current;
        return {
          ...current,
          events: [event, ...current.events].slice(0, 200),
        };
      });
    },
    [mode]
  );

  const onGcpIncidentUpdate = useCallback(
    (incident: GcpSecurityIncident) => {
      if (mode !== "live") return;
      setSnapshot((current) => {
        if (!current) return current;
        const existingIndex = current.incidents.findIndex(
          (candidate) => candidate.id === incident.id
        );
        const nextIncidents = [...current.incidents];
        if (existingIndex >= 0) {
          nextIncidents[existingIndex] = incident;
        } else {
          nextIncidents.unshift(incident);
        }
        return {
          ...current,
          incidents: nextIncidents.slice(0, 100),
        };
      });
    },
    [mode]
  );

  const onGcpEstateSnapshot = useCallback(
    (incoming: GcpEstateSummary) => {
      if (mode !== "live") return;
      setSnapshot((current) =>
        current
          ? {
              ...current,
              summary: {
                ...current.summary,
                ...incoming,
              },
            }
          : current
      );
    },
    [mode]
  );

  const { connected } = useSocket(
    {
      onGcpSecurityEvent,
      onGcpIncidentUpdate,
      onGcpEstateSnapshot,
    },
    cloudRunUrl,
    mode === "live"
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await triggerGcpRefresh().catch(() => undefined);
      await ensureGcpCollection().catch(() => undefined);
      if (mode === "history") {
        await ensureGcpHistory(30).catch(() => undefined);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await loadRangeData({ forceNow: mode === "live" });
    } finally {
      setRefreshing(false);
    }
  }, [loadRangeData, mode]);

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

  const handleTimeRangeChange = useCallback(
    (value: number) => {
      setIsPlaying(false);
      if (value !== 15) {
        lastHistoryRangeRef.current = value;
      }
      if (mode === "live" && value !== 15) {
        setMode("history");
      }
      setTimeRange(value);
    },
    [mode]
  );

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

  const handleJumpStart = useCallback(() => {
    if (!timeline?.start) return;
    setIsPlaying(false);
    setReplayCursor(timeline.start);
  }, [timeline?.start]);

  const handleJumpNow = useCallback(() => {
    if (!timeline?.end) return;
    setIsPlaying(false);
    setReplayCursor(timeline.end);
  }, [timeline?.end]);

  const loading = (loadingTimeline || loadingSnapshot) && !configError && !snapshot;

  if (loading) {
    return (
      <div
        style={{
          background: socColors.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(720px, 100%)",
            background: socColors.bgCard,
            border: `1px solid ${socColors.border}`,
            borderRadius: 36,
            padding: 32,
            boxShadow: socColors.shadow,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: socColors.text,
              fontFamily: typography.fontDisplay,
            }}
          >
            {mode === "history"
              ? "Loading 30-day historical posture"
              : "Connecting live monitoring"}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              color: socColors.textDim,
              lineHeight: 1.6,
            }}
          >
            {mode === "history"
              ? "Preparing timeline coverage, replay snapshots, and backfill status."
              : "Syncing the latest 15-minute window from GCP security telemetry."}
          </div>
          <div
            style={{
              marginTop: 24,
              height: 12,
              borderRadius: 999,
              background: socColors.bgPanel,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "32%",
                height: "100%",
                borderRadius: 999,
                background: socColors.accent,
                animation: "liveMonitorLoading 1.2s ease-in-out infinite alternate",
              }}
            />
          </div>
          <style>{`
            @keyframes liveMonitorLoading {
              from { transform: translateX(0); }
              to { transform: translateX(180%); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div
        style={{
          background: socColors.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(640px, 100%)",
            background: socColors.bgCard,
            border: `1px solid ${socColors.border}`,
            borderRadius: 36,
            padding: 32,
            boxShadow: socColors.shadow,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: socColors.text,
              fontFamily: typography.fontDisplay,
            }}
          >
            GCP Live Monitor needs configuration
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 15,
              color: socColors.textDim,
              lineHeight: 1.7,
            }}
          >
            {configError}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: socColors.bg,
        minHeight: "100vh",
        color: socColors.text,
      }}
    >
      <CommandBar
        projectId={projectId}
        mode={mode}
        historyStatus={historyStatus}
        selectedRegion={selectedRegion}
        regions={regionList}
        selectedService={selectedService}
        services={serviceNameList}
        selectedSource={selectedSource}
        selectedSeverity={selectedSeverity}
        timeRange={timeRange}
        socketConnected={connected}
        lastSync={lastSync}
        refreshing={refreshing}
        replayCursor={replayCursor}
        timelineStart={timeline?.start ?? windowBounds?.start ?? null}
        timelineEnd={timeline?.end ?? windowBounds?.end ?? null}
        playbackSpeed={playbackSpeed}
        isPlaying={isPlaying}
        onModeChange={handleModeChange}
        onRegionChange={setSelectedRegion}
        onServiceChange={setSelectedService}
        onSourceChange={setSelectedSource}
        onSeverityChange={setSelectedSeverity}
        onTimeRangeChange={handleTimeRangeChange}
        onRefresh={handleRefresh}
        onReplayCursorChange={handleReplayCursorChange}
        onTogglePlayback={() => setIsPlaying((current) => !current)}
        onPlaybackSpeedChange={setPlaybackSpeed}
        onJumpStart={handleJumpStart}
        onJumpNow={handleJumpNow}
      />

      <div
        className="live-monitor-shell"
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          marginRight: selectedIncident || selectedEvent ? 460 : "auto",
          transition: "margin-right 180ms ease",
        }}
      >
        <HeroSurface
          mode={mode}
          projectId={projectId}
          historyStatus={historyStatus}
          replayCursor={replayCursor}
          replayWindowLabel={replayWindowLabel}
          timeline={timeline}
        />

        <HeroKpiRow
          summary={summary}
          mode={mode}
          replayWindowLabel={replayWindowLabel}
        />

        {Object.keys(collectionErrors).length > 0 && (
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,244,229,0.95) 0%, rgba(255,249,240,0.95) 100%)",
              border: `1px solid rgba(194, 100, 1, 0.28)`,
              borderRadius: 28,
              padding: 18,
              color: socColors.high,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Data collection issues
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(collectionErrors).map(([source, message]) => (
                <div key={source} style={{ fontSize: 13, lineHeight: 1.6, color: socColors.text }}>
                  <strong style={{ color: socColors.high }}>{source}:</strong> {message}
                </div>
              ))}
            </div>
          </div>
        )}

        <EstateMatrix
          services={services}
          selectedService={selectedService}
          mode={mode}
          replayWindowLabel={replayWindowLabel}
          onSelectService={(serviceName) =>
            setSelectedService((current) =>
              current === serviceName ? "" : serviceName
            )
          }
          emptyStateMessage={estateEmptyStateMessage}
        />

        <div
          className="live-monitor-two-column"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.7fr) minmax(360px, 0.9fr)",
            gap: 18,
          }}
        >
          <GlobalThreatTimeline
            points={timeline?.points ?? []}
            markers={timeline?.markers ?? []}
            cursor={replayCursor}
            loading={loadingTimeline}
            emptyState={historyEmptyState(historyStatus)}
            onSelectTimestamp={handleReplayCursorChange}
          />
          <GeoAttackMap data={geoData} />
        </div>

        <PerimeterLanes
          events={perimeterEvents}
          counts={snapshot?.perimeter}
          mode={mode}
          replayWindowLabel={replayWindowLabel}
        />

        <div
          className="live-monitor-two-column"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.7fr) minmax(360px, 0.9fr)",
            gap: 18,
          }}
        >
          <LiveEvidenceFeed
            events={events}
            mode={mode}
            replayWindowLabel={replayWindowLabel}
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEvent?.id ?? null}
          />
          <IncidentQueue
            incidents={incidents}
            mode={mode}
            replayWindowLabel={replayWindowLabel}
            selectedIncidentId={selectedIncident?.id ?? null}
            onSelectIncident={handleSelectIncident}
          />
        </div>
      </div>

      <TriageDrawer
        incident={selectedIncident}
        selectedEvent={selectedEvent}
        onClose={handleCloseDrawer}
      />

      <style>{`
        @media (max-width: 1280px) {
          .live-monitor-two-column,
          .live-monitor-hero {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .live-monitor-shell {
            margin-right: auto !important;
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
}

function HeroSurface({
  mode,
  projectId,
  historyStatus,
  replayCursor,
  replayWindowLabel,
  timeline,
}: {
  mode: LiveMonitorMode;
  projectId: string;
  historyStatus: GcpHistoryStatus | null;
  replayCursor: string | null;
  replayWindowLabel: string;
  timeline: GcpTimelineResponse | null;
}) {
  const pointsCount = timeline?.points.length ?? 0;
  const markersCount = timeline?.markers.length ?? 0;

  return (
    <div
      className="live-monitor-hero"
      style={{
        borderRadius: 36,
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(232,240,254,0.95) 0%, rgba(255,255,255,0.92) 38%), linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(244,247,252,0.98) 100%)",
        border: `1px solid ${socColors.border}`,
        boxShadow: socColors.shadow,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 0.8fr)",
        gap: 18,
      }}
    >
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            background: socColors.accentSoft,
            color: socColors.accent,
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {mode === "history" ? "Historical posture" : "Live watch"}
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: typography.fontDisplay,
            fontSize: 28,
            lineHeight: 1.2,
            fontWeight: 700,
            color: socColors.text,
          }}
        >
          {mode === "history"
            ? "Defaulting to the last 30 days with full-page replay controls."
            : "Focused on the most recent 15 minutes with live updates enabled."}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            color: socColors.textMuted,
            lineHeight: 1.7,
            maxWidth: 780,
          }}
        >
          {projectId || "No project configured"} · {replayWindowLabel} · Coverage{" "}
          {formatTimestamp(historyStatus?.coverage_start ?? null)} to{" "}
          {formatTimestamp(historyStatus?.coverage_end ?? null)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <HeroStat label="Replay Cursor" value={formatTimestamp(replayCursor)} />
        <HeroStat label="Backfill State" value={historyStatus?.backfill_status?.status || (historyStatus?.history_ready ? "complete" : "idle")} />
        <HeroStat label="Timeline Buckets" value={String(pointsCount)} />
        <HeroStat label="Markers" value={String(markersCount)} />
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.74)",
        border: `1px solid ${socColors.border}`,
        borderRadius: 24,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: socColors.textDim,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 14,
          color: socColors.text,
          fontWeight: 700,
          lineHeight: 1.45,
        }}
      >
        {value}
      </div>
    </div>
  );
}
