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

import { inkPlatePrompt } from "./inkPlateDoor";
import {
  INK_NOT_ON_CLOTHING,
  INK_SITS_ON_THE_FORM,
  INK_SITS_ON_THE_FORM_LINES,
} from "./inkRealism";
import { inkTemplateFor } from "./inkTemplates";
import { inkViewReferenceClause } from "./inkViewReferences";

describe("one sentence, two shapes, and they cannot drift apart", () => {
  it("DERIVES the plate's wrapped bullet from the sentence rather than restating it", () => {
    /*
      Unwrap the bullet: drop the leading "- ", drop each continuation line's
      two-space indent, join with single spaces. What is left must BE the
      sentence — a derived check, not a second list (working law 4).
    */
    const unwrapped = INK_SITS_ON_THE_FORM_LINES
      .map((line, at) => (at === 0 ? line.replace(/^- /, "") : line.replace(/^ {2}/, "")))
      .join(" ");
    expect(unwrapped).toBe(INK_SITS_ON_THE_FORM);
  });

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
  it("the plate mint's prompt carries the anti-sticker clause, wrapped as it always was", () => {
    const choice = inkTemplateFor({ placement: "upperArm", side: "left", build: "female" });
    expect(choice.ok).toBe(true);
    if (!choice.ok) return;
    const prompt = inkPlatePrompt({ placement: "upperArm", side: "left", template: choice.template });

    /* The rendered bytes, not a paraphrase of them: the two lines exactly as the
       prompt joins them. */
    expect(prompt).toContain(INK_SITS_ON_THE_FORM_LINES.join("\n"));
  });

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
