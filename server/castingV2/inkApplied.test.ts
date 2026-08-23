/**
 * WHICH OF HER DESIGNS ARE ON HER — the record that makes a tattoo survive the
 * next edit (shape A, ruled fable-1167 §2).
 *
 * Every arm here is driven straight at the readers and the composer, never
 * through a model that usually behaves (working law 3). The two that matter
 * most are the ones the ruling made conditions:
 *
 *   §2a  the strict reader is BLIND to this field — armed in BOTH directions,
 *        because a fence proved only from the inside is a fence over a hole
 *   §2b  prune-correct is PROVEN, not inherited — the pruned chain and the
 *        un-pruned chain, side by side, differing in the one step
 */
import { describe, expect, it } from "vitest";

import {
  deltaCarriesAppliedInk,
  deltaCarriesAskedInk,
  deltaCarriesDeliveredInk,
  readAppliedInk,
  readAskedInk,
  readDeliveredInk,
  withAppliedInk,
  withAskedInk,
  withDeliveredInk,
} from "./inkApplied";
import { composeDeltas, readDelta, type RefineDelta } from "./refineDelta";
import { readStoredDelta } from "./refineLegacy";
import { composeChain, readChain } from "./refineRemoval";

/** A design's public name is a uuid, because `randomUUID` is what mints it. */
const DESIGN = "6c66a44f-ccbc-46eb-aa7b-1cf86be8f859";
const OTHER = "b0eeab5c-b570-4a69-8fa5-4589cced2e9f";

/** A delivered crop's public name — minted at claim, and uuid-shaped too. */
const CROP = "b9c1f4de-77a0-4a52-8f31-2d6e0c5ab914";
const OTHER_CROP = "7d2b0a11-3c48-4f9e-b6a5-01e2c3d4f5a6";

/** The step that put a design on her: her own words, and OUR two pointers. */
const inkStep = (design = DESIGN, crop = CROP): RefineDelta => ({
  free: { ink: ["the tattoo design in the attached picture on her upper chest"] },
  inkApplied: { "ink:upperChest": design },
  inkDelivered: { "ink:upperChest": crop },
});

/**
 * The step D-137's WORDS ROAD leaves behind — a real tattoo, and no design
 * anywhere, because the place and the picture both came out of her sentence.
 *
 * This is the shape that could not be recorded at all before migration 0050,
 * which is why a words-painted tattoo vanished on the next unrelated edit.
 */
const wordsInkStep = (crop = CROP): RefineDelta => ({
  free: { ink: ["a grey-black dinosaur skeleton on his neck"] },
  inkDelivered: { "ink:neck": crop },
});

describe("the strict reader is blind to the applied-design field", () => {
  /*
    THE FENCE, AND IT IS ARMED FROM BOTH SIDES.

    `readDelta` guards the boundary where a MODEL'S REPLY enters the record. A
    reply free to name a design id would be a model choosing which of a
    customer's eight designs gets painted onto her body — the decision
    `inkDesignForAsk` owns, taken by the one participant with no stake in
    getting it right.
  */
  it("REFUSES to produce the field from a model reply that carries it", () => {
    const planted = {
      free: { ink: ["a small swallow on her neck"] },
      inkApplied: { "ink:neck": DESIGN },
    };
    const read = readDelta(planted, { instruction: "a small swallow on her neck" });
    expect(read).not.toBeNull();
    /*
      Asserted with `deltaCarriesAppliedInk` rather than by reading the field:
      the question is whether the reply's attempt SURVIVED at all, and an
      instrument that answered "nothing usable here" for a malformed attempt
      would certify this fence over a hole (the false-pass guard, D-235).
    */
    expect(deltaCarriesAppliedInk(read)).toBe(false);
  });

  it("still reads everything else in that reply — the negative control", () => {
    /* Without this, an arm that made `readDelta` return null for every reply
       would pass the test above and take the whole product down with it. */
    const read = readDelta(
      { free: { ink: ["a small swallow on her neck"] }, inkApplied: { "ink:neck": DESIGN } },
      { instruction: "a small swallow on her neck" },
    );
    expect(read?.free?.ink).toEqual(["a small swallow on her neck"]);
  });

  it("carries it back out of OUR OWN record, unchanged", () => {
    /* The other boundary: history re-entering, where a key we wrote is a fact
       already paid for. Dropped here and the tattoo is lost on exactly the
       edit this field exists to survive. */
    const stored = readStoredDelta(inkStep());
    expect(stored?.inkApplied).toEqual({ "ink:upperChest": DESIGN });
    expect(deltaCarriesAppliedInk(stored)).toBe(true);
  });

  it("round-trips a delta that also carries an open kind", () => {
    /* Both fields are invisible to the strict reader and both are re-attached.
       An arm for one is not an arm for the other — they are re-attached by two
       different expressions. */
    const stored = readStoredDelta({
      ...inkStep(),
      open: { "cat-ears": { noun: "cat ears", words: "small grey cat ears" } },
    });
    expect(stored?.inkApplied).toEqual({ "ink:upperChest": DESIGN });
    expect(stored?.open?.["cat-ears"]?.noun).toBe("cat ears");
  });
});

describe("the strict reader is blind to the delivered-crop field", () => {
  /*
    THE SAME FENCE, ONE DEGREE SHARPER (migration 0050, condition fable-1197
    §2a). `inkApplied` names one of the customer's own designs; `inkDelivered`
    names A CROP OF HER BODY, cut from one of our delivered frames. A reply free
    to name one would be a model choosing which picture of her rides the next
    render.

    Armed in both directions, because a fence proved only from the inside is a
    fence over a hole.
  */
  it("REFUSES to produce the field from a model reply that carries it", () => {
    const planted = {
      free: { ink: ["a small swallow on her neck"] },
      inkDelivered: { "ink:neck": CROP },
    };
    const read = readDelta(planted, { instruction: "a small swallow on her neck" });
    expect(read).not.toBeNull();
    expect(deltaCarriesDeliveredInk(read)).toBe(false);
  });

  it("still reads everything else in that reply — the negative control", () => {
    const read = readDelta(
      { free: { ink: ["a small swallow on her neck"] }, inkDelivered: { "ink:neck": CROP } },
      { instruction: "a small swallow on her neck" },
    );
    expect(read?.free?.ink).toEqual(["a small swallow on her neck"]);
  });

  it("carries it back out of OUR OWN record, unchanged", () => {
    const stored = readStoredDelta(inkStep());
    expect(stored?.inkDelivered).toEqual({ "ink:upperChest": CROP });
    expect(deltaCarriesDeliveredInk(stored)).toBe(true);
  });

  it("carries a WORDS-ONLY step, whose only pointer is the crop", () => {
    /*
      THE WHOLE REPAIR, at the reader that used to drop it. The strict reader
      legitimately reads this step's `free.ink` and knows nothing of the crop;
      re-attaching it is what lets a tattoo with no design survive the next
      edit.
    */
    const stored = readStoredDelta(wordsInkStep());
    expect(stored?.inkDelivered).toEqual({ "ink:neck": CROP });
    expect(stored?.inkApplied).toBeUndefined();
  });

  it("carries a crop out of a step the strict reader reads as EMPTY", () => {
    /*
      D-182's discriminator, with a new member on its left. A row whose only
      content is a code-written field is not unreadable — it is a step the
      strict reader has nothing to say about — and refusing it would throw away
      the one pointer a words-only tattoo has.

      `inkDelivered` is the first field that can legitimately stand alone here:
      an open kind could already, and `inkApplied` never could, because an ink
      step on the picture road always carries its own words.
    */
    const stored = readStoredDelta({ inkDelivered: { "ink:neck": CROP } });
    expect(stored?.inkDelivered).toEqual({ "ink:neck": CROP });
  });

  it("still REFUSES a row whose other content it could not read", () => {
    /*
      The negative control for the line above, and the reason the discriminator
      exists at all: carrying the crop out of a genuinely unreadable row would
      be eleven instructions erased and one carried, with the money moving on an
      input the code had already decided it could not read.
    */
    expect(readStoredDelta({ inkDelivered: { "ink:neck": CROP }, eyeColour: 7 })).toBeNull();
  });

  it("SEES a malformed attempt that it refuses to read", () => {
    const malformed = { inkDelivered: { "ink:neck": "the one from before" } };
    expect(readDeliveredInk(malformed)).toBeNull();
    expect(deltaCarriesDeliveredInk(malformed)).toBe(true);
  });

  it("holds both pointers at once without either standing in for the other", () => {
    const stored = readStoredDelta(inkStep());
    expect(stored?.inkApplied).toEqual({ "ink:upperChest": DESIGN });
    expect(stored?.inkDelivered).toEqual({ "ink:upperChest": CROP });
    /* Different values on the same slot: an implementation that read one field
       and copied it into the other would pass every arm above. */
    expect(stored?.inkApplied?.["ink:upperChest"]).not.toBe(stored?.inkDelivered?.["ink:upperChest"]);
  });
});

describe("what the delivered-crop reader will and will not accept", () => {
  /* The same guards as its sibling, driven at THIS field: they share one
     implementation, and an arm that only drove the sibling would certify a
     shared body over a field nobody exercised. */
  it("takes an ink slot with a real crop name", () => {
    expect(readDeliveredInk({ inkDelivered: { "ink:upperArm@left": CROP } }))
      .toEqual({ "ink:upperArm@left": CROP });
  });

  it("drops a key that is not an ink slot", () => {
    expect(readDeliveredInk({ inkDelivered: { hair: CROP } })).toBeNull();
  });

  it("drops a value that is not the shape this product mints", () => {
    for (const id of ["the one from before", "", "b9c1f4de", 7, null, { publicId: CROP }]) {
      expect(readDeliveredInk({ inkDelivered: { "ink:neck": id } }), String(id)).toBeNull();
    }
  });

  it("answers null for an absent, empty or wrong-shaped field", () => {
    expect(readDeliveredInk({})).toBeNull();
    expect(readDeliveredInk({ inkDelivered: {} })).toBeNull();
    expect(readDeliveredInk({ inkDelivered: [CROP] })).toBeNull();
    expect(readDeliveredInk(null)).toBeNull();
  });

  it("does not answer its sibling's field, in either direction", () => {
    /* The two readers share a body since 0050, so the field name is the only
       thing telling them apart — and a shared body with a hard-coded name would
       pass every other arm in this file. */
    expect(readDeliveredInk({ inkApplied: { "ink:neck": DESIGN } })).toBeNull();
    expect(readAppliedInk({ inkDelivered: { "ink:neck": CROP } })).toBeNull();
    expect(deltaCarriesDeliveredInk({ inkApplied: {} })).toBe(false);
    expect(deltaCarriesAppliedInk({ inkDelivered: {} })).toBe(false);
  });
});

describe("the delivered crops compose exactly as the designs do", () => {
  /*
    Both pointer fields go through ONE loop since 0050 (`INK_POINTER_FIELDS`),
    so these arms are what stops that loop from being written for one field and
    silently wrong for the other. The property that matters is that the THREE
    halves of one fact — her words, which design, which picture — can never
    disagree about whether she still has a tattoo.
  */
  it("carries forward through an unrelated later edit", () => {
    const composed = composeDeltas([inkStep(), { eyeColour: "green" }]);
    expect(composed.inkDelivered).toEqual({ "ink:upperChest": CROP });
  });

  it("⚠ ACCUMULATES at a second placement — the arm this file had backwards", () => {
    /*
      THIS ARM USED TO ASSERT THE OPPOSITE AND IT WAS PINNING A DEFECT (§10
      item 3b, ruled fable-1494). It read *"is REPLACED, never accumulated,
      when she asks for a different tattoo"* and expected the neck crop alone,
      which is fable-1167 §2e's declared limit made mechanical — correct as a
      description of the code and wrong about what a customer wants.

      Driven at the frames with 50 dev credits on 2026-08-24: a Cast given a
      neck swallow and then an arm compass rose lost the neck crop inside the
      render that added the arm, and the second render then painted the neck
      tattoo AGAIN from her words — a different swallow, on the other side of
      his neck. A REPLACEMENT is a second ask at the SAME placement, which the
      arm below still pins.
    */
    const composed = composeDeltas([
      inkStep(),
      {
        free: { ink: ["the tattoo design in the attached picture on her upper chest",
          "a swallow on her neck"] },
        inkDelivered: { "ink:neck": OTHER_CROP },
      },
    ]);
    expect(composed.inkDelivered).toEqual({
      "ink:upperChest": CROP,
      "ink:neck": OTHER_CROP,
    });
  });

  it("still REPLACES at the same placement — a different tattoo where the old one was", () => {
    const composed = composeDeltas([
      inkStep(),
      {
        free: { ink: ["a swallow on her upper chest"] },
        inkDelivered: { "ink:upperChest": OTHER_CROP },
      },
    ]);
    expect(composed.inkDelivered).toEqual({ "ink:upperChest": OTHER_CROP });
  });

  it("goes when the ink facet is answered with nothing — a removal removes", () => {
    /* The expensive shape, at the new field: a crop that survived a removal
       would go on painting the tattoo back onto every later render, from a
       picture of her own body, with her words empty beside it. */
    const composed = composeDeltas([inkStep(), { free: { ink: [] } }]);
    expect(composed.inkDelivered).toBeUndefined();
    expect(composed.inkApplied).toBeUndefined();
    expect(composed.free?.ink).toEqual([]);
  });

  it("takes a WORDS-ONLY tattoo off just as completely", () => {
    /* The road with no design at all: the crop is the only pointer, so it is
       the only thing that could keep painting a removed tattoo. */
    const composed = composeDeltas([wordsInkStep(), { free: { ink: [] } }]);
    expect(composed.inkDelivered).toBeUndefined();
    expect(composed.free?.ink).toEqual([]);
  });

  it("survives a prune exactly as its sibling does", () => {
    const kept = readChain(
      ["colour her hair copper", "a dinosaur skeleton on his neck"],
      [{ hairColour: "copper" as const }, wordsInkStep()],
    );
    expect(composeChain(kept!).inkDelivered).toEqual({ "ink:neck": CROP });
    const pruned = readChain(["colour her hair copper"], [{ hairColour: "copper" as const }]);
    expect(composeChain(pruned!).inkDelivered).toBeUndefined();
    /* The negative control: the prune took the ink step and nothing else. */
    expect(composeChain(pruned!).hairColour).toBe("copper");
  });
});

describe("recording a delivered crop against its slot", () => {
  it("copies rather than mutating what the caller is holding", () => {
    const original: RefineDelta = { free: { ink: ["a swallow on her neck"] } };
    const recorded = withDeliveredInk(original, "ink:neck", CROP);
    expect(recorded.inkDelivered).toEqual({ "ink:neck": CROP });
    expect(original.inkDelivered).toBeUndefined();
  });

  it("leaves the design pointer alone", () => {
    const recorded = withDeliveredInk(inkStep(), "ink:neck", OTHER_CROP);
    expect(recorded.inkApplied).toEqual({ "ink:upperChest": DESIGN });
    expect(recorded.inkDelivered).toEqual({ "ink:upperChest": CROP, "ink:neck": OTHER_CROP });
  });
});

describe("what the applied-design reader will and will not accept", () => {
  it("takes an ink slot with a real design name", () => {
    expect(readAppliedInk({ inkApplied: { "ink:upperArm@left": DESIGN } }))
      .toEqual({ "ink:upperArm@left": DESIGN });
  });

  it("drops a key that is not an ink slot", () => {
    /* The recipe's carry loop refuses one (`inkCarryNotInkSlot`), and a refusal
       after the money has moved is worse than a drop before it. */
    expect(readAppliedInk({ inkApplied: { hair: DESIGN } })).toBeNull();
  });

  it("drops a value that is not the shape this product mints", () => {
    /* `readInkDesign` would answer nothing to it, so a lookup that cannot
       succeed is a render that cannot carry. */
    for (const id of ["the first one", "", "6c66a44f", 7, null, { publicId: DESIGN }]) {
      expect(readAppliedInk({ inkApplied: { "ink:neck": id } }), String(id)).toBeNull();
    }
  });

  it("keeps the good entry and drops the bad one beside it", () => {
    expect(readAppliedInk({ inkApplied: { "ink:neck": DESIGN, hair: OTHER } }))
      .toEqual({ "ink:neck": DESIGN });
  });

  it("answers null for an absent, empty or wrong-shaped field", () => {
    expect(readAppliedInk({})).toBeNull();
    expect(readAppliedInk({ inkApplied: {} })).toBeNull();
    expect(readAppliedInk({ inkApplied: [DESIGN] })).toBeNull();
    expect(readAppliedInk(null)).toBeNull();
  });

  it("SEES a malformed attempt that it refuses to read", () => {
    /*
      The two questions are different and must never share an answer: *is there
      anything usable here* is what the reader answers, and *did this reply try
      to name a design at all* is what the fence needs. A model that sent
      `{"ink:neck": "the first one"}` has done the forbidden thing.
    */
    const malformed = { inkApplied: { "ink:neck": "the first one" } };
    expect(readAppliedInk(malformed)).toBeNull();
    expect(deltaCarriesAppliedInk(malformed)).toBe(true);
  });
});

describe("the applied designs compose the way her other asks do", () => {
  it("carries forward through an unrelated later edit — the whole point", () => {
    const composed = composeDeltas([inkStep(), { eyeColour: "green" }]);
    expect(composed.inkApplied).toEqual({ "ink:upperChest": DESIGN });
    expect(composed.eyeColour).toBe("green");
  });

  it("never disagrees with the words about what she is wearing", () => {
    /*
      THE ONE RULE — and its declared limit is now the fix (§10 item 3b).

      This arm read the interpreter as filing *the newest ask alone*, so the
      pointers were expected to replace with the words. Measured at the wire,
      the interpreter restates the WHOLE current set for a plural subject
      (`refineDelta.ts:1373`, and the court's own second delta holds both
      sentences) — so the agreement this arm is about is between two items and
      two pointers, not between one and one.

      The failure it still catches is the one that matters: a pointer set that
      disagrees with the words about how many tattoos she has.
    */
    const composed = composeDeltas([
      inkStep(),
      {
        free: { ink: ["the tattoo design in the attached picture on her upper chest",
          "a swallow on her neck"] },
        inkApplied: { "ink:neck": OTHER },
      },
    ]);
    expect(composed.free?.ink).toHaveLength(2);
    expect(composed.inkApplied).toEqual({ "ink:upperChest": DESIGN, "ink:neck": OTHER });
  });

  it("lets a later step at the SAME slot replace the design", () => {
    const composed = composeDeltas([inkStep(), inkStep(OTHER)]);
    expect(composed.inkApplied).toEqual({ "ink:upperChest": OTHER });
  });

  it("goes when the ink facet is answered with nothing — a removal removes", () => {
    /*
      The pointer half of a fact whose word half lives at `free.ink`. A step
      that empties the ink subject is her having it taken off, and a pointer
      that survived it would go on sending the artwork on every render
      afterwards — a paid removal that does not remove, which is this product's
      most expensive shape.
    */
    const composed = composeDeltas([inkStep(), { free: { ink: [] } }]);
    expect(composed.inkApplied).toBeUndefined();
    /* And the two halves went together, which is the property the rule is
       written to hold: an emptied plural subject answers no facet, so a
       facet-keyed rule would have left the pointer standing beside empty
       words. */
    expect(composed.free?.ink).toEqual([]);
  });
});

describe("a pruned ink step takes its design with it", () => {
  /*
    fable-1167 §2b: prune-correct is PROVEN, not inherited.

    A prune deletes a step and recomposes what survives, so the two chains below
    differ in exactly one step and in nothing else. The design rides the chain
    that kept it and does not ride the chain that did not — and because every
    render anchors on the pristine master, which never had the tattoo, the
    master does the removing.
  */
  const steps = [
    { instruction: "colour her hair copper", delta: { hairColour: "copper" as const } },
    { instruction: "use this tattoo design on her upper chest", delta: inkStep() },
    { instruction: "give him green eyes", delta: { eyeColour: "green" as const } },
  ];

  const chainOf = (kept: typeof steps) => readChain(
    kept.map((step) => step.instruction),
    kept.map((step) => step.delta),
  );

  it("rides the chain that still holds the ink step", () => {
    const chain = chainOf(steps);
    expect(chain).not.toBeNull();
    expect(composeChain(chain!).inkApplied).toEqual({ "ink:upperChest": DESIGN });
  });

  it("does NOT ride the chain the ink step was pruned out of", () => {
    const pruned = chainOf([steps[0]!, steps[2]!]);
    expect(pruned).not.toBeNull();
    expect(composeChain(pruned!).inkApplied).toBeUndefined();
    /* And the words go with it — the two halves of one fact, never one
       without the other. */
    expect(composeChain(pruned!).free?.ink).toBeUndefined();
  });

  it("keeps every other step across the prune — the negative control", () => {
    /* An arm that lost the whole chain would pass the test above. */
    const pruned = composeChain(chainOf([steps[0]!, steps[2]!])!);
    expect(pruned.hairColour).toBe("copper");
    expect(pruned.eyeColour).toBe("green");
  });
});

describe("recording a design against its slot", () => {
  it("copies rather than mutating what the caller is holding", () => {
    /* The step delta and the composed delta are both already built and already
       read by a dozen consumers by the time the design is resolved. */
    const original: RefineDelta = { free: { ink: ["a swallow on her neck"] } };
    const recorded = withAppliedInk(original, "ink:neck", DESIGN);
    expect(recorded.inkApplied).toEqual({ "ink:neck": DESIGN });
    expect(original.inkApplied).toBeUndefined();
  });

  it("adds to what is already recorded rather than replacing it", () => {
    const recorded = withAppliedInk(withAppliedInk({}, "ink:neck", OTHER), "ink:upperChest", DESIGN);
    expect(recorded.inkApplied).toEqual({ "ink:neck": OTHER, "ink:upperChest": DESIGN });
  });
});

describe("which sentence painted which tattoo — `inkAsked` (§10 item 3b)", () => {
  /*
    THE THIRD HALF, and the reason it exists is a court rather than a
    principle: 50 dev credits on 2026-08-24 bought a Cast a neck swallow and
    then an arm compass rose, and the second render dropped the neck POINTER
    while keeping the neck WORDS — so the engine painted a second swallow, on
    the other side of his neck, from the sentence.

    Every arm below is driven at the reader and the composer directly, never
    through a model that usually behaves (working law 3).
  */
  const asked = (): RefineDelta => ({
    free: { ink: ["a swallow on her neck"] },
    inkAsked: { "ink:neck": "a swallow on her neck" },
    inkDelivered: { "ink:neck": CROP },
  });

  it("REFUSES to produce the field from a model reply that carries it", () => {
    /* Its two siblings' fence, one degree softer and the same in kind: a reply
       free to name the words of a slot it was not asked about is a model
       editing the record of a tattoo the customer never mentioned. */
    const read = readDelta(
      {
        free: { ink: ["a swallow on her neck"] },
        inkAsked: { "ink:upperChest": "a serpent on her chest" },
      },
      { instruction: "a swallow on her neck" },
    );
    expect(read).not.toBeNull();
    expect(deltaCarriesAskedInk(read)).toBe(false);
    /* The negative control — an arm that made `readDelta` return null for
       everything would pass the line above and take the product down. */
    expect(read?.free?.ink).toEqual(["a swallow on her neck"]);
  });

  it("carries it back out of OUR OWN record, unchanged", () => {
    const stored = readStoredDelta(asked());
    expect(stored?.inkAsked).toEqual({ "ink:neck": "a swallow on her neck" });
    expect(deltaCarriesAskedInk(stored)).toBe(true);
  });

  it("drops a key that is not an ink slot, and says the attempt was made", () => {
    /* Dropping is safe HERE and would not be safe at the painter: what is lost
       by a drop is one clause withheld; what would be lost by trusting a
       malformed key is a render that paints a tattoo twice. */
    const malformed = { inkAsked: { "hair": "copper", "ink:neck": "a swallow on her neck" } };
    expect(readAskedInk(malformed)).toEqual({ "ink:neck": "a swallow on her neck" });
    expect(deltaCarriesAskedInk(malformed)).toBe(true);
  });

  it("drops a blank sentence and an absurd one, and keeps the attempt visible", () => {
    const blank = { inkAsked: { "ink:neck": "   " } };
    expect(readAskedInk(blank)).toBeNull();
    expect(deltaCarriesAskedInk(blank)).toBe(true);
    const huge = { inkAsked: { "ink:neck": "a".repeat(401) } };
    expect(readAskedInk(huge)).toBeNull();
  });

  it("composes per slot: a second placement ACCUMULATES", () => {
    const composed = composeDeltas([
      asked(),
      {
        free: { ink: ["a swallow on her neck", "a compass rose on her left upper arm"] },
        inkAsked: { "ink:upperArm@left": "a compass rose on her left upper arm" },
        inkDelivered: { "ink:upperArm@left": OTHER_CROP },
      },
    ]);
    expect(composed.inkAsked).toEqual({
      "ink:neck": "a swallow on her neck",
      "ink:upperArm@left": "a compass rose on her left upper arm",
    });
    expect(composed.inkDelivered).toEqual({ "ink:neck": CROP, "ink:upperArm@left": OTHER_CROP });
  });

  it("composes per slot: the SAME placement overwrites", () => {
    const composed = composeDeltas([
      asked(),
      {
        free: { ink: ["a serpent on her neck"] },
        inkAsked: { "ink:neck": "a serpent on her neck" },
        inkDelivered: { "ink:neck": OTHER_CROP },
      },
    ]);
    expect(composed.inkAsked).toEqual({ "ink:neck": "a serpent on her neck" });
    expect(composed.inkDelivered).toEqual({ "ink:neck": OTHER_CROP });
  });

  it("goes with the others when she has them taken off", () => {
    /* The one wholesale case the keyed rule keeps: an emptied plural subject
       answers no facet, so a merge would leave every pointer standing while
       the words went empty — a paid removal that does not remove. */
    const composed = composeDeltas([asked(), { free: { ink: [] } }]);
    expect(composed.inkAsked).toBeUndefined();
    expect(composed.inkDelivered).toBeUndefined();
    expect(composed.free?.ink).toEqual([]);
  });

  it("⚠ a row written BEFORE this key existed composes exactly as it did", () => {
    /*
      The compatibility arm, and it is the whole live population on the day
      this landed: every branch in either world carries `free.ink` and no
      `inkAsked`. A merge keyed on a key that is not there adds nothing.
    */
    const composed = composeDeltas([
      { free: { ink: ["the tattoo design in the attached picture on her upper chest"] },
        inkApplied: { "ink:upperChest": DESIGN }, inkDelivered: { "ink:upperChest": CROP } },
      { eyeColour: "green" },
    ]);
    expect(composed.inkAsked).toBeUndefined();
    expect(composed.inkDelivered).toEqual({ "ink:upperChest": CROP });
    expect(composed.inkApplied).toEqual({ "ink:upperChest": DESIGN });
  });

  it("copies rather than mutating what the caller is holding", () => {
    const original: RefineDelta = { free: { ink: ["a swallow on her neck"] } };
    const recorded = withAskedInk(original, "ink:neck", "a swallow on her neck");
    expect(recorded.inkAsked).toEqual({ "ink:neck": "a swallow on her neck" });
    expect(original.inkAsked).toBeUndefined();
  });
});
