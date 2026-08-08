/**
 * DID HER FRECKLES ACTUALLY COME AND GO? — counted, not argued.
 *
 * Run-12's `marks` scored 25% and the first story was "the reader is broken".
 * The reader's own court then acquitted it on the negative control, on both
 * redhead positives and on one of the olive-skinned frames — and eyeballing the
 * four crops at 3× says frame 04 really is close to bare while 05 is the densest
 * of the set. Two stories in one number, and the last two stories I was
 * confident about both died on measurement.
 *
 * So this counts. Every render in the chain is base-anchored (D-86), so each one
 * re-renders her freckles from the recipe's own word for them — and if that word
 * buys a different density every time, a customer paid at step 1 for something
 * step 4 handed back without.
 *
 * # How it counts, and what it refuses to do
 *
 * A freckle is a small dark speck against LOCAL skin, not against a global
 * threshold: her cheek is lit differently from her nose and both are lit
 * differently from the frame next door. So the baseline is a blur of her own
 * skin in that frame — every count is relative to the face it is on, and a
 * frame the painter rendered a shade warmer cannot inflate its own score.
 *
 * The patches are the two CHEEK-AND-NOSE bands, derived from the segmenter's own
 * read of her face rather than from fractions of the frame (the crop law). They
 * are written out beside the numbers, because a count over a patch nobody looked
 * at is a claim about a region that might contain her nostril.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/calibration/freckle-density.mts
 *   (no database needed — plain `npx tsx` is fine; FAL_KEY supplies the face)
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { CHANGE_AMPLITUDE } from "../../server/castingV2/changeAmplitude";

const OUT = "output/marks-court";
mkdirSync(OUT, { recursive: true });

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required — the patch comes from a segmentation, never from a fraction");
const reader = createFalRegionReader({ apiKey });

const FRAMES = [
  { name: "01 after 'give her freckles'", file: "output/walk/run-12/01-delivered.png" },
  { name: "03 after lip gloss", file: "output/walk/run-12/03-delivered.png" },
  { name: "04 after hoops", file: "output/walk/run-12/04-delivered.png" },
  { name: "05 after the removal", file: "output/walk/run-12/05-delivered.png" },
  /*
    THE COUNTER'S OWN CONTROLS, because a count nobody has calibrated is worth
    what an unproven reader is worth — and this shift has now been burnt twice
    by believing an instrument that had never been made to fail.

    `neg` is the clear-skinned specimen the READER also calls clear, so the two
    instruments agree on a case with no freckles in it. `pos` is the redhead the
    roll itself freckled heavily, which both instruments should find loud. If
    the counter cannot separate those two, no number above it means anything.
  */
  /*
    THE CONTROLS, AND THE LIMIT THEY ESTABLISHED — kept in the run rather than
    deleted, because the finding is the limit.

    The clear-skinned specimen scores AS HIGH as the densest freckled frame, so
    **this counter cannot answer "is this face freckled" in absolute terms**: on
    a different person it is counting pores and fine lines as readily as
    pigment. What it can do is ORDER FOUR FRAMES OF ONE FACE, because her own
    texture, pose and lighting are constant across them and cancel — which is
    the only comparison anything above actually makes.
  */
  { name: "neg CONTROL — a DIFFERENT clear-skinned face", file: "output/masked/specimens/fresh-02.png" },
  { name: "pos CONTROL — heavily freckled redhead", file: "output/walk/run-11/05-delivered.png" },
];

/**
 * How much darker than local skin a speck has to be, in mean levels.
 *
 * `CHANGE_AMPLITUDE.marks` — the SURFACE band, whose basis is measured on this
 * exact thing (*"freckles read at >4 and vanish at >25"*). Taken from the
 * registry rather than picked here, because a measurement constant invented at
 * the bench is the shape this program keeps finding on the paid path.
 */
const DARKER_BY = CHANGE_AMPLITUDE.marks.levels;
/** A freckle's plausible area in pixels at this resolution. Bigger is a mole,
 *  a nostril or a shadow; smaller is sensor noise. */
const MIN_AREA = 3;
const MAX_AREA = 120;

type Patch = { left: number; top: number; width: number; height: number };

/**
 * HER CHEEKS AND NOSE, PLACED FROM HER EYES — not from a fraction of a box.
 *
 * The first version took a band at 46-68% of the face box and landed squarely on
 * her MOUTH, so the first four numbers counted her lips and chin. The script's
 * own instruction — *look at the patches before believing the numbers* — is what
 * caught it, on the first patch opened.
 *
 * A fraction of a box assumes where a face sits in it. Her eyes do not: they are
 * the same anchor `additionDestination` uses to place an earring, read from the
 * picture, and the cheeks are directly beneath them.
 */
async function cheekBand(file: string): Promise<Patch | null> {
  const bytes = readFileSync(file);
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
  const eyes = await reader.landmark({ image: bytes, name: "eyes" }).catch(() => []);
  if (eyes.length === 0) return null;
  const eyeY = (eyes.reduce((sum, point) => sum + point.y, 0) / eyes.length) * region.height;
  const faceWidth = maxX - minX;
  const faceHeight = maxY - minY;
  /* From a little below the eyes, down a fifth of her face: the cheek-and-nose
     band, clear of the eyes above and the mouth below. */
  return {
    left: Math.round(minX + faceWidth * 0.10),
    top: Math.round(eyeY + faceHeight * 0.05),
    width: Math.round(faceWidth * 0.80),
    height: Math.round(faceHeight * 0.20),
  };
}

/** Specks darker than their own neighbourhood, of freckle size. */
async function countSpecks(file: string, patch: Patch, save: string): Promise<{
  specks: number; area: number; perThousand: number;
}> {
  const cropped = sharp(readFileSync(file)).extract(patch).greyscale();
  const raw = await cropped.clone().raw().toBuffer({ resolveWithObject: true });
  const blurred = await cropped.clone().blur(6).raw().toBuffer({ resolveWithObject: true });
  await sharp(readFileSync(file)).extract(patch).png().toFile(save);

  const { width, height } = raw.info;
  const dark = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (blurred.data[pixel]! - raw.data[pixel]! >= DARKER_BY) dark[pixel] = 1;
  }

  /* Connected components, so a speck is counted once and a shadow is not
     counted at all — it is too big to be a freckle and says so by its area. */
  const seen = new Uint8Array(width * height);
  let specks = 0;
  for (let start = 0; start < width * height; start += 1) {
    if (!dark[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let area = 0;
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      area += 1;
      const x = pixel % width;
      const y = (pixel - x) / width;
      for (const neighbour of [
        x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1, y < height - 1 ? pixel + width : -1,
      ]) {
        if (neighbour < 0 || seen[neighbour] || !dark[neighbour]) continue;
        seen[neighbour] = 1;
        stack.push(neighbour);
      }
    }
    if (area >= MIN_AREA && area <= MAX_AREA) specks += 1;
  }
  const area = width * height;
  return { specks, area, perThousand: (specks / area) * 1000 };
}

const rows: Record<string, unknown>[] = [];
console.log("frame                              patch px    specks   per 1000px");
console.log("-".repeat(72));
for (const frame of FRAMES) {
  const patch = await cheekBand(frame.file);
  if (!patch) { console.log(`${frame.name.padEnd(34)} NO FACE READ`); continue; }
  const save = `${OUT}/PATCH-${frame.name.slice(0, 2)}.png`;
  const result = await countSpecks(frame.file, patch, save);
  console.log(`${frame.name.padEnd(34)} ${String(result.area).padStart(8)}`
    + `${String(result.specks).padStart(10)}   ${result.perThousand.toFixed(2)}`);
  rows.push({ frame: frame.name, file: frame.file, patch, ...result, saved: save });
}
writeFileSync(`${OUT}/freckle-density.json`, `${JSON.stringify({ rows }, null, 2)}\n`);
console.log(`\npatches written to ${OUT} — look at them before believing the numbers`);
