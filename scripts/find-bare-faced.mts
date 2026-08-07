/**
 * A BARE-FACED SPECIMEN, WITHOUT CASTING ONE — read-only.
 *
 * D-237 left one hypothesis explicitly untested: every specimen in
 * `output/masked/specimens/` is bespectacled, and a frame's upper rim crosses
 * exactly where a canthal tilt reads. Isolating occlusion from capability needs
 * a face with nothing over its outer corners.
 *
 * Casting a fresh roll would spend eight slices to get one. Production already
 * holds rolls whose briefs never mention eyewear, so this lists their candidates
 * with resolvable image URLs and the probe picks from them by eye. Free, and it
 * reuses faces the founder has already paid for.
 *
 *   railway.cmd run --service MySQL npx tsx scripts/find-bare-faced.mts
 */
import mysql from "mysql2/promise";

const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL — run under `railway run --service MySQL` for production.");
  process.exit(1);
}

/* The bucket's public base. Read from the environment rather than hardcoded:
   served URLs are persisted in rows and this must agree with them. */
const publicBase = process.env.R2_PUBLIC_URL ?? "";

const connection = await mysql.createConnection(url);

const [rows] = await connection.query<any[]>(
  `SELECT c.publicId AS candidate, c.position, c.status, c.imageKey,
          r.publicId AS roll, r.briefText, r.createdAt
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
     JOIN casting_sessions s ON s.id = r.sessionId
    WHERE s.userId = 1
      AND c.status = 'ready'
      AND c.imageKey IS NOT NULL
      AND r.briefText NOT LIKE '%glass%'
      AND r.briefText NOT LIKE '%spectacl%'
      AND r.briefText NOT LIKE '%eyewear%'
    ORDER BY r.createdAt DESC
    LIMIT 24`,
);

let currentRoll = "";
for (const row of rows) {
  if (row.roll !== currentRoll) {
    currentRoll = row.roll;
    console.log(`\n=== roll ${row.roll}  ${row.createdAt}`);
    console.log(`    "${row.briefText}"`);
  }
  console.log(`  pos ${row.position}  ${row.candidate}`);
  console.log(`     ${publicBase ? `${publicBase}/${row.imageKey}` : row.imageKey}`);
}

await connection.end();
