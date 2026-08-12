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

    EVERY PHRASE HERE MUST FAIL FOR CONTAINMENT AND FOR NOTHING ELSE. The
    second assertion used to read `["gold earrings"]` against this same brief,
    which contains neither word — so it passed for the reason it names AND
    because the guard banned the word "earrings", and it could not tell the two
    apart. It sat there reading as containment coverage while holding the
    earring defect in place (opus-280 §5, fable-337 condition 2). An assertion
    true for two sufficient causes proves neither; the fix is to starve the
    second one, so these differ from the brief ONLY in a word the user did not
    type.
  */
  it("drops a phrase carrying a word the user never typed", () => {
    expect(parseStatedAccessories(["designer chunky glasses"], BRIEF)).toEqual([]);
    expect(parseStatedAccessories(["a silver nose stud"], BRIEF)).toEqual([]);
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

/**
 * THE CARVE-OUT, AND THE BOUNDARY IT SITS ON.
 *
 * The framing law puts eight people in the same studio tee, and `statedWardrobe`
 * says so out loud when a brief names clothes. Accessories are the ONE carve-out
 * that law grants — glasses, a stud, a chain, a ring are facts about the person
 * and do reach the picture — so this field has to carry them.
 *
 * It did not. The guard here was `mentionsGarments`, whose word list exists to
 * keep composed DIRECTIONS off the subject of clothing and which therefore bans
 * "earring", "necklace", "jewellery" and "makeup" deliberately. A brief stating
 * *"small gold hoop earrings"* produced an empty list from a model that had
 * extracted the phrase perfectly, and the departure gate then told the founder
 * her brief had never asked for earrings while she wore them in the photograph.
 *
 * Every row below is driven from the measured table in opus-280 §3, and every
 * brief CONTAINS its phrase verbatim — so containment cannot be the reason for
 * any drop here, and the only thing under test is where the clothing boundary
 * falls. The clothing rows are the negative control: whatever guards this
 * field, it must keep declining them, or the echo would report an outfit the
 * picture deliberately does not contain.
 */
describe("the accessory carve-out the framing law grants", () => {
  const kinds: [phrase: string, brief: string][] = [
    ["chunky glasses", "a model in her 20s wearing chunky glasses"],
    ["a nose stud", "a man with a nose stud"],
    ["a wedding ring", "a woman with a wedding ring"],
    ["a red lip", "a woman with a red lip"],
    ["a silk headscarf", "a woman in a silk headscarf"],
  ];

  it.each(kinds)("keeps %s, which it always did", (phrase, brief) => {
    expect(parseStatedAccessories([phrase], brief)).toEqual([phrase]);
  });

  /*
    The four that the old line deleted. Each of these fails against
    `mentionsGarments` and passes against the clothing list, which is what makes
    them the red-then-green half of this suite rather than decoration.
  */
  const jewellery: [phrase: string, brief: string][] = [
    [
      "small gold hoop earrings",
      "A woman in her forties who wears small gold hoop earrings, one at each ear, "
        + "warm and unfussy, for an independent bookshop's about page.",
    ],
    ["a gold chain necklace", "a woman wearing a gold chain necklace"],
    ["gold jewellery", "a woman wearing gold jewellery"],
    // The field's own description says "Makeup counts" in that word.
    ["heavy makeup", "a woman wearing a bold red lip and heavy makeup"],
  ];

  it.each(jewellery)("now keeps %s, which the old guard deleted", (phrase, brief) => {
    expect(parseStatedAccessories([phrase], brief)).toEqual([phrase]);
  });

  /*
    THE NEGATIVE CONTROL. A suite that only proves things are kept cannot tell a
    working carve-out from a guard that was simply removed.
  */
  const clothing: [phrase: string, brief: string][] = [
    ["a red leather jacket", "a musician in a red leather jacket"],
    ["a grey wool coat", "a woman in a grey wool coat"],
    ["black jeans", "a woman in black jeans"],
  ];

  it.each(clothing)("still declines %s, which the sheet does not render", (phrase, brief) => {
    expect(parseStatedAccessories([phrase], brief)).toEqual([]);
  });

  /*
    And the exhibit, kept whole: ONE reply, two phrases, and the old guard ate
    exactly the half carrying a word from a list written for another field.
  */
  it("keeps both halves of the reply that first showed the split", () => {
    const brief = "a woman in her 40s wearing a bold red lip and heavy makeup";
    expect(parseStatedAccessories(["a bold red lip", "heavy makeup"], brief))
      .toEqual(["a bold red lip", "heavy makeup"]);
  });
});
