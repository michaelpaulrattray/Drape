/**
 * IS THERE ALSO A CROSS-SEX PULL? — the regression arm (authorized fable-1093
 * §2b, re-scoped fable-1094 §3, ordered third in fable-1097 §3).
 *
 * # The question, and how it changed
 *
 * The carrier court lost the LENGTH on both arms, and two causes were named:
 * the carrier pictured no scale, or the engine regressed to a woman's short
 * crop because the master is a woman and the reference is a man. The scale
 * court answered the first — with the length words held constant, the scale
 * carrier went LONG 2/2 while the plain one stayed short 2/2.
 *
 * So this arm is no longer *which of the two is it*. It is **is there ALSO a
 * pull**: with the scale carrier in hand, does the same ask land differently on
 * a MALE master than on the female one it was measured on?
 *
 * # THE CONTROL IS RE-RUN IN THIS SITTING, and that is the whole design
 *
 * The female arm's frames already exist from the scale court. They are NOT
 * reused. Engine behaviour drifts between sittings, and a control from another
 * sitting measures the drift as if it were the treatment — the same recipe
 * twice has drifted 0.0% against 21.3% in this program's own record. Both arms
 * are bought here, two runs each.
 *
 * ```
 *   ARM F   the FEMALE master   the scale carrier, the scale prompt   the control
 *   ARM M   the MALE master     the same carrier, the same prompt     the treatment
 * ```
 *
 * # WHAT DIFFERS BETWEEN THE ARMS, stated because a court's arms are claims too
 *
 * The master, and the two words that name the master's sex — *"a photograph of
 * a woman"* / *"one woman"* become *"a man"* / *"one man"*. That is not a
 * confound to be removed: it is INHERENT to the question. Lying to the engine
 * about the sex of the person in the frame would be a different experiment, and
 * the honest-description lesson from the scale court applies here too.
 *
 * ⚠ **AND A THIRD THING DIFFERED, WHICH THIS HEADER DID NOT KNOW WHEN IT WAS
 * WRITTEN** (found while wiring the take to the engine, `cc9cf8db`; annotation
 * ordered fable-1109 §3). The ride-along sentence composed above was
 * hard-coded `her`/`hers` — so **ARM M's male master was sent a sentence about
 * a woman** while ARM F's was not. The arms differed in their WORDS as well as
 * their picture, which is the very failure the section heading above names.
 *
 * Three consequences, and they do not all point the same way:
 *
 *   (i)   the POSITIVE finding survives A FORTIORI — the length arrived on the
 *         male arm DESPITE a mismatched sentence, so a matched one cannot make
 *         it arrive less;
 *   (ii)  the ears residual is now DOUBLY unseparated — starting state AND
 *         words — so it cannot be attributed to either;
 *   (iii) **the recorded frames predate the fix and no re-run is comparable
 *         with them.** The sentence this script now composes is neutral
 *         (`pronounsForSex(null)`), which is what the rest of its prompt has
 *         always said.
 *
 * No re-run is bought on this: the question the court answered was additive and
 * its positive half holds. This paragraph exists so the next reader does not
 * inherit a cleaner court than the one that ran.
 *
 * The male master is generated (his own `/codex-imagegen` path) and was LOOKED
 * AT before it became a fixture: square, mid-grey seamless, straight on, bare
 * shoulders, **short hair with both ears fully exposed** — which is the property
 * that makes an arriving length visible at all. A master already wearing the
 * reference's haircut would answer nothing.
 *
 * # What is judged, declared before the spend
 *
 * **Length, against the reference**: does the hair cover the ears and reach the
 * nape, as it does in the reference photograph? Everything else — one head, no
 * chimera, the face untouched — is a disqualifier rather than a score.
 *
 * A reading of *both arms long* is: no pull, and the scale form is enough. A
 * reading of *female long, male short* is a pull, and the recipe's words must
 * carry the length explicitly for a male cast. A reading of *both short* would
 * be this sitting's own drift and would put the scale finding itself back on
 * trial rather than answering this question.
 *
 * # Money
 *
 * FOUR edits on GPT Image 2 through the shipped masked-edit engine, house
 * money, dev only. No credits, no database, no bucket.
 *
 *   npx tsx scripts/court-hair-cross-sex-disposable.mts
 *   npx tsx scripts/court-hair-cross-sex-disposable.mts --only armM
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

/** The carrier the scale court earned — the same bytes, not a re-cut. */
const CARRIER = path.join(OUT, "carrier-scale-redacted-head.png");
const RUNS = 2;

const ARMS = [
  {
    key: "armF-female",
    name: "ARM F — the FEMALE master (the control, re-run in this sitting)",
    master: "output/imagegen/makeup-positive-control-smoky-eye-red-lip-studio-portrait.png",
    subject: "woman",
  },
  {
    key: "armM-male",
    name: "ARM M — the MALE master (the treatment)",
    master: "output/imagegen/male-studio-control-short-hair-exposed-ears.png",
    subject: "man",
  },
];

/* The product's own sentence, composed rather than typed: if the words differed
   from the courts before this one, a difference in the frames could be the
   words. */
/*
   NEUTRAL, because this court's two arms differ ONLY in the master's sex and
   the sentence must not: every other line of this prompt already says "them"
   and "their" for exactly that reason. It also removes a confound nobody had
   named — the pre-pronoun wording said "Take HER hair" and arm M's master is a
   man, so the treatment arm was being sent a sentence about a woman.
*/
const TAKE_SENTENCE = hairTakeSentence("style", pronounsForSex(null));

function promptFor(subject: string): string {
  return [
    `Edit the first picture, which is a photograph of a ${subject}.`,
    "",
    TAKE_SENTENCE,
    "",
    "The other picture shows hair on a plain grey form standing in for a head. The",
    "grey form is NOT part of the instruction — it is there only to show how long the",
    "hair is relative to a head. Match that length and that shape on them.",
    "",
    "Change nothing else about them: not their face, not their skin, not their clothing,",
    "not the background, not the framing.",
    `Return one photograph of one ${subject} with one head of hair.`,
  ].join("\n");
}

const carrier = await readFile(CARRIER);
const carrierMeta = await sharp(carrier).metadata();
console.log(`carrier ${CARRIER} — ${carrierMeta.width}x${carrierMeta.height}`);

const engine = createFalMaskedEditEngine({ apiKey });

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const RUNNING = only ? ARMS.filter((arm) => arm.key.startsWith(only)) : ARMS;
if (RUNNING.length === 0) throw new Error(`--only ${only} matched no arm`);

const floor16 = (value: number) => Math.floor(value / 16) * 16;

for (const arm of RUNNING) {
  const source = await readFile(arm.master);
  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) throw new Error(`${arm.master} has no dimensions`);
  const width = floor16(meta.width);
  const height = floor16(meta.height);
  /* Stated rather than done quietly, and identical in shape across both arms so
     it cannot be what separates them. */
  const master = await sharp(source).resize(width, height, { fit: "cover" }).png().toBuffer();

  const prompt = promptFor(arm.subject);
  console.log(`\n${arm.name}`);
  console.log(`  master ${arm.master} — ${meta.width}x${meta.height} → ${width}x${height}`);

  for (let run = 1; run <= RUNS; run += 1) {
    const started = Date.now();
    const frame = await engine.edit({
      prompt,
      references: [
        { bytes: master, contentType: "image/png" },
        { bytes: carrier, contentType: "image/png" },
      ],
      width,
      height,
    });
    const file = path.join(OUT, `crosssex-${arm.key}-run${run}.png`);
    await writeFile(file, frame.bytes);
    console.log(`  run ${run}: ${((Date.now() - started) / 1000).toFixed(1)}s → ${file}`);
  }
}

console.log("\nLOOK AT THEM. The question is LENGTH: ears covered and the nape reached, or not.");
process.exit(0);
