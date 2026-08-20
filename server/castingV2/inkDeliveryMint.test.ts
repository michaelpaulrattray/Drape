/**
 * KEEPING THE TATTOO AS IT LANDED — the mint's ORDER and its failures, driven
 * with no segmenter, no storage and no database (clause (a), fable-1194 §2).
 *
 * # What is being guarded, and it is not the arithmetic
 *
 * The arithmetic has its own suite (`inkDeliveryCrop.test.ts`). What this file
 * guards is the thing that would hurt a customer: **this step runs after a
 * delivered, paid render, and nothing in it may take that picture back.** Every
 * failure below is driven to prove it comes back as an outcome and a log line
 * rather than as a throw the caller has to catch.
 *
 * And the ORDER — manifest, then bytes, then row. On this road the litter would
 * be a crop of a real person's neck at a permanently public URL with no row
 * naming it, so a mint that wrote bytes before registering them for cleanup
 * would leave one behind on any crash in between.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { mintInkDeliveryCrop } from "./inkDeliveryMint";
import type { Mask } from "./maskedComposite";

const WIDTH = 800;
const HEIGHT = 1000;

async function framePng(): Promise<Buffer> {
  return sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 120, g: 100, b: 90 } },
  }).png().toBuffer();
}

function maskOf(box: { left: number; top: number; width: number; height: number }): Mask {
  const data = Buffer.alloc(WIDTH * HEIGHT, 0);
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) data[y * WIDTH + x] = 255;
  }
  return { data, width: WIDTH, height: HEIGHT };
}

const INK = { left: 250, top: 300, width: 300, height: 320 };

type Call = { what: string; detail?: unknown };

function harness(over: {
  region?: () => Promise<Mask>;
  store?: () => Promise<{ key: string }>;
  record?: (input: unknown) => Promise<{ outcome: "minted"; publicId: string } | { outcome: "already" }>;
} = {}) {
  const calls: Call[] = [];
  const recorded: any[] = [];
  const stored: Array<{ key: string; bytes: Buffer }> = [];
  const dependencies = {
    reader: {
      region: async () => {
        calls.push({ what: "region" });
        return over.region ? over.region() : maskOf(INK);
      },
    },
    manifest: async (input: { id: string; userId: number; storageKeys: readonly string[] }) => {
      calls.push({ what: "manifest", detail: input.storageKeys });
    },
    store: async (input: { key: string; bytes: Buffer; contentType: string }) => {
      calls.push({ what: "store", detail: input.key });
      stored.push({ key: input.key, bytes: input.bytes });
      return over.store ? over.store() : { key: input.key };
    },
    record: async (input: any) => {
      calls.push({ what: "record" });
      recorded.push(input);
      return over.record
        ? await over.record(input)
        : { outcome: "minted" as const, publicId: "crop-1" };
    },
  } as any;
  return { calls, recorded, stored, dependencies };
}

async function mint(bag: ReturnType<typeof harness>, frame: Buffer) {
  return mintInkDeliveryCrop({
    userId: 1,
    candidatePublicId: "cast-1",
    variantPublicId: "variant-9",
    frame,
    design: { publicId: "design-7", slot: "ink:neck" },
    operationId: "op-1",
    dependencies: bag.dependencies,
  });
}

describe("the delivered tattoo is kept as it landed", () => {
  it("reads, cuts, registers, writes and files — in that order", async () => {
    const bag = harness();
    const outcome = await mint(bag, await framePng());
    expect(outcome.outcome).toBe("minted");
    /* MANIFEST BEFORE BYTES BEFORE ROW. A crash between the last two collects
       itself; the other order leaves a picture of a person nothing deletes. */
    expect(bag.calls.map((one) => one.what)).toEqual(["region", "manifest", "store", "record"]);
  });

  it("stores the CROP and files the geometry that places it", async () => {
    const bag = harness();
    await mint(bag, await framePng());
    const row = bag.recorded[0];
    expect(row.slot).toBe("ink:neck");
    expect(row.designPublicId).toBe("design-7");
    expect(row.variantPublicId).toBe("variant-9");
    expect(row.region).toBe("tattooed skin");
    /* The crop's own size is the box, and the frame's size rides beside it —
       a crop means nothing except against the frame it came from. */
    expect({ width: row.width, height: row.height }).toEqual({ width: INK.width, height: INK.height });
    expect({ x: row.bboxX, y: row.bboxY }).toEqual({ x: INK.left, y: INK.top });
    expect({ w: row.frameWidth, h: row.frameHeight }).toEqual({ w: WIDTH, h: HEIGHT });
    expect(row.maskPixels).toBe(INK.width * INK.height);
    expect(row.keptPixels).toBe(INK.width * INK.height);
    /* And the stored object really is that crop, read back off its own bytes
       rather than believed from the row beside it. */
    const stored = await sharp(bag.stored[0]!.bytes).metadata();
    expect({ width: stored.width, height: stored.height })
      .toEqual({ width: INK.width, height: INK.height });
  });

  it("the digest names the bytes that were stored", async () => {
    const bag = harness();
    await mint(bag, await framePng());
    const { createHash } = await import("node:crypto");
    expect(bag.recorded[0].digest)
      .toBe(createHash("sha256").update(bag.stored[0]!.bytes).digest("hex"));
  });

  it("MINTED ONCE: a duplicate is reported, not retried", async () => {
    const bag = harness({ record: async () => ({ outcome: "already" as const }) });
    const outcome = await mint(bag, await framePng());
    expect(outcome.outcome).toBe("already");
    /* One attempt. A mint that reacted to the index by updating would be the
       chained-anchor trap arriving through the back door. */
    expect(bag.calls.filter((one) => one.what === "record")).toHaveLength(1);
  });
});

describe("nothing here may take the picture back", () => {
  it("a frame with no ink on it files nothing and does not throw", async () => {
    const bag = harness({
      region: async () => ({ data: Buffer.alloc(WIDTH * HEIGHT, 0), width: WIDTH, height: HEIGHT }),
    });
    const outcome = await mint(bag, await framePng());
    expect(outcome).toMatchObject({ outcome: "no-cut", reason: "noInk" });
    expect(bag.calls.map((one) => one.what)).toEqual(["region"]);
  });

  it("a mask in the wrong space is REFUSED, never resampled", async () => {
    /* `maskedRefine`'s house rule. It is `failed` rather than `no-cut` on
       purpose: nothing was learned about the picture, and filing "no ink here"
       over a read we could not place would be a claim we did not earn. */
    const bag = harness({
      region: async () => ({ data: Buffer.alloc(100 * 100, 255), width: 100, height: 100 }),
    });
    const outcome = await mint(bag, await framePng());
    expect(outcome).toMatchObject({ outcome: "failed", reason: "wrongSpace" });
    expect(bag.stored).toHaveLength(0);
  });

  it("a reader that does not answer leaves the picture standing", async () => {
    const bag = harness({ region: async () => { throw new Error("provider said no"); } });
    const outcome = await mint(bag, await framePng());
    expect(outcome).toMatchObject({ outcome: "failed" });
    expect(bag.stored).toHaveLength(0);
  });

  it("a write that fails leaves the picture standing and files no row", async () => {
    const bag = harness({ store: async () => { throw new Error("R2 said no"); } });
    const outcome = await mint(bag, await framePng());
    expect(outcome).toMatchObject({ outcome: "failed" });
    expect(bag.recorded).toHaveLength(0);
  });

  it("a database that has not taken 0049 leaves the picture standing", async () => {
    /* The ordinary state of production between the deploy and the ceremony.
       The carry falls back to the artwork, which is the road it drove
       yesterday — a lost improvement, never a lost render. */
    const bag = harness({
      record: async () => { throw Object.assign(new Error("no such table"), { code: "ER_NO_SUCH_TABLE" }); },
    });
    const outcome = await mint(bag, await framePng());
    expect(outcome).toMatchObject({ outcome: "failed", reason: "threw" });
  });

  it("bytes that will not decode leave the picture standing", async () => {
    const bag = harness();
    const outcome = await mint(bag, Buffer.from("not a picture"));
    expect(outcome).toMatchObject({ outcome: "failed" });
    expect(bag.calls).toHaveLength(0);
  });
});
