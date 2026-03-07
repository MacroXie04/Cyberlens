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
