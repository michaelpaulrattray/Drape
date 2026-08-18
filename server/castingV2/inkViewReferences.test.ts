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
  inkPlacementPhrase,
  inkViewReferenceClause,
  type CarriedInkPlate,
} from "./inkViewReferences";

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
    expect(inkPlacementPhrase({ placement: "upperArm", side: "left" })).toBe("her left upper arm");
    expect(inkPlacementPhrase({ placement: "upperChest", side: "centre" })).toBe("her upper chest");
    expect(inkPlacementPhrase({ placement: "neck", side: "centre" })).toBe("her neck");
  });

  it("never says a side for a centred surface", () => {
    /* "her centre neck" is not a sentence a stylist would say, and a laterality
       word on a surface that has one of itself is a claim about anatomy nobody
       measured. */
    expect(inkPlacementPhrase({ placement: "neck", side: "centre" })).not.toContain("centre");
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
    expect(clause).toContain("Reference 2 is the tattoo at her left upper arm.");
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
    expect(clause).toContain("Reference 2 is the tattoo at her left upper arm.");
    expect(clause).toContain("Reference 3 is the tattoo at her right upper arm.");
    expect(clause).toContain("Reference 4 is the tattoo at her upper chest.");
    /* One picture, one sentence — a plate with no sentence is a picture the
       engine has to guess the purpose of. */
    expect(clause.match(/is the tattoo at/g)).toHaveLength(3);
  });
});
