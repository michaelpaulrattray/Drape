/**
 * A'S COURT, ARM ZERO — the WORDS-ARGUED BASELINE, on the founder's own case.
 * (fable-598 §4.)
 *
 * His #193 delivered a matched pair of cross earrings. His #194 asked for a red
 * eye, carried both earring crops at full geometry — and beside those two
 * pictures of one object the recipe wrote two different sentences:
 *
 *   Reference 2 … left  — "Small silver cross pendant on a thin silver chain,
 *                          plain narrow crucifix shape…"
 *   Reference 3 … right — "Silver-tone cross pendant with rounded tubular arms
 *                          and beveled edges, suspended from a curb-link chain"
 *
 * He saw both drift and the RIGHT one more — the side whose sentence sits
 * furthest from what its own crop shows. This puts a NUMBER on that drift, per
 * side, with the standing constancy instrument (geometry decides, worst side is
 * the verdict statistic), so the pointing arm has something to be measured
 * against rather than a memory of what somebody saw.
 *
 * It buys no render and touches no ledger: two frames the founder already paid
 * for, read from the PRODUCTION bucket, named here explicitly because a script
 * that takes rows from one world and objects from another reports a fiction
 * (the `railway run --service MySQL` trap — that command injects the database's
 * variables, never the app's, so R2_PUBLIC_URL falls back to the DEV bucket).
 *
 * House cost: ~6 segmenter calls, ~$0.03.
 *
 *   npx tsx scripts/court-carried-words-baseline-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { catalogueSlots } from "../server/castingV2/referenceSlotCatalogue.js";

import { readConstancy } from "./lib/constancyArm.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";

const PROD_BUCKET = "https://pub-990e39d8d995468eb61aced83162123a.r2.dev";

/* `casting_candidate_variants`, candidate 1625, read 2026-08-15. */
const PAIR_BORN = "casting-v2/variants/a0635f22-2575-4760-9cd0-29fa3618bb4b.png"; /* #193 */
const EYE_EDIT = "casting-v2/variants/90dc8c19-166e-42bd-b964-8a5516a69c51.png"; /* #194 */

const EARRING_QUESTION = catalogueSlots()
  .find((definition) => definition.feature === "earring" && definition.question !== null)!.question as string;

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required — this reads regions");

const OUT = "output/court-carried-words";
mkdirSync(OUT, { recursive: true });

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const reader = createFalRegionReader({ apiKey: FAL_KEY }) as never;

const parent = (await fetchImageBytes(`${PROD_BUCKET}/${PAIR_BORN}`)).bytes;
const child = (await fetchImageBytes(`${PROD_BUCKET}/${EYE_EDIT}`)).bytes;
writeFileSync(`${OUT}/baseline-parent.png`, parent);
writeFileSync(`${OUT}/baseline-child.png`, child);
console.log(`#193 ${parent.length} bytes → #194 ${child.length} bytes`);

const reading = await readConstancy({
  reader,
  /* THE CATALOGUE'S OWN WORD, never a guessed one. The first run of this asked
     "earrings" and got a VOID — the reader splits a pair only for a question in
     its bilateral set, which is derived from the catalogue, where the earring's
     question is the singular "earring". A guessed selector cannot prove an
     absence, and it nearly reported one about the founder's own frames. */
  question: EARRING_QUESTION,
  bilateral: true,
  noun: "earring",
  parent,
  child,
});

console.log("");
if (reading.sides.length === 0) {
  console.log(`VOID — ${reading.why ?? "nothing read"}`);
} else {
  for (const side of reading.sides) {
    console.log(
      `${side.side.padEnd(6)} extent ${(side.parentExtent * 100).toFixed(3)}% → `
      + `${(side.childExtent * 100).toFixed(3)}% of her face  drift ${(side.extentDrift * 100).toFixed(1)}%`
      + `   aspect ${side.parentAspect.toFixed(2)} → ${side.childAspect.toFixed(2)}`
      + ` drift ${(side.aspectDrift * 100).toFixed(1)}%`,
    );
  }
  console.log("");
  console.log(`WORST SIDE — the verdict statistic: ${((reading.worstDrift ?? 0) * 100).toFixed(1)}%`);
  console.log(`saw: ${reading.saw}`);
}

writeFileSync(`${OUT}/baseline.json`, `${JSON.stringify(reading, null, 2)}\n`);

process.exit(0);
