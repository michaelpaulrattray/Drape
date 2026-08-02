import { describe, expect, it } from "vitest";

import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";
import {
  CASTING_V2_SIGN_PRICE_CREDITS,
  CAST_PACKAGE_VIEWS,
  CAST_PACKAGE_VIEW_PRICE,
  castPackageView,
  composePackageViewPrompt,
  packageViewExpectation,
} from "./castViewPackage";

/**
 * The package's spec, its price, and the one boundary that keeps view
 * conformance from quietly becoming prompt compliance.
 */
describe("the canonical view package", () => {
  it("promises exactly the six canonical slots, in the ledger's own vocabulary", () => {
    expect([...CAST_PACKAGE_VIEWS]).toEqual([...CANONICAL_VIEW_ANGLES]);
    expect(CAST_PACKAGE_VIEWS.length).toBe(6);
  });

  it("derives the Sign price from the number of views it actually promises", () => {
    // §H.10: 200 promotion + 6 × 50. Derived, so a cohort that promises five
    // views cannot quote a price for six.
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBe(500);
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBe(
      CASTING_V2_SIGN_COSTS.promotion + CAST_PACKAGE_VIEW_PRICE * CAST_PACKAGE_VIEWS.length,
    );
    // The refundable slice is an integer, because the ledger is.
    expect(Number.isSafeInteger(CAST_PACKAGE_VIEW_PRICE)).toBe(true);
  });

  it("gives every slot both a customer-facing spec and a generator directive", () => {
    for (const angle of CAST_PACKAGE_VIEWS) {
      const view = castPackageView(angle);
      expect(view.label.length).toBeGreaterThan(0);
      expect(view.spec.framing.length).toBeGreaterThan(20);
      expect(view.spec.wardrobe.length).toBeGreaterThan(20);
      expect(view.directive.length).toBeGreaterThan(20);
    }
  });

  /**
   * THE BOUNDARY (D-92). The judge is handed the spec and only the spec. If it
   * is ever handed the directive or the code-owned constant, "does this match
   * what we sold" silently becomes "did the model do as it was told" — the
   * settled anti-pattern, and a check that passes happily while the picture is
   * wrong in a way nobody described.
   *
   * Asserted on distinctive phrases rather than on whole strings, because a
   * partial leak is the realistic failure: someone reaches for `view.directive`
   * to "give the judge more context".
   */
  it("never leaks the generation prompt into what the judge is told", () => {
    for (const angle of CAST_PACKAGE_VIEWS) {
      const expectation = packageViewExpectation(angle);
      const judgeText = `${expectation.framing}\n${expectation.wardrobe}`;
      const prompt = composePackageViewPrompt(angle);

      // Nothing the generator is uniquely told may appear in the judge's brief.
      expect(judgeText).not.toContain("OUTPUT FRAME");
      expect(judgeText).not.toContain("AUTHORITY:");
      expect(judgeText).not.toContain("PHOTOREALISTIC ONLY");
      expect(judgeText).not.toContain(castPackageView(angle).directive);

      // And the generator IS told those things — otherwise the assertions above
      // would pass on an empty prompt.
      expect(prompt).toContain(castPackageView(angle).directive);
      expect(prompt).toContain("AUTHORITY:");
    }
  });

  it("puts the code-owned constant last, where it outranks the description", () => {
    const prompt = composePackageViewPrompt("frontFull");
    // The authority paragraph claims precedence over everything above it, so
    // anything appended after it would silently outrank the guarantee.
    expect(prompt.trimEnd().endsWith("it always wins.")).toBe(true);
  });

  it("holds the whole package to one wardrobe", () => {
    const wardrobes = new Set(CAST_PACKAGE_VIEWS.map((angle) => packageViewExpectation(angle).wardrobe));
    // One garment contract, or "did the shirt change between the headshot and
    // the walk" is not a question the judge can answer.
    expect(wardrobes.size).toBe(1);
  });

  it("names no absolute garment colour — continuity is with the reference", () => {
    /*
      The first real Sign failed and refunded its headshot because the spec said
      "mid-grey" while the signed candidate wore off-white: the generator obeyed
      the spec, the judge compared against the reference as instructed, and the
      customer paid for a contradiction we had authored. A colour word here is
      that defect coming back.
    */
    const wardrobe = packageViewExpectation("frontClose").wardrobe.toLowerCase();
    for (const colour of ["mid-grey", "grey", "gray", "off-white", "cream", "black", "white"]) {
      expect(wardrobe).not.toContain(colour);
    }
    expect(wardrobe).toContain("same");
    expect(wardrobe).toContain("reference");
  });

  it("keeps the sixth slot a walk, which is what the product calls it", () => {
    // D-44: `sideFull` is labelled "Walk" everywhere in the product. A spec
    // describing a standing profile would be judging a different photograph
    // from the one the room promises.
    const walk = castPackageView("sideFull");
    expect(walk.label).toBe("Walk");
    expect(walk.spec.framing).toContain("walking");
    expect(walk.directive.toLowerCase()).toContain("walk");
  });
});
