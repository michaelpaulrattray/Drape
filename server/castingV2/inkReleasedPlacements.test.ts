import { describe, expect, it } from "vitest";
import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import {
  INK_PLACEMENT_NOT_RELEASED,
  RELEASED_INK_TUPLES,
  everyInkTuple,
  inkTupleKey,
  isInkTupleReleased,
  releasedAgainst,
  sidesForInkPlacement,
} from "../../shared/inkReleasedPlacements";

/**
 * TWO FACTS, TWO TABLES — and the reason is a 300-credit receipt.
 *
 * A placement is in the VOCABULARY because the photograph was measured to
 * contain it. A placement is RELEASED because a drive proved ink actually held
 * there. The legacy ink road kept those apart and said why in its own docblock:
 * *"A tuple is not inferred from a neighbouring body region or opposite side:
 * every zone/surface/laterality combination earns release on its own
 * evidence."* It released 8 tuples of 288, and the ones it refused are the ones
 * that mirrored the design onto the wrong side of the body.
 */
describe("the sides come from the vocabulary rather than beside it", () => {
  it("gives an arm two and everything else one", () => {
    expect([...sidesForInkPlacement("upperArm")]).toEqual(["left", "right"]);
    expect([...sidesForInkPlacement("neck")]).toEqual(["centre"]);
    expect([...sidesForInkPlacement("upperChest")]).toEqual(["centre"]);
  });

  it("enumerates every tuple the vocabulary can currently express", () => {
    expect(everyInkTuple().map(inkTupleKey)).toEqual([
      "neck:centre",
      "upperArm:left",
      "upperArm:right",
      "upperChest:centre",
    ]);
  });

  it("covers every placement, so a new one cannot arrive without its sides", () => {
    const covered = new Set(everyInkTuple().map((tuple) => tuple.placement));
    expect([...covered].sort()).toEqual([...INK_PLACEMENTS].sort());
  });
});

describe("nothing is released, and that is the honest state", () => {
  it("holds an empty table", () => {
    expect(RELEASED_INK_TUPLES.size).toBe(0);
  });

  it("refuses every tuple the vocabulary can express", () => {
    for (const tuple of everyInkTuple()) expect(isInkTupleReleased(tuple)).toBe(false);
  });

  it("says so in words a customer can act on, and promises no charge", () => {
    expect(INK_PLACEMENT_NOT_RELEASED).toContain("Nothing was charged");
  });
});

/**
 * THE RULE CANNOT BE PROVEN BY AN EMPTY TABLE.
 *
 * With nothing released, "is it released" answers `false` to everything and a
 * test of it confirms only that the table is empty — a class labelled by what
 * was sent, which cannot fail to confirm its own instrument. So the rule is
 * driven against an INJECTED set, where release is reachable and the refusals
 * beside it mean something.
 */
describe("release is per tuple, never inferred — driven where it can succeed", () => {
  const released = new Set(["upperArm:left"]);

  it("admits exactly the tuple that earned it", () => {
    expect(releasedAgainst({ placement: "upperArm", side: "left" }, released)).toBe(true);
  });

  it("does NOT admit the opposite side of the same placement", () => {
    /*
      This is the failure with a receipt. The legacy road delivered a 3/4
      candidate that "visibly mirrored the left-shoulder triangle", and its
      placement audit later rejected both Walk attempts at 90% confidence for
      wrong anatomical side. A left arm earning release says nothing whatever
      about a right one.
    */
    expect(releasedAgainst({ placement: "upperArm", side: "right" }, released)).toBe(false);
  });

  it("does NOT admit a neighbouring placement", () => {
    expect(releasedAgainst({ placement: "neck", side: "centre" }, released)).toBe(false);
    expect(releasedAgainst({ placement: "upperChest", side: "centre" }, released)).toBe(false);
  });

  it("admits nothing at all against an empty set", () => {
    for (const tuple of everyInkTuple()) {
      expect(releasedAgainst(tuple, new Set())).toBe(false);
    }
  });
});
