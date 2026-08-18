/**
 * THE OPEN LANE'S SPECIMEN COURT — can the reader DECLINE for a kind nobody
 * catalogued? (OPEN_LANE_DESIGN_NOTE §4/§9.6 q3, ordered fable-866 §3c.)
 *
 * # The question, and why the answer is not already known
 *
 * Step 3 shipped the absence control: an open kind's crop mints only where the
 * same reader, asked the same question of the frame the render was painted
 * FROM, declined. That makes every render SAFE whatever the answer here is — a
 * reader that cannot decline simply costs its kind the crop.
 *
 * What it does not tell us is whether the lane DELIVERS. If the segmenter
 * answers a confident patch of forehead for every unarmed noun, every open ask
 * falls to words, the kind re-rolls on every later render, and V5 ships a
 * feature that quietly never carries. That is a measurement, and it needs kinds
 * the catalogue still does not own.
 *
 * # What is measured
 *
 * The product's OWN reader (`createFalRegionReader(...).region`, called exactly
 * as `refineService` calls it for the mint, `absentIsAnswer: true` included) is
 * asked five out-of-vocabulary nouns of real master frames that plainly do not
 * hold them. A kind that reads ZERO on every frame is a kind the absence
 * control will let through. A kind that answers is a kind the lane will only
 * ever sell as words — which is a promotion signal rather than a defect.
 *
 * # THE TWO CONTROLS, AND WHY NEITHER IS OPTIONAL
 *
 *   ALIVE         `hair` must ANSWER on every frame. Without it, a reader that
 *                 has silently stopped answering anything at all produces a
 *                 perfect score on this court — five clean declines and a
 *                 verdict made of nothing. This is the null-needs-a-fixture law
 *                 pointed at its own instrument.
 *   CAN-DECLINE   `horns` must read ZERO on every frame. It is catalogued,
 *                 courted, and its detection court is the source of the
 *                 0.0000%-on-bare-frames figure the absence control's floor
 *                 rests on — so it is the one kind where the expected answer is
 *                 already on the record. If it answers here, the finding is
 *                 about the READER's condition today and this court's verdicts
 *                 are void, not merely disappointing.
 *
 * Both run FIRST and a failure refuses the verdict rather than annotating it.
 *
 * # WHAT THIS COURT DOES NOT PROVE — its own road, asserted in advance
 * (fable-871 §4, court-must-assert-its-road).
 *
 * It reads the mint door's instrument on delivered-shaped frames. It does NOT
 * prove the product path end to end, and it cannot: no ask path into the open
 * lane exists until step 5, so nothing here travels through the interpreter,
 * the recipe, a paid render or a library write. Any positive specimen it uses
 * is made through the image transport directly — **a declared substitution**,
 * not a render this product could sell today. The end-to-end proof is step 5's
 * own, and a sentence from this court may not stand in for it.
 *
 * # Bounds
 *
 *   DEV world only, and it refuses to run anywhere else. It reads masters and
 *   asks a segmenter; it writes no row, buys no render and charges no credit.
 *   House money: every read is priced and the total is printed to the cent
 *   against the ceiling fable-866 §3c set.
 *
 *   Every mask is written out beside its frame, because a coverage number is
 *   not a picture and this court's whole subject is whether a reader is
 *   answering about nothing (law 9).
 *
 *   npx tsx scripts/court-open-absence-disposable.mts [--faces 4]
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { fetchImageBytes } from "./lib/imageBytes.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { readFalBalance, falLine } from "./lib/falSpend.mts";

const OUT = path.resolve("output/open-absence-court");

/** The kinds §9.6 confirmed open, and the one customer behind one of them. */
const OPEN_KINDS = ["fangs", "wings", "tail", "scales", "gills"] as const;

/** ALIVE and CAN-DECLINE — see the header. Order matters: both before anything. */
const CONTROLS = [
  { name: "hair", expect: "answers" as const },
  { name: "horns", expect: "declines" as const },
];

/** fal's own measured price for one segmenter call — the face scan's reading
 *  ($0.100 for 20 calls), quoted rather than guessed. */
const USD_PER_READ = 0.005;
/** The product's own measured price for one GPT Image 2 frame, taken from the
 *  account balance rather than a rate card (`falImages.ts`). */
const USD_PER_PAINT = 0.099;
const CEILING_USD = 3;

const faces = Number(process.env.FACES ?? process.argv[process.argv.indexOf("--faces") + 1] ?? 4);

assertOneWorld();
const uri = process.env.DATABASE_URL;
if (!uri) throw new Error("DATABASE_URL is not set");
if (new URL(uri).port !== "52008") {
  throw new Error(`this court runs in the DEV world only; DATABASE_URL points at :${new URL(uri).port}`);
}
const bucket = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
if (!bucket) throw new Error("R2_PUBLIC_URL is not set — there is nowhere to fetch a master from");
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is not set — this court is a reading and there is nothing to read with");

await mkdir(OUT, { recursive: true });

const connection = await openDatabase({ uri, timezone: "Z" });
const [rows] = await connection.query<any[]>(`
  SELECT publicId, imageKey FROM casting_candidates
   WHERE imageKey IS NOT NULL AND imageKey <> ''
   ORDER BY id DESC LIMIT ?`, [faces]);
await connection.end();
if (rows.length === 0) throw new Error("no dev candidate carries a master image");

const reader = createFalRegionReader({ apiKey });
let reads = 0;
/** Frames bought from the image transport for the positive arm — priced apart
 *  from the reads, because they are two different purchases at two prices. */
let paints = 0;

/** One reading, taken exactly as the mint takes it, with its mask written out. */
async function readRegion(label: string, image: Buffer, name: string): Promise<{
  pixels: number; total: number; share: number;
}> {
  reads += 1;
  const mask = await reader.region({ image, name, absentIsAnswer: true });
  if (!mask) return { pixels: -1, total: 0, share: -1 };
  let pixels = 0;
  for (const value of mask.data) if (value !== 0) pixels += 1;
  const total = mask.width * mask.height;
  if (pixels > 0) {
    await writeFile(
      path.join(OUT, `${label}-${name}.png`),
      await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
        .png().toBuffer(),
    );
  }
  return { pixels, total, share: total === 0 ? 0 : pixels / total };
}

const open = await readFalBalance();
console.log(`world     dev :52008 · bucket ${bucket.replace(/^https?:\/\//, "").slice(0, 28)}…`);
console.log(`faces     ${rows.length}: ${rows.map((row) => row.publicId.slice(0, 8)).join(" ")}`);
console.log(`money     ${falLine(open)} at open · ceiling $${CEILING_USD.toFixed(2)}`);
console.log();

const frames = new Map<string, Buffer>();
for (const row of rows) {
  frames.set(row.publicId, (await fetchImageBytes(`${bucket}/${row.imageKey}`)).bytes);
}

/* ─────────────────────────── the controls, first ─────────────────────────── */
console.log("CONTROLS");
let controlsPass = true;
for (const control of CONTROLS) {
  const readings: string[] = [];
  let ok = true;
  for (const row of rows) {
    const label = row.publicId.slice(0, 8);
    const reading = await readRegion(label, frames.get(row.publicId)!, control.name);
    readings.push(reading.share < 0 ? "no-read" : `${(reading.share * 100).toFixed(4)}%`);
    if (control.expect === "answers" && !(reading.pixels > 0)) ok = false;
    if (control.expect === "declines" && reading.pixels !== 0) ok = false;
  }
  controlsPass &&= ok;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${control.name} must ${control.expect} — ${readings.join(" · ")}`);
}
console.log();

if (!controlsPass) {
  console.log("VERDICT REFUSED — a control failed, so nothing below is a reading about the open kinds.");
  console.log(`reads     ${reads} · $${(reads * USD_PER_READ).toFixed(3)}`);
  console.log(`money     ${falLine(await readFalBalance())} at close`);
  process.exit(1);
}

/* ───────────────────────────── the question ──────────────────────────────── */
console.log("THE OPEN KINDS, on frames that do not hold them");
const table: Array<{ kind: string; declines: number; of: number; worst: number }> = [];
for (const kind of OPEN_KINDS) {
  const readings: string[] = [];
  let declines = 0;
  let worst = 0;
  for (const row of rows) {
    const label = row.publicId.slice(0, 8);
    const reading = await readRegion(label, frames.get(row.publicId)!, kind);
    readings.push(reading.share < 0 ? "no-read" : `${(reading.share * 100).toFixed(4)}%`);
    if (reading.pixels === 0) declines += 1;
    if (reading.share > worst) worst = reading.share;
  }
  table.push({ kind, declines, of: rows.length, worst });
  console.log(`  ${kind.padEnd(7)} declined ${declines}/${rows.length}  ${readings.join(" · ")}`);
}
console.log();

/* ────────── the positive arm — DECLARED SUBSTITUTION, see the header ──────── */
/*
  A CLEAN DECLINE IS NOT A FINDING ON ITS OWN, and this is the fixture that
  makes it one (null-needs-a-fixture). Five nouns reading exactly zero is what a
  perfect absence control looks like AND what a reader with no concept of the
  word looks like — and those two have opposite consequences: the first lets the
  crop through, the second means the DELIVERED read finds nothing either and the
  kind falls to words regardless.

  So one frame per kind is MADE to hold the thing, through the image transport
  directly, and the same reader is asked again. The frames are a substitution
  and the header says so: no ask path exists until step 5.
*/
const made: Array<{ kind: string; answers: boolean; share: number }> = [];
if (process.argv.includes("--positive")) {
  console.log("THE SAME KINDS, on frames MADE to hold them (transport-made — a declared substitution)");
  const { createFalMaskedEditEngine } = await import("../server/providers/falImages");
  const engine = createFalMaskedEditEngine({ apiKey });
  const subject = rows[0]!;
  const master = frames.get(subject.publicId)!;
  const meta = await sharp(master).metadata();
  const width = Math.floor((meta.width ?? 0) / 16) * 16;
  const height = Math.floor((meta.height ?? 0) / 16) * 16;
  if (width === 0 || height === 0) throw new Error("the master has no readable dimensions");
  const base = width === meta.width && height === meta.height
    ? master
    : await sharp(master).resize(width, height, { fit: "cover" }).png().toBuffer();

  for (const kind of OPEN_KINDS) {
    const painted = await engine.edit({
      prompt: `Give this person ${kind}. Change nothing else about them — same face, same hair, `
        + `same clothing, same photograph.`,
      references: [{ bytes: base, contentType: "image/png" }],
      width,
      height,
    });
    const label = `made-${kind}`;
    await writeFile(path.join(OUT, `${label}-frame.png`), painted.bytes);
    const reading = await readRegion(label, painted.bytes, kind);
    paints += 1;
    made.push({ kind, answers: reading.pixels > 0, share: Math.max(reading.share, 0) });
    console.log(`  ${kind.padEnd(7)} on a frame made to hold it — `
      + `${reading.share < 0 ? "no-read" : `${(reading.share * 100).toFixed(4)}%`}`
      + `${reading.pixels > 0 ? "  ANSWERS" : "  still declines"}`);
  }
  console.log();
}

/*
  THE VERDICT NEEDS BOTH ARMS, and this line said otherwise on its first run.

  It printed `CARRIES fangs, wings, tail, scales, gills` off the bare-frame arm
  alone — but passing the absence control is only half of carrying. A kind that
  declines on a frame that HOLDS the thing never gets a region on the delivered
  frame either, so it falls to `noRegion` and files words with no crop, exactly
  like a kind the control turned away. Two opposite readings, one word. The
  first run's summary line is superseded by this classification; its per-kind
  rows were correct and are what the report quotes.
*/
const positive = new Map(made.map((entry) => [entry.kind, entry.answers]));
const carries = table
  .filter((entry) => entry.declines === entry.of && positive.get(entry.kind) === true)
  .map((entry) => entry.kind);
const readerBlind = table
  .filter((entry) => entry.declines === entry.of && positive.get(entry.kind) === false)
  .map((entry) => entry.kind);
const refused = table.filter((entry) => entry.declines < entry.of);
const unproven = table.filter((entry) => entry.declines === entry.of && !positive.has(entry.kind));

console.log(`CARRIES   ${carries.length ? carries.join(", ") : "none"}`
  + " — declines where the thing is absent AND answers where it is present");
console.log(`BLIND     ${readerBlind.length ? readerBlind.join(", ") : "none"}`
  + " — the reader cannot see these even when they are plainly there, so they"
  + " sell as WORDS: no region, no crop, nothing for the control to pass");
console.log(`REFUSED   ${refused.length
  ? refused.map((entry) => `${entry.kind} (worst ${(entry.worst * 100).toFixed(4)}%)`).join(", ")
  : "none"} — answered on a frame that cannot hold the thing`);
if (unproven.length > 0) {
  console.log(`UNPROVEN  ${unproven.map((entry) => entry.kind).join(", ")}`
    + " — declined on bare frames and NO positive arm was run, so a clean"
    + " absence control and a reader with no concept of the word are"
    + " indistinguishable here. Run with --positive before quoting these.");
}
console.log();
console.log(`reads     ${reads} · $${(reads * USD_PER_READ).toFixed(3)}`
  + `${paints ? ` · ${paints} paints · $${(paints * USD_PER_PAINT).toFixed(3)}` : ""}`
  + ` — modelled $${(reads * USD_PER_READ + paints * USD_PER_PAINT).toFixed(3)} of the $${CEILING_USD.toFixed(2)} ceiling`);
console.log("          the BALANCE line is the fact; the figure above is the model, "
  + "and fal settles late so a close taken now is a floor");
console.log(`money     ${falLine(await readFalBalance())} at close`);
console.log(`masks     ${OUT} — every non-empty answer is written out; LOOK at them`);

process.exit(0);
