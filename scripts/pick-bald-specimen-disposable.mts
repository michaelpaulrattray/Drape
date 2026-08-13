/** Which dev face should the bald walk buy? A hairy one with a clean history. */
import "dotenv/config";
import { openDatabase } from "./lib/dbConnection.mts";

const connection = await openDatabase();
const [rows] = await connection.query<any[]>(
  `SELECT c.id, c.publicId,
          (SELECT COUNT(*) FROM casting_candidate_variants v WHERE v.candidateId = c.id) AS variants,
          (SELECT COUNT(*) FROM casting_reference_library l WHERE l.candidateId = c.id) AS libraryRows
     FROM casting_candidates c
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
    ORDER BY c.id`,
);
for (const row of rows) {
  console.log(`#${String(row.id).padStart(3)} ${row.publicId.slice(0, 8)}  variants ${String(row.variants).padStart(2)}  library ${row.libraryRows}`);
}
await connection.end();
process.exit(0);
