import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  AdkTraceEvent,
  CodeScanStreamEvent,
} from "../types";

interface SocketEvents {
  onScanProgress?: (data: { scan_id: number; step: string; message: string }) => void;
  onScanComplete?: (data: { scan_id: number; status: string; message: string }) => void;
  onCodeScanStream?: (data: CodeScanStreamEvent) => void;
  onAdkTraceStream?: (data: AdkTraceEvent) => void;
}

export function useSocket(
  events: SocketEvents = {},
  enabled = true
) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

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

    return () => {
      socket.disconnect();
    };
  }, [enabled]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { connected, emit };
}
