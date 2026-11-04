import { defineConfig } from "vite";

// Relative base so the build works from any folder, including GitHub Pages project sites.
export default defineConfig({
  base: "./",
  build: { target: "es2020", chunkSizeWarningLimit: 800 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as any);
