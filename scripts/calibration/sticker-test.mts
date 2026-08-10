/**
 * THE STICKER TEST — the founder's formal pass held the wall on one class.
 *
 * Three observations, one cause: *the fringe floats* (no contact shadow, no root
 * shading between strands); *the afro edge reads smoothed-out* (a matte-ramp edge
 * with no cast shadow on the wall); *the long hair's ends cut off straight and
 * lie on the shirt with zero shadowing.*
 *
 * The diagnosis: **the strict substance harvest discards the painter's
 * interaction pixels.** Contact shadows, occlusion darkening and translucent
 * tapers are not the object, so a harvest that keeps only confirmed object dies
 * on every one of them — and those are precisely the pixels that make a thing
 * belong to a photograph rather than sit on top of one. The founder's phrasing is
 * the brief: **allow room for the model to actually blend.**
 *
 * # Three modes, the same renders, the founder's eye deciding
 *
 *   A  SUBSTANCE   what shipped. The baseline to beat, kept honestly in the
 *                  comparison rather than assumed to lose.
 *   B  INTERACTION harvest, plus painter-delta pixels within a bounded band of
 *                  confirmed content. Distant repaint still dies; the object
 *                  keeps its consequences — and any colour the painter felt like
 *                  adding arrives with them.
 *   C  SHADOW      the same band, adopting only DARKENING as a multiply drawn
 *                  from the painter's luminance. Contact shadows without letting
 *                  it tint her shirt.
 *
 * **The tip taper is in all three**, including A, because it is a separate fix
 * for a separate observation and holding it back would confound the comparison.
 * A low-confidence strand end composites at its own matte value: 20% confident
 * renders at 20%.
 *
 * # What this costs, measured rather than waved through
 *
 * The band shrinks the byte-identical territory, and by how much is reported per
 * case. **Beyond the destination zone nothing moves at all** — that half of the
 * guarantee is untouched and is asserted on every render here. This is the
 * promise becoming accurate about where its boundary actually sits.
 *
 * # Nothing is generated
 *
 * All three renders are already on disk — the same pixels behind exhibits 15, 17
 * and 18, which are the founder's own before-references. A fresh render would
 * confound the modes with the model having a different day.
 *
 *   npx tsx scripts/calibration/sticker-test.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  coverage,
  dilateMask,
  harvestMatteFrom,
  placeDestinationZone,
  subtractMask,
  unionMasks,
} from "../../server/castingV2/maskGeometry";
import {
  adoptInteraction,
  compositeMasked,
  differenceMatte,
  featherMask,
  outsideMaskUnchanged,
  readRaster,
  writePng,
  type InteractionMode,
  type Mask,
  type Raster,
} from "../../server/castingV2/maskedComposite";
import { birefnetMatte, sam3, toMask } from "./lib/segment.mts";
import { differenceView } from "./lib/differenceView.mts";

const OUT = "output/masked/sticker-test";
mkdirSync(OUT, { recursive: true });

/** Low-confidence strand ends composite at their matte value, in every mode. */
const TAPER_PX = 8;
/** How far interaction may reach from confirmed content. */
const BAND_PX = 14;
/** How far strand tips may be recovered from confirmed content. */
const STRAND_REACH_PX = 40;
/** The composite's own feather radius — the zone's ramp reaches this far past it. */
const FEATHER = 4;

type Case = {
  name: string;
  reference: string;
  master: string;
  raw: string;
  /** The founder's own observation this case is the test of. */
  observation: string;
  /** Where to crop at 100% for the sticker test. */
  crop: { left: number; top: number; width: number; height: number };
  zone: "afro" | "grown";
};

const CASES: Case[] = [
  {
    name: "afro",
    reference: "EXHIBIT-15",
    master: "output/masked/specimens/wire-08.png",
    raw: "output/masked/max-delta/grow-raw.png",
    observation: "the afro edge reads smoothed-out — no cast shadow on the wall",
    crop: { left: 580, top: 340, width: 300, height: 400 },
    zone: "afro",
  },
  {
    name: "fringe",
    reference: "EXHIBIT-17",
    master: "output/masked/specimens/wire-02.png",
    raw: "output/masked/fringe-fixture/fringe-raw.png",
    observation: "the fringe floats — no contact shadow or root shading between strands",
    crop: { left: 262, top: 200, width: 500, height: 340 },
    zone: "grown",
  },
  {
    name: "hair-down",
    reference: "EXHIBIT-18",
    master: "output/masked/specimens/wire-02.png",
    raw: "output/masked/fringe-fixture/hair-down-raw.png",
    observation: "the ends cut off straight and lie on the shirt with zero shadowing",
    crop: { left: 180, top: 820, width: 664, height: 460 },
    zone: "grown",
  },
];

const MODES: { id: string; label: string; interaction: InteractionMode | null }[] = [
  { id: "A-substance", label: "strict substance harvest (what shipped)", interaction: null },
  { id: "B-interaction", label: "+ interaction band", interaction: "interaction" },
  { id: "C-shadow", label: "+ luminance-only shadow adoption", interaction: "shadow" },
  /*
    D — C, plus the strands the SHAPE was losing. Pass 2 found the hem and the
    blob are the SAM-class boundary transferred into the picture, not the
    painter. Difference matting recovers the real alpha over a background we
    already own exactly, so this is the same ratified shadow behaviour with the
    substance no longer cut to a confidence frontier.
  */
  { id: "D-strands", label: "C + difference-matted strands", interaction: "shadow" },
];

function pixelsIn(mask: Mask): number {
  let count = 0;
  for (let index = 0; index < mask.data.length; index += 1) if (mask.data[index] > 0) count += 1;
  return count;
}

const report: any[] = [];

for (const scenario of CASES) {
  console.log(`\n=== ${scenario.name} (${scenario.reference}) ===`);
  console.log(`  founder: "${scenario.observation}"`);

  const masterBytes = readFileSync(scenario.master);
  const master: Raster = await readRaster(masterBytes);
  const patchBytes = await sharp(readFileSync(scenario.raw))
    .resize(master.width, master.height, { fit: "fill" })
    .png()
    .toBuffer();
  const patch: Raster = await readRaster(patchBytes);

  /* ---- the zone, exactly as its own fixture built it ---- */
  const hair = await sam3(masterBytes, "hair");
  let zone: Mask;
  if (scenario.zone === "afro") {
    const face = await sam3(masterBytes, "face skin");
    const left = await sam3(masterBytes, "left ear");
    const right = await sam3(masterBytes, "right ear");
    const eyewear = await sam3(masterBytes, "eyeglasses");
    const lenses = await sam3(masterBytes, "eyeglass lenses");
    const subject = await birefnetMatte(masterBytes);
    zone = await placeDestinationZone({
      region: unionMasks(hair.all, await toMask(readFileSync("output/masked/max-delta/aligned-afro-zone.png"))),
      subject,
      reach: 24,
      skinMargin: 8,
      exclude: unionMasks(face.all, left.all, right.all, subtractMask(eyewear.all, lenses.all)),
    });
  } else {
    let grown = hair.all;
    for (let pass = 0; pass < (scenario.name === "hair-down" ? 11 : 1); pass += 1) {
      grown = await dilateMask(grown, 48);
    }
    zone = grown;
  }
  console.log(`  zone ${(coverage(zone) * 100).toFixed(2)}%`);

  /* ---- the harvest, tapered, shared by all three modes ---- */
  const patchSubject = await birefnetMatte(patchBytes);
  const patchHair = await sam3(patchBytes, "hair");
  const strict = await harvestMatteFrom({ content: patchHair.all, matte: patchSubject });
  const tapered = await harvestMatteFrom({
    content: patchHair.all, matte: patchSubject, taperPx: TAPER_PX,
  });
  const tipsRecovered = pixelsIn(tapered) - pixelsIn(strict);
  console.log(`  harvest ${(coverage(strict) * 100).toFixed(2)}% -> tapered ${(coverage(tapered) * 100).toFixed(2)}%`
    + `  (${tipsRecovered.toLocaleString()} strand-tip px recovered from the clip)`);

  const rows: any[] = [];
  for (const mode of MODES) {
    let alpha = tapered;
    let source = patch;
    let recovered = 0;
    if (mode.id === "D-strands") {
      /* The strand alpha the segmenter's boundary was throwing away. Unioned in
         BEFORE the interaction band, so shadows still ride on top of it. */
      const strands = differenceMatte({
        master, patch, confirmed: tapered, reachPx: STRAND_REACH_PX,
      });
      recovered = strands.recoveredPixels;
      alpha = unionMasks(tapered, strands.alpha);
    }
    let band = { bandPixels: 0, adoptedPixels: 0, baselineDelta: 0 };
    if (mode.interaction) {
      const adopted = adoptInteraction({
        master, patch, harvest: alpha, bandPx: BAND_PX, mode: mode.interaction,
      });
      alpha = adopted.alpha;
      source = adopted.patch;
      band = adopted;
    }
    const composed = await compositeMasked({
      master, patch: source, mask: zone, edgeMatte: alpha, featherRadius: FEATHER,
    });
    const file = `${OUT}/${scenario.name}-${mode.id}.png`;
    writeFileSync(file, await writePng(composed.composite));

    /*
      THE GUARANTEE, restated honestly. Beyond the zone nothing moves — that is
      asserted, not assumed. Inside it, the band is what the interaction cost,
      and it is reported rather than quietly absorbed.
    */
    const outside = outsideMaskUnchanged(master, composed.composite, composed.applied);
    /*
      "BEYOND THE ZONE" MEANS BEYOND THE FEATHER'S ACTUAL SUPPORT, and I drew
      this boundary wrong twice before getting it right.

      First against the HARD zone — the same mistake as `cropped-region-read.mts`,
      calling a designed blend a broken promise. Then against `dilate(zone, 6)`,
      which is still wrong for a subtler reason: **a gaussian's support is much
      wider than its radius.** `featherMask` blurs at sigma 4, so its ramp reaches
      roughly three sigma out, and a 6px dilation leaves a thin ring of
      legitimately-blended pixels outside the boundary I was asserting against.

      Both times the guard fired on MODE A, which changes nothing at all, and
      that is how I knew the guard was wrong rather than the composite. So the
      support is now COMPUTED — the nonzero set of the feathered zone — rather
      than estimated by something shaped like it. Estimating a boundary you can
      calculate is the approximation habit this program keeps catching.
    */
    const support = await featherMask(zone, FEATHER);
    const beyondZone: Mask = {
      data: Buffer.from(support.data.map((value) => (value === 0 ? 255 : 0))),
      width: zone.width,
      height: zone.height,
    };
    let beyondMoved = 0;
    for (let pixel = 0; pixel < beyondZone.data.length; pixel += 1) {
      if (beyondZone.data[pixel] === 0) continue;
      const at = pixel * 3;
      if (composed.composite.data[at] !== master.data[at]
        || composed.composite.data[at + 1] !== master.data[at + 1]
        || composed.composite.data[at + 2] !== master.data[at + 2]) beyondMoved += 1;
    }

    const diff = await differenceView(masterBytes, readFileSync(file), { gain: 6 });
    writeFileSync(`${OUT}/DIFF-${scenario.name}-${mode.id}.png`, diff.panel);

    console.log(
      `  ${mode.id.padEnd(14)} band ${String(band.bandPixels).padStart(7)} px, adopted `
      + `${String(band.adoptedPixels).padStart(6)}  (painter baseline ${band.baselineDelta.toFixed(1)} levels)`
      + `   beyond the zone: ${beyondMoved} px moved`
      + `   frame ${(diff.changedShare * 100).toFixed(2)}%`
      + (recovered ? `   strands recovered ${recovered.toLocaleString()} px` : ""),
    );
    if (beyondMoved !== 0) {
      throw new Error(`${scenario.name}/${mode.id} moved ${beyondMoved} px BEYOND the zone — the half of the guarantee that never bends`);
    }
    rows.push({
      mode: mode.id,
      label: mode.label,
      /* Scalars only — `band` also carries the alpha mask and the patch raster,
         and spreading those into a report turns it into a megabyte of buffer. */
      bandPixels: band.bandPixels,
      adoptedPixels: band.adoptedPixels,
      baselineDelta: band.baselineDelta,
      strandsRecovered: recovered,
      byteIdenticalOutsideApplied: outside.identical,
      blendBandPixels: outside.bandPixels,
      beyondZoneMoved: beyondMoved,
      frameMoved: diff.changedShare,
    });
  }

  /* ---- the founder's sticker test: master, three modes, at 100% ---- */
  const cells = [
    await sharp(masterBytes).extract(scenario.crop).png().toBuffer(),
    ...(await Promise.all(MODES.map((mode) =>
      sharp(readFileSync(`${OUT}/${scenario.name}-${mode.id}.png`)).extract(scenario.crop).png().toBuffer()))),
  ];
  await sharp({
    create: {
      width: scenario.crop.width,
      height: scenario.crop.height * cells.length + 8 * (cells.length - 1),
      channels: 3,
      background: "#0A0A0A",
    },
  })
    .composite(cells.map((input, index) => ({ input, left: 0, top: index * (scenario.crop.height + 8) })))
    .png()
    .toFile(`${OUT}/STICKER-${scenario.name}.png`);
  console.log(`  STICKER-${scenario.name}.png — master / A / B / C, lossless, 100%`);

  /* And the difference between the modes, which is where the shadows live. */
  const modeDiff = await differenceView(
    readFileSync(`${OUT}/${scenario.name}-A-substance.png`),
    readFileSync(`${OUT}/${scenario.name}-C-shadow.png`),
    { gain: 10 },
  );
  writeFileSync(`${OUT}/DIFF-${scenario.name}-A-vs-C.png`, modeDiff.panel);
  console.log(`  what C adds over A: ${(modeDiff.changedShare * 100).toFixed(2)}% of the frame, max ${modeDiff.maxDelta} levels`);

  report.push({ case: scenario.name, reference: scenario.reference, observation: scenario.observation, tipsRecovered, modes: rows });
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ taperPx: TAPER_PX, bandPx: BAND_PX, cases: report }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
