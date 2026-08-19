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
