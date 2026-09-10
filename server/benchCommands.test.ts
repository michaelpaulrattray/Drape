import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

import {
  BENCH_SET,
  foldHyperfine,
  renderBenchRows,
  resolveBenchSet,
  seconds,
  type HyperfineExport,
  type PackageManifest,
  type ResolvedBench,
} from "../scripts/lib/benchCommands.mts";
import {
  assertChecksum,
  downloadUrl,
  ensureHyperfine,
  HYPERFINE_PINS,
  HYPERFINE_VERSION,
  pinFor,
} from "../scripts/lib/hyperfineBin.mts";

/**
 * THE BENCH IS AN INSTRUMENT (working law 2), and two of its arms are the
 * reason it can be believed at all:
 *
 *  - **§1's last arm** binds the declared set to the REAL `package.json`. It is
 *    the whole of working law 4 for this feature: rename `pnpm check` and this
 *    reddens, instead of the bench quietly timing a command pnpm rejects.
 *  - **§2's exit-code arm.** A failing command is FAST. `pnpm check` on a red
 *    tree returns in a fraction of its green time, so a bench run during a
 *    breakage reports a spectacular improvement. Nothing about the output would
 *    look wrong.
 */

/* This suite reaches `hyperfineBin.mts`, which spawns `tar` and the binary
   itself, so it is in #548's derived population whether or not a given arm
   gets that far — the deriver resolves the import rather than reading this
   file alone, and it is right to: the extraction path runs the moment a
   download succeeds. File level, never per arm. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const ROOT = path.resolve(__dirname, "..");

function resolved(command: string, script = "check"): ResolvedBench {
  return { command, script, runs: 1, warmup: 0, why: "fixture" };
}

function exported(over: Partial<HyperfineExport["results"][number]> = {}): HyperfineExport {
  return {
    results: [
      {
        command: "pnpm check",
        mean: 10,
        stddev: 0.5,
        median: 9.5,
        min: 9,
        max: 11,
        times: [9, 9.5, 11],
        exit_codes: [0, 0, 0],
        ...over,
      },
    ],
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   1. resolveBenchSet — the set is declared, the commands are derived
   ──────────────────────────────────────────────────────────────────────── */

describe("resolveBenchSet", () => {
  it("builds a pnpm command per declared row", () => {
    const manifest: PackageManifest = { scripts: { check: "tsc", build: "vite build" } };
    const rows = resolveBenchSet(manifest, [
      { script: "check", runs: 3, warmup: 1, why: "w" },
      { script: "build", runs: 2, warmup: 1, why: "w" },
    ]);
    expect(rows.map((r) => r.command)).toEqual(["pnpm check", "pnpm build"]);
  });

  it("REFUSES a script package.json does not declare, and says what is there", () => {
    const manifest: PackageManifest = { scripts: { check: "tsc" } };
    expect(() =>
      resolveBenchSet(manifest, [{ script: "typecheck", runs: 1, warmup: 0, why: "w" }]),
    ).toThrow(/no script "typecheck".*Available: check/s);
  });

  it("REFUSES a manifest with no scripts", () => {
    expect(() => resolveBenchSet({ scripts: {} })).toThrow(/declares no scripts/);
  });

  it("REFUSES an empty set — a run of nothing is not a reading", () => {
    expect(() => resolveBenchSet({ scripts: { check: "tsc" } }, [])).toThrow(/set is empty/);
  });

  /* ⚠ THE ARM THAT MATTERS. Driven against the repository's own manifest, so
     renaming or removing a benchmarked script reddens here rather than at 2am
     inside a benchmark run. */
  it("every row of the real BENCH_SET names a script this repo really has", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as PackageManifest;
    expect(() => resolveBenchSet(manifest, BENCH_SET)).not.toThrow();
    expect(BENCH_SET.length).toBeGreaterThan(0);
    for (const row of BENCH_SET) {
      expect(row.runs, `${row.script} runs`).toBeGreaterThan(0);
      expect(row.why.length, `${row.script} why`).toBeGreaterThan(10);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2. foldHyperfine — and the trap it exists to refuse
   ──────────────────────────────────────────────────────────────────────── */

describe("foldHyperfine", () => {
  it("carries the timings and the reason the row is in the set", () => {
    const [reading] = foldHyperfine(exported(), [resolved("pnpm check")]);
    expect(reading).toMatchObject({
      command: "pnpm check",
      script: "check",
      runs: 3,
      medianSeconds: 9.5,
      stddevSeconds: 0.5,
    });
  });

  it("⚠ REFUSES a command that exited non-zero — a failing command is FAST", () => {
    expect(() => foldHyperfine(exported({ exit_codes: [0, 1, 0] }), [resolved("pnpm check")])).toThrow(
      /exited 1.*failing command is FAST/s,
    );
  });

  it("reports no spread for a single run rather than a stddev of zero", () => {
    // A `± 0.00 s` on one run reads as a perfectly repeatable measurement. It
    // is not a measurement of repeatability at all.
    const [reading] = foldHyperfine(
      exported({ times: [42], exit_codes: [0], stddev: 0 }),
      [resolved("pnpm check")],
    );
    expect(reading!.stddevSeconds).toBeNull();
    expect(renderBenchRows([reading!], "T").join("\n")).toMatch(/1 run — no spread/);
  });

  it("REFUSES an export with no results", () => {
    expect(() => foldHyperfine({ results: [] }, [resolved("pnpm check")])).toThrow(/no results/);
  });

  it("REFUSES an export whose command is not in this run's set", () => {
    // The export file is reused across invocations; reading a previous run's
    // file would otherwise attribute an old number to a new command.
    expect(() => foldHyperfine(exported({ command: "pnpm build" }), [resolved("pnpm check")])).toThrow(
      /does not belong to this run/,
    );
  });
});

describe("seconds", () => {
  it("switches to minutes where a bare seconds figure stops being readable", () => {
    expect(seconds(9.456)).toBe("9.46 s");
    expect(seconds(125)).toBe("2m 05s");
  });

  it("never prints sixty seconds (PR #745 review, nit 2)", () => {
    // 119.6 rendered `1m 60s` while the minutes were taken before the rounding.
    expect(seconds(119.6)).toBe("2m 00s");
    expect(seconds(59.6)).toBe("59.60 s");
    expect(seconds(60)).toBe("1m 00s");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2b. THE ARGUMENT GUARDS — both scripts refuse rather than dropping
   ──────────────────────────────────────────────────────────────────────── */

describe("the two entrypoints refuse a partially-understood command line", () => {
  /*
    ⚠ BOTH OF THESE SHIPPED WRONG AND WERE FOUND BY THE PR #745 REVIEW, in the
    two files whose own comments cite #289 — the `--dry-run` nobody had
    implemented, silently ignored, closing a LIVE production row. The arms are
    at the BYTES rather than by spawning the scripts: each is a top-level guard
    that runs at import and calls `process.exit`, so importing one inside vitest
    would take the runner down with it.
  */
  /* Comments stripped, so a comment EXPLAINING the banned shape cannot trip
     the rule — the house convention (`counts415-guard.test.ts`'s `code`), and
     it caught this arm's own first cut: the `not.toMatch` fired on the note
     recording what the guard used to do. */
  const scriptSource = (name: string) =>
    readFileSync(path.join(ROOT, "scripts", name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("bundle-report refuses `--flag=value` instead of accepting and ignoring it", () => {
    const source = scriptSource("bundle-report.mts");
    // The consumers read exact strings, so an `=` form that PASSES the guard is
    // silently dropped. It must be refused by name.
    expect(source).toMatch(/if\s*\(arg\.includes\("="\)\)/);
    expect(source, "splitting on = is what let --top=20 through").not.toMatch(
      /KNOWN\.has\(arg\.split\("="\)/,
    );
  });

  it("bench refuses an --only name that is not in the set, even beside a good one", () => {
    const source = scriptSource("bench-commands.mts");
    expect(source).toMatch(/const unknown = only\.filter\(\(name\) => !known\.has\(name\)\)/);
    expect(source).toMatch(/if \(unknown\.length > 0\)/);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3. The pinned binary — bad bytes must never reach the disk as an executable
   ──────────────────────────────────────────────────────────────────────── */

describe("hyperfine pins", () => {
  it("pins exactly the two platforms this project runs on", () => {
    expect(Object.keys(HYPERFINE_PINS).sort()).toEqual(["linux-x64", "win32-x64"]);
    for (const [key, pin] of Object.entries(HYPERFINE_PINS)) {
      expect(pin.sha256, key).toMatch(/^[0-9a-f]{64}$/);
      expect(pin.asset, key).toContain(HYPERFINE_VERSION);
    }
  });

  it("REFUSES an unpinned platform by name, rather than guessing an asset", () => {
    expect(() => pinFor("darwin", "arm64")).toThrow(/no pinned build for darwin-arm64/);
  });

  it("builds the release URL from the pin, so version and asset cannot disagree", () => {
    const url = downloadUrl(HYPERFINE_PINS["linux-x64"]!);
    expect(url).toContain(`/v${HYPERFINE_VERSION}/`);
    expect(url.endsWith(HYPERFINE_PINS["linux-x64"]!.asset)).toBe(true);
  });

  it("assertChecksum passes the right bytes and refuses the wrong ones", () => {
    // ⚠ NOT sha256("drape") — this is the WRONG-BYTES fixture, invented to be
    // refused. (PR #745 review, nit 1: it was labelled as the real hash, which
    // a later reader "fixing" the test could have copied believing it.) The
    // real hash is computed below, as the positive control, so a checker that
    // threw at everything could not pass this suite.
    const sha = "8d0f2a3fbd8f4d0f4e5b6b6b0e6e0a3a1f9e4c1f0a2b3c4d5e6f708192a3b4c5";
    expect(() => assertChecksum(new TextEncoder().encode("drape"), sha, "fixture")).toThrow(
      /checksum mismatch/,
    );
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    const real = createHash("sha256").update("drape").digest("hex");
    expect(() => assertChecksum(new TextEncoder().encode("drape"), real, "fixture")).not.toThrow();
  });

  it("⚠ writes NOTHING to the cache when the download fails its checksum", async () => {
    const cacheDir = mkdtempSync(path.join(tmpdir(), "drape-hf-cache-"));
    await expect(
      ensureHyperfine({
        cacheDir,
        platform: "linux",
        arch: "x64",
        download: async () => new TextEncoder().encode("not the release"),
      }),
    ).rejects.toThrow(/checksum mismatch/);
    // The bytes never became a file, let alone an executable one.
    expect(readdirSync(cacheDir)).toEqual([]);
  });

  it("returns a cached binary without downloading again", async () => {
    const cacheDir = mkdtempSync(path.join(tmpdir(), "drape-hf-cache-"));
    const versioned = path.join(cacheDir, `hyperfine-${HYPERFINE_VERSION}`);
    const { mkdirSync, writeFileSync } = require("node:fs") as typeof import("node:fs");
    mkdirSync(versioned, { recursive: true });
    writeFileSync(path.join(versioned, "hyperfine"), "#!/bin/sh\n");

    const found = await ensureHyperfine({
      cacheDir,
      platform: "linux",
      arch: "x64",
      download: async () => {
        throw new Error("the cache was not consulted");
      },
    });
    expect(existsSync(found)).toBe(true);
    expect(found).toContain(HYPERFINE_VERSION);
  });
});
