import { describe, expect, it } from "vitest";

import { onTheFace, type FaceExtent } from "./faceExtent";

/*
  THE RULE IS DRIVEN ON HIS OWN ROUND-10 FRAME, not on invented numbers.

  `falRegionReader`'s `keepPiecesOnTheFace` header records what SAM 3 actually
  answered on the cast he was looking at when he wrote *"her left eye box is
  jacked up and not cropped"* (#2844), and those are the numbers here:

      the face read        x351–727  y317–754, middle row y557
      the tattoo's eye     y1199, past the chin by 445 against 197 allowed
      the tattoo's brow    y1180, past the chin by 426 against 197 allowed
      the cast's right ear x306, past the face's edge by 45 against 155

  The two allowances are not typed in: 754 − 557 = 197 and 506 − 351 = 155, so
  the fixture below states the face and the arms re-derive them. That is the
  whole claim of the construction — the face is its own measure.
*/
const HIS_ROUND_10_FACE: FaceExtent = {
  left: 351,
  right: 727,
  top: 317,
  bottom: 754,
  midline: 506,
  middle: 557,
};

describe("the face as its own measure", () => {
  it("keeps what sits inside the face read", () => {
    expect(onTheFace(506, 557, HIS_ROUND_10_FACE)).toBe(true);
    expect(onTheFace(400, 400, HIS_ROUND_10_FACE)).toBe(true);
  });

  it("drops the tattooed face's eye and brow on his round-10 cast", () => {
    /* The defect itself: an eye-shaped answer at the elbow. Past the chin by
       445 and 426 against the 197 this face allows. */
    expect(onTheFace(600, 1199, HIS_ROUND_10_FACE)).toBe(false);
    expect(onTheFace(600, 1180, HIS_ROUND_10_FACE)).toBe(false);
  });

  it("keeps the cast's own ear, which the face read does not itself hold", () => {
    /* 45 outside the face's left edge against the 155 allowed — the reason the
       rule has a margin at all rather than being a plain overlap. */
    expect(onTheFace(306, 500, HIS_ROUND_10_FACE)).toBe(true);
  });

  it("measures each axis by that axis's own half, and keeps a tie", () => {
    /* Exactly at the allowance is kept, for `atTheSide`'s reason. */
    expect(onTheFace(351 - 155, 557, HIS_ROUND_10_FACE)).toBe(true);
    expect(onTheFace(351 - 156, 557, HIS_ROUND_10_FACE)).toBe(false);
    expect(onTheFace(506, 754 + 197, HIS_ROUND_10_FACE)).toBe(true);
    expect(onTheFace(506, 754 + 198, HIS_ROUND_10_FACE)).toBe(false);
    /* Right and top, so no arm here passes on a rule that only reads one side. */
    expect(onTheFace(727 + (727 - 506), 557, HIS_ROUND_10_FACE)).toBe(true);
    expect(onTheFace(727 + (727 - 506) + 1, 557, HIS_ROUND_10_FACE)).toBe(false);
    expect(onTheFace(506, 317 - (557 - 317), HIS_ROUND_10_FACE)).toBe(true);
    expect(onTheFace(506, 317 - (557 - 317) - 1, HIS_ROUND_10_FACE)).toBe(false);
  });

  it("needs BOTH axes, so a thing level with the face but far across is not on it", () => {
    /* A shoulder is the panel's case (#2840): down is fine, across is not. */
    expect(onTheFace(2000, 557, HIS_ROUND_10_FACE)).toBe(false);
    expect(onTheFace(506, 3000, HIS_ROUND_10_FACE)).toBe(false);
  });
});
