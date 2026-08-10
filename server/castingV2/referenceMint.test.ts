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
import { unionMasks } from "./maskGeometry";
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
    frame: "wholeFrame",
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

    /* And the row SAYS SO (migration 0029): the refusal, the family it was
       judged against, and the number it read — the difference between "this
       slot has words" and "this slot has words because its crop covered 12.5%
       of the hair it claimed to be". Its pixels are NOT kept: this refusal
       measured against a real bar and was right to turn the crop away. */
    expect(bench.rows[0]!.refusal).toEqual({ reason: "underCaptured", kind: "hair", coverage: 1250 });
  });

  it("treats a read that did not settle as a refusal, never as a pass", async () => {
    /* D-235's asymmetry at the one door where a failed reading would otherwise
       become a confident yes. */
    const bench = harness({ guardRead: null });
    const result = await mint([hairSlot()], bench);

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect(bench.stored).toEqual([]);
    /* No coverage AT ALL, because no reading happened. A zero here would be a
       number nobody measured wearing the clothes of one that was. */
    expect(bench.rows[0]!.refusal).toEqual({ reason: "readDidNotSettle", kind: "hair" });
  });

  /*
    THE ONE REFUSAL WHOSE PIXELS ARE KEPT (migration 0029, fable-214/215).

    `noSpecimen` refuses because nobody has ever measured what a complete crop of
    this kind looks like — so the refusal exists in order to produce the
    specimen, and the pixels are the only instrument that can. Before this, the
    crop was thrown away and the only way to see it again was to buy the render
    again.
  */
  it("keeps the crop of a kind nobody has measured, in columns the painter cannot see", async () => {
    const bench = harness();
    const result = await mint([hairSlot({ slot: "lips", noun: "lips", guardKind: "lips" })], bench);

    expect(result.slots[0]).toMatchObject({
      outcome: "words-only",
      reason: "guardRefused",
      keptForAdoption: true,
    });
    expect(result.slots[0]).toHaveProperty("detail", expect.stringContaining("no completeness specimen"));

    /* Two objects, and both reserved for cleanup BEFORE either was written —
       the same order a delivered crop goes in, because a refused crop is the
       same artifact and the crash between the two is the same crash. */
    expect(bench.stored).toHaveLength(2);
    expect(bench.manifests[0]).toEqual(bench.stored);
    expect(bench.batchId).toBeDefined();

    const row = bench.rows[0]!;
    /* NOT `image`. That is the whole design: `storageKey` is what rides into
       the next render's prompt, and this picture is by definition uncertified. */
    expect(row.image).toBeUndefined();
    expect(row.refusal).toEqual({
      reason: "noSpecimen",
      kind: "lips",
      coverage: 10_000,
      crop: {
        contentKey: bench.stored[0],
        maskKey: bench.stored[1],
        /* The box it was cut from, because the mask is written at the box's own
           size — without this the pixels could be looked at and never placed on
           the face they came from. */
        geometry: { bbox: HAIR, frame: { width: 40, height: 40 } },
      },
    });
    expect(row.words).toEqual(["a blunt shoulder-length bob"]);
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
    /* Nothing stored, and deliberately: these bytes already exist at the other
       slot's key, so keeping a second copy for adoption would be the same
       picture filed twice — D-242's shape inside the refusal group itself. */
    expect(bench.stored).toEqual([]);
    expect(bench.rows[0]!.refusal).toMatchObject({ reason: "duplicateOfSlot", kind: "hair" });
    expect(bench.rows[0]!.refusal?.crop).toBeUndefined();
  });

  /*
    A CROP OF WHERE THE THING WOULD HAVE BEEN. The frame does not wear the
    subject, so any crop of it is a fabrication with a well-formed bounding box
    (fable-181) — and it is exactly the picture that must NOT be put in front of
    the person deciding what complete looks like.
  */
  it("records a subject-absent refusal and keeps none of its pixels", async () => {
    const bench = harness({ guardRead: { data: Buffer.alloc(40 * 40, 0), width: 40, height: 40 } });
    const result = await mint([hairSlot()], bench);

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect(result.slots[0]).not.toHaveProperty("keptForAdoption");
    expect(bench.stored).toEqual([]);
    expect(bench.rows[0]!.refusal).toMatchObject({ reason: "subjectAbsent", kind: "hair" });
    expect(bench.rows[0]!.refusal?.crop).toBeUndefined();
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

  it("never cuts a slot with no question of its own, and still keeps its words", async () => {
    /*
      The catalogue hands these: her jaw, her teeth, her skin — features the
      region vocabulary has no question for. The alternative to this row is a
      crop of the nearest bigger region wearing the smaller name, which is the
      defect the catalogue exists to make unreachable. It must cost no vision
      call: a question-less slot has nothing to ask about.
    */
    let reads = 0;
    const bench = harness();
    const withCount = {
      ...bench,
      dependencies: { ...bench.dependencies, read: async () => { reads += 1; return rect(HAIR); } },
    };
    const result = await mint(
      [hairSlot({ slot: "jaw", noun: "jaw", words: ["a softer jawline"], question: null, guardKind: null })],
      withCount,
    );

    expect(result.outcome).toBe("stored");
    expect(result.slots[0]).toMatchObject({ slot: "jaw", outcome: "words-only", reason: "noQuestion" });
    expect(reads).toBe(0);
    expect(bench.stored).toEqual([]);
    expect(bench.rows[0]).toMatchObject({ slot: "jaw", words: ["a softer jawline"] });
    expect(bench.rows[0]!.image).toBeUndefined();
  });

  /*
    ONE OF A PAIR, CUT FROM A WHOLE-FRAME UNION — the refusal that has to be a
    refusal rather than a low score.

    The bilateral reader unions both sides into one mask by construction, so
    `earring@left` and `earring@right` would be cut from the same pixels, scored
    against the same union, and BOTH would read complete while containing both
    of her earrings. That is the wrong-boundary class at the library's door.

    Two things are asserted and the second is the one that matters: no crop, and
    NO COVERAGE NUMBER. "The refusal is also the thing that produces the
    specimen" — a refusal here carrying a reading would hand the next person a
    number measured against both ears, and the guard adopts a kind's specimen
    for every instance of it.
  */
  it("never cuts one of a pair while every region it has is a whole-frame union", async () => {
    let reads = 0;
    const bench = harness();
    const withCount = {
      ...bench,
      dependencies: { ...bench.dependencies, read: async () => { reads += 1; return rect(HAIR); } },
    };
    const earring = (instance: "left" | "right") => hairSlot({
      slot: `earring@${instance}`,
      tier: "item",
      noun: `${instance} earring`,
      words: ["dangly cross earrings in gold"],
      question: "earring",
      guardKind: "earring",
      frame: "ownSide",
    });

    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      /* The region IS there — this is not `noRegion` in disguise. */
      masterRegions: new Map([["earring", rect(HAIR)]]),
      slots: [earring("left"), earring("right")],
      dependencies: withCount.dependencies as never,
    });

    expect(result.outcome).toBe("stored");
    expect(result.slots).toEqual([
      expect.objectContaining({ slot: "earring@left", outcome: "words-only", reason: "noSide" }),
      expect.objectContaining({ slot: "earring@right", outcome: "words-only", reason: "noSide" }),
    ]);
    expect(reads).toBe(0);
    expect(bench.stored).toEqual([]);
    /* Both sides file their words, and they match — which is what lets the
       panel speak about them as one row. */
    expect(bench.rows.map((row) => row.slot)).toEqual(["earring@left", "earring@right"]);
    expect(bench.rows[0]!.words).toEqual(bench.rows[1]!.words);
    expect(bench.rows[0]!.image).toBeUndefined();
    /* No number, anywhere, that a later reader could mistake for a specimen. */
    expect(JSON.stringify(result.slots)).not.toContain("coverage");
  });

  /**
   * AND THE SAME DOOR ONCE THE SIDES ARRIVE APART.
   *
   * `regionSides` hands the mint the split the reader was already performing, so
   * `earring@left` is cut from HER LEFT and scored against HER LEFT. These drive
   * the capability arm the refusal above is the fallback for — the pair fable-211
   * asked to see asserted at the wire, in both directions.
   */
  const HER_LEFT = { x: 26, y: 10, width: 6, height: 6 };
  const HER_RIGHT = { x: 8, y: 10, width: 6, height: 6 };

  /**
   * A FRAME WITH SOMETHING IN IT, because a flat colour is not a photograph.
   *
   * Written after the flat fixture taught it: two same-sized crops of a flat
   * frame are byte-identical, so a matched pair tripped the duplicate check and
   * her right earring filed words. On a real face the two never match — different
   * light, different occlusion, different hair — which is the same reason
   * divergence is derived from WORDS and never from pixels (referenceSlots). The
   * behaviour is safe either way (the pair's words are its carrier), but the
   * fixture should not be the thing that produces it.
   */
  async function texturedFrame(size = 40): Promise<Buffer> {
    const data = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const at = (y * size + x) * 3;
        data[at] = (x * 7) % 256;
        data[at + 1] = (y * 5) % 256;
        data[at + 2] = (x * y) % 256;
      }
    }
    return sharp(data, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
  }
  const earringSlot = (instance: "left" | "right", guardKind: string) => hairSlot({
    slot: `earring@${instance}`,
    tier: "item",
    noun: `${instance} earring`,
    words: ["dangly cross earrings in gold"],
    question: "earring",
    guardKind,
    frame: "ownSide",
  });

  /** Records what the guard was asked, and answers with the side it was asked for. */
  function sideAwareGuard(bench: ReturnType<typeof harness>, answer?: (side?: string) => Mask | null) {
    const asked: Array<{ question: string; side?: string }> = [];
    const read = async (input: { question: string; side?: string }) => {
      asked.push({ question: input.question, side: input.side });
      if (answer) return answer(input.side);
      return input.side === "left" ? rect(HER_LEFT) : rect(HER_RIGHT);
    };
    return { asked, dependencies: { ...bench.dependencies, read: read as never } };
  }

  const mintPair = async (bench: ReturnType<typeof harness>, dependencies: unknown, guardKind: string) => (
    mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await texturedFrame() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["earring", rect(HER_LEFT)]]),
      masterSideRegions: new Map([["earring", { left: rect(HER_LEFT), right: rect(HER_RIGHT) }]]),
      slots: [earringSlot("left", guardKind), earringSlot("right", guardKind)],
      dependencies: dependencies as never,
    })
  );

  it("cuts one of a pair from her own side, and asks the guard about that side", async () => {
    const bench = harness();
    const guard = sideAwareGuard(bench);
    /*
      `hair` is the guard kind here because it is the only kind with a MEASURED
      specimen today, and a kind without one refuses by design. The mint does not
      know what a kind means — it carries the string — so this drives the stored
      path honestly while the earring's own specimen is still owed. That specimen
      comes from a delivered render, which is what the dev refines are for.
    */
    const result = await mintPair(bench, guard.dependencies, "hair");

    expect(result.slots).toEqual([
      expect.objectContaining({ slot: "earring@left", outcome: "stored" }),
      expect.objectContaining({ slot: "earring@right", outcome: "stored" }),
    ]);
    /* The guard's second read was scoped to the same instance the crop is of. */
    expect(guard.asked).toEqual([
      { question: "earring", side: "left" },
      { question: "earring", side: "right" },
    ]);
    /* Each crop is the box of ITS OWN hoop — the thing a union could not do. */
    expect(bench.rows[0]!.image?.geometry?.bbox).toMatchObject(HER_LEFT);
    expect(bench.rows[1]!.image?.geometry?.bbox).toMatchObject(HER_RIGHT);
    /* Two hoops, two pictures, four objects, two different pictures. */
    expect(bench.stored).toHaveLength(4);
    expect(bench.rows[0]!.image?.digest).not.toBe(bench.rows[1]!.image?.digest);
  });

  /**
   * THE NUMBER IS MEASURED AGAINST ONE SIDE — with the wrong boundary beside it
   * so the assertion cannot be vacuous.
   *
   * A crop of one hoop scored against a read of BOTH reads about half of a
   * region it entirely contains. That number would have become the earring
   * kind's first specimen, and the guard adopts a kind's specimen for every
   * instance of it.
   */
  it("scores a per-side crop against that side alone, not against the pair", async () => {
    const bench = harness();
    const perSide = await mintPair(bench, sideAwareGuard(bench).dependencies, "earring");
    expect(perSide.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect((perSide.slots[0] as { detail: string }).detail).toContain("100.0%");

    /* The control: the same crop, scored the way it would have been before. */
    const union = { left: rect(HER_LEFT), right: rect(HER_RIGHT) };
    const bothHoops = await mintPair(
      harness(),
      sideAwareGuard(bench, () => unionMasks(union.left, union.right)).dependencies,
      "earring",
    );
    expect((bothHoops.slots[0] as { detail: string }).detail).toContain("50.0%");
  });

  it("takes no reading at all when the guard cannot scope to a side", async () => {
    const bench = harness();
    /* Exactly what the product's reader does when it has no `regionSides`: it
       returns nothing rather than the union, so a number nobody earned cannot
       reach the row. */
    const guard = sideAwareGuard(bench, (side) => (side ? null : rect(HER_LEFT)));
    const result = await mintPair(bench, guard.dependencies, "hair");

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect((result.slots[0] as { detail: string }).detail).toContain("did not settle");
    expect(JSON.stringify(result.slots)).not.toContain("%");
    expect(bench.stored).toEqual([]);
  });

  it("files words when the sides it was handed are about another question", async () => {
    const bench = harness();
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["earring", rect(HER_LEFT)]]),
      /* The render read her eyes two-sidedly and never asked about an earring. */
      masterSideRegions: new Map([["eyes", { left: rect(HER_LEFT), right: rect(HER_RIGHT) }]]),
      slots: [earringSlot("left", "earring")],
      dependencies: bench.dependencies as never,
    });

    expect(result.slots[0]).toMatchObject({ slot: "earring@left", outcome: "words-only", reason: "noSide" });
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
