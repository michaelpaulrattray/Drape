/**
 * READ-ONLY: what does "v#163" name, and where did the walk's specimens go?
 *
 * The controls could not find them, and "the row is gone" and "the row was never
 * in this database" are different sentences with very different consequences.
 */
import "dotenv/config";
import { openDatabase, utc } from "./lib/dbConnection.mjs";

const connection = await openDatabase();
try {
  const [auto] = await connection.query<any[]>(
    "SELECT AUTO_INCREMENT AS next FROM information_schema.TABLES"
    + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'casting_candidate_variants'",
  );
  console.log(`casting_candidate_variants AUTO_INCREMENT = ${auto[0]?.next}`);

  const [rows] = await connection.query<any[]>(
    "SELECT id, publicId, candidateId, userId, status, createdAt,"
    + " JSON_UNQUOTE(JSON_EXTRACT(instructions, '$[0]')) AS ask"
    + " FROM casting_candidate_variants ORDER BY id",
  );
  for (const row of rows) {
    console.log(
      `v#${String(row.id).padStart(3)} cand ${row.candidateId} user ${row.userId} `
      + `${String(row.status).padEnd(8)} ${utc(row.createdAt)} — ${String(row.ask ?? "").slice(0, 48)}`,
    );
  }

  const [gaps] = await connection.query<any[]>(
    "SELECT COUNT(*) AS n FROM casting_candidate_variants WHERE id BETWEEN 142 AND 200",
  );
  console.log(`\nvariants with id 142–200 alive: ${gaps[0].n}`);
} finally {
  await connection.end();
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
