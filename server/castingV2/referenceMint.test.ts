/**
 * Minting the library — cut, guard at the door, write.
 *
 * The expensive halves are injected (the guard's reader, the store, the row
 * writer), so every case below is driven end to end without a database, a
 * bucket, or a vision call. What is NOT injected is the guard itself: this file
 * drives the real `mintGuardedReference`, because a mint that mocked its own
 * door would be proving the one thing that must not be taken on trust.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { mintReferencesForRender, type SlotSpec } from "./referenceMint";
import type { Mask } from "./maskedComposite";

/** A frame of flat colour — the mint decodes it, and nothing here reads pixels. */
async function frameBytes(width = 40, height = 40): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 110, b: 100 } },
  }).png().toBuffer();
}

/** A mask claiming a rectangle of the frame. */
function rect(box: { x: number; y: number; width: number; height: number }, frame = 40): Mask {
  const data = Buffer.alloc(frame * frame, 0);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) data[y * frame + x] = 255;
  }
  return { data, width: frame, height: frame };
}

const HAIR = { x: 4, y: 4, width: 20, height: 20 };

function hairSlot(overrides: Partial<SlotSpec> = {}): SlotSpec {
  return {
    slot: "hair",
    tier: "anatomy",
    noun: "hair",
    words: ["a blunt shoulder-length bob"],
    question: "hair",
    guardKind: "hair",
    ...overrides,
  };
}

type Recorded = Parameters<NonNullable<Parameters<typeof mintReferencesForRender>[0]["dependencies"]>["record"] & Function>[0];

function harness(options: {
  /** What the guard's SECOND read finds. Null means the read did not settle. */
  guardRead?: Mask | null;
  storeFails?: boolean;
} = {}) {
  const stored: string[] = [];
  const manifests: string[][] = [];
  let recorded: Recorded | null = null;
  return {
    stored,
    manifests,
    get rows() { return recorded?.rows ?? []; },
    get batchId() { return recorded?.cleanupBatchId; },
    dependencies: {
      enabledFor: () => true,
      read: async () => (options.guardRead === undefined ? rect(HAIR) : options.guardRead),
      store: async (input: { key: string }) => {
        if (options.storeFails) throw new Error("R2 said no");
        stored.push(input.key);
        return { key: input.key };
      },
      manifest: async (input: { storageKeys: readonly string[] }) => {
        manifests.push([...input.storageKeys]);
      },
      record: (async (input: Recorded) => {
        recorded = input;
        return input.rows.map((row, index) => ({
          id: index + 1,
          publicId: `pub-${index}`,
          candidateId: 7,
          slot: row.slot,
          role: row.role,
          version: 1,
        }));
      }) as never,
    },
  };
}

async function mint(slots: SlotSpec[], harnessed: ReturnType<typeof harness>, extra: {
  applied?: Mask | null;
  knownDigests?: Map<string, string>;
} = {}) {
  return mintReferencesForRender({
    userId: 1,
    variantId: 11,
    frame: { bytes: await frameBytes() },
    applied: extra.applied === undefined ? rect({ x: 0, y: 0, width: 40, height: 40 }) : extra.applied,
    masterRegions: new Map([["hair", rect(HAIR)]]),
    slots,
    knownDigests: extra.knownDigests,
    dependencies: harnessed.dependencies,
  });
}

describe("what the mint keeps", () => {
  it("stores a crop that its own second read confirms, with both objects and the reading", async () => {
    const bench = harness();
    const result = await mint([hairSlot()], bench);

    expect(result.outcome).toBe("stored");
    expect(result.slots[0]).toMatchObject({ slot: "hair", outcome: "stored" });

    /* The rectangle AND the mask — one for the recipe, one for the panel. */
    expect(bench.stored).toHaveLength(2);
    /* And both were registered for cleanup BEFORE either was written. */
    expect(bench.manifests[0]).toEqual(bench.stored);

    const row = bench.rows[0]!;
    expect(row.image?.storageKey).toBe(bench.stored[0]);
    expect(row.image?.maskKey).toBe(bench.stored[1]);
    expect(row.image?.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(row.image?.guard).toMatchObject({ kind: "hair", coverage: 10_000, threshold: 9460 });
    expect(row.words).toEqual(["a blunt shoulder-length bob"]);
  });

  /*
    THE FOUNDER'S FRINGE. The crop covers an eighth of what it claims to be, and
    every mechanical property of it is fine: well-formed, inside its region, it
    stores and it loads. The guard is the only thing between it and every later
    render carrying a haircut nobody asked for.
  */
  it("turns away an under-captured crop, keeps the words, and stores NOTHING", async () => {
    /* The guard's own read finds hair across a region eight times the crop. */
    const bench = harness({ guardRead: rect({ x: 4, y: 4, width: 20, height: 160 }, 200) });
    const result = await mint([hairSlot()], bench);

    expect(result.slots[0]).toMatchObject({
      slot: "hair",
      outcome: "words-only",
      reason: "guardRefused",
    });
    expect(bench.stored).toEqual([]);
    expect(bench.manifests).toEqual([]);

    /* The words still record — the crop is the assist, the words are the
       carrier of record (D-244). A row with no image is exactly "this slot has
       words and nothing has delivered a crop for it". */
    expect(bench.rows).toHaveLength(1);
    expect(bench.rows[0]!.image).toBeUndefined();
    expect(bench.rows[0]!.words).toEqual(["a blunt shoulder-length bob"]);
    expect(bench.batchId).toBeUndefined();
  });

  it("treats a read that did not settle as a refusal, never as a pass", async () => {
    /* D-235's asymmetry at the one door where a failed reading would otherwise
       become a confident yes. */
    const bench = harness({ guardRead: null });
    const result = await mint([hairSlot()], bench);

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect(bench.stored).toEqual([]);
  });

  it("refuses a kind with no positive specimen rather than borrowing hair's number", async () => {
    const bench = harness();
    const result = await mint([hairSlot({ slot: "lips", noun: "lips", guardKind: "lips" })], bench);

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect(result.slots[0]).toHaveProperty("detail", expect.stringContaining("no completeness specimen"));
    expect(bench.stored).toEqual([]);
  });

  it("refuses a crop byte-identical to one the library already holds", async () => {
    /* Two rows holding one fact — `marks` and `makeup` at `face skin` did this
       three times in production. The digest is passed in, so the collision is
       caught across renders and not merely inside one. */
    /* Mint once to learn the digest this frame's hair produces, then present it
       as another slot's and mint again. */
    const learn = harness();
    await mint([hairSlot()], learn);
    const seed = new Map([["skin", learn.rows[0]!.image!.digest]]);

    const bench = harness();
    const result = await mint([hairSlot()], bench, { knownDigests: seed });

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect(result.slots[0]).toHaveProperty("detail", expect.stringContaining("byte-identical to skin"));
    expect(bench.stored).toEqual([]);
  });
});

describe("what the mint never cuts", () => {
  it("never cuts a surface — no vision call, no crop, just its words", async () => {
    let reads = 0;
    const bench = harness();
    const withCount = {
      ...bench,
      dependencies: { ...bench.dependencies, read: async () => { reads += 1; return rect(HAIR); } },
    };
    const result = await mint(
      [hairSlot({ slot: "skin", tier: "surface", noun: "skin", words: ["a warm even tan"], question: "face skin", guardKind: "skin" })],
      withCount,
    );

    expect(result.slots[0]).toMatchObject({ slot: "skin", outcome: "words-only", reason: "surface" });
    expect(reads).toBe(0);
    expect(bench.stored).toEqual([]);
  });

  it("records words for a slot this render has no evidence about", async () => {
    const bench = harness();
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      /* The harvest never read this region on the master. */
      masterRegions: new Map(),
      slots: [hairSlot()],
      dependencies: bench.dependencies,
    });

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "noRegion" });
    expect(bench.rows[0]!.image).toBeUndefined();
  });
});

describe("what the mint does when things go wrong", () => {
  it("is inert while the flag is off — no decode, no read, no write", async () => {
    let touched = false;
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: Buffer.from("not even a png") },
      applied: null,
      masterRegions: new Map(),
      slots: [hairSlot()],
      dependencies: {
        enabledFor: () => false,
        read: async () => { touched = true; return null; },
        store: async () => { touched = true; return { key: "" }; },
        record: (async () => { touched = true; return []; }) as never,
      },
    });

    expect(result).toEqual({ outcome: "off", slots: [] });
    expect(touched).toBe(false);
  });

  it("leaves the picture standing when storage fails, and files no row", async () => {
    const bench = harness({ storeFails: true });
    const result = await mint([hairSlot()], bench);

    expect(result.outcome).toBe("failed");
    /* The manifest was registered first, so the objects that did get written
       are already on the cleanup worker's list. That is the whole point of
       registering before writing: the failure path collects itself. */
    expect(bench.manifests).toHaveLength(1);
    expect(bench.rows).toEqual([]);
  });

  it("refuses to mint at all with no reader — an unread crop may not enter", async () => {
    const bench = harness();
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["hair", rect(HAIR)]]),
      slots: [hairSlot()],
      dependencies: { ...bench.dependencies, read: undefined },
    });

    expect(result.outcome).toBe("failed");
    expect(bench.stored).toEqual([]);
  });
});

describe("the born read", () => {
  /*
    A fresh full region read on the MASTER, where no edit governs the frame. A
    null `applied` is "no edit governed this", which is a different claim from
    "the edit touched nothing" — passing an empty mask would file every slot as
    owning nothing while every count read zero.
  */
  it("lets a slot own its whole region when no edit governed the frame", async () => {
    const bench = harness();
    const result = await mint([hairSlot()], bench, { applied: null });

    expect(result.slots[0]).toMatchObject({ outcome: "stored" });
    const geometry = bench.rows[0]!.image!.geometry!;
    expect(geometry.bbox).toEqual(HAIR);
    expect(geometry.frame).toEqual({ width: 40, height: 40 });
  });
});
