/**
 * THE FRAMES GATE'S POSITIVE CONTROL — the face exclusion actually FIRING.
 *
 *   npx tsx scripts/gate-frames-fence-control-disposable.mts
 *
 * # Why this exists, and it is not in fable-1243 §2b's ruled shape
 *
 * The gate's walk ran on S1 at `upper chest` and its arm printed **0 face
 * pixels in the crop**. True — and, measured, the fence had NOTHING TO DO on
 * that specimen: `face ∩ upper chest` is 0 px there, so `subtractMask` removed
 * nothing and the box it cut is the box it would have cut anyway. A zero that
 * was never in danger is the negative arm that cannot find a YES defect, and a
 * control nobody has ever seen fire is working law 2 unmet — *verify the
 * instrument before believing its finding.*
 *
 * So this buys the cell the exclusion was supposedly written from: **S2, the
 * torso-and-neck man, whose `upper chest` box was documented to climb to y=80
 * and take his face with it** (`subtractMask`'s own docblock named this
 * specimen). Same road, same words, same reader — one specimen changed.
 *
 * ⚠ **IT DID NOT FIRE THERE EITHER.** S2's `upper chest` starts at y=210 and
 * holds 0 face pixels, which is opus-899 §3's finding re-measured. So the five
 * code sites carrying y=80 were corrected in this sitting, and the fence's
 * standing is: proven at fixtures and at the bytes, never on a real
 * photograph.
 *
 * # It is a CONTROL and not a second gate
 *
 * No render, no credits, nothing filed: five segmenter reads on the shared
 * courtesy pool, about three cents. It answers one question — *does the thing
 * that printed 0 on S1 print a non-zero when there is a face in the way* — and
 * the founder's eye still closes the gate on S1's own three frames.
 *
 * # ⚠ IT IS ONE READ SET BEYOND THE BOUND THAT WAS AGREED
 *
 * fable-1243 §2b put ~6 segmenter reads and one upscale on the record before
 * anything was bought. The walk spent 6 (five in the cut, one in the arm) and
 * the upscale was never needed — the chest cut cleared the floor at 399x287. So
 * this sits inside the budgeted envelope in money and outside it in shape, and
 * it is declared here rather than folded into a total.
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { cutInkDesign } from "../server/castingV2/inkReferenceCutter";
import { FACE_REGION, sourceRegionWord } from "../server/castingV2/inkReferenceCrop";
import { inkPlacementEntry } from "../shared/inkPlacementVocabulary";

const REPO = resolve(import.meta.dirname, "..");
const OUT = resolve(REPO, "output/frames-gate");
const SPECIMEN = "docs/specs/references/build-two-founder-specimens/tattoo-patchwork-torso-neck-continuation.png";
/*
  WHICH SURFACE — `upperChest` by default, `neck` by argument.

  Not a convenience. The chest cell answered *the fence did no work here*, and
  the reason is geometry: this man's chest surface starts at y=210 and his frame
  is cropped at the mouth, so no face was ever inside it. The NECK surface on the
  same photograph is the one that sits directly under his chin — the cell
  opus-899 §3 named as still missing, and the cell fable-919 §3's gate turns on.
*/
const PLACEMENT = (process.argv.includes("--neck") ? "neck" : "upperChest") as "neck" | "upperChest";
const TAG = PLACEMENT === "neck" ? "6-control-S2-neck" : "4-control-S2";

const lines: string[] = [];
const say = (line: string) => { console.log(line); lines.push(line); };

const apiKey = process.env.FAL_KEY;
if (!apiKey) {
  console.error("REFUSING: FAL_KEY is not set — this control asks the REAL reader and will not pretend to.");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const bytes = await readFile(resolve(REPO, SPECIMEN));
const meta = await sharp(bytes).metadata();
const word = sourceRegionWord({ readerWord: inkPlacementEntry(PLACEMENT).readerWord, phrase: null });
say(`S2       ${meta.width}x${meta.height}  placement ${PLACEMENT} -> "${word}"`);
if (word === null) {
  /* The vocabulary entry has no reader word, so there is no surface question to
     ask and no fence to exercise. Refusing rather than asking a made-up word. */
  say("REFUSING: that placement has no measured reader word — there is no surface to scope to.");
  process.exit(1);
}
say(`         shirtless tanned man against a rough white wall, CROPPED AT THE MOUTH —`);
say(`         barbed wire round the neck, chest and stomach pieces, both sleeves worked`);

/* THE CUT, through the product's own function with the product's own reader. */
const result = await cutInkDesign({
  bytes,
  reader: createFalRegionReader({ apiKey }),
  scope: { region: word, half: null },
  regionCrop: true,
  about: { candidatePublicId: "gate-fence-control-S2" },
});
say("");
if (!result.ok) {
  say(`REFUSED  ${result.refusal.code} — the control cannot fire on a road that did not run`);
  await writeFile(resolve(OUT, `${TAG}.log`), `${lines.join("\n")}\n`);
  process.exit(1);
}
const cut = result.cut;
say(`cut      route ${cut.route}  ${cut.width}x${cut.height}  at ${cut.box?.left},${cut.box?.top}`);
say(`         ink ${cut.inkPixels.toLocaleString()} px · person ${cut.personPixels.toLocaleString()} px`);
await writeFile(resolve(OUT, `${TAG}-cut.png`), cut.bytes);
const flat = await sharp(cut.bytes).removeAlpha().png().toBuffer();
await writeFile(resolve(OUT, `${TAG}-cut-flattened.png`), flat);
say(`wrote    ${resolve(OUT, `${TAG}-cut.png`)}`);
say(`wrote    ${resolve(OUT, `${TAG}-cut-flattened.png`)}`);

/*
  THE SAME TWO QUESTIONS THE ARM ASKED ON S1, asked again here — `face` for the
  geometry and the surface UN-SUBTRACTED, so the difference between them is the
  fence's work rather than an inference about it.
*/
const reader = createFalRegionReader({ apiKey });
const face = await reader.region({ image: bytes, name: FACE_REGION, absentIsAnswer: true });
const surface = await reader.region({ image: bytes, name: word, absentIsAnswer: true });
say("");
if (face === null || surface === null
  || face.width !== meta.width || surface.width !== meta.width) {
  say("the reader did not answer both questions in her space — the control is unmeasured this run");
} else {
  let faceInFrame = 0;
  let surfacePixels = 0;
  let removed = 0;
  let minY = Number.POSITIVE_INFINITY;
  for (let y = 0; y < face.height; y += 1) {
    for (let x = 0; x < face.width; x += 1) {
      const isFace = face.data[y * face.width + x]! > 127;
      const isSurface = surface.data[y * surface.width + x]! > 127;
      if (isFace) faceInFrame += 1;
      if (isSurface) { surfacePixels += 1; if (y < minY) minY = y; }
      if (isFace && isSurface) removed += 1;
    }
  }
  say(`face     in his picture              ${faceInFrame.toLocaleString()} px`);
  say(`surface  "${word}" un-subtracted     ${surfacePixels.toLocaleString()} px, top edge y=${minY}`);
  say(`         FACE PIXELS IT REMOVED      ${removed.toLocaleString()} px   <- the fence's work on this cell`);

  /* AND WHETHER ANY SURVIVED — counted against the crop the cutter actually
     produced, in the crop's own coordinates, exactly as on S1. */
  const box = cut.box;
  if (box === null || cut.width !== box.width || cut.height !== box.height) {
    say(`         (the cut was enlarged or rode whole — the survivor count needs the native crop)`);
  } else {
    const { data, info } = await sharp(cut.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let survived = 0;
    let hidden = 0;
    for (let y = 0; y < face.height; y += 1) {
      for (let x = 0; x < face.width; x += 1) {
        if (!(face.data[y * face.width + x]! > 127)) continue;
        const cx = x - box.left;
        const cy = y - box.top;
        if (cx < 0 || cy < 0 || cx >= box.width || cy >= box.height) continue;
        if (data[(cy * box.width + cx) * 4 + 3]! > 127) survived += 1;
      }
    }
    for (let at = 0; at < info.width * info.height; at += 1) {
      if (data[at * 4 + 3] === 0 && (data[at * 4] !== 0 || data[at * 4 + 1] !== 0 || data[at * 4 + 2] !== 0)) hidden += 1;
    }
    say(`         FACE PIXELS THAT SURVIVED   ${survived.toLocaleString()} px   <- must be 0`);
    say(`         person under alpha          ${hidden.toLocaleString()} px   <- must be 0`);
  }
}

await writeFile(resolve(OUT, `${TAG}.log`), `${lines.join("\n")}\n`);
process.exit(0);
