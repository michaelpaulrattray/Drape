import { describe, expect, it } from "vitest";

import { composeCandidatePrompt, resolveCandidateIdentity } from "./cohortPhotorealHuman";
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
      creativeRegister: null,
  poolTendencies: NO_TENDENCIES,
  wardrobe: null,
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

/** The eight SUBJECT lines a brief produces, which is where heritage lands. */
function subjectLines(intent: CastingIntent, seed = "pin-seed"): string[] {
  return Array.from({ length: 8 }, (_, position) => {
    const prompt = composeCandidatePrompt({
      intent,
      resolved: resolveCandidateIdentity(intent, position, seed),
      archetype: "street cast",
      seed: position,
    });
    const line = prompt.split("\n").find((row) => row.startsWith("SUBJECT:"));
    if (line === undefined) throw new Error("no SUBJECT line in the composed prompt");
    return line;
  });
}

const HERITAGE_WORDS = [
  "heritage",
];

describe("a stated skin tone pins the sheet", () => {
  it("⚠ THE PIN — with a tone stated and heritage unstated, NO slice names a heritage", () => {
    const lines = subjectLines({ ...BASE, statedSkin: PORCELAIN });

    expect(lines).toHaveLength(8);
    for (const line of lines) {
      for (const word of HERITAGE_WORDS) {
        expect(line, `no invented heritage may outrank her stated tone: ${line}`).not.toContain(word);
      }
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
    const lines = subjectLines(BASE);
    const named = lines.filter((line) => line.includes("heritage"));

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

    const lines = subjectLines(intent);
    for (const line of lines) {
      expect(line, "the stated heritage must survive").toContain("West African heritage");
    }
  });

  it("⚠ THE GRAMMAR — a SUBJECT line with no heritage is well-formed, asserted on the STRING", () => {
    /*
     * `describeHeritage` has always returned "" for an empty list, but the
     * template held the comma — `…${describeAge(…)}, ${describeHeritage(…)}.`
     * — so the first brief to resolve with no heritage would have shipped
     * `apparent age 44-46 years, .` into a paid prompt. Nothing could do that
     * until a stated tone could suppress the spread, so this arm is the whole
     * guard against a defect that ships as a typo rather than an exception.
     */
    const lines = subjectLines({ ...BASE, statedSkin: PORCELAIN });

    for (const line of lines) {
      expect(line, `dangling separator in: ${line}`).not.toMatch(/,\s*\./);
      expect(line, `doubled separator in: ${line}`).not.toMatch(/,\s*,/);
      expect(line.trim().endsWith(".") || line.includes(". "), `unterminated: ${line}`).toBe(true);
    }
  });
});
