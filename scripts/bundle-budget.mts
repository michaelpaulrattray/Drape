/**
 * `bundle-budget` — DOES THE FIRST DOWNLOAD STILL FIT (#1035)?
 *
 *     npx tsx scripts/bundle-budget.mts            build the client, then judge it
 *     npx tsx scripts/bundle-budget.mts --reuse    judge the build already in dist/
 *
 * Exit 0 under the budget, exit 1 over it (or when the reading is hollow), with
 * the verdict on stdout either way. The gate's `bundle-budget` job runs the
 * first form on every PR; `pnpm preflight` runs it before the first push, so a
 * customer surface that pulls a staff page eager is red at ten seconds on the
 * shift's own box rather than at seven minutes on the runner.
 *
 * The budget, what is counted and why, and the reader it derives from are all
 * in `scripts/lib/bundleBudget.mts` — this file only builds, reads the two
 * artifacts (`dist/public/index.html`, `dist/public/assets/`) and prints.
 *
 * The build is a plain `vite build` — no reporter plugin, because nothing here
 * needs attribution — and it is the SAME build the deploy rite runs, so the
 * bytes judged are the bytes shipped. ~8 s on the founder's machine; the
 * runner is slower and the job it runs in is beside `gate-checks`, not in
 * front of it.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { readEmittedAssets } from "./lib/bundleFold.mts";
import { firstPaintAssetsFromHtml, judgeFirstPaint, renderVerdict } from "./lib/bundleBudget.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "dist", "public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");
const ASSETS_DIR = path.join(PUBLIC_DIR, "assets");

/* Every flag is declared, and one that is not is REFUSED rather than ignored
   (#289's class; `bundle-report.mts` carries the measured incident). */
const KNOWN = new Set(["--reuse"]);
const argv = process.argv.slice(2);
for (const arg of argv) {
  if (arg.includes("=")) {
    console.error(`bundle-budget: ${arg} — this script takes no \`=\` forms`);
    process.exit(2);
  }
  if (!KNOWN.has(arg)) {
    console.error(`bundle-budget: unknown flag ${arg}. Known: ${[...KNOWN].join(", ")}`);
    process.exit(2);
  }
}
const reuse = argv.includes("--reuse");

function runBuild(): void {
  console.error("bundle-budget: building the client…");
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build"],
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] },
  );
  if (result.status !== 0) {
    console.error(`bundle-budget: the build failed (exit ${result.status}) — nothing to judge`);
    process.exit(1);
  }
  console.error(`bundle-budget: built in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

function main(): boolean {
  if (!reuse) runBuild();

  let html: string;
  try {
    html = readFileSync(INDEX_HTML, "utf8");
  } catch {
    throw new Error(
      `no built page at ${path.relative(ROOT, INDEX_HTML)}` +
        (reuse ? " — --reuse needs a build in dist/ to read" : " — the build did not write one"),
    );
  }
  const firstPaint = firstPaintAssetsFromHtml(html);
  const assets = readEmittedAssets(ASSETS_DIR);
  const verdict = judgeFirstPaint(firstPaint, assets);
  console.log(renderVerdict(verdict).join("\n"));
  return verdict.ok;
}

/* The readers throw rather than returning a small truth, so the failure arm is
   this catch; an over-budget verdict is the other red. The happy arm is the
   LAST top-level statement, which is what `scriptExitDiscipline` requires. */
let ok = false;
try {
  ok = main();
} catch (error) {
  console.error(`bundle-budget: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

process.exit(ok ? 0 : 1);
