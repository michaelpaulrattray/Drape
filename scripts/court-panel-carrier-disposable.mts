/**
 * DOES A TWO-VIEW SHEET DELIVER ONE HAIRCUT — the carrier court (§9.10, ordered
 * fable-1090 §3, spend approved fable-1092 §1).
 *
 * # What is on trial, and why it is not a formality
 *
 * The sheet-as-carrier **re-proposes a shape this product already convicted**:
 * the wrap court found one neck tattoo arriving as TWO, because a sheet showing
 * a design from two angles reads as one design PER VIEW. Its geometry might be
 * innocent here — a head cannot show its profile and its crown at once the way a
 * neck shows a front and a side — but *might*, measured never.
 *
 * ```
 *   ARM A   the two-view sheet as carrier      the hypothesis
 *   ARM B   the largest single panel           the control
 * ```
 *
 * **Both arms are one ask, one master, one engine, one sitting.** The only
 * difference between them is the picture riding beside the sentence, which is
 * the whole point: a cross-master comparison would be an anecdote.
 *
 * # The bar, declared before the spend
 *
 * 1. **ONE HAIRCUT, DELIVERED ONCE** — no doubling, no chimera blending the two
 *    views into a head nobody photographed. This is the arm the wrap court
 *    failed and it is what the sheet is on trial for.
 * 2. **FIDELITY TO THE CUT**, judged against BOTH source views by eye (law 9).
 *
 * And the artifact already told the eye what to watch for: with no head under
 * them the two cutouts are two dark masses whose orientation is ambiguous, so
 * **the sheet's failure mode is TWO HEADS OF HAIR rather than a blur.**
 *
 * # The composition is part of the instrument
 *
 * The sheet is SIDE BY SIDE while the source was stacked (ratified fable-1092
 * §3). A sheet repeating the source's own layout could not be told apart from
 * the source in a render, and the arm would have measured nothing.
 *
 * # The words are the product's own
 *
 * The sentence is composed by `hairTakeSentence`, not typed here — the same
 * words a real ask would carry, so the court cannot pass on prose the product
 * does not actually send.
 *
 * # Money, declared
 *
 * TWO edits on GPT Image 2 through the shipped masked-edit engine, house money,
 * dev only. No credits, no database, no bucket, no ledger row. The carriers are
 * read off disk — `build-panel-carriers-disposable.mts` cut them and they were
 * looked at first.
 *
 *   npx tsx scripts/court-panel-carrier-disposable.mts
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

/**
 * THE MASTER — a studio portrait whose hair is nothing like the reference's.
 *
 * Deliberate: her hair is near-black, flat to the scalp and pulled into a low
 * knot, and the reference is a loose swept cut with volume through the top. A
 * delivered change is therefore visible, and a NON-delivery is visible too —
 * which is what stops this court passing an arm that simply did nothing.
 */
const MASTER = "output/imagegen/makeup-positive-control-smoky-eye-red-lip-studio-portrait.png";

const ARMS = [
  {
    key: "armA-sheet",
    name: "ARM A — the two-view sheet",
    carrier: path.join(OUT, "carrier-armA-two-view-sheet.png"),
    watch: "TWO heads of hair, or a chimera of the profile and the crown",
  },
  {
    key: "armB-panel",
    name: "ARM B — the largest single panel (control)",
    carrier: path.join(OUT, "carrier-armB-largest-panel.png"),
    watch: "one haircut, and how faithful it is with only one view to go on",
  },
];

/*
  THE SENTENCE — the product's own, composed rather than typed.

  `style` rather than `fullLook`: the founder's centrepiece ask is *a hairstyle
  with a different colour*, and the style take is the one whose ride-along
  sentence disclaims the colour. It is also the harder case for a carrier, since
  the words have to hold back a property the picture plainly shows.
*/
/* The cast's own words — this court's master is a woman, as its prompt says. */
const TAKE_SENTENCE = hairTakeSentence("style", pronounsForSex("female"));

const PROMPT = [
  "Edit the first picture, which is a photograph of a woman.",
  "",
  TAKE_SENTENCE,
  "",
  "The other picture shows ONLY hair, cut out on a transparent background. It is",
  "a reference for the SHAPE and CUT of the hair, and nothing else in it is part",
  "of the instruction.",
  "",
  "Change nothing else about her: not her face, not her skin, not her clothing,",
  "not the background, not the framing.",
  "Return one photograph of one woman with one head of hair.",
].join("\n");

console.log("THE PROMPT, exactly as it goes out:\n");
console.log(PROMPT);
console.log("");

const source = await readFile(MASTER);
const sourceMeta = await sharp(source).metadata();
if (!sourceMeta.width || !sourceMeta.height) throw new Error("the master has no dimensions");

/*
  THE ENGINE REFUSES A FRAME THAT IS NOT A MULTIPLE OF 16, before dispatch and
  before any money moves — exactly the right shape for that guard, and it caught
  this court's first run at 1254x1254 for free.

  So the master is brought to the nearest multiple of 16 below its own size, and
  it is said out loud rather than done quietly: this is a resize of the court's
  fixture, it is identical for both arms, and it cannot be what separates them.
*/
const floor16 = (value: number) => Math.floor(value / 16) * 16;
const width = floor16(sourceMeta.width);
const height = floor16(sourceMeta.height);
const master = await sharp(source).resize(width, height, { fit: "cover" }).png().toBuffer();
const meta = { width, height };
console.log(
  `master ${MASTER} — ${sourceMeta.width}x${sourceMeta.height} → ${width}x${height} `
  + "(the engine takes multiples of 16; identical for both arms)",
);
console.log("");

const engine = createFalMaskedEditEngine({ apiKey });

for (const arm of ARMS) {
  const carrier = await readFile(arm.carrier);
  const carrierMeta = await sharp(carrier).metadata();
  console.log(`${arm.name}`);
  console.log(`  carrier ${arm.carrier} — ${carrierMeta.width}x${carrierMeta.height}`);
  console.log(`  WATCH FOR: ${arm.watch}`);
  const started = Date.now();
  try {
    const result = await engine.edit({
      prompt: PROMPT,
      references: [
        { bytes: master, contentType: "image/png" },
        { bytes: carrier, contentType: "image/png" },
      ],
      width: meta.width,
      height: meta.height,
    });
    const file = path.join(OUT, `court-${arm.key}.png`);
    await writeFile(file, result.bytes);
    console.log(`  DELIVERED in ${((Date.now() - started) / 1000).toFixed(1)}s → ${file}`);
  } catch (error) {
    /* A refusal is a reading too, and it is not the sheet losing — it is the
       arm not having run. Said plainly rather than scored. */
    console.log(`  NO FRAME — ${(error as Error).message}`);
    console.log("  This arm did not run. It is not a verdict about the carrier.");
  }
  console.log("");
}

console.log("Both frames are in front of eyes before any verdict is written (law 9).");
console.log("The bar: one haircut delivered once, and fidelity against BOTH source views.");
process.exit(0);
