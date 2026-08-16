/**
 * WHERE A PAID EDIT'S MINUTES GO — read off the census rows that already exist.
 *
 * Ordered by the founder in person (fable-678 §5): *"3 minutes is very long for
 * a render — have we looked at why?"* Measurement only. This script reads rows
 * and prints a table; it changes nothing and spends nothing.
 *
 * # What it reads
 *
 * `refineService` persists its call census inside the variant row's
 * `internalPrompt` JSON (`.census`), because a container log's window rotates
 * on every deploy. Each census carries every outbound model call — stage,
 * model, milliseconds, and `about` (a closed vocabulary: a region name or a
 * ReadPurpose, never anybody's prose).
 *
 * # The coverage caveat, stated before any number
 *
 * The persisted field is `censusSoFar()`, taken when the row lands. Anything
 * spent AFTER the picture is stored is missing from it, and the complete figure
 * only ever went to a log line. So every total here is a FLOOR on the true
 * spend, and the script prints how many rows in the window carry a census at
 * all — a decomposition over a thin slice would be an invented denominator.
 */
import "dotenv/config";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);

type Call = { stage?: string; model?: string; ms?: number; ok?: boolean; about?: string };
type Census = {
  calls?: Call[];
  total?: { calls?: number; ms?: number; failed?: number; labelledCalls?: number };
  wallMs?: number;
  byStage?: Record<string, { calls: number; ms: number }>;
};

const pct = (part: number, whole: number) => (whole === 0 ? "  n/a" : `${((part / whole) * 100).toFixed(1)}%`);
const secs = (ms: number) => (ms / 1000).toFixed(1);

async function main(): Promise<void> {
  const url = resolveDatabaseUrl();
  console.log(`world: ${worldOf(url)}   (key: ${databaseKey})\n`);
  const db = await openDatabase(url);

  const [rows] = await db.execute(
    `SELECT id, createdAt, internalPrompt
       FROM casting_candidate_variants
      WHERE internalPrompt IS NOT NULL
      ORDER BY id DESC
      LIMIT 400`,
  );

  const all = rows as Array<{ id: number; createdAt: Date; internalPrompt: unknown }>;
  const censuses: { id: number; at: Date; census: Census }[] = [];
  for (const row of all) {
    let parsed: { census?: Census } | null = null;
    try {
      parsed = typeof row.internalPrompt === "string"
        ? JSON.parse(row.internalPrompt) as { census?: Census }
        : row.internalPrompt as { census?: Census };
    } catch { parsed = null; }
    if (parsed?.census?.calls?.length) censuses.push({ id: row.id, at: row.createdAt, census: parsed.census });
  }

  console.log(`COVERAGE  ${censuses.length} of ${all.length} variant rows read carry a census`
    + `  (${pct(censuses.length, all.length)})`);
  if (censuses.length === 0) { console.log("\nNo census rows in this world — nothing to decompose."); await db.end(); return; }
  const span = [censuses[censuses.length - 1]!.at, censuses[0]!.at];
  console.log(`WINDOW    ${new Date(span[0]!).toISOString()} → ${new Date(span[1]!).toISOString()}`);
  console.log(`FLOOR     every total below is a floor: the persisted census is`);
  console.log(`          censusSoFar() at row-landing, so post-landing spend is absent.\n`);

  // ── the wall, per edit ────────────────────────────────────────────────
  const walls = censuses.map((c) => c.census.wallMs ?? 0).filter((w) => w > 0).sort((a, b) => a - b);
  const sums = censuses.map((c) => (c.census.calls ?? []).reduce((t, call) => t + (call.ms ?? 0), 0));
  const median = (xs: number[]) => (xs.length === 0 ? 0 : xs[Math.floor(xs.length / 2)]!);
  console.log(`WALL PER EDIT (n=${walls.length})   median ${secs(median(walls))}s`
    + `   p10 ${secs(walls[Math.floor(walls.length * 0.1)] ?? 0)}s`
    + `   p90 ${secs(walls[Math.floor(walls.length * 0.9)] ?? 0)}s`);
  console.log(`SUM OF CALL TIME             median ${secs(median([...sums].sort((a, b) => a - b)))}s`);
  console.log(`  (sum ≈ wall means a queue of serial round trips; sum >> wall means parallel)\n`);

  // ── where the time goes, per stage ────────────────────────────────────
  const byStage = new Map<string, { calls: number; ms: number; rows: Set<number> }>();
  let totalCalls = 0, totalMs = 0, labelled = 0;
  const byAbout = new Map<string, { calls: number; ms: number }>();
  for (const { id, census } of censuses) {
    for (const call of census.calls ?? []) {
      const stage = call.stage ?? "(unlabelled)";
      const entry = byStage.get(stage) ?? { calls: 0, ms: 0, rows: new Set<number>() };
      entry.calls += 1; entry.ms += call.ms ?? 0; entry.rows.add(id);
      byStage.set(stage, entry);
      totalCalls += 1; totalMs += call.ms ?? 0;
      if (call.about) {
        labelled += 1;
        const a = byAbout.get(call.about) ?? { calls: 0, ms: 0 };
        a.calls += 1; a.ms += call.ms ?? 0;
        byAbout.set(call.about, a);
      }
    }
  }

  const n = censuses.length;
  console.log(`STAGE            calls  calls/edit   total s   s/edit   share of call time`);
  for (const [stage, e] of [...byStage.entries()].sort((a, b) => b[1].ms - a[1].ms)) {
    console.log(`  ${stage.padEnd(14)}${String(e.calls).padStart(6)}`
      + `${(e.calls / n).toFixed(1).padStart(12)}`
      + `${secs(e.ms).padStart(10)}`
      + `${(e.ms / n / 1000).toFixed(1).padStart(9)}`
      + `${pct(e.ms, totalMs).padStart(21)}`);
  }
  const paint = byStage.get("render")?.ms ?? 0;
  console.log(`\n  PAINT ${secs(paint / n)}s per edit · EVERYTHING ELSE ${secs((totalMs - paint) / n)}s per edit`
    + `   (${pct(totalMs - paint, totalMs)} of call time)`);

  // ── and per question ──────────────────────────────────────────────────
  console.log(`\nBY QUESTION   labelled ${labelled} of ${totalCalls} calls (${pct(labelled, totalCalls)})`);
  console.log(`  an unlabelled call is counted in the totals above and NOT below.`);
  for (const [about, e] of [...byAbout.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 20)) {
    console.log(`  ${about.padEnd(34)}${String(e.calls).padStart(5)} calls`
      + `${(e.calls / n).toFixed(2).padStart(8)}/edit`
      + `${secs(e.ms / n).padStart(9)}s/edit`);
  }

  // ── duplicates: the same question asked twice inside ONE edit ─────────
  console.log(`\nSAME QUESTION TWICE IN ONE EDIT (the duplicate-ask candidate)`);
  const dupes = new Map<string, { edits: number; extraCalls: number; extraMs: number }>();
  for (const { census } of censuses) {
    const seen = new Map<string, { count: number; ms: number }>();
    for (const call of census.calls ?? []) {
      if (!call.about) continue;
      const key = `${call.stage ?? "?"}:${call.about}`;
      const s = seen.get(key) ?? { count: 0, ms: 0 };
      s.count += 1; s.ms += call.ms ?? 0;
      seen.set(key, s);
    }
    for (const [key, s] of seen) {
      if (s.count < 2) continue;
      const d = dupes.get(key) ?? { edits: 0, extraCalls: 0, extraMs: 0 };
      d.edits += 1;
      d.extraCalls += s.count - 1;
      d.extraMs += (s.ms / s.count) * (s.count - 1);
      dupes.set(key, d);
    }
  }
  if (dupes.size === 0) console.log("  none — no question is asked twice inside a single edit.");
  for (const [key, d] of [...dupes.entries()].sort((a, b) => b[1].extraMs - a[1].extraMs).slice(0, 15)) {
    console.log(`  ${key.padEnd(40)} in ${String(d.edits).padStart(3)}/${n} edits`
      + `  +${d.extraCalls} calls  +${secs(d.extraMs / n)}s/edit if removed`);
  }

  // ── the concurrency bound, measured off the runs themselves ───────────
  /*
    A maximal RUN of consecutive same-stage segment calls is the shape a loop
    over independent regions produces — `for (…) { await regionOf(…) }`. If a
    run of k calls were issued together instead of one after another, its cost
    falls from the SUM to the SLOWEST, so sum-minus-max is the saving per run.

    BOUNDED, NOT MEASURED: consecutive-in-completion-order is evidence of a
    serial loop, not proof that every call in a run is independent. Read
    alongside `maskedRefine.ts:1122`, which is one such loop in the open.
  */
  const boundFor = (stage: string): number[] => censuses.map(({ census }) => {
    let saved = 0;
    let runSum = 0;
    let runMax = 0;
    let runLen = 0;
    const closeRun = () => {
      if (runLen > 1) saved += runSum - runMax;
      runSum = 0; runMax = 0; runLen = 0;
    };
    for (const call of census.calls ?? []) {
      if (call.stage === stage) {
        runLen += 1;
        runSum += call.ms ?? 0;
        runMax = Math.max(runMax, call.ms ?? 0);
      } else closeRun();
    }
    closeRun();
    return saved;
  });

  for (const stage of ["segment", "read"]) {
    const perEdit = boundFor(stage);
    const savings = [...perEdit].sort((a, b) => a - b);
    console.log(`\nCONCURRENCY BOUND — consecutive ${stage} runs (n=${perEdit.length})`);
    console.log(`  median ${secs(median(savings))}s per edit saved if each run were issued`);
    console.log(`  together rather than one after another`);
    console.log(`  p90 ${secs(savings[Math.floor(savings.length * 0.9)] ?? 0)}s`
      + `   max ${secs(savings[savings.length - 1] ?? 0)}s`);
    console.log(`  edits containing a multi-call run: ${perEdit.filter((x) => x > 0).length}/${perEdit.length}`);
  }

  await db.end();
}

await main();
process.exit(0);
