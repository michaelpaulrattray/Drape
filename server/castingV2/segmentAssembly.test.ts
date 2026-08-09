import { describe, expect, it } from "vitest";

import { assembleComposite, type CarriedSegment } from "./segmentAssembly";
import type { Mask, Raster } from "./maskedComposite";

/**
 * The three-source assembly, against fable-088's acceptance criteria.
 *
 * The first case is the one that matters most and looks the least
 * interesting: a render with no segments must come out byte-identical to
 * today's composite. Everything else in this file is new behaviour; that one
 * is the promise that the new behaviour cannot reach a face that never asked
 * for it.
 */

function mask(width: number, height: number, claim: (x: number, y: number) => number): Mask {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = claim(x, y);
  }
  return { data, width, height };
}

function raster(width: number, height: number, colour: (x: number, y: number) => number): Raster {
  const data = Buffer.alloc(width * height * 3, 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.fill(colour(x, y), (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  return { data, width, height };
}

const FRAME = { width: 8, height: 8 };
const master = raster(8, 8, () => 10);

function segment(over: Partial<CarriedSegment> = {}): CarriedSegment {
  const box = over.box ?? { x: 1, y: 1, width: 2, height: 2 };
  return {
    id: 1,
    facet: "marks",
    version: 1,
    box,
    frame: FRAME,
    mask: mask(box.width, box.height, () => 255),
    content: raster(box.width, box.height, () => 200),
    ...over,
  };
}

function pixel(frame: Raster, x: number, y: number): number {
  return frame.data[(y * frame.width + x) * 3];
}

describe("the assembly's regression anchor", () => {
  it("returns the paint's own composite, byte for byte, when nothing is carried", () => {
    const painted = raster(8, 8, (x, y) => (x >= 4 && y >= 4 ? 90 : 10));
    const applied = mask(8, 8, (x, y) => (x >= 4 && y >= 4 ? 255 : 0));

    const result = assembleComposite({ master, painted, applied, carried: [] });

    // Not "close enough" — identical. A segmentless render must be unable to
    // tell that any of this was built.
    expect(result.raster.data.equals(painted.data)).toBe(true);
    expect(result.carriedFacets).toEqual([]);
    expect(result.evidence.segmentsApplied).toEqual([]);
  });

  it("is the master itself when there is neither paint nor segment", () => {
    const result = assembleComposite({ master, carried: [] });
    expect(result.raster.data.equals(master.data)).toBe(true);
  });
});

describe("carrying a segment", () => {
  it("puts the stored crop back, byte-identical, where nothing contests it", () => {
    const result = assembleComposite({ master, carried: [segment()] });

    expect(pixel(result.raster, 1, 1)).toBe(200);
    expect(pixel(result.raster, 2, 2)).toBe(200);
    // Everything outside the segment is still the master.
    expect(pixel(result.raster, 0, 0)).toBe(10);
    expect(result.carriedFacets).toEqual(["marks"]);
    expect(result.evidence.segmentsApplied).toEqual([
      { id: 1, facet: "marks", version: 1, pixels: 4 },
    ]);
  });

  it("counts carried ground inside `applied`, so the composite cannot overclaim byte-identity", () => {
    const result = assembleComposite({ master, carried: [segment()] });
    // The verification step's whole argument is "outside this, the picture IS
    // the master". A carried segment moves pixels the paint never touched.
    expect(result.evidence.applied.data[1 * 8 + 1]).toBe(255);
    expect(result.evidence.applied.data[0]).toBe(0);
  });

  it("blends a feathered edge against the master rather than stamping it", () => {
    const soft = segment({
      mask: mask(2, 2, (x, y) => (x === 0 && y === 0 ? 128 : 255)),
    });
    const result = assembleComposite({ master, carried: [soft] });
    // 200 at half alpha over a master of 10.
    expect(pixel(result.raster, 1, 1)).toBe(Math.round((200 * 128 + 10 * 127) / 255));
    expect(pixel(result.raster, 2, 2)).toBe(200);
  });
});

describe("intersections — later wins, and it is written down", () => {
  it("gives the newer segment the pixels both claim", () => {
    const older = segment({ id: 1, facet: "marks", version: 1 });
    const newer = segment({
      id: 2,
      facet: "makeup",
      version: 1,
      box: { x: 2, y: 1, width: 2, height: 2 },
      content: raster(2, 2, () => 77),
    });

    const result = assembleComposite({ master, carried: [older, newer] });

    // x=2 is claimed by both; the later one holds it.
    expect(pixel(result.raster, 2, 1)).toBe(77);
    expect(pixel(result.raster, 1, 1)).toBe(200);
    expect(result.evidence.intersections).toEqual([
      { winner: "makeup@v1", loser: "marks@v1", pixels: 2 },
    ]);
  });

  it("gives the fresh paint the pixels it shares with a carried segment", () => {
    const painted = raster(8, 8, (x, y) => (x >= 2 && x <= 2 && y >= 1 && y <= 2 ? 250 : 10));
    const applied = mask(8, 8, (x, y) => (x === 2 && y >= 1 && y <= 2 ? 255 : 0));

    const result = assembleComposite({ master, painted, applied, carried: [segment()] });

    // The current ask outranks every memory.
    expect(pixel(result.raster, 2, 1)).toBe(250);
    expect(pixel(result.raster, 1, 1)).toBe(200);
    expect(result.evidence.intersections).toEqual([
      { winner: "fresh paint", loser: "marks@v1", pixels: 2 },
    ]);
  });

  it("flags a kept thing being painted over, without acting on it", () => {
    const applied = mask(8, 8, (x, y) => (x >= 1 && x <= 2 && y >= 1 && y <= 2 ? 255 : 0));
    const painted = raster(8, 8, () => 250);

    const result = assembleComposite({ master, painted, applied, carried: [segment()] });

    // Not an error: it is the signal that a later edit is superseding an
    // earlier one, which the report needs to be able to see.
    expect(result.evidence.supersededCandidates).toEqual([
      { id: 1, facet: "marks", coverage: 1 },
    ]);
  });
});

describe("what the assembly refuses to paste", () => {
  it("excludes a segment cut from a differently-sized frame, and never scales it", () => {
    const foreign = segment({ frame: { width: 848, height: 1264 } });
    const result = assembleComposite({ master, carried: [foreign] });

    /*
      Resampling a kept edit is resampling the exact signal permanence exists
      to protect — and the paste would not fail, it would put her freckles
      somewhere else on her face.
    */
    expect(result.raster.data.equals(master.data)).toBe(true);
    expect(result.evidence.segmentsExcluded).toEqual([
      { id: 1, facet: "marks", reason: "frameMismatch", detail: "848×1264 against 8×8" },
    ]);
    expect(result.carriedFacets).toEqual([]);
  });

  it("excludes a box that leaves the frame", () => {
    const result = assembleComposite({
      master,
      carried: [segment({ box: { x: 7, y: 7, width: 4, height: 4 } })],
    });
    expect(result.evidence.segmentsExcluded[0].reason).toBe("boxOutsideFrame");
    expect(result.raster.data.equals(master.data)).toBe(true);
  });

  it("excludes bytes whose shape disagrees with the row that describes them", () => {
    // A record that lies about its own object: the row says 2×2 and the stored
    // crop is 3×3. Pasting it would walk off the end of one of them.
    const result = assembleComposite({
      master,
      carried: [segment({ content: raster(3, 3, () => 200) })],
    });
    expect(result.evidence.segmentsExcluded[0].reason).toBe("shapeMismatch");
    expect(result.raster.data.equals(master.data)).toBe(true);
  });

  it("refuses an applied mask that does not match the frame, rather than mis-indexing it", () => {
    expect(() => assembleComposite({
      master,
      painted: raster(8, 8, () => 90),
      applied: mask(4, 4, () => 255),
      carried: [],
    })).toThrow(/does not match the frame/);
  });
});
