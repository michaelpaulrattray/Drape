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
 * opening as the role so the engine's category readers have something to say —
 * it caps at a word boundary, because this bug was found and fixed there once.
 * The projection then re-cut the same string at 60 with a bare slice, and the
 * sheet said, at full ink, with no control to correct it:
 *
 *     Everyone on this sheet is cast as a beauty campaign casting, luminous
 *     skin, wide-set eyes, cro
 *
 * ⚠ **AND THE PRODUCT QUESTION UNDER IT IS ANSWERED — #1129, his C of
 * 2026-09-23: A BORROWED CATEGORY IS NOT SHOWN AT ALL.** So the two arms that
 * pinned the CUT on his own brief now pin its ABSENCE, and the cut itself is
 * pinned where it still happens — on a category the interpreter really read.
 * Both halves are kept on purpose: #1122 was a real defect on a real brief, and
 * a suite that forgot the cut would let the next long interpreted category
 * arrive broken.
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

describe("the sheet does not repeat her own sentence back as the category (#1129)", () => {
  it("says nothing about a category on the founder's own brief", () => {
    const promoted = promoteStatedRole(lookIntent(), FOUNDER_BRIEF);
    /* THE POSITIVE CONTROL, and it is the whole point of driving the real
       promotion: it DID borrow — so the null below is the projection's answer
       and not an intent that never had a role. */
    expect(promoted.role).toBe(
      "a beauty campaign casting, luminous skin, wide-set eyes, cropped platinum hair,",
    );
    expect(promoted.roleFromBriefText).toBe(true);

    expect(readBriefFacts({}, { intent: promoted }, FOUNDER_BRIEF).role).toBeNull();
  });

  it("still shows a category the interpreter read in her words", () => {
    /*
      THE NEGATIVE CONTROL, and the arm that decides whether this change is a
      fix or a removal. A category she named is the single fact the sheet is
      loudest about on purpose; only the BORROWED one goes.
    */
    const named = { ...lookIntent(), role: "an oncology nurse" } as CastingIntent;
    expect(named.roleFromBriefText).toBeUndefined();
    expect(readBriefFacts({}, { intent: named }, "an oncology nurse in her 50s").role).toBe(
      "an oncology nurse",
    );
  });

  it("still cuts a long interpreted category at a word boundary (#1122's own half)", () => {
    /*
      The cut did not leave with its most famous input. A model behind a seam
      can miss the 12-word ask, and this is the belt to those braces — pinned on
      a role that is HERS, which is the only kind that now reaches the sentence.
    */
    const long = {
      ...lookIntent(),
      role: "a retired heavyweight boxer turned neighbourhood barber with forearm scars",
    } as CastingIntent;
    const shown = readBriefFacts({}, { intent: long }, "").role!;

    expect(shown.length).toBeLessThanOrEqual(60);
    expect(long.role!.startsWith(shown)).toBe(true);
    /* No half word, and no dangling separator for the echo's full stop. */
    expect(long.role![shown.length]).toMatch(/\s/);
    expect(shown).not.toMatch(/[,;:—-]$/);
  });

  it("says nothing about a category when the reader's reply could not be parsed", async () => {
    /*
      THE LAW-7 SIBLING, driven through the real compiler: `fallbackIntent`
      borrows the brief's first eighty characters exactly as the promotion does
      — with a bare slice, and the projection's own word-boundary cap was the
      only thing standing between that and a half word on the sheet. One rule
      covers both roads because both roads record the same fact.
    */
    const unparsable: TextEngine = {
      id: "test:interpreter",
      complete: async () => ({
        text: "not json at all",
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      }),
    };
    const compiled = await castingBriefCompiler({
      briefText: FOUNDER_BRIEF,
      candidateCount: 8,
      rollSeed: "fallback-role",
      engine: unparsable,
    });

    /* The POSITIVE CONTROL that this is the fallback road at all. */
    expect((compiled.compiledBrief as { interpreted?: boolean }).interpreted).toBe(false);
    expect(readBriefFacts(compiled.lockContract, compiled.compiledBrief, FOUNDER_BRIEF).role)
      .toBeNull();
  });

  it("drops a borrowed category on a row written before the field existed, on the fallback road", () => {
    /*
      ⚠ THE STATED LIMIT, pinned so it cannot quietly become a promise.

      A live sheet compiled before `roleFromBriefText` shipped carries no such
      field. The fallback road still has a fact on the row (`interpreted:
      false`), so it is covered; the PROMOTION road has none, and that row keeps
      its sentence until it expires. Closing that would mean re-deriving the
      promotion's rule inside the projection — a second implementation of the
      cap, which is what #1122 was — or back-filling a stored row to say
      something it never said.
    */
    const legacyFallbackRow = { interpreted: false, intent: { role: FOUNDER_BRIEF.slice(0, 80) } };
    expect(readBriefFacts({}, legacyFallbackRow, FOUNDER_BRIEF).role).toBeNull();

    const legacyPromotedRow = { interpreted: true, intent: { role: FOUNDER_BRIEF.slice(0, 54) } };
    expect(readBriefFacts({}, legacyPromotedRow, FOUNDER_BRIEF).role).not.toBeNull();
  });

  it("keeps a stated accessory whole, rather than dropping it for a half word", () => {
    /*
      #1122's sibling, and it is not typography: `tokensComeFromBrief` reads
      EVERY token, so a cut landing inside a word leaves one the brief does not
      contain and the accessory is dropped from the sentence altogether —
      silently, and against the echo's own contract that a stated fact is never
      dropped by any road. Untouched by #1129: a stated accessory is a fact she
      named, not a category the studio borrowed.
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
