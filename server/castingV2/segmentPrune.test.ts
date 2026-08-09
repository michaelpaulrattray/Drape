import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { pruneSegmentFacet } from "./segmentPrune";
import type { StoredSegment } from "../db/castingV2Segments";

/**
 * Taking one thing back off her face.
 *
 * Two properties carry this whole module. The record moves BEFORE the picture
 * is rebuilt, so a frame can never disagree with the database about what she
 * is wearing. And a facet with no segment refuses rather than reporting
 * success — the glasses she was rolled wearing do not come off by dropping a
 * row, and a caller told "done" would show her a picture with them still on.
 */

async function png(width: number, height: number, channels: 1 | 3, value: number): Promise<Buffer> {
  return sharp(Buffer.alloc(width * height * channels, value), { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

const row = (over: Partial<StoredSegment> = {}): StoredSegment => ({
  id: 1,
  publicId: "seg-1",
  candidateId: 9,
  variantId: 4,
  provenance: "edit_patch",
  facet: "marks",
  region: "face skin",
  version: 1,
  maskKey: "segments/a-mask.png",
  contentKey: "segments/a-content.png",
  geometry: { bbox: { x: 1, y: 1, width: 2, height: 2 }, frame: { width: 8, height: 8 } },
  verifiedAt: null,
  verdict: "verified",
  detector: null,
  retiredAt: null,
  createdAt: new Date("2026-08-09T00:00:00Z"),
  ...over,
});

async function readBytes() {
  const mask = await png(2, 2, 1, 255);
  const content = await png(2, 2, 3, 200);
  return async (key: string) => ({
    bytes: key.includes("mask") ? mask : content,
    contentType: "image/png",
  });
}

async function master() {
  return { bytes: await png(8, 8, 3, 10), contentType: "image/png" };
}

const enabledFor = () => true;

describe("dropping a facet", () => {
  it("rebuilds the picture from what is left, with no render at all", async () => {
    const order: string[] = [];
    const result = await pruneSegmentFacet({
      userId: 1,
      candidateId: 9,
      facet: "hair.colour",
      master: await master(),
      dependencies: {
        enabledFor,
        retire: async () => { order.push("retire"); return 1; },
        list: async () => { order.push("list"); return [row()]; },
        readBytes: await readBytes(),
      },
    });

    expect(result.outcome).toBe("recomposited");
    if (result.outcome !== "recomposited") return;
    // What survived is still on her face…
    expect(result.carriedFacets).toEqual(["marks"]);
    expect(result.evidence.segmentsApplied).toHaveLength(1);
    // …and the record moved before the picture was built from it.
    expect(order).toEqual(["retire", "list"]);
  });

  it("refuses a facet it has nothing kept for, rather than reporting success", async () => {
    const list = vi.fn();
    const result = await pruneSegmentFacet({
      userId: 1,
      candidateId: 9,
      facet: "glasses",
      master: await master(),
      dependencies: { enabledFor, retire: async () => 0, list: list as never, readBytes: await readBytes() },
    });

    /*
      Either she never bought that facet, or it is something she was born
      wearing — and the second one needs a render into the skin behind it, not
      a row change. Saying "done" here shows her a picture with the glasses on.
    */
    expect(result).toEqual({ outcome: "nothing-to-drop" });
    expect(list).not.toHaveBeenCalled();
  });

  it("gives back the master itself when the last segment goes", async () => {
    const original = await master();
    const result = await pruneSegmentFacet({
      userId: 1,
      candidateId: 9,
      facet: "marks",
      master: original,
      dependencies: {
        enabledFor,
        retire: async () => 1,
        list: async () => [],
        readBytes: await readBytes(),
      },
    });

    expect(result.outcome).toBe("recomposited");
    if (result.outcome !== "recomposited") return;
    expect(result.carriedFacets).toEqual([]);
    // Her sharp original, unmodified — the base of every assembly.
    const rebuilt = await sharp(result.bytes).removeAlpha().raw().toBuffer();
    const master8 = await sharp(original.bytes).removeAlpha().raw().toBuffer();
    expect(rebuilt.equals(master8)).toBe(true);
  });

  it("does nothing, and drops nothing, while the store is dark", async () => {
    const retire = vi.fn();
    const result = await pruneSegmentFacet({
      userId: 1,
      candidateId: 9,
      facet: "marks",
      master: await master(),
      dependencies: { enabledFor: () => false, retire: retire as never },
    });
    expect(result).toEqual({ outcome: "off" });
    expect(retire).not.toHaveBeenCalled();
  });

  it("lets a store failure out — a rebuild it cannot read is not a rebuild", async () => {
    await expect(pruneSegmentFacet({
      userId: 1,
      candidateId: 9,
      facet: "hair.colour",
      master: await master(),
      dependencies: {
        enabledFor,
        retire: async () => 1,
        list: async () => { throw new Error("Deadlock found"); },
        readBytes: await readBytes(),
      },
    })).rejects.toThrow(/Deadlock/);
  });
});
