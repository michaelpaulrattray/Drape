/**
 * `after-paint-budget` — WHAT ELSE DOES A CUSTOMER DOWNLOAD (#1421)?
 *
 *     npx tsx scripts/after-paint-budget.mts
 *
 * Exit 0 under the budget, exit 1 over it (or when the reading is hollow), with
 * the verdict on stdout either way. The gate's `bundle-budget` job runs this
 * beside `scripts/bundle-budget.mts`, and `pnpm preflight` runs both before the
 * first push.
 *
 * The budget, the population and every stated limit are in
 * `scripts/lib/afterPaintBudget.mts` — this file only builds, reads the three
 * artifacts (the chunk graph, the built `index.html`, the emitted assets) and
 * prints. The specimen it exists for is in that header: 109.0 kB of dead
 * library in a lazy chunk, while first paint moved three bytes.
 *
 * # ⚠ WHY THIS BUILDS IN-PROCESS, AND WHY THERE IS NO `--reuse`
 *
 * `bundle-budget.mts` spawns `vite build` and then reads `dist/`, because
 * everything it needs is in the built `index.html`. **The chunk GRAPH is not on
 * disk.** Which chunk dynamically imports which is `OutputChunk.dynamicImports`
 * — a rollup declaration, returned by Vite's build API and thrown away by the
 * CLI. Scraping it back out of the emitted `__vite__mapDeps` calls is the exact
 * shape this repository has paid for four times (a regex standing in for
 * something the code already states), so the build happens here instead and a
 * `--reuse` flag is REFUSED rather than quietly reading a stale graph.
 *
 * **It is the same build, proven rather than assumed.** Driven 2026-09-26 at
 * `8178afee`: `npx tsx scripts/bundle-budget.mts` (the CLI road, and the one the
 * deploy rite runs) and this script's in-process build emitted
 * `assets/index--Eb8aq0n.js` — the SAME content hash — and both read it at
 * 260.6 kB. Identical bytes, so the graph read here describes the chunks that
 * ship.
 *
 * Its own `outDir` (`dist/after-paint/`), on purpose: the first-paint job reads
 * `dist/public`, and a second build into that directory would mean the two
 * instruments could only ever run in one order. Neither can now disturb the
 * other's reading.
 *
 * ~9 s on the founder's machine. Built with no `.env` on the runner, so the
 * `VITE_*` literals a local build inlines are absent there — tenths of a
 * kilobyte against 36.6 kB of headroom, the same delta the first-paint budget
 * records and for the same reason.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "vite";

import { firstPaintAssetsFromHtml } from "./lib/bundleBudget.mts";
import { readEmittedAssets } from "./lib/bundleFold.mts";
import {
  customerReachableChunks,
  judgeAfterPaint,
  renderAfterPaintVerdict,
  staffPageModulesFromApp,
  type ChunkNode,
} from "./lib/afterPaintBudget.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "dist", "after-paint");
const APP_TSX = path.join(ROOT, "client", "src", "App.tsx");

/* Every flag is declared, and one that is not is REFUSED rather than ignored
   (#289's class). There are none: `--reuse` cannot exist here — see the header. */
const KNOWN = new Set<string>([]);
const argv = process.argv.slice(2);
for (const arg of argv) {
  if (arg === "--reuse") {
    console.error(
      "after-paint-budget: there is no --reuse — the chunk graph is not on disk, only in the build's own output. " +
        "See this script's header.",
    );
    process.exit(2);
  }
  if (!KNOWN.has(arg)) {
    console.error(`after-paint-budget: unknown flag ${arg}. This script takes none.`);
    process.exit(2);
  }
}

/** Vite's build output, narrowed to the fields this reader uses. */
type BuiltChunk = {
  readonly type: string;
  readonly fileName: string;
  readonly isEntry: boolean;
  readonly facadeModuleId: string | null;
  readonly imports: readonly string[];
  readonly dynamicImports: readonly string[];
  readonly viteMetadata?: { readonly importedCss?: Iterable<string> };
};

/** `assets/index-<hash>.js`, the key `readEmittedAssets` uses. */
const assetKey = (fileName: string): string => `assets/${path.basename(fileName)}`;

async function buildAndReadGraph(): Promise<ChunkNode[]> {
  console.error("after-paint-budget: building the client…");
  const started = Date.now();
  const result = await build({
    configFile: path.join(ROOT, "vite.config.ts"),
    mode: "production",
    logLevel: "warn",
    build: { outDir: OUT_DIR, emptyOutDir: true },
  });
  console.error(`after-paint-budget: built in ${((Date.now() - started) / 1000).toFixed(1)} s`);

  const bundles = Array.isArray(result) ? result : [result];
  const chunks: ChunkNode[] = [];
  for (const bundle of bundles) {
    if (!("output" in bundle)) {
      throw new Error(
        "after-paint-budget: vite returned a watcher rather than a build result — nothing to read",
      );
    }
    for (const part of bundle.output as readonly BuiltChunk[]) {
      if (part.type !== "chunk") continue;
      chunks.push({
        file: assetKey(part.fileName),
        isEntry: part.isEntry,
        /* Windows ids arrive with backslashes; the staff-page matcher compares
           against posix module paths, so normalise here rather than at four
           call sites. */
        facadeModuleId:
          part.facadeModuleId === null ? null : String(part.facadeModuleId).split("\\").join("/"),
        staticImports: part.imports.map(assetKey),
        dynamicImports: part.dynamicImports.map(assetKey),
        importedCss: [...(part.viteMetadata?.importedCss ?? [])].map(assetKey),
      });
    }
  }
  if (chunks.length === 0) {
    throw new Error(
      "after-paint-budget: the build emitted no JS chunks — nothing was built, and a zero here would read as a small bundle",
    );
  }
  return chunks;
}

async function main(): Promise<boolean> {
  const staffModules = staffPageModulesFromApp(readFileSync(APP_TSX, "utf8"));
  const chunks = await buildAndReadGraph();

  let html: string;
  try {
    html = readFileSync(path.join(OUT_DIR, "index.html"), "utf8");
  } catch {
    throw new Error(
      `no built page at ${path.relative(ROOT, path.join(OUT_DIR, "index.html"))} — the build did not write one`,
    );
  }

  const { reachable, staffChunks } = customerReachableChunks(chunks, staffModules);
  const verdict = judgeAfterPaint({
    reachable,
    firstPaintFiles: firstPaintAssetsFromHtml(html),
    chunks,
    assets: readEmittedAssets(path.join(OUT_DIR, "assets")),
  });
  console.error(
    `after-paint-budget: ${staffModules.length} staff pages declared, ${staffChunks.length} staff chunks left out of the walk`,
  );
  console.log(renderAfterPaintVerdict(verdict).join("\n"));
  return verdict.ok;
}

/* The readers throw rather than returning a small truth, so the failure arm is
   this catch; an over-budget verdict is the other red. The happy arm is the
   LAST top-level statement, which is what `scriptExitDiscipline` requires. */
let ok = false;
try {
  ok = await main();
} catch (error) {
  console.error(`after-paint-budget: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

process.exit(ok ? 0 : 1);
