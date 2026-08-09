/**
 * WHICH FACES ARE STILL UNTOUCHED — and which of those wear glasses.
 *
 * The walk needs a candidate with NO prior variants (a face with a history is
 * not a fresh walk) that is visibly bespectacled (the removal step is one of the
 * five). Run-13 found one by asking the segmenter; this asks the cheaper
 * question first — which candidates are untouched at all — so the segmenter is
 * only run on the short list.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/pick-walk-face-disposable.mts
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT c.id, c.publicId, c.rollId, r.publicId AS rollPublicId, c.createdAt,
          (SELECT COUNT(*) FROM casting_candidate_variants v WHERE v.candidateId = c.id) AS variants
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
    ORDER BY c.id DESC LIMIT 80`,
);
/* kept open: the glasses sweep below re-queries. */

const untouched = rows.filter((row) => Number(row.variants) === 0);
console.log(`${untouched.length} untouched of ${rows.length} recent ready candidates\n`);
for (const row of untouched) {
  console.log(`  cand-${String(row.id).padEnd(5)} ${row.publicId}  roll ${row.rollPublicId}  ${utc(row.createdAt)}`);
}

const byRoll = new Map<string, number>();
for (const row of untouched) byRoll.set(row.rollPublicId, (byRoll.get(row.rollPublicId) ?? 0) + 1);
console.log(`\nuntouched per roll:`);
for (const [roll, count] of byRoll) console.log(`  ${roll}  ${count}`);

/*
  AND WHICH OF THEM WEAR GLASSES — asked of the PIXELS.

  Two of the walk's five steps are about her glasses, so an untouched face is
  not automatically a walkable one. Run-15's draw was cand-1546, who wears none,
  and the harness would have spent 75 credits before finding out. The walk now
  refuses such a face; this finds the ones it will accept, so the refusal is a
  redirection rather than a dead end.

  `--glasses` because it is a segmenter call per candidate and the plain listing
  is often all that is wanted.
*/
if (process.argv.includes("--glasses")) {
  const apiKey = process.env.FAL_KEY;
  const publicBase = process.argv.includes("--public-base")
    ? process.argv[process.argv.indexOf("--public-base") + 1]
    : undefined;
  if (!apiKey) throw new Error("FAL_KEY is required to ask the pixels");
  if (!publicBase) throw new Error("--public-base is required: this reads production BYTES as well as rows");
  const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
  const reader = createFalRegionReader({ apiKey });
  const [keys] = await connection.query<any[]>(
    `SELECT id, imageKey FROM casting_candidates WHERE id IN (?)`,
    [untouched.map((row) => row.id)],
  );
  const keyOf = new Map(keys.map((row: any) => [row.id, row.imageKey]));
  console.log(`\nasking the segmenter which untouched faces wear glasses:`);
  for (const row of untouched) {
    const url = `${publicBase.replace(/\/$/, "")}/${keyOf.get(row.id)}`;
    try {
      /* Proven to be a picture before `absentIsAnswer` is granted: a 200
         carrying an HTML page once answered "no glasses" for a whole sweep. */
      const { bytes } = await fetchImageBytes(url);
      const mask = await reader.region({ image: bytes, name: "eyeglasses", absentIsAnswer: true });
      const worn = mask.data.some((value) => value > 0);
      if (worn) console.log(`  cand-${row.id}  GLASSES  ${row.publicId}  roll ${row.rollPublicId}`);
    } catch (error) {
      console.log(`  cand-${row.id}  unreadable (${String(error).slice(0, 60)})`);
    }
  }
}
await connection.end();
