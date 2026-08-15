/**
 * WHY A SAM 3 CALL COSTS 8.0s IN DEV AND 1.8s IN PRODUCTION — the cheap check
 * approved by fable-657 §3.
 *
 * The census reads the same model at wildly different speeds in the two worlds,
 * and the difference is uniform across questions (`earring` 6.50s vs 1.45s,
 * `eye` 8.89s vs 2.33s), so it is not a question-mix effect. Two candidates:
 *
 *   PAYLOAD      a frame with no public URL is base64'd into every request
 *                (~2.3 MB), while `addressIfIdentical` lets a proven-identical
 *                frame be sent as an address.
 *   CONTENTION   dev renders come largely from BENCHES, which run many lanes at
 *                once against one fal account. Our own gate admits up to
 *                FAL_CONCURRENCY, and the provider queues behind that — which
 *                lands inside the census's per-call timing, because the gate
 *                wait does not (`throughFalGate` wraps `throughCensus`, so the
 *                timer starts after a slot is won).
 *
 * This distinguishes them for free, off rows already written: if dev's slow
 * calls belong to renders that OVERLAP each other in time and production's do
 * not, it is contention. If dev's calls are uniformly slow whether or not
 * anything else was running, it is payload.
 *
 *   npx tsx scripts/sam-latency-worlds-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/sam-latency-worlds-disposable.mts
 */
import "dotenv/config";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mjs";

const databaseUrl = resolveDatabaseUrl();
const db = await openDatabase(databaseUrl);

const [rows] = await db.query(
  `SELECT id, createdAt, internalPrompt
     FROM casting_candidate_variants
    WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 8 DAY)
      AND internalPrompt IS NOT NULL
    ORDER BY createdAt`,
);

const readJson = (value: unknown): any => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } }
  return null;
};

type Render = { id: number; start: number; end: number; samMs: number[]; };

const renders: Render[] = [];
for (const row of rows as any[]) {
  const census = readJson(row.internalPrompt)?.census;
  if (!census || !Array.isArray(census.calls)) continue;
  const sam = census.calls
    .filter((call: any) => String(call.model ?? "").includes("sam-3"))
    .map((call: any) => Number(call.ms) || 0);
  if (sam.length === 0) continue;
  /* The row lands at the END of the census window, so the window opened
     `wallMs` before it. Both come off the same row, so this is arithmetic
     rather than an estimate. */
  const end = new Date(row.createdAt).getTime();
  renders.push({ id: row.id, start: end - (Number(census.wallMs) || 0), end, samMs: sam });
}

/** How many OTHER renders were in flight while this one ran. */
const overlaps = (one: Render): number =>
  renders.filter((other) => other.id !== one.id && other.start < one.end && one.start < other.end).length;

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, one) => sum + one, 0) / values.length;

console.log(`\nSAM 3 PER-CALL SECONDS vs HOW BUSY THE WORLD WAS`);
console.log(`  world: ${worldOf(databaseUrl)}   (dev is :52008, production is :23768)\n`);

if (renders.length === 0) {
  console.log("  no censused render in this window made a SAM 3 call — nothing to read.\n");
  await db.end();
  process.exit(0);
}

const alone = renders.filter((one) => overlaps(one) === 0);
const crowded = renders.filter((one) => overlaps(one) > 0);

const line = (label: string, group: Render[]) => {
  const calls = group.flatMap((one) => one.samMs);
  console.log(
    `  ${label.padEnd(28)} ${String(group.length).padStart(3)} renders  `
    + `${String(calls.length).padStart(4)} sam calls  `
    + `${(mean(calls) / 1000).toFixed(2)}s each`,
  );
};

line("ran ALONE", alone);
line("ran WITH other renders", crowded);

console.log(`\n  the busiest render overlapped ${Math.max(...renders.map(overlaps))} others`);
console.log(`  renders in the window: ${renders.length}\n`);

/*
  THE READING, AND ITS OWN LIMIT. Both arms must be non-empty for the
  comparison to say anything — a world where every render ran alone, or every
  one ran crowded, has no contrast in it and is reported as such rather than as
  a null result.
*/
if (alone.length === 0 || crowded.length === 0) {
  console.log("  ONE ARM IS EMPTY — this world has no contrast to read, which is not the same");
  console.log("  as finding no effect. Compare it against the other world's arms.\n");
}

await db.end();
process.exit(0);
