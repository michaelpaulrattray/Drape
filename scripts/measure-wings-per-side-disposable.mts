/**
 * CAN A PAIRED OPEN KIND BE READ ONE SIDE AT A TIME? — the $0.01 measure
 * ordered by fable-872 §2, on the specimen the open-absence court already
 * bought (`output/open-absence-court/made-wings-frame.png`).
 *
 * # This is PROMOTION-DESIGN DATA. It is not a mint route.
 *
 * The ruling it serves is already made and is not in question here: **paired
 * open kinds are WORDS-ONLY UNTIL PROMOTED** (fable-872 §2). No crop of one
 * instance may ever file under a name that means both — that is the earring
 * history and it does not get a second run in a new lane. What this measures is
 * the thing the ruling deliberately leaves open: whether, WHEN somebody promotes
 * a paired kind, the per-side reader the closed lane already owns would find
 * both instances. That is a capability question, and it is cheap.
 *
 * # The finding it comes from
 *
 * The court asked the reader for `wings` on a frame the engine had painted with
 * two, whole-frame, exactly as the mint does. It answered **7.3277% of frame,
 * ONE wing, the image's left** — a number that reads like a clean pass and is
 * half a picture. Only the overlay said so.
 *
 * # What is asked here, in order
 *
 *   1. THE WHOLE-FRAME READ, re-bought in this sitting rather than quoted from
 *      the court's report. Two numbers from two sittings are not a comparison
 *      (read-the-same-pixels); the halves below are only meaningful against a
 *      whole read taken from the same reader on the same minute.
 *   2. `regionSides` ITSELF, asked for real. Its answer is `null` before any
 *      call is spent, and that is a fact about the product rather than about
 *      wings: `BILATERAL` derives from the slot catalogue's `frame: "ownSide"`
 *      column, and an open kind has no card, so the door is shut by
 *      construction. Printed because "route it through regionSides" is one of
 *      the two shapes the ruling weighs, and this is what that shape costs.
 *   3. THE METHOD UNDERNEATH IT, driven — cut the frame at her face's centroid
 *      and ask each half. That is precisely what `bilateralHalves` does for a
 *      catalogued pair, and it is the only part of the closed lane's per-side
 *      capability that an open kind could ever inherit.
 *
 * # THE CONTROL, and why a positive without it is worth nothing
 *
 * Two halves both answering is ALSO what a reader that answers something to
 * every crop looks like — the vacuous shape this program has already met on the
 * earring reader (fable-378 §3), and the exact failure the open lane's absence
 * control exists for. So the same split, the same question, is asked of a frame
 * of the SAME SUBJECT that plainly wears no wings: the court's `scales` frame,
 * already on disk. Both halves must decline. If they do not, nothing below is a
 * reading about wings.
 *
 * # THE SUBSTITUTION, declared (court-must-assert-its-road)
 *
 * `bilateralHalves` is module-private, so the halves are cut here and asked
 * through the reader's public `region`. Two differences, both stated:
 *
 *   a. `region` asks a non-bilateral name in instance mode `"first"`; the real
 *      path asks a half in `"all"`. `first ⊆ all`, so this substitution can only
 *      ever UNDERSTATE a half's answer — a positive finding is therefore safe
 *      and a null one would be ambiguous. The verdict below is only allowed to
 *      lean on the positive direction.
 *   b. the midline comes from a `face` read taken the same way, where the real
 *      `axisOf` asks in `"all"`. On a single-subject portrait these are the same
 *      face; on a frame holding two they would not be.
 *
 * It is not an end-to-end proof of anything on the product path, and no
 * sentence from it may stand in for one. Nothing here mints, files, or writes.
 *
 * # Bounds
 *
 *   House money, no credits, no render bought — every frame it reads was paid
 *   for by the court yesterday and is on disk. DEV world. Reads are counted and
 *   priced at the scan economy's own measured $0.005, and the fal balance at
 *   open and close is the fact beside the model.
 *
 *   npx tsx scripts/measure-wings-per-side-disposable.mts
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { readFalBalance, falLine } from "./lib/falSpend.mts";

const COURT = path.resolve("output/open-absence-court");
const OUT = path.resolve("output/wings-per-side");

/** The frame the court painted with two wings, and the frame of the same
 *  subject that wears none — the specimen and its control, both already bought. */
const SPECIMEN = path.join(COURT, "made-wings-frame.png");
const CONTROL = path.join(COURT, "made-scales-frame.png");

/** The scan economy's own measured price for one segmenter call. */
const USD_PER_READ = 0.005;

assertOneWorld();
const uri = process.env.DATABASE_URL;
if (uri && new URL(uri).port !== "52008") {
  throw new Error(`this measure runs in the DEV world only; DATABASE_URL points at :${new URL(uri).port}`);
}
const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY is not set — this is a reading and there is nothing to read with");

const { mkdir } = await import("node:fs/promises");
await mkdir(OUT, { recursive: true });

const reader = createFalRegionReader({ apiKey });
let reads = 0;

type Reading = { pixels: number; total: number; share: number };

/** One reading, its mask written out beside the frame it came from (law 9: a
 *  coverage number is not a picture, and this measure's whole subject is WHERE
 *  the answer sits). */
async function read(label: string, image: Buffer, name: string): Promise<Reading> {
  reads += 1;
  const mask = await reader.region({ image, name, absentIsAnswer: true });
  let pixels = 0;
  for (const value of mask.data) if (value !== 0) pixels += 1;
  const total = mask.width * mask.height;
  if (pixels > 0) {
    await writeFile(
      path.join(OUT, `${label}.png`),
      await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
        .png().toBuffer(),
    );
  }
  return { pixels, total, share: total === 0 ? 0 : pixels / total };
}

/** The centroid x of a mask — her axis, the same quantity `axisOf` takes. */
function centroidX(mask: { data: Uint8Array | Buffer; width: number; height: number }): number | null {
  let total = 0;
  let sum = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] !== 0) { total += 1; sum += x; }
    }
  }
  return total === 0 ? null : Math.round(sum / total);
}

/** Cut at her midline and ask each half, exactly as `bilateralHalves` does. */
async function halves(label: string, frame: Buffer, noun: string): Promise<{
  midline: number; byFace: boolean; atImageLeft: Reading; atImageRight: Reading;
}> {
  const meta = await sharp(frame).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error(`${label} has no readable size`);

  reads += 1;
  const face = await reader.region({ image: frame, name: "face", absentIsAnswer: true });
  const axis = centroidX(face);
  const midline = Math.min(width - 1, Math.max(1, Math.round(axis ?? width / 2)));

  const cut = async (left: number, cropWidth: number) => sharp(frame)
    .extract({ left, top: 0, width: cropWidth, height }).png().toBuffer();

  const atImageLeft = await read(`${label}-image-left-${noun}`, await cut(0, midline), noun);
  const atImageRight = await read(`${label}-image-right-${noun}`, await cut(midline, width - midline), noun);
  return { midline, byFace: axis !== null, atImageLeft, atImageRight };
}

const pct = (reading: Reading) => `${(reading.share * 100).toFixed(4)}%`;
const verdict = (reading: Reading) => (reading.pixels > 0 ? "ANSWERS" : "declines");

const specimen = await readFile(SPECIMEN);
const control = await readFile(CONTROL);
const open = await readFalBalance();
console.log(`specimen  ${path.relative(process.cwd(), SPECIMEN)} — the court's wings frame`);
console.log(`control   ${path.relative(process.cwd(), CONTROL)} — same subject, no wings`);
console.log(`money     ${falLine(open)} at open`);
console.log();

/* ─────────── 1. the whole-frame read, re-bought in this sitting ──────────── */
const whole = await read("specimen-whole-wings", specimen, "wings");
console.log("WHOLE FRAME, as the mint asks it");
console.log(`  wings   ${pct(whole)}  ${verdict(whole)}`
  + "   (the court read 7.3277% and found ONE wing; this is the same question re-asked today)");
console.log();

/* ───────────── 2. regionSides itself, asked rather than assumed ──────────── */
const sides = await reader.regionSides!({ image: specimen, name: "wings", absentIsAnswer: true });
console.log("regionSides(\"wings\") — the closed lane's per-side door, asked for real");
console.log(`  ${sides === null ? "null" : "answered"} — `
  + (sides === null
    ? "a CAPABILITY answer, spent before any call: BILATERAL derives from the slot "
      + "catalogue's `frame: \"ownSide\"` column and an open kind has no card, so the "
      + "door is shut by construction rather than by this frame"
    : "UNEXPECTED — an open kind reached the per-side path; read the code before this line"));
console.log();

/* ────────── 3. the method underneath it, driven — and its control ────────── */
console.log("CONTROL FIRST — the same split on a frame of the same subject wearing none");
const clean = await halves("control-scales", control, "wing");
console.log(`  midline ${clean.midline}px (${clean.byFace ? "her face's centroid" : "the image's middle — NO FACE READ"})`);
console.log(`  image-left   ${pct(clean.atImageLeft)}  ${verdict(clean.atImageLeft)}`);
console.log(`  image-right  ${pct(clean.atImageRight)}  ${verdict(clean.atImageRight)}`);
const controlPasses = clean.atImageLeft.pixels === 0 && clean.atImageRight.pixels === 0;
console.log(`  ${controlPasses ? "pass" : "FAIL"}  both halves must decline`);
console.log();

if (!controlPasses) {
  console.log("VERDICT REFUSED — a half answered where there is nothing to answer about, "
    + "so two answering halves below would be the vacuous shape rather than a pair.");
  console.log(`reads     ${reads} · $${(reads * USD_PER_READ).toFixed(3)}`);
  console.log(`money     ${falLine(await readFalBalance())} at close`);
  process.exit(1);
}

console.log("THE SPECIMEN, cut at her midline and asked one side to a picture");
const split = await halves("specimen-wings", specimen, "wing");
console.log(`  midline ${split.midline}px (${split.byFace ? "her face's centroid" : "the image's middle — NO FACE READ"})`);
console.log(`  image-left   ${pct(split.atImageLeft)}  ${verdict(split.atImageLeft)}`);
console.log(`  image-right  ${pct(split.atImageRight)}  ${verdict(split.atImageRight)}`);
console.log();

const both = split.atImageLeft.pixels > 0 && split.atImageRight.pixels > 0;
const one = (split.atImageLeft.pixels > 0) !== (split.atImageRight.pixels > 0);
console.log(`READING   ${both
  ? "BOTH SIDES ANSWER — the split-frame method finds a wing the whole-frame read "
    + "did not, so per-side geometry is available to a paired open kind AT PROMOTION"
  : one
    ? "ONE SIDE ONLY — the split does not rescue the second instance on this specimen; "
      + "promotion of a paired kind cannot assume the closed lane's method transfers"
    : "NEITHER SIDE — and the whole-frame read answered, which is a finding about the "
      + "split rather than about the pair; look at the masks before quoting this"}`);
console.log("          PROMOTION-DESIGN DATA ONLY. The ruling stands: a paired open kind "
  + "is words-only until promoted (fable-872 §2).");
console.log();
console.log(`reads     ${reads} · modelled $${(reads * USD_PER_READ).toFixed(3)}`);
console.log("          the BALANCE line is the fact; fal settles late, so a close taken now is a floor");
console.log(`money     ${falLine(await readFalBalance())} at close`);
console.log(`masks     ${OUT} — every non-empty answer is written out; LOOK at them`);

process.exit(0);
