/**
 * HOW OFTEN DOES THE TILT ACTUALLY FAIL, AND ON WHAT?
 *
 * I reported (opus-055) that chunky frames make the canthal tilt unreadable "by
 * construction" on a bespectacled face, from two no-reads and one bare-faced
 * control. Run-15's own dry run then read **2.0°** off a third bespectacled
 * face from the same sheet. Two specimens and a generalisation is an anecdote
 * with an opinion; this replaces it with a rate.
 *
 * All eight of the sheet — same brief, same session, same frames, so glasses
 * are held constant and whatever differs is the actual cause — plus bare-faced
 * controls from older rolls, so "reads" is shown to be the normal case rather
 * than assumed to be.
 *
 * Read-only: R2 objects and fal calls. No credits, no rows.
 *
 *   FAL_KEY=… railway.cmd run --service MySQL -- npx tsx scripts/probe-tilt-rate-disposable.mts
 */
import "dotenv/config";

import { readCanthalTilt } from "../server/castingV2/eyeShapeRouting";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { openDatabase } from "./lib/dbConnection.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const SHEET = "641c71d0-df30-4db3-ad65-1a94936a983c";

const falKey = process.env.FAL_KEY;
if (!falKey) throw new Error("FAL_KEY required");
const reader = createFalRegionReader({ apiKey: falKey });

assertOneWorld(["MYSQL_PUBLIC_URL"]);
const databaseUrl = process.env.MYSQL_PUBLIC_URL;
if (!databaseUrl) throw new Error("run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [sheet] = await connection.query<any[]>(
  `SELECT c.publicId, c.position, c.imageKey, 1 AS bespectacled
     FROM casting_candidates c JOIN casting_rolls r ON r.id = c.rollId
    WHERE r.publicId = ? AND c.imageKey IS NOT NULL ORDER BY c.position`,
  [SHEET],
);
const [controls] = await connection.query<any[]>(
  `SELECT c.publicId, c.position, c.imageKey, 0 AS bespectacled
     FROM casting_candidates c JOIN casting_rolls r ON r.id = c.rollId
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
      AND r.publicId <> ?
    ORDER BY c.createdAt DESC LIMIT 6`,
  [SHEET],
);
await connection.end();

const rows: { label: string; reads: number; total: number } = { label: "", reads: 0, total: 0 };
const tally = { bespectacled: { reads: 0, total: 0 }, bare: { reads: 0, total: 0 } };

for (const row of [...sheet, ...controls]) {
  const group = row.bespectacled ? "bespectacled" : "bare";
  let bytes: Buffer;
  try {
    ({ bytes } = await fetchImageBytes(`${BASE}/${row.imageKey}`));
  } catch (error) {
    console.log(`  ${group.padEnd(13)} ${row.publicId.slice(0, 8)}  NO-READ (picture): ${String((error as Error).message).slice(0, 60)}`);
    continue;
  }
  const glasses = await reader
    .region({ image: bytes, name: "glasses", absentIsAnswer: true })
    .then((m) => m.data.reduce((s, v) => s + (v > 0 ? 1 : 0), 0) / (m.width * m.height))
    .catch(() => null);
  const tilt = await readCanthalTilt({ image: bytes, reader });
  tally[group].total += 1;
  if (tilt) tally[group].reads += 1;
  console.log(`  ${group.padEnd(13)} ${row.publicId.slice(0, 8)} pos ${row.position}`
    + `  glasses ${glasses === null ? "  ?   " : `${(glasses * 100).toFixed(3)}%`}`
    + `  tilt ${tilt ? `${tilt.meanDeg.toFixed(1)}°` : "NO-READ"}`);
}

void rows;
console.log(`\nbespectacled: ${tally.bespectacled.reads}/${tally.bespectacled.total} read`);
console.log(`bare:         ${tally.bare.reads}/${tally.bare.total} read`);
console.log(
  tally.bespectacled.reads === 0
    ? "\nFrames block the reading outright — the opus-055 claim stands."
    : tally.bespectacled.reads === tally.bespectacled.total
      ? "\nFrames do NOT block it. The two no-reads were about those faces, not about glasses — withdraw the claim."
      : "\nFrames make it UNRELIABLE rather than impossible: it sometimes reads and sometimes does not, "
        + "on the same brief and the same frames. The gate's problem is the no-read branch, whatever causes it.",
);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
