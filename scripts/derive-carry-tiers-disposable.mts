/**
 * THE TWO CARRY TIERS, DERIVED FROM THE VOCABULARY WE ALREADY HAVE.
 *
 * fable-158 records the founder's addendum to D-241: an edited cast carries its
 * details in two ways, and they have different verification bars.
 *
 *   REFERENCE-CARRIED (things)    hair, earrings, glasses, tattoos — carried as
 *                                 crop references and COPIED onto the master
 *                                 each render. Bar: matches its reference.
 *   WORD-CARRIED (surfaces)       freckles, skin texture — carried by their
 *                                 recorded language and REGENERATED each
 *                                 render. Bar: delivers what the words say,
 *                                 with no cross-version stability claim.
 *
 * The order is explicit that the split must be DERIVED and not hand-authored —
 * "`isSurfaceFacet` and the statedDetails vocabulary are the existing rails …
 * DO NOT hand-author a second list (derive-never-mirror)". So this script owns
 * no list of its own. It reads `allFacets()`, and for each facet it reads the
 * amplitude the program already recorded for that facet's subjects.
 *
 * # The derivation, in one paragraph
 *
 * `CHANGE_AMPLITUDE` already sorts every free subject into three classes, and
 * those classes ARE the tier question asked in different words:
 *
 *   SURFACE       a few levels over a wide area. There is no silhouette to
 *                 crop, so there is nothing a reference could hold. WORD.
 *   REPLACEMENT   the thing is opaque where it is and absent where it is not —
 *                 an ear, a hoop, ink, a hairstyle. That IS a croppable thing.
 *                 REFERENCE.
 *   RESTRUCTURE   a boundary moves while the interior stays what it was. A
 *                 crop of it is a crop of the face itself. AMBIGUOUS — and the
 *                 founder's own examples of ambiguity land in exactly this
 *                 class, which is the check that the derivation is honest
 *                 rather than fitted.
 *
 * A facet no free subject answers (an axis-only facet, `makeup`) is ambiguous
 * by the same rule that makes `isSurfaceFacet` refuse it: there is nothing
 * underneath to read.
 *
 *   npx tsx scripts/derive-carry-tiers-disposable.mts
 */
import { allFacets, facetHeading, subjectsOfFacet } from "../server/castingV2/refineFacets";
import { CHANGE_AMPLITUDE } from "../server/castingV2/changeAmplitude";
import { isSurfaceFacet } from "../server/castingV2/changeAmplitude";

/* The three amplitude constants are private to changeAmplitude.ts, so they are
   recovered from the table itself rather than restated — a copied `4` here
   would be exactly the mirrored list the order forbids. */
const levelsOf = (facet: string): number[] =>
  subjectsOfFacet(facet).map((subject) => CHANGE_AMPLITUDE[subject].levels);

const SURFACE_LEVEL = CHANGE_AMPLITUDE.marks.levels; /* the measured surface member */
const REPLACEMENT_LEVEL = CHANGE_AMPLITUDE.statedAccessories.levels; /* the measured replacement member */

type Tier = "reference" | "word" | "ambiguous";

function tierOf(facet: string): { tier: Tier; because: string } {
  const subjects = subjectsOfFacet(facet);
  if (subjects.length === 0) {
    return { tier: "ambiguous", because: "no free subject answers it — an axis-only facet, nothing underneath to read" };
  }
  if (isSurfaceFacet(facet)) {
    return { tier: "word", because: "every subject is SURFACE — a few levels over a wide area, no silhouette to crop" };
  }
  const levels = levelsOf(facet);
  if (levels.every((level) => level === REPLACEMENT_LEVEL)) {
    return { tier: "reference", because: "REPLACEMENT — opaque where it is, absent where it is not: a croppable thing" };
  }
  const mixed = new Set(levels).size > 1;
  return {
    tier: "ambiguous",
    because: mixed
      ? "its subjects disagree on amplitude"
      : "RESTRUCTURE — a boundary moves while the interior stays itself; its crop is a crop of the face",
  };
}

const rows = allFacets()
  .map((facet) => ({ facet, heading: facetHeading(facet), ...tierOf(facet) }))
  .sort((a, b) => a.tier.localeCompare(b.tier) || a.facet.localeCompare(b.facet));

const show = (tier: Tier, title: string) => {
  const of = rows.filter((row) => row.tier === tier);
  console.log(`\n${title}  (${of.length} of ${rows.length})`);
  for (const row of of) {
    console.log(`  ${row.facet.padEnd(20)} ${row.heading.padEnd(16)} ${row.because}`);
  }
};

console.log("THE TWO CARRY TIERS — derived from CHANGE_AMPLITUDE, which nothing here restates");
show("reference", "REFERENCE-CARRIED — crop travels, NBP copies it, bar is 'matches its reference'");
show("word", "WORD-CARRIED — language travels, the render regenerates it, bar is 'delivers what the words say'");
show("ambiguous", "AMBIGUOUS — for the founder's thirty-second taste pass");

/*
  THE CHECK THAT THE DERIVATION IS NOT FITTED.

  fable-158 named five facets it expected to sit ambiguously, from taste and
  before seeing any of this. They were not consulted while the rule above was
  written. How many the rule actually lands on is printed rather than claimed.
*/
const HIS_EXAMPLES = ["makeup", "lips", "brows"]; /* those of his five that exist in the vocabulary at all */
console.log("\nTHE FOUNDER'S OWN AMBIGUOUS EXAMPLES, against the derived rule");
for (const facet of HIS_EXAMPLES) {
  const row = rows.find((entry) => entry.facet === facet);
  console.log(`  ${facet.padEnd(20)} ${row ? `derived: ${row.tier.toUpperCase()}` : "NOT IN THE VOCABULARY AT ALL"}`);
}
console.log("  lip gloss / lip colour     folded into `lips` — the vocabulary has no separate slot");
console.log("  nails                      NOT IN THE VOCABULARY AT ALL — no facet, no subject, no region");

process.exit(0);
