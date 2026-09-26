import { defineConfig } from "vitest/config";
import { availableParallelism } from "node:os";
import path from "path";
import { workerCap } from "./server/testing/workerCap";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  /**
   * PER-TREE, for the same reason and by the same route as `vite.config.ts`
   * (#1327) — and it has to be said twice because this config is STANDALONE:
   * it does not read `vite.config.ts`, so that file's `cacheDir` never reaches
   * a vitest run. With `root` at the tree root, the default resolves to
   * `<tree>/node_modules/.vite`, which in a worktree is a junction to the main
   * tree's — so every seat's `vitest run` was resolving through one shared
   * directory.
   *
   * No failure has ever been attributed to the vitest half (its entries are
   * keyed on absolute paths, so two trees write different keys rather than
   * fighting over one). It is set anyway because leaving one of the two halves
   * pointing through the junction is the drift this repository keeps paying
   * for, and because the next reader should not have to re-derive which half
   * was deliberate.
   */
  cacheDir: path.resolve(templateRoot, ".vite"),
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
