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

  it("detects marks for the guard", () => {
    expect(containsBrand("Versace editorial style")).toBe(true);
    expect(containsBrand("editorial style")).toBe(false);
    // Stateful regex: a second call must answer the same way.
    expect(containsBrand("Versace editorial style")).toBe(true);
  });
});
