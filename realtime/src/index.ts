import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { startRedisSubscriber } from "./redis-subscriber";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Socket.IO connection handling
io.use(async (socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie;
    if (!cookie) {
      return next(new Error("Authentication error: No cookies provided"));
    }
    const backendUrl = process.env.BACKEND_URL || "http://backend:8000";
    const response = await fetch(`${backendUrl}/api/verify-session/`, {
      headers: { cookie },
    });

    if (response.ok) {
      return next();
    } else {
      return next(new Error("Authentication error: Invalid session"));
    }
  } catch (err) {
    return next(new Error("Authentication error: Internal server error"));
  }
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start Redis subscriber
startRedisSubscriber(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Realtime server running on port ${PORT}`);
});
