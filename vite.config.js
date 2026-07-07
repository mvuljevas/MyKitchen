import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          scrollbars: ["simplebar", "simplebar-react"],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
