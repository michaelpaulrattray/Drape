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
  it("promises five generated views, in the order the strip reads them", () => {
    /*
      PACKAGE v3.1, the final composition: close-up, three-quarter, front,
      profile, back — with the Master leading the strip as presentation only.
      Read as angles it is a clean 0°/45°/90°/180° turnaround plus the detail
      shot.

      The retirement is asserted BY NAME, because a retired view coming back is
      exactly the kind of change that should have to argue for itself — and
      because this list has now moved three times, each time repricing the
      product through the derived constant below.
    */
    expect([...CAST_PACKAGE_VIEWS]).toEqual([
      "closeUp",
      "threeQuarter",
      "frontFull",
      "sideClose",
      "backFull",
    ]);
    // The walk retired in v2; the portrait in v3.1, because the Master already
    // shows her chest-up and square to camera — three frontal crops was one too
    // many.
    expect(CAST_PACKAGE_VIEWS).not.toContain("sideFull");
    expect(CAST_PACKAGE_VIEWS).not.toContain("frontClose");
    expect(new Set(CAST_PACKAGE_VIEWS).size).toBe(CAST_PACKAGE_VIEWS.length);
  });

  it("keeps the close-up out of the comp-card six", () => {
    /*
      `closeUp` is a Casting V2 package view, not a canonical comp-card angle.
      Folding it into `CANONICAL_VIEW_ANGLES` broke thirty legacy assertions
      that correctly say the comp card is six — the export filenames, the PDF
      cells, the ink registry, the iterate crops. It lives in the same database
      column and in its own vocabulary.
    */
    expect(CANONICAL_VIEW_ANGLES).not.toContain("closeUp");
    expect(CANONICAL_VIEW_ANGLES.length).toBe(6);
  });

  it("still knows the retired walk, because two signed Casts own one", () => {
    // A package is a historical record. Deleting the entry would leave their
    // walk slot rendering with no label.
    expect(castPackageView("sideFull").label).toBe("Walk");
  });

  it("specifies the close-up as a BAND, failable from both sides", () => {
    /*
      The founder's final framing, and the reason it is a range rather than a
      point: a single ideal crop can only be judged by "how close is this",
      which a vision model answers with a shrug. Two named landmarks and two
      named failure directions can each be checked by looking.

      v3 shipped a macro cropped at the lower lip. It was too tight — a face
      with no chin is a texture sample, not a portrait of anyone — so the
      shipped spec is now a conformance FAILURE under its own successor.
    */
    const closeUp = castPackageView("closeUp");
    expect(closeUp.label).toBe("Close-up");

    // What must be in frame: the tight bound.
    expect(closeUp.spec.framing).toContain("BELOW the chin");
    expect(closeUp.spec.framing).toContain("both eyes");
    // The band itself, stated by its two landmarks.
    expect(closeUp.spec.framing).toContain("eyebrows-to-chin");
    expect(closeUp.spec.framing).toContain("forehead-to-chin");
    // BOTH failure directions, or the judge has nothing to fail on.
    expect(closeUp.spec.framing).toContain("TOO TIGHT");
    expect(closeUp.spec.framing).toContain("TOO LOOSE");
    // And the superseded macro language is gone, not merely softened.
    expect(closeUp.spec.framing).not.toContain("tight macro");
    expect(closeUp.directive).not.toContain("EXTREME CLOSE-UP MACRO");
    expect(closeUp.directive).not.toContain("below the lower lip");
  });

  it("brings the three-quarter back with its spec intact", () => {
    /*
      45° is the angle downstream generation actually asks for, and it was the
      one genuinely missing viewpoint. Its entry survived the v3 retirement
      untouched — including the reference-relative wardrobe the maiden voyage
      forced, which it inherited from the shared constant rather than carrying
      its own copy. A per-view wardrobe string would have rotted here silently.
    */
    const threeQuarter = castPackageView("threeQuarter");
    expect(threeQuarter.label).toBe("Three-quarter");
    expect(threeQuarter.spec.framing).toContain("45 degrees");
    expect(threeQuarter.spec.framing).toContain("both eyes still visible");
    // Reference-relative, never an absolute colour (the maiden-voyage defect).
    expect(threeQuarter.spec.wardrobe).not.toMatch(/mid-grey|off-white/);
  });

  it("derives the Sign price from the number of views it actually promises", () => {
    // §H.10 as amended: 200 promotion + 5 × 50. Derived, so retiring a view
    // reprices the product rather than leaving a literal behind.
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBe(450);
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

  it("holds every full view to one wardrobe, and lets the close-up be honest", () => {
    const full = CAST_PACKAGE_VIEWS.filter((angle) => angle !== "closeUp");
    const wardrobes = new Set(full.map((angle) => packageViewExpectation(angle).wardrobe));
    // One garment contract across the views that can actually show a garment,
    // or "did the shirt change between the front and the back" is not a
    // question the judge can answer.
    expect(wardrobes.size).toBe(1);

    /*
      The close-up is deliberately different. At that crop the garment is often
      not in frame at all, and the judge is told to fail an axis it is unsure
      about — so the shared sentence would refund views for being hard to see.
      Its own sentence makes "nothing visible" a stated pass and keeps the axis
      pointed at what a close-up CAN show: things added to the face.
    */
    const closeUp = packageViewExpectation("closeUp").wardrobe;
    expect(closeUp).not.toBe(packageViewExpectation("frontFull").wardrobe);
    expect(closeUp).toContain("passes");
    expect(closeUp).toContain("earrings");
  });

  it("names no absolute garment colour — continuity is with the reference", () => {
    /*
      The first real Sign failed and refunded its headshot because the spec said
      "mid-grey" while the signed candidate wore off-white: the generator obeyed
      the spec, the judge compared against the reference as instructed, and the
      customer paid for a contradiction we had authored. A colour word here is
      that defect coming back.
    */
    const wardrobe = packageViewExpectation("frontFull").wardrobe.toLowerCase();
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

describe("the wardrobe axis only judges what the reference can establish", () => {
  it("does not ask the judge about clothing the anchor cannot show", () => {
    /*
      The maiden voyage lost a view to "mid-grey vs off-white"; the v3.1
      verification lost its full back to "dark leather dress shoes instead of
      plain neutral shoes". Same class, second occurrence: the anchor is a
      CHEST-UP photograph, so it shows no trousers and no shoes, and the judge
      was left adjudicating our own adjective against its own taste. An axis
      told to fail when unsure must never be pointed at something the reference
      cannot establish.
    */
    const wardrobe = castPackageView("backFull").spec.wardrobe;
    expect(wardrobe).toContain("CANNOT be compared");
    expect(wardrobe).toContain("must not fail this check");
    /*
      Trousers and shoes are still NAMED — the judge has to be told which
      garments it cannot adjudicate, or the exclusion is unstateable. What must
      be gone is the REQUIREMENT: the spec no longer demands a particular kind
      of them, which is what the judge was measuring its own taste against.
    */
    expect(wardrobe).not.toContain("plain unbranded neutral trousers");
    expect(wardrobe).not.toContain("plain unbranded shoes");
    // Additions remain a failure wherever they appear — that is the half of
    // this axis that IS answerable from a chest-up reference.
    expect(wardrobe).toMatch(/jacket|jewellery|logo/);
  });

  it("still tells the GENERATOR what to put on her legs", () => {
    /*
      The instruction moved rather than vanished. `spec.wardrobe` is read by the
      judge AND the generator (`composePackageViewPrompt`), so scoping it for
      the judge would have quietly stopped asking for trousers at all — the fix
      creating a worse defect than the one it closed.
    */
    for (const angle of ["frontFull", "sideFull", "backFull"] as const) {
      expect(castPackageView(angle).directive).toContain("Below the waist");
      expect(castPackageView(angle).directive).toContain("trousers");
    }
    // And never on a view that does not reach the waist.
    for (const angle of ["closeUp", "threeQuarter", "sideClose"] as const) {
      expect(castPackageView(angle).directive).not.toContain("Below the waist");
    }
  });
});
