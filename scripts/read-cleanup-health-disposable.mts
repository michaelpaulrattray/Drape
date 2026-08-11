/**
 * WHAT THE CLEANUP ALERT HAS BEEN SHOUTING ABOUT — fable-143 §5.
 *
 * `[StorageCleanup] cleanup health requires attention` has fired every 60
 * seconds for the whole retained log window: `failedBatches: 5`,
 * `retainedFailedItems: 6`, `succeededBatches: 72`. An alert ignored for a week
 * is invariant 7 with a schedule, so before re-shaping the alert we find out
 * whether it is right.
 *
 * The question is narrow: WHAT are those five batches and six items, when did
 * they fail, what did they fail on, and are the objects they name still there.
 * Reads only.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-cleanup-health-disposable.mts
 */
import mysql from "mysql2/promise";

import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const url = process.env[databaseKey];
if (!url) { console.error("no database url — run under `railway run --service MySQL`"); process.exit(1); }

const connection = await openDatabase({ uri: url, timezone: "Z" } as any);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};
const stamp = (value: unknown): string =>
  value instanceof Date ? value.toISOString().replace("T", " ").slice(0, 19) : String(value ?? "—");

const [clock] = await query("SELECT NOW() AS now");
console.log(`database NOW() = ${stamp(clock.now)}\n`);

const byStatus = await query(
  `SELECT status, kind, COUNT(*) AS n, MIN(createdAt) AS oldest, MAX(createdAt) AS newest
     FROM storage_cleanup_batches GROUP BY status, kind ORDER BY status, kind`,
);
console.log("--- every cleanup batch, by status and kind ---");
for (const row of byStatus) {
  console.log(`  ${String(row.status).padEnd(11)} ${String(row.kind).padEnd(28)} ${String(row.n).padStart(4)}   ${stamp(row.oldest)} → ${stamp(row.newest)}`);
}

const failed = await query(
  `SELECT id, userId, kind, status, expectedCount, deletedCount, failedCount,
          attemptedAt, createdAt, updatedAt
     FROM storage_cleanup_batches WHERE status IN ('failed','partial') ORDER BY createdAt ASC`,
);
console.log(`\n--- the batches the alert counts (${failed.length}) ---`);
for (const row of failed) {
  console.log(`  ${row.id}`);
  console.log(`     kind=${row.kind} status=${row.status} user=${row.userId}`);
  console.log(`     expected ${row.expectedCount}  deleted ${row.deletedCount}  failed ${row.failedCount}`);
  console.log(`     created ${stamp(row.createdAt)}   attempted ${stamp(row.attemptedAt)}   updated ${stamp(row.updatedAt)}`);
}

const items = await query(
  `SELECT i.id, i.batchId, i.storageKey, i.storageBackend, i.status, i.attempts,
          i.lastErrorCode, i.nextAttemptAt, b.kind, b.status AS batchStatus
     FROM storage_cleanup_items i
     JOIN storage_cleanup_batches b ON b.id = i.batchId
    WHERE i.status <> 'deleted'
    ORDER BY i.id ASC`,
);
console.log(`\n--- the items still held (${items.length}) ---`);
for (const row of items) {
  console.log(`  #${row.id} ${String(row.status).padEnd(10)} attempts=${row.attempts} backend=${row.storageBackend}`);
  console.log(`     key: ${row.storageKey}`);
  console.log(`     batch ${row.batchId}${row.kind ? ` (${row.kind}, ${row.batchStatus})` : ""}`);
  console.log(`     lastErrorCode: ${row.lastErrorCode ?? "(none)"}   next attempt ${stamp(row.nextAttemptAt)}`);
}

/* The other four conditions the predicate ORs together, so the report says
   which one is actually firing rather than leaving it to be guessed. */
const scalar = async (sql: string): Promise<number> => {
  const [row] = await query(sql);
  return Number(Object.values(row ?? { n: 0 })[0] ?? 0);
};
console.log("\n--- which clause of the predicate is true ---");
console.log(`  partial batches            ${await scalar("SELECT COUNT(*) FROM storage_cleanup_batches WHERE status = 'partial'")}`);
console.log(`  failed batches             ${await scalar("SELECT COUNT(*) FROM storage_cleanup_batches WHERE status = 'failed'")}`);
console.log(`  stale leases               ${await scalar("SELECT COUNT(*) FROM storage_cleanup_batches WHERE status = 'processing' AND leaseExpiresAt < NOW()")}`);

await connection.end();
process.exit(0);
