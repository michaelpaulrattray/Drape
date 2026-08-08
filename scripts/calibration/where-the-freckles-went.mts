/**
 * DID FRAME 04 PAINT NO FRECKLES, OR DID ITS CHEEKS COME FROM THE MASTER?
 *
 * The counter says frame 04 of run-12 sits at her untouched floor: what she
 * paid for at step 1 is not in it. Two very different mechanisms produce that
 * number, and they have DIFFERENT FIXES, so guessing between them would be
 * choosing a repair by taste:
 *
 *   THE WORD IS WEAK      the painter was asked for "freckles" and rendered
 *                         them so faintly they are gone. Fix: the recipe
 *                         remembers the density she accepted, so the ask is
 *                         specific. (fable-044/045's held candidate.)
 *   THE BASE REVERTED     the painter did fine, and the composite simply did
 *                         not carry her cheeks into this frame — every render
 *                         is anchored on the ORIGINAL CANDIDATE, so a region
 *                         this step's mask does not touch comes back as the
 *                         master's version of it, freckles and all removed.
 *                         (Known: `refineService.ts`, the inherited-verdict
 *                         note; run-7 saw it.) Fix: nothing to do with words.
 *
 * One measurement separates them, and it needs no model and no money: compare
 * the cheek band PIXELS. If frame 04's band is essentially the master's band,
 * the region was copied, not painted — no wording could have changed it. If it
 * differs from the master as much as the other frames do, the painter really
 * did repaint her cheeks and really did leave the freckles out.
 *
 * Reported as mean absolute difference per pixel over the same skin population
 * the counter uses, so the two instruments are talking about one region.
 *
 *   npx tsx scripts/calibration/where-the-freckles-went.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import sharp from "sharp";

type Patch = { left: number; top: number; width: number; height: number };

const density = JSON.parse(readFileSync("output/marks-court/freckle-density.json", "utf8")) as {
  rows: { frame: string; file: string; patch: Patch }[];
};
const her = density.rows.filter((row) => /^0[01345]/.test(row.frame));
if (her.length < 5) throw new Error("run freckle-density.mts first — it supplies the shared population");
const patch = her[0]!.patch;

async function band(file: string): Promise<Buffer> {
  return sharp(readFileSync(file)).extract(patch).greyscale().raw().toBuffer();
}

const bands = new Map<string, Buffer>();
for (const row of her) bands.set(row.frame.slice(0, 2), await band(row.file));

/**
 * Mean absolute difference, and the share of pixels that are EXACTLY equal.
 *
 * The second number is the one that decides it. Two independent renders of the
 * same face never agree pixel-for-pixel — a re-encode alone moves almost every
 * value. A high exact-match share means the bytes were carried across, not
 * regenerated, and no amount of prompt wording reaches a copy.
 */
function compare(a: Buffer, b: Buffer): { mad: number; identical: number } {
  let total = 0;
  let same = 0;
  for (let pixel = 0; pixel < a.length; pixel += 1) {
    const difference = Math.abs(a[pixel]! - b[pixel]!);
    total += difference;
    if (difference === 0) same += 1;
  }
  return { mad: total / a.length, identical: (same / a.length) * 100 };
}

const PAIRS: [string, string, string][] = [
  ["00", "01", "the master against the frame that first added freckles — the size of a real repaint"],
  ["00", "03", "the master against lip gloss"],
  ["00", "04", "THE QUESTION: the master against the frame that lost them"],
  ["00", "05", "the master against the removal"],
  ["01", "03", "two frames that measured the same density"],
  ["01", "04", "the delivery against the loss"],
  /* THE DECIDING PAIR. Every render is anchored on the original candidate, and
     a masked composite leaves pixels outside the changed region EXACTLY as the
     base had them. So whichever of `00` and `03` frame 04's band matches more
     closely is the picture frame 04 was actually built on. */
  ["03", "04", "DECIDES IT: the loss against its own predecessor"],
  ["04", "05", "the loss against the densest frame"],
];

console.log("pair        mean abs diff   pixels identical   what it means");
console.log("-".repeat(100));
for (const [left, right, note] of PAIRS) {
  const result = compare(bands.get(left)!, bands.get(right)!);
  console.log(`${left} vs ${right}  ${result.mad.toFixed(2).padStart(12)}`
    + `${`${result.identical.toFixed(1)}%`.padStart(18)}   ${note}`);
}

/*
  WHICH PART OF HER DID EACH STEP ACTUALLY TOUCH?

  The pair table alone cannot finish the argument. Every render is anchored on
  the master, so every frame resembles the master; "04 is closest to the master"
  is only damning if 04's cheeks are closer to the master **than the rest of 04
  is**. If the whole frame sits at the same similarity, 11% is re-encode noise
  everywhere and nothing distinguishes her cheeks.

  So the same comparison is run over regions no step in this chain asked about
  (her forehead, her shoulder) and over the region step 4 DID ask about (her
  ears). A masked composite leaves untouched pixels exactly as the base had
  them, so the signature of "this step never came near her cheeks" is: ears
  changed a lot, cheeks changed no more than the shoulder did.
*/
const meta = await sharp(readFileSync(her[0]!.file)).metadata();
const width = meta.width!;
const height = meta.height!;
const REGIONS: [string, Patch][] = [
  ["cheek band  ", patch],
  ["forehead    ", { left: patch.left, top: Math.max(0, patch.top - Math.round(patch.height * 2.6)), width: patch.width, height: patch.height }],
  ["ears (l+r)  ", { left: Math.max(0, patch.left - Math.round(patch.width * 0.28)), top: patch.top, width: Math.min(width - 1, Math.round(patch.width * 1.56)), height: patch.height }],
  ["shoulder    ", { left: Math.round(width * 0.12), top: Math.round(height * 0.78), width: Math.round(width * 0.24), height: Math.round(height * 0.10) }],
];

async function regionBand(file: string, region: Patch): Promise<Buffer> {
  return sharp(readFileSync(file)).extract(region).greyscale().raw().toBuffer();
}

console.log("\nWHAT EACH STEP TOUCHED — % of pixels left exactly as the master had them");
console.log("region          01 freckles   03 lip gloss   04 earrings   05 removal");
console.log("-".repeat(78));
for (const [label, region] of REGIONS) {
  const masterBand = await regionBand(her[0]!.file, region);
  const cells: string[] = [];
  for (const frame of ["01", "03", "04", "05"]) {
    const row = her.find((entry) => entry.frame.startsWith(frame))!;
    const result = compare(masterBand, await regionBand(row.file, region));
    cells.push(`${result.identical.toFixed(1)}%`.padStart(14));
  }
  console.log(`${label}${cells.join("")}`);
}
