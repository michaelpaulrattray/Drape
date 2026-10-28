/**
 * THE DROPPED-CLAUSE DETECTOR AND ITS SENTENCE (#2695).
 *
 * "Make her hair copper red in a studio" files `{hairColour: "copper"}` and the
 * studio reaches nobody: the stage wall runs over the PARSED value, so a clause
 * the model elided was never parsed and `wall_stage`'s honest sentence is
 * unreachable for a mixed ask. The detector reads the two halves the product
 * already holds — the sentence, and the delta filed from it — and names a stage
 * word present in the first and absent from the second.
 *
 * The first describe drives the card's own measured table, row by row, so the
 * suite is anchored to the defect as driven through the real entrance rather
 * than to cases invented for the fix.
 */
import { describe, expect, it } from "vitest";
import { sceneryLeftOut, stageWordIn, stageWordsIn, type RefineDelta } from "./refineDelta";
import { sceneryLeftOutNote } from "./cannotSayCopy";

describe("sceneryLeftOut — the card's own driven table, row by row", () => {
  const rows: Array<{ asked: string; filed: RefineDelta; dropped: string }> = [
    {
      asked: "make her hair copper red in a studio",
      filed: { hairColour: "copper" as RefineDelta["hairColour"] },
      dropped: "studio",
    },
    {
      asked: "make her eyes green against a white backdrop",
      filed: { eyeColour: "green" as RefineDelta["eyeColour"] },
      dropped: "backdrop",
    },
    {
      asked: "give him a full beard on a film set",
      filed: { free: { facialHair: "full beard" } } as RefineDelta,
      dropped: "set",
    },
    {
      asked: "give her freckles sitting on a wooden chair",
      filed: { free: { marks: ["freckles"] } } as RefineDelta,
      dropped: "chair",
    },
    {
      asked: "give her gold hoop earrings at a dinner table",
      filed: { free: { statedAccessories: ["gold hoop earrings"] } } as RefineDelta,
      dropped: "table",
    },
    {
      asked: "give her a deep tan on location in the snow",
      filed: { free: { skinTone: "deep tan" } } as RefineDelta,
      dropped: "location",
    },
    {
      asked: "make him smile holding a coffee cup",
      filed: { free: { expression: "smiling" } } as RefineDelta,
      dropped: "holding",
    },
  ];

  for (const row of rows) {
    it(`names "${row.dropped}" dropped from "${row.asked}"`, () => {
      expect(sceneryLeftOut(row.asked, row.filed)).toEqual({
        word: row.dropped,
        kind: "scenery",
      });
    });
  }

  it("the outfit road's sharpest row: the coat filed, the background named", () => {
    /* "give her a white coat and make the background black" — served account,
       garment licensed, wardrobe filed. The coat is both licensed at the
       lexicon AND present in the filed text; the background is neither. */
    const found = sceneryLeftOut(
      "give her a white coat and make the background black",
      { free: { wardrobe: "a white coat" } } as RefineDelta,
      { garmentLicensed: true },
    );
    expect(found).toEqual({ word: "background", kind: "scenery" });
  });

  it("an UNSERVED account's dropped coat is named as a garment", () => {
    const found = sceneryLeftOut(
      "give her freckles and a red coat",
      { free: { marks: ["freckles"] } } as RefineDelta,
    );
    expect(found).toEqual({ word: "coat", kind: "garment" });
  });
});

describe("sceneryLeftOut — what must NOT fire", () => {
  it("a sentence naming no stage word", () => {
    expect(sceneryLeftOut("make her eyes green", { eyeColour: "green" } as RefineDelta)).toBeNull();
  });

  it("a word the delta actually FILED was served, not dropped", () => {
    /* "studio" survives into a makeup value — the clause was used, so a note
       claiming it was not would be a false apology on a render that did it. */
    expect(sceneryLeftOut(
      "give her studio glam makeup",
      { makeup: "studio glam makeup" } as RefineDelta,
    )).toBeNull();
  });

  it("the accessory carve-out travels: 'wearing' alone never fires (D-160)", () => {
    expect(sceneryLeftOut(
      "wearing small gold hoops",
      { free: { statedAccessories: ["small gold hoops"] } } as RefineDelta,
    )).toBeNull();
  });

  it("a licensed garment word never fires for a served account", () => {
    expect(sceneryLeftOut(
      "put her in a red coat",
      { free: { wardrobe: "a red coat" } } as RefineDelta,
      { garmentLicensed: true },
    )).toBeNull();
  });

  it("no delta, no claim — a refusal or a removal owes no note here", () => {
    expect(sceneryLeftOut("make her hair copper red in a studio", null)).toBeNull();
  });

  it("its absence is not evidence of absence: the lexicon has no beach", () => {
    /* The stated floor, pinned so a later widening is a deliberate act: the
       detector inherits exactly the wall's blindness and no more. */
    expect(sceneryLeftOut(
      "give her a tan on a beach",
      { free: { skinTone: "a tan" } } as RefineDelta,
    )).toBeNull();
  });

  it("word-boundary, not substring: 'sunset' does not contain the stage word 'set'", () => {
    expect(sceneryLeftOut(
      "give her hair the colour of a sunset",
      { free: { hairColour: "the colour of a sunset" } } as RefineDelta,
    )).toBeNull();
  });
});

describe("stageWordsIn — the plural the detector needs, delegated to, never copied", () => {
  it("stageWordIn is its first answer, so the two readers cannot drift", () => {
    const text = "a white coat against a black backdrop in a studio";
    expect(stageWordIn(text)).toBe(stageWordsIn(text)[0]);
    expect(stageWordsIn(text)).toEqual(["backdrop", "studio", "coat"]);
  });

  it("carries both carve-outs exactly as the singular always has", () => {
    expect(stageWordsIn("wearing a coat", { garmentLicensed: true })).toEqual([]);
    expect(stageWordsIn("wearing a coat")).toEqual(["coat"]);
  });

  it("can see past a served first match to a dropped second one", () => {
    /* The reason the plural exists: first-match reading would call this
       sentence fully served once the coat was filed. */
    const found = sceneryLeftOut(
      "a trench coat with a studio behind her",
      { free: { wardrobe: "a trench coat" } } as RefineDelta,
      { garmentLicensed: true },
    );
    expect(found).toEqual({ word: "studio", kind: "scenery" });
  });
});

describe("sceneryLeftOutNote — the sentence beside the picture", () => {
  it("quotes their word and the product's own rule, scenery branch", () => {
    expect(sceneryLeftOutNote({ word: "studio", kind: "scenery" })).toBe(
      "The studio part of your ask wasn't changed — refining changes the person, "
      + "not the shoot.",
    );
  });

  it("says what the stage wall says for an unserved garment: after Sign", () => {
    expect(sceneryLeftOutNote({ word: "coat", kind: "garment" })).toBe(
      "The coat part of your ask wasn't changed — clothing comes after Sign.",
    );
  });

  it("'holding' is named as a prop, because 'the holding part' is not a sentence", () => {
    expect(sceneryLeftOutNote({ word: "holding", kind: "scenery" })).toContain("The prop part");
  });

  it("never claims nothing was charged — money moved on a delivered take", () => {
    for (const found of [
      { word: "studio", kind: "scenery" as const },
      { word: "coat", kind: "garment" as const },
    ]) {
      expect(sceneryLeftOutNote(found).toLowerCase()).not.toContain("charged");
    }
  });
});
