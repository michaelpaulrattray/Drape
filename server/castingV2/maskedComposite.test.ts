import { describe, expect, it } from "vitest";

import {
  CompositeError,
  adoptInteraction,
  differenceMatte,
  harvestGate,
  suppressWash,
  compositeMasked,
  featherMask,
  harmonizeSeam,
  matchGrain,
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

describe("the finish pass — grain, tone and the edge that belongs to the paint", () => {
  const W = 40;
  const H = 40;
  const box = { left: 10, top: 10, right: 30, bottom: 30 };

  it("closes a tonal whisper at the boundary", () => {
    /*
      The founder's forehead line: repainted skin a few levels off master skin.
      Feathering cannot hide that — it only makes the line soft — so the band has
      to move TONE.
    */
    const master = solid(W, H, [180, 150, 140]);
    const patch = solid(W, H, [174, 144, 134]);
    const mask = rect(W, H, box);
    const fixed = harmonizeSeam({ master, patch, mask, bandPx: 6 });

    const at = (raster: Raster, x: number, y: number) => raster.data[(y * W + x) * 3];
    /* At the boundary the patch should now agree with the master. */
    expect(Math.abs(at(fixed, 11, 11) - at(master, 11, 11))).toBeLessThanOrEqual(1);
    /* Deep inside, the edit's own tone survives — the band fades inward. */
    expect(at(fixed, 20, 20)).toBeLessThan(at(master, 20, 20));
  });

  it("leaves a real content change alone instead of greying it", () => {
    /*
      THE COUNTER-CASE, and the reason the correction is self-limiting. At a hair
      silhouette the master is background and the patch is hair: they are MEANT
      to differ. A correction that dragged one toward the other would grey the
      hairline, turning a fix for skin into a defect on hair.
    */
    const master = solid(W, H, [240, 240, 240]);
    const patch = solid(W, H, [30, 25, 20]);
    const mask = rect(W, H, box);
    const fixed = harmonizeSeam({ master, patch, mask, bandPx: 6 });
    expect(Buffer.compare(fixed.data, patch.data)).toBe(0);
  });

  it("adds the master's grain amplitude without importing its content", () => {
    /* A noisy master and a perfectly smooth patch — the generated-image case. */
    const master = solid(W, H, [128, 128, 128]);
    for (let pixel = 0; pixel < W * H; pixel += 1) {
      const jitter = pixel % 2 === 0 ? 14 : -14;
      for (let channel = 0; channel < 3; channel += 1) master.data[pixel * 3 + channel] = 128 + jitter;
    }
    const patch = solid(W, H, [128, 128, 128]);
    const mask = rect(W, H, box);
    const grained = matchGrain({ master, patch, mask, ringPx: 4 });

    let moved = 0;
    for (let y = box.top; y < box.bottom; y += 1) {
      for (let x = box.left; x < box.right; x += 1) {
        if (grained.data[(y * W + x) * 3] !== 128) moved += 1;
      }
    }
    expect(moved, "a smooth patch should gain grain").toBeGreaterThan(0);

    /* OUTSIDE the mask nothing may move — grain is not an excuse to touch the
       master, and the byte-identity guarantee still governs. */
    for (let x = 0; x < 5; x += 1) {
      expect(grained.data[(2 * W + x) * 3]).toBe(patch.data[(2 * W + x) * 3]);
    }
  });

  it("never smooths a patch that is already grainier than the master", () => {
    /* The other direction: inventing a cleanliness the photograph lacks would be
       the same sin as smoothing, which is what this workstream exists to avoid. */
    const master = solid(W, H, [128, 128, 128]);
    const patch = solid(W, H, [128, 128, 128]);
    for (let pixel = 0; pixel < W * H; pixel += 1) {
      const jitter = pixel % 2 === 0 ? 20 : -20;
      for (let channel = 0; channel < 3; channel += 1) patch.data[pixel * 3 + channel] = 128 + jitter;
    }
    const grained = matchGrain({ master, patch, mask: rect(W, H, box), ringPx: 4 });
    expect(Buffer.compare(grained.data, patch.data)).toBe(0);
  });

  it("is deterministic — the same edit twice is the same bytes", () => {
    const master = solid(W, H, [128, 128, 128]);
    for (let pixel = 0; pixel < W * H; pixel += 1) {
      master.data[pixel * 3] = 128 + (pixel % 2 === 0 ? 14 : -14);
    }
    const patch = solid(W, H, [128, 128, 128]);
    const mask = rect(W, H, box);
    const first = matchGrain({ master, patch, mask, ringPx: 4 });
    const second = matchGrain({ master, patch, mask, ringPx: 4 });
    expect(Buffer.compare(first.data, second.data)).toBe(0);
  });

  it("takes the visible edge from the paint's matte, not the zone's ramp", async () => {
    /*
      The afro halo. The zone is a generous box; the paint's matte is a smaller,
      SOFT shape inside it. The blend must follow the matte — so a pixel inside
      the zone but outside the matte keeps the master exactly, and the matte's
      own ramp is what appears in between.
    */
    const master = solid(W, H, [240, 240, 240]);
    const patch = solid(W, H, [20, 20, 20]);
    const zone = rect(W, H, box);
    const matte: Mask = { data: Buffer.alloc(W * H, 0), width: W, height: H };
    for (let y = 14; y < 26; y += 1) {
      for (let x = 14; x < 26; x += 1) matte.data[y * W + x] = 255;
    }
    /* One soft rim pixel, which is the whole point of a matte. */
    for (let x = 14; x < 26; x += 1) matte.data[13 * W + x] = 128;

    const { composite, applied } = await compositeMasked({ master, patch, mask: zone, edgeMatte: matte });
    /* Inside the zone, outside the matte: untouched. */
    expect(composite.data[(11 * W + 11) * 3]).toBe(240);
    /* Inside the matte: fully painted. */
    expect(composite.data[(20 * W + 20) * 3]).toBe(20);
    /* The rim blends, and it is the MATTE's value that governs. */
    expect(applied.data[13 * W + 20]).toBe(128);
    expect(composite.data[(13 * W + 20) * 3]).toBeGreaterThan(20);
    expect(composite.data[(13 * W + 20) * 3]).toBeLessThan(240);
  });

  it("still feathers the zone's own boundary where the matte knows nothing about it", async () => {
    /*
      THE DEFECT THIS TEST EXISTS FOR, found by looking at the picture rather
      than the number.

      The first version REFUSED a feather beside a matte, reasoning that
      feathering the bound would put the uniform ramp back under the matte. That
      is true at the outer silhouette and false everywhere else: a subject matte
      is uniformly opaque across the person, so where the ZONE's own boundary
      runs through the subject — the face carve-out — the matte carries no edge
      at all. With the feather refused, that boundary composited hard and the
      afro fix arrived with a cut-out edge around the forehead.

      Here the matte is opaque across the whole strip, so it can contribute
      nothing; the zone's feather must still produce a ramp.
    */
    const master = solid(W, H, [240, 240, 240]);
    const patch = solid(W, H, [20, 20, 20]);
    const zone = rect(W, H, box);
    const opaqueEverywhere: Mask = { data: Buffer.alloc(W * H, 255), width: W, height: H };

    const { applied } = await compositeMasked({
      master, patch, mask: zone, edgeMatte: opaqueEverywhere, featherRadius: 3,
    });
    let ramp = 0;
    for (let pixel = 0; pixel < applied.data.length; pixel += 1) {
      if (applied.data[pixel] > 0 && applied.data[pixel] < 255) ramp += 1;
    }
    expect(ramp, "the zone's boundary must still blend").toBeGreaterThan(0);
  });

  it("lets the matte win where it does know the boundary", async () => {
    /* The counter-case: where the matte is 0 inside a generous zone, nothing is
       painted — the zone is a bound, not the edge. */
    const master = solid(W, H, [240, 240, 240]);
    const patch = solid(W, H, [20, 20, 20]);
    const zone = rect(W, H, box);
    const matte = rect(W, H, { left: 14, top: 14, right: 26, bottom: 26 });
    const { composite } = await compositeMasked({
      master, patch, mask: zone, edgeMatte: matte, featherRadius: 1,
    });
    expect(composite.data[(11 * W + 11) * 3], "inside the zone, outside the matte").toBe(240);
    expect(composite.data[(20 * W + 20) * 3], "inside both").toBe(20);
  });
});

describe("grain is measured per neighbourhood, not once for the whole zone", () => {
  /*
    THE DEFECT THIS REPLACES. One amplitude for a zone holding both smooth skin
    and a busy hair edge over-serves whichever half it did not measure — it
    measured the busy half and speckled the skin, visible at 100% zoom on the
    founder's exhibit.

    Left half of the frame: a NOISY master beside a smooth patch — needs grain.
    Right half: a SMOOTH master beside a smooth patch — needs none. A global
    amplitude cannot produce both answers; a local one must.
  */
  const W = 128;
  const H = 64;

  it("adds grain where the master is noisy and none where it is smooth", () => {
    const master = solid(W, H, [128, 128, 128]);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W / 2; x += 1) {
        const jitter = (x + y) % 2 === 0 ? 16 : -16;
        for (let channel = 0; channel < 3; channel += 1) master.data[(y * W + x) * 3 + channel] = 128 + jitter;
      }
    }
    const patch = solid(W, H, [128, 128, 128]);
    /* A band across both halves, so one mask spans both neighbourhoods. */
    const mask: Mask = { data: Buffer.alloc(W * H, 0), width: W, height: H };
    for (let y = 20; y < 44; y += 1) for (let x = 0; x < W; x += 1) mask.data[y * W + x] = 255;

    const grained = matchGrain({ master, patch, mask });

    const moved = (fromX: number, toX: number) => {
      let count = 0;
      for (let y = 20; y < 44; y += 1) {
        for (let x = fromX; x < toX; x += 1) if (grained.data[(y * W + x) * 3] !== 128) count += 1;
      }
      return count;
    };
    expect(moved(4, 56), "the noisy side should gain grain").toBeGreaterThan(0);
    expect(moved(72, 124), "the smooth side should not").toBe(0);
  });
});

describe("the interaction band — the sticker effect, and the room to blend", () => {
  const SIZE = 64;
  const solidRaster = (rgb: [number, number, number]): Raster => {
    const data = Buffer.allocUnsafe(SIZE * SIZE * 3);
    for (let pixel = 0; pixel < SIZE * SIZE; pixel += 1) {
      data[pixel * 3] = rgb[0];
      data[pixel * 3 + 1] = rgb[1];
      data[pixel * 3 + 2] = rgb[2];
    }
    return { data, width: SIZE, height: SIZE };
  };
  const box = (from: { x: number; y: number }, to: { x: number; y: number }, fill = 255): Mask => {
    const data = Buffer.alloc(SIZE * SIZE, 0);
    for (let y = from.y; y < to.y; y += 1) for (let x = from.x; x < to.x; x += 1) data[y * SIZE + x] = fill;
    return { data, width: SIZE, height: SIZE };
  };
  const at = (raster: Raster, x: number, y: number) => {
    const index = (y * SIZE + x) * 3;
    return [raster.data[index], raster.data[index + 1], raster.data[index + 2]];
  };

  /* An object across the top, and a master that is a plain mid-grey wall. */
  const harvest = box({ x: 20, y: 8 }, { x: 44, y: 24 });
  const master = solidRaster([160, 160, 160]);

  /**
   * A painter's answer: the object, a genuine CONTACT SHADOW just beneath it,
   * a faint everywhere-drift, and one distant patch it recoloured for no reason.
   */
  const painter = (() => {
    const data = Buffer.from(master.data);
    /* the everywhere-drift: the painter repaints the whole frame slightly */
    for (let pixel = 0; pixel < SIZE * SIZE; pixel += 1) {
      const at3 = pixel * 3;
      for (let channel = 0; channel < 3; channel += 1) data[at3 + channel] = 162;
    }
    /* the object itself */
    for (let y = 8; y < 24; y += 1) for (let x = 20; x < 44; x += 1) {
      const at3 = (y * SIZE + x) * 3;
      data[at3] = 40; data[at3 + 1] = 30; data[at3 + 2] = 25;
    }
    /* the contact shadow: a darkening band under the object, neutral */
    for (let y = 24; y < 30; y += 1) for (let x = 20; x < 44; x += 1) {
      const at3 = (y * SIZE + x) * 3;
      data[at3] = 96; data[at3 + 1] = 96; data[at3 + 2] = 96;
    }
    /* a distant repaint the band must NOT reach */
    for (let y = 52; y < 60; y += 1) for (let x = 4; x < 16; x += 1) {
      const at3 = (y * SIZE + x) * 3;
      data[at3] = 20; data[at3 + 1] = 200; data[at3 + 2] = 40;
    }
    return { data, width: SIZE, height: SIZE };
  })();

  it("adopts the contact shadow the strict harvest threw away", () => {
    const strict = adoptInteraction({
      master, patch: painter, harvest, bandPx: 8, mode: "interaction",
    });
    expect(strict.alpha.data[26 * SIZE + 32], "the shadow under the object is adopted").toBeGreaterThan(0);
  });

  it("leaves the distant repaint to die — the control", () => {
    /* Without this, "adopts the shadow" could be satisfied by adopting
       everything, which is the whole-frame repaint the workstream exists to
       prevent. The green patch is far from any confirmed content. */
    const strict = adoptInteraction({
      master, patch: painter, harvest, bandPx: 8, mode: "interaction",
    });
    expect(strict.alpha.data[56 * SIZE + 10], "distant repaint is never adopted").toBe(0);
  });

  it("measures the painter's own drift and does not mistake it for interaction", () => {
    /* The everywhere-drift is 2 levels. A threshold would have adopted the
       entire band; the comparison against the painter's own baseline does not. */
    const strict = adoptInteraction({
      master, patch: painter, harvest, bandPx: 8, mode: "interaction",
    });
    expect(strict.baselineDelta, "the drift is measured, not assumed").toBeCloseTo(2, 0);
    /* A pixel in the band that carries only drift, off to the side of the shadow. */
    expect(strict.alpha.data[26 * SIZE + 15], "drift alone is not interaction").toBe(0);
  });

  it("shadow mode darkens without letting the painter tint her", () => {
    /* The painter is given a shadow that is also a strong COLOUR — the failure
       the founder's ruling names: contact shadows, never a tint on her shirt. */
    const tinted = (() => {
      const data = Buffer.from(painter.data);
      for (let y = 24; y < 30; y += 1) for (let x = 20; x < 44; x += 1) {
        const at3 = (y * SIZE + x) * 3;
        data[at3] = 30; data[at3 + 1] = 96; data[at3 + 2] = 180;
      }
      return { data, width: SIZE, height: SIZE };
    })();

    const shadow = adoptInteraction({ master, patch: tinted, harvest, bandPx: 8, mode: "shadow" });
    const [r, g, b] = at(shadow.patch, 32, 26);
    expect(r, "darker than the master").toBeLessThan(160);
    expect(r === g && g === b, "and still neutral — her hue survives by construction").toBe(true);

    const raw = adoptInteraction({ master, patch: tinted, harvest, bandPx: 8, mode: "interaction" });
    const [rr, rg, rb] = at(raw.patch, 32, 26);
    expect(rr === rg && rg === rb, "interaction mode WOULD have taken the blue — the control").toBe(false);
  });

  it("never lightens: an invented highlight is not a contact shadow", () => {
    const brightened = (() => {
      const data = Buffer.from(painter.data);
      for (let y = 24; y < 30; y += 1) for (let x = 20; x < 44; x += 1) {
        const at3 = (y * SIZE + x) * 3;
        data[at3] = 240; data[at3 + 1] = 240; data[at3 + 2] = 240;
      }
      return { data, width: SIZE, height: SIZE };
    })();
    const shadow = adoptInteraction({ master, patch: brightened, harvest, bandPx: 8, mode: "shadow" });
    expect(shadow.alpha.data[26 * SIZE + 32], "lightening is discarded").toBe(0);
  });

  it("reports the band it cost, so the guarantee can be restated rather than broken", () => {
    const strict = adoptInteraction({
      master, patch: painter, harvest, bandPx: 8, mode: "interaction",
    });
    expect(strict.bandPixels, "the band is measured").toBeGreaterThan(0);
    expect(strict.adoptedPixels, "and so is what it actually took").toBeGreaterThan(0);
    expect(strict.adoptedPixels).toBeLessThan(strict.bandPixels);
  });
});

describe("difference matting — the strand alpha we already own the background for", () => {
  const SIZE = 64;
  const GREY = 200;
  const STRAND: [number, number, number] = [40, 30, 25];

  const master = (() => {
    const data = Buffer.allocUnsafe(SIZE * SIZE * 3);
    for (let pixel = 0; pixel < SIZE * SIZE; pixel += 1) {
      data[pixel * 3] = GREY; data[pixel * 3 + 1] = GREY; data[pixel * 3 + 2] = GREY;
    }
    return { data, width: SIZE, height: SIZE };
  })();

  /* A solid block of hair, plus a half-transparent strand tip lying beyond it. */
  const confirmed = (() => {
    const data = Buffer.alloc(SIZE * SIZE, 0);
    for (let y = 8; y < 24; y += 1) for (let x = 20; x < 44; x += 1) data[y * SIZE + x] = 255;
    return { data, width: SIZE, height: SIZE };
  })();

  const withTip = (tipAlpha: number) => {
    const data = Buffer.from(master.data);
    for (let y = 8; y < 24; y += 1) for (let x = 20; x < 44; x += 1) {
      const at = (y * SIZE + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) data[at + channel] = STRAND[channel];
    }
    /* the tip: a genuine linear blend of strand over the known background */
    for (let y = 24; y < 30; y += 1) for (let x = 30; x < 34; x += 1) {
      const at = (y * SIZE + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        data[at + channel] = Math.round(tipAlpha * STRAND[channel] + (1 - tipAlpha) * GREY);
      }
    }
    return { data, width: SIZE, height: SIZE };
  };

  it("recovers the tip's true alpha, because the background is known exactly", () => {
    const { alpha, strandColour } = differenceMatte({
      master, patch: withTip(0.2), confirmed, reachPx: 10,
    });
    expect(Math.round(strandColour[0]), "the strand colour is measured, not assumed").toBe(STRAND[0]);
    /* 20% there renders at 20%, to within a rounding step. */
    expect(alpha.data[26 * SIZE + 32]).toBeGreaterThan(45);
    expect(alpha.data[26 * SIZE + 32]).toBeLessThan(60);
  });

  it("tracks alpha across its whole range, not just at one point", () => {
    for (const [asked, expected] of [[0.2, 51], [0.5, 128], [0.9, 230]] as const) {
      const { alpha } = differenceMatte({ master, patch: withTip(asked), confirmed, reachPx: 10 });
      expect(Math.abs(alpha.data[26 * SIZE + 32] - expected)).toBeLessThan(12);
    }
  });

  it("rejects a repainted shirt — orthogonal in colour space, not below a threshold", () => {
    /*
      THE WALL, and the reason this does not reopen it. The painter regrades the
      garment from one grey to a noticeably different grey. That delta is large —
      a threshold would have taken it — but it points nowhere near the strand
      colour, so the projection is approximately nothing.
    */
    const regraded = (() => {
      const data = Buffer.from(master.data);
      for (let y = 8; y < 24; y += 1) for (let x = 20; x < 44; x += 1) {
        const at = (y * SIZE + x) * 3;
        for (let channel = 0; channel < 3; channel += 1) data[at + channel] = STRAND[channel];
      }
      /* a cool regrade of her shirt: moves away from the strand, not toward it */
      for (let y = 24; y < 32; y += 1) for (let x = 20; x < 44; x += 1) {
        const at = (y * SIZE + x) * 3;
        data[at] = GREY - 50; data[at + 1] = GREY - 15; data[at + 2] = GREY + 55;
      }
      return { data, width: SIZE, height: SIZE };
    })();
    const { alpha } = differenceMatte({ master, patch: regraded, confirmed, reachPx: 10 });
    expect(alpha.data[26 * SIZE + 32], "her regraded shirt is not a strand").toBeLessThan(20);
  });

  it("and the same pixel WOULD be taken by raw magnitude — the control", () => {
    /* Without this, "rejects the shirt" could pass because the change was small.
       It is not: it is a bigger byte move than the 20% strand the matte accepts. */
    const regradeDelta = 50 + 15 + 55;
    const strandDelta = 0.2 * ((GREY - STRAND[0]) + (GREY - STRAND[1]) + (GREY - STRAND[2]));
    expect(regradeDelta).toBeGreaterThan(strandDelta);
  });

  it("never reaches beyond its bound", () => {
    const { alpha } = differenceMatte({ master, patch: withTip(0.9), confirmed, reachPx: 4 });
    expect(alpha.data[40 * SIZE + 32], "far from confirmed content, nothing is recovered").toBe(0);
  });

  it("takes the strand colour from the interior, never from blended edge pixels", () => {
    /* An edge pixel is already part background; averaging it in would drag the
       reference toward the plate and bias every alpha downstream. */
    const { strandColour } = differenceMatte({ master, patch: withTip(0.5), confirmed, reachPx: 10 });
    expect(strandColour[0]).toBeLessThan(GREY / 2);
  });
});

describe("skin-aware wash suppression — a film with nothing casting it", () => {
  const SIZE = 64;
  const blank = () => Buffer.alloc(SIZE * SIZE, 0);
  const box = (from: { x: number; y: number }, to: { x: number; y: number }, fill: number): Mask => {
    const data = blank();
    for (let y = from.y; y < to.y; y += 1) for (let x = from.x; x < to.x; x += 1) data[y * SIZE + x] = fill;
    return { data, width: SIZE, height: SIZE };
  };
  const merge = (...masks: Mask[]): Mask => {
    const data = blank();
    for (const mask of masks) for (let i = 0; i < data.length; i += 1) if (mask.data[i] > data[i]) data[i] = mask.data[i];
    return { data, width: SIZE, height: SIZE };
  };

  /* Her forehead, and three claims on it: a strand, the shadow beside that
     strand, and a faint wash off on its own with nothing casting it. */
  const skin = box({ x: 4, y: 4 }, { x: 60, y: 60 }, 255);
  const strand = box({ x: 20, y: 10 }, { x: 24, y: 40 }, 255);
  const shadowAtStrand = box({ x: 24, y: 10 }, { x: 28, y: 40 }, 90);
  const wash = box({ x: 40, y: 20 }, { x: 56, y: 44 }, 60);

  it("keeps the strand", () => {
    const { alpha } = suppressWash({ alpha: merge(strand, shadowAtStrand, wash), where: skin });
    expect(alpha.data[20 * SIZE + 22], "a strand is never touched").toBe(255);
  });

  it("keeps the shadow that touches the strand — the ratified behaviour survives", () => {
    const { alpha } = suppressWash({ alpha: merge(strand, shadowAtStrand, wash), where: skin });
    expect(alpha.data[20 * SIZE + 25], "a contact shadow at the strand stays").toBe(90);
  });

  it("refuses the broad faint claim with nothing casting it", () => {
    const { alpha, suppressedPixels } = suppressWash({ alpha: merge(strand, shadowAtStrand, wash), where: skin });
    expect(alpha.data[30 * SIZE + 48], "a wash on open skin goes").toBe(0);
    expect(suppressedPixels).toBeGreaterThan(0);
  });

  it("leaves the same faint claim alone OFF skin — the gate is skin-aware", () => {
    /* The control that stops this being a blanket faint-claim killer. Over
       background a soft claim is ordinary blending, and sweeping those would
       undo the strand recovery this exists to protect. */
    const noSkin = box({ x: 0, y: 0 }, { x: 8, y: 8 }, 255);
    const { alpha, suppressedPixels } = suppressWash({ alpha: merge(strand, shadowAtStrand, wash), where: noSkin });
    expect(alpha.data[30 * SIZE + 48], "off skin it is left alone").toBe(60);
    expect(suppressedPixels).toBe(0);
  });

  it("does not quietly become a no-op — the wash really was reachable", () => {
    /* Without this, "refuses the wash" could pass because the wash was already
       zero or already outside `where`. It is neither. */
    const before = merge(strand, shadowAtStrand, wash);
    expect(before.data[30 * SIZE + 48]).toBe(60);
    expect(skin.data[30 * SIZE + 48]).toBe(255);
  });
});

describe("the harvest gate — a pure narrowing, and shine survives it", () => {
  const SIZE = 64;
  const GREY: [number, number, number] = [190, 188, 186];
  const STRAND: [number, number, number] = [45, 32, 26];
  const raster = (fill: (pixel: number) => [number, number, number]): Raster => {
    const data = Buffer.allocUnsafe(SIZE * SIZE * 3);
    for (let pixel = 0; pixel < SIZE * SIZE; pixel += 1) {
      const [r, g, b] = fill(pixel);
      data[pixel * 3] = r; data[pixel * 3 + 1] = g; data[pixel * 3 + 2] = b;
    }
    return { data, width: SIZE, height: SIZE };
  };
  const inBox = (pixel: number, x0: number, y0: number, x1: number, y1: number) => {
    const x = pixel % SIZE; const y = Math.floor(pixel / SIZE);
    return x >= x0 && x < x1 && y >= y0 && y < y1;
  };

  const master = raster(() => GREY);
  /* strand, a bright SHINE on that strand, and a faint veil of near-master. */
  const patch = raster((pixel) => {
    if (inBox(pixel, 10, 10, 20, 50)) return STRAND;
    if (inBox(pixel, 20, 10, 26, 50)) return [225, 215, 205];
    if (inBox(pixel, 40, 10, 56, 50)) return [188, 186, 184];
    return GREY;
  });
  const claim: Mask = {
    data: Buffer.from(Array.from({ length: SIZE * SIZE }, (_, pixel) =>
      (inBox(pixel, 10, 10, 26, 50) || inBox(pixel, 40, 10, 56, 50)) ? 255 : 0)),
    width: SIZE, height: SIZE,
  };
  const at = (mask: Mask, x: number, y: number) => mask.data[y * SIZE + x];

  it("keeps the strand", () => {
    const { alpha } = harvestGate({ master, patch, alpha: claim, strandColour: STRAND, baselineDelta: 1 });
    expect(at(alpha, 15, 30)).toBe(255);
  });

  it("spares specular shine — the named hazard", () => {
    /* A highlight moves toward white, AWAY from a dark strand. The criterion
       that asks "is this her surface" keeps it; the one that asks "is this the
       strand colour" does not. */
    const novelty = harvestGate({ master, patch, alpha: claim, strandColour: STRAND, baselineDelta: 1 });
    expect(at(novelty.alpha, 23, 30), "shine survives the shipped criterion").toBe(255);
    const projection = harvestGate({
      master, patch, alpha: claim, strandColour: STRAND, baselineDelta: 1, criterion: "projection",
    });
    expect(at(projection.alpha, 23, 30), "and projection WOULD have dimmed it — the control")
      .toBeLessThan(255);
  });

  it("reverts the veil that is really her own surface", () => {
    const { alpha, revertedPixels } = harvestGate({ master, patch, alpha: claim, strandColour: STRAND, baselineDelta: 1 });
    expect(at(alpha, 48, 30), "near-master content is not new content").toBe(0);
    expect(revertedPixels).toBeGreaterThan(0);
  });

  it("is a PURE NARROWING — it can never admit a pixel", () => {
    /* The property that made global scope safe to approve. */
    const { alpha } = harvestGate({ master, patch, alpha: claim, strandColour: STRAND, baselineDelta: 1 });
    for (let pixel = 0; pixel < alpha.data.length; pixel += 1) {
      expect(alpha.data[pixel]).toBeLessThanOrEqual(claim.data[pixel]);
    }
  });

  it("scales down rather than cutting, so it cannot mint an edge of its own", () => {
    const soft = raster((pixel) => (inBox(pixel, 40, 10, 56, 50) ? [187, 185, 183] : GREY));
    const { alpha, softenedPixels } = harvestGate({
      master, patch: soft, alpha: claim, strandColour: STRAND, baselineDelta: 1,
    });
    expect(softenedPixels, "partial confidence yields partial alpha").toBeGreaterThan(0);
    expect(at(alpha, 48, 30)).toBeGreaterThan(0);
    expect(at(alpha, 48, 30)).toBeLessThan(255);
  });
});
