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
 * No credits: the frames are already paid for, and every call here is a text
 * completion plus one segmentation per master.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/calibration/marks-reader-court.mts
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
  /* POSITIVE — run-12, the olive-skinned face. Freckles across both cheeks and
     the nose bridge, unmistakable at 3×. All four are the same face. */
  { name: "run12-01 after 'give her freckles'", file: "output/walk/run-12/01-delivered.png", asked: "freckles", truth: "present" },
  { name: "run12-03 after lip gloss", file: "output/walk/run-12/03-delivered.png", asked: "freckles", truth: "present" },
  { name: "run12-04 after hoops", file: "output/walk/run-12/04-delivered.png", asked: "freckles", truth: "present" },
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
async function faceCrop(file: string): Promise<Buffer | null> {
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
  const pad = Math.round((maxX - minX) * 0.12);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(meta.width! - left, maxX - minX + pad * 2);
  const height = Math.min(meta.height! - top, maxY - minY + pad * 2);
  return sharp(bytes).extract({ left, top, width, height }).png().toBuffer();
}

/** The production reader, asked the production question. */
async function ask(bytes: Buffer, asked: string): Promise<{ verified: boolean | null; saw: string }> {
  const verdict = await verifyRender({
    bytes,
    contentType: "image/png",
    facts: [{ facet: "marks", asked, binding: false }],
  });
  const check = verdict.checks[0];
  if (!check) return { verified: null, saw: verdict.unavailable ? "(no reader)" : "(no check)" };
  return { verified: check.verified ?? null, saw: String(check.saw ?? "") };
}

const rows: Record<string, unknown>[] = [];
console.log("case                                  truth     portrait          crop");
console.log("-".repeat(96));

for (const entry of CASES) {
  if (!existsSync(entry.file)) { console.log(`${entry.name.padEnd(38)} SKIPPED — ${entry.file} missing`); continue; }
  const bytes = readFileSync(entry.file);

  const portrait = await ask(bytes, entry.asked);
  const cropBytes = await faceCrop(entry.file);
  if (cropBytes) writeFileSync(`${OUT}/${entry.name.replace(/[^a-z0-9]+/gi, "-")}-crop.png`, cropBytes);
  const crop = cropBytes ? await ask(cropBytes, entry.asked) : { verified: null, saw: "(no face read)" };

  const reads = (result: { verified: boolean | null }) =>
    result.verified === null ? "?" : result.verified ? "present" : "absent";
  const mark = (result: { verified: boolean | null }) =>
    result.verified === null ? "  ?  " : reads(result) === entry.truth ? " RIGHT" : " WRONG";

  console.log(`${entry.name.slice(0, 37).padEnd(38)} ${entry.truth.padEnd(9)}`
    + `${reads(portrait).padEnd(9)}${mark(portrait).padEnd(8)}`
    + `${reads(crop).padEnd(9)}${mark(crop)}`);
  console.log(`    portrait saw: ${portrait.saw.slice(0, 110)}`);
  console.log(`    crop     saw: ${crop.saw.slice(0, 110)}`);

  rows.push({
    case: entry.name, file: entry.file, asked: entry.asked, truth: entry.truth,
    portrait: { verified: portrait.verified, saw: portrait.saw },
    crop: { verified: crop.verified, saw: crop.saw },
  });
}

const score = (lens: "portrait" | "crop") => {
  let right = 0;
  let read = 0;
  for (const row of rows) {
    const result = row[lens] as { verified: boolean | null };
    if (result.verified === null) continue;
    read += 1;
    const said = result.verified ? "present" : "absent";
    if (said === row.truth) right += 1;
  }
  return `${right}/${read}`;
};
console.log(`\nportrait ${score("portrait")} correct    crop ${score("crop")} correct`);
writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ rows }, null, 2)}\n`);
console.log(`written ${OUT}/results.json`);
