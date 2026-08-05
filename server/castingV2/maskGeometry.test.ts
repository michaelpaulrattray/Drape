import { describe, expect, it } from "vitest";

import {
  MaskError,
  assertUsable,
  browRegion,
  coverage,
  dilateMask,
  eyeMaskFrom,
  eyeRegion,
  eyewearRegion,
  hairMaskFrom,
  hairRegion,
  mergeRegions,
  rasterise,
  subtractMask,
  unionMasks,
  type FaceGeometry,
  type Shape,
} from "./maskGeometry";
import { compositeMasked, outsideMaskUnchanged, type Mask, type Raster } from "./maskedComposite";

/**
 * The product laws of WHERE an edit may happen, proved without a provider.
 *
 * Every one of these is a founder ruling or a walk defect turned into geometry:
 * the face carved out of hair, glasses surviving an eye edit, lens interiors
 * regenerating rather than being copied, and same-region demands sharing one
 * patch.
 */

const W = 64;
const H = 64;

const FACE: Shape = { kind: "ellipse", cx: 0.5, cy: 0.52, rx: 0.18, ry: 0.24 };

const GEOMETRY: FaceGeometry = {
  face: FACE,
  leftEye: { kind: "ellipse", cx: 0.43, cy: 0.47, rx: 0.05, ry: 0.03 },
  rightEye: { kind: "ellipse", cx: 0.57, cy: 0.47, rx: 0.05, ry: 0.03 },
  leftBrow: { kind: "ellipse", cx: 0.43, cy: 0.41, rx: 0.06, ry: 0.02 },
  rightBrow: { kind: "ellipse", cx: 0.57, cy: 0.41, rx: 0.06, ry: 0.02 },
  mouth: { kind: "ellipse", cx: 0.5, cy: 0.66, rx: 0.06, ry: 0.03 },
  hair: [{ kind: "ellipse", cx: 0.5, cy: 0.42, rx: 0.26, ry: 0.28 }],
};

const BESPECTACLED: FaceGeometry = {
  ...GEOMETRY,
  eyewear: {
    /* A frame ring drawn as the band between two rects around each lens. */
    frames: [
      { kind: "rect", left: 0.36, top: 0.42, right: 0.64, bottom: 0.44 },
      { kind: "rect", left: 0.36, top: 0.51, right: 0.64, bottom: 0.53 },
    ],
    lenses: [
      { kind: "rect", left: 0.37, top: 0.44, right: 0.49, bottom: 0.51 },
      { kind: "rect", left: 0.51, top: 0.44, right: 0.63, bottom: 0.51 },
    ],
  },
};

function solid(rgb: [number, number, number]): Raster {
  const data = Buffer.allocUnsafe(W * H * 3);
  for (let pixel = 0; pixel < W * H; pixel += 1) {
    data[pixel * 3] = rgb[0];
    data[pixel * 3 + 1] = rgb[1];
    data[pixel * 3 + 2] = rgb[2];
  }
  return { data, width: W, height: H };
}

/** Is this normalised point writable under the rasterised spec? */
function writable(mask: { data: Buffer; width: number; height: number }, nx: number, ny: number) {
  const x = Math.floor(nx * mask.width);
  const y = Math.floor(ny * mask.height);
  return mask.data[y * mask.width + x] === 255;
}

describe("the face is carved out of every hair mask — founder law", () => {
  it("never lets a hair edit write on the face", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    /* Dead centre of the face: the nose, the thing that changed when "make her
       hair copper" came back a different woman. */
    expect(writable(mask, 0.5, 0.52)).toBe(false);
    expect(writable(mask, 0.5, 0.45)).toBe(false);
  });

  it("still writes on the hair itself, or it edits nothing", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(writable(mask, 0.5, 0.20)).toBe(true);
    expect(writable(mask, 0.28, 0.40)).toBe(true);
  });

  it("cannot be talked out of the carve-out by adding includes", () => {
    /* A destination zone that overlaps the face must still not open it — the
       exclusion is subtracted last, by construction. */
    const overlapping: Shape = { kind: "rect", left: 0, top: 0, right: 1, bottom: 1 };
    const mask = rasterise(hairRegion(GEOMETRY, [overlapping]), W, H);
    expect(writable(mask, 0.5, 0.52)).toBe(false);
  });
});

describe("growing and shrinking hair need the destination zone", () => {
  const below: Shape = { kind: "rect", left: 0.3, top: 0.72, right: 0.7, bottom: 0.95 };

  it("cannot lengthen hair without it — the space is not writable", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(writable(mask, 0.5, 0.85)).toBe(false);
  });

  it("opens exactly that space when the destination is given", () => {
    const mask = rasterise(hairRegion(GEOMETRY, [below]), W, H);
    expect(writable(mask, 0.5, 0.85)).toBe(true);
  });

  it("keeps the vacated space writable when hair gets shorter", () => {
    /* Shrinking is the same union from the other end: the mask must still cover
       where the hair IS, or nothing can paint background over it. */
    const shorter: Shape = { kind: "ellipse", cx: 0.5, cy: 0.34, rx: 0.2, ry: 0.16 };
    const mask = rasterise(hairRegion(GEOMETRY, [shorter]), W, H);
    expect(writable(mask, 0.28, 0.40)).toBe(true);
  });
});

describe("an eye edit does not delete her glasses — the walk defect, as geometry", () => {
  it("protects the opaque frames", () => {
    const mask = rasterise(eyeRegion(BESPECTACLED), W, H);
    expect(writable(mask, 0.5, 0.43)).toBe(false);
    expect(writable(mask, 0.5, 0.52)).toBe(false);
  });

  it("regenerates the lens interiors, which can never be copied back", () => {
    /* Those pixels hold the OLD eye seen through glass — preserving them would
       preserve the very thing being changed. */
    const mask = rasterise(eyeRegion(BESPECTACLED), W, H);
    expect(writable(mask, 0.43, 0.47)).toBe(true);
    expect(writable(mask, 0.57, 0.47)).toBe(true);
  });

  it("protects the frames from a brow edit too", () => {
    const mask = rasterise(browRegion(BESPECTACLED), W, H);
    expect(writable(mask, 0.5, 0.43)).toBe(false);
    expect(writable(mask, 0.43, 0.41)).toBe(true);
  });

  it("refuses to build an eyewear region for a face wearing none", () => {
    expect(() => eyewearRegion(GEOMETRY)).toThrow(MaskError);
  });
});

describe("same-region demands share one patch — batch by region, never by count", () => {
  it("merges eyes and brows into a single mask", () => {
    const merged = rasterise(
      mergeRegions([eyeRegion(BESPECTACLED), browRegion(BESPECTACLED)]),
      W,
      H,
    );
    expect(writable(merged, 0.43, 0.47)).toBe(true);
    expect(writable(merged, 0.43, 0.41)).toBe(true);
  });

  it("keeps an exclusion that only one member asked for", () => {
    /* Merging two safe regions must never produce an unsafe one. */
    const merged = rasterise(
      mergeRegions([eyeRegion(BESPECTACLED), browRegion(BESPECTACLED)]),
      W,
      H,
    );
    expect(writable(merged, 0.5, 0.43)).toBe(false);
  });

  it("does not grow the area beyond the two regions", () => {
    const merged = rasterise(
      mergeRegions([eyeRegion(BESPECTACLED), browRegion(BESPECTACLED)]),
      W,
      H,
    );
    /* The chin is neither eyes nor brows and must stay untouchable. */
    expect(writable(merged, 0.5, 0.72)).toBe(false);
  });
});

describe("a mask that cannot do its job is refused before the money", () => {
  it("refuses a region that selects nothing", () => {
    const empty = rasterise(
      { kind: "eyes", include: [{ kind: "rect", left: 0.5, top: 0.5, right: 0.5, bottom: 0.5 }] },
      W,
      H,
    );
    expect(() => assertUsable(empty, "eyes")).toThrow(/selects nothing/);
  });

  it("refuses a local edit that is really a full re-render", () => {
    const everything = rasterise(
      { kind: "skin", include: [{ kind: "rect", left: 0, top: 0, right: 1, bottom: 1 }] },
      W,
      H,
    );
    expect(() => assertUsable(everything, "skin")).toThrow(/re-render, not a local edit/);
  });

  it("accepts an ordinary hair region", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(() => assertUsable(mask, "hair")).not.toThrow();
    expect(coverage(mask)).toBeGreaterThan(0.01);
  });
});

/*
  THE SAME LAWS, ON REAL MATTES (founder rider, 2026-08-05).

  Production masks come from face parsing, alpha matting and SAM-class
  segmentation — never from the shapes above, which exist to make these tests
  free. What must hold is that the LAWS survive the change of source, and that a
  soft matte stays soft: a carve-out done by thresholding would put a binary edge
  back exactly where the matte was protecting one.
*/
describe("the laws run on mattes, not outlines", () => {
  const flat = (value: number): Mask => ({
    data: Buffer.alloc(4 * 4, value),
    width: 4,
    height: 4,
  });
  const ramp = (values: number[]): Mask => ({
    data: Buffer.from(values),
    width: values.length,
    height: 1,
  });

  it("unions by max, so two soft mattes stay soft", () => {
    const merged = unionMasks(ramp([0, 40, 200, 255]), ramp([10, 90, 20, 0]));
    expect([...merged.data]).toEqual([10, 90, 200, 255]);
  });

  it("subtracts softly, so a carved jawline does not become an outline", () => {
    /* A half-transparent face matte must halve the hair that overlaps it, not
       delete it — that gradient IS the jawline. */
    const carved = subtractMask(ramp([255, 255, 255, 255]), ramp([0, 64, 128, 255]));
    expect([...carved.data]).toEqual([255, 191, 127, 0]);
  });

  it("keeps the binary behaviour when both sides are hard", () => {
    expect([...subtractMask(ramp([255, 255]), ramp([0, 255])).data]).toEqual([255, 0]);
    expect([...unionMasks(ramp([255, 0]), ramp([0, 0])).data]).toEqual([255, 0]);
  });

  it("carves the face out of a hair matte from segmentation", () => {
    const hair = flat(255);
    const face: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    face.data[5] = 255;
    const mask = hairMaskFrom({ hair, face });
    expect(mask.data[5]).toBe(0);
    expect(mask.data[0]).toBe(255);
  });

  it("protects frames while letting lens interiors regenerate", () => {
    const eyes: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    eyes.data[5] = 255;
    const lenses: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    lenses.data[6] = 255;
    const frames: Mask = { data: Buffer.alloc(16, 0), width: 4, height: 4 };
    frames.data[6] = 128;

    const mask = eyeMaskFrom({ eyes, lenses, frames });
    expect(mask.data[5]).toBe(255);
    /* Half-opaque frame edge lets half the lens through — a wire rim is thin and
       partly transparent, and a binary cut would leave a halo of old frame. */
    expect(mask.data[6]).toBe(127);
  });

  it("refuses a multi-channel matte instead of walking off it (D-210)", () => {
    const threeChannel: Mask = { data: Buffer.alloc(4 * 4 * 3, 255), width: 4, height: 4 };
    expect(() => unionMasks(threeChannel, flat(0))).toThrow(/single-channel/);
    expect(() => subtractMask(threeChannel, flat(0))).toThrow(/single-channel/);
  });

  it("refuses to resize a matte to fit the master", () => {
    const other: Mask = { data: Buffer.alloc(9, 255), width: 3, height: 3 };
    expect(() => unionMasks(flat(255), other)).toThrow(/never resize/);
  });

  it("dilates a destination zone outward as paint-allowance", async () => {
    const seed: Mask = { data: Buffer.alloc(16 * 16, 0), width: 16, height: 16 };
    seed.data[8 * 16 + 8] = 255;
    const grown = await dilateMask(seed, 2);
    expect(grown.data[8 * 16 + 8]).toBe(255);
    expect(grown.data[8 * 16 + 9]).toBe(255);
    expect(grown.data.length).toBe(16 * 16);
  });

  it("weights coverage by alpha, so a faint halo is not solid area", () => {
    expect(coverage(flat(255))).toBeCloseTo(1);
    expect(coverage(flat(128))).toBeCloseTo(128 / 255, 2);
  });
});

describe("the geometry composes with the arithmetic", () => {
  it("leaves the face byte-identical when a hair patch redrew everything", async () => {
    /* The two halves of the workstream, end to end: geometry decides where, the
       composite proves what happened outside it. */
    const master = solid([10, 20, 30]);
    const patch = solid([200, 100, 50]);
    const mask = rasterise(hairRegion(GEOMETRY), W, H);

    const { composite, applied } = await compositeMasked({ master, patch, mask });
    expect(outsideMaskUnchanged(master, composite, applied).identical).toBe(true);

    const nose = ((Math.floor(0.52 * H)) * W + Math.floor(0.5 * W)) * 3;
    expect(composite.data[nose]).toBe(10);
  });

  it("hands the composite a mask of exactly one byte per pixel (D-210)", () => {
    const mask = rasterise(hairRegion(GEOMETRY), W, H);
    expect(mask.data.length).toBe(W * H);
  });
});
