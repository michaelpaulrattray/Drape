import { describe, expect, it } from "vitest";

import { resolveCandidateIdentity } from "./cohortPhotorealHuman";
import {
  EMPTY_STATED_HAIR,
  EMPTY_STATED_SKIN,
  NO_TENDENCIES,
  type CastingIntent,
} from "./castingIntent";

/**
 * A STATED SKIN TONE PINS THE EIGHT.
 *
 * Founder ruling, verbatim (2026-08-25): *"a typed skin tone should pin all 8
 * otherwise you have a caucasian african man or a african trying to be white
 * skin. but if you asked for a african albino you would still get it."*
 *
 * ⚠ WHAT THIS REPAIRS IS A FIGHT, NOT AN ABSENCE. Both facts were already in
 * every one of his eight prompts: the shared block said `SKIN: pale porcelain,
 * heavily weathered — exactly as described.` while each slice's SUBJECT line
 * named a different invented heritage — and `PRIORITY WHEN INSTRUCTIONS
 * CONFLICT` declares the SUBJECT block absolute. That rule was written for facts
 * the USER stated; the heritage was invented by the variance spread. **An
 * invented fact was riding in the absolute block and outranking a stated one.**
 * On his roll 214 one frame of eight read as porcelain and four plainly did not.
 *
 * Nothing is inferred from anything. A stated tone never narrows heritage to a
 * "matching" one — that map is a stereotype table and is REFUSED ON THE RECORD
 * (fable-1646) — and a stated heritage is never overridden by a stated tone.
 */

const BASE: CastingIntent = {
  cohort: "photoreal_human",
  role: "cybernetically augmented man",
  statedHair: EMPTY_STATED_HAIR,
  statedSkin: EMPTY_STATED_SKIN,
  statedAccessories: [],
  statedInk: null,
  poolTendencies: NO_TENDENCIES,
  wardrobe: null,
  statedWardrobe: null,
  characterNotes: null,
  sex: "male",
  ageBand: "40s",
  agePhase: "mid",
  heritage: [],
  build: null,
  energy: null,
  archetype: null,
  variationAxis: null,
  look: null,
  reads: [],
  composedDirection: null,
};

const PORCELAIN = { tone: "pale porcelain", character: "heavily weathered" };

/**
 * The eight heritages a brief resolves — asked of the RESOLVER, since #1490 act 2.
 *
 * ⚠ **THESE ARMS READ A COMPOSED PROMPT STRING UNTIL ACT 2, AND THE RULING THEY
 * CARRY NEVER LIVED THERE.** The helper was `subjectLines`: it composed the house
 * road's prompt and pulled the `SUBJECT:` line out of it, because in August 2026
 * that line was where an invented heritage reached the engine. Act 2 deleted the
 * composer — on the author road the customer's own words reach the engine and no
 * SUBJECT line is composed at all — so a prompt-string assertion here would have
 * had nothing to read.
 *
 * His ruling is unaffected, and that is the point: *"a typed skin tone should pin
 * all 8"* is a fact about WHO GETS CAST, and who gets cast is
 * `resolveCandidateIdentity`'s answer — written to `resolvedIdentity` on every
 * author-road roll, and read from there by the follow anchor, the refine pronouns
 * and the facet values. So the arms move one layer in, to the decision itself,
 * where they no longer pass or fail on how a retired block phrased the result.
 *
 * ⚠ **One arm did NOT survive the move and is recorded rather than quietly
 * dropped** — *"THE GRAMMAR — a SUBJECT line with no heritage is well-formed,
 * asserted on the STRING"*. It guarded a dangling separator (`apparent age 44-46
 * years, .`) in a template that no longer exists, and there is no string left for
 * it to assert on. Its subject died with the composer; it is not re-pointable,
 * because a resolver returning `[]` has no punctuation.
 */
function resolvedHeritages(intent: CastingIntent, seed = "pin-seed") {
  return Array.from({ length: 8 }, (_, position) =>
    resolveCandidateIdentity(intent, position, seed).heritage,
  );
}

/** The heritages as comparable strings, for the spread arm. */
function heritageNames(intent: CastingIntent, seed = "pin-seed"): string[] {
  return resolvedHeritages(intent, seed).map((components) =>
    components.map((component) => `${component.heritage}:${component.pct}`).join("+"),
  );
}

describe("a stated skin tone pins the sheet", () => {
  it("⚠ THE PIN — with a tone stated and heritage unstated, NO slice resolves a heritage", () => {
    const heritages = resolvedHeritages({ ...BASE, statedSkin: PORCELAIN });

    expect(heritages).toHaveLength(8);
    for (const components of heritages) {
      expect(
        components,
        `no invented heritage may outrank her stated tone: ${JSON.stringify(components)}`,
      ).toEqual([]);
    }
  });

  it("⚠ THE CONTROL — with NO tone stated, heritage still spreads across the eight", () => {
    /*
     * The load-bearing arm for everyone outside this ruling. Unstated heritage
     * is "a prime treatment-variation axis" by a separate founder ruling, and a
     * repair that suppressed it unconditionally would quietly turn every
     * ordinary sheet into eight people of one heritage — a far worse defect
     * than the one being fixed, and invisible without this arm.
     */
    const named = heritageNames(BASE).filter((name) => name !== "");

    expect(named.length, "every slice should still carry a heritage").toBe(8);
    expect(
      new Set(named).size,
      "and they must differ — a spread that returns one value is not a spread",
    ).toBeGreaterThan(1);
  });

  it("⚠ THE ALBINO CASE — both stated, both obeyed, and it needs no special case", () => {
    /*
     * His own example and the clause that makes the rule a rule rather than a
     * preference. A stated heritage is emitted untouched BESIDE the stated
     * tone; the tone does not drag the heritage toward a "consistent" one and
     * the heritage does not overwrite the tone.
     */
    const intent: CastingIntent = {
      ...BASE,
      statedSkin: { tone: "very pale, albino", character: null },
      heritage: [{ heritage: "West African", pct: 100 }],
    };

    for (const components of resolvedHeritages(intent)) {
      expect(components, "the stated heritage must survive").toEqual([
        { heritage: "West African", pct: 100 },
      ]);
    }
  });
});
