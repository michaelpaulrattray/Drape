/**
 * THE LENGTH INSTRUMENT'S CONTROLS, BEFORE IT IS ALLOWED TO JUDGE ANYTHING.
 *
 * Working law 2, and this is the second instrument installed at the library's
 * door in three days — the first one (area) is the reason the law exists here:
 * it read 65.2% and 54.0% on the founder's two hoops and neither number meant
 * anything, because it was measuring inside its own resolution.
 *
 * So this file drives, in order:
 *
 *   the thinner's fixed point   a one-pixel line is its OWN skeleton, and
 *                               thinning twice is thinning once. A thinner that
 *                               ate what it had already reduced would shrink the
 *                               denominator on every run and the bar would drift.
 *   the thinner really thins    a solid disc loses ~19 in 20 of its pixels, so
 *                               the fixed-point control above is not being passed
 *                               by a function that returns its argument.
 *   the topology survives       a ring thins to a closed one-pixel loop of about
 *                               its own circumference — not to a blob, not to a
 *                               broken arc.
 *   never an empty denominator  a single pixel survives thinning, so a non-empty
 *                               region can never divide by zero.
 *   the allowance is ONE pixel  a crop shifted by one reads unchanged; shifted by
 *                               three does not. That is what makes the dilation a
 *                               registration allowance rather than a tolerance
 *                               knob somebody can turn.
 *   the defect it CATCHES       an amputated arc costs the arc's share of the
 *                               circumference.
 *   the defect it CANNOT        the thin defect and one pixel of registration are
 *                               the same bytes, driven here so the limit is a
 *                               test result rather than a claim in a comment.
 */
import { describe, expect, it } from "vitest";

import type { Mask } from "./maskedComposite";
import {
  CENTRELINE_BLIND_TO,
  dilateOnce,
  measureCentreline,
  shapePixels,
  thinToCentreline,
} from "./referenceCentreline";
import type { SegmentBox } from "./segmentCuts";

const SIDE = 61;
const CENTRE = 30;

type Shape = { data: Uint8Array; width: number; height: number };

function shape(fill: (x: number, y: number) => boolean): Shape {
  const data = new Uint8Array(SIDE * SIDE);
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) if (fill(x, y)) data[y * SIDE + x] = 255;
  }
  return { data, width: SIDE, height: SIDE };
}

const radius = (x: number, y: number) => Math.hypot(x - CENTRE, y - CENTRE);
const degrees = (x: number, y: number) => {
  const angle = (Math.atan2(y - CENTRE, x - CENTRE) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
};

/** A three-pixel-thick ring — the founder's hoop's proportions, scaled up. */
const RING = (x: number, y: number) => radius(x, y) >= 9.5 && radius(x, y) <= 12.5;
const DISC = (x: number, y: number) => radius(x, y) <= 12.5;

/** A whole-frame shape as the `Mask` the guard passes around. */
function asMask(s: Shape): Mask {
  return { data: Buffer.from(s.data), width: s.width, height: s.height };
}

/** A whole-frame shape as a crop occupying the whole frame's box, which is how
 *  the guard's arithmetic takes it (mask in the box's own coordinates). */
function asCrop(s: Shape): { mask: Mask; box: SegmentBox } {
  return { mask: asMask(s), box: { x: 0, y: 0, width: s.width, height: s.height } };
}

function shift(s: Shape, dx: number, dy: number): Shape {
  return shape((x, y) => {
    const sx = x - dx;
    const sy = y - dy;
    return sx >= 0 && sy >= 0 && sx < SIDE && sy < SIDE && s.data[sy * SIDE + sx]! > 0;
  });
}

/** `erode` — and it is deliberately the SAME operation as "the ring drawn one
 *  pixel thinner all round". That identity is the blind spot, not a shortcut. */
function erode(s: Shape): Shape {
  return shape((x, y) => {
    if (s.data[y * SIDE + x]! === 0) return false;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SIDE || ny >= SIDE || s.data[ny * SIDE + nx]! === 0) return false;
      }
    }
    return true;
  });
}

describe("the thinner — the measure's denominator, controlled first", () => {
  it("FIXED POINT: a one-pixel line is its own skeleton, and thinning is idempotent", () => {
    const line = shape((x, y) => y === CENTRE && x >= 8 && x < SIDE - 8);
    const thinnedLine = thinToCentreline(line);
    expect([...thinnedLine.data]).toEqual([...line.data]);

    const once = thinToCentreline(shape(RING));
    const twice = thinToCentreline(once);
    expect([...twice.data]).toEqual([...once.data]);
  });

  it("AND IT REALLY THINS — a solid disc keeps about a twentieth of itself", () => {
    /* Without this, the control above would also be passed by `x => x`. */
    const disc = shape(DISC);
    const spine = thinToCentreline(disc);
    expect(shapePixels(spine) / shapePixels(disc)).toBeLessThan(0.1);
    expect(shapePixels(spine)).toBeGreaterThan(0);
  });

  it("TOPOLOGY: a ring thins to a closed one-pixel loop of its own circumference", () => {
    const ring = shape(RING);
    const spine = thinToCentreline(ring);
    /* About 2πr at the band's middle radius, r ≈ 11. */
    expect(shapePixels(spine)).toBeGreaterThan(55);
    expect(shapePixels(spine)).toBeLessThan(85);
    /* A closed loop: every pixel of it has at least two neighbours in it. An
       open arc would have two ends with one neighbour each, which is exactly the
       defect this instrument exists to detect — so the DENOMINATOR must never
       have it by accident. */
    for (let y = 0; y < SIDE; y += 1) {
      for (let x = 0; x < SIDE; x += 1) {
        if (spine.data[y * SIDE + x]! === 0) continue;
        let neighbours = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= SIDE || ny >= SIDE) continue;
            if (spine.data[ny * SIDE + nx]! > 0) neighbours += 1;
          }
        }
        expect(neighbours, `spine pixel ${x},${y}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("NEVER AN EMPTY DENOMINATOR: a single pixel survives thinning", () => {
    /* `measureCentreline` divides by the spine, and a region that thinned to
       nothing would make every reading 0 — a silent, confident, universal
       refusal. Zhang–Suen cannot delete a pixel with fewer than two neighbours,
       and this is that property driven rather than trusted. */
    const dot = shape((x, y) => x === CENTRE && y === CENTRE);
    expect(shapePixels(thinToCentreline(dot))).toBe(1);
  });
});

describe("the dilation — one pixel of registration, spent before the measurement", () => {
  it("grows a single pixel to exactly its nine", () => {
    const dot = shape((x, y) => x === CENTRE && y === CENTRE);
    expect(shapePixels(dilateOnce(dot))).toBe(9);
  });

  it("a one-pixel shift is beneath the instrument's notice; three pixels is not", () => {
    /* THE ALLOWANCE IS A MEASUREMENT, NOT A KNOB. Two independent reads of the
       same hoop are entitled to disagree about where its edge runs by a pixel;
       they are not entitled to disagree by three. If the second reading here were
       also ~100%, the dilation would be a tolerance hiding real disagreement. */
    const ring = asMask(shape(RING));
    const crop = shape(RING);
    expect(measureCentreline(asCrop(shift(crop, 1, 0)), ring).coverage).toBeGreaterThan(0.99);
    /* Three pixels reads 69.0% — under the 97.6% bar, so the door refuses it.
       Stated against the bar rather than as a round number, because "the
       instrument notices" only means anything relative to what it enforces. */
    expect(measureCentreline(asCrop(shift(crop, 3, 0)), ring).coverage).toBeLessThan(0.976);
  });
});

describe("the instrument — what it catches, and what it is blind to", () => {
  const ring = asMask(shape(RING));

  it("IDENTITY CONTROL: the region as its own crop runs the whole of its centreline", () => {
    const reading = measureCentreline(asCrop(shape(RING)), ring);
    expect(reading.coverage).toBe(1);
    expect(reading.coveredPixels).toBe(reading.spinePixels);
  });

  it("CATCHES a missing segment, and costs it the arc's share of the circumference", () => {
    /* A contiguous 120° of the ring deleted — a piece plainly missing, which is
       the disease this door was installed for. Two thirds of the loop remains,
       plus the pixel of bleed the dilation grants at each of the two cut ends. */
    const amputated = shape((x, y) => {
      if (!RING(x, y)) return false;
      const angle = degrees(x, y);
      return !(angle >= 200 && angle < 320);
    });
    const reading = measureCentreline(asCrop(amputated), ring);
    expect(reading.coverage).toBeGreaterThan(0.6);
    expect(reading.coverage).toBeLessThan(0.8);
    /* And that is decisively under the bar the door enforces. */
    expect(reading.coverage).toBeLessThan(0.976);
  });

  it("IS BLIND to thinning — a COMPLETE ring drawn one pixel thinner is refused", () => {
    /*
      opus-170 §3, adopted as fable-228's second caveat, and driven here from the
      side that costs something.

      `erode(crop)` is TWO things at once: "the ring drawn one pixel thinner all
      round" (a defect this door would like to catch) and "one pixel of honest
      disagreement between two independent readers" (noise it must forgive). They
      are the same operation, so the instrument returns one number for both, and
      asserting they read alike would be a tautology.

      What is NOT a tautology is which side of the bar that one number falls on.
      Here the ring is complete — nothing is missing — and eroded it reads 33.3%,
      far under the 97.6% bar. So the door refuses a whole ring for being drawn
      thin, and reports it as `brokenOutline`, which is the wrong name for what
      happened. The refusal keeps its crop precisely because of cases like this
      one: an eye is the only instrument that can overturn it.

      The real specimen was gentler — 16.7 points against a 23.6-point gap, the
      1.4× margin stated on the bar's face — because a photographed hoop is not an
      ideal band. The direction is the same and it is the door's stated limit; a
      thickness sensor is separate work and is not this.
    */
    const complete = measureCentreline(asCrop(shape(RING)), ring);
    const thinned = measureCentreline(asCrop(erode(shape(RING))), ring);
    expect(complete.coverage).toBe(1);
    expect(thinned.coverage).toBeLessThan(0.976);
    expect(CENTRELINE_BLIND_TO).toContain("thinning");
  });

  it("a crop that misses the region entirely reads nothing, not something", () => {
    const elsewhere = shape((x, y) => x < 4 && y < 4);
    expect(measureCentreline(asCrop(elsewhere), ring).coverage).toBe(0);
  });
});
