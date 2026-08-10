/**
 * READ-ONLY: did the campaign's 2026-08-08 renders happen in THIS database?
 *
 * The walk's control specimens (v#147/155/156/163/164) are absent, and
 * AUTO_INCREMENT says ids past 141 have never existed here. Two very different
 * explanations, and the credit ledger settles it: charges are never purged with
 * a candidate, so if those renders happened here their receipts are still here.
 */
import "dotenv/config";
import { openDatabase, utc } from "./lib/dbConnection.mjs";

const connection = await openDatabase();
try {
  const [byDay] = await connection.query<any[]>(`
    SELECT DATE(createdAt) AS day, COUNT(*) AS n, SUM(amount) AS credits
      FROM point_transactions
     WHERE userId = 1 AND createdAt >= '2026-08-04'
     GROUP BY DATE(createdAt) ORDER BY day
  `);
  console.log("user 1 credit transactions by day:");
  for (const row of byDay) console.log(`  ${String(row.day).slice(0, 10)}  ${String(row.n).padStart(4)} rows  ${row.credits} credits`);

  const [refines] = await connection.query<any[]>(`
    SELECT id, amount, reason, createdAt
      FROM point_transactions
     WHERE userId = 1 AND createdAt BETWEEN '2026-08-08' AND '2026-08-09 23:59:59'
     ORDER BY id LIMIT 12
  `);
  console.log(`\nthe 8th–9th, first ${refines.length}:`);
  for (const row of refines) {
    console.log(`  #${row.id} ${String(row.amount).padStart(5)} ${utc(row.createdAt)} ${String(row.reason ?? "").slice(0, 60)}`);
  }

  const [candidates] = await connection.query<any[]>(
    "SELECT COUNT(*) AS n, MIN(id) AS lo, MAX(id) AS hi FROM casting_candidates WHERE userId = 1",
  );
  console.log(`\nuser 1 candidates alive: ${candidates[0].n} (ids ${candidates[0].lo}–${candidates[0].hi})`);
  const [autoCandidates] = await connection.query<any[]>(
    "SELECT AUTO_INCREMENT AS next FROM information_schema.TABLES"
    + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'casting_candidates'",
  );
  console.log(`casting_candidates AUTO_INCREMENT = ${autoCandidates[0]?.next}`);
} finally {
  await connection.end();
}
