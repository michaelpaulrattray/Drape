/**
 * THE READER'S OWN COURT — because a verdict that gates the bar has never been
 * given a control.
 *
 * Run-12 scored `marks` at 25% and stopped the walk. The double-read says the
 * renders were right every time: the freckles are plainly there, and at 3× on
 * her cheeks they are unmistakable. What the reader stored was
 *
 *   "clear skin, no visible freckles on face"      (render 1)
 *   "clear skin, no visible freckles"              (render 3)
 *   "clear, even skin with no visible freckles"    (render 4)
 *   "light freckles visible across cheeks and nose"(render 5)
 *
 * Same face, same freckles, four readings, three of them flat absence reports.
 * Working law 2: a new metric, reader or checker gets a negative control and a
 * positive control before its verdicts count for anything. This one never had
 * either, and it has been scoring the campaign's delivery rate.
 *
 * # What this asks, and why twice
 *
 * Every case is put to the PRODUCTION reader — `verifyRender`, the same
 * function, the same prompt, the same engine — with the truth declared here by
 * eye and recorded beside the verdict. Then the same frame is put to it again as
 * a FACE CROP taken from the segmenter's own read of her face, because "does
 * this face have freckles?" at full-portrait scale is exactly where a
 * photo-reader goes blind, and the crop law ("the crop comes from the master")
 * has already been learnt once on this bench. If crop scale flips the readings,
 * the fix is WHERE THE READER LOOKS, not what it is asked.
 *
 * # And why REPEATEDLY (2026-08-08)
 *
 * The first sitting asked each question once per lens, then reported a residual
 * as *"the reader is unstable at its own margin"*. **A court that samples once
 * cannot make that finding** — one reading of a stochastic reader is the very
 * thing under suspicion, and a single sample cannot tell an unstable answer
 * from a wrong one. So each case is now put `--repeat N` times per lens
 * (default 5), and the column is a tally rather than a verdict. A 5/5 and a
 * 3/5 are different diagnoses with different repairs, and they used to print
 * identically.
 *
 * The reader runs at temperature 0, which is a reason to expect stability, not
 * a proof of it. Measuring costs nothing but time.
 *
 * No credits: the frames are already paid for, and every call here is a text
 * completion plus one segmentation per master.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/calibration/marks-reader-court.mts
 *   npx tsx scripts/calibration/marks-reader-court.mts --repeat 5
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

import { verifyRender } from "../../server/castingV2/renderVerification";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";

const OUT = "output/marks-court";
mkdirSync(OUT, { recursive: true });

const falKey = process.env.FAL_KEY;
if (!falKey) throw new Error("FAL_KEY required — the crop comes from a segmentation, never from a guess");
const reader = createFalRegionReader({ apiKey: falKey });

/**
 * THE CASES, with truth declared by a human looking at the artifact.
 *
 * Declared here rather than inferred from what the product said, which is the
 * whole point: a control whose answer comes from the thing under test is not a
 * control.
 */
type Case = { name: string; file: string; asked: string; truth: "present" | "absent" };

const CASES: Case[] = [
  /*
    NEGATIVE — HER OWN BARE MASTER, the case this court was missing.

    Its absence is why the truths below were wrong. Without her untouched face
    on the bench there was no way to ask "what does this reader say about THIS
    skin before anyone asked for freckles", so every reading of hers was
    compared against a declaration rather than against her.
  */
  { name: "run12-00 HER MASTER, before freckles", file: "output/marks-court/MASTER-run12.png", asked: "freckles", truth: "absent" },
  /* POSITIVE — run-12, the olive-skinned face. Freckles across both cheeks and
     the nose bridge, clear at 3×. All four are the same face. */
  { name: "run12-01 after 'give her freckles'", file: "output/walk/run-12/01-delivered.png", asked: "freckles", truth: "present" },
  { name: "run12-03 after lip gloss", file: "output/walk/run-12/03-delivered.png", asked: "freckles", truth: "present" },
  /*
    NEGATIVE — AND THIS TRUTH WAS DECLARED THE OTHER WAY UNTIL 2026-08-08.

    It was `present`, on the strength of "the freckles are plainly there" said
    at portrait scale about all four frames at once. It is wrong. Frame 04 is
    at her untouched floor by measurement (3.49 against her master's 3.84 per
    1000 skin px, `freckle-density.mts`) and indistinguishable from her master
    to the eye at 3× (`output/marks-court/COMPARE-cheek-00-01-04.png`, master /
    01 / 04 stacked: a plain freckle cluster in the middle tile, clear skin in
    the other two).

    So the reader's "clear, even skin with no visible freckles" on this frame
    was RIGHT, and this court convicted it. A declared truth is evidence like
    any other and gets the same double-read at the resolution the claim needs —
    the prosecutor's own rule, applied to the prosecutor a second time.

    That the freckles genuinely vanished at step 4 is a PRODUCT defect and a
    much larger one than a reader miss. It is not this court's business; it is
    the reason order 3 exists.
  */
  { name: "run12-04 after hoops", file: "output/walk/run-12/04-delivered.png", asked: "freckles", truth: "absent" },
  { name: "run12-05 after the removal", file: "output/walk/run-12/05-delivered.png", asked: "freckles", truth: "present" },
  /* POSITIVE — run-11, a different face type entirely (redhead, pale, heavily
     freckled by the roll itself). If the reader can see these and not the
     others, the failure is about skin tone or density rather than about seeing. */
  { name: "run11-04 redhead, hoops", file: "output/walk/run-11/04-delivered.png", asked: "freckles", truth: "present" },
  { name: "run11-05 redhead, removal", file: "output/walk/run-11/05-delivered.png", asked: "freckles", truth: "present" },
  /* NEGATIVE — the glasses specimen. Clear skin, no freckles anywhere; a reader
     that answers "freckled" here is not strict, it is broken in the direction
     that manufactures false passes. */
  { name: "fresh-02 specimen (no freckles)", file: "output/masked/specimens/fresh-02.png", asked: "freckles", truth: "absent" },
];

/** Her face, from the segmenter, with a margin — never a fraction of the frame. */
async function faceCrop(file: string, padFraction = 0.12): Promise<Buffer | null> {
  const bytes = readFileSync(file);
  const meta = await sharp(bytes).metadata();
  const region = await reader.region({ image: bytes, name: "face skin" }).catch(() => null);
  if (!region) return null;
  let minX = region.width;
  let maxX = 0;
  let minY = region.height;
  let maxY = 0;
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      if (region.data[y * region.width + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const pad = Math.round((maxX - minX) * padFraction);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(meta.width! - left, maxX - minX + pad * 2);
  const height = Math.min(meta.height! - top, maxY - minY + pad * 2);
  const crop = sharp(bytes).extract({ left, top, width, height });
  return crop.png().toBuffer();
}

/**
 * THE FACE CROP, ENLARGED — the same pixels, more of them.
 *
 * Worth separating from the crop because they test different hypotheses. The
 * crop tests *where the reader looks*: freckles are a few pixels across in a
 * 1024×1536 portrait and a vision model downsamples before it ever sees them.
 * The upscale tests whether what is left after that downsample is enough — if
 * the same crop read larger changes the answer, the loss is resolution and the
 * repair is to send more of it, not to ask differently.
 *
 * Nearest-neighbour on purpose: it invents no detail. A smooth resampler would
 * hand the reader plausible pigment that the render does not contain, which is
 * the fidelity law's failure mode pointed straight at an instrument.
 */
async function enlargedFaceCrop(file: string): Promise<Buffer | null> {
  const crop = await faceCrop(file, 0.04);
  if (!crop) return null;
  const meta = await sharp(crop).metadata();
  if (!meta.width) return null;
  return sharp(crop)
    .resize({ width: Math.min(2048, meta.width * 2), kernel: "nearest" })
    .png().toBuffer();
}

/** The production reader, asked the production question. */
async function ask(
  bytes: Buffer,
  asked: string,
  detail?: Buffer | null,
): Promise<{ verified: boolean | null; saw: string }> {
  const verdict = await verifyRender({
    bytes,
    contentType: "image/png",
    ...(detail ? { detail: { bytes: detail, contentType: "image/png" } } : {}),
    facts: [{ facet: "marks", asked, binding: false }],
  });
  const check = verdict.checks[0];
  if (!check) return { verified: null, saw: verdict.unavailable ? "(no reader)" : "(no check)" };
  return { verified: check.verified ?? null, saw: String(check.saw ?? "") };
}

const repeatFlag = process.argv.indexOf("--repeat");
const REPEAT = repeatFlag > -1 ? Number(process.argv[repeatFlag + 1]) : 5;
if (!Number.isInteger(REPEAT) || REPEAT < 1) throw new Error("--repeat needs a whole number of readings");

/**
 * THE FOUR LENSES — and the last one is the only one that ships.
 *
 * `enlarged` puts the magnified crop to the reader ON ITS OWN. That answered
 * the diagnostic question (is the loss resolution?) and it is NOT what
 * production can do: the reader has to weigh every fact in the recipe against
 * one photograph, and a crop of her cheek cannot answer a question about her
 * hair. So production sends BOTH — the frame and the enlargement, in one call.
 *
 * Those are different experiments, and a court that proved the first and
 * shipped the second would be assuring us about a shape nobody ran. `pair` is
 * the shape that ships, driven through `verifyRender`'s own `detail` argument.
 */
const LENSES = ["portrait", "crop", "enlarged", "pair"] as const;
type Lens = (typeof LENSES)[number];

/** N readings of one question about one picture, kept individually. */
type Sitting = { present: number; absent: number; unread: number; saws: string[] };

async function sit(bytes: Buffer | null, asked: string, detail?: Buffer | null): Promise<Sitting> {
  const sitting: Sitting = { present: 0, absent: 0, unread: 0, saws: [] };
  if (!bytes) { sitting.unread = REPEAT; sitting.saws.push("(no face read)"); return sitting; }
  for (let reading = 0; reading < REPEAT; reading += 1) {
    const result = await ask(bytes, asked, detail);
    if (result.verified === null) sitting.unread += 1;
    else if (result.verified) sitting.present += 1;
    else sitting.absent += 1;
    sitting.saws.push(result.saw);
  }
  return sitting;
}

const rows: Record<string, unknown>[] = [];
console.log(`\n${REPEAT} readings per lens. A tally, not a verdict — "3/5" and "5/5" are `
  + `different diagnoses.\n`);
console.log("case                                  truth      portrait     crop         enlarged     pair (SHIPS)");
console.log("-".repeat(96));

for (const entry of CASES) {
  if (!existsSync(entry.file)) { console.log(`${entry.name.padEnd(38)} SKIPPED — ${entry.file} missing`); continue; }
  const bytes = readFileSync(entry.file);
  const slug = entry.name.replace(/[^a-z0-9]+/gi, "-");

  const cropBytes = await faceCrop(entry.file);
  if (cropBytes) writeFileSync(`${OUT}/${slug}-crop.png`, cropBytes);
  const enlargedBytes = await enlargedFaceCrop(entry.file);
  if (enlargedBytes) writeFileSync(`${OUT}/${slug}-enlarged.png`, enlargedBytes);

  const sittings: Record<Lens, Sitting> = {
    portrait: await sit(bytes, entry.asked),
    crop: await sit(cropBytes, entry.asked),
    enlarged: await sit(enlargedBytes, entry.asked),
    pair: await sit(bytes, entry.asked, enlargedBytes),
  };

  /* How many of the N readings landed on the truth. The tally IS the finding:
     a lens that is right 5/5 and one that is right 3/5 have both "passed" under
     a single-sample court, and only one of them is an instrument. */
  const correctOf = (sitting: Sitting) =>
    entry.truth === "present" ? sitting.present : sitting.absent;
  const cell = (sitting: Sitting) => {
    const right = correctOf(sitting);
    const flag = right === REPEAT ? "" : right === 0 ? " ✗" : " ~";
    return `${right}/${REPEAT}${flag}`.padEnd(13);
  };

  console.log(`${entry.name.slice(0, 37).padEnd(38)} ${entry.truth.padEnd(10)}`
    + LENSES.map((lens) => cell(sittings[lens])).join(""));
  for (const lens of LENSES) {
    const unique = Array.from(new Set(sittings[lens].saws));
    console.log(`    ${lens.padEnd(9)} ${unique.length === 1 ? "" : `${unique.length} distinct: `}`
      + unique.map((saw) => saw.slice(0, 74)).join(" | ").slice(0, 150));
  }

  rows.push({
    case: entry.name, file: entry.file, asked: entry.asked, truth: entry.truth,
    readings: REPEAT,
    ...Object.fromEntries(LENSES.map((lens) => [lens, sittings[lens]])),
  });
}

/**
 * THE PASS GATE — every case right on EVERY reading, not on the reading it got.
 *
 * A lens that is right 4 times in 5 has not passed; it has been lucky four
 * times, and the product takes one sample.
 */
console.log("");
for (const lens of LENSES) {
  let clean = 0;
  let readings = 0;
  let correct = 0;
  for (const row of rows) {
    const sitting = row[lens] as Sitting;
    const right = row.truth === "present" ? sitting.present : sitting.absent;
    readings += REPEAT;
    correct += right;
    if (right === REPEAT) clean += 1;
  }
  console.log(`${lens.padEnd(9)} ${clean}/${rows.length} cases unanimous`
    + `    ${correct}/${readings} readings correct`);
}
writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ readings: REPEAT, rows }, null, 2)}\n`);
console.log(`\nwritten ${OUT}/results.json`);
