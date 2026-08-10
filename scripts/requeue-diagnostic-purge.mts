/**
 * RE-DRIVE THE SIX FRAMES THE PURGE COULD NOT DELETE.
 *
 * The founder approved keeping the painted frame and mask of a refused render
 * on one condition, in his own words: only until the cleanup worker sweeps
 * them. It never swept one. `deleteExact` refused every diagnostic key as an
 * invalid request and, being non-retryable, stopped forever — five failed
 * batches, six items, `nextAttemptAt` NULL.
 *
 * The guard is fixed and deployed. These rows are not: a failed item with no
 * next attempt is never claimed again, so the objects stay until something
 * puts them back in the queue. This is that something.
 *
 * # It deletes nothing itself, and that is deliberate
 *
 * It resets rows; the WORKER deletes, through the same path every other
 * cleanup uses, with the fixed guard in front of it. A script that deleted the
 * objects directly would be a second deletion path — the parallel copy that
 * drifts — and it would prove nothing about whether the product's own purge
 * works. The point is to prove the purge works.
 *
 * # What it will not touch
 *
 * Only `casting_diagnostic_cleanup` batches in `failed`/`partial`, and only for
 * the user named. It re-uses `requeueFailedStorageCleanupBatch`, which is the
 * product's own helper, rather than writing its own UPDATEs.
 *
 *   railway.cmd run --service MySQL -- sh -c \
 *     'DATABASE_URL=$MYSQL_PUBLIC_URL npx tsx scripts/requeue-diagnostic-purge.mts'
 *   … --apply  to requeue.  … --verify  to read the outcome afterwards.
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const USER_ID = Number(arg("user", "1"));
const KIND = "casting_diagnostic_cleanup";

assertOneWorld(["DATABASE_URL"]);
const url = process.env.DATABASE_URL;
if (!url) { console.error("no DATABASE_URL — the app's own helper reads it, so it must be given one"); process.exit(1); }

const connection = await mysql.createConnection({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const report = async (title: string): Promise<{ held: number; deleted: number }> => {
  const [counts] = await query(
    `SELECT
       SUM(i.status = 'deleted') AS deleted,
       SUM(i.status <> 'deleted') AS held,
       COUNT(*) AS total
     FROM storage_cleanup_items i
     JOIN storage_cleanup_batches b ON b.id = i.batchId
    WHERE b.kind = ? AND b.userId = ?`,
    [KIND, USER_ID],
  );
  const batches = await query(
    `SELECT status, COUNT(*) AS n FROM storage_cleanup_batches
      WHERE kind = ? AND userId = ? GROUP BY status ORDER BY status`,
    [KIND, USER_ID],
  );
  console.log(`\n${title}`);
  console.log(`  items: ${Number(counts.deleted ?? 0)} deleted · ${Number(counts.held ?? 0)} still held · ${counts.total} total`);
  console.log(`  batches: ${batches.map((row) => `${row.status}=${row.n}`).join(" · ") || "(none)"}`);
  return { held: Number(counts.held ?? 0), deleted: Number(counts.deleted ?? 0) };
};

const before = await report("BEFORE");

const stuck = await query(
  `SELECT b.id, b.createdAt FROM storage_cleanup_batches b
    WHERE b.kind = ? AND b.userId = ? AND b.status IN ('failed','partial')
      AND EXISTS (
        SELECT 1 FROM storage_cleanup_items i
         WHERE i.batchId = b.id AND i.status = 'failed'
      )
    ORDER BY b.createdAt ASC`,
  [KIND, USER_ID],
);
console.log(`\nbatches eligible for requeue: ${stuck.length}`);
for (const row of stuck) console.log(`  ${row.id}`);

if (VERIFY) {
  console.log(before.held === 0
    ? "\nVERIFY: every diagnostic frame is deleted — the promise is kept."
    : `\nVERIFY: ${before.held} frame(s) still held. Not done.`);
  await connection.end();
  process.exit(before.held === 0 ? 0 : 1);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing requeued. Re-run with --apply.");
  await connection.end();
  process.exit(0);
}
if (stuck.length === 0) {
  console.log("\nNothing eligible; nothing to do.");
  await connection.end();
  process.exit(0);
}

/* The product's own helper, imported here so a dry run never opens the
   application pool. It refuses any batch that is not failed/partial, which is
   a second lock on top of the query above. */
const { requeueFailedStorageCleanupBatch } = await import("../server/db/storageCleanup.js");

let requeued = 0;
for (const row of stuck) {
  const count = await requeueFailedStorageCleanupBatch({ batchId: String(row.id) });
  requeued += count;
  console.log(`  requeued ${count} item(s) on ${row.id}`);
}
console.log(`\n${requeued} item(s) put back in the queue.`);

await report("AFTER REQUEUE (the worker has not run yet)");
console.log(
  "\nThe worker sweeps every 60s. Re-run with --verify in a few minutes: every\n"
  + "item should read `deleted` and every batch `succeeded`. Until it does, the\n"
  + "promise is still not kept and this is not finished.",
);

await connection.end();
process.exit(0);
