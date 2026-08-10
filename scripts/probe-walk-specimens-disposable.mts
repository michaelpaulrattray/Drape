/**
 * READ-ONLY: are the walk's control specimens still in the database?
 *
 * The controls came back "no frame — wrong world, or the row is gone", and those
 * are two very different sentences. This asks the database directly.
 */
import "dotenv/config";
import { openDatabase, utc } from "./lib/dbConnection.mjs";

const SPECIMENS = [
  ["v#156 — one hoop (A positive)", "ffe31dae-afac-4fd7-af15-46fb65ee273a"],
  ["v#147 — two hoops (A negative)", "8ac53e6e-ac36-4a83-83be-a17e04593450"],
  ["v#155 — wears nothing (B before)", "d1f9d64c-cb0b-4f30-9cfd-6ad3a4a9ef9a"],
] as const;

const connection = await openDatabase();
try {
  for (const [label, publicId] of SPECIMENS) {
    const [rows] = await connection.query<any[]>(
      "SELECT id, status, imageKey, createdAt, candidateId FROM casting_candidate_variants WHERE publicId = ?",
      [publicId],
    );
    console.log(`${label}: ${rows.length === 0 ? "GONE" : `id ${rows[0].id} ${rows[0].status} ${utc(rows[0].createdAt)}`}`);
  }

  const [span] = await connection.query<any[]>(
    "SELECT COUNT(*) AS n, MIN(id) AS lo, MAX(id) AS hi, MIN(createdAt) AS oldest, MAX(createdAt) AS newest"
    + " FROM casting_candidate_variants",
  );
  console.log(
    `\nvariants alive: ${span[0].n}, ids ${span[0].lo}–${span[0].hi}, `
    + `${utc(span[0].oldest)} → ${utc(span[0].newest)}`,
  );

  const [pinned] = await connection.query<any[]>(
    "SELECT COUNT(*) AS n FROM casting_candidate_variants v"
    + " JOIN casting_candidates c ON c.id = v.candidateId"
    + " WHERE JSON_EXTRACT(v.internalPrompt, '$.verification') IS NOT NULL",
  );
  console.log(`variants carrying a verification block: ${pinned[0].n}`);

  /* Where the walk's four findings would have to be re-anchored: any surviving
     variant whose stored verdict mentions hair worn or an accessory. */
  const [candidatesForD] = await connection.query<any[]>(`
    SELECT v.id, v.publicId, v.candidateId, v.status, v.createdAt,
           JSON_UNQUOTE(JSON_EXTRACT(v.instructions, '$[0]')) AS ask
      FROM casting_candidate_variants v
     WHERE JSON_SEARCH(v.internalPrompt, 'one', 'hairWorn') IS NOT NULL
     ORDER BY v.id DESC LIMIT 8
  `);
  console.log("\nmost recent variants whose stored prompt mentions hairWorn:");
  for (const row of candidatesForD) {
    console.log(`  v#${row.id} cand ${row.candidateId} ${row.status} ${utc(row.createdAt)} — ${String(row.ask ?? "").slice(0, 60)}`);
  }
} finally {
  await connection.end();
}
