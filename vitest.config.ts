import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  // Client components under test (e.g. CastModelModal) use the automatic
  // JSX runtime — same as the app's Vite build
  esbuild: { jsx: "automatic" },
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
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // *.integration.test.ts files need a running dev server — run them
    // with `pnpm test:integration` (vitest.integration.config.ts)
    exclude: ["**/node_modules/**", "server/**/*.integration.test.ts"],
  },
});
