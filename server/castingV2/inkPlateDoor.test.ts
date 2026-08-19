import { describe, expect, it } from "vitest";

import { INK_PLACEMENTS, type InkPlacement } from "../../shared/inkPlacementVocabulary";
import { sidesForInkPlacement, type InkSide } from "../../shared/inkReleasedPlacements";
import { INK_TEMPLATES, inkTemplateFor, type InkTemplate } from "./inkTemplates";
import {
  INK_PLATE_REFUSAL_CODES,
  inkPlateAlreadyMintedRefusal,
  inkPlateDesignRefusal,
  inkPlateFormRefusal,
  inkPlatePrompt,
  inkPlateTemplateRefusal,
  inkPlateTransportRefusal,
} from "./inkPlateDoor";

const DIGEST = "a".repeat(64);
const OTHER = "b".repeat(64);

/**
 * The blank a real caller would resolve for this placement, so the prompt is
 * asserted against the picture that would actually be posted beside it — the
 * mint resolves once and hands the same object to both.
 */
function blankFor(placement: InkPlacement, side?: InkSide): InkTemplate {
  /* The placement's OWN side by default — `upperArm:centre` is refused by the
     upload door and by the routing, so a helper defaulting to `centre` would
     throw on a third of the vocabulary and read as a routing bug. */
  const chosen = side ?? sidesForInkPlacement(placement)[0];
  const choice = inkTemplateFor({ placement, side: chosen, build: "female" });
  if (!choice.ok) throw new Error(`no blank for ${placement}:${chosen}`);
  return choice.template;
}

/**
 * A TWO-VIEW FORM THAT IS NOT IN THE SET — the positive control for every
 * "the multi-view sentence falls out" assertion below.
 *
 * The set is all single-view now, so an absence test over it proves nothing on
 * its own: a prompt that had DELETED the multi-view sentences would pass every
 * one of them. This is a form with two views and nothing else different, and
 * the sentences must come back for it.
 */
const TWO_VIEW_FORM: InkTemplate = {
  ...INK_TEMPLATES.bodyFemaleFront,
  name: "two-view control",
  views: ["front", "back"],
};

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

  it("names the missing FORM and never the person, and passes when there is one", () => {
    /*
      fable-1025 rider one. The refusal a customer reads when their Cast's build
      has no torso blank must be about the MATERIAL — a mannequin nobody has
      drawn yet — and must not name them, their label or their body.

      The absence list is word-boundaried and positive-controlled below for the
      reason the person-word assertion in this file already carries its own
      scar: a negative that cannot fail is not a negative.
    */
    const refusal = inkPlateFormRefusal({ ok: false, reason: "noFormForBuild" });
    expect(refusal).toMatchObject({ code: "noFormForBuild" });
    expect(refusal!.message).toContain("mannequin");
    const forbidden = [
      [/\bnonbinary\b/iu, "this cast is nonbinary"],
      [/\bher\b/iu, "we could not draw her"],
      [/\bhis\b/iu, "we could not draw his"],
      [/\bbody\b/iu, "we could not draw your body"],
      [/\bsex\b/iu, "no form for this sex"],
      [/\byou\b/iu, "you cannot do that"],
    ] as const;
    for (const [pattern] of forbidden) {
      expect(refusal!.message, `must not say ${pattern}`).not.toMatch(pattern);
    }
    /*
      THE CONTROL, and this file carries the scar that demands one: a patch
      script once wrote a literal BACKSPACE where \b was meant, so the pattern
      matched nothing and the assertion passed while examining nothing. Every
      pattern above is driven at a string that DOES carry its word.
    */
    for (const [pattern, carrier] of forbidden) {
      expect(carrier, `${pattern} must be able to fire`).toMatch(pattern);
    }
    expect(inkPlateFormRefusal({ ok: true, template: INK_TEMPLATES.armLeft })).toBeNull();
  });

  it("says something a customer can read, never a code", () => {
    /* Every refusal is shown to somebody. A message that is the code with
       spaces in it is a client re-wording an enum, which is how two surfaces
       end up saying different things about one refusal. */
    for (const refusal of [
      inkPlateTransportRefusal(false),
      inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: null }),
      inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: OTHER }),
      inkPlateTemplateRefusal({ present: false, approvedDigest: DIGEST, fetchedDigest: null }),
      inkPlateAlreadyMintedRefusal(true),
      inkPlateFormRefusal({ ok: false, reason: "noFormForBuild" }),
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
      inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: null }),
      inkPlateDesignRefusal({ recordedDigest: DIGEST, fetchedDigest: OTHER }),
      inkPlateTemplateRefusal({ present: false, approvedDigest: DIGEST, fetchedDigest: null }),
      inkPlateTemplateRefusal({ present: true, approvedDigest: DIGEST, fetchedDigest: OTHER }),
      inkPlateAlreadyMintedRefusal(true),
      inkPlateFormRefusal({ ok: false, reason: "noFormForBuild" }),
    ].map((refusal) => refusal!.code);
    expect(new Set(produced)).toEqual(new Set(INK_PLATE_REFUSAL_CODES));
  });
});

describe("what the engine is told about the SHEET", () => {
  /*
    THE COURT'S OWN FINDING, made mechanical — and now pointing the other way.

    Every committed template used to be a turnaround while the prompt described
    one form, and the engine obeyed: the wrap court's first plate came back with
    the serpent on the side view and two bare arms beside it. The fix was to
    DERIVE the sentence from `template.views` rather than remember it.

    The set is now single-view throughout (founder, fable-989/990), so the
    multi-view sentences must FALL OUT rather than be silenced by hand — and an
    absence test over an all-single-view set proves nothing on its own, because
    a prompt that had deleted those sentences outright would pass it. Every
    absence below is therefore paired with {@link TWO_VIEW_FORM}, where the same
    sentence must come back.
  */
  it("names the ONE view the blank holds, and asks for no others", () => {
    for (const placement of INK_PLACEMENTS) {
      const template = blankFor(placement);
      const prompt = inkPlatePrompt({
        placement, side: sidesForInkPlacement(placement)[0], template,
      });
      expect(template.views).toHaveLength(1);
      expect(prompt, `${placement} must name its ${template.views[0]} view`)
        .toContain(template.views[0]);
      expect(prompt).not.toContain("IN EVERY");
      expect(prompt).not.toContain("never leave a view bare");
      expect(prompt).not.toContain("same number of views");
    }
  });

  it("brings the multi-view sentences BACK for a form that has two views", () => {
    /* The control for the three absences above. Without it they are satisfied
       by a prompt that no longer knows how to say those things at all. */
    const prompt = inkPlatePrompt({ placement: "neck", side: "centre", template: TWO_VIEW_FORM });
    expect(prompt).toContain("IN EVERY");
    expect(prompt).toContain("never leave a view bare");
    expect(prompt).toContain("same number of views");
    expect(prompt).toContain("one body seen from several angles");
    expect(prompt).toContain("shown twice");
  });

  it("still forbids a second copy at ONE view — the failure that survives the spec", () => {
    /*
      The single-view spec removes the doubling that came from a sheet carrying
      the artwork twice. It does not make "one tattoo" unnecessary: an engine
      can still draw the design twice on one form, and that failure would look
      like success in a thumbnail.
    */
    const prompt = inkPlatePrompt({
      placement: "upperArm", side: "left", template: blankFor("upperArm", "left"),
    });
    expect(prompt).toContain("It is ONE tattoo");
    expect(prompt).toContain("Never draw a second copy");
  });

  it("describes the blank as GREYSCALE on near-white — the picture it is actually posted with", () => {
    /*
      Checklist item 1 of the template commit. The retired sheets were mid-tone
      beige skin; the set is neutral grey on a flat 254 field, and a prompt
      describing the retired asset is a prompt about a picture that no longer
      exists (the wire-honest defect in prompt form).
    */
    const prompt = inkPlatePrompt({ placement: "neck", side: "centre", template: blankFor("neck") });
    expect(prompt).toContain("neutral grey");
    expect(prompt).toContain("near-white background");
    expect(prompt).not.toContain("on one near-white sheet");
  });
});

describe("what the engine is told", () => {
  it("names the placement, and names it in the vocabulary's own measured word", () => {
    const prompt = inkPlatePrompt({
      placement: "upperArm", side: "left", template: blankFor("upperArm", "left"),
    });
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
    const prompt = inkPlatePrompt({ placement: "neck", side: "centre", template: blankFor("neck") });
    expect(prompt).toContain("the neck");
    expect(prompt).not.toContain("centre");
  });

  it("names a surface for every placement the vocabulary holds", () => {
    /* Derived over the vocabulary rather than over a list here, so a fourth
       placement earned tomorrow cannot ship with a prompt that forgets to say
       where the design goes. */
    for (const placement of INK_PLACEMENTS) {
      const prompt = inkPlatePrompt({
        placement, side: sidesForInkPlacement(placement)[0], template: blankFor(placement),
      });
      expect(prompt).toContain("Leave every other part of the form");
      expect(prompt.length).toBeGreaterThan(200);
    }
  });

  it("FORBIDS the person, at the wire, in the words the fence needs", () => {
    /* The fence is met by construction — an engine is only ever shown the
       plate. This is the belt: a rule enforced only by the shape of the inputs
       is a rule the next model revision may not notice. Asserted on the string
       that is actually sent, never on a constant near it. */
    const prompt = inkPlatePrompt({
      placement: "upperChest", side: "centre", template: blankFor("upperChest"),
    });
    for (const forbidden of ["no face", "no hair", "no eyes", "no skin tone", "no jewellery", "no clothing"]) {
      expect(prompt).toContain(forbidden);
    }
    expect(prompt).toContain("is not the subject and must not appear");
  });

  it("asks for the design to be REPRODUCED, never restyled", () => {
    /* D-138's whole reason for a plate: a described tattoo is a different
       tattoo. The picture is handed over; the words only say where it goes and
       what must not change. */
    const prompt = inkPlatePrompt({ placement: "neck", side: "centre", template: blankFor("neck") });
    expect(prompt).toContain("Do not restyle it");
    expect(prompt).toContain("any lettering exactly as they appear");
  });
});
