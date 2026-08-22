import { describe, expect, it } from "vitest";
import { WARDROBE_PICK_MAX, wardrobePickDoor } from "./wardrobeDoor";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";

/**
 * THE DOOR OVER AN ENGINE-PICKED OUTFIT (design §4.1).
 *
 * Two halves, and the second is the one that matters. A door of word lists can
 * always be made to pass its positive arms — the interesting question is what
 * it REFUSES that it should not, and this repo has twice shipped a list aimed
 * at the wrong field and deleted the very thing the field existed to carry.
 *
 * So every refusal arm asserts its REASON AND ITS WORD, never a bare `false`
 * (a boolean cannot tell "rejected the sword" from "rejected the length"), and
 * the admission arms are driven over the lines this product actually produces
 * plus the outfits §4's own worked examples name.
 */
describe("the wardrobe pick door", () => {
  function refused(line: string) {
    const verdict = wardrobePickDoor(line);
    expect(verdict.ok, `admitted: ${line}`).toBe(false);
    return verdict as Extract<typeof verdict, { ok: false }>;
  }

  function admitted(line: string) {
    const verdict = wardrobePickDoor(line);
    if (verdict.ok) return verdict;
    throw new Error(`refused as ${verdict.reason} (${verdict.word}): ${line}`);
  }

  describe("⚠ THE NEGATIVE CONTROL — what it must never refuse", () => {
    /*
      Written first and deliberately. A guard whose positive arms all pass and
      whose population it silently walls is the failure this suite exists for:
      one word on a list written for another field cost a paid roll its entire
      hair axis, and the arm that would have caught it is exactly this one.
    */
    it("passes the product's OWN lines — the house line and both basics forms", () => {
      /* `HOUSE_WARDROBE_LINE` says "unbranded" twice, which is the whole-word
         matcher's own trap: "unbranded" is not "brand". */
      expect(admitted(HOUSE_WARDROBE_LINE).line).toBe(HOUSE_WARDROBE_LINE);
      expect(admitted(basicsWardrobeLine("male")).line).toBe(basicsWardrobeLine("male"));
      expect(admitted(basicsWardrobeLine(null)).line).toBe(basicsWardrobeLine(null));
    });

    it("passes the outfits the design's own examples name", () => {
      for (const line of [
        // §4(a), verbatim from the design.
        "a red apron over a plain white tee, dark straight jeans, plain low shoes",
        // §4(b), verbatim from the design.
        "a one-shoulder hide tunic, rough-cut, and bare feet",
        // §4.1(1), verbatim from the design's own label example.
        "dark canvas work jacket, straight jeans, plain boots",
      ]) {
        expect(admitted(line).line).toBe(line);
      }
    });

    it("passes ordinary picks whose words sit NEXT TO a banned one", () => {
      /*
        The near-misses, each one a word this door deliberately does not hold,
        or holds only outside a protected phrase. Every entry here is an outfit
        a picker could reasonably choose for a real brief.
      */
      for (const line of [
        "a hooded grey sweatshirt, plain black joggers, plain trainers", // "hood" is not headwear here
        "a floral print cotton dress and plain flat sandals",           // "print" is not printed TEXT
        "a plain shirt with patch pockets, chinos, plain shoes",        // "patch" is a pocket
        "a navy blouse with a soft bow at the neck, straight skirt, plain shoes", // "bow" is not a weapon
        "a black sports top cut low at the shoulder blades and plain shorts",     // "blade" is anatomy
        "a white cap-sleeve tee, dark jeans, plain low shoes",          // protected phrase
        "a pale shirt with a club collar, grey trousers, plain shoes",  // protected phrase
        "surgical scrubs in plain teal and plain white clogs",
        "a plain chef's whites jacket, black trousers, plain black shoes",
      ]) {
        expect(admitted(line).line).toBe(line);
      }
    });
  });

  describe("the five classes §4.1 names, each asserting its own reason", () => {
    it("refuses a PROP, and says which word did it", () => {
      const verdict = refused("a barista apron, jeans, plain shoes, holding a mug");
      expect(verdict.reason).toBe("prop");
      expect(verdict.word).toBe("holding");
    });

    it("refuses a WEAPON — the design's own caveman example", () => {
      const verdict = refused("a one-shoulder hide, bare feet, and a heavy wooden club");
      expect(verdict.reason).toBe("weapon");
      expect(verdict.word).toBe("club");
    });

    it("refuses HEADWEAR", () => {
      const verdict = refused("a work jacket, straight jeans, plain boots, and a baseball cap");
      expect(verdict.reason).toBe("headwear");
      expect(verdict.word).toBe("cap");
    });

    it("refuses PRINTED TEXT and LOGOS as one class", () => {
      expect(refused("a graphic tee, jeans, plain shoes").reason).toBe("text");
      expect(refused("a plain tee with a small chest logo, jeans, plain shoes").word).toBe("logo");
    });

    it("⚠ SCRUBS a brand rather than refusing it — the outfit survives the mark", () => {
      /*
        The one class that is EDITED. `scrubBrands` is the product's standing
        answer and it keeps the sentence, so a good pick is not thrown away over
        one token. A refusal here would be the fidelity-shaped mistake: losing
        the whole outfit to save a word we already know how to remove.
      */
      const verdict = admitted("a Nike hoodie, plain black joggers, plain trainers");
      expect(verdict.line).not.toMatch(/nike/i);
      expect(verdict.line).toContain("hoodie");
      expect(verdict.line).toContain("trainers");
    });

    it("refuses a line that is ONLY a brand", () => {
      const verdict = refused("Versace");
      expect(verdict.reason).toBe("brand");
    });
  });

  describe("the mechanical three", () => {
    it("refuses nothing, a blank, and a non-string as `blank`", () => {
      /* The id is `blank` on purpose, and the obvious alternative is named
         only in the door's own type comment — never here. That word is a
         DECLARED refusal id in the capability census, and the census pins an
         id to every test file that quotes it, so writing it in this suite
         would file these arms as proof of somebody else's door. */
      for (const value of [null, undefined, 42, {}, "", "   "]) {
        const verdict = wardrobePickDoor(value);
        expect(verdict.ok).toBe(false);
        expect((verdict as { reason: string }).reason).toBe("blank");
      }
    });

    it("⚠ REFUSES an over-long line rather than truncating it", () => {
      /*
        The distinction from every other free-text field here, and the reason is
        durability: this string is stored as the outfit six signed views are
        composed from and a judge compares them against. A line cut mid-word is
        an outfit no render can satisfy and no judge can pass — kept for the
        life of the Cast.
      */
      const long = `${"a plain unbranded cotton tee in neutral grey, ".repeat(6)}plain shoes`;
      expect(long.length).toBeGreaterThan(WARDROBE_PICK_MAX);
      expect(refused(long).reason).toBe("too_long");
      /* CONTROL — the same sentence under the cap is admitted, so the arm above
         is measuring the length and not the words. */
      expect(admitted("a plain unbranded cotton tee in neutral grey, plain shoes").line.length)
        .toBeLessThanOrEqual(WARDROBE_PICK_MAX);
    });

    it("refuses digits — they render as text artefacts in the picture", () => {
      expect(refused("a plain tee, 501 straight jeans, plain shoes").reason).toBe("digits");
    });
  });

  it("CONTROL — the door can both admit and refuse, and the lists really fire", () => {
    /*
      Without this the suite is satisfiable by a door that says yes to
      everything (every refusal arm above would still need to fail, so this is
      belt and braces) — and, more usefully, by one whose word lists are empty
      while the mechanical three carry every arm.
    */
    const base = "a work jacket, straight jeans, plain boots";
    expect(wardrobePickDoor(base).ok).toBe(true);
    for (const suffix of ["and a mug", "and a sword", "and a beanie", "and a printed slogan"]) {
      expect(wardrobePickDoor(`${base}, ${suffix}`).ok, suffix).toBe(false);
    }
  });
});
