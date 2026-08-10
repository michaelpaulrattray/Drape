/**
 * WHY DOES THE CANTHAL TILT NOT READ ON THE NEW SHEET?
 *
 * Run-15's dry run says "her tilt did not read" on TWO different faces from
 * roll `641c71d0`. A no-read is honest — the gate never fires on one, so step 2
 * spends and declares its expectation unproven — but it costs 25 credits and it
 * arrived immediately after I changed the reader's front door. The recent
 * change is the first suspect, not the last.
 *
 * Three specimens, one instrument, so the answer cannot be a story:
 *
 *   a bespectacled face from the new sheet   the case under investigation
 *   a second one from the same sheet         is it the sheet or that face
 *   an older candidate the walk has read     the NEGATIVE CONTROL — if the
 *                                            tilt reads here, the path works
 *                                            and the glasses are the cause
 *
 *   FAL_KEY=… railway.cmd run --service MySQL -- npx tsx scripts/probe-tilt-noread-disposable.mts
 */
import "dotenv/config";

import { readCanthalTilt } from "../server/castingV2/eyeShapeRouting";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { openDatabase } from "./lib/dbConnection.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const falKey = process.env.FAL_KEY;
if (!falKey) throw new Error("FAL_KEY required");
const reader = createFalRegionReader({ apiKey: falKey });

assertOneWorld(["MYSQL_PUBLIC_URL"]);
const databaseUrl = process.env.MYSQL_PUBLIC_URL;
if (!databaseUrl) throw new Error("run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT c.publicId, c.imageKey, c.position, r.publicId AS roll,
          (r.publicId = '641c71d0-df30-4db3-ad65-1a94936a983c') AS newSheet
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
      AND (r.publicId = '641c71d0-df30-4db3-ad65-1a94936a983c' OR c.publicId = ?)
    ORDER BY newSheet DESC, c.position
    LIMIT 3`,
  ["129898c2-0000-0000-0000-000000000000"],
);
/* The control is picked by recency rather than by a guessed id, so this cannot
   silently probe two faces and call it three. */
const [control] = await connection.query<any[]>(
  `SELECT c.publicId, c.imageKey, c.position, r.publicId AS roll, 0 AS newSheet
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE c.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
      AND r.publicId <> '641c71d0-df30-4db3-ad65-1a94936a983c'
    ORDER BY c.createdAt DESC
    LIMIT 1`,
);
await connection.end();

const specimens = [...rows.slice(0, 2), ...control];

for (const row of specimens) {
  const label = row.newSheet ? "NEW SHEET (bespectacled)" : "OLDER CANDIDATE (control)";
  const { bytes } = await fetchImageBytes(`${BASE}/${row.imageKey}`);
  const glasses = await reader
    .region({ image: bytes, name: "glasses", absentIsAnswer: true })
    .then((mask) => mask.data.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0) / (mask.width * mask.height))
    .catch(() => null);
  const tilt = await readCanthalTilt({ image: bytes, reader });
  console.log(`${label}  ${row.publicId.slice(0, 8)} pos ${row.position} roll ${String(row.roll).slice(0, 8)}`);
  console.log(`    glasses ${glasses === null ? "NO-READ" : `${(glasses * 100).toFixed(3)}%`}`);
  console.log(`    tilt    ${tilt ? `${tilt.meanDeg.toFixed(1)}° (asymmetry ${tilt.asymmetryDeg.toFixed(1)}°)` : "NO-READ"}`);
}

console.log("\nIf the control reads and the sheet does not, the path works and the frames are the cause.");
console.log("If nothing reads, the path is the suspect and the sheet is innocent.");

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
