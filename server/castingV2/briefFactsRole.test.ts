import { describe, expect, it } from "vitest";

import { readBriefFacts } from "./rollProjection";
import { castingBriefCompiler } from "./briefCompiler";
import { promoteStatedRole } from "./heritagePromotion";
import type { CastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * The casting category must reach the echo.
 *
 * Founder's round-6 finding: "a runway model early 20s" echoed with no mention
 * of the category. The interpreter was innocent — it captured
 * `role: "runway model"` on that brief and on every phrasing tried live. The
 * break was here, in the projection: the echo's facts were read from
 * `lockContract`, which is the VALIDATOR's input and has no role field, because
 * the validator compares enum values and a category is free text.
 *
 * So the loudest lock on the sheet — the one the prompt carries as "CASTING
 * CATEGORY (ABSOLUTE)" — was the one fact the sentence could not see. This
 * pins the seam.
 */

function engineReturning(role: string | null): TextEngine {
  return {
    id: "test:interpreter",
    complete: async () => ({
      text: JSON.stringify({
        cohort: "photoreal_human",
        role,
        /*
          The axis tracks the role, because the real interpreter sets "look"
          only when the brief asks for a KIND OF FACE — a modelling or campaign
          casting. Hard-coding it for a brief with no category described an
          intent the interpreter would never return, and the deterministic
          category repair reads exactly that pair as evidence a category was
          recognised and dropped.
        */
        variationAxis: role ? "look" : null,
        reads: null,
      }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  };
}

const PHRASINGS = ["a runway model", "runway model", "catwalk model", "high-fashion model"];

/*
  ⚠ **THE PROJECTION IS EXACTLY WHAT SOMETHING READS — #1288, 2026-09-26.**

  `open` and `variationAxis` were computed here and shipped to the client for the
  echo's "… were left to the roll" clause. He retired the clause, and nothing else
  in the product had ever read either field, so both left with it — a field
  computed on every sheet load and read by nobody is the shape this repository has
  paid for repeatedly (#1204, #1217).

  Nothing else guards a wire field going dead, which is exactly how one comes
  BACK: a later shift adds `open` again for a surface that is then cut, and the
  projection quietly grows a fourth key no reader wants. So the key set is
  asserted whole rather than field by field, and a new key is a deliberate act
  that edits this line and says who reads it.
*/
describe("the brief-facts projection carries nothing nobody reads", () => {
  it("projects exactly role, locks and statedAccessories", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a runway model early 20s",
      candidateCount: 8,
      rollSeed: "projection-shape",
      engine: engineReturning("runway model"),
    });
    const facts = readBriefFacts(compiled.lockContract, compiled.compiledBrief, "a runway model early 20s");
    expect(Object.keys(facts).sort()).toEqual(["locks", "role", "statedAccessories"]);
    /* THE POSITIVE CONTROL: it is a real projection, not an empty object. */
    expect(facts.role).toBe("runway model");
  });
});

describe("readBriefFacts surfaces the category", () => {
  it.each(PHRASINGS)("compiling %j puts the category where the echo can see it", async (phrase) => {
    const compiled = await castingBriefCompiler({
      briefText: `${phrase} early 20s`,
      candidateCount: 8,
      rollSeed: `role:${phrase}`,
      engine: engineReturning(phrase.replace(/^an? /, "")),
    });
    const facts = readBriefFacts(compiled.lockContract, compiled.compiledBrief);
    expect(facts.role).toBe(phrase.replace(/^an? /, ""));
  });

  it("is null when the brief named no category, rather than inventing one", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "someone in their 30s",
      candidateCount: 8,
      rollSeed: "no-role",
      engine: engineReturning(null),
    });
    expect(readBriefFacts(compiled.lockContract, compiled.compiledBrief).role).toBeNull();
  });

  it("bounds and flattens the category, because it is the one free-text field here", () => {
    // Everything else in this projection is enum-checked. This one cannot be,
    // so it is capped and stripped instead of trusted.
    const facts = readBriefFacts(
      {},
      { intent: { role: `  a very\n\tlong   category ${"x".repeat(200)}  ` } },
    );
    expect(facts.role!.length).toBeLessThanOrEqual(60);
    expect(facts.role).not.toMatch(/[\n\t]/);
    expect(facts.role!.startsWith("a very long category")).toBe(true);
  });
});

/**
 * #1122 — THE FOUNDER'S OWN SENTENCE, HANDED BACK CUT INSIDE A WORD.
 *
 * Driven end to end through the two real functions, because that is how the
 * ghost audit found it and because a claim about what a customer READS is
 * exactly the kind that gets written into a document and stays wrong.
 *
 * On a brief naming no category, `promoteStatedRole` installs the brief's own
 * opening as the role so the CASTING CATEGORY block has something to say — it
 * caps at a word boundary, because this bug was found and fixed there once. The
 * projection then re-cut the same string at 60 with a bare slice, and the sheet
 * said, at full ink, with no control to correct it:
 *
 *     Everyone on this sheet is cast as a beauty campaign casting, luminous
 *     skin, wide-set eyes, cro
 */
const FOUNDER_BRIEF =
  "a beauty campaign casting, luminous skin, wide-set eyes, cropped platinum hair, strong brows";

function lookIntent(): CastingIntent {
  return {
    cohort: "photoreal_human",
    role: null,
    /* The one signal the promotion reads: the brief asks for a kind of face. */
    variationAxis: "look",
    heritage: [],
    reads: [],
  } as unknown as CastingIntent;
}

describe("the role the sheet shows is never cut inside a word (#1122)", () => {
  it("does not hand the founder his own sentence back broken", () => {
    const promoted = promoteStatedRole(lookIntent(), FOUNDER_BRIEF);
    const shown = readBriefFacts({}, { intent: promoted }, FOUNDER_BRIEF).role;

    expect(shown).not.toContain("cro");
    expect(shown).toBe("a beauty campaign casting, luminous skin, wide-set eyes");
    /* Every word shown is a whole word of his own sentence. */
    expect(FOUNDER_BRIEF.startsWith(shown!)).toBe(true);
    expect(FOUNDER_BRIEF[shown!.length]).toMatch(/[\s,]/);
  });

  it("leaves no dangling separator for the echo's own full stop to land on", () => {
    // The echo writes the role, then the rest of its sentence, then ".". A
    // value ending in a comma renders "wide-set eyes,." on the sheet.
    const promoted = promoteStatedRole(lookIntent(), FOUNDER_BRIEF);
    expect(readBriefFacts({}, { intent: promoted }, FOUNDER_BRIEF).role).not.toMatch(/[,;:—-]$/);
  });

  it("keeps a stated accessory whole, rather than dropping it for a half word", () => {
    /*
      The sibling, and it is not typography: `tokensComeFromBrief` reads EVERY
      token, so a cut landing inside a word leaves one the brief does not
      contain and the accessory is dropped from the sentence altogether —
      silently, and against the echo's own contract that a stated fact is never
      dropped by any road.
    */
    const briefText = "she wears heavy tortoiseshell reading spectacles with thin gold temples";
    /* 40 lands inside "spectacles": the bare slice left "w", which is not a
       word in her brief, so the whole accessory failed containment and the
       sentence said nothing about it. */
    const stated = "heavy tortoiseshell reading spectacles with thin gold temples";
    const facts = readBriefFacts({}, { intent: { statedAccessories: [stated] } }, briefText);

    expect(facts.statedAccessories).toEqual(["heavy tortoiseshell reading spectacles"]);
  });
});
