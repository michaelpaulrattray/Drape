/** The two rows item 6 names, by publicId — the identifiers a money script
 *  must be pinned to, plus the charge each one carries. Reads only. */
import mysql from "mysql2/promise";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { openDatabase } from "./lib/dbConnection.mts";
const key = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([key]);
const url = process.env[key];
if (!url) { console.error("no database url"); process.exit(1); }
const connection = await openDatabase({ uri: url, timezone: "Z" } as any);
const [rows] = await connection.query<any[]>(
  `SELECT v.id, v.publicId, v.userId, v.requestText, v.status, v.pointsCost, v.operationId,
          v.createdAt, o.chargedCredits, o.refundedCredits, o.chargeReferenceId
     FROM casting_candidate_variants v
     LEFT JOIN generation_operations o ON o.id = v.operationId
    WHERE v.id IN (164,165)`,
);
for (const r of rows) {
  console.log(`v#${r.id}  publicId=${r.publicId}  user=${r.userId}  "${r.requestText}"`);
  console.log(`    status=${r.status} cost=${r.pointsCost}  charged=${r.chargedCredits} refunded=${r.refundedCredits}`);
  console.log(`    operation=${r.operationId}  chargeRef=${r.chargeReferenceId}`);
}
const [existing] = await connection.query<any[]>(
  `SELECT id, type, amount, referenceId, balanceAfter FROM point_transactions
    WHERE referenceId LIKE 'refund:correction:%' ORDER BY id DESC LIMIT 10`,
);
console.log(`\nexisting refund:correction rows (${existing.length}):`);
for (const r of existing) console.log(`  #${r.id} ${r.type} ${r.amount} ${r.referenceId} balance=${r.balanceAfter}`);
const [bal] = await connection.query<any[]>(`SELECT balance FROM points WHERE userId = 1`);
console.log(`\nuser 1 balance now: ${bal[0]?.balance}`);
await connection.end();
process.exit(0);
