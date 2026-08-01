import { describe, expect, it } from "vitest";

import { resolveCandidateIdentity, briefStatesSexCodedFacialHair } from "./cohortPhotorealHuman";
import type { CastingIntent } from "./castingIntent";

/**
 * A sex-coded stated fact resolves an unstated sex.
 *
 * Founder ruling, 2026-08-01, extending H11 and seed-law clause 6 to runtime
 * resolution. "A 25 year old heavy metal bogan with a beard" left sex open, so
 * the resolver alternated it, and four candidates came back female carrying a
 * stated beard — androgynous faces nobody asked for. Two axes each behaving
 * correctly in isolation produced a sheet that was wrong.
 *
 * **This is the first cross-axis implication in the resolver** — a fact on one
 * axis constraining another — and it is hand-coded. M7's registry should get a
 * declared place for these so the next one is a data change rather than a
 * discovery.
 */

function intentOf(partial: Partial<CastingIntent>): CastingIntent {
  return {
    cohort: "photoreal_human",
    role: null,
    characterNotes: null,
    sex: null,
    ageBand: null,
    agePhase: null,
    heritage: [],
    build: null,
    energy: null,
    archetype: null,
    variationAxis: null,
    look: null,
    reads: [],
    ...partial,
  } as CastingIntent;
}

function sexesOf(intent: CastingIntent, rollSeed = "sexcode") {
  return Array.from({ length: 8 }, (_, position) =>
    resolveCandidateIdentity(intent, position, rollSeed).sex,
  );
}

describe("a stated beard resolves an unstated sex", () => {
  it("casts the whole sheet male", () => {
    const sexes = sexesOf(intentOf({ role: "heavy metal bogan", characterNotes: "with a beard" }));
    expect(sexes).toEqual(Array(8).fill("male"));
  });

  it("holds across seeds, because alternation was the defect", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const sexes = sexesOf(intentOf({ characterNotes: "a full beard and heavy stubble" }), seed);
      expect(new Set(sexes).size, seed).toBe(1);
      expect(sexes[0], seed).toBe("male");
    }
  });

  it("reads the fact from either free-text field", () => {
    expect(sexesOf(intentOf({ role: "a bearded woodworker" }))).toEqual(Array(8).fill("male"));
    expect(sexesOf(intentOf({ characterNotes: "thick moustache" }))).toEqual(Array(8).fill("male"));
  });
});

describe("an explicit statement always wins", () => {
  it("renders a bearded woman exactly as written", () => {
    /*
      The rule must never second-guess an explicit statement. A stated sex is
      read before the implication, so this is untouched.
    */
    const sexes = sexesOf(intentOf({ sex: "female", characterNotes: "a full beard" }));
    expect(sexes).toEqual(Array(8).fill("female"));
  });

  it("renders a bearded non-binary person exactly as written", () => {
    const sexes = sexesOf(intentOf({ sex: "nonbinary", characterNotes: "a short beard" }));
    expect(sexes).toEqual(Array(8).fill("nonbinary"));
  });
});

describe("the control — nothing else changes", () => {
  it("still alternates when the brief carries no sex-coded fact", () => {
    // Without this the rule could be passing by casting every sheet male.
    const sexes = sexesOf(intentOf({ role: "an oncology nurse" }));
    expect(new Set(sexes).size).toBeGreaterThan(1);
  });

  it("does not read absence of facial hair as coding for sex", () => {
    /*
      "Clean-shaven", "beardless" and "unshaven" are facial-hair facts that code
      for nothing — every woman is clean-shaven. Reading them as male would
      invent a lock from a fact that carries none, which is the opposite of the
      restraint doctrine.
    */
    for (const notes of ["clean-shaven", "beardless", "unshaven", "a smooth jaw"]) {
      expect(briefStatesSexCodedFacialHair(notes), notes).toBe(false);
      expect(new Set(sexesOf(intentOf({ characterNotes: notes }))).size, notes).toBeGreaterThan(1);
    }
  });

  it("recognises growth and only growth", () => {
    for (const stated of ["a beard", "bearded", "heavy stubble", "a goatee", "sideburns"]) {
      expect(briefStatesSexCodedFacialHair(stated), stated).toBe(true);
    }
    for (const stated of ["long hair", "green eyes", "freckles"]) {
      expect(briefStatesSexCodedFacialHair(stated), stated).toBe(false);
    }
  });
});
