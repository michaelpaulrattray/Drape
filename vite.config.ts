import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type PluginOption } from "vite";

/**
 * THE BUNDLE READING IS OFF UNLESS ASKED FOR, AND THAT IS THE POINT (#35).
 *
 * `pnpm build` is what the deploy rite runs. A reporting plugin that rode
 * every build would put a measuring instrument on the production path — it
 * writes files, it costs seconds, and a fault in it would be a fault in the
 * deploy. So the visualiser is added ONLY when `BUNDLE_REPORT=1`, which
 * `scripts/bundle-report.mts` sets and nothing else does.
 *
 * `server/bundleReportWiring.test.ts` proves both directions at this object
 * rather than near it (invariant 5): it imports THIS config with the variable
 * set and unset, and reads the plugin list that vite would actually receive.
 */
const wantsBundleReport = process.env.BUNDLE_REPORT === "1";

/** Every font format `@fontsource` ships and any a future face could. */
const FONT_FILE = /\.(woff2?|ttf|otf|eot)$/i;

const bundleReportPlugins: PluginOption[] = wantsBundleReport
  ? [
      visualizer({
        // `raw-data` is the machine-readable one — the treemap is written
        // separately below for his eyes. The reader folds the raw data into
        // the ledger's rows; nothing parses the HTML.
        template: "raw-data",
        filename: path.resolve(
          import.meta.dirname,
          "output",
          "bundle-report",
          "raw-data.json",
        ),
        gzipSize: true,
        brotliSize: false,
        emitFile: false,
      }),
      visualizer({
        template: "treemap",
        filename: path.resolve(
          import.meta.dirname,
          "output",
          "bundle-report",
          "treemap.html",
        ),
        gzipSize: true,
        brotliSize: false,
        emitFile: false,
        title: "Drape client bundle",
      }),
    ]
  : [];

export default defineConfig({
  plugins: [react(), tailwindcss(), ...bundleReportPlugins],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  /**
   * PER-TREE, AND DELIBERATELY NOT UNDER `node_modules` (#1327).
   *
   * Vite derives `cacheDir` from the nearest `package.json` above `root`.
   * `root` is `<tree>/client`, which has no `package.json` and no
   * `node_modules`, so the default lands on `<tree>/node_modules/.vite` — and
   * in a git worktree `<tree>/node_modules` is a JUNCTION to the main tree's,
   * so every worktree's dev server shared ONE optimizer cache. Two builder
   * seats running at once therefore invalidated each other: the second server
   * printed `Re-optimizing dependencies because vite config has changed` and
   * the first seat's page went blank with `504 Outdated Optimize Dep`.
   *
   * ⚠ `node_modules/.vite` DOES NOT FIX IT, which is what #1327's own card
   * proposed. `path.resolve(import.meta.dirname, "node_modules/.vite")` is the
   * value Vite already computes, and it realpaths straight back through the
   * junction to the main tree — measured, not assumed. The cache has to leave
   * `node_modules` entirely to be per-tree, which is why this is `.vite` at the
   * tree root (gitignored) rather than a tidier-looking path inside.
   *
   * Vitest needs the same thing said again in `vitest.config.ts`: that config
   * is standalone and does not read this file, so this line does not reach it.
   */
  cacheDir: path.resolve(import.meta.dirname, ".vite"),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Fonts are never inlined (#1044). Vite's default folds any asset under
    // 4 kB into the stylesheet as a `data:` URL, and six of the mono face's
    // subsets are that small (cyrillic-ext in both formats, vietnamese in
    // woff2) — so every production page load logged six CSP violations,
    // because `font-src` is `'self' https://fonts.gstatic.com` and says
    // nothing about `data:`. Keeping the policy narrow and shipping the
    // files is the repair; widening the CSP for a build artefact is not.
    // Invisible on the dev server, which inlines nothing.
    assetsInlineLimit: (filePath) =>
      FONT_FILE.test(filePath) ? false : undefined,
  },
  // No `server` block here, on purpose (#849). The dev server is Vite in
  // middleware mode inside Express, and `setupVite` (server/_core/vite.ts)
  // replaces this config's whole `server` key with its own options; the CLI
  // only ever runs `vite build`, which ignores `server`. A dev-server policy
  // written here is dead text — put it in `setupVite`, where it is read.
});
