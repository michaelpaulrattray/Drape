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

import { deltaCarriesAppliedInk, readAppliedInk, withAppliedInk } from "./inkApplied";
import { composeDeltas, readDelta, type RefineDelta } from "./refineDelta";
import { readStoredDelta } from "./refineLegacy";
import { composeChain, readChain } from "./refineRemoval";

/** A design's public name is a uuid, because `randomUUID` is what mints it. */
const DESIGN = "6c66a44f-ccbc-46eb-aa7b-1cf86be8f859";
const OTHER = "b0eeab5c-b570-4a69-8fa5-4589cced2e9f";

/** The step that put a design on her: her own words, and OUR pointer. */
const inkStep = (design = DESIGN): RefineDelta => ({
  free: { ink: ["the tattoo design in the attached picture on her upper chest"] },
  inkApplied: { "ink:upperChest": design },
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
      THE ONE RULE, AND ITS DECLARED LIMIT (fable-1167 §2e).

      A second ink ask RESTATES the subject: the interpreter files the newest
      ask alone rather than the whole set, so `free.ink` holds one design and
      the pointers must hold exactly the same one. This arm exists to make that
      agreement mechanical — the failure it would catch is a pointer set that
      accumulated while the words replaced, which is a design riding a render
      that says nothing about it, at a placement nobody mentioned.

      The day a Cast wears two, `free.ink`'s restatement is the line to fix
      first and the composer's is the line to fix beside it.
    */
    const composed = composeDeltas([
      inkStep(),
      { free: { ink: ["a swallow on her neck"] }, inkApplied: { "ink:neck": OTHER } },
    ]);
    expect(composed.free?.ink).toEqual(["a swallow on her neck"]);
    expect(composed.inkApplied).toEqual({ "ink:neck": OTHER });
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
