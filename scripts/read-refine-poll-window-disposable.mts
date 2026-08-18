/**
 * WHICH SIDE OF THE LINE DOES PRODUCTION SIT ON? — the poll-gap artifact
 * (fable-861 §5).
 *
 * # The question
 *
 * The sheet polls `variants` only while a refine is out or a PENDING row sits in
 * the last answer (`CastingSheet.tsx:881`). So the Landing A delivery depends on
 * the client having SEEN the pending row before the socket dies:
 *
 *   NEAR SIDE  the row is in hand when the gateway kills the request → the poll
 *              survives the death, and the poll that empties `pending` is the
 *              same one that delivers `settled`. Landing A works.
 *   FAR SIDE   the request dies before any answer carrying that row arrives →
 *              nothing is polling, and the outcome waits for a focus or a
 *              reload.
 *
 * The first poll fires about four seconds after the click, and the server writes
 * the variant row when it CLAIMS the operation — before the picture is asked
 * for. So the far side needs a death inside the first few seconds.
 *
 * # What this reads
 *
 * Every settled refine on record, with the distance between the variant row's
 * birth and its operation's completion. That interval is how long the pending
 * row was visible to a four-second poll. A distribution far from zero says
 * production lives on the near side; anything near zero is the far side and
 * would mean the fix needs another clause.
 *
 * It reads rows and nothing else — no browser, no money, no writes.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-refine-poll-window-disposable.mts
 */
import "dotenv/config";
/*
  IT DECLARES ITS WORLD NOW, BECAUSE IT IS NO LONGER A ONE-SHOT.
  `assertOneWorld`'s exemption is for a bench run by hand in a known world.
  This file is cited by tracked source and has been promoted into the
  repository, so it is a standing instrument wearing a one-shot's name, and the
  exemption stopped fitting it the moment it was committed. Calling the guard
  makes the name residue rather than a hole.

  The exemption itself was keyed on the `-disposable.mts` SPELLING until
  2026-08-19 — which would have handed this file a one-shot's pass forever, and
  deleting the call below would have reddened nothing. `scriptWorldGuard` now
  keys on TRACKING STATUS instead, so the class is closed rather than this one
  instance: see `trackedScripts` there.
*/
import { assertOneWorld } from "./lib/worldGuard.mts";
assertOneWorld([process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL"]);


/** The sheet's own cadence, from the source, so this reading is about the
 *  product rather than about a number I chose. */
const POLL_MS = 4_000;

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
process.env.DATABASE_URL = databaseUrl;
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);

const { getDb } = await import("../server/db/connection.js");
const { sql } = await import("drizzle-orm");
const db = await getDb();
if (!db) throw new Error("no database");
const rowsOf = async (query: any): Promise<any[]> => {
  const found = (await db.execute(query)) as unknown as any[][];
  return (Array.isArray(found[0]) ? found[0] : found) as any[];
};

const rows = await rowsOf(sql`
  SELECT v.id, v.status, v.createdAt AS born, o.completedAt AS settled,
         TIMESTAMPDIFF(SECOND, v.createdAt, o.completedAt) AS seconds
    FROM casting_candidate_variants v
    JOIN generation_operations o ON o.id = v.operationId
   WHERE o.kind = 'castingV2.refine' AND o.completedAt IS NOT NULL
   ORDER BY o.completedAt DESC
   LIMIT 200`);

if (rows.length === 0) {
  console.log("\nNO SPECIMEN — this world holds no settled refine. The reading is");
  console.log("UNAVAILABLE, not passing (doctrine 6).");
  process.exit(1);
}

const seconds = rows.map((row) => Number(row.seconds)).filter((value) => Number.isFinite(value));
seconds.sort((a, b) => a - b);
const at = (fraction: number) => seconds[Math.min(seconds.length - 1, Math.floor(fraction * seconds.length))]!;
const insidePoll = seconds.filter((value) => value * 1000 <= POLL_MS).length;

console.log(`\nsettled refines on record: ${rows.length}`);
console.log(`  the pending row was visible for (seconds between birth and settlement)`);
console.log(`    min ${seconds[0]}  ·  p10 ${at(0.1)}  ·  median ${at(0.5)}  ·  p90 ${at(0.9)}  ·  max ${seconds[seconds.length - 1]}`);
console.log(`\n  rows that settled INSIDE one poll interval (${POLL_MS / 1000}s): ${insidePoll} of ${seconds.length}`);
console.log(`  — those are the ones a client could have missed entirely, and they are the`);
console.log(`    only population the FAR SIDE can be drawn from.`);

const failed = rows.filter((row) => row.status === "failed" || row.status === "expired");
console.log(`\n  of these, terminal failures (the ones Landing A is FOR): ${failed.length}`);
for (const row of failed.slice(0, 10)) {
  console.log(`    variant ${row.id} ${row.status} — pending for ${row.seconds}s`);
}
console.log("\nBLIND SPOT, named: this measures when the ROW settled, not when the");
console.log("socket died. A request whose gateway killed it at 305s while the render");
console.log("ran on has a long visible window here — which is the point — but a client");
console.log("that never got a single answer is invisible to this table.");
process.exit(0);
