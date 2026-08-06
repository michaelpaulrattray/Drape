/**
 * CROPPED-REGION VERIFICATION — the behind-glasses false-refusal class, closed
 * or not closed by measurement.
 *
 * The founder's walk died partly on this: *"fox eyes"* was refused TWICE, and
 * the likeliest reason is that a reader asked to judge eye SHAPE on a full-frame
 * portrait is looking at eyes maybe thirty pixels across, seen through lenses.
 * It could not tell, so it said no, and a refusal that means "I could not see"
 * is indistinguishable to the user from "your edit did not happen".
 *
 * The masked path changes what can be asked. We know exactly which region an
 * edit touched, so the reader can be handed **the region, at its own scale**
 * instead of the whole picture. This measures whether that is enough.
 *
 * # Why this instrument can be graded, when the old one could not
 *
 * Every previous reader experiment in this program graded opinion against
 * opinion. Here the ground truth is ARITHMETIC:
 *
 *   the EYES changed   provable — the composite differs from the master inside
 *                      the mask, by byte comparison
 *   the MOUTH did not  provable — the composite is byte-identical to the master
 *                      outside the mask, and the mouth is outside it
 *
 * So the reader gets a question whose answer is known to be YES and a question
 * whose answer is known to be NO, on the same pair, in both framings. That gives
 * the score a floor and a ceiling (D-215) and makes a confident wrong answer
 * visible rather than plausible.
 *
 * **The negative control is the important half.** A cropped reader that says
 * "yes" to everything would score perfectly on the eye question and has learned
 * nothing except to agree. D-199 and D-203 measured what these readers are worth
 * and the answer was "they disagree with themselves", so every question is asked
 * `SAMPLES` times and the spread is reported, never a single verdict.
 *
 *   npx tsx scripts/calibration/cropped-region-read.mts
 */
import "dotenv/config";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { type Mask, type Raster, readRaster } from "../../server/castingV2/maskedComposite";
import { createOpenRouterTextEngine } from "../../server/providers/openrouterText";
import { dilateMask } from "../../server/castingV2/maskGeometry";
import { toMask } from "./lib/segment.mts";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY required");

const OUT = "output/masked/cropped-region-read";
mkdirSync(OUT, { recursive: true });

const MASTER = "output/masked/specimens/fresh-02.png";
/* The compound eye edit from the glasses fixture: fox eyes, eye colour, brows
   and different glasses, all inside one region — and the founder's own refused
   instruction is the first of those. */
const COMPOSITE = "output/masked/glasses-fixture/a-compound-gpt2-composite.png";
const MASK = "output/masked/glasses-fixture/a-compound-mask.png";
const SAMPLES = 6;
/** Room around the region so the reader sees context, not a floating eye. */
const CROP_PAD = 120;

const engine = createOpenRouterTextEngine({ apiKey });

const SYSTEM =
  "You are comparing two photographs of the same person. Answer only with a JSON object "
  + `{"answer":"yes"|"no"|"cannot tell","why":"<one short clause>"}. `
  + "Use \"cannot tell\" when the images do not let you judge, rather than guessing.";

type Question = { id: string; text: string; truth: "yes" | "no"; basis: string };

/*
  THE LABELS WERE WRONG ONCE, AND THAT IS THE MOST USEFUL THING THIS FIXTURE
  PRODUCED. The first version labelled "has the eye SHAPE changed" as truth=YES
  on the grounds that 24,192 pixels moved inside the mask — and then scored the
  reader 0/6 for saying no, twice over, in both framings.

  Looking at the crop settled it in one glance. What moved was eye COLOUR (brown
  to green), the brows a little, and the frames. **The eye shape did not change:
  the compound instruction's "fox eyes" clause simply did not render.** The
  reader was right both times, and my ground truth was an inference dressed as a
  measurement — D-202 inside the instrument built to avoid D-202.

  Two consequences. The labels below are now what the picture supports rather
  than what the byte count implies. And the founder's walk defect gains a second
  possible reading: when the studio said "fox eyes" and the reader said no, the
  reader may have been telling the truth about a clause the ENGINE dropped.
*/
const QUESTIONS: Question[] = [
  {
    id: "colour",
    text: "Has the colour of the irises changed between the first image and the second?",
    truth: "yes",
    basis: "brown to green — plainly visible in the crop and in the difference panel",
  },
  {
    id: "shape",
    text: "Has the shape of the eyes changed between the first image and the second?",
    truth: "no",
    basis: "the 'fox eyes' clause did not render; the lids and corners are unchanged",
  },
  {
    id: "mouth",
    text: "Has the mouth changed between the first image and the second?",
    truth: "no",
    basis: "byte-proven — the composite is identical to the master beyond the feather band",
  },
];

/** Bounding box of a mask, padded, clamped to the frame. */
function boxOf(mask: Mask, pad: number): { left: number; top: number; width: number; height: number } {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    if (mask.data[pixel] === 0) continue;
    const x = pixel % mask.width;
    const y = Math.floor(pixel / mask.width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) throw new Error("empty mask — no region to crop to");
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  return {
    left,
    top,
    width: Math.min(mask.width - left, maxX - minX + 1 + pad * 2),
    height: Math.min(mask.height - top, maxY - minY + 1 + pad * 2),
  };
}

/** Did anything inside this region actually move? The ground truth, in bytes. */
function movedInside(master: Raster, composite: Raster, mask: Mask): number {
  let moved = 0;
  for (let pixel = 0; pixel < mask.data.length; pixel += 1) {
    if (mask.data[pixel] === 0) continue;
    const at = pixel * 3;
    if (composite.data[at] !== master.data[at]
      || composite.data[at + 1] !== master.data[at + 1]
      || composite.data[at + 2] !== master.data[at + 2]) moved += 1;
  }
  return moved;
}

async function ask(question: string, before: Buffer, after: Buffer): Promise<string> {
  const result = await engine.complete({
    system: SYSTEM,
    user: question,
    images: [
      { bytes: before, contentType: "image/png" },
      { bytes: after, contentType: "image/png" },
    ],
    json: true,
    temperature: 0,
    maxOutputTokens: 200,
  });
  const match = result.text.match(/"answer"\s*:\s*"([^"]+)"/i);
  return (match?.[1] ?? "unparsed").toLowerCase().trim();
}

/* -------------------------------------------------------------------- run */

const masterBytes = readFileSync(MASTER);
const compositeBytes = readFileSync(COMPOSITE);
const master = await readRaster(masterBytes);
const composite = await readRaster(compositeBytes);
const mask = await toMask(readFileSync(MASK));

/*
  THE GROUND TRUTH, established before a single question is asked. If the eye
  region did not actually move, the "yes" question has the wrong truth attached
  and every score below would be graded against a fiction.
*/
const changedInside = movedInside(master, composite, mask);
/*
  "OUTSIDE" MEANS OUTSIDE THE FEATHER BAND, not outside the hard mask — and the
  first version of this check got it wrong and said so loudly, which is the only
  reason it is right now.

  The composite's guarantee is stated on the APPLIED mask: where the FEATHERED
  mask is fully zero, the output is byte-identical. The hard mask on disk is the
  input to that feather, so a ring of pixels just outside it is blended by design
  — 5,035 of them here. Grading the reader against "the hard mask's complement"
  would have called a designed blend a broken promise, and then graded a truthful
  reader as wrong.
*/
const beyondBand = await dilateMask(mask, 24);
const outsideMask: Mask = {
  data: Buffer.from(beyondBand.data.map((value) => (value === 0 ? 255 : 0))),
  width: mask.width,
  height: mask.height,
};
const outsideChanged = movedInside(master, composite, outsideMask);
console.log(`ground truth, in bytes:`);
console.log(`  inside the mask       ${changedInside.toLocaleString()} px moved  -> "the eyes changed" is YES`);
console.log(`  beyond the feather band ${outsideChanged.toLocaleString()} px moved  -> "the mouth changed" is NO`);
if (changedInside === 0 || outsideChanged !== 0) {
  throw new Error("the pair does not carry the ground truth this fixture grades against");
}
console.log("\nquestion labels, and what each one rests on:");
for (const question of QUESTIONS) {
  console.log(`  ${question.id.padEnd(7)} truth ${question.truth.padEnd(3)} — ${question.basis}`);
}

const box = boxOf(mask, CROP_PAD);
console.log(`\nregion crop ${box.width}x${box.height} at (${box.left}, ${box.top}) — `
  + `${((box.width * box.height) / (master.width * master.height) * 100).toFixed(1)}% of the frame`);
const beforeCrop = await sharp(masterBytes).extract(box).png().toBuffer();
const afterCrop = await sharp(compositeBytes).extract(box).png().toBuffer();
writeFileSync(`${OUT}/crop-before.png`, beforeCrop);
writeFileSync(`${OUT}/crop-after.png`, afterCrop);

const framings = [
  { id: "full-frame", before: masterBytes, after: compositeBytes },
  { id: "region-crop", before: beforeCrop, after: afterCrop },
];

const rows: any[] = [];
for (const framing of framings) {
  console.log(`\n=== ${framing.id} ===`);
  for (const question of QUESTIONS) {
    const answers: string[] = [];
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      answers.push(await ask(question.text, framing.before, framing.after));
    }
    const correct = answers.filter((answer) => answer === question.truth).length;
    const cannot = answers.filter((answer) => answer.includes("cannot")).length;
    const wrong = SAMPLES - correct - cannot;
    console.log(
      `  ${question.id.padEnd(6)} (truth ${question.truth.padEnd(3)})  `
      + `correct ${correct}/${SAMPLES}   cannot tell ${cannot}   WRONG ${wrong}   [${answers.join(", ")}]`,
    );
    rows.push({ framing: framing.id, question: question.id, truth: question.truth, answers, correct, cannot, wrong });
  }
}

console.log("\n=== does the crop close the false-refusal class? ===");
for (const question of QUESTIONS) {
  const full = rows.find((row) => row.framing === "full-frame" && row.question === question.id);
  const crop = rows.find((row) => row.framing === "region-crop" && row.question === question.id);
  console.log(
    `  ${question.id.padEnd(6)}  full-frame ${full.correct}/${SAMPLES} correct, ${full.cannot} refusals`
    + `   ->   region-crop ${crop.correct}/${SAMPLES} correct, ${crop.cannot} refusals`,
  );
}
console.log(
  "\nREADING IT: the crop only earns the row if it raises correctness on the EYE question\n"
  + "WITHOUT raising wrong answers on the MOUTH question. A reader that gained confidence\n"
  + "by learning to say yes has not been helped, it has been broken in a flattering\n"
  + "direction — which is why the negative control is here and why both are reported.",
);

writeFileSync(`${OUT}/results.json`, `${JSON.stringify({
  master: MASTER, composite: COMPOSITE, samples: SAMPLES, cropPad: CROP_PAD,
  groundTruth: { changedInside, outsideChanged },
  box, rows,
}, null, 2)}\n`);
console.log(`\nwritten to ${OUT}`);
