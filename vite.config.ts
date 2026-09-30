import {
  sentryVitePlugin,
  type SentryVitePluginOptions,
} from "@sentry/bundler-plugins/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type PluginOption } from "vite";

import { SENTRY_BROWSER_PROJECT, SENTRY_ORG } from "./shared/monitoringProjects";

/**
 * WHERE THE BROWSER BUNDLE IS WRITTEN — declared ONCE and read by four things:
 * `build.outDir`, the upload's delete-after glob, the guard that refuses a
 * surviving `.map`, and the line the build prints. It was a literal inside
 * `build.outDir` alone until #1420 part 1; the moment a second reader needed it,
 * a second spelling of `dist/public` would have been the parallel copy working
 * law 4 is about — and the reader it would have broken is the DELETE glob, whose
 * failure is silent (a wrong path deletes nothing, the upload still reports
 * success, and the maps ship to the public bucket).
 */
const CLIENT_OUT_DIR = path.resolve(import.meta.dirname, "dist/public");

/** `glob` takes posix separators on every platform; `path.resolve` gives Windows ones. */
const posix = (absolute: string): string => absolute.replace(/\\/g, "/");

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

/**
 * THE BUILD THE BROWSER BUNDLE CAME FROM, BAKED IN — #1420's release tag.
 *
 * The server tags its events with `RAILWAY_GIT_COMMIT_SHA` read at RUNTIME
 * (`server/_core/env.ts`'s `deployedCommitSha`). A bundle has no runtime access
 * to the platform's environment, so the only moment the browser half can learn
 * which tree it is, is this one.
 *
 * ⚠ **WHETHER RAILWAY'S BUILD STEP HAS THAT VARIABLE WAS THE ONE UNREAD FACT
 * #1418 REFUSED TO GUESS AT, AND IT IS STILL NOT READABLE AT AN ARTIFACT FROM
 * HERE — SO THE BUILD IS MADE TO SAY.** Railway's own reference documents it as
 * provided *"to all builds and deployments"* (docs.railway.com/variables/reference,
 * the Git-variables table), but that is the vendor's claim and this repository
 * does not file a claim as a fact (law 7b). The production build log carries no
 * environment at all — read at the real log for the 2026-09-29 deploy, which
 * prints vite's asset list and railpack's copy steps and nothing else — so
 * there was no reading to take. `releaseStampPlugin` below therefore prints, on
 * every real build, which of the two happened. **The next production build's log
 * answers the question permanently, and costs nothing to have asked.**
 *
 * Absent, the tag is ABSENT rather than empty: an empty release is a group in
 * Sentry that every unlabelled build falls into, which is the "0 errors today"
 * lie #1419 refused wearing a different hat. `clientRelease()` in
 * `client/src/monitoring/errorTracker.ts` is the reader, and it is the only one.
 */
const clientRelease = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").trim();

/**
 * THE CREDENTIAL THAT MAKES A STACK TRACE READABLE — #1420 part 1, and the only
 * reason this build ever generates a source map at all.
 *
 * His token, added to the Drape service 2026-09-30. Read here and handed to the
 * plugin; it is never printed, never baked into `define`, and never written to a
 * file — `server/viteSourceMapUpload.test.ts` proves all three at this object
 * rather than trusting the sentence.
 *
 * ⚠ **ITS ABSENCE IS THE NORMAL CASE AND MUST COST NOTHING.** Every laptop and
 * every CI run has no token, and a build that failed without one would make the
 * gate depend on a third party's credential. So no token means: no maps
 * generated, no upload attempted, one line saying so — the same shape #1526 gave
 * the release stamp.
 *
 * ⚠ **AND WHETHER RAILWAY'S BUILD STEP CARRIES IT IS THE SAME UNREAD FACT THE
 * RELEASE TAG HAS, SO IT IS ASKED THE SAME WAY RATHER THAN ASSUMED (law 7b).** A
 * service variable is documented as reaching the build, but the production build
 * log carries no environment, so there is nothing to read. The line below prints
 * which of the two happened, by PRESENCE and never by value, and the next
 * production build's log settles it permanently.
 */
const sentryAuthToken = (process.env.SENTRY_AUTH_TOKEN ?? "").trim();

/** Whether this build both can and should upload — one reading, four readers. */
const uploadsSourceMaps = sentryAuthToken.length > 0;

/**
 * UPLOAD THE MAPS, THEN LEAVE NONE BEHIND — the whole of #1420 part 1.
 *
 * # Why the vendor's plugin and not `sentry sourcemaps upload` in the build script
 *
 * Sentry resolves a minified frame by **debug id**: a short identifier injected
 * into the bundle AND into its map, matched at read time. Nothing in this
 * repository can inject one — it is a bundler-level rewrite of the emitted chunk.
 * A `sentry sourcemaps inject && upload` pair in `package.json`'s build script
 * would do the same work in two more processes and a second place, and would
 * still be this same package underneath (`sentry` is its own dependency). The
 * fidelity law's plain case: the dedicated tool exists, it is already in this
 * tree, and the hand-rolled alternative caps what it can resolve.
 *
 * # It costs no new download, which is worth saying because it looks like it does
 *
 * `@sentry/bundler-plugins` is already installed — `@sentry/node` 11 depends on
 * it, so production has carried it since #509. It is declared in
 * `devDependencies` here because this config imports it directly, and an
 * undeclared import that happens to resolve through somebody else's dependency is
 * the thing that breaks on an unrelated upgrade.
 *
 * # The four options that are decisions rather than defaults
 *
 * **`release.inject: false`.** The plugin's default writes a release name into
 * the bundle for the SDK to pick up. This bundle already has one —
 * `__DRAPE_RELEASE__`, read by `clientRelease()` in
 * `client/src/monitoring/errorTracker.ts`, which is deliberately the ONLY reader.
 * Injecting a second would give one identifier two sources, and the plugin's own
 * fallback chain (`release.name` ?? `SENTRY_RELEASE` ?? git detection — read at
 * `options-mapping.js:20`) means the two could genuinely differ.
 *
 * **No release is CREATED when the sha is unknown.** Read at that same line, an
 * absent `name` falls through to git detection, so `create`/`finalize` would
 * invent a release the events do not carry. Read at `debug-id-upload.js`, the
 * upload itself uses no release name at all — only `release.dist` — so turning
 * creation off costs the upload nothing and keeps the build from claiming a build
 * identity it does not have.
 *
 * **`setCommits: false`.** Its default is `{ auto: true }`, which shells out to
 * git for the commit range. The deploy container is a copy of the tree, not a
 * clone, so this is a step that can only fail; it is a warning either way, and a
 * warning nobody can act on is noise in the one log this card exists to make
 * readable.
 *
 * **`telemetry: false`.** On by default, and it sends the plugin's own errors to
 * Sentry's own account rather than to ours. One more network call on the deploy
 * path in exchange for nothing this product reads.
 *
 * # What the maps carry, said plainly
 *
 * Vite's maps include `sourcesContent`, so this uploads THIS PRODUCT'S OWN SOURCE
 * to his own Sentry org. That is the point — an unreadable frame was the defect —
 * and it is our shape rather than a customer's: nothing a customer typed is in a
 * build artifact. What may leave the building in an EVENT is unchanged and is
 * still `shared/errorEventScrub.ts`'s allowlist alone.
 *
 * # Why nothing here can leave a `.map` in `dist/public`
 *
 * Three readings at the installed plugin, because "uploaded and deleted" is a
 * promise and the deletion is the half that matters:
 *   · `rollup/index.js:206-209` — `deleteArtifacts()` is in a `finally`, so the
 *     maps are deleted even when the upload throws.
 *   · `build-plugin-manager.js:505` — a deletion failure is raised with
 *     `throwByDefault: true`, so it FAILS THE BUILD rather than shipping them.
 *   · `build-plugin-manager.js:457` — an upload failure is raised with
 *     `throwByDefault: false`, so Sentry being down does not fail a deploy.
 * That is the behaviour this card wants and it is the vendor's, not ours — so no
 * second deleter is written (two would be the parallel copy again). What IS ours
 * is the ASSERTION below, because the delete glob is a string we compose and a
 * wrong one fails silently in exactly the direction that ships a leak.
 *
 * # Why the options are an exported function rather than an object literal
 *
 * Invariant 5 — assert at the wire. Every claim in this header is a claim about
 * the object the plugin is HANDED, and a constructed plugin keeps its options in
 * a closure where no test can read them. `buildClientTrackerOptions` in
 * `client/src/monitoring/errorTracker.ts` is the same shape for the same reason.
 */
export function sourceMapUploadOptions(input: {
  authToken: string;
  release: string;
  outDir: string;
}): SentryVitePluginOptions {
  return {
    org: SENTRY_ORG,
    project: SENTRY_BROWSER_PROJECT,
    authToken: input.authToken,
    telemetry: false,
    release: {
      /*
        SPREAD, so an unknown build identity leaves `name` OFF the object rather
        than present-and-undefined: the plugin's `??` chain treats those two
        differently (an absent name falls through to git detection), and this
        object's whole job is to have exactly one source for the release.
      */
      ...(input.release.length > 0
        ? { name: input.release }
        : { create: false, finalize: false }),
      inject: false,
      setCommits: false,
    },
    sourcemaps: {
      /*
        DERIVED from the same `outDir` the build writes to. A literal here is the
        one mistake in this whole change that nothing downstream would notice —
        the upload still succeeds, the log still says so, and the maps stay in the
        directory production serves. `noPublicSourceMapsPlugin` is the backstop
        for exactly that, and it is the reason this glob is allowed to be a string
        at all.
      */
      filesToDeleteAfterUpload: [`${posix(input.outDir)}/**/*.map`],
    },
  };
}

const sourceMapUploadPlugins: PluginOption[] = uploadsSourceMaps
  ? sentryVitePlugin(
      sourceMapUploadOptions({
        authToken: sentryAuthToken,
        release: clientRelease,
        outDir: CLIENT_OUT_DIR,
      }),
    )
  : [];

/**
 * THE BUNDLE'S SOURCE MAPS NEVER REACH THE PUBLIC BUCKET — the backstop, and it
 * is an assertion rather than a repair.
 *
 * `dist/public` is served as static files in production, so a surviving
 * `index-abc123.js.map` is downloadable by anyone who can guess the asset's name —
 * and the asset's name is printed in the page's own `<script src>`. What it
 * carries is the whole of this product's client shape: every tRPC procedure it
 * calls, every route, every guard's wording.
 *
 * `build.sourcemap` is `"hidden"` rather than `true` so no `//# sourceMappingURL`
 * comment points at them even for the moment they exist, and the plugin deletes
 * them; this hook then REFUSES a build that still has one. It repairs nothing on
 * purpose — a silent repair would hide the day the glob above stopped matching,
 * and the failure this guards is a wrong string rather than a flaky filesystem.
 *
 * It runs on every build, including the ones with no token and therefore no maps,
 * because the cheapest arm is the one that also covers the case nobody changed.
 * `closeBundle` rather than `writeBundle`: the plugin deletes inside its own
 * `writeBundle`, and `closeBundle` is the first hook guaranteed to be after it.
 */
function noPublicSourceMapsPlugin(outDir: string): PluginOption {
  return {
    name: "drape-no-public-source-maps",
    apply: "build",
    generateBundle(_options, bundle) {
      const maps = Object.keys(bundle).filter((name) => name.endsWith(".map"));
      console.log(
        uploadsSourceMaps
          ? `[build] ${maps.length} source map(s) built for upload to ${SENTRY_ORG}/${SENTRY_BROWSER_PROJECT}`
          : "[build] SENTRY_AUTH_TOKEN is not set at build time — no source maps are built and none are uploaded",
      );
    },
    closeBundle() {
      const survivors = mapFilesUnder(outDir);
      if (survivors.length > 0) {
        throw new Error(
          `[build] REFUSED: ${survivors.length} source map(s) are still in the published output and would be served ` +
            `publicly — ${survivors.join(", ")}. The upload's filesToDeleteAfterUpload glob did not match them.`,
        );
      }
      console.log("[build] no source maps left in the published output");
    },
  };
}

/**
 * Every `.map` under a directory, relative to it, in one cheap walk.
 *
 * `throwIfNoEntry: false` on the stat, and a missing directory answering `[]`:
 * the reader's question is whether a map is PRESENT, and a tree that does not
 * exist has none. Exported so the suite drives it against a real temporary
 * directory rather than through a whole build.
 */
export function mapFilesUnder(root: string): string[] {
  const stat = fs.statSync(root, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(next, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".map")) out.push(`${prefix}${entry.name}`);
    }
  };
  walk(root, "");
  return out.sort();
}

/**
 * Say what was baked in, at BUILD time only.
 *
 * A `console.log` at this module's top level would fire on every import —
 * `server/bundleReportWiring.test.ts` imports this config five times — so the
 * line lives in a plugin hook, which runs when vite actually builds and never
 * when the config object is merely read.
 */
function releaseStampPlugin(release: string): PluginOption {
  return {
    name: "drape-release-stamp",
    apply: "build",
    buildStart() {
      console.log(
        release.length > 0
          ? `[build] browser release ${release}`
          : "[build] RAILWAY_GIT_COMMIT_SHA is not set at build time — the browser bundle carries no release tag",
      );
    },
  };
}

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
  plugins: [
    react(),
    tailwindcss(),
    releaseStampPlugin(clientRelease),
    ...sourceMapUploadPlugins,
    noPublicSourceMapsPlugin(CLIENT_OUT_DIR),
    ...bundleReportPlugins,
  ],
  /**
   * THE ONE VALUE THIS BUILD BAKES IN THAT IS NOT A `VITE_` VARIABLE, AND THE
   * NAME IS DELIBERATE.
   *
   * `import.meta.env.VITE_*` is Vite's own channel and it reads `.env` files as
   * well as the process, so defining a `VITE_`-shaped name here would give one
   * identifier two sources with `define` silently winning — the parallel-copy
   * shape working law 4 is about. `__DRAPE_RELEASE__` can only have come from
   * this line.
   *
   * It is `declare const`d where it is READ rather than in a `.d.ts`, so the
   * declaration sits beside the guard that survives its absence (vitest and the
   * server tsconfigs never run `define`, and a bare reference would throw).
   */
  define: {
    __DRAPE_RELEASE__: JSON.stringify(clientRelease),
  },
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
    outDir: CLIENT_OUT_DIR,
    emptyOutDir: true,
    /*
      MAPS ONLY WHEN THEY ARE GOING TO SENTRY, AND HIDDEN EVEN THEN (#1420).

      `false` without a token is the load-bearing half: a map generated and not
      uploaded is a map nothing deletes, sitting in the directory production
      serves. `"hidden"` rather than `true` for the upload case suppresses the
      `//# sourceMappingURL` comment, so nothing in a shipped asset points at a
      file that is about to be removed — and Sentry does not need the comment,
      because it matches on the debug id the plugin injects into both sides.
    */
    sourcemap: uploadsSourceMaps ? "hidden" : false,
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
