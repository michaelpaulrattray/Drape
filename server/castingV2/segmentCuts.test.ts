import { describe, expect, it } from "vitest";

import { boundsOf, cropMask, cropRaster, cutSegments, encodeCut, intersectMasks } from "./segmentCuts";
import { readRaster, type Mask, type Raster } from "./maskedComposite";

/**
 * Cutting a delivered frame into the segments it earned.
 *
 * The arithmetic between "one applied mask" and "one segment per facet". It is
 * pure, so it is tested on rasters small enough to write out by hand — the
 * alternative is a fixture nobody can check by reading it.
 */

function mask(width: number, height: number, claim: (x: number, y: number) => boolean): Mask {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = claim(x, y) ? 255 : 0;
  }
  return { data, width, height };
}

function raster(width: number, height: number, colour: (x: number, y: number) => [number, number, number]): Raster {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colour(x, y);
      const at = (y * width + x) * 3;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
    }
  }
  return { data, width, height };
}

describe("the geometry", () => {
  it("intersects to where two masks agree, and says so in whole pixels", () => {
    const left = mask(4, 2, (x) => x < 3);
    const right = mask(4, 2, (x) => x > 1);
    const both = intersectMasks(left, right);
    expect(Array.from(both.data)).toEqual([0, 0, 255, 0, 0, 0, 255, 0]);
  });

  it("refuses masks of different sizes rather than walking off the end of one", () => {
    // The class this closes is real and expensive: a loop that reads past a
    // raster compares against `undefined`, every comparison is false, and the
    // guarantee passes by reading nothing.
    expect(() => intersectMasks(mask(4, 2, () => true), mask(2, 2, () => true))).toThrow(/different sizes/);
  });

  it("bounds a claim tightly, and answers null when there is nothing to bound", () => {
    expect(boundsOf(mask(5, 5, (x, y) => x >= 1 && x <= 2 && y === 3))).toEqual({ x: 1, y: 3, width: 2, height: 1 });
    expect(boundsOf(mask(5, 5, () => false))).toBeNull();
  });

  it("crops a mask and a frame to the same window", () => {
    const box = { x: 1, y: 1, width: 2, height: 2 };
    expect(Array.from(cropMask(mask(4, 4, (x, y) => x === y), box).data)).toEqual([255, 0, 0, 255]);
    const cropped = cropRaster(raster(4, 4, (x, y) => [x * 10, y * 10, 0]), box);
    expect(cropped.width).toBe(2);
    expect(Array.from(cropped.data.subarray(0, 6))).toEqual([10, 10, 0, 20, 10, 0]);
  });
});

describe("cutting a render into segments", () => {
  const composite = raster(8, 8, (x, y) => [x * 8, y * 8, 64]);
  /* The painter was allowed to differ from the master in a 4×4 block. */
  const applied = mask(8, 8, (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6);

  it("gives each facet only the ground its own region can prove", () => {
    const cuts = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"], ["hair.colour", "hair"]]),
      regionMasks: new Map([
        // Face skin covers the lower half of the applied block…
        ["face skin", mask(8, 8, (_x, y) => y >= 4)],
        // …and hair the top two rows, which the paint never reached.
        ["hair", mask(8, 8, (_x, y) => y < 2)],
      ]),
    });

    // One segment, not two: `hair.colour`'s region never met the applied mask,
    // so this render has no evidence about it and files nothing.
    expect(cuts.map((cut) => cut.facet)).toEqual(["marks"]);
    expect(cuts[0].box).toEqual({ x: 2, y: 4, width: 4, height: 2 });
    expect(cuts[0].pixels).toBe(8);
    expect(cuts[0].frame).toEqual({ width: 8, height: 8 });
    // The crop is the DELIVERED pixels at that box, not the master's.
    expect(Array.from(cuts[0].content.data.subarray(0, 3))).toEqual([16, 32, 64]);
  });

  it("files two segments over shared ground — a stylist's freckles and cheekbones are different things", () => {
    const cuts = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"], ["cheekbones", "face skin"]]),
      regionMasks: new Map([["face skin", mask(8, 8, () => true)]]),
    });

    /*
      Deliberate duplication. A shared row would make "take the freckles back"
      remove her cheekbones too — per-facet undo is the promised feature, and
      storage is rent rather than debt (ruled, fable-087).
    */
    expect(cuts.map((cut) => cut.facet).sort()).toEqual(["cheekbones", "marks"]);
    expect(cuts[0].box).toEqual(cuts[1].box);
  });

  it("files nothing for a facet whose region was never segmented", () => {
    const cuts = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["nose", "nose"]]),
      regionMasks: new Map(),
    });
    // Not an empty segment: a promise of permanence over nothing is the
    // flattering direction, and the honest state is "no evidence here".
    expect(cuts).toEqual([]);
  });

  it("refuses a region mask that does not match the frame under test", () => {
    expect(() => cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"]]),
      regionMasks: new Map([["face skin", mask(4, 4, () => true)]]),
    })).toThrow(/does not match the composite/);
  });

  it("encodes the mask as one channel and the crop as a readable picture", async () => {
    const [cut] = cutSegments({
      composite,
      applied,
      facetRegions: new Map([["marks", "face skin"]]),
      regionMasks: new Map([["face skin", mask(8, 8, () => true)]]),
    });
    const encoded = await encodeCut(cut);

    // Read the bytes back rather than trusting the encoder: the crop must come
    // out at the box's size, with the delivered colour still in it.
    const decoded = await readRaster(encoded.content);
    expect({ width: decoded.width, height: decoded.height }).toEqual({ width: 4, height: 4 });
    expect(Array.from(decoded.data.subarray(0, 3))).toEqual([16, 16, 64]);
    expect(encoded.mask.length).toBeGreaterThan(0);
  });
});
