import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  FACE_SCAN_CACHE_LIMIT,
  STENCIL_MAX_SIDE,
  faceScanCacheStats,
  panelScanOf,
  resetFaceScanCache,
  scannedFace,
  scannedFaceIfReady,
} from "./faceScanService";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

/**
 * SERVING THE SCAN — driven where the money is.
 *
 * The scan itself is tested in `faceScan.test.ts`. What is on trial here is the
 * part that decides how many times a face gets read, because every extra read
 * is fourteen segmenter calls nobody asked for: a second click, a refocus
 * refetch, the panel query and the scan query racing on the same fresh key.
 *
 * The reader below COUNTS ITS CALLS, so "cached" is a measurement rather than a
 * claim — a cache that silently rescanned would pass every assertion about the
 * shape of what comes back.
 */
const FRAME = { width: 1000, height: 1500 };

/**
 * A shape with an EDGE INSIDE its own bounding box — a right triangle.
 *
 * A solid rectangle would have been the obvious fixture and it is the useless
 * one: every pixel inside it is 255, so a downsample that smoothed would still
 * come back binary and the test that swears the stencil stays binary could not
 * fail. The diagonal is the thing a smoothing kernel has to spread, which is
 * what makes the assertion a measurement (the null-result-needs-a-fixture trap,
 * paid for twice already).
 *
 * It still touches all four edges of `box`, so the geometry the box reports is
 * exactly the rectangle asked for.
 */
function maskOf(box: { x: number; y: number; width: number; height: number }): Mask {
  const data = Buffer.alloc(FRAME.width * FRAME.height, 0);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    const across = Math.max(1, Math.round(box.width * ((y - box.y + 1) / box.height)));
    data.fill(255, y * FRAME.width + box.x, y * FRAME.width + box.x + across);
  }
  return { data, width: FRAME.width, height: FRAME.height };
}

function countingReader(box = { x: 10, y: 20, width: 30, height: 40 }): RegionReader & { calls: () => number } {
  let calls = 0;
  const built: any = {
    calls: () => calls,
    async region() {
      calls += 1;
      return maskOf(box);
    },
    async regionSides() {
      calls += 1;
      return { left: maskOf(box), right: maskOf({ ...box, x: box.x + 500 }) };
    },
    async subject() {
      return maskOf(box);
    },
    async landmark() {
      return null;
    },
  };
  return built;
}

/** A real JPEG of the frame's size — `sharp` reads its dimensions for real. */
async function frameBytes(): Promise<Buffer> {
  return sharp({
    create: { width: FRAME.width, height: FRAME.height, channels: 3, background: { r: 90, g: 90, b: 90 } },
  }).jpeg().toBuffer();
}

async function dependencies(reader: RegionReader) {
  const bytes = await frameBytes();
  let reads = 0;
  return {
    deps: {
      reader,
      readBytes: async () => {
        reads += 1;
        return { bytes, contentType: "image/jpeg" };
      },
      publicUrl: (key: string) => `https://bucket.example/${key}`,
    },
    reads: () => reads,
  };
}

const FACE = { userId: 7, candidateId: 41, variantId: null, imageKey: "casting/master.jpg" };

beforeEach(() => {
  resetFaceScanCache();
});

describe("one face-version is read once", () => {
  it("does not buy a second scan for a second look", async () => {
    const reader = countingReader();
    const { deps, reads } = await dependencies(reader);

    const first = await scannedFace({ ...FACE, dependencies: deps });
    const after = reader.calls();
    expect(after).toBeGreaterThan(0);

    const second = await scannedFace({ ...FACE, dependencies: deps });
    expect(reader.calls()).toBe(after);
    /* And the frame is not re-downloaded either — the whole read is joined,
       not just the segmenter half of it. */
    expect(reads()).toBe(1);
    expect(second).toBe(first);
    expect(faceScanCacheStats().hits).toBe(1);
    expect(faceScanCacheStats().scans).toBe(1);
  });

  it("joins two callers who arrive together rather than reading twice", async () => {
    const reader = countingReader();
    const { deps, reads } = await dependencies(reader);

    /*
      THE RACE THAT ACTUALLY HAPPENS: the panel query and the scan query fire
      within a frame of each other on a key nobody has read. A cache that stored
      only settled values would pay twice here, every time, invisibly.
    */
    const [a, b] = await Promise.all([
      scannedFace({ ...FACE, dependencies: deps }),
      scannedFace({ ...FACE, dependencies: deps }),
    ]);
    expect(a).toBe(b);
    expect(reads()).toBe(1);
    expect(faceScanCacheStats().scans).toBe(1);
  });

  it("reads a different VERSION of the same face separately", async () => {
    const reader = countingReader();
    const { deps, reads } = await dependencies(reader);

    await scannedFace({ ...FACE, dependencies: deps });
    await scannedFace({ ...FACE, variantId: 12, imageKey: "casting/v12.jpg", dependencies: deps });
    /* A version is a different picture, so it is a different key (4c) — and a
       refine landing invalidates nothing, because it creates one. */
    expect(reads()).toBe(2);
    expect(faceScanCacheStats().scans).toBe(2);
  });

  it("never serves one account's face to another", async () => {
    const reader = countingReader();
    const { deps, reads } = await dependencies(reader);

    await scannedFace({ ...FACE, dependencies: deps });
    await scannedFace({ ...FACE, userId: 8, dependencies: deps });
    expect(reads()).toBe(2);
    expect(scannedFaceIfReady({ userId: 9, candidateId: 41, variantId: null })).toBeNull();
  });
});

describe("what a failed scan costs", () => {
  it("is not remembered, so the next look can succeed", async () => {
    const { deps } = await dependencies(countingReader());
    let attempts = 0;
    const failing = {
      ...deps,
      readBytes: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("the frame store is down");
        return { bytes: await frameBytes(), contentType: "image/jpeg" };
      },
    };

    await expect(scannedFace({ ...FACE, dependencies: failing })).rejects.toThrow("the frame store is down");
    /* A cached rejection would make one bad minute permanent for this version.
       The second look pays again, which is the right trade for a courtesy. */
    const recovered = await scannedFace({ ...FACE, dependencies: failing });
    expect(recovered.found).toBeGreaterThan(0);
    expect(attempts).toBe(2);
    expect(faceScanCacheStats().failures).toBe(1);
  });

  it("refuses rather than returning an empty scan when there is no transport", async () => {
    const { deps } = await dependencies(countingReader());
    /*
      An empty scan and a face with nothing on it are the same payload, and the
      panel would show the second while meaning the first (invariant 7's shape:
      a control missing its dependency refuses, it does not allow).
    */
    await expect(scannedFace({ ...FACE, dependencies: { ...deps, reader: null } }))
      .rejects.toThrow(/FAL_KEY/);
  });
});

describe("what is ready, without waiting for it", () => {
  it("answers null while the read is in flight and the value after", async () => {
    const reader = countingReader();
    const { deps } = await dependencies(reader);

    const pending = scannedFace({ ...FACE, dependencies: deps });
    /* The panel's first paint must not block on seconds of segmentation, so it
       asks this and gets nothing — which is today's panel, exactly. */
    expect(scannedFaceIfReady(FACE)).toBeNull();
    const value = await pending;
    /* One tick for the settle handler that publishes it. */
    await Promise.resolve();
    expect(scannedFaceIfReady(FACE)).toBe(value);
  });
});

describe("the re-scan rate is a reading", () => {
  /*
    THIS ONE TEST BUYS ITS OWN CLOCK, AND THE REASON IS A COUPLING WORTH NAMING.

    Every other test in this file scans one face and costs ~50 ms. This one has
    to push a real key out of a real cache, so it scans FACE_SCAN_CACHE_LIMIT + 2
    of them — its cost is proportional to a PRODUCTION CONSTANT, and it is the
    only test in the suite that is. Measured: 1,729 ms alone on an idle machine,
    5,021 ms inside the 431-file parallel run, against vitest's 5,000 ms default.
    So it passed alone, passed the shift it was written in, and went red on the
    next run of an unchanged tree — the worst shape a test can have, because the
    red says nothing about its subject.

    An explicit budget rather than a cheaper test: reading the limit from the
    module is the right discipline (derive, never mirror — a hard-coded 64 here
    would stop proving eviction the day the ceiling moves), and the honest
    consequence of that discipline is that raising the ceiling makes this test
    slower. 30 s is ~6× the contended cost, so the ceiling can quadruple before
    this line needs looking at again.
  */
  it("counts a key that was evicted and came back", async () => {
    const reader = countingReader();
    const { deps } = await dependencies(reader);

    await scannedFace({ ...FACE, dependencies: deps });
    expect(faceScanCacheStats().rescans).toBe(0);

    /* Fill past the cache's own ceiling so the first key is dropped — the
       deploy-shaped event, in miniature. */
    for (let at = 0; at < FACE_SCAN_CACHE_LIMIT; at += 1) {
      await scannedFace({ ...FACE, candidateId: 100 + at, dependencies: deps });
    }
    expect(scannedFaceIfReady(FACE)).toBeNull();

    await scannedFace({ ...FACE, dependencies: deps });
    /*
      The number that promotes the memory cache to a table (4b), and it is
      produced by the thing it judges rather than estimated afterwards.
    */
    expect(faceScanCacheStats().rescans).toBe(1);
    expect(faceScanCacheStats().rescanRate).toBeGreaterThan(0);
  }, 30_000);
});

describe("what the panel receives", () => {
  it("carries a stencil of the crop's own rectangle, and the box at full resolution", async () => {
    const box = { x: 120, y: 240, width: 80, height: 60 };
    const { deps } = await dependencies(countingReader(box));

    const scan = await scannedFace({ ...FACE, dependencies: deps });
    const panel = panelScanOf(scan);
    expect(panel.frameUrl).toBe("https://bucket.example/casting/master.jpg");
    const entry = Array.from(panel.slots.values())[0];
    expect(entry).toBeDefined();

    /* The BOX is exact and full-resolution: it is geometry, and everything
       clickable is placed by it. */
    expect(entry!.box.frame).toEqual(FRAME);
    expect(entry!.box.width).toBeGreaterThan(0);

    expect(entry!.maskUrl.startsWith("data:image/png;base64,")).toBe(true);
    const stencil = await sharp(Buffer.from(entry!.maskUrl.split(",")[1]!, "base64")).metadata();
    /* Small enough to leave alone: the stencil is the crop's own rectangle, not
       the whole frame — a full-frame mask would be a hundred kilobytes to draw
       a 34px thumbnail. */
    expect(stencil.width).toBe(entry!.box.width);
    expect(stencil.height).toBe(entry!.box.height);
    expect(stencil.channels).toBe(1);
  });

  it("reduces a stencil that is bigger than a thumbnail needs, and keeps its shape", async () => {
    const box = { x: 0, y: 0, width: 900, height: 450 };
    const { deps } = await dependencies(countingReader(box));

    const scan = await scannedFace({ ...FACE, dependencies: deps });
    const entry = Array.from(panelScanOf(scan).slots.values())[0]!;
    const stencil = await sharp(Buffer.from(entry.maskUrl.split(",")[1]!, "base64")).metadata();
    expect(Math.max(stencil.width!, stencil.height!)).toBe(STENCIL_MAX_SIDE);
    /* The aspect survives the reduction — a stencil that changed shape would
       land the cutout on the wrong pixels, and the box beside it says 2:1. */
    expect(stencil.width! / stencil.height!).toBeCloseTo(entry.box.width / entry.box.height, 1);
    /* And the BOX is untouched by any of it: display bytes are cheap, geometry
       is not. */
    expect(entry.box.width).toBe(900);
  });

  it("stays binary through the reduction rather than inventing partial coverage", async () => {
    const { deps } = await dependencies(countingReader({ x: 0, y: 0, width: 900, height: 450 }));
    const scan = await scannedFace({ ...FACE, dependencies: deps });
    const entry = Array.from(panelScanOf(scan).slots.values())[0]!;
    const { data } = await sharp(Buffer.from(entry.maskUrl.split(",")[1]!, "base64"))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const values = new Set(Array.from(data.subarray(0, 4096)));
    /*
      A smoothing downsample would spread the reader's edge over a band of grey
      — coverage the reader never claimed, at a boundary this product has been
      wrong about before. Nearest keeps the two values it was given.
    */
    for (const value of Array.from(values)) expect([0, 255]).toContain(value);
  });

  it("measures what the stencils cost the payload rather than assuming it", async () => {
    const { deps } = await dependencies(countingReader());
    const scan = await scannedFace({ ...FACE, dependencies: deps });
    expect(scan.stencilBytes).toBeGreaterThan(0);
    /* Under a hundred kilobytes for a whole face, which is what makes riding
       the query payload legitimate instead of an object with a lifecycle. */
    expect(scan.stencilBytes).toBeLessThan(100_000);
  });
});

/**
 * THE FIELD THE EYES COURT DID NOT HAVE (fable-383 ruling 2).
 *
 * The founder reported one eye; the log carried counts and no laterality; the
 * scan writes nothing. So the one instrument that could have settled the court
 * could not record what the court needed, and his specimen had to be re-driven
 * on the same bytes across two shifts. One field closes it forever.
 */
describe("the scan says which sides it found", () => {
  it("names every bilateral feature and the sides that answered", async () => {
    const { deps } = await dependencies(countingReader());
    const scan = await scannedFace({ ...FACE, dependencies: deps });
    /* Both sides on every pair, because the fake reader answers both — the
       shape of the field is what is on trial here. */
    expect(scan.sides).toContain("eye:LR");
    expect(scan.sides).toContain("brow:LR");
    expect(scan.sides).toContain("ear:LR");
  });

  it("prints a dash for a side that answered nothing, rather than omitting it", async () => {
    /* An ear behind her hair is an honest one-sided answer, and a `-` beside
       its own question is the difference between "nothing came back" and "we
       never asked". The reader below answers only on her left. */
    const oneSided: any = {
      async region() { return maskOf({ x: 10, y: 20, width: 30, height: 40 }); },
      async regionSides() {
        return { left: maskOf({ x: 10, y: 20, width: 30, height: 40 }), right: { data: Buffer.alloc(FRAME.width * FRAME.height, 0), width: FRAME.width, height: FRAME.height } };
      },
      async subject() { return maskOf({ x: 10, y: 20, width: 30, height: 40 }); },
      async landmark() { return null; },
    };
    const { deps } = await dependencies(oneSided);
    const scan = await scannedFace({ ...FACE, dependencies: deps });
    expect(scan.sides).toContain("eye:L-");
    expect(scan.sides).not.toContain("eye:LR");
  });
});
