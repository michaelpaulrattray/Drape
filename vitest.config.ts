import { defineConfig } from "vitest/config";
import { availableParallelism } from "node:os";
import path from "path";
import { workerCap } from "./server/testing/workerCap";

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
    // vitest's own `cores - 1`, ceilinged at 8 (#743): 19 workers on this box
    // starved the child-process suites into 13–14 timeouts a run and doubled
    // the wall time. The numbers are in server/testing/workerCap.ts.
    maxWorkers: workerCap(availableParallelism()),
    // Client entries are the foundation's pure-logic and source-guard tests
    // (theme boot, no-hex token guard) — node environment, no DOM, no app
    // imports beyond plain modules. Component rendering stays out of `pnpm test`.
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/src/**/*.test.ts"],
    // *.integration.test.ts files need a running dev server — run them
    // with `pnpm test:integration` (vitest.integration.config.ts)
    exclude: ["**/node_modules/**", "server/**/*.integration.test.ts"],
  },
});
