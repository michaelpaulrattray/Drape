import { describe, expect, it } from "vitest";

import {
  CompositeError,
  adoptInteraction,
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
