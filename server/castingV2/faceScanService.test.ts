import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import {
  FACE_SCAN_CACHE_LIMIT,
  STENCIL_MAX_SIDE,
  faceScanCacheStats,
  panelScanOf,
  resetFaceScanCache,
  scanProgressOf,
  scanSettlesWithin,
  scannedFace,
  scannedFaceIfReady,
} from "./faceScanService";
import { MaskError } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";

/*
  THE AUDIT WRITER IS CAUGHT RATHER THAN LET THROUGH.

  The miss counter writes one row per scan MISS, and it writes it
  fire-and-forget: the real `logAuditEvent` would reach for a database that
  these tests deliberately cannot see, and the `.catch()` around the call would
  swallow the failure without a mark. So a counter that had quietly stopped
  writing would look exactly like this suite passing.
*/
const auditRows: Array<{ action: string; metadata: Record<string, unknown> }> = [];
vi.mock("../auditLog", () => ({
  logAuditEvent: async (event: any) => {
    auditRows.push({ action: event.action, metadata: event.metadata ?? {} });
  },
}));

const scanMisses = () => auditRows.filter((row) => row.action === "casting.scan_miss");

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
  auditRows.length = 0;
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

describe("the panel fills a feature at a time", () => {
  /*
    THE ROWS EXIST BEFORE THE SCAN DOES (fable-521 §3).

    Fourteen questions run in parallel and the slowest decides when the whole
    scan resolves, so for several seconds there are real answers nobody could
    see. These drive that window directly rather than hoping to catch it: the
    reader is HELD OPEN, so "some features have landed and the reading is not
    finished" is a state the test creates rather than races for.
  */
  function heldReader(box = { x: 10, y: 20, width: 30, height: 40 }) {
    const waiting: Array<() => void> = [];
    const gate = () => new Promise<void>((resolve) => { waiting.push(resolve); });
    return {
      /** How many questions are waiting on this gate right now. */
      pending: () => waiting.length,
      /** Let every question answered so far through. */
      release: async () => {
        const all = waiting.splice(0, waiting.length);
        for (const open of all) open();
        /* Two turns: one for the reads to resolve, one for the stencils the
           partial cuts from them. */
        await new Promise((resolve) => setTimeout(resolve, 5));
      },
      reader: {
        async region() { await gate(); return maskOf(box); },
        async regionSides() {
          await gate();
          return { left: maskOf(box), right: maskOf({ ...box, x: box.x + 500 }) };
        },
        async subject() { return maskOf(box); },
        async landmark() { return null; },
      } as unknown as RegionReader,
    };
  }

  it("hands back the features that have landed, and says it is not finished", async () => {
    const held = heldReader();
    const { deps } = await dependencies(held.reader);

    const reading = scannedFace({ ...FACE, dependencies: deps });
    /* Nothing has answered yet: a key with no rows is NOT a panel with no
       features, and the difference is what the placeholder rows are for. */
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(scanProgressOf(FACE)).toBeNull();

    await held.release();
    const midway = scanProgressOf(FACE);
    expect(midway, "some features have landed").not.toBeNull();
    expect(midway!.done, "and the reading is still running").toBe(false);
    expect(midway!.scan.slots.size).toBeGreaterThan(0);
    /* A real stencil, not an empty box: the partial is what the panel DRAWS,
       so a row without its cutout would be a square with nothing in it. */
    for (const [, slot] of midway!.scan.slots) {
      expect(slot.maskUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(slot.maskUrl.length).toBeGreaterThan(64);
    }

    /* And the second reads the plan makes (the re-ask, the composed rows) still
       have to be let through before the whole thing settles. */
    while (scanProgressOf(FACE)?.done !== true) await held.release();
    const settled = await reading;
    const after = scanProgressOf(FACE);
    expect(after!.done).toBe(true);
    expect(after!.scan).toBe(settled);
    /* The settled answer is the authority and it is at least as complete as the
       partial ever was. */
    expect(settled.slots.size).toBeGreaterThanOrEqual(midway!.scan.slots.size);
  });

  it("says DONE on the first look at a face already read — no polling for an answer we have", async () => {
    const reader = countingReader();
    const { deps } = await dependencies(reader);
    await scannedFace({ ...FACE, dependencies: deps });

    const progress = scanProgressOf(FACE);
    expect(progress?.done).toBe(true);
  });

  it("calls a FAILED reading finished, so a polling panel cannot spin the segmenter", async () => {
    /*
      THE ONE WAY THIS COULD COST REAL MONEY.

      A failed scan is deliberately not cached — a cached rejection would make
      one bad minute permanent for that version. Fine when a panel asked once;
      not fine now that it asks again while a reading is unfinished. If failure
      read as "not finished", the client would ask every second and every ask
      would start a fresh fourteen-question scan.

      So the endpoint's patience reports whether the reading ENDED, which is a
      different question from whether any rows landed. Driven on a promise that
      rejects, because that is the case.
    */
    const settled = await scanSettlesWithin(Promise.reject(new Error("the segmenter is down")), 50);
    expect(settled).toBe(true);

    /* And the control, or "finished" would just be a function that says yes:
       a reading still in flight is NOT finished within the same patience. */
    const pending = await scanSettlesWithin(new Promise(() => {}), 20);
    expect(pending).toBe(false);
  });

  it("says NOTHING about a face nobody has asked about", () => {
    /* Not `done: true` with no rows — that would tell a panel the face has no
       features when the truth is that nothing has looked at it. */
    expect(scanProgressOf({ ...FACE, candidateId: 999 })).toBeNull();
  });
});

describe("a damaged reading is served once and never kept", () => {
  /*
    THE FOUNDER'S SECOND MISSING-EYES CAUSE (fable-547), and it hid behind the
    first one. The segmenter answers "eyes" on his bespectacled frame, the scan
    finds both, and the panel builds the row — all measured on his own specimen.
    What his panel showed was an OLDER reading of the same version: the burst
    that lost eleven regions to the provider's concurrency limit resolved into a
    scan whose failures were cached for the life of the process.
  */
  function readerLosing(names: readonly string[]) {
    const box = { x: 10, y: 20, width: 30, height: 40 };
    /* WEATHER, said the way the real reader says it: the provider's own 429 is
       a `MaskError` marked retryable, and that mark is what the cache reads.
       A plain Error here would be a stable failure and correctly KEPT. */
    const refuse = () => {
      throw new MaskError("fal-ai/sam-3/image: 429 concurrent_requests_limit", { retryable: true });
    };
    return {
      async region(input: { name: string }) {
        if (names.includes(input.name)) refuse();
        return maskOf(box);
      },
      async regionSides(input: { name: string }) {
        if (names.includes(input.name)) refuse();
        return { left: maskOf(box), right: maskOf({ ...box, x: box.x + 500 }) };
      },
      async subject() { return maskOf(box); },
      async landmark() { return null; },
    } as unknown as RegionReader;
  }

  it("does not keep a scan that lost regions — the next look re-asks", async () => {
    const { deps } = await dependencies(readerLosing(["eyes"]));
    const damaged = await scannedFace({ ...FACE, dependencies: deps });
    expect(damaged.failed.length, "the reading really did lose something").toBeGreaterThan(0);

    /* Served to whoever was waiting… */
    expect(damaged.asked).toBeGreaterThan(0);
    /* …and then dropped, so the next look pays again rather than inheriting it. */
    expect(scannedFaceIfReady(FACE)).toBeNull();
    expect(faceScanCacheStats().damaged).toBe(1);

    const reader = countingReader();
    const second = await dependencies(reader);
    const clean = await scannedFace({ ...FACE, dependencies: second.deps });
    /* "Clean" means no WEATHER, not no failures: this fixture's frame has
       nothing below the chin, so the composed build fails every time and asking
       again would buy the same nothing. That one is kept on purpose. */
    expect(clean.failed.some((one) => one.retryable === true)).toBe(false);
    expect(scannedFaceIfReady(FACE), "and a reading with no weather IS kept").not.toBeNull();
  });

  it("CONTROL — a clean scan is still cached, and still costs one read", async () => {
    /* The saving this whole cache exists for must survive the fix: without this
       arm, "never keep anything" would pass the test above. */
    const reader = countingReader();
    const { deps, reads } = await dependencies(reader);
    await scannedFace({ ...FACE, dependencies: deps });
    const after = reader.calls();
    await scannedFace({ ...FACE, dependencies: deps });
    expect(reader.calls()).toBe(after);
    expect(reads()).toBe(1);
    expect(faceScanCacheStats().damaged).toBe(0);
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

    /*
      AND THE SAME EVENT SURVIVES THE PROCESS. The counters above are in memory
      beside the cache, so a deploy takes the reading with the thing it was
      reading — which is why the rate was unreadable on a night with a dozen
      deploys. The durable half: exactly one row for the returning key, and it
      says the key had been read before.
    */
    const rows = scanMisses();
    expect(rows).toHaveLength(FACE_SCAN_CACHE_LIMIT + 2);
    expect(rows.at(-1)?.metadata.rescan).toBe(true);
    /* The negative arm of the same field, from the same run: the very first
       read of this key was NOT a re-scan. A row that said `true` for every miss
       would count every scan and measure nothing. */
    expect(rows[0]?.metadata.rescan).toBe(false);
  }, 30_000);

  it("writes one row for a miss and NOTHING for a hit", async () => {
    const reader = countingReader();
    const { deps } = await dependencies(reader);

    await scannedFace({ ...FACE, dependencies: deps });
    expect(scanMisses()).toHaveLength(1);
    const row = scanMisses()[0];
    expect(row.metadata).toMatchObject({ rescan: false, variantId: null });
    expect(row.metadata.cacheSize).toBe(0);

    /* The second look is free, so it is not worth a row — otherwise the rate's
       denominator would be looks rather than reads, and every extra click would
       make the cache look worse at the exact moment it was working. */
    await scannedFace({ ...FACE, dependencies: deps });
    expect(faceScanCacheStats().hits).toBe(1);
    expect(scanMisses()).toHaveLength(1);
  });

  it("says nothing about her face in the row it writes", async () => {
    const reader = countingReader();
    const { deps } = await dependencies(reader);
    await scannedFace({ ...FACE, variantId: 12, dependencies: deps });

    /*
      A scan reads fourteen places on a customer's face. The counter's whole
      subject is HOW OFTEN that happens, so the row carries the shape of the
      question and never its answer — no slots, no descriptions, no boxes, no
      key. Enumerated rather than spot-checked: a field added later has to be
      added here too, in front of somebody.
    */
    expect(Object.keys(scanMisses()[0].metadata).sort()).toEqual(["cacheSize", "rescan", "variantId"]);
  });
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

/**
 * THE KEPT READING, AT THE WIRE (migration 0032).
 *
 * What is on trial here is the SERVICE's half of the bargain: when it asks the
 * table, when it writes to it, and — the whole point of the feature — whether a
 * kept reading actually stops the money.
 *
 * The module itself is proved in `keptFaceScan.test.ts` against injected
 * dependencies. Here it is a double, because these arms are about the call
 * sites: a table consulted in the wrong place would still pass every test the
 * module has.
 */
const keptCalls = { served: [] as any[], kept: [] as any[] };
let keptAnswer: any = null;
vi.mock("./keptFaceScan", () => ({
  serveKeptScan: async (input: any) => { keptCalls.served.push(input); return keptAnswer; },
  keepScan: async (input: any) => { keptCalls.kept.push(input); return { kept: true, objects: 1 }; },
}));

describe("the reading this face has already paid for", () => {
  const arm = (scope: string | undefined) => {
    if (scope === undefined) delete process.env.CASTING_SCAN_TABLE_SCOPE;
    else process.env.CASTING_SCAN_TABLE_SCOPE = scope;
    /* The whole chain, because the flag is an AND of its parents and a test
       that set only the leaf would be arming nothing. */
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_REFERENCE_LIBRARY_SCOPE = "all";
    process.env.CASTING_FACE_SCAN_SCOPE = "all";
  };

  beforeEach(() => {
    keptCalls.served.length = 0;
    keptCalls.kept.length = 0;
    keptAnswer = null;
  });

  it("DARK — with the flag off it neither reads nor writes a row", async () => {
    arm(undefined);
    const reader = countingReader();
    const { deps } = await dependencies(reader);

    await scannedFace({ ...FACE, dependencies: deps });

    expect(keptCalls.served, "nothing was asked of the table").toHaveLength(0);
    expect(keptCalls.kept, "and nothing was written to it").toHaveLength(0);
    expect(reader.calls(), "the scan happened exactly as it does today").toBeGreaterThan(0);
  });

  it("spends NOTHING when the table already has this face-version", async () => {
    /*
      The headline, and the reason the table exists: 58 paid scans for 28
      distinct faces. The assertion is on the READER's call count, because
      "served from the table" is only worth anything if no segmenter was rung.
    */
    arm("all");
    const reader = countingReader();
    const { deps } = await dependencies(reader);
    keptAnswer = {
      slots: new Map([["hair", { box: { x: 1, y: 2, width: 3, height: 4, frame: { width: 1000, height: 1500 } }, maskUrl: "data:image/png;base64,AAAA" }]]),
      words: new Map([["skin", ["a warm even tan"]]]),
      asked: 12,
      empty: [],
      stencilBytes: 8360,
      sides: "eye:LR",
    };

    const scan = await scannedFace({ ...FACE, dependencies: deps });

    expect(reader.calls(), "not one segmenter call").toBe(0);
    expect(scan.found).toBe(1);
    expect(scan.failed, "a kept reading is clean by construction").toEqual([]);
    expect(scan.frameUrl).toContain(FACE.imageKey);
    /* And the memory holds it now, so the second look does not even ask. */
    await scannedFace({ ...FACE, dependencies: deps });
    expect(keptCalls.served, "asked once, then held in memory").toHaveLength(1);
  });

  it("writes a CLEAN reading down, with the frame it was read from", async () => {
    arm("all");
    const { deps } = await dependencies(countingReader());

    await scannedFace({ ...FACE, dependencies: deps });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(keptCalls.kept).toHaveLength(1);
    expect(keptCalls.kept[0].frameKey).toBe(FACE.imageKey);
    expect(keptCalls.kept[0].candidateId).toBe(FACE.candidateId);
    expect(keptCalls.kept[0].scan.slots.size).toBeGreaterThan(0);
  });

  it("NEVER writes a reading that lost regions — the missing-eyes law", async () => {
    /*
      The negative control for the arm above, and the one that matters: a
      damaged reading is already refused by the memory, and persisting it would
      make one bad minute permanent instead of one process long.
    */
    arm("all");
    const lossy: any = {
      async region() { throw new MaskError("the segmenter said no", { retryable: true }); },
      async regionSides() { throw new MaskError("the segmenter said no", { retryable: true }); },
      async subject() { return maskOf({ x: 10, y: 20, width: 30, height: 40 }); },
      async landmark() { return null; },
    };
    const { deps } = await dependencies(lossy);

    await scannedFace({ ...FACE, dependencies: deps });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(keptCalls.kept, "a damaged reading is served and dropped, never kept").toHaveLength(0);
  });
});
