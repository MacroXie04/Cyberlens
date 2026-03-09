import { useMemo } from "react";

import { useLiveMonitorControls } from "./useLiveMonitorControls";
import { useLiveMonitorData } from "./useLiveMonitorData";
import { useLiveMonitorSocket } from "./useLiveMonitorSocket";
import { historyEmptyState, projectIdFromState, replayWindowLabelFor } from "../lib/timeWindow";

export function useLiveMonitorState(cloudRunUrl?: string | null) {
  const controls = useLiveMonitorControls();
  const data = useLiveMonitorData({
    mode: controls.mode,
    replayCursor: controls.replayCursor,
    replayCursorRef: controls.replayCursorRef,
    selectedRegion: controls.selectedRegion,
    selectedService: controls.selectedService,
    selectedSeverity: controls.selectedSeverity,
    selectedSource: controls.selectedSource,
    setReplayCursor: controls.setReplayCursor,
    timeRange: controls.timeRange,
  });
  const { connected } = useLiveMonitorSocket({ cloudRunUrl, mode: controls.mode, setSnapshot: data.setSnapshot });

  const summary = data.snapshot?.summary ?? null;
  const services = data.snapshot?.services ?? [];
  const events = data.snapshot?.events ?? [];
  const incidents = data.snapshot?.incidents ?? [];
  const geoData = data.snapshot?.map ?? [];
  const perimeterEvents = events.filter((event) => ["cloud_armor", "load_balancer", "iam_audit", "iap"].includes(event.source));
  const estateEmptyStateMessage = data.collectionErrors.discovery || (Object.keys(data.collectionErrors).length > 0 ? "Discovery completed with collection issues. Resolve the errors above and refresh." : historyEmptyState(data.historyStatus));
  const projectId = projectIdFromState(data.snapshot, summary, data.serviceDirectory);
  const replayWindowLabel = replayWindowLabelFor(controls.timeRange, controls.replayCursor, data.timeline, data.snapshot);
  const regionList = useMemo(() => [...new Set(data.serviceDirectory.map((service) => service.region).filter(Boolean))].sort(), [data.serviceDirectory]);
  const serviceNameList = useMemo(() => [...new Set(data.serviceDirectory.map((service) => service.service_name).filter(Boolean))].sort(), [data.serviceDirectory]);
  const loading = (data.loadingTimeline || data.loadingSnapshot) && !data.configError && !data.snapshot;

  return { connected, controls, data, estateEmptyStateMessage, events, geoData, incidents, loading, perimeterEvents, projectId, regionList, replayWindowLabel, serviceNameList, services, summary };
}
