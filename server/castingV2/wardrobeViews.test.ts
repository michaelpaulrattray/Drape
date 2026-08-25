import { describe, expect, it } from "vitest";
import {
  CAST_PACKAGE_VIEWS,
  CAST_PACKAGE_WARDROBE_SPEC,
  castPackageWardrobeSpec,
  composePackageViewPrompt,
  packageViewExpectation,
} from "./castViewPackage";
import { castWardrobeLine } from "./wardrobeLine";

/**
 * THE FIVE VIEWS AND THEIR JUDGE READ ONE ANSWER (design §3.3, item 6).
 *
 * The Cast's outfit is decided once at Sign and stored on its own record. What
 * these arms hold is the property that costs money when it breaks: **the
 * sentence the view was GENERATED from and the sentence it is JUDGED against
 * are the same sentence**. A judge told a different outfit than the prompt
 * asked for fails a view for obeying its instructions — five views, the wardrobe
 * axis, refunded slices, which is how the crew-neck chest design already cost
 * the customer money.
 */
describe("the package's wardrobe sentence", () => {
  const LINE = "dark canvas work jacket, straight jeans, plain boots";
  /*
    ⚠ The view with its own sentence is `closeUp`, NOT `frontClose`, and that
    distinction is one this file's own header warns about: `frontClose` means
    "Headshot" everywhere else in the product, and the package's `frontClose` is
    a tight close-up. The one carrying `CLOSE_UP_WARDROBE` is `closeUp`. Read off
    the source rather than inferred from the name, after inferring it wrongly.
  */
  const FULL_VIEWS = CAST_PACKAGE_VIEWS.filter((angle) => angle !== "closeUp");

  describe("⚠ UNPATHED IS UNCHANGED — every Cast signed to date", () => {
    it("is the constant, verbatim, on every view that shares it", () => {
      for (const angle of FULL_VIEWS) {
        expect(packageViewExpectation(angle).wardrobe).toBe(CAST_PACKAGE_WARDROBE_SPEC);
      }
      expect(castPackageWardrobeSpec(null)).toBe(CAST_PACKAGE_WARDROBE_SPEC);
    });

    it("keeps the below-frame clause, which is the honest answer with nothing written down", () => {
      expect(CAST_PACKAGE_WARDROBE_SPEC).toContain("CANNOT be compared to it and must not fail this check");
    });
  });

  describe("with a line", () => {
    it("⚠ the generator and the judge are given the SAME sentence", () => {
      /*
        One function, two callers. This is the arm the whole slice exists for:
        `composePackageViewPrompt` and `packageViewExpectation` derive their
        wardrobe sentence from one place, so they cannot come to describe two
        outfits.
      */
      for (const angle of CAST_PACKAGE_VIEWS) {
        const expectation = packageViewExpectation(angle, LINE);
        expect(composePackageViewPrompt(angle, LINE)).toContain(`WARDROBE: ${expectation.wardrobe}`);
      }
    });

    it("names the outfit and makes the FULL-LENGTH views judgeable for the first time", () => {
      const spec = castPackageWardrobeSpec(LINE);
      expect(spec).toContain(LINE);
      /*
        §3.3's payoff. The below-frame escape exists because a chest-up
        reference cannot establish trousers or shoes; a written line can, so the
        clause that told the judge to ignore them goes.
      */
      expect(spec).not.toContain("CANNOT be compared");
      expect(spec).toContain("below the frame of the reference photograph");
    });

    it("⚠ stops calling a JACKET an addition — the line may BE one", () => {
      /*
        The same self-contradiction the roll prompt's "No jackets" had, in the
        one place where the price is a refunded slice: a judge told that a
        jacket fails wherever it appears, handed a Cast whose outfit is a work
        jacket, fails a view for wearing what we asked for.
      */
      expect(CAST_PACKAGE_WARDROBE_SPEC).toContain("a jacket");
      expect(castPackageWardrobeSpec(LINE)).not.toContain("a jacket");
      /* And the rest of the addition list survives, which it CAN because the
         door refuses hats, props, logos and printed text in the line. */
      for (const addition of ["jewellery", "a hat", "a bag", "a prop", "printed"]) {
        expect(castPackageWardrobeSpec(LINE), addition).toContain(addition);
      }
    });

    it("leaves the CLOSE-UP's own sentence alone", () => {
      /*
        It is written about the REFERENCE rather than about a spec — *where the
        collar IS visible it matches the reference's neckline* — so it is
        already correct on every path, including a Basics Cast with no collar.
      */
      const closeUp = packageViewExpectation("closeUp", LINE).wardrobe;
      expect(closeUp).toBe(packageViewExpectation("closeUp").wardrobe);
      expect(closeUp).not.toContain(LINE);
    });

    it("CONTROL — a different line really produces a different expectation", () => {
      expect(packageViewExpectation("frontFull", LINE).wardrobe)
        .not.toBe(packageViewExpectation("frontFull", "a plain white tee and dark jeans").wardrobe);
    });
  });
});

/**
 * READING THE SNAPSHOT BACK — the one reader, and it fails safe.
 *
 * `technicalSchema` is an unstructured column written across several eras, so
 * everything unrecognised answers `null`: compose and judge exactly as the
 * product always has. The alternative dresses a Cast in an outfit nobody chose.
 */
describe("castWardrobeLine", () => {
  it("reads the line Sign stored", () => {
    expect(castWardrobeLine({ wardrobe: { path: "wardrobe", line: "a red apron", source: "born" } }))
      .toBe("a red apron");
  });

  it("answers null for every shape that is not one", () => {
    for (const schema of [
      null,
      undefined,
      "a string",
      42,
      {},
      /* Every Cast signed before the paths existed: no key at all. */
      { subject: {}, cohortKey: "photoreal_human" },
      /* The unpathed snapshot this Sign writes today. */
      { wardrobe: { path: null, line: null, source: null } },
      /* An incoherent roll — a path with no line. Refused, never guessed. */
      { wardrobe: { path: "basics", line: null, source: null } },
      { wardrobe: "a red apron" },
      { wardrobe: { line: "   " } },
    ]) {
      expect(castWardrobeLine(schema), JSON.stringify(schema)).toBeNull();
    }
  });
});
