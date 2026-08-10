/**
 * WHICH ROLLS STILL HOLD A FACE NOBODY HAS TOUCHED — on the walk's own
 * definition, not a near neighbour of it.
 *
 * A first attempt counted `selectedVariantId IS NULL`, which is a DIFFERENT
 * question: a candidate can carry a whole chain of refinements and still have
 * no selection. It named a roll the walk then refused, correctly. The walk's
 * rule is the one that matters — **no variant rows at all** — so this asks that.
 *
 * Position 0 is excluded: it is the founder's signed Cast and is never walked.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/find-fresh-faces-disposable.mts
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT r.publicId AS roll, LEFT(r.briefText, 62) AS brief, r.createdAt,
          COUNT(*) AS fresh
     FROM casting_rolls r
     JOIN casting_candidates c ON c.rollId = r.id
     LEFT JOIN casting_candidate_variants v ON v.candidateId = c.id
    WHERE r.userId = 1
      AND c.status = 'ready'
      AND c.position > 0
      AND v.id IS NULL
    GROUP BY r.id
    ORDER BY r.createdAt DESC
    LIMIT 12`,
);
await connection.end();

console.log("roll      fresh  created           brief");
for (const row of rows) {
  console.log(`${String(row.roll).slice(0, 8)}  ${String(row.fresh).padStart(5)}  `
    + `${String(row.createdAt).slice(0, 16)}  ${row.brief}`);
}
console.log(`\nthe walk needs a BESPECTACLED face — step 5 is "remove her glasses".`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
