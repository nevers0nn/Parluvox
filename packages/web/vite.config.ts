import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/session": { target: "ws://localhost:8787", ws: true },
    },
  },
});
