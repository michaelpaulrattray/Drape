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
  /**
   * The sided reader, ABSENT BY DEFAULT — because that absence is a real
   * production state (a keyless deployment's `refusingRegionReader` has no
   * `regionSides`) and because every test above this line asks about a
   * `sides: "one"` surface, which must never take the sided road.
   */
  regionSides?: (ask: { name: string; declaredTwoSided?: true; axisKey?: string })
    => Promise<{ left: Mask; right: Mask } | null>;
  store?: () => Promise<{ key: string }>;
  record?: (input: unknown) => Promise<{ outcome: "minted"; publicId: string } | { outcome: "already" }>;
} = {}) {
  const calls: Call[] = [];
  const recorded: any[] = [];
  const stored: Array<{ key: string; bytes: Buffer }> = [];
  const dependencies = {
    reader: {
      region: async (ask: { name: string }) => {
        /* WHICH WORD, captured at the wire rather than assumed from the slot
           beside it — the whole finding is that this word was wrong. */
        calls.push({ what: "region", detail: ask.name });
        return over.region ? over.region() : maskOf(INK);
      },
      ...(over.regionSides === undefined ? {} : {
        regionSides: async (ask: { name: string; declaredTwoSided?: true; axisKey?: string }) => {
          calls.push({ what: "regionSides", detail: ask });
          return over.regionSides!(ask);
        },
      }),
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

/** The name the chain minted at claim time, which the mint must honour. */
const CROP_ID = "0f7ae3c1-2b44-4a6d-9c81-6a2f4b0d7e35";

async function mint(bag: ReturnType<typeof harness>, frame: Buffer, slot = "ink:neck") {
  return mintInkDeliveryCrop({
    userId: 1,
    candidatePublicId: "cast-1",
    variantPublicId: "variant-9",
    frame,
    delivered: { cropPublicId: CROP_ID, slot, designPublicId: "design-7" },
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
    /* THE SLOT'S OWN WORD, on the row — so a crop minted before the word
       changed is tellable from one minted after it by READING THE ROW, not by
       reading its timestamp against a deploy. */
    expect(row.region).toBe("neck");
    /*
      ⚠ AND THE GEOMETRY COLUMNS ARE THE RECTANGLE'S NOW — deliberate, not
      incidental (fable-1284 §4).

      They used to be the ink's own bounding box. They are now the padded
      SURFACE, which is what makes the panel card's box grow from one swallow to
      the piece — which is the thing he asked for. Written out to the pixel so
      the change cannot happen again silently.
    */
    expect({ width: row.width, height: row.height }).toEqual({ width: 390, height: 416 });
    expect({ x: row.bboxX, y: row.bboxY }).toEqual({ x: 205, y: 252 });
    expect({ w: row.frameWidth, h: row.frameHeight }).toEqual({ w: WIDTH, h: HEIGHT });
    /* The mask count stays the READER'S answer — a fact about what came back,
       which must not quietly become the rectangle's. */
    expect(row.maskPixels).toBe(INK.width * INK.height);
    /* The kept count is the rectangle, and it is COUNTED IN THE PRODUCED BYTES
       rather than copied from the box above it. */
    expect(row.keptPixels).toBe(390 * 416);
    /* And the stored object really is that crop, read back off its own bytes
       rather than believed from the row beside it. */
    const stored = await sharp(bag.stored[0]!.bytes).metadata();
    expect({ width: stored.width, height: stored.height })
      .toEqual({ width: 390, height: 416 });
  });

  it("⚠ ASKS THE SLOT'S OWN WORD, never `tattooed skin` — at the wire", async () => {
    /*
      THE FINDING, proved on the outgoing request rather than on the constant
      beside it (working law 5). This line used to send `tattooed skin`, and on
      a chest piece of seven marks that came back with ONE SWALLOW — 1 of 7,
      about a fifth of the ink — which then rode every later carry as "the
      exact tattoo he already has".
    */
    const bag = harness();
    await mint(bag, await framePng());
    expect(bag.calls.filter((one) => one.what === "region").map((one) => one.detail))
      .toEqual(["neck"]);
  });

  it("⚠ REGRESSION: a CONTINUOUS design still comes back whole", async () => {
    /*
      fable-1284 §4's first named arm, and it is the counterexample that kept
      the old word looking correct. Crop #18 — the tall fine-line neck piece,
      ONE continuous design — was cut whole by `tattooed skin` today, because
      one continuous design is one patch. A fix aimed at scattered pieces must
      not make that case worse.

      The surface word CONTAINS the design that sits on it, so the padded
      surface is a superset of the old ink box. Modelled at #18's real SHAPE —
      a 156x461 piece inside a neck region that holds it — placed to fit this
      harness's own 800x1000 frame rather than the 1024x1536 it was measured
      in, because a fixture that runs off its own frame tests the extractor
      instead of the claim.
    */
    const design = { left: 320, top: 200, width: 156, height: 461 };
    const surface = { left: 300, top: 180, width: 200, height: 500 };
    const bag = harness({ region: async () => maskOf(surface) });
    await mint(bag, await framePng());
    const row = bag.recorded[0];
    expect(row.bboxX).toBeLessThanOrEqual(design.left);
    expect(row.bboxY).toBeLessThanOrEqual(design.top);
    expect(row.bboxX + row.width).toBeGreaterThanOrEqual(design.left + design.width);
    expect(row.bboxY + row.height).toBeGreaterThanOrEqual(design.top + design.height);
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

/*
  ⚠ THE ASYMMETRIC ARM — the fixture family law, made into a test.

  Every sided crop this product mints was invisible-when-wrong for one reason:
  horns, eyes and earrings are SYMMETRIC, so a mirrored answer looks right. The
  first asymmetric single-side delivery — a tattoo on ONE arm — is what showed
  it, on the founder's own frame.

  So this fixture is deliberately lopsided. `region` (the whole-frame road)
  answers with the BARE arm; `regionSides` answers with a different mask per
  side and the ink is on HER LEFT, which in a frame she faces the camera in is
  the IMAGE's right half. A mint that takes the old road cuts a rectangle out of
  the image-left half and the assertion goes red — which is exactly what the
  shipped code did until 2026-08-22.
*/
const HER_LEFT_INK = { left: 560, top: 300, width: 180, height: 260 };
const HER_RIGHT_BARE = { left: 60, top: 300, width: 180, height: 260 };

describe("a tattoo on ONE arm is filed against THAT arm", () => {
  const sidedReader = () => ({
    /* The old road, kept live in the fixture so the arm has something to fail
       into rather than merely not passing. */
    region: async () => maskOf(HER_RIGHT_BARE),
    regionSides: async () => ({ left: maskOf(HER_LEFT_INK), right: maskOf(HER_RIGHT_BARE) }),
  });

  it("cuts from HER left — the image's RIGHT half — not from whatever the whole frame answered", async () => {
    const bag = harness(sidedReader());
    const outcome = await mint(bag, await framePng(), "ink:upperArm@left");
    expect(outcome.outcome).toBe("minted");
    const row = bag.recorded[0];
    /* The rectangle's own left edge (`bboxX`), padded outward — so the assertion is on
       the FILED geometry rather than on which function was called. A crop of
       the bare arm lands near x=0; hers lands past the midline. */
    expect(row.bboxX).toBeGreaterThan(WIDTH / 2);
    expect(row.slot).toBe("ink:upperArm@left");
    /* And the word is still the SURFACE — laterality is not the question, it is
       which frame the question is asked of. */
    expect(row.region).toBe("upper arm");
  });

  it("asks the reader to split a word its own vocabulary does not know", async () => {
    const bag = harness(sidedReader());
    await mint(bag, await framePng(), "ink:upperArm@right");
    const ask = bag.calls.find((one) => one.what === "regionSides")?.detail as any;
    /* Without this the reader answers `null` for `upper arm` and the fix is
       inert — its closed bilateral list is five FACE words. The flag is the
       placement vocabulary's own `sides` field arriving, never this caller's
       opinion. */
    expect(ask.declaredTwoSided).toBe(true);
    /* One midline per face, so two sides of one render cannot be cut at two
       different centres. */
    expect(ask.axisKey).toBe("cast-1");
    expect(bag.recorded[0].bboxX).toBeLessThan(WIDTH / 2);
  });

  it("a surface there is ONE of never takes the sided road", async () => {
    const bag = harness(sidedReader());
    await mint(bag, await framePng(), "ink:neck");
    expect(bag.calls.map((one) => one.what)).toContain("region");
    expect(bag.calls.map((one) => one.what)).not.toContain("regionSides");
  });

  it("REFUSES rather than filing a whole-frame read under a sided key", async () => {
    /* The load-bearing decision (opus-1037 §5, fable-1391): a missing document
       costs a re-render; a WRONG document rides a transform as the SOURCE. Both
       ways it can fail are driven — a reader without the method at all, and one
       that has it and cannot split this word. */
    const noMethod = harness();
    const first = await mint(noMethod, await framePng(), "ink:upperArm@left");
    expect(first).toMatchObject({ outcome: "failed", reason: "sideUnread" });
    expect(noMethod.recorded).toHaveLength(0);
    expect(noMethod.stored).toHaveLength(0);

    const saysNull = harness({ regionSides: async () => null });
    const second = await mint(saysNull, await framePng(), "ink:upperArm@left");
    expect(second).toMatchObject({ outcome: "failed", reason: "sideUnread" });
    expect(saysNull.recorded).toHaveLength(0);
    /* ⚠ AND IT DID NOT QUIETLY FALL BACK. A `region` call here would be the
       defect reintroduced as a kindness. */
    expect(saysNull.calls.map((one) => one.what)).not.toContain("region");
  });
});
