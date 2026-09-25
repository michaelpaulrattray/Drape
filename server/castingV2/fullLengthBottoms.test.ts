/**
 * ⚠ THE PROMPT ORDERED THE TROUSERS IT WAS BLAMED FOR HALLUCINATING.
 *
 * The founder, on two signed packages that each lost a full-length view: *"we
 * need a fix for the hallucinated trousers?"* They were not hallucinated.
 *
 * Both full-length directives ENDED with this, hard-coded — and it went into the
 * same prompt as the wardrobe block, four lines apart:
 *
 * ```
 * FULL BODY FRONT VIEW … standing still rather than posing.Below the waist,
 * plain unbranded neutral trousers and plain unbranded shoes …
 *
 * WARDROBE: exactly this outfit, unchanged across every view: a rough
 * animal-hide wrap draped over one shoulder, a plain hide loincloth, bare feet.
 * ```
 *
 * A block contradicting itself in the same breath, which an image model resolves
 * by picking one, silently, per view. **Measured: 2 of 4 full-length views
 * across the two Sign court arms** — the caveman's `backFull` came back in
 * *"long trousers and shoes"* and the Basics cast's `frontFull` in *"dark gray
 * full-length pants and black shoes"*, each caught by the judge, refused and
 * refunded at 50 credits.
 *
 * # The judge caught us because HALF the design had landed
 *
 * §3.3's table has a row for the five signed views and a row for the wardrobe
 * judge, both to derive from `currentWardrobeLine` so generator and judge cannot
 * drift. The judge half shipped; the generator half did not. So the product paid
 * a text model to referee a disagreement it had manufactured, and refunded the
 * customer when its own two sentences lost.
 *
 * `packageViewExpectation` still deliberately does not read `directive` — its
 * docblock says why, and that separation is the only reason this was visible at
 * all: *"if this function ever reaches for `directive`, view conformance
 * silently becomes prompt compliance."*
 *
 * # Both directions, because a one-sided flag is a flag nobody has read
 *
 * With a line the sentence must GO. With no line it must STAY, byte for byte —
 * that is every Cast signed to date, whose chest-up reference names no bottoms
 * and for whom our own restrained default is the honest answer.
 */
import { describe, expect, it } from "vitest";

import { CAST_PACKAGE_VIEWS, composePackageViewPrompt } from "./castViewPackage";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";

/** The two views that show below the waist. */
const FULL_LENGTH = ["frontFull", "backFull"] as const;
const HIDE = "a rough animal-hide wrap draped over one shoulder, a plain hide loincloth, bare feet";
/** The exact clause, so a reworded copy of it cannot slip past this file. */
const BOTTOMS = "plain unbranded neutral trousers and plain unbranded shoes";
/** What a full-length view is told instead, since #1207. */
const CONTINUE = "CONTINUE THE SAME OUTFIT the reference photograph shows";

describe("a full-length view is not told two different things about the bottoms", () => {
  it("⚠ WITH A LINE the trousers clause is GONE and the outfit is stated", () => {
    for (const angle of FULL_LENGTH) {
      const prompt = composePackageViewPrompt(angle, HIDE);
      expect(prompt, angle).not.toContain(BOTTOMS);
      expect(prompt, angle).toContain("a plain hide loincloth, bare feet");
      /* Not merely absent — the word itself is gone, so a paraphrase of the old
         clause reintroduced elsewhere would still be caught here. */
      expect(prompt, angle).not.toMatch(/\btrousers\b/i);
      expect(prompt, angle).not.toMatch(/\bshoes\b/i);
    }
  });

  it("⚠ WITH NO LINE it names no garment either — the population is ALL of them (#1207)", () => {
    /*
      ⚠ **THIS ARM ASSERTED THE OPPOSITE UNTIL 2026-09-25, AND ITS REASONING IS
      WHY THE DEFECT LASTED.** It read *"WITH NO LINE it is intact, character
      for character — every existing Cast"*, and called the trousers clause
      *"our own restrained default … the honest answer rather than a
      contradiction"*. Two things were wrong with that, and only the second was
      visible from inside this file.

      **One: it was not a default, it was the whole product.** Read at
      production the day this changed, **5 of 5 signed Casts carry no stored
      line, all time** — so `castPackageWardrobeSpec`'s composed road has never
      run once, and this branch is not the fallback it is described as. Since
      #203 made the roll's path column a constant `null`, no future Cast can
      take the other branch either.

      **Two: a chest-up reference cannot establish her hem, but it does
      establish her OUTFIT** — and naming trousers and shoes overrides it rather
      than extending it. His Sifr cast, verbatim: *"she is wearing pants and
      shoes these dont match her described outfit at all in the brief."* The
      engine was obeying us, exactly as it was for the loincloth in 2026-08-23.

      So the clause stays (dropping it would stop asking about the legs at all,
      which `castViewPackage.test.ts` guards) and it now points at the reference.
    */
    for (const angle of FULL_LENGTH) {
      const prompt = composePackageViewPrompt(angle, null);
      expect(prompt, angle).not.toContain(BOTTOMS);
      expect(prompt, angle).not.toMatch(/\btrousers\b/i);
      expect(prompt, angle).not.toMatch(/\bshoes\b/i);
      expect(prompt, angle).toContain(CONTINUE);
    }
  });

  it("⚠ IT IS THE LINE THAT DECIDES, on any line — not the Basics one by name", () => {
    /*
      The trap this arm exists for: a fix keyed on the PATH rather than on the
      presence of a line would work for the two outfits I happened to test and
      fail for the engine's pick, which is the population the whole Wardrobe
      path exists to serve.
    */
    for (const line of [HOUSE_WARDROBE_LINE, basicsWardrobeLine("male"), basicsWardrobeLine(null), HIDE]) {
      for (const angle of FULL_LENGTH) {
        expect(composePackageViewPrompt(angle, line), `${angle} / ${line}`).not.toContain(BOTTOMS);
      }
    }
  });

  it("⚠ NO OTHER VIEW EVER CARRIED IT, and none gains it", () => {
    /*
      A close-up that quietly acquired a bottoms instruction would be composing
      about pixels it does not contain. `belowWaist` is declared per view rather
      than inferred from a name so a sixth view states its own answer instead of
      being caught by a regex on "Full".
    */
    const others = CAST_PACKAGE_VIEWS.filter((angle) => !FULL_LENGTH.includes(angle as never));
    expect(others.length, "there are views that are not full-length").toBeGreaterThan(0);
    for (const angle of others) {
      for (const line of [null, HIDE]) {
        expect(composePackageViewPrompt(angle, line), `${angle}`).not.toContain(BOTTOMS);
      }
    }
  });

  it("CONTROL — both readers can see what they are looking for", () => {
    /*
      Every arm in this file is now an absence, and an absence passes on
      nothing. Two positives, because two different readers do the work.

      ⚠ **This control's positive USED TO BE the trousers clause itself, found
      in the real prompt — and that is exactly why it had to move (#1207).** The
      string is gone from the product now, so a control still asserting it would
      be red for the right reason and useless either way. What made it a control
      was never the particular sentence: it was the same reader running over the
      same function's REAL output. That property is what is kept here.
    */
    expect(composePackageViewPrompt("frontFull", null)).toContain(CONTINUE);
    expect(composePackageViewPrompt("backFull", null)).toContain(CONTINUE);

    /*
      And the absence readers driven over the one text they exist to catch, so a
      mangled constant or a regex that can never match cannot make the four
      absence arms above pass vacuously — which is the way this file would fail
      silently rather than loudly.
    */
    expect(`Below the waist, ${BOTTOMS}.`).toContain(BOTTOMS);
    expect(/\btrousers\b/i.test(BOTTOMS), "the trousers reader is inert").toBe(true);
    expect(/\bshoes\b/i.test(BOTTOMS), "the shoes reader is inert").toBe(true);
  });
});
