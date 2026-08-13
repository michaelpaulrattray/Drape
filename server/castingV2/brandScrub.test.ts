import { describe, expect, it } from "vitest";

import { containsBrand, scrubBrands } from "./brandScrub";

/**
 * Brand names never reach the image engine.
 *
 * A roll of "a young male Mediterranean model inspired by versace editorial"
 * lost five of eight candidates. The interpreter had written the house name
 * into `role` — "male fashion model, Versace editorial style" — and `role` is
 * composed verbatim into the prompt as CASTING CATEGORY (ABSOLUTE). The
 * archetype layer was careful about brands by ruling; the free-text field
 * beside it was not, which is the whole lesson: the rule is about what reaches
 * the engine, not about one layer's vocabulary.
 */

describe("scrubBrands", () => {
  it("removes the house and keeps the casting category", () => {
    // The exact string the compiler produced on the founder's brief.
    expect(scrubBrands("male fashion model, Versace editorial style")).toBe(
      "male fashion model, editorial style",
    );
  });

  it("leaves a sentence without a hole in it", () => {
    expect(scrubBrands("a model inspired by Gucci")).toBe("a model");
    expect(scrubBrands("Prada casting, severe")).toBe("casting, severe");
  });

  it("removes the longest mark first, so no fragment survives", () => {
    expect(scrubBrands("Louis Vuitton campaign face")).toBe("campaign face");
    expect(scrubBrands("Saint Laurent gaunt look")).toBe("gaunt look");
  });

  it("returns null when the category was only a brand", () => {
    // "cast as — ." in a paid prompt is worse than no category at all.
    expect(scrubBrands("Versace")).toBeNull();
    expect(scrubBrands("Balenciaga")).toBeNull();
  });

  it("is case-insensitive and boundary-safe", () => {
    expect(scrubBrands("VERSACE editorial")).toBe("editorial");
    // A brand token inside an ordinary word is not a brand.
    expect(scrubBrands("a marniest kind of person")).toBe("a marniest kind of person");
  });

  it("leaves ordinary briefs untouched", () => {
    const ordinary = "a retired boxer with a broken nose";
    expect(scrubBrands(ordinary)).toBe(ordinary);
    expect(scrubBrands(null)).toBeNull();
  });

  /*
    THE JEWELLERY HOUSES (fable-406 §3), each with its own negative control.

    The list was fashion houses by design and these were simply absent, so "a
    cartier style gold chain" reached the engine with the mark intact. The
    ruling's condition is the interesting half: a longer list starts eating
    ordinary words, so every token added here is asked to prove it does not.
  */
  it("removes the jewellery houses", () => {
    expect(scrubBrands("a cartier style gold chain necklace")).toBe("a style gold chain necklace");
    expect(scrubBrands("Bulgari jewellery campaign face")).toBe("jewellery campaign face");
    expect(scrubBrands("a BVLGARI serpenti look")).toBe("a serpenti look");
    expect(scrubBrands("Van Cleef & Arpels alhambra styling")).toBe("alhambra styling");
    expect(containsBrand("a cartier style gold chain")).toBe(true);
  });

  /*
    AND TIFFANY IS A PERSON BEFORE IT IS A HOUSE.

    The one token in this batch that could not join plainly: a bare "tiffany"
    would take the name out of a brief describing someone called Tiffany — the
    guard eating the person it exists to protect. So only the forms that can
    only be the house are matched, and the colour is left alone because scrubbing
    "tiffany blue" whole would delete the colour she asked for.
  */
  it("scrubs the jeweller and leaves the woman, the colour and the map", () => {
    expect(scrubBrands("a Tiffany and Co campaign face")).toBe("a campaign face");
    expect(scrubBrands("inspired by Tiffany & Co. jewellery")).toBe("jewellery");

    for (const ordinary of [
      "a model named Tiffany",
      "Tiffany, 24, a dancer from Leeds",
      "a tiffany blue backdrop",
      "a cartography student",
      "a bulgarian dancer",
    ]) {
      expect(scrubBrands(ordinary)).toBe(ordinary);
      expect(containsBrand(ordinary)).toBe(false);
    }
  });

  /*
    A CONNECTIVE STRANDED MID-SENTENCE, which is the trailing rule's own class
    one character short of the end.

    Predates every token above: any brand followed by a full stop left "inspired
    by." welded together in a paid prompt. Both positions are asserted here so
    the pair cannot drift apart again.
  */
  it("does not strand a preposition against the punctuation the brand left behind", () => {
    expect(scrubBrands("inspired by Gucci. A severe face")).toBe("A severe face");
    expect(scrubBrands("a face for Prada, and nothing else")).toBe("a face, and nothing else");
    expect(scrubBrands("a model inspired by Gucci")).toBe("a model");
  });

  it("detects marks for the guard", () => {
    expect(containsBrand("Versace editorial style")).toBe(true);
    expect(containsBrand("editorial style")).toBe(false);
    // Stateful regex: a second call must answer the same way.
    expect(containsBrand("Versace editorial style")).toBe(true);
  });
});
