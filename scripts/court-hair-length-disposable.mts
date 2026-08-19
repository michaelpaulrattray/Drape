/**
 * WHY THE LENGTH DID NOT ARRIVE — the length court's scale arm (authorized
 * fable-1093 §2).
 *
 * # The gap
 *
 * The carrier court delivered one haircut on both arms and lost the LENGTH on
 * both: his reference is a mid-length cut covering the ears and reaching the
 * nape; what arrived was a short crop with the ears bare. Same direction on both
 * arms, so the carrier's shape is not what did it. A customer pointing at that
 * photograph is pointing at a length as much as at a shape.
 *
 * # The arms — paired IN ONE SITTING, which is the whole design
 *
 * ```
 *   ARM S   the scale carrier    hair on a REDACTED head form
 *   ARM P   the plain carrier    hair alone, the previous court's ARM B
 * ```
 *
 * Two runs each. The plain arm is re-rendered here rather than compared against
 * yesterday's frame: engine behaviour drifts between sittings, and a control
 * from another sitting measures the drift as if it were the treatment
 * (`carry-noise-floor` — the SAME recipe twice drifts 0.0% against 21.3%). Two
 * runs per arm is also the minimum that can show a difference is not one sample
 * of a coin.
 *
 * # What the frames are judged on, declared before the spend
 *
 * **Length, against the reference**: does the hair cover the ears and reach the
 * nape, as it does in his photograph? Everything else — one head, no chimera,
 * her face untouched — is carried over from the carrier court's bar and is a
 * disqualifier rather than a score.
 *
 * **This court cannot separate cause (2).** If both arms are short, the reading
 * is *scale is not what was missing* and the cross-sex regression arm is the
 * next sitting — not that length is unfixable.
 *
 * # WHAT IT READ — six renders, three arms, two runs each, judged at the frames
 *
 * ```
 *   ARM S   scale carrier + length words    LONG   2/2   ears covered, past the jaw
 *   ARM P   plain carrier, no such words    short  2/2   ears bare, nape bare
 *   ARM W   plain carrier + length words    short  2/2   ears bare, nape bare
 * ```
 *
 * **The words did not do it. The picture did.** ARM W is the arm that says so:
 * handed the identical length sentence, the plain carrier stays short while the
 * scale carrier goes long. The arms do not overlap — the shortest scale frame
 * still covers more ear than either plain frame on either prompt.
 *
 * So **scale is what was missing**, and the redacted head form is not a fixture
 * for this court: it is the carrier's design. It is the ink road's mannequin
 * answer arriving in hair's lane — a carrier that pictures its own scale without
 * picturing a person.
 *
 * Limits, stated: one specimen, one master, two runs per arm, and the master is
 * a woman while the reference is a man — the cross-sex regression arm is a
 * separate sitting and this court cannot speak to it.
 *
 * # Money
 *
 * SIX edits on GPT Image 2 through the shipped masked-edit engine, house money,
 * dev only. No credits, no database, no bucket.
 *
 *   npx tsx scripts/court-hair-length-disposable.mts
 *   npx tsx scripts/court-hair-length-disposable.mts --only armW
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { createFalMaskedEditEngine } from "../server/providers/falImages";
import { pronounsForSex } from "../server/castingV2/castPronouns";
import { hairTakeSentence } from "../server/castingV2/hairReferenceTake";

if (process.env.MYSQL_PUBLIC_URL) {
  throw new Error("dev only — this spends house money and must not run in the production context");
}

const apiKey = process.env.FAL_KEY;
if (!apiKey) throw new Error("no FAL_KEY — this court renders");

const OUT = path.resolve("output/panel-probe");
await mkdir(OUT, { recursive: true });

const MASTER = "output/imagegen/makeup-positive-control-smoky-eye-red-lip-studio-portrait.png";
const RUNS = 2;

const ARMS = [
  {
    key: "armS-scale",
    name: "ARM S — the scale carrier (hair on a redacted head form)",
    carrier: path.join(OUT, "carrier-scale-redacted-head.png"),
  },
  {
    key: "armP-plain",
    name: "ARM P — the plain carrier (hair alone) — the paired control",
    carrier: path.join(OUT, "carrier-armB-largest-panel.png"),
  },
  /*
    ARM W — THE CONFOUND I PUT IN MY OWN COURT, and the arm that removes it.

    The two arms above do not differ only in their picture. The scale prompt has
    to describe the picture honestly — calling a redacted form "only hair" would
    be lying to the engine about its own reference — and in doing so it also
    says *"match that length"*. The plain prompt says no such thing.

    So a length difference between S and P could be the WORDS rather than the
    carrier, and reporting "scale is what was missing" on those two arms alone
    would be a claim the design could not support. This arm sends the PLAIN
    carrier with the scale arm's own length sentence: if it comes back short,
    the picture is what carried the length; if it comes back long, the words
    were doing the work and the carrier needs no form at all.

    Not a widening of the court to meet its data — a defect in the arms as
    declared, fixed before a verdict is written.
  */
  {
    key: "armW-words",
    name: "ARM W — the plain carrier WITH the scale arm's length words",
    carrier: path.join(OUT, "carrier-armB-largest-panel.png"),
  },
];

/*
  THE SAME SENTENCE THE CARRIER COURT SENT, composed by the product rather than
  typed — if the words changed between the two courts, the length difference
  could be the words.

  The only line that differs is the one describing what the picture IS, because
  the two carriers are genuinely different pictures and a prompt that called the
  redacted form "only hair" would be lying to the engine about its own reference.
*/
/* The cast's own words — this court's master is a woman and every other line
   of its prompt says so ("on her", "about her"). */
const TAKE_SENTENCE = hairTakeSentence("style", pronounsForSex("female"));

function promptFor(scale: boolean, wordsOnly = false): string {
  if (wordsOnly) {
    return [
      "Edit the first picture, which is a photograph of a woman.",
      "",
      TAKE_SENTENCE,
      "",
      "The other picture shows ONLY hair, cut out on a transparent background. It is",
      "a reference for the SHAPE and CUT of the hair, and nothing else in it is part",
      "of the instruction.",
      "Match that length and that shape on her.",
      "",
      "Change nothing else about her: not her face, not her skin, not her clothing,",
      "not the background, not the framing.",
      "Return one photograph of one woman with one head of hair.",
    ].join("\n");
  }
  return [
    "Edit the first picture, which is a photograph of a woman.",
    "",
    TAKE_SENTENCE,
    "",
    scale
      ? "The other picture shows hair on a plain grey form standing in for a head. The"
      : "The other picture shows ONLY hair, cut out on a transparent background. It is",
    scale
      ? "grey form is NOT part of the instruction — it is there only to show how long the"
      : "a reference for the SHAPE and CUT of the hair, and nothing else in it is part",
    scale
      ? "hair is relative to a head. Match that length and that shape on her."
      : "of the instruction.",
    "",
    "Change nothing else about her: not her face, not her skin, not her clothing,",
    "not the background, not the framing.",
    "Return one photograph of one woman with one head of hair.",
  ].join("\n");
}

const source = await readFile(MASTER);
const sourceMeta = await sharp(source).metadata();
if (!sourceMeta.width || !sourceMeta.height) throw new Error("the master has no dimensions");
const floor16 = (value: number) => Math.floor(value / 16) * 16;
const width = floor16(sourceMeta.width);
const height = floor16(sourceMeta.height);
const master = await sharp(source).resize(width, height, { fit: "cover" }).png().toBuffer();
console.log(`master ${MASTER} — ${sourceMeta.width}x${sourceMeta.height} → ${width}x${height}`);
console.log(`${RUNS} run(s) per arm, both arms in this sitting.`);

const engine = createFalMaskedEditEngine({ apiKey });

/* Re-buying an arm whose frames are already on disk is house money spent on
   tidiness, so one arm can be run on its own. */
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const RUNNING = only ? ARMS.filter((arm) => arm.key.startsWith(only)) : ARMS;
if (RUNNING.length === 0) throw new Error(`--only ${only} matched no arm`);

for (const arm of RUNNING) {
  const carrier = await readFile(arm.carrier);
  const meta = await sharp(carrier).metadata();
  const prompt = promptFor(arm.key.startsWith("armS"), arm.key.startsWith("armW"));
  console.log(`\n${arm.name}`);
  console.log(`  carrier ${arm.carrier} — ${meta.width}x${meta.height}`);
  console.log("  PROMPT:");
  for (const line of prompt.split("\n")) console.log(`    ${line}`);
  for (let run = 1; run <= RUNS; run += 1) {
    const started = Date.now();
    try {
      const result = await engine.edit({
        prompt,
        references: [
          { bytes: master, contentType: "image/png" },
          { bytes: carrier, contentType: "image/png" },
        ],
        width,
        height,
      });
      const file = path.join(OUT, `length-${arm.key}-run${run}.png`);
      await writeFile(file, result.bytes);
      console.log(`  run ${run}: DELIVERED in ${((Date.now() - started) / 1000).toFixed(1)}s → ${file}`);
    } catch (error) {
      console.log(`  run ${run}: NO FRAME — ${(error as Error).message}`);
      console.log("    This run did not happen. It is not a verdict about the carrier.");
    }
  }
}

console.log("\nThe bar: does the hair cover the ears and reach the nape, as it does in his");
console.log("photograph? Judged at the frames, against the reference, by eye (law 9).");
process.exit(0);
