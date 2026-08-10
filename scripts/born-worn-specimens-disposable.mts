/**
 * THE COURT'S SPECIMEN SET, drawn from faces the founder already paid for.
 *
 * Read-only against production. Writes `output/born-worn/specimens.json`, which
 * the court then reads — so the court itself is a pure measurement over a named
 * set rather than a script that also decides what to measure.
 *
 * Two arms, and the arms are chosen by the BRIEF rather than by anybody's eye:
 * a roll whose brief asked for glasses is the positive population, and rolls
 * whose briefs never mention eyewear are the negative one. That keeps specimen
 * selection independent of the instrument on trial — picking bare faces by
 * looking at them through the same segmenter would be the instrument grading
 * its own homework.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/born-worn-specimens-disposable.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import mysql from "mysql2/promise";

const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL — run under `railway.cmd run --service MySQL`.");
  process.exit(1);
}
/*
  PRODUCTION'S bucket, because these are production rows.

  `railway run --service MySQL` injects the DATABASE service's variables, not
  the app's, so `R2_PUBLIC_URL` here would fall through to whatever `.env` holds
  — the DEV bucket, in which every one of these keys 404s. The first run of this
  court read 24 specimens as NO-READ for exactly that reason. Passed in
  explicitly, and refused rather than guessed.
*/
const publicBase = process.env.BORN_WORN_PUBLIC_BASE ?? process.env.R2_PUBLIC_URL;
if (!publicBase) {
  console.error(
    "BORN_WORN_PUBLIC_BASE is required — the production bucket's public URL "
    + "(`railway.cmd variables --service Drape`). A key from the production database "
    + "resolved against the dev bucket is a 404 dressed up as a bare face.",
  );
  process.exit(1);
}

const connection = await mysql.createConnection(url);

async function arm(where: string, limit: number) {
  const [rows] = await connection.query<any[]>(
    `SELECT c.publicId AS candidate, c.imageKey, r.publicId AS roll, r.briefText, r.createdAt
       FROM casting_candidates c
       JOIN casting_rolls r ON r.id = c.rollId
       JOIN casting_sessions s ON s.id = r.sessionId
      WHERE s.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
        AND ${where}
      ORDER BY r.createdAt DESC
      LIMIT ${limit}`,
  );
  return rows.map((row) => ({
    candidate: row.candidate as string,
    url: `${publicBase}/${row.imageKey}`,
    roll: row.roll as string,
    brief: String(row.briefText ?? "").slice(0, 120),
    createdAt: String(row.createdAt),
  }));
}

const bespectacled = await arm(
  "(r.briefText LIKE '%glass%' OR r.briefText LIKE '%spectacl%' OR r.briefText LIKE '%eyewear%')",
  12,
);
const bare = await arm(
  "r.briefText NOT LIKE '%glass%' AND r.briefText NOT LIKE '%spectacl%' AND r.briefText NOT LIKE '%eyewear%'",
  12,
);

mkdirSync("output/born-worn", { recursive: true });
const manifest = {
  drawnAt: new Date().toISOString(),
  source: "production casting_candidates, user 1, status=ready",
  selectedBy: "the roll's own brief text — never by looking at the face through the instrument on trial",
  arms: { bespectacled, bare },
};
writeFileSync("output/born-worn/specimens.json", JSON.stringify(manifest, null, 2));

console.log(`bespectacled: ${bespectacled.length}`);
for (const row of bespectacled) console.log(`  ${row.candidate}  "${row.brief}"`);
console.log(`bare: ${bare.length}`);
for (const row of bare) console.log(`  ${row.candidate}  "${row.brief}"`);

await connection.end();

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
