/**
 * THE COMPOSITE, AND THE ARITHMETIC THAT REPLACES THE JUDGE.
 *
 * # Why this module is the workstream's foundation
 *
 * Everything this program has fought for a week — drift, unreliable readers,
 * retries, second opinions, majorities of three — exists because we could only
 * ever ASK whether the picture changed outside the region we meant to edit. A
 * vision model was the only instrument, and D-199 and D-203 measured what that
 * instrument is worth: it disagrees with itself, and it cannot tell a clarity
 * pass from a repaint.
 *
 * **Once our code owns the composite, outside-the-mask consistency stops being
 * a judgement and becomes subtraction.** The model returns a whole frame; we
 * take only the pixels inside the mask and put them into an otherwise untouched
 * master. What happened outside is then not a question for a reader — it is
 * `Buffer.compare`, and it answers in bytes.
 *
 * # Why the model's own mask is not enough
 *
 * OpenAI's own documentation, quoted in the founder's research
 * (`docs/specs/masked-editing/RESEARCH_repeated-refinement-editors_manus_2026-08-05.md`):
 *
 *   > "Masking with GPT Image is entirely prompt-based. The model uses the mask
 *   > as guidance, but may not follow its exact shape with complete precision."
 *
 * A model mask is documented GUIDANCE. A boundary that the other side is free to
 * cross is not a boundary, and building on one would be invariant 7's failure in
 * a new costume: a control that looks invoked and is not. So the mask is sent to
 * the model to shape its attention, and enforced HERE, where it is arithmetic.
 *
 * # The feather, and the one place the guarantee is exact
 *
 * A hard mask edge reads as a cut-out. The mask is therefore feathered, and
 * inside the feathered band the output is a blend — which by definition is not
 * byte-identical to the master. So the promise is stated precisely:
 *
 *   **Where the feathered mask is fully zero, the output is byte-identical to
 *   the master.** Not approximately, not perceptually — identical.
 *
 * The band between is where seam honesty lives, and it is measured rather than
 * asserted (`seamBand`). Calling the whole frame "unchanged" while a blend band
 * exists would be exactly the overclaim D-202 named.
 */
import sharp from "sharp";

export type Raster = {
  /** Raw RGB, three bytes per pixel, no alpha — the master is opaque. */
  data: Buffer;
  width: number;
  height: number;
};

/** A mask is one byte per pixel: 0 keeps the master, 255 takes the patch. */
export type Mask = {
  data: Buffer;
  width: number;
  height: number;
};

export class CompositeError extends Error {}

/**
 * Read a PNG into raw RGB at its own resolution.
 *
 * **No resizing, ever.** §5 of the research is explicit that repeated resolution
 * conversion adds resampling loss on top of the model's own errors, and a
 * silent resample here would put a lossy step inside the one path that promises
 * to be lossless.
 */
export async function readRaster(bytes: Buffer): Promise<Raster> {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Write raw RGB back out as lossless PNG at the same size. */
export async function writePng(raster: Raster): Promise<Buffer> {
  return sharp(raster.data, {
    raw: { width: raster.width, height: raster.height, channels: 3 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Feather a hard mask into a blend ramp.
 *
 * Gaussian rather than a box blur because a box blur leaves a visible straight
 * shoulder on curved edges — a jaw or a lens rim is exactly where that shows.
 */
export async function featherMask(mask: Mask, radius: number): Promise<Mask> {
  if (radius <= 0) return mask;
  const { data, info } = await sharp(mask.data, {
    raw: { width: mask.width, height: mask.height, channels: 1 },
  })
    .blur(radius)
    /*
      ONE CHANNEL OUT, EXPLICITLY — sharp promoted the blurred mask to three,
      and the loops that walk `mask.data` one byte per pixel then ran three
      times too far, reading past the raster into `undefined`. Every comparison
      against `undefined` is false, so the outside-the-mask check reported
      byte-identity for two thirds of a buffer it had never looked at.

      **A guarantee that passes by reading nothing is worse than no guarantee**,
      and this is precisely the class D-202 named: a claim that looked verified
      and was not. Forced here, and re-checked in `assertSameShape` so the same
      mistake cannot arrive from a different direction.
    */
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function assertSameShape(master: Raster, patch: Raster, mask: Mask): void {
  /*
    DIMENSIONS ARE PART OF THE PROMISE, not a detail. The acceptance test
    requires the image's dimensions and format to stay constant across a whole
    session, so a patch that came back at a different size is a failed edit
    rather than something to scale into place — scaling it would smuggle the
    resample this module exists to avoid.
  */
  if (patch.width !== master.width || patch.height !== master.height) {
    throw new CompositeError(
      `patch is ${patch.width}x${patch.height}, master is ${master.width}x${master.height}`,
    );
  }
  if (mask.width !== master.width || mask.height !== master.height) {
    throw new CompositeError("mask does not match the master's dimensions");
  }
  /*
    ONE BYTE PER PIXEL, PROVEN RATHER THAN ASSUMED. Every loop in this module
    walks the mask one byte at a time and indexes the raster at `pixel * 3`; a
    mask carrying three channels would run three times too far, read `undefined`
    past the end, and report byte-identity for pixels it never compared. That
    actually happened, silently, and the tests passed. It cannot happen again
    without this throwing first.
  */
  if (mask.data.length !== mask.width * mask.height) {
    throw new CompositeError(
      `mask must be single-channel: ${mask.data.length} bytes for `
      + `${mask.width}x${mask.height} pixels`,
    );
  }
  if (master.data.length !== master.width * master.height * 3) {
    throw new CompositeError("master must be three-channel RGB");
  }
}

/**
 * The master, with only the masked pixels taken from the patch.
 *
 * Returned alongside the mask actually used, because the caller needs the
 * FEATHERED mask to state the guarantee — the hard mask it passed in is not the
 * one the arithmetic ran on.
 */
export async function compositeMasked(input: {
  master: Raster;
  patch: Raster;
  mask: Mask;
  featherRadius?: number;
}): Promise<{ composite: Raster; applied: Mask }> {
  const { master, patch } = input;
  const applied = await featherMask(input.mask, input.featherRadius ?? 0);
  assertSameShape(master, patch, applied);

  const out = Buffer.allocUnsafe(master.data.length);
  for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
    const alpha = applied.data[pixel];
    const at = pixel * 3;
    if (alpha === 0) {
      /*
        THE EXACT PATH, and it is exact on purpose. A blend of alpha=0 would
        round-trip through arithmetic and could land a byte off; copying is what
        makes "byte-identical" true rather than nearly true.
      */
      out[at] = master.data[at];
      out[at + 1] = master.data[at + 1];
      out[at + 2] = master.data[at + 2];
      continue;
    }
    if (alpha === 255) {
      out[at] = patch.data[at];
      out[at + 1] = patch.data[at + 1];
      out[at + 2] = patch.data[at + 2];
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      const index = at + channel;
      out[index] = Math.round(
        (master.data[index] * (255 - alpha) + patch.data[index] * alpha) / 255,
      );
    }
  }
  return {
    composite: { data: out, width: master.width, height: master.height },
    applied,
  };
}

export type OutsideVerdict = {
  /** True when every fully-unmasked pixel is byte-identical to the master. */
  identical: boolean;
  /** How many fully-unmasked pixels differ. Zero, or the edit is rejected. */
  changedPixels: number;
  /** Pixels in the feather band — blended by design, never counted as damage. */
  bandPixels: number;
};

/**
 * THE PROOF. Not a reader, not a score — a comparison.
 *
 * This is what the verification net's outside-the-mask half becomes. The net
 * still asks a vision model whether the EDIT happened (a presence question with
 * a real answer, per D-203's scope note), but whether anything else moved is
 * settled here, in bytes, for free, every time.
 */
export function outsideMaskUnchanged(
  master: Raster,
  composite: Raster,
  applied: Mask,
): OutsideVerdict {
  let changedPixels = 0;
  let bandPixels = 0;
  for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
    const alpha = applied.data[pixel];
    if (alpha === 255) continue;
    if (alpha !== 0) { bandPixels += 1; continue; }
    const at = pixel * 3;
    if (
      composite.data[at] !== master.data[at]
      || composite.data[at + 1] !== master.data[at + 1]
      || composite.data[at + 2] !== master.data[at + 2]
    ) changedPixels += 1;
  }
  return { identical: changedPixels === 0, changedPixels, bandPixels };
}

/**
 * How hard the seam works — the number the founder asked to score.
 *
 * Mean absolute difference between the composite and the master, measured ONLY
 * in the feather band. A low figure means the patch met the master already and
 * the feather merely tidied it; a high one means the feather is hiding a real
 * discontinuity, which is what a visible seam is. Reported per channel-byte on
 * the 0–255 scale so it reads as "how many levels does the blend have to move".
 */
export function seamBand(
  master: Raster,
  composite: Raster,
  applied: Mask,
): { meanDelta: number; maxDelta: number; pixels: number } {
  let total = 0;
  let max = 0;
  let pixels = 0;
  for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
    const alpha = applied.data[pixel];
    if (alpha === 0 || alpha === 255) continue;
    const at = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(composite.data[at + channel] - master.data[at + channel]);
      total += delta;
      if (delta > max) max = delta;
    }
    pixels += 1;
  }
  return { meanDelta: pixels ? total / (pixels * 3) : 0, maxDelta: max, pixels };
}
