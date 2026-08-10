/**
 * WHERE THE TEXTURE IS LOST — raw paint against our own composite, same crop.
 *
 * The five-minute check answered both of pass 2's questions, and it answered
 * them the other way round from the hypotheses:
 *
 *   THE HEM      is NOT in the paint. The painter's raw output ends in scattered
 *                tapering strands — good ends, better than the brief asked for.
 *   THE BLOB     is NOT in the paint either. The painter's raw afro has
 *                individual coils standing proud of the outline with gaps
 *                between them.
 *
 * And the zone cannot be authoring anything, because **the painter is never sent
 * the zone.** The standing rider is full-frame context with local harvest: the
 * model gets the master and a sentence, and returns a whole frame. There is no
 * canvas for an inpainting model to complete inside, so the box-authored
 * mechanism is unreachable on this dispatch shape. (It would become reachable
 * the day we start sending masks to the model, which is worth remembering.)
 *
 * So if the texture is in the paint and not in the picture, **we are removing
 * it**, and this locates where. The suspect is named and specific:
 *
 *   `harvestMatteFrom` = intersect(dilate(SAM 3 hair), BiRefNet subject matte)
 *
 * Over BACKGROUND that composition works, because the subject matte ramps at the
 * silhouette and the tip taper can read that ramp as confidence. Over the
 * SUBJECT'S OWN BODY it cannot: BiRefNet is uniformly opaque across her shirt, so
 * a fine strand lying on fabric has no ramp to be recognised by, and the taper's
 * ramp-ness guard — the thing that stops it bleeding onto a forehead — refuses it
 * for exactly the same reason. **The guard that makes the taper safe is the guard
 * that makes it useless where the hair-down case needs it.**
 *
 * This renders the three layers at one crop so the claim is checkable rather than
 * argued: the painter's raw output, the harvest matte over it, and what came out.
 *
 *   npx tsx scripts/calibration/where-it-is-lost.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { harvestMatteFrom, type Mask } from "../../server/castingV2/maskGeometry";
import { readRaster, type Raster } from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3 } from "./lib/segment.mts";

const OUT = "output/masked/diagnose";
mkdirSync(OUT, { recursive: true });

const CASES = [
  {
    name: "hem",
    master: "output/masked/specimens/wire-02.png",
    raw: "output/masked/fringe-fixture/hair-down-raw.png",
    composite: "output/masked/sticker-test/hair-down-C-shadow.png",
    crop: { left: 120, top: 1080, width: 784, height: 456 },
    over: "her shirt",
  },
  {
    name: "afro",
    master: "output/masked/specimens/wire-08.png",
    raw: "output/masked/max-delta/grow-raw.png",
    composite: "output/masked/sticker-test/afro-C-shadow.png",
    crop: { left: 620, top: 120, width: 380, height: 420 },
    over: "the wall",
  },
];

/** Paint the matte as a red wash over an image, so the cut line is visible. */
async function overlay(image: Buffer, matte: Mask, box: { left: number; top: number; width: number; height: number }): Promise<Buffer> {
  const base = await sharp(image).extract(box).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(base.data);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const alpha = matte.data[(y + box.top) * matte.width + (x + box.left)] / 255;
      const at = (y * box.width + x) * 3;
      out[at] = Math.round(out[at] * (1 - alpha) + 255 * alpha);
      out[at + 1] = Math.round(out[at + 1] * (1 - alpha * 0.85));
      out[at + 2] = Math.round(out[at + 2] * (1 - alpha * 0.85));
    }
  }
  return sharp(out, { raw: { width: box.width, height: box.height, channels: 3 } }).png().toBuffer();
}

const report: any[] = [];

for (const scenario of CASES) {
  console.log(`\n=== ${scenario.name} — the paint lies over ${scenario.over} ===`);
  const masterBytes = readFileSync(scenario.master);
  const master: Raster = await readRaster(masterBytes);
  const rawBytes = await sharp(readFileSync(scenario.raw))
    .resize(master.width, master.height, { fit: "fill" })
    .png()
    .toBuffer();

  const painted = await sam3(rawBytes, "hair");
  const matte = await birefnetMatte(rawBytes);
  const harvest = await harvestMatteFrom({ content: painted.all, matte, taperPx: 8 });

  /*
    THE MEASUREMENT THAT NAMES THE CAUSE. Inside the crop, how much of what the
    painter drew as hair does the harvest actually keep — and how opaque is the
    matte there? Over background the matte ramps and the taper works; over her
    own body it is flat 255 and the taper's ramp-ness guard refuses everything.
  */
  let paintedPixels = 0;
  let keptPixels = 0;
  let matteSum = 0;
  let ramped = 0;
  for (let y = scenario.crop.top; y < scenario.crop.top + scenario.crop.height; y += 1) {
    for (let x = scenario.crop.left; x < scenario.crop.left + scenario.crop.width; x += 1) {
      const pixel = y * master.width + x;
      if (painted.all.data[pixel] <= 128) continue;
      paintedPixels += 1;
      if (harvest.data[pixel] > 128) keptPixels += 1;
      matteSum += matte.data[pixel];
      if (matte.data[pixel] >= 26 && matte.data[pixel] <= 229) ramped += 1;
    }
  }
  const meanMatte = paintedPixels ? matteSum / paintedPixels : 0;
  const rampShare = paintedPixels ? ramped / paintedPixels : 0;
  console.log(`  painter drew ${paintedPixels.toLocaleString()} hair px in this crop; the harvest kept ${keptPixels.toLocaleString()}`);
  console.log(`  the subject matte over those pixels: mean ${meanMatte.toFixed(0)}/255, ramp share ${(rampShare * 100).toFixed(1)}%`);
  console.log(
    rampShare < 0.1
      ? "  -> the matte is FLAT here. It carries no confidence about strands, so the tip\n"
        + "     taper's ramp-ness guard refuses every one of them. This is where the texture dies."
      : "  -> the matte ramps here, so the taper has something to read.",
  );

  const cells = [
    await sharp(rawBytes).extract(scenario.crop).png().toBuffer(),
    await overlay(rawBytes, harvest, scenario.crop),
    await sharp(readFileSync(scenario.composite)).extract(scenario.crop).png().toBuffer(),
  ];
  await sharp({
    create: { width: scenario.crop.width, height: scenario.crop.height * 3 + 16, channels: 3, background: "#0A0A0A" },
  })
    .composite(cells.map((input, index) => ({ input, left: 0, top: index * (scenario.crop.height + 8) })))
    .png()
    .toFile(`${OUT}/LOST-${scenario.name}.png`);
  console.log(`  LOST-${scenario.name}.png — the painter's raw output / the harvest matte over it / what shipped`);

  report.push({ case: scenario.name, over: scenario.over, paintedPixels, keptPixels, meanMatte, rampShare });
}

writeFileSync(`${OUT}/lost.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
