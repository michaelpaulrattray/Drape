/**
 * IS THERE A BESPECTACLED FACE ALREADY PAID FOR? — before rolling a new one.
 *
 * The walk's fifth step is "remove her glasses", so it needs a face wearing
 * them. Both rolls from the bespectacled brief are exhausted: `7c5db01d`'s last
 * untouched candidate is a SIGNED Cast, which the walk correctly refuses to
 * walk, and `455d096d` was called exhausted a shift ago.
 *
 * Rolling a fresh one costs about 200 credits. But the portrait prior draws
 * glasses onto plenty of faces nobody asked to bespectacle — that is a known
 * property of this generator, and `find-bare-faced.mts` exists because of the
 * same fact pointing the other way. So the cheap move first: look at the faces
 * already sitting in untouched rolls and ask the segmenter whether any of them
 * is wearing glasses.
 *
 * The reader is the production one (`falRegionReader`, a real segmentation
 * rather than a guess about a brief), and every hit is written out so a human
 * looks before a credit is spent.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/find-bespectacled-fresh-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";

const PUBLIC_BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";
const OUT = "output/bespectacled-hunt";
mkdirSync(OUT, { recursive: true });

const falKey = process.env.FAL_KEY;
if (!falKey) throw new Error("FAL_KEY required — glasses are found by segmentation, never by the brief");
const reader = createFalRegionReader({ apiKey: falKey });

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL — run under `railway run --service MySQL`");

const connection = await openDatabase(databaseUrl);
/* The walk's OWN definition of a walkable face, so a hit here cannot be one the
   walk then refuses: ready, unsigned, no variant rows, never position 0. */
const [rows] = await connection.query<any[]>(
  `SELECT c.publicId, c.position, c.imageKey, r.publicId AS roll, LEFT(r.briefText, 40) AS brief
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE r.userId = 1
      AND c.status = 'ready'
      AND c.signedCastId IS NULL
      AND c.position > 0
      AND c.imageKey IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM casting_candidate_variants v WHERE v.candidateId = c.id)
    ORDER BY r.createdAt DESC
    LIMIT 30`,
);
await connection.end();

console.log(`${rows.length} walkable faces to look at\n`);
const found: any[] = [];
const unread: { candidate: string; why: string }[] = [];
for (const row of rows) {
  const href = `${PUBLIC_BASE}/${row.imageKey}`;

  /*
    THE READING AND THE NON-READING ARE DIFFERENT ROWS, and this is the fix for
    the defect that made this script's last sweep meaningless (opus-052 §3).

    It used to fetch, check `response.ok`, and `.catch(() => null)` the reading
    — so an HTTP 200 carrying an HTML page produced a coverage of ZERO, and a
    coverage of zero prints as "not bespectacled". Thirty faces were reported
    bare on the strength of thirty error pages, and the report read clean.

    Now the bytes must be provably a picture (`fetchImageBytes`) and a failed
    reading is printed as NO-READ and counted nowhere. D-235's asymmetry, one
    surface over: an affirmative without a look is not a finding.
  */
  let image;
  try {
    image = await fetchImageBytes(href);
  } catch (error) {
    unread.push({ candidate: row.publicId, why: String((error as Error).message).slice(0, 120) });
    console.log(`  ${row.publicId.slice(0, 8)} NO-READ — ${String((error as Error).message).slice(0, 100)}`);
    continue;
  }

  /* `absentIsAnswer` matters: "no glasses on this face" is the answer for most
     of them, and an absence that throws would read as an outage. It is only
     safe now because the bytes above are proven to be a picture. */
  let region;
  try {
    region = await reader.region({ image: image.bytes, name: "glasses", absentIsAnswer: true });
  } catch (error) {
    unread.push({ candidate: row.publicId, why: `segmenter: ${String((error as Error).message).slice(0, 100)}` });
    console.log(`  ${row.publicId.slice(0, 8)} NO-READ — segmenter: ${String((error as Error).message).slice(0, 90)}`);
    continue;
  }

  const covered = region.data.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0)
    / (region.width * region.height);
  /* Frames are a small part of a portrait; a fraction of a percent is a real
     pair, and zero is zero. The number is printed so the threshold is visible
     rather than believed. */
  const wearing = covered > 0.001;
  console.log(`  ${row.publicId.slice(0, 8)} pos ${row.position} roll ${String(row.roll).slice(0, 8)} `
    + `glasses ${(covered * 100).toFixed(3)}%${wearing ? "  <-- BESPECTACLED" : ""}  "${row.brief}"`);
  if (wearing) {
    writeFileSync(`${OUT}/${row.publicId}.png`, image.bytes);
    found.push({ candidate: row.publicId, roll: row.roll, position: row.position, covered });
  }
}

writeFileSync(`${OUT}/found.json`, `${JSON.stringify({ found, unread }, null, 2)}\n`);
const looked = rows.length - unread.length;
console.log(`\n${found.length} bespectacled of ${looked} ACTUALLY READ (${unread.length} no-read) `
  + `— images in ${OUT}. LOOK AT THEM before walking one.`);
if (unread.length > 0) {
  console.log(`The ${unread.length} no-read faces are NOT evidence of anything. `
    + `"Zero bespectacled" is a claim about the ${looked} that were looked at.`);
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
