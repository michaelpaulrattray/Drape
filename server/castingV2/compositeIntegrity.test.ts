/**
 * THE INSTRUMENT GETS ITS CONTROLS BEFORE ITS VERDICTS COUNT (working law 2).
 *
 * A seam detector that cannot fire is decoration, and one that fires on a clean
 * composite destroys a picture somebody paid for. So: a positive control that
 * reproduces run-6's tear, a negative control that reproduces a legitimate
 * surface edit, and a NULL — a frame against itself, where there is no applied
 * region at all and the honest answer is "nothing was composited" rather than a
 * small number.
 *
 * The thresholds themselves were measured on production frames rather than
 * chosen; `scripts/calibration/composite-seam.mts` is that measurement and its
 * table is quoted in the module.
 */
import { describe, expect, it } from "vitest";

import {
  SEAM_EXCESS_LEVELS,
  SEAM_MIN_PIXELS,
  compositeSeam,
} from "./compositeIntegrity";
import type { Mask, Raster } from "./maskedComposite";

const W = 64;
const H = 64;

function frame(fill: (x: number, y: number) => [number, number, number]): Raster {
  const data = Buffer.allocUnsafe(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = fill(x, y);
      const at = (y * W + x) * 3;
      data[at] = r; data[at + 1] = g; data[at + 2] = b;
    }
  }
  return { data, width: W, height: H };
}

const maskOf = (inside: (x: number, y: number) => boolean): Mask => {
  const data = Buffer.alloc(W * H, 0);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) if (inside(x, y)) data[y * W + x] = 255;
  }
  return { data, width: W, height: H };
};

const HAIR: [number, number, number] = [10, 8, 8];
const SKIN: [number, number, number] = [210, 164, 147];
const BACKDROP: [number, number, number] = [200, 198, 200];

/* Her hair is the left half; the applied region is a block inside it. */
const master = frame((x) => (x < 32 ? HAIR : SKIN));
const applied = maskOf((x, y) => x >= 8 && x < 24 && y >= 8 && y < 56);

describe("a composite that cut through her picture", () => {
  it("POSITIVE — a slab of backdrop delivered over hair reads as torn", () => {
    /* Run-6's left notch, in miniature: inside the mask the delivered content
       is pale backdrop; immediately outside it is her dark hair, unchanged. */
    const composite = frame((x, y) =>
      (applied.data[y * W + x] !== 0 ? BACKDROP : (x < 32 ? HAIR : SKIN)));
    const verdict = compositeSeam({ master, composite, applied });

    expect(verdict.torn).toBe(true);
    expect(verdict.tornPixels).toBeGreaterThanOrEqual(SEAM_MIN_PIXELS);
    expect(verdict.worstExcess).toBeGreaterThan(SEAM_EXCESS_LEVELS);
    expect(verdict.detail).toMatch(/boundary px step more than/);
  });

  it("NEGATIVE — a surface edit inside the same mask is not torn", () => {
    /* Freckles: a handful of levels on her own surface, which is what the
       excess measure has to stay quiet about or the product refunds everything
       it correctly delivered. */
    const composite = frame((x, y) => {
      if (applied.data[y * W + x] === 0) return x < 32 ? HAIR : SKIN;
      return (x + y) % 3 === 0 ? [24, 20, 20] : HAIR;
    });
    const verdict = compositeSeam({ master, composite, applied });

    expect(verdict.torn).toBe(false);
    expect(verdict.boundaryPixels, "and it did look at the boundary").toBeGreaterThan(0);
  });

  it("NULL — a frame against itself has no boundary at all, not a small number", () => {
    /* The control that matters most. An instrument reporting a seam where
       nothing was composited is measuring its own noise. */
    const verdict = compositeSeam({ master, composite: master, applied: maskOf(() => false) });
    expect(verdict.boundaryPixels).toBe(0);
    expect(verdict.torn).toBe(false);
    expect(verdict.detail).toBe("nothing was composited — delivering");
  });

  it("does not fire on a few stray pixels — the clean production frame had two", () => {
    /* `03-earrings` produced 2 boundary pixels over the level bar and is a
       perfectly good render. Two must never be a refusal. */
    const composite = frame((x, y) => {
      if (applied.data[y * W + x] === 0) return x < 32 ? HAIR : SKIN;
      /* One short run of backdrop, far below the count bar. */
      return (y === 20 && x >= 8 && x < 12) ? BACKDROP : HAIR;
    });
    const verdict = compositeSeam({ master, composite, applied });
    expect(verdict.tornPixels).toBeGreaterThan(0);
    expect(verdict.tornPixels).toBeLessThan(SEAM_MIN_PIXELS);
    expect(verdict.torn, "a speck is not a tear").toBe(false);
  });

  it("FAILS OPEN on anything it cannot measure", () => {
    /* A false positive destroys a picture the customer paid for and the refund
       does not give them the face back, so every uncertainty delivers. */
    const small: Raster = { data: Buffer.alloc(4 * 4 * 3, 0), width: 4, height: 4 };
    expect(compositeSeam({ master, composite: small, applied }).torn).toBe(false);
    expect(compositeSeam({ master, composite: master, applied: { data: Buffer.alloc(3), width: W, height: H } }).torn)
      .toBe(false);
  });

  it("is blind to a change that does not reach the boundary", () => {
    /*
      Stated as a limit rather than discovered as a surprise: this measures the
      STEP AT THE EDGE of what was composited. A tear wholly in the interior of
      the applied region has no boundary to step across and is invisible here.
      Run-6's tears were both at the boundary, which is what made this the right
      first instrument — not the only one it will ever need.
    */
    const composite = frame((x, y) => {
      if (x >= 14 && x < 18 && y >= 20 && y < 40) return BACKDROP;
      return x < 32 ? HAIR : SKIN;
    });
    const verdict = compositeSeam({ master, composite, applied });
    expect(verdict.torn).toBe(false);
  });
});
