/**
 * THE VIEW-REFERENCE CLAUSE, DRIVEN — the founder's own ruling (fable-987 §3):
 * *"tattoo reference will need to be supplied to each view generated otherwise
 * it wont know what the tattoo is"*.
 *
 * What is on trial is the SENTENCE, because the sentence is the fence. The
 * picture handed over is a grey mannequin limb wearing a tattoo, and the
 * obvious misreading of it — make the photograph look like this — would grey
 * her skin, blank her background and delete the person. Every arm here is about
 * a way that could happen.
 */
import { describe, expect, it } from "vitest";

import {
  INK_VIEW_PLACEMENT_DISCIPLINE,
  inkPlacementPhrase,
  inkViewCropClause,
  inkViewPlacementDisciplineClause,
  placementRideCoverage,
  type CarriedInkCrop,
} from "./inkViewReferences";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";
import { inkDeliveredCarrySentence } from "./inkRealism";
import { pronounsForSex } from "./castPronouns";

describe("where a tattoo is said to live", () => {
  it("uses the surface word the vocabulary MEASURED, never the key", () => {
    /*
      `upperArm` is the key; "upper arm" is the word twelve reads found actually
      cuts that surface. Deriving it here rather than typing it is what keeps one
      surface to one name — the same fork `inkPlatePrompt` takes.
    */
    /* The positional clause rides with it — see the per-side arms below. What is
       on trial here is the SURFACE word, so the assertion names the prefix. */
    expect(inkPlacementPhrase({ placement: "upperArm", side: "left", possessive: "her" }))
      .toMatch(/^her left upper arm \(/);
    expect(inkPlacementPhrase({ placement: "upperChest", side: "centre", possessive: "her" })).toBe("her upper chest");
    expect(inkPlacementPhrase({ placement: "neck", side: "centre", possessive: "her" })).toBe("her neck");
  });

  it("never says a side for a centred surface", () => {
    /* "her centre neck" is not a sentence a stylist would say, and a laterality
       word on a surface that has one of itself is a claim about anatomy nobody
       measured. */
    expect(inkPlacementPhrase({ placement: "neck", side: "centre", possessive: "her" })).not.toContain("centre");
  });
});

/*
  ⚠ **THE PLATE LANE'S ARMS ARE GONE WITH THEIR SUBJECT — #1158 slice 4f, and
  what happened to their COVERAGE is the part worth reading.**

  Two describe blocks stood here: `inkViewReferenceClause`'s own eight arms, and
  a per-side block that drove `imageHalfClause`'s mirror rule THROUGH that
  clause. The first died with its function. The second was the §8c question —
  *which of these prove LIVE code?* — and the answer is that its rule is proved
  twice over on the lane that actually paints:

    "carries the SIDE in prose"          the same mirror, both directions, the
                                         same one owner — below, on the crop lane
    "never says a side for a surface
     there is one of"                    the centred case, below
    "where a tattoo is said to live"     `inkPlacementPhrase` driven DIRECTLY,
                                         above, which is the shared thing both
                                         lanes always called

  So nothing was re-pointed here, because nothing needed to be: the live lane's
  arms were not derived from the plate lane's and do not share a fixture with
  them. ONE arm had no live equivalent and is simply gone — *"says it on the
  copy instruction too"*, which asserted the positional clause appeared TWICE
  because the plate clause said the surface in two sentences. The crop lane says
  it in one, so there is no second place for it to disagree with itself.
*/


/**
 * A SURFACE THE PACKAGE'S OWN WARDROBE COVERS DOES NOT RIDE — the interim
 * ordered fable-1006 §2, bought by the court.
 *
 * The upper chest is bare on a SCOOP neckline only; the package wardrobe is a
 * fixed crew neck. The two promises cannot both hold in one frame, and the
 * engine proved it by breaking each in turn: printed on the shirt, and then —
 * once told ink goes on skin — by rewriting the wardrobe into a scoop.
 *
 * Both are conformance failures with a refund behind them, so until he rules on
 * the wardrobe itself, an upper-chest design carries no plate into a package
 * view. It says so on the SAME disposition surface as every other way a design
 * can fail to ride; a second refusal on a second surface is the defect §5 just
 * repaired.
 */
describe("which surfaces can ride a package view at all", () => {
  it("says the upper chest cannot — THE HOUSE TEE covers it", () => {
    /* `null` is *no line recorded* — every Cast signed before the paths — and it
       answers the house table, which is what makes this landing dark. */
    expect((placementRideCoverage("upperChest", null) === "bare")).toBe(false);
  });

  it("⚠ A BASICS CAST'S ARM RIDES — the answer is the OUTFIT'S, not the placement's", () => {
    /*
      Item 7a, the whole point of it. This used to be a frozen `false` keyed on
      the placement, so a cast born shirtless was refused by a reading taken on
      sixteen masters in a crew-neck tee. The OUTFIT answers now.
    */
    expect(placementRideCoverage("upperArm", basicsWardrobeLine("male"))).toBe("bare");
    expect(placementRideCoverage("upperArm", basicsWardrobeLine(null))).toBe("bare");
  });

  it("⚠ AND ITS CHEST DOES TOO — the one placement this whole path exists for", () => {
    /*
      THIS ARM HAS SAID THREE DIFFERENT THINGS AND EACH ONE WAS RIGHT AT THE
      TIME, which is the clearest thing this file has to teach:

        `bare`      off the Basics SPEC's own sentence, and the coverage owner
                    said in as many words that it had never been through a frame
        `unknown`   the Two Paths court rolled eight and asked `upper chest`:
                    **0 px on 4 of 4** (opus-1111, ruled fable-1453). Not
                    `covered` — her chest is plainly visible — and not `bare`,
                    because that would put a tattoo into five paid views the mint
                    cannot crop
        `bare`      EARNED, 2026-08-23. The founder lowered the spec's neckline
                    to name the collarbones and the sternum, and the re-court
                    read the amended frames **12 of 12 across three sheets and
                    two wordings**, 3.9–7.6% of frame, masks opened and looked
                    at. The founder then closed the trade knowing what the
                    lowered neckline costs at the vendor's content checker

      **The value returned to where it started and it is not the same value.**
      The first was a claim about a sentence we wrote; this one is a reading of
      photographs, and `inkSurfaceCoverage.ts` carries the four rounds.

      So a Basics chest design RIDES the package views — which is the headline
      capability of the path, reaching a customer for the first time.
    */
    for (const line of [basicsWardrobeLine("male"), basicsWardrobeLine(null)]) {
      expect(placementRideCoverage("upperChest", line)).toBe("bare");
    }
    /* CONTROL — the house tee's chest still does NOT ride, so the two above are
       a fact about the Basics line rather than about the reader having stopped
       distinguishing outfits. */
    expect(placementRideCoverage("upperChest", HOUSE_WARDROBE_LINE)).toBe("covered");
  });

  it("⚠ AND AN OUTFIT NOBODY HAS READ RIDES NOTHING — including the neck", () => {
    /*
      The over-promising direction. `neck: true` was measured under a crew tee
      whose neckline sits below it; on a roll-neck jumper the same `true` sells
      a design that rides all five views and fails the wardrobe axis on every one.
      Unknown fails closed, and `placementRideCoverage` is what stops the caller
      reporting it as a covering.
    */
    const jumper = "a charcoal roll-neck jumper, dark jeans and boots";
    for (const placement of INK_PLACEMENTS) {
      expect((placementRideCoverage(placement, jumper) === "bare")).toBe(false);
      expect(placementRideCoverage(placement, jumper)).toBe("unknown");
    }
    expect(placementRideCoverage("upperChest", null)).toBe("covered");
  });

  it("says the upper arm and the neck can", () => {
    /*
      The crew tee leaves both bare in the package's own framings.

      When this was written only the upper ARM had a passing arm behind it and
      the sentence claimed both. **The neck now has its own court** (2026-08-19,
      ordered fable-1008 §4a): three arms, all must-SHOW, all passed by eye —
      `closeUp` (the crop's own subject), `frontFull` (bare above the crew neck)
      and `backFull` (the plate inks the nape, so must-not there would have been
      a mislabel). Nothing appeared anywhere else in any of the three, which is
      the must-not this placement can honestly carry.
    */
    expect((placementRideCoverage("upperArm", null) === "bare")).toBe(true);
    expect((placementRideCoverage("neck", null) === "bare")).toBe(true);
  });

  it("is TOTAL over the vocabulary, so a fourth placement cannot compile silently", () => {
    /*
      The same totality `TEMPLATE_FOR` and `bodyAnchorRegions` use, for the same
      reason: a default would decide a new surface's visibility by whichever
      value was listed first, and nothing would say so.
    */
    for (const placement of INK_PLACEMENTS) {
      expect(typeof (placementRideCoverage(placement, null) === "bare")).toBe("boolean");
    }
  });
});

/**
 * THE DELIVERED-CROP CLAUSE — the lane that actually carries something
 * (fable-1297 §3, countersigned fable-1303).
 *
 * The plate lane's fence is about a picture of a grey form. This lane's fence
 * is the opposite one: the picture IS her, its skin is her skin, and the danger
 * is a sentence that disclaims the very thing the picture was minted to say.
 * Every arm here is a way that could go wrong.
 */
describe("the clause that carries the tattoos she really has", () => {
  const HIM = pronounsForSex("male");

  const crop = (over: Partial<CarriedInkCrop> = {}): CarriedInkCrop => ({
    cropPublicId: "11111111-1111-4111-8111-111111111111",
    slot: "ink:upperArm@left",
    placement: "upperArm",
    side: "left",
    noun: "left upper arm tattoo",
    bytes: Buffer.from("crop"),
    contentType: "image/png",
    ...over,
  });

  it("is EMPTY when nothing rides — every signed Cast without ink is untouched", () => {
    /* The inertness control, and it is the one that matters most: this lane
       reaches every package view in the product. */
    expect(inkViewCropClause({ crops: [], firstOrdinal: 2, pronouns: HIM })).toBe("");
  });

  it("says the transform road's sentence, through its OWNER and not a second spelling", () => {
    /*
      Three clauses were said to this lane before the sentence landed and all
      three put a design a third of the way down a white T-shirt. A copy of the
      wording here would lose that measurement silently, on a frame somebody
      paid for — so the assertion is identity with the owner's own output, and a
      re-spelling reddens.
    */
    const clause = inkViewCropClause({ crops: [crop()], firstOrdinal: 2, pronouns: HIM });
    expect(clause).toContain(inkDeliveredCarrySentence(2, "left upper arm tattoo", HIM));
  });

  it("NEVER says the mannequin sentence about a crop", () => {
    /*
      There is no grey form in this picture, and its surrounding surface is the
      FACT being supplied rather than a hazard to disclaim. The plate lane's
      closing sentence said here would tell the painter to ignore the one thing
      the crop was minted to say.
    */
    const clause = inkViewCropClause({ crops: [crop()], firstOrdinal: 2, pronouns: HIM });
    expect(clause).not.toContain("mannequin");
    expect(clause).not.toContain("Do not take skin");
    /* And it says whose skin it is, positively — the absence above could be had
       by saying nothing at all. */
    expect(clause).toContain("HIS OWN skin");
  });

  it("speaks the CAST'S pronoun, where the plate lane can only say her", () => {
    const his = inkViewCropClause({ crops: [crop()], firstOrdinal: 2, pronouns: HIM });
    expect(his).toContain("HIS TATTOOS");
    expect(his).toContain("It is on his left upper arm");
    expect(his).not.toContain(" her ");

    const theirs = inkViewCropClause({
      crops: [crop()], firstOrdinal: 2, pronouns: pronounsForSex(null),
    });
    /* `they` is correct English for a person whose pronouns the record cannot
       say, and the verb has to agree with it. */
    expect(theirs).toContain("they already have");
  });

  it("carries the SIDE in prose, because a crop cannot picture its own side", () => {
    /*
      A plate holds the side it pictures — the mirror court. A delivered crop is
      the design alone on transparency, so the arm it came off is not in the
      picture at all and prose is the only carrier there is. Through
      `imageHalfClause`'s one owner: her left is the image's RIGHT.
    */
    const left = inkViewCropClause({ crops: [crop()], firstOrdinal: 2, pronouns: HIM });
    expect(left).toContain("his left upper arm (on the right of the picture as you look at it)");

    const right = inkViewCropClause({
      crops: [crop({ slot: "ink:upperArm@right", side: "right", noun: "right upper arm tattoo" })],
      firstOrdinal: 2,
      pronouns: HIM,
    });
    expect(right).toContain("his right upper arm (on the left of the picture as you look at it)");
  });

  it("never says a side for a surface there is one of", () => {
    const clause = inkViewCropClause({
      crops: [crop({ slot: "ink:neck", placement: "neck", side: "centre", noun: "neck tattoo" })],
      firstOrdinal: 2,
      pronouns: HIM,
    });
    expect(clause).toContain("It is on his neck:");
    expect(clause).not.toContain("centre");
  });

  it("quotes the ordinal it is GIVEN, so a sentence cannot point at another lane's picture", () => {
    /* The crops sit behind the plates in one array. A clause that assumed 2
       would describe a plate's picture as a crop the first time both lanes
       carried anything. */
    const clause = inkViewCropClause({
      crops: [crop(), crop({ slot: "ink:neck", placement: "neck", side: "centre", noun: "neck tattoo" })],
      firstOrdinal: 4,
      pronouns: HIM,
    });
    expect(clause).toContain("Reference 4 is the exact left upper arm tattoo");
    expect(clause).toContain("Reference 5 is the exact neck tattoo");
    expect(clause).not.toContain("Reference 2");
  });

  it("ends on the placement discipline — the same words as the plate lane's, pronouns aside", () => {
    /*
      A second SHAPE of one fact and not a second fact. Held to the constant
      with the pronoun substituted, so neither can be edited alone — the same
      way `inkNotOnClothingClause` is held to `INK_NOT_ON_CLOTHING`.
    */
    expect(inkViewPlacementDisciplineClause({ possessive: "her" }))
      .toBe(INK_VIEW_PLACEMENT_DISCIPLINE);
    expect(inkViewPlacementDisciplineClause({ possessive: "his" }))
      .toBe(INK_VIEW_PLACEMENT_DISCIPLINE.replace("her other side", "his other side"));

    const clause = inkViewCropClause({ crops: [crop()], firstOrdinal: 2, pronouns: HIM });
    expect(clause).toContain(inkViewPlacementDisciplineClause(HIM));
    /* Both halves of the discipline, because each is a frame this product would
       otherwise refund: the wrong arm, and a tattoo invented into a view whose
       framing never shows its surface. */
    expect(clause).toContain("do not mirror it to his other side");
    expect(clause).toContain("that tattoo simply does not appear in that view");
  });

  it("says it once per crop and names each one", () => {
    const clause = inkViewCropClause({
      crops: [crop(), crop({ slot: "ink:neck", placement: "neck", side: "centre", noun: "neck tattoo" })],
      firstOrdinal: 2,
      pronouns: HIM,
    });
    expect(clause.match(/Reference \d is the exact/g)).toHaveLength(2);
    /* And the discipline is said ONCE, at the end, rather than per picture. */
    expect(clause.match(/simply does not appear in that view/g)).toHaveLength(1);
  });
});
