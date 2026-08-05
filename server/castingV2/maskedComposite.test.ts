import { describe, expect, it } from "vitest";

import {
  CompositeError,
  compositeMasked,
  featherMask,
  outsideMaskUnchanged,
  readRaster,
  seamBand,
  writePng,
  type Mask,
  type Raster,
} from "./maskedComposite";

/**
 * THE ARITHMETIC THAT REPLACES THE JUDGE.
 *
 * These tests are deliberately synthetic and provider-free: the whole claim of
 * the masked workstream is that outside-the-mask consistency is *decidable*, so
 * it must be decidable here, in milliseconds, without spending a credit or
 * asking a model anything.
 *
 * The adversary in each case is a patch that has been redrawn EVERYWHERE — the
 * exact failure mode the founder's walk produced, where a freckles edit replaced
 * a hairstyle. If the composite still comes back byte-identical outside the
 * mask against a patch that changed every pixel, the guarantee is real.
 */

function solid(width: number, height: number, rgb: [number, number, number]): Raster {
  const data = Buffer.allocUnsafe(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    data[pixel * 3] = rgb[0];
    data[pixel * 3 + 1] = rgb[1];
    data[pixel * 3 + 2] = rgb[2];
  }
  return { data, width, height };
}

/** A hard rectangular mask — 255 inside, 0 everywhere else. */
function rect(width: number, height: number, box: {
  left: number; top: number; right: number; bottom: number;
}): Mask {
  const data = Buffer.alloc(width * height, 0);
  for (let y = box.top; y < box.bottom; y += 1) {
    for (let x = box.left; x < box.right; x += 1) data[y * width + x] = 255;
  }
  return { data, width, height };
}

const W = 32;
const H = 32;

describe("the composite takes only what the mask allows", () => {
  it("is byte-identical outside the mask, against a patch that redrew everything", async () => {
    const master = solid(W, H, [10, 20, 30]);
    /* The walk's failure mode: the model returned a completely different frame. */
    const patch = solid(W, H, [200, 100, 50]);
    const mask = rect(W, H, { left: 8, top: 8, right: 16, bottom: 16 });

    const { composite, applied } = await compositeMasked({ master, patch, mask });
    const verdict = outsideMaskUnchanged(master, composite, applied);

    expect(verdict.identical).toBe(true);
    expect(verdict.changedPixels).toBe(0);
  });

  it("does take the patch inside the mask, or it edited nothing", async () => {
    const master = solid(W, H, [10, 20, 30]);
    const patch = solid(W, H, [200, 100, 50]);
    const mask = rect(W, H, { left: 8, top: 8, right: 16, bottom: 16 });

    const { composite } = await compositeMasked({ master, patch, mask });
    const inside = (12 * W + 12) * 3;
    expect([composite.data[inside], composite.data[inside + 1], composite.data[inside + 2]])
      .toEqual([200, 100, 50]);
  });

  it("counts a masked region of exactly the size asked for", async () => {
    const master = solid(W, H, [10, 20, 30]);
    const patch = solid(W, H, [200, 100, 50]);
    const mask = rect(W, H, { left: 8, top: 8, right: 16, bottom: 16 });

    const { composite, applied } = await compositeMasked({ master, patch, mask });
    let changed = 0;
    for (let pixel = 0; pixel < W * H; pixel += 1) {
      if (composite.data[pixel * 3] !== master.data[pixel * 3]) changed += 1;
    }
    expect(changed).toBe(64);
    expect(outsideMaskUnchanged(master, composite, applied).bandPixels).toBe(0);
  });
});

describe("the feather is honest about where the guarantee stops", () => {
  it("still guarantees byte-identity wherever the feathered mask is zero", async () => {
    const master = solid(W, H, [10, 20, 30]);
    const patch = solid(W, H, [200, 100, 50]);
    const mask = rect(W, H, { left: 12, top: 12, right: 20, bottom: 20 });

    const { composite, applied } = await compositeMasked({
      master, patch, mask, featherRadius: 3,
    });
    const verdict = outsideMaskUnchanged(master, composite, applied);

    /* The band exists — that is the point of feathering — and OUTSIDE it
       nothing moved by a single byte. Both halves must hold, or the claim is
       either false or vacuous. */
    expect(verdict.bandPixels).toBeGreaterThan(0);
    expect(verdict.identical).toBe(true);
  });

  it("blends rather than cuts, so the band is not a step", async () => {
    const master = solid(W, H, [0, 0, 0]);
    const patch = solid(W, H, [255, 255, 255]);
    const mask = rect(W, H, { left: 12, top: 12, right: 20, bottom: 20 });

    const { composite, applied } = await compositeMasked({
      master, patch, mask, featherRadius: 3,
    });

    const values = new Set<number>();
    for (let pixel = 0; pixel < W * H; pixel += 1) {
      if (applied.data[pixel] !== 0 && applied.data[pixel] !== 255) {
        values.add(composite.data[pixel * 3]);
      }
    }
    /* A cut-out would produce only 0 and 255 in the band. A ramp produces
       intermediate levels, which is what makes a seam invisible. */
    expect(values.size).toBeGreaterThan(2);
  });

  it("scores the seam as the work the blend had to do", async () => {
    const master = solid(W, H, [0, 0, 0]);
    const mask = rect(W, H, { left: 12, top: 12, right: 20, bottom: 20 });

    const matched = await compositeMasked({
      master, patch: solid(W, H, [2, 2, 2]), mask, featherRadius: 3,
    });
    const mismatched = await compositeMasked({
      master, patch: solid(W, H, [255, 255, 255]), mask, featherRadius: 3,
    });

    const easy = seamBand(master, matched.composite, matched.applied);
    const hard = seamBand(master, mismatched.composite, mismatched.applied);

    /* A patch that already matched its surroundings barely moves the band; one
       that does not forces the feather to hide a real discontinuity. That gap
       IS seam quality, and it is a number rather than an opinion. */
    expect(hard.meanDelta).toBeGreaterThan(easy.meanDelta * 10);
    expect(easy.maxDelta).toBeLessThan(5);
  });
});

describe("dimensions and format are part of the promise", () => {
  it("refuses a patch that came back a different size rather than scaling it", async () => {
    await expect(compositeMasked({
      master: solid(W, H, [10, 20, 30]),
      patch: solid(W / 2, H, [200, 100, 50]),
      mask: rect(W, H, { left: 8, top: 8, right: 16, bottom: 16 }),
    })).rejects.toBeInstanceOf(CompositeError);
  });

  it("refuses a mask that does not fit the master", async () => {
    await expect(compositeMasked({
      master: solid(W, H, [10, 20, 30]),
      patch: solid(W, H, [200, 100, 50]),
      mask: rect(W, H / 2, { left: 2, top: 2, right: 6, bottom: 6 }),
    })).rejects.toBeInstanceOf(CompositeError);
  });

  it("round-trips through PNG without changing a byte", async () => {
    /* The master stays lossless across an arbitrary number of edits, or the
       session accumulates re-encoding loss underneath everything else. */
    const master = solid(W, H, [37, 111, 200]);
    const again = await readRaster(await writePng(master));
    expect(Buffer.compare(again.data, master.data)).toBe(0);
    expect([again.width, again.height]).toEqual([W, H]);
  });

  it("survives ten round-trips, which one round-trip cannot prove", async () => {
    let raster = solid(W, H, [37, 111, 200]);
    for (let pass = 0; pass < 10; pass += 1) raster = await readRaster(await writePng(raster));
    expect(Buffer.compare(raster.data, solid(W, H, [37, 111, 200]).data)).toBe(0);
  });
});

describe("featherMask", () => {
  it("leaves a hard mask alone at radius zero", async () => {
    const mask = rect(W, H, { left: 8, top: 8, right: 16, bottom: 16 });
    expect(await featherMask(mask, 0)).toBe(mask);
  });

  /*
    THE NEAR-MISS THAT PASSED, AND WHY IT IS PINNED.

    The feather originally came back from sharp as THREE channels. Every loop
    here walks the mask one byte per pixel, so it ran three times too far, read
    `undefined` past the end of the raster, and — because every comparison
    against `undefined` is false — reported byte-identity for two thirds of a
    buffer it had never looked at. The suite was green.

    A guarantee that passes by reading nothing is worse than no guarantee. These
    two tests are the ones that would have caught it.
  */
  it("returns exactly one byte per pixel", async () => {
    const mask = rect(W, H, { left: 8, top: 8, right: 16, bottom: 16 });
    const feathered = await featherMask(mask, 3);
    expect(feathered.data.length).toBe(W * H);
  });

  it("refuses a multi-channel mask rather than walking off the end of it", async () => {
    const threeChannel: Mask = {
      data: Buffer.alloc(W * H * 3, 255),
      width: W,
      height: H,
    };
    await expect(compositeMasked({
      master: solid(W, H, [10, 20, 30]),
      patch: solid(W, H, [200, 100, 50]),
      mask: threeChannel,
    })).rejects.toThrow(/single-channel/);
  });
});
