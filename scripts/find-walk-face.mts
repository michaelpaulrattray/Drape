/**
 * WHICH FACE THE WALK SPENDS ON — read-only, and it names her in the record.
 *
 * The self-drive walk refuses to guess which candidate to spend on, and that is
 * correct: a driver that picks its own target picks a different one each run and
 * the delivery-rate number stops being about anything. The founder named her —
 * the miu-miu-glasses woman from their own July/August walks — because she is
 * bespectacled (fox eyes behind frames and a glasses removal both live on her
 * face), already carries the walk's history, and is throwaway-tolerant.
 *
 * This finds her so the report can say which face the number was earned on. It
 * looks two ways, because the founder's description is a memory of a sentence
 * rather than a key: by the brief's own words, and by which candidates actually
 * carry refinement history (the walk's own footprints).
 *
 *   railway.cmd run --service MySQL npx tsx scripts/find-walk-face.mts
 */
import mysql from "mysql2/promise";

const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL — run under `railway run --service MySQL` for production.");
  process.exit(1);
}

const connection = await mysql.createConnection(url);

/* ---- 1. Where has anyone actually REFINED? Those are the walk's footprints. */
console.log("=== candidates carrying refinement history (most recent variant first) ===\n");
const [refined] = await connection.query<any[]>(
  `SELECT c.publicId AS candidate, c.status, c.position,
          r.publicId AS roll, r.briefText, s.userId,
          COUNT(v.id) AS variants, MAX(v.createdAt) AS lastVariant
     FROM casting_candidate_variants v
     JOIN casting_candidates c ON c.id = v.candidateId
     JOIN casting_rolls r ON r.id = c.rollId
     JOIN casting_sessions s ON s.id = r.sessionId
    GROUP BY c.publicId, c.status, c.position, r.publicId, r.briefText, s.userId
    ORDER BY MAX(v.createdAt) DESC
    LIMIT 12`,
);
for (const row of refined) {
  console.log(`${row.lastVariant}  user ${row.userId}  ${row.status}`);
  console.log(`  candidate ${row.candidate}  (pos ${row.position}, ${row.variants} variants)`);
  console.log(`  brief: "${row.briefText}"\n`);
}

/* ---- 2. Bespectacled briefs, by the words the founder remembers. */
console.log("\n=== rolls whose brief mentions eyewear ===\n");
const [glasses] = await connection.query<any[]>(
  `SELECT r.id, r.publicId, r.briefText, r.createdAt, s.userId
     FROM casting_rolls r JOIN casting_sessions s ON s.id = r.sessionId
    WHERE r.briefText LIKE '%glass%' OR r.briefText LIKE '%spectacl%' OR r.briefText LIKE '%eyewear%'
    ORDER BY r.createdAt DESC LIMIT 8`,
);
for (const roll of glasses) {
  console.log(`roll ${roll.publicId}  user ${roll.userId}  ${roll.createdAt}`);
  console.log(`  "${roll.briefText}"`);
  const [candidates] = await connection.query<any[]>(
    `SELECT c.publicId, c.position, c.status, c.imageKey IS NOT NULL AS hasImage,
            (SELECT COUNT(*) FROM casting_candidate_variants v WHERE v.candidateId = c.id) AS variants
       FROM casting_candidates c WHERE c.rollId = ? ORDER BY c.position`,
    [roll.id],
  );
  for (const candidate of candidates) {
    console.log(
      `    pos ${candidate.position}  ${candidate.publicId}  ${String(candidate.status).padEnd(9)}`
      + `  image ${candidate.hasImage ? "yes" : "NO "}  variants ${candidate.variants}`,
    );
  }
  console.log();
}

await connection.end();
