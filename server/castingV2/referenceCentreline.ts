/**
 * THE LENGTH INSTRUMENT — for the shapes that ARE their own outline.
 *
 * §2.4b established that area cannot judge a hoop: two-thirds of a hoop crop is
 * its own edge, so one pixel of boundary disagreement is worth more than the
 * whole verdict, and `notScorableByArea` says so out loud rather than handing
 * somebody a number to adopt.
 *
 * This is the instrument that CAN judge one, and it measures a different
 * quantity — **length, not area**:
 *
 * ```
 * |dilate(crop, 1) ∩ thin(region)| / |thin(region)|
 * ```
 *
 * How much of the region's own centreline runs within one pixel of the crop. The
 * dilation is not a tolerance knob: it is the one pixel of registration that a
 * second, independent read of the same feature is entitled to disagree by, spent
 * BEFORE the measurement rather than absorbed into it afterwards. The denominator
 * is the region's skeleton, so a ring's reading is a fraction of its
 * circumference and no longer a fraction of its metal.
 *
 * # WHAT IT CATCHES, AND WHAT IT CANNOT — the second one is not a footnote
 *
 * It catches a **missing segment**: an arc of the ring the crop does not hold
 * removes that arc's share of the skeleton, and the reading falls by it.
 *
 * It CANNOT catch **thinning**. On a three-pixel ring, "the ring drawn one pixel
 * thinner all round" and "one pixel of honest reader disagreement" are the same
 * operation — `erode(crop)`, byte for byte — and no instrument can separate a
 * defect from noise when they are the same bytes (opus-170 §3, adopted in
 * fable-228 as the bar's second caveat). A thickness sensor is separate work and
 * is not this. {@link CENTRELINE_BLIND_TO} names the limit in the code so that a
 * reader of the door meets it before they trust a number, and
 * `referenceCentreline.test.ts` DRIVES it: the thin defect and a registration
 * shift land on the same side of the bar, deliberately.
 */
import type { Mask } from "./maskedComposite";
import type { SegmentBox } from "./segmentCuts";

/**
 * The defect class this measure is structurally unable to see, in one string.
 *
 * Named rather than commented because it travels: the guard's refusal detail
 * quotes it, so the person reading a turned-away hoop is told what the
 * instrument that turned it away is blind to, on the same line as the number.
 */
export const CENTRELINE_BLIND_TO = "thinning — on a three-pixel ring it is the same bytes as reader noise";

type Shape = { data: Uint8Array; width: number; height: number };

function blank(width: number, height: number): Shape {
  return { data: new Uint8Array(width * height), width, height };
}

export function shapePixels(shape: { data: Uint8Array | Buffer }): number {
  let total = 0;
  for (let index = 0; index < shape.data.length; index += 1) if (shape.data[index]! > 0) total += 1;
  return total;
}

/**
 * One pixel of 8-connected growth — the registration allowance, spent up front.
 *
 * Applied to the CROP and never to the region: growing the thing being measured
 * is a tolerance, growing the thing it is measured against would be moving the
 * goalposts. The asymmetry is the point, and the shifted-crop control in the
 * test file is what proves the allowance is worth exactly one pixel and not more.
 */
export function dilateOnce(shape: Shape): Shape {
  const out = blank(shape.width, shape.height);
  for (let y = 0; y < shape.height; y += 1) {
    for (let x = 0; x < shape.width; x += 1) {
      if (shape.data[y * shape.width + x]! === 0) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= shape.width || ny >= shape.height) continue;
          out.data[ny * shape.width + nx] = 255;
        }
      }
    }
  }
  return out;
}

/**
 * Zhang–Suen thinning: the shape reduced to a one-pixel skeleton that keeps its
 * topology — a closed ring thins to a closed ring, a solid disc to a small core.
 *
 * Standard and unmodified on purpose. The bar of 97.6% was measured by
 * `scripts/bench-centreline-widen-disposable.mts` with this exact algorithm over
 * the whole frame, so any cleverness here (a bounding-box optimisation, a
 * different neighbour order) would silently move the number the door enforces.
 * If it is ever made faster, the equivalence is a test and not an argument.
 *
 * The iteration guard is a backstop, not a parameter: thinning converges in
 * about half the shape's thickest radius, so a three-pixel ring is done in two.
 */
export function thinToCentreline(shape: Shape): Shape {
  const { width, height } = shape;
  const data = new Uint8Array(shape.data);
  const at = (x: number, y: number) => (
    x < 0 || y < 0 || x >= width || y >= height ? 0 : (data[y * width + x]! > 0 ? 1 : 0)
  );
  let changed = true;
  let passes = 0;
  while (changed && passes < 100) {
    changed = false;
    passes += 1;
    for (const step of [0, 1]) {
      const doomed: number[] = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (at(x, y) === 0) continue;
          /* P2..P9, clockwise from north — the classical numbering. */
          const p = [
            at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1),
            at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1),
          ];
          const neighbours = p.reduce((total, value) => total + value, 0);
          if (neighbours < 2 || neighbours > 6) continue;
          let transitions = 0;
          for (let i = 0; i < 8; i += 1) if (p[i] === 0 && p[(i + 1) % 8] === 1) transitions += 1;
          if (transitions !== 1) continue;
          const [north, east, south, west] = [p[0]!, p[2]!, p[4]!, p[6]!];
          if (step === 0) {
            if (north * east * south !== 0 || east * south * west !== 0) continue;
          } else if (north * east * west !== 0 || north * south * west !== 0) continue;
          doomed.push(y * width + x);
        }
      }
      if (doomed.length === 0) continue;
      changed = true;
      /* Deletions land AFTER the sub-iteration's full scan. Deleting inside it
         would let a pixel's fate depend on its neighbours' fate in the same
         pass, which is how a thinner eats a line it should have kept. */
      for (const index of doomed) data[index] = 0;
    }
  }
  return { data, width, height };
}

export type CentrelineReading = {
  /** `|dilate(crop,1) ∩ thin(region)| / |thin(region)|` — the share of the
   *  region's centreline the crop runs along. */
  coverage: number;
  /** The skeleton's length in pixels. A denominator small enough to be worth
   *  showing: it is what a point of this reading is worth. */
  spinePixels: number;
  coveredPixels: number;
};

/**
 * Score a crop against the centreline of an independent read of its own region.
 *
 * The crop's mask is in its own box's coordinates and the region is the whole
 * frame, exactly as {@link import("./referenceCompleteness").measureCoverage}
 * takes them — the same two arguments, a different question asked of them.
 */
export function measureCentreline(
  crop: { mask: Mask; box: SegmentBox },
  region: Mask,
): CentrelineReading {
  const placed = blank(region.width, region.height);
  for (let y = 0; y < crop.box.height; y += 1) {
    for (let x = 0; x < crop.box.width; x += 1) {
      if (crop.mask.data[y * crop.mask.width + x]! === 0) continue;
      const frameX = crop.box.x + x;
      const frameY = crop.box.y + y;
      if (frameX < 0 || frameY < 0 || frameX >= region.width || frameY >= region.height) continue;
      placed.data[frameY * region.width + frameX] = 255;
    }
  }
  const reach = dilateOnce(placed);
  const spine = thinToCentreline({
    data: new Uint8Array(region.data),
    width: region.width,
    height: region.height,
  });
  let spinePixels = 0;
  let coveredPixels = 0;
  for (let index = 0; index < spine.data.length; index += 1) {
    if (spine.data[index]! === 0) continue;
    spinePixels += 1;
    if (reach.data[index]! > 0) coveredPixels += 1;
  }
  return {
    coverage: spinePixels === 0 ? 0 : coveredPixels / spinePixels,
    spinePixels,
    coveredPixels,
  };
}
