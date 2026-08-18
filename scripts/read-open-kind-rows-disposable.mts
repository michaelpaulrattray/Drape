/**
 * DOES ANY LIVE FACE CARRY AN OPEN KIND? — read off rows already paid for.
 *
 * Written to settle one sentence I had carried from a previous shift's report
 * without checking it: *"production is on the words road throughout, so this
 * build is inert there."* That sentence was written about the CARRY/EDIT SPLIT,
 * whose inertness comes from production minting no crops. The presence verifier
 * is gated on something else entirely — the REPAINT road — and production has
 * `CASTING_REPAINT_SCOPE=users:1`.
 *
 * Two controls before the verdict, and both must print:
 *   negative — a query for a kind nobody has ever asked for returns 0 rows
 *   positive — the same query shape over `deltas` finds the closed-lane rows it
 *              must, so a 0 on the open lane is an absence and not a broken LIKE
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-open-kind-rows-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);

const count = async (where: string): Promise<number> => {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS n FROM casting_candidate_variants WHERE ${where}`,
  );
  return Number(rows[0]?.n ?? 0);
};

/* CONTROL (negative) — a token no ask has ever produced. */
const impossible = await count(`JSON_EXTRACT(deltas, '$.open') IS NOT NULL
  AND JSON_CONTAINS_PATH(deltas, 'one', '$.open.zzzznotakind')`);
/* CONTROL (positive) — the closed lane, same column, same reader. */
const closed = await count(`JSON_EXTRACT(deltas, '$.free') IS NOT NULL`);
const open = await count(`JSON_EXTRACT(deltas, '$.open') IS NOT NULL`);

console.log(`world ${databaseUrl.replace(/.*@/, "").replace(/\/.*/, "")}`);
console.log(`  CONTROL negative — variants naming an invented kind: ${impossible} (must be 0)`);
console.log(`  CONTROL positive — variants with a closed free delta:  ${closed} (must be > 0)`);
console.log(`  variants carrying delta.open:                          ${open}`);

if (open > 0) {
  const [rows] = await connection.query<any[]>(
    `SELECT id, publicId, userId, status, createdAt, JSON_EXTRACT(deltas, '$.open') AS open
       FROM casting_candidate_variants
      WHERE JSON_EXTRACT(deltas, '$.open') IS NOT NULL
      ORDER BY id DESC LIMIT 20`,
  );
  console.log("");
  for (const row of rows) {
    console.log(`  v#${row.id} ${row.publicId} user ${row.userId} ${row.status} `
      + `${utc(row.createdAt)} — ${String(row.open).slice(0, 90)}`);
  }
}

await connection.end();
/* A pooled connection keeps the event loop alive; the repository rule is that a
   script ends by ENDING, so a reader is never left watching a finished run. */
process.exit(0);
