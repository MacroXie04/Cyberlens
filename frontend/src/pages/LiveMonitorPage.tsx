import { useState, useCallback, useEffect, useRef } from "react";
import { useSocket } from "../hooks/useSocket";
import {
  getGcpEstateSummary,
  getGcpEstateServices,
  getGcpEstateTimeseries,
  getGcpSecurityEvents,
  getGcpSecurityIncidents,
  getGcpSecurityMap,
  triggerGcpRefresh,
  ensureGcpCollection,
} from "../services/api";
import type {
  GcpEstateSummary,
  GcpObservedService,
  GcpSecurityEvent,
  GcpSecurityIncident,
  GcpServiceHealth,
  GcpGeoThreatPoint,
} from "../types";
import { socColors } from "../theme/theme";
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

export default function LiveMonitorPage({ cloudRunUrl }: Props) {
  // GCP estate state
  const [summary, setSummary] = useState<GcpEstateSummary | null>(null);
  const [services, setServices] = useState<GcpObservedService[]>([]);
  const [timeseries, setTimeseries] = useState<GcpServiceHealth[]>([]);
  const [events, setEvents] = useState<GcpSecurityEvent[]>([]);
  const [incidents, setIncidents] = useState<GcpSecurityIncident[]>([]);
  const [geoData, setGeoData] = useState<GcpGeoThreatPoint[]>([]);

  // Filters
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [timeRange, setTimeRange] = useState(15);

  // Drawer state
  const [selectedIncident, setSelectedIncident] =
    useState<GcpSecurityIncident | null>(null);
  const [selectedEvent, setSelectedEvent] =
    useState<GcpSecurityEvent | null>(null);

  // Sync status
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collectionErrors, setCollectionErrors] = useState<Record<string, string>>({});

  // Derived data
  const projectId = summary?.project_id || "";
  const regionList = [
    ...new Set(services.map((s) => s.region).filter(Boolean)),
  ].sort();
  const serviceNameList = [
    ...new Set(services.map((s) => s.service_name).filter(Boolean)),
  ].sort();
  const estateEmptyStateMessage =
    collectionErrors.discovery ||
    (Object.keys(collectionErrors).length > 0
      ? "No Cloud Run services discovered yet. Resolve the data collection issues above and refresh."
      : undefined);

  // Perimeter events (filtered for perimeter lane sources)
  const perimeterEvents = events.filter(
    (e) =>
      e.source === "cloud_armor" ||
      e.source === "load_balancer" ||
      e.source === "iam_audit" ||
      e.source === "iap"
  );

  // Apply local filters to events
  const filteredEvents = events.filter((e) => {
    if (selectedRegion && e.region !== selectedRegion) return false;
    if (selectedService && e.service !== selectedService) return false;
    if (selectedSource && e.source !== selectedSource) return false;
    if (selectedSeverity && e.severity !== selectedSeverity) return false;
    return true;
  });

  // Fetch data — use allSettled so one failing endpoint doesn't block others
  const fetchData = useCallback(
    async (minutes: number) => {
      try {
        setConfigError(null);
        try {
          await ensureGcpCollection();
        } catch (err) {
          console.error("GCP collection bootstrap failed:", err);
        }

        const [summaryRes, servicesRes, timeseriesRes, eventsRes, incidentRes, mapRes] =
          await Promise.allSettled([
            getGcpEstateSummary(minutes),
            getGcpEstateServices(),
            getGcpEstateTimeseries({ minutes }),
            getGcpSecurityEvents({
              minutes,
              limit: 500,
              ...(selectedSource ? { source: selectedSource } : {}),
              ...(selectedSeverity ? { severity: selectedSeverity } : {}),
              ...(selectedService ? { service: selectedService } : {}),
            }),
            getGcpSecurityIncidents(),
            getGcpSecurityMap(minutes),
          ]);

        // Check if the summary call indicates a config error
        if (summaryRes.status === "rejected") {
          const msg = summaryRes.reason instanceof Error
            ? summaryRes.reason.message
            : String(summaryRes.reason);
          if (msg.includes("not configured") || msg.includes("HTTP 400")) {
            setConfigError(
              "GCP project not configured. Go to Settings to set up your GCP service account and project ID."
            );
            return;
          }
        }

        if (summaryRes.status === "fulfilled") {
          setSummary(summaryRes.value);
          setCollectionErrors(summaryRes.value.collection_errors ?? {});
        }
        if (servicesRes.status === "fulfilled") setServices(servicesRes.value);
        if (timeseriesRes.status === "fulfilled") setTimeseries(timeseriesRes.value);
        if (eventsRes.status === "fulfilled") setEvents(eventsRes.value.results);
        if (incidentRes.status === "fulfilled") setIncidents(incidentRes.value);
        if (mapRes.status === "fulfilled") setGeoData(mapRes.value);
        setLastSync(new Date().toLocaleTimeString());
      } catch (err: unknown) {
        console.error("Unexpected fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [selectedSource, selectedSeverity, selectedService]
  );

  // Initial load + refetch on filter changes
  useEffect(() => {
    fetchData(timeRange);
  }, [fetchData, timeRange]);

  // Auto-refresh polling (every 5s for events)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchData(timeRange);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, timeRange]);

  // Socket.IO handlers
  const onGcpSecurityEvent = useCallback(
    (evt: GcpSecurityEvent) => {
      setEvents((prev) => [evt, ...prev].slice(0, 500));
    },
    []
  );

  const onGcpIncidentUpdate = useCallback(
    (inc: GcpSecurityIncident) => {
      setIncidents((prev) => {
        const idx = prev.findIndex((p) => p.id === inc.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = inc;
          return next;
        }
        return [inc, ...prev];
      });
    },
    []
  );

  const onGcpEstateSnapshot = useCallback(
    (data: GcpEstateSummary) => {
      setSummary(data);
    },
    []
  );

  const { connected } = useSocket(
    {
      onGcpSecurityEvent,
      onGcpIncidentUpdate,
      onGcpEstateSnapshot,
    },
    cloudRunUrl
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await triggerGcpRefresh();
      // Wait briefly for tasks to execute before re-fetching
      await new Promise((r) => setTimeout(r, 2000));
      await fetchData(timeRange);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, timeRange]);

  const handleSelectEvent = useCallback((evt: GcpSecurityEvent) => {
    setSelectedEvent(evt);
    setSelectedIncident(null);
  }, []);

  const handleSelectIncident = useCallback((inc: GcpSecurityIncident) => {
    setSelectedIncident(inc);
    setSelectedEvent(null);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedIncident(null);
    setSelectedEvent(null);
  }, []);

  // Loading state — first fetch hasn't completed yet
  if (loading && !configError) {
    return (
      <div
        style={{
          background: socColors.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: socColors.text,
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: `3px solid ${socColors.border}`,
            borderTop: `3px solid ${socColors.accent}`,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: socColors.textMuted, fontSize: 14 }}>
          Connecting to GCP Security Dashboard...
        </span>
      </div>
    );
  }

  // If GCP not configured, show setup prompt
  if (configError) {
    return (
      <div
        style={{
          background: socColors.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: socColors.text,
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            background: socColors.bgCard,
            border: `1px solid ${socColors.border}`,
            borderRadius: 12,
            padding: 32,
            maxWidth: 500,
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>
            GCP Security Dashboard
          </h2>
          <p
            style={{
              margin: 0,
              color: socColors.textMuted,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {configError}
          </p>
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
      {/* Command Bar */}
      <CommandBar
        projectId={projectId}
        selectedRegion={selectedRegion}
        regions={regionList}
        selectedService={selectedService}
        services={serviceNameList}
        selectedSource={selectedSource}
        selectedSeverity={selectedSeverity}
        timeRange={timeRange}
        socketConnected={connected}
        lastSync={lastSync}
        onRegionChange={setSelectedRegion}
        onServiceChange={setSelectedService}
        onSourceChange={setSelectedSource}
        onSeverityChange={setSelectedSeverity}
        onTimeRangeChange={setTimeRange}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* Dashboard grid */}
      <div
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          // Account for triage drawer when open
          marginRight:
            selectedIncident || selectedEvent ? 440 : 0,
          transition: "margin-right 200ms",
        }}
      >
        {/* Hero KPI row */}
        <HeroKpiRow summary={summary} />

        {/* Collection error banner */}
        {Object.keys(collectionErrors).length > 0 && (
          <div
            style={{
              background: "rgba(251, 191, 36, 0.1)",
              border: "1px solid rgba(251, 191, 36, 0.4)",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              color: "#fbbf24",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>
              Data collection issues
            </strong>
            {Object.entries(collectionErrors).map(([source, msg]) => (
              <div key={source} style={{ color: "rgba(251, 191, 36, 0.85)" }}>
                <strong>{source}:</strong> {msg}
              </div>
            ))}
          </div>
        )}

        {/* Estate Matrix */}
        <EstateMatrix
          services={services}
          selectedService={selectedService}
          onSelectService={setSelectedService}
          emptyStateMessage={estateEmptyStateMessage}
        />

        {/* Timeline + Map row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
          }}
        >
          <GlobalThreatTimeline data={timeseries} />
          <GeoAttackMap data={geoData} />
        </div>

        {/* Perimeter Lanes */}
        <PerimeterLanes events={perimeterEvents} />

        {/* Evidence Feed + Incident Queue row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
          }}
        >
          <LiveEvidenceFeed
            events={filteredEvents}
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEvent?.id ?? null}
          />
          <IncidentQueue
            incidents={incidents}
            selectedIncidentId={selectedIncident?.id ?? null}
            onSelectIncident={handleSelectIncident}
          />
        </div>
      </div>

      {/* Triage Drawer */}
      <TriageDrawer
        incident={selectedIncident}
        selectedEvent={selectedEvent}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
