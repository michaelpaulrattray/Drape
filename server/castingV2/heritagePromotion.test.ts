import { describe, expect, it } from "vitest";

import { promoteStatedHeritage } from "./heritagePromotion";
import type { CastingIntent } from "./castingIntent";

/**
 * A stated heritage becomes a lock even when the interpreter puts it elsewhere.
 *
 * Measured on the founder's own brief — "a young male Mediterranean model
 * inspired by versace editorial" — five identical runs: four captured the
 * heritage lock, one folded the word into `role` and left the lock empty. That
 * one run produced the sheet they reported: eight men, most of them visibly not
 * Mediterranean, under a sentence promising they were.
 *
 * With no lock the resolver varies heritage across all eight, so the prompt
 * says Mediterranean in the casting category and Nordic in the subject line at
 * the same time.
 */

function intent(partial: Partial<CastingIntent> = {}): CastingIntent {
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

describe("promoteStatedHeritage", () => {
  it("recovers the founder's exact miss", () => {
    const recovered = promoteStatedHeritage(
      intent({ role: "a young male Mediterranean model inspired by editorial" }),
      "a young male Mediterranean model inspired by versace editorial",
    );
    expect(recovered.heritage).toEqual([{ heritage: "Mediterranean", pct: 100 }]);
  });

  it.each([
    ["an Italian man in his 30s", "Mediterranean"],
    ["a Nigerian creator, 20s", "West African"],
    ["a Korean model", "East Asian"],
    ["a Jamaican founder", "Afro-Caribbean"],
    ["a Lebanese woman, 40s", "Middle Eastern"],
  ])("recovers %j as %s", (brief, expected) => {
    expect(promoteStatedHeritage(intent(), brief).heritage[0].heritage).toBe(expected);
  });

  it("never overrides a heritage the interpreter did capture", () => {
    // A backstop, not a second opinion. The interpreter read the whole
    // sentence; this only ever fills a gap.
    const kept = promoteStatedHeritage(
      intent({ heritage: [{ heritage: "Nordic", pct: 100 }] }),
      "a Mediterranean model",
    );
    expect(kept.heritage).toEqual([{ heritage: "Nordic", pct: 100 }]);
  });

  it("stays out of it when the brief names two", () => {
    // Ambiguity is not a statement, and choosing between them would be
    // inventing rather than recovering.
    expect(promoteStatedHeritage(intent(), "Italian and Japanese parents").heritage).toEqual([]);
  });

  it("leaves an ordinary brief alone", () => {
    expect(promoteStatedHeritage(intent(), "a retired boxer with a broken nose").heritage).toEqual([]);
  });

  it("matches whole words only", () => {
    // "Indianapolis" is not a heritage.
    expect(promoteStatedHeritage(intent(), "a creator from Indianapolis").heritage).toEqual([]);
  });
});
