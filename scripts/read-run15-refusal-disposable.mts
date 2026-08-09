/**
 * WHAT DID THE SERVER ACTUALLY SAY ABOUT RUN-15's STEP 2?
 *
 * The panel told her "We lost contact while that was rendering" after 323.6s,
 * which reads as a transport loss — but the rate table scored the row
 * `refused_honest`, and that classification requires `failureClass =
 * 'facts_missing'`. Those two stories are not the same story, and the row is
 * the one that counts.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/read-run15-refusal-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["MYSQL_PUBLIC_URL"]);
const url = process.env.MYSQL_PUBLIC_URL;
if (!url) throw new Error("run under `railway run --service MySQL`");

const connection = await openDatabase(url);
const [rows] = await connection.query<any[]>(
  `SELECT v.publicId, v.status, v.failureClass, v.createdAt,
          JSON_EXTRACT(v.instructions, "$[0]") AS instruction,
          v.pointsCost
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
    WHERE c.publicId = '154fb36b-334e-4cb1-92aa-9a2c567f6d26'
    ORDER BY v.createdAt`,
);
await connection.end();

for (const row of rows) {
  console.log(`${utc(row.createdAt)}  ${String(row.status).padEnd(10)} `
    + `${String(row.failureClass ?? "—").padEnd(16)} cost ${String(row.pointsCost).padStart(3)}  "${row.instruction}"`);
}
