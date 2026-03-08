import { useState, useCallback, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import { getStatsOverview, getStatsTimeline, getStatsGeo, getRequests } from "../services/api";
import type { HttpRequest, StatsOverview, TimelinePoint, GeoData } from "../types";
import StatsRow from "../components/LiveMonitor/StatsRow";
import AttackMap from "../components/LiveMonitor/AttackMap";
import ThreatDistribution from "../components/LiveMonitor/ThreatDistribution";
import TrafficTrend from "../components/LiveMonitor/TrafficTrend";
import AttackTypes from "../components/LiveMonitor/AttackTypes";
import LiveRequestStream from "../components/LiveMonitor/LiveRequestStream";
import AiAnalysisPanel from "../components/LiveMonitor/AiAnalysisPanel";

interface Props {
  cloudRunUrl?: string | null;
}

export default function LiveMonitorPage({ cloudRunUrl }: Props) {
  const [stats, setStats] = useState<StatsOverview>({
    total_requests: 0,
    threats_detected: 0,
    malicious_count: 0,
    ai_analyzed: 0,
  });
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [geoData, setGeoData] = useState<GeoData[]>([]);
  const [requests, setRequests] = useState<HttpRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<HttpRequest | null>(null);

  // Load initial data (re-fetch when cloudRunUrl changes)
  useEffect(() => {
    getStatsOverview().then(setStats).catch(console.error);
    getStatsTimeline().then(setTimeline).catch(console.error);
    getStatsGeo().then(setGeoData).catch(console.error);
    getRequests().then((data) => setRequests(data.results)).catch(console.error);
  }, [cloudRunUrl]);

  // Real-time updates via WebSocket
  const onNewRequest = useCallback((req: HttpRequest) => {
    setRequests((prev) => [req, ...prev].slice(0, 100));
  }, []);

  const onStatsUpdate = useCallback((update: StatsOverview) => {
    setStats(update);
  }, []);

  useSocket({ onNewRequest, onStatsUpdate }, cloudRunUrl);

  // Compute attack type distribution from requests
  const attackTypes = requests.reduce<Record<string, number>>((acc, req) => {
    const type = req.analysis?.threat_type;
    if (type && type !== "none") {
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {});

  const attackTypeData = Object.entries(attackTypes).map(([type, count]) => ({
    type: type.replace(/_/g, " "),
    count,
  }));

  // Compute threat distribution
  const threatCounts = requests.reduce(
    (acc, req) => {
      const level = req.analysis?.threat_level || "safe";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    { safe: 0, suspicious: 0, malicious: 0 } as Record<string, number>
  );

  return (
    <div className="dashboard-grid" style={{ padding: 24 }}>
      {/* Stats Row */}
      <StatsRow stats={stats} />

      {/* Spatial Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <AttackMap data={geoData} />
        <ThreatDistribution
          safe={threatCounts.safe}
          suspicious={threatCounts.suspicious}
          malicious={threatCounts.malicious}
        />
      </div>

      {/* Trends Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <TrafficTrend data={timeline} />
        <AttackTypes data={attackTypeData} />
      </div>

      {/* Details Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <LiveRequestStream requests={requests} onSelect={setSelectedRequest} />
        <AiAnalysisPanel request={selectedRequest} />
      </div>
    </div>
  );
}
