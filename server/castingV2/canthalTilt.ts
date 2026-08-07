/**
 * CANTHAL TILT, IN DEGREES — a geometric facet gets a geometric measure.
 *
 * # Why this exists
 *
 * `eye.shape` is the one class this program has never been able to score. A
 * vision reader is asked *"are these fox eyes"* and answers with an opinion, and
 * the opinion has been wrong in both directions: it called a lifted outer corner
 * "rounded/almond" and it called an unchanged eye the same thing, so the verdict
 * carried no information about the render. Meanwhile the founder's own eye
 * caught what a whole sweep of scalars missed.
 *
 * The property being asked for is **an angle**. It is not a matter of taste or
 * of naming, it is where two points sit relative to one another, and a model
 * that can find those two points turns the whole question into arithmetic.
 * *"The corners are still level"* becomes a number, and a compliance too subtle
 * for a reader to perceive becomes visible anyway.
 *
 * # THE CONFOUND THIS WAS BUILT TO CLOSE (founder, 2026-08-07)
 *
 * Every fox-eyes test this program has ever run — July's walk, this week's
 * walk, the bare-faced probe — ran on **Asian faces, whose eyes carry a high
 * baseline canthal tilt.** The requested delta was therefore near zero, and an
 * engine changing nothing and an engine correctly rendering that ask produce
 * nearly the same picture. Every prior verdict is confounded by baseline; the
 * class's capability is UNKNOWN rather than disproven.
 *
 * A probe of that capability needs a face whose corners are measurably LEVEL or
 * DOWNTURNED, so the ask carries a real delta — and "measurably" is this module.
 * It is also what makes the already-true gate possible: an ask for a property
 * the face already has can be refused for free, before any spend.
 *
 * # The instrument is not trusted until it is controlled
 *
 * A landmark model is stochastic and its points wobble by a few pixels, which on
 * a 78-pixel eye is degrees. So this SAMPLES, reports the spread alongside the
 * value, and refuses to pretend to a precision it does not have. The positive
 * control lives in the tests and in `scripts/calibration/tilt-instrument.mts`:
 * **rotate the image by a known angle and the measured tilt must move by that
 * angle.** An instrument that cannot see a rotation it was handed cannot see a
 * render it was pointed at.
 */
import { MaskError } from "./maskGeometry";
import type { Mask } from "./maskedComposite";

/** Normalised landmark, as the point model returns them. */
export type Point = { x: number; y: number };

/**
 * CORNERS FROM THE EYE MASK, NOT FROM A POINT MODEL — and this is a swap, not a
 * tune (the fidelity law's own instruction: if a mask reads wrong in the
 * side-by-sides, change the model rather than tuning around it).
 *
 * The first instrument asked `moondream3-preview/point` for "outer corner of the
 * eye". It **failed its rotation control outright**: an 8.3 degree noise floor
 * on a repeat measurement of one unchanged face, and a 16.7 degree residual
 * against a rotation it had been handed. It could not see an 8 degree turn, so
 * it could never have seen a render. Reporting tilt from it would have produced
 * confident numbers about nothing.
 *
 * A SAM-class eye mask is a different kind of answer. It is precise on named
 * regions, and **a corner is not a thing to be guessed at — it is where the mask
 * ends.** Extremal columns of a segmentation are arithmetic on pixels we
 * already hold, so the reading is deterministic given the mask and inherits the
 * segmenter's own accuracy rather than a language model's aim.
 *
 * The two eyes are found as the two largest connected components, so the same
 * union the reader already returns for a bilateral region is usable unchanged.
 * Each corner is averaged over a few outermost columns rather than taken from a
 * single extreme pixel, because one stray pixel of lash is a corner two rows out
 * of place and a lever on a short baseline.
 */
export function cornersFromMask(mask: Mask): { outers: Point[]; inners: Point[] } {
  const { width, height, data } = mask;
  if (data.length !== width * height) {
    throw new MaskError(`the eye mask is ${data.length} bytes for ${width}x${height} — not single-channel`);
  }

  /* Connected components over the mask, iteratively so a tall eye cannot blow
     the stack the way a recursive flood fill would. */
  const labels = new Int32Array(width * height).fill(-1);
  const components: { pixels: number[]; sumX: number }[] = [];
  for (let start = 0; start < data.length; start += 1) {
    if (data[start] <= 127 || labels[start] !== -1) continue;
    const id = components.length;
    const pixels: number[] = [];
    let sumX = 0;
    const stack = [start];
    labels[start] = id;
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      pixels.push(pixel);
      sumX += pixel % width;
      const x = pixel % width;
      const y = (pixel - x) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (data[next] <= 127 || labels[next] !== -1) continue;
        labels[next] = id;
        stack.push(next);
      }
    }
    components.push({ pixels, sumX });
  }

  const twoLargest = components.sort((a, b) => b.pixels.length - a.pixels.length).slice(0, 2);
  if (twoLargest.length < 2) {
    throw new MaskError(
      `the eye mask holds ${components.length} region(s) — a tilt reading needs two eyes`,
    );
  }
  /* By centroid: the smaller x is her RIGHT eye (image left). */
  twoLargest.sort((a, b) => a.sumX / a.pixels.length - b.sumX / b.pixels.length);

  /** The mean y over the `span` outermost columns on one side of a component. */
  const edge = (pixels: number[], side: "min" | "max", span = 3): Point => {
    const xs = pixels.map((pixel) => pixel % width);
    const limit = side === "min" ? Math.min(...xs) : Math.max(...xs);
    let sumY = 0;
    let count = 0;
    for (const pixel of pixels) {
      const x = pixel % width;
      const withinSpan = side === "min" ? x <= limit + span : x >= limit - span;
      if (!withinSpan) continue;
      sumY += (pixel - x) / width;
      count += 1;
    }
    return { x: limit / width, y: sumY / count / height };
  };

  const [right, left] = twoLargest;
  return {
    /* Outer corners are the ones further apart: her right eye's leftmost edge
       and her left eye's rightmost. */
    outers: [edge(right.pixels, "min"), edge(left.pixels, "max")],
    inners: [edge(right.pixels, "max"), edge(left.pixels, "min")],
  };
}

export type TiltReading = {
  /** Her right eye (image left) and her left eye, in degrees. */
  rightDeg: number;
  leftDeg: number;
  /** The face's tilt: the mean of the two. */
  meanDeg: number;
  /**
   * How far apart the two eyes read. A real face is roughly symmetric, so a
   * large value is the LANDMARKER disagreeing with itself rather than an
   * asymmetric face — and it is reported rather than averaged away, because
   * that is the difference between a measurement and a number.
   */
  asymmetryDeg: number;
};

/**
 * POSITIVE MEANS UPSWEPT — the outer corner sitting higher than the inner one,
 * which is the direction "fox eyes" asks for.
 *
 * Image coordinates run downward, so "higher" is a SMALLER y, and the sign is
 * flipped once here rather than at every call site.
 *
 * Measured in PIXELS, never in the normalised coordinates the model returns: a
 * 1024x1536 frame stretches the vertical axis by half again, and an angle
 * computed on normalised coordinates would be wrong by that factor — larger on
 * a portrait crop than a square one, which is the sort of error that reads as a
 * model behaving differently on different framings.
 */
export function tiltOf(outer: Point, inner: Point, width: number, height: number): number {
  const dx = Math.abs(inner.x - outer.x) * width;
  const dy = (inner.y - outer.y) * height;
  if (dx < 1) throw new MaskError("the two corners landed on top of each other — no angle to read");
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Pair the returned corners into two eyes, by side.
 *
 * The model is asked for "outer corner of the eye" and returns two points, one
 * per side; likewise the inner corners. Which is which is decided by x, because
 * the outer corners are the ones further apart — anatomy, not the order of an
 * array (the longest-match lesson, one module over).
 */
export function pairCorners(outers: Point[], inners: Point[]): {
  right: { outer: Point; inner: Point };
  left: { outer: Point; inner: Point };
} {
  if (outers.length < 2 || inners.length < 2) {
    throw new MaskError(
      `a tilt reading needs two outer and two inner corners — got ${outers.length} and ${inners.length}`,
    );
  }
  const byX = (points: Point[]) => [...points].sort((a, b) => a.x - b.x);
  const [outerRight, outerLeft] = byX(outers);
  const [innerRight, innerLeft] = byX(inners);
  /*
    A SANITY CHECK THE ANATOMY MAKES FREE: the outer corners must lie OUTSIDE
    the inner ones. When the landmarker mislabels — and it does, "lateral
    canthus" put a point on her jaw — this catches it rather than producing a
    confident angle from two points that are not corners at all.
  */
  if (!(outerRight.x < innerRight.x && outerLeft.x > innerLeft.x)) {
    throw new MaskError("the corners did not land outside-in — the landmarker mislabelled them");
  }
  return {
    right: { outer: outerRight, inner: innerRight },
    left: { outer: outerLeft, inner: innerLeft },
  };
}

/**
 * The leftmost and rightmost points of one eye's mask, each averaged over a few
 * outermost columns so a stray pixel of lash cannot lever a short baseline.
 */
function extremesOf(mask: Mask): { leftMost: Point; rightMost: Point } {
  const { width, height, data } = mask;
  if (data.length !== width * height) {
    throw new MaskError(`an eye mask is ${data.length} bytes for ${width}x${height} — not single-channel`);
  }
  let minX = width;
  let maxX = -1;
  for (let pixel = 0; pixel < data.length; pixel += 1) {
    if (data[pixel] <= 127) continue;
    const x = pixel % width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  if (maxX < 0) throw new MaskError("an eye mask selected nothing — no corner to read");

  const meanYNear = (limit: number, side: "min" | "max", span = 3) => {
    let sumY = 0;
    let count = 0;
    for (let pixel = 0; pixel < data.length; pixel += 1) {
      if (data[pixel] <= 127) continue;
      const x = pixel % width;
      const within = side === "min" ? x <= limit + span : x >= limit - span;
      if (!within) continue;
      sumY += (pixel - x) / width;
      count += 1;
    }
    return sumY / count / height;
  };

  return {
    leftMost: { x: minX / width, y: meanYNear(minX, "min") },
    rightMost: { x: maxX / width, y: meanYNear(maxX, "max") },
  };
}

/**
 * CORNERS FROM TWO SEPARATE EYE MASKS — because "how many regions came back" is
 * a property of the segmenter's mood, not of the face.
 *
 * `cornersFromMask` splits one mask into two eyes by connected components, and
 * on three of six probe renders SAM 3 returned the pair as a SINGLE region, so
 * the reading refused. That refusal is honest — far better than pairing corners
 * across two different eyes — but it left three arms of a factorial
 * "unreadable", and **an unreadable arm is not a failed one.** Scoring it as a
 * miss would be the false-pass asymmetry running backwards, and the hole landed
 * exactly where the engine-versus-vocabulary attribution lives.
 *
 * Asking each side by name removes the question: two masks in, two eyes out, no
 * component analysis to be defeated. The single-mask path stays for callers who
 * genuinely have one region.
 */
export function cornersFromEyeMasks(right: Mask, left: Mask): { outers: Point[]; inners: Point[] } {
  const r = extremesOf(right);
  const l = extremesOf(left);
  /* Her RIGHT eye sits on the image's left, so its outer corner is its leftmost
     point; her LEFT eye's outer corner is its rightmost. Anatomy decides, not
     the order the masks arrived in. */
  return {
    outers: [r.leftMost, l.rightMost],
    inners: [r.rightMost, l.leftMost],
  };
}

export function readingFrom(
  outers: Point[],
  inners: Point[],
  width: number,
  height: number,
): TiltReading {
  const { right, left } = pairCorners(outers, inners);
  const rightDeg = tiltOf(right.outer, right.inner, width, height);
  const leftDeg = tiltOf(left.outer, left.inner, width, height);
  return {
    rightDeg,
    leftDeg,
    meanDeg: (rightDeg + leftDeg) / 2,
    asymmetryDeg: Math.abs(rightDeg - leftDeg),
  };
}

/**
 * The median of several samples, because one sample of a stochastic landmarker
 * is not a measurement — the lesson D-237 had to learn about its own figures.
 *
 * Median rather than mean so a single mislabelled sample moves the answer by
 * nothing rather than by its own size.
 */
export function medianReading(readings: TiltReading[]): TiltReading & { spreadDeg: number } {
  if (readings.length === 0) throw new MaskError("no tilt readings to summarise");
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const means = readings.map((reading) => reading.meanDeg);
  return {
    rightDeg: median(readings.map((reading) => reading.rightDeg)),
    leftDeg: median(readings.map((reading) => reading.leftDeg)),
    meanDeg: median(means),
    asymmetryDeg: median(readings.map((reading) => reading.asymmetryDeg)),
    /** Max minus min across samples — the instrument's own noise, stated. */
    spreadDeg: Math.max(...means) - Math.min(...means),
  };
}

/**
 * THE ALREADY-TRUE THRESHOLD for an upswept ask.
 *
 * Above this, a face's outer corners are ALREADY sitting clearly higher than its
 * inner ones and "give her fox eyes" is asking for a property she has. That is
 * not a render, it is a re-ask — and a free one, like every other member of the
 * refuse-before-dispatch family.
 *
 * Provisional and deliberately generous: a false "she already has it" costs a
 * user a picture they wanted, which is the failure this program has shipped once
 * and does not get to ship again. Calibrated against measured faces before it
 * governs anything, and until then it exists to SELECT probe specimens rather
 * than to refuse anybody.
 */
export const UPSWEPT_ALREADY = 6;

/** Does this face already carry the upswept property an ask is about? */
export function alreadyUpswept(reading: { meanDeg: number }): boolean {
  return reading.meanDeg >= UPSWEPT_ALREADY;
}
