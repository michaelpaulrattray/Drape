/**
 * Integration test config — suites that hit a live server over HTTP.
 * Start the app first (`pnpm dev`), then run `pnpm test:integration`.
 * Target defaults to http://localhost:3000; override with VITE_API_URL.
 */
import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["server/**/*.integration.test.ts"],
  },
});
