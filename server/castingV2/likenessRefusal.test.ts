import { describe, expect, it } from "vitest";

import { SYSTEM_PROMPT_FOR_TESTS } from "./interpreter";
import { castingBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";

/**
 * We do not cast a named person or somebody else's character.
 *
 * "mastercheif look-alike from the halo series" used to compile cleanly as a
 * photoreal human, charge 160 credits, and put "Master Chief look-alike from
 * Halo" into the paid prompt as CASTING CATEGORY (ABSOLUTE). Two things wrong
 * with that at once: it is a likeness we should not manufacture — the mirror of
 * the ruling that a customer's own cast is their work — and it is one the frame
 * cannot deliver anyway, because a plain studio portrait with no costume, mask
 * or props strips away exactly what makes such a character recognisable.
 *
 * Verified live at the time of the fix: six likeness phrasings refused, four
 * genre briefs cast, nothing over-refused. The mapping lives in a language
 * model's instructions, so what is assertable offline is that both halves are
 * still written down — the refusal AND the carve-out that keeps genres castable.
 */

// Whitespace-normalised: the prompt is hard-wrapped, so a phrase can span a
// line break and a naive toContain would fail on formatting rather than on
// meaning.
const PROMPT = SYSTEM_PROMPT_FOR_TESTS().split(/\s+/).join(" ");

describe("the likeness rule survives in the prompt", () => {
  it("names the refusal", () => {
    expect(PROMPT).toMatch(/SPECIFIC PERSON OR CHARACTER/);
    expect(PROMPT).toMatch(/Master Chief from Halo/);
  });

  it("covers the softer phrasings, which are the same request", () => {
    for (const phrasing of ["look-alike", "inspired by", "in the style of", "reminds me of"]) {
      expect(PROMPT).toContain(phrasing);
    }
  });

  it("keeps the carve-out, so a genre is still castable", () => {
    // Without this the rule over-applies and "a space marine" stops working —
    // the same overshoot the restraint doctrine made before its other half was
    // written down.
    expect(PROMPT).toMatch(/A GENRE is not a character/);
    expect(PROMPT).toMatch(/space marine/);
  });
});

describe("the refusal is free and says the way out", () => {
  it("refuses before anything is charged, and names what to do instead", async () => {
    const compile = castingBriefCompiler({
      briefText: "a Spider-Man look-alike",
      candidateCount: 8,
      rollSeed: "likeness",
      engine: {
        id: "test",
        complete: async () => ({
          text: JSON.stringify({ cohort: "other", reads: null }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });
    await expect(compile).rejects.toMatchObject({ code: "unsupported_cohort" });
    await compile.catch((error: Error) => {
      expect(error.message).toContain("nobody in particular");
      expect(error.message).toContain("not a character from a game or film");
      // The refusal must always say the money is safe — it runs before the claim.
      expect(error.message).toContain("not been charged");
    });
  });
});
