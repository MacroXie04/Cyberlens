import Redis from "ioredis";
import { Server } from "socket.io";

const CHANNELS = [
  "cyberlens:scan_progress",
  "cyberlens:scan_complete",
  "cyberlens:code_scan_stream",
  "cyberlens:adk_trace_stream",
];

const CHANNEL_TO_EVENT: Record<string, string> = {
  "cyberlens:scan_progress": "scan_progress",
  "cyberlens:scan_complete": "scan_complete",
  "cyberlens:code_scan_stream": "code_scan_stream",
  "cyberlens:adk_trace_stream": "adk_trace_stream",
};

export function startRedisSubscriber(io: Server): void {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/0";
  const subscriber = new Redis(redisUrl);

  subscriber.subscribe(...CHANNELS, (err, count) => {
    if (err) {
      console.error("Failed to subscribe to Redis channels:", err);
      return;
    }
    console.log(`Subscribed to ${count} Redis channels`);
  });

  subscriber.on("message", (channel: string, message: string) => {
    const event = CHANNEL_TO_EVENT[channel];
    if (!event) return;

    try {
      const data = JSON.parse(message);
      io.emit(event, data);
    } catch (err) {
      console.error(`Failed to parse message from ${channel}:`, err);
    }
  });

  subscriber.on("error", (err) => {
    console.error("Redis subscriber error:", err);
  });
}
