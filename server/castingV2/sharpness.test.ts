import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { ratioAgainst, sharpnessOf, SHARPNESS_BAND } from "./sharpness";
import { readRaster, type Mask, type Raster } from "./maskedComposite";

/**
 * THE INSTRUMENT STANDS TRIAL BEFORE ITS VERDICTS COUNT (working law 2).
 *
 * This metric exists because v2 shipped blurred and every instrument read
 * green. So the first thing it has to prove is not that it approves of a good
 * chain — it is that it can CONDEMN a bad one. The positive controls here are
 * the disease itself: a blurred frame, and a frame photocopied six times.
 *
 * Without them the gauntlet would be decoration, and the last time this program
 * shipped decoration it cost four shifts.
 */

/**
 * A photographic subject, not white noise — and the difference is a finding.
 *
 * The first version of this fixture used pseudo-random noise, and the
 * six-generation photocopy control FAILED: the metric read the copies as
 * 1.03× SHARPER than the original. That is not a bug in the metric, it is a
 * fact about JPEG on incompressible content — the codec cannot preserve random
 * noise, so it substitutes its own blocking and ringing, which is high-frequency
 * energy the Laplacian happily counts.
 *
 * The lesson is the one this program keeps relearning: an instrument must be
 * trialled on the content it will actually measure. Faces are smooth gradients
 * carrying fine texture, so that is what this builds — a soft background with a
 * fine periodic texture and two hard edges, which is what a codec, a blur and a
 * resample all attack.
 */
function photographic(width: number, height: number): Raster {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gradient = 90 + 40 * Math.sin((x + y) * 0.06);
      /* Period ~4px: skin texture, freckles, the strands of a fringe. */
      const texture = 26 * Math.sin(x * 1.6) * Math.cos(y * 1.5);
      const edge = x > width * 0.6 && y > height * 0.3 ? 45 : 0;
      const value = Math.max(0, Math.min(255, Math.round(gradient + texture + edge)));
      const at = (y * width + x) * 3;
      data[at] = value;
      data[at + 1] = value;
      data[at + 2] = value;
    }
  }
  return { data, width, height };
}

function whole(width: number, height: number): Mask {
  return { data: Buffer.alloc(width * height, 255), width, height };
}

async function blurred(raster: Raster, sigma: number): Promise<Raster> {
  const { data, info } = await sharp(raster.data, {
    raw: { width: raster.width, height: raster.height, channels: 3 },
  })
    .blur(sigma)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * The photocopier, in the shape this product can actually suffer: RESAMPLING.
 *
 * Deliberately not JPEG. This pipeline writes PNG end to end, so lossy
 * re-encoding is not a failure mode it has — and the trial below records why
 * that matters more than it sounds.
 *
 * What v2 did was condition each render on the previous FRAME, and a generative
 * model re-reading its own output is a resample with opinions: fine detail
 * softens a little each pass and nothing puts it back. Six generations of
 * shrink-and-restore is the closest honest miniature of that.
 */
async function generations(raster: Raster, passes: number): Promise<Raster> {
  let bytes = await sharp(raster.data, {
    raw: { width: raster.width, height: raster.height, channels: 3 },
  }).png().toBuffer();
  for (let pass = 0; pass < passes; pass += 1) {
    /*
      TWO PIPELINES, and the first attempt at this was ONE — which is a sharp
      pipeline with two `resize` calls, and it only ever applies the last one.
      The "degradation" was a no-op resize back to the original size, the
      control read exactly 1.000, and a control that changes nothing proves
      nothing. Caught only because a ratio of precisely 1 is too clean to be a
      measurement.
    */
    const smaller = await sharp(bytes)
      .resize(Math.round(raster.width * 0.8), Math.round(raster.height * 0.8))
      .png()
      .toBuffer();
    bytes = await sharp(smaller).resize(raster.width, raster.height).png().toBuffer();
  }
  return readRaster(bytes);
}

/** One generation of a LOSSY codec — used only to pin the metric's blind spot. */
async function jpegGenerations(raster: Raster, passes: number): Promise<Raster> {
  let bytes = await sharp(raster.data, {
    raw: { width: raster.width, height: raster.height, channels: 3 },
  }).jpeg({ quality: 80 }).toBuffer();
  for (let pass = 1; pass < passes; pass += 1) {
    bytes = await sharp(bytes).jpeg({ quality: 80 }).toBuffer();
  }
  return readRaster(bytes);
}

const FRAME = { width: 64, height: 64 };
const master = photographic(FRAME.width, FRAME.height);
const region = whole(FRAME.width, FRAME.height);

describe("the metric's own trial", () => {
  it("NEGATIVE CONTROL: identical pixels read as identical detail", async () => {
    const same = ratioAgainst({ reference: master, subject: { ...master, data: Buffer.from(master.data) }, region });
    expect(same.read).toBe(true);
    expect(same.ratio).toBe(1);
    expect(same.withinBand).toBe(true);
  });

  it("POSITIVE CONTROL: a blurred frame reads DEGRADED", async () => {
    // The disease itself. If this passes the band, the gauntlet is decoration.
    const soft = await blurred(master, 1.2);
    const reading = ratioAgainst({ reference: master, subject: soft, region });
    expect(reading.read).toBe(true);
    expect(reading.ratio).toBeLessThan(SHARPNESS_BAND);
    expect(reading.withinBand).toBe(false);
  });

  it("POSITIVE CONTROL: six generations of resampling read DEGRADED", async () => {
    // The v2 shape, in miniature: each generation re-reads the last one's
    // pixels, and the loss accumulates where no facet instrument looks.
    const sixth = await generations(master, 6);
    const reading = ratioAgainst({ reference: master, subject: sixth, region });
    expect(reading.read).toBe(true);
    expect(reading.ratio).toBeLessThan(SHARPNESS_BAND);
  });

  it("ORDERS the disease: six generations are worse than one", async () => {
    const first = await generations(master, 1);
    const sixth = await generations(master, 6);
    const one = ratioAgainst({ reference: master, subject: first, region });
    const six = ratioAgainst({ reference: master, subject: sixth, region });
    // A metric that fires but cannot rank is a smoke alarm with no direction.
    expect(six.ratio).toBeLessThan(one.ratio);
  });

  it("BLIND SPOT, pinned: lossy compression can read as MORE detail, not less", async () => {
    /*
      FOUND BY THIS TRIAL, and it is why the control above is a resample.

      Six JPEG generations came out reading 1.1× SHARPER than the original.
      That is not a bug: a codec cannot preserve fine texture, so it
      substitutes blocking and ringing, and those are high-frequency energy the
      Laplacian counts happily. An instrument fooled in the FLATTERING
      direction is the dangerous kind — it would certify a degraded chain.

      The product writes PNG end to end, so this is a limit rather than a hole.
      It is pinned here so nobody later "strengthens" the gauntlet by adding a
      lossy step to it and reads the resulting number as good news.
    */
    const compressed = await jpegGenerations(master, 6);
    const reading = ratioAgainst({ reference: master, subject: compressed, region });
    expect(reading.ratio).toBeGreaterThan(1);
  });

  it("does not condemn a change that is not a LOSS of detail", async () => {
    /*
      The false-positive direction, and it matters: an edit legitimately
      changes pixels. Brightening every pixel by a constant changes the picture
      and destroys no detail, and a metric that called that "blur" would refuse
      real renders.
    */
    const brighter: Raster = {
      ...master,
      data: Buffer.from(master.data.map((value) => Math.min(255, value + 20))),
    };
    const reading = ratioAgainst({ reference: master, subject: brighter, region });
    expect(reading.withinBand).toBe(true);
  });
});

describe("what it refuses to measure", () => {
  it("skips the region's own edge rather than measuring its outline", () => {
    /*
      A Laplacian that reaches outside the mask measures the boundary between
      region and not-region — a strong edge with nothing to do with the detail
      inside it. Clamping instead of skipping is how a mask's outline becomes
      "sharpness", and a flat region would then read sharp.
    */
    const flat: Raster = { data: Buffer.alloc(64 * 64 * 3, 128), width: 64, height: 64 };
    const patch: Mask = { data: Buffer.alloc(64 * 64), width: 64, height: 64 };
    for (let y = 20; y < 40; y += 1) for (let x = 20; x < 40; x += 1) patch.data[y * 64 + x] = 255;

    const reading = sharpnessOf(flat, patch);
    expect(reading.energy).toBe(0);
    // 20×20 claimed, minus the one-pixel skin the kernel cannot reach.
    expect(reading.pixels).toBe(18 * 18);
  });

  it("answers NO-READ rather than a ratio when there is too little to measure", () => {
    const tiny: Mask = { data: Buffer.alloc(64 * 64), width: 64, height: 64 };
    for (let y = 10; y < 13; y += 1) for (let x = 10; x < 13; x += 1) tiny.data[y * 64 + x] = 255;

    const reading = ratioAgainst({ reference: master, subject: master, region: tiny });
    // A ratio computed from a handful of pixels, dressed as a verdict, is worse
    // than an honest silence.
    expect(reading.read).toBe(false);
    expect(reading.withinBand).toBe(false);
  });

  it("refuses a region that does not match the frame", () => {
    expect(() => sharpnessOf(master, whole(8, 8))).toThrow(/against frame/);
  });
});
