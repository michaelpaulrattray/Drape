/**
 * WHAT THE HOUSE'S OWN COMMANDS COST (#35, the toolbelt remainder).
 *
 * The standing orders measure the shift, not the command: *"median shift 75
 * min = 30 building, 27 WAITING on the gate and reviewer"*, and *"3.1 gate runs
 * per PR over the last 25, at ~7 min each"*. Both numbers are about waiting,
 * and neither says WHICH step the waiting is in. This is the reader that does,
 * and its output is a Machinist ledger row.
 *
 * # The set is DECLARED but the commands are DERIVED (working law 4)
 *
 * A benchmark set that restated its commands as shell strings would be a
 * second copy of `package.json`'s scripts, and it would drift the first time a
 * script was renamed — silently, because a renamed script still benchmarks
 * fine as "pnpm <name>" right up until pnpm says it does not exist, and
 * hyperfine would happily report how long the failure took.
 *
 * So each row names a SCRIPT, `resolveBenchSet` looks it up in the real
 * `package.json`, and a name that is not there is a REFUSAL rather than a
 * short list. What is declared here is only the judgement a manifest cannot
 * hold: how many runs each deserves, and why the Machinist cares.
 *
 * # ⚠ A FAILING COMMAND IS FAST, AND THAT IS THE TRAP
 *
 * hyperfine times whatever it is given and records the exit codes beside the
 * timings. `pnpm check` on a red tree exits in a fraction of the time it takes
 * on a green one, so a bench run during a breakage would report a spectacular
 * improvement. `foldHyperfine` REFUSES any result carrying a non-zero exit
 * code rather than reporting its number — invariant 7's shape: the reading
 * refuses when its premise is missing instead of returning a smaller truth.
 */

export type BenchRow = {
  /** a key of `package.json`'s `scripts` */
  readonly script: string;
  readonly runs: number;
  readonly warmup: number;
  /** why the Machinist cares — carried into the ledger beside the number */
  readonly why: string;
};

/**
 * Run counts are sized by duration, not by importance: three runs of a
 * seven-second check is twenty-one seconds, three runs of the full suite is
 * most of an hour. A single run has no spread and says so in the output.
 */
export const BENCH_SET: readonly BenchRow[] = [
  {
    script: "check",
    runs: 3,
    warmup: 1,
    why: "the gate's first red and every shift's preflight — three tsc passes",
  },
  {
    script: "architecture:check",
    runs: 3,
    warmup: 1,
    why: "runs in the commit hook, the gate and the deploy rite; #501 measured 7.6 s of hook cost",
  },
  {
    script: "capability:check",
    runs: 3,
    warmup: 1,
    why: "the same three places, and the other half of the hook's ~9 s",
  },
  {
    script: "build",
    runs: 2,
    warmup: 1,
    why: "every deploy waits on it; the client half is what machinist:bundle reads",
  },
  {
    script: "test",
    runs: 1,
    warmup: 0,
    why: "the longest single step in the gate — one run, because a second costs the same again",
  },
];

export type PackageManifest = { readonly scripts?: Readonly<Record<string, string>> };

export type ResolvedBench = BenchRow & { readonly command: string };

/**
 * Bind each declared row to a script that really exists.
 *
 * Refuses on the first missing name and lists what IS there, because the whole
 * point of deriving is that a rename is loud.
 */
export function resolveBenchSet(
  manifest: PackageManifest,
  set: readonly BenchRow[] = BENCH_SET,
): ResolvedBench[] {
  const scripts = manifest.scripts ?? {};
  if (Object.keys(scripts).length === 0) {
    throw new Error("bench: package.json declares no scripts — nothing to benchmark");
  }
  if (set.length === 0) {
    throw new Error("bench: the benchmark set is empty — a run of nothing is not a reading");
  }
  return set.map((row) => {
    if (!(row.script in scripts)) {
      throw new Error(
        `bench: package.json has no script "${row.script}" — it was renamed or removed. ` +
          `Available: ${Object.keys(scripts).sort().join(", ")}`,
      );
    }
    return { ...row, command: `pnpm ${row.script}` };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   The fold
   ──────────────────────────────────────────────────────────────────────── */

export type HyperfineResult = {
  readonly command: string;
  readonly mean: number;
  readonly stddev: number | null;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly times: readonly number[];
  readonly exit_codes: readonly number[];
};

export type HyperfineExport = { readonly results: readonly HyperfineResult[] };

export type BenchReading = {
  readonly command: string;
  readonly script: string;
  readonly why: string;
  readonly runs: number;
  readonly meanSeconds: number;
  readonly medianSeconds: number;
  readonly minSeconds: number;
  readonly maxSeconds: number;
  /** null when a single run was asked for — there is no spread to report */
  readonly stddevSeconds: number | null;
};

export function foldHyperfine(
  exported: HyperfineExport,
  resolved: readonly ResolvedBench[],
): BenchReading[] {
  if (!exported.results || exported.results.length === 0) {
    throw new Error("bench: hyperfine exported no results — the run measured nothing");
  }

  const byCommand = new Map(resolved.map((r) => [r.command, r]));
  return exported.results.map((result) => {
    const row = byCommand.get(result.command);
    if (!row) {
      throw new Error(
        `bench: hyperfine timed "${result.command}", which is not in the benchmark set — ` +
          `the export does not belong to this run`,
      );
    }
    // ⚠ The arm this fold exists for. See the header.
    const bad = result.exit_codes.filter((code) => code !== 0);
    if (bad.length > 0) {
      throw new Error(
        `bench: "${result.command}" exited ${bad.join(", ")} — a failing command is FAST, and ` +
          `timing it would report an improvement. Fix the tree, then benchmark it.`,
      );
    }
    if (result.times.length === 0) {
      throw new Error(`bench: "${result.command}" recorded no timings`);
    }
    return {
      command: result.command,
      script: row.script,
      why: row.why,
      runs: result.times.length,
      meanSeconds: result.mean,
      medianSeconds: result.median,
      minSeconds: result.min,
      maxSeconds: result.max,
      stddevSeconds: result.times.length > 1 ? (result.stddev ?? null) : null,
    };
  });
}

export function seconds(value: number): string {
  if (value < 60) return `${value.toFixed(2)} s`;
  /* ⚠ ROUND FIRST, THEN SPLIT (PR #745 review, nit 2). Splitting first and
     rounding the remainder printed `1m 60s` for 119.6 s, because `toFixed(0)`
     carried 59.6 past the boundary the minutes had already been taken from. */
  const whole = Math.round(value);
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, "0")}s`;
}

export function renderBenchRows(readings: readonly BenchReading[], takenAt: string): string[] {
  const lines: string[] = [];
  lines.push(`### House commands — read at ${takenAt}`);
  lines.push("");
  lines.push("| command | median | mean ± σ | runs | why it is here |");
  lines.push("|---|---|---|---|---|");
  for (const r of [...readings].sort((a, b) => b.medianSeconds - a.medianSeconds)) {
    const spread =
      r.stddevSeconds === null
        ? `${seconds(r.meanSeconds)} (1 run — no spread)`
        : `${seconds(r.meanSeconds)} ± ${seconds(r.stddevSeconds)}`;
    lines.push(`| \`${r.command}\` | **${seconds(r.medianSeconds)}** | ${spread} | ${r.runs} | ${r.why} |`);
  }
  lines.push("");
  const total = readings.reduce((n, r) => n + r.medianSeconds, 0);
  lines.push(
    `One serial pass of all ${readings.length} is **${seconds(total)}** at these medians. ` +
      `Machine and load are part of the reading — compare two runs from the same machine, ` +
      `never a number here against one from a CI runner.`,
  );
  return lines;
}
