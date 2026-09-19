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
