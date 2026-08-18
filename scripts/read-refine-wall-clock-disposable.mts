/**
 * HOW LONG A PAID REFINE HOLDS ITS HTTP REQUEST OPEN — against the ~300s wall.
 *
 * Roadmap §1 carries "the gateway-outliving-refine topology (~300s Railway edge
 * timeout swallowing honest refusals)". The wall is OBSERVED, not documented:
 * run-9's step 5 waited 304.9s and was answered by a gateway's plain-text 502
 * (`client/src/lib/failureSentence.ts`), and run-15's step 2 completed honestly
 * at 293.0s while the panel was told at 323.6s.
 *
 * # THE CONFOUND THIS SCRIPT EXISTS TO AVOID
 *
 * `completedAt - createdAt` is NOT one measurement. For an operation its own
 * worker settled, it is the render. For an operation the RECOVERY SWEEP settled,
 * it is the recovery clock — the lease (300s) plus up to one 60s sweep, exactly
 * the window CLAUDE.md documents as the accepted deploy-collision cost. Those
 * rows land at 300-360s by construction and would manufacture a cluster just
 * past the wall out of a class that never rendered at all.
 *
 * The discriminator is the UNION of two, and it took both to be right.
 *
 *   a. the variant row stamped `failureClass = 'recovered'`
 *      (`refineRecovery.ts:200`) — structural, and INCOMPLETE: that stamp is
 *      written inside the fenced branch, and a LEFT JOIN over an operation with
 *      no variant row at all yields NULL, which is not 'recovered'. On
 *      production it caught 1 of 5.
 *   b. the sweep's own sentence. Normally reading a spelling for a meaning, and
 *      admissible only because it was PROVEN unique first:
 *      `grep -rn "didn't come through" server/` returns exactly one writer
 *      outside tests — `refineRecovery.ts:320`. If a second site ever writes
 *      that sentence, this arm silently over-counts.
 *
 *   npx tsx scripts/read-refine-wall-clock-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/…
 */
import "dotenv/config";

import { openDatabase, resolveDatabaseUrl, utc, worldOf } from "./lib/dbConnection.mts";

const databaseUrl = resolveDatabaseUrl();
const db = await openDatabase(databaseUrl);

console.log(`\nA PAID REFINE'S HELD REQUEST vs THE OBSERVED ~300s WALL`);
console.log(`  world: ${worldOf(databaseUrl)}   (dev is :52008, production is :23768)\n`);

const resolves = async (sql: string): Promise<boolean> => {
  try { await db.query(sql); return true; } catch { return false; }
};
const positive = await resolves("SELECT failureClass FROM casting_candidate_variants LIMIT 1");
const negative = await resolves("SELECT zzzNoSuchColumn FROM casting_candidate_variants LIMIT 1");
console.log(`  control  positive  casting_candidate_variants.failureClass  ${positive ? "resolved" : "ABSENT"}`);
console.log(`  control  negative  …zzzNoSuchColumn                        ${negative ? "RESOLVED" : "absent"}`);
if (!positive || negative) {
  console.log(`\n  A CONTROL FAILED — no verdict is printed.\n`);
  await db.end();
  process.exit(1);
}

const [rows] = await db.query(
  `SELECT o.id, o.userId, o.status, o.errorCode, o.publicMessage, o.createdAt,
          TIMESTAMPDIFF(SECOND, o.createdAt, o.completedAt) AS seconds,
          v.failureClass AS failureClass
     FROM generation_operations o
     LEFT JOIN casting_candidate_variants v ON v.operationId = o.id
    WHERE o.kind = 'castingV2.refine'
      AND o.completedAt IS NOT NULL
    ORDER BY seconds DESC`,
);

const all = (rows as any[]).map((row) => ({ ...row, seconds: Number(row.seconds) }));
if (all.length === 0) {
  console.log(`\n  no settled refine in this world — nothing to read.\n`);
  await db.end();
  process.exit(0);
}

/* THE SPLIT. `recovered` means the sweep settled it, so its seconds are the
   recovery clock and belong in a different table, not in a percentile of
   render durations. */
const SWEEP_SENTENCE = "That refinement didn't come through. Your credits have been returned.";
const sweptRow = (row: any): boolean =>
  row.failureClass === "recovered" || String(row.publicMessage ?? "") === SWEEP_SENTENCE;
const swept = all.filter(sweptRow);
const lived = all.filter((row) => !sweptRow(row));
const stampedOnly = all.filter((row) => row.failureClass === "recovered").length;
console.log(`\n  the two arms of the sweep discriminator: stamped ${stampedOnly}`
  + ` · sentence-or-stamped ${swept.length}`);

const byUser = new Map<number, number>();
for (const row of all) byUser.set(Number(row.userId), (byUser.get(Number(row.userId)) ?? 0) + 1);
console.log(`\n  WHOSE THEY ARE`);
for (const [userId, count] of [...byUser].sort((a, b) => b[1] - a[1])) {
  console.log(`    user ${String(userId).padEnd(6)} ${String(count).padStart(4)} settled refines`);
}

console.log(`\n  SETTLED REFINES: ${all.length}`);
console.log(`    settled by their own worker (a render)   ${lived.length}`);
console.log(`    settled by the RECOVERY SWEEP            ${swept.length}`
  + `   ← lease + sweep, NOT a render`);

const quantiles = (label: string, group: any[]) => {
  if (group.length === 0) { console.log(`\n  ${label}: none`); return; }
  const sorted = group.map((row) => row.seconds).sort((a, b) => a - b);
  const at = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))]!;
  console.log(`\n  ${label}  (n=${group.length})`);
  console.log(`    median ${at(0.5)}s · p75 ${at(0.75)}s · p90 ${at(0.90)}s`
    + ` · p95 ${at(0.95)}s · max ${sorted[sorted.length - 1]}s`);
};
quantiles("HELD-REQUEST SECONDS, worker-settled only", lived);
quantiles("RECOVERY CLOCK, sweep-settled only", swept);

const band = (group: any[], label: string, keep: (s: number) => boolean) => {
  const hit = group.filter((row) => keep(row.seconds));
  const share = ((hit.length / group.length) * 100).toFixed(1);
  console.log(`    ${label.padEnd(28)} ${String(hit.length).padStart(4)} of ${group.length}  (${share}%)`);
  return hit;
};

console.log(`\n  EXPOSURE TO THE WALL — worker-settled renders only`);
band(lived, "under 240s", (s) => s < 240);
band(lived, "240-290s  (close)", (s) => s >= 240 && s < 290);
band(lived, "290-305s  (the band)", (s) => s >= 290 && s < 305);
const over = band(lived, "305s or more  (past it)", (s) => s >= 305);

if (over.length > 0) {
  console.log(`\n  EVERY RENDER THAT ANSWERED PAST THE OBSERVED WALL`);
  for (const row of over) {
    console.log(
      `    ${String(row.seconds).padStart(5)}s  user ${String(row.userId).padEnd(4)}`
      + ` ${String(row.status).padEnd(11)} ${utc(row.createdAt)}  ${row.id}`,
    );
    console.log(`        "${String(row.publicMessage ?? "(no sentence — it delivered)").slice(0, 140)}"`);
  }
  console.log(
    `\n  Each of these answered its customer into a socket the gateway had already`
    + `\n  closed. The sentence above is what the server decided; the panel showed`
    + `\n  the caller's fallback instead.\n`,
  );
} else {
  console.log(`\n  No worker-settled render has crossed 305s.\n`);
}

await db.end();
process.exit(0);
