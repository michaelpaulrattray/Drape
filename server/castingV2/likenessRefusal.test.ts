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
          /*
            ⚠ THIS DROVE THE READER WITH `cohort: "other"` UNTIL #1490 ACT 1,
            which is the HOUSE road's two-valued vocabulary and produced
            an unsupported cohort. The author road asks the FOUR-valued subject
            question, and a named character comes back as `likeness` by name —
            one of the two walls the ruling KEEPS (#131 slice C). The wall is
            the same wall and it is still free; only the word the reader says
            has changed.
          */
          text: JSON.stringify({ cohort: "likeness", reads: null }),
          latencyMs: 1,
          provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
        }),
      } satisfies TextEngine,
    });
    await expect(compile).rejects.toMatchObject({ code: "likeness" });
    await compile.catch((error: Error) => {
      expect(error.message).toContain("nobody in particular");
      /* ⚠ The wall's own words, and they are the LIKENESS message's rather than
         the retired cohort message's (#1490 act 1) — it says "game, film or
         show". Asserted as the bytes the customer reads, not near them. */
      expect(error.message).toContain("not a character from a game, film or show");
      /* The way out, which is what this arm's title promises. */
      expect(error.message).toContain("Describe the kind of face you want");
      // The refusal must always say the money is safe — it runs before the claim.
      expect(error.message).toContain("not been charged");
    });
  });
});
