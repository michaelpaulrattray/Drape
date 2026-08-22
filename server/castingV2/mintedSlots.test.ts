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

  /*
    RULING C IS KEPT HERE, and until this test existed it was kept nowhere.
    (fable-444: per-side is a property of the REFERENCE, not of the axis — the
    delta goes on saying "green eyes" and the LIBRARY is what remembers that
    only one of them is green.)

    The ask list narrowed to the clicked instance in the shipped slice; the mint
    did not. So a scoped render painted ONE eye and filed BOTH — `eye@right`
    getting a row that asserts a delivery its own recipe never asked for, read
    from its own crop so entirely plausible, and carried into every later
    recipe as a fact she paid for.
  */
  it("files ONE instance's row when the ask was scoped to one, and nothing on the other", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: { "eye.colour": "A clear green iris" },
      scope: "eye@left",
    });

    expect(unfiled).toEqual([]);
    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left"]);
    /* The absence is the whole point: nothing anywhere in what the mint is
       handed mentions the eye she did not point at. */
    expect(JSON.stringify(slots)).not.toContain("eye@right");
  });

  it("CONTROL — the same ask UNSCOPED still files both eyes", () => {
    /* The inert half, and the sabotage detector for the narrowing: make the
       filter a no-op and the test above goes red; make it swallow everything
       and this one does. */
    const { slots } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: { "eye.colour": "A clear green iris" },
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left", "eye@right"]);
  });

  /*
    AND THE SCOPE HAS TO HOLD IN THE OTHER LOOP TOO — the production instance,
    reproduced from its own dispatch record.

    The narrowing above was built for the EARNED pass and tested there. Ruling
    (b)'s pass — a slot still awaiting a carrier, minted on a later render whose
    reader confirms one of its facets — was written afterwards and reaches
    `slotsForFacet` directly. So a per-eye render narrows correctly, files
    `eye@left`, and then files `eye@right` from the loop below it.

    Every value here is off production v#199 on candidate 1625 (2026-08-16):

      askScope        eye@left           — recorded on the render itself
      the ask wrote   eye.shape          "her left eye vertical slit pupil like a cats"
      confirmed       eye.colour         carried, and the reader agreed — "Right eye
                                          glows fiery red-orange with dark pupil"
      awaiting        eye@right          its newest live row holds no pixels
                                          (refused `noSpecimen/eyes`)

    What it filed: `eye@left` v2 AND `eye@right` v3, carrying the SAME sentence
    — on a face whose right eye is fiery red. The assembler then tells her next
    render "Keep her right eye exactly: Pale grey iris with a vertical slit
    pupil", and the eye she paid for is repainted.
  */
  it("keeps the scope in the AWAITING-CARRIER pass, not only in the earned one", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["eye.shape"],
      confirmed: ["eye.colour"],
      awaitingCarrier: new Set(["eye@right"]),
      captions: {
        "eye.shape": "Pale grey iris with a vertical slit pupil",
        "eye.colour": "Right eye glows fiery red-orange; left eye is pale grey-blue",
      },
      scope: "eye@left",
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left"]);
    /* The absence is the whole point, and it is asserted over the serialized
       result rather than the keys: a row that names the eye she did not point
       at is wrong however it got there. */
    expect(JSON.stringify(slots)).not.toContain("eye@right");
  });

  it("CONTROL — the same confirmation UNSCOPED still reaches the awaiting slot", () => {
    /*
      The other half, and the sabotage detector: ruling (b) exists to mint a
      carrier a branch never got, and a narrowing that swallowed the unscoped
      case would silently switch the whole mechanism off. A render that scopes
      nothing must still file the awaiting slot.
    */
    const { slots } = mintedSlotsForRender({
      earned: [],
      confirmed: ["eye.colour"],
      awaitingCarrier: new Set(["eye@right"]),
      captions: { "eye.colour": "Right eye glows fiery red-orange" },
    });

    expect(slots.map((slot) => slot.slot)).toContain("eye@right");
  });

  it("names a facet the scope excluded as OUTSIDE SCOPE, never as an uncatalogued one", () => {
    /*
      It should be unreachable — `repaintAsksFor` refuses the render with
      `notASlot` before a pixel is painted — and it is reported rather than
      skipped because reaching it means the ask list and the mint disagree about
      which slots a scoped render is about. A finding wearing another reason's
      label is a finding nobody reads (the same argument `uncataloguedFeature`
      already makes in this file).
    */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["lips"],
      captions: { lips: "Full, a soft nude" },
      scope: "eye@left",
    });

    expect(slots).toEqual([]);
    expect(unfiled).toEqual([{ facet: "lips", reason: "outsideScope" }]);
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

  it("⚠ FILES THE ASK'S WORDS when the caption reader could not corroborate", () => {
    /*
      fable-1364/1365, the founder's horns — and the fixture varies the ONE
      property the class is about: whether a caption arrived.

      v211 delivered horns, the BINDING verifier read them on the delivered
      frame and confirmed, and `captionRealization` then returned null because
      its own reader described them differently ("pairs of curved bone-white
      horns" against "two clusters of three tapered points near each temple").
      Two honest readings of one thing, cancelled into deletion: no caption, no
      slot, no library row — and `recipeAssembler`'s standing loop iterates the
      library and nothing else, so v212's prompt never said the word "horns" and
      the frame came back bare.

      This is not D-183 relaxed. D-183 refuses to PIN a caption as already true
      when the edit did not take; a facet reaching this fallback is one the
      binding verifier confirmed.
    */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["horns"],
      captions: {},
      asked: { horns: "two smooth bone-white horns rising from the top of her head" },
    });

    expect(unfiled).toEqual([]);
    expect(slots.map((slot) => slot.slot)).toEqual(["horns@left", "horns@right"]);
    expect(slots[0]!.words).toEqual([
      "two smooth bone-white horns rising from the top of her head",
    ]);
  });

  it("CONTROL — a corroborated caption still wins over the ask", () => {
    /* Without this the arm above is satisfied by a mint that always files the
       request, which would quietly replace every read-back in the product with
       the words that produced it. */
    const { slots } = mintedSlotsForRender({
      earned: ["horns"],
      captions: { horns: "pairs of curved bone-white horns rising from top of head" },
      asked: { horns: "two smooth bone-white horns rising from the top of her head" },
    });

    expect(slots[0]!.words).toEqual([
      "pairs of curved bone-white horns rising from top of head",
    ]);
  });

  it("CONTROL — an ACCESSORY does not get the ask's words, and the reason is the glasses", () => {
    /*
      `statedAccessories` is ONE facet over every kind of thing a face can wear,
      so the value behind it is the whole worn list. Filing it into `earring@left`
      would write her glasses into an earring row — the identical defect the
      mint's frame-read refusal exists to prevent, arriving through the ask
      instead of through a reader. Same predicate, both layers.
    */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["statedAccessories"],
      captions: {},
      accessoryKind: "earring",
      asked: { statedAccessories: "dark tortoiseshell glasses, dangly cross earrings" },
    });

    expect(slots).toEqual([]);
    expect(unfiled).toEqual([
      { facet: "statedAccessories", reason: "noWords" },
      { facet: "statedAccessories", reason: "noWords" },
    ]);
  });

  it("CONTROL — the ask for a facet this render did NOT earn is not filed", () => {
    /*
      A slot holds several facets, and what a face was told about its hair
      COLOUR says nothing about a render that only wrote the CUT. Without the
      narrowing, one uncorroborated facet would drag every other facet's
      standing instruction into a row as though this render had delivered it.
    */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["lips"],
      captions: {},
      asked: { "hair.colour": "a deep copper" },
    });

    expect(slots).toEqual([]);
    expect(unfiled).toEqual([{ facet: "lips", reason: "noWords" }]);
  });

  it("CONTROL — a DISPUTED slot files no words-only row from the ask", () => {
    /*
      fable-220 §3, kept: a disputed slot is in the list for its PIXELS. Its own
      reader said the change is not in the delivered picture, so handing it the
      ask's words would file exactly the thing the reader denied — which is the
      one shape D-183 really forbids.
    */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: [],
      disputed: ["horns"],
      captions: {},
      asked: { horns: "two smooth bone-white horns rising from the top of her head" },
    });

    /* Byte for byte what this input produced before the fallback existed: the
       disputed pass is not offered the ask, so the slot has no words and falls
       to the same `noWords` refusal it always did. */
    expect(slots).toEqual([]);
    expect(unfiled).toEqual([
      { facet: "horns", reason: "noWords" },
      { facet: "horns", reason: "noWords" },
    ]);
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
      .toEqual({ slots: [], unfiled: [], unfiledOpen: [] });
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
 * on the catalogue and derived here.
 *
 * Two of these cases are the LIVE defect (dev #365, shift 77), where the whole
 * feature stood dark behind a gate nobody had driven: a body edit produces no
 * caption at all — the render verifier passed the narrowing, `buildSpan` read it
 * at −10.8%, and the caption reader said *"no visible slimming edit"* — so
 * "does this slot have words" could never open for `build`.
 */
describe("the slots re-cut every render", () => {
  it("files her build on the render that EARNS it, with no caption at all", () => {
    /* The gate that kept it dark. Both facets earned their delivery and neither
       produced a sentence; under the words rule the slot filed nothing, so the
       composer never ran and her build was never kept. */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["shoulders", "arms"],
      captions: {},
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["build"]);
    expect(slots[0]!.words).toEqual([]);
    /* And it is NOT reported unfiled: nothing went unhomed. */
    expect(unfiled).toEqual([]);
  });

  it("still refuses a wordless row for a slot whose CARRIER is its words", () => {
    /* The exception is `build`'s alone and it is measured. For anatomy generally
       D-244 makes the words the carrier of record, and a wordless row would be a
       version bump asserting a feature exists. */
    const { slots, unfiled } = mintedSlotsForRender({ earned: ["lips"], captions: {} });

    expect(slots).toEqual([]);
    expect(unfiled).toEqual([{ facet: "lips", reason: "noWords" }]);
  });

  it("re-files her build on a render that earned nothing of it", () => {
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: { "eye.colour": "Green" },
      held: new Set(["build", "hair"]),
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left", "eye@right", "build"]);
    expect(unfiled).toEqual([]);
    expect(slots[2]!.disputed).toBeUndefined();
  });

  /*
    AND THE RE-MINT PASS IS DELIBERATELY *NOT* SCOPED — pinned, because the
    sweep that scoped the other two passes had to decide about this one.

    A scope names the instance an ASK was about. `build` is re-cut every render
    because its crop is a photograph of her torso in whatever she is wearing, so
    a crop kept across somebody else's clothing edit is a picture of last week's
    top (fable-424 §4) — that has nothing to do with which eye she pointed at.
    Narrowing here would return no definitions for any scoped render and switch
    the whole re-mint off silently, which is the sabotage the control below
    would not have caught.
  */
  it("re-cuts her build even on a render scoped to one eye", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: { "eye.colour": "Green" },
      held: new Set(["build"]),
      scope: "eye@left",
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left", "build"]);
  });

  it("files NOTHING before the library keeps anything for her build", () => {
    /*
      In silence, not as `unfiled`. A face nobody has body-edited has nothing to
      preserve: the pristine master every render anchors on already carries her
      build. The discriminator is the LIBRARY rather than the words, because
      nothing is ever said about a build for the words to answer with.
    */
    const { slots, unfiled } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: { "eye.colour": "Green", build: "A more athletic build" },
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["eye@left", "eye@right"]);
    expect(unfiled).toEqual([]);
  });

  it("carries her whole build stack when there IS one", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["eye.colour"],
      captions: { "eye.colour": "Green", build: "Noticeably narrower shoulders" },
      held: new Set(["build"]),
    });

    expect(slots[2]!.words).toEqual(["Noticeably narrower shoulders"]);
  });

  it("does not file her build TWICE on the render that earned it", () => {
    const { slots } = mintedSlotsForRender({
      earned: ["shoulders"],
      captions: { build: "A more athletic build", shoulders: "Broader shoulders" },
      held: new Set(["build"]),
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
      held: new Set(["build"]),
    });

    expect(slots.map((slot) => [slot.slot, slot.disputed ?? false])).toEqual([["build", true]]);
  });

  /*
    THE CARRIER A SLOT NEVER GOT (fable-468 §2, ruling b) — the founder's
    candidate 1604, as a test.

    v#184 delivered a slim build and the caption reader called it absent, so the
    row was filed with no pixels. v#186, two renders later, read the same body
    and said *"slender arms and torso visible, consistent with a slim build"* —
    a confirmation of a delivery whose carrier had never been minted, and
    nothing looked.
  */
  it("mints the carrier a disputed slot never got, on the render that confirms it", () => {
    const { slots } = mintedSlotsForRender({
      /* This render asked about her expression; nobody asked about her build. */
      earned: ["expression"],
      captions: { build: "Slender frame with narrow shoulders and slim arms" },
      /* The library holds a build ROW and no build crop. */
      held: new Set(),
      awaitingCarrier: new Set(["build"]),
      confirmed: ["build"],
    });

    expect(slots.map((slot) => [slot.slot, slot.disputed ?? false])).toEqual([["build", false]]);
  });

  it("does NOT mint it on a render that confirms nothing about it", () => {
    /*
      The control, and the reason this is a confirmation rather than a retry: a
      later render that says nothing about her build has proven nothing about
      it, and filing there would store whatever the frame happens to show as the
      build she paid for.
    */
    const { slots } = mintedSlotsForRender({
      earned: ["expression"],
      captions: { build: "Slender frame with narrow shoulders and slim arms" },
      held: new Set(),
      awaitingCarrier: new Set(["build"]),
      confirmed: ["eye.colour"],
    });

    expect(slots).toEqual([]);
  });

  it("does NOT mint a slot the library already keeps pixels for", () => {
    /* `awaitingCarrier` is the whole gate: a slot with a crop is the re-mint
       pass's business, and this pass must not file a second row for it. */
    const { slots } = mintedSlotsForRender({
      earned: ["expression"],
      captions: { build: "Slender frame with narrow shoulders and slim arms" },
      held: new Set(["build"]),
      awaitingCarrier: new Set(),
      confirmed: ["build"],
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["build"]);
    /* Filed once, by the re-mint pass, exactly as it was before this existed. */
    expect(slots).toHaveLength(1);
  });

  it("does not file it TWICE when this render also earned the slot", () => {
    /* `seen` again: a render that earned the build has already filed it with
       its own verdict, and this pass may not add a second entry. */
    const { slots } = mintedSlotsForRender({
      earned: ["shoulders"],
      captions: { build: "A more athletic build", shoulders: "Broader shoulders" },
      held: new Set(),
      awaitingCarrier: new Set(["build"]),
      confirmed: ["build"],
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["build"]);
  });

  it("carries the NAMES of the disputed facets, so a court can be facet-narrow", () => {
    /*
      fable-429 §3 condition 3. `build` holds five facets and `buildSpan`
      measures three of them, so the mint's door has to know WHICH facet the
      reader disputed — not merely that something in this slot was. Derived here
      once and carried, rather than re-derived downstream where a second answer
      to "which facets does this slot hold" would be free to disagree with this
      one, and the disagreement would decide whether a ruler may speak.
    */
    const { slots } = mintedSlotsForRender({
      earned: [],
      disputed: ["shoulders", "waist"],
      captions: { shoulders: "Narrower shoulders", waist: "A trimmer waist" },
    });

    expect(slots).toHaveLength(1);
    expect(slots[0]!.disputedFacets).toEqual(["waist", "shoulders"]);
  });

  it("names only the facets THIS slot holds, never the render's whole dispute", () => {
    /* A dispute about her hair must not arrive on her build's row and hand a
       ruler a facet it was never shown. */
    const { slots } = mintedSlotsForRender({
      earned: [],
      disputed: ["shoulders", "hair.colour"],
      captions: { shoulders: "Narrower shoulders", "hair.colour": "Copper" },
    });

    const build = slots.find((slot) => slot.slot === "build")!;
    const hair = slots.find((slot) => slot.slot === "hair")!;
    expect(build.disputedFacets).toEqual(["shoulders"]);
    expect(hair.disputedFacets).toEqual(["hair.colour"]);
  });

  it("names no facets on a slot nobody disputed", () => {
    /* The negative control on the field: an earned slot carries no dispute at
       all, so there is nothing for a court to be handed. */
    const { slots } = mintedSlotsForRender({
      earned: ["shoulders"],
      captions: { shoulders: "Narrower shoulders" },
    });
    expect(slots[0]!.disputedFacets).toBeUndefined();
  });
});

/**
 * THE OPEN LANE'S SLOT — step 5b, the producer the mint's door has been waiting
 * for since step 3.
 *
 * Every rule here is a ruling rather than a preference, so each arm names the
 * one it drives: a SINGULAR open kind may carry pixels, a PAIRED one may not
 * (fable-872 §2 — a whole-frame read of a pair returns one instance), and an
 * UNANSWERED property refuses exactly like a pair while reporting a different
 * word, because only one of those two is a bug (fable-896 §3).
 */
describe("the open kinds a render files", () => {
  it("files an open:<kind> slot for a SINGULAR kind, carrying the customer's own words", () => {
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: [],
      captions: {},
      open: [{ kind: "tail", words: "a long scaled tail", locality: "single" }],
    });

    expect(unfiledOpen).toEqual([]);
    expect(slots.map((slot) => slot.slot)).toEqual(["open:tail"]);
    const spec = slots[0]!;
    /* The words are the ASK'S, because they are the only words an open kind ever
       has — no facet means no caption reader ever wrote a sentence about it. */
    expect(spec.words).toEqual(["a long scaled tail"]);
    expect(spec.noun).toBe("tail");
    /* The question IS the noun (§4), and `guardKind` is null with a REASON —
       which is what routes this slot to the absence-control door rather than to
       the measured completeness guard. */
    expect(spec.question).toBe("tail");
    expect(spec.guardKind).toBeNull();
    expect(spec.noSpecimen).toBeTruthy();
    expect(spec.tier).toBe("anatomy");
  });

  it("files a DISTRIBUTED kind ONE SLOT PER SIDE — the earring architecture", () => {
    /*
      THE RULING MOVED, AND THE RECORD SAYS SO. Until fable-987 §1 this arm
      asserted the opposite: a distributed kind filed NOTHING and carried words,
      because a whole-frame read of two things on opposite sides returns one
      instance (measured on the court's wings frame — the mask the mint would
      have carried was the image-left wing to thirteen pixels).

      The founder wired the counting instrument ("yes"), and the shape ruled in
      fable-1001 is the earring architecture: one row per side, each honestly a
      picture of what its name says. A union of the two was refused on this
      program's own banked laws — a rectangle spanning both wings pictures her
      torso, and the completeness guard scores 1.0 on it AND on a crop of one
      wing, which is a guard that cannot fail.

      Nothing here counts anything: this door says WHERE the pixels would be
      filed. The count is bought at the mint, on the frame, and refuses every
      reading but two.
    */
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: [],
      captions: {},
      open: [{ kind: "wings", words: "enormous feathered wings", locality: "distributed" }],
    });

    expect(unfiledOpen).toEqual([]);
    expect(slots.map((slot) => slot.slot)).toEqual(["open:wings@left", "open:wings@right"]);
    /* Both sides carry the customer's own words — an open kind has no facet, so
       no caption reader ever wrote a sentence about either of them. */
    expect(slots.map((slot) => slot.words)).toEqual([
      ["enormous feathered wings"], ["enormous feathered wings"],
    ]);
    /* `ownSide` is the whole point: asked of the WHOLE frame this question comes
       back as the union of both wings, and a crop of it would score 100% against
       the very mask it was cut from. */
    expect(slots.map((slot) => slot.frame)).toEqual(["ownSide", "ownSide"]);
    /* Still the open lane's own door — no completeness family exists for a kind
       nobody catalogued, and the recorded reason is what routes both sides to the
       absence control rather than to the measured guard. */
    expect(slots.map((slot) => slot.guardKind)).toEqual([null, null]);
    expect(slots.every((slot) => Boolean(slot.noSpecimen))).toBe(true);
    expect(slots.map((slot) => slot.question)).toEqual(["wings", "wings"]);
  });

  /*
    AND THE OTHER HALF OF THE FOUNDER'S RULING (fable-951) — the arm that would
    have been missing if the rename had been cosmetic.

    *"fangs are apart of teeth as a whole though right? no need for a left and
    right fang?"* Fangs are several and they sit together, so ONE CROP HOLDS THE
    SET and the failure the old gate existed to prevent — one instance minted
    under a plural name — cannot structurally arise. The completeness and ceiling
    instruments decide whether the crop holds the whole of it, which is what they
    are for.
  */
  it("MINTS a co-located kind, because one crop holds the whole set", () => {
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: [],
      captions: {},
      open: [{ kind: "fangs", words: "long pointed fangs", locality: "coLocated" }],
    });

    expect(unfiledOpen).toEqual([]);
    expect(slots.map((slot) => slot.slot)).toEqual(["open:fangs"]);
  });

  it("refuses an UNANSWERED property its crop under a DIFFERENT word", () => {
    /* The two-meanings-of-none split. `null` is nobody having answered — no row,
       no engine, a reader that declined — and it must refuse identically while
       being countable separately, because a kind stuck here is silently getting
       the conservative path forever. */
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: [],
      captions: {},
      open: [{ kind: "gills", words: "gills on her neck", locality: null }],
    });

    expect(slots).toEqual([]);
    expect(unfiledOpen).toEqual([{ kind: "gills", reason: "openKindLocalityUnread" }]);
  });

  it("judges STRUCTURE before POLICY, so the refusal count is over well-formed asks", () => {
    /* An ask with no words is a defect — `readOpenKinds` refuses empty words on
       the way in — and reported as "words-only because it is a pair" it would
       inflate the one number the promotion decision reads while hiding a bug
       behind a ruling. */
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: [],
      captions: {},
      open: [{ kind: "wings", words: "   ", locality: "distributed" }],
    });

    expect(slots).toEqual([]);
    expect(unfiledOpen).toEqual([{ kind: "wings", reason: "noWords" }]);
  });

  it("reports a key the catalogue cannot define rather than skipping it", () => {
    /* Should be unreachable — the normalizer mints only keys the catalogue can
       synthesize — so it is a disagreement between two grammars and must arrive
       as a named finding. `openKind` is the label kept for exactly this. */
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: [],
      captions: {},
      open: [{ kind: "cat ears", words: "pointed cat ears", locality: "single" }],
    });

    expect(slots).toEqual([]);
    expect(unfiledOpen).toEqual([{ kind: "cat ears", reason: "openKind" }]);
  });

  it("files one row for a kind named twice in one list", () => {
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: [],
      captions: {},
      open: [
        { kind: "tail", words: "a long scaled tail", locality: "single" },
        { kind: "tail", words: "a long scaled tail", locality: "single" },
      ],
    });
    expect(slots.map((slot) => slot.slot)).toEqual(["open:tail"]);
    expect(unfiledOpen).toEqual([]);
  });

  it("files an open kind BESIDE the facets the same render earned", () => {
    /* The two passes are independent: an open key carries a prefix the closed
       `feature@instance` grammar cannot produce, so it can never displace or be
       displaced by a catalogued slot. */
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: ["hair.colour"],
      captions: { "hair.colour": "Copper, warm at the ends" },
      open: [{ kind: "tail", words: "a long scaled tail", locality: "single" }],
    });

    expect(slots.map((slot) => slot.slot)).toEqual(["hair", "open:tail"]);
    expect(unfiledOpen).toEqual([]);
  });

  it("does not narrow an open kind to a scope", () => {
    /* Declared rather than omitted: a scope names one INSTANCE of a catalogued
       feature and an open kind has none, so there is nothing to select or
       exclude — and the render painted what the recipe said. */
    const { slots } = mintedSlotsForRender({
      earned: [],
      captions: {},
      scope: "eye@left",
      open: [{ kind: "tail", words: "a long scaled tail", locality: "single" }],
    });
    expect(slots.map((slot) => slot.slot)).toEqual(["open:tail"]);
  });

  it("files nothing at all when no open kind was asked for", () => {
    /* The negative control on the whole pass: the field being absent must be
       indistinguishable from the behaviour before this build existed. */
    const { slots, unfiledOpen } = mintedSlotsForRender({
      earned: ["hair.colour"],
      captions: { "hair.colour": "Copper" },
    });
    expect(slots.map((slot) => slot.slot)).toEqual(["hair"]);
    expect(unfiledOpen).toEqual([]);
  });
});
