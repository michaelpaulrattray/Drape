import { describe, expect, it } from "vitest";

import { masksMeet, splitByInheritance } from "./inheritedVerdict";
import type { Mask } from "./maskedComposite";
import type { FacetCheck } from "./renderVerification";
import type { Facet } from "./refineFacets";

/**
 * CONTROLS BEFORE THIS INSTRUMENT'S VERDICTS COUNT (law 2, and fable-012's
 * condition 2 in as many words).
 *
 * Inheritance decides whether a stochastic reader is consulted about a
 * 25-credit render. So the pair that matters is: a facet the composite COULD
 * have changed still gets looked at, and a facet it provably could not comes
 * through carrying the master's own words. If only the second were tested, a
 * function that inherited everything would pass.
 */

const SIDE = 8;

/** A mask with pixels set inside `[fromRow, toRow)` — bands, so overlap is
 *  arithmetic rather than a picture I have to squint at. */
const band = (fromRow: number, toRow: number): Mask => {
  const data = Buffer.alloc(SIDE * SIDE, 0);
  for (let y = fromRow; y < toRow; y += 1) {
    for (let x = 0; x < SIDE; x += 1) data[y * SIDE + x] = 255;
  }
  return { data, width: SIDE, height: SIDE };
};

const checkFor = (facet: Facet, over: Partial<FacetCheck> = {}): FacetCheck => ({
  facet,
  asked: "tied back, low ponytail",
  verified: true,
  read: true,
  saw: "hair is tied back in a low ponytail",
  binding: false,
  ...over,
});

/* `hairWorn` segments "hair"; `marks` segments "face skin" — from the
   compositor's own table, not restated here. */
const HAIR = band(0, 2);
const FACE_SKIN = band(4, 6);

describe("masks meeting", () => {
  it("is true on a single shared pixel, and false when they merely touch nothing", () => {
    expect(masksMeet(band(0, 3), band(2, 5)), "row 2 is in both").toBe(true);
    expect(masksMeet(band(0, 2), band(4, 6))).toBe(false);
  });

  it("says NO when the masks are different sizes, so the caller looks again", () => {
    /* Not "true", not a resize — unknown. Comparing index-wise across two
       geometries would answer a question about a picture that does not exist. */
    const small: Mask = { data: Buffer.alloc(4, 255), width: 2, height: 2 };
    expect(masksMeet(small, band(0, 8))).toBe(false);
  });
});

describe("inheriting a verdict the composite could not have changed", () => {
  const evidence = {
    /* The earrings edit: the composite was allowed to change her earlobes, and
       nothing in the hair band. */
    applied: band(4, 6),
    masterRegions: new Map<string, Mask>([["hair", HAIR], ["face skin", FACE_SKIN]]),
  };

  it("NEGATIVE CONTROL — run-6's hairWorn comes through inherited, carrying the master's own saw", () => {
    const { live, inherited } = splitByInheritance({
      facts: [{ facet: "hairWorn", asked: "tied back, low ponytail" }],
      evidence,
      masterChecks: new Map([["hairWorn" as Facet, checkFor("hairWorn")]]),
      written: new Set<Facet>(),
    });

    expect(live, "the reader is not asked about hair the composite never touched").toEqual([]);
    expect(inherited).toHaveLength(1);
    expect(inherited[0]!.verified, "the master's verdict, unchanged").toBe(true);
    expect(inherited[0]!.saw, "and its evidence travels with it")
      .toBe("hair is tied back in a low ponytail");
  });

  it("POSITIVE CONTROL — a facet whose region MEETS what changed is still read live", () => {
    const { live, inherited } = splitByInheritance({
      /* `marks` segments "face skin", which is exactly where this composite
         was allowed to paint. Nothing about it is settled by arithmetic. */
      facts: [{ facet: "marks", asked: "light freckles" }],
      evidence,
      masterChecks: new Map([["marks" as Facet, checkFor("marks")]]),
      written: new Set<Facet>(),
    });

    expect(inherited, "an overlapping region is never inherited").toEqual([]);
    expect(live.map((fact) => fact.facet)).toEqual(["marks"]);
  });

  it("never inherits a facet THIS edit wrote, even when its region is untouched", () => {
    /* The thing being bought gets looked at. If this ever inherits, a render
       could pass its own ask without anyone opening the picture. */
    const { live, inherited } = splitByInheritance({
      facts: [{ facet: "hairWorn", asked: "worn up" }],
      evidence,
      masterChecks: new Map([["hairWorn" as Facet, checkFor("hairWorn")]]),
      written: new Set<Facet>(["hairWorn"]),
    });
    expect(inherited).toEqual([]);
    expect(live).toHaveLength(1);
  });

  it("reads live when the region was never segmented — we did not look is not it did not change", () => {
    const { live, inherited } = splitByInheritance({
      facts: [{ facet: "hairWorn", asked: "tied back, low ponytail" }],
      evidence: { applied: band(4, 6), masterRegions: new Map() },
      masterChecks: new Map([["hairWorn" as Facet, checkFor("hairWorn")]]),
      written: new Set<Facet>(),
    });
    expect(inherited).toEqual([]);
    expect(live).toHaveLength(1);
  });

  it("reads live when the render was never composited at all", () => {
    const { live, inherited } = splitByInheritance({
      facts: [{ facet: "hairWorn", asked: "tied back, low ponytail" }],
      evidence: null,
      masterChecks: new Map([["hairWorn" as Facet, checkFor("hairWorn")]]),
      written: new Set<Facet>(),
    });
    expect(inherited).toEqual([]);
    expect(live).toHaveLength(1);
  });

  it("reads live when the master never had an opinion — a first refinement", () => {
    const { live, inherited } = splitByInheritance({
      facts: [{ facet: "hairWorn", asked: "tied back, low ponytail" }],
      evidence,
      masterChecks: new Map(),
      written: new Set<Facet>(),
    });
    expect(inherited).toEqual([]);
    expect(live).toHaveLength(1);
  });

  /*
    D-235, AND THE ONE THAT MUST NOT BE TIDIED.

    A master row that passed with nothing behind it was never a reading. Copying
    the boolean forward would launder it into a pass — on pixels this code has
    just proved nobody looked at twice, which makes it the most confident false
    pass the system could possibly produce.
  */
  it("carries an unread master row through UNREAD, never as a pass", () => {
    const { inherited } = splitByInheritance({
      facts: [{ facet: "hairWorn", asked: "tied back, low ponytail" }],
      evidence,
      masterChecks: new Map([
        ["hairWorn" as Facet, checkFor("hairWorn", { verified: true, read: true, saw: undefined })],
      ]),
      written: new Set<Facet>(),
    });

    expect(inherited).toHaveLength(1);
    expect(inherited[0]!.read, "no saw behind it, so it was never read").toBe(false);
    expect(inherited[0]!.verified, "and it certainly is not a pass").toBe(false);
  });

  it("carries a master MISS forward as a miss", () => {
    /* Inheritance is not amnesty. If the master was wrong there and the
       composite did not touch it, it is still wrong there. */
    const { inherited } = splitByInheritance({
      facts: [{ facet: "hairWorn", asked: "tied back, low ponytail", binding: true }],
      evidence,
      masterChecks: new Map([
        ["hairWorn" as Facet, checkFor("hairWorn", { verified: false, saw: "her hair is down" })],
      ]),
      written: new Set<Facet>(),
    });
    expect(inherited[0]!.verified).toBe(false);
    expect(inherited[0]!.saw).toBe("her hair is down");
  });
});
