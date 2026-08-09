import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Refine's MONEY and its ORDER (M8 §10, §12).
 *
 * One invariant, stated the way the Sign suite states its own:
 *
 *   **a variant exists ⟹ money was taken, and money was taken ⟹ a variant
 *   exists or the whole charge came back.**
 *
 * A refine is one image and one unit, so there is no partial state to defend —
 * which makes the interesting cases the boundaries rather than the middle: the
 * refusals that must happen BEFORE anything is claimed, and the failures after
 * the charge that must give back all 25 rather than some of it.
 */

const journal: string[] = [];
const ledger = {
  charges: [] as Array<{ amount: number; reference: string }>,
  refunds: [] as Array<{ amount: number; description: string }>,
};

let chargeSucceeds = true;
let candidateRow: Record<string, unknown>;
let variantRows: Array<Record<string, unknown>>;
let landedVariant: Record<string, unknown> | null = null;
/** What the BRIEF said she wears — the base-worn inventory (D-206). */
let briefWorn: string[] | null = null;
let failedVariant: Record<string, unknown> | null = null;
let engineThrows: Error | null = null;
/**
 * EVERY STRING THE PAINTER WAS ACTUALLY SENT.

 * Assert at the wire (invariant 5): what a render asks for is a property of the
 * prompt that left the building, never of a constant near it. The segment
 * subtraction below is only real if the clause is missing from THIS list.
 */
const sentPrompts: string[] = [];
let renderFault = false;

vi.mock("./spendGuards", () => ({ assertNotFrozen: vi.fn(async () => undefined) }));

vi.mock("../db/castingV2", () => ({
  /*
    THE BRIEF THE REMOVAL NOW CONSULTS (D-206). `briefWorn` is what each test
    sets when it wants a face that was DRAWN wearing something — the origin the
    recipe has never known about.
  */
  getBriefForOwnedCandidate: vi.fn(async () => (briefWorn
    ? {
      compiledBrief: { intent: { statedAccessories: briefWorn } },
      lockContract: {},
      briefText: briefWorn.join(" "),
    }
    : null)),
  getOwnedCandidateWithSelectedFace: vi.fn(async () => {
    journal.push("read");
    if (!candidateRow) return null;
    const selected = variantRows.find((v) => v.publicId === candidateRow.selectedVariantPublicId);
    return {
      candidate: candidateRow,
      variantId: selected ? (selected.id as number) : null,
      variantPublicId: selected ? (selected.publicId as string) : null,
      imageKey: selected ? selected.imageKey : candidateRow.imageKey,
      thumbKey: null,
      internalPrompt: selected ? selected.internalPrompt : candidateRow.internalPrompt,
    };
  }),
}));

vi.mock("../db/castingV2Variants", () => ({
  VariantOwnershipError: class extends Error {},
  listCandidateVariants: vi.fn(async () => variantRows),
  claimVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("claim");
    return {
      id: 500 + variantRows.length,
      publicId: `variant-${variantRows.length + 1}`,
      candidateId: 1,
      sessionId: 1,
      parentVariantId: input.parentVariantPublicId
        ? Number(String(input.parentVariantPublicId).replace("variant-", "")) + 499
        : null,
      baseImageKey: candidateRow.imageKey as string,
      baseInternalPrompt: candidateRow.internalPrompt,
      claimedInstructions: input.instructions,
      claimedDeltas: input.deltas,
      /* Read back from the row, which is what wall (d) composes from. */
      deltas: input.deltas,
    };
  }),
  markVariantDispatched: vi.fn(async () => true),
  VariantLandingError: class extends Error {},
  landVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("land");
    landedVariant = input;
  }),
  failVariant: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("fail");
    failedVariant = input;
    return true;
  }),
  /* The free half of D-163: navigation and re-selection move a pointer and
     open no operation, so they are journalled but never charged. */
  selectVariant: vi.fn(async () => {
    journal.push("select");
    return true;
  }),
  /* The satisfaction ledger's writer (D-175) — journalled so the tests can see
     that a label is written, and that a label failing never costs a render. */
  recordVariantOutcome: vi.fn(async () => {
    journal.push("outcome");
    return true;
  }),
}));

vi.mock("../db/credits", () => ({
  deductCredits: vi.fn(async (
    _userId: number,
    amount: number,
    _type: string,
    _label: string,
    reference: string,
  ) => {
    journal.push("deduct");
    if (!chargeSucceeds) return { success: false, error: "Not enough credits" };
    ledger.charges.push({ amount, reference });
    return { success: true };
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, description: string) => {
    journal.push("refund");
    ledger.refunds.push({ amount, description });
    return { recorded: true };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

vi.mock("../db/generationOperations", () => ({
  markGenerationOperationRunning: vi.fn(async () => {
    journal.push("running");
  }),
}));

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("begin");
    return { type: "claimed", operationId: "11111111-1111-4111-8111-111111111111" };
  }),
  completeDirectOperationSuccess: vi.fn(async () => {
    journal.push("seal:success");
  }),
  completeDirectOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:failure");
    throw input.error;
  }),
  failClaimedDirectOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:claimed-failure");
    throw input.error;
  }),
}));

vi.mock("../storage", () => ({
  /* A REAL png, because the service reads the master's dimensions to pin the
     render size — a fake buffer made that a decode error rather than a test.
     32x48 keeps the master's 2:3 and both dimensions multiples of 16. */
  storageReadBytes: vi.fn(async () => ({ bytes: TINY_MASTER_PNG, contentType: "image/png" })),
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://cdn.example/${key}` })),
  /* Typed removal answers some asks by SELECTING an existing picture, which
     needs the public URL of a row rather than a fresh upload (D-163). */
  storagePublicUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
}));

vi.mock("../db/connection", () => ({
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

/*
  The register-before-write manifest. Journalled because its ORDER is the point:
  the key must be handed to the cleanup worker before the bytes exist, or a
  crash strands a paid picture of a person at a permanent public URL.
*/
vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: vi.fn(async () => {
    journal.push("manifest");
    return { id: "batch-1" };
  }),
}));

vi.mock("./renderFault", () => ({
  detectRenderFault: vi.fn(async () => ({
    fault: renderFault,
    reason: renderFault ? "seam" : "clean",
    detail: "a horizontal seam",
  })),
}));

/*
  The masked path renders through GPT Image 2 at a pinned size — the routing row
  the face wall established. Stubbed here beside the incumbent engine so the
  service suite keeps testing the service; `maskedRefine.test.ts` owns masking.
  Partial mock, so everything else in the module keeps its real implementation.
*/
/* Built once, at module scope, so every mock can hand back the same master. */
const TINY_MASTER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAwCAIAAAD/zu84AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAASklEQVR4nO3YwQkAMAxC0c7uEE7igJ2i0MOD3AMhUX/Omqd1NKgRxRbNoYVUjJqW4YxlVqqI4FXRMdL1AEgg1FBmgfi8Evrxt+UCvS/Il+tSa9kAAAAASUVORK5CYII=",
  "base64",
);

vi.mock("../providers/falImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../providers/falImages")>()),
  createFalMaskedEditEngine: () => ({
    id: "test:masked",
    edit: vi.fn(async (request: { prompt: string }) => {
      sentPrompts.push(request.prompt);
      journal.push("generate");
      if (engineThrows) throw engineThrows;
      return {
        bytes: Buffer.from("refined"),
        contentType: "image/png",
        width: 1024,
        height: 1536,
        latencyMs: 10,
        provenance: { provider: "fal", model: "gpt-image-2", providerRef: "req-1" },
      };
    }),
  }),
}));

/**
 * THE SEGMENT STORE, AT THE SEAM THE PRODUCT ACTUALLY USES.
 *
 * Both calibration benches proved the carried machinery by handing it
 * `writing: [step.facet]` — an argument the product derives for itself, and
 * derived it WRONG for as long as the store has existed. So this suite never
 * hands it anything: it records what the SERVICE decided and asserts on that.
 */
const carriedAsks: Array<{ writing: readonly string[]; anchorVariantId: number | null }> = [];
const assembleAsks: Array<{ writing: readonly string[]; rows?: readonly unknown[] }> = [];
let carriedRowsFixture: Array<Record<string, unknown>> = [];

vi.mock("./carriedSegments", () => ({
  listCarriedRows: vi.fn(async (ask: { writing: readonly string[]; anchorVariantId: number | null }) => {
    carriedAsks.push({ writing: ask.writing, anchorVariantId: ask.anchorVariantId });
    const writing = new Set(ask.writing);
    if (!ask.anchorVariantId) return [];
    return carriedRowsFixture.filter((row) => !writing.has(row.facet as string));
  }),
  assembleWithCarriedSegments: vi.fn(async (ask: {
    writing: readonly string[];
    rows?: readonly unknown[];
    harvested: { bytes: Buffer; contentType: string; evidence?: unknown };
  }) => {
    assembleAsks.push({ writing: ask.writing, rows: ask.rows });
    return {
      bytes: ask.harvested.bytes,
      contentType: ask.harvested.contentType,
      evidence: ask.harvested.evidence ?? null,
      carriedFacets: (ask.rows ?? []).map((row) => (row as { facet: string }).facet),
      assembly: null,
    };
  }),
}));

/** What the render asked permanence to KEEP — captured, never supplied. */
const keptAsks: Array<{ facets: readonly string[]; verdict: string | null }> = [];
vi.mock("./segmentPersistence", () => ({
  keepSegmentsFromRender: vi.fn(async (ask: { facets: readonly string[]; verdict?: string | null }) => {
    keptAsks.push({ facets: ask.facets, verdict: ask.verdict ?? null });
    return { outcome: "off" as const, segments: [] };
  }),
}));

vi.mock("./signEngine", () => ({
  castingIdentityEngine: () => ({
    id: "test",
    editWithReferences: vi.fn(async (request: { prompt: string }) => {
      sentPrompts.push(request.prompt);
      journal.push("generate");
      if (engineThrows) throw engineThrows;
      return {
        bytes: Buffer.from("refined"),
        contentType: "image/png",
        width: 1024,
        height: 1536,
        latencyMs: 10,
        provenance: { provider: "fal", model: "nbp", providerRef: "req-1" },
      };
    }),
    generateView: vi.fn(),
  }),
}));

const { refineCandidate } = await import("./refineService");
const { claimVariant } = await import("../db/castingV2Variants");
const { arrangementWording } = await import("./hairArrangement");

beforeEach(() => {
  journal.length = 0;
  sentPrompts.length = 0;
  carriedAsks.length = 0;
  keptAsks.length = 0;
  assembleAsks.length = 0;
  carriedRowsFixture = [];
  ledger.charges.length = 0;
  ledger.refunds.length = 0;
  chargeSucceeds = true;
  engineThrows = null;
  renderFault = false;
  landedVariant = null;
  failedVariant = null;
  briefWorn = null;
  variantRows = [];
  candidateRow = {
    id: 1,
    publicId: "candidate-public",
    imageKey: "casting-v2/candidates/abc.png",
    signedCastId: null,
    selectedVariantPublicId: null,
    internalPrompt: {
      prompt: "the composed casting instruction",
      resolved: {
        sex: "female",
        ageBand: "30s",
        energy: "warm",
        heritage: [{ heritage: "Nordic", pct: 100 }],
        realized: { eyeColour: "brown", eyeShape: null },
      },
    },
  };
  vi.clearAllMocks();
});

const input = {
  userId: 1,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
  candidatePublicId: "candidate-public",
  instruction: "make her eyes green",
};

/**
 * This suite is about the refinement SERVICE — charging, retrying, refusing,
 * refunding — and not about masking, which `maskedRefine.test.ts` owns.
 *
 * The masked path is live for this suite's user, so without this every test
 * would run a real composite against a flat synthetic swatch and measure the
 * fixture rather than the service. A passthrough keeps each suite testing its
 * own subject, which is why the seam is an injectable dependency like
 * `interpret` and `verifier`.
 */
const unmasked = async (input: { painted: { bytes: Buffer; contentType: string } }) => ({
  bytes: input.painted.bytes,
  contentType: input.painted.contentType,
  outcome: "flag-off" as const,
});

/**
 * WHAT THE SERVICE WROTE DOWN.
 *
 * The real logger is pino writing through its own stream, not through
 * `process.stdout.write` — an interceptor on that seam captured nothing, which
 * is its own small lesson about asserting at the wire you actually have. So the
 * module is replaced for this suite and the records are read back directly.
 * The thing under test is the FIELDS the service chose to write, and those are
 * ours either way.
 */
const logged: { level: string; fields: Record<string, unknown>; message: string }[] = [];
vi.mock("../logging/logger", () => {
  const record = (level: string) => (fields: unknown, message: string) => {
    logged.push({ level, fields: (fields ?? {}) as Record<string, unknown>, message });
  };
  return {
    createModuleLogger: () => ({
      error: record("error"), warn: record("warn"), info: record("info"), debug: record("debug"),
    }),
  };
});

const greenEyes = {
  interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
  harvest: unmasked,
};

/*
  THE SEAM VERDICT RIDES THE ROW ON EVERY RENDER (fable-119).

  It existed only as a log line, and only when it fired — a sample of failures
  with no denominator, which is why the shadow→enforce flip has rested on three
  anecdotes for four shifts. A log is not an artifact a report can be derived
  from; the intersections learned that first (fable-109) and this is the same
  lesson one consumer over.

  Asserted on what is WRITTEN, not on a constant near it: the clean case is the
  one that matters, because a verdict recorded only when it is bad cannot
  produce a rate.
*/
describe("the seam verdict is an artifact, not a log line", () => {
  const composited = async (input: { painted: { bytes: Buffer; contentType: string } }) => ({
    bytes: input.painted.bytes,
    contentType: input.painted.contentType,
    outcome: "composited" as const,
    seam: {
      torn: false,
      enforced: false,
      boundaryPixels: 38_592,
      tornPixels: 0,
      share: 0,
      worstExcess: 73.1,
      signedMean: -10.31,
      signedSpread: 9.22,
      coherence: 1.118,
    },
  });

  it("writes a CLEAN verdict to the row, so the rate has a denominator", async () => {
    await refineCandidate({ ...greenEyes, harvest: composited }, input);
    const stored = (landedVariant?.internalPrompt as { seam?: Record<string, unknown> }).seam;
    expect(stored).toEqual({
      torn: false,
      enforced: false,
      boundaryPixels: 38_592,
      tornPixels: 0,
      share: 0,
      worstExcess: 73.1,
      signedMean: -10.31,
      signedSpread: 9.22,
      coherence: 1.118,
    });
  });

  it("writes nothing when nothing was composited — no boundary, no opinion", async () => {
    await refineCandidate({ ...greenEyes, harvest: unmasked }, input);
    expect((landedVariant?.internalPrompt as { seam?: unknown }).seam).toBeUndefined();
  });
});

describe("refusals land before anything is claimed", () => {
  /*
    §10's whole argument. An out-of-tier ask is a real thing a user will type,
    and it must cost nothing and say so at once — not take 25 credits to make a
    picture that was never going to be what they asked for.
  */
  it("refuses an out-of-tier instruction for free", async () => {
    await expect(refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: false, refusal: { reason: "wall_stage", asked: "her age" } }) },
      { ...input, instruction: "make her older" },
    )).rejects.toThrow(/not the shoot/);

    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
    expect(ledger.charges).toHaveLength(0);
  });

  it("refuses an ask the reading ABSORBED — and the customer keeps their credits", async () => {
    /*
      INVARIANT 7 AT ITS CALL SITE. `saysNothingNew` has its own controls in
      `refineDelta.test.ts`; this proves the service actually asks it, before
      the claim, and that a delta echoing her own record never reaches a charge.

      Her record says brown. A reading that comes back "brown" has lost the
      sentence she typed — and if it were let through she would pay for a
      picture identical to the one she is looking at, with no row in the
      verification net for the thing she asked about.
    */
    await expect(refineCandidate(
      { harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeColour: "brown" as const } }) },
      { ...input, instruction: "make her eyes a warmer brown" },
    )).rejects.toThrow(/already has brown/);

    expect(journal, "nothing was begun").not.toContain("begin");
    expect(journal, "and nothing was deducted").not.toContain("deduct");
    expect(ledger.charges).toHaveLength(0);
  });

  it("does NOT refuse a reading that keeps her sentence, on the same face", async () => {
    /* The negative half, on the same fixture: green is not brown, so the guard
       has nothing to say and the ordinary path runs. */
    const result = await refineCandidate(greenEyes, input);
    expect(result).toBeTruthy();
    expect(ledger.charges.length, "and this one is paid for").toBeGreaterThan(0);
  });

  it("SAYS WHY, in a line that outlives the request", async () => {
    /*
      The gap run-11 fell into. A refusal writes no row — correctly — and used
      to write no log either, so a customer meeting a wall on three plain words
      left nothing behind to diagnose. The value that failed to file rides with
      it, because "which subject" was never the question; "what did it say" was.
    */
    logged.length = 0;
    {
      await expect(refineCandidate(
        {
          harvest: unmasked,
          interpret: async () => ({
            ok: false as const,
            refusal: { reason: "wall_unfileable" as const, asked: "marks", value: "a scar she never mentioned" },
          }),
        },
        { ...input, instruction: "give her freckles" },
      )).rejects.toThrow(/wasn't recorded/);
    }
    const refusal = logged.find((line) => line.message.includes("refused before the charge"));
    expect(refusal, "the refusal left a line").toBeTruthy();
    expect(refusal!.fields.reason).toBe("wall_unfileable");
    expect(refusal!.fields.instruction).toBe("give her freckles");
    expect(refusal!.fields.modelSaid, "and it carries what the model said").toBe("a scar she never mentioned");
    expect(ledger.charges, "still free").toHaveLength(0);
  });

  it("refuses when the interpreter cannot be reached, rather than guessing", async () => {
    await expect(refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: false, refusal: { reason: "unreadable" } }) },
      input,
    )).rejects.toThrow(/Nothing was charged/);
    expect(ledger.charges).toHaveLength(0);
  });

  it("ASKS INSTEAD OF SPENDING when her eyes already sweep up", async () => {
    /*
      THE ALREADY-TRUE GATE, proved at its call site rather than in isolation.

      The walk candidate measures 7.2 degrees of canthal tilt, so "fox eyes" on
      her is an ask for a property she has. Rendering it spends 25 credits to
      produce the face she is looking at and then asks a reader whether it
      complied — which is how a false pass is manufactured. The honest answer is
      a free question.

      This is the half that matters: a gate nobody calls does not exist, and
      until this test existed the gate was built, unit-tested and INERT.
    */
    const W = 400;
    const H = 300;
    const upsweptEyes = () => {
      const data = Buffer.alloc(W * H, 0);
      const put = (x0: number, x1: number, yAt: (x: number) => number) => {
        for (let x = x0; x < x1; x += 1) {
          const y = Math.round(yAt(x));
          for (let dy = -4; dy <= 4; dy += 1) data[(y + dy) * W + x] = 255;
        }
      };
      put(80, 160, (x) => 120 + (x - 80) * 0.25);
      put(240, 320, (x) => 140 - (x - 240) * 0.25);
      return { data, width: W, height: H };
    };
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const asked = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          region: async () => upsweptEyes(),
          subject: async () => upsweptEyes(),
          landmark: async () => [],
        },
      },
      { ...input, instruction: "fox eyes" },
    );

    expect(asked.kind, "a question, in the shape the product asks questions in").toBe("asked");
    expect(asked.reask!.question).toMatch(/already sweep/);
    expect(ledger.charges, "and it costs her nothing").toHaveLength(0);
    expect(journal).not.toContain("begin");
  });

  it("ASKS INSTEAD OF SPENDING when her glasses hide the eyes it must measure", async () => {
    /*
      THE PROTECTION THAT WAS SILENTLY UNAVAILABLE TO PEOPLE IN GLASSES.

      The gate above only fires on a measurement. Measured 2026-08-09: the tilt
      reads on 6 of 6 bare faces and 4 of 8 bespectacled ones — so about half
      the time a woman in glasses was charged 25 credits for an eye edit that
      may have been a no-op, with nothing able to protect her. A measurement
      that could not be taken fell through to the branch that spends.

      Both conditions are required and both are driven here: the tilt read
      FAILS (no eye masks at all) and the picture shows frames.
    */
    const W = 400;
    const H = 300;
    const nothing = () => ({ data: Buffer.alloc(W * H, 0), width: W, height: H });
    /* Well above the measured bespectacled floor of 1.349%. */
    const frames = () => {
      const data = Buffer.alloc(W * H, 0);
      for (let index = 0; index < Math.round(W * H * 0.015); index += 1) data[index] = 255;
      return { data, width: W, height: H };
    };
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const asked = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          /* The eyes cannot be found; the glasses can. That IS the case. */
          region: async ({ name }) => (name === "glasses" ? frames() : nothing()),
          subject: async () => nothing(),
          landmark: async () => [],
        },
      },
      { ...input, instruction: "fox eyes" },
    );

    expect(asked.kind, "a free question, not a charge").toBe("asked");
    expect(asked.reask!.question).toMatch(/glasses are sitting over her eyes/);
    /*
      ONE INSTRUCTION, and it used to be two. `remove her glasses, then fox
      eyes` carried both halves 0 times in 5 through the live interpreter
      (`scripts/drive-compound-chip.mts`) while each half alone carried 5 in 5:
      the compound files as a removal and the eye ask disappears. See
      `glassesHideEyesReask` — the parse is a union that cannot hold both.
    */
    expect(asked.reask!.options[0]!.resolves, "and the first answer leaves her measurable next time")
      .toBe("remove her glasses");
    expect(ledger.charges, "nothing reserved, nothing charged").toHaveLength(0);
  });

  it("does NOT ask a bare-eyed customer whose tilt merely failed to read", async () => {
    /*
      THE FAIL-CLOSED HALF, and the reason the gate is allowed to exist.

      This may only ever ADD a free question. A no-read on a face with no
      frames keeps exactly the old behaviour — she is charged and rendered —
      because the alternative is a new way to withhold a picture somebody
      wanted, which is the failure this program has shipped once already.
    */
    const W = 400;
    const H = 300;
    const nothing = () => ({ data: Buffer.alloc(W * H, 0), width: W, height: H });
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const spent = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          /* Nothing anywhere — no eyes AND no glasses. */
          region: async () => nothing(),
          subject: async () => nothing(),
          landmark: async () => [],
        },
      },
      { ...input, instruction: "fox eyes" },
    );

    expect(spent.kind, "today's behaviour, unchanged").not.toBe("asked");
    expect(ledger.charges.length, "she is charged, as she always was").toBeGreaterThan(0);
  });

  it("falls through to spending when the glasses reader itself throws", async () => {
    /*
      An instrument that cannot answer must not be able to ask. A segmenter
      outage must look exactly like today, never like a new question.
    */
    const W = 400;
    const H = 300;
    const nothing = () => ({ data: Buffer.alloc(W * H, 0), width: W, height: H });
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const spent = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          region: async ({ name }) => {
            if (name === "glasses") throw new Error("the segmenter is down");
            return nothing();
          },
          subject: async () => nothing(),
          landmark: async () => [],
        },
      },
      { ...input, instruction: "fox eyes" },
    );

    expect(spent.kind).not.toBe("asked");
    expect(ledger.charges.length).toBeGreaterThan(0);
  });

  /*
    AND IT ANSWERS THE SENTENCE IN FRONT OF IT — run-8's defect, pinned.

    The gate read `composed.eyeShape`, which carries every earlier step forever.
    So once "fox eyes" was delivered, a customer could not buy anything else:
    run-8's step 3 asked for nude lip gloss and step 4 for gold hoop earrings,
    and BOTH came back *"Her eyes already sweep up at the outer corners. Push
    them further, or leave her as she is?"* with chips reading "More tilt" and
    "Never mind". The fifth step was then consumed answering a question nobody
    had asked.

    A paid, correctly delivered edit locked the product. The gate now keys on
    what THIS sentence wrote.
  */
  it("does not interrupt a LATER ask because an earlier step bought fox eyes", async () => {
    const W = 400;
    const H = 300;
    const upswept = () => {
      const data = Buffer.alloc(W * H, 0);
      const put = (x0: number, x1: number, yAt: (x: number) => number) => {
        for (let x = x0; x < x1; x += 1) {
          const y = Math.round(yAt(x));
          for (let dy = -4; dy <= 4; dy += 1) data[(y + dy) * W + x] = 255;
        }
      };
      put(80, 160, (x) => 120 + (x - 80) * 0.25);
      put(240, 320, (x) => 140 - (x - 240) * 0.25);
      return { data, width: W, height: H };
    };
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    /* Her recipe ALREADY carries the delivered fox eyes, and her face really is
       upswept now — both halves of run-8's state. This sentence is about her
       lips and has nothing to do with her eyes. */
    variantRows = [{
      id: 501,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/one.png",
      instructions: ["fox eyes"],
      stepDeltas: [{ eyeShape: "fox eyes" }],
      deltas: { eyeShape: "fox eyes" },
      internalPrompt: {},
    }];
    candidateRow.selectedVariantPublicId = "variant-1";

    const result = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { makeup: "nude lip gloss" } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          region: async () => upswept(),
          subject: async () => upswept(),
          landmark: async () => [],
        },
      },
      { ...input, instruction: "add nude lip gloss" },
    );

    expect(result.kind, "her lip gloss is rendered, not answered with a question about her eyes")
      .toBe("rendered");
  });

  /*
    AND IT MUST BE ANSWERABLE — which is the half that was missing.

    The gate shipped as a thrown BAD_REQUEST carrying the sentence, so the
    question arrived in the refusal channel with no chips, and `pendingReaskFor`
    had never heard of it: every answer re-derived nothing, fell through to the
    gate, and was asked the same question again. The founder's condition on
    shipping the sentence form is that it must NEVER dead end, and these two
    tests are what say it does not. They fail if the gate stops standing down.
  */
  it("takes YES for an answer, and then actually spends", async () => {
    const W = 400;
    const H = 300;
    const upsweptEyes = () => {
      const data = Buffer.alloc(W * H, 0);
      const put = (x0: number, x1: number, yAt: (x: number) => number) => {
        for (let x = x0; x < x1; x += 1) {
          const y = Math.round(yAt(x));
          for (let dy = -4; dy <= 4; dy += 1) data[(y + dy) * W + x] = 255;
        }
      };
      put(80, 160, (x) => 120 + (x - 80) * 0.25);
      put(240, 320, (x) => 140 - (x - 240) * 0.25);
      return { data, width: W, height: H };
    };
    const sharp = (await import("sharp")).default;
    const face = await sharp({ create: { width: W, height: H, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const answered = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: face, contentType: "image/png" }),
        regions: {
          region: async () => upsweptEyes(),
          subject: async () => upsweptEyes(),
          landmark: async () => [],
        },
      },
      /* Exactly what the chip sends: the outstanding sentence travels as
         `answering`, the label as the instruction. Typing "More tilt" is the
         same request, which is the property that keeps the two routes one. */
      { ...input, instruction: "More tilt", answering: "fox eyes" },
    );

    expect(answered.kind, "the question must not be asked a second time").toBe("rendered");
    expect(ledger.charges, "she said yes, so this one is paid for").toHaveLength(1);
  });

  it("takes NO for an answer, for free, and lands on the face she has", async () => {
    /* Declining has to be as easy as accepting, or the question has one real
       answer and is not a question. It never reaches the claim. */
    const declined = await refineCandidate(
      { harvest: unmasked, interpret: async () => { throw new Error("the parse is never reached"); } },
      { ...input, instruction: "Never mind", answering: "fox eyes" },
    );

    expect(declined.kind).toBe("selected");
    expect(declined.note).toMatch(/nothing was charged/i);
    expect(ledger.charges).toHaveLength(0);
    expect(journal).not.toContain("begin");
  });

  it("measures the face she is LOOKING at, not the one she started from", async () => {
    /*
      ASSERTED AT THE WIRE, because the contract is about which picture gets
      read and a constant near it proves nothing.

      This gate shipped reading `source.candidate.imageKey` — her base — while
      the removal path three hundred lines above reads the SELECTED face and
      says outright that asking the wrong picture is "the record-versus-pixels
      mistake wearing a new hat". On a chain that has already changed her eyes,
      the base is a face nobody is looking at, and the gate would decide whether
      to charge her on the strength of it.
    */
    variantRows.push({
      id: 91,
      publicId: "variant-selected",
      imageKey: "casting-v2/variants/she-is-looking-at-this.png",
      instructions: ["icy blue eyes"],
      stepDeltas: [{ eyeColour: "blue" }],
      deltas: { eyeColour: "blue" },
      internalPrompt: {},
    } as never);
    candidateRow.selectedVariantPublicId = "variant-selected";

    /*
      The two faces are told apart by their SIZE, not by the key that was
      asked for: another read happens earlier in this function for a different
      purpose, so asserting on "the first key requested" would measure that one
      instead. What the gate segments is the thing under test.
    */
    const sharp = (await import("sharp")).default;
    const base = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#808080" } })
      .png().toBuffer();
    const looking = await sharp({ create: { width: 60, height: 60, channels: 3, background: "#808080" } })
      .png().toBuffer();

    const segmented: number[] = [];
    await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async (key: string) => ({
          bytes: key.includes("she-is-looking-at-this") ? looking : base,
          contentType: "image/png",
        }),
        regions: {
          region: async ({ image }: { image: Buffer }) => {
            segmented.push((await sharp(image).metadata()).width ?? 0);
            throw new Error("no eyes — the gate stands down, which this test is not about");
          },
          subject: async () => { throw new Error("no subject"); },
          landmark: async () => [],
        } as never,
      },
      { ...input, instruction: "fox eyes" },
    ).catch(() => undefined);

    expect(segmented[0], "the gate measured her base instead of her selected face").toBe(60);
    candidateRow.selectedVariantPublicId = null;
    variantRows.pop();
  });

  it("still SPENDS when the instrument cannot read her — silence never refuses", async () => {
    /*
      The asymmetry, at the call site. A gate that refuses on a no-read would
      cost a customer the picture they asked for whenever a segmenter had an off
      day, and that is the failure this program has shipped once already. So an
      unreadable face falls through to the ordinary paid path.
    */
    const blind = {
      region: async () => { throw new Error("the segmenter found no eyes to edit"); },
      subject: async () => { throw new Error("no subject"); },
      landmark: async () => [],
    };
    const result = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeShape: "fox eyes" as const } }),
        readBytes: async () => ({ bytes: Buffer.from("not-an-image"), contentType: "image/png" }),
        regions: blind,
      },
      { ...input, instruction: "fox eyes" },
    ).catch((error) => error);
    /* Whatever happens downstream, it must NOT be the gate's refusal. */
    expect(String(result)).not.toMatch(/already sweep/);
  });

  it("refuses a candidate that has already been signed", async () => {
    candidateRow.signedCastId = 42;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/already been signed/);
    expect(journal).not.toContain("begin");
  });

  it("refuses a real TOO_MANY_REQUESTS when the queue is full, before the claim", async () => {
    await expect(refineCandidate({ ...greenEyes, admit: () => false },
      input,
    )).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(journal).not.toContain("begin");
    expect(ledger.charges).toHaveLength(0);
  });
});

/*
  THE QUESTIONS ARE FREE, AND THEY ARE FREE STRUCTURALLY (D-178, D-179, D-180).

  They fire before the parse, so they cost nothing at all — not a claim, not a
  charge, not even the interpreter call. `interpret` here THROWS: if any of
  these ever reached it, the test would fail rather than quietly passing on a
  free-but-slower path.
*/
describe("the questions cost nothing, and never dead-end", () => {
  const explodes = {
    interpret: async () => {
      throw new Error("the interpreter must never be reached by a question");
    },
  };

  it("asks which part a bare colour ask means, with nothing claimed", async () => {
    const result = await refineCandidate(explodes, { ...input, instruction: "pinker" });
    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("which-facet");
    expect(result.reask?.options.map((option) => option.label))
      .toEqual(["the hair", "the eyes", "makeup"]);
    expect(journal).toEqual(["read"]);
    expect(ledger.charges).toHaveLength(0);
  });

  it("asks about a near-miss typo before the money moves", async () => {
    const result = await refineCandidate(explodes, { ...input, instruction: "piink hair" });
    expect(result.kind).toBe("asked");
    expect(result.reask?.question).toContain("Did you mean pink?");
    expect(journal).not.toContain("begin");
    expect(ledger.charges).toHaveLength(0);
  });

  it("runs the answer as the instruction it stands for, and charges once", async () => {
    let seen = "";
    await refineCandidate({ harvest: unmasked,
        interpret: async (parse: { instruction: string }) => {
          seen = parse.instruction;
          return { ok: true as const, delta: { hairColour: "copper" as const } };
        },
      },
      { ...input, instruction: "yes", answering: "piink hair" },
    );
    /* THEIR word, chosen by them — the confirmation is what keeps D-172 intact. */
    expect(seen).toBe("pink hair");
    expect(ledger.charges).toHaveLength(1);
  });

  it("treats an unrecognised reply as a new instruction rather than a dead end", async () => {
    let seen = "";
    await refineCandidate({ harvest: unmasked,
        interpret: async (parse: { instruction: string }) => {
          seen = parse.instruction;
          return { ok: true as const, delta: { hairColour: "copper" as const } };
        },
      },
      { ...input, instruction: "actually give her a fringe", answering: "pinker" },
    );
    expect(seen).toBe("actually give her a fringe");
    expect(ledger.charges).toHaveLength(1);
  });

  it("does not ask twice — an answer is never re-questioned", async () => {
    let seen = "";
    await refineCandidate({ harvest: unmasked,
        interpret: async (parse: { instruction: string }) => {
          seen = parse.instruction;
          return { ok: true as const, delta: { free: { hairShade: "piink" } } };
        },
      },
      { ...input, instruction: "no", answering: "piink hair" },
    );
    /* Still one slip from a known word, and asking again would be the loop the
       question exists to end. */
    expect(seen).toContain("piink hair");
    expect(ledger.charges).toHaveLength(1);
  });
});

/*
  THE HISTORY IS PART OF THE INPUT (D-182).

  The founder's eleven-instruction chain rendered as the original plus pink
  hair, because the stored recipe could not be read and `?? {}` turned that into
  "there was nothing". Nine facts left the prompt and the money moved anyway.
*/
describe("an unreadable history stops the money", () => {
  it("refuses rather than composing from nothing, and charges nothing", async () => {
    variantRows = [{
      id: 501,
      publicId: "variant-legacy",
      candidateId: 1,
      imageKey: "casting-v2/variants/legacy.png",
      internalPrompt: candidateRow.internalPrompt,
      instructions: ["change hair to mullet"],
      /* A shape no reader can make sense of — not legacy, just broken. */
      deltas: { free: { unknowable: { nested: true } } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-legacy";

    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/won't guess at it/);
    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
    expect(ledger.charges).toHaveLength(0);
  });

  it("still allows the FIRST refinement, which has no history at all", async () => {
    /* Nothing stored is legitimate; stored-but-unreadable is the fault. */
    await refineCandidate(greenEyes, input);
    expect(ledger.charges).toHaveLength(1);
  });

  it("reads a legacy chain and carries it forward", async () => {
    variantRows = [{
      id: 502,
      publicId: "variant-old",
      candidateId: 1,
      imageKey: "casting-v2/variants/old.png",
      internalPrompt: candidateRow.internalPrompt,
      instructions: ["change hair to mullet", "seafoam green eyes"],
      /* The founder's own pre-split row shape. */
      deltas: { free: { hair: "mullet", eyes: "seafoam green" } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-old";

    await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { free: { hairShade: "pink" } } }) },
      input,
    );
    const claimed = JSON.stringify(landedVariant ?? {});
    expect(claimed).toContain("mullet");
    expect(claimed).toContain("seafoam green");
    expect(claimed).toContain("pink");
  });

  /*
    AND A PRESENTATION PIN FROM BEFORE THE VOCABULARY IS RE-READ, NOT CARRIED
    (D-238).

    `hairWorn` scored 25% on run-12 and again on run-13 with hair that never
    moved a pixel. The pin said "worn natural, loose"; the reader looked at a
    tight crop and answered "not loose" three times, then "worn loose" once —
    same pixels, same pin, opposite verdicts. The word was doing double duty and
    nothing had ever constrained it.

    Chains carrying those strings are live, so the fix has to reach them: the
    unrecognised pin is deleted and the base is re-read, which is the ONE thing
    that knows the answer. This drives the whole road — retire, re-capture, and
    the free text nowhere in the paid prompt.
  */
  it("retires a pre-vocabulary presentation pin and re-reads the master", async () => {
    variantRows = [{
      id: 503,
      publicId: "variant-old",
      candidateId: 1,
      imageKey: "casting-v2/variants/old.png",
      internalPrompt: {
        ...(candidateRow.internalPrompt as Record<string, unknown>),
        /* Run-13's pin, verbatim from production. */
        captions: { hairWorn: "worn natural, loose" },
      },
      instructions: ["give her freckles"],
      deltas: { free: { marks: "freckles" } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-old";

    let presentationReads = 0;
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string }) => {
        if (request.system.includes("how they")) {
          presentationReads += 1;
          /* The base is a tight crop, and the honest answer is the value both
             broken pins were reaching for. */
          return { text: JSON.stringify({ hairWorn: "worn as cut" }), truncated: false, latencyMs: 1 };
        }
        return {
          text: JSON.stringify({ results: [{ id: 1, present: true, saw: "green irises" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;

    await refineCandidate({ ...greenEyes, verifier }, input);

    const prompt = (landedVariant?.internalPrompt as { prompt: string }).prompt;
    /* The picture was asked, not a thesaurus. */
    expect(presentationReads).toBeGreaterThan(0);
    expect(prompt).toContain(arrangementWording("worn as cut"));
    /* And the string that spent two walks' worth of score is gone from the
       prompt the user pays for. */
    expect(prompt).not.toContain("worn natural, loose");
    expect(prompt).not.toContain("loose");
  });

  /*
    FOUNDER FINDING #4 — HIS PAID EDIT, COUNTERMANDED BY OUR OWN PROMPT.

    2026-08-09, his account, candidate `84598983`. He paid for "she wear her
    hair down" (v#163, delivered, verified, hair genuinely down — I looked).
    His next edit, "dangly cross earrings" (v#164, 25 credits), came back with
    the hair BACK UP.

    Nothing drifted. The realization caption v#163 stored is prose, the
    retirement rule above owns only the ten closed arrangement wordings, so it
    took his delivered fact for a pre-vocabulary pin and deleted it — and the
    re-capture then read the MASTER, the one picture guaranteed not to contain
    the edit he had just bought. His prompt said, verbatim:

      "These are ALREADY TRUE of this person … HAIR WORN: gathered — the bulk
       of the hair drawn away from the face and gathered behind the head…"

    (Byte-identical to `HAIR_ARRANGEMENTS.gathered`, 132 characters, proven by
    comparison rather than by reading it.) The engine obeyed.

    Both halves are driven here: the chain's own delivery survives, and the
    master's value never reaches the paid prompt.
  */
  it("never restates the master's arrangement after the chain has delivered its own", async () => {
    const HIS_DELIVERY = "Straight dark hair worn down, center-parted, "
      + "falling loosely past shoulder length on both sides.";
    variantRows = [{
      id: 163,
      publicId: "variant-hair-down",
      candidateId: 1,
      imageKey: "casting-v2/variants/hair-down.png",
      internalPrompt: {
        ...(candidateRow.internalPrompt as Record<string, unknown>),
        captions: { hairWorn: HIS_DELIVERY },
      },
      instructions: ["she wear her hair down"],
      deltas: { free: { hairWorn: "down" } },
      stepDeltas: [{ free: { hairWorn: "down" } }],
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-hair-down";

    let presentationReads = 0;
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string }) => {
        if (request.system.includes("how they")) {
          presentationReads += 1;
          /* If anything DOES ask a frame about her arrangement, the master's
             answer is this — the value that overwrote him. */
          return { text: JSON.stringify({ hairWorn: "gathered" }), truncated: false, latencyMs: 1 };
        }
        return {
          text: JSON.stringify({ results: [{ id: 1, present: true, saw: "hair loose past the shoulders" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;

    await refineCandidate(
      { ...greenEyes, verifier },
      { ...input, instruction: "dangly cross earrings" },
    );

    const prompt = (landedVariant?.internalPrompt as { prompt: string }).prompt;
    /*
      The delivery outranks the dictionary: HIS sentence is what the painter is
      told, spliced without its full stop — which lane it rides in depends on
      whether this render is pasting a segment for the facet, and both lanes
      say the same true thing.
    */
    expect(prompt).toContain(HIS_DELIVERY.replace(/\.$/, ""));
    /* And the master's value is nowhere in the prompt he paid for. */
    expect(prompt).not.toContain(arrangementWording("gathered"));
    expect(prompt).not.toContain("gathered behind the head");
    /* Nothing was re-read at all — the caption stood, so no frame was asked. */
    expect(presentationReads).toBe(0);
    /* And what is carried forward is never the base's value either. */
    const stored = (landedVariant?.internalPrompt as { captions: Record<string, unknown> }).captions;
    expect(JSON.stringify(stored)).not.toContain("gathered behind the head");
  });

  /*
    AND WHEN A RE-CAPTURE IS LEGITIMATE, IT READS THE FRAME SHE IS ON.

    A pin the vocabulary cannot stand behind still goes, and the facet still has
    to be re-read from a picture. The master is the right picture exactly once —
    at the head of a chain. Mid-chain every edit she has bought is missing from
    it, so reading it there is the same countermand by a slower road.
  */
  it("re-reads the anchor she is standing on, never the master, mid-chain", async () => {
    variantRows = [{
      id: 504,
      publicId: "variant-anchor",
      candidateId: 1,
      imageKey: "casting-v2/variants/anchor.png",
      internalPrompt: {
        ...(candidateRow.internalPrompt as Record<string, unknown>),
        /* Free text on a facet this chain never wrote: a genuine retirement. */
        captions: { hairWorn: "pulled back low" },
      },
      instructions: ["give her freckles"],
      deltas: { free: { marks: "freckles" } },
      stepDeltas: [{ free: { marks: "freckles" } }],
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-anchor";

    const framesRead: string[] = [];
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string }) => {
        if (request.system.includes("how they")) {
          return { text: JSON.stringify({ hairWorn: "bun" }), truncated: false, latencyMs: 1 };
        }
        return {
          text: JSON.stringify({ results: [{ id: 1, present: true, saw: "green irises" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;

    await refineCandidate({
      ...greenEyes,
      verifier,
      readBytes: async (key: string) => {
        framesRead.push(key);
        return { bytes: TINY_MASTER_PNG, contentType: "image/png" };
      },
    } as never, input);

    /*
      The anchor's own frame is opened. Before this change it never was: the
      render paints from the master by design, so the ONLY thing that would ask
      for a variant's frame here is the presentation re-read.
    */
    expect(framesRead).toContain("casting-v2/variants/anchor.png");
  });

  /*
    THE PIN COARSENED; HER WORDS DID NOT.

    `up` and `tied back` were merged into one pinned value because the reader
    cannot hold that seam, and a pin finer than its reader fabricates verdicts at
    the boundary. The cost of that ruling is real — the pinned BASE STATE can no
    longer say which — and this is the assertion that it stops there. What she
    typed reaches the painter verbatim and is what the net checks her render
    against, at full resolution, with the coarse pin nowhere in the prompt
    because her instruction rewrote that very facet.
  */
  it("keeps HER words at full resolution when the pin has none left", async () => {
    variantRows = [{
      id: 504,
      publicId: "variant-old",
      candidateId: 1,
      imageKey: "casting-v2/variants/old.png",
      internalPrompt: {
        ...(candidateRow.internalPrompt as Record<string, unknown>),
        captions: { hairWorn: arrangementWording("gathered") },
      },
      instructions: ["give her freckles"],
      deltas: { free: { marks: "freckles" } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-old";

    const askedOfTheReader: string[] = [];
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string; user: string }) => {
        if (request.system.includes("how they")) {
          return { text: JSON.stringify({ hairWorn: "gathered" }), truncated: false, latencyMs: 1 };
        }
        askedOfTheReader.push(request.user);
        return {
          text: JSON.stringify({ results: [{ id: 1, present: true, saw: "hair fastened at the crown" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;

    await refineCandidate(
      {
        harvest: unmasked,
        verifier,
        interpret: async () => ({ ok: true as const, delta: { free: { hairWorn: "tied up in a high knot" } } }),
      },
      { ...input, instruction: "tie her hair up in a high knot" },
    );

    const prompt = (landedVariant?.internalPrompt as { prompt: string }).prompt;
    /* Her distinction, intact, in the picture she is paying for. */
    expect(prompt).toContain("tied up in a high knot");
    /* And the coarse pin is gone rather than arguing beside it — her instruction
       rewrote that facet, so the remembered fact dies with it (D-159). */
    expect(prompt).not.toContain(arrangementWording("gathered"));
    /* The net checks HER words, not the vocabulary's. */
    expect(askedOfTheReader.join("\n")).toContain("tied up in a high knot");
    expect(askedOfTheReader.join("\n")).not.toContain(arrangementWording("gathered"));
  });
});

/*
  THE VERIFICATION NET (D-185).

  A roll is judged before delivery; a refine shipped sight-unseen, and the
  founder's chain lost an eye colour that was present in every prompt. The net
  looks at the picture, retries once at the house's expense, and refuses with a
  full refund rather than charging for a render that is missing a filed fact.
*/
describe("the render is checked against the record before it is delivered", () => {
  /*
    Keyed on WHICH question is being asked, not on call order — the same reader
    also pins the base's presentation (D-186), and counting its call as a
    verdict made the retry test pass for the wrong reason.
  */
  const verifierSaying = (...verdicts: boolean[]) => {
    let call = 0;
    return {
      id: "verifier",
      complete: async (request: { system: string }) => {
        if (request.system.includes("how they")) {
          /* The presentation read. No pin, so the net's fact list is unchanged. */
          return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
        }
        const present = verdicts[Math.min(call, verdicts.length - 1)];
        call += 1;
        return {
          /* `saw` on BOTH answers (D-235). An affirmative that names nothing is
             not a reading, so a fake that omits it here is reproducing the
             empty yes rather than a pass. */
          text: JSON.stringify({ results: [{ id: 1, present, saw: present ? "green irises" : "brown" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;
  };

  it("delivers when the picture contains what was asked for", async () => {
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(true) }, input);
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.charges).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("re-renders once, free, when the first attempt is missing a fact", async () => {
    /* Two readings agreeing it is missing (D-194), then a clean second attempt. */
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false, true) }, input);
    /* Two renders, ONE charge — the retry is absorbed. */
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.charges).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("refuses and refunds the whole 25 when the retry fails too", async () => {
    /* Confirmed missing on both attempts: two readings each. */
    await expect(
      refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false, false, false) }, input),
    ).rejects.toThrow();
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });

  /*
    PRESENCE BINDS (fable-118 ruling (c), and the founder paid for the proof).

    v#164, his account: "dangly cross earrings", 25 credits, delivered — with
    his own reader saying on the row *"small stud earrings, no dangly cross
    earrings visible"*. Not a false pass: an honest reading, made advisory
    because `statedAccessories` lives in the free lane, and the free lane was
    scoped to protect SHADE disputes ("is this distinctly seafoam") from a
    reader nobody had defined the word for.

    An accessory is not a shade. Either the crosses are in the picture or they
    are not, which is the same test a removal has always been binding on.
  */
  it("refunds a missing accessory instead of charging for it", async () => {
    const earrings = {
      ...greenEyes,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { statedAccessories: "dangly cross earrings" } },
      }),
    };
    await expect(refineCandidate(
      { ...earrings, verifier: verifierSaying(false, false, false, false) },
      { ...input, instruction: "dangly cross earrings" },
    )).rejects.toThrow();
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });

  it("still only WATCHES a shade nobody has defined", async () => {
    /* The other half of the scoping, and the reason this ruling is narrow: six
       legitimate renders were refunded in eighteen when a reader was asked to
       arbitrate "seafoam green". A free-lane DEGREE miss still delivers. */
    const shade = {
      ...greenEyes,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { eyeColourFree: "seafoam green" } },
      }),
    };
    await refineCandidate(
      { ...shade, verifier: verifierSaying(false, false, false, false) },
      { ...input, instruction: "seafoam green eyes" },
    );
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds).toHaveLength(0);
  });

  /*
    FAIL OPEN ON AN OUTAGE. Invariant 7 governs security controls, where
    allowing is a breach. Here refusing on an unreachable reader destroys a
    render that is probably fine and hands back credits instead of the face —
    D-114 inverted the same way for the same reason.
  */
  it("delivers when the reader cannot be reached at all", async () => {
    const broken = {
      id: "broken",
      complete: async () => { throw new Error("reader down"); },
    } as never;
    await refineCandidate({ ...greenEyes, verifier: broken }, input);
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  /*
    THE FIRST LIVE TRIAL'S LESSON (D-187). Six of eight refusals were the reader
    adjudicating "seafoam green" — the user's own words for a shade nobody has
    defined — against renders whose eyes had plainly gone green.
  */
  it("never refuses over the user's own words, and still records the miss", async () => {
    /* A free-lane value: checked, recorded, not binding. */
    const freeLane = {
      interpret: async () => ({ ok: true as const, delta: { free: { eyeColourFree: "seafoam green" } } }),
      verifier: verifierSaying(false, false),
      harvest: unmasked,
    };
    await refineCandidate(freeLane, input);
    /* Delivered on the first attempt: an advisory miss buys nothing and costs
       nothing — no retry, no refund. */
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
    const landed = JSON.stringify(landedVariant ?? {});
    expect(landed).toContain("seafoam green");
    expect(landed).toContain('"binding":false');
  });

  it("still refuses over a value the vocabulary defines", async () => {
    /* "green" is a word this program owns, so the reader can be held to it. */
    await expect(
      refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false) }, input),
    ).rejects.toThrow();
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });

  it("records the verdict on the row, because it is the measuring instrument", async () => {
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false, true) }, input);
    const landed = JSON.stringify(landedVariant ?? {});
    expect(landed).toContain("verification");
    expect(landed).toContain('"attempts":2');
    /* How many readings the verdict took, recorded — the reader's own
       reliability, per render (D-194). */
    expect(landed).toContain('"readings"');
  });

  /*
    THE SECOND OPINION (D-194), and the trial is why.

    The same reader disagreed with itself on 21% of judgements about the same
    image. Chain 3 position 1: the service passed a render an independent
    re-read said was missing the fact. One reading cannot spend a refusal.
  */
  it("does not re-render when a second reading disagrees with the first", async () => {
    /* miss, then hit, then hit — the majority says it is there. */
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, true, true) }, input);
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("breaks a split with a third reading, and refuses only on a majority", async () => {
    /* Attempt 1: miss, hit, miss → majority missing → re-render.
       Attempt 2: miss, miss → confirmed → refuse and refund. */
    await expect(
      refineCandidate({ ...greenEyes, verifier: verifierSaying(false, true, false, false, false) },
        input,
      ),
    ).rejects.toThrow();
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });
});

/*
  THE CHAIN-2 MISREAD (D-189), reproduced at the service.

  The trial asked for "small gold hoop earrings" — an addition — and one
  sampling classified it as a removal, so D-167's confession told the user there
  was nothing to take off something they were trying to put on. The word list
  cannot prevent the mis-sampling; it stops it reaching the confession.
*/
describe("a removal with no removal word is re-read as an edit", () => {
  const misreads = (asEdit: unknown) => {
    let call = 0;
    return async () => {
      call += 1;
      /* First read: the flake. Second read (mode: edit): the truth. */
      return call === 1
        ? { ok: true as const, intent: "remove" as const, subject: "statedAccessories", match: "earrings" }
        : asEdit;
    };
  };

  it("does not confess about taking off something being put on", async () => {
    const result = await refineCandidate({ harvest: unmasked,
        interpret: misreads({
          ok: true as const,
          delta: { free: { statedAccessories: ["small gold hoop earrings"] } },
        }) as never,
      },
      { ...input, instruction: "small gold hoop earrings" },
    );
    /* It rendered the addition instead of confessing. */
    expect(result.variantId).toBeTruthy();
    expect(JSON.stringify(landedVariant ?? {})).toContain("small gold hoop earrings");
  });

  /*
    THE FOUNDER'S WALK, AS A TEST (D-206).

    Production, their own account, a face visibly wearing glasses that their
    BRIEF asked for: "remove her glasses" came back "I can't find any glasses on
    this face". The recipe was the only record consulted, and the recipe has
    never had an opinion about glasses, because nobody ever refined them.
  */
  describe("a base-worn thing is not invisible just because no refine added it", () => {
    it("removes glasses the brief asked for", async () => {
      briefWorn = ["wire-framed glasses"];
      let call = 0;
      const result = await refineCandidate({ harvest: unmasked,
          /* Rule 3: the record says it IS there, so the sentence is re-read as
             an ordinary content edit with the removal vocabulary withheld. */
          interpret: (async () => {
            call += 1;
            return call === 1
              ? {
                ok: true as const,
                intent: "remove" as const,
                subject: "statedAccessories",
                match: "glasses",
              }
              : { ok: true as const, delta: { free: { statedAccessories: ["no glasses"] } } };
          }) as never,
        },
        { ...input, instruction: "remove her glasses" },
      );
      /* It did the work rather than denying what she is wearing. */
      expect(result.variantId).toBeTruthy();
    });

    it("says what it actually checked when the brief is silent too", async () => {
      /* The confession still stands — the composer forbids inventing an
         accessory nobody named — but it no longer claims to have looked at her
         face when all it read was a record. */
      briefWorn = null;
      await expect(refineCandidate({ harvest: unmasked,
          interpret: async () => ({
            ok: true as const,
            intent: "remove" as const,
            subject: "statedAccessories",
            match: "glasses",
          }),
        } as never,
        { ...input, instruction: "remove her glasses" },
      )).rejects.toThrow(/brief didn't ask for glasses/);
    });

    /* The founder's own face: brief edited to ask for glasses, re-rolled, and
       the refusal told them the brief never asked. Whatever the record did, she
       was wearing them — so the picture decides. */
    const seeingReader = (found: boolean) => ({
      region: async () => {
        if (!found) throw new Error("the segmenter found no glasses to edit");
        const data = Buffer.alloc(32 * 48, 0);
        /* A real pair of frames: comfortably inside the eyewear class band. */
        for (let y = 18; y < 24; y += 1) for (let x = 6; x < 26; x += 1) data[y * 32 + x] = 255;
        return { data, width: 32, height: 48 };
      },
      subject: async () => ({ data: Buffer.alloc(32 * 48, 255), width: 32, height: 48 }),
      landmark: async () => [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }],
    });

    it("LOOKS when the record is silent, and lets the removal through if she is wearing them", async () => {
      briefWorn = null;
      let call = 0;
      const result = await refineCandidate({ harvest: unmasked,
          regions: seeingReader(true),
          /* Same two-call shape as a record-backed removal: once the face has
             confirmed the thing, the sentence is re-read as a content edit. */
          interpret: (async () => {
            call += 1;
            return call === 1
              ? {
                ok: true as const,
                intent: "remove" as const,
                subject: "statedAccessories",
                match: "glasses",
              }
              : { ok: true as const, delta: { free: { statedAccessories: ["no glasses"] } } };
          }) as never,
        },
        { ...input, instruction: "remove her glasses" },
      );
      /* No confession, no refusal — it did the work on the face she is looking at. */
      expect(result.variantId).toBeTruthy();
    });

    it("still refuses when her face genuinely has none — the control", async () => {
      /* Without this the branch above could pass by never refusing anything,
         which is the confession deleted rather than corrected. */
      briefWorn = null;
      await expect(refineCandidate({ harvest: unmasked,
          regions: seeingReader(false),
          interpret: async () => ({
            ok: true as const,
            intent: "remove" as const,
            subject: "statedAccessories",
            match: "glasses",
          }),
        } as never,
        { ...input, instruction: "remove her glasses" },
      )).rejects.toThrow(/nothing on record to take off/);
    });

    it("charges nothing either way", async () => {
      briefWorn = null;
      await expect(refineCandidate({ harvest: unmasked,
          interpret: async () => ({
            ok: true as const,
            intent: "remove" as const,
            subject: "statedAccessories",
            match: "glasses",
          }),
        } as never,
        { ...input, instruction: "remove her glasses" },
      )).rejects.toThrow();
      expect(ledger.charges).toHaveLength(0);
      expect(journal).not.toContain("claim");
    });
  });

  it("still lets a real removal through", async () => {
    /* "remove the earrings" carries a removal word, so the parse stands and the
       honest confession is reached when the face has none. Since D-206 that
       confession names what it consulted — the brief and the recipe — rather
       than claiming to have looked at her face. */
    await expect(refineCandidate({ harvest: unmasked,
        interpret: async () => ({
          ok: true as const,
          intent: "remove" as const,
          subject: "statedAccessories",
          match: "earrings",
        }),
      } as never,
      { ...input, instruction: "remove the earrings" },
    )).rejects.toThrow(/brief didn.t ask for earrings/);
  });
});

/*
  THE CEILING (D-207, founder ruling 2026-08-05: twelve became twenty-four).

  There was no driver at all before this, which is how a number nobody had
  re-examined stayed a wall for a paying user. Three things are pinned: where it
  now sits, that it still gates a chain that GROWS rather than the box, and that
  hitting it costs nothing.
*/
describe("how many refinements one face can carry", () => {
  /* A real chain: each step adds one accessory, so the history is readable and
     nothing is dropped — the cap is what must fire, not the containment guard. */
  const chainOf = (length: number) => Array.from({ length }, (_, index) => {
    const steps = Array.from({ length: index + 1 }, (_, step) => `add charm ${step + 1}`);
    const stepDeltas = steps.map((_, step) => ({
      free: { statedAccessories: `charm ${step + 1}` },
    }));
    return {
      id: 100 + index,
      publicId: `variant-${index + 1}`,
      status: "ready",
      imageKey: `casting-v2/variants/v${index + 1}.png`,
      instructions: steps,
      stepDeltas,
      deltas: { free: { statedAccessories: `charm ${index + 1}` } },
      internalPrompt: {},
    };
  });

  it("accepts a twenty-fourth refinement, which twelve used to refuse", async () => {
    variantRows = chainOf(23);
    candidateRow.selectedVariantPublicId = "variant-23";
    const result = await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" } }) } as never,
      { ...input, instruction: "make her eyes green" },
    );
    expect(result.variantId).toBeTruthy();
  });

  it("refuses the twenty-fifth, for free", async () => {
    variantRows = chainOf(24);
    candidateRow.selectedVariantPublicId = "variant-24";
    await expect(refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" } }) } as never,
      { ...input, instruction: "make her eyes green" },
    )).rejects.toThrow(/as many refinements as it can carry/);
    expect(ledger.charges).toHaveLength(0);
  });
});

describe("the order, and the money", () => {
  it("claims, runs, charges, generates, lands — in that order", async () => {
    await refineCandidate(greenEyes, input);
    expect(journal).toEqual([
      "read", "begin", "claim", "running", "deduct", "generate", "manifest", "land", "seal:success",
    ]);
    expect(ledger.charges).toEqual([
      { amount: 25, reference: "op:11111111-1111-4111-8111-111111111111:charge" },
    ]);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("never charges when the deduct is refused, and fails the variant row", async () => {
    chargeSucceeds = false;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow(/Not enough credits/);
    expect(ledger.charges).toHaveLength(0);
    expect(ledger.refunds).toHaveLength(0);
    /* The claimed row must not sit there queued forever. */
    expect(journal).toContain("fail");
  });

  it("gives back the WHOLE charge when the generation throws", async () => {
    engineThrows = new Error("the provider fell over");
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the generation failed" },
    ]);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  /*
    D-93's alarm, borrowed. A seamed frame is not something anyone should pay 25
    credits to receive, and the ledger line says what actually happened rather
    than blaming a provider that did its job.
  */
  it("refunds a damaged frame, and says so honestly on the receipt", async () => {
    renderFault = true;
    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the image came back damaged" },
    ]);
  });

  /*
    THE SAME HONESTY, ONE CLASS OVER (D-188).

    A verification refusal is not damage — the detector passed the picture
    twice. Wearing the damage class, it wrote "the image came back damaged" on
    eight real ledger rows and the first person to read them reported provider
    damage to the founder. The receipt is the record, and it must name what
    actually happened.
  */
  it("refunds a fact-short render under its own name, and says which fact", async () => {
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string }) => ({
        text: request.system.includes("how they")
          ? JSON.stringify({ hairWorn: "unclear" })
          : JSON.stringify({ results: [{ id: 1, present: false, saw: "brown" }] }),
        truncated: false,
        latencyMs: 1,
      }),
    } as never;

    await expect(refineCandidate({ ...greenEyes, verifier }, input)).rejects.toThrow(/without green/);
    /*
      "came back", not "was missing" — a removal's shortfall is not an absence.
      The render came back WITH the thing that was supposed to go, and "the
      render was missing with glasses still in the picture" is the grammar
      failure that reached a real receipt in run-6.
    */
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the render came back without green" },
    ]);
  });

  it("files the fact-short refusal under its own failure class, never as damage", async () => {
    const verifier = {
      id: "verifier",
      complete: async (request: { system: string }) => ({
        text: request.system.includes("how they")
          ? JSON.stringify({ hairWorn: "unclear" })
          : JSON.stringify({ results: [{ id: 1, present: false }] }),
        truncated: false,
        latencyMs: 1,
      }),
    } as never;
    await expect(refineCandidate({ ...greenEyes, verifier }, input)).rejects.toThrow();
    /* The variant row carries the same class the ledger line describes, or the
       two halves of the record disagree about one event. */
    expect(failedVariant?.failureClass).toBe("facts_missing");
  });
});

describe("the record and the picture come from the same place", () => {
  it("writes the composed edit into the variant's identity", async () => {
    await refineCandidate(greenEyes, input);
    const internal = landedVariant?.internalPrompt as { prompt: string; resolved: Record<string, unknown> };
    expect(internal.resolved).toMatchObject({ realized: { eyeColour: "green" } });
    /* The prompt is derived from the same delta — never the raw sentence. */
    expect(internal.prompt).toContain("green");
    expect(internal.prompt).not.toContain("make her eyes green");
  });

  /*
    BASE-ANCHORING. Every variant is one edit of the ORIGINAL, so drift cannot
    accumulate: the tenth refinement is as close to the face the user picked as
    the first. This asserts the reference is the candidate's own image even when
    a refinement is already selected.
  */
  it("edits the ORIGINAL even when a variant is selected", async () => {
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: { prompt: "p", resolved: { realized: { eyeColour: "green" } } },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";

    const { claimVariant } = await import("../db/castingV2Variants");
    await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeShape: "hooded" as const } }) },
      { ...input, instruction: "hood her eyes a little" },
    );
    const claimed = vi.mocked(claimVariant).mock.results[0].value as Promise<Record<string, unknown>>;
    expect((await claimed).baseImageKey).toBe("casting-v2/candidates/abc.png");
  });

  /*
    The stack extends the SELECTED variant, not the newest one — which is what
    makes "edit from here" branch instead of appending to whatever came last,
    and what stops every earlier instruction being repeated once per variant.
  */
  it("extends the selected variant's stack, without repeating its instructions", async () => {
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: { prompt: "p", resolved: { realized: { eyeColour: "green" } } },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";

    const { claimVariant } = await import("../db/castingV2Variants");
    await refineCandidate({ harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { eyeShape: "hooded" as const } }) },
      { ...input, instruction: "hood her eyes a little" },
    );
    const call = vi.mocked(claimVariant).mock.calls[0][0];
    expect(call.instructions).toEqual(["make her eyes green", "hood her eyes a little"]);
    /* Both edits survive, because composition is per-axis. */
    expect(call.deltas).toEqual({ eyeColour: "green", eyeShape: "hooded" });
  });
});

/**
 * The three money holes Fable found, each with the test that would catch it.
 *
 * All three were the same shape: a state where the ledger and the row disagree,
 * or where the receipt and the number beside it disagree. None of them threw.
 */
describe("the landing cannot half-commit, and the receipt cannot lie", () => {
  it("registers the object for cleanup BEFORE the bytes exist", async () => {
    await refineCandidate(greenEyes, input);
    /*
      Order, not presence. A manifest written after the put leaves the window
      it exists to close — the crash lands between them.
    */
    expect(journal.indexOf("manifest")).toBeLessThan(journal.indexOf("land"));
    expect(journal.indexOf("manifest")).toBeGreaterThan(journal.indexOf("generate"));
  });

  /*
    `landVariant` now THROWS rather than returning false, because
    `withTransaction` commits on any non-throw return: a boolean would have
    committed a `ready` variant that nothing points at, while the caller
    refunded it in full. Ready picture plus full refund, and the sweep would
    read the same row as a durable success and keep the charge.
  */
  it("refunds the whole charge when the landing refuses, with nothing half-written", async () => {
    const { landVariant } = await import("../db/castingV2Variants");
    vi.mocked(landVariant).mockRejectedValueOnce(new Error("not_selectable"));

    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    expect(ledger.refunds).toEqual([
      { amount: 25, description: "Refine refunded — the generation failed" },
    ]);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  /*
    The receipt is persisted and replayed to whoever asks about the operation
    later, so a message promising money back beside `refundedCredits: 0` is a
    receipt claiming money moved when it did not.
  */
  it("never promises a refund that did not record", async () => {
    const { recordRefund } = await import("../casting/atomicCredits");
    vi.mocked(recordRefund).mockResolvedValueOnce({ recorded: false } as never);
    engineThrows = new Error("the provider fell over");

    await expect(refineCandidate(greenEyes, input))
      .rejects.toThrow(/could not be recorded — quote operation/);
  });
});

/**
 * WALL (d), the structural half (D-131).
 *
 * "No render the paperwork did not learn" is dataflow, not discipline: the
 * prompt is composed from what the row actually holds, so a filing failure
 * degrades to filed-but-not-rendered — which the sweep can see — and never to
 * rendered-but-not-filed, which nothing can.
 */
describe("the prompt is composed from the persisted row", () => {
  it("renders what the ROW holds, not what the caller had in hand", async () => {
    const { claimVariant } = await import("../db/castingV2Variants");
    /* The row came back holding LESS than the service composed — a filing
       failure, simulated. The render must follow the row. */
    vi.mocked(claimVariant).mockImplementationOnce(async () => ({
      id: 501,
      publicId: "variant-1",
      candidateId: 1,
      sessionId: 1,
      parentVariantId: null,
      baseImageKey: candidateRow.imageKey as string,
      baseInternalPrompt: candidateRow.internalPrompt,
      deltas: { eyeColour: "blue" },
    }));

    await refineCandidate(greenEyes, input);
    const internal = landedVariant?.internalPrompt as { prompt: string };
    expect(internal.prompt).toContain("blue");
    expect(internal.prompt).not.toContain("green");
  });

  it("refuses rather than falling back when the row is unreadable", async () => {
    const { claimVariant } = await import("../db/castingV2Variants");
    vi.mocked(claimVariant).mockImplementationOnce(async () => ({
      id: 502,
      publicId: "variant-2",
      candidateId: 1,
      sessionId: 1,
      parentVariantId: null,
      baseImageKey: candidateRow.imageKey as string,
      baseInternalPrompt: candidateRow.internalPrompt,
      deltas: { eyeColour: "violet" },
    }));

    await expect(refineCandidate(greenEyes, input)).rejects.toThrow();
    /* And the whole charge came back, because a refusal past the deduct is
       still a failure the user must not pay for. */
    expect(ledger.refunds.at(-1)?.amount).toBe(25);
  });
});

/**
 * TYPED REMOVAL, AND ITS MONEY (D-163).
 *
 * The whole point of the ruling is that two of the three intents cost nothing.
 * So these assert on the LEDGER and on the journal: a free outcome must not
 * charge, must not claim, and must not even open an operation — an operation
 * carrying zero credits and no image is a phantom for the recovery sweep to
 * adjudicate forever.
 */
describe("removal is typed, and most of it is free", () => {
  const twoStep = () => {
    variantRows = [
      {
        id: 501,
        publicId: "variant-1",
        imageKey: "casting-v2/variants/one.png",
        instructions: ["a smokey eye"],
        stepDeltas: [{ makeup: "a smokey eye" }],
        deltas: { makeup: "a smokey eye" },
        internalPrompt: {},
      },
      {
        id: 502,
        publicId: "variant-2",
        imageKey: "casting-v2/variants/two.png",
        instructions: ["a smokey eye", "small gold hoops"],
        stepDeltas: [{ makeup: "a smokey eye" }, { free: { statedAccessories: "small gold hoops" } }],
        deltas: { makeup: "a smokey eye", free: { statedAccessories: "small gold hoops" } },
        internalPrompt: {},
      },
    ];
    candidateRow.selectedVariantPublicId = "variant-2";
  };

  /** One small valid PNG, built once, for any removal test that renders. */
  let pngCache: Buffer | null = null;
  const realPng = async (): Promise<Buffer> => {
    if (!pngCache) {
      const sharp = (await import("sharp")).default;
      pngCache = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#808080" } })
        .png().toBuffer();
    }
    return pngCache;
  };

  const asks = (parse: Record<string, unknown>) => ({
    interpret: async () => parse as never,
    harvest: unmasked,
  });

  /*
    THE TABLE IS THE TEST (Fable ruling, 2026-08-08). Two rows, and the whole
    argument is that they are indistinguishable by language:

      asked      echoed item          correct
      earrings   small gold hoops     prune the step   (D-173's founding case)
      glasses    gold hoop earrings   leave it alone   (the founder's walk)

    In both, the named thing is nowhere in the item's text. Only the face knows
    which is a true reference — and specifically the ORIGINAL face, because a
    prune can only remove what the chain added. Either of these going red means
    the implementation is wrong, not the test.
  */
  const seesInBase = (present: boolean) => ({
    regions: {
      region: async () => {
        if (!present) throw new Error("the segmenter finds none");
        /* Above eyewearFrames.min (0.004) — a real thing, not a speck. */
        const side = 64;
        return { data: Buffer.alloc(side * side, 255), width: side, height: side };
      },
      subject: async () => { throw new Error("no subject"); },
      landmark: async () => [],
    } as never,
    /* A REAL PNG, because the absence row is the first removal test that
       reaches a render — `Buffer.from("original")` made sharp throw
       "unsupported image format" and the refusal looked like a product
       failure. The prune tests never got this far, which is why it held. */
    readBytes: async () => ({ bytes: await realPng(), contentType: "image/png" }),
  });

  /*
    THE ABSENCE ROW — the gap declared here on 2026-08-08 is now CLOSED, and how
    it closed is worth more than the test.

    The note said the row could not be reached "inside a reasonable budget"
    because the path needs the interpreter mocked across two calls plus a chain
    fixture the helpers do not build. The interpreter half was true and cheap
    (`asksThenEdits`). The rest was not a fixture problem at all: `readBytes`
    handed sharp `Buffer.from("original")`, sharp answered "unsupported image
    format", and the render died looking exactly like a product refusal. Three
    attempts read that as the path being unreachable.

    The fixture was lying and the diagnosis believed it — the same shape as
    every measurement error this campaign has produced. It cost a shipped-
    unproven guard for a day.

    And the test that belongs here does not need the render to SUCCEED: what has
    to be true is that the reader is asked about the departed object, in a
    binding row, when the record can no longer name it. That is a claim about
    the outgoing request (working law 5).
  */


  /**
   * THE ABSENCE ROW, PROVEN AT THE WIRE (the gap declared above, closed).
   *
   * The test that "could not reach the render" was trying to reach the wrong
   * thing. What has to be true is not that a removal renders — it is that the
   * reader is ASKED about the departed object, in a binding row, when the record
   * can no longer name it. That is a claim about the outgoing request, and
   * working law 5 says to assert it there rather than on a constant near it.
   *
   * So this drives the base-worn removal path — which needs the interpreter
   * answering twice, a removal first and the edit its rule-3 re-read produces
   * second — and captures what the verifier is actually handed.
   */
  const asksThenEdits = (first: Record<string, unknown>, second: Record<string, unknown>) => {
    let call = 0;
    return {
      interpret: async () => (call++ === 0 ? first : second) as never,
      harvest: unmasked,
    };
  };

  /** Captures the fact list the reader is given, and answers everything true. */
  const capturingVerifier = () => {
    const asked: string[] = [];
    return {
      asked,
      verifier: {
        id: "verifier",
        complete: async (request: { system: string; user: string }) => {
          if (request.system.includes("how they")) {
            return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
          }
          asked.push(request.user);
          const lines = request.user.split("\n").filter((line) => line.trim());
          return {
            text: JSON.stringify({
              results: lines.map((_, index) => ({ id: index + 1, present: true, saw: "seen" })),
            }),
            truncated: false,
            latencyMs: 1,
          };
        },
      } as never,
    };
  };

  it("ASKS THE READER ABOUT THE THING THAT LEFT — binding, and in her own terms", async () => {
    twoStep();
    const { asked, verifier } = capturingVerifier();
    await refineCandidate(
      {
        ...asksThenEdits(
          /* She is wearing them from the brief, so the chain cannot prune them:
             this routes to a render (`8adc3634`). */
          { ok: true, intent: "remove", subject: "statedAccessories", match: "glasses", items: ["small gold hoops"] },
          /* Rule 3's re-read, as an ordinary edit. */
          { ok: true, delta: { free: { statedAccessories: ["small gold hoops"] } } },
        ),
        ...seesInBase(true),
        verifier,
      },
      { ...input, instruction: "remove her glasses" },
    ).catch(() => undefined);

    /*
      In this fixture the absence row is the ONLY fact — there is no identity to
      resolve the surviving accessory against — so "the reader was reached" IS
      the row's presence, which is why removing the row turns this red rather
      than the regex below. Said out loud so the signal is not mistaken for a
      broader one than it is.
    */
    expect(asked.length, "the reader was reached at all").toBeGreaterThan(0);
    /*
      `facts` is built from `facetsWrittenBy(composed)` and a removal deletes
      its own facet, so without this row the render is verified against
      everything EXCEPT the thing that was asked for — and lands
      `delivered_unverified` forever while her glasses sit there.
    */
    expect(
      asked.some((prompt) => /no glasses — they have been taken off and are not in the picture/.test(prompt)),
      "the departed thing is asked about, phrased as the absence it is",
    ).toBe(true);
  });

  it("tells the reader HOW to judge an absence, or the row is unreadable", async () => {
    /* The prompt had no notion of an ask phrased as a removal, so the
       instruction that makes the row judgeable ships with it. Asserted at the
       wire for the same reason the row is. */
    const { asked, verifier } = capturingVerifier();
    let system = "";
    const watching = {
      id: "verifier",
      complete: async (request: { system: string; user: string }) => {
        if (request.system.includes("how they")) {
          return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
        }
        system = request.system;
        return (verifier as never as { complete: (r: unknown) => unknown }).complete(request) as never;
      },
    } as never;
    twoStep();
    await refineCandidate(
      {
        ...asksThenEdits(
          { ok: true, intent: "remove", subject: "statedAccessories", match: "glasses", items: ["small gold hoops"] },
          { ok: true, delta: { free: { statedAccessories: ["small gold hoops"] } } },
        ),
        ...seesInBase(true),
        verifier: watching,
      },
      { ...input, instruction: "remove her glasses" },
    ).catch(() => undefined);

    expect(asked.length, "the reader was reached").toBeGreaterThan(0);
    expect(system, "an absence is VISIBLY TRUE when the thing is not there")
      .toMatch(/taken off/);
  });

  it("PRUNES when the chain put it there — D-173's founding case", async () => {
    twoStep();
    const result = await refineCandidate(
      {
        ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "earrings", items: ["small gold hoops"] }),
        /* Her ORIGINAL wore no earrings: the hoops arrived in step two, so
           undoing that step really does take them off her face. */
        ...seesInBase(false),
      },
      { ...input, instruction: "remove the earrings" },
    );
    expect(result.kind, "a chain-added accessory comes off for free").toBe("selected");
    expect(ledger.charges).toEqual([]);
  });

  it("REFUSES TO PRUNE when the thing predates the chain — the founder's walk", async () => {
    twoStep();
    /*
      She asks for her GLASSES. The parser has only ever been shown her hoops,
      so it echoes those, and `matchSteps` would delete the earrings step she
      paid for — landing her on an older variant and answering "you already have
      that version" while she looks straight at her glasses.

      Her original wears the glasses, so no prune can remove them. The step
      survives and the ask goes to the face — as a DEPARTURE recorded in the
      recipe (D-238), which is the road this walk used to fall off.

      This test now carries run-7's harm directly rather than by proxy. It used
      to assert that nothing was charged, and that was an artefact of the mock:
      the ask was re-read as an edit, the stub handed back the same removal
      parse, and the service refused for want of a delta. The comment above
      always said the ask goes to the face, which costs 25. So the assertions
      are what the walk is actually about — her paid hoops SURVIVE the question
      about her glasses, and the glasses are asked to leave.
    */
    const result = await refineCandidate(
      {
        ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "glasses", items: ["small gold hoops"] }),
        ...seesInBase(true),
      },
      { ...input, instruction: "remove her glasses" },
    );

    expect(journal, "it must not have quietly walked her selection backwards")
      .not.toContain("select");
    expect(result.kind, "the answer is a render, not an undo").toBe("rendered");
    const call = vi.mocked(claimVariant).mock.calls[0]![0];
    /*
      RUN-7'S HARM, ASSERTED ON THE MONEY PATH. A question about her glasses
      must not take the earrings she paid for out of the recipe — and because
      renders are base-anchored, a recipe that stops naming them is a face that
      stops wearing them.
    */
    expect((call.deltas as { free?: Record<string, unknown> }).free?.statedAccessories)
      .toEqual(["small gold hoops"]);
    /* And the thing she actually asked about is recorded as gone, durably, so
       her NEXT ask does not re-render the glasses back on. */
    expect((call.deltas as { absent?: Record<string, unknown> }).absent)
      .toEqual({ statedAccessories: ["glasses"] });
    expect(call.instructions)
      .toEqual(["a smokey eye", "small gold hoops", "remove her glasses"]);
    expect(ledger.charges[0]?.amount, "a render is a render").toBe(25);
  });

  /*
    THE HOLE INSIDE THE GUARD — run-7's mechanism, reproduced without a render.

    The provenance check is written `if (matched.length > 0 && parsed.match …)`,
    and `matchSteps` matches on the SUBJECT ALONE when there are no narrowing
    words: "no words" returns every step on the facet, whole-step deletion. So
    the one parse shape that deletes the MOST is the one shape the guard never
    sees, and — because every log line on that path is inside the guard — it
    leaves no record at all. That is why run-7 was undiagnosable.

    The parse shape is not exotic; the interpreter's own prompt asks for it. It
    tells the model to send `{"remove": {"subject": …, "items": [...]}}` with no
    `match` at all when it is echoing filed items, and the authority filter then
    DROPS any echo that is not verbatim a stored item. A model that echoes
    "tortoiseshell glasses" against a chain that only ever stored "small gold
    hoops" therefore arrives here as `match: null, items: []` — a targeted
    removal silently promoted to a subject-wide one.

    Her original wears the glasses, so no prune can take them off; the answer is
    a render, and her paid earrings step must survive.
  */
  it("REFUSES TO PRUNE when the parse named no words — run-7's mechanism", async () => {
    twoStep();
    await expect(refineCandidate(
      {
        ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: null, items: [] }),
        ...seesInBase(true),
      },
      { ...input, instruction: "remove her glasses" },
      /* Free, and it asks for the one thing that would let it act. */
    )).rejects.toThrow(/didn't catch what should come off/);

    /*
      Run-7's exact harm, and the only assertion that matters: she asked about
      her glasses and must not be walked off the earrings step she paid for.
      Before the fix this reached `selectAndReport` with
      `dropped: ["small gold hoops"]` — the log line belt part 1 added, firing
      on the defect it was built to expose.
    */
    expect(journal, "it must not have quietly walked her selection backwards")
      .not.toContain("select");
    expect(ledger.charges, "and nothing is charged for the attempt").toEqual([]);
  });

  /*
    THE THIRD ROAD TO AN UNARBITRATED PRUNE — found by sabotage, not by reading.

    The matcher's width fix covers the WORD path. The ITEMS path does not go
    through it at all: a verbatim echo matches by identity, so a parse carrying
    `items: ["small gold hoops"]` and NO match prunes her earrings step while
    the provenance check — which needs a noun to ask the picture about — is
    skipped for want of one. That is the same harm by a different road, and the
    interpreter's own echo example produced exactly this shape until today.

    The service-side belt is what stops it, and until this row existed the belt
    was decorative: sabotaging it left the suite green.
  */
  it("REFUSES TO PRUNE when an echo matched but nothing was named", async () => {
    twoStep();
    await expect(refineCandidate(
      {
        ...asks({
          ok: true,
          intent: "remove",
          subject: "statedAccessories",
          match: null,
          items: ["small gold hoops"],
        }),
        ...seesInBase(true),
      },
      { ...input, instruction: "remove her glasses" },
    )).rejects.toThrow(/didn't catch what should come off/);

    expect(journal, "an echo is not a licence to prune unarbitrated")
      .not.toContain("select");
    expect(ledger.charges).toEqual([]);
  });

  /*
    A WIDTH CLAIM IS NOT A NOUN, and this row is where the implementation goes
    one step past the ruling's letter, deliberately. `whole: true` with no words
    still leaves the picture nothing to arbitrate — and it asks for the WIDEST
    prune there is, every step on the facet. Refusing for want of the noun is
    the requirement; the width only ever said how far.
  */
  it("REFUSES TO PRUNE on a width claim with no noun", async () => {
    twoStep();
    await expect(refineCandidate(
      {
        ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: null, whole: true }),
        ...seesInBase(true),
      },
      { ...input, instruction: "take all that off her" },
    )).rejects.toThrow(/didn't catch what should come off/);
    expect(journal).not.toContain("select");
    expect(ledger.charges).toEqual([]);
  });

  it("REFUSES rather than guessing when her face cannot be checked", async () => {
    /* Fail closed. Handing the decision back to the word match when a
       dependency is missing is invariant 7's violation wearing a new hat — it
       is the exact path that corrupted a paid chain. */
    twoStep();
    await expect(refineCandidate(
      {
        ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "glasses", items: ["small gold hoops"] }),
        regions: {
          region: async () => { throw new Error("segmenter unreachable"); },
          subject: async () => { throw new Error("no subject"); },
          landmark: async () => [],
        } as never,
        readBytes: async () => { throw new Error("storage unreachable"); },
      },
      { ...input, instruction: "remove her glasses" },
    )).rejects.toThrow(/couldn't check her face/);
    expect(ledger.charges).toEqual([]);
  });

  it("walks back a step for free on a bare undo", async () => {
    twoStep();
    const result = await refineCandidate(
      asks({ ok: true, intent: "navigate" }),
      { ...input, instruction: "undo" },
    );
    expect(result.kind).toBe("selected");
    expect(result.variantId).toBe("variant-1");
    expect(ledger.charges).toEqual([]);
    /* No claim and no operation — nothing for the sweep to adjudicate. */
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("deduct");
  });

  /*
    RULE 4. Taking the last step off lands on a chain that already exists as a
    picture, so it is backing up wearing different words — and charging 25 for
    the phrasing is the defect the rule exists to prevent.
  */
  it("selects an existing version for free when removal lands on one", async () => {
    twoStep();
    const result = await refineCandidate(
      asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "hoops" }),
      { ...input, instruction: "take the hoops off" },
    );
    expect(result.kind).toBe("selected");
    expect(result.variantId).toBe("variant-1");
    /*
      IT NAMES WHAT IT TOOK OFF (Fable, 2026-08-08). "You already have that
      version" is true and uninformative, and on run-7 it was the whole
      disguise: she asked about her GLASSES and was silently moved off the
      earrings she had paid for. A sentence that names the step turns a wrong
      prune into something she can contest while reading it.
    */
    expect(result.note).toMatch(/takes off/i);
    expect(result.note, "the step it dropped, in her own words").toContain("small gold hoops");
    expect(result.note).toMatch(/nothing was charged/i);
    expect(ledger.charges).toEqual([]);
    expect(journal).not.toContain("claim");
  });

  it("says nothing was taken off when the match lands on the same steps", async () => {
    /* The genuinely-identical case keeps the old sentence: there is no step to
       name, and inventing one would be worse than the vague line. */
    twoStep();
    const result = await refineCandidate(
      asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "hoops" }),
      { ...input, instruction: "take the hoops off" },
    );
    expect(result.kind).toBe("selected");
    expect(result.note).toMatch(/takes off|already have that version/i);
  });

  /*
    THE WHOLE-SUBJECT UNDO SURVIVES, and it now arrives carrying her own noun.

    This row used to be pinned as `match: null` — because the interpreter's
    prompt asked for exactly that on a whole-subject removal. That contract is
    what made a WIDENED removal indistinguishable from a genuine one: run-7's
    "remove her glasses" reached the same code as "remove the makeup", and the
    provenance check, which needs something to ask the picture about, was
    skipped for both. The prompt now requires their words in every case, so the
    whole-subject undo is a named prune like any other and is arbitrated like
    any other. Her original wore no makeup, so the chain really did put it
    there and the undo is honest.
  */
  it("returns to the ORIGINAL for free when every step is removed", async () => {
    twoStep();
    const result = await refineCandidate(
      {
        ...asks({ ok: true, intent: "remove", subject: "makeup", match: "makeup", whole: true }),
        ...seesInBase(false),
      },
      { ...input, instruction: "remove the makeup" },
    );
    /* Both the smokey eye and the hoops? No — only makeup matches, so the
       remaining chain is the hoops alone, which is not an existing variant. */
    expect(result.kind).toBe("rendered");
    expect(ledger.charges[0]?.amount).toBe(25);
  });

  /*
    A MID-CHAIN REMOVAL IS A NEW COMBINATION, so it renders and charges — and
    the row it claims carries the SHORTENED recipe, which is the receipt the
    chips read back.
  */
  it("renders chain-minus-step, and files the shortened recipe", async () => {
    twoStep();
    await refineCandidate(
      asks({ ok: true, intent: "remove", subject: "makeup", match: "smokey" }),
      { ...input, instruction: "get rid of the smokey eye" },
    );
    const call = vi.mocked(claimVariant).mock.calls[0]![0];
    expect(call.instructions).toEqual(["small gold hoops"]);
    /* Plural subjects hold ITEMS now (D-171) — the parse normalizes to a list
       so removal can prune one without deleting the step. */
    expect(call.stepDeltas).toEqual([{ free: { statedAccessories: ["small gold hoops"] } }]);
    expect(call.deltas).toEqual({ free: { statedAccessories: ["small gold hoops"] } });
    /* What they TYPED is kept apart from the recipe, or the in-flight chip
       would name the last surviving sentence instead (D-161). */
    expect(call.requestText).toBe("get rid of the smokey eye");
    expect(ledger.charges[0]?.amount).toBe(25);
  });

  /*
    RULE 3 — THE FACE SECOND, and for a thing that can LEAVE her the answer is a
    DEPARTURE rather than a re-read (D-238).

    Nothing in the recipe matches and the record says she has them, so this is
    base-worn: there is no step to prune, and the removal has to become a fact
    the recipe carries. It used to be handed back to the interpreter as an
    ordinary edit, which asked a model to express a negative as a positive and
    recorded nothing about the departure at all — so the render never asked for
    it and her next ask started again from the original.
  */
  it("records a departure when the FACE has it but the recipe does not", async () => {
    twoStep();
    /*
      D-167: rule 3 only fires when the thing actually exists. Freckles from
      the dice live at `realized.skinCharacter`, so the selected face has to
      carry them or the honest answer is the confession below, not an edit.
    */
    variantRows[1]!.internalPrompt = {
      resolved: {
        /* readResolvedIdentity requires these four, or it discards the whole
           identity — so a partial fixture would silently mean "no record". */
        sex: "female",
        ageBand: "30s",
        energy: "warm",
        heritage: [{ heritage: "Nordic", pct: 100 }],
        realized: { skinCharacter: "freckled" },
      },
    };
    const modes: Array<string | undefined> = [];
    const result = await refineCandidate({ harvest: unmasked,
        interpret: async (request: { mode?: string }) => {
          modes.push(request.mode);
          return modes.length === 1
            ? { ok: true, intent: "remove", subject: "marks", match: "freckles" } as never
            : { ok: true, delta: { free: { marks: "no freckles" } } } as never;
        },
      },
      { ...input, instruction: "remove her freckles" },
    );
    /* ONE reading, not two. The code owns what a removal means, so there is
       nothing left for a second sampling to get wrong. */
    expect(modes).toEqual([undefined]);
    expect(result.kind).toBe("rendered");
    const call = vi.mocked(claimVariant).mock.calls[0]![0];
    /* Appended like any other edit — the chain GREW. */
    expect(call.instructions).toEqual(["a smokey eye", "small gold hoops", "remove her freckles"]);
    /* And the departure is in the recipe, so every later render still asks. */
    expect((call.deltas as { absent?: Record<string, unknown> }).absent)
      .toEqual({ marks: ["freckles"] });
    expect((call.stepDeltas as unknown[]).at(-1)).toEqual({ absent: { marks: ["freckles"] } });
  });

  /*
    THE HONEST THIRD STEP (D-167). Absent from the recipe AND from the record,
    so there is nothing to remove — and saying so is free. Before this, the ask
    fell through to the face and bought a full-face smoothing: the beautify
    prior arriving as an identity-adjacent over-edit nobody asked for.
  */
  it("confesses for free when the thing exists nowhere", async () => {
    twoStep();
    await expect(refineCandidate(
      asks({ ok: true, intent: "remove", subject: "marks", match: "freckles" }),
      { ...input, instruction: "remove her freckles" },
    )).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ledger.charges).toEqual([]);
    expect(journal).not.toContain("claim");
  });

  it("refuses on a variant that predates the step chain, rather than guessing", async () => {
    variantRows = [{
      id: 501,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/one.png",
      instructions: ["a smokey eye"],
      /* No stepDeltas — a row from before the column existed. */
      deltas: { makeup: "a smokey eye" },
      internalPrompt: {},
    }];
    candidateRow.selectedVariantPublicId = "variant-1";
    await expect(refineCandidate(
      asks({ ok: true, intent: "remove", subject: "makeup", match: null }),
      { ...input, instruction: "remove the makeup" },
    )).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(ledger.charges).toEqual([]);
  });
});

/**
 * SEGMENT PERMANENCE, AT THE SEAM THE BENCHES COULD NOT SEE.
 *
 * The first production walk of the armed store lost her freckles twice on
 * renders she paid for, while both calibration benches said the architecture
 * held. Both benches were right about the module and blind to the product: they
 * supplied `writing: [step.facet]` by hand, and the service derived it from the
 * ACCUMULATED recipe — so every facet that could be carried disqualified itself
 * as "one this edit writes", and the prompt asked for it again anyway.
 *
 * These tests hand the service nothing. They read what it decided, off the
 * arguments it passed and the string it sent.
 */
describe("what this ask writes, and what it stops asking for", () => {
  /** Her recipe already holds delivered freckles; this sentence is about lips. */
  const withFreckledPredecessor = () => {
    variantRows = [{
      id: 501,
      publicId: "variant-1",
      candidateId: 1,
      imageKey: "casting-v2/variants/one.png",
      instructions: ["give her freckles"],
      stepDeltas: [{ free: { marks: "freckles" } }],
      deltas: { free: { marks: "freckles" } },
      internalPrompt: {},
    }];
    candidateRow.selectedVariantPublicId = "variant-1";
    carriedRowsFixture = [{
      id: 9001,
      facet: "marks",
      provenance: "edit_patch",
      version: 1,
      maskKey: "casting-v2/segments/mask.png",
      contentKey: "casting-v2/segments/content.png",
    }];
  };

  const glossOnFreckles = {
    harvest: unmasked,
    interpret: async () => ({ ok: true as const, delta: { makeup: "nude lip gloss" } }),
  };

  it("asks the store for THIS ask's facets, not the whole recipe", async () => {
    withFreckledPredecessor();
    await refineCandidate(glossOnFreckles, { ...input, instruction: "add nude lip gloss" });

    expect(carriedAsks.length, "the store was consulted before the paint").toBeGreaterThan(0);
    const writing = carriedAsks[0].writing;
    expect(writing, "the facet this sentence writes").toContain("makeup");
    /*
      THE DEFECT ITSELF. `marks` here is what made the whole architecture inert:
      a segment only ever exists for a facet the recipe names, so listing the
      recipe excluded every carriable facet by construction.
    */
    expect(writing, "and NOT the facet she is already keeping").not.toContain("marks");
    expect(carriedAsks[0].anchorVariantId, "anchored on the face she is looking at").toBe(501);
  });

  it("stops asking the painter for a facet it is going to paste", async () => {
    withFreckledPredecessor();
    await refineCandidate(glossOnFreckles, { ...input, instruction: "add nude lip gloss" });

    expect(sentPrompts.length, "a prompt reached the painter").toBeGreaterThan(0);
    for (const prompt of sentPrompts) {
      /*
        Asserted on the string that LEFT, not on the recipe object. Carrying the
        pixels while still asking for them is worse than not carrying at all:
        the paste lands, the fresh paint is applied last by design, and the
        re-roll wins the pixels straight back — which is exactly what her walk
        recorded.
      */
      expect(prompt, "her kept freckles are not re-asked for").not.toMatch(/freckle/i);
      expect(prompt, "and the thing she actually asked for is").toMatch(/gloss/i);
    }
  });

  it("hands the composite the SAME rows the prompt was stripped against", async () => {
    withFreckledPredecessor();
    await refineCandidate(glossOnFreckles, { ...input, instruction: "add nude lip gloss" });

    expect(assembleAsks.length).toBeGreaterThan(0);
    /* One list, decided once. Two reads of the store could disagree, and then
       the prompt and the paste would hold different opinions about her face. */
    expect(assembleAsks[0].rows, "the rows travelled with the render").toHaveLength(1);
    expect(assembleAsks[0].writing).not.toContain("marks");
  });

  it("still asks for everything when nothing is carried", async () => {
    /* The dark-store case, and the first edit of any face: no anchor, no rows,
       and the prompt must be exactly what it always was. */
    carriedRowsFixture = [];
    await refineCandidate(
      { harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { free: { marks: "freckles" } } }) },
      { ...input, instruction: "give her freckles" },
    );
    expect(sentPrompts.length).toBeGreaterThan(0);
    expect(sentPrompts[0], "the ask is untouched when there is nothing to paste").toMatch(/freckle/i);
  });
});

/**
 * WHAT PERMANENCE IS ALLOWED TO KEEP (fable-102 §4).
 *
 * The first production walk filed `marks@v2` and `marks@v3` from the two frames
 * where her freckles had been LOST — each stamped `verified` by a constant,
 * while the render's own reading of that exact facet said `verified:false`. The
 * lineage walk takes the newest version, so the store had quietly made the loss
 * the truth, and a promotion at Sign would have written it onto her Cast.
 *
 * D-235 at permanence's front door: an affirmative without a `saw` is not a
 * reading, and a reading that says NO keeps nothing.
 */
describe("a render keeps only the facets its own reading earned", () => {
  const freckles = {
    harvest: unmasked,
    interpret: async () => ({ ok: true as const, delta: { free: { marks: "freckles" } } }),
  };
  const readerSays = (present: boolean, saw: string) => ({
    id: "verifier",
    complete: async () => ({
      text: JSON.stringify({ results: [{ id: 1, present, saw }] }),
      truncated: false,
      latencyMs: 1,
    }),
  } as never);

  it("keeps the pixels when the reading found them", async () => {
    await refineCandidate(
      { ...freckles, verifier: readerSays(true, "light scattered freckles across nose and cheeks") },
      { ...input, instruction: "give her freckles" },
    );
    expect(keptAsks, "the render offered its pixels to the store").toHaveLength(1);
    expect(keptAsks[0].facets).toContain("marks");
    expect(keptAsks[0].verdict, "and the verdict is the reading that earned them").toBe("verified");
  });

  it("keeps NOTHING when the reading says the facet is not there", async () => {
    await refineCandidate(
      { ...freckles, verifier: readerSays(false, "no freckling visible") },
      { ...input, instruction: "give her freckles" },
    );
    expect(keptAsks, "the store was still called — silently, as it must be").toHaveLength(1);
    /*
      The exact row the walk filed. Keeping this would make the LOSS the newest
      version of the facet, and every later render would paste it back.
    */
    expect(keptAsks[0].facets, "a facet that did not arrive keeps no pixels").not.toContain("marks");
    expect(keptAsks[0].facets).toHaveLength(0);
    expect(keptAsks[0].verdict, "and no verdict is invented for it").toBeNull();
  });
});

/**
 * THE GUARD'S PREDICATE, SHARPENED TO THE CLAUSE (fable-105).
 *
 * The first form asked whether the carried facet's VALUE appeared anywhere in
 * the produced prompt, and a legitimate sentence tripped it: her kept `marks`
 * reads "freckles", and "a bronzer that mimics freckles" is an ask about her
 * cheeks that happens to say the word. A free refusal is still a wall in front
 * of a real request.
 *
 * A genuine leak has a shape — the facet's own HEADING opening a lane,
 * `MARKS: freckles…` — and the bronzer sentence composes no MARKS clause,
 * because bronzer files as makeup. So the predicate matches the lane, not the
 * word, and this specimen is pinned as the boundary.
 */
describe("the carried-clause guard matches the lane, not the word", () => {
  it("lets through a sentence that merely SAYS a carried facet's value", async () => {
    variantRows = [{
      id: 501,
      publicId: "variant-1",
      candidateId: 1,
      imageKey: "casting-v2/variants/one.png",
      instructions: ["give her freckles"],
      stepDeltas: [{ free: { marks: "freckles" } }],
      deltas: { free: { marks: "freckles" } },
      internalPrompt: {},
    }];
    candidateRow.selectedVariantPublicId = "variant-1";
    carriedRowsFixture = [{ id: 9001, facet: "marks", provenance: "edit_patch", version: 1 }];

    const result = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { makeup: "a bronzer that mimics freckles" } }),
      },
      { ...input, instruction: "a bronzer that mimics freckles" },
    );

    expect(result.kind, "her bronzer is rendered, not walled").toBe("rendered");
    expect(ledger.charges.length, "and paid for like any other edit").toBeGreaterThan(0);
    /* The kept facet is still carried, and still not asked for. */
    expect(carriedAsks[0].writing).not.toContain("marks");
    for (const prompt of sentPrompts) expect(prompt.toLowerCase()).not.toContain("marks:");
  });
});
