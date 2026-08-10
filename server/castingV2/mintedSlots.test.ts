import { describe, expect, it } from "vitest";

import { mintedSlotsForRender } from "./mintedSlots";

/**
 * WHAT A LANDED RENDER TELLS THE LIBRARY.
 *
 * The subject is the step between "these facets earned something" and "these
 * slots are being filed", and every rule in it is one this campaign has already
 * got wrong somewhere else: a facet with no home falling silently to nothing, a
 * pair of slots cut from one union, two facets of one feature filed twice, and
 * an accessory whose slot has to come from the described OBJECT rather than
 * from the facet.
 */
describe("the slots a render files", () => {
  it("files one slot for a feature several facets landed in, with every caption in its stack", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["hair.cut", "hair.colour"],
      captions: {
        "hair.cut": "A blunt bob at the jaw",
        "hair.colour": "Copper, warm at the ends",
        "hair.texture": "Straight",
        lips: "Full, a soft nude",
      },
    });

    expect(unfiled).toEqual([]);
    expect(slots.map((slot) => slot.slot)).toEqual(["hair"]);
    /* Every hair facet's caption, catalogue order — including `hair.texture`,
       which this ask did not write. The stack is what her hair currently IS,
       not what this instruction changed, which is the difference between a
       declarative stack and an edit log. And `lips` is not in it. */
    expect(slots[0]!.words).toEqual([
      "A blunt bob at the jaw",
      "Copper, warm at the ends",
      "Straight",
    ]);
    expect(slots[0]!.tier).toBe("anatomy");
    expect(slots[0]!.noun).toBe("hair");
    expect(slots[0]!.question).toBe("hair");
    expect(slots[0]!.frame).toBe("wholeFrame");
  });

  it("takes a pinned caption's wording, not the object it is stored as", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["hairWorn"],
      captions: { hairWorn: { wording: "Worn down, centre-parted", pin: "down" } },
    });

    expect(slots[0]!.words).toEqual(["Worn down, centre-parted"]);
  });

  /*
    THE ACCESSORY GAP, WHICH IS THE EARRING DEMO.

    `statedAccessories` is one facet over every kind of thing a face can wear,
    so `FACET_SLOTS` answers with a FAMILY rather than a slot. The kind comes
    from the described object, through the same `accessoryKindOf` derivation the
    harvest and the segment cutter use — three consumers, one string, or they
    disagree about whether an ask was about ears or eyes.
  */
  it("files an earring as two slots, one per side, both saying the same thing", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["statedAccessories"],
      captions: { statedAccessories: "Dangly cross earrings in gold" },
      accessoryKind: "earring",
    });

    expect(unfiled).toEqual([]);
    expect(slots.map((slot) => slot.slot)).toEqual(["earring@left", "earring@right"]);
    expect(slots.map((slot) => slot.noun)).toEqual(["left earring", "right earring"]);
    /* Matched words are what makes the panel say "her earrings" as one row —
       divergence is derived from the words, never from the pixels. */
    expect(slots[0]!.words).toEqual(slots[1]!.words);
    /* And both are per-side, which is what stops the mint cutting them from a
       whole-frame union of both her ears. */
    expect(slots.map((slot) => slot.frame)).toEqual(["ownSide", "ownSide"]);
    expect(slots.map((slot) => slot.tier)).toEqual(["item", "item"]);
  });

  it("files a single-instance accessory as one slot", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["statedAccessories"],
      captions: { statedAccessories: "Thin gold wire-frame glasses" },
      accessoryKind: "glasses",
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["glasses"]);
    expect(slots[0]!.frame).toBe("wholeFrame");
  });

  it("says an accessory it cannot name is UNNAMED rather than not a slot", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["statedAccessories"],
      captions: { statedAccessories: "A jewelled forehead chain" },
      accessoryKind: null,
    });

    expect(slots).toEqual([]);
    /* The two are different problems and only one of them is owed work: a
       decided absence is finished, an object the placement table cannot name is
       a thing she is visibly wearing that the product cannot keep. */
    expect(unfiled).toEqual([{ facet: "statedAccessories", reason: "unnamedObject" }]);
  });

  it("says a facet that rides another slot is a DECIDED absence", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["makeup", "expression"],
      captions: { makeup: "A soft nude lip", expression: "Neutral" },
      /* An accessory kind is in scope and must not colour this verdict — the
         reason comes from the assignment, never from what the caller passed. */
      accessoryKind: "earring",
    });

    expect(slots).toEqual([]);
    expect(unfiled).toEqual([
      { facet: "makeup", reason: "notASlot" },
      { facet: "expression", reason: "notASlot" },
    ]);
  });

  it("files nothing for a slot whose read-back failed soft", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["lips"],
      captions: {},
    });

    /* A row with no words asserts only that a feature exists, which the
       catalogue already says for free. Honest, and cheap to say so. */
    expect(slots).toEqual([]);
    expect(unfiled).toEqual([{ facet: "lips", reason: "noWords" }]);
  });

  it("treats a blank caption as no caption", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["lips"],
      captions: { lips: "   " },
    });

    expect(slots).toEqual([]);
    expect(unfiled).toEqual([{ facet: "lips", reason: "noWords" }]);
  });

  it("never files one slot twice, however many of its facets earned", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["skinTone", "skinCharacter", "marks"],
      captions: {
        skinTone: "Fair with a warm cast",
        skinCharacter: "Fine pores, a little shine at the nose",
        marks: "Freckles across the nose and cheeks",
      },
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["skin"]);
    expect(slots[0]!.words).toHaveLength(3);
  });

  it("keeps slots in the order the render earned them", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["lips", "hair.colour", "nose"],
      captions: { lips: "Full", "hair.colour": "Copper", nose: "Straight bridge" },
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["lips", "hair", "nose"]);
  });

  it("files nothing at all for a render that earned nothing", () => {
    expect(mintedSlotsForRender({ earned: [], captions: { lips: "Full" } }))
      .toEqual({ slots: [], unfiled: [] });
  });
});
