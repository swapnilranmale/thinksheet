import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3002,
    proxy: {
      // Streamline invoicing endpoints — must be listed before the generic /api rule
      "/api/invoicing": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      // All other /api calls → ThinkSheet backend (port 5001)
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
