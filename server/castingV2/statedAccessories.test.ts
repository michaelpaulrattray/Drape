import { describe, expect, it } from "vitest";

import { parseStatedAccessories } from "./castingIntent";

/**
 * The containment on a free-text field the sheet reads back.
 *
 * `statedAccessories` exists so the echo can say what the brief said, which
 * means user-supplied words travel from a model's reply to a rendered sentence.
 * That is exactly the path invariant 8 exists for, so the rule is D-89's closed
 * SOURCE: every token must appear in the user's own sentence. A closed
 * VOCABULARY could not work here — "chunky glasses" is in no enum and never
 * will be.
 */

const BRIEF = "a model in her 20s wearing chunky glasses and a nose stud";

describe("only the user's own words survive", () => {
  it("keeps a phrase the brief actually contains", () => {
    expect(parseStatedAccessories(["chunky glasses"], BRIEF)).toEqual(["chunky glasses"]);
  });

  /*
    THE ONE THAT MATTERS. A model that helpfully improves the phrasing is
    inventing a fact the user never stated, and the echo would then report it
    back to them as their own.
  */
  it("drops a phrase carrying a word the user never typed", () => {
    expect(parseStatedAccessories(["designer chunky glasses"], BRIEF)).toEqual([]);
    expect(parseStatedAccessories(["gold earrings"], BRIEF)).toEqual([]);
  });

  it("drops digits, which render as text artefacts", () => {
    expect(parseStatedAccessories(["2 nose stud"], "a man with 2 nose stud")).toEqual([]);
  });

  /*
    A garment word means the model answered about CLOTHES. Wardrobe is not an
    accessory: the sheet keeps the studio tee and says so in its own line, and
    listing a jacket here would have the echo report something the picture
    deliberately does not contain.
  */
  it("drops clothing, which the sheet does not render", () => {
    const brief = "a musician in a red leather jacket";
    expect(parseStatedAccessories(["a red leather jacket"], brief)).toEqual([]);
  });

  it("is empty for anything that is not a list", () => {
    for (const raw of [null, undefined, "chunky glasses", {}, 42]) {
      expect(parseStatedAccessories(raw, BRIEF)).toEqual([]);
    }
  });

  it("bounds what the sentence can be made to carry", () => {
    const brief = "a b c d e f";
    expect(parseStatedAccessories(["a", "b", "c", "d", "e"], brief).length).toBeLessThanOrEqual(3);
  });

  it("does not say the same thing twice", () => {
    expect(parseStatedAccessories(["chunky glasses", "Chunky Glasses"], BRIEF))
      .toEqual(["chunky glasses"]);
  });
});
