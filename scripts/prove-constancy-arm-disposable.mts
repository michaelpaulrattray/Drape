/**
 * THE CONSTANCY ARM'S OWN CONTROLS — before any verdict it produces counts.
 * (Working law 2: a new instrument gets a negative and a positive control
 * first. A green suite proves nothing if the checker cannot fail.)
 *
 * ```
 * POSITIVE   the same frame twice → geometry ~0% drift, and the eye says SAME.
 *            An arm that cannot recognise a thing as itself is measuring noise.
 * NEGATIVE   two DIFFERENT deliveries on the same face → the eye must say
 *            REDRAWN. This is the arm's whole purpose: presence and identity
 *            both hold here (a pair of horns, the same woman), and only
 *            constancy separates them.
 * NO-READ    a bare face → no reading, with the reason, rather than a zero.
 * ```
 *
 * Frames are the survival court's own, already paid for. ~14 segmenter reads
 * and 2 judge calls, about ten cents. No generations.
 *
 *   npx tsx scripts/prove-constancy-arm-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { readConstancy } from "./lib/constancyArm.mts";

const FAL_KEY = process.env.FAL_KEY;
const OPENROUTER = process.env.OPENROUTER_API_KEY;
if (!FAL_KEY || !OPENROUTER) throw new Error("FAL_KEY and OPENROUTER_API_KEY are required");

const { createFalRegionReader } = await import("../server/castingV2/falRegionReader.js");
const { createOpenRouterTextEngine } = await import("../server/providers/openrouterText.js");
const reader = createFalRegionReader({ apiKey: FAL_KEY }) as never;
const judge = createOpenRouterTextEngine({ apiKey: OPENROUTER }) as never;

const IN = "output/horns-court";
const horned = readFileSync(`${IN}/words-2.png`);
const otherHorns = readFileSync(`${IN}/words-3.png`);
const bare = readFileSync(`${IN}/master.png`);

let failed = 0;
const check = (ok: boolean, name: string, saw: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — saw ${saw}`);
  if (!ok) failed += 1;
};

const ask = (parent: Buffer, child: Buffer) => readConstancy({
  reader, judge, question: "horns", bilateral: true, noun: "horn", parent, child,
});

console.log("POSITIVE — the same frame twice");
const itself = await ask(horned, horned);
check(
  itself.sides.length > 0 && itself.sides.every((side) => side.extentDrift < 0.05),
  "geometry recognises a thing as itself",
  itself.sides.map((side) => `${side.side} ${(side.extentDrift * 100).toFixed(1)}%`).join(", ") || "no sides",
);
check(itself.worstDrift !== null && itself.worstDrift < 0.05,
  "and the verdict statistic — the worst side — is at the floor",
  `${((itself.worstDrift ?? 1) * 100).toFixed(1)}%`);
console.log(`        the eye (observation only): ${itself.judged
  ? `${itself.judged.same ? "same" : "REDRAWN"} — ${itself.judged.saw}`
  : "nothing usable"}`);

console.log("");
console.log("NEGATIVE — two different deliveries on the same face");
const other = await ask(horned, otherHorns);
check(other.worstDrift !== null && other.worstDrift > 0.15,
  "geometry can say REDRAWN — the arm's whole purpose",
  `worst drift ${((other.worstDrift ?? 0) * 100).toFixed(0)}% · `
    + other.sides.map((side) =>
      `${side.side} extent ${(side.extentDrift * 100).toFixed(0)}% aspect ${(side.aspectDrift * 100).toFixed(0)}%`)
      .join(" · "));
/*
  AND THE EYE IS RECORDED FAILING IT. This is why the reader's answer is an
  observation rather than a verdict: it says SAME about two horns that differ by
  a quarter of their own extent, and it does so after being made to measure
  three specifics first.
*/
console.log(`        the eye (observation only, REFUTED here): ${other.judged
  ? `${other.judged.same ? "same" : "REDRAWN"} — ${other.judged.saw}`
  : "nothing usable"}`);

console.log("");
console.log("NO-READ — a bare face");
const nothing = await ask(bare, horned);
check(nothing.saw === null && nothing.why !== null,
  "answers with a reason rather than a zero",
  nothing.why ?? `it produced a reading: ${nothing.saw}`);

console.log("");
console.log(failed === 0 ? "the arm can pass, fail, and refuse" : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
