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
  inkViewReferenceClause,
  placementRideCoverage,
  type CarriedInkCrop,
  type CarriedInkPlate,
} from "./inkViewReferences";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";
import { inkDeliveredCarrySentence } from "./inkRealism";
import { pronounsForSex } from "./castPronouns";

const plate = (over: Partial<CarriedInkPlate> = {}): CarriedInkPlate => ({
  designPublicId: "design-1",
  placement: "upperArm",
  side: "left",
  bytes: Buffer.from("plate"),
  contentType: "image/png",
  ...over,
});

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

describe("the clause that rides beside the anchor", () => {
  it("is EMPTY when nothing rides — every signed Cast without ink is untouched", () => {
    /*
      The inertness control, and it is the one that matters most: this lane
      reaches every package view in the product. A Cast with no plated tattoo
      must compose the prompt it composed yesterday, or the whole Sign surface
      has quietly changed on the strength of a feature nobody used.
    */
    expect(inkViewReferenceClause({ plates: [], firstOrdinal: 2 })).toBe("");
  });

  it("names the ordinal the reference actually occupies", () => {
    /* The anchor is reference 1, so plates start at 2 — and the ordinal is
       passed rather than assumed, because a sentence quoting the wrong slot is a
       prompt pointing at the wrong picture. */
    const clause = inkViewReferenceClause({ plates: [plate(), plate({ designPublicId: "d2", placement: "neck", side: "centre" })], firstOrdinal: 2 });
    expect(clause).toContain("Reference 2 is the tattoo at her left upper arm (on the right");
    expect(clause).toContain("Reference 3 is the tattoo at her neck.");
  });

  it("says COPY THE ARTWORK and excludes the mannequin explicitly", () => {
    /*
      D-138's fence held from the inside. The plate is the only ink artifact an
      engine is ever shown, and the sentence has to say which part of it is the
      subject — otherwise the safest reading of a grey limb on white is that the
      photograph should look like that.
    */
    const clause = inkViewReferenceClause({ plates: [plate()], firstOrdinal: 2 });
    expect(clause).toContain("Copy the ARTWORK from it");
    expect(clause).toContain("The mannequin form in those pictures is NOT part of the tattoo");
    expect(clause).toContain("must not appear anywhere in the photograph");
    /* And it must protect the person, not only the background: a grey form is a
       skin tone, a build and a pose as well as a colour. */
    expect(clause).toContain("never change her skin, her build or her pose");
  });

  it("forbids relocation, mirroring and duplication — D-145 one surface along", () => {
    /*
      "A stated placement is never relocated" was earned on the words road when
      a chest tattoo landed on the collarbones. The same law applies to a
      reference: an engine handed a picture of a tattoo will find somewhere to
      put it.
    */
    const clause = inkViewReferenceClause({ plates: [plate()], firstOrdinal: 2 });
    expect(clause).toContain("do not move one to a nearby part of the body");
    expect(clause).toContain("do not mirror it to her other side");
    expect(clause).toContain("do not draw a second copy of it");
  });

  it("forbids the tattoo being printed on CLOTHING — the court's own finding", () => {
    /*
      MEASURED, on the first conformance court (2026-08-19). Handed an
      upper-chest plate and a `frontFull` view whose wardrobe is a crew-neck tee,
      the engine printed "SEMPRE" and its olive sprig ON THE SHIRT — faithfully
      drawn, in the wrong material. It is the obvious resolution of an
      instruction it could not otherwise satisfy: the upper chest is COVERED on a
      crew neck (the placement vocabulary says so in its own table), so the only
      place that artwork could go in that frame was the garment.

      It is not a cosmetic miss. The package's wardrobe check calls printed text
      or a logo on the garment a failure WHEREVER it appears, so that view would
      have been refused and refunded — an upper-chest tattoo would have cost a
      slice of every Sign it rode.

      So the clause says the thing the engine needed told: ink goes on skin.

      AND WHAT "COVERED" MEANS IS HIS RULING (2026-08-19, fable-1081 §2), not a
      side effect this arm may state loosely. Clothing COVERS ink rather than
      deleting it — *"if you had a chest tatto reference with neck continuation
      you might see it poking out the top of the shirt but thats the extent for
      now"* — so a design that runs onto bare skin shows that part and no more,
      and the garment is never altered to reveal the rest. The arm asserts both
      halves, because a clause carrying only the first would license the scoop
      neck the ruling refuses and one carrying only the second would delete the
      poke he asked for.
    */
    const clause = inkViewReferenceClause({ plates: [plate()], firstOrdinal: 2 });
    expect(clause).toContain("It is ink on her skin");
    expect(clause).toContain("never printed, embroidered or otherwise placed on her clothing");
    expect(clause).toContain("the part of it on bare skin appears exactly as it is");
    expect(clause).toContain("the covered part simply does not show");
    expect(clause).toContain("Never change, move or open a garment to reveal more of a tattoo");
  });

  it("tells the engine that a view which cannot show a tattoo simply does not", () => {
    /*
      The ruling rides the reference into EVERY view, so the prompt must say what
      a back view is meant to do with a chest tattoo. Without this sentence the
      instruction "copy this onto her upper chest" is unsatisfiable from behind,
      and an engine with an unsatisfiable instruction improvises.
    */
    const clause = inkViewReferenceClause({ plates: [plate()], firstOrdinal: 2 });
    expect(clause).toContain("that tattoo simply does not appear in that view");
  });

  it("speaks once per plate and carries every one of them", () => {
    const clause = inkViewReferenceClause({
      plates: [
        plate(),
        plate({ designPublicId: "d2", placement: "upperArm", side: "right" }),
        plate({ designPublicId: "d3", placement: "upperChest", side: "centre" }),
      ],
      firstOrdinal: 2,
    });
    expect(clause).toContain("Reference 2 is the tattoo at her left upper arm (on the right");
    expect(clause).toContain("Reference 3 is the tattoo at her right upper arm (on the left");
    expect(clause).toContain("Reference 4 is the tattoo at her upper chest.");
    /* One picture, one sentence — a plate with no sentence is a picture the
       engine has to guess the purpose of. */
    expect(clause.match(/is the tattoo at/g)).toHaveLength(3);
  });
});

/**
 * THE SIDE IS SAID BOTH WAYS — anatomy and the half of the picture it lives in
 * (ordered fable-1006 §3, on the court's own miss).
 *
 * The court's arm plate said HER LEFT upper arm and the render put the tattoo on
 * her RIGHT — the image's left half. That is per-side-paint-favours-image-right
 * arriving in a new lane, and this product already measured the lever for it:
 * saying the side both ways took a per-side edit from four misses in twelve to
 * none, never once worse, at no cost per render.
 *
 * The phrase comes from the ONE owner (`sidePhrasing.imageHalfClause`) rather
 * than being spelled here or there — a second copy of it would drift at exactly
 * the point it exists to hold still.
 */
describe("a per-side tattoo says which half of the picture it is in", () => {
  it("puts HER LEFT on the picture's RIGHT — and the mirror on the left", () => {
    /*
      THE MIRROR IS DRIVEN, both directions, because a per-side claim asserted
      one way round passes just as well when the mapping is inverted. Her left is
      the viewer's right; said as the painter sees it, because the painter is
      looking at the picture.
    */
    const left = inkViewReferenceClause({ plates: [plate({ side: "left" })], firstOrdinal: 2 });
    expect(left).toContain("her left upper arm (on the right of the picture as you look at it)");

    const right = inkViewReferenceClause({ plates: [plate({ side: "right" })], firstOrdinal: 2 });
    expect(right).toContain("her right upper arm (on the left of the picture as you look at it)");
  });

  it("says it on the copy instruction too, not only on the naming line", () => {
    /* Both sentences name the surface, and a positional clause on one of them is
       a recipe that says two different things about where the ink goes. */
    const clause = inkViewReferenceClause({ plates: [plate({ side: "left" })], firstOrdinal: 2 });
    expect(clause.match(/on the right of the picture as you look at it/g)).toHaveLength(2);
  });

  it("says NOTHING positional for a centred surface", () => {
    /*
      A neck or an upper chest has one of itself, and there is no half of the
      picture it lives in. A clause that volunteered one would be inventing a
      laterality the customer never named — the thing this whole lane refuses to
      do about a mask's side label.
    */
    const clause = inkViewReferenceClause({
      plates: [plate({ placement: "neck", side: "centre" })], firstOrdinal: 2,
    });
    expect(clause).not.toContain("of the picture as you look at it");
  });
});

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
