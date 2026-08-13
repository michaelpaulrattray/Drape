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

/**
 * THE DISPUTED LIST — what the ask wrote and this render's own reader denied
 * (fable-220 §3). This module's whole job in it is to name the slots and to
 * settle the collision; the mint decides what a marked slot may do.
 */
describe("the slots a render DISPUTES", () => {
  it("marks a disputed slot and no other", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["nose"],
      disputed: ["lips"],
      captions: { nose: "Straight bridge", lips: "Natural, slim, no pronounced cupid's bow" },
    });

    expect(slots.map((slot) => [slot.slot, slot.disputed ?? false])).toEqual([
      ["nose", false],
      ["lips", true],
    ]);
    /* The words are the read-back of the frame that landed — the honest sentence
       about what is actually there, which is what makes the crop worth opening. */
    expect(slots[1]!.words).toEqual(["Natural, slim, no pronounced cupid's bow"]);
  });

  it("EARNED WINS when two facets of one slot disagree", () => {
    /*
      One ask, one slot, two verdicts: the reader saw the colour land and not the
      cut. The slot is earned — the render did change it and the guard can certify
      the crop — and marking it disputed over a neighbouring facet would throw away
      a good reference. The order of the two lists is the whole of this rule, so it
      is driven from both directions.
    */
    const captions = { "hair.cut": "A blunt bob at the jaw", "hair.colour": "Copper" };
    const both = mintedSlotsForRender({ earned: ["hair.colour"], disputed: ["hair.cut"], captions });
    expect(both.slots.map((slot) => [slot.slot, slot.disputed ?? false])).toEqual([["hair", false]]);

    const reversed = mintedSlotsForRender({ earned: ["hair.cut"], disputed: ["hair.colour"], captions });
    expect(reversed.slots.map((slot) => [slot.slot, slot.disputed ?? false])).toEqual([["hair", false]]);
  });

  it("files a disputed accessory as both of its sides, both marked", () => {
    const { slots } = mintedSlotsForRender({
      earned: [],
      disputed: ["statedAccessories"],
      captions: { statedAccessories: "Small gold studs" },
      accessoryKind: "earring",
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["earring@left", "earring@right"]);
    expect(slots.every((slot) => slot.disputed)).toBe(true);
  });

  it("reports a disputed facet with nowhere to file exactly as an earned one", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: [],
      disputed: ["makeup", "lips"],
      captions: { makeup: "A soft nude lip" },
    });

    expect(slots).toEqual([]);
    expect(unfiled).toEqual([
      { facet: "makeup", reason: "notASlot" },
      { facet: "lips", reason: "noWords" },
    ]);
  });

  it("is exactly today's behaviour when nothing is disputed", () => {
    /* The flag-shaped property: an absent list changes nothing. */
    const captions = { lips: "Full", nose: "Straight bridge" };
    expect(mintedSlotsForRender({ earned: ["lips", "nose"], captions }))
      .toEqual(mintedSlotsForRender({ earned: ["lips", "nose"], disputed: [], captions }));
  });
});

/**
 * THE SLOT THAT IS FILED WHATEVER THIS RENDER EARNED.
 *
 * `build`'s crop is a photograph of her torso IN WHATEVER SHE IS WEARING, so a
 * crop kept across somebody else's clothing edit is a picture of last week's top
 * labelled "the exact build she has, unchanged" (fable-424 §4). The rule is data
 * on the catalogue and derived here; these cases are the door it comes through.
 */
describe("the slots re-cut every render", () => {
  it("files her build on a render that earned nothing of it", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: {
        "eye.colour": "Green",
        build: "Noticeably narrower shoulders and slimmer upper arms",
      },
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left", "eye@right", "build"]);
    expect(unfiled).toEqual([]);
    /* Her whole build stack, not the facet the render happened to touch. */
    expect(slots[2]!.words).toEqual(["Noticeably narrower shoulders and slimmer upper arms"]);
    expect(slots[2]!.disputed).toBeUndefined();
  });

  it("files NOTHING before anything has ever been said about her build", () => {
    /*
      And in silence, not as `unfiled`. This is not a facet that earned
      something and had nowhere to go — it is a feature nobody has asked about,
      and the pristine master every render anchors on already carries it. There
      is nothing to preserve and nothing to report.
    */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: { "eye.colour": "Green" },
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left", "eye@right"]);
    expect(unfiled).toEqual([]);
  });

  it("does not file her build TWICE on the render that earned it", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["shoulders"],
      captions: { build: "A more athletic build", shoulders: "Broader shoulders" },
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["build"]);
  });

  it("leaves a DISPUTED build disputed rather than re-filing it clean", () => {
    /*
      The re-mint pass runs last and `seen` is what makes that a rule rather than
      an ordering: a render whose own reader disputed the build has already filed
      it, marked, and a second clean entry would store an unverified delivery as
      what the next render knows her build is.
    */
    const { slots } = mintedSlotsForRender({
      earned: [],
      disputed: ["shoulders"],
      captions: { shoulders: "Broader shoulders" },
    });

    expect(slots.map((slot) => [slot.slot, slot.disputed ?? false])).toEqual([["build", true]]);
  });
});
