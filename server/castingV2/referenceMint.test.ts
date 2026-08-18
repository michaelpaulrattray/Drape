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
import { slotDefinition, slotSpecFor } from "./referenceSlotCatalogue";
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
  /** What a NAMED question finds, for the readers that are not the door's. */
  answers?: Record<string, Mask | null>;
  /** A reader that cannot answer at all — the courtesy read's worst case. */
  readThrows?: boolean;
  storeFails?: boolean;
} = {}) {
  const stored: string[] = [];
  const manifests: string[][] = [];
  const asked: string[] = [];
  let recorded: Recorded | null = null;
  return {
    stored,
    manifests,
    asked,
    get rows() { return recorded?.rows ?? []; },
    get batchId() { return recorded?.cleanupBatchId; },
    dependencies: {
      enabledFor: () => true,
      read: async (input: { question: string }) => {
        asked.push(input.question);
        if (options.readThrows) throw new Error("the segmenter said no");
        const named = options.answers?.[input.question];
        if (named !== undefined) return named;
        return options.guardRead === undefined ? rect(HAIR) : options.guardRead;
      },
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
    /* The stand-in kind is `nose`, and it used to be `lips`. Not a weakening:
       this case is about the ONE refusal that keeps its pixels, and any
       unmeasured kind states it. `lips` stopped being able to stand for the
       class the day it got a door of its own in front of this one (fable-493),
       and a fixture that carries a second rule is a fixture that fails for
       reasons the case is not about. */
    const bench = harness();
    const result = await mint([hairSlot({ slot: "nose", noun: "nose", guardKind: "nose" })], bench);

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
      kind: "nose",
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
    /*
      ALL THREE MEMBERS OF THE CLASS NOW FILE THEIR WORDS (fable-927 §3 for
      `noQuestion`, fable-930 §2 for these two).

      This test used to assert the opposite for all three: a disputed slot with
      no crop kept nothing, "because the row would carry no picture and the
      words would assert a delivery the reader denied". That reasoning is right
      about pixels and wrong about the row — where there is no crop the words
      are not the assist, they are the only carrier, and the recipe's standing
      clauses are built from library rows alone. A slot that files nothing is a
      feature the next render is never told about.

      So what is asserted here now is that each still spends NO vision call and
      stores NO object; what it files is one words-only row apiece.
    */
    let reads = 0;
    const bench = harness();
    const counted = {
      ...bench,
      dependencies: { ...bench.dependencies, read: async () => { reads += 1; return rect(HAIR); } },
    };
    const result = await mint([
      hairSlot({ slot: "skin", tier: "surface", noun: "skin", words: ["a light tan"], question: "face skin", guardKind: "skin", disputed: true }),
      hairSlot({ slot: "eyebrows", noun: "eyebrows", words: ["fuller brows"], question: "eyebrows", guardKind: "eyebrows", disputed: true }),
    ], counted);

    expect(result.outcome).toBe("stored");
    expect(result.slots).toEqual([
      { slot: "skin", outcome: "words-only", reason: "surface" },
      expect.objectContaining({ slot: "eyebrows", outcome: "words-only", reason: "noRegion" }),
    ]);
    /* Still no reading bought and still no object stored — a disputed slot with
       no crop was never going to have pixels, and this fix does not give it
       any. What changed is that its WORDS survive. */
    expect(reads).toBe(0);
    expect(bench.stored).toEqual([]);
    expect(bench.rows).toEqual([
      expect.objectContaining({ slot: "skin", words: ["a light tan"] }),
      expect.objectContaining({ slot: "eyebrows", words: ["fuller brows"] }),
    ]);
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

  it("STILL files the words when a question-less slot's reading was disputed", async () => {
    /*
      THE RECIPE-SILENCE DEFECT, at the line that caused it (opus-682/683).

      A disputed slot keeps its refused CROP so a human can settle
      reader-versus-painter. For a question-less slot there is no crop — and the
      branch concluded from that "nothing a human could settle", so it kept
      NOTHING. But the words are not the assist here, they are the only carrier:
      the recipe's standing clauses are built from library rows alone, so a slot
      that files nothing is a feature the next render never hears about.

      Measured on the real chain: `skin` holds `marks`, her freckles were asked
      for and paid for on v#457, the delivery reader called them absent (wrongly
      — they are visibly there at native pixels), the slot filed nothing, and
      v#458's recipe said not one word about her skin. Born freckles ride the
      master's pixels and survived; the ones she paid for did not.

      So a disputed question-less slot files its words. There is no crop to
      argue about, so there is nothing for the dispute to withhold.
    */
    const bench = harness();
    const result = await mint(
      [{
        ...hairSlot({ slot: "skin", noun: "skin", words: ["freckles across her nose and cheeks"], question: null, guardKind: null }),
        disputed: true,
        disputedFacets: ["marks"],
      } as never],
      bench,
    );

    expect(result.outcome).toBe("stored");
    expect(bench.rows[0]).toMatchObject({
      slot: "skin",
      words: ["freckles across her nose and cheeks"],
    });
    expect(bench.rows[0]!.image).toBeUndefined();
    expect(bench.stored).toEqual([]);
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

  /**
   * ONE DESCRIPTION FOR A MATCHED PAIR, TWO FOR A REAL ONE (founder
   * 2026-08-15; fable-591 §1 and the negative control fable-592 makes
   * mandatory).
   *
   * His #193 delivered identical crosses and filed two different sentences
   * about them — the describer is asked once per side, and two calls about one
   * object come back with two answers. His own limit is the second arm: *"the
   * description can genuinely be different if I edit the left or right earring
   * to genuinely be a different earring, or ask for 2 different earrings in the
   * first place"*, and a patch that forced agreement onto a deliberate mismatch
   * would erase the capability click-to-scope shipped.
   *
   * The reader here answers with a DIFFERENT sentence every call, which is the
   * describer's variance made deterministic: if the pair rule is not doing the
   * work, the two rows cannot agree by accident.
   */
  const pairBench = async (leftWords: string[], rightWords: string[]) => {
    const bench = harness({ guardRead: rect(HER_LEFT) });
    let call = 0;
    const reader = wordsReader(() => {
      call += 1;
      return `describer answer number ${call}`;
    });
    await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await texturedFrame() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["earring", rect(HER_LEFT)]]),
      masterSideRegions: new Map([["earring", { left: rect(HER_LEFT), right: rect(HER_RIGHT) }]]),
      slots: [
        { ...earringSlot("left"), words: leftWords },
        { ...earringSlot("right"), words: rightWords },
      ],
      dependencies: { ...bench.dependencies, readWords: reader.readWords } as never,
    });
    return { bench, reader };
  };

  it("describes a pair ASKED AS A PAIR once, and files that one description on both sides", async () => {
    const { bench, reader } = await pairBench(["dangly cross earrings"], ["dangly cross earrings"]);

    expect(reader.calls, "one object, one read — and one vision call saved").toHaveLength(1);
    const words = bench.rows.map((row) => row.words.join(" "));
    expect(words).toHaveLength(2);
    expect(words[0]).toBe(words[1]);
  });

  it("CONTROL — a pair asked as two different things keeps its two descriptions", async () => {
    const { bench, reader } = await pairBench(
      ["a thin gold hoop"],
      ["a silver stud"],
    );

    expect(reader.calls, "two things, two reads").toHaveLength(2);
    const words = bench.rows.map((row) => row.words.join(" "));
    expect(words).toHaveLength(2);
    expect(words[0]).not.toBe(words[1]);
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

/*
  A LIPS CROP IS CUT FROM A CLOSED MOUTH, OR IT WAITS (fable-493).

  "The lips" is the cutting word from today (measured: 0.2342% on the founder's
  smiling frame against 0.0000% for the bare "lips" that shipped before it), and
  the word that finally reaches an open mouth is the word that can cut one. A
  reference of PARTED lips with teeth between them would be handed to every later
  render as what her lips ARE — an expression smuggled into an identity fact.

  Both arms are driven here rather than reasoned about, because the difference
  between them is one vision call answering or not answering.
*/
describe("a lips crop and an open mouth", () => {
  /* Her mouth on the frame, and the region the door reads back — the same
     rectangle, so nothing in these arms turns on a coverage number. */
  const LIPS = { x: 14, y: 20, width: 12, height: 6 };
  const onTheFrame = { masterRegions: new Map([["lips", rect(LIPS)]]) };
  const lipsSlot = () => hairSlot({
    slot: "lips",
    noun: "lips",
    guardKind: "lips",
    /* The catalogue's own key, which is what a real slot carries — the words
       that reach the segmenter ("the lips") are the READER's business, and
       proving that translation is `falRegionReader.test.ts`'s wire assertion. */
    question: "lips",
    words: ["full, softly defined"],
  });

  it("files her words and keeps NO crop when the delivered frame is smiling", async () => {
    /* The teeth answer, which is what smiling means to this guard. */
    const bench = harness({
      answers: { lips: rect(LIPS), teeth: rect({ x: 16, y: 22, width: 6, height: 3 }) },
    });
    const result = await mint([lipsSlot()], bench, onTheFrame);

    expect(result.slots[0]).toMatchObject({
      slot: "lips",
      outcome: "words-only",
      reason: "guardRefused",
      /* NOT kept for adoption either — and that is the ordering's whole point.
         `lips` has no completeness specimen, so without this door the crop would
         be kept as the candidate specimen the lips bar is one day derived from,
         and the bar would be calibrated on a mouth full of teeth. */
    });
    /* NOT kept for adoption either — and that is the ordering's whole point.
       `lips` has no completeness specimen, so without this door the crop would
       be kept as the candidate the lips bar is one day derived from, and the
       bar would be calibrated on a mouth full of teeth. */
    const filed = result.slots[0]!;
    expect("keptForAdoption" in filed && filed.keptForAdoption).toBeFalsy();

    /* Nothing was written and nothing was reserved: no object, no manifest. */
    expect(bench.stored).toEqual([]);
    expect(bench.manifests).toEqual([]);

    const row = bench.rows[0]!;
    expect(row.image).toBeUndefined();
    /* The words file exactly as they always did — the row still says what her
       lips are, and the panel still draws its row. */
    expect(row.words).toEqual(["full, softly defined"]);
    /* NO NUMBER on the refusal: nothing measured this crop's completeness. */
    expect(row.refusal).toEqual({ reason: "mouthOpen", kind: "lips" });

    /* And the question was asked at the wire, of the region that discriminates
       — not of the lips, which answer either way. */
    expect(bench.asked).toContain("teeth");
  });

  it("mints exactly as it did before, on a closed mouth", async () => {
    /* The teeth region finds nothing, which is what a closed mouth reads as. */
    const bench = harness({ answers: { lips: rect(LIPS), teeth: null } });
    const result = await mint([lipsSlot()], bench, onTheFrame);

    /* Today that is `noSpecimen` — nobody has measured a complete lips crop —
       and its pixels are kept for exactly that purpose. The point of this arm
       is that the new door is INVISIBLE here: this is the verdict the mint gave
       before it existed, with its two objects and its manifest. */
    expect(result.slots[0]).toMatchObject({
      outcome: "words-only",
      reason: "guardRefused",
      keptForAdoption: true,
    });
    expect(bench.stored).toHaveLength(2);
    expect(bench.manifests[0]).toEqual(bench.stored);
    expect(bench.rows[0]!.refusal).toMatchObject({ reason: "noSpecimen", kind: "lips" });
  });

  it("does not refuse when the mouth cannot be read at all", async () => {
    /*
      The asymmetry, deliberately the other way round from D-235's.

      An affirmative needs a reading — but this reading is a COURTESY the mint
      buys on its own initiative, and an instrument that cannot answer must not
      be able to turn away a crop that nothing is wrong with. A reader that
      throws leaves the mint exactly where it was before this guard existed.
    */
    const bench = harness({ readThrows: true });
    const result = await mint([lipsSlot()], bench, onTheFrame);

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    /* `readDidNotSettle`, from the completeness door — NOT `mouthOpen`. */
    expect(bench.rows[0]!.refusal).toMatchObject({ reason: "readDidNotSettle" });
  });

  it("buys no teeth read for any other slot", async () => {
    const bench = harness();
    await mint([hairSlot()], bench);
    expect(bench.asked).not.toContain("teeth");
  });
});

/**
 * WHETHER THE DESCRIBER IS ASKED ONE SLOT AT A TIME (stage 3b).
 *
 * The mint asks the describer once per slot, across five loops, and a render
 * with six slots used to wait through six calls in series on the customer's
 * paid clock. Nothing in this file could tell that apart from the same calls
 * made together: every case above drives a slot count of one or two whose
 * answers do not depend on each other, so serial and parallel produce identical
 * rows.
 *
 * So this asks the question directly, the way the caption fixture does — were
 * two reads ever in flight at the same moment? — with a barrier that opens on
 * ARRIVAL and, failing that, on a timer. A serial mint can only open it by the
 * timer. The one-slot arm is the negative control: the same barrier, the same
 * escape, a render that cannot overlap.
 */
describe("the words for many slots are asked together", () => {
  const captionBarrier = (expected: number, escapeMs = 250) => {
    const entered: string[] = [];
    let openedBy: "arrival" | "escape" | "never" = "never";
    let release!: () => void;
    const opened = new Promise<void>((resolve) => { release = resolve; });
    let escape: NodeJS.Timeout | null = null;
    const readWords = async (input: { noun: string }) => {
      entered.push(input.noun);
      if (entered.length >= expected) {
        if (escape) clearTimeout(escape);
        if (openedBy === "never") openedBy = "arrival";
        release();
      } else if (!escape) {
        escape = setTimeout(() => {
          if (openedBy === "never") openedBy = "escape";
          release();
        }, escapeMs);
      }
      await opened;
      return `a described ${input.noun}`;
    };
    return {
      readWords,
      entered,
      openedBy: () => openedBy,
      done: () => { if (escape) clearTimeout(escape); },
    };
  };

  /* Two surface slots: words-only by construction, no cut, no guard — the
     simplest pair of reads the mint makes, and one of the five loops. */
  const surfaceSlot = (slot: string, noun: string): SlotSpec => hairSlot({
    slot: slot as SlotSpec["slot"],
    tier: "surface",
    noun,
    words: [`whatever ${noun} arrived with`],
    question: null,
    guardKind: null,
  });

  it("asks for two slots' words at once", async () => {
    const barrier = captionBarrier(2);
    const bench = harness();
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["hair", rect(HAIR)]]),
      slots: [surfaceSlot("skin", "skin"), surfaceSlot("freckles", "freckles")],
      dependencies: { ...bench.dependencies, readWords: barrier.readWords } as never,
    });
    barrier.done();

    expect(barrier.entered.sort(), "both slots were described").toEqual(["freckles", "skin"]);
    expect(barrier.openedBy(), "the second read began before the first returned").toBe("arrival");
    /* And the rows are what they were: same slots, in the slots' own order,
       each carrying its own read rather than its neighbour's. */
    expect(result.slots.map((entry) => entry.slot)).toEqual(["skin", "freckles"]);
    expect(bench.rows.map((row) => [row.slot, row.words[0]])).toEqual([
      ["skin", "a described skin"],
      ["freckles", "a described freckles"],
    ]);
  });

  it("CONTROL — one slot cannot overlap, and the same barrier says so", async () => {
    const barrier = captionBarrier(2);
    const bench = harness();
    await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["hair", rect(HAIR)]]),
      slots: [surfaceSlot("skin", "skin")],
      dependencies: { ...bench.dependencies, readWords: barrier.readWords } as never,
    });
    barrier.done();

    expect(barrier.entered, "one slot, one read").toEqual(["skin"]);
    expect(barrier.openedBy(), "nothing to overlap with — the barrier times out").toBe("escape");
  });
});

/**
 * AND THE READS THAT MUST NOT BE STARTED (stage 3b's own risk).
 *
 * Starting the reads before the loops is only safe while the set started
 * matches the set the loops would ask for, predicate for predicate. A slot the
 * loops skip — a disputed one, which files nothing and is in the list for its
 * pixels alone — must not be described here, or the change would quietly buy a
 * vision call per render that the serial version never made.
 *
 * This is the arm that would catch that: it costs nothing, it is exact, and it
 * fails on a `filter` that drifts by one predicate.
 */
describe("no slot is described that the mint would not have asked about", () => {
  it("spends one read for one askable slot, whatever else is on the list", async () => {
    const asked: string[] = [];
    const bench = harness();
    await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: rect({ x: 0, y: 0, width: 40, height: 40 }),
      masterRegions: new Map([["hair", rect(HAIR)]]),
      slots: [
        hairSlot({
          slot: "skin", tier: "surface", noun: "skin", question: null, guardKind: null,
          words: ["a warm even tan"], disputed: true,
        }),
        hairSlot({
          slot: "freckles", tier: "surface", noun: "freckles", question: null, guardKind: null,
          words: ["a light scatter across the nose"],
        }),
      ],
      dependencies: {
        ...bench.dependencies,
        readWords: async (input: { noun: string }) => { asked.push(input.noun); return `a described ${input.noun}`; },
      } as never,
    });

    expect(asked, "the disputed slot is not described, and is not read for either").toEqual(["freckles"]);
  });
});

/**
 * THE OPEN LANE'S ABSENCE CONTROL — the door a kind nobody catalogued goes
 * through (OPEN_LANE_DESIGN_NOTE §4, step 3; the `noSpecimen` bound of
 * fable-766 §2).
 *
 * The measured door scores a crop against a specimen family. An open kind has
 * no family, because a family is a measurement and nobody has measured a kind
 * nobody has catalogued — so the catalogue records that as an explicit reason
 * rather than a silent null, and **the bound that came with that ratification
 * is that the mint door must demonstrably READ it.** A recorded fact nobody
 * consults is the gate-not-reader class, which this campaign has already paid
 * for once.
 *
 * What stands at the door instead is §4's control, and its shape is the one
 * this program uses everywhere: *an affirmative from an instrument never seen
 * to decline is not evidence.* A segmenter asked where the fangs are on a face
 * with none will return a small confident region of mouth, and a crop of that
 * is not a diagnostic — it is a permanent instruction to paint nothing, in a
 * place, forever.
 *
 * So the same reader is asked the same question of the BEFORE-picture, which
 * the mint is already handed for the ruler. Decline there and the crop mints;
 * answer there and the kind falls to words with its reason on the row.
 */
describe("the open lane's absence control", () => {
  /** Where the reader claims to find fangs on the delivered frame. */
  const FANGS = { x: 17, y: 24, width: 6, height: 4 };

  /** A frame the anchor read can be told apart from — a different colour, so an
   *  assertion about WHICH bytes were handed over cannot pass by accident. */
  async function anchorBytes(): Promise<Buffer> {
    return sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).png().toBuffer();
  }

  /** The slot as the real catalogue makes it — question, no guard kind, and the
   *  recorded reason. Built rather than typed, so a change to the catalogue's
   *  open branch reaches these arms instead of passing them by. */
  function openSlot(): SlotSpec {
    const spec = slotSpecFor("open:fangs" as never, ["long slender fangs"]);
    if (spec === null) throw new Error("the catalogue no longer makes a spec for an open kind");
    return spec;
  }

  /**
   * A mint on the repaint's own terms — no harvest map, a ground reader, and
   * the before-picture the ruler is already given.
   *
   * `beforeRead` is what the reader answers when handed the ANCHOR bytes: null
   * is a clean decline, a mask is the reader answering on a frame that does not
   * hold the thing.
   */
  async function mintOpen(options: {
    beforeRead?: Mask | null;
    withAnchor?: boolean;
    slots?: SlotSpec[];
  } = {}) {
    const bench = harness({ guardRead: rect(FANGS) });
    const anchor = await anchorBytes();
    const delivered = await frameBytes();
    const calls: Array<{ question: string; onAnchor: boolean }> = [];
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: delivered },
      applied: null,
      masterRegions: new Map(),
      slots: options.slots ?? [openSlot()],
      ...(options.withAnchor === false ? {} : { anchorFrame: { bytes: anchor } }),
      dependencies: {
        ...bench.dependencies,
        readGround: async (ask: { frame: Buffer; question: string }) => {
          const onAnchor = ask.frame.equals(anchor);
          calls.push({ question: ask.question, onAnchor });
          if (onAnchor) return options.beforeRead === undefined ? null : options.beforeRead;
          return rect(FANGS);
        },
      } as never,
    });
    return { bench, result, calls };
  }

  it("mints the crop when the reader DECLINES on the before-picture", async () => {
    const { bench, result, calls } = await mintOpen({ beforeRead: null });

    expect(result.slots[0]).toMatchObject({ slot: "open:fangs", outcome: "stored" });
    expect(bench.stored).toHaveLength(2);
    /* ONE ROW. The open kind left the words-only loop and joined the cut list,
       and a slot both loops claim files its slot twice — a second version of
       the same feature in the same render, which the fold would then read as
       history. */
    expect(bench.rows).toHaveLength(1);
    expect(result.slots).toHaveLength(1);

    /*
      THE BAR ON THE ROW IS THE CEILING, and no row claims a family that does
      not exist: the crop holds every pixel of an independent second read of its
      own region, so 1.0 is measured against 1.0 — the comparison that actually
      happened — and `fangs` names what was judged rather than a specimen family
      anybody has calibrated.
    */
    expect(bench.rows[0]!.image!.guard).toEqual({
      kind: "fangs", coverage: 10_000, spill: 0, threshold: 10_000,
    });

    /* Same reader, same question, both frames — one extra call and no more. */
    expect(calls).toEqual([
      { question: "fangs", onAnchor: false },
      { question: "fangs", onAnchor: true },
    ]);
  });

  it("files words and stores NOTHING when the reader answers on the before-picture", async () => {
    /* The measured failure this control exists for: a confident small region on
       a frame that cannot contain the thing. */
    const { bench, result } = await mintOpen({ beforeRead: rect({ x: 16, y: 23, width: 7, height: 5 }) });

    expect(result.slots[0]).toMatchObject({
      slot: "open:fangs",
      outcome: "words-only",
      reason: "guardRefused",
    });
    expect(bench.stored).toEqual([]);
    expect(bench.manifests).toEqual([]);

    /* The words still file — the carrier of record — and the refusal says which
       control turned it away, with NO coverage number, because nothing here
       measured this crop's completeness. */
    expect(bench.rows[0]!.words).toEqual(["long slender fangs"]);
    expect(bench.rows[0]!.refusal).toEqual({ reason: "absenceUnproven", kind: "fangs" });
  });

  it("refuses when the control cannot be RUN — a no-read is not a pass", async () => {
    /* D-235's asymmetry, at the one door where a missing before-picture would
       otherwise become a confident yes. */
    const { bench, result } = await mintOpen({ withAnchor: false });

    expect(result.slots[0]).toMatchObject({ outcome: "words-only", reason: "guardRefused" });
    expect(bench.stored).toEqual([]);
    expect(bench.rows[0]!.refusal).toEqual({ reason: "absenceUnread", kind: "fangs" });
  });

  it("CONTROL — BELOW the ceiling an open kind still refuses `noSpecimen`", async () => {
    /*
      The scope of the whole amendment, driven. `ceilingIsTheBar` widens ONE
      clause: at exactly 1.0 there is no shortfall for a bar to divide, so a
      family would add nothing. One pixel below that and there is a shortfall,
      nobody has measured what share of a fang a complete crop of one holds,
      and the door refuses exactly as it does today — keeping its pixels,
      because that crop is the only thing that can ever teach the bar.

      Without this arm the flag could be accepting everything and the arm above
      would still be green.
    */
    const bench = harness({
      /* The guard's own read finds fangs across four times the crop, so the
         crop covers a quarter of what it claims to be. */
      guardRead: rect({ x: 17, y: 24, width: 12, height: 8 }),
    });
    const anchor = await anchorBytes();
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      applied: null,
      masterRegions: new Map(),
      slots: [openSlot()],
      anchorFrame: { bytes: anchor },
      dependencies: {
        ...bench.dependencies,
        /* Declines cleanly on the before-picture — so the absence control
           PASSES and the refusal below can only come from the bar. */
        readGround: async (ask: { frame: Buffer }) => (ask.frame.equals(anchor) ? null : rect(FANGS)),
      } as never,
    });

    expect(result.slots[0]).toMatchObject({
      slot: "open:fangs", outcome: "words-only", reason: "guardRefused",
    });
    expect(bench.rows[0]!.refusal).toMatchObject({ reason: "noSpecimen", kind: "fangs" });
    /* And its pixels ARE kept, because this is the refusal that exists to
       produce the specimen — the open lane inherits that unchanged. */
    expect(bench.stored).toHaveLength(2);
  });

  it("CONTROL — a slot with NO question is untouched, and buys no read", async () => {
    /*
      The bound's own control (fable-766 §2): behaviour must DIFFER on a
      recorded `noSpecimen` versus the catalogue's ordinary null. Her jaw has no
      question at all — the region vocabulary does not name it — and it files
      exactly the row it has always filed, having bought nothing.
    */
    const jaw = hairSlot({
      slot: "jaw", noun: "jaw", question: null, guardKind: null, words: ["a soft jawline"],
    });
    const { bench, result, calls } = await mintOpen({ slots: [jaw] });

    expect(result.slots[0]).toMatchObject({ slot: "jaw", outcome: "words-only", reason: "noQuestion" });
    expect(calls).toEqual([]);
    expect(bench.stored).toEqual([]);
  });

  it("CONTROL — a CLOSED slot never buys an absence read", async () => {
    /* The property that makes this safe to land on a live path: every kind the
       catalogue owns is judged by its own measured family, exactly as before,
       and cannot pay for this door even by accident. */
    const { bench, result, calls } = await mintOpen({ slots: [hairSlot()] });

    expect(result.slots[0]).toMatchObject({ slot: "hair", outcome: "stored" });
    expect(calls).toEqual([{ question: "hair", onAnchor: false }]);
    expect(bench.rows[0]!.image!.guard).toMatchObject({ kind: "hair", threshold: 9460 });
  });

  /*
    AND THE CROP NO BAR DIVIDED SAYS SO — fable-306's clause, made keepable
    (fable-872 §5).

    The clause promised `ceilingAccepted` would mark the crop "so a later count
    of bar-measured specimens cannot silently include crops no bar ever
    divided". It marked an in-process verdict that nothing read. It could not be
    put on the ROW — the library persists no instrument, so a ceiling acceptance
    and a `derived-geometry` pass both land as 10000/10000 and are
    indistinguishable afterwards — so it is carried onto the render's own
    outcome, which is the level a promotion decision reads at.

    It matters because of step 3: an open kind has no specimen family by
    definition, so EVERY open kind that ever carries is a ceiling acceptance.
    Without this, the first count of what the library has measured would report
    the open lane's crops as bar-measured.
  */
  it("marks a crop NO BAR divided — the open kind's carry is a ceiling acceptance", async () => {
    const { result } = await mintOpen({ beforeRead: null });

    expect(result.slots[0]).toMatchObject({
      slot: "open:fangs", outcome: "stored", ceilingAccepted: true,
    });
  });

  it("CONTROL — a crop a real bar DID divide is not marked", async () => {
    /*
      Without this arm the assertion above passes on a mint that marks
      everything, which is the same verdict wearing a different word. Hair is
      judged at 9460 — a measured family, a real shortfall for the bar to
      divide — and it must come back with no mark at all.
    */
    const { result } = await mintOpen({ slots: [hairSlot()] });

    expect(result.slots[0]).toMatchObject({ slot: "hair", outcome: "stored" });
    expect(result.slots[0]).not.toHaveProperty("ceilingAccepted");
  });
});

/**
 * THE D1 COUNT GATE — a distributed open kind is two crops or it is words
 * (founder verdict fable-987 §1 "yes"; shape and bounds ruled fable-1001).
 *
 * # What is on trial
 *
 * Not the counter — the counting court bought that on real frames (2/1/0
 * discriminated, its instrument the same centroid split this reader performs).
 * What is on trial here is the GATE: that one wing can never be filed under a
 * name that means two, that the refusal says which count it saw, and that the
 * side a crop is filed under is the side the READER answered rather than the
 * half of the picture it happened to land in.
 *
 * # Why the gate has to be here and not at the slot list
 *
 * `mintedSlots` says where pixels would be filed; only the mint has the frame.
 * And the completeness guard cannot stand in for the count: handed a crop of one
 * wing it reads its own one wing and scores 1.0 — the same number it gives the
 * honest pair. A check that answers the same on both is not a check.
 */
describe("the D1 count gate for a distributed open kind", () => {
  /*
    THE TWO WINGS ARE DIFFERENT SIZES ON PURPOSE. The bench frame is a flat
    colour, so two boxes of identical shape cut byte-identical crops — and the
    duplicate door refuses the second, correctly, since two slots holding one
    fact is D-242. A fixture that tripped that guard would be grading this gate
    against a defect of its own making.
  */
  const LEFT_WING = { x: 4, y: 10, width: 8, height: 12 };
  const RIGHT_WING = { x: 27, y: 9, width: 9, height: 13 };

  function wingSlots(): SlotSpec[] {
    return (["left", "right"] as const).map((side) => {
      const spec = slotSpecFor(`open:wings@${side}` as never, ["enormous black wings"]);
      if (spec === null) throw new Error("the catalogue no longer makes a spec for a distributed open kind");
      return spec;
    });
  }

  /**
   * `sides` is what the reader answers for each side, so an arm can make the
   * frame hold two wings, one, or none — and a `null` is that side declining,
   * which is what the real reader returns for a half nothing was found in.
   */
  async function mintWings(sides: { left: Mask | null; right: Mask | null }) {
    const bench = harness({ guardRead: null });
    const ground: Array<{ question: string; side?: string; declaredTwoSided?: true }> = [];
    const guard: Array<{ question: string; side?: string; declaredTwoSided?: true }> = [];
    const answer = (side?: string) => (side === "left" ? sides.left : side === "right" ? sides.right : null);
    /*
      THE BEFORE-PICTURE, because the open lane's absence control stands in
      front of this door and is not being retested here: a crop of an
      uncatalogued kind is refused unless the reader has been shown a frame
      WITHOUT the thing and declined. A different colour so an assertion about
      which bytes were handed over cannot pass by accident, and the readers
      answer nothing on it — the clean decline.
    */
    const anchor = await sharp({
      create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).png().toBuffer();
    const result = await mintReferencesForRender({
      userId: 1,
      variantId: 11,
      frame: { bytes: await frameBytes() },
      anchorFrame: { bytes: anchor },
      applied: null,
      masterRegions: new Map(),
      slots: wingSlots(),
      dependencies: {
        ...bench.dependencies,
        /* The GUARD's own read, and it must be told the side too — a guard that
           cannot scope answers null, files `readDidNotSettle`, and would refuse
           every crop the count just opened the door for. */
        read: async (ask: { question: string; side?: string; declaredTwoSided?: true }) => {
          guard.push(ask);
          return answer(ask.side);
        },
        readGround: async (
          ask: { frame: Buffer; question: string; side?: string; declaredTwoSided?: true },
        ) => {
          if (ask.frame.equals(anchor)) return null;
          ground.push(ask);
          return answer(ask.side);
        },
      } as never,
    });
    return { bench, result, ground, guard };
  }

  it("mints ONE CROP PER SIDE when both sides answer", async () => {
    const { bench, result } = await mintWings({ left: rect(LEFT_WING), right: rect(RIGHT_WING) });

    expect(result.slots.map((slot) => slot.slot)).toEqual(["open:wings@left", "open:wings@right"]);
    expect(result.slots.every((slot) => slot.outcome === "stored")).toBe(true);
    /* Two rows, two crops, and each crop is its own side's pixels — the whole
       point of refusing the union, which would have been one row holding a
       rectangle that spans her torso. */
    expect(bench.rows.map((row) => row.slot)).toEqual(["open:wings@left", "open:wings@right"]);
  });

  it("refuses BOTH crops when only ONE side answers, with the count in the reason", async () => {
    /*
      The failure the gate exists for, and the founder's own specimen: a frame
      holding one wing. Filing it as `wings` is half a picture wearing the whole
      picture's name — the earring history, which does not get a second run in a
      new lane. Both rows fall to words, so the feature still survives the render.
    */
    const { bench, result } = await mintWings({ left: rect(LEFT_WING), right: null });

    expect(result.slots.map((slot) => ({ slot: slot.slot, outcome: slot.outcome }))).toEqual([
      { slot: "open:wings@left", outcome: "words-only" },
      { slot: "open:wings@right", outcome: "words-only" },
    ]);
    for (const slot of result.slots) {
      expect(slot).toMatchObject({ reason: "notAPair" });
      /* The COUNT, said out loud (fable-1001 §4): a refusal that only says "no"
         leaves the next person unable to tell a one-winged frame from a reader
         that declined twice. */
      expect((slot as { detail?: string }).detail).toContain("on 1 of her two sides");
    }
    expect(bench.stored).toEqual([]);
    /* And the words still file, on both rows — a refused crop must never take
       the feature off her. */
    expect(bench.rows.map((row) => row.slot)).toEqual(["open:wings@left", "open:wings@right"]);
  });

  it("refuses when NEITHER side answers, and says zero", async () => {
    const { bench, result } = await mintWings({ left: null, right: null });

    expect(result.slots.every((slot) => slot.outcome === "words-only")).toBe(true);
    expect((result.slots[0] as { detail?: string }).detail).toContain("on 0 of her two sides");
    expect(bench.stored).toEqual([]);
  });

  it("files each side from the side the READER answered — driven mirrored", async () => {
    /*
      THE MIRROR ARM (fable-1001 §4, and the banked image-half-not-anatomy law).

      A per-side claim is only proven with the mirror driven: an implementation
      that took the image's left half and called it her left would pass the arm
      above and be wrong on every frame shot from behind or flipped. So the same
      two masks are handed back under SWAPPED sides, and the crops must swap with
      them — the mint owns no midline of its own and never infers one from where
      a mask happens to sit.
    */
    const straight = await mintWings({ left: rect(LEFT_WING), right: rect(RIGHT_WING) });
    const mirrored = await mintWings({ left: rect(RIGHT_WING), right: rect(LEFT_WING) });

    const digestOf = (bench: typeof straight.bench, slot: string) =>
      bench.rows.find((row) => row.slot === slot)?.image?.digest ?? null;

    expect(digestOf(straight.bench, "open:wings@left")).not.toBeNull();
    /* Her left crop under the mirrored reading is the same bytes as her RIGHT
       crop under the straight one, and vice versa. */
    expect(digestOf(mirrored.bench, "open:wings@left"))
      .toBe(digestOf(straight.bench, "open:wings@right"));
    expect(digestOf(mirrored.bench, "open:wings@right"))
      .toBe(digestOf(straight.bench, "open:wings@left"));
  });

  it("tells the reader the name is two-sided, and buys the count ONCE", async () => {
    /*
      ASSERTED AT THE WIRE, on the argument this program has banked: a contract
      about what gets SENT is proven on the outgoing call, never on a constant
      near it. An open kind is outside the reader's own bilateral vocabulary, so
      without this flag on the wire `regionSides` answers null and every wing
      files words forever — the feature would look built and be inert.

      And the read is bought ONCE for the kind rather than once per side slot:
      two reads of one frame are a second opinion about the same pixels, which is
      how this program manufactured fictional drift once already.
    */
    const { ground, guard } = await mintWings({ left: rect(LEFT_WING), right: rect(RIGHT_WING) });

    expect(ground.map((ask) => ({
      question: ask.question, side: ask.side, declaredTwoSided: ask.declaredTwoSided,
    }))).toEqual([
      { question: "wings", side: "left", declaredTwoSided: true },
      { question: "wings", side: "right", declaredTwoSided: true },
    ]);
    /* The guard's independent second read, scoped to the same side and told the
       same fact — one per crop, and no more. */
    expect(guard.map((ask) => ({ side: ask.side, declaredTwoSided: ask.declaredTwoSided }))).toEqual([
      { side: "left", declaredTwoSided: true },
      { side: "right", declaredTwoSided: true },
    ]);
  });
});
