/**
 * THE TWO CANDIDATE CARRIERS, CUT AND LOOKED AT BEFORE ANY RENDER IS BOUGHT —
 * the artifact half of the carrier measurement (§9.10, ordered fable-1090 §3,
 * ratified again fable-1091 §3).
 *
 * # Why this exists as its own step
 *
 * The carrier question — does a two-view sheet ride, or does one panel — is a
 * HYPOTHESIS, and the shape it re-proposes was convicted in another lane (the
 * wrap court: one neck tattoo arrived as TWO from a multi-view sheet). The wrap
 * court's own method is to **scope the arms at the artifact first**, so the two
 * carriers are built and looked at before a single render is paid for. A sheet
 * that is visibly wrong as a picture never needs a render to convict it.
 *
 * ```
 *   ARM A   the two-view sheet     both panels' hair, one carrier
 *   ARM B   the largest panel      the control
 * ```
 *
 * # It splits FIRST, and that is the repair rather than a convenience
 *
 * Asked *where is the hair* on the whole composite, the segmenter returns ONE
 * panel and says nothing about the other — measured, and the box proved to be
 * the top panel alone (`probe-panel-discriminator-disposable.mts`). So the frame
 * is cut at its seam first and each panel is asked its own question: both heads
 * are read deliberately, and neither is chosen for the customer by a model.
 *
 * # The cutout is the region, never a rectangle
 *
 * The mask is the alpha channel and the box is the mask's own bounds, so what
 * comes out is the hair's own shape. A rectangle containing a face is the
 * fidelity law's named violation, and `crop-holds-the-region-it-depicts` is why
 * it matters here specifically: a carrier pins what it PICTURES.
 *
 * **This is not the production cutter.** The real road is `referenceMint`'s, and
 * this is a probe standing in for it so the carrier question can be answered
 * before the crop road is shaped around an answer nobody has.
 *
 * # Money
 *
 * Two segmenter calls — one per panel — on the house. No render, no credit, no
 * database, no bucket.
 *
 *   npx tsx scripts/build-panel-carriers-disposable.mts
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { boxOf, componentsOf, maskOf } from "./lib/shapeOnFace.mts";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY — the segmenter is the instrument here");

const OUT = path.resolve("output/panel-probe");
await mkdir(OUT, { recursive: true });

const SPECIMEN = "docs/specs/references/build-two-founder-specimens/hair-style-dark-waves-two-panel.png";

/** Measured by the seam scan; quoted rather than re-derived here. */
const SEAM_Y = 661;

/** The gutter the sheet puts between two views, in pixels. */
const GUTTER = 24;

const source = await readFile(SPECIMEN);
const meta = await sharp(source).metadata();
if (!meta.width || !meta.height) throw new Error("the specimen has no dimensions");
console.log(`${SPECIMEN} — ${meta.width}x${meta.height}, seam at y=${SEAM_Y}`);

const PANELS = [
  { name: "top", left: 0, top: 0, width: meta.width, height: SEAM_Y },
  { name: "bottom", left: 0, top: SEAM_Y + 1, width: meta.width, height: meta.height - SEAM_Y - 1 },
];

const reader = createFalRegionReader({ apiKey });

type Cut = { name: string; bytes: Buffer; width: number; height: number; pixels: number };
const cuts: Cut[] = [];

for (const panel of PANELS) {
  const panelBytes = await sharp(source).extract(panel).png().toBuffer();
  const mask = await reader.region({ image: panelBytes, name: "hair" });
  const loaded = maskOf({ data: mask.data, info: { width: mask.width, height: mask.height } });
  if (!loaded) {
    console.log(`  ${panel.name}: NO MASK — a no-read, not a zero. This panel carries nothing.`);
    continue;
  }
  /* The mask itself, written before anything is cut from it — the carrier is
     judged by eye and so is the thing that shaped it. */
  await writeFile(
    path.join(OUT, `carrier-${panel.name}-hairmask.png`),
    await sharp(loaded.data, {
      raw: { width: loaded.width, height: loaded.height, channels: 1 },
    }).png().toBuffer(),
  );
  const { kept, sizes } = componentsOf(loaded, 400);
  console.log(`  ${panel.name}: hair ${kept.length} component(s) — sizes ${sizes.slice(0, 4).join(", ")}`);
  if (kept.length === 0) continue;

  /*
    THE WHOLE HAIR REGION, not the largest component — within ONE head, every
    component is her hair (a fringe separated from the lengths by a face is two
    components of one haircut), and dropping the smaller ones would be the
    silent pick this build exists to stop, one level down.
  */
  const box = boxOf(loaded, 0);
  const alpha = await sharp(loaded.data, {
    raw: { width: loaded.width, height: loaded.height, channels: 1 },
  })
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    /*
      RAW, AND READ WITH ITS OWN CHANNEL COUNT — sharp PROMOTES a one-channel
      raw input to three on the way out, so a buffer indexed as if it were still
      greyscale is read every third byte and the alpha comes out smeared. That
      is what produced a "hair" cutout containing the whole face: 149,454 opaque
      pixels for a mask holding 99,237.
    */
    .raw()
    .toBuffer({ resolveWithObject: true });
  const content = await sharp(panelBytes)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  /*
    `removeAlpha` FIRST, and it is not tidiness — `joinChannel` APPENDS.

    The first version wrote `ensureAlpha().joinChannel(...)`, which produces a
    five-channel image whose fourth channel is still the opaque one sharp had
    just added: the mask rode along as a fifth channel nothing reads, and the
    cutout came out fully opaque — **the man's whole face, in a carrier that is
    supposed to hold hair.**

    I nearly reported that as a finding about the segmenter. Its mask was clean
    (`style-hair-mask.png` — hair, no face), so the defect was mine, and the
    only reason it was caught is that the artifact was LOOKED at before the
    verdict was written. Verify the instrument before believing its finding.
  */
  /*
    THE ALPHA IS INTERLEAVED BY HAND, and the two library idioms that should
    have done it are why.

    `ensureAlpha().joinChannel(mask)` APPENDS — it produces a five-channel image
    whose fourth channel is still the opaque one sharp had just added, so the
    mask rides along as a channel nothing reads. `removeAlpha().joinChannel()`
    then produced a **three-channel** PNG: `hasAlpha false`, 203096 opaque
    pixels of 203096. Both silently returned the man's whole FACE in a carrier
    that is supposed to hold hair.

    I twice nearly filed that as a finding about the segmenter. Its mask was
    clean both times — written out and looked at — so the defect was mine, and
    the only reason it was caught before a verdict was written is that the
    artifact went in front of eyes rather than into a report. **Verify the
    instrument before believing its finding**, and prefer the boring loop to the
    clever call when the clever call can fail quietly.
  */
  const cutout = await (async () => {
    const rgba = Buffer.alloc(box.w * box.h * 4);
    for (let index = 0; index < box.w * box.h; index += 1) {
      rgba[index * 4] = content.data[index * content.info.channels];
      rgba[index * 4 + 1] = content.data[index * content.info.channels + 1];
      rgba[index * 4 + 2] = content.data[index * content.info.channels + 2];
      rgba[index * 4 + 3] = alpha.data[index * alpha.info.channels];
    }
    return sharp(rgba, { raw: { width: box.w, height: box.h, channels: 4 } }).png().toBuffer();
  })();

  await writeFile(path.join(OUT, `carrier-panel-${panel.name}.png`), cutout);
  console.log(`      box ${box.w}x${box.h} at (${box.x}, ${box.y})  ${loaded.pixels}px of hair`);
  cuts.push({ name: panel.name, bytes: cutout, width: box.w, height: box.h, pixels: loaded.pixels });
}

if (cuts.length === 0) throw new Error("no panel produced a cut — nothing to compare");

/* ------------------------------------------------------------------ ARM B */

const largest = [...cuts].sort((a, b) => b.pixels - a.pixels)[0];
await writeFile(path.join(OUT, "carrier-armB-largest-panel.png"), largest.bytes);
console.log(`\nARM B — the largest panel: ${largest.name}, ${largest.width}x${largest.height}, ${largest.pixels}px`);

/* ------------------------------------------------------------------ ARM A */

if (cuts.length < 2) {
  console.log("ARM A — not buildable: only one panel produced a cut. The sheet arm cannot run.");
} else {
  /* Side by side rather than stacked: the source was stacked, and a sheet that
     repeats the source's own layout cannot be told apart from the source in the
     render — the arm would be measuring nothing. */
  const height = Math.max(...cuts.map((cut) => cut.height));
  const width = cuts.reduce((sum, cut) => sum + cut.width, 0) + GUTTER * (cuts.length - 1);
  let left = 0;
  const layers = cuts.map((cut) => {
    const at = { input: cut.bytes, left, top: Math.round((height - cut.height) / 2) };
    left += cut.width + GUTTER;
    return at;
  });
  const sheet = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(layers).png().toBuffer();
  await writeFile(path.join(OUT, "carrier-armA-two-view-sheet.png"), sheet);
  console.log(`ARM A — the two-view sheet: ${width}x${height}, ${cuts.length} views side by side`);
}

console.log(`\nartifacts in ${OUT}. LOOK AT THEM before any render is bought — a sheet that is`);
console.log("wrong as a picture never needed a render to convict it.");
process.exit(0);
