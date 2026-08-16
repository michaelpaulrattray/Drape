import { describe, expect, it } from "vitest";

import { keepScan, serveKeptScan, type KeptScanShape } from "./keptFaceScan";
import type { FeatureSlot } from "./recipeAssembler";
import type { PanelBox } from "./facePanel";

/**
 * KEEPING A SCAN, DRIVEN DIRECTLY.
 *
 * Every dependency is injected, so nothing here needs a database, a bucket or a
 * segmenter — and, more to the point, nothing here is proved THROUGH a scan.
 * A store whose only exercise runs behind fourteen model calls is a store
 * nobody has tested: this program has paid for that shape twice (the segment
 * store shipped inert; the reference library's guard was proved only through
 * the thing that used it).
 */
const box = (x: number): PanelBox => ({ x, y: 20, width: 30, height: 40, frame: { width: 1000, height: 1500 } });

/** A one-pixel PNG, base64'd exactly as the panel carries a stencil. */
const STENCIL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const dataUrl = `data:image/png;base64,${STENCIL.toString("base64")}`;

const shape = (slots: readonly FeatureSlot[]): KeptScanShape => ({
  slots: new Map(slots.map((slot, at) => [slot, { box: box(10 * at), maskUrl: dataUrl }])),
  words: new Map([["skin" as FeatureSlot, ["a warm even tan"]]]),
  asked: 12,
  empty: ["horn"],
  stencilBytes: 8360,
  sides: "eye:LR brow:LR ear:LR horns:-- earring:--",
});

/** A bucket and a table, in memory, recording the order they were used in. */
function bench() {
  const objects = new Map<string, Buffer>();
  const manifested: string[][] = [];
  const rows: any[] = [];
  const journal: string[] = [];
  return {
    objects,
    manifested,
    rows,
    journal,
    dependencies: {
      store: async (one: { key: string; bytes: Buffer }) => {
        journal.push(`store:${one.key}`);
        objects.set(one.key, one.bytes);
      },
      manifest: async (one: { storageKeys: readonly string[] }) => {
        journal.push("manifest");
        manifested.push([...one.storageKeys]);
      },
      write: async (row: any) => { journal.push("write"); rows.push(row); },
      read: async () => rows.at(-1) ?? null,
      readBytes: async (key: string) => {
        const bytes = objects.get(key);
        return bytes ? { bytes, contentType: "image/png" } : (null as never);
      },
    },
  };
}

describe("what a kept scan writes", () => {
  it("registers every stencil for cleanup BEFORE writing a single one", async () => {
    const it_ = bench();
    const kept = await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: shape(["eye@left", "hair"] as FeatureSlot[]),
      dependencies: it_.dependencies,
    });

    expect(kept).toEqual({ kept: true, objects: 2 });
    /*
      THE ORDER IS THE ASSERTION. A crash between the object write and the row
      insert leaves stencils nothing points at, and the sweep only finds what a
      row names — so the manifest has to exist before the bytes do. Asserting
      "both happened" would pass on the broken order.
    */
    expect(it_.journal[0]).toBe("manifest");
    expect(it_.journal.filter((step) => step.startsWith("store:"))).toHaveLength(2);
    expect(it_.journal.at(-1)).toBe("write");
    expect(it_.manifested[0]).toEqual(Array.from(it_.objects.keys()));
  });

  it("keeps the geometry and the frame it was measured on, never the bytes", async () => {
    const it_ = bench();
    await keepScan({
      userId: 1, candidateId: 41, variantId: 12, frameKey: "faces/v1.png",
      scan: shape(["eye@left"] as FeatureSlot[]),
      dependencies: it_.dependencies,
    });

    const row = it_.rows[0];
    const stored = JSON.stringify(row.geometry);
    /* The founder's storage condition, at the row: a stencil in here is 10× the
       row and 4.7 GB of MySQL at ten thousand users. */
    expect(stored).not.toContain("base64");
    expect(row.geometry.slots[0].maskKey).toMatch(/^casting-v2\/scans\/[0-9a-f-]{36}\.png$/);
    /* A box without its frame is a rectangle in an unknown space. */
    expect(row.geometry.slots[0].box.frame).toEqual({ width: 1000, height: 1500 });
    expect(row.frameKey).toBe("faces/v1.png");
    expect(row.stencilBytes).toBe(8360);
  });

  it("never lets its own failure reach the customer", async () => {
    /* She already has her panel. A row is bookkeeping, and bookkeeping may not
       break a courtesy read — the next look simply pays again. */
    const it_ = bench();
    const kept = await keepScan({
      userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png",
      scan: shape(["eye@left"] as FeatureSlot[]),
      dependencies: {
        ...it_.dependencies,
        store: async () => { throw new Error("R2 said no"); },
      },
    });
    expect(kept).toEqual({ kept: false, objects: 0 });
    expect(it_.rows, "and no row claims objects that were never written").toHaveLength(0);
  });
});

describe("what a kept scan serves", () => {
  const face = { userId: 1, candidateId: 41, variantId: null, frameKey: "faces/v1.png" };

  it("hands back the same boxes and stencils it was given", async () => {
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });

    const served = await serveKeptScan({ ...face, dependencies: it_.dependencies });

    expect(served?.slots.size).toBe(2);
    expect(served?.slots.get("eye@left" as FeatureSlot)?.maskUrl).toBe(dataUrl);
    expect(served?.slots.get("eye@left" as FeatureSlot)?.box).toEqual(box(0));
    expect(served?.words.get("skin" as FeatureSlot)).toEqual(["a warm even tan"]);
    expect(served?.asked).toBe(12);
    expect(served?.empty).toEqual(["horn"]);
    expect(served?.sides).toBe("eye:LR brow:LR ear:LR horns:-- earring:--");
  });

  it("REFUSES a reading taken from a frame that has since moved", async () => {
    /*
      The version now points at different bytes, so the kept reading is a
      reading of a picture that is no longer on screen. Serving it would draw
      last week's ear on this week's face — the reference-whose-bytes-moved
      door, on a new road.
    */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left"] as FeatureSlot[]), dependencies: it_.dependencies });

    expect(await serveKeptScan({ ...face, frameKey: "faces/v2.png", dependencies: it_.dependencies })).toBeNull();
  });

  it("CONTROL — the same call on the same frame does serve", async () => {
    /* The negative control for the arm above: if this also returned null, the
       refusal would be a constant and would prove nothing about frameKey. */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left"] as FeatureSlot[]), dependencies: it_.dependencies });
    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).not.toBeNull();
  });

  it("condemns the whole reading when one stencil will not fetch", async () => {
    /* A panel with a hole in it is the founder's own complaint arriving by a
       new road — better to re-scan than to draw a face missing an ear. */
    const it_ = bench();
    await keepScan({ ...face, scan: shape(["eye@left", "hair"] as FeatureSlot[]), dependencies: it_.dependencies });
    it_.objects.delete(Array.from(it_.objects.keys())[1]!);

    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  it("says SCAN THIS FACE when there is no row at all", async () => {
    const it_ = bench();
    expect(await serveKeptScan({ ...face, dependencies: it_.dependencies })).toBeNull();
  });

  it("says SCAN THIS FACE when the database will not answer", async () => {
    const it_ = bench();
    const served = await serveKeptScan({
      ...face,
      dependencies: { ...it_.dependencies, read: async () => { throw new Error("the database said no"); } },
    });
    expect(served, "one outcome, because every cause has the same right answer").toBeNull();
  });
});
