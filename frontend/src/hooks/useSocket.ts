import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  AdkTraceEvent,
  Alert,
  CodeScanStreamEvent,
  GcpEstateSummary,
  GcpSecurityEvent,
  GcpSecurityIncident,
  GcpServiceHealth,
  GcpThreatTimeseriesPoint,
  HttpRequest,
  StatsOverview,
} from "../types";

interface SocketEvents {
  onNewRequest?: (data: HttpRequest) => void;
  onAlert?: (data: Alert) => void;
  onStatsUpdate?: (data: StatsOverview) => void;
  onScanProgress?: (data: { scan_id: number; step: string; message: string }) => void;
  onScanComplete?: (data: { scan_id: number; status: string; message: string }) => void;
  onCodeScanStream?: (data: CodeScanStreamEvent) => void;
  onAdkTraceStream?: (data: AdkTraceEvent) => void;
  // GCP Estate & Security
  onGcpEstateSnapshot?: (data: GcpEstateSummary) => void;
  onGcpSecurityEvent?: (data: GcpSecurityEvent) => void;
  onGcpIncidentUpdate?: (data: GcpSecurityIncident) => void;
  onGcpServiceHealth?: (data: GcpServiceHealth) => void;
  onGcpTimeseriesUpdate?: (data: GcpThreatTimeseriesPoint[]) => void;
}

export function useSocket(events: SocketEvents = {}, remoteUrl?: string | null) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const isRemote = !!remoteUrl;
    const socket = isRemote
      ? io(remoteUrl, {
          path: "/socket.io",
          transports: ["websocket", "polling"],
          withCredentials: false,
        })
      : io({
          path: "/socket.io",
          transports: ["websocket", "polling"],
          withCredentials: true,
        });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("new_request", (data: HttpRequest) => {
      eventsRef.current.onNewRequest?.(data);
    });

    socket.on("alert", (data: Alert) => {
      eventsRef.current.onAlert?.(data);
    });

    socket.on("stats_update", (data: StatsOverview) => {
      eventsRef.current.onStatsUpdate?.(data);
    });

    socket.on("scan_progress", (data) => {
      eventsRef.current.onScanProgress?.(data);
    });

    socket.on("scan_complete", (data) => {
      eventsRef.current.onScanComplete?.(data);
    });

    socket.on("code_scan_stream", (data: CodeScanStreamEvent) => {
      eventsRef.current.onCodeScanStream?.(data);
    });

    socket.on("adk_trace_stream", (data: AdkTraceEvent) => {
      eventsRef.current.onAdkTraceStream?.(data);
    });

    // GCP Estate & Security events
    socket.on("gcp_estate_snapshot", (data: GcpEstateSummary) => {
      eventsRef.current.onGcpEstateSnapshot?.(data);
    });

    socket.on("gcp_security_event", (data: GcpSecurityEvent) => {
      eventsRef.current.onGcpSecurityEvent?.(data);
    });

    socket.on("gcp_incident_update", (data: GcpSecurityIncident) => {
      eventsRef.current.onGcpIncidentUpdate?.(data);
    });

    socket.on("gcp_service_health", (data: GcpServiceHealth) => {
      eventsRef.current.onGcpServiceHealth?.(data);
    });

    socket.on("gcp_timeseries_update", (data: GcpThreatTimeseriesPoint[]) => {
      eventsRef.current.onGcpTimeseriesUpdate?.(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [remoteUrl]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { connected, emit };
}
