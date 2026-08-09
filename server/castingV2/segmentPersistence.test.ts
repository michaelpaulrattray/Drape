import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Keeping the pixels a render earned.
 *
 * Three orderings are the whole subject: the manifest before the bytes, the
 * rows after them, and a failure that costs the delivered picture nothing.
 * Each of those is a real incident wearing a new hat — the diagnostics frames
 * that registered nothing, the variant landing's own register-before-write, and
 * every "a control that refuses too hard becomes an outage" case in this
 * program's history.
 */

const events: string[] = [];
const calls = {
  manifest: vi.fn(),
  store: vi.fn(),
  record: vi.fn(),
};

vi.mock("../db/connection", () => ({
  withTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
}));

vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: (_tx: unknown, input: unknown) => {
    events.push("manifest");
    return calls.manifest(input);
  },
}));

const { persistSegmentsForVariant, keepSegmentsFromRender, SEGMENT_KEY_PREFIX } = await import("./segmentPersistence");
const { cutSegments } = await import("./segmentCuts");
import type { Mask, Raster } from "./maskedComposite";

function mask(width: number, height: number, claim: (x: number, y: number) => boolean): Mask {
  const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = claim(x, y) ? 255 : 0;
  }
  return { data, width, height };
}

const composite: Raster = { data: Buffer.alloc(8 * 8 * 3, 120), width: 8, height: 8 };

const cuts = cutSegments({
  composite,
  applied: mask(8, 8, (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6),
  facetRegions: new Map([["marks", "face skin"]]),
  regionMasks: new Map([["face skin", mask(8, 8, () => true)]]),
});

const dependencies = {
  enabledFor: () => true,
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
  calls.record.mockResolvedValue([{ id: 1, publicId: "p", candidateId: 9, facet: "marks", version: 1, retired: 0 }]);
});

describe("persisting a render's segments", () => {
  it("registers the objects for cleanup BEFORE writing a single byte", async () => {
    const result = await persistSegmentsForVariant({ userId: 1, variantId: 2, cuts, dependencies });

    expect(result.outcome).toBe("stored");
    /*
      The order is the safety property. Bytes at a permanently public key with
      no row that knows they exist is the diagnostics incident exactly; here the
      keys are handed to the cleanup worker first, and the row insert discharges
      that manifest as its last act.
    */
    expect(events).toEqual(["manifest", "store:mask", "store:content", "record"]);

    const [manifest] = calls.manifest.mock.calls[0] as [
      { kind: string; storageItems: Array<{ storageKey: string }> },
    ];
    expect(manifest.kind).toBe("casting_candidate_cleanup");
    expect(manifest.storageItems.map((item) => item.storageKey)).toEqual(
      calls.store.mock.calls.map(([input]) => (input as { key: string }).key),
    );
    for (const item of manifest.storageItems) {
      expect(item.storageKey.startsWith(`${SEGMENT_KEY_PREFIX}/`)).toBe(true);
    }
  });

  it("hands the row writer the same batch it reserved, and the cut's own geometry", async () => {
    await persistSegmentsForVariant({ userId: 1, variantId: 2, cuts, verdict: "verified", dependencies });

    const [written] = calls.record.mock.calls[0] as [{
      cleanupBatchId: string;
      verdict: string | null;
      patches: Array<{ facet: string; region: string; geometry: unknown }>;
    }];
    const [manifest] = calls.manifest.mock.calls[0] as [{ id: string }];
    expect(written.cleanupBatchId).toBe(manifest.id);
    expect(written.verdict).toBe("verified");
    expect(written.patches[0].facet).toBe("marks");
    expect(written.patches[0].region).toBe("face skin");
    expect(written.patches[0].geometry).toEqual({
      bbox: { x: 2, y: 2, width: 4, height: 4 },
      frame: { width: 8, height: 8 },
    });
  });

  it("does nothing at all while the store is dark", async () => {
    const result = await persistSegmentsForVariant({
      userId: 1,
      variantId: 2,
      cuts,
      dependencies: { ...(dependencies as object), enabledFor: () => false } as never,
    });

    expect(result.outcome).toBe("off");
    // Not even a manifest: a dark deployment does not touch storage or the
    // database on the paid path.
    expect(events).toEqual([]);
  });

  it("lets the delivered picture stand when the upload fails", async () => {
    const result = await persistSegmentsForVariant({
      userId: 1,
      variantId: 2,
      cuts,
      dependencies: {
        ...(dependencies as object),
        store: async () => { throw new Error("R2 unavailable"); },
      } as never,
    });

    /*
      Never throws. The caller is a landed, paid render — refusing it because a
      mask did not upload would take back a picture the user can already see.
      The objects that did get written are still on the manifest, so the
      failure path collects itself.
    */
    expect(result.outcome).toBe("failed");
    expect(calls.record).not.toHaveBeenCalled();
  });

  it("survives the row writer failing, and files nothing", async () => {
    calls.record.mockRejectedValue(new Error("manifest_claimed"));
    const result = await persistSegmentsForVariant({ userId: 1, variantId: 2, cuts, dependencies });
    expect(result.outcome).toBe("failed");
    expect(result.segments).toEqual([]);
  });
});

describe("cutting a landed render", () => {
  const png = { bytes: Buffer.alloc(0) };

  it("keeps nothing when the composite left no evidence", async () => {
    // No evidence means no composite happened. Inventing a segment from the
    // whole frame would file her entire face as one facet's property.
    const result = await keepSegmentsFromRender({
      userId: 1,
      variantId: 2,
      image: { ...png, evidence: null },
      facets: ["marks"],
      dependencies,
    });
    expect(result.outcome).toBe("nothing-to-keep");
    expect(events).toEqual([]);
  });

  it("keeps nothing, and reads no frame, when the store is dark", async () => {
    const result = await keepSegmentsFromRender({
      userId: 1,
      variantId: 2,
      // Deliberately unreadable bytes: proving the flag check comes first, not
      // that decoding is tolerant.
      image: { bytes: Buffer.from("not a png"), evidence: null },
      facets: ["marks"],
      dependencies: { ...(dependencies as object), enabledFor: () => false } as never,
    });
    expect(result.outcome).toBe("off");
  });

  it("keeps nothing for facets with no masked path at all", async () => {
    const result = await keepSegmentsFromRender({
      userId: 1,
      variantId: 2,
      image: {
        bytes: Buffer.from("not a png"),
        evidence: { applied: mask(8, 8, () => true), masterRegions: new Map() },
      },
      // `age` has no segmentation question, so there is no region to own.
      facets: ["age"],
      dependencies,
    });
    expect(result.outcome).toBe("nothing-to-keep");
    expect(events).toEqual([]);
  });
});
