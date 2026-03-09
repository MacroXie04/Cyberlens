import { useEffect, useMemo } from "react";

import CommandBar from "../../../components/LiveMonitor/CommandBar";
import EstateMatrix from "../../../components/LiveMonitor/EstateMatrix";
import GeoAttackMap from "../../../components/LiveMonitor/GeoAttackMap";
import GlobalThreatTimeline from "../../../components/LiveMonitor/GlobalThreatTimeline";
import HeroKpiRow from "../../../components/LiveMonitor/HeroKpiRow";
import IncidentQueue from "../../../components/LiveMonitor/IncidentQueue";
import LiveEvidenceFeed from "../../../components/LiveMonitor/LiveEvidenceFeed";
import PerimeterLanes from "../../../components/LiveMonitor/PerimeterLanes";
import TriageDrawer from "../../../components/LiveMonitor/TriageDrawer";
import HeroSurface from "../components/HeroSurface";
import { CollectionIssuesBanner, ConfigMonitorState, LoadingMonitorState } from "../components/MonitorEmptyState";
import { historyEmptyState } from "../lib/timeWindow";
import { useLiveMonitorState } from "../hooks/useLiveMonitorState";

interface Props {
  cloudRunUrl?: string | null;
}

export default function LiveMonitorPage({ cloudRunUrl }: Props) {
  const state = useLiveMonitorState(cloudRunUrl);
  const { controls, data, connected, estateEmptyStateMessage, events, geoData, incidents, loading, perimeterEvents, projectId, regionList, replayWindowLabel, serviceNameList, services, summary } = state;
  const timeline = data.timeline;

  const playbackStepMs = useMemo(() => timeline?.bucket === "6h" ? 6 * 60 * 60 * 1000 : timeline?.bucket === "1h" ? 60 * 60 * 1000 : 5 * 60 * 1000, [timeline?.bucket]);

  useEffect(() => {
    if (!controls.isPlaying || !timeline) return;
    const maxTs = new Date(timeline.end).getTime();
    const timer = window.setInterval(() => {
      controls.setReplayCursor((current) => {
        const currentTs = current ? new Date(current).getTime() : maxTs;
        const nextTs = Math.min(maxTs, currentTs + playbackStepMs * controls.playbackSpeed);
        if (nextTs >= maxTs) controls.actions.setIsPlaying(false);
        return new Date(nextTs).toISOString();
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [controls, playbackStepMs, timeline]);

  if (loading) return <LoadingMonitorState historyMode={controls.mode === "history"} />;
  if (data.configError) return <ConfigMonitorState message={data.configError} />;

  return (
    <div style={{ background: "var(--soc-bg, #f6f8fb)", minHeight: "100vh", color: "var(--soc-text, #0f172a)" }}>
      <CommandBar
        projectId={projectId}
        mode={controls.mode}
        historyStatus={data.historyStatus}
        selectedRegion={controls.selectedRegion}
        regions={regionList}
        selectedService={controls.selectedService}
        services={serviceNameList}
        selectedSource={controls.selectedSource}
        selectedSeverity={controls.selectedSeverity}
        timeRange={controls.timeRange}
        socketConnected={connected}
        lastSync={data.lastSync}
        refreshing={data.refreshing}
        replayCursor={controls.replayCursor}
        timelineStart={timeline?.start ?? data.windowBounds?.start ?? null}
        timelineEnd={timeline?.end ?? data.windowBounds?.end ?? null}
        playbackSpeed={controls.playbackSpeed}
        isPlaying={controls.isPlaying}
        onModeChange={controls.actions.handleModeChange}
        onRegionChange={controls.actions.setSelectedRegion}
        onServiceChange={controls.actions.setSelectedService}
        onSourceChange={controls.actions.setSelectedSource}
        onSeverityChange={controls.actions.setSelectedSeverity}
        onTimeRangeChange={controls.actions.handleTimeRangeChange}
        onRefresh={data.handleRefresh}
        onReplayCursorChange={controls.actions.handleReplayCursorChange}
        onTogglePlayback={() => controls.actions.setIsPlaying((current) => !current)}
        onPlaybackSpeedChange={controls.setPlaybackSpeed}
        onJumpStart={() => timeline?.start && (controls.actions.setIsPlaying(false), controls.setReplayCursor(timeline.start))}
        onJumpNow={() => timeline?.end && (controls.actions.setIsPlaying(false), controls.setReplayCursor(timeline.end))}
      />

      <div className="live-monitor-shell" style={{ maxWidth: 1600, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 18, marginRight: controls.selectedIncident || controls.selectedEvent ? 460 : "auto", transition: "margin-right 180ms ease" }}>
        <HeroSurface mode={controls.mode} projectId={projectId} historyStatus={data.historyStatus} replayCursor={controls.replayCursor} replayWindowLabel={replayWindowLabel} timeline={timeline} />
        <HeroKpiRow summary={summary} mode={controls.mode} replayWindowLabel={replayWindowLabel} />
        <CollectionIssuesBanner errors={data.collectionErrors} />
        <EstateMatrix services={services} selectedService={controls.selectedService} mode={controls.mode} replayWindowLabel={replayWindowLabel} onSelectService={(serviceName) => controls.actions.setSelectedService(controls.selectedService === serviceName ? "" : serviceName)} emptyStateMessage={estateEmptyStateMessage} />
        <div className="live-monitor-two-column" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(360px, 0.9fr)", gap: 18 }}>
          <GlobalThreatTimeline points={timeline?.points ?? []} markers={timeline?.markers ?? []} cursor={controls.replayCursor} loading={data.loadingTimeline} emptyState={historyEmptyState(data.historyStatus)} onSelectTimestamp={controls.actions.handleReplayCursorChange} />
          <GeoAttackMap data={geoData} />
        </div>
        <PerimeterLanes events={perimeterEvents} counts={data.snapshot?.perimeter} mode={controls.mode} replayWindowLabel={replayWindowLabel} />
        <div className="live-monitor-two-column" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(360px, 0.9fr)", gap: 18 }}>
          <LiveEvidenceFeed events={events} mode={controls.mode} replayWindowLabel={replayWindowLabel} onSelectEvent={controls.actions.handleSelectEvent} selectedEventId={controls.selectedEvent?.id ?? null} />
          <IncidentQueue incidents={incidents} mode={controls.mode} replayWindowLabel={replayWindowLabel} selectedIncidentId={controls.selectedIncident?.id ?? null} onSelectIncident={controls.actions.handleSelectIncident} />
        </div>
      </div>

      <TriageDrawer incident={controls.selectedIncident} selectedEvent={controls.selectedEvent} onClose={controls.actions.handleCloseDrawer} />

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
