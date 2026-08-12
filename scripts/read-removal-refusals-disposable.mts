/**
 * HOW LONG HAS THE BLIND DOORMAN BEEN THERE — every row it ever refused.
 *
 * The gate that adjudicates a removal compared a non-nullable mask to null and
 * therefore refused every removal that reached it. This counts the damage in
 * rows: which asks, on which days, and what each one cost and returned.
 *
 * Read-only, dev by default. Declares its world.
 *
 *   npx tsx scripts/read-removal-refusals-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-removal-refusals-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const where = new URL((process.env[key] ?? "").replace(/^mysql:/, "http:"));
console.log(`WORLD: ${key} → ${where.hostname}:${where.port}`);
const connection = await openDatabase(process.env[key]!);

const [rows] = await connection.query<any[]>(
  `SELECT v.id, v.publicId, v.userId, v.candidateId, v.requestText, v.status,
          v.failureClass, v.pointsCost, v.createdAt,
          o.chargedCredits, o.refundedCredits
     FROM casting_candidate_variants v
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE v.failureClass = 'removal_not_delivered'
    ORDER BY v.id`,
);

console.log(`\n${rows.length} render(s) ever refused as "the removal did not land"`);
let charged = 0;
let refunded = 0;
for (const row of rows) {
  charged += Number(row.chargedCredits ?? 0);
  refunded += Number(row.refundedCredits ?? 0);
  console.log(`  #${row.id} user ${row.userId} · cand ${row.candidateId} · "${row.requestText}"`
    + ` · charged ${row.chargedCredits ?? "—"} refunded ${row.refundedCredits ?? "—"} · ${utc(row.createdAt)}`);
}
console.log(`\ncharged ${charged} · refunded ${refunded} · unreturned ${charged - refunded}`);

/* And the other half of the same question: has a removal EVER been delivered
   on this road? A vacancy row is written only after the gate passes, so the
   library answers it without needing the variant history. */
const [vacancies] = await connection.query<any[]>(
  `SELECT id, userId, candidateId, slot, version, retiredAt, createdAt
     FROM casting_reference_library WHERE role = 'vacancy' ORDER BY id`,
);
console.log(`\n${vacancies.length} vacancy row(s) in this world — one per removal the gate has ever passed`);
for (const row of vacancies) {
  console.log(`  #${row.id} user ${row.userId} · cand ${row.candidateId} · ${row.slot} v${row.version}`
    + `${row.retiredAt ? " RETIRED" : ""} · ${utc(row.createdAt)}`);
}

await connection.end();
process.exit(0);
