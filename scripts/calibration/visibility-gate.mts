/**
 * CALIBRATING THE VISIBILITY GATE — because 0.98 was a guess.
 *
 * `assertVisible` refuses an edit whose subject would be all but invisible
 * behind what is already there, and the bar it refuses at is `INVISIBLE_AT`.
 * That constant was chosen by reasoning — *a false refusal is the worse failure
 * by a distance, so partly hidden must count as visible* — and reasoning is not
 * a calibration. This measures what the score actually does on real faces.
 *
 * # What is measured
 *
 * For each specimen: the hair matte, the ear, and the LOBE (the lower third of
 * the ear, derived from the segmentation rather than drawn — a stud sits there,
 * a drop hangs below it). Then `occludedShare(lobe, hair)`, which is what the
 * gate would see if someone asked for earrings.
 *
 * A useful bar has to separate two populations that really exist: hair worn back
 * off the ears, and hair worn over them. If the two overlap there is no bar to
 * set and the gate should be deleted rather than tuned — which is a legitimate
 * outcome of running this.
 *
 * **THE PIN IS NOT CONSULTED ANYWHERE HERE.** The founder's ruling is that the
 * matte decides and the pin only suggests: occlusion is a question about current
 * pixels, and we have the current pixels. This is that ruling as arithmetic.
 *
 * Segmentation only — nothing is generated.
 *
 *   npx tsx scripts/calibration/visibility-gate.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  INVISIBLE_AT,
  coverage,
  occludedShare,
  unionMasks,
  type Mask,
} from "../../server/castingV2/maskGeometry";
import { pointAt, sam3 } from "./lib/segment.mts";

const OUT = "output/masked/visibility-gate";
mkdirSync(OUT, { recursive: true });

/** A spread on purpose: buns and updos beside long hair worn down. */
const SPECIMENS = [
  "wire-02", "chunky-02", "fresh-06", "fresh-02",
  "fresh-03", "wire-01", "fresh-04", "chunky-03",
];

/**
 * D-213 HAS A SIBLING, and the first version of this fixture found it by
 * producing a perfect row of zeroes.
 *
 * *You cannot segment a thing that is not there* — and **you cannot segment a
 * thing that is not VISIBLE** either. Asked for "left ear" on the afro
 * specimen, SAM 3 returns nothing at all: not a low-scoring blob to filter, an
 * empty mask set.
 *
 * Worse than the crash was what the surviving rows said. Deriving the lobe from
 * a SEGMENTED ear scored occlusion at 0.0% on all seven faces that had one —
 * including two with hair to the chest — and it could not have said anything
 * else: **if the segmenter can outline the ear, the hair is by definition not
 * covering it.** The instrument's passing state required it to have read
 * nothing, which is this program's most-repeated failure shape and its third
 * appearance in this workstream.
 *
 * So the destination of an ADD never comes from segmenting the thing itself.
 * It comes from a LANDMARK model, which answers "where is the ear on this face"
 * from the face — and still answers when the ear is hidden. Segmentation
 * supplies only the OCCLUDER, which by definition is the thing you can see.
 */
function discAt(point: { x: number; y: number }, radius: number, width: number, height: number): Mask {
  const data = Buffer.alloc(width * height, 0);
  const cx = point.x * width;
  const cy = point.y * height;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) data[y * width + x] = 255;
    }
  }
  return { data, width, height };
}

/** A drop: the stud's disc, repeated downward — the earring's own shape. */
function dropFrom(point: { x: number; y: number }, radius: number, width: number, height: number): Mask {
  const steps = 6;
  const discs: Mask[] = [];
  for (let step = 0; step <= steps; step += 1) {
    discs.push(discAt({ x: point.x, y: point.y + (step * radius * 1.4) / height }, radius, width, height));
  }
  return unionMasks(...discs);
}

const rows: any[] = [];
for (const name of SPECIMENS) {
  const bytes = readFileSync(`output/masked/specimens/${name}.png`);
  const meta = await sharp(bytes).metadata();
  const width = meta.width!;
  const height = meta.height!;
  const hair = await sam3(bytes, "hair");

  /* THE LANDMARK, with its negative control every time (D-219's discipline).
     A pointer that answers confidently about absent things is worse than none. */
  const lobes = await pointAt(bytes, "earlobe");
  const phantom = await pointAt(bytes, "wristwatch");
  if (phantom.length > 0) {
    throw new Error(`${name}: the landmark model located ${phantom.length} wristwatch(es) — it is guessing`);
  }
  if (lobes.length !== 2) {
    console.log(`${name.padEnd(10)} landmark returned ${lobes.length} lobe(s) — skipped, not scored`);
    rows.push({ specimen: name, lobes: lobes.length, verdict: "landmark did not resolve two lobes" });
    continue;
  }

  /*
    SIZE FROM THE FACE, not from a number I liked. The two lobes give a scale for
    free — the distance between them is the head's width at the ears — so a stud
    is a small fraction of that on any face at any framing.
  */
  const span = Math.hypot((lobes[0].x - lobes[1].x) * width, (lobes[0].y - lobes[1].y) * height);
  const studRadius = span * 0.035;
  const studs = unionMasks(...lobes.map((lobe) => discAt(lobe, studRadius, width, height)));
  const drops = unionMasks(...lobes.map((lobe) => dropFrom(lobe, studRadius, width, height)));

  const studShare = occludedShare(studs, hair.all);
  const dropShare = occludedShare(drops, hair.all);
  const verdict = studShare >= INVISIBLE_AT ? "REFUSE studs" : "render studs";
  console.log(
    `${name.padEnd(10)} hair ${(coverage(hair.all) * 100).toFixed(2).padStart(5)}%  `
    + `stud r=${studRadius.toFixed(0)}px  `
    + `studs hidden ${(studShare * 100).toFixed(1).padStart(5)}%  `
    + `drops hidden ${(dropShare * 100).toFixed(1).padStart(5)}%   ${verdict}`,
  );
  rows.push({ specimen: name, hairCoverage: coverage(hair.all), lobes: 2, studRadius, studShare, dropShare, verdict });

  await sharp(unionMasks(studs, drops).data, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(`${OUT}/MASK-${name}-stud-and-drop.png`);
}

/*
  DOES A BAR EXIST AT ALL? The gate is only worth having if the two populations
  separate. Reported as the gap between the most-hidden and least-hidden case,
  with the bar's position inside it — not asserted, because eight specimens is a
  reading and not a calibration, and saying so is the difference between the two.
*/
const scored = rows.filter((row) => row.studShare !== undefined);
const studs = scored.map((row) => row.studShare).sort((a, b) => a - b);
const drops = scored.map((row) => row.dropShare).sort((a, b) => a - b);
const unfindable = rows.filter((row) => row.lobes !== 2);
console.log(`\nstud occlusion across ${scored.length} scored specimens: ${(studs[0] * 100).toFixed(1)}% … ${(studs[studs.length - 1] * 100).toFixed(1)}%`);
console.log(`drop occlusion: ${(drops[0] * 100).toFixed(1)}% … ${(drops[drops.length - 1] * 100).toFixed(1)}%`);
console.log(`landmark did not resolve two lobes on: ${unfindable.length ? unfindable.map((r) => r.specimen).join(", ") : "none"}`);
console.log(`the bar sits at ${(INVISIBLE_AT * 100).toFixed(0)}% — refusing ${scored.filter((r) => r.studShare >= INVISIBLE_AT).length} of ${scored.length} for studs, `
  + `${scored.filter((r) => r.dropShare >= INVISIBLE_AT).length} of ${scored.length} for drops`);
console.log(
  "\nthe pair the founder specified: on any face where studs refuse and drops do not,\n"
  + "the gate asks a FREE question about studs and renders the drops — which is the\n"
  + "whole design, since a drop hangs below the hair's edge and is plainly visible.",
);
const pairs = scored.filter((row) => row.studShare >= INVISIBLE_AT && row.dropShare < INVISIBLE_AT);
console.log(`  faces exhibiting exactly that pair: ${pairs.length ? pairs.map((p) => p.specimen).join(", ") : "none in this set"}`);

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({ bar: INVISIBLE_AT, rows }, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
