/**
 * FOX EYES — did the painter drop the clause, or could the reader not see it?
 *
 * The net failed this twice on the founder's own face and refunded cleanly, with
 * the stored verdict "Eyes appear rounded/almond, not fox-shaped". Two worlds fit
 * that sentence and they need opposite fixes:
 *
 *   (a) THE PAINTER DIDN'T DO IT — the July finding recurring, and the reader was
 *       telling the truth. Points at prompt strength for shape-class edits.
 *   (b) THE PAINTER DID IT AND THE READER COULDN'T SEE — the behind-glasses class,
 *       pointing at the cropped-region judging queued for exactly this.
 *
 * The failed renders were never stored, so this re-renders through the SAME path
 * the product now uses — GPT Image 2, size pinned to the master — and looks.
 *
 *   npx tsx scripts/calibration/fox-eyes-diagnosis.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { differenceView } from "./lib/differenceView.mts";

const OUT = "output/masked/fox-eyes";
mkdirSync(OUT, { recursive: true });
const MASTER = "output/masked/specimens/fresh-02.png";

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const masterBytes = readFileSync(MASTER);
const meta = await sharp(masterBytes).metadata();
console.log(`master ${meta.width}x${meta.height} — a bespectacled face, which is the point\n`);

/*
  CORRECTION, 2026-08-07 — the first run's weak arm was not the product's prompt.

  The "as-composed" line below used to read `Change only her eyes: fox eyes` — a
  BARE TERM. The product does not send that. It sends `composedPrompt.full`,
  whose eye-shape lane is the anatomical prose in EYE_SHAPE_RENDER, quoted
  verbatim here from the composer's own output.

  So the first run compared a bare term against engineered prose, and proved
  only that prose beats a bare term — which is D-124/A9, already ruled, and NOT
  a finding about this defect. Reported as "the engine drops the shape clause at
  ordinary strength"; that conclusion did not follow from the comparison that
  was actually run. This is D-202 in its natural habitat: the arm was named
  as-composed rather than taken from the composer.

  The weak arm is now the product's real instruction, so the two arms finally
  differ by the thing under test.
*/
const PROMPTS: [string, string][] = [
  ["as-composed", "Edit this photograph of this exact person, changing ONLY what is listed below. "
    + "Change the eye shape to fox eyes — the outer corner lifted distinctly higher than the inner "
    + "corner with a strong upward canthal tilt, the eye opening long and narrow rather than round, "
    + "the whole eye reading as elongated toward the temple — this is the bone and lid STRUCTURE of "
    + "the eye itself, not liner, shadow or any makeup effect."],
  ["stronger", "Restyle her eye shape to FOX EYES: outer corners lifted and elongated into a sharp upward taper, the lid line swept up and out, almond narrowed to a cat-eye slant. The change must be clearly visible even through her glasses. Keep her identity, glasses, hair, skin, expression, pose, clothing and background exactly as they are."],
];

for (const [label, prompt] of PROMPTS) {
  const started = Date.now();
  const result = await engine.edit({
    prompt,
    references: [{ bytes: masterBytes, contentType: "image/png" }],
    width: meta.width!, height: meta.height!,
  });
  writeFileSync(`${OUT}/${label}.png`, result.bytes);
  const diff = await differenceView(masterBytes, result.bytes, { gain: 6 });
  writeFileSync(`${OUT}/DIFF-${label}.png`, diff.panel);
  console.log(`${label.padEnd(12)} ${result.width}x${result.height} in ${((Date.now()-started)/1000).toFixed(1)}s`
    + `  frame moved ${(diff.changedShare*100).toFixed(2)}%, max ${diff.maxDelta}`);
}

/* The eye region at 100%, which is where the answer is. */
const box = { left: 250, top: 380, width: 520, height: 260 };
const cells = [masterBytes, readFileSync(`${OUT}/as-composed.png`), readFileSync(`${OUT}/stronger.png`)];
const crops = await Promise.all(cells.map((b) => sharp(b).extract(box).png().toBuffer()));
await sharp({ create: { width: box.width, height: box.height*3+16, channels: 3, background: "#0A0A0A" } })
  .composite(crops.map((input,i)=>({input,left:0,top:i*(box.height+8)}))).png().toFile(`${OUT}/EYES.png`);
console.log("\nEYES.png — master / as-composed / stronger, at 100%");

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
