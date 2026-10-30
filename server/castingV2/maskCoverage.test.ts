/**
 * THE COVERAGE RULE, DRIVEN DIRECTLY (working law 3).
 *
 * Every arm here builds its own pixels and calls the function. Nothing in this
 * file goes through a scan, a reader or a panel — the rule his check 1 turns on
 * must be provable without anything that could rescue it.
 */
import { describe, expect, it } from "vitest";

import { COVERED_SHARE, coveredShare, coversAFaceCut, type CoverageMask } from "./maskCoverage";

const WIDTH = 10;
const HEIGHT = 10;

/** A mask with a filled rectangle in it, in the one frame every arm uses. */
function maskOf(box: { x: number; y: number; width: number; height: number }): CoverageMask {
  const data = Buffer.alloc(WIDTH * HEIGHT, 0);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) data[y * WIDTH + x] = 255;
  }
  return { data, width: WIDTH, height: HEIGHT };
}

describe("how much of one shape lies under another", () => {
  it("is 1 when the shape is wholly covered", () => {
    const lips = maskOf({ x: 4, y: 4, width: 2, height: 2 });
    const cloth = maskOf({ x: 0, y: 0, width: 10, height: 10 });
    expect(coveredShare(lips, cloth)).toBe(1);
  });

  it("is 0 when the two do not touch", () => {
    const lips = maskOf({ x: 0, y: 0, width: 2, height: 2 });
    const cloth = maskOf({ x: 6, y: 6, width: 4, height: 4 });
    expect(coveredShare(lips, cloth)).toBe(0);
  });

  it("is the share of the COVERED shape, never of the covering one", () => {
    /* Four lip pixels, two of them under a cloth that is itself 40 pixels. The
       answer is 0.5 and not 2/40 — asked the other way round, a big garment
       would always read as covering almost nothing. */
    const lips = maskOf({ x: 4, y: 4, width: 2, height: 2 });
    const cloth = maskOf({ x: 0, y: 5, width: 10, height: 4 });
    expect(coveredShare(lips, cloth)).toBe(0.5);
  });

  it("is 0 for a shape with no pixels, rather than a division by zero", () => {
    const nothing: CoverageMask = { data: Buffer.alloc(WIDTH * HEIGHT, 0), width: WIDTH, height: HEIGHT };
    expect(coveredShare(nothing, maskOf({ x: 0, y: 0, width: 10, height: 10 }))).toBe(0);
  });

  it("REFUSES two masks of different frames rather than comparing them", () => {
    /*
      Two pictures of different sizes compared pixel for pixel answer about the
      wrong part of the body, and the answer looks perfectly ordinary. The
      refusal is 0 — never a covering verdict from a comparison it could not
      make.
    */
    const lips = maskOf({ x: 4, y: 4, width: 2, height: 2 });
    const other: CoverageMask = { data: Buffer.alloc(20 * 20, 255), width: 20, height: 20 };
    expect(coveredShare(lips, other)).toBe(0);
  });
});

describe("does a shape cover one of the face's own cuts", () => {
  const lips = maskOf({ x: 4, y: 4, width: 2, height: 2 });
  const nose = maskOf({ x: 4, y: 1, width: 2, height: 2 });

  it("says yes for a face covering that takes the whole mouth", () => {
    const faceMask = maskOf({ x: 2, y: 3, width: 6, height: 5 });
    expect(coversAFaceCut(faceMask, [lips, nose])).toBe(true);
  });

  it("says no for a high collar that only grazes it", () => {
    /* One of the four lip pixels — a quarter, well under the line. */
    const collar = maskOf({ x: 0, y: 5, width: 5, height: 5 });
    expect(coveredShare(lips, collar)).toBe(0.25);
    expect(coversAFaceCut(collar, [lips, nose])).toBe(false);
  });

  it("asks about ONE face cut at a time, so a mouth taken whole fails even beside untouched rows", () => {
    /*
      ⚠ THE ARM THE RULE EXISTS FOR. Pooled across every face cut, a garment
      over the mouth alone is a minority of all the face's pixels and would
      pass. Asked per row, it fails on the lips — which is the defect.
    */
    const overTheMouth = maskOf({ x: 3, y: 4, width: 4, height: 2 });
    expect(coveredShare(lips, overTheMouth)).toBe(1);
    expect(coveredShare(nose, overTheMouth)).toBe(0);
    expect(coversAFaceCut(overTheMouth, [lips, nose])).toBe(true);
  });

  it("CONTROL — says no when the scan cut no face rows at all", () => {
    /* A reading with nothing of the face cut cannot answer the question, and
       the answer it gives is the one that changes nothing. */
    expect(coversAFaceCut(maskOf({ x: 0, y: 0, width: 10, height: 10 }), [])).toBe(false);
  });

  it("CONTROL — the line is a majority and nothing else", () => {
    /* Pinned so a later hand cannot slide it to 0.2 or 0.8 without this
       sentence going red beside it. */
    expect(COVERED_SHARE).toBe(0.5);
    /* And it is strictly greater: exactly half is kept, the way `atTheSide`
       keeps a tie. */
    const half = maskOf({ x: 0, y: 5, width: 10, height: 5 });
    const straddling = maskOf({ x: 4, y: 4, width: 2, height: 2 });
    expect(coveredShare(straddling, half)).toBe(0.5);
    expect(coversAFaceCut(half, [straddling])).toBe(false);
  });
});
