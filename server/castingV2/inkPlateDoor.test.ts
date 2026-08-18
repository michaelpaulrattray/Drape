import { describe, expect, it } from "vitest";

import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import {
  INK_PLATE_REFUSAL_CODES,
  inkPlateAlreadyMintedRefusal,
  inkPlateDesignRefusal,
  inkPlatePrompt,
  inkPlateTemplateRefusal,
  inkPlateTransportRefusal,
} from "./inkPlateDoor";

const DIGEST = "a".repeat(64);
const OTHER = "b".repeat(64);

describe("the plate mint's doors", () => {
  it("refuses with no transport, and passes with one", () => {
    expect(inkPlateTransportRefusal(false)).toMatchObject({ code: "noTransport" });
    expect(inkPlateTransportRefusal(true)).toBeNull();
  });

  /*
    The negative arm on every one of these, deliberately: a door that refuses
    everything passes a positive-only suite and takes the whole feature down
    with it. Both arms, each time — the bar the makeup controls proved.
  */
  it("refuses a design whose bytes have moved since she attached it", () => {
    expect(inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: OTHER }))
      .toMatchObject({ code: "designMoved" });
    expect(inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: DIGEST })).toBeNull();
  });

  it("tells a MISSING template apart from a SWAPPED one", () => {
    /* Two facts with two fixes — a deploy that lost an asset, versus an asset
       somebody edited. One word for both is the two-meanings-of-none shape. */
    expect(inkPlateTemplateRefusal({ present: false, approvedDigest: DIGEST, fetchedDigest: null }))
      .toMatchObject({ code: "templateMissing" });
    expect(inkPlateTemplateRefusal({ present: true, approvedDigest: DIGEST, fetchedDigest: null }))
      .toMatchObject({ code: "templateMissing" });
    expect(inkPlateTemplateRefusal({ present: true, approvedDigest: DIGEST, fetchedDigest: OTHER }))
      .toMatchObject({ code: "templateMoved" });
    expect(inkPlateTemplateRefusal({ present: true, approvedDigest: DIGEST, fetchedDigest: DIGEST }))
      .toBeNull();
  });

  it("calls a second mint ALREADY PLATED rather than buying another", () => {
    expect(inkPlateAlreadyMintedRefusal(true)).toMatchObject({ code: "alreadyPlated" });
    expect(inkPlateAlreadyMintedRefusal(false)).toBeNull();
  });

  it("says something a customer can read, never a code", () => {
    /* Every refusal is shown to somebody. A message that is the code with
       spaces in it is a client re-wording an enum, which is how two surfaces
       end up saying different things about one refusal. */
    for (const refusal of [
      inkPlateTransportRefusal(false),
      inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: OTHER }),
      inkPlateTemplateRefusal({ present: false, approvedDigest: DIGEST, fetchedDigest: null }),
      inkPlateAlreadyMintedRefusal(true),
    ]) {
      expect(refusal).not.toBeNull();
      expect(refusal!.message).toMatch(/[a-z] [a-z]/);
      expect(refusal!.message).not.toContain(refusal!.code);
    }
  });

  it("keeps the code list and the codes it can produce in step", () => {
    /* The list exists so a demand record can hold a value for each one, and a
       type alone cannot be iterated. A code produced but unlisted is a column
       value MySQL truncates to the empty string. */
    const produced = [
      inkPlateTransportRefusal(false),
      inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: OTHER }),
      inkPlateTemplateRefusal({ present: false, approvedDigest: DIGEST, fetchedDigest: null }),
      inkPlateTemplateRefusal({ present: true, approvedDigest: DIGEST, fetchedDigest: OTHER }),
      inkPlateAlreadyMintedRefusal(true),
    ].map((refusal) => refusal!.code);
    expect(new Set(produced)).toEqual(new Set(INK_PLATE_REFUSAL_CODES));
  });
});

describe("what the engine is told", () => {
  it("names the placement, and names it in the vocabulary's own measured word", () => {
    const prompt = inkPlatePrompt({ placement: "upperArm", side: "left" });
    expect(prompt).toContain("the left upper arm");
    /* Never the key, and never the customer's copy: `upperArm` is an
       identifier and "her upper arm" puts a person in the sentence whose whole
       job is keeping one out. */
    expect(prompt).not.toContain("upperArm");
    /* WORD-BOUNDARED, and this line got it wrong TWICE before it was right.
       `not.toContain("her ")` fails on "every other part" — a substring trap,
       not a person in the sentence. The repair after it was written by a script
       that turned `\b` into a literal BACKSPACE, so the regex matched nothing
       and the assertion passed while examining nothing. Positive-controlled
       below, which is the only reason the second one was caught. */
    expect(prompt).not.toMatch(/\bher\b/u);
  });

  it("can actually SEE a person word — the control on the line above", () => {
    /* The assertion above passed for a while because a patch script wrote a
       literal backspace where `\b` was meant, so the pattern matched nothing at
       all. A negative that cannot fail is not a negative. This drives the same
       pattern at a string that DOES carry the word. */
    expect("the design sits on her upper arm").toMatch(/\bher\b/u);
    expect("leave every other part bare").not.toMatch(/\bher\b/u);
  });

  it("drops the side for a placement that has only one", () => {
    expect(inkPlatePrompt({ placement: "neck", side: "centre" })).toContain("the neck");
    expect(inkPlatePrompt({ placement: "neck", side: "centre" })).not.toContain("centre");
  });

  it("names a surface for every placement the vocabulary holds", () => {
    /* Derived over the vocabulary rather than over a list here, so a fourth
       placement earned tomorrow cannot ship with a prompt that forgets to say
       where the design goes. */
    for (const placement of INK_PLACEMENTS) {
      const prompt = inkPlatePrompt({ placement, side: "centre" });
      expect(prompt).toContain("Leave every other part of the form");
      expect(prompt.length).toBeGreaterThan(200);
    }
  });

  it("FORBIDS the person, at the wire, in the words the fence needs", () => {
    /* The fence is met by construction — an engine is only ever shown the
       plate. This is the belt: a rule enforced only by the shape of the inputs
       is a rule the next model revision may not notice. Asserted on the string
       that is actually sent, never on a constant near it. */
    const prompt = inkPlatePrompt({ placement: "upperChest", side: "centre" });
    for (const forbidden of ["no face", "no hair", "no eyes", "no skin tone", "no jewellery", "no clothing"]) {
      expect(prompt).toContain(forbidden);
    }
    expect(prompt).toContain("is not the subject and must not appear");
  });

  it("asks for the design to be REPRODUCED, never restyled", () => {
    /* D-138's whole reason for a plate: a described tattoo is a different
       tattoo. The picture is handed over; the words only say where it goes and
       what must not change. */
    const prompt = inkPlatePrompt({ placement: "neck", side: "centre" });
    expect(prompt).toContain("Do not restyle it");
    expect(prompt).toContain("any lettering exactly as they appear");
  });
});
