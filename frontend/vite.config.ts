import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        configure: (proxy: { on: Function }) => {
          proxy.on("error", () => {});
        },
      },
      "/socket.io": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
        configure: (proxy: { on: Function }) => {
          proxy.on("error", () => {});
        },
      },
    },
  },
});
