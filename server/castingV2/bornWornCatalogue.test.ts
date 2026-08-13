import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Filing what the master already had.
 *
 * The orderings are the patch writer's, and they are tested again rather than
 * assumed shared: manifest before bytes, rows after bytes, failure silent to
 * her. What is new here is the re-scan — the cheap half of idempotency has to
 * sit in FRONT of the vision call or "re-runnable because detectors improve"
 * means paying a segmenter to tell us what a row already says.
 */
import sharp from "sharp";

const events: string[] = [];
const calls = {
  manifest: vi.fn(),
  store: vi.fn(),
  record: vi.fn(),
};

vi.mock("../db/connection", () => ({
  withTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
}));

/* Stubbed with a sentinel so this suite proves the catalogue passes THE SHARED
   derivation rather than a number of its own; what the derivation is worth is
   proved in `server/db/storageCleanupHold.test.ts`. */
const HELD_UNTIL = new Date("2031-01-01T00:00:00.000Z");

vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: (_tx: unknown, input: unknown) => {
    events.push("manifest");
    return calls.manifest(input);
  },
  storageCleanupManifestHeldUntil: () => HELD_UNTIL,
}));

const { catalogueBornWorn } = await import("./bornWornCatalogue");
import { armedBornWornClasses } from "./bornWornDetector";
import type { Mask } from "./maskedComposite";
import type { StoredSegment } from "../db/castingV2Segments";

const FRAME = { width: 40, height: 40 };

async function masterPng(): Promise<Buffer> {
  return sharp(Buffer.alloc(FRAME.width * FRAME.height * 3, 90), {
    raw: { width: FRAME.width, height: FRAME.height, channels: 3 },
  }).png().toBuffer();
}

/** A box of `size`×`size` in the top-left — 100 pixels of 1,600 is 6.25%. */
function boxMask(size: number, width = FRAME.width, height = FRAME.height): Mask {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < size; y += 1) data.fill(255, y * width, y * width + size);
  return { data, width, height };
}

function reader(mask: Mask) {
  return {
    region: vi.fn(async () => {
      events.push("read");
      return mask;
    }),
    subject: vi.fn(async () => mask),
    landmark: vi.fn(async () => []),
  };
}

function storedDetection(overrides: Partial<StoredSegment> = {}): StoredSegment {
  return {
    id: 7,
    publicId: "seg",
    candidateId: 9,
    variantId: null,
    provenance: "detected_born",
    facet: "glasses",
    region: "glasses",
    version: 1,
    maskKey: "m",
    contentKey: "c",
    geometry: { bbox: { x: 0, y: 0, width: 10, height: 10 }, frame: FRAME },
    verifiedAt: null,
    verdict: null,
    detector: "sam3-coverage@1",
    retiredAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

const dependencies = {
  enabledFor: () => true,
  list: async () => [] as StoredSegment[],
  store: async (input: { key: string; bytes: Buffer; contentType: string }) => {
    events.push(`store:${input.key.includes("mask") ? "mask" : "content"}`);
    calls.store(input);
    return { key: input.key };
  },
  record: async (input: never) => {
    events.push("record");
    return calls.record(input);
  },
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  events.length = 0;
  calls.manifest.mockResolvedValue(undefined);
  calls.record.mockResolvedValue([
    { id: 1, publicId: "p", candidateId: 9, facet: "glasses", version: 1, retired: 0 },
  ]);
});

describe("cataloguing a master", () => {
  it("files a detection as a FACT — no variant, no verdict", async () => {
    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: reader(boxMask(10)),
      dependencies,
    });

    expect(result.outcome).toBe("catalogued");
    const filed = calls.record.mock.calls[0][0];
    expect(filed.detector).toBe("sam3-coverage@1");
    expect(filed.detections).toHaveLength(1);
    expect(filed.detections[0]).toMatchObject({
      facet: "glasses",
      region: "glasses",
      geometry: { bbox: { x: 0, y: 0, width: 10, height: 10 }, frame: FRAME },
    });
    /* The writer refuses a verdict; the caller never gets to offer one. */
    expect(filed).not.toHaveProperty("verdict");
    expect(filed).not.toHaveProperty("variantId");
  });

  it("registers the objects for cleanup BEFORE writing a single byte", async () => {
    await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: reader(boxMask(10)),
      dependencies,
    });

    expect(events).toEqual(["read", "manifest", "store:mask", "store:content", "record"]);

    /*
      BORN HELD — registering first is only safe while something holds the
      manifest. This batch carries a synthetic operation id, so the worker's
      in-flight fence matches no operation and passes trivially; unheld, the
      manifest is claimable in the window between the manifest and the record.
    */
    const [manifest] = calls.manifest.mock.calls[0] as [{ heldUntil?: Date }];
    expect(manifest.heldUntil).toBe(HELD_UNTIL);
  });

  /*
    THE RE-SCAN, and the order of these two events is the whole point: the read
    that decides whether to ask comes BEFORE the asking. A catalogue that
    re-segments a master to discover it already has the answer is a catalogue
    that charges the product for its own memory.
  */
  it("asks nothing when this detector already holds the class", async () => {
    const eyes = reader(boxMask(10));
    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: eyes,
      dependencies: { ...(dependencies as object), list: async () => [storedDetection()] } as never,
    });

    expect(result.outcome).toBe("already-catalogued");
    expect(eyes.region).not.toHaveBeenCalled();
    expect(calls.manifest).not.toHaveBeenCalled();
    expect(calls.record).not.toHaveBeenCalled();
  });

  /*
    A CLASS THIS PATH CANNOT FILE IS NOT WORK OUTSTANDING.

    Earrings are armed — the panel scan reads them per side — and this catalogue
    writes one row per class from one whole-frame reading, which for a pair is
    both ears at once. So it never wants them, and a master whose glasses are
    already held is FINISHED rather than perpetually one class short. Without
    this, every re-scan of every catalogued face would report "nothing found"
    and re-run its refusal forever.
  */
  it("never wants a kind it has no way to file", async () => {
    const armed = armedBornWornClasses().map((entry) => entry.id);
    expect(armed).toContain("earring");
    expect(armedBornWornClasses().find((entry) => entry.id === "earring")!.pair).toBe(true);

    const eyes = reader(boxMask(10));
    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: eyes,
      dependencies: { ...(dependencies as object), list: async () => [storedDetection()] } as never,
    });

    expect(result.outcome).toBe("already-catalogued");
    expect(eyes.region).not.toHaveBeenCalled();
  });

  it("re-reads for a BETTER detector, and leaves the old row's name alone", async () => {
    const eyes = reader(boxMask(10));
    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: eyes,
      dependencies: {
        ...(dependencies as object),
        list: async () => [storedDetection({ detector: "sam3-coverage@1" })],
        detector: "sam3-coverage@2",
      } as never,
    });

    expect(result.outcome).toBe("catalogued");
    expect(eyes.region).toHaveBeenCalledTimes(1);
    expect(calls.record.mock.calls[0][0].detector).toBe("sam3-coverage@2");
  });

  it("ignores a retired row's class — a fact taken back is a fact to re-earn", async () => {
    const eyes = reader(boxMask(10));
    await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: eyes,
      /* `listLiveSegments` never returns retired rows; a patch row is not a fact. */
      dependencies: {
        ...(dependencies as object),
        list: async () => [storedDetection({ provenance: "edit_patch", detector: null })],
      } as never,
    });

    expect(eyes.region).toHaveBeenCalledTimes(1);
  });

  it("writes nothing at all when she is wearing none of them", async () => {
    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      /* One pixel of 1,600 is 0.06% — under the floor. */
      reader: reader(boxMask(1)),
      dependencies,
    });

    expect(result.outcome).toBe("nothing-found");
    expect(calls.manifest).not.toHaveBeenCalled();
    expect(calls.store).not.toHaveBeenCalled();
  });

  /*
    NEVER RESIZE A MASK TO FIT. A mask measured against another frame does not
    fail when cropped — it names the wrong part of her face, and the row would
    say so forever.
  */
  it("refuses a detection measured against a different frame", async () => {
    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: reader(boxMask(10, 80, 80)),
      dependencies,
    });

    expect(result.outcome).toBe("nothing-found");
    expect(result.excluded).toEqual([
      { facet: "glasses", reason: "frameMismatch", detail: "80x80 against 40x40" },
    ]);
    expect(calls.store).not.toHaveBeenCalled();
  });

  it("is dark until the flag names her — no read, no bytes, no row", async () => {
    const eyes = reader(boxMask(10));
    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: eyes,
      dependencies: { ...(dependencies as object), enabledFor: () => false } as never,
    });

    expect(result.outcome).toBe("off");
    expect(eyes.region).not.toHaveBeenCalled();
    expect(calls.manifest).not.toHaveBeenCalled();
  });

  it("costs the cast nothing when the store itself fails", async () => {
    calls.record.mockRejectedValue(new Error("MySQL has gone away"));

    const result = await catalogueBornWorn({
      userId: 1,
      candidateId: 9,
      master: await masterPng(),
      reader: reader(boxMask(10)),
      dependencies,
    });

    expect(result.outcome).toBe("failed");
    expect(result.segments).toEqual([]);
    /* The manifest still holds the objects — the failure path collects itself. */
    expect(events).toEqual(["read", "manifest", "store:mask", "store:content", "record"]);
  });
});
