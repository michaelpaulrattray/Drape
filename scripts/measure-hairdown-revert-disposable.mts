/**
 * HOW MUCH OF THE PAID EDIT COULD THE STORE EVEN KEEP? (fable-115, finding #4.)
 *
 * The adjudicator says the founder's hair-down edit was KEPT: 27,910 pixels,
 * byte-identical, on both later renders. His eyes say it reverted, and the
 * delivered frame agrees with his eyes. Both readings are correct, and the gap
 * between them is the finding — so it gets a number rather than a paragraph.
 *
 * The measurement, on artifacts only:
 *
 *   DELIVERED   pixels where the hair-down render differs from the master.
 *               That is what she paid for, whatever region it landed in.
 *   KEPT        of those, how many the segment's mask covers — the most the
 *               store could ever paste back.
 *   SURVIVING   of those delivered pixels, how many are still byte-identical
 *               on the next render, which is what permanence actually meant.
 *
 * A pixel-difference threshold is used for DELIVERED because a re-encode moves
 * quiet pixels by a unit or two; SURVIVING is exact equality, because a carried
 * fact is judged by bytes (fable-109) and a tolerance there would launder the
 * very thing being measured.
 *
 *   npx tsx scripts/measure-hairdown-revert-disposable.mts
 */
import { fetchImageBytes } from "./lib/imageBytes.mts";

const BASE = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";

/* Rows from `casting_candidates`, `casting_candidate_variants` and
   `casting_segments`, pulled 2026-08-09 and pasted here so this measurement
   depends on no live database. */
const MASTER = "casting-v2/candidates/09c90f57-e39c-4204-8636-9c280f89000e.png";
const HAIR_DOWN = "casting-v2/variants/ac05f409-9734-4cd6-8a04-f7e360bfb5e6.png";  /* v163 */
const EARRINGS = "casting-v2/variants/af6e6f4b-2155-4e62-8c39-353a97cf0a90.png";   /* v164 */
const SEGMENT_MASK = "casting-v2/segments/48daf590-7252-4d0e-9fe0-43e2ab55d058-mask.png";
const SEGMENT_BBOX = { x: 325, y: 194, w: 364, h: 467 };

/** A re-encode's floor. Anything at or below this is not a change anyone made. */
const NOISE = 8;

const sharp = (await import("sharp")).default;

async function raster(key: string): Promise<{ data: Buffer; width: number; height: number }> {
  const fetched = await fetchImageBytes(`${BASE}/${key}`);
  const image = sharp(fetched.bytes).ensureAlpha().raw();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const master = await raster(MASTER);
const down = await raster(HAIR_DOWN);
const earrings = await raster(EARRINGS);
const maskRaster = await raster(SEGMENT_MASK);

console.log(`master   ${master.width}x${master.height}`);
console.log(`v163     ${down.width}x${down.height}   "she wear her hair down"`);
console.log(`v164     ${earrings.width}x${earrings.height}   "dangly cross earrings"`);
console.log(`mask     ${maskRaster.width}x${maskRaster.height}   at ${SEGMENT_BBOX.x},${SEGMENT_BBOX.y}\n`);

/**
 * The segment mask as a frame-sized predicate.
 *
 * The stored mask is the bbox crop, so it is placed back at the bbox origin —
 * reading it as if it were frame-sized would score the whole measurement
 * against a mask shifted into her forehead.
 */
const inMask = new Uint8Array(down.width * down.height);
let maskPixels = 0;
for (let y = 0; y < maskRaster.height; y += 1) {
  for (let x = 0; x < maskRaster.width; x += 1) {
    const value = maskRaster.data[(y * maskRaster.width + x) * 4]!;
    if (value < 128) continue;
    const frameX = SEGMENT_BBOX.x + x;
    const frameY = SEGMENT_BBOX.y + y;
    if (frameX >= down.width || frameY >= down.height) continue;
    inMask[frameY * down.width + frameX] = 1;
    maskPixels += 1;
  }
}

let delivered = 0;
let deliveredInMask = 0;
let deliveredOutsideMask = 0;
let survivingExact = 0;
let survivingOutsideMask = 0;
let revertedToMaster = 0;

for (let index = 0; index < down.width * down.height; index += 1) {
  const offset = index * 4;
  const changed = Math.max(
    Math.abs(down.data[offset]! - master.data[offset]!),
    Math.abs(down.data[offset + 1]! - master.data[offset + 1]!),
    Math.abs(down.data[offset + 2]! - master.data[offset + 2]!),
  );
  if (changed <= NOISE) continue;
  delivered += 1;
  const covered = inMask[index] === 1;
  if (covered) deliveredInMask += 1; else deliveredOutsideMask += 1;

  const identical = down.data[offset] === earrings.data[offset]
    && down.data[offset + 1] === earrings.data[offset + 1]
    && down.data[offset + 2] === earrings.data[offset + 2];
  if (identical) {
    survivingExact += 1;
    if (!covered) survivingOutsideMask += 1;
  } else {
    /* Did the later render put the MASTER's pixel back? That is the revert,
       distinguished from "changed to some third thing". */
    const backToMaster = Math.max(
      Math.abs(earrings.data[offset]! - master.data[offset]!),
      Math.abs(earrings.data[offset + 1]! - master.data[offset + 1]!),
      Math.abs(earrings.data[offset + 2]! - master.data[offset + 2]!),
    );
    if (backToMaster <= NOISE) revertedToMaster += 1;
  }
}

const percent = (part: number, whole: number) => whole === 0 ? "—" : `${((part / whole) * 100).toFixed(1)}%`;

console.log(`DELIVERED   ${delivered.toLocaleString()} px changed by the paid hair-down edit`);
console.log(`  inside the kept segment's mask   ${deliveredInMask.toLocaleString()}  ${percent(deliveredInMask, delivered)}`);
console.log(`  OUTSIDE it                       ${deliveredOutsideMask.toLocaleString()}  ${percent(deliveredOutsideMask, delivered)}`);
console.log(`\nthe mask covers ${maskPixels.toLocaleString()} px in total`);
console.log(`\nSURVIVING on the next render (byte-identical)`);
console.log(`  of everything delivered          ${survivingExact.toLocaleString()}  ${percent(survivingExact, delivered)}`);
console.log(`  of what the mask did NOT cover   ${survivingOutsideMask.toLocaleString()}  ${percent(survivingOutsideMask, deliveredOutsideMask)}`);
console.log(`\nREVERTED to the master's own pixel  ${revertedToMaster.toLocaleString()}  ${percent(revertedToMaster, delivered)}`);
console.log(
  "\nThe store kept what it was given to keep. What it was given is the master's own hair\n"
  + "region — and an arrangement change lives mostly outside it.",
);
