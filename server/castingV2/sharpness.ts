/**
 * HIGH-FREQUENCY ENERGY, per region — the gauntlet's instrument (spec:
 * fable-089, bench B).
 *
 * v2's defect was blur. Six edits deep the founder's own face was visibly soft
 * while every facet-survival instrument read green, because facet instruments
 * ask *is the thing there* and blur does not remove anything. Nothing in this
 * product could measure the disease, which is why it shipped.
 *
 * This is that measurement, and it is deliberately the plainest one that works:
 * the variance of a 3×3 Laplacian over a region. Sharp detail has strong local
 * second derivatives; blurring, re-encoding and resampling all suppress them.
 * A cleverer metric nobody checks would be worse than a simple one everybody
 * can read.
 *
 * # It is a COMPARATIVE instrument, and only that
 *
 * An absolute Laplacian variance means nothing on its own — it depends on the
 * face, the region, the lighting and the crop. Every reading here is a ratio
 * against the same region of the same face at another version, which is the
 * only form in which the number answers a question. `ratioAgainst` exists so no
 * caller has to remember that.
 *
 * # And it must be able to FAIL
 *
 * Working law 2: a metric that cannot report the disease is decoration. The
 * bench's positive control is a deliberately degraded chain that this must read
 * as degraded, and the same control runs in the unit suite — a blurred frame
 * and a six-times re-encoded frame both have to come out below band, or the
 * instrument has not been shown to work at all.
 */
import type { Mask, Raster } from "./maskedComposite";

export type SharpnessReading = {
  /** Variance of the Laplacian response over the region, in level² units. */
  energy: number;
  /** How many pixels it was measured over — a number with no n is not a reading. */
  pixels: number;
};

/** Luma, at the coefficients everything else in this program uses. */
function lumaAt(raster: Raster, pixel: number): number {
  const at = pixel * 3;
  return 0.299 * raster.data[at] + 0.587 * raster.data[at + 1] + 0.114 * raster.data[at + 2];
}

/**
 * Measure one region.
 *
 * Pixels on the region's own edge are skipped rather than clamped: a Laplacian
 * that reaches outside the mask measures the boundary between region and
 * not-region, which is a strong edge that has nothing to do with detail inside
 * it. Clamping instead of skipping is how a mask's outline becomes "sharpness".
 */
export function sharpnessOf(raster: Raster, region: Mask): SharpnessReading {
  if (region.width !== raster.width || region.height !== raster.height) {
    throw new Error(
      `sharpnessOf: region ${region.width}×${region.height} against frame ${raster.width}×${raster.height}`,
    );
  }
  const { width, height } = raster;
  const responses: number[] = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x;
      if (region.data[pixel] === 0) continue;
      /* Every contributing pixel must be inside the region too — see above. */
      if (
        region.data[pixel - 1] === 0 || region.data[pixel + 1] === 0
        || region.data[pixel - width] === 0 || region.data[pixel + width] === 0
      ) {
        continue;
      }
      const response = 4 * lumaAt(raster, pixel)
        - lumaAt(raster, pixel - 1)
        - lumaAt(raster, pixel + 1)
        - lumaAt(raster, pixel - width)
        - lumaAt(raster, pixel + width);
      responses.push(response);
    }
  }

  if (responses.length === 0) return { energy: 0, pixels: 0 };
  const mean = responses.reduce((total, value) => total + value, 0) / responses.length;
  const variance = responses.reduce((total, value) => total + (value - mean) ** 2, 0) / responses.length;
  return { energy: variance, pixels: responses.length };
}

export type SharpnessComparison = {
  ratio: number;
  reference: SharpnessReading;
  subject: SharpnessReading;
  /** Whether the subject holds its reference's detail within the band. */
  withinBand: boolean;
  /** NO-READ: neither frame had enough measurable region to compare. */
  read: boolean;
};

/**
 * The band, and why it is stated rather than tuned.
 *
 * A single JPEG generation or one gentle resample costs roughly a fifth of the
 * Laplacian energy of a region; six of them cost most of it. 0.85 sits below
 * ordinary reading noise on identical content and well above one generation of
 * loss, so it separates "the same pixels" from "the same picture, once
 * photocopied" — which is exactly the distinction v2 needed and did not have.
 */
export const SHARPNESS_BAND = 0.85;

/**
 * Compare a subject region against the same region of a reference frame.
 *
 * A region too small to measure returns `read: false` rather than a ratio.
 * A NO-READ is evidence of nothing, and a ratio computed from four pixels
 * dressed up as a verdict is worse than an honest silence.
 */
export function ratioAgainst(input: {
  reference: Raster;
  subject: Raster;
  region: Mask;
  band?: number;
  /** Fewer measurable pixels than this is a NO-READ. */
  minimumPixels?: number;
}): SharpnessComparison {
  const reference = sharpnessOf(input.reference, input.region);
  const subject = sharpnessOf(input.subject, input.region);
  const minimum = input.minimumPixels ?? 64;
  const band = input.band ?? SHARPNESS_BAND;

  if (reference.pixels < minimum || subject.pixels < minimum || reference.energy === 0) {
    return { ratio: 0, reference, subject, withinBand: false, read: false };
  }
  const ratio = subject.energy / reference.energy;
  return { ratio, reference, subject, withinBand: ratio >= band, read: true };
}
