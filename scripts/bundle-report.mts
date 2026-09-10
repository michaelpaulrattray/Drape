/**
 * `machinist:bundle` — WHAT THE CLIENT ACTUALLY SHIPS (#35, founder-ordered).
 *
 *     pnpm machinist:bundle              build, then read it
 *     pnpm machinist:bundle --reuse      read the last build's report again
 *     pnpm machinist:bundle --json       print the summary object and nothing else
 *     pnpm machinist:bundle --top 20     how many owners to list (default 12)
 *
 * `docs/MACHINIST_LEDGER.md` says of itself that **no instrument records the
 * client** and that the charter's *"laggy in general"* half is therefore
 * UNREAD. This is the first reader against that gap, and it answers exactly
 * one question of it: how many bytes a visitor downloads, and whose they are.
 * It does not measure page load, interaction latency or the canvas — those are
 * still unread, and saying so here is cheaper than a future shift assuming
 * this covered them.
 *
 * ⚠ **The arithmetic trap this reader exists to avoid is documented in
 * `scripts/lib/bundleFold.mts`'s header** — the plugin's per-module byte counts
 * sum to more than twice the emitted bundle, so totals come from the files on
 * disk and the plugin's numbers are only ever reported as a share. Read that
 * before quoting anything this prints.
 *
 * Nothing here is on the deploy path: the visualiser plugin is added by
 * `vite.config.ts` only when `BUNDLE_REPORT=1`, which this script sets and
 * nothing else does.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildBundleSummary,
  kb,
  readEmittedAssets,
  renderLedgerRows,
  type RawVisualizerData,
} from "./lib/bundleFold.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPORT_DIR = path.join(ROOT, "output", "bundle-report");
const RAW_DATA = path.join(REPORT_DIR, "raw-data.json");
const TREEMAP = path.join(REPORT_DIR, "treemap.html");
const SUMMARY = path.join(REPORT_DIR, "summary.json");
const ASSETS_DIR = path.join(ROOT, "dist", "public", "assets");

/* Every flag is declared, and one that is not is REFUSED rather than ignored —
   #289's class: a `--dry-run` nobody had implemented was silently dropped and a
   live production row was closed by a command its operator believed was a
   rehearsal. */
const KNOWN = new Set(["--reuse", "--json", "--top"]);
const argv = process.argv.slice(2);
for (const arg of argv) {
  if (!arg.startsWith("--")) continue;
  /* ⚠ THE `=` FORM IS REFUSED RATHER THAN SPLIT (PR #745 review, finding 1).
     The first cut of this guard tested `KNOWN.has(arg.split("=")[0])`, so
     `--top=20` PASSED it — and every consumer below reads exact strings, so
     `indexOf("--top")` returned −1 and the operator got 12 owners believing
     they had asked for 20. `--json=1` was worse: a caller piping stdout for
     JSON got the markdown table. That is #289's class exactly, written into
     the guard built to refuse it. */
  if (arg.includes("=")) {
    console.error(
      `bundle-report: ${arg} — this script takes space-separated values, not \`=\`. ` +
        `Write \`${arg.split("=")[0]} ${arg.split("=").slice(1).join("=")}\`.`,
    );
    process.exit(2);
  }
  if (!KNOWN.has(arg)) {
    console.error(`bundle-report: unknown flag ${arg}. Known: ${[...KNOWN].join(", ")}`);
    process.exit(2);
  }
}
const reuse = argv.includes("--reuse");
const asJson = argv.includes("--json");
const topIndex = argv.indexOf("--top");
const topOwners = topIndex === -1 ? 12 : Number(argv[topIndex + 1] ?? 12);
if (!Number.isFinite(topOwners) || topOwners <= 0) {
  console.error("bundle-report: --top needs a positive number");
  process.exit(2);
}

function runBuild(): void {
  if (!asJson) console.error("bundle-report: building the client with the reporter on…");
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build"],
    {
      cwd: ROOT,
      env: { ...process.env, BUNDLE_REPORT: "1" },
      stdio: asJson ? ["ignore", "ignore", "inherit"] : "inherit",
    },
  );
  if (result.status !== 0) {
    console.error(`bundle-report: the build failed (exit ${result.status}) — nothing to read`);
    process.exit(1);
  }
  if (!asJson) {
    console.error(`bundle-report: built in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
}

function main(): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  if (!reuse) runBuild();

  let data: RawVisualizerData;
  try {
    data = JSON.parse(readFileSync(RAW_DATA, "utf8")) as RawVisualizerData;
  } catch {
    console.error(
      `bundle-report: no report at ${path.relative(ROOT, RAW_DATA)}` +
        (reuse ? " — --reuse needs an earlier run to reuse" : " — the build did not write one"),
    );
    process.exit(1);
  }

  const assets = readEmittedAssets(ASSETS_DIR);
  const summary = buildBundleSummary({ assets, data, takenAt: new Date().toISOString() });
  writeFileSync(SUMMARY, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("");
  console.log(renderLedgerRows(summary, topOwners).join("\n"));
  console.log("");
  console.log(`summary  ${path.relative(ROOT, SUMMARY)}`);
  console.log(`treemap  ${path.relative(ROOT, TREEMAP)}   ← open this one to look`);
  console.log("");
  if (summary.totals.chunkCount === 1) {
    console.log(
      `NOTE: the client is ONE chunk of ${kb(summary.totals.jsGzipBytes)} gzipped, so every ` +
        `visitor downloads all of it before anything renders — including the admin panel, ` +
        `the canvas and the casting studio. That is a finding for the ledger, not a defect ` +
        `this script should fix.`,
    );
    console.log("");
  }
}

/* The fold and the readers throw rather than returning a small truth, so the
   failure arm is this catch and it exits nonzero. The happy arm is the LAST
   top-level statement in the file, which is what `scriptExitDiscipline`
   requires — an exit sitting inside an earlier branch does not count. */
try {
  main();
} catch (error) {
  console.error(`bundle-report: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

process.exit(0);
