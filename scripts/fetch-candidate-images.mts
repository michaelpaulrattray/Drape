/**
 * PULL CANDIDATE IMAGES DOWN SO THEY CAN BE LOOKED AT — read-only.
 *
 * Reports are claims; artifacts are facts (working law 1). A row saying a brief
 * never mentioned eyewear is not evidence that the face it produced is
 * bare-faced — the prior draws glasses onto plenty of faces nobody asked to
 * bespectacle. So the pictures come down and get looked at.
 *
 * Run under the APP service rather than MySQL: it needs `R2_PUBLIC_URL` as
 * production has it, because served URLs are persisted against that base and a
 * dev bucket answers 403 to a production key.
 *
 *   railway.cmd run npx tsx scripts/fetch-candidate-images.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import mysql from "mysql2/promise";

const url = process.env.MYSQL_PUBLIC_URL ?? process.env.DATABASE_URL;
const publicBase = process.env.R2_PUBLIC_URL;
if (!url) throw new Error("no database URL — run under `railway run`");
if (!publicBase) throw new Error("no R2_PUBLIC_URL — run under `railway run` for the app service");

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}
/** Named candidates, when the probe already knows which faces it wants. */
const WANTED = arg("candidates").split(",").map((id) => id.trim()).filter(Boolean);
const OUT = arg("out", "output/masked/bare-faced");
mkdirSync(OUT, { recursive: true });

const connection = await mysql.createConnection(url);
const [rows] = WANTED.length > 0
  ? await connection.query<any[]>(
    `SELECT c.publicId AS candidate, c.position, c.imageKey, r.publicId AS roll, r.briefText
       FROM casting_candidates c
       JOIN casting_rolls r ON r.id = c.rollId
      WHERE c.publicId IN (${WANTED.map(() => "?").join(",")})`,
    WANTED,
  )
  : await connection.query<any[]>(
  `SELECT c.publicId AS candidate, c.position, c.imageKey, r.publicId AS roll, r.briefText
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
    LIMIT 16`,
);
await connection.end();

const manifest: any[] = [];
for (const [index, row] of rows.entries()) {
  const href = `${publicBase.replace(/\/$/, "")}/${row.imageKey}`;
  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error(`${response.status}`);
    const name = WANTED.length > 0 ? `${row.candidate}.png` : `cand-${String(index).padStart(2, "0")}.png`;
    writeFileSync(`${OUT}/${name}`, Buffer.from(await response.arrayBuffer()));
    manifest.push({ file: name, candidate: row.candidate, position: row.position, roll: row.roll, brief: row.briefText });
    console.log(`${name}  ${row.candidate}  pos ${row.position}  "${String(row.briefText).slice(0, 50)}"`);
  } catch (error) {
    console.log(`SKIP ${row.candidate}: ${String(error).slice(0, 60)}`);
  }
}
writeFileSync(`${OUT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${manifest.length} images in ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
