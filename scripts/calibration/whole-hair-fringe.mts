/**
 * THE WHOLE-HAIR FRINGE — the founder's redesign, and it re-scopes the edit.
 *
 * Every previous fringe attempt scoped the zone to the FOREHEAD PATCH and asked
 * the painter to conjure strands into a canvas of skin. That is appliqué by
 * construction, and it produced exactly what appliqué produces: sparse wisps
 * sitting on repainted forehead. Three rounds of gating chased the symptom.
 *
 * The founder's correction: **a fringe is not an applied object, it is a CUT
 * CHANGE, and it renders as a whole-hair edit.** *"Select the whole hair and
 * change the cut — same cut, but add a fringe."*
 *
 * So two things move, and they move together:
 *
 *   ZONE         the full hair composition, plus the forehead allowance the new
 *                cut needs. Not the delta's patch.
 *   INSTRUCTION  the complete style described whole — *the same bun with soft
 *                tendrils, now cut with a wispy fringe* — hairdressing, not
 *                strand-conjuring.
 *
 * # Why this should behave differently, stated before the run
 *
 * A painter rendering a STYLE makes real coverage decisions: density, fall,
 * texture and light that belong to one mass. A painter filling a skin box makes
 * gaps, because it is decorating a region rather than cutting hair. The expected
 * gains are coherence and natural density; the prediction is recorded here so the
 * result can contradict it.
 *
 * **Honest residual, expected:** strand-gap ambiguity at the fringe's own edge
 * may survive at some scale. A pixel of skin shadowed by a fringe and a pixel of
 * translucent strand over skin are the same direction in colour space, so no
 * gate can separate them — that is what the hair-matting shop is queued for.
 *
 * # Both engines, because the hair row is still empty
 *
 * The bake-off was eye-region only; which painter renders hair best has never
 * been measured. This doubles as that row's coherence test. FLUX is excluded by
 * standing ruling — a cut change is a silhouette change.
 *
 *   npx tsx scripts/calibration/whole-hair-fringe.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  coverage,
  dilateMask,
  expandUntilClear,
  harvestMatteFrom,
  intersectMask,
  subtractMask,
  unionMasks,
} from "../../server/castingV2/maskGeometry";
import {
  adoptInteraction,
  compositeMasked,
  differenceMatte,
  harvestGate,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type Mask,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { runFalImageJob } from "../../server/providers/falTransport";
import { FAL_GPT_IMAGE_2_EDIT } from "../../server/providers/falImages";
import { DEFAULT_IDENTITY_EDIT_MODEL } from "../../server/providers/falQueue";
import { birefnetMatte, sam3 } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("FAL_KEY required");

const OUT = "output/masked/whole-hair";
mkdirSync(OUT, { recursive: true });

const MASTER = "output/masked/specimens/wire-02.png";

/**
 * THE STYLE, DESCRIBED WHOLE. Her current cut is named so the painter is
 * restyling something it can see rather than inventing a fringe from nothing —
 * and the fringe arrives as a property of that style, not as an object placed on
 * her forehead.
 */
const INSTRUCTION =
  "Restyle her hair as a whole: the same dark brown hair worn up in a loose, "
  + "slightly messy bun with soft tendrils falling at the temples — now cut with "
  + "a soft wispy fringe across her forehead, the fringe belonging to the same "
  + "head of hair, with the same texture, density and lighting. "
  + "Keep her face, skin, identity, expression, glasses, pose, clothing and the "
  + "plain studio background exactly as they are.";

const ENGINES = [
  {
    id: "gpt2",
    endpoint: FAL_GPT_IMAGE_2_EDIT,
    body: (uri: string) => ({
      prompt: INSTRUCTION, image_urls: [uri], num_images: 1, quality: "high", output_format: "png",
    }),
  },
  {
    id: "nbp",
    endpoint: DEFAULT_IDENTITY_EDIT_MODEL,
    body: (uri: string) => ({
      prompt: INSTRUCTION, image_urls: [uri], num_images: 1,
      resolution: "2K", aspect_ratio: "2:3", output_format: "png",
    }),
  },
];

const masterBytes = readFileSync(MASTER);
const master: Raster = await readRaster(masterBytes);
const masterUri = `data:image/png;base64,${masterBytes.toString("base64")}`;

console.log("segmenting the master…");
const hair = await sam3(masterBytes, "hair");
const faceSkin = await sam3(masterBytes, "face skin");
const eyewear = await sam3(masterBytes, "eyeglasses");
const subject = await birefnetMatte(masterBytes);

/*
  THE ZONE FOLLOWS THE FACET, NOT THE DELTA. A cut change takes the whole hair
  composition — every pixel of the style being restyled — plus the forehead
  allowance the new cut needs to occupy. Scoping this to the forehead patch is
  what made the last three rounds appliqué.
*/
let brow = master.height;
for (let pixel = 0; pixel < eyewear.all.data.length; pixel += 1) {
  if (eyewear.all.data[pixel] === 0) continue;
  const y = Math.floor(pixel / master.width);
  if (y < brow) brow = y;
}
const foreheadAllowance: Mask = {
  data: Buffer.from(faceSkin.all.data.map((value, index) => (Math.floor(index / master.width) < brow ? value : 0))),
  width: master.width,
  height: master.height,
};
const zone = unionMasks(await dilateMask(hair.all, 48), foreheadAllowance);
console.log(`zone ${(coverage(zone) * 100).toFixed(2)}% — the whole hair composition plus the forehead allowance`);
console.log(`  (the forehead allowance alone is ${(coverage(foreheadAllowance) * 100).toFixed(2)}%)\n`);

const report: any[] = [];
for (const engine of ENGINES) {
  console.log(`=== ${engine.id} ===`);
  const started = Date.now();
  const job = await runFalImageJob({
    apiKey, endpoint: engine.endpoint, body: engine.body(masterUri),
    timeoutMs: 300_000, pollIntervalMs: 1_500,
  });
  const meta = await sharp(job.bytes).metadata();
  const patchBytes = meta.width === master.width && meta.height === master.height
    ? job.bytes
    : await sharp(job.bytes).resize(master.width, master.height, { fit: "fill" }).png().toBuffer();
  const patch: Raster = await readRaster(patchBytes);
  writeFileSync(`${OUT}/${engine.id}-raw.png`, patchBytes);
  console.log(`  returned ${meta.width}x${meta.height} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  /*
    THE COMPLIANCE QUESTION, asked of every engine and recorded as routing data:
    the instruction says leave her skin alone. Measured on the forehead BELOW the
    brow line — territory no fringe can legitimately reach.
  */
  const untouchable = subtractMask(faceSkin.all, foreheadAllowance);
  let complianceMoved = 0;
  let compliancePixels = 0;
  let complianceSum = 0;
  for (let pixel = 0; pixel < untouchable.data.length; pixel += 1) {
    if (untouchable.data[pixel] === 0) continue;
    compliancePixels += 1;
    const at = pixel * 3;
    const delta = (Math.abs(patch.data[at] - master.data[at])
      + Math.abs(patch.data[at + 1] - master.data[at + 1])
      + Math.abs(patch.data[at + 2] - master.data[at + 2])) / 3;
    complianceSum += delta;
    if (delta > 12) complianceMoved += 1;
  }
  console.log(`  compliance: repainted ${complianceMoved.toLocaleString()} of ${compliancePixels.toLocaleString()} px of face it was told not to touch`
    + `  (mean ${(complianceSum / compliancePixels).toFixed(1)} levels)`);

  /* ---- the shipped pipeline, unchanged ---- */
  const patchSubject = await birefnetMatte(patchBytes);
  const patchHair = await sam3(patchBytes, "hair");
  const tapered = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject, taperPx: 8 });
  const dm = differenceMatte({ master, patch, confirmed: tapered, reachPx: 40 });
  const withStrands: Mask = {
    data: Buffer.from(tapered.data.map((value, index) => Math.max(value, dm.alpha.data[index]))),
    width: master.width, height: master.height,
  };
  const far: number[] = [];
  const painted: Mask = { data: Buffer.alloc(master.width * master.height, 0), width: master.width, height: master.height };
  for (let pixel = 0; pixel < painted.data.length; pixel += 1) {
    const at = pixel * 3;
    const delta = (Math.abs(patch.data[at] - master.data[at])
      + Math.abs(patch.data[at + 1] - master.data[at + 1])
      + Math.abs(patch.data[at + 2] - master.data[at + 2])) / 3;
    if (delta > 25) painted.data[pixel] = 255;
    if (tapered.data[pixel] === 0 && pixel % 37 === 0) far.push(delta);
  }
  far.sort((a, b) => a - b);
  const baselineDelta = far[Math.floor(far.length / 2)] ?? 0;

  for (const [label, base] of [["C", tapered], ["D", withStrands]] as const) {
    const gated = harvestGate({ master, patch, alpha: base, strandColour: dm.strandColour, baselineDelta }).alpha;
    const grown = await expandUntilClear({ painted, zone, stepPx: 48, effective: gated, maxCoverage: 0.6 });
    const adopted = adoptInteraction({ master, patch, harvest: gated, bandPx: 14, mode: "shadow" });
    const composed = await compositeMasked({
      master, patch: adopted.patch, mask: grown.zone, edgeMatte: adopted.alpha, featherRadius: 4,
    });
    const file = `${OUT}/${engine.id}-${label}.png`;
    writeFileSync(file, await writePng(composed.composite));
    const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
    const diff = await differenceView(masterBytes, readFileSync(file), { gain: 6 });
    writeFileSync(`${OUT}/DIFF-${engine.id}-${label}.png`, diff.panel);
    console.log(`  ${label}: frame moved ${(diff.changedShare * 100).toFixed(2)}%   byte-identity outside ${outside.identical}`);
  }

  report.push({
    engine: engine.id,
    compliance: { repainted: complianceMoved, of: compliancePixels, meanLevels: complianceSum / compliancePixels },
  });
}

/* Full-extent crops — the frame's top IS the crop's top, so nothing can be
   cut off by a boundary of mine again. */
const box = { left: 120, top: 0, width: 784, height: 620 };
const cells: Buffer[] = [await sharp(masterBytes).extract(box).png().toBuffer()];
for (const engine of ENGINES) {
  for (const file of [`${engine.id}-raw`, `${engine.id}-C`, `${engine.id}-D`]) {
    cells.push(await sharp(readFileSync(`${OUT}/${file}.png`)).extract(box).png().toBuffer());
  }
}
await sharp({
  create: { width: box.width, height: box.height * cells.length + 8 * (cells.length - 1), channels: 3, background: "#0A0A0A" },
})
  .composite(cells.map((input, index) => ({ input, left: 0, top: index * (box.height + 8) })))
  .png()
  .toFile(`${OUT}/WHOLE-HAIR.png`);
console.log("\nWHOLE-HAIR.png — master / gpt2 raw / gpt2 C / gpt2 D / nbp raw / nbp C / nbp D, 100%");

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ instruction: INSTRUCTION, zoneCoverage: coverage(zone), engines: report }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
