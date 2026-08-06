import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  MASKED_EDITING_ENABLED,
  harvestRefinement,
  needsLandmarkDestination,
  regionNameOf,
  type RegionReader,
} from "./maskedRefine";
import { allFacets } from "./refineFacets";
import { hasRegion } from "./zoneScope";
import type { Mask } from "./maskedComposite";

/**
 * The product-path seam, proved without a provider.
 *
 * The flag is dark, so the test that matters most is that the dark path is a
 * byte-for-byte passthrough — a deploy of this must change nothing at all.
 */

const W = 64;
const H = 64;

async function png(fill: (x: number, y: number) => [number, number, number]): Promise<Buffer> {
  const data = Buffer.allocUnsafe(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = fill(x, y);
      const at = (y * W + x) * 3;
      data[at] = r; data[at + 1] = g; data[at + 2] = b;
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

const box = (x0: number, y0: number, x1: number, y1: number, fill = 255): Mask => {
  const data = Buffer.alloc(W * H, 0);
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) data[y * W + x] = fill;
  return { data, width: W, height: H };
};

const reader: RegionReader = {
  region: async () => box(20, 8, 44, 28),
  subject: async () => box(16, 6, 48, 60),
};

describe("the flag is dark, and dark means nothing happens", () => {
  it("ships off", () => {
    expect(MASKED_EDITING_ENABLED, "a deploy of this must change nothing").toBe(false);
  });

  it("returns the engine's own bytes, byte for byte", async () => {
    const master = await png(() => [190, 188, 186]);
    const painted = await png((x, y) => (y < 30 ? [40, 30, 25] : [12, 200, 40]));
    const result = await harvestRefinement({
      master: { bytes: master, contentType: "image/png" },
      painted: { bytes: painted, contentType: "image/png" },
      facets: ["hair.cut"],
      reader,
    });
    expect(result.outcome).toBe("flag-off");
    expect(Buffer.compare(result.bytes, painted), "not re-encoded, not touched").toBe(0);
    expect(result.contentType).toBe("image/png");
  });

  it("does not even consult the segmenter while dark", async () => {
    /* A dark path that still spends provider calls is not dark. */
    let calls = 0;
    const counting: RegionReader = {
      region: async () => { calls += 1; return box(20, 8, 44, 28); },
      subject: async () => { calls += 1; return box(16, 6, 48, 60); },
    };
    await harvestRefinement({
      master: { bytes: await png(() => [190, 188, 186]), contentType: "image/png" },
      painted: { bytes: await png(() => [40, 30, 25]), contentType: "image/png" },
      facets: ["hair.cut"],
      reader: counting,
    });
    expect(calls).toBe(0);
  });
});

describe("the segmentation question is named per facet, never invented", () => {
  it("gives every SEGMENTABLE facet a question to ask", () => {
    /* D-213: a segmenter is never asked an open question, so a facet whose
       region is read off her current picture must have a written prompt rather
       than a derived one. */
    const missing = allFacets().filter((facet) =>
      hasRegion(facet) && !needsLandmarkDestination(facet) && regionNameOf(facet) === null);
    expect(missing).toEqual([]);
  });

  it("gives ADDITIONS none, because the thing is not there to segment", () => {
    /* The named gap, declared. An earring's destination comes from a landmark
       and the described object's extent — segmenting the master for it would be
       asking where a thing is that nobody is wearing. */
    const additions = allFacets().filter(needsLandmarkDestination);
    expect(additions.sort()).toEqual(["ink", "statedAccessories"]);
    for (const facet of additions) expect(regionNameOf(facet)).toBeNull();
  });

  it("gives the regionless facet none", () => {
    /* expression routes full-frame; a region prompt for it would be a lie. */
    expect(regionNameOf("expression")).toBeNull();
  });
});
