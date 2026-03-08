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

  // Derived data
  const projectId = summary?.project_id || "";
  const regionList = [
    ...new Set(services.map((s) => s.region).filter(Boolean)),
  ].sort();
  const serviceNameList = [
    ...new Set(services.map((s) => s.service_name).filter(Boolean)),
  ].sort();

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

  // Fetch data
  const fetchData = useCallback(
    async (minutes: number) => {
      try {
        setConfigError(null);
        const [summaryData, servicesData, timeseriesData, eventsData, incidentData, mapData] =
          await Promise.all([
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
        setSummary(summaryData);
        setServices(servicesData);
        setTimeseries(timeseriesData);
        setEvents(eventsData.results);
        setIncidents(incidentData);
        setGeoData(mapData);
        setLastSync(new Date().toLocaleTimeString());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("not configured") || msg.includes("HTTP 400")) {
          setConfigError(
            "GCP project not configured. Go to Settings to set up your GCP service account and project ID."
          );
        }
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

  const handleRefresh = useCallback(() => {
    triggerGcpRefresh().catch(console.error);
    fetchData(timeRange);
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

        {/* Estate Matrix */}
        <EstateMatrix
          services={services}
          selectedService={selectedService}
          onSelectService={setSelectedService}
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
