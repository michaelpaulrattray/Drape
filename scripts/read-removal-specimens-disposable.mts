/**
 * WHO IS WEARING SOMETHING WE CAN TAKE OFF — the specimen hunt for the removal
 * class (D-236, shift 63).
 *
 * Shift 62 measured the removal rate at 8 of 8 — on ONE face, ONE object, ONE
 * prompt. D-236 asks for a CLASS, and the base-worn departure class is exactly
 * three kinds wide today (`LANDMARK_OF_ACCESSORY`: glasses, earrings, nose
 * jewellery), because those are the only kinds with a `vacantPhrase` to say.
 *
 * A removal cannot be measured on a face that is not wearing the thing, so this
 * is the cheapest question first: the database lists the ready candidates, and
 * only the printed shortlist is worth a vision read. It does NOT paint, charge
 * or write.
 *
 *   npx tsx scripts/read-removal-specimens-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");

const USER = 1;
const connection = await openDatabase(databaseUrl);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

console.log("=".repeat(96));
console.log(`READY CANDIDATES · world ${databaseKey} · user ${USER}`);
console.log("=".repeat(96));

const rows = await query(
  `SELECT c.id, c.publicId, c.status, c.createdAt, c.imageKey,
          LEFT(r.briefText, 110) AS brief,
          COUNT(DISTINCT v.id) AS variants,
          COUNT(DISTINCT l.id) AS libraryRows
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
     JOIN casting_sessions s ON s.id = r.sessionId
     LEFT JOIN casting_candidate_variants v ON v.candidateId = c.id
     LEFT JOIN casting_reference_library l ON l.candidateId = c.id
    WHERE s.userId = ? AND c.status = 'ready'
    GROUP BY c.id
    ORDER BY c.createdAt DESC`,
  [USER],
);

console.log(`\n${rows.length} ready candidates.\n`);
for (const row of rows) {
  console.log(
    `  ${row.publicId}  #${row.id}  ${utc(row.createdAt)}  variants ${row.variants} · library ${row.libraryRows}`
    + `\n     key ${row.imageKey}`
    + `\n     brief ${JSON.stringify(row.brief)}`,
  );
}

console.log("\n" + "=".repeat(96));
await connection.end();
process.exit(0);
