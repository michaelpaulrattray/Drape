import { describe, expect, it } from "vitest";

import {
  UPSWEPT_ALREADY,
  alreadyUpswept,
  medianReading,
  pairCorners,
  readingFrom,
  tiltOf,
  type Point,
} from "./canthalTilt";

/**
 * The arithmetic, driven directly — no landmark model, no render.
 *
 * The live instrument is controlled separately and by rotation
 * (`scripts/calibration/tilt-instrument.mts`): turn the image by a known angle
 * and the reading must follow it. These pin the part that must not drift while
 * that runs — sign, aspect handling, and the refusals.
 */

const W = 1024;
const H = 1536;

describe("the sign says which way the eye sweeps", () => {
  it("reads UPSWEPT as positive — the outer corner higher than the inner", () => {
    /* Image coordinates run downward, so a higher outer corner is a SMALLER y. */
    const outer: Point = { x: 0.35, y: 0.30 };
    const inner: Point = { x: 0.45, y: 0.32 };
    expect(tiltOf(outer, inner, W, H)).toBeGreaterThan(0);
  });

  it("reads DOWNTURNED as negative", () => {
    const outer: Point = { x: 0.35, y: 0.33 };
    const inner: Point = { x: 0.45, y: 0.32 };
    expect(tiltOf(outer, inner, W, H)).toBeLessThan(0);
  });

  it("reads level corners as zero", () => {
    expect(tiltOf({ x: 0.35, y: 0.32 }, { x: 0.45, y: 0.32 }, W, H)).toBe(0);
  });

  it("measures in PIXELS, so a portrait frame does not inflate the angle", () => {
    /*
      The model returns normalised coordinates and this frame is half again as
      tall as it is wide. An angle computed on those directly would be larger on
      a portrait crop than a square one for the same face — a model appearing to
      behave differently per framing, which is exactly the sort of artefact that
      gets blamed on the model.
    */
    const outer: Point = { x: 0.35, y: 0.30 };
    const inner: Point = { x: 0.45, y: 0.32 };
    const portrait = tiltOf(outer, inner, 1024, 1536);
    const square = tiltOf(outer, inner, 1024, 1024);
    expect(portrait).not.toBeCloseTo(square, 1);
    /* dy = 0.02*1536 = 30.7px, dx = 0.10*1024 = 102.4px -> atan(0.3) = 16.7deg */
    expect(portrait).toBeCloseTo(16.7, 0);
  });
});

describe("the corners are paired by anatomy, never by array order", () => {
  it("puts the outer corners on the outside of the inner ones", () => {
    const outers: Point[] = [{ x: 0.58, y: 0.33 }, { x: 0.37, y: 0.32 }];
    const inners: Point[] = [{ x: 0.55, y: 0.32 }, { x: 0.45, y: 0.32 }];
    const paired = pairCorners(outers, inners);
    expect(paired.right.outer.x).toBeLessThan(paired.right.inner.x);
    expect(paired.left.outer.x).toBeGreaterThan(paired.left.inner.x);
  });

  it("REFUSES when the landmarker mislabels, rather than returning an angle", () => {
    /*
      Asked for "lateral canthus" the model put a point on her jaw. Two points
      always make an angle; only some pairs of points make a canthal tilt. A
      confident number from the wrong landmarks is the D-210 family.
    */
    const outers: Point[] = [{ x: 0.50, y: 0.33 }, { x: 0.52, y: 0.32 }];
    const inners: Point[] = [{ x: 0.30, y: 0.32 }, { x: 0.70, y: 0.32 }];
    expect(() => pairCorners(outers, inners)).toThrow(/outside-in|mislabel/);
  });

  it("REFUSES a face it could only half-see", () => {
    expect(() => pairCorners([{ x: 0.4, y: 0.3 }], [{ x: 0.45, y: 0.3 }, { x: 0.55, y: 0.3 }]))
      .toThrow(/two outer and two inner/);
  });

  it("refuses corners that landed on top of each other", () => {
    expect(() => tiltOf({ x: 0.45, y: 0.32 }, { x: 0.45, y: 0.32 }, W, H))
      .toThrow(/on top of each other/);
  });
});

describe("a reading reports its own disagreement", () => {
  it("carries the asymmetry rather than averaging it away", () => {
    /* Her right eye upswept, her left downturned — a real face is not like
       this, so a big number here is the landmarker disagreeing with itself and
       the caller needs to be able to see that. */
    const reading = readingFrom(
      [{ x: 0.37, y: 0.30 }, { x: 0.58, y: 0.34 }],
      [{ x: 0.45, y: 0.32 }, { x: 0.55, y: 0.32 }],
      W, H,
    );
    expect(reading.asymmetryDeg).toBeGreaterThan(10);
    expect(Math.sign(reading.rightDeg)).not.toBe(Math.sign(reading.leftDeg));
  });

  it("takes the MEDIAN across samples, so one mislabel moves nothing", () => {
    const sample = (meanDeg: number) => ({ rightDeg: meanDeg, leftDeg: meanDeg, meanDeg, asymmetryDeg: 0 });
    const summary = medianReading([sample(4), sample(5), sample(40), sample(4.5), sample(5.5)]);
    expect(summary.meanDeg, "the outlier does not drag it").toBe(5);
    expect(summary.spreadDeg, "but the spread confesses the outlier existed").toBe(36);
  });

  it("refuses to summarise nothing", () => {
    expect(() => medianReading([])).toThrow(/no tilt readings/);
  });
});

describe("the already-true gate", () => {
  it("says a clearly upswept face already has what the ask wants", () => {
    expect(alreadyUpswept({ meanDeg: UPSWEPT_ALREADY + 2 })).toBe(true);
  });

  it("does not fire on a level face, which is the one the ask is for", () => {
    expect(alreadyUpswept({ meanDeg: 0 })).toBe(false);
    expect(alreadyUpswept({ meanDeg: -3 })).toBe(false);
  });

  it("keeps the threshold generous, because a false 'she already has it' costs a picture", () => {
    /* The failure this program has shipped once and does not get to ship again
       is a FALSE REFUSAL. Pinned so lowering it is a deliberate act. */
    expect(UPSWEPT_ALREADY).toBeGreaterThanOrEqual(5);
  });
});
