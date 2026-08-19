/**
 * A CARRIER THAT PICTURES ITS OWN SCALE, WITHOUT PICTURING A PERSON — the
 * length court's scale arm (authorized fable-1093 §2a).
 *
 * # The gap it is built for
 *
 * The carrier court delivered one haircut on both arms and **lost the length on
 * both**: his reference is a mid-length cut covering the ears and reaching the
 * nape, and what arrived was a short crop with the ears bare. Same direction on
 * both arms, so it is not the carrier's SHAPE doing it.
 *
 * One candidate cause is that the carrier has no scale at all. It is a hair
 * silhouette on transparency — no head, no shoulders, nothing that says how long
 * this hair is relative to a face. A customer pointing at that photograph is
 * pointing at a LENGTH as much as at a shape.
 *
 * # THE CONTAINMENT BOUND IS THE DESIGN, not a test concession
 *
 * **No real face rides, ever, even in a probe** (fable-1093 §2a). Scale context
 * arrives as the head's REDACTED form: the head region minus the hair, filled
 * flat. What comes out is hair sitting on a blank form — it says *this much
 * head, this much hair* and nothing about whose head it was.
 *
 * That is the ink road's own answer arriving in hair's lane. A tattoo rides on a
 * grey mannequin because the mannequin pictures placement and scale while
 * picturing nobody; this is the same artifact for a haircut. If the court says
 * scale is what was missing, this shape is not a fixture — it is the carrier
 * design.
 *
 * # Money
 *
 * Two segmenter calls — head and hair on one panel — house money. No render, no
 * credit, no database, no bucket.
 *
 *   npx tsx scripts/build-scale-carrier-disposable.mts
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { boxOf, maskOf } from "./lib/shapeOnFace.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY — the segmenter is the instrument here");

const OUT = path.resolve("output/panel-probe");
await mkdir(OUT, { recursive: true });

const SPECIMEN = "docs/specs/references/build-two-founder-specimens/hair-style-dark-waves-two-panel.png";
/** The seam the scan measured; quoted rather than re-derived. */
const SEAM_Y = 661;

/**
 * The flat the redacted head is filled with.
 *
 * Mid grey rather than white or black: a white form would read as background on
 * a light frame and a black one would read as more hair, and both would change
 * what the carrier appears to picture. Neutral is the ink road's own choice for
 * a mannequin and for the same reason.
 */
const FORM = { r: 150, g: 150, b: 150 };

const source = await readFile(SPECIMEN);
const panel = await sharp(source)
  .extract({ left: 0, top: 0, width: (await sharp(source).metadata()).width!, height: SEAM_Y })
  .png()
  .toBuffer();

const reader = createFalRegionReader({ apiKey });

async function maskFor(name: string) {
  const mask = await reader.region({ image: panel, name });
  const loaded = maskOf({ data: mask.data, info: { width: mask.width, height: mask.height } });
  if (!loaded) throw new Error(`no ${name} mask — a no-read, not a zero`);
  return loaded;
}

const hair = await maskFor("hair");
/*
  THE SCALE REGION IS ASKED AS "face", NOT "head" — MEASURED, not preferred.

  Asked for `head` on this panel the segmenter returned 99,677px against the
  hair's 99,220px, and their union was 100,263: **the head answer IS the hair**,
  give or take a thousand pixels. A carrier built on it had 1,043px of redacted
  form and therefore no scale context at all — which would have been an arm that
  measured nothing while looking like it had run.

  So the region is named for the thing the scale actually comes from. It is
  overridable because the right noun is an empirical question about a reader and
  not a fact about hair.
*/
const SCALE_REGION = process.argv.includes("--region")
  ? process.argv[process.argv.indexOf("--region") + 1]
  : "face";
const head = await maskFor(SCALE_REGION);
console.log(`hair ${hair.pixels}px · ${SCALE_REGION} ${head.pixels}px  (panel ${hair.width}x${hair.height})`);
if (hair.width !== head.width || hair.height !== head.height) {
  throw new Error("the two masks are in different spaces — the wrong-frame class, refusing");
}

/* The carrier's extent is everything either mask covers, so a fringe hanging
   past the head outline is not cut off by the head's own bounds. */
const both = {
  data: Buffer.alloc(hair.data.length),
  width: hair.width,
  height: hair.height,
  pixels: 0,
  cx: 0,
  cy: 0,
};
for (let index = 0; index < both.data.length; index += 1) {
  both.data[index] = hair.data[index] !== 0 || head.data[index] !== 0 ? 255 : 0;
}
const union = maskOf({ data: both.data, info: { width: both.width, height: both.height } });
if (!union) throw new Error("the union is empty");
const box = boxOf(union, 0);
console.log(`union ${union.pixels}px  box ${box.w}x${box.h} at (${box.x}, ${box.y})`);

const content = await sharp(panel)
  .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

/* Every mask is cropped the same way and read by its own channel count — sharp
   promotes a one-channel raw input on the way out, which is how an earlier probe
   returned a whole face in a hair carrier three times running. */
async function cropped(mask: { data: Buffer; width: number; height: number }) {
  return sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .raw()
    .toBuffer({ resolveWithObject: true });
}

const hairCrop = await cropped(hair);
const headCrop = await cropped(head);

const rgba = Buffer.alloc(box.w * box.h * 4);
let formPixels = 0;
let hairPixels = 0;
for (let index = 0; index < box.w * box.h; index += 1) {
  const isHair = hairCrop.data[index * hairCrop.info.channels] !== 0;
  const isHead = headCrop.data[index * headCrop.info.channels] !== 0;
  const at = index * 4;
  if (isHair) {
    rgba[at] = content.data[index * content.info.channels];
    rgba[at + 1] = content.data[index * content.info.channels + 1];
    rgba[at + 2] = content.data[index * content.info.channels + 2];
    rgba[at + 3] = 255;
    hairPixels += 1;
  } else if (isHead) {
    /* THE REDACTION. Not a blur, not a pixelation, not a darkened face — a flat
       fill, so there is nothing of him left to recover and nothing for an engine
       to read as a feature. */
    rgba[at] = FORM.r;
    rgba[at + 1] = FORM.g;
    rgba[at + 2] = FORM.b;
    rgba[at + 3] = 255;
    formPixels += 1;
  } else {
    rgba[at + 3] = 0;
  }
}

const carrier = await sharp(rgba, { raw: { width: box.w, height: box.h, channels: 4 } })
  .png()
  .toBuffer();
const file = path.join(OUT, "carrier-scale-redacted-head.png");
await writeFile(file, carrier);

console.log(`\nscale carrier ${box.w}x${box.h} → ${file}`);
console.log(`  hair ${hairPixels}px · redacted form ${formPixels}px · transparent ${box.w * box.h - hairPixels - formPixels}px`);
console.log("\nLOOK AT IT before it rides: it must show hair on a blank form and NO face at all.");
process.exit(0);
