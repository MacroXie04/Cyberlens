import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { HttpRequest, Alert, StatsOverview } from "../types";

interface SocketEvents {
  onNewRequest?: (data: HttpRequest) => void;
  onAlert?: (data: Alert) => void;
  onStatsUpdate?: (data: StatsOverview) => void;
  onScanProgress?: (data: { scan_id: number; step: string; message: string }) => void;
  onScanComplete?: (data: { scan_id: number; status: string; message: string }) => void;
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

    return () => {
      socket.disconnect();
    };
  }, [remoteUrl]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { connected, emit };
}
