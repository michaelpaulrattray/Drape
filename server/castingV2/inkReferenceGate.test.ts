import { describe, expect, it } from "vitest";

import { readDelta, type FreeLaneCheck } from "./refineDelta";

/**
 * THE INK DOCUMENT GATE'S SECOND ANSWER, DRIVEN AT THE GATE ITSELF.
 *
 * D-137: only pixels render a design, and the one case where words suffice is
 * ink the anchor itself documents — face and neck. A sleeve walls, because a
 * sentence produces a different tattoo in every frame.
 *
 * fable-1078 gives the gate its other document: *"no any tattoo request from a
 * reference image must be respected regardless if u can see it or not."* A
 * photograph she attached and POINTED AT is a document.
 *
 * # Why this file drives `readDelta` rather than a helper
 *
 * The gate is four lines inside a loop over the free lane, and the last time it
 * was wrong the unit tests could not see it: *"a small star behind her ear"*
 * carried no word "tattoo", came back as a MARK, and marks had no placement law
 * — so it rendered. That bypass was found by driving the real reader with a real
 * reply (D-158), not by asking the question with the subject already chosen.
 * So every arm here hands `readDelta` a reply shaped the way the interpreter
 * shapes one, and reads the wall off `check`.
 *
 * # THE ARMS COME IN PAIRS ON PURPOSE
 *
 * Each condition is proven to WALL without it and FILE with it, because a gate
 * arm asserted only in its passing direction is a gate nobody has watched refuse
 * (working law 2, and the reason the negative control keeps earning its place).
 */

function check(extra: Partial<FreeLaneCheck> = {}): FreeLaneCheck {
  return {
    instruction: "give her a snake tattoo on her left sleeve like this one",
    ...extra,
  };
}

/** The shape the interpreter returns for a free-lane ink ask. */
function inkReply(value = "a snake tattoo on her left sleeve") {
  return { ok: true, intent: "edit", free: { ink: value } };
}

/** The same ask filed as a MARK — the D-158 bypass, in its own words. */
function markReply(value = "a small star on her left sleeve") {
  return { ok: true, intent: "edit", free: { marks: value } };
}

describe("without a picture, the gate is exactly what it was", () => {
  it("walls a sleeve asked in words alone", () => {
    const seen = check();
    readDelta(inkReply(), seen);
    expect(seen.wall).toEqual({ reason: "gate_ink_document" });
  });

  it("still lets the anchor's own surfaces through — face and neck", () => {
    const seen = check({ instruction: "give her a small snake tattoo on her neck" });
    const delta = readDelta(inkReply("a small snake tattoo on her neck"), seen);
    expect(seen.wall).toBeUndefined();
    expect(delta).not.toBeNull();
  });

  it("walls the MARK spelling too — the star that once got through", () => {
    /* D-158's bypass: a design is a design wherever it is filed. Pinned here so
       the reference arm cannot rescue `ink` and leave `marks` walling, which
       would kill his never-refused ruling at a subject boundary. */
    const seen = check({ instruction: "give her a small star on her left sleeve" });
    readDelta(markReply(), seen);
    expect(seen.wall).toEqual({ reason: "gate_ink_document" });
  });
});

describe("a picture she pointed at IS the document", () => {
  it("files the sleeve that walled one arm ago", () => {
    const seen = check({ inkDocumentedByReference: true });
    const delta = readDelta(inkReply(), seen);
    expect(seen.wall).toBeUndefined();
    expect(delta).not.toBeNull();
  });

  it("files the MARK spelling as well, so the ruling does not die at a subject", () => {
    const seen = check({
      instruction: "give her a small star on her left sleeve",
      inkDocumentedByReference: true,
    });
    const delta = readDelta(markReply(), seen);
    expect(seen.wall).toBeUndefined();
    expect(delta).not.toBeNull();
  });

  it("opens ONLY this gate — every other wall still stands", () => {
    /*
      THE ARM THAT KEEPS THIS HONEST. A document for a tattoo is not a licence,
      and the cheapest way for this change to go wrong is to be read as one. The
      likeness wall is the one that matters most and it is asserted through the
      same open gate: a picture documenting a DESIGN never documents a PERSON.
    */
    const seen = check({
      instruction: "make her look like Scarlett Johansson",
      inkDocumentedByReference: true,
    });
    readDelta({ ok: true, intent: "edit", free: { ink: "Scarlett Johansson" } }, seen);
    expect(seen.wall?.reason).toBe("wall_likeness");
  });
});

describe("⚠ AND A TATTOO THIS PRODUCT ALREADY PAINTED IS THE THIRD DOCUMENT", () => {
  /*
    The transform road's own wall, found by driving the REAL entrance rather than
    the service (fable-1288 §5): *"his upper chest tattoo — make it bigger"*, the
    sentence the panel popover itself composes, came back `gate_ink_document` —
    refused 1,860 lines before the road it was built to reach.

    The gate has always asked ONE question — *is there a document for this
    design* — and the answers are now three: the anchor itself, a photograph she
    pointed at, and the crop of the tattoo as it actually landed on her
    (migration `0049`). A change to a documented design invents nothing.

    `inkDocumentedByDelivery` is set by the SERVICE, and only when her own
    sentence points at ink she has AND the branch really holds a crop for it. The
    arms below drive the gate; `inkPriorAsk.test.ts` drives the reading that
    decides the bit, and `scripts/entrance-transform-disposable.mts` drives both
    through the real interpreter with the fresh ask as its negative control.
  */
  it("files the upper chest that walls without it", () => {
    const seen = check({
      instruction: "make his fine-line swallow chest piece bigger",
      inkDocumentedByDelivery: true,
    });
    const delta = readDelta(inkReply("a bigger fine-line swallow chest piece"), seen);
    expect(seen.wall).toBeUndefined();
    expect(delta).not.toBeNull();
  });

  it("⚠ AND WALLS THE SAME SURFACE WITHOUT IT — the control that makes the arm mean something", () => {
    /* Same sentence, same reply, one bit. A gate whose open and shut states are
       not both driven is a gate nobody has measured. */
    const seen = check({ instruction: "make his fine-line swallow chest piece bigger" });
    readDelta(inkReply("a bigger fine-line swallow chest piece"), seen);
    expect(seen.wall).toEqual({ reason: "gate_ink_document" });
  });

  it("walls when the bit is explicitly false, exactly as when it is absent", () => {
    const seen = check({
      instruction: "make his fine-line swallow chest piece bigger",
      inkDocumentedByDelivery: false,
    });
    readDelta(inkReply("a bigger fine-line swallow chest piece"), seen);
    expect(seen.wall).toEqual({ reason: "gate_ink_document" });
  });

  it("opens ONLY this gate — the likeness wall still stands behind it", () => {
    /*
      The same honesty arm its sibling above carries, and for the same reason: a
      document for a tattoo is not a licence, and the cheapest way for this
      change to go wrong is to be read as one.
    */
    const seen = check({
      instruction: "make his chest tattoo look like Scarlett Johansson",
      inkDocumentedByDelivery: true,
    });
    readDelta({ ok: true, intent: "edit", free: { ink: "Scarlett Johansson" } }, seen);
    expect(seen.wall?.reason).toBe("wall_likeness");
  });

  it("files the MARK spelling too, so the road does not die at a subject boundary", () => {
    /* D-158's bypass, pinned here for the same reason the reference arm pins it:
       a design is a design wherever it is filed. */
    const seen = check({
      instruction: "make the small star on his chest bigger",
      inkDocumentedByDelivery: true,
    });
    const delta = readDelta(markReply("a bigger small star on his chest"), seen);
    expect(seen.wall).toBeUndefined();
    expect(delta).not.toBeNull();
  });
});

describe("the flag and the pointing are BOTH required — proven separately", () => {
  /*
    `inkDocumentedByReference` is one derived bit, and the interpreter sets it
    only when the reply pointed AND the account is in scope. Each half is driven
    here as its own arm, because the failure of either alone is a live wall
    opening for somebody who did not ask:

      pointing without the flag   every user on `CASTING_V2_SCOPE=all`
      flag without the pointing   a picture riding an ask that never mentioned it

    Absent and false must behave identically, so both are driven — an `undefined`
    that walls while a `false` files would be a contract nobody could read.
  */
  it("walls when the bit is absent", () => {
    const seen = check();
    readDelta(inkReply(), seen);
    expect(seen.wall).toEqual({ reason: "gate_ink_document" });
  });

  it("walls when the bit is explicitly false", () => {
    const seen = check({ inkDocumentedByReference: false });
    readDelta(inkReply(), seen);
    expect(seen.wall).toEqual({ reason: "gate_ink_document" });
  });
});
