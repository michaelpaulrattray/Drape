/**
 * THE PRIOR QUESTION, DRIVEN DIRECTLY (opus-940 §2, countersigned fable-1274
 * §2, three arms ruled fable-1287 §2).
 *
 * *"Is this ask about ink she already has, and does she want it changed or
 * gone."* Everything downstream of it is a routing decision worth 25 credits
 * and a wrong tattoo, so it is driven here as a function rather than only
 * through the service — working law 3: a guard whose only test runs through a
 * model that usually behaves is untested.
 *
 * The arms are grouped by the mistake each one exists to prevent, because that
 * is what makes a sweep readable a year later.
 */
import { describe, expect, it } from "vitest";

import { inkSlotSheAsksAbout, readInkPriorAsk } from "./inkPriorAsk";

describe("her sentence has to point at something that exists AND name a change", () => {
  it("reads the founder's own sentence — a bare pronoun and one axis", () => {
    /* *"like make it bigger or somthing now it has a bounding box?"* — no
       placement anywhere in it, which is why the slot comes from state. */
    expect(readInkPriorAsk("make it bigger")).toEqual({
      want: "change",
      changes: [{ axis: "size", direction: "bigger", factor: null }],
    });
  });

  it("reads a possessive and an ink noun with words in between", () => {
    expect(readInkPriorAsk("make his upper chest tattoo smaller")).toEqual({
      want: "change",
      changes: [{ axis: "size", direction: "smaller", factor: null }],
    });
  });

  it("⚠ LEAVES A FRESH ASK ALONE — the arm that shaped the reading", () => {
    /*
      *"Put the dragon tattoo on his neck"* points at *the … tattoo* with a
      definite article and is an ordinary new design. A pointer-only test would
      have refused it as *"there is nothing there to change"*, which is the
      transform road breaking the road it was built beside.

      What separates the two sentences is not how confident a reader is; it is
      whether she named a change at all.
    */
    expect(readInkPriorAsk("put the dragon tattoo on his neck")).toEqual({ want: "fresh" });
    expect(readInkPriorAsk("give him a small geometric skeleton tattoo on his neck"))
      .toEqual({ want: "fresh" });
  });

  it("⚠ AND THE INDEFINITE FORMS DISQUALIFY THE SENTENCE, change word and all", () => {
    /*
      These are the ones a pointer test alone gets wrong in the OTHER direction:
      every one of them names an ink noun and a change word, and every one of
      them is asking for a tattoo she does not have yet.
    */
    for (const said of [
      "give him a bigger tattoo on his chest",
      "add another tattoo, smaller this time",
      "give her a new design on her neck, darker",
    ]) {
      expect(readInkPriorAsk(said), said).toEqual({ want: "fresh" });
    }
  });

  it("a pointer with NO change named is not a transform", () => {
    expect(readInkPriorAsk("keep his chest tattoo")).toEqual({ want: "fresh" });
  });

  it("⚠ READS THE ANSWER TO THE PRODUCT'S OWN QUESTION — found at the service", () => {
    /*
      When she has two, the product asks *"You've got more than one — his upper
      chest tattoo and his neck tattoo. Say which one and I'll do it."* The
      natural reply is *"the upper chest one"*, and with ink nouns alone that
      sentence pointed at nothing: the reading fell back to FRESH and the answer
      to the question rendered a brand new tattoo.

      A question whose answer the product cannot read is D-180's dead end
      wearing a sentence. The surfaces come from `INK_PLACEMENTS` through the
      vocabulary's own noun, so a fourth measured surface becomes an answerable
      reply by existing.
    */
    expect(readInkPriorAsk("make the upper chest one bigger")).toEqual({
      want: "change",
      changes: [{ axis: "size", direction: "bigger", factor: null }],
    });
    expect(readInkPriorAsk("make his neck one darker")).toEqual({
      want: "change",
      changes: [{ axis: "intensity", direction: "darker" }],
    });
  });
});

describe("the change she named, on the closed vocabulary and nothing wider", () => {
  it("takes a factor SHE TYPED and never one it derived", () => {
    expect(readInkPriorAsk("make his tattoo twice the size")).toEqual({
      want: "change",
      changes: [{ axis: "size", direction: "bigger", factor: 2 }],
    });
    expect(readInkPriorAsk("make his tattoo half the size")).toEqual({
      want: "change",
      changes: [{ axis: "size", direction: "smaller", factor: 0.5 }],
    });
    /* A bare direction has NO factor, because a magnitude nobody typed is a
       magnitude nobody agreed to. */
    expect(readInkPriorAsk("make his tattoo bigger")).toEqual({
      want: "change",
      changes: [{ axis: "size", direction: "bigger", factor: null }],
    });
  });

  it("reads height and intensity, in both directions", () => {
    expect(readInkPriorAsk("move his tattoo a bit higher")).toEqual({
      want: "change",
      changes: [{ axis: "height", direction: "higher" }],
    });
    expect(readInkPriorAsk("make his tattoo darker")).toEqual({
      want: "change",
      changes: [{ axis: "intensity", direction: "darker" }],
    });
    expect(readInkPriorAsk("make his tattoo more faded")).toEqual({
      want: "change",
      changes: [{ axis: "intensity", direction: "lighter" }],
    });
  });

  it("⚠ NAMES BOTH AXES WHEN SHE NAMED BOTH — never silently the first", () => {
    /*
      The whole reason `changes` is a list. Every transform clause ends by
      saying that everything else about the tattoo stays exactly as the picture
      shows it, so two of them contradict each other on the wire — the same
      design, the same ink, and darker ink, in one prompt. Serving the first
      half silently would be a paid render answering half an ask.
    */
    const read = readInkPriorAsk("make his tattoo bigger and darker");
    expect(read.want).toBe("change");
    if (read.want !== "change") return;
    expect(read.changes).toHaveLength(2);
  });

  it("⚠ HAS NO SIDEWAYS AXIS, and that absence is a measurement", () => {
    /*
      The engine paints by POSITION rather than by anatomy, and the legacy ink
      road refunded 300 credits twice for a design on the wrong anatomical side.
      A horizontal move is that hazard with a paid render attached, so it reads
      as no change at all rather than as a fourth member nobody measured.
    */
    expect(readInkPriorAsk("move his tattoo to the left")).toEqual({ want: "fresh" });
  });
});

describe("she wants it gone", () => {
  it("reads a plain removal word beside a pointer", () => {
    expect(readInkPriorAsk("take his tattoos off")).toEqual({ want: "gone" });
    expect(readInkPriorAsk("remove the tattoo")).toEqual({ want: "gone" });
  });

  it("⚠ USES `removalWords`' OWN VOCABULARY — the negative control is `ambiguous`", () => {
    /*
      That band holds words like `clear` and `no`, which describe a look as
      often as an absence. A wrong reading here is a tattoo somebody paid for
      disappearing, so only `stated` counts — and the vocabulary is that
      module's rather than a second list here, so the two cannot drift.
    */
    expect(readInkPriorAsk("give him a tattoo with no colour in it").want).not.toBe("gone");
  });

  it("does not read a removal out of a sentence pointing at nothing", () => {
    expect(readInkPriorAsk("remove her glasses")).toEqual({ want: "fresh" });
  });
});

describe("which tattoo she means comes from STATE, and `slots[0]` is forbidden", () => {
  const NECK = "ink:neck";
  const CHEST = "ink:upperChest";

  it("answers NONE for a cast with no delivered tattoo", () => {
    expect(inkSlotSheAsksAbout("make it bigger", [])).toEqual({ kind: "none" });
  });

  it("answers the one she has, whether or not she named a place", () => {
    expect(inkSlotSheAsksAbout("make it bigger", [CHEST])).toEqual({ kind: "one", slot: CHEST });
  });

  it("⚠ ASKS WHICH on two, rather than picking one — the left-arm scar", () => {
    /*
      An ask that omitted a key member spanned two rows and `matches[0]` rode
      her LEFT ARM. A transform that silently picks one of two tattoos is that
      defect with a paid render attached, and every answer to the question ACTS
      (D-180): each names a tattoo that exists and can be changed.
    */
    expect(inkSlotSheAsksAbout("make it bigger", [CHEST, NECK])).toEqual({
      kind: "several",
      slots: [NECK, CHEST],
    });
  });

  it("but takes HER OWN WORD when she already answered it", () => {
    /*
      Extraction rather than inference: her word is matched against the
      SURFACE'S OWN NOUN, so it can only ever confirm a slot she named. A
      customer with two tattoos who says which one and is asked again is the
      product not listening — and, since her answer re-enters as an ordinary
      sentence, an ask-which that could not be narrowed would loop for ever.
    */
    expect(inkSlotSheAsksAbout("make the upper chest one bigger", [CHEST, NECK]))
      .toEqual({ kind: "one", slot: CHEST });
    expect(inkSlotSheAsksAbout("make the neck one bigger", [CHEST, NECK]))
      .toEqual({ kind: "one", slot: NECK });
  });

  it("⚠ AND A WORD MATCHING BOTH STILL ASKS — never the first of two", () => {
    /* The one shape a narrowing must not quietly resolve. */
    expect(inkSlotSheAsksAbout("make the neck and upper chest ones bigger", [CHEST, NECK]).kind)
      .toBe("several");
  });

  it("is stable across two identical asks", () => {
    /* A question whose options reorder between renders reads as a different
       question about a different face. */
    const first = inkSlotSheAsksAbout("make it bigger", [CHEST, NECK]);
    const second = inkSlotSheAsksAbout("make it bigger", [NECK, CHEST]);
    expect(first).toEqual(second);
  });
});
