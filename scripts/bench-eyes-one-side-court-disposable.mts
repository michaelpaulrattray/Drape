/**
 * THE EYES-ONE-SIDE COURT (fable-374's build input, opus-293 §4).
 *
 * On the founder's own master the `eyes` bilateral read came back with ONE side
 * while `eyebrows` and `ear` both came back with two — reproducibly, across two
 * runs. Under per-instance boxes that fills one eye and leaves the other empty,
 * and a pair row then shows a shape covering one eye while claiming to be about
 * both. It was flagged as needing a look across SEVERAL faces rather than a
 * conclusion from one, which is what this is.
 *
 *   npx tsx scripts/bench-eyes-one-side-court-disposable.mts [--faces 6]
 *
 * # WHAT MAKES IT A COURT RATHER THAN A COUNT
 *
 * `eyebrows` and `ear` are read on the SAME frames in the same run. They are the
 * controls: a face where all three come back one-sided is a face problem (a
 * profile, an occlusion, a bad frame), and only a face where the eyes are alone
 * in failing is evidence about the eyes. Without them a run of hard frames would
 * read as a verdict about eyes.
 *
 * House money, off-ledger, no user credits: ~3 calls per feature per face.
 * Read-only — it writes no row and no object.
 */
import "dotenv/config";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { boundsOf } from "../server/castingV2/segmentCuts";
import { storagePublicUrl, storageReadBytes } from "../server/storage";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const FACES = Number(arg("faces", "6"));
/*
  `--features earring` is the POSITIVE CONTROL arm, and it is why the verdict
  below is worth anything.

  "Both sides, six out of six" is a null result, and a null result from an
  instrument that has never returned anything else is not evidence — the
  one-sided branch would report zero whether it worked or not. A face wearing
  one earring, or with one ear behind her hair, is a case where the honest
  answer IS one side, so running the same reader on `earring` proves the branch
  can fire before the eyes verdict is believed.
*/
const FEATURES = arg("features", "eyes,eyebrows,ear").split(",") as readonly string[];

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
const where = new URL(databaseUrl.replace(/^mysql:/, "http:"));
console.log(`WORLD: ${databaseKey} → ${where.hostname}:${where.port}`);

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is required — this bench reads real faces");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT id, publicId, imageKey FROM casting_candidates
    WHERE userId = 1 AND status = 'ready' AND imageKey IS NOT NULL
    ORDER BY id DESC LIMIT ?`,
  [FACES],
);
await connection.end();
console.log(`${rows.length} faces\n`);

type Reading = { left: number | null; right: number | null; refused: string | null };
const table: { face: number; readings: Record<string, Reading> }[] = [];

for (const face of rows) {
  const frame = await storageReadBytes(face.imageKey);
  const url = storagePublicUrl(face.imageKey);
  /* One reader per frame, so the URL is proved against these bytes once and the
     proof never travels to another picture. */
  const reader = createFalRegionReader({ apiKey });
  const readings: Record<string, Reading> = {};

  for (const feature of FEATURES) {
    try {
      const sides = await reader.regionSides!({
        image: frame.bytes,
        name: feature,
        absentIsAnswer: true,
        imageUrl: url,
      });
      if (sides === null) {
        readings[feature] = { left: null, right: null, refused: "the reader has no sides for this name" };
        continue;
      }
      const share = (mask: { data: Buffer; width: number; height: number }) => {
        const box = boundsOf(mask);
        if (box === null) return null;
        let on = 0;
        for (let at = 0; at < mask.data.length; at += 1) if (mask.data[at] > 0) on += 1;
        return Number(((on / (mask.width * mask.height)) * 100).toFixed(3));
      };
      readings[feature] = { left: share(sides.left), right: share(sides.right), refused: null };
    } catch (error) {
      readings[feature] = { left: null, right: null, refused: error instanceof Error ? error.message : String(error) };
    }
  }

  table.push({ face: face.id, readings });
  const line = FEATURES.map((feature) => {
    const reading = readings[feature];
    if (reading.refused) return `${feature}: REFUSED (${reading.refused.slice(0, 40)})`;
    const found = [reading.left === null ? null : "L", reading.right === null ? null : "R"].filter(Boolean);
    return `${feature}: ${found.length}/2 [${found.join("")}] L=${reading.left ?? "—"}% R=${reading.right ?? "—"}%`;
  }).join("  |  ");
  console.log(`cand ${face.id}  ${line}`);
}

/* ---------------------------------------------------------------- verdict */

console.log("\n--- how often each feature came back with both sides ---");
for (const feature of FEATURES) {
  const readings = table.map((entry) => entry.readings[feature]);
  const both = readings.filter((reading) => reading.left !== null && reading.right !== null).length;
  const one = readings.filter((reading) => (reading.left === null) !== (reading.right === null)).length;
  const none = readings.filter((reading) => reading.left === null && reading.right === null && !reading.refused).length;
  const refused = readings.filter((reading) => reading.refused).length;
  console.log(`${feature.padEnd(9)} both ${both}/${readings.length}   one side ${one}   neither ${none}   refused ${refused}`);
}

/*
  THE DISCRIMINATOR: a face where the eyes came back one-sided AND both controls
  came back whole. That is the only shape that says anything about eyes rather
  than about the frame.
*/
if (!FEATURES.includes("eyes")) {
  console.log("\n(no eyes arm in this run — this is the control)");
  process.exit(0);
}
const alone = table.filter((entry) => {
  const eyes = entry.readings.eyes;
  const eyesOneSided = (eyes.left === null) !== (eyes.right === null);
  const controlsWhole = FEATURES.filter((feature) => feature !== "eyes").every((feature) => {
    const reading = entry.readings[feature];
    return reading.left !== null && reading.right !== null;
  });
  return eyesOneSided && controlsWhole;
});
console.log(`\nfaces where the EYES alone came back one-sided: ${alone.length}/${table.length}`
  + (alone.length ? ` — ${alone.map((entry) => entry.face).join(", ")}` : ""));
console.log(JSON.stringify(table, null, 2));
process.exit(0);
