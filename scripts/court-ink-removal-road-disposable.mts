/**
 * §10 item 3a — DOES THE REMOVAL ROAD THAT ALREADY EXISTS TAKE A TATTOO OFF?
 * (ordered fable-1314 §2; the A/B/C letter its ruling follows.)
 *
 * # Why this is the drive rather than a service drive
 *
 * opus-967 already proved the ROUTING at the real interpreter: a plainly-worded
 * ink removal parses `intent: "remove"`, `subject: "ink"`, with her filed words
 * echoed back, and `evidence` is `stated` so it never re-reads as an edit. What
 * was still unknown is what the road DOES with it — and that half is pure:
 * `matchSteps` picks the step, `chainAfterRemoval` prunes it, `composeChain`
 * recomposes the survivors. No database, no engine, no network, no credits.
 *
 * Isolating the unknown beats driving the whole service around it: the same
 * answer, deterministic, and it can go in the suite later.
 *
 * # THE THREE THINGS THAT MUST ALL HOLD
 *
 *   1  the matcher finds the INK step and only it
 *   2  the prune keeps every other step — this is the claim opus-966 §3 got
 *      wrong and fable-1310 §2 ratified: a prune is SURGICAL, not "go back"
 *   3  the composed result carries NO ink at all — not the words, and not
 *      either pointer. The words going empty while a pointer stands is "a paid
 *      removal that does not remove", which `refineDelta` names as this
 *      product's most expensive shape
 */
import {
  chainAfterRemoval,
  composeChain,
  matchSteps,
  type ChainStep,
} from "../server/castingV2/refineRemoval";

const INK_WORDS = "a fine-line swallow chest piece";
const CROP_ID = "11111111-1111-4111-8111-111111111111";
const DESIGN_ID = "22222222-2222-4222-8222-222222222222";

/* A REAL BRANCH SHAPE: an edit before the tattoo and an edit after it, so the
   surgical claim has something to be surgical about. */
const chain: ChainStep[] = [
  {
    instruction: "give her a copper shag",
    delta: { free: { hairCut: ["a copper shag"] } },
    provenance: null,
  },
  {
    instruction: "give him a fine-line swallow chest piece",
    delta: {
      free: { ink: [INK_WORDS] },
      inkApplied: { "ink:upperChest": DESIGN_ID },
      inkDelivered: { "ink:upperChest": CROP_ID },
    },
    provenance: null,
  },
  {
    instruction: "make her eyes green",
    delta: { free: { eyeColourFree: ["green"] } },
    provenance: null,
  },
];

const before = composeChain(chain);
console.log("BEFORE the removal");
console.log("  free.ink      ", JSON.stringify(before.free?.ink));
console.log("  inkApplied    ", JSON.stringify(before.inkApplied));
console.log("  inkDelivered  ", JSON.stringify(before.inkDelivered));
console.log("  other facets  ", JSON.stringify({ hairCut: before.free?.hairCut, eye: before.free?.eyeColourFree }));

/* Exactly what the real interpreter returned for "take his chest tattoo off"
   (opus-967 §3), copied from that drive's output rather than invented. */
const matches = matchSteps(chain, {
  subject: "ink",
  match: "chest tattoo",
  whole: false,
  items: [INK_WORDS],
});
console.log("\nMATCH");
console.log("  matches       ", JSON.stringify(matches));

const pruned = chainAfterRemoval(chain, matches, "ink");
const after = composeChain(pruned);
console.log("\nAFTER the removal");
console.log("  steps kept    ", JSON.stringify(pruned.map((s) => s.instruction)));
console.log("  free.ink      ", JSON.stringify(after.free?.ink));
console.log("  inkApplied    ", JSON.stringify(after.inkApplied));
console.log("  inkDelivered  ", JSON.stringify(after.inkDelivered));
console.log("  other facets  ", JSON.stringify({ hairCut: after.free?.hairCut, eye: after.free?.eyeColourFree }));

const foundOnlyInk = matches.length === 1 && matches[0]!.index === 1;
const keptTheOthers = pruned.length === 2
  && Boolean(after.free?.hairCut) && Boolean(after.free?.eyeColourFree);
const inkFullyGone = !after.free?.ink
  && (after.inkApplied === undefined || Object.keys(after.inkApplied).length === 0)
  && (after.inkDelivered === undefined || Object.keys(after.inkDelivered).length === 0);

console.log("\n──────── THE LETTER ────────");
console.log(`1 matcher finds the ink step and only it   ${foundOnlyInk ? "YES" : "NO"}`);
console.log(`2 every other step survives (surgical)     ${keptTheOthers ? "YES" : "NO"}`);
console.log(`3 no ink left — words AND both pointers    ${inkFullyGone ? "YES" : "NO"}`);
const letter = foundOnlyInk && keptTheOthers && inkFullyGone ? "A" : (foundOnlyInk ? "B" : "C");
console.log(`\nLETTER ${letter} — ${
  letter === "A" ? "the prune IS the removal action; no repaint lane is needed beside it"
  : letter === "B" ? "the road reaches ink and misfires; 3a is a repair, not a new lane"
  : "the road does not reach ink; 3a is the build as designed"}`);

process.exit(letter === "A" ? 0 : 1);
