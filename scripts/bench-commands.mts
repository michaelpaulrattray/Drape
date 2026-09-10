/**
 * `machinist:bench` — HOW LONG THE HOUSE'S OWN COMMANDS TAKE (#35).
 *
 *     pnpm machinist:bench                 the whole declared set
 *     pnpm machinist:bench --only check    one script by name (repeatable)
 *     pnpm machinist:bench --list          print the set and exit, measuring nothing
 *     pnpm machinist:bench --json          the readings as JSON
 *
 * ⚠ **A FULL PASS TAKES MINUTES, ON PURPOSE.** `--list` first if you only want
 * to know what it would do; `--only` if you are chasing one number. The
 * declared set and the reasoning behind each row live in
 * `scripts/lib/benchCommands.mts`; the pinned tool in `lib/hyperfineBin.mts`.
 *
 * It measures THIS machine under THIS load. That is stated in the output
 * rather than left for a reader to remember, because the one thing a
 * benchmark invites is comparing two numbers that were never comparable.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  BENCH_SET,
  foldHyperfine,
  renderBenchRows,
  resolveBenchSet,
  seconds,
  type HyperfineExport,
  type PackageManifest,
} from "./lib/benchCommands.mts";
import { ensureHyperfine, reportedVersion } from "./lib/hyperfineBin.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, ".tools");
const OUT_DIR = path.join(ROOT, "output", "bench");

/* Unknown flags are refused, never ignored (#289's class). */
const KNOWN = new Set(["--only", "--list", "--json"]);
const argv = process.argv.slice(2);
for (const arg of argv) {
  if (arg.startsWith("--") && !KNOWN.has(arg)) {
    console.error(`bench: unknown flag ${arg}. Known: ${[...KNOWN].join(", ")}`);
    process.exit(2);
  }
}
const asJson = argv.includes("--json");
const listOnly = argv.includes("--list");
const only: string[] = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--only") {
    const name = argv[i + 1];
    if (!name || name.startsWith("--")) {
      console.error("bench: --only needs a script name");
      process.exit(2);
    }
    only.push(name);
  }
}

async function main(): Promise<void> {
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, "package.json"), "utf8"),
  ) as PackageManifest;

  /* ⚠ EVERY `--only` NAME MUST HIT, NOT JUST ONE (PR #745 review, finding 2).
     Refusing only when `wanted` came back empty meant
     `--only check --only bulid` benched `check` alone and never mentioned the
     typo — so the operator believes a number was taken that was not. Same
     silent-partial-drop class as finding 1, in a file whose whole header is
     about refusing rather than returning a smaller truth. */
  const known = new Set(BENCH_SET.map((r) => r.script));
  const unknown = only.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    console.error(
      `bench: --only ${unknown.join(", --only ")} — not in the benchmark set. ` +
        `The set is: ${[...known].join(", ")}`,
    );
    process.exit(2);
  }
  const wanted = only.length === 0 ? BENCH_SET : BENCH_SET.filter((r) => only.includes(r.script));
  // Throws — loudly — if a declared script is no longer in package.json.
  const resolved = resolveBenchSet(manifest, wanted);

  if (listOnly) {
    console.log("The benchmark set (nothing was measured):");
    for (const row of resolved) {
      console.log(`  ${row.command.padEnd(28)} ${row.runs} run(s), ${row.warmup} warmup — ${row.why}`);
    }
    return;
  }

  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const binary = await ensureHyperfine({
    cacheDir: CACHE,
    log: (line) => console.error(line),
  });
  const version = reportedVersion(binary);
  if (!asJson) console.error(`bench: using ${version} at ${path.relative(ROOT, binary)}`);

  const exportFile = path.join(OUT_DIR, "hyperfine.json");
  const readings: ReturnType<typeof foldHyperfine> = [];

  /* One hyperfine invocation PER command rather than one for all of them.
     hyperfine's own multi-command mode reports a comparison ("1.4× faster
     than"), which is meaningless between `pnpm check` and `pnpm build` — they
     are not alternatives, they are steps. Separate runs also mean a failing
     command refuses on its own and the rest of the reading survives. */
  for (const row of resolved) {
    if (!asJson) console.error(`bench: ${row.command} — ${row.runs} run(s)…`);
    const result = spawnSync(
      binary,
      [
        "--warmup",
        String(row.warmup),
        "--runs",
        String(row.runs),
        "--export-json",
        exportFile,
        "--command-name",
        row.command,
        row.command,
      ],
      { cwd: ROOT, stdio: asJson ? ["ignore", "ignore", "inherit"] : "inherit", shell: false },
    );
    if (result.error) {
      throw new Error(`bench: could not run hyperfine — ${result.error.message}`);
    }
    /* ⚠ hyperfine ABORTS on the first failing run and writes NO export, so the
       fold's exit-code refusal never gets the chance to speak. Without this
       arm the operator sees `Unexpected end of JSON input` from the parse —
       measured on the first end-to-end drive of this script, against a stale
       Atlas. The fold's refusal stays as well: it is what catches a failure
       that appears in a LATER run, or a run made with --ignore-failure. */
    if (result.status !== 0) {
      throw new Error(
        `"${row.command}" failed (exit ${result.status}), so there is nothing to time — ` +
          `a failing command is fast, which would read as an improvement. ` +
          `Run it directly, fix the tree, then benchmark it.`,
      );
    }
    const exported = JSON.parse(readFileSync(exportFile, "utf8")) as HyperfineExport;
    readings.push(...foldHyperfine(exported, [row]));
  }

  const takenAt = new Date().toISOString();
  const summary = { takenAt, hyperfine: version, platform: `${process.platform}-${process.arch}`, readings };
  writeFileSync(path.join(OUT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("");
  console.log(renderBenchRows(readings, takenAt).join("\n"));
  console.log("");
  console.log(`Read on ${summary.platform} with ${version}.`);
  console.log(`summary  ${path.relative(ROOT, path.join(OUT_DIR, "summary.json"))}`);
  const slowest = [...readings].sort((a, b) => b.medianSeconds - a.medianSeconds)[0];
  if (slowest) {
    console.log("");
    console.log(`Slowest: \`${slowest.command}\` at ${seconds(slowest.medianSeconds)} median.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`bench: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
