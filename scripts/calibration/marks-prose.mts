/**
 * THE THIN CLAUSE — is `marks` under-delivering because of the WORDS?
 *
 * Walk five, on the right face and a stable build: `statedAccessories` 100%,
 * `marks` 33%. The reader was accurate both times — I looked, and the freckles
 * were not there. But `scripts/calibration/freckles-layers.mts` DID freckle the
 * same master through the same compositor, using rich anatomical prose.
 *
 * # The structural half, which costs nothing at all
 *
 * `qualifierFor` in `refineDelta.ts` appends a qualifier to the clause for a
 * subject. Three subjects have one:
 *
 *   hairShade           "rendered as natural hair — dimensional rather than flat…"
 *   hairCut             "cut and dressed as a real haircut on this person's own…"
 *   statedAccessories   "…plainly visible… an accessory that fails to appear is
 *                        a failed candidate"
 *
 * **Nineteen do not**, `marks` among them, so its whole instruction is the
 * heading and the words the user typed: `MARKS: a beauty mark, freckles.` The
 * one class carrying failure-to-appear teeth is the one class that delivered
 * 100%, and the bare one delivered 33%.
 *
 * That is a correlation across three classes with single-digit samples, which
 * is not a finding — it is a reason to run the control.
 *
 * # The control: one master, one compositor, two sets of words
 *
 * Same face, same engine, same harvest. Only the clause differs. Each render is
 * then read by the SAME vision reader the product uses to decide whether
 * someone gets charged, so the verdict is the product's own, not mine.
 *
 * Not free — two fal renders — but it spends no credits and no founder time.
 *
 *   npx tsx scripts/calibration/marks-prose.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { createFalMaskedEditEngine } from "../../server/providers/falImages";
import { createFalRegionReader } from "../../server/castingV2/falRegionReader";
import { harvestRefinement } from "../../server/castingV2/maskedRefine";
import { facetOfSubject } from "../../server/castingV2/refineFacets";
import { composeEditPrompt } from "../../server/castingV2/refineDelta";

const OUT = "output/masked/marks-prose";
mkdirSync(OUT, { recursive: true });

const master = readFileSync("output/masked/freckles/master.png");
const meta = await sharp(master).metadata();
const W = meta.width!;
const H = meta.height!;

/*
  THE PRODUCT'S OWN SENTENCE, built by the product's own composer.

  Not a reconstruction of it — `composeEditPrompt` is the function the render
  path calls, so what prints here is what the model is actually sent. Writing
  the clause out by hand is how a prompt experiment ends up measuring a prompt
  nobody ships (D-143's shape, one layer along).
*/
const delta = { free: { marks: ["a beauty mark", "freckles"] } } as never;
const shipped = composeEditPrompt(delta, {} as never);
console.log("THE PRODUCT SENDS:\n  " + shipped + "\n");

/*
  AND THE SAME CLAUSE WITH A QUALIFIER — written in the shape the two working
  ones use: say what the thing IS on a real face, and give it teeth about
  failing to appear.
*/
const QUALIFIED = shipped.replace(
  /MARKS: ([^.]+)\./,
  "MARKS: $1, rendered as real marks on this person's own skin — freckles as a "
  + "natural scattering of small brown points across the nose and cheeks, denser "
  + "over the bridge and thinning outward, following the form of the face rather "
  + "than painted flat, and plainly visible at a normal viewing distance. A mark "
  + "that fails to appear is a failed render.",
);
console.log("THE CONTROL SENDS:\n  " + QUALIFIED + "\n");

const engine = createFalMaskedEditEngine({ apiKey: process.env.FAL_KEY! });
const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });

/** Her face skin, from the MASTER — never from the frame under test. */
const skin = await reader.region({ image: master, name: "face skin" });
let skinPx = 0;
for (let i = 0; i < skin.data.length; i += 1) if (skin.data[i] > 127) skinPx += 1;

const raw = async (bytes: Buffer) =>
  sharp(bytes).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
const A = await raw(master);

async function arm(label: string, prompt: string) {
  const began = Date.now();
  const painted = await engine.edit({
    prompt,
    references: [{ bytes: master, contentType: "image/png" }],
    width: W,
    height: H,
  });
  writeFileSync(`${OUT}/${label}-painted.png`, painted.bytes);

  const composed = await harvestRefinement({
    master: { bytes: master, contentType: "image/png" },
    painted: { bytes: painted.bytes, contentType: painted.contentType },
    facets: [facetOfSubject("marks")],
    reader,
    userId: 1,
    described: "a beauty mark, freckles",
  });
  writeFileSync(`${OUT}/${label}-composed.png`, composed.bytes);

  /* Freckle amplitude, on her skin, against the master. A freckle is worth
     about four levels; the program's habitual 25 would report nothing. */
  const B = await raw(composed.bytes);
  let moved = 0;
  for (let p = 0; p < W * H; p += 1) {
    if (skin.data[p] <= 127) continue;
    const i = p * 3;
    const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
    if (d > 4) moved += 1;
  }
  console.log(
    `${label.padEnd(10)} ${((Date.now() - began) / 1000).toFixed(0)}s · `
    + `${((moved / skinPx) * 100).toFixed(1)}% of her face skin moved at freckle amplitude`,
  );
  return { label, moved, bytes: composed.bytes };
}

const shippedArm = await arm("shipped", shipped);
const qualifiedArm = await arm("qualified", QUALIFIED);

console.log(
  `\nher face skin: ${skinPx.toLocaleString()} px · `
  + `qualified moved ${(qualifiedArm.moved / Math.max(1, shippedArm.moved)).toFixed(2)}x the shipped arm`,
);

/* Look at them, because a percentage cannot tell freckles from a warmer cheek. */
const crop = (bytes: Buffer) =>
  sharp(bytes).extract({
    left: Math.round(W * 0.28), top: Math.round(H * 0.28),
    width: Math.round(W * 0.44), height: Math.round(H * 0.26),
  }).png().toBuffer();
const cells = await Promise.all([master, shippedArm.bytes, qualifiedArm.bytes].map(crop));
const cellMeta = await sharp(cells[0]).metadata();
await sharp({
  create: {
    width: cellMeta.width! * 3 + 24, height: cellMeta.height!,
    channels: 3, background: "#0A0A0A",
  },
})
  .composite(cells.map((input, index) => ({ input, left: index * (cellMeta.width! + 12), top: 0 })))
  .png()
  .toBuffer()
  .then((buffer) => writeFileSync(`${OUT}/ARMS.png`, buffer));
console.log(`master / shipped clause / qualified clause at 100% → ${OUT}/ARMS.png`);
