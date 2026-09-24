/**
 * THE INK PROSE HAS ONE OWNER, AND EVERY LANE THAT SPEAKS IT IS PINNED HERE
 * (ordered fable-1180 §1, shaped fable-1184 §2).
 *
 * Two different failures are guarded, and they are not the same guard:
 *
 *   1  THE LANES DRIFT — two copies of one sentence, edited once. That is what
 *      the owner exists to prevent, and it is proved by rendering each lane and
 *      finding the OWNER'S OWN STRING in the output, never a copy of it.
 *   2  THE PROSE CHANGES BY ACCIDENT — this commit is a pure extraction, so the
 *      bytes each lane sends must be what they were before it. The literal pins
 *      below are what make a reword show up as a deliberate diff in a review
 *      rather than as a silent change to a paid prompt.
 *
 * The sign-view lane PAINTS TODAY. Its prose moved house; it did not change
 * clothes, and pin 2 is the thing that says so.
 */
import { describe, expect, it } from "vitest";

import {
  INK_NOT_ON_CLOTHING,
  INK_SITS_ON_THE_FORM,
  inkDeliveredCarrySentence,
  inkNotOnClothingClause,
  inkRealismClause,
} from "./inkRealism";
import { inkTakeSentence } from "./inkReferenceTake";
import { inkViewReferenceClause } from "./inkViewReferences";

/*
  ⚠ ONE LANE LEFT THIS FILE WITH THE ROAD IT SPOKE FOR (#1158 slice 2).

  Two arms above drove the PLATE prompt: one unwrapped
  `INK_SITS_ON_THE_FORM_LINES` and asserted it was the sentence, and one rendered
  `inkPlatePrompt` and found the owner's own string inside it. His ruling of
  2026-09-24 retired the studio, `inkPlateDoor.ts` is gone, and both arms are
  gone with it — the wrapped second form is deleted at its declaration for the
  same reason.

  **The file's purpose is unchanged and its remaining arms are the ones that
  matter**: failure 2 (a paid prompt's prose changing by accident) is still
  pinned literally, and failure 1 (two lanes drifting) is still proved on the
  lane that PAINTS TODAY — the sign views'. What is removed is coverage of a
  lane that no longer exists, not coverage that was doing work.
*/

describe("the house sentences, pinned so a reword is a deliberate diff", () => {
  it("pins both sentences literally — a reword is a deliberate diff, never a silent one", () => {
    expect(INK_SITS_ON_THE_FORM).toBe(
      "Follow the form underneath, so the design sits on the surface as ink on skin rather than as a flat sticker.",
    );
    expect(INK_NOT_ON_CLOTHING).toBe(
      "It is ink on her skin — never printed, embroidered or otherwise placed on her clothing, and "
      + "never added to a garment as a graphic. Clothing covers ink rather than removing it: where a "
      + "tattoo runs under a garment, the part of it on bare skin appears exactly as it is and the "
      + "covered part simply does not show. Never change, move or open a garment to reveal more of a "
      + "tattoo — the clothing in a view is what it is, and the tattoo shows only where skin shows.",
    );
  });
});

describe("every lane that says it, says the OWNER'S string", () => {
  it("the sign views' clause carries the clothing rule — the lane that paints today", () => {
    const clause = inkViewReferenceClause({
      plates: [{
        designPublicId: "d1",
        placement: "upperArm",
        side: "left",
        bytes: Buffer.from("a plate"),
        contentType: "image/png",
      }],
      firstOrdinal: 2,
    });
    expect(clause).toContain(INK_NOT_ON_CLOTHING);
  });
});

/*
  THE TWO SENTENCES MAY NEVER SHARE AN INSTANCE — ruled fable-1194 §2a, as a
  rule with an arm rather than a note in a docblock.

  The fresh lane and the delivered carry both hand a picture to the painter, and
  what they must say about the SKIN in that picture is opposite:

    fresh       somebody else's artwork on somebody else's arm. The surrounding
                surface is a hazard, so `inkTakeSentence` disclaims it —
                "Do not take skin, skin tone, body shape, pose or lighting from
                the reference — keep his own."
    delivered   a crop of HIS OWN frame. The surface is the FACT being supplied
                — his tone, his light, the ink at the size it landed — and the
                disclaimer would tell the painter to ignore the one thing the
                crop was minted for.

  Both sentences are imported here, so a future edit that merges them into one
  reusable clause turns this file red instead of quietly making one of the two
  lanes wrong.
*/
describe("the fresh sentence and the delivered carry cannot be one sentence", () => {
  const HE = { subject: "he", object: "him", possessive: "his", plural: false };
  const DISCLAIMER = "Do not take skin, skin tone, body shape, pose or lighting";

  it("the FRESH lane disclaims the reference's skin", () => {
    expect(inkTakeSentence(HE)).toContain(DISCLAIMER);
  });

  it("the DELIVERED carry does not — and says whose skin it is showing", () => {
    const sentence = inkDeliveredCarrySentence(2, "neck tattoo", HE);
    expect(sentence).not.toContain(DISCLAIMER);
    /* Not merely "no disclaimer": the affirmative and the negative cannot be
       allowed to share an answer, so the arm demands the positive claim too. */
    expect(sentence).toContain("HIS OWN skin");
    expect(sentence).toContain("his own tone");
    expect(sentence).toContain("his own light");
  });

  it("the delivered carry still says what a tattoo IS on skin", () => {
    /* The naming form alone is the decal instruction. `486` and its siblings
       failed on that, and the realism clause is the same fix on this lane. */
    const sentence = inkDeliveredCarrySentence(2, "neck tattoo", HE);
    expect(sentence).toContain(inkRealismClause(HE));
    expect(sentence).toContain("HEALED tattoo");
    expect(sentence).toContain("never printed, embroidered");
  });

  it("it takes the CAST'S pronoun, on all three", () => {
    /* `segmentsOnFace` shipped "hers" onto a male candidate before pronouns
       were passed rather than guessed; this sentence talks about a person's
       skin four times in one breath. */
    const she = inkDeliveredCarrySentence(2, "neck tattoo", {
      subject: "she", object: "her", possessive: "her", plural: false,
    });
    expect(she).toContain("HER OWN skin");
    /* A WORD BOUNDARY, never a substring: "this picture" contains "his", and a
       bare `not.toContain` would pass on a sentence riddled with the wrong
       pronoun the day somebody removed the word "this". */
    expect(she).not.toMatch(new RegExp(String.raw`\bhis\b`));
    const they = inkDeliveredCarrySentence(2, "neck tattoo", {
      subject: "they", object: "them", possessive: "their", plural: true,
    });
    expect(they).toContain("they already have");
    expect(they).toContain("THEIR OWN skin");
  });

  it("⚠ THE REVERTED CLAUSE IS GONE — `8f0515d2`, measured on three frames", () => {
    /*
      `inkStopsAtTheGarmentClause` said the edge as a place and `490` carried it
      in full onto a T-shirt. fable-1194 §2c's standing rule: a clause measured
      not to work is REMOVED by the next commit that touches its lane. This arm
      is what stops it drifting back in as prose somebody liked the sound of.
    */
    for (const sentence of [
      inkDeliveredCarrySentence(2, "neck tattoo", HE),
      inkRealismClause(HE),
      inkNotOnClothingClause(HE),
    ]) {
      expect(sentence).not.toContain("Its edge is where");
      expect(sentence).not.toContain("Do not enlarge, extend or complete");
    }
  });
});
