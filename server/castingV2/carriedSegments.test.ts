import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { assembleWithCarriedSegments, loadCarriedSegments } from "./carriedSegments";
import type { StoredSegment } from "../db/castingV2Segments";

/**
 * Fetching what this face already has.
 *
 * The two failure modes are the subject, and the spec is emphatic that they
 * are different: a store that cannot be read refuses the whole render, while
 * one missing object costs one facet its permanence. Getting that backwards in
 * either direction is a real harm — a silently-short paste, or an outage over
 * a single unreadable mask.
 */

const geometry = {
  bbox: { x: 1, y: 1, width: 2, height: 2 },
  frame: { width: 8, height: 8 },
};

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
  geometry,
  verifiedAt: null,
  verdict: "verified",
  detector: null,
  retiredAt: null,
  createdAt: new Date("2026-08-09T00:00:00Z"),
  ...over,
});

async function png(width: number, height: number, channels: 1 | 3, value: number): Promise<Buffer> {
  return sharp(Buffer.alloc(width * height * channels, value), { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

async function objects() {
  const mask = await png(2, 2, 1, 255);
  const content = await png(2, 2, 3, 200);
  return async (key: string) => ({
    bytes: key.includes("mask") ? mask : content,
    contentType: "image/png",
  });
}

const enabledFor = () => true;

describe("loading a face's kept segments", () => {
  it("reads a segment's mask and crop back at its stored geometry", async () => {
    const load = await loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      dependencies: { enabledFor, list: async () => [row()], readBytes: await objects() },
    });

    expect(load.excluded).toEqual([]);
    expect(load.segments).toHaveLength(1);
    expect(load.segments[0]).toMatchObject({ id: 1, facet: "marks", version: 1 });
    expect(load.segments[0].mask.width).toBe(2);
    // One byte per pixel, or every loop that walks it runs three times too far.
    expect(load.segments[0].mask.data.length).toBe(4);
    expect(load.segments[0].content.data.length).toBe(2 * 2 * 3);
    expect(load.segments[0].frame).toEqual({ width: 8, height: 8 });
  });

  it("does not carry a facet this edit is writing", async () => {
    // The current ask outranks its own memory: a segment for the facet being
    // repainted would be pasted under the fresh paint at best.
    const load = await loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: ["marks"],
      dependencies: { enabledFor, list: async () => [row()], readBytes: await objects() },
    });
    expect(load.segments).toEqual([]);
  });

  it("does not carry a detected-born segment", async () => {
    // It has no pixels to re-composite: it is already in the master, and the
    // master is the base of every assembly.
    const load = await loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      dependencies: {
        enabledFor,
        list: async () => [row({ provenance: "detected_born", facet: "glasses", variantId: null })],
        readBytes: await objects(),
      },
    });
    expect(load.segments).toEqual([]);
  });

  it("keeps the readable segments when one is unreadable", async () => {
    const readable = await objects();
    const load = await loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      dependencies: {
        enabledFor,
        list: async () => [
          row({ id: 1, facet: "marks", maskKey: "segments/gone-mask.png" }),
          row({ id: 2, facet: "hair.colour" }),
        ],
        readBytes: async (key: string) => {
          if (key.includes("gone")) throw new Error("NoSuchKey");
          return readable(key);
        },
      },
    });

    // One facet's lost permanence must not hold her whole edit hostage.
    expect(load.segments.map((segment) => segment.facet)).toEqual(["hair.colour"]);
    expect(load.excluded.map((entry) => entry.facet)).toEqual(["marks"]);
  });

  it("lets a store failure OUT, because that one is the caller's refusal", async () => {
    /*
      Not caught, deliberately. A face composited from a partial list looks
      exactly like a correct render — her freckles simply gone again, on a
      picture she paid for, with every instrument green.
    */
    await expect(loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      dependencies: {
        enabledFor,
        list: async () => { throw new Error("Deadlock found"); },
        readBytes: await objects(),
      },
    })).rejects.toThrow(/Deadlock/);
  });

  it("reads nothing at all while the store is dark", async () => {
    const list = vi.fn();
    const load = await loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      dependencies: { enabledFor: () => false, list: list as never, readBytes: await objects() },
    });
    expect(load).toEqual({ segments: [], excluded: [] });
    expect(list).not.toHaveBeenCalled();
  });

  /*
    THE BRANCH IS THE QUESTION, not the candidate (fable-091).

    "The layers are only what that currently selected image holds." The store is
    asked about ONE variant's own ancestry, and the anchor is the only thing
    that says which. Asserted at the wire, because a caller that dropped the
    anchor would silently be asking a different question.
  */
  it("asks the store about the SELECTED variant's own lineage", async () => {
    const list = vi.fn(async () => [row()]);
    await loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 7,
      writing: [],
      dependencies: { enabledFor, list: list as never, readBytes: await objects() },
    });
    expect(list).toHaveBeenCalledWith({ userId: 1, candidateId: 9, anchorVariantId: 7 });
  });

  it("carries nothing for an edit made from the candidate itself", async () => {
    const list = vi.fn();
    const load = await loadCarriedSegments({
      userId: 1,
      candidateId: 9,
      /* No branch yet: the first edit of a face has no ancestry to carry. */
      anchorVariantId: null,
      writing: [],
      dependencies: { enabledFor, list: list as never, readBytes: await objects() },
    });
    expect(load).toEqual({ segments: [], excluded: [] });
    expect(list).not.toHaveBeenCalled();
  });
});

/**
 * The product entry point: a harvested render plus what she already has.
 *
 * The refusal case is the one with teeth. Everything else here is about
 * leaving a render alone when there is nothing to add — which has to be exact,
 * because a segmentless render must be unable to tell any of this exists.
 */
describe("assembling a render with what she already has", () => {
  const harvestBytes = Buffer.from("harvested frame");
  const mask8 = (claim: (x: number, y: number) => number) => {
    const data = Buffer.alloc(64);
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) data[y * 8 + x] = claim(x, y);
    return { data, width: 8, height: 8 };
  };

  async function masterPng() {
    return { bytes: await png(8, 8, 3, 10), contentType: "image/png" };
  }

  it("hands back the harvest's own bytes while the store is dark", async () => {
    const result = await assembleWithCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      master: await masterPng(),
      harvested: {
        bytes: harvestBytes,
        contentType: "image/png",
        evidence: { applied: mask8(() => 255), masterRegions: new Map() },
      },
      dependencies: { enabledFor: () => false },
    });

    // Identity of the buffer itself, not merely equal content: nothing was
    // decoded, re-encoded, or touched.
    expect(result.bytes).toBe(harvestBytes);
    expect(result.carriedFacets).toEqual([]);
    expect(result.assembly).toBeNull();
  });

  it("hands back the harvest untouched when the masked path composited nothing", async () => {
    /*
      No `applied` mask means the frame is the engine's whole-face answer
      rather than a master-anchored composite. Pasting kept pixels onto a face
      that was entirely repainted would put an old jaw on a new one.
    */
    const result = await assembleWithCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      master: await masterPng(),
      harvested: { bytes: harvestBytes, contentType: "image/png", evidence: null },
      dependencies: { enabledFor, list: async () => [row()], readBytes: await objects() },
    });
    expect(result.bytes).toBe(harvestBytes);
  });

  it("hands back the harvest untouched when this face has kept nothing", async () => {
    const result = await assembleWithCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      master: await masterPng(),
      harvested: {
        bytes: harvestBytes,
        contentType: "image/png",
        evidence: { applied: mask8(() => 0), masterRegions: new Map() },
      },
      dependencies: { enabledFor, list: async () => [], readBytes: await objects() },
    });
    expect(result.bytes).toBe(harvestBytes);
  });

  it("REFUSES the render when the store cannot be read", async () => {
    /*
      Not a degradation. We do not know what belongs in this picture, so we do
      not deliver one — a face short of the edits she has already paid for
      looks exactly like a correct render, and she would have no way to tell.
    */
    const attempt = assembleWithCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      master: await masterPng(),
      harvested: {
        bytes: harvestBytes,
        contentType: "image/png",
        evidence: { applied: mask8(() => 0), masterRegions: new Map() },
      },
      dependencies: {
        enabledFor,
        list: async () => { throw new Error("Deadlock found"); },
        readBytes: await objects(),
      },
    });

    await expect(attempt).rejects.toMatchObject({
      // Its own class, because the receipt is the record: the provider was
      // fine and our compositor was fine.
      failureClass: "segment_store",
    });
  });

  it("puts a kept segment back into the delivered frame, and says what it did", async () => {
    const result = await assembleWithCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: ["hair.colour"],
      master: await masterPng(),
      harvested: {
        bytes: await png(8, 8, 3, 10),
        contentType: "image/png",
        evidence: { applied: mask8(() => 0), masterRegions: new Map() },
      },
      dependencies: { enabledFor, list: async () => [row()], readBytes: await objects() },
    });

    expect(result.carriedFacets).toEqual(["marks"]);
    expect(result.assembly?.segmentsApplied).toEqual([
      { id: 1, facet: "marks", version: 1, pixels: 4 },
    ]);
    // The delivered bytes are a new frame, and the carried ground is inside
    // `applied` so the composite cannot claim byte-identity over it.
    expect(result.bytes).not.toBe(harvestBytes);
    expect(result.evidence?.applied.data[1 * 8 + 1]).toBe(255);
  });

  it("carries the loader's exclusions into the same record as the assembly's", async () => {
    const readable = await objects();
    const result = await assembleWithCarriedSegments({
      userId: 1,
      candidateId: 9,
      anchorVariantId: 4,
      writing: [],
      master: await masterPng(),
      harvested: {
        bytes: await png(8, 8, 3, 10),
        contentType: "image/png",
        evidence: { applied: mask8(() => 0), masterRegions: new Map() },
      },
      dependencies: {
        enabledFor,
        list: async () => [row({ maskKey: "segments/gone-mask.png" })],
        readBytes: async (key: string) => {
          if (key.includes("gone")) throw new Error("NoSuchKey");
          return readable(key);
        },
      },
    });

    // One list of what did not make it into her picture, whatever the reason —
    // two lists would be two places to forget to read.
    expect(result.assembly?.segmentsExcluded).toEqual([
      { id: 1, facet: "marks", reason: "objectMissing", detail: "NoSuchKey" },
    ]);
  });
});
