import { describe, expect, it } from "vitest";
import { renderLikeImage } from "../testing/renderLikeFrame";

import { pronounsForSex } from "./castPronouns";
import {
  belowWaistFor,
  composePackageViewPrompt,
  wardrobeSpecFor,
} from "./castViewPackage";
import { outfitReferenceClause } from "./outfitPlate";
import { createViewConformanceJudge } from "./viewConformance";
import type { TextRequest } from "../providers/types";
import { CAST_VIEW_ANGLES } from "@shared/boardTypes";

/**
 * #1480 — WHO DECIDES THE OUTFIT, AND HOW MANY TIMES THE PROMPT SAYS SO.
 *
 * His question, 2026-09-29 (terminal): *"so how many times are you mentioning
 * the outfit? i mean the outfit is attached as a reference image now right"*.
 *
 * Counted at the composed bytes, a full-length view with the plate attached
 * addressed the outfit in FIVE places, and **three of them told the engine to
 * work the bottom half out from the DESCRIPTION, as if no plate existed** —
 * composed by functions that had no way of knowing one rides. Where the plate's
 * reading of the brief and the engine's fresh reading of the brief differ —
 * which is every time, since that difference is the whole reason the plate
 * exists — the prompt had told it two things, and an image model resolves that
 * by picking one, silently, per view.
 *
 * It is the hallucinated-trousers class one layer up: the plate road was added
 * beside the words road and the words road was never told. His own measured
 * law, quoted in the plate clause's own comment: **context is not additive.**
 *
 * # Why this suite reads the COMPOSED PROMPT rather than the constants
 *
 * Working law 5 — a contract about what gets sent is proven on the outgoing
 * request, never on a constant near it. Every one of the three sentences this
 * card is about lives in a different module and two of them are assembled from
 * branches; a suite asserting each constant separately would have passed on
 * every arrangement of them, including the broken one.
 */
const BRIEF = "a street-level futurist in a white body-conscious dress that mixes qipao structure "
  + "with industrial straps, buckles and a worn graphic on the chest, leaving the exact cut, "
  + "hardware and weathering open";

const SHE = pronounsForSex("female");
const HE = pronounsForSex("male");

/** The clause the orchestrator appends, composed by its real owner. */
const plateClause = (ordinal: number, pronouns = SHE): string =>
  outfitReferenceClause({ ordinal, side: "front", kind: "plate", pronouns });

/** A full-length view the way a Sign with a landed plate composes it. */
const withPlate = (angle: "frontFull" | "backFull", ordinal = 2, pronouns = SHE): string =>
  composePackageViewPrompt(angle, null, BRIEF, {
    pronouns,
    outfitReferenceOrdinal: ordinal,
    outfitClause: plateClause(ordinal, pronouns),
  });

/** The same view with no plate — a close-up, or a Sign whose plate did not land. */
const withoutPlate = (angle: "frontFull" | "backFull" | "closeUp", pronouns = SHE): string =>
  composePackageViewPrompt(angle, null, BRIEF, { pronouns });

/**
 * The sentences that hand the lower half to the DESCRIPTION, by the phrase each
 * one is recognisable by. Three places, three modules.
 */
const DESCRIPTION_SETTLES_THE_HEM = [
  /* the reference-rule paragraph, `cohortPhotorealHuman.ts` */
  "The description governs what the reference cannot show: below the frame of this crop, and the "
  + "cut, hardware, length, footwear and weathering of the outfit it names",
  /* the directive's below-waist sentence, `belowWaistFor` */
  "Below the waist, CONTINUE THE SAME OUTFIT",
  /* the WARDROBE sentence, `describedWardrobeSpec` */
  "Below its frame the description governs: the cut, length, hardware, footwear and weathering",
] as const;

describe("#1480 — a full-length view names the outfit's authority ONCE", () => {
  it("says the description settles the hem THREE times when no plate rides — today's bytes, unchanged", () => {
    /*
      THE NEGATIVE CONTROL, AND IT IS THE ARM THAT MAKES THE NEXT ONE MEAN
      ANYTHING (working law 2). A suite that only asserted the absence of these
      three phrases would pass just as happily on a composer that had stopped
      emitting them at all — including on the no-plate road, where they are
      correct and are the only thing answering for the hem.
    */
    const prompt = withoutPlate("frontFull");
    for (const sentence of DESCRIPTION_SETTLES_THE_HEM) {
      expect(prompt, `the no-plate road must keep: ${sentence.slice(0, 48)}…`).toContain(sentence);
    }
  });

  it("says it ZERO times when a plate rides, and names reference N instead", () => {
    const prompt = withPlate("frontFull");
    for (const sentence of DESCRIPTION_SETTLES_THE_HEM) {
      expect(prompt, `a plate rides and the prompt still says: ${sentence.slice(0, 48)}…`)
        .not.toContain(sentence);
    }

    /* And the replacement actually names the picture, in both places that used
       to defer to the description. A sentence saying "the outfit is a
       reference" without saying WHICH is no better than the ambiguity. */
    expect(prompt).toContain("It does NOT settle the outfit: reference 2 does");
    expect(prompt).toContain("Below its frame the OUTFIT is reference 2");
  });

  it("carries the ordinal it is given, so a Cast with three tattoos is not pointed at her elbow", () => {
    /*
      The ordinal is `2 + crops.length` at the orchestrator. It is PASSED rather
      than recomputed here, and this is the arm that would catch a constant
      creeping back in: every sentence that names the reference must name the
      same one, and it must be the one the clause itself claims.
    */
    for (const ordinal of [2, 3, 5]) {
      const prompt = withPlate("frontFull", ordinal);
      expect(prompt).toContain(`It does NOT settle the outfit: reference ${ordinal} does`);
      expect(prompt).toContain(`Below its frame the OUTFIT is reference ${ordinal}`);
      expect(prompt).toContain(`THE OUTFIT — reference ${ordinal} is a wardrobe plate`);
      /* No OTHER ordinal may appear in an outfit sentence. */
      for (const wrong of [2, 3, 5].filter((n) => n !== ordinal)) {
        expect(prompt, `ordinal ${ordinal} leaked reference ${wrong}`)
          .not.toContain(`OUTFIT is reference ${wrong}`);
      }
    }
  });

  it("puts the outfit clause WITH the wardrobe sentence, not after the block that ranks authority", () => {
    /*
      #1480 finding D. It was appended by `packageOrchestrator` after the whole
      house block — i.e. after `AUTHORITY:`, the paragraph that says what beats
      what — so the one sentence naming the outfit's real authority sat outside
      the ordering that decides authority.
    */
    const lines = withPlate("frontFull").split("\n");
    const wardrobeAt = lines.findIndex((line) => line.startsWith("WARDROBE:"));
    const outfitAt = lines.findIndex((line) => line.startsWith("THE OUTFIT —"));
    const authorityAt = lines.findIndex((line) => line.startsWith("AUTHORITY:"));
    expect(wardrobeAt, "no WARDROBE line").toBeGreaterThan(-1);
    expect(outfitAt, "no outfit clause").toBeGreaterThan(-1);
    expect(authorityAt, "no AUTHORITY line").toBeGreaterThan(-1);
    expect(outfitAt).toBe(wardrobeAt + 1);
    expect(outfitAt).toBeLessThan(authorityAt);
  });

  it("drops one repetition of the logo ban with the below-waist sentence, and keeps the house one", () => {
    /*
      Finding D's arithmetic, asserted rather than asserted-about. The ban is
      stated by the below-waist sentence, by the WARDROBE additions clause and
      by the house NEGATIVES line; dropping the first takes it to two, and the
      house line is shared with the ROLL by his #1240 ruling, so it is not this
      card's to touch.
    */
    const bans = (text: string): number => (text.match(/logo/gi) ?? []).length;
    expect(bans(withPlate("frontFull"))).toBeLessThan(bans(withoutPlate("frontFull")));
    expect(withPlate("frontFull")).toContain("NO logos, watermarks, captions or signage");
  });
});

describe("#1480 — the no-plate road is untouched", () => {
  it("composes byte-identically with and without the new options, on every angle", () => {
    /*
      ⚠ THE INERTNESS ARM, and it is the one a reviewer should read first.
      Every option added by this card defaults to the value the composer behaved
      as if it had, so a caller that passes nothing gets the prompt it always
      got. Asserted over EVERY angle and both description roads, because the
      three sentences this card moves live on different branches.
    */
    for (const angle of CAST_VIEW_ANGLES) {
      for (const description of [null, BRIEF]) {
        expect(
          composePackageViewPrompt(angle, null, description, {}),
          `${angle} · ${description === null ? "no brief" : "brief"}`,
        ).toBe(composePackageViewPrompt(angle, null, description));
      }
    }
  });

  it("gives the plate's OWN prompt the description as the record — the one place it must keep it", () => {
    /*
      The plate is what INVENTS the outfit, so for that request the description
      really is the record for the hem and the footwear. If #1480's yield ever
      reached it, nothing in the product would decide the lower half at all.
    */
    expect(belowWaistFor("frontFull", null, BRIEF, null)).toContain("Below the waist, CONTINUE THE SAME OUTFIT");
    expect(belowWaistFor("frontFull", null, BRIEF, 2)).toBe("");
  });

  it("⚠ never lets the plate reach the JUDGE — now because the judge is told no outfit at all (#1903)", async () => {
    /*
      ⚠ **THE ARM THAT STOPS THIS CARD BECOMING A REFUND BUG, RE-AIMED RATHER
      THAN DELETED — law 7's ruling sweep: when a rule closes a path, what was
      bolted to it?**

      It used to read `packageViewExpectation(angle, null, BRIEF)` and hold its
      wardrobe sentence byte-identical, because `viewConformance` posted
      `SPECIFICATION for IMAGE 2: / Framing: … / Wardrobe: …` and a spec naming
      "reference 2" would have pointed the judge at a picture it cannot see.

      **#1903 removed the wardrobe axis and the whole specification with it**,
      so that function no longer exists and the worry is answered by
      construction. The worry is still worth an arm, and this is the honest
      version of it: driven at the WIRE, with a brief that names an outfit, the
      reader must be handed neither the outfit nor any plate ordinal. A future
      edit that threads either one back into the judge reddens here.
    */
    let seen: TextRequest | null = null;
    await createViewConformanceJudge({
      engine: {
        id: "test-judge",
        complete: async (request: TextRequest) => {
          seen = request;
          return {
            text: JSON.stringify({
              identity: { verdict: "matches", note: "" },
              intact: { verdict: "matches", note: "" },
              people: { verdict: "matches", note: "" },
            }),
            latencyMs: 1,
            provenance: { provider: "openrouter" as const, model: "t" },
          };
        },
      },
    })({
      angle: "frontFull",
      /* Real frames since #1903 — the judge opens the candidate's bytes before
         it posts anything, so a non-image fixture is refused as a broken render
         and this arm's engine is never called. */
      anchor: await renderLikeImage(64, 96),
      candidate: await renderLikeImage(96, 64),
    });

    const request = seen as unknown as TextRequest;
    const posted = `${request.system ?? ""} ${request.user ?? ""}`;
    expect(posted).not.toContain("reference 2");
    /* A distinctive run of words from the brief's own outfit, so this cannot
       pass by the brief happening to share no vocabulary with the prompt. */
    expect(posted).not.toContain("qipao");
    expect(posted).not.toContain("WARDROBE");
    /* CONTROL — the same words DO reach the generator, so the arm above is a
       statement about the judge and not about the fixture being empty. */
    expect(composePackageViewPrompt("frontFull", null, BRIEF)).toContain("qipao");
  });
});

describe("#1480 finding A — the prompt uses the cast's pronouns", () => {
  it("never calls a male cast 'her', on any angle, plate or no plate", () => {
    for (const angle of CAST_VIEW_ANGLES) {
      const prompt = composePackageViewPrompt(angle, null, BRIEF, { pronouns: HE });
      expect(prompt.match(/\b(she|her|hers)\b/gi) ?? [], `${angle} · no plate`).toEqual([]);
    }
    const plated = withPlate("frontFull", 2, HE);
    expect(plated.match(/\b(she|her|hers)\b/gi) ?? [], "frontFull · with a plate").toEqual([]);
  });

  it("⚠ and it really is the CAST'S pronoun, not a neutral rewrite", () => {
    /*
      The arm above passes perfectly on a prompt that had simply had every
      pronoun deleted. This is the half that cannot: the same view, two casts,
      and the words must differ in the direction that matters.
    */
    const his = composePackageViewPrompt("frontFull", null, BRIEF, { pronouns: HE });
    const hers = composePackageViewPrompt("frontFull", null, BRIEF, { pronouns: SHE });
    expect(his).not.toBe(hers);
    expect(his).toContain("Everything the reference shows on him");
    expect(hers).toContain("Everything the reference shows on her");
    expect(his).toContain("RECORD OF HIS APPEARANCE");
    expect(hers).toContain("RECORD OF HER APPEARANCE");
  });
});

describe("#1480 findings B and C", () => {
  it("B — tells the view road that the description does not set the scene", () => {
    /*
      `AUTHORITY_LINE` arrived on this road with #1240 and on the ROLL it is
      right. On a VIEW, a brief reading *"on a rain-soaked street at night,
      mid-stride, laughing"* would override the studio block's "no environment"
      and fight the angle directive — and the judge's framing spec, derived from
      `spec` alone, knows nothing about the brief and would fail the view we
      asked for.
    */
    const scoped = "ON THIS ROAD the description settles WHO this person is and WHAT they wear";
    for (const angle of CAST_VIEW_ANGLES) {
      expect(composePackageViewPrompt(angle, null, BRIEF), angle).toContain(scoped);
      /* No brief, no sentence — there is nothing to scope. */
      expect(composePackageViewPrompt(angle, null, null), angle).not.toContain(scoped);
    }
  });

  it("B — the sentence rides with the VIEW's lines and not inside the shared house block", () => {
    /*
      The block is one road's and both roads' by his #1240 ruling, so narrowing
      it here would narrow the ROLL too. Proven by position: the sentence sits
      above the angle directive, which is above the house block.
    */
    const lines = composePackageViewPrompt("frontFull", null, BRIEF).split("\n");
    const scopeAt = lines.findIndex((line) => line.startsWith("ON THIS ROAD"));
    const cameraAt = lines.findIndex((line) => line.startsWith("CAMERA:"));
    expect(scopeAt).toBeGreaterThan(-1);
    expect(scopeAt).toBeLessThan(cameraAt);
  });

  it("C — the back view's sentence names every record, not only the reference", () => {
    /*
      The master is a chest-up FRONT photograph and cannot show a back, while
      the same prompt tells the engine to draw a born back tattoo and, with a
      plate, to copy the garments its right panel shows. Three instructions, two
      of them telling it to put on the back what the third forbade.
    */
    const back = composePackageViewPrompt("backFull", null, BRIEF);
    expect(back).toContain("Add nothing to the back or arms that neither the references nor the words above establish");
    expect(back).not.toContain("Add nothing to the back or arms that the reference does not show");
  });
});
