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

/*
  THE COHERENCE STATISTIC — recorded, acted on by nothing (fable-119).

  The founder traced a visible tonal seam along an expanded ground's edge on a
  frame this detector scored `torn: false`. It was not a bar set too high. In
  the band he marked, his frame is ZERO pixels over the tear bar with a
  consistent −10 luma offset along the whole edge: a tear is an amplitude and a
  blend seam is a coherence, and no threshold on |step| separates the second
  from texture.

  So the controls here are about DISCRIMINATION, not about a verdict — nothing
  refuses on this number yet, and it has one production specimen.
*/
describe("a seam the eye reads as a line", () => {
  /* A uniform-ish surface so the only structure is what the composite adds. */
  const SHIRT: [number, number, number] = [170, 170, 172];
  const shirt = frame((x, y) => [
    SHIRT[0] + ((x * 7 + y * 13) % 5) - 2,
    SHIRT[1] + ((x * 11 + y * 5) % 5) - 2,
    SHIRT[2] + ((x * 3 + y * 17) % 5) - 2,
  ]);
  const block = maskOf((x) => x >= 16 && x < 48);

  it("POSITIVE — a consistent tonal offset inside the mask reads as coherent", () => {
    /* Ten levels darker inside, which is roughly what he saw and nowhere near
       the tear bar of eighty. */
    const pasted = frame((x, y) => {
      const at = (y * W + x) * 3;
      const base: [number, number, number] = [shirt.data[at]!, shirt.data[at + 1]!, shirt.data[at + 2]!];
      return block.data[y * W + x] ? [base[0] - 10, base[1] - 10, base[2] - 10] : base;
    });
    const verdict = compositeSeam({ master: shirt, composite: pasted, applied: block });

    /* The tear detector is silent, correctly — nothing here is a tear. */
    expect(verdict.torn).toBe(false);
    expect(verdict.tornPixels).toBe(0);
    /* And the coherence is loud: the step has a consistent sign and a spread
       far smaller than its mean. */
    expect(Math.abs(verdict.signedMean)).toBeGreaterThan(5);
    expect(verdict.coherence).toBeGreaterThan(1);
  });

  it("NEGATIVE — a noisy edit with no consistent offset is not coherent", () => {
    /* Same magnitude of change, alternating sign: visible as texture, invisible
       as a line. This is the control that stops "any edit" scoring as a seam. */
    const noisy = frame((x, y) => {
      const at = (y * W + x) * 3;
      const base: [number, number, number] = [shirt.data[at]!, shirt.data[at + 1]!, shirt.data[at + 2]!];
      if (!block.data[y * W + x]) return base;
      const wobble = (x + y) % 2 === 0 ? 10 : -10;
      return [base[0] + wobble, base[1] + wobble, base[2] + wobble];
    });
    const verdict = compositeSeam({ master: shirt, composite: noisy, applied: block });

    expect(verdict.torn).toBe(false);
    expect(verdict.coherence).toBeLessThan(1);
  });

  /*
    THE CONTROL THAT CAUGHT THIS STATISTIC'S OWN FIRST BUG.

    It shipped as `spread === 0 ? 0 : |mean|/spread`, so a boundary with a
    dead-consistent offset — the strongest possible reading of the defect it
    exists to find — scored ZERO. The flattering direction, in an instrument
    written to stop exactly that. Nothing acted on the number yet, which is the
    only reason it is a footnote.
  */
  it("scores a PERFECTLY consistent offset at the top, not at the bottom", () => {
    /* No texture at all: master and delivered differ by a flat ten levels, so
       the signed excess has zero spread. */
    const flat = frame(() => SHIRT);
    const offset = frame((x, y) => (block.data[y * W + x]
      ? [SHIRT[0] - 10, SHIRT[1] - 10, SHIRT[2] - 10]
      : SHIRT));
    const verdict = compositeSeam({ master: flat, composite: offset, applied: block });
    expect(verdict.signedSpread).toBe(0);
    expect(verdict.coherence).toBeGreaterThan(10);
    expect(Number.isFinite(verdict.coherence)).toBe(true);
  });

  it("reports zero rather than a division by nothing when there is no boundary", () => {
    const verdict = compositeSeam({ master: shirt, composite: shirt, applied: maskOf(() => false) });
    expect(verdict.boundaryPixels).toBe(0);
    expect(verdict.coherence).toBe(0);
    expect(verdict.signedSpread).toBe(0);
  });
});
