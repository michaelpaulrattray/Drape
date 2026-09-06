/**
 * WHICH MASK CLAIMED THE TEAR? — run-6's freckles render, reproduced with the
 * adapter's own intermediate masks on disk.
 *
 * # The defect
 *
 * Production variant `198005a3` ("give her freckles", candidate `7c796a72`)
 * was delivered, charged 25, and scored `delivered_compliant` by the
 * verification net — with a hard-edged slab of background punched through her
 * hair and neck on one side, and a phantom hank of hair pasted over bare skin
 * on the other. The net only ever asks about facets; no question in it means
 * "the picture is intact", so a torn frame scores a clean sheet by
 * construction.
 *
 * # What is already measured, and what is not
 *
 * `outsideMaskUnchanged` holds: master → the delivered earrings render is
 * exactly 0.00 mean |Δluma| everywhere outside the face patch. So the tear is
 * INSIDE the applied mask — content the harvest CLAIMED, not content that
 * leaked. Running `differenceMatte`'s own arithmetic by hand over the two torn
 * regions, with her skin as the strand colour (the strand colour a `marks`
 * edit necessarily has, since its confirmed content is "face skin"):
 *
 *   left notch    master [8,6,6] → delivered [136,129,127]   alpha 0.730
 *   left wash     master [7,6,6] → delivered  [92, 90, 88]   alpha 0.490
 *   right phantom master [162,161,162] → delivered [74,71,71] alpha 0.000
 *   control: untouched hair / background                     alpha 0.000, |Δ| 0.0
 *
 * So the two tears have DIFFERENT mechanisms: the left is the strand
 * projection claiming a pale slab lying over dark hair (because "dark → pale"
 * points along the same axis as "dark hair → skin", and the projection cannot
 * tell a translucent strand from a replaced material); the right is not the
 * strand path at all, which points at the vacancy/reveal pair.
 *
 * That is a hypothesis with controls, and it is still a hypothesis. This
 * fixture settles it by asking the adapter to hand over the masks it actually
 * built, rather than reasoning about which one it must have been.
 *
 * # Why this fixture and not `freckles-layers.mts`
 *
 * That fixture asks the same class on the same kind of face and would never
 * have seen this: **it counts only pixels of HER FACE SKIN**, and the tear is
 * outside the face-skin mask by definition — it is at the hair boundary. A
 * measurement window drawn around the expected answer cannot report a failure
 * that happens outside it. Same shape as "the crop comes from the master":
 * this one is the measurement MASK wandering to where the answer is
 * convenient. This fixture measures the whole frame and reports per mask.
 *
 *   npx tsx scripts/calibration/torn-frame.mts            # re-composite stored paint
 *   npx tsx scripts/calibration/torn-frame.mts --repaint  # take a fresh one
 */
import "dotenv/config";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { facetOfSubject } from "../../server/castingV2/refineFacets";
import { parseStrictArgsOrRefuse } from "../lib/strictArgs.mts";

const OUT = "output/masked/torn-frame";
mkdirSync(OUT, { recursive: true });

/* Run-6's own master — candidate 7c796a72, position 1 of roll 455d096d. The
   face the torn render was made from, so this is that defect and not a
   lookalike's. Downloaded by `scripts/investigate-run6-disposable.mts`. */
const MASTER_SOURCE = "output/run6-audit/00-master.png";
if (!existsSync(MASTER_SOURCE)) {
  throw new Error(`no master at ${MASTER_SOURCE} — download it before running this fixture`);
}
const master = readFileSync(MASTER_SOURCE);
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;
console.log(`master ${W}x${H} — run-6 candidate 7c796a72\n`);

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

const DESCRIBED = "visibly textured, freckles";
const PROMPT = "Edit this photograph of this exact person, changing ONLY what is listed below. "
  + "Give her freckles: a natural scattering of small brown freckles across the nose, "
  + "cheeks and upper face, denser over the bridge of the nose and thinning outward — "
  + "the same person with freckled skin, not a different face and not makeup.";

/**
 * THIS SCRIPT'S WHOLE VOCABULARY, DECLARED SO A WORD OUTSIDE IT REFUSES (#345).
 *
 * A bare `includes("--repaint")` is the same class as the `indexOf` reader and
 * was invisible to the grep that defined #345's population.
 */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: [],
  boolean: ["repaint"],
});
const repaint = ARGS.flag("repaint");
let painted: { bytes: Buffer; contentType: string };
if (repaint || !existsSync(`${OUT}/painted.png`)) {
  const began = Date.now();
  const fresh = await engine.edit({
    prompt: PROMPT,
    references: [{ bytes: master, contentType: "image/png" }],
    width: W,
    height: H,
  });
  writeFileSync(`${OUT}/painted.png`, fresh.bytes);
  painted = { bytes: fresh.bytes, contentType: fresh.contentType };
  console.log(`painted in ${((Date.now() - began) / 1000).toFixed(1)}s`);
} else {
  painted = { bytes: readFileSync(`${OUT}/painted.png`), contentType: "image/png" };
  console.log("re-composited the STORED paint — the painter is held still (--repaint for a fresh one)");
}

const composed = await harvestRefinement({
  master: { bytes: master, contentType: "image/png" },
  painted: { bytes: painted.bytes, contentType: painted.contentType },
  facets: [facetOfSubject("marks")],
  reader,
  userId: 1,
  described: DESCRIBED,
  explain: true,
});
writeFileSync(`${OUT}/composed.png`, composed.bytes);
console.log("composed through the product's own adapter\n");

const masks: Record<string, { data: Buffer; width: number; height: number }> = {};
for (const [name, mask] of Object.entries(composed.explain ?? {})) {
  masks[name] = mask;
  writeFileSync(`${OUT}/mask-${name}.png`, await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  }).png().toBuffer());
  let sum = 0;
  for (let i = 0; i < mask.data.length; i += 1) sum += mask.data[i]!;
  console.log(`  ${name.padEnd(13)} ${((sum / (mask.data.length * 255)) * 100).toFixed(3)}% of frame, alpha-weighted`);
}
console.log();

/*
  THE QUESTION THIS FIXTURE EXISTS FOR.

  A `marks` edit asks one segmentation question — "face skin". Any pixel a mask
  claims that lies over HER HAIR on the master is, by construction, territory
  belonging to a facet this instruction never touched. So: read her hair from
  the MASTER (never from the frame under test), and ask each mask how much of
  its claim lands there.
*/
const hair = await reader.region({ image: master, name: "hair" });
const skin = await reader.region({ image: master, name: "face skin" });
let hairPx = 0;
for (let i = 0; i < hair.data.length; i += 1) if (hair.data[i]! > 127) hairPx += 1;
console.log(`her hair on the MASTER: ${hairPx.toLocaleString()} px (${((hairPx / (W * H)) * 100).toFixed(1)}% of frame)\n`);

console.log("how much of each mask's claim lands on HAIR the instruction never named");
console.log(`  ${"mask".padEnd(13)}${"claimed px".padStart(12)}${"of which hair".padStart(15)}${"share".padStart(9)}`);
for (const [name, mask] of Object.entries(masks)) {
  let claimed = 0;
  let onHair = 0;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    if (mask.data[pixel]! === 0) continue;
    claimed += 1;
    if (hair.data[pixel]! > 127) onHair += 1;
  }
  const share = claimed === 0 ? 0 : (onHair / claimed) * 100;
  console.log(
    `  ${name.padEnd(13)}${claimed.toLocaleString().padStart(12)}${onHair.toLocaleString().padStart(15)}${`${share.toFixed(1)}%`.padStart(9)}`,
  );
}

/*
  AND WHAT ACTUALLY CHANGED IN THE DELIVERED PICTURE, over her hair.

  The masks say what was claimed; this says what the customer received. A
  composite that respects the instruction leaves her hair at zero.
*/
const raw = async (bytes: Buffer) =>
  sharp(bytes).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
const A = await raw(master);
const P = await raw(painted.bytes);
const C = await raw(composed.bytes);

const bands = (B: Buffer, within: { data: Buffer }, threshold: number) => {
  let moved = 0;
  let total = 0;
  for (let pixel = 0; pixel < W * H; pixel += 1) {
    if (within.data[pixel]! <= 127) continue;
    total += 1;
    const at = pixel * 3;
    const delta = (Math.abs(A[at]! - B[at]!) + Math.abs(A[at + 1]! - B[at + 1]!)
      + Math.abs(A[at + 2]! - B[at + 2]!)) / 3;
    if (delta > threshold) moved += 1;
  }
  return total === 0 ? 0 : (moved / total) * 100;
};

console.log("\npixels MOVED from the master, at REPLACEMENT amplitude (>25 levels)");
console.log(`  ${"region".padEnd(13)}${"painted".padStart(10)}${"delivered".padStart(12)}`);
console.log(`  ${"her hair".padEnd(13)}${`${bands(P, hair, 25).toFixed(2)}%`.padStart(10)}${`${bands(C, hair, 25).toFixed(2)}%`.padStart(12)}`);
console.log(`  ${"her skin".padEnd(13)}${`${bands(P, skin, 25).toFixed(2)}%`.padStart(10)}${`${bands(C, skin, 25).toFixed(2)}%`.padStart(12)}`);

console.log(
  "\nthe painter drifting her hair is EXPECTED and harmless — it is whether the\n"
  + "composite DELIVERED that drift that decides this. Anything above ~0 in the\n"
  + "delivered/hair cell is the tear.",
);

/* And look at it, because no table can tell a tear from a strand. */
const strip = await Promise.all([master, painted.bytes, composed.bytes].map((bytes) =>
  sharp(bytes).resize(Math.round(W / 2), Math.round(H / 2), { fit: "fill" }).png().toBuffer()));
const cell = await sharp(strip[0]!).metadata();
await sharp({
  create: {
    width: cell.width! * 3 + 24, height: cell.height!,
    channels: 3, background: "#0A0A0A",
  },
})
  .composite(strip.map((input, index) => ({ input, left: index * (cell.width! + 12), top: 0 })))
  .png()
  .toBuffer()
  .then((buffer) => writeFileSync(`${OUT}/FRAMES.png`, buffer));
console.log(`\nmaster / painted / composed → ${OUT}/FRAMES.png`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
