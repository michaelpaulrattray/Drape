/**
 * THE GLASSES FIXTURE'S FIRST PROBLEM — frames and lens interiors are ONE region.
 *
 * D-211 splits them by law, and the two halves get opposite treatment:
 *
 *   FRAMES          opaque. Composited back VERBATIM from the master — they are
 *                   the one part of a bespectacled face that must survive an eye
 *                   edit byte-for-byte.
 *   LENS INTERIORS  transparent. They CANNOT be copied, because those pixels
 *                   contain the old eye seen through glass. They must regenerate
 *                   inside fixed frame-edge anchors.
 *
 * SAM 3 hands back the union of the two — frames and lenses filled as one blob
 * (shop round two). So the split has to come from somewhere, and there are only
 * two honest places it can come from:
 *
 *   ASK      a second prompt for the lenses alone, then FRAMES = union − lenses
 *   DERIVE   geometry: the lens interiors are the holes enclosed by the frame
 *
 * Asking is tried first because it is the dedicated tool doing the job it was
 * built for, and a derived hole-fill is an approximation standing in for a
 * segmentation — exactly the substitution the fidelity law forbids while a real
 * source is still on the board.
 *
 * # What decides it
 *
 * A usable split has to satisfy three things at once, and the third is the one a
 * coverage number will not tell you:
 *
 *   1. lenses ⊂ union      the lens mask must sit INSIDE the union, or the two
 *                          prompts are describing different objects
 *   2. frames survive      union − lenses must be a connected rim of plausible
 *                          area, not a halo of leftovers
 *   3. the eye is inside   the lens region must contain the eye, because the
 *                          whole point is that eye edits happen THERE. SAM 3's
 *                          `eyes` mask from the same specimen is the probe.
 *
 * Run on both frame weights — chunky opaque rims and fine wire — because a split
 * that only works on thick frames is not a routing row, it is a lucky specimen.
 *
 *   npx tsx scripts/calibration/glasses-frame-lens-split.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { coverage, subtractMask, type Mask } from "../../server/castingV2/maskGeometry";

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error("FAL_KEY required");

const OUT = "output/masked/glasses-split";
mkdirSync(OUT, { recursive: true });

const SPECIMENS: Record<string, string> = {
  chunky: "output/masked/specimens/fresh-02.png",
  wire: "output/masked/specimens/wire-04.png",
};

/** Mask from the alpha channel for cut-outs, luma otherwise — D-214, proven. */
async function toMask(bytes: Buffer): Promise<Mask> {
  const meta = await sharp(bytes).metadata();
  const pipeline = meta.hasAlpha ? sharp(bytes).extractChannel(3) : sharp(bytes).toColourspace("b-w");
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (data.length !== info.width * info.height) {
    throw new Error(`mask is not single-channel: ${data.length} for ${info.width}x${info.height}`);
  }
  return { data, width: info.width, height: info.height };
}

async function segment(dataUri: string, prompt: string): Promise<{ mask: Mask | null; score: number | null }> {
  const response = await fetch("https://fal.run/fal-ai/sam-3/image", {
    method: "POST",
    headers: {
      Authorization: `Key ${KEY}`,
      "Content-Type": "application/json",
      "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({ image_url: dataUri, prompt, include_scores: true, output_format: "png" }),
  });
  if (!response.ok) throw new Error(`${prompt}: ${(await response.text()).slice(0, 160)}`);
  const json = await response.json() as any;
  /* An empty set is a RESULT, not a read failure (D-214's corollary). */
  if (!Array.isArray(json.masks) || json.masks.length === 0) return { mask: null, score: null };
  const url = json.masks[0]?.url ?? json.masks[0];
  const bytes = url.startsWith("data:")
    ? Buffer.from(url.split(",")[1], "base64")
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  return { mask: await toMask(bytes), score: json.scores?.[0] ?? null };
}

/** Share of `inner` that falls inside `outer` — containment, not overlap. */
function containedIn(inner: Mask, outer: Mask): number {
  let innerWeight = 0;
  let insideWeight = 0;
  for (let index = 0; index < inner.data.length; index += 1) {
    const value = inner.data[index];
    if (value === 0) continue;
    innerWeight += value;
    insideWeight += Math.min(value, outer.data[index]);
  }
  return innerWeight === 0 ? 0 : insideWeight / innerWeight;
}

const report: any[] = [];
for (const [tag, file] of Object.entries(SPECIMENS)) {
  const bytes = readFileSync(file);
  const dataUri = `data:image/png;base64,${bytes.toString("base64")}`;
  console.log(`\n### ${tag} — ${file}`);

  const union = await segment(dataUri, "eyeglasses");
  const lenses = await segment(dataUri, "eyeglass lenses");
  const eyes = await segment(dataUri, "eyes");

  if (!union.mask) {
    console.log("  eyeglasses returned NOTHING — no split is possible on this specimen");
    report.push({ tag, ok: false, reason: "no eyeglasses mask" });
    continue;
  }
  console.log(`  union  (eyeglasses)      coverage ${(coverage(union.mask) * 100).toFixed(2)}%  score ${union.score?.toFixed(3)}`);

  if (!lenses.mask) {
    console.log("  lenses (eyeglass lenses) returned NOTHING — ASKING FAILS, the split must be derived");
    report.push({ tag, ok: false, reason: "no lens mask", unionCoverage: coverage(union.mask) });
    continue;
  }
  console.log(`  lenses (eyeglass lenses) coverage ${(coverage(lenses.mask) * 100).toFixed(2)}%  score ${lenses.score?.toFixed(3)}`);

  const frames = subtractMask(union.mask, lenses.mask);
  const lensInUnion = containedIn(lenses.mask, union.mask);
  const eyeInLens = eyes.mask ? containedIn(eyes.mask, lenses.mask) : null;

  console.log(`  frames = union − lenses  coverage ${(coverage(frames) * 100).toFixed(2)}%`);
  console.log(`  [1] lenses inside union: ${(lensInUnion * 100).toFixed(1)}%  ${lensInUnion > 0.9 ? "— same object" : "— DIFFERENT OBJECTS, the split is not real"}`);
  console.log(`  [2] frames survive:      ${(coverage(frames) * 100).toFixed(2)}% of frame`);
  console.log(
    `  [3] eye inside lens:     ${eyeInLens === null ? "no eye mask" : `${(eyeInLens * 100).toFixed(1)}%`}`
    + `  ${eyeInLens !== null && eyeInLens > 0.8 ? "— edits land where they must" : "— THE EYE IS NOT IN THE LENS REGION"}`,
  );

  for (const [name, mask] of [["union", union.mask], ["lenses", lenses.mask], ["frames", frames]] as [string, Mask][]) {
    writeFileSync(
      `${OUT}/${tag}-${name}.png`,
      await sharp(mask.data, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer(),
    );
  }
  report.push({
    tag,
    ok: true,
    unionCoverage: coverage(union.mask),
    lensCoverage: coverage(lenses.mask),
    frameCoverage: coverage(frames),
    lensInUnion,
    eyeInLens,
    unionScore: union.score,
    lensScore: lenses.score,
  });
}

writeFileSync(`${OUT}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
