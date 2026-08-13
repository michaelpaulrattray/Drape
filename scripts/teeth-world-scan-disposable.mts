/**
 * IS THERE A SMILE ANYWHERE IN THIS WORLD? — the fixture question, asked of the
 * database rather than of my memory.
 *
 * Twelve masters read by eye show twelve closed mouths, and the roll prompt
 * says why (`cohortPhotorealHuman.ts`: "Mouth closed, lips together and
 * relaxed … a broad smile is not"). Before that becomes a finding it has to be
 * asked of every ready frame the world holds, masters AND variants — an edited
 * frame is a photograph too, and "give her a smile" is an ask a user could
 * have made.
 *
 * Read-only, no transport calls.
 *   npx tsx scripts/teeth-world-scan-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";

const connection = await openDatabase();
const rows = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [result] = await connection.query<any[]>(sql, params);
  return result;
};

const MOUTH = "%smil%";
const words = ["%smil%", "%grin%", "%laugh%", "%teeth%", "%mouth%", "%tooth%"];

const [counts] = await rows(
  `SELECT
     (SELECT COUNT(*) FROM casting_candidates WHERE userId = 1 AND status = 'ready') AS masters,
     (SELECT COUNT(*) FROM casting_candidate_variants WHERE userId = 1 AND status = 'ready') AS variants`,
);
console.log(`world: ${counts.masters} ready masters · ${counts.variants} ready variants (user 1)`);

/* CONTROL, POSITIVE — the same LIKE machinery over a word this world certainly
   holds, so an empty result below is a reading rather than a broken query. */
const control = await rows(
  `SELECT COUNT(*) AS n FROM casting_candidate_variants
    WHERE userId = 1 AND (requestText LIKE ? OR instructions LIKE ?)`,
  ["%hair%", "%hair%"],
);
console.log(`CONTROL POSITIVE — variants mentioning "hair": ${control[0].n} (must be > 0)`);

let hits = 0;
for (const word of words) {
  const found = await rows(
    `SELECT id, publicId, candidateId, requestText, createdAt
       FROM casting_candidate_variants
      WHERE userId = 1 AND (requestText LIKE ? OR instructions LIKE ?)
      ORDER BY id ASC`,
    [word, word],
  );
  hits += found.length;
  console.log(`\n${word}: ${found.length}`);
  for (const row of found) {
    console.log(`  #${row.id} ${row.publicId.slice(0, 8)} cand ${row.candidateId} ${utc(row.createdAt)} — ${JSON.stringify(row.requestText)}`);
  }
}
void MOUTH;

console.log(`\nTOTAL variant rows mentioning a smile, teeth or a mouth: ${hits}`);
await connection.end();
process.exit(0);
