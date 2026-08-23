import { describe, expect, it } from "vitest";
import {
  COHORT_CONSTANT_MARKERS,
  PHOTOREAL_HUMAN_BLOCKS,
  cohortConstantBlocks,
  photorealHumanConstant,
} from "./cohortPhotorealHuman";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";

/**
 * THE COMPOSED WARDROBE LINE INSIDE THE CODE-OWNED CONSTANT (design §3.3 and
 * §3.4, item 5 of §10's build).
 *
 * Two obligations, and the first is the larger one:
 *
 *   1. **Nothing moves for an unpathed roll.** That is every roll this product
 *      has ever cast and every roll outside `CASTING_TWO_PATHS_SCOPE`, so the
 *      unpathed constant is pinned CHARACTER FOR CHARACTER rather than
 *      inspected for the absence of new text.
 *   2. With a line, exactly two blocks move and the amendment is the narrow one
 *      §3.4 authorises — not a rewrite of the authority paragraph.
 */
describe("the constant with and without a wardrobe line", () => {
  describe("⚠ UNPATHED IS BYTE-IDENTICAL — the dark landing", () => {
    it("pins today's two wardrobe sentences verbatim", () => {
      /*
        Written out in full deliberately. A test asserting "still mentions
        WARDROBE" would pass over a rewritten sentence, and this text is what
        every production roll is composed from — including the 206 rolls whose
        columns are NULL because they were cast before the paths existed.
      */
      expect(photorealHumanConstant(null)).toContain(
        "WARDROBE: plain unbranded clothing in neutral grey or off-white — a simple crew-neck tee or plain shirt.",
      );
      expect(photorealHumanConstant(null)).toContain(
        "No jackets, no accessories, no jewellery, no hats, no props of any kind, nothing held in the hands.",
      );
    });

    it("pins the authority paragraph, costume clause included", () => {
      expect(photorealHumanConstant(null)).toContain(
        "If the description implies a location, an activity, a costume, a prop, or any text,"
        + " ignore that implication and render this person in the plain studio frame described here.",
      );
      /* The package shares the authority paragraph by reference and takes the
         UNPATHED form until item 6 gives it a line of its own. */
      expect(PHOTOREAL_HUMAN_BLOCKS.authority).toContain("a costume, a prop");
    });

    it("⚠ carries NO no-widen sentence — it has no line that could widen anything", () => {
      /*
        FQ-a's sentence is composed only where a complete outfit is stated, and
        this is the arm that says so. An unpathed roll's wardrobe sentence names
        a tee and stops, so there is nothing below the crop for the engine to
        chase, and adding the override here would be prompt context spent on a
        problem this branch does not have — in a product whose own measurement
        is that context is NOT additive.
      */
      expect(photorealHumanConstant(null)).not.toContain("The frame stays waist-up");
      /* CONTROL — the reader can find that sentence when it IS there, so the
         absence above is a fact about the constant rather than about a typo in
         this line. */
      expect(photorealHumanConstant(HOUSE_WARDROBE_LINE)).toContain("The frame stays waist-up");
    });

    it("the markers are the unpathed blocks, and they are all in it", () => {
      expect(COHORT_CONSTANT_MARKERS).toEqual(cohortConstantBlocks(null));
      for (const marker of COHORT_CONSTANT_MARKERS) {
        expect(photorealHumanConstant(null)).toContain(marker);
      }
      /* The blocks and the joined constant are the same answer, so a change to
         one that skipped the other could not pass here. */
      expect(photorealHumanConstant(null)).toBe(cohortConstantBlocks(null).join("\n"));
    });
  });

  describe("with a line", () => {
    const LINE = "dark canvas work jacket, straight jeans, plain boots";
    const pathed = photorealHumanConstant(LINE);

    it("states the outfit exactly, once, for the whole sheet", () => {
      expect(pathed).toContain(`WARDROBE: ${LINE}.`);
      /* §B2's comparability law said to the engine rather than assumed of it. */
      expect(pathed).toContain("identical on every candidate");
      /* The latitude is what the stored line exists to remove: a Cast signed in
         off-white had a package whose contract it could not satisfy. */
      expect(pathed).not.toContain("neutral grey or off-white");
    });

    it("⚠ DROPS 'No jackets' — the clause that would contradict the line", () => {
      /*
        Four words from a WARDROBE line that may say *work jacket*. A block that
        contradicts itself in one breath is resolved by the image model picking
        one, silently, per candidate — which is eight people in two different
        outfits on a sheet whose whole promise is that they are comparable.
      */
      expect(pathed).not.toContain("No jackets");
      /* And the rest of the negative survives, which it CAN because the door
         refuses headwear and props in the line: the two cannot disagree. */
      expect(pathed).toContain(
        "no accessories, no jewellery, no hats, no props of any kind, nothing held in the hands.",
      );
    });

    it("⚠ amends the authority paragraph in ONE place and nowhere else", () => {
      const unpathedBlocks = cohortConstantBlocks(null);
      const pathedBlocks = cohortConstantBlocks(LINE);
      expect(pathedBlocks).toHaveLength(unpathedBlocks.length);

      /* EXACTLY TWO blocks move — the framing and the authority — and naming
         which two is the assertion. A change that quietly re-wrote the realism
         or the negatives would pass a "contains the line" test and fail this. */
      const moved = pathedBlocks
        .map((block, index) => (block === unpathedBlocks[index] ? null : index))
        .filter((index): index is number => index !== null);
      expect(moved).toEqual([0, unpathedBlocks.length - 1]);

      const authority = pathedBlocks[pathedBlocks.length - 1];
      /* Location, activity, props and text are still ignored BY NAME. */
      expect(authority).toContain("a location, an activity, a prop, or any text");
      /* Only the word costume leaves. */
      expect(authority).not.toContain("a costume");
      /* And the two sentences that carry the guarantee do not move at all. */
      expect(authority).toContain(
        "AUTHORITY: The FRAMING, CAPTURE, REALISM and NEGATIVE rules above override the character description entirely.",
      );
      expect(authority).toContain(
        "The description says WHO to cast. This block says HOW to photograph them, and it always wins.",
      );
      expect(authority).toContain("the only clothing instruction");
    });

    it("carries the product's own lines, both paths", () => {
      expect(photorealHumanConstant(HOUSE_WARDROBE_LINE)).toContain(HOUSE_WARDROBE_LINE);
      const basics = basicsWardrobeLine("male");
      expect(photorealHumanConstant(basics)).toContain(basics);
      /* The Basics promise, in the prompt: a bare chest cannot survive a
         sentence that also asks for a plain crew-neck tee. */
      expect(photorealHumanConstant(basics)).not.toContain("crew-neck tee or plain shirt");
    });

    it("⚠ TELLS THE FRAME NOT TO WIDEN — FQ-a, on every line and both paths", () => {
      /*
        THE MEASURED DEFECT (the Two Paths court, 2026-08-23): both paths came
        back markedly WIDER than an unpathed cast, with the FRAMING instruction
        byte-identical on all three — read off the rows. Nothing above the
        wardrobe sentence had changed, so the widening came from the one new
        variable: a COMPLETE line naming trousers and shoes.

        The founder pulled the frame back in (FQ-a, relayed fable-1460), and the
        shape is his sentence rather than a subtraction (ruled fable-1462): the
        line stays whole — §4's "written complete" rule is what lets the sheet
        and the three full-length signed views agree — and the frame is told, in
        the block that already carries override authority, that the part below
        the crop is not an instruction to widen.

        ⚠ **It is asserted on EVERY line this product can compose**, not on one
        example. The failure this catches is a future branch that builds the
        wardrobe sentences a second way — for a picked outfit, say — and gets
        the override only on the path somebody remembered.
      */
      for (const line of [
        HOUSE_WARDROBE_LINE,
        basicsWardrobeLine("male"),
        basicsWardrobeLine(null),
        /* And a customer-named one, which is the case a decomposition could
           never have handled and this sentence handles for free. */
        "a one-shoulder animal hide, bare legs, bare feet",
      ]) {
        const constant = photorealHumanConstant(line);
        expect(constant, line).toContain(
          "The frame stays waist-up whatever this WARDROBE line describes below it.",
        );
        expect(constant, line).toContain("Never widen the frame, zoom out, or change the crop");
        /* The line itself is STILL stated in full beside it — the whole point
           is that both sentences are present and the frame wins. */
        expect(constant, line).toContain(line);
      }
    });

    it("CONTROL — a different line really produces a different constant", () => {
      expect(photorealHumanConstant("a plain white tee and dark jeans")).not.toBe(pathed);
      expect(pathed).not.toBe(photorealHumanConstant(null));
    });
  });
});
