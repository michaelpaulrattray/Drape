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
import { slotDefinition } from "./referenceSlotCatalogue";
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
  masterRegions?: Map<string, Mask>;
} = {}) {
  return mintReferencesForRender({
    userId: 1,
    variantId: 11,
    frame: { bytes: await frameBytes() },
    applied: extra.applied === undefined ? rect({ x: 0, y: 0, width: 40, height: 40 }) : extra.applied,
    masterRegions: extra.masterRegions ?? new Map([["hair", rect(HAIR)]]),
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

/**
 * A DISPUTED SLOT — the ask wrote it, the render's own reader said it did not
 * land, and the crop is the only thing that can say which of the two was wrong
 * (fable-220 §3).
 *
 * Every case below is a form of one rule: **pixels or nothing.** A disputed slot
 * is never stored and never files words, so it either leaves a crop a human can
 * open or it leaves the library exactly as this render found it.
 */
describe("what the mint does with a disputed delivery", () => {
  it("keeps the crop and stores NOTHING, on a kind whose bar it would have cleared", async () => {
    /*
      The load-bearing one. This is `hair` at 100% coverage against a real
      threshold — the arrangement that stores a live reference on any other
      render. Disputed, it is refused, and the previous version of this slot
      stays newest and stays good.
    */
    const bench = harness();
    const result = await mint([hairSlot({ disputed: true })], bench);

    expect(result.outcome).toBe("stored");
    expect(result.slots[0]).toEqual({
      slot: "hair", outcome: "disputed", kept: true, coverage: 1,
    });

    const row = bench.rows[0]!;
    /* NOT `image`, on a crop that measured perfectly. `storageKey` is what rides
       into the next render's prompt, and an unverified delivery may not. */
    expect(row.image).toBeUndefined();
    expect(row.refusal).toEqual({
      reason: "disputedDelivery",
      kind: "hair",
      coverage: 10_000,
      crop: {
        contentKey: bench.stored[0],
        maskKey: bench.stored[1],
        geometry: { bbox: HAIR, frame: { width: 40, height: 40 } },
      },
    });
    /* Same order as every other crop: reserved for deletion before written. */
    expect(bench.stored).toHaveLength(2);
    expect(bench.manifests[0]).toEqual(bench.stored);
  });

  it("writes NO ROW AT ALL when there are no pixels worth a human's time", async () => {
    /*
      The frame does not wear the thing, so the two readers agree and there is
      nothing to adjudicate. A words-only row here would be a version bump for a
      delivery this render's own reader disputed — so the library is left
      untouched, which is what a disputed facet did before any of this existed.
    */
    const bench = harness({ guardRead: { data: Buffer.alloc(40 * 40, 0), width: 40, height: 40 } });
    const result = await mint([hairSlot({ disputed: true })], bench);

    expect(result.outcome).toBe("nothing-to-keep");
    expect(result.slots[0]).toMatchObject({
      slot: "hair", outcome: "disputed", kept: false, reason: "subjectAbsent",
    });
    expect(bench.rows).toEqual([]);
    expect(bench.stored).toEqual([]);
    expect(bench.manifests).toEqual([]);
  });

  it("writes no row and buys no reading when the read did not settle", async () => {
    const bench = harness({ guardRead: null });
    const result = await mint([hairSlot({ disputed: true })], bench);

    expect(result.slots[0]).toMatchObject({ outcome: "disputed", kept: false, reason: "readDidNotSettle" });
    expect(bench.rows).toEqual([]);
  });

  it("writes no row for a disputed slot nothing can be cut for, and spends no vision call", async () => {
    /* A surface, a slot with no question, and a slot this frame has no region
       for. Each files words when it is earned; each files nothing when it is
       disputed, because the row would carry no picture and the words would
       assert a delivery the reader denied. */
    let reads = 0;
    const bench = harness();
    const counted = {
      ...bench,
      dependencies: { ...bench.dependencies, read: async () => { reads += 1; return rect(HAIR); } },
    };
    const result = await mint([
      hairSlot({ slot: "skin", tier: "surface", noun: "skin", question: "face skin", guardKind: "skin", disputed: true }),
      hairSlot({ slot: "jaw", noun: "jaw", question: null, guardKind: null, disputed: true }),
      hairSlot({ slot: "eyebrows", noun: "eyebrows", question: "eyebrows", guardKind: "eyebrows", disputed: true }),
    ], counted);

    expect(result.outcome).toBe("nothing-to-keep");
    expect(result.slots).toEqual([
      { slot: "skin", outcome: "disputed", kept: false, reason: "surface" },
      {
        slot: "jaw",
        outcome: "disputed",
        kept: false,
        reason: "noQuestion",
        detail: expect.stringContaining("nothing a human could settle"),
      },
      { slot: "eyebrows", outcome: "disputed", kept: false, reason: "noRegion" },
    ]);
    expect(reads).toBe(0);
    expect(bench.rows).toEqual([]);
  });

  it("files one render's earned slot and its disputed slot side by side", async () => {
    /* Two slots, two verdicts, one transaction — and the shapes are opposites:
       the earned one is an image with a guard reading, the disputed one is a
       refusal with a crop nobody may show the painter. */
    const bench = harness({ guardRead: undefined });
    const eyes = { x: 4, y: 30, width: 20, height: 6 };
    const scoped = {
      ...bench,
      dependencies: {
        ...bench.dependencies,
        read: async (asked?: { question: string }) => (asked?.question === "hair" ? rect(HAIR) : rect(eyes)),
      },
    };
    const result = await mint([
      hairSlot(),
      hairSlot({ slot: "eyebrows", noun: "eyebrows", question: "eyebrows", guardKind: "eyebrows", disputed: true }),
    ], scoped, {
      masterRegions: new Map([["hair", rect(HAIR)], ["eyebrows", rect(eyes)]]),
    });

    expect(result.slots).toEqual([
      { slot: "hair", outcome: "stored", coverage: 1 },
      { slot: "eyebrows", outcome: "disputed", kept: true, coverage: 1 },
    ]);
    expect(bench.rows).toHaveLength(2);
    expect(bench.rows[0]!.image).toBeDefined();
    expect(bench.rows[0]!.refusal).toBeUndefined();
    expect(bench.rows[1]!.image).toBeUndefined();
    expect(bench.rows[1]!.refusal).toMatchObject({ reason: "disputedDelivery", kind: "eyebrows" });
    /* Four objects on one manifest, registered before any of them was written. */
    expect(bench.stored).toHaveLength(4);
    expect(bench.manifests[0]).toEqual(bench.stored);
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

  it("NEVER sends a derived region key to a reader, and files her build's words", async () => {
    /*
      `build`'s region is composed, not asked (`belowHeadMask`): the whole
      subject below the bottom of the face box. Its key —
      `derived:below-head` — is a phrase no segmenter should ever receive, and
      the generic path would have handed it over as a question the moment the
      catalogue stopped saying `null`.

      With no composer wired — which is every caller that does not supply
      `derivedGround` — a derived slot files words exactly as it did when it had
      no region at all, and says so on the row. What this case pins is the part
      that is not allowed to change either way: NO VISION CALL, and nothing
      asked under that key.
    */
    const asked: string[] = [];
    const bench = harness();
    const withCount = {
      ...bench,
      dependencies: {
        ...bench.dependencies,
        read: async (...args: unknown[]) => {
          asked.push(String((args[0] as { question?: string })?.question ?? "(no question)"));
          return rect(HAIR);
        },
        readGround: async (...args: unknown[]) => {
          asked.push(String((args[0] as { question?: string })?.question ?? "(no question)"));
          return rect(HAIR);
        },
      },
    };
    const build = slotDefinition("build")!;
    const result = await mint(
      [hairSlot({
        slot: "build",
        noun: build.noun,
        words: ["noticeably narrower shoulders and slimmer upper arms"],
        question: build.question,
        guardKind: build.guardKind,
      })],
      withCount,
    );

    expect(result.slots[0]).toMatchObject({
      slot: "build",
      outcome: "words-only",
      reason: "noRegion",
      detail: "this slot's region is composed rather than asked, and no composer is wired into this mint",
    });
    expect(asked).toEqual([]);
    expect(bench.stored).toEqual([]);
    expect(bench.rows[0]).toMatchObject({
      slot: "build",
      words: ["noticeably narrower shoulders and slimmer upper arms"],
    });
    /* And the catalogue really is handing a derived key here — otherwise this
       case would pass by testing the old `question: null` road. */
    expect(build.question).toBe("derived:below-head");
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
    /*
      SCORED AGAINST HER OWN SIDE — 100.0% of it, against 50.0% for the union
      below. That contrast is this test's subject and it is unchanged.

      What changed underneath it (fable-305, 2026-08-12) is the OUTCOME: a
      reading at the ceiling on a kind with a length bar is now judged by that
      bar and adopted, where it used to fall through to the area path and refuse
      `noSpecimen`. This test previously asserted the refusal, which made it one
      of the pins holding the inverted gate in place — the first real walk on the
      repaint road lost all four of its earring crops to exactly this.
    */
    expect(perSide.slots[0]).toMatchObject({ slot: "earring@left", outcome: "stored" });
    expect((perSide.slots[0] as { coverage: number }).coverage).toBe(1);

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

/**
 * THE GROUND A REPAINT BRINGS NO MAP FOR (§6.2.3, chunk 2).
 *
 * The old compositor hands over the masks its harvest already cut a paste with.
 * A repaint has no harvest — it paints the whole frame and pastes nothing — so
 * without this every cuttable slot falls to `noRegion` and the library files
 * words on the one road that makes crops the carrier.
 *
 * Both directions are driven, because the failure mode of an optional
 * dependency is that it changes the path that never asked for it.
 */
describe("the ground read, for a render that brought no regions", () => {
  const GROUND = { x: 10, y: 10, width: 12, height: 12 };

  /** A harness whose ground read is counted and answers somewhere the master
   *  map does not, so a crop cut from it is distinguishable from one that was
   *  not. */
  function withGround(bench: ReturnType<typeof harness>, ground: Mask | null = rect(GROUND)) {
    const calls: Array<{ question: string; side?: string }> = [];
    return {
      calls,
      dependencies: {
        ...bench.dependencies,
        readGround: async (ask: { question: string; side?: string }) => {
          calls.push({ question: ask.question, ...(ask.side ? { side: ask.side } : {}) });
          return ground;
        },
      },
    };
  }

  it("asks the delivered frame where the slot is, and cuts from that", async () => {
    const bench = harness({ guardRead: rect(GROUND) });
    const grounded = withGround(bench);

    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      /* Both of the repaint's own conditions: no `applied`, because the whole
         frame was painted, and no region map, because there was no harvest. */
      applied: null,
      masterRegions: new Map(),
      slots: [hairSlot()],
      dependencies: grounded.dependencies as never,
    });

    expect(result.slots[0]).toMatchObject({ slot: "hair", outcome: "stored" });
    expect(grounded.calls).toEqual([{ question: "hair" }]);
    /* Cut from the ground the READ returned, not from a master map it never
       had — provable because the two rectangles differ. */
    expect(bench.rows[0]!.image!.geometry!.bbox).toEqual(GROUND);
  });

  it("CONTROL — a render that brought its own map never spends the call", async () => {
    /* The property that makes this safe to land on a live path: the old road
       cannot pay for this even by accident. */
    const bench = harness();
    const grounded = withGround(bench);

    const result = await mint([hairSlot()], { ...bench, dependencies: grounded.dependencies as never });

    expect(result.slots[0]).toMatchObject({ outcome: "stored" });
    expect(grounded.calls).toEqual([]);
    expect(bench.rows[0]!.image!.geometry!.bbox).toEqual(HAIR);
  });

  it("CONTROL — with no ground reader at all, the slot files words as before", async () => {
    /* The regression anchor: this is exactly what a repaint would have done
       before chunk 2, and it is what any render with neither map nor reader
       still does. */
    const bench = harness();

    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: null,
      masterRegions: new Map(),
      slots: [hairSlot()],
      dependencies: bench.dependencies as never,
    });

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "noRegion" });
    expect(bench.stored).toEqual([]);
  });

  it("asks for HER side by name, and takes null for an answer", async () => {
    /*
      A side is scoped by the reader or it is not scoped at all. The refusal is
      preserved rather than routed around: a reader that cannot split answers
      null, and the slot files words with NO coverage number — because a crop of
      one hoop scored against a read of both would become this kind's specimen.
    */
    const earring = hairSlot({
      slot: "earring@left",
      tier: "item",
      noun: "left earring",
      words: ["dangly cross earrings in gold"],
      question: "earring",
      guardKind: "earring",
      frame: "ownSide",
    });

    const asked = harness();
    const canSplit = withGround(asked);
    await mintReferencesForRender({
      userId: 1, variantId: 11, frame: { bytes: await frameBytes() },
      applied: null, masterRegions: new Map(), slots: [earring],
      dependencies: canSplit.dependencies as never,
    });
    expect(canSplit.calls).toEqual([{ question: "earring", side: "left" }]);

    const refused = harness();
    const cannotSplit = withGround(refused, null);
    const result = await mintReferencesForRender({
      userId: 1, variantId: 11, frame: { bytes: await frameBytes() },
      applied: null, masterRegions: new Map(), slots: [earring],
      dependencies: cannotSplit.dependencies as never,
    });

    expect(result.slots[0]).toMatchObject({ slot: "earring@left", outcome: "words-only", reason: "noSide" });
    expect(refused.stored).toEqual([]);
    expect(JSON.stringify(result.slots)).not.toContain("coverage");
  });
});

/**
 * THE LIBRARY'S OWN READ OF WHAT A SLOT NOW IS.
 *
 * Until this existed a slot's words were its FACETS' captions, each read against
 * the whole frame — so an earring slot's words were a sentence about everything
 * she was wearing, and eight production rows named her GLASSES. D-244 re-says a
 * slot's whole stack on every edit, so those sentences would have asked a paid
 * render to put them back on.
 *
 * These drive the reader at the wire: what it is HANDED (the cut, not the
 * frame), when it is not asked at all, and what happens when it comes back
 * empty. A reader that is merely present is the inert-store defect this program
 * has already paid for twice.
 */
describe("the words read", () => {
  const HER_LEFT = { x: 26, y: 10, width: 6, height: 6 };
  const HER_RIGHT = { x: 8, y: 10, width: 6, height: 6 };

  async function texturedFrame(size = 40): Promise<Buffer> {
    const data = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const at = (y * size + x) * 3;
        data[at] = (x * 7 + y * 3) % 256;
        data[at + 1] = (x * 3 + y * 11) % 256;
        data[at + 2] = (x * 13 + y * 5) % 256;
      }
    }
    return sharp(data, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
  }

  /** Records every call, and answers with a sentence naming the view it got. */
  function wordsReader(answer: (noun: string, view: string) => string | null) {
    const calls: Array<{ noun: string; view: string; bytes: number }> = [];
    const readWords = async (input: { noun: string; view: string; bytes: Buffer }) => {
      calls.push({ noun: input.noun, view: input.view, bytes: input.bytes.length });
      return answer(input.noun, input.view);
    };
    return { calls, readWords };
  }

  const earringSlot = (instance: "left" | "right"): SlotSpec => ({
    slot: `earring@${instance}`,
    tier: "item",
    noun: `${instance} earring`,
    /* The words the slot ARRIVES with — the frame-wide caption that caused all
       of this. Every assertion below is that these do not reach a row. */
    words: ["gold hoops and dark tortoiseshell glasses"],
    question: "earring",
    guardKind: "hair",
    frame: "ownSide",
  });

  it("files what the read says about THE CUT, never the words the slot arrived with", async () => {
    const bench = harness({ guardRead: rect(HER_LEFT) });
    const reader = wordsReader((noun) => `a slim gold hoop at the ${noun}.`);
    await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await texturedFrame() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["earring", rect(HER_LEFT)]]),
      masterSideRegions: new Map([["earring", { left: rect(HER_LEFT), right: rect(HER_RIGHT) }]]),
      slots: [earringSlot("left")],
      dependencies: { ...bench.dependencies, readWords: reader.readWords } as never,
    });

    /* Handed the CUT — the whole point. A crop of her left earlobe cannot be
       described as glasses, because the glasses are not in the bytes. */
    expect(reader.calls).toHaveLength(1);
    expect(reader.calls[0]!.view).toBe("cut");
    expect(reader.calls[0]!.noun).toBe("left earring");
    expect(bench.rows[0]!.words).toEqual(["a slim gold hoop at the left earring"]);
    /* And the terminator the join would have doubled is gone. */
    expect(bench.rows[0]!.words[0]).not.toMatch(/\.$/);
  });

  it("NEVER asks about an accessory against the frame, and files no row at all", async () => {
    /*
      No side map and no ground, so there is no cut. Reading the whole frame for
      "her left earring" is exactly the read that wrote her glasses into an
      earring row four times, so it is not made — and the slot files nothing, so
      its newest existing row keeps carrying rather than being superseded by
      silence.
    */
    const bench = harness();
    const reader = wordsReader(() => "gold hoops and dark tortoiseshell glasses");
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await texturedFrame() },
      applied: null,
      masterRegions: new Map(),
      slots: [earringSlot("left")],
      dependencies: { ...bench.dependencies, readWords: reader.readWords } as never,
    });

    expect(reader.calls).toEqual([]);
    expect(result.slots[0]).toMatchObject({ slot: "earring@left", outcome: "unread", reason: "noCut" });
    expect(bench.rows).toEqual([]);
  });

  it("reads the FRAME for an anatomy slot the region vocabulary cannot name", async () => {
    /* "Her jaw" names one thing a face has one of, so the frame is honest for
       it — and there is no question to cut it with anyway. */
    const bench = harness();
    const reader = wordsReader(() => "a soft rounded jawline");
    await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await texturedFrame() },
      applied: null,
      masterRegions: new Map(),
      slots: [hairSlot({ slot: "jaw", noun: "jaw", question: null, guardKind: null })],
      dependencies: { ...bench.dependencies, readWords: reader.readWords } as never,
    });

    expect(reader.calls).toMatchObject([{ noun: "jaw", view: "frame" }]);
    expect(bench.rows[0]!.words).toEqual(["a soft rounded jawline"]);
  });

  it("keeps the crop with an EMPTY stack when the read comes back empty", async () => {
    /*
      The crop is the carrier and the assembler says "the same hair, unchanged"
      for an empty stack. Dropping the row would strand bytes already planned
      for storage and forget a picture the guard had passed.
    */
    const bench = harness();
    const reader = wordsReader(() => null);
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await texturedFrame() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["hair", rect(HAIR)]]),
      slots: [hairSlot()],
      dependencies: { ...bench.dependencies, readWords: reader.readWords } as never,
    });

    expect(result.slots[0]).toMatchObject({ slot: "hair", outcome: "stored" });
    expect(bench.rows[0]!.words).toEqual([]);
    expect(bench.rows[0]!.image).toBeDefined();
  });

  it("changes nothing at all when no reader is wired", async () => {
    /* The old road, byte for byte: the slot files the words it arrived with. */
    const bench = harness();
    await mint([hairSlot()], bench);
    expect(bench.rows[0]!.words).toEqual(["a blunt shoulder-length bob"]);
  });
});

/**
 * HER BUILD — the region nobody can be asked for, composed and cut.
 *
 * The body bench (opus-326) found a delivered build lost ENTIRELY on the next
 * edit, 3 faces of 3, and the same below-head crop keeping 92–109% of it. These
 * cases drive the door that crop now comes through: composed from a matte and a
 * head read on the frame in hand, judged by arithmetic rather than by a specimen
 * nobody calibrated, and never intersected with where the paint was allowed to
 * go.
 */
describe("the composed region", () => {
  const SIZE = 40;
  /** A frame with real texture, so two different crops are two different
   *  digests and the duplicate door can be told apart from a passing one. */
  async function bodyFrame(size = SIZE): Promise<Buffer> {
    const data = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const at = (y * size + x) * 3;
        data[at] = (x * 7) % 256;
        data[at + 1] = (y * 5) % 256;
        data[at + 2] = ((x + 1) * (y + 3)) % 256;
      }
    }
    return sharp(data, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
  }

  /** Her head high in the frame; her shoulders and body below it. */
  const HEAD = { x: 14, y: 4, width: 12, height: 12 };
  const BODY = { x: 8, y: 16, width: 24, height: 24 };
  const head = rect(HEAD);
  const subject = unionMasks(rect(HEAD), rect(BODY));

  function buildSlot(overrides: Partial<SlotSpec> = {}): SlotSpec {
    const definition = slotDefinition("build")!;
    return {
      slot: "build",
      tier: definition.tier,
      noun: definition.noun,
      words: ["noticeably narrower shoulders and slimmer upper arms"],
      question: definition.question,
      guardKind: definition.guardKind,
      frame: definition.frame,
      ...overrides,
    };
  }

  /** The composer's two seams, with every question it asks recorded. */
  function ground(options: { head?: Mask | null; subject?: Mask | null } = {}) {
    const asked: string[] = [];
    return {
      asked,
      derivedGround: {
        region: async (input: { question: string }) => {
          asked.push(input.question);
          return options.head === undefined ? head : options.head;
        },
        subject: async () => {
          asked.push("(subject matte)");
          return options.subject === undefined ? subject : options.subject;
        },
      },
    };
  }

  async function mintBuild(options: {
    slots?: SlotSpec[];
    ground?: ReturnType<typeof ground>;
    applied?: Mask | null;
    knownDigests?: Map<string, string>;
  } = {}) {
    const bench = harness();
    const composer = options.ground ?? ground();
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await bodyFrame() },
      applied: options.applied === undefined
        ? rect({ x: 0, y: 0, width: SIZE, height: SIZE })
        : options.applied,
      masterRegions: new Map(),
      slots: options.slots ?? [buildSlot()],
      knownDigests: options.knownDigests,
      dependencies: {
        ...bench.dependencies,
        derivedGround: composer.derivedGround,
      } as never,
    });
    return { bench, result, asked: composer.asked };
  }

  it("cuts her build from the frame in hand and judges it by ARITHMETIC", async () => {
    const { bench, result } = await mintBuild();

    expect(result.slots[0]).toMatchObject({ slot: "build", outcome: "stored" });
    /* Two objects — the crop for the recipe, the matte for the panel. */
    expect(bench.stored).toHaveLength(2);

    const row = bench.rows[0]!;
    /* The box is her below-head extent, and it starts BELOW her chin: the
       lowest row of the head mask belongs to her head. */
    expect(row.image!.geometry).toEqual({
      bbox: { x: BODY.x, y: HEAD.y + HEAD.height, width: BODY.width, height: BODY.height },
      frame: { width: SIZE, height: SIZE },
    });
    /* And the verdict says which of three instruments read it, at what bar. */
    expect(row.image!.guard).toEqual({
      kind: "derived:below-head",
      coverage: 10_000,
      spill: 0,
      threshold: 10_000,
    });
  });

  it("asks for a head and a matte, and NEVER for the derived key", async () => {
    const { asked } = await mintBuild();
    expect(asked).toEqual(["face", "(subject matte)"]);
    /* The key the catalogue hands out is a phrase no segmenter may receive. */
    expect(asked).not.toContain("derived:below-head");
  });

  it("does NOT intersect her build with where the paint was allowed to go", async () => {
    /*
      THE REGRESSION THIS CASE EXISTS TO SURVIVE.

      `build` is re-cut on every delivered render, including the ones that
      painted her eyes. Routed through `cutSegments` — the obvious tidy-up —
      the region would be intersected with `applied`, and on a "green eyes"
      render `applied` is her eyes: a crop of her eyelids filed as her build.
    */
    const eyesOnly = rect({ x: 16, y: 8, width: 8, height: 4 });
    const { bench, result } = await mintBuild({ applied: eyesOnly });

    expect(result.slots[0]).toMatchObject({ slot: "build", outcome: "stored" });
    expect(bench.rows[0]!.image!.geometry!.bbox)
      .toEqual({ x: BODY.x, y: HEAD.y + HEAD.height, width: BODY.width, height: BODY.height });
  });

  it("takes the ratchet's reading on every render it composes", async () => {
    const { result } = await mintBuild();
    /* Her shoulders are 24px across and her head is 12px tall. */
    expect(result.build).toMatchObject({ spanPx: 24, headPx: 12, ratio: 2, clipped: false });
  });

  it("REFUSES masks at another resolution rather than resizing one to fit", async () => {
    /*
      TWO MODELS ANSWER HERE — a matting model for the silhouette, a segmenter
      for the head — and neither promises the frame's own pixels. The masks
      below compose perfectly WITH EACH OTHER and are simply not this picture;
      resizing one to fit would be a resample inside the one path that promises
      not to, and a box measured in one grid and cut in another is the
      wrong-boundary class with her whole body inside it.
    */
    const half = 20;
    const smallHead = rect({ x: 7, y: 2, width: 6, height: 6 }, half);
    const smallSubject = unionMasks(smallHead, rect({ x: 4, y: 8, width: 12, height: 12 }, half));
    const { bench, result } = await mintBuild({
      ground: ground({ head: smallHead, subject: smallSubject }),
    });

    expect(result.slots[0]).toMatchObject({ slot: "build", outcome: "words-only", reason: "noRegion" });
    expect((result.slots[0] as { detail: string }).detail).toContain("never resize one to fit");
    /* The words still file, exactly as they did before the region existed. */
    expect(bench.rows[0]).toMatchObject({ slot: "build" });
    expect(bench.rows[0]!.image).toBeUndefined();
    expect(bench.stored).toEqual([]);
  });

  it("names WHICH read the frame gave up, rather than reporting a blank", async () => {
    const noMatte = await mintBuild({ ground: ground({ subject: null }) });
    expect((noMatte.result.slots[0] as { detail: string }).detail).toContain("no silhouette");

    const noHead = await mintBuild({ ground: ground({ head: null }) });
    expect((noHead.result.slots[0] as { detail: string }).detail).toContain("no head");
  });

  it("files words, never a crop, when there is no build in the picture", async () => {
    /* Her head reaching the bottom of the frame is a portrait with no body in
       it, and a crop of nothing filed as her build is the failure this whole
       slot's catalogue note is about. */
    const tall = rect({ x: 14, y: 4, width: 12, height: SIZE - 4 });
    const { bench, result } = await mintBuild({
      ground: ground({ head: tall, subject: tall }),
    });

    expect(result.slots[0]).toMatchObject({ slot: "build", outcome: "words-only", reason: "noRegion" });
    expect(bench.stored).toEqual([]);
  });

  it("never stores a build its own reader DISPUTED — and keeps its pixels", async () => {
    /*
      The measured door's precedence, kept at the geometric one (fable-220 §3):
      an unverified delivery may not become what the next render KNOWS her build
      is, and the crop is the only instrument that can say whether the painter
      or the reader was wrong. So the pixels are kept under the refusal's own
      keys — which the assembler cannot see — and the row carries no
      `storageKey` at all.
    */
    const { bench, result } = await mintBuild({ slots: [buildSlot({ disputed: true })] });

    expect(result.slots[0]).toMatchObject({ slot: "build", outcome: "disputed", kept: true });
    const row = bench.rows[0]!;
    expect(row.image).toBeUndefined();
    expect(row.refusal).toMatchObject({ reason: "disputedDelivery", kind: "derived:below-head" });
    expect(row.refusal!.crop!.contentKey).toBe(bench.stored[0]);
    /* The row that exists is EVIDENCE rather than a version: the library's fold
       skips a `disputedDelivery` row entirely, so her previous build stays
       newest and stays good. A disputed build with nothing to show would write
       no row at all. */
    expect(row.image).toBeUndefined();
  });

  it("refuses a crop another slot already holds, at the geometric door too", async () => {
    /* Cut the same region twice and the second is byte-identical to the first.
       Two rows holding one fact is D-242 whichever door let them in. */
    const first = await mintBuild();
    const digest = first.bench.rows[0]!.image!.digest;

    const { bench, result } = await mintBuild({ knownDigests: new Map([["skin", digest]]) });
    expect(result.slots[0]).toMatchObject({
      slot: "build",
      outcome: "words-only",
      reason: "guardRefused",
    });
    expect((result.slots[0] as { detail: string }).detail).toContain("skin");
    expect(bench.stored).toEqual([]);
  });

  it("spends no completeness read on a composed region", async () => {
    /*
      There is nothing to buy: the region was not READ, it was derived, so a
      second read of it would be a read of a question no segmenter answers. The
      guard's own reader is the one seam that must stay untouched here.
    */
    const bench = harness();
    let guardReads = 0;
    const composer = ground();
    await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await bodyFrame() },
      applied: null,
      masterRegions: new Map(),
      slots: [buildSlot()],
      dependencies: {
        ...bench.dependencies,
        read: async () => { guardReads += 1; return rect(BODY); },
        derivedGround: composer.derivedGround,
      } as never,
    });

    expect(guardReads).toBe(0);
    expect(bench.rows[0]!.image).toBeDefined();
  });

  /**
   * WHERE A CALIBRATED RULER SETTLES THE DISPUTE (fable-429 §3).
   *
   * These drive the real court through the real door: no adjudication is
   * stubbed, and the mint's own arithmetic decides every case. The one thing
   * the harness supplies is two frames whose silhouettes differ by a known
   * amount, so a settlement and a decline are the same code path reading two
   * different pictures.
   */
  describe("a disputed build a ruler can measure", () => {
    /** Her anchor: shoulders 24px across, head 12px tall — a ratio of 2.0. */
    const ANCHOR_BODY = { x: 8, y: 16, width: 24, height: 24 };
    /** The delivered frame, 16.7% narrower — past the court's 7.76% bar. */
    const NARROW_BODY = { x: 10, y: 16, width: 20, height: 24 };
    /** And one 4.2% narrower, which is under it. */
    const BARELY_BODY = { x: 8, y: 16, width: 23, height: 24 };

    /**
     * A composer that answers for the frame it is HANDED, which is the whole
     * point: the anchor read and the delivered read are the same two seams
     * asked of two different pictures, and a ground that answered identically
     * for both would make every case pass by reading nothing.
     */
    function twoFrames(options: { anchor: Buffer; delivered: Buffer; body?: typeof BODY }) {
      const asked: Array<{ question: string; anchor: boolean }> = [];
      const deliveredSubject = unionMasks(rect(HEAD), rect(options.body ?? NARROW_BODY));
      const anchorSubject = unionMasks(rect(HEAD), rect(ANCHOR_BODY));
      const isAnchor = (frame: Buffer) => frame.equals(options.anchor);
      return {
        asked,
        get anchorReads() { return asked.filter((entry) => entry.anchor).length; },
        derivedGround: {
          region: async (input: { frame: Buffer; question: string }) => {
            asked.push({ question: input.question, anchor: isAnchor(input.frame) });
            return head;
          },
          subject: async (input: { frame: Buffer }) => {
            asked.push({ question: "(subject matte)", anchor: isAnchor(input.frame) });
            return isAnchor(input.frame) ? anchorSubject : deliveredSubject;
          },
        },
      };
    }

    /**
     * TWO PICTURES OF THE SAME SIZE, with different pixels.
     *
     * Same size because the composer REFUSES masks at another resolution rather
     * than resizing one to fit, so a 41-pixel frame would fail these cases at a
     * door two describes above — green for the wrong reason is the failure this
     * whole file exists to avoid.
     */
    async function tintedFrame(tint: number): Promise<Buffer> {
      const data = Buffer.alloc(SIZE * SIZE * 3);
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const at = (y * SIZE + x) * 3;
          data[at] = (x * 7 + tint) % 256;
          data[at + 1] = (y * 5 + tint) % 256;
          data[at + 2] = ((x + 1) * (y + 3) + tint) % 256;
        }
      }
      return sharp(data, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer();
    }

    async function mintDisputed(options: {
      body?: typeof BODY;
      facets?: readonly string[];
      withAnchor?: boolean;
      knownDigests?: Map<string, string>;
    } = {}) {
      const bench = harness();
      /* Two different pictures, so `frame.equals` can tell them apart the way
         the reader would. */
      const anchor = await tintedFrame(0);
      const delivered = await tintedFrame(64);
      const composer = twoFrames({ anchor, delivered, ...(options.body ? { body: options.body } : {}) });
      const result = await mintReferencesForRender({
        userId: 1,
        variantId: 11,
        frame: { bytes: delivered },
        applied: null,
        masterRegions: new Map(),
        slots: [buildSlot({
          disputed: true,
          disputedFacets: options.facets ?? ["shoulders", "arms"],
        })],
        knownDigests: options.knownDigests,
        ...(options.withAnchor === false ? {} : { anchorFrame: { bytes: anchor } }),
        dependencies: {
          ...bench.dependencies,
          derivedGround: composer.derivedGround,
        } as never,
      });
      return { bench, result, composer };
    }

    it("STORES the crop a reader disputed when the ruler can see the change", async () => {
      /*
        The whole point of the grant. Her shoulders moved 16.7% — twice the
        court's bar and sixteen times its wobble — on a frame whose caption
        reader wrote nothing at all. Before this, that crop was refused, so the
        next render re-anchored on the master and painted her build back.
      */
      const { bench, result } = await mintDisputed();

      expect(result.slots[0]).toMatchObject({
        slot: "build", outcome: "stored", adjudicated: true,
      });
      /* A real row with real pixels, judged by the completeness arithmetic like
         any other crop — the dispute stopped refusing it and decided nothing
         else. */
      const row = bench.rows[0]!;
      expect(row.image).toBeDefined();
      expect(row.image!.guard).toMatchObject({ coverage: 10_000, threshold: 10_000 });
      expect(row.refusal).toBeUndefined();
      expect(bench.stored).toHaveLength(2);
    });

    it("carries BOTH verdicts on the record, never the winner alone", async () => {
      /* Condition 2. A stored crop with the dispute dropped from its record is
         indistinguishable from an ordinary pass, and the disagreement is the
         distribution this program wants. */
      const { result } = await mintDisputed();
      expect(result.adjudications).toHaveLength(1);
      const entry = result.adjudications![0]!;
      expect(entry).toMatchObject({
        slot: "build",
        instrument: "buildSpan",
        reader: "disputed",
        facets: ["shoulders", "arms"],
      });
      expect(entry.verdict.settled).toBe(true);
      /* And the bar it was judged against, with the court that set it. */
      expect(entry.bar).toBeCloseTo(0.0776, 6);
      expect(entry.source).toContain("bench-body-carrier");
    });

    it("keeps the crop REFUSED when the change is under the bar, and records the decline", async () => {
      /* 4.2%: inside the range an unrelated edit has been seen to produce on
         one of the bench's three faces. The ruler declines, the reader's
         refusal stands, and the pixels are kept for a human exactly as before. */
      const { bench, result } = await mintDisputed({ body: BARELY_BODY });

      expect(result.slots[0]).toMatchObject({ slot: "build", outcome: "disputed", kept: true });
      expect(bench.rows[0]!.image).toBeUndefined();
      expect(bench.rows[0]!.refusal).toMatchObject({ reason: "disputedDelivery" });
      expect(result.adjudications![0]!.verdict).toMatchObject({ declined: "belowBar" });
    });

    it("declines a facet its ruler does not measure — and buys NO read to do it", async () => {
      /*
        Condition 3, with its price attached: a waist dispute is refused before
        any call is made, so facet-narrowness costs nothing and cannot be
        skipped for being expensive.
      */
      const { bench, result, composer } = await mintDisputed({ facets: ["waist"] });

      expect(result.slots[0]).toMatchObject({ outcome: "disputed", kept: true });
      expect(bench.rows[0]!.image).toBeUndefined();
      expect(result.adjudications![0]!.verdict).toMatchObject({ declined: "facetOutsideCourt" });
      expect(composer.anchorReads).toBe(0);
    });

    it("declines when the branch already holds a build crop", async () => {
      /* Every specimen is master → FIRST body edit. On a branch that already
         bought one, the delta contains the earlier purchase and the ruler would
         be confirming a delivery this render may never have made. */
      const { bench, result, composer } = await mintDisputed({
        knownDigests: new Map([["build", "a-digest-from-three-renders-ago"]]),
      });

      expect(result.slots[0]).toMatchObject({ outcome: "disputed", kept: true });
      expect(bench.rows[0]!.image).toBeUndefined();
      expect(result.adjudications![0]!.verdict)
        .toMatchObject({ declined: "anchorCarriesPriorDelivery" });
      expect(composer.anchorReads).toBe(0);
    });

    it("changes NOTHING for a caller that hands it no anchor frame", async () => {
      /*
        The additive control. A mint with no anchor cannot compare anything, so
        every disputed slot behaves exactly as it did before this existed — and
        it spends nothing finding that out.
      */
      const { bench, result, composer } = await mintDisputed({ withAnchor: false });

      expect(result.slots[0]).toMatchObject({ outcome: "disputed", kept: true });
      expect(bench.rows[0]!.image).toBeUndefined();
      expect(bench.rows[0]!.refusal).toMatchObject({ reason: "disputedDelivery" });
      expect(result.adjudications![0]!.verdict).toMatchObject({ declined: "noReading" });
      expect(composer.anchorReads).toBe(0);
    });

    it("asks no court at all for a build nobody disputed, and buys no anchor read", async () => {
      /*
        The negative control on the price. An undisputed build is the ordinary
        case — every render of a face with a build to keep — and it must not
        start paying for a ruler nobody needs.
      */
      const bench = harness();
      const anchor = await tintedFrame(0);
      const delivered = await tintedFrame(64);
      const composer = twoFrames({ anchor, delivered });
      const result = await mintReferencesForRender({
        userId: 1,
        variantId: 11,
        frame: { bytes: delivered },
        applied: null,
        masterRegions: new Map(),
        slots: [buildSlot()],
        anchorFrame: { bytes: anchor },
        dependencies: { ...bench.dependencies, derivedGround: composer.derivedGround } as never,
      });

      expect(result.slots[0]).toMatchObject({ outcome: "stored" });
      expect(result.slots[0]).not.toHaveProperty("adjudicated");
      expect(result.adjudications).toBeUndefined();
      expect(composer.anchorReads).toBe(0);
    });

    it("never lets a MEASURED door's dispute reach a court", async () => {
      /*
        Facet-narrowness has a second edge: `hair` has no court, so a disputed
        hair crop is refused however it measures. A family that could inherit
        `build`'s calibration is exactly what condition 3 forbids, and this is
        the case that would go green if one ever did.
      */
      const bench = harness();
      const result = await mint(
        [hairSlot({ disputed: true, disputedFacets: ["hairColour"] })],
        bench,
      );
      expect(result.slots[0]).toMatchObject({ slot: "hair", outcome: "disputed", kept: true });
      expect(bench.rows[0]!.image).toBeUndefined();
      expect(result.adjudications).toBeUndefined();
    });
  });
});
