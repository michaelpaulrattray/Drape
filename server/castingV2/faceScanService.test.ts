import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import {
  FACE_SCAN_CACHE_LIMIT,
  STENCIL_MAX_SIDE,
  defaultDiscoverer,
  faceScanCacheStats,
  panelScanOf,
  resetFaceScanCache,
  scanProgressOf,
  scanSettlesWithin,
  scannedFace,
  scannedFaceIfReady,
  scannedFaceAlreadyRead,
} from "./faceScanService";
import { resetInterpreterForTests } from "./interpreter";
import { MaskError } from "./maskGeometry";
import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";
import { scanPlan } from "./faceScan";
import type { DiscoveredFeature, FaceDiscovery } from "./faceDiscovery";

/* One place a discovered feature is built in this suite, so a new field on
   `DiscoveredFeature` is one line here and not six (#2566). The grouping facts
   default to the parse's own fallbacks, which is today's behaviour. */
const discoveredFeature = (name: string, count = 1): DiscoveredFeature => (
  { name, count, about: "", kind: "anatomy", on: "", coverage: "single" }
);

import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";
import { once } from "../testing/once";

/* Its arms do real work in process — a tree sweep, a sheet compile, a sharp
   encode — and under the parallel run that cost multiplies by fifteen or twenty
   against vitest's 5,000 ms default. The measurement, and the two roads that
   were rejected, are in `contendedTestTimeout.ts` (#741). File level, never
   per arm: a number typed onto one `it(…)` is not inherited by its neighbour. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

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

/**
 * A real JPEG of the frame's size — `sharp` reads its dimensions for real.
 *
 * ⚠ **ENCODED ONCE PER RUN (#2172).** It is one constant 1000×1500 grey frame
 * and 30 arms asked for it, so `sharp` encoded the same image 30 times for an
 * answer that cannot differ — this suite was 18.7 s of the gate's unit `tests`
 * total. The buffer is already shared across every `readBytes` call WITHIN an
 * arm (`dependencies` reads it once and closes over it), so sharing it across
 * arms takes on no risk that was not already taken: nothing in the scan road
 * writes to the bytes it is handed, and `sharp` does not mutate its input.
 */
const frameBytesOnce = once(async () =>
  sharp({
    create: { width: FRAME.width, height: FRAME.height, channels: 3, background: { r: 90, g: 90, b: 90 } },
  }).jpeg().toBuffer(),
);
async function frameBytes(): Promise<Buffer> {
  return frameBytesOnce();
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

  /**
   * The scan's progress once at least one feature has actually landed, or null
   * at the deadline — so a caller's own assertion says what went wrong.
   *
   * The deadline is generous rather than tuned: it is never reached on a
   * healthy run, so its only job is to stop a broken one hanging.
   */
  async function waitForProgress(nudge?: () => Promise<void>, deadlineMs = 10_000) {
    const started = performance.now();
    for (;;) {
      const progress = scanProgressOf(FACE);
      if (progress !== null && progress.scan.slots.size > 0) return progress;
      if (performance.now() - started > deadlineMs) return progress;
      /* `nudge` re-releases the gate each lap. A single release() frees only
         the questions ALREADY parked, and under full-suite load the scan may
         not have reached the gate when it fires — it opens nothing, the reads
         park forever, and the old version died at its own deadline (the
         5011 ms failure, three sightings in one shift). Releasing per lap
         creates the state instead of racing for it; a scan that never lands
         still fails here, on the same message, at the deadline. */
      if (nudge) await nudge();
      else await new Promise((resolve) => setTimeout(resolve, 5));
    }
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
    /*
      WAIT FOR THE STATE, DO NOT SLEEP TOWARDS IT (2026-08-19).

      `release()` opens the gate and then waits a fixed 5 ms for the reads to
      resolve and the partial to cut its stencils from them. That is a race
      dressed as a wait, and this block's own header says the opposite — *"a
      state the test creates rather than races for"*. Cutting a stencil is real
      PNG work: 5 ms is plenty on an idle machine and not enough under a full
      suite, which is where it failed (green 31/31 run alone, red inside
      `pnpm test`).

      Polling for the condition keeps every ounce of the assertion's failure
      power — a partial that never lands still fails, on the same message, at
      the deadline — and removes only the dependence on how busy the machine is.
    */
    const midway = await waitForProgress(held.release);
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

  it("a discovery that OMITS a feature today's road answers takes no row away (#2566)", async () => {
    /*
      THE RELAY'S SECOND HELD FINDING ON PR #2570. On cast 812's selected
      version the discovery named no earring in reading 2 of 3, the question
      was cancelled, and the Earrings row (piercings plainly on the ear) left
      the panel. The repair is that a discovery may only ADD, so this drives the
      exact shape: a successful reading that names hair and eyes and says
      nothing about earrings, horns or glasses, against a reader that finds
      every feature. Every catalogue question is asked and every row stays.
    */
    const held = heldReader({ x: 10, y: 10, width: 20, height: 20 });
    const { deps } = await dependencies(held.reader);
    let discovered = 0;
    const omitting: FaceDiscovery = {
      ok: true,
      features: [discoveredFeature("hair"), discoveredFeature("eyes", 2)],
      cannotSee: [],
      unusable: [],
      crops: ["head", "full"],
    };
    const reading = scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => { discovered += 1; return omitting; } },
    });
    const midway = await waitForProgress(held.release);
    expect(midway, "some features have landed").not.toBeNull();
    expect(midway!.scan.asked, "the partial counts the whole catalogue").toBe(scanPlan().length);

    while (scanProgressOf(FACE)?.done !== true) await held.release();
    const settled = await reading;
    expect(discovered, "the discovery was bought, so the arm is not vacuous").toBe(1);
    expect(settled.asked).toBe(scanPlan().length);
    expect(settled.slots.has("earring@left"), "the omitted earring is still asked and still found").toBe(true);
    expect(settled.slots.has("earring@right")).toBe(true);
  });

  it("CONTROL — the same reader with no discovery finds the same rows", async () => {
    const held = heldReader({ x: 10, y: 10, width: 20, height: 20 });
    const { deps } = await dependencies(held.reader);
    const reading = scannedFace({ ...FACE, dependencies: { ...deps, discover: null } });
    while (scanProgressOf(FACE)?.done !== true) await held.release();
    const settled = await reading;
    expect(settled.asked).toBe(scanPlan().length);
    expect(settled.slots.has("earring@left")).toBe(true);
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
 * WHAT CAME BACK EMPTY, AS THE PANEL RECEIVES IT (founder ruling fable-889,
 * `PANEL_ABSENT_STATE_DESIGN.md`).
 *
 * The bald row is made of this projection, and it is a derivation rather than a
 * field — `empty` holds region QUESTIONS and the panel is a list of SLOTS — so
 * it is driven directly on a constructed reading rather than through a scan.
 * That is deliberate: what is on trial is the arithmetic, and a reading built
 * by a fake reader can only produce the cases that reader happens to make.
 *
 * The three arms are the three ways a slot can be missing from `slots`, and
 * telling them apart is the entire ruling: FOUND-NOTHING may be spoken about,
 * COULD-NOT-LOOK may not, and NEVER-ASKED is not even a question.
 */
describe("what the scan asked about and found nothing of", () => {
  const reading = (over: Partial<Parameters<typeof panelScanOf>[0]>) => panelScanOf({
    frameUrl: "https://bucket.example/casting/master.jpg",
    slots: new Map(),
    words: new Map(),
    asked: 12,
    found: 0,
    empty: [],
    failed: [],
    stencilBytes: 0,
    sides: "",
    ...over,
  } as any);

  it("names the slot behind a question that was asked and answered nothing", () => {
    const panel = reading({ empty: ["hair"] });
    expect(panel.absent?.has("hair" as any)).toBe(true);
  });

  it("does NOT name a slot whose question failed — that is could-not-look", () => {
    /* The negative control, and it is the one that matters: a reader that
       errored on hair produces the same missing row as a bald head, and only
       one of them may be told she is bald. */
    const panel = reading({
      empty: [],
      failed: [{ question: "hair", why: "Reached concurrent requests limit of 20", retryable: true }],
    });
    expect(panel.absent?.has("hair" as any)).toBe(false);

    /*
      AND AGAIN WITH THE QUESTION IN BOTH LISTS, which is the arm that actually
      drives the filter.

      Said plainly, because the arm above passes for a weaker reason than it
      looks: `scanFace` never writes a question to both, so the case above is
      already excluded by `empty` alone and would pass with no failure check at
      all. This one cannot — remove the `failed` filter and it names hair. It
      is the lock on a class rather than on today's writer: the day something
      appends to both lists, the panel must go on refusing to say "bald" over a
      read that errored.
    */
    const both = reading({
      empty: ["hair"],
      failed: [{ question: "hair", why: "the segmenter said no" }],
    });
    expect(both.absent?.has("hair" as any)).toBe(false);
  });

  it("does NOT name a slot nobody asked about", () => {
    /* Never-ran is the third fact. An empty list is silence, and silence is not
       a finding — the whole set is empty here, which is what a face read by
       nothing looks like. */
    expect(reading({ empty: [] }).absent?.size).toBe(0);
  });

  it("does not call a feature absent on the frame it was just found on", () => {
    /* Belt and braces against the region-level answer: a bilateral question
       counts as filed when EITHER side lands, so presence is decided per slot,
       from the boxes, and a slot with a box is present whatever `empty` says. */
    const box = { x: 1, y: 2, width: 3, height: 4, frame: FRAME };
    const panel = reading({
      empty: ["hair"],
      slots: new Map([["hair" as any, { box, maskUrl: "data:image/png;base64,AA" }]]),
    });
    expect(panel.absent?.has("hair" as any)).toBe(false);
  });

  it("names both sides of a bilateral region that answered nothing at all", () => {
    /* The FACT is reported for every slot; whether anything may be SAID about
       it is the catalogue's decision, and no per-side slot admits one. Driven
       so the projection is honest rather than quietly single-instance. */
    const panel = reading({ empty: ["eyes"] });
    expect(panel.absent?.has("eye@left" as any)).toBe(true);
    expect(panel.absent?.has("eye@right" as any)).toBe(true);
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
       that set only the leaf would be arming nothing. ⚠ The reference library
       was a link here and left with #1577 slice D5 — dropped rather than pinned
       `all`, because a value nothing reads is a lever that looks live. */
    process.env.CASTING_V2_SCOPE = "all";
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

  it("writes a reading with a discovery beside it down like any other (#2566)", async () => {
    /*
      The narrowed-reading refusal that stood here went with the gate: a
      discovery cancels nothing, so a flag-on reading is as whole as a flag-off
      one and is kept on the same rule.
    */
    arm("all");
    const { deps } = await dependencies(countingReader());
    const scan = await scannedFace({
      ...FACE,
      dependencies: {
        ...deps,
        discover: async () => ({ ok: true, features: [discoveredFeature("hair")], cannotSee: [], unusable: [], crops: ["head", "full"] }),
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scan.asked).toBe(scanPlan().length);
    expect(keptCalls.kept).toHaveLength(1);
  });

  /*
    ⚠ AND THE PANEL'S FIRST PAINT ASKS THE TABLE TOO (#1378).

    The defect these arms close: `scannedFaceIfReady` — the panel's first paint —
    reads the in-memory cache ALONE. That was the whole truth on 2026-08-13 when
    it was written, and stopped being it on 2026-08-16 when the kept table landed
    in a commit that touched this module and its suite and nothing else. So
    `scannedFace` gained the tier and the first paint did not: the first open of a
    face in a fresh process drew the library-only panel WHILE THE ANSWER SAT ON
    DISK, then bought a fresh twenty-call read of it.

    Every arm below fails against `scannedFaceIfReady`, which is the point — the
    old reader cannot pass them, because it never asks.
  */
  it("THE DEFECT — a cold memory with a kept row answers from the table, and spends nothing", async () => {
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

    /* The old reader is the negative control, and it is the defect itself: the
       memory is cold, so it says "nothing has been read for this face". */
    expect(scannedFaceIfReady(FACE), "the memory-only reader cannot see the row")
      .toBeNull();

    const served = await scannedFaceAlreadyRead({ ...FACE, dependencies: deps });

    expect(served, "the reading that was already paid for").not.toBeNull();
    expect(served!.found).toBe(1);
    expect(served!.failed, "a kept reading is clean by construction").toEqual([]);
    expect(served!.frameUrl).toContain(FACE.imageKey);
    expect(reader.calls(), "not one segmenter call for a first paint").toBe(0);
    expect(keptCalls.served, "asked the table once, with the frame on screen").toHaveLength(1);
    expect(keptCalls.served[0].frameKey).toBe(FACE.imageKey);
  });

  it("HOLDS what it found, so the scan query behind it rings nobody", async () => {
    /* Without this the panel would be right and the money would still be spent:
       the client fires `faceScan` straight after the first paint. */
    arm("all");
    const reader = countingReader();
    const { deps } = await dependencies(reader);
    keptAnswer = {
      slots: new Map([["hair", { box: { x: 1, y: 2, width: 3, height: 4, frame: { width: 1000, height: 1500 } }, maskUrl: "data:image/png;base64,AAAA" }]]),
      words: new Map(), asked: 12, empty: [], stencilBytes: 10, sides: "eye:LR",
    };

    await scannedFaceAlreadyRead({ ...FACE, dependencies: deps });
    const after = await scannedFace({ ...FACE, dependencies: deps });

    expect(reader.calls(), "the scan query spent nothing either").toBe(0);
    expect(after.found).toBe(1);
    expect(keptCalls.served, "and it did not ask the table a second time").toHaveLength(1);
    expect(scannedFaceIfReady(FACE), "the memory now holds it, so every later look is free").not.toBeNull();
  });

  it("CONTROL — with the flag off it does not ask the table and does not scan", async () => {
    arm(undefined);
    const reader = countingReader();
    const { deps } = await dependencies(reader);

    expect(await scannedFaceAlreadyRead({ ...FACE, dependencies: deps })).toBeNull();
    expect(keptCalls.served, "nothing was asked of the table").toHaveLength(0);
    expect(reader.calls(), "and a first paint NEVER scans, whatever the flags say").toBe(0);
  });

  it("CONTROL — no row means the library-only panel, never a scan bought at first paint", async () => {
    arm("all");
    const reader = countingReader();
    const { deps } = await dependencies(reader);
    keptAnswer = null;

    expect(await scannedFaceAlreadyRead({ ...FACE, dependencies: deps })).toBeNull();
    expect(keptCalls.served, "it did ask").toHaveLength(1);
    expect(reader.calls(), "and answered nothing rather than buying an answer").toBe(0);
  });

  it("CONTROL — a scan in flight answers nothing, not a partial", async () => {
    /*
      The first paint must not draw rows the panel is about to be told are still
      arriving: the `faceScan` query owns an in-flight read and reports
      `done: false` with what has landed. A partial served HERE would arrive with
      no such word beside it.
    */
    arm("all");
    const { deps } = await dependencies(countingReader());
    const inFlight = scannedFace({ ...FACE, dependencies: deps });
    /* One tick, because the entry is held AFTER the scan's own table ask — so a
       reader that ran sooner would be racing rather than reading an in-flight
       scan, which is a different claim and was what the first draft of this arm
       actually measured (it saw two asks and called it a defect). */
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(await scannedFaceAlreadyRead({ ...FACE, dependencies: deps })).toBeNull();
    expect(keptCalls.served, "the live scan asked; this reader did not ask again").toHaveLength(1);

    await inFlight;
    expect(await scannedFaceAlreadyRead({ ...FACE, dependencies: deps }), "once it settles, it answers")
      .not.toBeNull();
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

/*
  THE MISSING-EYES LAW, ON THE ROAD IT DID NOT COVER (#2833, his eye round 9).

  His panel on a cast in a harness top with two tattoo sleeves was settled and
  held every catalogue row and not one found row: no Outfit, no Tattoo, not even
  the collar. Two readings of the same picture on the same build both drew an
  Outfit and a Tattoo. The discovery road fails open by design, and a reading
  whose discovery or calls failed LOOKED clean, so it was kept, and a kept
  reading is the end of the asking for that frame.

  Driven through the real `scannedFace`, with the table's writer caught by the
  mock above, so each arm reads what was actually WRITTEN and what the memory
  actually holds, not a flag near them.
*/
describe("a reading that lost its found rows is served and not kept", () => {
  const armTable = () => {
    process.env.CASTING_SCAN_TABLE_SCOPE = "all";
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_FACE_SCAN_SCOPE = "all";
  };
  const JACKET = { x: 100, y: 200, width: 300, height: 400 };

  /** The counting reader, plus a pointer road whose detect answers as told. */
  function pointing(detect: (name: string) => Promise<Array<typeof JACKET>>) {
    const base = countingReader() as any;
    base.pointer = async ({ name }: { name: string }) => detect(name);
    base.regionInBox = async ({ box }: { box: typeof JACKET }) => maskOf(box);
    return base as RegionReader;
  }
  const jacketOnly = (): FaceDiscovery => ({
    ok: true,
    features: [{ ...discoveredFeature("jacket"), kind: "clothing" }],
    cannotSee: [],
    unusable: [],
    crops: ["head", "full"],
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    keptCalls.served.length = 0;
    keptCalls.kept.length = 0;
    keptAnswer = null;
    armTable();
  });

  it("a discovery that came back { ok: false } is served and NOT kept — the next look asks again", async () => {
    const reader = pointing(async () => [JACKET]);
    const { deps } = await dependencies(reader);
    const lost = await scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => ({ ok: false, why: "only part of the reading came back" }) },
    });
    await settle();

    /* Served exactly as before: the catalogue, and no found row. */
    expect(lost.slots.size, "the catalogue rows still reach the panel").toBeGreaterThan(0);
    expect(lost.discovered).toEqual([]);
    /* And neither written down nor held. */
    expect(keptCalls.kept, "not written to the table").toHaveLength(0);
    expect(scannedFaceIfReady(FACE), "and not held in memory either").toBeNull();
    expect(faceScanCacheStats().damaged).toBe(1);

    /* THE NEXT LOOK ASKS AGAIN, and this time the reading answers. */
    const again = await scannedFace({ ...FACE, dependencies: { ...deps, discover: async () => jacketOnly() } });
    await settle();
    expect(again.discovered.map((one) => one.noun), "the second look finds the jacket").toEqual(["jacket"]);
    expect(keptCalls.kept, "and THAT reading is kept").toHaveLength(1);
  });

  it("a detect that THREW is served and NOT kept", async () => {
    const reader = pointing(async () => {
      throw new MaskError("fal-ai/moondream3-preview/detect: 429 concurrent_requests_limit", { retryable: true });
    });
    const { deps } = await dependencies(reader);
    const lost = await scannedFace({ ...FACE, dependencies: { ...deps, discover: async () => jacketOnly() } });
    await settle();

    expect(lost.discovered).toEqual([]);
    /* Not a catalogue failure, so it never enters `failed` — that list is
       catalogue questions, and the panel reads it. */
    expect(lost.failed.map((one) => one.question)).not.toContain("jacket");
    expect(keptCalls.kept, "not written to the table").toHaveLength(0);
    expect(scannedFaceIfReady(FACE)).toBeNull();
  });

  it("CONTROL — a reading whose found rows all landed IS kept", async () => {
    const reader = pointing(async () => [JACKET]);
    const { deps } = await dependencies(reader);
    const found = await scannedFace({ ...FACE, dependencies: { ...deps, discover: async () => jacketOnly() } });
    await settle();

    expect(found.discovered.map((one) => one.noun)).toEqual(["jacket"]);
    expect(keptCalls.kept, "written once").toHaveLength(1);
    expect(scannedFaceIfReady(FACE), "and held").not.toBeNull();
    expect(faceScanCacheStats().damaged).toBe(0);
  });

  it("CONTROL — the detector finding NOTHING is an answer, and that reading IS kept", async () => {
    /* `declined`, not `failed`: the reading named a jacket and the detector
       looked and saw none. Re-asking would buy the same nothing. */
    const reader = pointing(async () => []);
    const { deps } = await dependencies(reader);
    const declined = await scannedFace({ ...FACE, dependencies: { ...deps, discover: async () => jacketOnly() } });
    await settle();

    expect(declined.discovered).toEqual([]);
    expect(keptCalls.kept, "kept: nothing was lost, the answer was no").toHaveLength(1);
    expect(faceScanCacheStats().damaged).toBe(0);
  });

  it("CONTROL — no discovery at all (the flag off for this account) is kept, exactly as before", async () => {
    const { deps } = await dependencies(countingReader());
    await scannedFace({ ...FACE, dependencies: { ...deps, discover: null } });
    await settle();

    expect(keptCalls.kept).toHaveLength(1);
    expect(faceScanCacheStats().damaged).toBe(0);
  });
});

/*
  WHETHER A DISCOVERY IS BOUGHT AT ALL (#2566).

  ⚠ These arms exist because their absence survived sabotage, and the reason is
  worth more than the arms: driven through a SCAN, replacing the flag check
  with a constant left every suite green — `defaultDiscoverer`'s next line
  finds no transport, or the read fails, and both fall open to exactly the
  answer a correctly-gated scan gives. **The three silent roads that make this
  road safe are the same three that make it invisible from outside**, so the
  decision is driven where it is made.
*/
describe("whether a discovery is bought", () => {
  const previous = { ...process.env };
  afterEach(() => { process.env = { ...previous }; });

  function chainOn(): void {
    /* ⚠ Two links, not three, since #1577 slice D5 retired the library's. */
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_FACE_SCAN_SCOPE = "all";
  }

  it("buys none when the flag names nobody — the position every account is in today", () => {
    chainOn();
    delete process.env.CASTING_FACE_DISCOVERY_SCOPE;
    process.env.OPENROUTER_API_KEY = "a-key-that-is-never-reached";
    expect(defaultDiscoverer(1)).toBeNull();
  });

  it("buys none for a user the flag does not name", () => {
    chainOn();
    process.env.CASTING_FACE_DISCOVERY_SCOPE = "users:1";
    process.env.OPENROUTER_API_KEY = "a-key-that-is-never-reached";
    expect(defaultDiscoverer(2)).toBeNull();
    expect(defaultDiscoverer(1)).not.toBeNull();
  });

  it("buys none when a parent flag is off, even with its own flag on", () => {
    chainOn();
    process.env.CASTING_FACE_DISCOVERY_SCOPE = "all";
    process.env.OPENROUTER_API_KEY = "a-key-that-is-never-reached";
    expect(defaultDiscoverer(1)).not.toBeNull();
    process.env.CASTING_FACE_SCAN_SCOPE = "off";
    expect(defaultDiscoverer(1)).toBeNull();
  });

  it("buys none with no text transport configured, flag or no flag", () => {
    chainOn();
    process.env.CASTING_FACE_DISCOVERY_SCOPE = "all";
    delete process.env.OPENROUTER_API_KEY;
    resetInterpreterForTests();
    expect(defaultDiscoverer(1)).toBeNull();
  });
});

/**
 * THE POINTER ROAD REACHING THE PANEL (#2566 slice 2).
 *
 * Slice 1's own closing note said the discovery's names were logged and
 * discarded — *"a discovery's names change nothing on the panel"* — and that is
 * the sentence these arms exist to have stopped being true. What is on trial is
 * the SEAM: the discovery is bought, its off-list names reach the pointer road,
 * the road's rows reach the settled reading, and the settled reading is what
 * gets kept.
 *
 * ⚠ **The reader here answers the pointer road's two calls and counts them**,
 * so *"the panel drew a jacket"* is a measurement of two provider calls having
 * been made rather than of a fixture having been plumbed through.
 */
describe("what a discovery's names become", () => {
  /** The counting reader, plus the pointer road's two halves. */
  function pointingReader(detects: Record<string, Array<{ x: number; y: number; width: number; height: number }>>) {
    const base = countingReader() as any;
    const asked: string[] = [];
    base.pointer = async ({ name }: { name: string }) => {
      asked.push(name);
      return detects[name] ?? [];
    };
    base.regionInBox = async ({ box }: { box: { x: number; y: number; width: number; height: number } }) =>
      maskOf(box);
    base.pointed = () => asked;
    return base as RegionReader & { calls: () => number; pointed: () => string[] };
  }

  const discoveryOf = (features: Array<{ name: string; count: number }>): FaceDiscovery => ({
    ok: true,
    features: features.map((one) => discoveredFeature(one.name, one.count)),
    cannotSee: [],
    unusable: [],
    crops: ["head", "full"],
  });

  it("cuts the off-list ones and puts them on the panel under the reading's own noun", async () => {
    const reader = pointingReader({ jacket: [{ x: 100, y: 200, width: 300, height: 400 }] });
    const { deps } = await dependencies(reader);

    const reading = await scannedFace({
      ...FACE,
      dependencies: {
        ...deps,
        discover: async () => discoveryOf([{ name: "hair", count: 1 }, { name: "jacket", count: 1 }]),
      },
    });

    /* The catalogue's own name never reached the detector — the scan already
       bought it, and asking again is the same feature paid for twice. */
    expect(reader.pointed()).toEqual(["jacket"]);
    expect(reading.discovered).toHaveLength(1);
    expect(reading.discovered[0]!.noun).toBe("jacket");
    expect(reading.discovered[0]!.box).toEqual({ x: 100, y: 200, width: 300, height: 400, frame: FRAME });
    /* And it arrives as a stencil, the way every other row's picture does. */
    expect(reading.discovered[0]!.maskUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(reading.stencilBytes).toBeGreaterThan(0);

    /* The panel's own channel carries it through untouched. */
    expect(panelScanOf(reading).discovered).toEqual(reading.discovered);
  });

  it("CONTROL — the same reader with no discovery finds nothing off the list", async () => {
    const reader = pointingReader({ jacket: [{ x: 100, y: 200, width: 300, height: 400 }] });
    const { deps } = await dependencies(reader);

    const reading = await scannedFace({ ...FACE, dependencies: { ...deps, discover: null } });

    expect(reader.pointed()).toEqual([]);
    expect(reading.discovered).toEqual([]);
    expect(panelScanOf(reading).discovered).toEqual([]);
  });

  it("the catalogue's own rows are byte for byte what they were beside it", async () => {
    const reader = pointingReader({ sash: [{ x: 10, y: 10, width: 20, height: 20 }] });
    const { deps } = await dependencies(reader);

    const without = await scannedFace({ ...FACE, dependencies: { ...deps, discover: null } });
    resetFaceScanCache();
    const with_ = await scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => discoveryOf([{ name: "sash", count: 1 }]) },
    });

    expect(Array.from(with_.slots.keys())).toEqual(Array.from(without.slots.keys()));
    expect(with_.asked).toBe(without.asked);
    /* `found` is still the CATALOGUE's count: a dressed cast reporting more
       found than asked reads as an instrument fault. */
    expect(with_.found).toBe(without.found);
    expect(with_.discovered).toHaveLength(1);
  });

  /*
    #2810, his eye round 8: a `snout` cut as the whole head drew a Snout row
    beside Nose. The scan's own face-skin cut is what says it is the face, so
    this arm drives that cut through the real scan into the pointer road.
  */
  it("a body part cut as the whole face gets no row — the scan's own face-skin cut says so (#2810)", async () => {
    const face = { x: 100, y: 200, width: 400, height: 500 };
    const reader = pointingReader({ snout: [face], muzzle: [{ x: 250, y: 450, width: 100, height: 80 }] });
    const asked = reader.region.bind(reader);
    (reader as any).region = async (input: { name: string }) => (input.name === "face skin" ? maskOf(face) : asked(input as never));
    const { deps } = await dependencies(reader);

    const reading = await scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => discoveryOf([{ name: "snout", count: 1 }, { name: "muzzle", count: 1 }]) },
    });

    expect(reading.discovered.map((one) => one.noun)).toEqual(["muzzle"]);
    expect(panelScanOf(reading).namedNotCut?.map((one) => [one.noun, one.why])).toEqual([["snout", "uncut"]]);
  });

  it("CONTROL — the same snout beside a face-skin cut somewhere else is drawn", async () => {
    const face = { x: 100, y: 200, width: 400, height: 500 };
    const reader = pointingReader({ snout: [face] });
    const asked = reader.region.bind(reader);
    (reader as any).region = async (input: { name: string }) =>
      (input.name === "face skin" ? maskOf({ x: 600, y: 900, width: 200, height: 200 }) : asked(input as never));
    const { deps } = await dependencies(reader);

    const reading = await scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => discoveryOf([{ name: "snout", count: 1 }]) },
    });

    expect(reading.discovered.map((one) => one.noun)).toEqual(["snout"]);
  });

  it("a reading whose pointer road fails is the reading it would have been anyway", async () => {
    const reader = pointingReader({});
    (reader as any).pointer = async () => { throw new MaskError("429 concurrent_requests_limit"); };
    const { deps } = await dependencies(reader);

    const reading = await scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => discoveryOf([{ name: "jacket", count: 1 }]) },
    });

    expect(reading.discovered).toEqual([]);
    expect(reading.slots.size).toBeGreaterThan(0);
    /* And the pointer road's failure is NOT recorded as a failed region:
       `failed` is a list of catalogue QUESTIONS, which the panel reads.
       ⚠ This comment went on *"so a detector's bad minute would otherwise
       condemn the whole catalogue reading and re-buy it on the next look"*
       until #2833, and that re-buy is now exactly what happens, by another
       road: a reading whose found rows were lost on weather is served and not
       kept (`foundRowsLost`), because keeping it made the loss permanent. That
       is the missing-eyes law's own trade, and his round-9 panel is its cost.
       The arms are "a reading that lost its found rows is served and not
       kept" above. */
    expect(reading.failed.map((one) => one.question)).not.toContain("jacket");
  });

  it("a discovery that fails buys no pointer call and changes nothing", async () => {
    const reader = pointingReader({ jacket: [{ x: 10, y: 10, width: 20, height: 20 }] });
    const { deps } = await dependencies(reader);

    const reading = await scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => ({ ok: false, why: "no crop produced a usable reading" }) },
    });

    expect(reader.pointed()).toEqual([]);
    expect(reading.discovered).toEqual([]);
    expect(reading.slots.size).toBeGreaterThan(0);
  });

  /*
    ⚠ ONE THING, ONE ROW, ACROSS THE SEAM (#2789). The catalogue's cuts exist
    only once `scanFace` resolves, and the pointer road runs beside it: these
    arms are what redden if the scan's cuts stop reaching the road — every
    pointerCut arm would still pass against a catalogue handed in by hand.
  */
  const worn = (name: string, on: string): DiscoveredFeature => (
    { ...discoveredFeature(name), kind: "accessory", on }
  );

  it("a found cut that is a catalogue row's own cut is never drawn again (#2789)", async () => {
    /* The counting reader answers every catalogue question with ONE triangle at
       (10,20 30x40); a found cut on exactly those pixels is that row. */
    const reader = pointingReader({
      "ear piercing": [{ x: 10, y: 20, width: 30, height: 40 }],
      jacket: [{ x: 100, y: 200, width: 300, height: 400 }],
    });
    const { deps } = await dependencies(reader);
    const reading = await scannedFace({
      ...FACE,
      dependencies: {
        ...deps,
        discover: async () => ({
          ok: true,
          features: [worn("ear piercing", "ear"), discoveredFeature("jacket")],
          cannotSee: [],
          unusable: [],
          crops: ["head", "full"],
        }),
      },
    });
    expect(reader.pointed().sort()).toEqual(["ear piercing", "jacket"]);
    expect(reading.discovered.map((one) => one.noun)).toEqual(["jacket"]);
    /* Drawn as the catalogue's row, so not a name nothing could cut. */
    expect(reading.namedNotCut).toEqual([]);
  });

  it("a box from the product's word is kept only where the scan cut that kind's site (#2789)", async () => {
    const run = async (noseStud: { x: number; y: number; width: number; height: number }) => {
      resetFaceScanCache();
      const reader = pointingReader({ "nose stud": [noseStud] });
      const { deps } = await dependencies(reader);
      return scannedFace({
        ...FACE,
        dependencies: {
          ...deps,
          discover: async () => ({
            ok: true,
            features: [worn("septum ring", "nose")],
            cannotSee: [],
            unusable: [],
            crops: ["head", "full"],
          }),
        },
      });
    };
    /* Inside the nose the scan cut: drawn, under the reading's noun. */
    const on = await run({ x: 20, y: 30, width: 10, height: 10 });
    expect(on.discovered.map((one) => one.noun)).toEqual(["septum ring"]);
    /* On the far side of the frame — his star, the lip stud at 768 px — refused. */
    const off = await run({ x: 600, y: 900, width: 20, height: 20 });
    expect(off.discovered).toEqual([]);
    expect(off.namedNotCut.map((one) => `${one.noun}:${one.why}`)).toEqual(["septum ring:uncut"]);
  });

  /*
    ⚠ THE SETTLED READING IS WHAT GETS KEPT, so it has to WAIT for the pointer
    road. This arm is the one that reddens if `discovering` goes back to being
    fired and forgotten: a settled answer that omitted the jacket would be
    written down as complete and the jacket would never arrive on that frame.
  */
  it("the settled reading waits for the found rows rather than resolving without them", async () => {
    const reader = pointingReader({ jacket: [{ x: 10, y: 10, width: 20, height: 20 }] });
    (reader as any).pointer = async ({ name }: { name: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return name === "jacket" ? [{ x: 10, y: 10, width: 20, height: 20 }] : [];
    };
    const { deps } = await dependencies(reader);

    const reading = await scannedFace({
      ...FACE,
      dependencies: { ...deps, discover: async () => discoveryOf([{ name: "jacket", count: 1 }]) },
    });
    expect(reading.discovered).toHaveLength(1);
  });
});
