import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  THE PROVENANCE KEY IS DERIVED FROM `JWT_SECRET` AT IMPORT TIME, so the value
  has to be in place before `_core/env` is evaluated — `vi.hoisted` is the only
  thing that runs early enough. Pinned rather than borrowed from the developer's
  own `.env`, so the token arms below prove the same thing on every machine and
  do not quietly skip where the secret happens to be absent.
*/
vi.hoisted(() => {
  process.env.JWT_SECRET = "refine-service-suite-secret-long-enough-to-be-realistic";
});

import { departureFloorFor } from "./bornWornDetector";
import { COVERAGE_BANDS } from "./maskGeometry";
import { slotDefinition } from "./referenceSlotCatalogue";
import { whichSideReask } from "./refineReask";
import type { RefineDelta } from "./refineDelta";
import type { StoredInkDesign } from "../db/castingV2InkDesigns";
import { resolveInkReferenceTake } from "./inkReferenceTake";
import { inkDesignImagePath } from "../../shared/inkDesignDelivery";
import { pictureHalfPhrase } from "./sidePhrasing";

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
/**
 * The two carry stores, counted AS the landing runs — one entry per landing.
 *
 * Written by the `landVariant` mock below and asserted by "the 42-second race".
 */
const atLanding: Array<{ mints: number; segments: number }> = [];
/** What the BRIEF said she wears — the base-worn inventory (D-206). */
let briefWorn: string[] | null = null;
let failedVariant: Record<string, unknown> | null = null;
/** Every dispatch-time recipe record written — the failing render's only account. */
const dispatchRecords: Array<Record<string, unknown>> = [];
let engineThrows: Error | null = null;
/**
 * A PAINT HELD OPEN, for the dispatch swap's arms at the bottom of this file.
 *
 * Landing C's whole claim is that the answer arrives BEFORE the render, so the
 * only honest way to assert it is to make the render unable to finish until the
 * test says so. Gating an earlier read would not do: the service reads bytes
 * three times before the claim, and a latch on those would prove nothing about
 * where the receipt sits relative to the PAINT.
 */
let renderGate: Promise<void> | null = null;
/**
 * EVERY STRING THE PAINTER WAS ACTUALLY SENT.

 * Assert at the wire (invariant 5): what a render asks for is a property of the
 * prompt that left the building, never of a constant near it. The segment
 * subtraction below is only real if the clause is missing from THIS list.
 */
const sentPrompts: string[] = [];
let renderFault = false;

vi.mock("./spendGuards", () => ({ assertNotFrozen: vi.fn(async () => undefined) }));

/*
  THE REFERENCE RESOLVER, STUBBED AT ITS MODULE BOUNDARY.

  Its own decisions — the flag, the owner in the statement, the re-anchor to
  this Cast — are driven directly in `askReference.test.ts`. What this seam is
  for is the other half: whether the service CONSULTS it, and what it does with
  each answer. Default is "no picture", which is every ask in this suite.
*/
type AskReferenceQuery = { userId: number; referencePublicId: string; candidateId: number };
const resolveAskReferenceMock = vi.fn(async (_query: AskReferenceQuery) => null as unknown);
vi.mock("./askReference", () => ({
  resolveAskReference: (query: AskReferenceQuery) => resolveAskReferenceMock(query),
}));

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
  recordVariantDispatch: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("record-dispatch");
    dispatchRecords.push(input);
    return true;
  }),
  VariantLandingError: class extends Error {},
  landVariant: vi.fn(async (input: Record<string, unknown>) => {
    /*
      WHAT THE STORES HELD AT THE INSTANT THE PICTURE BECAME VISIBLE.

      Read here rather than after the call returns, because that is the whole
      question the 42-second race asks: `landVariant` flips the row to `ready`
      and selects it in one transaction, so this is the first moment anyone can
      submit the next ask. See "the 42-second race" below.
    */
    atLanding.push({
      mints: journal.filter((entry) => entry === "mint").length,
      segments: journal.filter((entry) => entry === "keep-segments").length,
    });
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

/**
 * The digest of the bytes the storage double serves, DERIVED rather than
 * pasted.
 *
 * `repaintRender` re-hashes every reference it loads and refuses when the sha
 * the recipe named does not match (`referenceBytesChanged`) — which is how a
 * design row whose bytes have moved refuses instead of painting something else.
 * A fixture that wants a reference to RIDE therefore has to name the digest of
 * the bytes that will actually be loaded, and computing it here means a change
 * to the fixture png moves this with it instead of leaving a pasted hex string
 * that quietly stops matching.
 */
const TINY_MASTER_SHA = createHash("sha256").update(TINY_MASTER_PNG).digest("hex");

vi.mock("../providers/falImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../providers/falImages")>()),
  createFalMaskedEditEngine: () => ({
    id: "test:masked",
    edit: vi.fn(async (request: { prompt: string }) => {
      sentPrompts.push(request.prompt);
      journal.push("generate");
      if (renderGate) await renderGate;
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
const keptAsks: Array<{
  facets: readonly string[];
  verdict: string | null;
  /** The harvest's own masks. A repaint pastes nothing and therefore produces
   *  none, which is what makes the old carrier retire by construction. */
  evidence: unknown;
}> = [];
vi.mock("./segmentPersistence", () => ({
  keepSegmentsFromRender: vi.fn(async (ask: {
    facets: readonly string[];
    verdict?: string | null;
    image?: { evidence?: unknown };
  }) => {
    /* Journalled for its POSITION, not only its arguments: both stores are read
       by the next ask, so when they are written relative to the landing is the
       whole of the 42-second race (fable-307). */
    journal.push("keep-segments");
    keptAsks.push({
      facets: ask.facets,
      verdict: ask.verdict ?? null,
      evidence: ask.image?.evidence ?? null,
    });
    return { outcome: "off" as const, segments: [] };
  }),
}));

/**
 * What the render asked the LIBRARY to keep — captured, never supplied.
 *
 * Assert at the wire: both benches passed once while the segment store was
 * inert, because each proved its own half against arguments the harness had
 * handed it. The only thing that proves this caller composed a slot list is the
 * list the mint was actually called with.
 */
type MintAsk = {
  slots: ReadonlyArray<{ slot: string; words: readonly string[]; frame: string; disputed?: boolean }>;
  variantId: number | null;
  knownDigests: ReadonlyMap<string, string> | undefined;
  /** The compositor's own working. NULL on a repaint, where the whole frame was
   *  painted and the mint's `applied ?? wholeFrame` is the honest answer. */
  applied: unknown;
  deliveredRegions: unknown;
  masterSideRegions: ReadonlyMap<string, unknown> | null | undefined;
  deliveredSideRegions: ReadonlyMap<string, unknown> | null | undefined;
  /** The guard's own reader, so a test can drive it rather than trust it. */
  read: ((input: { frame: Buffer; question: string; side?: string }) => Promise<unknown>) | undefined;
  /** The GROUND reader, handed only by a render that brought no region map —
   *  which is the repaint, and only the repaint. */
  readGround: ((input: { frame: Buffer; question: string; side?: string }) => Promise<unknown>) | undefined;
  /** THE COMPOSER'''S TWO SEAMS, so a test can drive the reads her build is
   *  composed from rather than trust that they were wired at all. */
  derivedGround: {
    region: (input: { frame: Buffer; question: string }) => Promise<unknown>;
    subject: (input: { frame: Buffer }) => Promise<unknown>;
  } | undefined;
  /** THE RULER'S OTHER END — the frame this render was painted from, without
   *  which no delivery dispute can be measured at all (fable-429 §3). */
  anchorFrame: { bytes: Buffer } | undefined;
};
const mintAsks: MintAsk[] = [];
vi.mock("./referenceMint", () => ({
  mintReferencesForRender: vi.fn(async (ask: {
    slots: ReadonlyArray<{ slot: string; words: readonly string[]; frame: string; disputed?: boolean }>;
    variantId: number | null;
    knownDigests?: ReadonlyMap<string, string>;
    applied?: unknown;
    deliveredRegions?: unknown;
    masterSideRegions?: ReadonlyMap<string, unknown> | null;
    deliveredSideRegions?: ReadonlyMap<string, unknown> | null;
    anchorFrame?: { bytes: Buffer };
    dependencies?: {
      read?: MintAsk["read"];
      readGround?: MintAsk["readGround"];
      derivedGround?: MintAsk["derivedGround"];
    };
  }) => {
    journal.push("mint");
    mintAsks.push({
      slots: ask.slots,
      variantId: ask.variantId,
      knownDigests: ask.knownDigests,
      applied: ask.applied ?? null,
      deliveredRegions: ask.deliveredRegions,
      masterSideRegions: ask.masterSideRegions,
      deliveredSideRegions: ask.deliveredSideRegions,
      read: ask.dependencies?.read,
      readGround: ask.dependencies?.readGround,
      derivedGround: ask.dependencies?.derivedGround,
      anchorFrame: ask.anchorFrame,
    });
    return { outcome: "stored" as const, slots: [] };
  }),
}));

/**
 * WHAT THE READ-BACK SAYS ABOUT THIS RENDER, by facet.
 *
 * Empty by default, which is what the real one returns here anyway: it needs a
 * text engine and there is none in this suite, so it fails soft to null. Mocked
 * rather than left alone only so the library cases can have words at all —
 * every other case in this file sees exactly the behaviour it saw before.
 */
let captionsRead: Partial<Record<string, string>> = {};
/**
 * A HOOK FOR WATCHING THE CALLS THEMSELVES, not just their answers.
 *
 * Null in every test but the two-facet fixture below, which installs a barrier
 * here to ask whether two facets' read-backs are ever in flight at the same
 * moment. Nothing else in this file can see that, which is exactly why stage 3
 * of the latency work was taken out again rather than shipped green.
 */
let captionGate: ((facet: string) => Promise<void>) | null = null;
vi.mock("./realizationCaption", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./realizationCaption")>()),
  captionRealization: vi.fn(async ({ facet }: { facet: string }) => {
    if (captionGate) await captionGate(facet);
    return captionsRead[facet] ?? null;
  }),
}));

/** The digests this branch already holds. Empty unless a test says otherwise. */
let lineageReferences: Array<Record<string, unknown>> = [];
vi.mock("../db/castingV2ReferenceLibrary", () => ({
  listLineageReferences: vi.fn(async () => lineageReferences),
}));

/**
 * WHAT WAS COUNTED, and what may never be in it (fable-498 §4/§5).
 *
 * A free refusal writes no variant row, so its only artifact is this count —
 * and the count is read by staff, which is why the payload may carry the reason
 * and the facet and never the customer's own sentence.
 */
const counted: Array<Record<string, unknown>> = [];
vi.mock("./refusalCounter", () => ({
  countRefusal: vi.fn(async (input: Record<string, unknown>) => { counted.push(input); }),
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

const {
  assertNotAnUncataloguedDeparture, asksToRemoveHerHair, readAskScope, refineCandidate,
} = await import("./refineService");
/* The door itself, so the pair-vacancy rows below are checked against the rule
   that used to refuse them rather than against a copy of it. */
const { slotWordsRefusal } = await import("./slotWordShape");
const { claimVariant } = await import("../db/castingV2Variants");
const { listLineageReferences } = await import("../db/castingV2ReferenceLibrary");
const { arrangementWording } = await import("./hairArrangement");

beforeEach(() => {
  journal.length = 0;
  sentPrompts.length = 0;
  carriedAsks.length = 0;
  keptAsks.length = 0;
  mintAsks.length = 0;
  lineageReferences = [];
  counted.length = 0;
  captionsRead = {};
  captionGate = null;
  assembleAsks.length = 0;
  carriedRowsFixture = [];
  ledger.charges.length = 0;
  ledger.refunds.length = 0;
  chargeSucceeds = true;
  engineThrows = null;
  costLineThrows = false;
  renderGate = null;
  renderFault = false;
  landedVariant = null;
  atLanding.length = 0;
  failedVariant = null;
  dispatchRecords.length = 0;
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
/**
 * MAKE THE PRICING ITSELF FAIL — the only way to test the catch at the top of
 * detached work (Landing C, fable-973 §3c).
 *
 * `censusOfAttempt` returns a failure rather than throwing one, so a render
 * that dies does NOT reject the detached promise: an arm that only kills the
 * paint would pass with the guard deleted, which is a test that cannot fail.
 * What CAN reject that promise is the settlement work wrapped around it, and
 * this is the cheapest honest way to make it do so.
 */
let costLineThrows = false;

vi.mock("../logging/logger", () => {
  const record = (level: string) => (fields: unknown, message: string) => {
    if (costLineThrows && message.includes("what this edit cost")) {
      costLineThrows = false;
      throw new Error("the cost line could not be written");
    }
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

  /*
    THE DOOR ASKS AGAIN BEFORE IT REFUSES (fable-460).

    The founder's cast held "left eye icey blue". He typed "her eyes meadow
    green" and was told *"She already has left eye icey blue"* — the reading had
    dropped his ask and returned only the restatement, and the door read that as
    "she already has it". Benched on his own state, 1 of 3 readings lost the ask
    and 2 of 3 filed the colour: a third of a legitimate paid edit refused with a
    sentence that reads as the product not understanding colours.

    Driven through a fake interpreter, so the model cannot rescue it (law 3) —
    and the `restated` flag is asserted AT THE WIRE, on the request the service
    actually made, rather than on a constant near it.
  */
  it("asks once more when the reading kept only what she already is", async () => {
    const asked: Array<boolean | undefined> = [];
    const interpret = (async (request: { restated?: boolean }) => {
      asked.push(request.restated);
      /* The first reading loses her sentence; the second keeps it. */
      return asked.length === 1
        ? { ok: true as const, delta: { eyeColour: "brown" as const } }
        : { ok: true as const, delta: { eyeColour: "green" as const } };
    }) as never;

    await refineCandidate(
      { harvest: unmasked, interpret },
      { ...input, instruction: "make her eyes meadow green" },
    );

    expect(asked, "the second ask carried the restatement constraint").toEqual([undefined, true]);
    expect(journal, "and the edit she asked for was rendered").toContain("generate");
    expect(ledger.charges, "charged once, for the picture she got").toHaveLength(1);
  });

  /*
    HIS EXACT CASE, TURNED ROUND (fable-480 §2 + the restatement retry).

    Her glasses are already off in the recipe she is standing on. He asks for
    new frames; the first reading comes back holding only the standing
    departure — the echo that used to skip this door entirely and reach a paid
    render of a bare face. Now it is absorbed, the retry buys one more reading,
    and the frames he asked for are what gets painted.
  */
  it("turns the restyle that was read as a removal into a delivered restyle", async () => {
    variantRows = [{
      id: 611,
      publicId: "variant-bare",
      candidateId: 1,
      imageKey: "casting-v2/variants/bare.png",
      internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
      instructions: ["remove her glasses"],
      /* The state that made the echo invisible: they are ALREADY off. */
      deltas: { absent: { statedAccessories: ["glasses"] } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-bare";

    const readings: (boolean | undefined)[] = [];
    const interpret = (async (request: { restated?: boolean }) => {
      readings.push(request.restated);
      return readings.length === 1
        ? { ok: true as const, delta: { absent: { statedAccessories: ["glasses"] } } }
        : {
          ok: true as const,
          delta: { free: { statedAccessories: ["gentle monster style glasses clear rims"] } },
        };
    }) as never;

    const result = await refineCandidate(
      { harvest: unmasked, interpret },
      { ...input, instruction: "her glasses — gentle monster style glasses clear rims" },
    );

    expect(readings, "the restatement retry fired on the departure echo").toEqual([undefined, true]);
    const prompt = (landedVariant?.internalPrompt as { prompt: string }).prompt.toLowerCase();
    expect(prompt, "the frames he asked for were painted").toContain("clear rims");
    expect(result.variantId).toBeTruthy();
    expect(ledger.charges, "charged once, for the picture he asked for").toHaveLength(1);
  });

  it("refuses a SECOND removal of something already gone — free, and in its own words", async () => {
    /*
      The other arm of the same door: when the retry ALSO comes back holding
      only the standing departure, the ask really is a no-op and it costs
      nothing. The sentence is the departure's own — "she already has no
      glasses" is not English.
    */
    variantRows = [{
      id: 612,
      publicId: "variant-bare-2",
      candidateId: 1,
      imageKey: "casting-v2/variants/bare.png",
      internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
      instructions: ["remove her glasses"],
      deltas: { absent: { statedAccessories: ["glasses"] } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-bare-2";

    let reads = 0;
    const interpret = (async () => {
      reads += 1;
      return { ok: true as const, delta: { absent: { statedAccessories: ["glasses"] } } };
    }) as never;

    await expect(refineCandidate(
      { harvest: unmasked, interpret },
      { ...input, instruction: "take her glasses off" },
    )).rejects.toThrow(/already off her/);

    expect(reads, "two readings, never a third").toBe(2);
    expect(ledger.charges, "and nothing was charged").toHaveLength(0);
  });

  it("and asks only ONCE — a second restatement is still refused, free", async () => {
    /*
      The negative control, and the reason this is not simply "retry until it
      changes its mind": a sentence that genuinely asks for what she already has
      restates twice and must still be refused, for nothing. Without this arm a
      fix that looped, or that deleted the door, would pass the arm above.
    */
    let asks = 0;
    const interpret = (async () => {
      asks += 1;
      return { ok: true as const, delta: { eyeColour: "brown" as const } };
    }) as never;

    await expect(refineCandidate(
      { harvest: unmasked, interpret },
      { ...input, instruction: "make her eyes a warmer brown" },
    )).rejects.toThrow(/already has brown/);

    expect(asks, "two readings, never a third").toBe(2);
    expect(journal, "nothing was begun").not.toContain("begin");
    expect(ledger.charges).toHaveLength(0);
  });

  /*
    THE FIFTH DOOR, DRIVEN — and driven where the money is, not at its helper.

    `castingFrame.test.ts` proves the table and the sentence. This proves the
    SERVICE consults them before the claim, which is invariant 7's whole point: a
    control nothing calls does not exist. Driven through a fake interpreter, so
    the model cannot rescue it (law 3).
  */
  it("refuses an ask the photograph does not contain, for free", async () => {
    await expect(refineCandidate(
      { harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { free: { waist: "a smaller waist" } } }) },
      { ...input, instruction: "make her waist smaller" },
    )).rejects.toThrow(/framed from the mid-torso up/);

    expect(journal, "nothing was begun").not.toContain("begin");
    expect(journal, "and nothing was deducted").not.toContain("deduct");
    expect(ledger.charges).toHaveLength(0);
  });

  /*
    WALL (d) READS OUR OWN ROW WITH OUR OWN ROW'S READER — asserted HERE, at the
    money, and not only at the reader (ruled fable-881 §3c).

    `wallDOpenKind.test.ts` proves the two readers disagree about an open kind.
    This proves the SERVICE survives one, which is the harness-supplied-argument
    class: a reader arm passes on a value the caller may never hand it, and the
    caller is where the throw was.

    RED BEFORE THE FIX, GREEN AFTER, and the red was total: *"give her vampire
    fangs"* is one ask and it is the open one, so the persisted row is
    `{ open: … }` with nothing else. The strict reader nulls that, and the line
    under wall (d) threw ABOVE the road split — every road, every user, 100% of
    the ordinary open ask. It refunded, so nobody lost money and everybody lost
    the picture.
  */
  it("renders an ask whose ONLY content is an open kind, rather than calling the row unreadable", async () => {
    const result = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({
          ok: true as const,
          delta: { open: { fangs: { noun: "fangs", words: "vampire fangs" } } },
        }),
      },
      { ...input, instruction: "give her vampire fangs" },
    );
    expect(result).toBeTruthy();
    expect(journal, "the picture was made").toContain("land");
    expect(ledger.charges.length, "and paid for like any other edit").toBeGreaterThan(0);
    expect(ledger.refunds, "and nothing came back — this used to refund every time").toHaveLength(0);
  });

  it("SERVES a sentence whose other half is in the picture", async () => {
    /*
      The must-not-fire half. Refusing "a smaller waist and bigger arms" for the
      waist would take the arms away from her to be tidy — so the door fires only
      when the WHOLE ask is out of frame.
    */
    const result = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({
          ok: true as const,
          delta: { free: { waist: "a smaller waist", arms: "bigger arms" } },
        }),
      },
      { ...input, instruction: "a smaller waist and bigger arms" },
    );
    expect(result).toBeTruthy();
    expect(ledger.charges.length, "and it is paid for like any other edit").toBeGreaterThan(0);
  });

  /*
    AND IT SAYS WHICH HALF IT DID NOT DO (fable-386 §2), PROVEN ON THE WIRE.

    Serving the arms is right; serving them in silence is D-181 from the
    customer's side — they typed two things, paid once, and can see one of them.
    Four assertions, and each is a different place the waist used to survive:
    the delivered SENTENCE, the stored RECIPE (base-anchored, so a phantom there
    is permanent), the PROMPT the painter is sent, and the money.
  */
  it("says which half of a half-served ask was left out, and carries the waist nowhere", async () => {
    const { claimVariant } = await import("../db/castingV2Variants");
    const result = await refineCandidate(
      {
        harvest: unmasked,
        interpret: async () => ({
          ok: true as const,
          delta: { free: { waist: "a smaller waist", arms: "bigger arms" } },
        }),
      },
      { ...input, instruction: "a smaller waist and bigger arms" },
    );

    expect(result.note, "the delivery names the half it could not do").toContain("her waist is not in it");
    expect(result.note).toContain("everything else you asked for was done");
    /* A DELIVERED take. The refusal's reassuring sentence would be a lie here. */
    expect(result.note?.toLowerCase()).not.toContain("nothing was charged");

    const claimed = vi.mocked(claimVariant).mock.calls[0]![0] as {
      deltas: { free?: Record<string, unknown> };
      stepDeltas: { free?: Record<string, unknown> }[];
    };
    expect(claimed.deltas.free?.waist, "the stored recipe is base-anchored — a phantom here is forever")
      .toBeUndefined();
    expect(claimed.deltas.free?.arms, "and the half she paid for IS stored").toBe("bigger arms");
    expect(claimed.stepDeltas[claimed.stepDeltas.length - 1]?.free?.waist).toBeUndefined();

    /*
      ASSERT AT THE WIRE — and on the RIGHT LANE, which this test's first cut
      got wrong in a way worth keeping.

      It asserted the word "waist" was absent from the whole prompt, and it
      failed: the preservation clause says *"the same waist"*, because a facet
      nobody is editing is a facet to be left exactly as it is. That is the fix
      WORKING, read by an instrument too blunt to tell the two lanes apart. So
      the criterion is the one the compositor's own leak-checker uses: a genuine
      ask has the shape `HEADING: value`, and the split is the preservation
      boundary itself.
    */
    const prompt = (landedVariant?.internalPrompt as { prompt: string }).prompt.toLowerCase();
    const KEEP = "everything else must be identical to the reference";
    expect(prompt, "the split below is only meaningful if the boundary is there").toContain(KEEP);
    const askedFor = prompt.slice(0, prompt.indexOf(KEEP));
    const preserved = prompt.slice(prompt.indexOf(KEEP));
    expect(askedFor, "the painter is never told to change a waist it cannot see").not.toContain("waist");
    expect(askedFor, "the positive control — the served half IS asked for").toContain("arms: bigger arms");
    expect(preserved, "and her waist is named as a thing to leave alone").toContain("the same waist");

    expect(ledger.charges.length, "and it is paid for, once, like any other edit").toBe(1);
  });

  it("does NOT refuse a body ask that IS in the picture", async () => {
    const result = await refineCandidate(
      { harvest: unmasked, interpret: async () => ({ ok: true as const, delta: { free: { build: "a more athletic build" } } }) },
      { ...input, instruction: "give her a more athletic build" },
    );
    expect(result).toBeTruthy();
    expect(ledger.charges.length).toBeGreaterThan(0);
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

  it("but STANDS ASIDE for a proven fresh take — the sibling door the sweep found", async () => {
    /*
      THE FOURTH STRIKE, CAUGHT BY THE SWEEP INSTEAD OF BY THE FOUNDER
      (fable-733 §2, working law 7).

      This gate is `saysNothingNew` measured off the picture rather than off the
      recipe — its own log line says *"already-true — asking instead of
      spending"* — so it is state-comparing, and on a replay her upswept eyes
      are the PREMISE: she has them because of the version being regenerated.
      Left alone it would have refused the fresh take of an eye-shape edit
      exactly as the already-has door refused the fresh take of an eye-colour
      one, and he would have reported it as a fourth door.

      Its neighbour is deliberately NOT keyed on the marker: the glasses reading
      below refuses because an instrument could not take a reading, which a
      replay does not change. Two doors in one block, two classes.
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

    /* The version she is looking at, and the sentence that made it — both
       halves, because the server proves the replay against the row rather than
       believing the client. */
    variantRows = [{
      id: 612,
      publicId: "variant-foxed",
      candidateId: 1,
      imageKey: "casting-v2/variants/foxed.png",
      internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
      instructions: ["fox eyes"],
      requestText: "fox eyes",
      deltas: { eyeShape: "fox eyes" },
      stepDeltas: [{ eyeShape: "fox eyes" }],
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-foxed";

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
      { ...input, instruction: "fox eyes", replayOf: "variant-foxed" },
    );

    expect(asked.kind, "a picture, because asking again is the whole point").not.toBe("asked");
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

  it("tries twice for free and then DELIVERS, charging once (fable-721)", async () => {
    /*
      Confirmed missing on both attempts: two readings each. This asserted the
      refusal and the whole 25 back until the founder retired the reader from
      the money path — *"only give refunds on catastrophic failures because it
      couldn't truly detect something as subtle as freckles."*

      The free retry is what must survive, and it does: the product still spends
      its own second render trying to satisfy the check. What changed is the end
      of that road — she gets the picture and pays once, and the disputed verdict
      rides the row as telemetry.
    */
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false, false, false) }, input);
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds, "the reader's opinion of a healthy frame moves no money").toHaveLength(0);
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
  it("BINDS on a missing accessory — and records it, which is what binding now buys", async () => {
    /*
      fable-118's ruling survives the fable-721 flip, in the only place it can
      still live. "Binding" used to mean *worth a refusal*; the founder took
      refusals off the reader's opinion of a healthy frame, so binding now means
      **the check is asked and its answer is kept** — the difference between an
      accessory and a shade is still a fact on the row, and the two-column report
      still reads it.

      The money assertion is inverted deliberately: this is the arm that goes red
      if the flip ever leaks back into a refund.
    */
    const earrings = {
      ...greenEyes,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { statedAccessories: "dangly cross earrings" } },
      }),
    };
    await refineCandidate(
      { ...earrings, verifier: verifierSaying(false, false, false, false) },
      { ...input, instruction: "dangly cross earrings" },
    );
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds).toHaveLength(0);
    const landed = JSON.stringify(landedVariant ?? {});
    expect(landed, "an accessory is not a shade — the check binds").toContain('"binding":true');
    expect(landed, "and its answer is on the row").toContain('"verified":false');
  });

  /*
    AND A SET IS ASKED ONE ITEM AT A TIME, so the gate can fail (fable-312).

    The five-ask walk's step 2, paid for on 2026-08-12: hoops on her ears, an ask
    for dangly cross earrings, and the whole set sent to the reader as ONE line.
    The verdict came back `verified: true` with its own `saw` reading *"gold hoop
    earrings on both ears, plain hoops, no dangly crosses"* — an honest answer to
    a question that could not fail, because a picture of plain hoops does contain
    earrings.

    The reader below is not invented: it is the MEASURED one, reproduced from a
    live reading of that very frame (`prove-per-item-question-disposable.mts`,
    2026-08-13, five readings per question). One rule produces both halves of
    what was measured — **a line is present when anything actually in the picture
    satisfies it** — and that is what makes this a control rather than a mirror
    of the outcome:

      joined "gold hoop earrings, dangly cross earrings"  → present 5/5
      split  "dangly cross earrings"                      → MISSING 5/5
      split  "gold hoop earrings"                         → present 5/5
      control: her glasses, plainly there                 → present 5/5
      control: a septum ring, plainly not                 → absent  5/5

    A fake that answered "no" to any line containing the word `cross` would fail
    the joined line too, and would prove nothing about the split.
  */
  const measuredReader = (...inThePicture: string[]) => {
    const asked: string[] = [];
    return {
      asked,
      engine: {
        id: "verifier",
        complete: async (request: { system: string; user: string }) => {
          if (request.system.includes("how they")) {
            return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
          }
          asked.push(request.user);
          const results = request.user.split("\n").filter(Boolean).map((line, index) => {
            const satisfied = inThePicture.find((thing) => line.toLowerCase().includes(thing));
            return {
              id: index + 1,
              present: satisfied !== undefined,
              ...(satisfied !== undefined
                ? { saw: `${satisfied} on her` }
                /*
                  `absent: false`, and it is the measured answer rather than a
                  convenience: with hoops on her ears the reader calls a missing
                  cross a matter of how it was done, 5 readings out of 5. What
                  that costs is the finding filed in opus-256 §3.
                */
                : { absent: false, saw: "something else is at that place" }),
            };
          });
          return { text: JSON.stringify({ results }), truncated: false, latencyMs: 1 };
        },
      } as never,
    };
  };

  const twoThings = ["thin wire glasses", "dangly cross earrings"];

  it("asks the reader about EACH thing she is wearing, with its own laterality", async () => {
    const reader = measuredReader("glasses", "earrings");
    await refineCandidate(
      {
        harvest: unmasked,
        verifier: reader.engine,
        interpret: async () => ({ ok: true as const, delta: { free: { statedAccessories: twoThings } } }),
      },
      { ...input, instruction: "thin wire glasses and dangly cross earrings" },
    );
    const lines = reader.asked.join("\n").split("\n").filter((line) => /glasses|earrings/.test(line));
    expect(lines).toHaveLength(2);
    /* A pair means both sides — and only for the thing that comes in a pair.
       Joined, the clause landed once on a line that also named her glasses. */
    expect(lines.find((line) => line.includes("cross"))).toContain("one on each ear");
    expect(lines.find((line) => line.includes("glasses"))).not.toContain("one on each ear");
  });

  it("records the MISS the joined question could only answer yes to", async () => {
    /*
      The walk's own false pass, driven against the measured reader. She is
      wearing hoops; the crosses are not there. Asked as one line the answer is
      an honest YES — there are earrings on her — and that is the verdict that
      was stored beside a green tick. Asked as its own line the same reader says
      the crosses are missing, and the row says so.
    */
    const reader = measuredReader("hoop");
    await refineCandidate(
      {
        harvest: unmasked,
        verifier: reader.engine,
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["gold hoop earrings", "dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "dangly cross earrings" },
    );
    const stored = (landedVariant?.internalPrompt as {
      verification?: { checks?: Array<{ asked: string; verified: boolean }> };
    }).verification?.checks ?? [];
    const crosses = stored.find((check) => check.asked.includes("cross"));
    const hoops = stored.find((check) => check.asked.startsWith("gold hoop"));
    expect(crosses?.verified).toBe(false);
    expect(hoops?.verified).toBe(true);
  });

  it("records it, and charges, when the reader says the site is BARE", async () => {
    /*
      And the gate can now fail, which is the whole point of splitting it. This
      reader finds nothing on her ears at all — the answer that carries
      `absent`, and the only kind of miss D-246 lets spend her refusal. Joined
      with the glasses she is still wearing, this same reading was a pass.
    */
    const reader = measuredReader("glasses");
    await refineCandidate(
      {
        harvest: unmasked,
        verifier: {
          id: "verifier",
          complete: async (request: { system: string; user: string }) => {
            if (request.system.includes("how they")) {
              return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
            }
            reader.asked.push(request.user);
            const results = request.user.split("\n").filter(Boolean).map((line, index) => {
              const here = line.toLowerCase().includes("glasses");
              return {
                id: index + 1,
                present: here,
                ...(here
                  ? { saw: "thin wire glasses on her face" }
                  : { absent: true, saw: "both earlobes bare, nothing hanging from either ear" }),
              };
            });
            return { text: JSON.stringify({ results }), truncated: false, latencyMs: 1 };
          },
        } as never,
        interpret: async () => ({ ok: true as const, delta: { free: { statedAccessories: twoThings } } }),
      },
      { ...input, instruction: "thin wire glasses and dangly cross earrings" },
    );
    /*
      The gate can still FAIL — which is the whole point of splitting it — and
      failing now means the answer is recorded rather than the money returned
      (fable-721). A bare site and a worn one still read differently; only the
      consequence moved.
    */
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds).toHaveLength(0);
    const bare = JSON.stringify(landedVariant ?? {});
    expect(bare, "the site the reader found bare is on the row").toContain('"absent":true');
  });

  it("still delivers when the thing that is missing was nobody's ask this time", async () => {
    /*
      THE OTHER HALF, and it is what stops this from bricking a chain. A carried
      item with no realization caption behind it is recorded and never binding —
      the same rule the facet already had, now applied per item, so one
      undeliverable thing cannot refuse every later edit she pays for.

      The glasses are in the SET ALREADY, which is the fact that makes them a
      carried item rather than this sentence's ask.
    */
    variantRows = [{
      id: 505,
      publicId: "variant-wearing-glasses",
      candidateId: 1,
      imageKey: "casting-v2/variants/old.png",
      internalPrompt: candidateRow.internalPrompt,
      instructions: ["thin wire glasses"],
      deltas: { free: { statedAccessories: ["thin wire glasses"] } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-wearing-glasses";
    /* The crosses she asked for ARE painted; the glasses she was wearing are
       not in this frame. Under a per-item gate with no carried rule, that
       missing carried item would refuse the render she actually asked for. */
    const reader = measuredReader("cross");
    await refineCandidate(
      {
        harvest: unmasked,
        verifier: reader.engine,
        interpret: async () => ({ ok: true as const, delta: { free: { statedAccessories: twoThings } } }),
      },
      /* Her sentence asks for the crosses; the glasses ride along as a
         restatement, so they are a carried fact rather than this ask. */
      { ...input, instruction: "dangly cross earrings" },
    );
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds).toHaveLength(0);
    /* Recorded, never lost: the honesty column still shows the glasses gone. */
    expect(JSON.stringify(landedVariant ?? {})).toContain("something else is at that place");
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

  it("still BINDS over a value the vocabulary defines, and no longer refunds it", async () => {
    /*
      D-187's line is intact: "green" is a word this program owns, so the reader
      can be held to it, and greenish-hazel-versus-seafoam cannot be. The pair
      above and below is the whole ruling — one records `binding:false`, this one
      `binding:true`. What fable-721 removed is the refund that used to hang off
      the difference.
    */
    await refineCandidate({ ...greenEyes, verifier: verifierSaying(false, false) }, input);
    expect(ledger.refunds).toHaveLength(0);
    const landed = JSON.stringify(landedVariant ?? {});
    expect(landed).toContain('"binding":true');
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

  it("breaks a split with a third reading, and RE-RENDERS only on a majority", async () => {
    /*
      D-194 is untouched by fable-721, and this is where that is proved: one
      reading still cannot spend the product's free retry. Attempt 1: miss, hit,
      miss → majority missing → re-render. Attempt 2: miss, miss → confirmed →
      and the picture is delivered, because a confirmed reading of a healthy
      frame is telemetry now rather than a refund.
    */
    await refineCandidate(
      { ...greenEyes, verifier: verifierSaying(false, true, false, false, false) },
      input,
    );
    expect(journal.filter((entry) => entry === "generate")).toHaveLength(2);
    expect(ledger.refunds).toHaveLength(0);
  });
});

/*
  THE CHAIN-2 MISREAD (D-189), reproduced at the service.

  The trial asked for "small gold hoop earrings" — an addition — and one
  sampling classified it as a removal, so D-167's confession told the user there
  was nothing to take off something they were trying to put on. The word list
  cannot prevent the mis-sampling; it stops it reaching the confession.
*/
/**
 * HER HAIR GOING IS A HAIRCUT, DECIDED IN CODE (founder ruling 2026-08-14,
 * fable-606/608).
 *
 * He typed *"remove her hair"* and was told *"That one can't be rendered"*;
 * he typed the same sentence again and it rendered her bald. Measured on the
 * real service, six attempts, claim door shut: **the paint 3, the wall 2, a
 * question 1 — three doors on one input.** The variance lives in the re-read
 * this branch replaces, and the neighbouring phrasings never reach it at all
 * (*"take her hair off"* and *"make her bald"* parse straight to
 * `hairStyle: "shaved head"`, which is exactly why they are stable).
 *
 * The negative arm is the one that keeps this honest: a braid removed is not a
 * shaved head, so a removal naming a STYLE of her hair still goes to the model.
 */
describe("her hair going is a haircut, read from her sentence", () => {
  /* No brief and no chain by default — deliberately: a haircut needs no proof
     she has hair, and the gate that asks for one refuses a fresh cast with
     "I can't find any hair on this face". */
  afterEach(() => { briefWorn = null; });

  const asked = (instruction: string) => {
    let calls = 0;
    const interpret = async () => {
      calls += 1;
      return calls === 1
        ? { ok: true as const, intent: "remove" as const, subject: "hairStyle", match: "braids" }
        : { ok: true as const, delta: { hairStyle: "a soft bob" } };
    };
    return { interpret, count: () => calls, instruction };
  };

  const claimedDeltas = async () => {
    const claimed = (await import("../db/castingV2Variants")).claimVariant as unknown as {
      mock: { calls: Array<[{ deltas: unknown }]> };
    };
    return JSON.stringify(claimed.mock.calls.at(-1)?.[0]?.deltas);
  };

  it("is the bald edit, and the model is never asked about it", async () => {
    const reader = asked("remove her hair");
    const result = await refineCandidate(
      { harvest: unmasked, interpret: reader.interpret as never },
      { ...input, instruction: reader.instruction },
    );

    expect(result.variantId).toBeTruthy();
    /* NOT ONCE. The model's reading of this sentence came back four different
       ways in six attempts on the real service; the code does not wait for it. */
    expect(reader.count()).toBe(0);
    expect(await claimedDeltas()).toContain("shaved head");
  });

  it("holds for every phrasing the founder named", async () => {
    for (const phrasing of [
      "take her hair off",
      "get rid of her hair",
      "her hair — remove it",
      "shave her hair off",
    ]) {
      const reader = asked(phrasing);
      const result = await refineCandidate(
        { harvest: unmasked, interpret: reader.interpret as never },
        { ...input, instruction: phrasing, clientRequestId: `bald-${phrasing}` },
      );
      expect(result.variantId, phrasing).toBeTruthy();
      expect(reader.count(), phrasing).toBe(0);
      expect(await claimedDeltas(), phrasing).toContain("shaved head");
    }
  });

  it("CONTROL — a style of her hair still goes to the model", async () => {
    /* A braid removed is not a shaved head, and the founder's own fringe is why
       this product does not treat part of a haircut as a thing that can leave.
       Her brief names the braids so this reaches the re-read rather than the
       evidence gate, which is a different question with its own tests. */
    briefWorn = ["braids"];
    const reader = asked("remove her braids");
    await refineCandidate(
      { harvest: unmasked, interpret: reader.interpret as never },
      { ...input, instruction: reader.instruction },
    ).catch(() => undefined);

    expect(reader.count(), "the model still decides a style").toBe(2);
    const deltas = await claimedDeltas();
    expect(deltas).toContain("soft bob");
    expect(deltas, "and nothing authored a shaved head behind her back").not.toContain("shaved head");
  });

  it("CONTROL — the sentences this rule must NOT take", () => {
    /* Driven directly, because each of these is a paid render of the wrong
       thing if the rule widens: hair clips are an accessory, hair off her face
       is tied back, and shorter hair is a cut rather than a removal. */
    for (const sentence of [
      "remove her hair clips",
      "get her hair off her face",
      "remove her braids",
      "make her hair shorter",
      "take off her glasses",
    ]) {
      expect(asksToRemoveHerHair(sentence), sentence).toBe(false);
    }
    for (const sentence of [
      "remove her hair",
      "take her hair off",
      "get rid of her hair",
      "her hair — remove it",
      "shave her hair off",
      "REMOVE HER HAIR",
    ]) {
      expect(asksToRemoveHerHair(sentence), sentence).toBe(true);
    }
  });
});

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

    /*
      AND IT ASKS THE CATALOGUE'S WORD, NOT HER INFLECTION (fable-335).

      Measured on a dev face wearing a gold hoop at each lobe: asked "earrings",
      the real reader answers NOTHING; asked "earring", it finds them at once —
      its bilateral set is keyed on the singular. So a customer typing the
      plural was told her face does not show the thing she is looking at, and
      her removal was refused with a sentence about her brief.

      The double below is therefore the measured reader rather than a
      convenient one: it answers for the catalogue's word and refuses the
      user's inflection, which is exactly what production does.

      What this does NOT prove, said out loud: that the class band is right for
      a hoop. It is not — two hoops read 0.0558% of a frame against a 0.4% band
      measured on glasses — and that is a separate, unmeasured repair.
    */
    const inflectionReader = (kindItKnows: string) => {
      const asked: string[] = [];
      return {
        asked,
        regions: {
          region: async ({ name }: { name: string }) => {
            asked.push(name);
            if (name !== kindItKnows) throw new Error(`the segmenter found no ${name} to edit`);
            const data = Buffer.alloc(32 * 48, 0);
            /* Small — a hoop is a small object — but over the band. */
            for (let y = 30; y < 34; y += 1) for (let x = 4; x < 12; x += 1) data[y * 32 + x] = 255;
            return { data, width: 32, height: 48 };
          },
          subject: async () => ({ data: Buffer.alloc(32 * 48, 255), width: 32, height: 48 }),
          landmark: async () => [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }],
        },
      };
    };

    it.each(["earrings", "hoops", "studs"])(
      "asks the segmenter \"earring\" when she said %s, and lets the removal through",
      async (said) => {
        briefWorn = null;
        const reader = inflectionReader("earring");
        let call = 0;
        const result = await refineCandidate({ harvest: unmasked,
            regions: reader.regions as never,
            interpret: (async () => {
              call += 1;
              return call === 1
                ? { ok: true as const, intent: "remove" as const, subject: "statedAccessories", match: said }
                : { ok: true as const, delta: { free: { statedAccessories: [`no ${said}`] } } };
            }) as never,
          },
          { ...input, instruction: `take her ${said} off` },
        );

        /* Asserted at the wire: the word that reached the reader, not the word
           she typed. */
        expect(reader.asked).toContain("earring");
        expect(reader.asked).not.toContain(said);
        expect(result.variantId).toBeTruthy();
      },
    );

    it("CONTROL — a word the catalogue cannot name is still asked as she said it, and still refuses", async () => {
      /* The fallback, driven: no kind, no translation, and the door the fix
         must not have opened. */
      briefWorn = null;
      const reader = inflectionReader("earring");
      await expect(refineCandidate({ harvest: unmasked,
          regions: reader.regions as never,
          interpret: async () => ({
            ok: true as const, intent: "remove" as const,
            subject: "statedAccessories", match: "her tiara",
          }),
        } as never,
        { ...input, instruction: "take her tiara off" },
      )).rejects.toThrow(/nothing on record to take off/);
      expect(reader.asked).toEqual(["her tiara"]);
    });

    /*
    A SCOPED ASK THE ROAD CANNOT PLACE IS REFUSED BEFORE THE MONEY
    (fable-489 §3) — his ear, with the charge deleted.

    He tapped the panel's EARS row and asked for a cauliflower ear; the reading
    filed it as a MARK; marks have no slot inside an ear. The repaint's door
    refused it correctly and AFTER the claim, so he was charged 25 and refunded
    in the same second.
  */
  it("refuses a scoped ask whose reading landed elsewhere — and writes NO ledger row", async () => {
    briefWorn = null;
    await expect(refineCandidate({ harvest: unmasked,
        interpret: async () => ({
          ok: true as const,
          delta: { free: { marks: ["cauliflower ear on her left ear"] } },
        }),
      } as never,
      { ...input, instruction: "her left ear — has cauliflower ear", scope: "ear@left" },
    )).rejects.toThrow(/her left ear/);

    /* THE MONEY PROOF, on the ledger rather than on the log (fable-489 §3b). */
    expect(ledger.charges, "nothing was charged").toHaveLength(0);
    expect(ledger.refunds, "so nothing had to be given back").toHaveLength(0);
    expect(journal, "and nothing was claimed").not.toContain("claim");
  });

  it("COUNTS a free refusal, with the reason and never her sentence", async () => {
    /*
      The artifact D-236's sibling requires (fable-498 §5): a refusal a customer
      experienced, countable afterwards. This shift asked production how often
      the containment guard refuses an honest ask and could not answer at all.
    */
    await expect(refineCandidate({ harvest: unmasked,
        interpret: async () => ({
          ok: false as const,
          refusal: { reason: "wall_unfileable" as const, asked: "marks", value: "a lightning bolt scar" },
        }),
      } as never,
      { ...input, instruction: "give her a harry potter lighting bolt scar on her forehead" },
    )).rejects.toThrow();

    expect(counted).toHaveLength(1);
    expect(counted[0]).toMatchObject({ reason: "wall_unfileable", facet: "marks", outcome: "refused" });
    /* THE BOUNDARY, asserted on the payload rather than trusted: no field of it
       may carry what she typed or what the model wrote. */
    const said = JSON.stringify(counted[0]);
    expect(said).not.toContain("harry potter");
    expect(said).not.toContain("lightning bolt");
  });

  it("counts the door's RESCUE, which is the half that makes the ratio mean something", async () => {
    await refineCandidate({ harvest: unmasked,
        interpret: async () => ({
          ok: true as const,
          delta: { free: { marks: ["a lightning bolt scar on her forehead"] } },
          door: "rescued" as const,
        }),
      } as never,
      { ...input, instruction: "give her a harry potter lighting bolt scar on her forehead" },
    );

    expect(counted).toHaveLength(1);
    expect(counted[0]).toMatchObject({ outcome: "rescued", reason: "wall_unfileable" });
  });

  /*
    EVERY DOOR, NOT THE TWO SOMEBODY REMEMBERED (opus-465).

    The count above was wired at two call sites, and the refine road throws
    about twenty user-visible free refusals. So production had counted ZERO
    refusals on the morning the founder was refused IN IT — his "remove her
    hair" hit the removal road's edit re-read, which threw straight past the
    counter, between two audit rows written by the same helper minutes either
    side. These drive the doors themselves; the counting now happens at the one
    seam every refusal escapes through.
  */
  describe("every door a customer can hit leaves a countable artifact", () => {
    /**
     * His shape: read as a removal, re-read as an edit, and the wall.
     *
     * A STYLE of her hair, because that is a removal the re-read still handles:
     * a departable subject would leave by the branch above and never reach this
     * door. Her brief names the braids so the evidence gate — a different door,
     * with its own row below — lets it past.
     */
    const removalThenWall = (asEdit: unknown) => {
      let call = 0;
      return async () => {
        call += 1;
        return call === 1
          ? { ok: true as const, intent: "remove" as const, subject: "hairStyle", match: "braids" }
          : asEdit;
      };
    };
    beforeEach(() => { briefWorn = ["braids"]; });

    it("COUNTS the founder's own door — the removal road's edit re-read", async () => {
      /*
        His SENTENCE no longer comes down here — the determinism fix routes
        "remove her hair" to the haircut before the model is asked. The DOOR is
        the one he hit, so it is driven with a sentence that still reaches it.
      */
      await expect(refineCandidate({ harvest: unmasked,
          interpret: removalThenWall({
            ok: false as const, refusal: { reason: "wall_content" as const },
          }) as never,
        },
        { ...input, instruction: "remove her braids" },
      )).rejects.toThrow();

      expect(counted, "this refusal wrote nothing at all before today").toHaveLength(1);
      expect(counted[0]).toMatchObject({ reason: "wall_content", outcome: "refused" });
    });

    it("COUNTS the re-read that matched nothing to change", async () => {
      await expect(refineCandidate({ harvest: unmasked,
          interpret: removalThenWall({ ok: true as const, intent: "navigate" as const }) as never,
        },
        { ...input, instruction: "remove her braids" },
      )).rejects.toThrow();

      expect(counted).toHaveLength(1);
      expect(counted[0]).toMatchObject({ reason: "removal_reread_unmatched" });
    });

    it("COUNTS a door that has no parse behind it at all — the scope it cannot name", async () => {
      await expect(refineCandidate({ harvest: unmasked,
          interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
        } as never,
        { ...input, instruction: "make it green", scope: "elbow@left" as never },
      )).rejects.toThrow(/which part of her/);

      expect(counted).toHaveLength(1);
      expect(counted[0]).toMatchObject({ reason: "scope_unknown", facet: null });
    });

    it("COUNTS ONCE — the seam does not double-count a door that used to count itself", async () => {
      await expect(refineCandidate({ harvest: unmasked,
          interpret: async () => ({
            ok: false as const,
            refusal: { reason: "wall_unfileable" as const, asked: "marks", value: "a scar" },
          }),
        } as never,
        { ...input, instruction: "give her a scar" },
      )).rejects.toThrow();

      expect(counted, "one refusal, one row").toHaveLength(1);
    });

    it("COUNTS NOTHING when the ask is served — the counter is not a request log", async () => {
      briefWorn = null;
      await refineCandidate({ harvest: unmasked,
          interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
        } as never,
        { ...input, instruction: "her eyes — green" },
      );
      expect(counted).toHaveLength(0);
    });

    it("COUNTS NOTHING for a failure PAST the claim — that one has a ledger row of its own", async () => {
      /*
        The boundary the tally depends on. A render that dies after the charge
        is refunded and readable in the ledger; putting it in this count would
        mix "the product said no for free" with "the product took the money and
        failed", which are two different questions about two different fixes.
      */
      briefWorn = null;
      engineThrows = new Error("the engine fell over");
      await expect(refineCandidate({ harvest: unmasked,
          interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
        } as never,
        { ...input, instruction: "her eyes — green" },
      )).rejects.toThrow();

      expect(journal, "it got past the claim").toContain("claim");
      expect(counted, "and is therefore not a free refusal").toHaveLength(0);
    });
  });

  it("CONTROL — a scoped ask that DOES belong to the scope proceeds and charges", async () => {
    /*
      The new door must not over-refuse (the misaimed-guard lesson: keep the
      negative control after the positive passes). An eye colour asked with an
      eye scope has a slot inside that scope, so it renders and charges exactly
      as it did before this door existed.
    */
    briefWorn = null;
    await refineCandidate({ harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
      } as never,
      { ...input, instruction: "her left eye — green", scope: "eye@left" },
    );
    expect(ledger.charges, "charged once, exactly as before").toHaveLength(1);
    expect(journal).toContain("generate");
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

    /*
      THE FOUNDER'S 25 CREDITS, AS A TEST (fable-473/481).

      "Her glasses — gentle monster style glasses CLEAR rims" was classified as
      a removal; "clear" was in the removal lexicon, so this backstop was
      skipped; the base-worn path authored the departure; the painter took her
      glasses off and the charge stood. Both arms are scripted, so the model
      cannot rescue either one (law 3), and the verdict is read off the PAINTER'S
      OWN SENTENCE — what was asked for is the artifact, not what we intended.
    */
    it("an ambiguous word does not authorize a removal when the sentence names a thing to HAVE", async () => {
      briefWorn = ["glasses"];
      const modes: (string | undefined)[] = [];
      const result = await refineCandidate({ harvest: unmasked,
          interpret: (async (request: { mode?: string }) => {
            modes.push(request.mode);
            return modes.length === 1
              ? {
                ok: true as const, intent: "remove" as const,
                subject: "statedAccessories", match: "glasses",
              }
              : {
                ok: true as const,
                delta: { free: { statedAccessories: ["gentle monster style glasses clear rims"] } },
              };
          }) as never,
        } as never,
        { ...input, instruction: "her glasses — gentle monster style glasses clear rims" },
      );

      expect(modes, "the second reading is the edit re-read").toEqual([undefined, "edit"]);
      const prompt = (landedVariant?.internalPrompt as { prompt: string }).prompt.toLowerCase();
      expect(prompt, "the painter was told about the frames").toContain("clear rims");
      expect(prompt, "and never told to take them off").not.toContain("taken off");
      expect(result.variantId).toBeTruthy();
    });

    it("CONTROL — and an ambiguous word DOES stand when the re-read names nothing to have", async () => {
      /*
        The other half, and the one that protects a real removal: "no glasses"
        carries only the ambiguous "no", and its edit re-read files the user's
        own words back — a positive lane holding a negation. Taking that as a
        thing to have would cancel the removal she asked for.
      */
      briefWorn = ["glasses"];
      const reader = inflectionReader("glasses");
      const modes: (string | undefined)[] = [];
      await refineCandidate({ harvest: unmasked,
          regions: reader.regions as never,
          interpret: (async (request: { mode?: string }) => {
            modes.push(request.mode);
            return modes.length === 1
              ? {
                ok: true as const, intent: "remove" as const,
                subject: "statedAccessories", match: "glasses",
              }
              : { ok: true as const, delta: { free: { statedAccessories: ["no glasses"] } } };
          }) as never,
        } as never,
        { ...input, instruction: "no glasses" },
      );

      expect(modes).toEqual([undefined, "edit"]);
      const prompt = (landedVariant?.internalPrompt as { prompt: string }).prompt.toLowerCase();
      expect(prompt, "the removal she asked for survived the re-read").toContain("taken off");
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
  it("claims, runs, charges, generates, keeps, lands — in that order", async () => {
    await refineCandidate(greenEyes, input);
    /*
      THE LANDING IS LAST, AND THAT IS THE FIX FOR THE 42-SECOND RACE (fable-307).

      Everything the NEXT ask reads is written before the row becomes selectable
      — see "the 42-second race" in the library describe below. `keep-segments`
      appears here and `mint` does not because this render's flag is dark for the
      library and the segment store is called on every road.
    */
    expect(journal).toEqual([
      "read", "begin", "claim", "running", "deduct", "generate", "manifest",
      "keep-segments", "land", "seal:success",
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
    AND THE READER'S OPINION OF A HEALTHY FRAME NO LONGER MOVES MONEY
    (founder ruling, fable-721; the list lives in `providers/types` and is
    pinned in `providerFailureContract.test.ts`).

    > *"the verification layer was trash… only give refunds on catastrophic
    > failures because it couldn't truly detect something as subtle as
    > freckles."*

    These two used to assert the refusal and its receipt — the D-188 honesty
    fix, which was right about the WORDING and has been overtaken on the
    QUESTION. The reader disputing a picture the damage detector passed twice
    is now telemetry: the frame is delivered, the charge stands, the verdict
    rides the row, and the remedy is Regenerate.

    Driven through the real service rather than asserted on the set, because a
    contract nothing consults is a comment (working law 7).
  */
  it("DELIVERS a fact-short render and charges for it, rather than refunding", async () => {
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

    await refineCandidate({ ...greenEyes, verifier }, input);

    expect(ledger.refunds, "nothing goes back on a reader's opinion").toEqual([]);
    expect(ledger.charges, "and she is charged once, for the picture she got").toHaveLength(1);
    expect(landedVariant, "the frame lands rather than vanishing").not.toBeNull();
    expect(failedVariant, "and no failed row is written").toBeNull();
  });

  it("keeps the disputed verdict on the row, where the report reads it", async () => {
    /*
      The half of the old behaviour that must NOT be lost. The refusal used to
      be the only record that a check had failed; delivering it would be a
      silent charge if the verdict went with it. `reliabilityReport` classifies
      these rows as `delivered_absent` / `delivered_noncompliant` off exactly
      this field, so the number survives the ruling that took away the refund.
    */
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
    await refineCandidate({ ...greenEyes, verifier }, input);

    const stored = (landedVariant?.internalPrompt as {
      verification?: { checks?: Array<{ verified?: boolean }> };
    })?.verification;
    expect(stored?.checks?.some((check) => check.verified === false),
      "the failed check is on the delivered row").toBe(true);
  });
});

/**
 * THE NEW COMPOSITOR ON THE PAID PATH (D-241), dark behind
 * `CASTING_REPAINT_SCOPE`.
 *
 * Everything here is asserted on WHAT WENT OUT — the request the repaint engine
 * actually received — rather than on a constant near it (working law 5). "The
 * master is reference 1" is a claim about element 0 of an array somebody
 * dispatched, and the campaign has already paid twice for the version of that
 * claim which was true of a variable and false of a request.
 */
describe("the repaint replaces the compositor rather than configuring it", () => {
  /** A repaint's whole request, captured at the wire. */
  const painted: Array<{
    prompt: string;
    references: ReadonlyArray<{ bytes: Buffer; contentType: string }>;
    width: number;
    height: number;
  }> = [];

  const repaintEngine = () => ({
    id: "test:repaint",
    edit: async (request: {
      prompt: string;
      references: ReadonlyArray<{ bytes: Buffer; contentType: string }>;
      width: number;
      height: number;
    }) => {
      painted.push(request);
      journal.push("repaint");
      if (engineThrows) throw engineThrows;
      return {
        bytes: Buffer.from("repainted"),
        contentType: "image/png",
        width: request.width,
        height: request.height,
        latencyMs: 10,
        provenance: { provider: "fal" as const, model: "gpt-image-2", providerRef: "req-r" },
      };
    },
  });

  /** Distinguishable bytes per key, so "reference 2 is her lips" is provable
   *  against the array rather than against the sentence that describes it. */
  const readBytes = async (key: string) => (key === "casting-v2/candidates/abc.png"
    ? { bytes: TINY_MASTER_PNG, contentType: "image/png" }
    : { bytes: Buffer.from(`crop:${key}`), contentType: "image/png" });

  const repainting = {
    repaintEnabled: () => true,
    repaintEngine,
    readBytes,
    /* The masked harvest must never be reached on this road; if it is, this
       passthrough keeps the failure legible instead of masking a real cut. */
    harvest: unmasked,
  };

  /** One live carry row, in the shape the lineage walk returns. */
  const carryRow = (over: Record<string, unknown> = {}) => ({
    id: 1,
    publicId: "ref-1",
    candidateId: 1,
    variantId: null,
    role: "carry",
    slot: "lips",
    tier: "anatomy",
    noun: "lips",
    words: ["a fuller cupid's bow"],
    storageKey: "casting-v2/library/lips.png",
    maskKey: null,
    digest: null,
    geometry: null,
    guard: null,
    refusal: null,
    version: 1,
    retiredAt: null,
    createdAt: new Date("2026-08-11T00:00:00Z"),
    ...over,
  });

  const hairDown = {
    ...repainting,
    interpret: async () => ({ ok: true as const, delta: { free: { hairWorn: "hair down" } } }),
  };

  beforeEach(() => {
    painted.length = 0;
  });

  /**
   * THE SMALL COPY IS HELD BY THE SAME MANIFEST AS THE FRAME (fable-503).
   *
   * A thumbnail put to a public key with nothing that knows it exists is the same
   * orphan as a frame — a picture of a person at a permanent URL that no row can
   * ever purge — at a twentieth of the size and none of the excuse. So it is
   * registered BEFORE the write, in the same batch, and discharged with it.
   */
  describe("the thumbnail of a delivered version", () => {
    const realFrame = async () => (await import("sharp")).default({
      create: { width: 640, height: 960, channels: 3, background: { r: 90, g: 80, b: 70 } },
    }).png().toBuffer();

    it("is registered with the frame and lands on the row", async () => {
      const cleanup = await import("../db/storageCleanup");
      const variants = await import("../db/castingV2Variants");
      (cleanup.createStorageCleanupManifestIn as any).mockClear();
      (variants.landVariant as any).mockClear();

      const stored: Array<{ key: string; contentType: string }> = [];
      await refineCandidate({
        ...hairDown,
        /* A REAL picture: the suite's standard engine answers four bytes of
           text, and a thumbnail of that is correctly null. */
        repaintEngine: () => ({
          id: "test:repaint",
          edit: async (request: { width: number; height: number }) => {
            journal.push("repaint");
            return {
              bytes: await realFrame(),
              contentType: "image/png",
              width: request.width,
              height: request.height,
              latencyMs: 10,
              provenance: { provider: "fal" as const, model: "gpt-image-2", providerRef: "req-r" },
            };
          },
        }),
        storeImage: async (ask: any) => {
          stored.push({ key: ask.key, contentType: ask.contentType });
          return { key: ask.key, url: `https://cdn.example/${ask.key}` };
        },
      } as never, { ...input, instruction: "wear her hair down" });

      const manifest = (cleanup.createStorageCleanupManifestIn as any).mock.calls.at(-1)?.[1];
      const held = (manifest?.storageItems ?? []).map((item: any) => item.storageKey);
      /* BOTH keys, before either object exists. */
      expect(held.filter((key: string) => key.endsWith(".webp"))).toHaveLength(1);
      expect(held.length).toBe(2);
      /* And every key the manifest holds is one the writer actually used. */
      for (const key of held) expect(stored.map((write) => write.key)).toContain(key);

      const landing = (variants.landVariant as any).mock.calls.at(-1)?.[0];
      expect(landing?.thumbKey).toMatch(/\.webp$/);
      expect(held).toContain(landing?.thumbKey);
    });

    it("lands WITHOUT one when the frame cannot be shrunk, and holds only the frame", async () => {
      const cleanup = await import("../db/storageCleanup");
      const variants = await import("../db/castingV2Variants");
      (cleanup.createStorageCleanupManifestIn as any).mockClear();
      (variants.landVariant as any).mockClear();

      await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

      const manifest = (cleanup.createStorageCleanupManifestIn as any).mock.calls.at(-1)?.[1];
      const held = (manifest?.storageItems ?? []).map((item: any) => item.storageKey);
      /* One key, not two — a manifest naming an object nobody will ever write is
         a purge that reports work it did not do. */
      expect(held).toHaveLength(1);
      expect((variants.landVariant as any).mock.calls.at(-1)?.[0]?.thumbKey).toBeNull();
    });
  });

  it("THE DEGENERATE CASE: an empty library sends the master alone, plus words", async () => {
    /* fable-171 condition 1 — the road every new cast travels, and the first
       fixture here for exactly that reason. It is not a special case in the
       code either: it is what the general path does with nothing to carry. */
    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    expect(painted).toHaveLength(1);
    expect(painted[0]!.references).toHaveLength(1);
    expect(painted[0]!.references[0]!.bytes).toEqual(TINY_MASTER_PNG);
    expect(painted[0]!.prompt).toContain("Reference 1 is the photograph of this person");
    expect(painted[0]!.prompt).toContain("Change only her hair: hair down.");
    /* The master's exact pixels, never a resolution tier. */
    expect(painted[0]!.width).toBe(32);
    expect(painted[0]!.height).toBe(48);
  });

  it("delivers the engine's own frame, with nothing composited into it", async () => {
    const stored: Buffer[] = [];
    await refineCandidate({
      ...hairDown,
      storeImage: async (ask) => {
        stored.push(ask.bytes);
        return { key: ask.key, url: `https://cdn.example/${ask.key}` };
      },
    }, { ...input, instruction: "wear her hair down" });

    expect(stored).toEqual([Buffer.from("repainted")]);
    /* And the old road was not travelled at all: no full-frame prompt reached
       the incumbent engine or the masked one. */
    expect(sentPrompts).toHaveLength(0);
    expect(journal).toContain("repaint");
    expect(journal).not.toContain("generate");
  });

  /**
   * THE CARRY'S OWN ROOT, AT THE CLAIM — and the segment store is dark here.
   *
   * `listLineageReferences` anchors on the new variant and climbs its parents,
   * so the whole carry rests on one written column. That column used to be
   * written only while `CASTING_SEGMENTS_SCOPE` named the user, on a reason
   * that had gone stale twice over, and nothing in this suite could see it:
   * every test above hands the lineage rows in directly (`lineageReferences`),
   * which is the harness supplying the very argument the product has to derive.
   *
   * Driven on a fixture inside the repaint and library scopes and outside the
   * segment one, the consequence was four renders in a row that came back
   * without the earrings the previous render had delivered — `carried: []`
   * beside two healthy library rows, and a refund each time.
   *
   * So this asserts the fact at the site that writes it, with the flag proved
   * OFF first: an assertion that passes because the environment happens to be
   * armed would be measuring the harness again.
   */
  it("records the version it came from even while the segment store is dark", async () => {
    const { captureCastingSegmentsEnabled } = await import("./castingV2Scope.js");
    /* Set here rather than assumed: `vitest.setup.ts` loads the developer's own
       `.env`, so this suite inherits whatever that machine has the store set to
       — the first cut of this test read `true` on mine. A control that depends
       on a dotfile is not a control. */
    const wasScoped = process.env.CASTING_SEGMENTS_SCOPE;
    process.env.CASTING_SEGMENTS_SCOPE = "off";
    expect(
      captureCastingSegmentsEnabled(input.userId),
      "the control is the point: the store must be OFF for this to mean anything",
    ).toBe(false);

    variantRows = [{
      id: 720,
      publicId: "variant-born",
      candidateId: 1,
      imageKey: "casting-v2/variants/born.png",
      internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
      instructions: ["dangly cross earrings"],
      deltas: { free: { statedAccessories: ["dangly cross earrings"] } },
      stepDeltas: [{ free: { statedAccessories: ["dangly cross earrings"] } }],
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-born";

    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    const variants = await import("../db/castingV2Variants");
    const claimed = (variants.claimVariant as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    }).mock.calls.at(-1)?.[0];
    expect(claimed?.parentVariantPublicId).toBe("variant-born");
    process.env.CASTING_SEGMENTS_SCOPE = wasScoped;
  });

  it("carries a minted crop as its own reference, in the recipe's own order", async () => {
    lineageReferences = [carryRow()];

    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    const request = painted[0]!;
    expect(request.references.map((reference) => reference.bytes)).toEqual([
      TINY_MASTER_PNG,
      Buffer.from("crop:casting-v2/library/lips.png"),
    ]);
    /* The sentence and the array are built in one pass, so the ordinal in the
       prose is the ordinal in the request. Asserting both is what makes that
       claim checkable rather than plausible. */
    expect(request.prompt).toContain("Reference 2 is the exact lips she has");
    /*
      AND FOR AN ANATOMY SLOT, THE WORDS RIDE BESIDE IT — at the wire, which is
      where this proof has to be (fable-863 §3c).

      This assertion read `not.toContain("a fuller cupid's bow")` until
      2026-08-17, carrying fable-598's item rule onto a slot it was never
      measured on. `lips` is ANATOMY: its crop is an assist worth about a third
      of the distance against a master that disagrees with it, and the word
      stack is the carrier of record (fable-192). Measured the same day on an
      eye, which is the same class: crop alone 0 of 5 across three
      presentations, words present 5 of 5.

      The item half of the rule keeps its own arm in `recipeAssembler.test.ts` —
      an earring's crop still says nothing beside itself, for the reason it
      earned.
    */
    expect(request.prompt).toContain("the same lips, unchanged");
    expect(request.prompt).toContain("Keep her lips exactly: a fuller cupid's bow.");
  });

  /**
   * D-244 LINE 2 AT THE WIRE — the second edit of a slot the library already
   * holds a crop for.
   *
   * `assembleRecipe` refuses `carriesItsOwnEdit` when a slot is both edited and
   * carrying, calling that branch "the defect the law makes unreachable". It was
   * entirely reachable: this service passed the derived library through whole,
   * and every live production row is a carry row. Driven on the founder's own
   * library, *"wear her hair down"* was REFUSED and refunded on both his faces
   * (opus-238).
   *
   * The fixture that hid it for a whole campaign is one word: every existing
   * case here carries a `lips` crop while the ask is `hair`, and every case in
   * `repaintAsks.test.ts` passes `library: []`. Two suites proving the guard
   * fires and the asks assemble, and no test ever putting a real crop and its
   * own slot's ask in one room.
   */
  const hairCarryRow = () => carryRow({
    slot: "hair", tier: "anatomy", noun: "hair",
    words: ["tight curls piled into a high bun"],
    storageKey: "casting-v2/library/hair.png",
  });

  /**
   * THE CLASS, PROVEN AT THE WIRE (fable-599 §2).
   *
   * Fix A lands in the one reference-line writer every kind shares, so hair,
   * eyes, horns and every kind added later inherit it in the same commit. That
   * is an argument about construction; this is the assertion, and it is on the
   * outgoing dispatch rather than on a constant near it (working law 5).
   *
   * NO carried reference of ANY kind restates its description. Each says the
   * slot, its side where it has one, and the claim — and the crop is the
   * description. A future kind cannot quietly reintroduce the second author
   * without this failing, and it does not need a court of its own to do so.
   *
   * Words-only carriers are a different thing and are deliberately not here:
   * skin has no crop to argue with and rides its sentence by founder ruling.
   */
  /**
   * A PER-SIDE FACET IS READ BACK FROM ITS OWN CUT (fable-611 §2, courted).
   *
   * Asked which eye a colour landed on, the read-back is wrong in both
   * directions — on seventeen frames whose painted side the segmenter had
   * measured it refused three correct renders and corroborated three wrong-eye
   * ones, and pinning its frame of reference in the prompt moved no verdict at
   * all. What passed was taking the side word out of the question: cut the
   * named side out and the picture IS the side.
   *
   * Both halves are asserted on the CALL — the bytes it was handed and the ask
   * it was given — because "reads the cut" is a claim about what went to the
   * reader, not about a variable near it.
   */
  it("reads a per-side facet back from that side's own cut, with the side words gone", async () => {
    const onePixelOn = () => {
      const data = Buffer.alloc(32 * 48);
      for (let at = 0; at < 200; at += 1) data[at] = 255;
      return { data, width: 32, height: 48 };
    };
    captionsRead = { "eye.colour": "a fiery red iris" };
    await refineCandidate({
      ...repainting,
      /* A real picture, because the cut is made with sharp: a sentinel buffer
         would fall back to the frame and the arm would prove nothing. */
      repaintEngine: () => ({
        id: "test:repaint",
        edit: async (request: { width: number; height: number }) => ({
          bytes: TINY_MASTER_PNG,
          contentType: "image/png",
          width: request.width,
          height: request.height,
          latencyMs: 1,
          provenance: { provider: "fal" as const, model: "gpt-image-2", providerRef: "req-cut" },
        }),
      }),
      regions: {
        region: async () => onePixelOn(),
        regionSides: async () => ({ left: onePixelOn(), right: onePixelOn() }),
        subject: async () => onePixelOn(),
        landmark: async () => [],
      } as never,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { eyeColourFree: "her right eye fiery red" } },
      }),
    } as never, { ...input, instruction: "her right eye fiery red", scope: "eye@right" });

    const { captionRealization } = await import("./realizationCaption");
    const call = (captionRealization as unknown as {
      mock: { calls: Array<[{ facet: string; bytes: Buffer; asked: string | null }]> };
    }).mock.calls.at(-1)?.[0];
    expect(call?.facet).toBe("eye.colour");
    /* Not the delivered frame: a cut of it. */
    expect(call?.bytes.equals(TINY_MASTER_PNG)).toBe(false);
    /* And no side word left for it to be wrong about. */
    expect(call?.asked ?? "").not.toContain("right");
    expect(call?.asked ?? "").toContain("fiery red");
  });

  /*
    THE SIDE CLAUSE, ASSERTED AT THE WIRE (fable-625 §3, opus-469).

    The enumeration of scope-flag branch points on this road found three, and
    two of them already took an injected predicate. This one read the flag
    directly, so the clause could be proven inside the assembler (which takes
    `placeSides` as an input) and inside the boot guard — and NOWHERE in
    between. A per-user flag hides exactly that gap: the wiring is invisible to
    every suite whose machine has the flag off, which is every machine that has
    not gone looking for the founder's road.

    Both sides, on one dispatched prompt each, because a clause that is present
    when armed proves nothing unless it is absent when it is not.
  */
  it("says WHERE the side is when this account is inside the phrasing scope", async () => {
    await refineCandidate({
      ...repainting,
      sidePhrasingEnabled: () => true,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { eyeColourFree: "her right eye fiery red" } },
      }),
    } as never, { ...input, instruction: "her right eye fiery red", scope: "eye@right" });

    expect(painted.at(-1)?.prompt, "the recipe that actually went out")
      .toContain("on the left of the picture as you look at it");
  });

  it("CONTROL — and says nothing about the picture's halves when it is not", async () => {
    await refineCandidate({
      ...repainting,
      sidePhrasingEnabled: () => false,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { eyeColourFree: "her right eye fiery red" } },
      }),
    } as never, { ...input, instruction: "her right eye fiery red", scope: "eye@right" });

    const prompt = painted.at(-1)?.prompt ?? "";
    expect(prompt, "her own side is still named").toContain("right eye");
    expect(prompt, "and the flag is genuinely off at the wire")
      .not.toContain("as you look at it");
  });

  /*
    THE POINTED ASK, REPLAYABLE (fable-704 — the founder's own bug).
    ---------------------------------------------------------------

    He hit Regenerate on *"her right eye — fiery red"* and got the per-side
    refusal: *"That names one side of a pair… tap it on her picture."* The gate
    was working exactly as designed; what reached it was wrong. Regenerate
    rebuilt the ask from the words on the chip, and the words are half of a
    pointed request — the other half is the rectangle, which was written down
    nowhere. A reconstruction needs an independent record and there was none.

    Four tests, and the fourth is the one that matters: the third proves a
    recovered scope reaches the painter, and the fourth proves that WITHOUT the
    record the same replay reproduces his refusal. Together they say the record
    is what carries it, rather than something else in the request happening to.
  */
  const perSideDeps = {
    interpret: async () => ({
      ok: true as const,
      delta: { free: { eyeColourFree: "her right eye fiery red" } },
    }),
  };

  it("writes the rectangle she pointed at onto the row, so a fresh take can replay it", async () => {
    await refineCandidate({ ...repainting, ...perSideDeps } as never,
      { ...input, instruction: "her right eye fiery red", scope: "eye@right" });

    expect(readAskScope(landedVariant?.internalPrompt)).toBe("eye@right");
  });

  it("CONTROL — a typed ask that pointed at nothing writes nothing", async () => {
    /* The discriminator for the reader above: make the write unconditional and
       this goes red, rather than every whole-face ask quietly acquiring a
       rectangle it never had. */
    await refineCandidate({ ...repainting, ...greenEyes } as never, input);

    expect((landedVariant?.internalPrompt as { askScope?: unknown }).askScope).toBeUndefined();
    expect(readAskScope(landedVariant?.internalPrompt)).toBeNull();
  });

  it("REPLAYS the pointed ask from the record — one eye reaches the painter, not two", async () => {
    /*
      The round trip end to end: send a scope, read it back off the row the way
      the projection does, and send THAT. The recipe the painter receives names
      the eye she pointed at and never the other one — which is the whole of
      fable-444 ruling C, arrived at from the record rather than from the ask.
    */
    await refineCandidate({ ...repainting, ...perSideDeps } as never,
      { ...input, instruction: "her right eye fiery red", scope: "eye@right" });
    const recovered = readAskScope(landedVariant?.internalPrompt);

    painted.length = 0;
    await refineCandidate({ ...repainting, ...perSideDeps } as never,
      { ...input, instruction: "her right eye fiery red", scope: recovered ?? undefined });

    expect(painted).toHaveLength(1);
    const recipe = painted.at(-1)?.prompt ?? "";
    expect(recipe).toContain("Change only her right eye");
    expect(recipe).not.toContain("left eye");
  });

  it("REPRODUCES his bug when the record is missing — the same words alone are refused", async () => {
    /*
      The negative control, and it is the founder's screenshot: replay the
      sentence with no rectangle behind it and the sentence lane refuses it,
      because a side named in prose would tell the recipe to change BOTH. The
      refund is the contract holding — he was charged nothing — and the refusal
      is honest. It is simply an answer to a question he did not ask.

      This is what a row landed before the record still does, and deliberately:
      there is nothing pointed to replay, so it replays what there is.
    */
    painted.length = 0;
    await expect(refineCandidate({ ...repainting, ...perSideDeps } as never,
      { ...input, instruction: "her right eye fiery red" }))
      .rejects.toThrow(/names one side of a pair/i);
    expect(painted).toHaveLength(0);
  });

  /*
    AND THE ROW SAYS WHAT IT IS REDRAWING WHILE IT IS BEING DRAWN (fable-703).

    Screenshot #303: he hit Regenerate, the plate said the honest wait, and the
    version's own rail thumbnail sat there wearing the old render. An in-place
    re-roll adds no chip — it replaces one — so the rail had nothing to draw the
    wait ON, and the only thing that knows which version is being replaced is
    the row. It knew four minutes too late: `landVariant` wrote it on arrival,
    which is precisely when nobody needs telling any more.
  */
  const regenerating = () => {
    const claimed = (claimVariant as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    }).mock.calls.at(-1)?.[0];
    return claimed?.regeneratesVariantPublicId ?? null;
  };

  const repeatable = () => {
    variantRows.push({
      id: 91,
      publicId: "variant-selected",
      imageKey: "casting-v2/variants/she-is-looking-at-this.png",
      instructions: ["icy blue eyes"],
      requestText: "icy blue eyes",
      stepDeltas: [{ eyeColour: "blue" }],
      deltas: { eyeColour: "blue" },
      internalPrompt: {},
    } as never);
    candidateRow.selectedVariantPublicId = "variant-selected";
    return {
      interpret: async () => ({ ok: true as const, delta: { eyeColour: "blue" as const } }),
    };
  };

  it("offers a fresh take before claiming anything, and charges nothing to ask", async () => {
    const deps = repeatable();
    const charges = ledger.charges.length;

    const result = await refineCandidate({ ...repainting, ...deps } as never,
      { ...input, instruction: "icy blue eyes" });

    expect(result.kind).toBe("asked");
    expect(ledger.charges).toHaveLength(charges);
    expect(vi.mocked(claimVariant)).not.toHaveBeenCalled();
  });

  /*
    AND THE BUTTON IS THE OTHER DOOR INTO THE SAME ROOM (fable-733).

    Everything above is the REASK path — she was offered a fresh take and said
    yes. The Regenerate BUTTON answers nothing: it sends the sentence and the
    scope and no `answering` at all, so `confirmedRegenerate` was false on every
    press and the already-has door told the founder *"She already has her right
    eye fiery red — this would have changed nothing"* about the one control
    whose entire meaning is asking again. Third strike on that journey, which is
    why the marker exists rather than a fourth patch.
  */
  it("the REGENERATE BUTTON renders in place — the state doors stand aside for a proven replay", async () => {
    const deps = repeatable();
    const charges = ledger.charges.length;

    const result = await refineCandidate({ ...repainting, ...deps } as never, {
      ...input,
      /* The sentence the version was made from, and the version it was made
         for — exactly what the button sends. No `answering`: nothing was
         asked. */
      instruction: "icy blue eyes",
      replayOf: "variant-selected",
    });

    expect(result.kind, "a picture, not a question").toBe("rendered");
    expect(ledger.charges.length, "and it is a paid render like any other").toBe(charges + 1);
    /* In PLACE — the rail replaces this version rather than growing one. */
    expect(regenerating()).toBe("variant-selected");
  });

  it("NEGATIVE CONTROL — a typed duplicate with no marker is still offered, not rendered", async () => {
    /*
      fable-733 §3's condition, and the half that makes the fix a fix rather
      than a hole: the door stays alive for its real customers. Somebody typing
      the same sentence again has not pressed Regenerate, and the offer before
      the charge is the whole protection.

      The arm above and this one differ by ONE field. That is the discriminator,
      and it is why they sit together.
    */
    const deps = repeatable();
    const charges = ledger.charges.length;

    const result = await refineCandidate({ ...repainting, ...deps } as never,
      { ...input, instruction: "icy blue eyes" });

    expect(result.kind, "the offer, exactly as before").toBe("asked");
    expect(ledger.charges).toHaveLength(charges);
  });

  it("NEGATIVE CONTROL — a replay naming a version this render is not built on proves nothing", async () => {
    /*
      The marker is NAMED, not asserted. A client that could turn the state
      doors off by sending a boolean could spend somebody's 25 credits on a
      render that changes nothing — so the id is checked against the row this
      render is actually built on, and a claim that does not check out simply is
      not a replay. The ask carries on as an ordinary sentence, which here means
      the offer.
    */
    const deps = repeatable();
    const charges = ledger.charges.length;

    const result = await refineCandidate({ ...repainting, ...deps } as never, {
      ...input,
      instruction: "icy blue eyes",
      replayOf: "variant-she-is-not-looking-at",
    });

    expect(result.kind).toBe("asked");
    expect(ledger.charges).toHaveLength(charges);
  });

  it("NEGATIVE CONTROL — a replay whose SENTENCE drifted from the row proves nothing", async () => {
    /*
      Both halves are checked, because either one alone is forgeable. Naming the
      right version while sending a different sentence is a new ask wearing a
      replay's clothes, and treating it as a re-roll would put a fresh edit into
      the version it claims to be replacing.
    */
    const deps = repeatable();

    const result = await refineCandidate({ ...repainting, ...deps } as never, {
      ...input,
      instruction: "emerald green eyes",
      replayOf: "variant-selected",
    });

    expect(regenerating(), "it replaces nothing — it is a new ask").toBeNull();
  });

  it("records at the CLAIM which version a confirmed fresh take replaces", async () => {
    const deps = repeatable();

    await refineCandidate({ ...repainting, ...deps } as never, {
      ...input,
      instruction: "Yes — a fresh take · 25 credits",
      answering: "icy blue eyes",
    });

    /* The chip the rail must draw the ring on — known at the claim, four
       minutes before the picture that used to be its only announcement. */
    expect(regenerating()).toBe("variant-selected");
    /* And still said on arrival, where the take grouping reads it. Two
       writers, one condition — they cannot disagree. */
    expect((landedVariant?.internalPrompt as { regeneratedFrom?: unknown }).regeneratedFrom)
      .toBe("variant-selected");
  });

  it("CONTROL — an ordinary edit replaces nothing and says so", async () => {
    /* The discriminator: an edit that ADDS a version has a ghost chip of its
       own, and marking it as a redraw would put the wait on somebody else's
       picture. */
    await refineCandidate({ ...repainting, ...greenEyes } as never, input);

    expect(regenerating()).toBeNull();
    expect((landedVariant?.internalPrompt as { regeneratedFrom?: unknown }).regeneratedFrom)
      .toBeUndefined();
  });

  it("lets an ITEM's crop speak alone and makes ANATOMY say its words too", async () => {
    const kinds = [
      { slot: "hair", tier: "anatomy", noun: "hair", words: ["auburn-brown, shoulder length"] },
      { slot: "lips", tier: "anatomy", noun: "lips", words: ["a fuller cupid's bow"] },
      { slot: "eye@left", tier: "anatomy", noun: "left eye", words: ["deep green with a pale limbal ring"] },
      { slot: "horns@right", tier: "item", noun: "right horn", words: ["a curved, ridged, tan-brown horn"] },
      { slot: "earring@left", tier: "item", noun: "left earring", words: ["a small silver cross on a thin chain"] },
    ];
    lineageReferences = kinds.map((kind, index) => carryRow({
      id: 20 + index,
      publicId: `ref-${20 + index}`,
      slot: kind.slot,
      tier: kind.tier,
      noun: kind.noun,
      words: kind.words,
      storageKey: `casting-v2/library/${kind.slot.replace("@", "-")}.png`,
    }));

    await refineCandidate(
      { ...repainting, interpret: async () => ({ ok: true as const, delta: { free: { skinTone: "a warm tan" } } }) },
      { ...input, instruction: "give her a warm tan" },
    );

    /*
      BOTH DIRECTIONS, SWEPT ACROSS BOTH TIERS, at the wire (fable-863 §3b/c).

      Until 2026-08-17 this loop asserted the SAME thing for every kind — no
      slot restates itself beside its crop — which is fable-598's item rule
      applied to anatomy, where it was never measured. It cost the eyes their
      carrier: an anatomy slot with a crop said nothing about what the feature
      IS, and the delivered colour came back 0 times in 5.

      Now the sweep is the discriminator. An item that starts describing itself
      reddens; an anatomy slot that goes quiet reddens. Neither direction can
      drift without this failing.
    */
    const { prompt } = painted[0]!;
    for (const kind of kinds) {
      expect(prompt).toContain(`is the exact ${kind.noun} she has — the same ${kind.noun}, unchanged.`);
      if (kind.tier === "item") {
        expect(
          prompt,
          `${kind.slot} is an ITEM: its crop is the fact and a sentence beside it is a second author`,
        ).not.toContain(kind.words[0]!);
        continue;
      }
      expect(
        prompt,
        `${kind.slot} is ANATOMY: its words are the carrier of record and ride beside the crop`,
      ).toContain(`Keep her ${kind.noun} exactly: ${kind.words[0]!}.`);
    }
    /* And the crops really did ride — an assertion about what is ABSENT from a
       prompt passes just as well when nothing was carried at all. */
    expect(painted[0]!.references).toHaveLength(kinds.length + 1);
  });

  it("PAINTS the second edit of a carried slot, without sending that slot its own crop", async () => {
    lineageReferences = [hairCarryRow()];

    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    /* It painted at all — the assertion the refusal would have failed. */
    expect(painted).toHaveLength(1);
    const request = painted[0]!;
    /* The master alone: her hair's own crop did NOT ride in her hair's edit. */
    expect(request.references.map((reference) => reference.bytes)).toEqual([TINY_MASTER_PNG]);
    expect(request.prompt).not.toContain("Reference 2");
    /*
      AND THE WORDS SURVIVED THE CROP BEING DROPPED. Without this the fix and
      "drop the whole entry" are indistinguishable, and the second would silently
      throw away everything ever said about her hair — the stack an edit
      regenerates from.
    */
    expect(request.prompt).toContain("tight curls piled into a high bun");
  });

  it("and the OTHER slots' crops still carry — the over-correction, driven", async () => {
    lineageReferences = [hairCarryRow(), carryRow({ id: 2, publicId: "ref-2" })];

    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    const request = painted[0]!;
    /* Exactly one crop rides: the lips, which nobody edited. Dropping every
       carry on an edited render would pass the test above and lose her face. */
    expect(request.references.map((reference) => reference.bytes)).toEqual([
      TINY_MASTER_PNG,
      Buffer.from("crop:casting-v2/library/lips.png"),
    ]);
    expect(request.prompt).toContain("Reference 2 is the exact lips she has");
  });

  /**
   * A harvest that DOES hand back the compositor's working.
   *
   * Both assertions below are about an ABSENCE — no evidence, no `applied` —
   * and an absence is only evidence if the fixture could have produced a
   * presence. The suite's own passthrough returns neither on either road, so
   * without this control the two tests would pass identically with the repaint
   * branch deleted, which is the checker that cannot fail.
   */
  const composite = {
    applied: { width: 32, height: 48, data: Buffer.alloc(32 * 48) },
    masterRegions: new Map<string, never>(),
  };
  const compositing = async (ask: { painted: { bytes: Buffer; contentType: string } }) => ({
    bytes: ask.painted.bytes,
    contentType: ask.painted.contentType,
    outcome: "composited" as const,
    evidence: composite,
  });

  it("keeps no segments, because nothing was pasted", async () => {
    /* The old carrier retiring BY CONSTRUCTION rather than by anyone
       remembering to skip it: the store's own rule is "no evidence, nothing to
       keep", and a repaint produces no evidence because there is no paste to
       scope. */
    await refineCandidate({ ...hairDown, harvest: compositing },
      { ...input, instruction: "wear her hair down" });

    expect(keptAsks).toHaveLength(1);
    expect(keptAsks[0]!.evidence).toBeNull();
  });

  it("CONTROL — the same ask on the old road hands permanence its masks", async () => {
    await refineCandidate({ ...hairDown, repaintEnabled: () => false, harvest: compositing },
      { ...input, instruction: "wear her hair down" });

    expect(keptAsks).toHaveLength(1);
    expect(keptAsks[0]!.evidence).toEqual(composite);
  });

  /**
   * A PROMOTED KIND IS ADMITTED ONLY WHERE IT WAS MEASURED (fable-525 §3c).
   *
   * Horns was promoted on 2026-08-14 off four courts, every one of them run on
   * the repaint road. The old paste road has never grown a horn and nothing has
   * ever measured whether it can, so an ask that names one there refuses free.
   *
   * Both arms are driven, because the interesting half is the one that must NOT
   * refuse: a gate that says no to everybody would pass a one-armed test and
   * would have quietly taken the founder's own new kind away from him.
   */
  it("does not carry a crop the chain no longer asks for (V3(c) step 2, at the wire)", async () => {
    /*
      The state a prune leaves behind, built directly: the branch holds an
      earring crop minted by an earlier render, and the surviving chain says
      nothing about earrings. The derivation is unit-driven in
      `prunedCarries.test.ts`; this is the one assertion that it is CONNECTED —
      a filter nobody calls is a filter that does not exist.
    */
    lineageReferences = [
      carryRow({
        id: 9, publicId: "ref-9", slot: "earring@left", tier: "item", noun: "left earring",
        words: ["gold hoops"], storageKey: "casting-v2/library/earring-left.png", variantId: 5,
      }),
      carryRow({
        id: 10, publicId: "ref-10", slot: "lips", tier: "anatomy", noun: "lips",
        words: ["a fuller cupid's bow"], storageKey: "casting-v2/library/lips.png", variantId: 5,
      }),
    ];
    variantRows = [{
      id: 701,
      publicId: "variant-pruned",
      candidateId: 1,
      imageKey: "casting-v2/variants/pruned.png",
      internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
      /* The earrings step is GONE; her lips step survives. */
      instructions: ["a fuller cupid's bow"],
      deltas: { free: { lips: "a fuller cupid's bow" } },
      stepDeltas: [{ free: { lips: "a fuller cupid's bow" } }],
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-pruned";

    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    const request = painted[0]!;
    const bytes = request.references.map((reference) => String(reference.bytes));
    /* Her lips still ride — the chain still names them. */
    expect(bytes.some((one) => one.includes("lips"))).toBe(true);
    /* Her earrings do not: nothing in the surviving chain asks for them. */
    expect(bytes.some((one) => one.includes("earring"))).toBe(false);
  });

  /*
    THE OPEN LANE'S CARRY/EDIT SPLIT, AT THE WIRE (D-244, ruled fable-909 §1).

    The unit arms are in `repaintAsks.test.ts`; this is the one place the split
    is proved on the request the painter was HANDED. It exists because of this
    campaign's most expensive shape — a suite asserting one road while the
    founder is on another — and because the defect it closes was invisible from
    inside the ask builder: the crop was minted, the recipe was assembled, the
    render landed, and the paid crop simply never reached the array.

    Both directions, on ONE fixture, because a split has two sides and a guard
    that answered the same way to both would pass either arm alone.
  */
  /*
    A DELIVERED TATTOO SURVIVES THE NEXT EDIT — clause (a) AT THE WIRE
    (ruled fable-1165 §2a, conditions fable-1167 §2).

    The unit arms one module along prove the record composes and the recipe can
    carry it. Neither of them can prove the WIRE, and the wire is where this
    campaign has twice found a rule with six arms and no caller: the carry only
    exists if the design reaches `painted[0].references` on a render whose
    sentence says nothing about ink.

    The measured failure it replaces: step one painted a chest piece, step two
    was "give him green eyes", and the dispatch record held the master and a
    hair crop — no ink reference, no ink clause (opus-864 §1).
  */
  describe("a design she already has rides the next unrelated edit", () => {
    const DESIGN_KEY = "casting-v2/ink/design.png";
    const DESIGN_ID = "6c66a44f-ccbc-46eb-aa7b-1cf86be8f859";
    /* The digest of the bytes the harness will actually serve for that key.
       Computed rather than typed, because `repaintRender` refuses a reference
       whose loaded bytes do not hash to the sha the recipe named — so a
       hand-written digest would make this arm prove the refusal instead. */
    const designDigest = createHash("sha256").update(Buffer.from(`crop:${DESIGN_KEY}`)).digest("hex");

    const designRow = (over: Partial<StoredInkDesign> = {}): StoredInkDesign => ({
      publicId: DESIGN_ID,
      candidateId: 1,
      placement: "upperChest",
      side: "centre",
      provenance: "consented",
      intents: ["tattoo"],
      storageKey: DESIGN_KEY,
      cutRoute: "rideWhole",
      sourceDigest: null,
      digest: designDigest,
      mime: "image/png",
      byteSize: 64,
      width: 512,
      height: 512,
      createdAt: new Date("2026-08-20T08:33:04Z"),
      ...over,
    });

    /** The branch a paid ink render left behind: her words, and OUR pointer. */
    /* `null` rather than `undefined` for "nothing applied", because a default
       parameter swallows an explicitly passed `undefined` — which is how the
       negative control below first passed as a positive one. */
    const wearingTheDesign = (applied: Record<string, string> | null = { "ink:upperChest": DESIGN_ID }) => {
      const delta = {
        free: { ink: ["the tattoo design in the attached picture on her upper chest"] },
        ...(applied ? { inkApplied: applied } : {}),
      };
      variantRows = [{
        id: 703,
        publicId: "variant-ink",
        candidateId: 1,
        imageKey: "casting-v2/variants/ink.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: ["use this tattoo design on her upper chest"],
        deltas: delta,
        stepDeltas: [delta],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-ink";
    };

    const withDesigns = (rows: readonly StoredInkDesign[]) => ({
      ...hairDown,
      listInkDesigns: async () => rows,
    });

    const dispatched = () => dispatchRecords[0]!.repaint as {
      references: Array<{ kind: string | null; slot: string | null; digest: string | null }>;
      edited: string[];
      carried: string[];
    };

    it("puts the DESIGN on the wire on a render that never mentions ink", async () => {
      wearingTheDesign();

      await refineCandidate(withDesigns([designRow()]), { ...input, instruction: "wear her hair down" });

      expect(painted[0]!.references.map((reference) => String(reference.bytes)))
        .toContain(`crop:${DESIGN_KEY}`);
      expect(dispatched().references.map((reference) => [reference.kind, reference.slot]))
        .toEqual([["master", null], ["carry", "ink:upperChest"]]);
      /* CARRIED, so the verification has a question about it — a picture
         riding uncounted is delivered unverified on the fact it exists to keep. */
      expect(dispatched().carried).toContain("ink:upperChest");
      expect(dispatched().edited).not.toContain("ink:upperChest");
      /* Said as what it IS, and said to be already there. */
      expect(painted[0]!.prompt).toContain("the exact upper chest tattoo she already has");
      expect(painted[0]!.prompt).toContain("artwork alone on a transparent background");
    });

    it("carries nothing when the branch never applied one — the negative control", async () => {
      /*
        THE ARM THAT MAKES THE ONE ABOVE MEAN SOMETHING. Same rows on the Cast,
        same ask, and the branch's own record is the only difference: a design
        a customer merely uploaded, or one minted for a cut she then declined,
        must never be painted onto an edit she did not ask for.
      */
      wearingTheDesign(null);

      await refineCandidate(withDesigns([designRow()]), { ...input, instruction: "wear her hair down" });

      expect(dispatched().references.map((reference) => reference.slot)).toEqual([null]);
      expect(painted[0]!.prompt).not.toContain("tattoo");
    });

    it("carries nothing when the design row is gone — and says so", async () => {
      /* The per-design delete exists, so this is a real state and not a
         corruption. It stops riding, which is right, and it is LOUD — a tattoo
         that quietly stops existing is the class this build ends. */
      wearingTheDesign();

      await refineCandidate(withDesigns([]), { ...input, instruction: "wear her hair down" });

      expect(dispatched().references.map((reference) => reference.slot)).toEqual([null]);
      expect(logged.some((line) => (
        line.level === "warn"
        && line.message.includes("this render cannot carry it")
        && line.fields.design === DESIGN_ID
      ))).toBe(true);
    });

    it("REFUSES the whole render when the applied row was never examined", async () => {
      /*
        fable-1137 §4 reaching the carry road (condition fable-1167 §2c): the
        row's own disposition is re-checked at assembly, so a forged delta
        naming an unexamined design paints nothing. `null` means nobody looked,
        which on this road means possibly a photograph of a person.
      */
      wearingTheDesign();

      await expect(refineCandidate(
        withDesigns([designRow({ cutRoute: null })]),
        { ...input, instruction: "wear her hair down" },
      )).rejects.toThrow(/didn't come through/);

      /* Nothing was painted, and the money went back — the refund path, which
         is the right shape for a recipe the assembler will not build. */
      expect(painted).toHaveLength(0);
    });
  });

  describe("an open kind the customer is not changing carries by its CROP", () => {
    /** A branch that already asked for fangs, and a library that minted one. */
    const carryingFangs = () => {
      lineageReferences = [carryRow({
        id: 11, publicId: "ref-11", slot: "open:fangs", tier: "anatomy", noun: "fangs",
        /* The MINT's read-back, not the ask's words — so an arm that passed by
           quoting the customer's own sentence back at itself fails here. */
        words: ["long white pointed vampire fangs"],
        storageKey: "casting-v2/library/open-fangs.png", variantId: 5,
      })];
      variantRows = [{
        id: 702,
        publicId: "variant-fangs",
        candidateId: 1,
        imageKey: "casting-v2/variants/fangs.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: ["give her vampire fangs"],
        /* `{ open: … }` with nothing else — the shape an ordinary open ask
           actually persists, and the one wall (d) had to learn to read. */
        deltas: { open: { fangs: { noun: "fangs", words: "vampire fangs" } } },
        stepDeltas: [{ open: { fangs: { noun: "fangs", words: "vampire fangs" } } }],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-fangs";
    };

    const dispatched = () => dispatchRecords[0]!.repaint as {
      references: Array<{ kind: string | null; slot: string | null }>;
      edited: string[];
      carried: string[];
    };

    it("puts the CROP on the wire on a later render that never mentions it", async () => {
      carryingFangs();

      await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

      /* THE FACT C1 WENT LOOKING FOR. Before the split this array held the
         master alone: the kind was re-said, a re-said kind is an edit, and an
         edited slot gives up its crop one line before the recipe is built. */
      expect(painted[0]!.references.map((reference) => String(reference.bytes)))
        .toContain("crop:casting-v2/library/open-fangs.png");
      expect(dispatched().references.map((reference) => [reference.kind, reference.slot]))
        .toEqual([["master", null], ["carry", "open:fangs"]]);
      expect(dispatched().carried).toContain("open:fangs");
      /* And it is a CARRY rather than an edit — the hair is what she changed. */
      expect(dispatched().edited).toEqual(["hair"]);
      /* The words ride beside the crop: an open slot is `anatomy`, and anatomy
         with a bare reference sentence delivered 0 of 5. */
      expect(painted[0]!.prompt).toContain("Reference 2 is the exact fangs she has");
      expect(painted[0]!.prompt)
        .toContain("Keep her fangs exactly: long white pointed vampire fangs.");
    });

    it("and REFUSES that same crop when the customer edits the fangs themselves", async () => {
      /*
        D-244 line 2, at the wire and in the direction that must not move. The
        edit regenerates from the anchor plus the full word stack; handing it a
        photograph of the fangs she is changing is the recipe the law forbids.
      */
      carryingFangs();

      await refineCandidate({
        ...repainting,
        interpret: async () => ({
          ok: true as const,
          delta: { open: { fangs: { noun: "fangs", words: "longer curved fangs" } } },
        }),
      }, { ...input, instruction: "make the fangs longer" });

      expect(painted[0]!.references.map((reference) => String(reference.bytes)))
        .not.toContain("crop:casting-v2/library/open-fangs.png");
      expect(dispatched().references.map((reference) => reference.kind)).toEqual(["master"]);
      expect(dispatched().edited).toContain("open:fangs");
      expect(dispatched().carried).not.toContain("open:fangs");
      /* And her new words DID reach the painter — a render that quietly carried
         nothing and asked nothing would satisfy every line above it. */
      expect(painted[0]!.prompt).toContain("longer curved fangs");
    });

    it("CONTROL — with NO crop minted, the kind is still re-said in words", async () => {
      /*
        Line (c) of the ruling, and the arm that keeps the split from being a
        way to lose a feature. Every open kind on every cast whose library has
        minted nothing is on this road, which is production today.
      */
      carryingFangs();
      lineageReferences = [];

      await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

      expect(dispatched().references.map((reference) => reference.kind)).toEqual(["master"]);
      /* Said as an edit, exactly as it was before crops existed — because words
         are the only carrier there is when there is no crop. */
      expect(dispatched().edited).toContain("open:fangs");
      expect(painted[0]!.prompt).toContain("vampire fangs");
    });
  });

  /*
    AND THE PICTURE IS ASKED WHETHER THE OPEN KIND IS ACTUALLY THERE
    (fable-911 §2 — the presence verifier, at the wire).

    The unit arms are in `openKindPresence.test.ts`; this is the one place the
    question is proved on the request the READER was handed, and it exists for
    this campaign's most expensive shape — a suite asserting one road while the
    founder is on another. Both directions of the carry/edit split ask, because
    the defect class IS a carried feature vanishing.
  */
  describe("an open kind is asked of the delivered frame", () => {
    /** A reader that records every line it was given and finds nothing. */
    const blindReader = () => {
      const asked: string[] = [];
      return {
        asked,
        engine: {
          id: "verifier",
          complete: async (request: { system: string; user: string }) => {
            if (request.system.includes("how they")) {
              return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
            }
            asked.push(request.user);
            const results = request.user.split("\n").filter(Boolean).map((_line, index) => ({
              id: index + 1,
              present: false,
              absent: true,
              saw: "nothing of the sort on her",
            }));
            return { text: JSON.stringify({ results }), truncated: false, latencyMs: 1 };
          },
        } as never,
      };
    };

    /** A branch that already asked for fangs, and a library that minted one. */
    const carryingFangs = () => {
      lineageReferences = [carryRow({
        id: 11, publicId: "ref-11", slot: "open:fangs", tier: "anatomy", noun: "fangs",
        words: ["long white pointed vampire fangs"],
        storageKey: "casting-v2/library/open-fangs.png", variantId: 5,
      })];
      variantRows = [{
        id: 702,
        publicId: "variant-fangs",
        candidateId: 1,
        imageKey: "casting-v2/variants/fangs.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: ["give her vampire fangs"],
        deltas: { open: { fangs: { noun: "fangs", words: "vampire fangs" } } },
        stepDeltas: [{ open: { fangs: { noun: "fangs", words: "vampire fangs" } } }],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-fangs";
    };

    const storedChecks = () => ((landedVariant?.internalPrompt as {
      verification?: { checks?: Array<Record<string, unknown>> };
    }).verification?.checks ?? []);

    it("asks about the CARRIED kind the change clause no longer mentions", async () => {
      /*
        The defect this closes, at its own wire. Since the carry/edit split a
        carried open kind rides by crop and the recipe says nothing about it —
        so a check scoped to what this edit wrote would be blind to exactly the
        thing that goes missing, which is this module's founding sentence one
        lane over.
      */
      carryingFangs();
      const reader = blindReader();

      await refineCandidate(
        { ...hairDown, verifier: reader.engine },
        { ...input, instruction: "wear her hair down" },
      );

      const lines = reader.asked.join("\n").split("\n").filter(Boolean);
      /* Anchored on the WHOLE line rather than a substring: `open:fangs`
         upper-cased ends in "FANGS:" too, so a heading composed from the lossy
         key would satisfy an `includes` — the sabotage arm proved that before
         this assertion was tightened. */
      expect(lines.some((line) => /^\d+\. FANGS: vampire fangs$/.test(line))).toBe(true);
      /* And it is recorded under the SUBJECT, so the report names the kind
         rather than searching the closed vocabulary for it in vain. */
      const fangs = storedChecks().find((check) => check.asked === "vampire fangs");
      expect(fangs?.subject).toEqual({ kind: "open", slot: "open:fangs", noun: "fangs" });
      expect(fangs?.verified).toBe(false);
      expect(fangs?.absent).toBe(true);
    });

    it("records the miss and DELIVERS — record, never refund", async () => {
      /*
        The money half (fable-911 §2 (1)). The reader above says the thing is
        not in the picture AT ALL, which on a binding facet is the one shape
        that refuses. An open kind is unmeasured — no specimen family, no court
        — so it is recorded and nothing is refunded on it.
      */
      carryingFangs();
      const reader = blindReader();

      const result = await refineCandidate(
        { ...hairDown, verifier: reader.engine },
        { ...input, instruction: "wear her hair down" },
      );

      expect(result.imageUrl).toBeTruthy();
      const fangs = storedChecks().find((check) => check.asked === "vampire fangs");
      expect(fangs?.binding).toBe(false);
    });

    it("asks about the kind she is EDITING too, in her own new words", async () => {
      carryingFangs();
      const reader = blindReader();

      await refineCandidate({
        ...repainting,
        verifier: reader.engine,
        interpret: async () => ({
          ok: true as const,
          delta: { open: { fangs: { noun: "fangs", words: "longer curved fangs" } } },
        }),
      }, { ...input, instruction: "make the fangs longer" });

      expect(reader.asked.join("\n")).toContain("FANGS: longer curved fangs");
    });

    it("CONTROL — the road that never says it does not ask about it either", async () => {
      /*
        The aim of the gate, driven. `delta.open` reaches the painter through
        the repaint recipe and nothing else, so asking a reader about fangs the
        paste road never mentioned would manufacture a miss on every frame and
        file it against the kind. A gate that asked on both roads would pass
        every test above.
      */
      carryingFangs();
      const reader = blindReader();

      await refineCandidate(
        { ...hairDown, repaintEnabled: () => false, harvest: compositing, verifier: reader.engine },
        { ...input, instruction: "wear her hair down" },
      );

      expect(reader.asked.join("\n")).not.toContain("FANGS");
      expect(storedChecks().some((check) => check.asked === "vampire fangs")).toBe(false);
      /* And the closed lane is untouched on that road — the negative control
         for the gate's AIM, which is how the misaimed guard was caught twice. */
      expect(reader.asked.join("\n")).toContain("HAIR WORN");
    });
  });

  /**
   * WHAT A PRUNE DOES ON THE REPAINT ROAD — and this block is the RED-FLIP
   * fable-534 asked for, now flipped (V3(c), fable-536 §2).
   *
   * It used to assert the refusal: *"Taking that off isn't something I can do
   * on this face yet"*, charged and refunded, no picture — with a note saying
   * it was written to go red the day pruning was derived. That day is this one,
   * so it now asserts what the pruned render actually does.
   */
  describe("a prune on the repaint road", () => {
    const prunedEarrings = async () => {
      lineageReferences = [
        carryRow({
          id: 9, publicId: "ref-9", slot: "earring@left", tier: "item", noun: "left earring",
          words: ["gold hoops"], storageKey: "casting-v2/library/earring-left.png", variantId: 5,
        }),
        carryRow({
          id: 10, publicId: "ref-10", slot: "lips", tier: "anatomy", noun: "lips",
          words: ["a fuller cupid's bow"], storageKey: "casting-v2/library/lips.png", variantId: 5,
        }),
      ];
      variantRows = [{
        id: 700,
        publicId: "variant-earrings",
        candidateId: 1,
        imageKey: "casting-v2/variants/earrings.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: ["gold hoop earrings", "a fuller cupid's bow"],
        deltas: { free: { statedAccessories: ["gold hoop earrings"], lips: "a fuller cupid's bow" } },
        stepDeltas: [
          { free: { statedAccessories: ["gold hoop earrings"] } },
          { free: { lips: "a fuller cupid's bow" } },
        ],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-earrings";

      let call = 0;
      return refineCandidate(
        {
          ...repainting,
          /* The base has NO earrings, so the chain put them there and a prune is
             the honest reading — the arbitration the post-run-7 guard requires
             before it will undo anything. */
          regions: {
            region: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }),
            subject: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }),
            landmark: async () => [],
          } as never,
          interpret: (async () => {
            call += 1;
            return call === 1
              ? { ok: true as const, intent: "remove" as const, subject: "statedAccessories", match: "gold hoop earrings" }
              : { ok: true as const, delta: { free: { lips: "a fuller cupid's bow" } } };
          }) as never,
        },
        { ...input, instruction: "take the earrings off" },
      );
    };

    it("paints her without them, and carries no crop of the thing taken back", async () => {
      const result = await prunedEarrings();

      expect(result.imageUrl).toBeTruthy();
      expect(painted).toHaveLength(1);
      const bytes = painted[0]!.references.map((reference) => String(reference.bytes));
      /* Her lips still ride — that step survived the prune. */
      expect(bytes.some((one) => one.includes("lips"))).toBe(true);
      /* Her earrings do not: the ask was taken back, so the crop stopped
         riding and the master — which never had them — does the removing. */
      expect(bytes.some((one) => one.includes("earring"))).toBe(false);
    });

    it("names what it took back, so the verification has a question at the wire", async () => {
      /*
        The reason the ask exists at all (fable-536 §2). A prune arriving as an
        ABSENCE of asks would ship unverified on precisely the fact it exists to
        change.
      */
      await prunedEarrings();
      const recipe = (landedVariant?.internalPrompt as { repaint?: { restated?: string[] } })?.repaint;
      expect(recipe?.restated ?? []).toContain("earring@left");
    });

    it("CONTROL — a prune that names nothing still meets the old refusal", async () => {
      /*
        The lift is a NARROWING, not an opening (fable-536 §3). With no words to
        name what left, there is no question to verify and no honest recipe, so
        the road refuses exactly as it did before — driven, because a lift that
        quietly widened would be indistinguishable from this one.
      */
      variantRows = [{
        id: 702,
        publicId: "variant-nameless",
        candidateId: 1,
        imageKey: "casting-v2/variants/nameless.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: ["gold hoop earrings"],
        deltas: { free: { statedAccessories: ["gold hoop earrings"] } },
        stepDeltas: [{ free: { statedAccessories: ["gold hoop earrings"] } }],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-nameless";

      let call = 0;
      await expect(refineCandidate(
        {
          ...repainting,
          regions: {
            region: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }),
            subject: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }),
            landmark: async () => [],
          } as never,
          interpret: (async () => {
            call += 1;
            /* A removal with no `match`: the parse names a subject and nothing
               else, which is the shape that deletes whole steps. */
            return call === 1
              ? { ok: true as const, intent: "remove" as const, subject: "statedAccessories" }
              : { ok: true as const, delta: {} };
          }) as never,
        },
        { ...input, instruction: "take those off" },
      )).rejects.toThrow();
      expect(painted).toHaveLength(0);
    });

    it("KEEPS SAYING the standing presentation fact — a prune must not take her smile", async () => {
      /*
        THE SMILE LASTS UNTIL THE FIRST PRUNE — found by the step-4 sweep
        (opus-569 §2), driven here before it was fixed.

        A presentation fact has no library row anywhere: the composed recipe is
        the ONLY place it is written down, and every render anchors on the
        pristine master, so a recipe that goes quiet about her expression paints
        the master's face back. `repaintAsksFor` re-says it from
        `restore.state` on every ordinary render — and the PRUNE road built its
        asks with `delta: {}` and no `restore` at all, four lines below the
        recomposed chain it needed.

        So: ask for a smile, ask for earrings, take the earrings back — and the
        render that removes the earrings also removes the smile, silently, from
        a customer who paid for it. The build-lost class on the one channel with
        nothing to fall back on.

        Driven through the real service to the WIRE, because the defect is at
        the call site rather than at the door: the door has been re-saying it
        correctly all along.
      */
      lineageReferences = [
        carryRow({
          id: 9, publicId: "ref-9", slot: "earring@left", tier: "item", noun: "left earring",
          words: ["gold hoops"], storageKey: "casting-v2/library/earring-left.png", variantId: 5,
        }),
      ];
      variantRows = [{
        id: 703,
        publicId: "variant-smiling",
        candidateId: 1,
        imageKey: "casting-v2/variants/smiling.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: ["a soft, closed-mouth smile", "gold hoop earrings"],
        deltas: {
          free: { expression: "a soft, closed-mouth smile", statedAccessories: ["gold hoop earrings"] },
        },
        stepDeltas: [
          { free: { expression: "a soft, closed-mouth smile" } },
          { free: { statedAccessories: ["gold hoop earrings"] } },
        ],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-smiling";

      let call = 0;
      await refineCandidate(
        {
          ...repainting,
          regions: {
            region: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }),
            subject: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }),
            landmark: async () => [],
          } as never,
          interpret: (async () => {
            call += 1;
            return call === 1
              ? { ok: true as const, intent: "remove" as const, subject: "statedAccessories", match: "gold hoop earrings" }
              : { ok: true as const, delta: { free: { lips: "a fuller cupid's bow" } } };
          }) as never,
        },
        { ...input, instruction: "take the earrings off" },
      );

      expect(painted).toHaveLength(1);
      expect(
        painted[0]!.prompt,
        "the prune's recipe still asks for the smile the branch is carrying",
      ).toContain("her expression: a soft, closed-mouth smile");
    });
  });

  /**
   * THE STEP SHE POINTED AT — the chip's own remove, server half
   * (V3(c), `V3C_CHIP_SURFACE_NOTE.md`).
   *
   * A click is not a sentence. These drive what that buys: the interpreter is
   * never asked, the matcher is never run, and a stale click refuses instead of
   * pruning a step nobody chose.
   */
  describe("a prune she pointed at", () => {
    const twoSteps = () => {
      lineageReferences = [
        carryRow({
          id: 9, publicId: "ref-9", slot: "earring@left", tier: "item", noun: "left earring",
          words: ["gold hoops"], storageKey: "casting-v2/library/earring-left.png", variantId: 5,
        }),
      ];
      variantRows = [{
        id: 710,
        publicId: "variant-two",
        candidateId: 1,
        imageKey: "casting-v2/variants/two.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: ["gold hoop earrings", "colour her hair copper"],
        deltas: { free: { statedAccessories: ["gold hoop earrings"], hairShade: "copper" } },
        stepDeltas: [
          { free: { statedAccessories: ["gold hoop earrings"] } },
          { free: { hairShade: "copper" } },
        ],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-two";
    };

    it("prunes THAT step without asking the interpreter or the matcher", async () => {
      twoSteps();
      let interpretations = 0;
      const result = await refineCandidate(
        {
          ...repainting,
          interpret: (async () => {
            interpretations += 1;
            return { ok: true as const, delta: {} };
          }) as never,
        },
        {
          ...input,
          instruction: "",
          removeStep: { at: 0, instruction: "gold hoop earrings" },
        },
      );

      expect(interpretations, "a click is not a sentence").toBe(0);
      expect(result.imageUrl).toBeTruthy();
      /* The surviving step is still in the record, and the pruned one is gone —
         read off the CLAIM, which is where the instruction list is written. */
      const variants = await import("../db/castingV2Variants");
      const claimed = (variants.claimVariant as any).mock.calls.at(-1)?.[0];
      expect(claimed?.instructions).toEqual(["colour her hair copper"]);
      /* And its crop stopped riding, which is the derivation doing the work. */
      const bytes = painted[0]!.references.map((reference) => String(reference.bytes));
      expect(bytes.some((one) => one.includes("earring"))).toBe(false);
    });

    it("refuses a STALE click rather than pruning the step that moved into place", async () => {
      /*
        She clicked while another edit landed. The index still exists and now
        means a different step — the one shape where a pointed prune could take
        something nobody chose, and the reason the sentence travels with the
        index at all.
      */
      twoSteps();
      await expect(refineCandidate(
        { ...repainting },
        {
          ...input,
          instruction: "",
          removeStep: { at: 0, instruction: "a fuller cupid's bow" },
        },
      )).rejects.toThrow(/that step has moved/i);
      expect(ledger.charges).toHaveLength(0);
      expect(painted).toHaveLength(0);
    });

    it("refuses an index the chain does not have", async () => {
      twoSteps();
      await expect(refineCandidate(
        { ...repainting },
        { ...input, instruction: "", removeStep: { at: 7, instruction: "gold hoop earrings" } },
      )).rejects.toThrow(/that step has moved/i);
      expect(ledger.charges).toHaveLength(0);
    });
  });

  describe("what the edit cost, written on the row", () => {
    it("lands a census of the calls this render made", async () => {
      /*
        ASSERT AT THE WIRE, and the reason is a live one: the first real dev
        render after this shipped landed a row with `prompt`, `captions`,
        `seam` and `verification` on it and NO census — the field was written
        where the store could not be seen, so the stopwatch was inert and the
        report said "an unread window" in a voice that sounded like a reading.

        This asserts the field on the object handed to `landVariant`, which is
        the thing that becomes the row.
      */
      const variants = await import("../db/castingV2Variants");
      (variants.landVariant as any).mockClear();

      await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

      const landing = (variants.landVariant as any).mock.calls.at(-1)?.[0];
      const census = landing?.internalPrompt?.census;
      expect(census, "the row carries what the render spent").toBeDefined();
      expect(census.wallMs).toBeGreaterThanOrEqual(0);
      /*
        ZERO CALLS IS THE RIGHT ANSWER HERE and it is worth saying why: this
        fixture's engines are fakes, so the render reaches no transport at all.
        What is on trial in this file is that the FIELD reaches the row from
        inside the store — the transports' own wiring is driven in
        `callCensus.test.ts`, against the shipped OpenRouter engine with the
        network stubbed, and the two together are the claim.
      */
      expect(census.total.calls).toBe(0);
      /* A bill, never a transcript: no prompts, no images, no replies. */
      const fields = new Set(census.calls.flatMap((call: any) => Object.keys(call)));
      expect([...fields].sort()).toEqual(["about", "ms", "ok", "provider", "stage"].filter((key) => fields.has(key)));
    });
  });

  describe("a kind only the repaint road has been measured on", () => {
    const horns = {
      ...repainting,
      interpret: async () => ({ ok: true as const, delta: { free: { horns: "curved ram horns" } } }),
    };

    it("refuses on the OLD road, free, before anything is claimed", async () => {
      await expect(refineCandidate(
        { ...horns, repaintEnabled: () => false, harvest: compositing },
        { ...input, instruction: "give her curved ram horns" },
      )).rejects.toThrow(/can't do that to her yet/i);
    });

    it("is served on the repaint road — the arm that matters", async () => {
      const result = await refineCandidate(horns,
        { ...input, instruction: "give her curved ram horns" });
      expect(result.imageUrl).toBeTruthy();
      /* And it really went through the painter, rather than being answered by
         some earlier free exit that would look identical from out here. */
      expect(painted.length).toBeGreaterThan(0);
    });

    it("CONTROL — an ordinary subject is untouched on the old road", async () => {
      /* The negative control for the guard's AIM. A gate that refused every
         free-lane ask on the old road would pass both tests above and break
         every customer not in the repaint scope — the misaimed-guard class,
         which has cost this program twice. */
      const result = await refineCandidate(
        { ...hairDown, repaintEnabled: () => false, harvest: compositing },
        { ...input, instruction: "wear her hair down" },
      );
      expect(result.imageUrl).toBeTruthy();
    });
  });

  /*
    THE OPEN LANE'S FIRST PAID STEP, ON THE ROAD THE ONLY ARMED USER IS ON.

    `CASTING_OPEN_LANE_SCOPE=users:1` went on 2026-08-17 and its parent is
    `CASTING_REPAINT_SCOPE`, so the one person who can produce a `delta.open`
    is on the REPAINT road and nowhere else. Everything proven about the open
    lane before this arm stopped at the interpreter: the routing bench measured
    which lane an ask lands in, `repaintAsks.test.ts` measures the ask, and the
    wall-(d) arm proves the row survives being re-read. **None of them puts the
    customer's own words on the wire.**

    That gap is this campaign's most expensive shape — a suite asserting one
    road while the founder is on another — so the assertion is on the string the
    painter was HANDED, and it is compared against the dispatch record rather
    than against a second read of the recipe.
  */
  describe("an ask nobody catalogued reaches the paint in the customer's own words", () => {
    const fangs = {
      ...repainting,
      interpret: async () => ({
        ok: true as const,
        delta: { open: { fangs: { noun: "fangs", words: "vampire fangs" } } },
      }),
    };

    it("paints it, and HIS WORDS are in the recipe that was sent", async () => {
      const result = await refineCandidate(fangs,
        { ...input, instruction: "give her vampire fangs" });

      expect(result.imageUrl).toBeTruthy();
      expect(painted.length, "it went through the painter rather than an earlier free exit")
        .toBeGreaterThan(0);

      const record = dispatchRecords[0]!.repaint as { prompt: string };
      /* One string, two places — the recipe that was recorded IS the recipe
         that was painted, which is the only version of this claim that means
         anything (the same discipline the hair-down arm above uses). */
      expect(record.prompt).toBe(painted[0]!.prompt);
      /* AND IT SAYS THE THING. A recipe that renders happily while never
         mentioning fangs is the failure this arm exists for: she is charged,
         she gets a picture, and nothing in it is what she asked for. */
      expect(record.prompt).toContain("vampire fangs");
    });

    it("CONTROL — the words are not there when the ask is not", async () => {
      /*
        Without this the arm above passes on a prompt that happens to contain
        the noun for some unrelated reason, which is the substring trap this
        programme has met on a hex alphabet and on a duration. An ordinary hair
        ask through the same fixtures must NOT carry it.
      */
      await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });
      const record = dispatchRecords[0]!.repaint as { prompt: string };
      expect(record.prompt).not.toContain("vampire fangs");
      expect(record.prompt, "and the control is a real recipe, not an empty string")
        .toContain("Reference 1 is the photograph of this person");
    });
  });

  const mintingLibrary = {
    referenceLibraryEnabled: () => true,
    verifier: {
      id: "verifier",
      complete: async (request: { system: string }) => ({
        text: request.system.includes("how they")
          ? JSON.stringify({ hairWorn: "down" })
          : JSON.stringify({ results: [{ id: 1, present: true, saw: "hair worn down" }] }),
        truncated: false,
        latencyMs: 1,
      }),
    } as never,
  };

  it("tells the library the whole frame was painted", async () => {
    captionsRead = { hairWorn: "worn long and loose" };
    await refineCandidate({ ...hairDown, ...mintingLibrary, harvest: compositing },
      { ...input, instruction: "wear her hair down" });

    expect(mintAsks).toHaveLength(1);
    /* NULL rather than a mask — which the mint reads as `wholeFrame`, and the
       whole frame is exactly what a repaint painted. */
    expect(mintAsks[0]!.applied).toBeNull();
    /*
      AND THE GROUND THE MINT MUST NOW READ FOR ITSELF (chunk 2).
      With no harvest there is no region map, so without this every cuttable
      slot falls to `noRegion` and the library files words on the one road that
      makes crops the carrier.
    */
    expect(mintAsks[0]!.readGround).toBeTypeOf("function");
  });

  it("CONTROL — the same ask on the old road hands the mint the paste's own mask", async () => {
    captionsRead = { hairWorn: "worn long and loose" };
    await refineCandidate({
      ...hairDown, ...mintingLibrary, repaintEnabled: () => false, harvest: compositing,
    }, { ...input, instruction: "wear her hair down" });

    expect(mintAsks).toHaveLength(1);
    expect(mintAsks[0]!.applied).toEqual(composite.applied);
    /* And it is never handed a ground reader, so the live road cannot start
       paying for a vision call it never asked for. Gated on the FLAG, not on
       the absence of evidence — the old road can arrive here with no evidence
       too, and inferring the need from that would spend her credits. */
    expect(mintAsks[0]!.readGround).toBeUndefined();
  });

  it("hands the mint the two reads her BUILD is composed from, on both roads", async () => {
    /*
      ASSERT AT THE WIRE (invariant 7, and this program's own scar tissue: two
      benches passed while the segment store was inert).

      `build` has no segmentation question — no region vocabulary word names a
      body, and D-213 forbids inventing one — so its region is COMPOSED from her
      silhouette and the bottom of her head. Both must be read on the frame the
      user is looking at. The only thing that proves this caller wired them is
      driving the seams the mint was actually handed.

      Not gated on the repaint flag, unlike `readGround`: this is a fix to what
      the LIVE mint writes. Under words alone a delivered build is lost entirely
      on the next edit, 3 faces of 3 (opus-326).
    */
    const asked: string[] = [];
    const blank = () => ({ data: Buffer.alloc(32 * 48, 0), width: 32, height: 48 });
    const reader = {
      region: async ({ name }: { name: string }) => { asked.push(name); return blank(); },
      subject: async () => { asked.push("(subject matte)"); return blank(); },
      landmark: async () => [],
    };
    captionsRead = { hairWorn: "worn long and loose" };
    await refineCandidate(
      { ...hairDown, ...mintingLibrary, harvest: compositing, regions: reader as never },
      { ...input, instruction: "wear her hair down" },
    );

    const composer = mintAsks[0]!.derivedGround!;
    expect(composer).toBeDefined();
    await composer.region({ frame: TINY_MASTER_PNG, question: "face" });
    await composer.subject({ frame: TINY_MASTER_PNG });
    expect(asked).toEqual(["face", "(subject matte)"]);
  });

  it("CONTROL — the old road is handed the composer too", async () => {
    /* The composer is the library's, not the repaint's. A build lost under
       words is lost on whichever road delivered the render. */
    captionsRead = { hairWorn: "worn long and loose" };
    await refineCandidate({
      ...hairDown, ...mintingLibrary, repaintEnabled: () => false, harvest: compositing,
    }, { ...input, instruction: "wear her hair down" });

    expect(mintAsks[0]!.derivedGround).toBeDefined();
    expect(mintAsks[0]!.readGround).toBeUndefined();
  });

  it("hands the mint THE FRAME THIS RENDER WAS PAINTED FROM, so a ruler has two ends", async () => {
    /*
      ASSERTED AT THE WIRE, and this is the assertion the whole grant stands on.

      `deliveryCourt`'s specimens are `master → first body edit`, so an
      adjudication needs the anchor frame's bytes and cannot invent them. The
      mint's own suite proves what it does with an anchor and what it does
      without one; only this line proves the live path hands it one — and a
      library that silently stopped passing it would go on adjudicating nothing
      while every unit test in the mint stayed green. That is the exact shape of
      the two defects this program has already paid for.
    */
    captionsRead = { hairWorn: "worn long and loose" };
    await refineCandidate({
      ...hairDown, ...mintingLibrary, harvest: compositing,
    }, { ...input, instruction: "wear her hair down" });

    expect(mintAsks[0]!.anchorFrame).toBeDefined();
    /* The BASE's bytes — the frame the render was anchored on, never the
       delivered one. A ruler quoted against the wrong pair has no court. */
    expect(mintAsks[0]!.anchorFrame!.bytes).toEqual(TINY_MASTER_PNG);
  });

  it("tells the mint to re-cut her BUILD on a render that earned nothing of it", async () => {
    /*
      THE GATE THIS FEATURE STOOD DARK BEHIND, asserted at the wire.

      Driven live on dev #365 (shift 77): a body edit's two facets earned their
      delivery, `buildSpan` read the narrowing at −10.8%, and the caption reader
      looked at the same delivered frame and refused to write a sentence — *"no
      visible slimming edit"*. With no caption the slot filed nothing, so the
      composer never ran, so her build was never kept, and the next edit
      returned her to the master: 4.0% retained, dead centre of the bench's
      words-only column.

      The discriminator is now the LIBRARY, and only this assertion proves this
      caller passes it. A version that computed `held` and forgot to hand it
      over would leave every unit test green and the feature exactly as dark as
      it was.
    */
    lineageReferences = [carryRow({ slot: "build", tier: "anatomy", noun: "build", words: [] })];
    captionsRead = { hairWorn: "worn long and loose" };
    await refineCandidate({ ...hairDown, ...mintingLibrary, harvest: compositing },
      { ...input, instruction: "wear her hair down" });

    expect(mintAsks).toHaveLength(1);
    expect(mintAsks[0]!.slots.map((slot) => slot.slot)).toContain("build");
  });

  it("CONTROL — a face whose library keeps no build is not asked to cut one", async () => {
    /* The cost is two reads per delivered render, and it is spent only where
       there is something to preserve. A face nobody has body-edited is carried
       by the pristine master every render anchors on. */
    lineageReferences = [];
    captionsRead = { hairWorn: "worn long and loose" };
    await refineCandidate({ ...hairDown, ...mintingLibrary, harvest: compositing },
      { ...input, instruction: "wear her hair down" });

    expect(mintAsks).toHaveLength(1);
    expect(mintAsks[0]!.slots.map((slot) => slot.slot)).not.toContain("build");
  });



  it("refuses a scope it cannot place, before the claim and for free", async () => {
    /*
      fable-444 §3. A scope names the rectangle she clicked. One the catalogue
      does not know must NOT fall through to a whole-face render: she would be
      charged for both eyes having asked for one, and the picture would look
      like a correct render of a different question.

      Asserted on the LEDGER as well as the throw — "free" is a claim about
      money, and a refusal that charges is the defect wearing a refusal's coat.
    */
    const chargesBefore = ledger.charges.length;
    await expect(refineCandidate({ ...repainting, ...greenEyes, harvest: unmasked },
      { ...input, scope: "her left eyebrow-ish" }))
      .rejects.toThrow(/which part of her/i);
    expect(ledger.charges).toHaveLength(chargesBefore);
    expect(painted).toHaveLength(0);
  });

  it("sends ONE eye to the painter when she scoped the ask to one", async () => {
    /*
      The positive control beside the refusal — a door that only ever refuses is
      a door that is simply shut — and the wire assertion at the same time: the
      recipe the painter receives names `eye@left` and never `eye@right`. That
      absence is the whole feature (fable-444, ruling C).
    */
    await refineCandidate({ ...repainting, ...greenEyes, harvest: unmasked },
      { ...input, scope: "eye@left" });

    expect(painted).toHaveLength(1);
    /* Read on the PROMPT the painter receives, in the words it receives them
       in — the slot key is our bookkeeping and never reaches the engine. */
    const recipe = JSON.stringify(painted[0]);
    expect(recipe).toContain("Change only her left eye");
    expect(recipe).not.toContain("right eye");
  });

  /*
    THE CHECKER MUST NOT DISPUTE A DELIVERY IT MISREAD (fable-444 condition 2).

    A scoped render paints one eye and leaves the other as the master had it.
    The whole-face question over that frame — "are her eyes green" — is honestly
    answered NO, and on `eye.colour` that answer is BINDING: the net would
    dispute a delivery the founder asked for and received, spend a free
    re-render, and then refund him for getting what he paid for.

    Asserted on the LINES THE READER RECEIVES, because that is the wire — the
    question is the whole subject here, and a constant near it would prove
    nothing about what was asked.
  */
  const askedLines: string[] = [];
  const watchingVerifier = {
    id: "verifier",
    complete: async (request: { system: string; user: string }) => {
      if (request.system.includes("how they")) {
        return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
      }
      askedLines.push(request.user);
      return {
        text: JSON.stringify({ results: [{ id: 1, present: true, saw: "one green iris" }] }),
        truncated: false,
        latencyMs: 1,
      };
    },
  } as never;

  it("asks the reader about ONE eye when the ask was scoped to one", async () => {
    askedLines.length = 0;
    await refineCandidate({ ...repainting, ...greenEyes, harvest: unmasked, verifier: watchingVerifier },
      { ...input, scope: "eye@left" });

    expect(askedLines).toHaveLength(1);
    /* The side, in her own ontology, and the other one named rather than left
       to be guessed at — a guess about which side is the whole failure mode. */
    expect(askedLines[0]).toContain("HER LEFT EYE ONLY");
    expect(askedLines[0]).toContain("her right eye was deliberately left as it was");
  });

  it("CONTROL — an unscoped ask still asks the whole-face question", async () => {
    /* The inert half, and the discriminator: make the narrowing unconditional
       and this goes red rather than the feature going quietly wrong. */
    askedLines.length = 0;
    await refineCandidate({ ...repainting, ...greenEyes, harvest: unmasked, verifier: watchingVerifier }, input);

    expect(askedLines).toHaveLength(1);
    expect(askedLines[0]).not.toContain("ONLY");
  });

  /*
    AND THE NARROWED QUESTION'S ANSWER IS ON THE RECORD (fable-448 §1).

    The scoped question was bought with a stated trade: it refuses none of the
    correct one-eye renders the whole-face question refuses 1-in-4 of, and it
    waves the WRONG eye through 4 times in 16 — a price that is only right
    while the engine paints the wrong eye 0 times in 32, as the court measured.
    The base rate is therefore load-bearing, and nothing was watching it.

    Not a gate: a gate on the wrong-side arm is the whole-face question back
    under a new name, refusing exactly what this exists to deliver. A line per
    read, disputing or not, so what comes out is a distribution.
  */
  const narrowedLines = () => logged.filter((line) => line.message.includes("a per-side question was put"));

  it("logs the per-side read and what it answered", async () => {
    logged.length = 0;
    await refineCandidate({ ...repainting, ...greenEyes, harvest: unmasked, verifier: watchingVerifier },
      { ...input, scope: "eye@left" });

    const lines = narrowedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fields.askScope).toBe("eye@left");
    expect(lines[0]!.fields.reads).toEqual([
      expect.objectContaining({ slot: "eye@left", from: "ask", read: true, verified: true }),
    ]);
  });

  it("logs it when the read DISPUTES, which is the whole point of watching", async () => {
    /*
      The decay this instrument exists to see: a render that painted the eye she
      did not ask for reads as a scoped question answered NO. If the line rode
      the delivered render only, that is precisely the case it could never
      count — so it is written before the refusal, and the refusal still
      happens.
    */
    logged.length = 0;
    const disputing = {
      id: "verifier",
      complete: async (request: { system: string; user: string }) => {
        if (request.system.includes("how they")) {
          return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
        }
        return {
          text: JSON.stringify({ results: [{ id: 1, present: false, saw: "a brown iris" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;

    /* Written before the delivery rather than before the refusal now — the line
       is about what the READ said, and fable-721 changed only what the read
       costs her. */
    await refineCandidate({ ...repainting, ...greenEyes, harvest: unmasked, verifier: disputing },
      { ...input, scope: "eye@left" });

    const lines = narrowedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fields.reads).toEqual([
      expect.objectContaining({ slot: "eye@left", from: "ask", read: true, verified: false }),
    ]);
  });

  it("CONTROL — a whole-face ask writes no line at all", async () => {
    /* A denominator that counts whole-face renders would drown the thing being
       watched. Make the line unconditional and this goes red. */
    logged.length = 0;
    await refineCandidate({ ...repainting, ...greenEyes, harvest: unmasked, verifier: watchingVerifier }, input);

    expect(narrowedLines()).toHaveLength(0);
  });

  /*
    AND THE NEXT RENDER MUST NOT DISPUTE IT EITHER (fable-444 condition 1, where
    it costs money).

    The narrowing above is keyed on THIS ask's scope, so it ends when the ask
    does. `facts` is built from the COMPOSED delta — every named facet of the
    whole recipe, not only the ones this step wrote — and the composed delta says
    "green eyes" forever, because ruling C put the per-side memory in the library
    and left the axis whole-face. `eye.colour` is a GUARANTEED axis, so its
    carried fact is binding without needing a realization caption.

    So on the very next unrelated edit the reader is asked *"are her eyes green"*
    over a frame with one green eye and one brown one, answers no honestly, and a
    binding miss refuses and refunds a render that delivered exactly what was
    asked. Not once: every later edit on that face, for as long as the chain
    lives. **A per-eye edit would brick the chain it belongs to.**

    The library is the memory, so the library is the instrument: the newest live
    row of a bilateral feature says which instance the last edit of it actually
    touched, and a pair whose rows disagree may not be asked about as one thing.
  */
  it("keeps asking about ONE eye on the NEXT render, off the library rather than the ask", async () => {
    askedLines.length = 0;
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: {
        prompt: "p",
        resolved: {
          sex: "female", ageBand: "30s", energy: "warm",
          heritage: [{ heritage: "Nordic", pct: 100 }],
          realized: { eyeColour: "green", eyeShape: null },
        },
      },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";
    /* What the scoped render left behind: one instance written at version 2,
       the other never written at all. That is divergence, and it is the only
       record of the side that survives the ask. */
    lineageReferences = [carryRow({
      id: 2, publicId: "ref-eye-left", slot: "eye@left", noun: "left eye",
      words: ["green"], storageKey: null, maskKey: null, version: 2,
    })];

    await refineCandidate(
      {
        ...repainting,
        harvest: unmasked,
        verifier: watchingVerifier,
        interpret: async () => ({ ok: true as const, delta: { hairColour: "copper" as const } }),
      },
      { ...input, instruction: "colour her hair copper" },
    );

    expect(askedLines).toHaveLength(1);
    expect(askedLines[0]).toContain("HER LEFT EYE ONLY");
  });

  it("CONTROL — a MATCHED pair is still asked about as one thing", async () => {
    /*
      The discriminator, and the reason the instrument is the library rather
      than "was anything ever scoped": a whole-face green edit files BOTH rows
      at the same version, they agree, and the question stays whole-face. Make
      the narrowing fire on any bilateral facet and this goes red.
    */
    askedLines.length = 0;
    variantRows = [{
      id: 500,
      publicId: "variant-1",
      imageKey: "casting-v2/variants/first.png",
      instructions: ["make her eyes green"],
      deltas: { eyeColour: "green" },
      internalPrompt: {
        prompt: "p",
        resolved: {
          sex: "female", ageBand: "30s", energy: "warm",
          heritage: [{ heritage: "Nordic", pct: 100 }],
          realized: { eyeColour: "green", eyeShape: null },
        },
      },
    }];
    candidateRow.selectedVariantPublicId = "variant-1";
    lineageReferences = [
      carryRow({ id: 2, publicId: "ref-eye-left", slot: "eye@left", noun: "left eye", words: ["green"], storageKey: null, maskKey: null, version: 2 }),
      carryRow({ id: 3, publicId: "ref-eye-right", slot: "eye@right", noun: "right eye", words: ["green"], storageKey: null, maskKey: null, version: 2 }),
    ];

    await refineCandidate(
      {
        ...repainting,
        harvest: unmasked,
        verifier: watchingVerifier,
        interpret: async () => ({ ok: true as const, delta: { hairColour: "copper" as const } }),
      },
      { ...input, instruction: "colour her hair copper" },
    );

    expect(askedLines).toHaveLength(1);
    expect(askedLines[0]).not.toContain("ONLY");
  });

  it("files the LIBRARY on one eye too, not just the painter — ruling C at the wire", async () => {
    /*
      fable-444 chose the reference over the axis: the delta goes on saying
      "green eyes" and the LIBRARY is what remembers that only one of them is
      green. That makes the mint the one place the ruling is load-bearing, and
      the shipped slice narrowed the ask list without narrowing the mint — so a
      scoped render painted ONE eye and filed BOTH, `eye@right` carrying a row
      that asserts a delivery its own recipe never asked for into every later
      render.

      Asserted on the slot list the mint RECEIVES rather than on the line that
      passes it (invariant 5), because the wiring is the half a unit test on
      `mintedSlotsForRender` cannot see.
    */
    captionsRead = { "eye.colour": "A clear green iris" };
    await refineCandidate({ ...repainting, ...greenEyes, ...mintingLibrary, harvest: unmasked },
      { ...input, scope: "eye@left" });

    expect(mintAsks).toHaveLength(1);
    expect(mintAsks[0]!.slots.map((slot) => slot.slot)).toEqual(["eye@left"]);
  });

  it("CONTROL — the same ask unscoped files both eyes", async () => {
    captionsRead = { "eye.colour": "A clear green iris" };
    await refineCandidate({ ...repainting, ...greenEyes, ...mintingLibrary, harvest: unmasked }, input);

    expect(mintAsks).toHaveLength(1);
    expect(mintAsks[0]!.slots.map((slot) => slot.slot)).toEqual(["eye@left", "eye@right"]);
  });

  it("refuses an ask it cannot say declaratively, and gives the money back", async () => {
    /* Makeup has no library slot by ruling (fable-168/201). Painting anyway
       would send a recipe that never mentions what she asked for and charge her
       for the result — the dropped-ask class, one door over from the gate this
       campaign fixed this week. */
    await expect(refineCandidate({
      ...repainting,
      interpret: async () => ({ ok: true as const, delta: { makeup: "a red lip" } }),
    }, { ...input, instruction: "give her a red lip" })).rejects.toThrow();

    expect(painted).toHaveLength(0);
    /*
      AND THE RECEIPT STOPPED CALLING IT A FAILURE. Nothing was rendered and no
      provider was contacted, so "the generation failed" sent support hunting an
      outage that never happened — the misdescribing-receipt class the render/
      composite/segment/removal splits were all made to stop.
    */
    expect(ledger.refunds).toEqual([
      {
        amount: 25,
        description: "Refine refunded — we cannot yet place what this asked for, so nothing was rendered",
      },
    ]);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
    /*
      AND THE ROW SAYS THE SAME THING AS THE RECEIPT (fable-442 ruling 2).

      It recorded `unknown` — the class that means *nobody knows why* — on the
      one door whose entire point is that it knows exactly what went wrong. The
      founder's smile ask went into that bucket, so a named product gap was
      inflating the unknown-failure rate D-236's report reads.
    */
    expect(failedVariant?.failureClass).toBe("cannot_say");
  });

  /*
    AND THE SMILE WALKED OUT OF THAT DOOR (fable-446, the founder's YES).

    *"Make her smile"* met the same refusal until 2026-08-14 — the honest one,
    with the whole 25 back, and still a customer being told the product cannot
    do the simplest thing anyone would ask a photographer for. Expression is
    the first specimen of an ask with no slot to file under: presentation
    rather than identity (D-136), no zone to cut, nothing to carry. It now
    rides the recipe in words.

    Driven end to end rather than at the door, because the claim is that a
    render HAPPENS and is CHARGED FOR — the two things the refusal took away.
  */
  it("paints a smile instead of refunding it, and says so in the recipe", async () => {
    const chargesBefore = ledger.charges.length;
    const refundsBefore = ledger.refunds.length;

    await refineCandidate({
      ...repainting,
      harvest: unmasked,
      interpret: async () => ({ ok: true as const, delta: { free: { expression: "a soft, closed-mouth smile" } } }),
    }, { ...input, instruction: "make her smile" });

    expect(painted).toHaveLength(1);
    /* On the PROMPT the painter receives, in the words it receives them in
       (invariant 5) — the whole defect this door existed to prevent is an
       instruction that never reaches the painter. */
    expect(JSON.stringify(painted[0])).toContain("her expression: a soft, closed-mouth smile");
    expect(ledger.charges.length).toBe(chargesBefore + 1);
    expect(ledger.refunds.length).toBe(refundsBefore);
  });

  /*
    AND THE READER IS ASKED ABOUT IT — the half a slotless fact loses silently.

    `facts` are valued from the resolved identity, and a smile is deliberately
    never written there (D-136). So the fact had no value, dropped out of the
    list, and the render would have been delivered with nobody looking at the
    one thing it was asked to change. Asserted on the LINES THE READER RECEIVES,
    because that is the wire.
  */
  it("asks the reader about the smile it painted", async () => {
    const seen: string[] = [];
    const watching = {
      id: "verifier",
      complete: async (request: { system: string; user: string }) => {
        if (request.system.includes("how they")) {
          return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
        }
        seen.push(request.user);
        return {
          text: JSON.stringify({ results: [{ id: 1, present: true, saw: "a closed-mouth smile" }] }),
          truncated: false,
          latencyMs: 1,
        };
      },
    } as never;

    await refineCandidate({
      ...repainting,
      harvest: unmasked,
      verifier: watching,
      interpret: async () => ({ ok: true as const, delta: { free: { expression: "a soft, closed-mouth smile" } } }),
    }, { ...input, instruction: "make her smile" });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("a soft, closed-mouth smile");
  });

  it("does not REFUSE on the reader's word — expression is a degree ask", async () => {
    /*
      D-246 clean, and honestly rather than optimistically: *"softer"*,
      *"warmer"*, *"more serious"* are a continuum a photograph cannot settle,
      and `FREE_SUBJECT_KIND` classes the whole subject `degree` for it. So a
      reader that disputes the smile is RECORDED and never refunded — the same
      treatment the body and lips rows get, for the same measured reason. The
      day the crisp case earns a specimen of its own, promotion is one table
      entry and this test is the thing that notices.
    */
    const chargesBefore = ledger.charges.length;
    const refundsBefore = ledger.refunds.length;
    const disputing = {
      id: "verifier",
      complete: async (request: { system: string }) => ({
        text: request.system.includes("how they")
          ? JSON.stringify({ hairWorn: "unclear" })
          : JSON.stringify({ results: [{ id: 1, present: false, saw: "a neutral mouth" }] }),
        truncated: false,
        latencyMs: 1,
      }),
    } as never;

    await refineCandidate({
      ...repainting,
      harvest: unmasked,
      verifier: disputing,
      interpret: async () => ({ ok: true as const, delta: { free: { expression: "a soft, closed-mouth smile" } } }),
    }, { ...input, instruction: "make her smile" });

    expect(ledger.charges.length).toBe(chargesBefore + 1);
    expect(ledger.refunds.length).toBe(refundsBefore);
  });

  it("files NOTHING for it — no slot, no crop, nothing a follow could inherit", async () => {
    /*
      The other half of D-136, and the half a library would break quietly: a
      momentary state must not become permanent. The mint files the slots a
      render EDITED, and a presentation clause edits none — so this is the
      promise asserted where the mint is actually asked, not on the type that
      makes it hard to break.
    */
    await refineCandidate({
      ...repainting,
      ...mintingLibrary,
      harvest: unmasked,
      interpret: async () => ({ ok: true as const, delta: { free: { expression: "a soft, closed-mouth smile" } } }),
    }, { ...input, instruction: "make her smile" });

    expect(painted).toHaveLength(1);
    expect(mintAsks.flatMap((ask) => ask.slots)).toEqual([]);
  });

  it("tells her WHY the makeup door refused, in the founder's ruled words", async () => {
    /*
      He asked for a lip gloss TWICE, because the refusal never said why — the
      generic "didn't come through" reads as a malfunction and invites the exact
      retry it cannot serve. The sentence is founder-ruled verbatim (fable-354);
      the leading noun adapts to the ask, and the ask's own words are on the
      delta the refusal was raised about.

      Asserted on the sentence the CUSTOMER receives, thrown out of the service,
      rather than on the helper that composes it — the message only matters if it
      survives the settlement it travels through.
    */
    await expect(refineCandidate({
      ...repainting,
      interpret: async () => ({ ok: true as const, delta: { makeup: "lip gloss" } }),
    }, { ...input, instruction: "give her a lip gloss" }))
      .rejects.toThrow(
        "Lip gloss is makeup, and makeup isn't something I can place yet — "
        + "it's coming. Nothing was charged.",
      );

    /* "Nothing was charged" has to be TRUE, not merely kind. */
    expect(painted).toHaveLength(0);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  it("tells her the ONE-OF-A-PAIR door refused, and names what she can do instead", async () => {
    /*
      The narrowing is granted for PAINT (the per-eye court, 31/32 exact) and
      not for a VACANCY: the only time a per-side vacancy sentence was watched
      it took BOTH sides (opus-275, located to the vacancy sentence by
      opus-342 §3). Rather than ship the shape a court has already seen fail,
      the door refuses — and says why, in the makeup door's ruled voice, with
      the thing she CAN do in the same breath.
    */
    await expect(refineCandidate({
      /* The removal harness — a reader that answers with masks rather than with
         nulls, because that is the reader production has (the fake-reader law,
         and the bug it cost). Only the departed OBJECT differs. */
      ...removing(false),
      interpret: async () => ({
        ok: true as const,
        delta: { absent: { statedAccessories: ["gold hoop earrings"] } },
      }),
    }, { ...input, instruction: "take this earring off", scope: "earring@left" }))
      .rejects.toThrow(
        "Taking just one of a pair off isn't something I can do yet — ask for both and "
        + "they'll come off together. Nothing was charged.",
      );

    /* And "nothing was charged" is arithmetic rather than kindness. */
    expect(painted).toHaveLength(0);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  it("CONTROL — a door beside it says its OWN sentence, never makeup's", async () => {
    /*
      THE ONE THAT MATTERS, RE-ANCHORED TWICE (fable-471 §1).

      `ink` used to refuse through the SAME error class and the same `notASlot`
      reason as makeup, a different facet being the only thing separating them,
      which is what made it the control that proves the makeup wording is
      scoped to the door the founder ruled.

      **On 2026-08-20 it stopped sharing the reason**, and the control got
      stronger rather than weaker: ink now refuses with `unplacedInk` and its
      own sentence, so the two doors are separated by their words as well as by
      their facet. The literal below moved with it — quoting makeup's phrase
      over a door that no longer says it would be an assertion nothing writes,
      which is a guard that cannot fail.

      What changed is the other half: it used to prove that every other door got
      the GENERIC line, and the generic line over a road that knew exactly why it
      refused is what he read as a malfunction. Now the control is that the
      sentence is this door's own and mentions no makeup.
    */
    /*
      RE-ANCHORED A THIRD TIME, 2026-08-21, and the contract STILL did not move
      — it got cheaper for the customer.

      D-137's words-only road now resolves the placement out of her own sentence
      (fable-1192 §1), so "behind her ear" is answered BEFORE the claim instead
      of travelling into it: `unplacedInk`'s own words, said by the pre-claim
      branch that door's docblock always said should be the one she meets.

      So this is `selected` rather than a throw, and the money assertion below
      changed with it — from "charged and refunded, and they match" to NOTHING
      WAS CHARGED AT ALL. Quoting the old shape over the new door would be an
      assertion nothing writes, which is a guard that cannot fail. What the
      control proves is unchanged and is asserted on the sentence: this door
      speaks in its OWN voice, names no makeup, and does not read as a
      malfunction.
    */
    const chargesBefore = ledger.charges.length;
    const result = await refineCandidate({
      ...repainting,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { ink: "a small star tattoo behind her ear" } },
      }),
    }, { ...input, instruction: "give her a small star tattoo behind her ear" });

    expect(result.kind).toBe("selected");
    const said = result.note ?? "";
    expect(said, "the door stopped naming the places she CAN have one")
      .toContain("I need to know where it goes");
    expect(said, "the founder's makeup wording belongs to makeup").not.toContain("makeup");
    expect(said, "and it does not read as a malfunction").not.toContain("didn't come through");
    expect(said, "a free outcome that does not say it is free reads as a silent 25 credits")
      .toContain("Nothing was charged.");

    expect(painted).toHaveLength(0);
    /* Free BEFORE the claim: not a charge and a refund that happen to match —
       no charge was raised at all. */
    expect(ledger.charges.length, "a pre-claim answer took her money").toBe(chargesBefore);
  });

  /*
    HIS EAR, AS A TEST (fable-471 §1) — the specimen that started this.

    He tapped the panel's EARS row and asked for a cauliflower ear. The reading
    filed it as a MARK; the scope said ears; marks have no slot inside an ear;
    and the sentence he read was "That refinement didn't come through."
  */
  it("names the part she pointed at when the reading landed somewhere else", async () => {
    const said = await refineCandidate({
      ...repainting,
      interpret: async () => ({
        ok: true as const,
        delta: { free: { marks: ["cauliflower ear on her left ear"] } },
      }),
    }, { ...input, instruction: "her left ear — has cauliflower ear", scope: "ear@left" })
      .then(() => "", (error: Error) => error.message);

    expect(said).toContain("her left ear");
    expect(said).not.toContain("didn't come through");
    /* And the money is where she left it, which the sentence may only say
       because the refund is recorded. */
    expect(said).toContain("Nothing was charged.");
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  it("refuses a reference whose bytes are not the bytes the library minted", async () => {
    /*
      The pixel-frozen promise, driven through the production caller rather than
      through the module that makes it. A digest mismatch means the library's
      mint and the object in storage have diverged, and painting from the newer
      one would quietly redraw a feature this render promised not to touch.
    */
    lineageReferences = [carryRow({ digest: "deadbeefdeadbeef" })];
    const before = logged.length;

    /* The user is told the spoken sentence, never the internal detail — so the
       claim is proved on the RECORD the service wrote and on the money, which
       is where a digest refusal is actually visible. */
    await expect(refineCandidate(hairDown, { ...input, instruction: "wear her hair down" }))
      .rejects.toThrow(/Your credits have been returned/);
    expect(logged.slice(before).map((entry) => entry.fields.reason))
      .toContain("referenceBytesChanged");

    expect(painted).toHaveLength(0);
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.charges.at(-1)?.amount).toBe(ledger.refunds.at(-1)?.amount);
  });

  it("records WHAT WENT OUT on the row, so the road is a fact and not a log line", async () => {
    /*
      The five-ask proof has to answer "what did this render actually send?" a
      week after it ran, and until this record the only account of it was one
      line on one process's stdout. Asserted against the dispatched request
      rather than against the recipe beside it (working law 5): the keys on the
      row must be the bytes the engine received, in the order it received them.
    */
    lineageReferences = [carryRow()];

    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    const record = (landedVariant?.internalPrompt as {
      repaint?: {
        engineId: string;
        references: Array<{ key: string; digest: string | null; kind: string | null; slot: string | null }>;
        edited: string[];
        carried: string[];
        standing: string[];
      };
    }).repaint;
    expect(record).toBeDefined();
    expect(record!.engineId).toBe("test:repaint");
    expect(record!.references.map((reference) => reference.key)).toEqual([
      "casting-v2/candidates/abc.png",
      "casting-v2/library/lips.png",
    ]);
    expect(record!.references.map((reference) => [reference.kind, reference.slot])).toEqual([
      ["master", null],
      ["carry", "lips"],
    ]);
    /* The row names as many references as the engine was handed — the count the
       report prints, proved against the wire rather than against the recipe. */
    expect(record!.references).toHaveLength(painted[0]!.references.length);
    /*
      Every digest is of the bytes the LIBRARY holds at that position — which on
      this row are also the bytes dispatched, because nothing here is padded.
      The two part company once a carry is fitted to the master's geometry, and
      that is deliberate: the promise being proved is "this feature's minted crop
      has not changed", so the digest is taken before transport touches it.
    */
    record!.references.forEach((reference, at) => {
      expect(reference.digest).toBe(
        createHash("sha256").update(painted[0]!.references[at]!.bytes).digest("hex"),
      );
    });
    expect(record!.edited).toEqual(["hair"]);
    expect(record!.carried).toEqual(["lips"]);
  });

  /** The dispatch record's reference list, with the size each one went out at. */
  const sentGeometries = () => ((landedVariant?.internalPrompt as {
    repaint?: { references: Array<{ sentGeometry: string | null }> };
  }).repaint!.references).map((reference) => reference.sentGeometry);

  it("records the SIZE each reference went out at, so a padded carry is provable", async () => {
    /*
      The carried-crop drift hid for four shifts because the record said WHICH
      crop was sent and never how big it was — so "two references at different
      scales", the measured cause of the founder's head-size complaint, was a
      thing the database could not express.

      Driven through the injection point rather than through sharp: the padding
      itself is proved on real pixels in `referenceFit.test.ts`, and what this
      asserts is the wire — that whatever geometry actually went out reaches the
      row.
    */
    lineageReferences = [carryRow()];

    await refineCandidate({
      ...hairDown,
      fitReference: async ({ reference, frame }) => ({ ...reference, ...frame }),
    }, { ...input, instruction: "wear her hair down" });

    const [master, carry] = sentGeometries();
    expect(master, "the master goes out at its own frame").toMatch(/^\d+x\d+$/);
    expect(carry, "and a padded carry goes out at the SAME frame").toBe(master);
  });

  it("CONTROL — an UNPADDED carry records its own smaller size, so the gap is visible", async () => {
    /*
      THE ONE THAT MATTERS. If the row reported the frame's size regardless of
      what was sent, it would certify every render as padded — including the ones
      that silently were not, which is precisely the blindness this column was
      added to end. A fit that did not happen has to be readable ON THE ROW.
    */
    lineageReferences = [carryRow()];

    await refineCandidate({
      ...hairDown,
      fitReference: async ({ reference, role, frame }) => ({
        ...reference,
        ...(role.kind === "master" ? frame : { width: 484, height: 617 }),
      }),
    }, { ...input, instruction: "wear her hair down" });

    const [master, carry] = sentGeometries();
    expect(carry, "the crop's own size, exactly as #179 sent it").toBe("484x617");
    expect(carry, "and demonstrably NOT the master's").not.toBe(master);
  });

  it("records what it sent BEFORE the engine answers, so a REFUSED render still says", async () => {
    /*
      The five-ask proof's own hole: two renders refused, both refunded
      correctly, and neither left any account of what it had dispatched — which
      were exactly the two anybody needed to inspect. The record is written from
      inside the dispatch now, so the engine falling over cannot take it with it.
    */
    lineageReferences = [carryRow()];
    engineThrows = new Error("the provider fell over");

    await expect(refineCandidate(hairDown, { ...input, instruction: "wear her hair down" }))
      .rejects.toThrow();

    /* No landing happened at all — this is the failing half, by construction. */
    expect(landedVariant).toBeNull();
    expect(dispatchRecords).toHaveLength(1);
    const record = dispatchRecords[0]!.repaint as {
      engineId: string;
      references: Array<{ key: string; kind: string | null; slot: string | null }>;
      edited: string[]; carried: string[];
    };
    expect(record.engineId).toBe("test:repaint");
    expect(record.references.map((reference) => [reference.kind, reference.slot])).toEqual([
      ["master", null],
      ["carry", "lips"],
    ]);
    expect(record.edited).toEqual(["hair"]);
    /* And it says the thing the proof could not answer: whether the recipe
       carried her features or sent the master alone. */
    expect(record.carried).toEqual(["lips"]);
    /* Ordered before the engine, not after it: the journal is the proof. */
    expect(journal.indexOf("record-dispatch")).toBeLessThan(journal.indexOf("repaint"));
    /* The money is untouched by any of this — the refusal still refunds. */
    expect(ledger.refunds).toHaveLength(1);
  });

  it("records the SENTENCE it sent, and the wire is what proves it", async () => {
    /*
      fable-320 §4, and shift 62 is what it cost to be without it: a removal
      refused twice on the paid path while the same recipe took her glasses off
      eight times out of eight off it — and no way to compare the two, because
      the record kept every reference by key and digest and was silent about the
      only other thing in the request. Reconstructing the sentence afterwards
      took three attempts and a control to know which one to believe.

      ASSERTED AT THE WIRE (law 5): the string on the record is compared against
      the string the ENGINE received, captured in the engine double, not against
      the recipe variable that produced both. A record built from a second read
      of the recipe would pass a comparison against the recipe and could still
      be a different string from the one that was painted.
    */
    lineageReferences = [carryRow()];

    await refineCandidate(hairDown, { ...input, instruction: "wear her hair down" });

    const record = dispatchRecords[0]!.repaint as { prompt: string };
    expect(painted).toHaveLength(1);
    expect(record.prompt).toBe(painted[0]!.prompt);
    /* And it is the real thing rather than an empty string agreeing with an
       empty string — the recipe's own sentences are in it. */
    expect(record.prompt).toContain("Reference 1 is the photograph of this person");
    expect(record.prompt).toContain("Change only her hair");
  });

  it("records the sentence on a REFUSED render too — the case it exists for", async () => {
    /*
      A field written only on success is inert for its one caller. Step 5 is the
      specimen: nothing landed, so a landing-time write would have kept nothing
      about the render nobody could explain.
    */
    lineageReferences = [carryRow()];
    engineThrows = new Error("the provider fell over");

    await expect(refineCandidate(hairDown, { ...input, instruction: "wear her hair down" }))
      .rejects.toThrow();

    expect(landedVariant).toBeNull();
    const record = dispatchRecords[0]!.repaint as { prompt: string };
    expect(record.prompt).toContain("Change only her hair");
  });

  it("CONTROL — the OLD road writes no dispatch record either, so the key means one road", async () => {
    lineageReferences = [carryRow()];
    engineThrows = new Error("the provider fell over");

    await expect(refineCandidate({ ...hairDown, repaintEnabled: () => false, harvest: compositing },
      { ...input, instruction: "wear her hair down" })).rejects.toThrow();

    expect(dispatchRecords).toHaveLength(0);
    /* And the run really did reach an engine and fail there, rather than
       stopping somewhere earlier where nothing would have been written anyway. */
    expect(journal).toContain("generate");
    expect(ledger.refunds).toHaveLength(1);
  });

  it("CONTROL — the same ask on the old road leaves no repaint record at all", async () => {
    /*
      The mark is only worth reading if its ABSENCE means something, and an
      absence is evidence only where the fixture could have produced a presence
      — this is the same ask, the same library row, and the same landing, with
      the flag off.
    */
    lineageReferences = [carryRow()];

    await refineCandidate({ ...hairDown, repaintEnabled: () => false, harvest: compositing },
      { ...input, instruction: "wear her hair down" });

    expect((landedVariant?.internalPrompt as { repaint?: unknown }).repaint).toBeUndefined();
    /* And this run is not simply empty: a row DID land, from a render that DID
       happen, on the other road. Without these two lines the assertion above
       would pass just as well against a fixture that never reached the landing
       at all — which is the shape of a control that cannot fail. */
    expect((landedVariant?.internalPrompt as { prompt?: string }).prompt).toBeTruthy();
    expect(journal).toContain("generate");
    expect(painted).toHaveLength(0);
  });

  it("does not exist for anyone the flag has not named", async () => {
    /* The dark control, driven rather than assumed: with the predicate false
       the same ask travels the old road, and the repaint engine is never
       constructed, let alone dispatched to. */
    await refineCandidate({
      ...hairDown,
      repaintEnabled: () => false,
    }, { ...input, instruction: "wear her hair down" });

    expect(painted).toHaveLength(0);
    expect(journal).toContain("generate");
  });

  /*
    A REMOVAL, BOTH ARMS, DRIVEN DIRECTLY (chunk 3,
    `LIBRARY_REMOVAL_DESIGN.md` §4 and §5).

    The founder's own step 5 — "remove her glasses" — refused and refunded on
    the shift-59 walk in 33.2 seconds. Every claim below is a null result in one
    direction, so every one gets a fixture that could have produced the other:
    a reader that finds the thing and a reader that does not, with nothing else
    changed between the arms.
  */
  const removing = (finds: boolean) => ({
    ...repainting,
    /* The base-worn departure D-238 authors in the service, handed straight in
       so the removal arithmetic is not the subject of these tests. */
    interpret: async () => ({
      ok: true as const,
      delta: { absent: { statedAccessories: ["glasses"] } },
    }),
    /*
      THE READER'S REAL CONTRACT, not a convenient one (the fake-reader law).

      This double answered *nothing found* with `null` for four days, and the
      service duly asked `still !== null`. `RegionReader.region` is declared
      `Promise<Mask>`, and `falRegionReader` answers "nothing found" with a
      frame-sized mask of ZEROS — so in production the gate was true on every
      frame and every removal was refused and refunded, while these two arms sat
      green because both of them modelled a reader that does not exist. Driven
      through the real reader on 2026-08-12: a removed frame came back a
      1024×1536 mask at 0.0000% coverage, her master at 1.4095%.

      So the arms are now the two MASKS the real reader can return, and the
      answer is in their pixels rather than in their nullity.
    */
    regions: {
      region: async () => (finds
        /* Covered: 100% of a small mask, well over any floor. */
        ? { data: Buffer.alloc(64 * 64, 255), width: 64, height: 64 }
        /* Nothing found: `emptyLike` — a frame-sized mask holding nothing. */
        : { data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }),
      subject: async () => null,
      landmark: async () => [],
    } as never,
    retireSlot: async (ask: Record<string, unknown>) => {
      retired.push(ask);
      return 1;
    },
    recordRows: async (write: Record<string, unknown>) => {
      recorded.push(write);
      return [];
    },
  });
  const retired: Array<Record<string, unknown>> = [];
  const recorded: Array<Record<string, unknown>> = [];
  beforeEach(() => { retired.length = 0; recorded.length = 0; });

  it("says the absence at the wire, and retires the slot the frame agrees is empty", async () => {
    await refineCandidate(removing(false), { ...input, instruction: "remove her glasses" });

    /* THE SENTENCE. Silence would be an instruction to keep them: the master is
       reference 1 and her glasses are in it. Asserted on the prompt that left
       the building, never on a constant near it. */
    expect(painted).toHaveLength(1);
    expect(painted[0]!.prompt).toContain("no glasses — her face uncovered");
    /* THE RETIREMENT, scoped to this branch rather than to every fork. */
    expect(retired).toHaveLength(1);
    expect(retired[0]!.slot).toBe("glasses");
    expect(retired[0]!.userId).toBe(1);
    /* And the render is a render: delivered, landed, charged once. */
    expect(journal).toContain("land");
    expect(ledger.refunds).toHaveLength(0);
  });

  it("DELIVERS when the thing is still in the frame, and still does not retire the slot", async () => {
    /*
      D-246 (c) read in the mirror, and then read again after fable-721. The only
      thing changed from the test above is the reader's answer; if both arms did
      not move, one of them would be a constant.

      TWO HALVES THAT NOW PART COMPANY, which is why this arm is worth its
      length. The MONEY follows the founder's ruling: a reader saying the glasses
      are still there is an opinion about a healthy picture, so she gets the
      frame and pays for it, with Regenerate as the remedy. The RECORD still
      follows the reading: the slot keeps its reference, because retiring the
      crop of a thing our own instrument says is still on her face would file a
      lie where every later repaint reads from.
    */
    await refineCandidate(removing(true), { ...input, instruction: "remove her glasses" });

    expect(ledger.refunds, "no refund on a reading of a healthy frame").toHaveLength(0);
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(retired, "and the library is not told the glasses are gone").toEqual([]);
    /* And it DOES land now — she has the picture she paid for. */
    expect(journal).toContain("land");
  });

  /*
    AND THE ABSENCE IS PUT ON THE RECORD, which retiring alone does not do
    (migration 0030, fable-326/327).

    Retiring stops the branch carrying her earrings. It does not stop the MASTER
    wearing her glasses, and the master is reference 1 of every render on this
    road. The one-frame removal was proved with pictures — remove, then ask for
    copper hair, and the glasses come back — and this is the row that ends it.
  */
  it("files a VACANCY row so a later render can say the absence again", async () => {
    await refineCandidate(removing(false), { ...input, instruction: "remove her glasses" });

    expect(recorded).toHaveLength(1);
    const rows = (recorded[0]!.rows as Array<Record<string, unknown>>);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe("vacancy");
    expect(rows[0]!.slot).toBe("glasses");
    /* Words and NO crop: nothing pictures an absence. */
    expect(rows[0]!.image).toBeUndefined();
    expect(rows[0]!.words).toEqual(["no glasses — her face uncovered, no frames, no lenses and no rim shadow on her cheeks or brows"]);
    /* The same sentence the wire carried this render — one phrase, one source. */
    expect(painted[0]!.prompt).toContain("no glasses — her face uncovered");
    /* Written against THIS render, so it belongs to this branch and no other. */
    expect(recorded[0]!.userId).toBe(1);
    expect(recorded[0]!.variantId).toBeTruthy();
  });

  /*
    AND WHETHER SHE WILL SEE ANY OF IT, ON THE DELIVERED RESULT (fable-398 §3).

    The reading itself is proved in `invisibleRemoval.test.ts`, against the real
    geometry and with both sabotage arms. What is proved HERE is the only thing
    that file cannot: that the sentence reaches the field the panel reads. The
    dropped-reference confession is why that is a separate claim — it was
    composed, spread into the result and serialized on every likeness ask for
    weeks while `refineOutcomeNote`'s predecessor threw it away, so a note nobody
    asserted at the wire is a note nobody has seen.

    The double must answer TWO different questions differently: the site is empty
    (the removal landed) and her hair is everywhere (nothing can see the site).
    One answer for both would prove whichever one it happened to suit.
  */
  describe("a removal onto a site nothing can see", () => {
    const FRAME = 64;
    /**
     * A reader that answers each question about the delivered frame on its own
     * terms. `sees` names the regions it finds; everything else comes back the
     * frame-sized nothing the real reader returns — including "glasses", which
     * is what makes the removal land in the first place.
     */
    const answering = (sees: readonly string[]) => ({
      ...removing(false),
      regions: {
        region: async (request: { name: string }) => ({
          data: Buffer.alloc(FRAME * FRAME, sees.includes(request.name) ? 255 : 0),
          width: FRAME,
          height: FRAME,
        }),
        subject: async () => null,
        /* Where her eyes are — the landmark model answers even when the
           segmenter cannot, which is the whole of D-226. */
        landmark: async () => [{ x: 0.35, y: 0.4 }, { x: 0.65, y: 0.4 }],
      } as never,
    });

    const deliver = async (sees: readonly string[]) => await refineCandidate(
      answering(sees),
      { ...input, instruction: "remove her glasses" },
    ) as { note?: string };

    it("names her hair on the delivered take, in the cast's own pronoun", async () => {
      /* Her eyes cannot be found and her hair is everywhere: the site is hidden
         and the cause is proven. */
      const result = await deliver(["hair"]);

      /* Delivered and charged — this is not a refusal and says nothing about
         money. She has a picture; what she does not have is a visible change. */
      expect(journal).toContain("land");
      expect(ledger.refunds).toHaveLength(0);
      expect(result.note).toMatch(/eyes are behind (her|his|their) hair/);
      expect(result.note).toMatch(/no longer wearing glasses/);
      expect(result.note).not.toMatch(/charge|credit/i);
    });

    it("falls back to the sentence that claims no cause", async () => {
      /* Nothing can see the site and nothing is provably over it. */
      const result = await deliver([]);

      expect(journal).toContain("land");
      expect(result.note).toMatch(/glasses weren't visible in this shot/);
      expect(result.note).not.toMatch(/behind/);
    });

    /*
      THE ARM THAT COULD HAVE PRODUCED THE OTHER TWO. Everything is identical but
      whether her eyes are in the picture; if this one also spoke, the note would
      be a constant rather than a reading.
    */
    it("stays silent when she can see the site perfectly well", async () => {
      const result = await deliver(["eyes", "hair"]);

      expect(journal).toContain("land");
      expect(result.note).toBeUndefined();
    });
  });

  /*
    AND A PAIR CAN NOW BE RECORDED AT ALL (fable-332).

    An earring removal LANDED and could not be filed: the kind's phrase claims
    both sides, `slotWordsRefusal` refuses that under a per-side slot, and the
    service refused into the refund rather than deliver an absence the library
    would forget one frame later. Each lobe now records its own side.
  */
  /*
    THE FLOOR THE COURT MEASURED, PROVEN TO BE THE ONE THE GATE CONSULTS.

    Invariant 7 wearing its quietest hat: the earring floor was measured,
    written into the catalogue with its provenance, and pinned by its own test —
    and the gate went on comparing hoops to `COVERAGE_BANDS.eyewearFrames`
    (0.4%, measured on GLASSES). The paid acceptance run refused a second time
    with `coverage: 0.00056, faceWearsIt: false`, which is the number the court
    says means WEARING sitting beside the verdict that says bare.

    The double here is the reason the defect survived this file: the removal
    arms answer "found" with a mask at 100% coverage, which clears every floor
    that has ever existed and therefore cannot tell one floor from another. A
    fixture that passes under both the right and the wrong threshold is not
    testing a threshold. So these arms answer with the coverage the REAL
    segmenter returned on the founder's own eight-face roll.
  */
  describe("the gate asks the catalogue's word and the kind's own floor", () => {
    /** A frame-sized mask covering exactly `fraction` of itself. */
    const maskCovering = (fraction: number) => {
      const width = 1000;
      const height = 1000;
      const data = Buffer.alloc(width * height, 0);
      data.fill(255, 0, Math.round(width * height * fraction));
      return { data, width, height };
    };

    /** Every region name the service actually asked for, in order. */
    const asked: string[] = [];

    const wearing = (fraction: number) => ({
      ...removing(false),
      /*
        A REMOVAL PARSE, then the delta — the two-call shape the freckles test
        uses. The record is SILENT about earrings, which is the whole point:
        that is the path where the FACE is asked, and the only path where the
        floor can decide anything.
      */
      interpret: async (request: { mode?: string }) => (request.mode === undefined
        ? { ok: true, intent: "remove", subject: "statedAccessories", match: "earrings" } as never
        : { ok: true, delta: { free: { marks: "no earrings" } } } as never),
      regions: {
        region: async (request: { name: string }) => {
          asked.push(request.name);
          return maskCovering(fraction);
        },
        subject: async () => null,
        landmark: async () => [],
      } as never,
    });

    beforeEach(() => { asked.length = 0; });

    /*
      0.056% is the reading the production segmenter returned for this very
      face (opus-284), and the court's worn band is 0.0404–0.0621% across eight.
      Against the eyewear band this is a bare face; against the kind's own floor
      it is a woman wearing earrings.
    */
    /** The refusal a face wearing them must never receive. */
    const NOTHING_ON_RECORD = /nothing on record to take off/;

    const refusalFor = async (fraction: number) => {
      try {
        await refineCandidate(wearing(fraction), { ...input, instruction: "take her earrings off" });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };

    it("asks the singular the reader's bilateral set is keyed on", async () => {
      await refusalFor(0.00056);
      /*
        Asserted at the WIRE (invariant 5). She typed "earrings"; every region
        question about them must go out as "earring", or the reader answers
        nothing at all and a face plainly wearing them reads as bare.
      */
      expect(asked).not.toContain("earrings");
      expect(asked).toContain("earring");
    });

    /*
      THE ARM THAT CAUGHT MY OWN HALF-FIX.

      The first cut of this describe asserted the wire word and the arithmetic
      and swallowed the outcome — and when I put the eyewear band back into the
      gate to check the red, **all 142 tests still passed**. The word was
      proven, the numbers were proven, and the one claim that matters — that the
      gate CONSULTS the floor — was proven by nothing. That is invariant 7
      reappearing inside the test written for invariant 7.

      So the assertion is the OUTCOME, both ways, one fixture apart: a face at
      the measured worn coverage must not be told there is nothing to take off,
      and a bare one must be.
    */
    it("does not tell a woman wearing earrings there is nothing to take off", async () => {
      /*
        `null` is what a delivered render returns from this helper, and since
        fable-721 that is the ordinary outcome here: a removal the reader
        disputes is charged and delivered rather than refused. The claim is
        unchanged and so is its control below — at the measured worn coverage the
        product must not confess, and at zero it must.
      */
      expect(await refusalFor(0.00056) ?? "").not.toMatch(NOTHING_ON_RECORD);
    });

    it("still says so to a face whose lobes are bare", async () => {
      expect(await refusalFor(0)).toMatch(NOTHING_ON_RECORD);
    });

    it("puts the measured reading on the wearing side of the kind's floor", () => {
      /*
        The arithmetic the gate now runs, driven directly rather than through a
        render — a backstop the model cannot rescue (law 3). Both directions,
        so the assertion cannot pass by the floor being zero.
      */
      const floor = departureFloorFor("earring").floor;
      expect(0.00056).toBeGreaterThan(floor);          // the measured pair
      expect(0.0000).not.toBeGreaterThan(floor);       // a bare lobe
      /* And the reading an UNMEASURED kind gets, where the floor is 0: an
         empty answer must still not read as present. */
      expect(0).not.toBeGreaterThan(departureFloorFor("a thing nobody measured").floor);
      /* And the band it used to be judged against says the opposite. */
      expect(0.00056).toBeLessThan(COVERAGE_BANDS.eyewearFrames.min);
    });
  });

  it("files a vacancy under EACH lobe, in words that lobe is allowed to say", async () => {
    await refineCandidate({
      ...removing(false),
      interpret: async () => ({
        ok: true as const,
        delta: { absent: { statedAccessories: ["earrings"] } },
      }),
    }, { ...input, instruction: "take her earrings off" });

    expect(retired.map((ask) => ask.slot)).toEqual(["earring@left", "earring@right"]);
    const rows = recorded.flatMap((write) => write.rows as Array<Record<string, unknown>>);
    expect(rows.map((row) => row.slot)).toEqual(["earring@left", "earring@right"]);
    expect(rows.map((row) => row.role)).toEqual(["vacancy", "vacancy"]);
    expect(rows.map((row) => (row.words as string[])[0])).toEqual([
      "no earring on her left ear — that earlobe bare, nothing hanging from it",
      "no earring on her right ear — that earlobe bare, nothing hanging from it",
    ]);
    /* The door, asked of what was actually written rather than of a constant:
       these are the rows, and the rule that used to refuse them is the rule
       they now pass. */
    for (const row of rows) {
      expect(slotWordsRefusal(String(row.slot), row.words as string[])).toBeNull();
    }
    /* THE CHANGE CLAUSE IS THE PAIR'S, SAID ONCE — the measured sentence on the
       measured path, read off the prompt that left the building. */
    const pair = "no earrings — both earlobes bare, nothing hanging from either ear";
    expect(painted[0]!.prompt).toContain(pair);
    expect(painted[0]!.prompt.split(pair)).toHaveLength(2);
    expect(painted[0]!.prompt).not.toContain("her left ear");
    /* And it is a delivered render, charged once. */
    expect(journal).toContain("land");
    expect(ledger.refunds).toHaveLength(0);
  });

  it("does NOT file one when the removal did not land", async () => {
    /*
      The row asserts something about a delivered picture: that the thing is
      GONE. Since fable-721 the picture is delivered either way, which makes this
      arm more load-bearing than it was — a library that recorded the absence
      anyway would tell every later render that the glasses she is still visibly
      wearing are gone. Same fixture as the arm above, one reader answer changed.
    */
    await refineCandidate(removing(true), { ...input, instruction: "remove her glasses" });

    expect(recorded).toEqual([]);
  });

  it("CONTROL — an ordinary edit files no vacancy", async () => {
    await refineCandidate({
      ...hairDown,
      /* An empty mask, not null — the reader's real "nothing there" (see the
         note on `removing` above). */
      regions: { region: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }), subject: async () => null, landmark: async () => [] } as never,
    }, { ...input, instruction: "wear her hair down" });

    expect(recorded).toEqual([]);
  });

  it("CONTROL — an ordinary edit retires nothing, however the reader answers", async () => {
    /* Nothing but a vacate may originate a departure. A reader that finds
       nothing on an untouched slot has at least three innocent causes, and a
       library that retired on that signal would delete her earrings because a
       render came out shadowy. Same silent reader as the first arm. */
    await refineCandidate({
      ...hairDown,
      /* An empty mask, not null — the reader's real "nothing there" (see the
         note on `removing` above). */
      regions: { region: async () => ({ data: Buffer.alloc(64 * 64, 0), width: 64, height: 64 }), subject: async () => null, landmark: async () => [] } as never,
    }, { ...input, instruction: "wear her hair down" });

    expect(painted).toHaveLength(1);
    expect(retired).toEqual([]);
    expect(journal).toContain("land");
  });

  /*
    THE WEDGE, DRIVEN — fable-318 R2, and shift 61's walk is the specimen.

    Her step 2 asked for dangly cross earrings and the frame came back with a
    cross on one ear and a plain hoop on the other. The door refused BOTH v2
    crops as disputed, so the branch was left holding two truths about one
    feature: her words said crosses, and the only reference the library could
    send was the hoops it minted a version earlier. Step 3 was *"copper hair"* —
    an unrelated ask — and it carried the hoops, came back without the crosses
    the branch believed she was wearing, and refused TWICE. Her innocent ask ate
    the refund, and the face could not be edited again.

    Both halves are asserted, because either alone is a different defect: the
    contradicting crop must NOT ride, and the feature must still be SAID.
  */
  const earringRow = (side: "left" | "right", over: Record<string, unknown> = {}) => carryRow({
    id: side === "left" ? 11 : 12,
    publicId: `ref-earring-${side}`,
    variantId: 165,
    slot: `earring@${side}`,
    tier: "item",
    noun: `${side} earring`,
    words: ["A gold hoop earring, thick smooth round tube, polished metallic shine"],
    storageKey: `casting-v2/library/earring-${side}-v1.png`,
    version: 1,
    ...over,
  });
  /** v#166's own row: minted, refused at the door, no bytes kept. */
  const disputedRow = (side: "left" | "right") => carryRow({
    id: side === "left" ? 21 : 22,
    publicId: `ref-earring-${side}-v2`,
    variantId: 166,
    slot: `earring@${side}`,
    tier: "item",
    noun: `${side} earring`,
    words: ["A thick gold hoop earring with a smooth, rounded, glossy surface"],
    storageKey: null,
    version: 2,
    refusal: { reason: "disputedDelivery" },
  });

  /** The branch as step 3 found it: wearing crosses, by her own words. */
  const wearingCrosses = () => {
    variantRows = [{
      id: 166,
      publicId: "variant-crosses",
      candidateId: 1,
      imageKey: "casting-v2/variants/crosses.png",
      internalPrompt: candidateRow.internalPrompt,
      instructions: ["dangly cross earrings"],
      deltas: { free: { statedAccessories: ["dangly cross earrings"] } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-crosses";
  };

  /** Delivers the hair and says the earrings are not on her — the reading step
   *  3 actually got, on the frame the stale crop produced. */
  const readerMissingTheEarrings = {
    id: "verifier",
    complete: async (request: { system: string; user: string }) => {
      if (request.system.includes("how they")) {
        return { text: JSON.stringify({ hairWorn: "down" }), truncated: false, latencyMs: 1 };
      }
      const results = request.user.split("\n").filter(Boolean).map((line, index) => (
        /earring|cross/i.test(line)
          ? { id: index + 1, present: false, absent: true, saw: "plain gold hoops, no crosses" }
          : { id: index + 1, present: true, saw: "hair loose past the shoulders" }
      ));
      return { text: JSON.stringify({ results }), truncated: false, latencyMs: 1 };
    },
  } as never;

  it("does not send a crop the branch's own words have moved past, and says the feature instead", async () => {
    wearingCrosses();
    lineageReferences = [
      earringRow("left"), earringRow("right"), disputedRow("left"), disputedRow("right"),
    ];

    await refineCandidate(
      { ...hairDown, verifier: readerMissingTheEarrings },
      { ...input, instruction: "wear her hair down" },
    );

    expect(painted).toHaveLength(1);
    const request = painted[0]!;
    const bytes = request.references.map((reference) => reference.bytes);
    /* The master alone. Neither superseded crop rode — the whole defect. */
    expect(bytes).toEqual([TINY_MASTER_PNG]);
    /*
      AND THE EARRINGS ARE STILL IN THE ROOM. Without this, "do not send the
      contradiction" and "paint her ears bare" are the same test: an ITEM with
      no crop says nothing at all in a recipe, so the master would have taken
      her earrings off.
    */
    expect(request.prompt).toContain("dangly cross earrings");
    expect(request.prompt).toContain("the left earring");
    expect(request.prompt).toContain("the right earring");
  });

  it("and the unrelated ask is still DELIVERED — one undeliverable thing cannot brick the chain", async () => {
    /*
      fable-318's condition on R2, driven through `evidencesDelivery`: the
      crosses have no realization caption, because no render was ever
      corroborated on them. So they are re-said on every render and they bind
      NOTHING — her hair is what she asked for and her hair is what she gets.
    */
    wearingCrosses();
    lineageReferences = [
      earringRow("left"), earringRow("right"), disputedRow("left"), disputedRow("right"),
    ];

    await refineCandidate(
      { ...hairDown, verifier: readerMissingTheEarrings },
      { ...input, instruction: "wear her hair down" },
    );

    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds, "the innocent ask paid for what it got").toHaveLength(0);
  });

  it("CONTROL — and it WOULD refuse if the crosses had ever been delivered", async () => {
    /*
      The arm that makes the one above a reading rather than a driver that never
      refuses. One thing changes: the branch carries a REALIZATION caption for
      the accessories, which `evidencesDelivery` accepts as proof some render was
      once corroborated on them. A feature the store promised and then dropped is
      the store failing, and it still refuses — the fifth-thing bound was only
      ever about asks that NEVER landed.
    */
    wearingCrosses();
    variantRows[0]!.internalPrompt = {
      ...(candidateRow.internalPrompt as Record<string, unknown>),
      captions: { statedAccessories: "gold hoops with dangling cross charms on both ears" },
    };
    lineageReferences = [
      earringRow("left"), earringRow("right"), disputedRow("left"), disputedRow("right"),
    ];

    await refineCandidate(
      { ...hairDown, verifier: readerMissingTheEarrings },
      { ...input, instruction: "wear her hair down" },
    );
    /*
      The difference between this arm and the innocent one above now lives on the
      ROW rather than in the ledger (fable-721): a feature the store promised and
      then dropped still binds — it is asked, and its answer is kept — but a
      reader's opinion of a healthy frame no longer takes her money back. Both
      arms charge 25; only this one records a bound failure.
    */
    expect(ledger.charges.at(-1)?.amount).toBe(25);
    expect(ledger.refunds).toHaveLength(0);
    const landed = JSON.stringify(landedVariant ?? {});
    expect(landed).toContain('"binding":true');
  });

  it("CONTROL — a slot whose newest version DID file its crop carries it exactly as before", async () => {
    /*
      The arm that makes the two above evidence rather than a driver that never
      carries anything: one row changes — the newest version has bytes — and the
      crop rides again.
    */
    wearingCrosses();
    lineageReferences = [
      earringRow("left"), earringRow("right"),
      carryRow({
        id: 21, publicId: "ref-earring-left-v2", variantId: 166,
        slot: "earring@left", tier: "item", noun: "left earring",
        words: ["A gold hoop with a dangling cross charm"],
        storageKey: "casting-v2/library/earring-left-v2.png", version: 2,
      }),
    ];

    await refineCandidate(
      { ...hairDown, verifier: readerMissingTheEarrings },
      { ...input, instruction: "wear her hair down" },
    );

    const bytes = painted[0]!.references.map((reference) => reference.bytes);
    expect(bytes).toContainEqual(Buffer.from("crop:casting-v2/library/earring-left-v2.png"));
    /* And the right ear, whose newest version is still v1, carries v1. */
    expect(bytes).toContainEqual(Buffer.from("crop:casting-v2/library/earring-right-v1.png"));
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
  /**
   * The base reader, in the three answers the REAL one can give.
   *
   * This double used to THROW to mean "found nothing", because that is what
   * `falRegionReader` did before the call started passing `absentIsAnswer`.
   * With the flag, an empty answer comes back as an EMPTY MASK and only
   * transport throws — so a double that still throws for absence models a
   * reader that does not exist, and it would keep the two causes welded
   * together in the one place the fix was meant to separate them.
   *
   * Three modes, because the site now has three outcomes:
   *   "present"      it predates the chain — do not prune a paid step
   *   "absent"       an honest no, WITH A NUMBER (0.0000%) — prune
   *   "unreachable"  transport — fail closed, refuse for free, charge nothing
   */
  const seesInBase = (mode: boolean | "present" | "absent" | "unreachable") => ({
    regions: {
      region: async (request: { name: string; absentIsAnswer?: boolean }) => {
        const answer = mode === true ? "present" : mode === false ? "absent" : mode;
        if (answer === "unreachable") throw new Error("the mask store answered 503");
        const side = 64;
        if (answer === "absent") {
          /*
            THE FLAG IS PART OF THE CONTRACT, and modelling it is the whole
            reason this double can prove anything. `falRegionReader:462` throws
            `the segmenter found no <name> to edit` on an empty answer UNLESS
            the caller passed `absentIsAnswer` — that is the switch between
            "absence arrives as a throw, indistinguishable from a 503" and
            "absence arrives as a mask with a number on it".

            A double that returns an empty mask either way cannot tell those
            apart, which is exactly the thing under test. The first version of
            this did that, and the whole suite went green with the flag deleted
            from the call site.
          */
          if (!request.absentIsAnswer) throw new Error(`the segmenter found no ${request.name} to edit`);
          /* `emptyLike` — a frame-sized mask holding nothing. A reading. */
          return { data: Buffer.alloc(side * side, 0), width: side, height: side };
        }
        /* Well above any floor: a real thing, not a speck. */
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
      /* Her original wore no hoops — the chain put them there, so the base is
         asked and answers no. Stated rather than inherited from a reader that
         could not be reached; see the note on the chain-minus-step test. */
      { ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "hoops" }), ...seesInBase("absent") },
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

  /*
    THE TWO CAUSES, SEPARATED AT THE SOURCE — fable-341's discriminating pair.

    `presentInBase` used to be decided by a `catch`: the reader THREW to mean
    "found nothing", so a fal 500 arrived by the same door as an honest absence
    and both said "the chain put it there", which prunes a step she paid for.
    `absentIsAnswer: true` makes absence a READING (an empty mask, 0.0000%) and
    leaves only transport throwing, so the two now separate themselves before
    any code has to guess.

    Both arms below differ in ONE thing — what the reader does — and they must
    land in different places, or the fold is still there wearing a flag.
  */
  it("prunes on an honest absence, which now arrives as a number", async () => {
    twoStep();
    const result = await refineCandidate(
      { ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "hoops" }), ...seesInBase("absent") },
      { ...input, instruction: "take the hoops off" },
    );
    /* It got a verdict and acted on it. */
    expect(result.kind).toBe("selected");
  });

  it("refuses for free when the segmenter cannot be reached at all", async () => {
    twoStep();
    const refusal = await refineCandidate(
      { ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "hoops" }), ...seesInBase("unreachable") },
      { ...input, instruction: "take the hoops off" },
    ).then(() => null, (error: Error) => error.message);

    /*
      FAIL CLOSED, and say so in her words. The refusal is the point: an
      instrument that cannot answer must not be allowed to delete her work, and
      the charge must not happen either.
    */
    expect(refusal).toMatch(/couldn't check her face/i);
    expect(refusal).toMatch(/nothing was charged/i);
    expect(ledger.charges).toEqual([]);
  });

  it("says nothing was taken off when the match lands on the same steps", async () => {
    /* The genuinely-identical case keeps the old sentence: there is no step to
       name, and inventing one would be worse than the vague line. */
    twoStep();
    const result = await refineCandidate(
      /* Her original wore no hoops — the chain put them there, so the base is
         asked and answers no. Stated rather than inherited from a reader that
         could not be reached; see the note on the chain-minus-step test. */
      { ...asks({ ok: true, intent: "remove", subject: "statedAccessories", match: "hoops" }), ...seesInBase("absent") },
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
      /*
        THE BASE IS ASKED, AND IT SAYS NO — stated, not inherited.

        This used to supply no reader at all, so `defaultRegionReader()` refused
        for want of FAL_KEY and the refusal was read as "not in the base", which
        let the prune proceed. The test passed BECAUSE of the fold it was
        sitting next to: an unreachable segmenter meaning "the chain put it
        there" is exactly what deletes a step somebody paid for. The fixture now
        says what it means — her original wore no smokey eye.
      */
      { ...asks({ ok: true, intent: "remove", subject: "makeup", match: "smokey" }), ...seesInBase("absent") },
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

  /*
    AND ONLY A FACET THIS ASK WROTE (fable-143 §3a, restoring fable-102 §4).

    The rule was always **written ∩ verified**. What was built was "every
    verified, non-carried check" — a different set, because the net checks the
    whole COMPOSED recipe: a facet an earlier step wrote, or a presentation pin
    nobody mentioned, gets read, passes, and banks a segment for an ask that
    never touched it.

    Found on the founder's own face: `ee5d6988` variant 158, asked *"give her
    freckles"*, filed `marks` AND `hairWorn`. The panel then showed one row —
    the hair segment has no delivered value to be named by — so the store was
    keeping pixels the product could not tell him about and he could not undo.
    "From an edit" was a lie about half of what that face kept.

    The reader here affirms EVERYTHING, which is the whole point: the old
    predicate would keep both, so this fixture separates the two rules instead
    of passing on a reader that happened to say no.
  */
  const readerAffirmsEverything = {
    id: "verifier",
    complete: async () => ({
      /* Generous ids: the net numbers its questions, and a fixture that
         answered only the first would prove nothing about the second. */
      text: JSON.stringify({
        results: [1, 2, 3, 4, 5, 6].map((id) => ({ id, present: true, saw: "clearly present in the frame" })),
      }),
      truncated: false,
      latencyMs: 1,
    }),
  } as never;

  /** A predecessor that already wrote `makeup`, so the composed recipe holds a
   *  facet THIS ask does not — the founder's shape, reproduced. */
  const withEarlierMakeupStep = (): void => {
    variantRows = [{
      id: 601,
      publicId: "variant-makeup",
      candidateId: 1,
      imageKey: "casting-v2/variants/makeup.png",
      internalPrompt: candidateRow.internalPrompt,
      instructions: ["add nude lip gloss"],
      deltas: { makeup: "nude lip gloss" },
      stepDeltas: [{ makeup: "nude lip gloss" }],
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-makeup";
  };

  it("keeps the facet THIS ask wrote", async () => {
    withEarlierMakeupStep();
    await refineCandidate(
      { ...freckles, verifier: readerAffirmsEverything },
      { ...input, instruction: "give her freckles" },
    );
    expect(keptAsks).toHaveLength(1);
    expect(keptAsks[0].facets, "the ask's own facet is kept").toContain("marks");
  });

  it("does NOT keep a verified facet an earlier step wrote — the founder's hairWorn row", async () => {
    withEarlierMakeupStep();
    await refineCandidate(
      { ...freckles, verifier: readerAffirmsEverything },
      { ...input, instruction: "give her freckles" },
    );
    expect(keptAsks).toHaveLength(1);
    /*
      `makeup` is in the composed recipe, was READ, and was VERIFIED — every
      condition the old predicate asked for. It is kept only if the rule has
      drifted back to "everything the net affirmed".
    */
    expect(keptAsks[0].facets, "a facet this ask never wrote earns nothing").not.toContain("makeup");
    expect(keptAsks[0].facets, "and nothing else sneaks in either").toEqual(["marks"]);
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

/**
 * WHERE AN ACCESSORY LIVES, DERIVED BY THE SERVICE AND ASSERTED ON THE WIRE.
 *
 * `statedAccessories` is the one facet with no `REGION_OF_FACET` entry and no
 * way to have one — an earring is at the lobe and glasses are at the eyes, so
 * the region depends on the described OBJECT rather than the facet. The
 * placement therefore travels as an override, and the override is the only
 * thing that lets the segment cutter find the corridor the harvest built.
 *
 * Asserted where the service SENDS it, not on a constant beside it. This suite
 * has already learned that lesson twice: the segment store spent a shift inert
 * behind a harness that supplied what the product was supposed to derive, and
 * both benches passed the whole time.
 */
describe("the service says where an accessory lives, from the words in the ask", () => {
  const capturingHarvest = () => {
    const overrides: Array<Record<string, string> | undefined> = [];
    const described: Array<string | undefined> = [];
    return {
      overrides,
      described,
      harvest: async (input: {
        painted: { bytes: Buffer; contentType: string };
        regionOverrides?: Record<string, string>;
        described?: string;
      }) => {
        overrides.push(input.regionOverrides);
        described.push(input.described);
        return {
          bytes: input.painted.bytes,
          contentType: input.painted.contentType,
          outcome: "flag-off" as const,
        };
      },
    };
  };

  it("sends the earring corridor's name for an earring ask", async () => {
    const capture = capturingHarvest();
    await refineCandidate(
      {
        harvest: capture.harvest as never,
        interpret: async () => ({ ok: true as const, delta: { free: { statedAccessories: ["small gold hoops"] } } }),
      },
      { ...input, instruction: "give her small gold hoops" },
    );

    expect(capture.overrides[0]?.statedAccessories).toBe("earring");
    /* And the SAME words placed it — one derivation, or the corridor and its
       name come from two readings of one sentence and drift apart. */
    expect(capture.described[0]).toContain("small gold hoops");
  });

  it("sends the glasses corridor's name for a glasses ask — never the earring one", async () => {
    const capture = capturingHarvest();
    await refineCandidate(
      {
        harvest: capture.harvest as never,
        interpret: async () => ({ ok: true as const, delta: { free: { statedAccessories: ["round tortoiseshell glasses"] } } }),
      },
      { ...input, instruction: "put her in round tortoiseshell glasses" },
    );

    expect(capture.overrides[0]?.statedAccessories).toBe("glasses");
  });

  it("CONTROL — an eye-colour ask sends no accessory placement at all", async () => {
    /* The instrument has to be able to say nothing. An override present on every
       render would file a slab of her ear as jewellery on an edit that never
       mentioned any. */
    const capture = capturingHarvest();
    await refineCandidate({ ...greenEyes, harvest: capture.harvest as never }, input);

    expect(capture.overrides[0]?.statedAccessories).toBeUndefined();
  });
});

/**
 * WHAT THE RENDER TELLS THE LIBRARY — asserted on the call, not near it.
 *
 * The mint itself is proved in `referenceMint.test.ts` and the composition in
 * `mintedSlots.test.ts`. Neither of them can see whether this service ever
 * speaks to either, and that gap is not hypothetical: two benches passed for a
 * week while the segment store was inert, each proving its own half against
 * arguments its harness had handed it.
 */
describe("the render tells the library what it made of her", () => {
  const onFlag = { referenceLibraryEnabled: () => true };
  const readerSees = (saw: string) => ({
    id: "verifier",
    complete: async () => ({
      text: JSON.stringify({ results: [{ id: 1, present: true, saw }] }),
      truncated: false,
      latencyMs: 1,
    }),
  } as never);

  /*
    THE EARRING, WHICH IS THE GAP THIS CALLER WAS BUILT AROUND.

    `statedAccessories` maps to a FAMILY rather than a slot, because the region
    depends on the described object: an earring is at the lobe and glasses are
    at the eyes. So the slot's kind AND its side come from the placement layer,
    and this is the assertion that the caller reaches for it rather than filing
    the facet under its own name.
  */
  it("files a paid earring as two per-side slots, saying the same thing", async () => {
    captionsRead = { statedAccessories: "Dangly gold cross earrings, one in each lobe" };
    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    expect(mintAsks, "the library was told about this render").toHaveLength(1);
    expect(mintAsks[0].slots.map((slot) => slot.slot)).toEqual(["earring@left", "earring@right"]);
    expect(mintAsks[0].slots.map((slot) => slot.frame)).toEqual(["ownSide", "ownSide"]);
    expect(mintAsks[0].slots[0]!.words).toEqual(mintAsks[0].slots[1]!.words);
    expect(mintAsks[0].slots[0]!.words[0]).toContain("cross earrings");
  });

  /**
   * AND THE SPLIT THE HARVEST MADE REACHES THE MINT, with the guard's reader
   * able to ask about one side.
   *
   * Both halves are asserted on the CALL. The mint's own bench proves what it
   * does with a side map, and the reader's proves the split — neither can see
   * whether this service passes one to the other, which is the gap that let two
   * green benches sit over an inert segment store for a week.
   */
  it("passes the harvest's per-side reads on, and a guard that can ask about a side", async () => {
    captionsRead = { statedAccessories: "Dangly gold cross earrings, one in each lobe" };
    const sides = { left: "her left" as unknown, right: "her right" as unknown };
    const sideAsks: Array<string | undefined> = [];

    await refineCandidate(
      {
        ...onFlag,
        /* A harvest that carries the split, as the real one now does. */
        harvest: (async (harvestInput: { painted: { bytes: Buffer; contentType: string } }) => ({
          bytes: harvestInput.painted.bytes,
          contentType: harvestInput.painted.contentType,
          outcome: "flag-off" as const,
          evidence: {
            applied: { data: Buffer.alloc(1), width: 1, height: 1 },
            masterRegions: new Map(),
            masterSideRegions: new Map([["earring", sides]]),
            deliveredSideRegions: new Map([["earring", sides]]),
          },
        })) as never,
        regions: {
          region: async () => ({ data: Buffer.alloc(1), width: 1, height: 1 }),
          regionSides: async ({ name }: { name: string }) => {
            sideAsks.push(name);
            return sides as never;
          },
          subject: async () => ({ data: Buffer.alloc(1), width: 1, height: 1 }),
          landmark: async () => [],
        } as never,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    expect(mintAsks).toHaveLength(1);
    expect(mintAsks[0].masterSideRegions?.get("earring")).toBe(sides);
    expect(mintAsks[0].deliveredSideRegions?.get("earring")).toBe(sides);

    /* And the guard's reader, driven rather than trusted: asked about a side it
       goes to the side reader and returns THAT side, never the union. */
    const answer = await mintAsks[0].read!({
      frame: Buffer.alloc(1),
      question: "earring",
      side: "left",
    });
    expect(sideAsks).toEqual(["earring"]);
    expect(answer).toBe(sides.left);
  });

  it("CONTROL — a reader with no side capability answers nothing rather than the union", async () => {
    captionsRead = { statedAccessories: "Dangly gold cross earrings, one in each lobe" };
    const union = { data: Buffer.alloc(1), width: 1, height: 1 };
    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        /* Production's reader before today, and any stub that has not opted in. */
        regions: {
          region: async () => union,
          subject: async () => union,
          landmark: async () => [],
        } as never,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    const read = mintAsks[0].read!;
    /* Asked whole-frame it still answers — the capability is additive. */
    expect(await read({ frame: Buffer.alloc(1), question: "earring" })).toBe(union);
    /* Asked about ONE side it refuses, and the refusal is what keeps a coverage
       measured against both hoops from becoming the earring kind's specimen. */
    expect(await read({ frame: Buffer.alloc(1), question: "earring", side: "left" })).toBeNull();
  });

  it("hands the mint the digests this branch already holds", async () => {
    captionsRead = { statedAccessories: "Thin gold wire-frame glasses" };
    lineageReferences = [{
      id: 1,
      slot: "glasses",
      role: "carry",
      version: 2,
      digest: "deadbeef",
      retiredAt: null,
      createdAt: new Date("2026-08-10T00:00:00Z"),
    }];

    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("thin gold wire frames"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["thin gold wire-frame glasses"] } },
        }),
      },
      { ...input, instruction: "put her in thin gold wire-frame glasses" },
    );

    expect(mintAsks).toHaveLength(1);
    expect(mintAsks[0].slots.map((slot) => slot.slot)).toEqual(["glasses"]);
    /* Two rows may not hold one fact, and the collision that bit three times in
       production was ACROSS renders — so the check needs what came before. */
    expect(mintAsks[0].knownDigests?.get("glasses")).toBe("deadbeef");
  });

  it("files nothing when the render's read-back left the slot with no words", async () => {
    captionsRead = {};
    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    /* A row with no words asserts only that a feature exists, which the
       catalogue already says for free. */
    expect(mintAsks).toHaveLength(0);
  });

  /**
   * THE DISPUTED FACET — the founding case, driven at the wire (fable-220 §3).
   *
   * `lips`, asked *"a fuller cupid's bow"*, read TRUE and verified FALSE: the
   * reader looked at the delivered frame and said the change is not there. The
   * render is delivered and charged (D-187/D-246), and the only thing that
   * changes is that its crop now gets cut for a human to look at.
   *
   * Both halves are asserted here because only this caller can be wrong about
   * them: that the mint is told, and that permanence is NOT.
   */
  const readerDisputes = (saw: string) => ({
    id: "verifier",
    complete: async () => ({
      text: JSON.stringify({ results: [{ id: 1, present: false, saw }] }),
      truncated: false,
      latencyMs: 1,
    }),
  } as never);

  it("sends a facet its own reader disputed to the LIBRARY and never to permanence", async () => {
    captionsRead = { lips: "Natural, slim, no pronounced fuller cupid's bow visible" };
    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerDisputes("lips appear natural, slim, no pronounced fuller cupid's bow visible"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { lips: ["a fuller cupid's bow"] } },
        }),
      },
      { ...input, instruction: "give her a fuller cupid's bow" },
    );

    expect(mintAsks, "the library was told about the disputed facet").toHaveLength(1);
    expect(mintAsks[0].slots.map((slot) => [slot.slot, slot.disputed ?? false]))
      .toEqual([["lips", true]]);
    /* The words are the read-back of the frame that landed, which is what makes
       the kept crop worth opening: the sentence and the picture disagree with
       the ask in the same direction, or one of them is wrong. */
    expect(mintAsks[0].slots[0]!.words[0]).toContain("no pronounced fuller cupid's bow");

    /* AND THE HALF THAT MUST NOT MOVE. Permanence keeps pixels a render EARNED;
       filing an unverified one would make the loss the truth on the next lineage
       walk, which is the `marks@v2` incident the `earned` gate exists for. */
    expect(keptAsks).toHaveLength(1);
    expect(keptAsks[0]!.facets).toEqual([]);
    expect(keptAsks[0]!.verdict).toBeNull();
  });

  it("CONTROL — the same facet, believed, is unmarked and DOES reach permanence", async () => {
    /* The negative control for the test above: change nothing but the reader's
       answer. If both arms did not move, the marking would be a constant. */
    captionsRead = { lips: "Full, with a pronounced cupid's bow" };
    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("a fuller, more defined cupid's bow"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { lips: ["a fuller cupid's bow"] } },
        }),
      },
      { ...input, instruction: "give her a fuller cupid's bow" },
    );

    expect(mintAsks[0].slots.map((slot) => [slot.slot, slot.disputed ?? false]))
      .toEqual([["lips", false]]);
    expect(keptAsks[0]!.facets).toEqual(["lips"]);
    expect(keptAsks[0]!.verdict).toBe("verified");
  });

  it("CONTROL — with the flag dark it never speaks to the library at all", async () => {
    captionsRead = { statedAccessories: "Dangly gold cross earrings, one in each lobe" };
    await refineCandidate(
      {
        /* No `referenceLibraryEnabled` — production's shape today. */
        harvest: unmasked,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    expect(mintAsks, "a dark deploy mints nothing").toHaveLength(0);
    /* And it does not pay for the digest query either — the flag is read once,
       by the caller, before any of this costs anything. */
    expect(vi.mocked(listLineageReferences)).not.toHaveBeenCalled();
  });

  it("a library failure never takes back the picture she is already looking at", async () => {
    captionsRead = { statedAccessories: "Dangly gold cross earrings, one in each lobe" };
    vi.mocked(listLineageReferences).mockRejectedValueOnce(new Error("the database said no"));

    const result = await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    /* The render landed and was charged for. A bookkeeping failure that
       refunded a picture the engine had already painted is the exact shape this
       try/catch exists for, and it is a synchronous throw that would walk past a
       `.catch()`. It matters more now than it did: this block runs BEFORE the
       landing, so the outer catch is one `throw` away from the whole render. */
    expect(result.kind).toBe("rendered");
    expect(ledger.refunds).toHaveLength(0);
    /* And it landed anyway — the ordering did not make the library a gate. */
    expect(journal).toContain("land");
  });

  /**
   * THE 42-SECOND RACE, DRIVEN OFF THE ORDER RATHER THAN THE CLOCK (fable-307).
   *
   * The live walk's finding: step 2 paid for cross charms, step 3 was claimed 42
   * seconds before step 2's library rows existed, and the repaint carried the
   * OLDER crop — an unrelated ask silently taking back the edit the customer had
   * just paid for. The fold picked newest-by-version correctly; the library it
   * was handed did not yet hold the newer row.
   *
   * The moment that matters is `landVariant`: it flips the row to `ready` and
   * selects it in one transaction, so it is the first instant anyone — a person
   * or the walk's driver — can submit the next ask. The contract is therefore
   * not "the mint happens" but **"the mint has already happened by then"**, and
   * that is what these two observe: the state of the stores AS the landing runs,
   * captured inside the landing itself rather than read off the end.
   */
  it("the library already knows what this render made when the picture becomes visible", async () => {
    captionsRead = { statedAccessories: "Dangly gold cross earrings, one in each lobe" };

    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    expect(atLanding, "the picture landed once").toHaveLength(1);
    /* Read INSIDE the landing: both stores had already been written when the
       row became selectable. An ask submitted in the very next millisecond
       assembles from a library that holds this render's crops. */
    expect(atLanding[0]!.mints).toBe(1);
    expect(atLanding[0]!.segments).toBe(1);
    /* The same fact said the other way, so a future reorder trips on both. */
    expect(journal.indexOf("mint")).toBeLessThan(journal.indexOf("land"));
    expect(journal.indexOf("keep-segments")).toBeLessThan(journal.indexOf("land"));
    /* And the render is still a render — nothing about the ordering changed
       what the customer got. */
    expect(ledger.refunds).toHaveLength(0);
  });

  it("CONTROL — the observer reads the moment, not the end of the run", async () => {
    /*
      The negative control this assertion cannot do without. An observer that
      quietly reported the FINAL state would pass the test above no matter where
      the mint sat, so it has to be shown counting zero somewhere. With the flag
      dark nothing is ever minted, and the count at the landing is 0 — the same
      instrument, the same instant, a different answer.
    */
    captionsRead = { statedAccessories: "Dangly gold cross earrings, one in each lobe" };

    await refineCandidate(
      {
        /* No `referenceLibraryEnabled` — production's shape today. */
        harvest: unmasked,
        verifier: readerSees("dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { statedAccessories: ["dangly cross earrings"] } },
        }),
      },
      { ...input, instruction: "give her dangly cross earrings" },
    );

    expect(atLanding).toHaveLength(1);
    expect(atLanding[0]!.mints).toBe(0);
    expect(mintAsks).toHaveLength(0);
  });
});

/**
 * THE CARRIER A SLOT NEVER GOT, AT THE SERVICE'S OWN WIRE (fable-468 §2).
 *
 * `mintedSlots.test.ts` proves the rule; invariant 7 is why this exists: a
 * control nothing invokes does not exist, and the two inputs the rule needs —
 * the slots still awaiting a carrier, and the facets THIS render's reader
 * confirmed without being asked — are both derived here, in the service, from
 * reads that were already happening.
 */
describe("a later confirmation rescues a refused carrier", () => {
  /** A carry row with a verdict and no pixels — the shape v#184 filed. */
  const refusedBuildRow = {
    id: 9,
    publicId: "ref-build",
    candidateId: 1,
    variantId: 184,
    role: "carry",
    slot: "build",
    tier: "body",
    noun: "build",
    words: [],
    storageKey: null,
    maskKey: null,
    digest: null,
    geometry: null,
    guard: null,
    refusal: { reason: "disputedDelivery" },
    version: 1,
    retiredAt: null,
    createdAt: new Date("2026-08-14T00:21:06Z"),
  };

  /*
    THE MINT ONLY RUNS ON THE REPAINT ROAD, so the road is switched on here —
    the same three dependencies the library cases use, inlined because they are
    defined inside another describe.
  */
  const repaintEngine = () => ({
    id: "test:repaint",
    edit: async (request: { width: number; height: number }) => {
      journal.push("repaint");
      return {
        bytes: Buffer.from("repainted"),
        contentType: "image/png",
        width: request.width,
        height: request.height,
        latencyMs: 10,
        provenance: { provider: "fal" as const, model: "gpt-image-2", providerRef: "req-r" },
      };
    },
  });
  const readBytes = async (key: string) => (key === "casting-v2/candidates/abc.png"
    ? { bytes: TINY_MASTER_PNG, contentType: "image/png" }
    : { bytes: Buffer.from(`crop:${key}`), contentType: "image/png" });
  const onTheRepaintRoad = {
    repaintEnabled: () => true,
    /* The mint runs behind the library's own flag; the road needs both. */
    referenceLibraryEnabled: () => true,
    repaintEngine,
    readBytes,
    harvest: unmasked,
  };

  /** Everything the net asks about is there — the later render's own reading. */
  const confirmsEverything = {
    id: "verifier",
    complete: async (request: { system: string }) => {
      if (request.system.includes("how they")) {
        return { text: JSON.stringify({ hairWorn: "unclear" }), truncated: false, latencyMs: 1 };
      }
      return {
        text: JSON.stringify({
          results: [1, 2, 3, 4].map((id) => ({ id, present: true, saw: "slender arms and torso" })),
        }),
        truncated: false,
        latencyMs: 1,
      };
    },
  } as never;

  beforeEach(() => {
    lineageReferences = [refusedBuildRow];
    /* Her recipe already says her build, so this render CARRIES it and the net
       asks about it — which is what makes a confirmation possible at all. */
    variantRows = [{
      id: 620,
      publicId: "variant-build",
      candidateId: 1,
      imageKey: "casting-v2/variants/build.png",
      internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
      instructions: ["their build — slim super model build"],
      deltas: { free: { build: "slim super model build" } },
      stepDeltas: null,
      status: "ready",
    }];
    candidateRow.selectedVariantPublicId = "variant-build";
    captionsRead = { build: "Slender frame with narrow shoulders and slim arms" };
  });

  it("asks the mint for the build this render did not edit", async () => {
    await refineCandidate(
      {
        ...onTheRepaintRoad,
        verifier: confirmsEverything,
        interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
      },
      input,
    );
    const asked = mintAsks.at(-1)!.slots.map((slot) => slot.slot);
    expect(asked, "the refused carrier is minted on the render that confirms it").toContain("build");
  });

  it("does NOT ask for it when the library already keeps its pixels", async () => {
    /* The control: a slot with a crop is the re-mint pass's business, and this
       row is not awaiting anything. */
    lineageReferences = [{ ...refusedBuildRow, storageKey: "casting-v2/library/build.png", refusal: null }];
    await refineCandidate(
      {
        ...onTheRepaintRoad,
        verifier: confirmsEverything,
        interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
      },
      input,
    );
    const asked = mintAsks.at(-1)!.slots.filter((slot) => slot.slot === "build");
    expect(asked, "filed once, by the pass that already owned it").toHaveLength(1);
  });
});

/**
 * THE TWO-FACET CAPTION FIXTURE — the control this file did not have.
 *
 * Every other caption case here drives ONE facet, so none of them can tell a
 * parallel read-back loop from a serial one: with a single facet both shapes
 * make exactly one call and return exactly the same answers. That gap is why
 * stage 3 of the latency work was written, typechecked, run green and then
 * TAKEN OUT AGAIN — a concurrency change on the paid path whose claim about
 * speed nothing in this repository could check.
 *
 * So the instrument does not measure duration (which would be a race dressed
 * as a test); it asks a question with one answer: **were two read-backs ever
 * in flight at the same moment?** The barrier below opens the instant the
 * second facet ARRIVES, and by a timer if it never does. A serial loop can
 * only ever open it by the timer, because its first call cannot return until
 * the barrier lets go and its second cannot start until the first returns.
 *
 * `openedBy` is therefore the reading, and the single-facet arm is its
 * negative control: the same barrier, the same escape, on a case that cannot
 * overlap even in principle.
 */
describe("two read-backs on one render, and whether they wait for each other", () => {
  const onFlag = { referenceLibraryEnabled: () => true };
  /*
    A TWO-FACET RENDER ASKS THE VERIFIER TWO QUESTIONS, so this answers every
    id it is asked about rather than only the first. The single-result reader
    used elsewhere in this file left the second facet unverified — a property
    of the fixture, not of the loop, and it would have read here as the change
    losing a slot.
  */
  const readerSees = (saw: string) => ({
    id: "verifier",
    complete: async (request: { user?: string }) => ({
      /* One numbered line per fact, exactly as `renderVerification` writes
         them — so the answer covers however many this render asked about. */
      text: JSON.stringify({
        results: Array.from((request.user ?? "1. ").matchAll(/^(\d+)\. /gm))
          .map((match) => ({ id: Number(match[1]), present: true, saw })),
      }),
      truncated: false,
      latencyMs: 1,
    }),
  } as never);

  /**
   * A gate that lets go when `expected` callers are inside it — or, failing
   * that, after `escapeMs`, so a serial loop fails this fixture instead of
   * hanging the suite on it.
   */
  const captionBarrier = (expected: number, escapeMs = 250) => {
    const entered: string[] = [];
    const exited: string[] = [];
    let openedBy: "arrival" | "escape" | "never" = "never";
    let release!: () => void;
    const opened = new Promise<void>((resolve) => { release = resolve; });
    let escape: NodeJS.Timeout | null = null;
    const gate = async (facet: string) => {
      entered.push(facet);
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
      exited.push(facet);
    };
    return {
      gate,
      entered,
      exited,
      openedBy: () => openedBy,
      /* Nothing is left ticking after the test that installed it. */
      done: () => { if (escape) clearTimeout(escape); },
    };
  };

  it("asks for both captions at once — two facets in flight together", async () => {
    const barrier = captionBarrier(2);
    captionGate = barrier.gate;
    captionsRead = {
      lips: "Full, with a pronounced cupid's bow",
      statedAccessories: "Dangly gold cross earrings, one in each lobe",
    };

    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("a fuller cupid's bow, and dangly gold crosses at both lobes"),
        interpret: async () => ({
          ok: true as const,
          delta: {
            free: {
              lips: ["a fuller cupid's bow"],
              statedAccessories: ["dangly cross earrings"],
            },
          },
        }),
      },
      { ...input, instruction: "give her a fuller cupid's bow and dangly cross earrings" },
    );
    barrier.done();

    /* First: the fixture drove what it claims to drive. A one-facet render
       would open the barrier by escape too, and for a reason that has nothing
       to do with the loop's shape. */
    expect(barrier.entered.sort(), "both facets were read back").toEqual(["lips", "statedAccessories"]);
    expect(barrier.openedBy(), "the second read-back began before the first returned")
      .toBe("arrival");
    /* And the answers are unchanged — a faster loop that loses a caption is
       not a faster loop. */
    expect(mintAsks.at(-1)!.slots.map((slot) => slot.slot).sort())
      .toEqual(["earring@left", "earring@right", "lips"]);
  });

  it("CONTROL — one facet cannot overlap, and the same barrier says so", async () => {
    /*
      THE NEGATIVE CONTROL FOR THE INSTRUMENT ABOVE (working law 2).

      Identical barrier, identical escape, a render that writes ONE facet. If
      this arm also read `arrival`, the reading above would be a constant and
      would confirm a parallel loop that was never built — which is precisely
      the failure the single-facet suite already had.
    */
    const barrier = captionBarrier(2);
    captionGate = barrier.gate;
    captionsRead = { lips: "Full, with a pronounced cupid's bow" };

    await refineCandidate(
      {
        ...onFlag,
        harvest: unmasked,
        verifier: readerSees("a fuller cupid's bow"),
        interpret: async () => ({
          ok: true as const,
          delta: { free: { lips: ["a fuller cupid's bow"] } },
        }),
      },
      { ...input, instruction: "give her a fuller cupid's bow" },
    );
    barrier.done();

    expect(barrier.entered, "one facet, one read-back").toEqual(["lips"]);
    expect(barrier.openedBy(), "nothing to overlap with — the barrier times out")
      .toBe("escape");
  });
});

/*
  THE SCOPE DOOR, ASKED ABOUT A KEY THE CATALOGUE IS ABOUT TO LEARN
  (`OPEN_LANE_CARRY_DESIGN.md` §3 test 4, §4 finding 1).

  The open lane synthesizes `open:<noun>` so an uncatalogued kind can carry.
  This door refuses a scope `slotDefinition` cannot resolve — so the moment the
  open branch resolves one, the door stops refusing and an open kind silently
  becomes scopable: *her left one, longer*. Three separate rulings withhold that
  (`ZONE_SCOPE` is `fullFrame`, `bilateralPair` is forbidden until promotion,
  and the one-of-a-pair ask refuses into the refund), and none of them is
  written at this line.

  So this is a CONJUNCTION and not a refusal test. Asserting the refusal alone
  passes today for the wrong reason — the key is unknown — and would go on
  passing right up until the branch lands, which is the one moment it is meant
  to speak. The first expectation fails until the branch exists; after that the
  second is doing real work.
*/
/*
  AND THE VACATE PATH'S OWN DOOR, DRIVEN DIRECTLY (fable-775 §2).

  Both arms, because only one of them proves anything on its own: the open key
  must throw, and the closed keys the loop actually serves must NOT — a guard
  that threw on everything would pass the first arm and take the removal road
  down with it.
*/
describe("an uncatalogued slot never departs through the vacate path", () => {
  it("throws on an open key, loudly, before the paid reading", () => {
    expect(() => assertNotAnUncataloguedDeparture("open:horns" as never))
      .toThrow(/must never reach the vacate path/);
    expect(() => assertNotAnUncataloguedDeparture("open:cat-ears" as never))
      .toThrow(/must never reach the vacate path/);
  });

  /*
    AND ON AN INK KEY, for the same two reasons word for word: a design is an
    addition the master never held, and its slot carries `guardKind: null`
    because ink is never cut for the library — so `departureFloorFor` would hand
    the vacate loop a floor of ZERO, at which any non-empty mask reads as still
    there and the removal is disputed on a number nobody measured.

    Written on the commit that MINTED the namespace rather than left for the
    sitting that first reaches this path, which is working law 7's second half.
  */
  it("throws on an ink key, for the identical zero-floor reason", () => {
    expect(() => assertNotAnUncataloguedDeparture("ink:neck" as never))
      .toThrow(/must never reach the vacate path/);
    expect(() => assertNotAnUncataloguedDeparture("ink:upperArm@left" as never))
      .toThrow(/must never reach the vacate path/);
  });

  it("lets every slot the loop is FOR through untouched", () => {
    for (const slot of ["glasses", "earring@left", "earring@right", "hair"]) {
      expect(() => assertNotAnUncataloguedDeparture(slot as never), slot).not.toThrow();
    }
  });
});

describe("an open kind is never scopable — the door, at the wire", () => {
  it("resolves the open key AND still refuses it as a scope", async () => {
    expect(
      slotDefinition("open:horns" as never),
      "the open branch does not exist yet — this arm is the build's definition of done",
    ).not.toBeNull();

    await expect(refineCandidate({ harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
      } as never,
      { ...input, instruction: "make them longer", scope: "open:horns" as never },
    )).rejects.toThrow(/which part of her/);
  });
});

/*
  AND THE INK LANE IS NOT SCOPABLE EITHER — the same finding, one namespace on.

  The first assertion is the one that makes the second mean anything: the
  catalogue RESOLVES `ink:neck` now, so the door written as *the catalogue
  cannot name it* has stopped answering the question it is being asked. Without
  its own line a design would become scopable through a resolver change nobody
  read as a decision about scoping — the unowned-axis class through the back
  door, which is exactly how the open lane got here.

  Driven at the WIRE rather than on the predicate: the contract is about what
  `refineCandidate` does with a customer's field, and a helper answering
  correctly beside a door that never calls it is the shape this campaign has
  already paid for.
*/
describe("an ink design is never scopable — the door, at the wire", () => {
  it("resolves the ink key AND still refuses it as a scope", async () => {
    expect(
      slotDefinition("ink:neck" as never),
      "the ink branch does not exist yet — this arm is the build's definition of done",
    ).not.toBeNull();

    await expect(refineCandidate({ harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
      } as never,
      { ...input, instruction: "make it bigger", scope: "ink:neck" as never },
    )).rejects.toThrow(/which part of her/);

    await expect(refineCandidate({ harvest: unmasked,
        interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
      } as never,
      { ...input, instruction: "make it bigger", scope: "ink:upperArm@left" as never },
    )).rejects.toThrow(/which part of her/);
  });
});

/**
 * THE DISPATCH SWAP — Landing C (`CASTING_V2_REFINE_DISPATCH_DESIGN.md` §3,
 * countersigned fable-973).
 *
 * A refine is one long-held mutation: the customer's exposure is the
 * operation's own life — median 121 s, p95 276 s, and 1.7% answered past the
 * observed ~305 s gateway wall, where the socket is gone before the answer
 * exists. Behind `CASTING_REFINE_DISPATCH_SCOPE` the paid half returns a
 * receipt the moment the work is genuinely under way and the outcome arrives on
 * the surface like every other durable fact.
 *
 * What these arms hold the swap to, and each is a bound rather than a nicety:
 *
 *   1. flag OFF is today's product, byte for byte — the held path stays
 *      reachable at every moment, so a park mid-item leaves a working thing;
 *   2. the receipt arrives BEFORE the render, proven by holding the render on a
 *      latch the test opens itself — a receipt that merely arrives is a receipt
 *      that might have waited;
 *   3. a background failure lands DURABLY (refund, failed variant) and never as
 *      an unhandled rejection — the catch at the top of detached work;
 *   4. the census is logged at SETTLEMENT and carries the render's own wall
 *      clock, never the receipt's 200 ms (fable-973 §3b). The cost lane is
 *      built on that instrument and a swap that quietly makes every render look
 *      instant would corrupt it in the one direction nobody checks.
 */
describe("the dispatch swap — WHEN the answer arrives, never what is painted", () => {
  /** A paint held open until the test decides to let it finish. */
  const latch = () => {
    let release!: () => void;
    renderGate = new Promise<void>((resolve) => { release = resolve; });
    return { release };
  };

  const censusLines = () =>
    logged.filter((line) => line.message.includes("what this edit cost in calls and seconds"));

  beforeEach(() => {
    /* This suite's logger mock accumulates for the whole file, so the census
       arms count THEIR OWN lines or they read the previous test's render. */
    logged.length = 0;
    process.env.CASTING_V2_SCOPE = "users:1";
  });

  afterEach(() => {
    delete process.env.CASTING_REFINE_DISPATCH_SCOPE;
    delete process.env.CASTING_V2_SCOPE;
  });

  it("holds the request while the flag is off — the picture, on the request, as today", async () => {
    const result = await refineCandidate({ ...greenEyes }, input);

    expect(result.kind, "the delivered picture answers the mutation").toBe("rendered");
    expect(result.variantId).toBeTruthy();
    expect(landedVariant, "and it had already landed when the request answered").not.toBeNull();
    expect(ledger.charges).toHaveLength(1);
  });

  it("answers with a receipt BEFORE the render, and the picture lands afterwards", async () => {
    process.env.CASTING_REFINE_DISPATCH_SCOPE = "users:1";
    const render = latch();

    const result = await refineCandidate({ ...greenEyes }, input);

    /*
      The latch is still shut at this line, so this is not a fast render — it is
      an answer that did not wait for one. The charge is already out, which is
      what makes the receipt honest: the money moved and the work is under way.
    */
    expect(result.kind).toBe("dispatched");
    expect(result.variantId, "the row the panel's pending list already draws").toBeTruthy();
    expect(result.operationId, "and the operation support would be quoted").toBeTruthy();
    expect(landedVariant, "nothing has been painted at the moment of the receipt").toBeNull();
    expect(ledger.charges, "charged once, before the receipt").toHaveLength(1);
    expect(censusLines(), "and the cost line has not been written yet").toHaveLength(0);

    render.release();
    await vi.waitFor(() => expect(landedVariant, "the picture arrives on the rows").not.toBeNull());
    expect(ledger.charges, "and it is still one charge").toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("lands a background failure DURABLY — on the rows, where the surface reads it", async () => {
    process.env.CASTING_REFINE_DISPATCH_SCOPE = "users:1";
    const render = latch();
    const unhandled: unknown[] = [];
    const watch = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", watch);

    try {
      const result = await refineCandidate({ ...greenEyes }, input);
      expect(result.kind).toBe("dispatched");

      engineThrows = new Error("the paint never came back");
      render.release();

      await vi.waitFor(() => expect(ledger.refunds, "the whole charge came back").toHaveLength(1));
      expect(failedVariant, "and the row says so, for the surface to read").not.toBeNull();
      await new Promise((resolve) => setImmediate(resolve));
      /* A belt, not the discriminator: the render's own failure is caught
         INSIDE the attempt and handed back as a value, so this could not fail
         even with every guard deleted. The arm below is the one that can. */
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", watch);
    }
  });

  it("logs the census at SETTLEMENT, carrying the render's wall clock and not the receipt's", async () => {
    process.env.CASTING_REFINE_DISPATCH_SCOPE = "users:1";
    const render = latch();

    const started = Date.now();
    await refineCandidate({ ...greenEyes }, input);
    expect(censusLines(), "nothing is priced while the render is still running").toHaveLength(0);

    await new Promise((resolve) => setTimeout(resolve, 60));
    render.release();
    await vi.waitFor(() => expect(censusLines()).toHaveLength(1));

    const [census] = censusLines();
    expect(census.fields.delivered).toBe(true);
    expect(
      Number(census.fields.wallMs),
      "the wall is the RENDER's, so the cost lane cannot read a dispatched refine as instant",
    ).toBeGreaterThanOrEqual(60);
    expect(Number(census.fields.wallMs)).toBeLessThanOrEqual(Date.now() - started + 50);
  });

  it("WRITES DOWN a settlement that throws — the catch at the top of detached work", async () => {
    /*
      What this arm is for, having been built once against the wrong claim and
      driven until it could fail.
    
      A render that dies is caught INSIDE the attempt and handed back as a
      value, so the detached promise resolves either way — an arm that only
      kills the paint passes with every guard deleted. What can reject that
      promise is the settlement work wrapped around it, and here the cost line
      refuses to be written.
    
      And the rejection is not an unhandled one even then: the receipt arrived
      through `Promise.race`, which has already attached handlers to the same
      promise, so a fault after the race is SILENTLY DISCARDED rather than
      thrown. That is the defect the catch exists to stop — not a crash, a
      disappearance — so this arm asserts the RECORD. Deleting the catch reddens
      it and nothing else.
    */
    process.env.CASTING_REFINE_DISPATCH_SCOPE = "users:1";
    const render = latch();
    const unhandled: unknown[] = [];
    const watch = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", watch);

    try {
      const result = await refineCandidate({ ...greenEyes }, input);
      expect(result.kind).toBe("dispatched");

      costLineThrows = true;
      render.release();

      await vi.waitFor(() => expect(landedVariant, "the picture still landed").not.toBeNull());
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      expect(costLineThrows, "the cost line really did refuse — the arm is driving something").toBe(false);
      const written = logged.filter((line) =>
        line.message.includes("failed outside its own compensation"));
      expect(written, "the fault is on the record rather than lost after the race").toHaveLength(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", watch);
    }
  });
});

/**
 * WHERE A STEP'S WORDS CAME FROM, ASSERTED AT THE WIRE (ruled fable-968 §3).
 *
 * The contract is about what reaches the ROW, so every arm here reads the
 * payload `claimVariant` was actually handed rather than a value near it. And
 * the arms that matter most are the ones where the answer must be `null`: this
 * column exists so that a row cannot lie, and a mechanism that files a
 * provenance whenever it is handed something is not that.
 */
describe("the provenance a refine writes", () => {
  /* The suite's own dependency bundle — a local one lacking `harvest` fails the
     render for a harness reason and every arm below goes red together, which
     says nothing about provenance. */
  const deps = greenEyes;

  async function claimedPayload() {
    const { claimVariant } = await import("../db/castingV2Variants");
    return vi.mocked(claimVariant).mock.calls[0]![0] as unknown as {
      instructions: string[];
      stepProvenance: unknown[];
    };
  }

  /* Minted with the SAME secret the service will verify under, read off the
     module rather than retyped — a token signed with a constant that has since
     drifted would fail for a reason nobody could see. */
  async function mint(over: Record<string, unknown> = {}) {
    const { issueReadToken } = await import("./referenceProvenance");
    const { ENV } = await import("../_core/env");
    return issueReadToken({
      secret: ENV.cookieSecret,
      userId: 1,
      /* The candidate ROW id the harness serves, which is what the read seals. */
      candidateId: 1,
      intent: "makeup",
      sentence: "soft brown smoky shadow",
      issuedAt: Date.now(),
      ...over,
    } as Parameters<typeof issueReadToken>[0]);
  }

  it("files VERBATIM when she spent the sentence the reader wrote", async () => {
    const result = await refineCandidate(
      { ...deps, interpret: async () => ({ ok: true as const, delta: { makeup: "soft brown smoky shadow" } }) },
      { ...input, instruction: "soft brown smoky shadow", provenanceToken: await mint() },
    );
    expect(result.kind).not.toBe("refused");

    const claimed = await claimedPayload();
    expect(claimed.stepProvenance, "index-aligned with the instructions, always")
      .toHaveLength(claimed.instructions.length);
    expect(claimed.stepProvenance.at(-1)).toEqual({
      source: "referenceRead",
      intent: "makeup",
      adopted: "verbatim",
    });
  });

  it("files EDITED when she reworked it — the common case, and still a fact", async () => {
    const result = await refineCandidate(
      { ...deps, interpret: async () => ({ ok: true as const, delta: { makeup: "soft brown shadow, glossy lip" } }) },
      { ...input, instruction: "soft brown shadow, glossy lip", provenanceToken: await mint() },
    );
    expect(result.kind).not.toBe("refused");
    expect((await claimedPayload()).stepProvenance.at(-1)).toMatchObject({ adopted: "edited" });
  });

  it("files NOTHING for an ordinary typed refine — the array is nulls, not absent", async () => {
    /*
      The negative arm, and it is the one that keeps the column honest: a step
      nobody adopted a read for must say so per index rather than leaving a hole
      that a later reader has to interpret.
    */
    await refineCandidate({ ...deps }, input);
    const claimed = await claimedPayload();
    expect(claimed.stepProvenance).toHaveLength(claimed.instructions.length);
    expect(claimed.stepProvenance.every((entry) => entry === null)).toBe(true);
  });

  it("files NOTHING for a token minted against ANOTHER Cast, and still renders", async () => {
    /*
      Two assertions in one, deliberately. The provenance must not survive a
      Cast it was not issued for — the realistic version is two tabs, not theft
      — and the refine must not NOTICE: a decoration that can fail a paid
      operation is worse than no decoration at all.
    */
    const result = await refineCandidate(
      { ...deps },
      { ...input, provenanceToken: await mint({ candidateId: 999 }) },
    );
    expect(result.kind, "the paid operation is untouched by a bad decoration").not.toBe("refused");
    expect((await claimedPayload()).stepProvenance.at(-1)).toBeNull();
  });

  it("files NOTHING for a token the client made up, and still renders", async () => {
    const result = await refineCandidate(
      { ...deps },
      { ...input, provenanceToken: "makeup.not-a-hash.1.nope" },
    );
    expect(result.kind).not.toBe("refused");
    expect((await claimedPayload()).stepProvenance.at(-1)).toBeNull();
  });
});

/*
  THE REFERENCE LANE, PROVED AT THE SERVICE RATHER THAN BESIDE IT.

  `askReference.test.ts` proves the three ownership questions and
  `refineReask.test.ts` proves the question is re-derivable. Neither proves the
  WIRING, and a resolver that is correct and never consulted is the shape this
  campaign keeps paying for (`gate-not-reader`): the picture would be accepted,
  no question would be asked, and she would be charged for a render that quietly
  ignored the photograph she attached.

  So these arms drive `refineCandidate` itself, with the resolver stubbed at its
  module boundary — the seam that carries the FACT, not the one that decides it.
*/
describe("the picture she attached reaches the ask", () => {
  const REFERENCE = {
    id: 7,
    storageKey: "casting-v2/reference/abc.png",
    provenance: "consented" as const,
    digest: "d".repeat(64),
    mime: "image/png",
    width: 1024,
    height: 1024,
  };

  afterEach(() => { resolveAskReferenceMock.mockReset(); });

  it("ASKS NOTHING for a hair ask with a picture attached — his newer ruling", () => {
    /*
      This arm asserted the OPPOSITE an hour ago, and the ruling that moved it
      is the founder's own (2026-08-19, fable-1087, superseding fable-1047 §3):
      *"if they are vague and say copy this hair it just means the whole lot
      unless they specify."*

      So a hair ask with a reference attached is not a question and never was
      one — it is a complete instruction that the recipe reads a take out of.
      Driven through `refineCandidate` rather than through the reask builder,
      because the thing being proved is that the DOOR is gone from the request
      path and not merely that a function returns something different.
    */
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    return refineCandidate({ ...greenEyes, harvest: unmasked }, {
      ...input,
      instruction: "copy hair from reference",
      referenceId: "ref-public",
    }).then((result) => {
      expect(result.kind).not.toBe("asked");
    });
  });

  it("resolves the handle even though nothing asks a question about it", () => {
    /*
      THE HALF THE DELETED QUESTION WAS CARRYING, and it is why this arm is not
      redundant. The resolver was reached through the question door in every
      previous arm; with that door gone, a reference could silently stop being
      resolved at all and every hair arm would still pass. So the resolution is
      driven on its own — the ownership and re-anchoring checks are the whole
      safety of the lane and they run before anything is charged.
    */
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    return refineCandidate({ ...greenEyes, harvest: unmasked }, {
      ...input,
      instruction: "copy hair from reference",
      referenceId: "ref-public",
    }).then(() => {
      expect(resolveAskReferenceMock).toHaveBeenCalled();
    });
  });

  it("does not resolve anything when no picture is attached", () => {
    return refineCandidate({ ...greenEyes, harvest: unmasked }, {
      ...input,
      instruction: "copy hair from reference",
    }).then(() => {
      expect(resolveAskReferenceMock).not.toHaveBeenCalled();
    });
  });

  /*
    A HANDLE THAT RESOLVES TO NOTHING IS NOT AN EXCEPTION — it is an answer she
    reads. Charging for a render that silently dropped her reference is the one
    outcome this arm exists to make impossible.
  */
  it("refuses free when the handle resolves to nothing", async () => {
    resolveAskReferenceMock.mockResolvedValue(null);
    const result = await refineCandidate({ ...greenEyes, harvest: unmasked }, {
      ...input,
      instruction: "copy hair from reference",
      referenceId: "ref-public",
    });
    expect(result.kind).toBe("selected");
    expect(result.note).toMatch(/isn't attached to this Cast/);
    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
  });

  it("scopes the resolve to this account and this Cast", async () => {
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    await refineCandidate({ ...greenEyes, harvest: unmasked }, {
      ...input,
      instruction: "copy hair from reference",
      referenceId: "ref-public",
    });
    expect(resolveAskReferenceMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      referencePublicId: "ref-public",
    }));
    /* The candidate is a number resolved from her own row, never the public id
       off the request (invariant 2). */
    const [query] = resolveAskReferenceMock.mock.calls[0];
    expect(typeof query.candidateId).toBe("number");
  });
});

/*
  THE WORDS LANE, PROVED AT THE SERVICE — free, and it never intercepts a render.

  `referenceWordsLane.test.ts` drives the decision and the read directly. What
  it cannot prove is the WIRING, and the wiring is the whole of it: a lane that
  is correct and never consulted leaves a colour ask rendering the words *"the
  hair colour in the attached picture"* onto somebody's face, which is exactly
  what the entrance clause made possible one commit earlier.

  So these arms drive `refineCandidate` and assert on the ANSWER and on the
  LEDGER — no claim opened, nothing deducted — rather than on a variable near
  them.
*/
describe("a words take is answered with a sentence to adopt, free", () => {
  const REFERENCE = {
    id: 7,
    storageKey: "casting-v2/reference/words.png",
    provenance: "consented" as const,
    digest: "d".repeat(64),
    mime: "image/png",
    width: 900,
    height: 900,
  };

  const readWords = async () => ({
    ok: true as const,
    sentence: "copper through the lengths",
    used: ["copper through the lengths"],
    dropped: ["ash blonde at the roots"],
    outcome: "delivered",
  });

  /*
    THE INTERPRETER, ANSWERING THE WAY THE REAL ONE WAS MEASURED TO.

    Not `greenEyes`: a double that answers unlike the thing it stands for
    discriminates nothing. Driven on the live transport with the entrance clause
    in place, *"take the hair colour from this picture"* files exactly this —
    the free lane, a value naming the picture, and `fromReference` beside it.
    That value is the reason this lane exists: painted, it would put the words
    "the hair colour in the attached picture" onto a customer's hair.
  */
  const pointedAtThePicture = async () => ({
    ok: true as const,
    delta: { free: { hairShade: "the hair colour in the attached picture" } },
    fromReference: true,
  });

  const road = (over: Record<string, unknown> = {}) => ({
    ...greenEyes,
    interpret: pointedAtThePicture,
    harvest: unmasked,
    readBytes: async () => ({ bytes: Buffer.from("her picture"), contentType: "image/png" }),
    readWords,
    /* The words lane is the hair road's other form (D-142's split), so it asks
       the hair flag for itself from 2026-08-20 — these arms are about what the
       lane SAYS, not about who is on it (fable-1163 §2). */
    hairReferenceEnabled: () => true,
    ...over,
  });

  afterEach(() => { resolveAskReferenceMock.mockReset(); });

  it("reads her picture and offers the sentence — nothing claimed, nothing charged", async () => {
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    const result = await refineCandidate(road() as never, {
      ...input,
      instruction: "take the hair colour from this picture",
      referenceId: "ref-public",
    });
    expect(result.kind).toBe("selected");
    expect(result.offer?.sentence).toBe("copper through the lengths");
    /* NAMED, never counted — the only useful thing she can do with what did not
       fit is type it herself. */
    expect(result.offer?.dropped).toEqual(["ash blonde at the roots"]);
    /* THE LEDGER IS THE ASSERTION. A words take costs nothing, and "free" is a
       fact about the journal rather than about the sentence. */
    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
  });

  it("mints the provenance the adopted sentence travels back with", async () => {
    /* So `verbatim` or `edited` is something the service derives rather than a
       claim anybody makes. */
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    const result = await refineCandidate(road() as never, {
      ...input,
      instruction: "take the hair colour from this picture",
      referenceId: "ref-public",
    });
    expect(result.offer?.provenanceToken).toMatch(/^hair\./);
  });

  it("carries a reader's refusal as HER sentence, and still charges nothing", async () => {
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    const result = await refineCandidate({
      ...road(),
      readWords: async () => ({
        ok: false as const,
        message: "I can't see any hair in that picture.",
        outcome: "no_hair_visible",
      }),
    } as never, {
      ...input,
      instruction: "take the hair colour from this picture",
      referenceId: "ref-public",
    });
    expect(result.kind).toBe("selected");
    expect(result.note).toBe("I can't see any hair in that picture.");
    expect(result.offer).toBeUndefined();
    expect(journal).not.toContain("deduct");
  });

  it("READS NOTHING when no picture is attached", async () => {
    /*
      The lane is reached by a picture, never by a sentence. Without this the
      words "take the hair colour from this picture" typed by somebody with no
      attachment would spend house money on a reader with nothing to read.
    */
    let read = 0;
    /* With no picture there is nothing to intercept, so the ask goes to the
       render this harness has no engine for — the assertion is on the READ. */
    const answered = await refineCandidate({
      ...road(),
      readWords: async () => { read += 1; return { ok: false as const, message: "no", outcome: "no_transport" }; },
    } as never, {
      ...input,
      instruction: "take the hair colour from this picture",
    }).then((result) => result.offer, () => undefined);
    expect(read).toBe(0);
    expect(answered).toBeUndefined();
  });

  it("READS NOTHING for a complete ask of her own — the picture is confessed instead", async () => {
    /*
      fable-1104 §3's cousin, and the failure it names is real: the take
      resolver defaults to the whole lot for ANY sentence, so a picture she
      attached and did not mention must not turn her own value into a reading.
    */
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    let read = 0;
    /*
      IT GOES TO THE RENDER, which this harness has no engine for — so the
      assertion is on what the lane DID, not on what the render returned. A
      thrown render is the proof the ask was never intercepted: an intercepted
      one answers `selected` and never reaches an engine at all.
    */
    const answered = await refineCandidate({
      /* Her own complete ask, filed the way the real interpreter files it —
         the exact vocabulary, and NO `fromReference` beside it. */
      ...road({ interpret: async () => ({ ok: true as const, delta: { hairColour: "copper" as const } }) }),
      readWords: async () => { read += 1; return { ok: false as const, message: "no", outcome: "no_transport" }; },
    } as never, {
      ...input,
      instruction: "make her hair copper",
      referenceId: "ref-public",
    }).then((result) => result.offer, () => undefined);
    expect(read).toBe(0);
    expect(answered).toBeUndefined();
  });
});

/*
  HER PICTURE BECOMING A CARRIER — the crop road ON THE REQUEST PATH.

  `hairReferenceCutter.test.ts` proves the cut and `recipeAssembler.test.ts`
  proves the fourth role. Neither proves that a paid ask reaches either of them,
  and this campaign's own record says what an unconsulted control is worth
  (`gate-not-reader`, invariant 7): `carrierPicturesScale` exists exactly as
  much as the request path that consults it.

  So these arms drive `refineCandidate` and assert on WHAT WENT OUT — the
  reference array the repaint engine actually received — rather than on a
  variable near it.
*/
describe("the picture she attached becomes the carrier that rides", () => {
  const REFERENCE = {
    id: 7,
    storageKey: "casting-v2/reference/attached.png",
    provenance: "consented" as const,
    digest: "d".repeat(64),
    mime: "image/png",
    width: 120,
    height: 100,
  };

  /** One photograph, continuous — no seam, so one panel and two questions. */
  const onePhotograph = async () => {
    const sharp = (await import("sharp")).default;
    const width = 120;
    const height = 100;
    const raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 3;
        raw[at] = Math.round(60 + (x / width) * 60);
        raw[at + 1] = Math.round(70 + (y / height) * 60);
        raw[at + 2] = 90;
      }
    }
    return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
  };

  const boxMask = (width: number, height: number, rect: { x: number; y: number; w: number; h: number }) => {
    const data = Buffer.alloc(width * height, 0);
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) data[y * width + x] = 255;
    }
    return { data, width, height };
  };

  /** The segmenter, scripted. `asked` is the count that proves a refusal was
   *  free in CALLS as well as in credits. */
  const asked: string[] = [];
  const reader = (answers: (name: string) => { hair?: boolean; form?: boolean } = () => ({})) => ({
    region: async ({ image, name }: { image: Buffer; name: string }) => {
      asked.push(name);
      const sharp = (await import("sharp")).default;
      const meta = await sharp(image).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      const answer = answers(name);
      if (name === "hair") {
        return answer.hair === false
          ? { data: Buffer.alloc(width * height, 0), width, height }
          : boxMask(width, height, { x: 10, y: 10, w: 40, h: 40 });
      }
      return answer.form === false
        ? { data: Buffer.alloc(width * height, 0), width, height }
        : boxMask(width, height, { x: 50, y: 20, w: 30, h: 30 });
    },
    subject: async () => { throw new Error("no subject matte is asked for on this road"); },
    landmark: async () => { throw new Error("no landmark is asked for on this road"); },
  });

  /** Every render's outgoing request, captured at the wire. */
  const painted: Array<{ prompt: string; references: ReadonlyArray<{ bytes: Buffer; contentType: string }> }> = [];
  const minted: Array<{ userId: number; bytes: Buffer }> = [];

  const carrierRoad = (over: Record<string, unknown> = {}) => ({
    repaintEnabled: () => true,
    /*
      THE HAIR ROAD IS OPEN FOR THIS ACCOUNT — supplied here from 2026-08-20,
      when the lane gained its own reader of the hair flag (fable-1163 §2).

      Every arm in this describe is about what the hair road DOES; the flag is
      not their subject, and without this they would all be testing an account
      that is not on it. The arms that ARE about the flag override it and say so.
    */
    hairReferenceEnabled: () => true,
    repaintEngine: () => ({
      id: "test:repaint",
      edit: async (request: { prompt: string; references: ReadonlyArray<{ bytes: Buffer; contentType: string }>; width: number; height: number }) => {
        painted.push({ prompt: request.prompt, references: request.references });
        return {
          bytes: Buffer.from("repainted"),
          contentType: "image/png",
          width: request.width,
          height: request.height,
          latencyMs: 10,
          provenance: { provider: "fal" as const, model: "gpt-image-2", providerRef: "req-r" },
        };
      },
    }),
    /*
      STORAGE, STANDING IN — and the carrier comes back out of it EXACTLY as it
      went in.

      Not a convenience: `repaint` checks every reference's digest against the
      sha the recipe carries, so a stub handing back different bytes would be
      refused as `referenceBytesChanged` — which is what the first version of
      this fixture did, and it is the pixel-frozen promise catching a fixture
      rather than a defect.
    */
    readBytes: async (key: string) => (key === REFERENCE.storageKey
      ? { bytes: await onePhotograph(), contentType: "image/png" }
      : key === "casting-v2/reference-carrier/carrier.png"
        ? { bytes: minted.at(-1)!.bytes, contentType: "image/png" }
        : { bytes: TINY_MASTER_PNG, contentType: "image/png" }),
    /* The mint is stubbed at its own seam: this suite must not write to a
       bucket, and the KEY is what the recipe carries. */
    mintCarrier: async ({ userId, carrier }: { userId: number; carrier: { bytes: Buffer } }) => {
      minted.push({ userId, bytes: carrier.bytes });
      const { createHash } = await import("node:crypto");
      return {
        key: "casting-v2/reference-carrier/carrier.png",
        sha: createHash("sha256").update(carrier.bytes).digest("hex"),
        contentType: "image/png",
        carrier: carrier as never,
      };
    },
    regions: reader(),
    interpret: async () => ({ ok: true as const, delta: { free: { hairCut: "a mid-length wavy cut" } } }),
    harvest: unmasked,
    ...over,
  });

  beforeEach(() => {
    painted.length = 0;
    minted.length = 0;
    inkMinted.length = 0;
    asked.length = 0;
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
  });
  afterEach(() => { resolveAskReferenceMock.mockReset(); });

  it("SENDS THE CARRIER as a second reference, described honestly", async () => {
    await refineCandidate(carrierRoad(), {
      ...input,
      instruction: "copy this hairstyle",
      referenceId: "ref-public",
    });

    expect(minted).toHaveLength(1);
    expect(painted).toHaveLength(1);
    /* The master is reference 1 and the carrier is reference 2 — asserted on
       the array that was dispatched. */
    expect(painted[0]!.references).toHaveLength(2);
    expect(painted[0]!.references[0]!.bytes).toEqual(TINY_MASTER_PNG);
    /* The bytes that went out ARE the bytes the cutter composed — the pixel
       identity, read off the request rather than off the mint. */
    expect(painted[0]!.references[1]!.bytes).toEqual(minted[0]!.bytes);
    expect(painted[0]!.prompt).toContain("Reference 2 is the picture supplied for her hair");
    expect(painted[0]!.prompt).toContain("plain grey form");
    /* Two questions, no more: one panel, hair then the scale. */
    expect(asked).toEqual(["hair", "face"]);
  });

  it("REFUSES FREE when the carrier pictures no scale — nothing claimed, nothing charged", async () => {
    /*
      The guard is `carrierPicturesScale`, and this is the arm that makes it
      exist: consulted here, on the path a customer's money travels. A carrier
      with no form would deliver the short crop the length court convicted, at
      full price.
    */
    const result = await refineCandidate(carrierRoad({ regions: reader(() => ({ form: false })) }), {
      ...input,
      instruction: "copy this hairstyle",
      referenceId: "ref-public",
    });

    expect(result.kind).toBe("selected");
    expect(result.note).toMatch(/not enough of the head around it/);
    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
    expect(painted).toHaveLength(0);
    expect(minted).toHaveLength(0);
  });

  it("REFUSES FREE when there is no hair in her picture, and buys no scale call", async () => {
    const result = await refineCandidate(carrierRoad({ regions: reader(() => ({ hair: false })) }), {
      ...input,
      instruction: "copy this hairstyle",
      referenceId: "ref-public",
    });

    expect(result.kind).toBe("selected");
    expect(result.note).toMatch(/couldn't find any hair/);
    expect(journal).not.toContain("deduct");
    /* Free in calls as well: the second question is never bought. */
    expect(asked).toEqual(["hair"]);
  });

  it("CUTS NOTHING for an ask that does not touch hair — and says the picture went unused", async () => {
    /*
      She attached a photograph and asked for green eyes. No segmenter call is
      bought, no carrier is cut — and she is TOLD, because a product that stays
      quiet here lets her believe her picture was used (D-181's law, pointed at
      the other kind of reference).
    */
    const result = await refineCandidate(carrierRoad({
      interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
    }), {
      ...input,
      instruction: "copy this hairstyle",
      referenceId: "ref-public",
    });

    expect(asked).toEqual([]);
    expect(minted).toHaveLength(0);
    expect(painted).toHaveLength(1);
    expect(painted[0]!.references).toHaveLength(1);
    expect(result.note).toMatch(/picture you attached wasn't used/);
  });

  it("CUTS NOTHING for a COLOUR take — that one carries as words", async () => {
    /* His own example of the words half of the general law. The picture is not
       cut, and the ask still renders. */
    await refineCandidate(carrierRoad({ hairTake: async () => "colour" as const }), {
      ...input,
      instruction: "copy just the hair colour",
      referenceId: "ref-public",
    });

    expect(asked).toEqual([]);
    expect(minted).toHaveLength(0);
    expect(painted[0]!.references).toHaveLength(1);
  });

  it("CUTS NOTHING when the take cannot be read — an unreadable ask is not a coin flip", async () => {
    await refineCandidate(carrierRoad({ hairTake: async () => null }), {
      ...input,
      instruction: "copy the colour and the cut",
      referenceId: "ref-public",
    });

    expect(asked).toEqual([]);
    expect(minted).toHaveLength(0);
  });

  it("carries NOTHING of the person in her photograph — the containment bound, at the wire", async () => {
    /*
      Proved on the bytes that were dispatched rather than on the cutter's
      promise: every opaque pixel of what went out is either the hair's own
      colour or the flat fill. The mint seam here hands back the REAL composed
      carrier so the assertion reads what the road built.
    */
    const sharp = (await import("sharp")).default;
    await refineCandidate(carrierRoad(), {
      ...input, instruction: "copy this hairstyle", referenceId: "ref-public",
    });

    expect(painted).toHaveLength(1);
    /* Read off the DISPATCHED reference, not off the mint — what a person's
       photograph could leak into is the request, and that is where this looks. */
    const { data, info } = await sharp(painted[0]!.references[1]!.bytes)
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { FORM_FILL } = await import("./hairReferenceCrop.js");
    let flat = 0;
    for (let at = 0; at < info.width * info.height; at += 1) {
      if (data[at * 4 + 3] === 0) continue;
      const inHair = (at % info.width) + 10 < 50 && Math.floor(at / info.width) + 10 < 50;
      if (!inHair) {
        expect([data[at * 4], data[at * 4 + 1], data[at * 4 + 2]])
          .toEqual([FORM_FILL.r, FORM_FILL.g, FORM_FILL.b]);
        flat += 1;
      }
    }
    expect(flat).toBe(30 * 30);
  });

  it("NARROWS A DRAWING to the words road — free, and it names the sentence she could type", async () => {
    /*
      The class door on the path a customer's money travels (fable-1075 §1). A
      crop rides into a repaint as a picture of the thing to reproduce, so a
      gouache painting there asks an engine to paint PAINT onto her head. The
      colour is a different matter, which is why the answer offers it.
    */
    const result = await refineCandidate(carrierRoad({ readMedium: async () => "drawn" as const }), {
      ...input,
      instruction: "copy this hairstyle",
      referenceId: "ref-public",
    });

    expect(result.kind).toBe("selected");
    expect(result.note).toMatch(/illustration/);
    expect(result.note).toMatch(/copy just the hair colour/);
    /* Nothing cut, nothing claimed, nothing charged — and the segmenter never
       asked a question about a picture the road had already declined. */
    expect(asked).toEqual([]);
    expect(minted).toHaveLength(0);
    expect(journal).not.toContain("begin");
    expect(journal).not.toContain("deduct");
  });

  it("changes NOTHING when the medium cannot be read — the arm that keeps a bad minute from turning her away", async () => {
    /*
      A door that narrows on silence turns customers away on a provider's bad
      minute, which is the verdict fable-1052 forbids. The licence to narrow
      comes from a positive `drawn` answer or from nowhere.
    */
    await refineCandidate(carrierRoad({ readMedium: async () => "unreadable" as const }), {
      ...input,
      instruction: "copy this hairstyle",
      referenceId: "ref-public",
    });

    expect(minted).toHaveLength(1);
    expect(painted[0]!.references).toHaveLength(2);
  });

  it("asks the class door only once BOTH cheap doors have said this ask wants a crop", async () => {
    /* A vision read is house money on a paid path. An ask that never wanted a
       crop must not buy one — the colour take and the non-hair ask both stop
       short of it. */
    const asks: number[] = [];
    const counting = { readMedium: async () => { asks.push(1); return "photograph" as const; } };

    await refineCandidate(carrierRoad({ ...counting, hairTake: async () => "colour" as const }), {
      ...input, instruction: "copy just the hair colour", referenceId: "ref-public",
    });
    expect(asks).toHaveLength(0);

    await refineCandidate(carrierRoad({
      ...counting,
      interpret: async () => ({ ok: true as const, delta: { eyeColour: "green" as const } }),
    }), { ...input, instruction: "copy this hairstyle", referenceId: "ref-public" });
    expect(asks).toHaveLength(0);

    await refineCandidate(carrierRoad(counting), {
      ...input, instruction: "copy this hairstyle", referenceId: "ref-public",
    });
    expect(asks).toHaveLength(1);
  });

  /* ------------------------------------------------------------------ *
   * WHAT THE CROP IS ALLOWED TO GIVE HER — his fable-1048 amendment, at *
   * the wire (opus-815, the last mile of the crop road)                 *
   * ------------------------------------------------------------------ */

  /*
    > *"if someone wanted a hairstyle but a different hair color its important
    > that the words that ride along with the reference state it the style only
    > not the color etc"*

    A crop cannot scope itself: a picture of a haircut is a picture of a haircut
    in SOME colour whether anybody asked for the colour or not. The words are
    the only scoping instrument there is, so these arms read the dispatched
    prompt rather than the composer — a sentence that exists and does not travel
    is exactly the state this road was found in.
  */

  it("SCOPES THE CROP IN WORDS — a style take says what it must NOT take, at the wire", async () => {
    await refineCandidate(carrierRoad({ hairTake: async () => "style" as const }), {
      ...input,
      instruction: "give her this haircut but keep her own colour",
      referenceId: "ref-public",
    });

    expect(painted).toHaveLength(1);
    /* The claim, and then the half his amendment is actually about. Read off
       the request that was dispatched — the crop rode, so the scope must too. */
    expect(painted[0]!.prompt).toContain("Take her hair from the reference:");
    expect(painted[0]!.prompt).toContain("Do not take the colour from the reference — keep her own.");
  });

  it("a FULL LOOK take claims the colour and disclaims nothing — no empty clause", async () => {
    await refineCandidate(carrierRoad({ hairTake: async () => "fullLook" as const }), {
      ...input,
      instruction: "copy this hair",
      referenceId: "ref-public",
    });

    expect(painted).toHaveLength(1);
    const claim = /Take her hair from the reference: ([^.]+)\./.exec(painted[0]!.prompt);
    expect(claim).not.toBeNull();
    /* "the whole lot" is his own word for this take, so the colour is IN the
       claim — and there is nothing left over to disclaim. */
    expect(claim![1]).toContain("the colour");
    expect(painted[0]!.prompt).not.toContain("Do not take");
  });

  it("THE TWO CROP TAKES ARE NOT THE SAME REQUEST — the negative control", async () => {
    /*
      THE ARM THAT WAS RED. Before the take reached the engine, `style` and
      `fullLook` were resolved, courted, logged — and then dropped, so the two
      asks dispatched byte-identical prompts and a customer who asked to keep
      her own colour was given the reference's. Nothing else in this file could
      fail on that, because everything else asserts what IS in the prompt and
      the defect was a difference that was not.
    */
    await refineCandidate(carrierRoad({ hairTake: async () => "style" as const }), {
      ...input, instruction: "give her this haircut but keep her own colour", referenceId: "ref-public",
    });
    await refineCandidate(carrierRoad({ hairTake: async () => "fullLook" as const }), {
      ...input, instruction: "copy this hair", referenceId: "ref-public",
    });

    expect(painted).toHaveLength(2);
    expect(painted[0]!.prompt).not.toEqual(painted[1]!.prompt);
  });

  /*
    THE ORDERED ARM — a reference-documented tattoo ask is ANSWERED and NEVER
    DISPATCHED, pre-cutter (ruled fable-1116 §4, shaped fable-1120 §4).

    This is the one the whole staging argument rests on. The gate's reference arm
    stopped walling a sleeve ask; with nothing behind it, that ask would have
    travelled to a recipe with no crop and been RENDERED FROM WORDS — D-137's
    forbidden render, produced by the very gate built to stop it.

    Asserted on `painted`, which is the outgoing request itself, because the
    contract is about what gets SENT and a check on a constant near it proves
    nothing (invariant 5).
  */
  /**
   * ONE design row, at the place `inkRoad`'s take names.
   *
   * `digest` defaults to a value that does NOT match the bytes storage serves,
   * because that is the honest default for a fixture: a row whose digest is
   * invented describes bytes that are not there, and the render is supposed to
   * refuse it. The riding arm passes the real one explicitly, so the ONE place
   * that expects a paint is the one place that had to say so.
   */
  const inkDesignRow = (over: Record<string, unknown> = {}) => ({
    publicId: "d-sleeve",
    candidateId: 1,
    placement: "sleeve",
    side: "left",
    provenance: "ownWork",
    intents: ["ink"],
    storageKey: "casting-v2/ink/d-sleeve.png",
    cutRoute: "cut",
    /*
      IT CAME OUT OF THE PICTURE THIS ASK POINTS AT (migration 0048).

      The default rather than an over-ride, because a row that RIDES on this
      road is by definition one cut from the attachment she is pointing at —
      the reuse rule. An arm about a design that came from somewhere else says
      so explicitly, and there are two of those below: a hand-uploaded row
      (`sourceDigest: null`) and one cut from another picture. A fixture family
      that shared this property would test it once (fable-1150 §1).
    */
    sourceDigest: REFERENCE.digest,
    createdAt: new Date("2026-08-20T00:00:00Z"),
    digest: "b".repeat(64),
    mime: "image/png",
    byteSize: 2048,
    width: 512,
    height: 512,
    ...over,
  });

  /**
   * WHAT THE MINT WAS ASKED TO FILE — recorded, so an arm can assert that a
   * picture was NOT cut as well as that it was.
   *
   * A refusal that never reaches the mint and one that reaches it and comes
   * back empty look identical in the note a customer reads, and only the first
   * is free of house money.
   */
  const inkMinted: Array<{ placement: string; side: string; sourceDigest: string }> = [];

  const inkRoad = (over: Record<string, unknown> = {}) => carrierRoad({
    inkReferenceEnabled: () => true,
    /*
      THE MINT, at its own seam: this suite must not fetch bytes, call a
      segmenter or write to a bucket. What it returns is the row the real one
      would have written, with a digest that matches the bytes storage serves —
      because `repaintRender` re-hashes every reference and would refuse it
      otherwise, which is the pixel-frozen promise catching a fixture rather
      than a defect.
    */
    mintInkDesign: async (request: {
      placement: string;
      side: string;
      reference: { digest: string };
      intents: readonly string[];
    }) => {
      inkMinted.push({
        placement: request.placement,
        side: request.side,
        sourceDigest: request.reference.digest,
      });
      return {
        ok: true as const,
        design: inkDesignRow({
          publicId: "d-minted",
          placement: request.placement,
          side: request.side,
          storageKey: "casting-v2/ink/d-minted.png",
          digest: TINY_MASTER_SHA,
          intents: request.intents,
        }),
      };
    },
    /*
      HER STUDIO, EMPTY — which is the production state for every customer who
      has uploaded no design, and therefore the right default for this road's
      arms. An arm that wanted a design supplies one.

      The seam exists because the shipped read is owner-scoped on BOTH sides of
      its join, and a double that ignored the owner would be testing a door that
      is not the one that ships.
    */
    listInkDesigns: async () => [],
    interpret: async () => ({
      ok: true as const,
      fromReference: true,
      delta: { free: { ink: "the tattoo design in the attached picture" } },
    }),
    inkTake: async () => ({ placement: { kind: "open" as const, phrase: "sleeve" }, side: "left" as const }),
    ...over,
  });

  /*
    ---- D-137'S OWN ROAD: WORDS ALONE, AND NO PICTURE ANYWHERE ----

    Until 2026-08-21 this road did not exist on the repaint lane. The ink facet
    is `perPlacement` — it has NO slot until a caller supplies the placement —
    and the only supplier was a design minted out of an attached picture. So a
    words-only tattoo ask was CHARGED, refused `unplacedInk`, and REFUNDED, with
    a sentence asking her where it goes; her filed delta held the words
    *"on his neck"* the whole time (measured, opus-885 §1).

    The fix is extraction, not inference (ruled fable-1192 §1): her own word,
    pulled out of her own sentence by the take she already has, and put through
    the closed vocabulary. `sleeve` is still open and still walls; a side is
    still only hers; nothing is guessed anywhere.
  */
  const wordsRoad = (over: Record<string, unknown> = {}) => inkRoad({
    /* NO PICTURE, and `fromReference: false` is what makes it this lane. */
    interpret: async () => ({
      ok: true as const,
      fromReference: false,
      delta: { free: { ink: "a small geometric skeleton design on his neck" } },
    }),
    inkTake: async () => ({ placement: { kind: "measured" as const, placement: "neck" }, side: null }),
    ...over,
  });

  it("RENDERS a words-only neck tattoo — the promise D-137 made and this road never kept", async () => {
    painted.length = 0;
    const result = await refineCandidate(wordsRoad(), {
      ...input, instruction: "give him a small geometric skeleton tattoo on his neck",
    });
    /* The whole finding, in one assertion: this used to be a refund. */
    expect(result.kind).toBe("rendered");
    expect(painted.length, "a words-only neck tattoo still did not reach the engine").toBeGreaterThan(0);
  });

  it("ASKS rather than guessing when she names a paired surface with no side", async () => {
    /*
      The EXISTING side machinery, reached from the new lane — fable-1192 §1's
      condition. A wrong arm is a refund and an apology (300 credits, twice,
      DECISION_LOG R7-7G); an unstated side is a question. `whichSideReask`
      raises no operation and moves no credit, and it cannot loop: her answer
      puts the word in her own sentence, where the containment that guards the
      side will accept it.
    */
    painted.length = 0;
    const result = await refineCandidate(wordsRoad({
      inkTake: async () => ({ placement: { kind: "measured" as const, placement: "upperArm" }, side: null }),
    }), { ...input, instruction: "give him a skull tattoo on his upper arm" });
    expect(result.kind).toBe("asked");
    expect(painted, "a paired surface with no side reached the engine").toHaveLength(0);
  });

  it("takes the side SHE said and renders it, without asking twice", async () => {
    painted.length = 0;
    const result = await refineCandidate(wordsRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" }, side: "left" as const,
      }),
    }), { ...input, instruction: "give him a skull tattoo on his left upper arm" });
    expect(result.kind).toBe("rendered");
    expect(painted.length).toBeGreaterThan(0);
  });

  it("ASKS when her sentence named no place at all — free, and never a guess", async () => {
    painted.length = 0;
    const result = await refineCandidate(wordsRoad({
      inkTake: async () => ({ placement: { kind: "absent" as const }, side: null }),
    }), { ...input, instruction: "give him a tattoo" });
    expect(result.kind).toBe("selected");
    expect(result.note).toContain("Nothing was charged.");
    expect(painted, "an ask that named no place reached the engine").toHaveLength(0);
  });

  it("does NOT take this road when she pointed at a picture — the negative control", async () => {
    /*
      THE ARM THAT SHAPED THE CONDITION. Without `!namesInkFromReference`, an
      ink-reference ask from an account OUTSIDE `CASTING_INK_REFERENCE_SCOPE`
      got a placement question instead of D-137's document wall — the gate
      being routed around by the fix for a different lane. `fromReference` is
      read off the delta, the same predicate the gate itself uses.
    */
    let asked = 0;
    await expect(refineCandidate(inkRoad({
      inkReferenceEnabled: () => false,
      inkTake: async () => { asked += 1; return { placement: { kind: "absent" as const }, side: null }; },
    }), {
      ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public",
    })).rejects.toThrow(/Nothing was charged/);
    expect(asked, "the words lane read a sentence that pointed at a picture").toBe(0);
  });

  it("ANSWERS a reference-documented tattoo ask with NO DESIGN and dispatches NOTHING", async () => {
    /*
      RE-ANCHORED 2026-08-20, and the contract it protects did not move.

      Pre-cutter this ask was answered *"I can't put it on her yet"* because
      there was no road at all. There is one now — the design row is resolved
      and ridden — so the sentence a customer reads depends on what she HAS, and
      this arm is the case that has nothing: an empty studio.

      **The thing being protected is identical**: a tattoo ask must never travel
      to a recipe with no design and be RENDERED FROM WORDS. That is D-137's
      forbidden render, produced by the very gate built to stop it, and it is
      still asserted on `painted` — the outgoing request itself, because the
      contract is about what gets SENT (invariant 5).
    */
    const result = await refineCandidate(inkRoad(), {
      ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public",
    });

    expect(painted, "a tattoo was rendered from words — the render D-137 forbids").toHaveLength(0);
    expect(minted, "a hair carrier was cut for a tattoo ask").toHaveLength(0);
    expect(result.kind).toBe("selected");
    /* The place she named is in front of her, which is what makes the take a
       live control rather than a dark one — and the answer names what she can
       DO about it rather than what we cannot do. */
    expect(result.note).toContain("her left sleeve");
    expect(result.note).toContain("Nothing was charged.");
  });

  /*
    AND WITH A DESIGN AT THAT PLACE, IT RIDES — the other half, and the first
    time a tattoo has ever reached a recipe on this road.

    The two assertions that matter are the last two: the design goes as a
    SECOND REFERENCE with its own digest, and the prompt carries the sentence
    that scopes it. A render that sent the picture with nothing said about it
    would pass a naive "did it dispatch" check and would be the unscoped
    reference the whole source vocabulary exists to prevent.
  */
  it("RIDES the design she has at the place she named", async () => {
    const design = inkDesignRow({ digest: TINY_MASTER_SHA });
    await refineCandidate(inkRoad({ listInkDesigns: async () => [design] }), {
      ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public",
    });
    expect(painted, "the design was resolved and nothing was sent").toHaveLength(1);
    const sent = painted[0]!;
    /*
      TWO REFERENCES REACHED THE ENGINE, not one: the master and the design.

      Asserted on the outgoing request's own `references` rather than on a key
      in a log line, because this double records what the ENGINE was handed —
      loaded bytes — and that is the thing the contract is about (invariant 5).
      The bytes only load at all because the digest matched: `repaintRender`
      refuses a reference whose sha is not the one the recipe named, which is
      the arm below.
    */
    expect(sent.references).toHaveLength(2);
    /* AND THE ENGINE IS TOLD WHAT THE SECOND PICTURE IS — a reference sent with
       nothing said about it is one the painter may read as anything. */
    expect(sent.prompt).toContain("is the tattoo design supplied for this edit");
    /* AND WHAT IT MAY GIVE HER: the artwork is claimed, her body is not. */
    expect(sent.prompt).toContain("Take the tattoo design from the reference");
    expect(sent.prompt).toContain("Do not take skin, skin tone, body shape, pose or lighting");
    /* AND WHERE IT GOES, in the ask clause — the slot's own noun. */
    expect(sent.prompt).toContain("left sleeve tattoo");
    /*
      AND THE ROW REMEMBERS WHICH DESIGN RODE — clause (a)'s write half
      (shape A, ruled fable-1167 §2).

      Without this line the whole carry is a rule with no caller: the recipe can
      carry an applied design and nothing would ever record that one was
      applied, so the tattoo would still vanish on the next edit. Asserted on
      what `claimVariant` was HANDED — the row as written — because that is the
      only thing a later render reads.

      Both lists, because they answer different questions: the composed delta is
      the branch state a later recipe reads, and the step's own delta is what a
      PRUNE takes away.
    */
    const claimed = (claimVariant as unknown as {
      mock: { calls: Array<[{ deltas: RefineDelta; stepDeltas: RefineDelta[] }]> };
    }).mock.calls.at(-1)![0];
    expect(claimed.deltas.inkApplied).toEqual({ "ink:sleeve@left": "d-sleeve" });
    expect(claimed.stepDeltas.at(-1)!.inkApplied).toEqual({ "ink:sleeve@left": "d-sleeve" });
  });

  /*
    AND WHEN SHE HAS NOTHING THERE, THE PICTURE SHE POINTED AT BECOMES THE
    DESIGN — road (D) at the wire (ruled fable-1148 §3).

    This is the arm that closes the gap opus-853 named in its own commit
    message: before it, this road's entrance required a customer to have BOTH
    attached a picture and uploaded a design at the same placement, which
    nobody had. Now the ask that reaches an empty studio files the design out
    of her own attachment and rides it in the same breath.
  */
  it("MINTS the design out of her picture and SHOWS IT before anything is charged", async () => {
    /*
      RE-ANCHORED 2026-08-20 by fable-1156 §2, and the change is the ruling
      rather than the code drifting: this arm read *"mints and rides it, in one
      ask"*, which is exactly the sentence 1127 §2 forbids on a road that cuts.

      The cutter takes what it decides is the artwork out of her photograph, and
      the reader that judges that CANNOT see fine sparse detail — so her eyes
      are the only check between the cut and her money. The mint still happens
      here, and it still happens before the claim; what has changed is that the
      ask now STOPS and shows her.
    */
    const result = await refineCandidate(inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" as const },
        side: "left" as const,
      }),
      listInkDesigns: async () => [],
    }), {
      ...input,
      instruction: "use this tattoo design on her left upper arm",
      referenceId: "ref-public",
    });

    /* THE MINT WAS ASKED FOR EXACTLY WHAT HER SENTENCE SAID, and the picture it
       was told to cut is the one she pointed at. */
    expect(inkMinted).toEqual([
      { placement: "upperArm", side: "left", sourceDigest: REFERENCE.digest },
    ]);
    /* AND IT DID NOT RIDE. Free, before the claim, and no engine was asked for
       anything — the two segmenter calls the mint spends are house money. */
    expect(painted, "the cut rode into a paid render before she had seen it").toHaveLength(0);
    expect(ledger.charges, "a cut nobody had looked at was charged for").toHaveLength(0);
    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("this-design");
    expect(result.reask?.options.map((one) => one.label))
      .toEqual(["Yes — use this design", "No, discard it"]);
    /*
      AND THE ANSWER NAMES THE DESIGN AT AN ADDRESS SHE CAN OPEN (fable-1156
      §2e). A question about a picture nobody can see is not a question, and the
      path is the one speller's — never a storage URL.
    */
    expect(result.design?.designId).toBe("d-minted");
    expect(result.design?.imagePath).toBe(inkDesignImagePath("d-minted"));
    expect(result.design?.imagePath).not.toContain("http");
  });

  it("AND THE ADOPT RIDES THE ROW SHE WAS SHOWN — one cut and one claim across the pair", async () => {
    /*
      THE PAIR, DRIVEN END TO END (ruled fable-1156 §2b).

      The round trip the shown cut costs must be ONE TAP AND NOTHING ELSE: no
      second cut of the same picture, and no second charge. Both of those are
      properties of the pair rather than of either ask, so neither can be seen
      by an arm that runs one of them.

      `listInkDesigns` is stateful here BECAUSE THE DATABASE IS: the first ask
      writes the row, so the second ask must find it. A fixed empty double would
      mint twice and this arm would pass while the customer paid for two cuts.
    */
    const studio: Array<Record<string, unknown>> = [];
    const road = inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" as const },
        side: "left" as const,
      }),
      listInkDesigns: async () => studio,
      mintInkDesign: async (request: {
        placement: string;
        side: string;
        reference: { digest: string };
        intents: readonly string[];
      }) => {
        inkMinted.push({
          placement: request.placement,
          side: request.side,
          sourceDigest: request.reference.digest,
        });
        const design = inkDesignRow({
          publicId: "d-minted",
          placement: request.placement,
          side: request.side,
          storageKey: "casting-v2/ink/d-minted.png",
          digest: TINY_MASTER_SHA,
          intents: request.intents,
        });
        studio.push(design as unknown as Record<string, unknown>);
        return { ok: true as const, design };
      },
    });

    const asked = "use this tattoo design on her left upper arm";
    const offer = await refineCandidate(road, { ...input, instruction: asked, referenceId: "ref-public" });
    expect(offer.kind).toBe("asked");

    /*
      THE LABEL, WHICH IS WHAT THE CLIENT SENDS — never the `resolves`, and the
      handle echoed back verbatim. An arm that posted the resolved sentence
      would skip the rebuild and the mapping both, and prove a road nobody
      travels.
    */
    const chip = offer.reask!.options.find((one) => one.label === "Yes — use this design")!;
    const rode = await refineCandidate(road, {
      ...input,
      instruction: chip.label,
      answering: offer.reask!.about,
      referenceId: "ref-public",
    });

    /* ONE CUT ACROSS THE PAIR — the reuse rule is what makes her answer free. */
    expect(inkMinted, "the same picture was cut a second time to answer a question about it")
      .toHaveLength(1);
    /* ONE CLAIM ACROSS THE PAIR — the offer charged nothing, the adopt charged once. */
    expect(ledger.charges, "the round trip cost her two charges").toHaveLength(1);
    /* AND IT RODE — the master and the design, two references at the engine. */
    expect(rode.kind).toBe("rendered");
    expect(painted, "the design she adopted never reached the render").toHaveLength(1);
    expect(painted[0]!.references).toHaveLength(2);
    expect(painted[0]!.prompt).toContain("is the tattoo design supplied for this edit");
    expect(painted[0]!.prompt).toContain("left upper arm tattoo");
    /* The delivered answer names the design too — a row she cannot name is a
       row she cannot reject, and `ink.remove` takes a name (fable-1156 §2e). */
    expect(rode.design?.designId).toBe("d-minted");
  });

  it("does NOT mint twice for the same picture at the same place — it rides the row", async () => {
    /*
      The reuse rule at the wire (fable-1149 §2b). A second ask about the same
      picture at the same address must find the row the first one wrote: a mint
      here would be a second $0.010 of house money and a second row that then
      walls her as a conflict.
    */
    const result = await refineCandidate(inkRoad({
      listInkDesigns: async () => [inkDesignRow({ digest: TINY_MASTER_SHA })],
    }), {
      ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public",
    });

    expect(inkMinted, "the same picture was cut a second time").toHaveLength(0);
    expect(painted).toHaveLength(1);
    /*
      AND IT DID NOT ASK AGAIN (ruled fable-1156 §2c). The shown cut fires on a
      FRESH MINT only: the row a reuse finds is one she has already been shown,
      and a question repeated on every render about a decision already taken is
      D-180's dead end wearing a tap target. This is what makes the round trip
      cost once per DESIGN rather than once per render.
    */
    expect(result.kind, "a reuse re-asked a question she had already answered").toBe("rendered");
  });

  it("NAMES THE UNMEASURED SURFACE when the resident sits at one — the road, not a dead end", async () => {
    /*
      RE-AIMED 2026-08-20 by the founder's replace-on-confirm ruling (relayed
      fable-1158 §1), and the re-aim is a repair as well as a change.

      This arm used to assert the flat conflict refusal — *"remove the one you
      don't want and send this again"* — on an ask about her SLEEVE. That
      sentence was a dead end on this fixture and nobody had noticed: `sleeve`
      is not a placement a row can be minted at (the column's type is still the
      measured three), so doing exactly what it told her to do would have met
      the unserved sentence on the next message.

      Now the resolver asks whether the address can hold a row BEFORE it decides
      what to say about the resident, so she gets the sentence with a road in
      it. The `inkMinted` assertion is unchanged and is still the one that
      matters: no house money is spent to produce a refusal.
    */
    const result = await refineCandidate(inkRoad({
      listInkDesigns: async () => [inkDesignRow({
        publicId: "d-resident",
        storageKey: "casting-v2/ink/d-resident.png",
        sourceDigest: "e".repeat(64),
      })],
    }), {
      ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public",
    });

    expect(painted, "a resident design was painted for a picture it did not come from").toHaveLength(0);
    expect(inkMinted, "a picture was cut for an ask that was refused").toHaveLength(0);
    expect(result.note).toContain("her left sleeve is more than I can place yet");
    expect(result.note).toContain("her upper arm");
    expect(result.note).toContain("Nothing was charged.");
  });

  /*
    REPLACE-ON-CONFIRM AT THE WIRE — the founder's amendment, driven end to end
    (ruled fable-1158 §1, atomic shape countersigned fable-1163 §4).

    His words: *"cant is just paint over the original rather than you hving to
    remopve it just replace the reference image provided?"*. Everything below is
    one question and its two answers, and the answers destroy OPPOSITE rows — so
    these arms are driven as the client drives them (the chip's LABEL, the
    handle echoed back) rather than by calling the offer's builder.
  */
  const replaceRoad = (residentOver: Record<string, unknown> = {}) => {
    /*
      THE STUDIO IS STATEFUL BECAUSE THE DATABASE IS. The resident is in it from
      the start; the mint adds the new row; a removal takes one out. A fixed
      double would let the second ask see a world the first one never made, and
      every arm below is about what the SECOND ask does.

      `residentOver` exists for the already-true arms below, and for exactly one
      field: a chain that RECORDS this resident must name it by the shape this
      product mints (`readAppliedInk` drops anything that is not a uuid), so
      those arms hand in a real one rather than this file's readable stand-in.
    */
    const resident = inkDesignRow({
      publicId: "d-resident",
      placement: "upperArm",
      side: "left",
      storageKey: "casting-v2/ink/d-resident.png",
      sourceDigest: "e".repeat(64),
      ...residentOver,
    });
    const studio: Array<Record<string, unknown>> = [resident as unknown as Record<string, unknown>];
    const removals: Array<{ userId: number; designPublicId: string }> = [];
    const road = inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" as const },
        side: "left" as const,
      }),
      listInkDesigns: async () => studio,
      mintInkDesign: async (request: {
        placement: string;
        side: string;
        reference: { digest: string };
        intents: readonly string[];
      }) => {
        inkMinted.push({
          placement: request.placement,
          side: request.side,
          sourceDigest: request.reference.digest,
        });
        const design = inkDesignRow({
          publicId: "d-minted",
          placement: request.placement,
          side: request.side,
          storageKey: "casting-v2/ink/d-minted.png",
          digest: TINY_MASTER_SHA,
          intents: request.intents,
        });
        studio.push(design as unknown as Record<string, unknown>);
        return { ok: true as const, design };
      },
      removeInkDesign: async (request: { userId: number; designPublicId: string }) => {
        removals.push(request);
        const at = studio.findIndex((row) => row.publicId === request.designPublicId);
        if (at < 0) return null;
        studio.splice(at, 1);
        return { designPublicId: request.designPublicId, objectsQueued: 1, remaining: studio.length };
      },
    });
    return { road, studio, removals };
  };

  const ASKED_AT_THE_ARM = "use this tattoo design on her left upper arm";

  it("OFFERS THE REPLACEMENT instead of refusing — and mints FIRST, so she can see it", async () => {
    /*
      MINT-FIRST is the countersigned order (fable-1163 §4) and the SHOWING is
      why: his own doubt about this surface was answered with *"discard is
      free"*, and a preview she cannot see is not a preview.

      So the cut happens before the question — house money, never hers — and
      nothing is claimed. The Cast briefly holds both rows, which is the stated
      cost of that order rather than a surprise.
    */
    const { road, studio } = replaceRoad();
    const result = await refineCandidate(road, {
      ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public",
    });

    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("replace-design");
    /* THE RESIDENT IS NAMED IN THE SENTENCE — the offer's whole content. */
    expect(result.reask?.question).toContain("Her left upper arm already has a design");
    expect(result.reask?.question).toContain("Nothing has been charged.");
    expect(result.reask?.options.map((one) => one.label))
      .toEqual(["Yes — replace it", "No, keep the one she has"]);
    /* The picture beside it is the NEW cut, at an address she can open. */
    expect(result.design?.designId).toBe("d-minted");
    expect(result.design?.imagePath).toBe(inkDesignImagePath("d-minted"));
    /* Mint-first, nothing rendered, nothing charged, and BOTH rows standing. */
    expect(inkMinted).toHaveLength(1);
    expect(painted, "a replacement was painted before she agreed to it").toHaveLength(0);
    expect(ledger.charges, "being offered a replacement cost her credits").toHaveLength(0);
    expect(studio.map((row) => row.publicId)).toEqual(["d-resident", "d-minted"]);
  });

  it("ADOPT deletes the resident and rides the new design — ONE act, ONE claim", async () => {
    /*
      THE ATOMIC SHAPE (fable-1163 §4). The delete happens BEFORE the claim, so
      the only two end states are *nothing happened* and *resident gone, new
      design ridden, charged*. There is no order in which she pays and keeps
      neither.
    */
    const { road, studio, removals } = replaceRoad();
    const offer = await refineCandidate(road, {
      ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public",
    });
    const chip = offer.reask!.options.find((one) => one.label === "Yes — replace it")!;

    const rode = await refineCandidate(road, {
      ...input,
      instruction: chip.label,
      answering: offer.reask!.about,
      referenceId: "ref-public",
    });

    /* THE RESIDENT DIED, by the name the handle carried and under the
       AUTHENTICATED owner (invariant 3, never from input). */
    expect(removals).toEqual([{ userId: input.userId, designPublicId: "d-resident" }]);
    expect(studio.map((row) => row.publicId)).toEqual(["d-minted"]);
    /* AND THE NEW ONE RODE — one cut and one charge across the pair. */
    expect(rode.kind).toBe("rendered");
    expect(inkMinted, "the same picture was cut a second time to answer a question about it")
      .toHaveLength(1);
    expect(ledger.charges, "the round trip cost her two charges").toHaveLength(1);
    expect(painted).toHaveLength(1);
    expect(rode.design?.designId).toBe("d-minted");
  });

  it("DISCARD throws away the NEW design and leaves the resident exactly where it was", async () => {
    /*
      The opposite row from the arm above, off the same handle — which is the
      whole reason the two ids have different readers. A discard that deleted
      the resident would be the worst outcome this road can produce: she said
      *keep the one she has* and it would be gone.
    */
    const { road, studio, removals } = replaceRoad();
    const offer = await refineCandidate(road, {
      ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public",
    });
    const chip = offer.reask!.options.find((one) => one.label === "No, keep the one she has")!;

    const result = await refineCandidate(road, {
      ...input,
      instruction: chip.label,
      answering: offer.reask!.about,
      referenceId: "ref-public",
    });

    expect(removals, "declining a replacement destroyed the design she kept")
      .toEqual([{ userId: input.userId, designPublicId: "d-minted" }]);
    expect(studio.map((row) => row.publicId)).toEqual(["d-resident"]);
    expect(painted, "a declined replacement was rendered").toHaveLength(0);
    expect(ledger.charges, "declining a replacement cost her credits").toHaveLength(0);
    expect(result.note).toContain("Discarded");
  });

  it("NO RESIDENT DIES WITHOUT AN ADOPT — the load-bearing arm", async () => {
    /*
      fable-1158 §1's condition, and the one an ordinary build gets wrong by
      being helpful. Three ways of NOT adopting, each of which leaves the
      resident standing:

        she types something that is not an answer — she has moved on, and it
        runs as a fresh instruction;
        she declines — the arm above, restated here as part of the sweep;
        and the handle names a design that is not the one about to ride, which
        is what a replayed or forged answer looks like.

      The third is the one reasoning alone would have missed: the deletion is
      spent at the RIDE, and both halves of the handle are checked there.
    */
    const { road, studio, removals } = replaceRoad();
    const offer = await refineCandidate(road, {
      ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public",
    });

    /* (1) Not an answer. It runs as an ordinary ask about the same picture at
       the same address — which the studio now holds a row for, so it RIDES
       without anything dying. */
    await refineCandidate(road, {
      ...input,
      instruction: "actually make her hair red",
      answering: offer.reask!.about,
      referenceId: "ref-public",
    });
    expect(removals, "a reply that was not an answer deleted her design").toEqual([]);
    expect(studio.map((row) => row.publicId)).toEqual(["d-resident", "d-minted"]);

    /* (2) A handle naming somebody ELSE'S adopted design. The answer resolves,
       but the row about to ride is not the one the question offered, so nothing
       is destroyed. */
    const forged = offer.reask!.about!.replace("d-minted", "d-somebody-else");
    await refineCandidate(road, {
      ...input,
      instruction: "Yes — replace it",
      answering: forged,
      referenceId: "ref-public",
    });
    expect(removals, "a handle naming a design that was not riding deleted a resident")
      .toEqual([]);
    expect(studio.map((row) => row.publicId)).toEqual(["d-resident", "d-minted"]);
  });

  it("KEEPS THE REFUSAL where two designs sit at one address — nothing to name, nothing cut", async () => {
    /*
      fable-1158 §1: the refusal survives *"only for the corner where the offer
      cannot be shown"*. Two residents is that corner, and the assertion that
      matters is `inkMinted`: the refusal happens before the cut, so it costs no
      house money either.
    */
    const result = await refineCandidate(inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" as const },
        side: "left" as const,
      }),
      listInkDesigns: async () => [
        inkDesignRow({
          publicId: "d-one",
          placement: "upperArm",
          side: "left",
          sourceDigest: "e".repeat(64),
        }),
        inkDesignRow({
          publicId: "d-two",
          placement: "upperArm",
          side: "left",
          sourceDigest: "f".repeat(64),
        }),
      ],
    }), {
      ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public",
    });

    expect(inkMinted, "a picture was cut for an ask that was refused").toHaveLength(0);
    expect(painted).toHaveLength(0);
    expect(ledger.charges).toHaveLength(0);
    expect(result.kind).toBe("selected");
    expect(result.note).toContain("2 designs for her left upper arm");
    expect(result.note).toContain("Nothing was charged.");
  });

  it("AFTER AN ADOPT, A RE-ASK RIDES REUSE — no second question, no second cut", async () => {
    /*
      THE POST-FAILURE STATE, DECIDED RATHER THAN LEFT OVER (fable-1163 §4's
      addition: *"if the render fails AFTER the charge, the adopted design
      REMAINS hers and the re-ask rides reuse without a second mint"*).

      Nothing about the adopt is undone by a later failure, so the row is at the
      address and `inkDesignForAsk` answers `ride`. This arm drives the third
      ask — the one a customer sends after a render that went wrong — and proves
      she meets neither the question nor the cutter a second time.
    */
    const { road } = replaceRoad();
    const offer = await refineCandidate(road, {
      ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public",
    });
    await refineCandidate(road, {
      ...input,
      instruction: "Yes — replace it",
      answering: offer.reask!.about,
      referenceId: "ref-public",
    });

    const again = await refineCandidate(road, {
      ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public",
    });

    expect(again.kind, "a re-ask after an adopt asked the question again").toBe("rendered");
    expect(inkMinted, "a re-ask after an adopt bought a second cut").toHaveLength(1);
    expect(again.design?.designId).toBe("d-minted");
  });

  /*
    AND THE DOOR ONE STEP EARLIER — THE ALREADY-TRUE DOOR LEARNS TO COMPARE
    PICTURES (ruled fable-1173 §1, shape (C) countersigned fable-1174 §1).

    Every arm above starts from a Cast whose CHAIN says nothing about ink. The
    customer the replace offer was built for does not: she is standing on a
    version that already carries a tattoo, which means the chain already holds
    the sentence *"the tattoo design in the attached picture"* — and the ask
    that brings a SECOND design spells that sentence identically, because the
    words name the place and the picture and never the artwork.

    So the already-true door read the second ask as an echo of the first and
    refused it free, 2,000 lines before the offer. The offer was unreachable for
    exactly the person it exists for, and nothing was red.

    The fix compares DIGESTS for this one subject and words for every other, and
    that asymmetry is deliberate — `saysNothingNew`'s own docblock carries the
    reason. These arms are what make it a decision rather than a coincidence:
    the protection is KEPT (same picture, still free) and the wrong refusal is
    gone (different picture, offered).
  */
  describe("a second design at an occupied address is not an echo of the first", () => {
    /** The sentence the interpreter returns for EVERY reference tattoo — the
     *  last-writer-wins fact, made a fixture. */
    const THE_SAME_WORDS = "the tattoo design in the attached picture";

    /**
     * THE RESIDENT'S NAME, IN THE SHAPE THIS PRODUCT MINTS.
     *
     * `readAppliedInk` drops any id that is not a uuid — deliberately, because
     * a stored delta is bytes on disk and "it can only have come from us" is
     * the sentence that precedes every input-validation incident. So a chain
     * fixture naming this file's readable `d-resident` records NOTHING, the
     * gate closes, and every arm here would pass by comparing words. Asked for
     * by the door under test, and that is why it is spelled out.
     */
    const RESIDENT_ID = "1f9d7c62-5a4b-4c8e-9f21-6b3a5d0e7c14";

    /** A second one, for the arm where what she is WEARING is somewhere else. */
    const WORN_ELSEWHERE_ID = "3c7f81ad-92e4-4b16-8d05-71ea4f2c9b38";

    /**
     * The branch a paid ink render left behind: her words, and OUR pointer.
     *
     * `applied` is passed explicitly by every caller — a default would let a
     * negative control pass as a positive one, which is the trap the carry
     * suite already paid for once.
     */
    const standingOnAnInkedVersion = (
      applied: Record<string, string> | null,
      alsoWearing: Record<string, string[]> = {},
    ) => {
      const delta = {
        free: { ink: [THE_SAME_WORDS], ...alsoWearing },
        ...(applied ? { inkApplied: applied } : {}),
      };
      variantRows = [{
        id: 907,
        publicId: "variant-inked",
        candidateId: 1,
        imageKey: "casting-v2/variants/inked.png",
        internalPrompt: candidateRow.internalPrompt as Record<string, unknown>,
        instructions: [ASKED_AT_THE_ARM],
        deltas: delta,
        stepDeltas: [delta],
        status: "ready",
      }];
      candidateRow.selectedVariantPublicId = "variant-inked";
    };

    /** How many times her studio was read on this ask — the cost half of the
     *  ruling, counted rather than asserted in prose. */
    let studioReads = 0;
    const counting = (rows: () => Array<Record<string, unknown>>) => async () => {
      studioReads += 1;
      return rows();
    };
    beforeEach(() => { studioReads = 0; });

    it("KEEPS THE PROTECTION — the same picture at the same place, again, is still free", async () => {
      /*
        RED FIRST, and it is the arm that fails if this fix is written as
        *"stand aside for any ink ask carrying a reference"* — the one-line
        road that was refused (opus-871 §4 (A)). She sends the identical ask
        twice; the second is a render that would change nothing, and it is the
        25-credit mistake this door was built to stop.
      */
      const resident = inkDesignRow({
        publicId: RESIDENT_ID,
        placement: "upperArm",
        side: "left",
        storageKey: "casting-v2/ink/d-resident.png",
        /* IT CAME OUT OF THE PICTURE SHE IS POINTING AT — the reuse key. */
        sourceDigest: REFERENCE.digest,
      });
      standingOnAnInkedVersion({ "ink:upperArm@left": RESIDENT_ID });

      await expect(refineCandidate(
        inkRoad({
          inkTake: async () => ({
            placement: { kind: "measured" as const, placement: "upperArm" as const },
            side: "left" as const,
          }),
          listInkDesigns: counting(() => [resident as unknown as Record<string, unknown>]),
        }),
        { ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public" },
      )).rejects.toThrow(/already has/);

      expect(ledger.charges, "an identical re-ask was charged for").toHaveLength(0);
      expect(painted, "an identical re-ask was rendered").toHaveLength(0);
      expect(inkMinted, "an identical re-ask bought a cut").toHaveLength(0);
    });

    it("REACHES THE OFFER — a DIFFERENT picture at that same place is not an echo", async () => {
      /*
        THE CUSTOMER THE FEATURE IS FOR. Same address, same words, different
        artwork. Before this fix she was told *"she already has that"* about a
        design she had never seen.
      */
      const { road, studio } = replaceRoad({ publicId: RESIDENT_ID });
      standingOnAnInkedVersion({ "ink:upperArm@left": RESIDENT_ID });

      /*
        AND THE READING IS COUNTED, which is what pins the fix to the FIRST
        verdict rather than to the retry.

        The door asks once more before it refuses, and the second reading of
        this same sentence carries the same pointer — so a fix wired only into
        the retry reaches the offer too, and every arm here would pass while a
        customer paid an extra interpreter call for the privilege. Measured
        rather than reasoned: two readings is the sabotage, one is the fix.
      */
      let readings = 0;
      const result = await refineCandidate(
        { ...road, interpret: async () => {
          readings += 1;
          return {
            ok: true as const,
            fromReference: true,
            delta: { free: { ink: THE_SAME_WORDS } },
          };
        } } as never,
        { ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public" },
      );

      expect(readings, "the restatement retry fired on an ask the door should never have held")
        .toBe(1);
      expect(result.kind, "the already-true door swallowed the second design").toBe("asked");
      expect(result.reask?.kind).toBe("replace-design");
      expect(result.reask?.question).toContain("Her left upper arm already has a design");
      /* Free, and both rows standing, exactly as the offer's own arms have it. */
      expect(ledger.charges).toHaveLength(0);
      expect(painted).toHaveLength(0);
      expect(studio.map((row) => row.publicId)).toEqual([RESIDENT_ID, "d-minted"]);
    });

    it("STANDS ASIDE FROM A HAND-UPLOADED RESIDENT — it came out of no picture", async () => {
      /*
        `sourceDigest` is null for every design uploaded through the studio
        door, and no digest can equal a null. So an ask pointing at a picture
        is never absorbed into a design that did not come out of one — the
        safety is a property of the column's own emptiness (migration 0048)
        rather than of a branch somebody remembered to write.
      */
      const resident = inkDesignRow({
        publicId: RESIDENT_ID,
        placement: "upperArm",
        side: "left",
        storageKey: "casting-v2/ink/d-resident.png",
        sourceDigest: null,
      });
      const studio: Array<Record<string, unknown>> = [resident as unknown as Record<string, unknown>];
      standingOnAnInkedVersion({ "ink:upperArm@left": RESIDENT_ID });

      const result = await refineCandidate(
        inkRoad({
          inkTake: async () => ({
            placement: { kind: "measured" as const, placement: "upperArm" as const },
            side: "left" as const,
          }),
          listInkDesigns: async () => studio,
          mintInkDesign: async (request: {
            placement: string;
            side: string;
            reference: { digest: string };
            intents: readonly string[];
          }) => {
            inkMinted.push({
              placement: request.placement,
              side: request.side,
              sourceDigest: request.reference.digest,
            });
            const design = inkDesignRow({
              publicId: "d-minted",
              placement: request.placement,
              side: request.side,
              storageKey: "casting-v2/ink/d-minted.png",
              digest: TINY_MASTER_SHA,
              intents: request.intents,
            });
            studio.push(design as unknown as Record<string, unknown>);
            return { ok: true as const, design };
          },
        }),
        { ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public" },
      );

      expect(result.kind, "a hand-uploaded resident absorbed an ask that points at a picture")
        .toBe("asked");
      expect(result.reask?.kind).toBe("replace-design");
      expect(ledger.charges).toHaveLength(0);
    });

    it("THE WORDS-ONLY LANE IS UNTOUCHED — no picture, so nothing to compare", async () => {
      /*
        `askDigest` is null for an ask carrying no reference, and a null never
        stands the door aside. This is the lane every ink customer was on
        before the attach door existed, and it must behave today exactly as it
        behaved yesterday.

        The studio is never read either: the door's gate is *she attached a
        picture*, and this ask did not.
      */
      standingOnAnInkedVersion({ "ink:upperArm@left": RESIDENT_ID });

      await expect(refineCandidate(
        inkRoad({ listInkDesigns: counting(() => []) }),
        { ...input, instruction: ASKED_AT_THE_ARM },
      )).rejects.toThrow(/already has/);

      expect(studioReads, "a words-only ask read her studio at the door").toBe(0);
      expect(ledger.charges).toHaveLength(0);
    });

    it("THE ORDINARY ASK PAYS NOTHING — a hair ask on an inked Cast reads the studio ONCE", async () => {
      /*
        THE COST HALF OF THE RULING, and the negative control for the gate.

        The one read this ask makes is the CARRY's — the recipe asking which
        designs are already on her so the tattoo survives an edit that never
        mentions it. The door adds none, because `namesInkFromReference` is
        false for a hair ask, and if that gate were ever deleted this number
        would be two.
      */
      standingOnAnInkedVersion({ "ink:upperArm@left": RESIDENT_ID });

      const result = await refineCandidate(
        carrierRoad({ listInkDesigns: counting(() => []) }),
        { ...input, instruction: "copy this hairstyle", referenceId: "ref-public" },
      );

      expect(result.kind, "an ordinary hair ask stopped rendering").toBe("rendered");
      expect(studioReads, "the already-true door read her studio on an ask about hair").toBe(1);
    });

    it("COMPARES ONLY WHAT THE CHAIN SAYS IS ON HER — a design in the drawer absorbs nothing", async () => {
      /*
        THE ARM THAT MAKES `recorded.has` A DECISION.

        Her studio holds a design cut from THIS picture that no step ever
        applied — the ordinary state of a Cast whose owner has been trying
        things. It is a picture in a drawer, not something she is wearing, so
        it cannot be what a restatement is restating. Compared against her
        whole studio instead of against the chain's own record, this ask would
        match it and she would be told she already has a tattoo that is on
        nobody.

        She is standing on a version wearing a DIFFERENT design somewhere else
        entirely, which is what keeps the gate open and makes this arm about
        the filter rather than about the gate.
      */
      const wornOnHerNeck = inkDesignRow({
        publicId: WORN_ELSEWHERE_ID,
        placement: "neck",
        side: "centre",
        storageKey: "casting-v2/ink/d-neck.png",
        sourceDigest: "e".repeat(64),
      });
      const inTheDrawer = inkDesignRow({
        publicId: "d-drawer",
        placement: "upperArm",
        side: "left",
        storageKey: "casting-v2/ink/d-drawer.png",
        /* Cut from the picture she is pointing at — and applied to nothing. */
        sourceDigest: REFERENCE.digest,
        digest: TINY_MASTER_SHA,
      });
      standingOnAnInkedVersion({ "ink:neck": WORN_ELSEWHERE_ID });

      const result = await refineCandidate(
        inkRoad({
          inkTake: async () => ({
            placement: { kind: "measured" as const, placement: "upperArm" as const },
            side: "left" as const,
          }),
          listInkDesigns: async () => [
            wornOnHerNeck as unknown as Record<string, unknown>,
            inTheDrawer as unknown as Record<string, unknown>,
          ],
        }),
        { ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public" },
      );

      /* It rides the row she already has for this picture — the reuse rule —
         rather than being refused for wearing something she is not wearing. */
      expect(result.kind, "a design in the drawer absorbed the ask").toBe("rendered");
      expect(result.design?.designId).toBe("d-drawer");
      expect(inkMinted, "reuse bought a second cut").toHaveLength(0);
    });

    it("AND THE RETRY CARRIES THE PICTURE TOO — a reading that loses her ask still reaches the offer", async () => {
      /*
        THE SECOND CALL SITE, AND IT IS NOT DECORATION.

        This door asks once more before it refuses, because a reading
        sometimes comes back holding only a restatement and drops the ask
        (fable-460, measured at 1 of 3). So the sequence that gets here is:
        reading one loses the tattoo and echoes her hair, the door absorbs it,
        the retry recovers the tattoo — and the RETRY's verdict is the one
        that decides. A pointer wired into the first verdict alone would
        refuse her at that second door, which is the same wrong refusal one
        reading later.

        Reading one names no ink, so it carries no pointer at all — which is
        what makes this arm about the retry rather than a copy of the one
        above.
      */
      const { road, studio } = replaceRoad({ publicId: RESIDENT_ID });
      standingOnAnInkedVersion(
        { "ink:upperArm@left": RESIDENT_ID },
        { hairCut: ["a mid-length wavy cut"] },
      );

      let readings = 0;
      const result = await refineCandidate(
        { ...road, interpret: async () => {
          readings += 1;
          return readings === 1
            /* The ask, lost — only her hair, which she already has. */
            ? { ok: true as const, delta: { free: { hairCut: "a mid-length wavy cut" } } }
            : {
              ok: true as const,
              fromReference: true,
              delta: { free: { ink: THE_SAME_WORDS } },
            };
        } } as never,
        { ...input, instruction: ASKED_AT_THE_ARM, referenceId: "ref-public" },
      );

      expect(readings, "the retry never fired").toBe(2);
      expect(result.kind, "the retry's verdict refused a design she has never seen").toBe("asked");
      expect(result.reask?.kind).toBe("replace-design");
      expect(studio.map((row) => row.publicId)).toEqual([RESIDENT_ID, "d-minted"]);
      expect(ledger.charges).toHaveLength(0);
    });
  });

  /*
    AND THE OFFER SAYS WHICH HALF OF HER PICTURE THE CUT CAME OUT OF (ruled
    fable-1172 §2a).

    This is the condition road (c) was ruled ON. The side of a source
    photograph is decided by image geometry, and geometry assumes a subject
    facing the camera — a photograph taken from behind swaps the halves back.
    (b), the honest refusal, was refused because *"discard is free"*; that
    argument only holds if the preview says what was GUESSED, so a customer
    looking at an arm can tell it was chosen rather than found.

    Driven at the wire, on the question a customer actually receives, because a
    sentence proved next to its builder is a sentence nobody was shown.
  */
  describe("the offer names the half of the picture the cut came from", () => {
    const focused = (focus: { region: string; half: "left" | "right"; fellBack: boolean } | null) => ({
      mintInkDesign: async (request: {
        placement: string;
        side: string;
        reference: { digest: string };
        intents: readonly string[];
      }) => {
        inkMinted.push({
          placement: request.placement,
          side: request.side,
          sourceDigest: request.reference.digest,
        });
        return {
          ok: true as const,
          focus,
          design: inkDesignRow({
            publicId: "d-minted",
            placement: request.placement,
            side: request.side,
            storageKey: "casting-v2/ink/d-minted.png",
            digest: TINY_MASTER_SHA,
          }),
        };
      },
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" as const },
        side: "left" as const,
      }),
      listInkDesigns: async () => [],
    });

    it("SAYS WHICH HALF on a fresh cut — and the words come from the one owner", async () => {
      const result = await refineCandidate(
        inkRoad(focused({ region: "upper arm", half: "right", fellBack: false })),
        { ...input, instruction: "use this tattoo design on her left upper arm", referenceId: "ref-public" },
      );

      expect(result.kind).toBe("asked");
      expect(result.reask?.kind).toBe("this-design");
      /* Derived from `sidePhrasing.pictureHalfPhrase`, never respelled in the
         assertion either — a test that spells the phrase is a second copy of
         the thing the module exists to own. */
      expect(result.reask?.question).toContain(`I took it from the upper arm ${pictureHalfPhrase("right")}`);
      expect(result.reask?.question).toContain("Nothing has been charged.");
      /* Still free, still nothing painted. */
      expect(ledger.charges).toHaveLength(0);
      expect(painted).toHaveLength(0);
    });

    it("SAYS IT DIFFERENTLY WHEN IT FELL BACK — she is told it is not the side she asked for", async () => {
      /*
        The half she named held no design and the other one did. Naming the
        half without saying it differs from her ask would be true and
        misleading in one breath — she would read it as confirmation.
      */
      const result = await refineCandidate(
        inkRoad(focused({ region: "upper arm", half: "left", fellBack: true })),
        { ...input, instruction: "use this tattoo design on her left upper arm", referenceId: "ref-public" },
      );

      expect(result.reask?.question)
        .toContain(`The only upper arm with a design on it is ${pictureHalfPhrase("left")}`);
      expect(result.reask?.question).toContain("so that is the one I took");
    });

    it("SAYS NOTHING ABOUT A HALF when the cut narrowed nothing — the negative control", async () => {
      /*
        A flash sheet has no arm in it, so nothing was narrowed and no half was
        chosen. A sentence claiming one here would describe a decision the cut
        did not make — and it is the sentence a customer would rely on.
      */
      const result = await refineCandidate(
        inkRoad(focused(null)),
        { ...input, instruction: "use this tattoo design on her left upper arm", referenceId: "ref-public" },
      );

      expect(result.reask?.question).toBe(
        "This is the design I took out of your picture. Use it? Nothing has been charged.",
      );
    });

    it("does NOT say it again on a RIDE — the row was shown once, when it was cut", async () => {
      /*
        A reuse ride finds a row she has already looked at. Re-describing which
        half of a picture it came from, on every later render, is the repeated
        question D-180 forbids — and there is no fresh cut to describe.
      */
      const design = inkDesignRow({
        publicId: "d-ridden",
        placement: "upperArm",
        side: "left",
        digest: TINY_MASTER_SHA,
      });
      const result = await refineCandidate(
        inkRoad({
          ...focused({ region: "upper arm", half: "right", fellBack: false }),
          listInkDesigns: async () => [design],
        }),
        { ...input, instruction: "use this tattoo design on her left upper arm", referenceId: "ref-public" },
      );

      expect(result.kind, "a ride asked a question").toBe("rendered");
      expect(inkMinted, "a ride bought a cut").toHaveLength(0);
    });
  });

  it("ASKS which arm — a question with chips, not a sentence telling her to retype", async () => {
    /*
      Released fable-1120 §4 on the condition that an answer leads somewhere,
      and built once the mint gave it that. The refusal it replaces was honest
      and was still a wall: the one thing missing is a word she can supply with
      a tap.
    */
    const result = await refineCandidate(inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" as const },
        side: null,
      }),
      listInkDesigns: async () => [],
    }), {
      ...input, instruction: "use this tattoo design on her arm", referenceId: "ref-public",
    });

    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("which-side");
    expect(result.reask?.options.map((one) => one.label)).toEqual(["Her left", "Her right"]);
    /* FREE, and nothing was cut while it asks. */
    expect(painted).toHaveLength(0);
    expect(inkMinted, "a picture was cut before the side was known").toHaveLength(0);
  });

  it("AND THE ANSWER CLOSES THE LOOP — the chip lands the design on the arm she named", async () => {
    /*
      THE ARM THAT WOULD CATCH A CHIP THAT DOES NOT ANSWER ITS OWN QUESTION.

      The take accepts a side only when the WORD IS IN HER SENTENCE (source
      containment, D-79, on the one field where a confident guess is a refund).
      So this arm runs the REAL take over a scripted model reply rather than a
      stub that agrees: if the chip's `resolves` put the side beside her
      sentence instead of in it, containment would drop it, the address would
      come back sideless, and the question would be asked a second time — the
      loop a question exists to end.
    */
    const raised = whichSideReask("use this tattoo design on her upper arm");
    const chip = raised.options.find((one) => one.label === "Her right")!;

    const result = await refineCandidate(inkRoad({
      listInkDesigns: async () => [],
      /* The real reader, over a scripted reply. The model says "arm" and
         "right"; the CODE decides whether the word is hers. */
      inkTake: async ({ instruction }: { instruction: string }) => resolveInkReferenceTake({
        instruction,
        engine: {
          id: "test:take",
          complete: async () => ({ text: '{"placement":"upper arm","side":"right"}' }),
        } as never,
      }),
    }), {
      ...input,
      /*
        THE LABEL, WHICH IS WHAT THE CLIENT SENDS — never the `resolves`.

        `RefinePanel` submits `option.label` and echoes `about`; the server
        rebuilds the question by its handle and maps the label back. An arm that
        posted the resolved sentence would skip both of those and prove a road
        nobody travels (`entrance-before-the-road`).
      */
      instruction: chip.label,
      answering: raised.about,
      referenceId: "ref-public",
    });

    /* THE MINT WAS ASKED FOR HER RIGHT — not her left, and not nothing. */
    expect(inkMinted).toEqual([
      { placement: "upperArm", side: "right", sourceDigest: REFERENCE.digest },
    ]);
    /*
      AND THE LOOP CLOSED ONTO THE SHOWN CUT rather than asking the SAME
      question again — which is the thing this arm exists to catch (fable-1156
      re-anchored it; before the shown cut the loop closed onto the render).

      The two questions are distinguishable by kind, so a side question raised a
      second time would redden here rather than passing as "still asking".
    */
    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("this-design");
    expect(result.design?.designId).toBe("d-minted");
  });

  it("THE DECLINE THROWS THE DESIGN AWAY — free, and nothing is rendered", async () => {
    /*
      THE OTHER HALF OF "SEE OR REJECT" (ruled fable-1156 §2a).

      A shown cut she cannot refuse is a viewing window, not a decision. This
      arm drives the decline exactly as the client sends it — the chip's LABEL,
      with the question's handle echoed back — and asserts the three things that
      make it a rejection rather than a shrug:

        the design is DELETED, by the name the handle carried and under the
        AUTHENTICATED owner (invariant 3, never from input);
        nothing is painted, because a sentinel that reached the interpreter
        would be read as an ordinary ask and RENDERED — the charge this whole
        question stands in front of;
        and nothing is charged.

      What "nothing remains" means for the row and its bytes is proved against a
      real database in `castingV2-ink-design-db.test.ts`, where the deletion and
      its cleanup manifest live in one transaction. What is proved HERE is the
      wire into it, which is the half that did not exist.
    */
    const removals: Array<{ userId: number; designPublicId: string }> = [];
    const road = inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "upperArm" as const },
        side: "left" as const,
      }),
      listInkDesigns: async () => [],
      removeInkDesign: async (request: { userId: number; designPublicId: string }) => {
        removals.push(request);
        return { designPublicId: request.designPublicId, objectsQueued: 1, remaining: 0 };
      },
    });

    const offer = await refineCandidate(road, {
      ...input,
      instruction: "use this tattoo design on her left upper arm",
      referenceId: "ref-public",
    });
    const chip = offer.reask!.options.find((one) => one.label === "No, discard it")!;

    const result = await refineCandidate(road, {
      ...input,
      instruction: chip.label,
      answering: offer.reask!.about,
      referenceId: "ref-public",
    });

    expect(removals, "the design she declined was kept anyway").toEqual([
      { userId: input.userId, designPublicId: "d-minted" },
    ]);
    expect(painted, "a declined design was rendered — the sentinel reached the parse")
      .toHaveLength(0);
    expect(ledger.charges, "declining a cut cost her credits").toHaveLength(0);
    expect(result.kind).toBe("selected");
    expect(result.note).toContain("Discarded");
    expect(result.note).toContain("nothing was charged");
  });

  it("RESOLVES FOR AN INK-ONLY ACCOUNT — the two runs the drive lost", async () => {
    /*
      THE END-TO-END HALF OF fable-1163 §2, and the reason it is here rather
      than only in `askReference.test.ts`.

      `resolveAskReference` gated on the HAIR flag for the whole life of the ink
      road. An account inside `CASTING_INK_REFERENCE_SCOPE` and outside the hair
      scope attached a picture, pointed at it for a tattoo, and was told **"That
      picture isn't attached to this Cast any more"** — about a picture that was
      attached. Not one arm in this suite could see it: they all inject
      `inkReferenceEnabled` and stub the resolution, so the road was proven
      everywhere except at the door it comes through.

      This arm is that account. The hair road is SHUT for her and the tattoo ask
      still reaches the cut.
    */
    const result = await refineCandidate(inkRoad({
      hairReferenceEnabled: () => false,
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "neck" as const },
        side: "centre" as const,
      }),
      listInkDesigns: async () => [],
    }), {
      ...input, instruction: "use this tattoo design on her neck", referenceId: "ref-public",
    });

    expect(inkMinted, "an ink-only account's picture never reached the cutter").toHaveLength(1);
    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("this-design");
    /* And not a word about her picture being unattached — the sentence the
       defect produced. */
    expect(result.note ?? "").not.toContain("isn't attached");
  });

  it("and the SAME account's hair ask is refused at the lane, not served for free", async () => {
    /*
      THE OTHER HALF, and the reason the gate's OR could not ship alone: until
      that commit there was no other live reader of the hair flag anywhere in
      the product, so widening the gate would have handed an ink-only account
      the hair crop road for nothing.

      Her picture is CONFESSED rather than silently ignored — she attached one
      and nothing was taken from it, which is the line D-181 has required since
      the dropped reference went unmentioned for its whole life.
    */
    const result = await refineCandidate(inkRoad({
      hairReferenceEnabled: () => false,
      interpret: async () => ({
        ok: true as const,
        fromReference: true,
        delta: { free: { hairWorn: "the hairstyle in the attached picture" } },
      }),
    }), {
      ...input, instruction: "copy this hairstyle", referenceId: "ref-public",
    });

    expect(minted, "an ink-only account had a HAIR carrier cut for it").toHaveLength(0);
    expect(inkMinted, "a hair ask reached the ink cutter").toHaveLength(0);
    expect(result.note ?? "", "her picture went unused and unmentioned").toContain("picture");
  });

  it("leaves a HAIR-ONLY account exactly as it was — both ways", async () => {
    /*
      The unchanged control. The fix must be invisible to everyone who was
      already on the hair road: her crop is still cut, and the ink road she is
      not on still does not open for her.
    */
    const hairOnly = await refineCandidate(inkRoad({
      hairReferenceEnabled: () => true,
      inkReferenceEnabled: () => false,
      interpret: async () => ({
        ok: true as const,
        fromReference: true,
        delta: { free: { hairWorn: "the hairstyle in the attached picture" } },
      }),
    }), {
      ...input, instruction: "copy this hairstyle", referenceId: "ref-public",
    });
    expect(minted, "the hair road stopped cutting for the account it was built for")
      .toHaveLength(1);
    expect(hairOnly.kind).toBe("rendered");

    minted.length = 0;
    /*
      AND HER TATTOO ASK MEETS THE DOCUMENT GATE, exactly as it did before any
      of this — D-137's wall, thrown rather than returned, because a tattoo
      documented by nothing is the render that gate exists to stop. The point of
      the assertion is what is ABSENT: no cut was bought for an account outside
      the ink flag, and the OR at the resolver did not change that.
    */
    await expect(refineCandidate(inkRoad({
      hairReferenceEnabled: () => true,
      inkReferenceEnabled: () => false,
      listInkDesigns: async () => [],
    }), {
      ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public",
    })).rejects.toThrow(/Nothing was charged/);
    expect(inkMinted, "the ink road opened for an account outside its flag").toHaveLength(0);
  });

  it("names the surfaces that work when she asks for one nobody has measured", async () => {
    /*
      Ordered fable-1152 §1c. The design row's placement type is still the
      measured three, and widening it forces an unmeasured answer on the paid
      package-view road — so the mint serves those three and says so.

      It REPLACES a worse sentence rather than adding a wall: until today this
      ask was told *"send me the tattoo you want"* by a gate that could not see
      she had just attached one.
    */
    const result = await refineCandidate(inkRoad({ listInkDesigns: async () => [] }), {
      ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public",
    });

    expect(painted).toHaveLength(0);
    expect(inkMinted, "an unservable placement was cut anyway").toHaveLength(0);
    expect(result.note).toContain("her neck");
    expect(result.note).toContain("her upper arm");
    expect(result.note).toContain("her upper chest");
    expect(result.note).toContain("sleeve");
    expect(result.note).toContain("Nothing was charged.");
  });

  it("REFUSES FREE when the cut fails, and files no design at all", async () => {
    /*
      fable-1148 §3b at the wire. The mint's own suite proves nothing is left
      behind; this proves the DOOR — that the cutter's sentence reaches her
      unchanged, before any claim, and that no render happens on the way.
    */
    const result = await refineCandidate(inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "neck" as const },
        side: "centre" as const,
      }),
      listInkDesigns: async () => [],
      mintInkDesign: async () => ({
        ok: false as const,
        refusal: {
          code: "cut" as const,
          message: "That looks like a design on a model's arm — I can't safely take it from there. Nothing was charged.",
        },
      }),
    }), {
      ...input, instruction: "use this tattoo design on her neck", referenceId: "ref-public",
    });

    expect(painted, "a refused mint still painted").toHaveLength(0);
    expect(result.note).toContain("design on a model's arm");
    expect(result.note).toContain("Nothing was charged.");
  });

  /*
    AND BYTES THAT HAVE MOVED SINCE THE ROW RECORDED THEM REFUSE RATHER THAN
    PAINT (fable-1137 §3b).

    This arm exists because the build handed it to me: the first version of the
    arm above carried an invented digest, and the render refused it with
    `referenceBytesChanged` before anything was painted. That is the control
    working on real machinery rather than on a check written beside it —
    `repaintRender` re-hashes EVERY reference it loads and compares against the
    sha the recipe named, so the design road inherits the refusal instead of
    needing its own.

    Kept as its own arm because a control discovered by accident is a control
    nobody has decided to keep. This is the deciding.
  */
  it("REFUSES a design whose bytes are not the ones its row recorded", async () => {
    await refineCandidate(
      inkRoad({ listInkDesigns: async () => [inkDesignRow({ digest: "b".repeat(64) })] }),
      { ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public" },
    ).then(() => expect.unreachable("moved bytes must not paint"), () => undefined);

    expect(painted, "a design was painted from bytes its row does not describe").toHaveLength(0);
    const refusal = logged.find((line) => line.fields.reason === "referenceBytesChanged");
    expect(refusal, "the refusal was not the digest one").toBeDefined();
    expect(refusal!.fields.key).toBe("casting-v2/ink/d-sleeve.png");
  });

  /*
    A NECK ASK — THE ORDINARY ONE, and the arm a sabotage proved was missing.

    Every other arm on this road names a per-side placement, so all of them were
    green with `slotPlacementOf`'s `centre` → `null` translation broken. A neck
    take carries side `centre` (`sidesForInkPlacement`), and without the
    translation the ask would look for `ink:neck@centre` — a key the closed
    suffix grammar refuses — and the most ordinary tattoo request on the road
    would be walled as unplaced.
  */
  it("RIDES a neck design, where the side is `centre` rather than a side", async () => {
    const neck = inkDesignRow({
      publicId: "d-neck",
      placement: "neck",
      side: "centre",
      storageKey: "casting-v2/ink/d-neck.png",
      digest: TINY_MASTER_SHA,
    });
    await refineCandidate(inkRoad({
      inkTake: async () => ({
        placement: { kind: "measured" as const, placement: "neck" as const },
        side: "centre" as const,
      }),
      listInkDesigns: async () => [neck],
    }), { ...input, instruction: "put this tattoo on her neck", referenceId: "ref-public" });

    expect(painted, "a neck ask was walled").toHaveLength(1);
    expect(painted[0]!.references).toHaveLength(2);
    /* The slot's own noun, with no side in it — which is what `centre` means. */
    expect(painted[0]!.prompt).toContain("neck tattoo");
    expect(painted[0]!.prompt).not.toContain("centre");
  });

  it("REFUSES FREE when she has two designs at that place, naming the count", async () => {
    /*
      (iii), at the wire (ruled fable-1145 §4). The pure resolver's own suite
      proves the sentence; this proves the DOOR — that the refusal happens
      before the claim and nothing is dispatched, which is the half a unit test
      of a pure function cannot see.

      MOVED TO A MEASURED PLACEMENT 2026-08-20, and it had to be: this arm asked
      about her SLEEVE, where the honest refusal is now that the surface is one
      no row can be minted at. The count sentence survives only where an offer
      COULD have been shown and could not name what it would destroy, which is a
      measured address holding two designs (fable-1158 §1).

      Both rows are HAND-UPLOADED here, which the replace-offer arms above are
      not — the two makers between them keep the family mixed (fable-1150 §1)
      rather than proving this door against one kind of row twice.
    */
    const at = (publicId: string) => inkDesignRow({
      publicId,
      placement: "upperArm",
      side: "left",
      storageKey: `casting-v2/ink/${publicId}.png`,
      sourceDigest: null,
    });
    const result = await refineCandidate(
      inkRoad({
        inkTake: async () => ({
          placement: { kind: "measured" as const, placement: "upperArm" as const },
          side: "left" as const,
        }),
        listInkDesigns: async () => [at("d-one"), at("d-two")],
      }),
      { ...input, instruction: "use this tattoo design on her left upper arm", referenceId: "ref-public" },
    );

    expect(painted, "an ambiguous ask was painted").toHaveLength(0);
    expect(result.note).toContain("2 designs");
    expect(result.note).toContain("Nothing was charged.");
  });

  it("REFUSES FREE a design nobody has looked at — before the claim, not after", async () => {
    /*
      1137 §4's control at its PRE-CLAIM door (ruled fable-1146 §3). `cutRoute:
      null` is the recorded fact that the cutter was off when those bytes were
      stored, so what sits at `storageKey` is her uploaded picture rather than
      the design cut out of it — possibly a photograph of a person.

      The assembler keeps its own arm as the backstop, driven separately with
      this door bypassed, because a guard whose only test runs through a door
      that usually behaves is not a tested guard.
    */
    const result = await refineCandidate(inkRoad({
      listInkDesigns: async () => [inkDesignRow({ publicId: "d-old", cutRoute: null })],
    }), { ...input, instruction: "use this tattoo design on my left sleeve", referenceId: "ref-public" });

    expect(painted, "an unexamined picture reached an engine").toHaveLength(0);
    const said = result.note ?? "";
    expect(said).toContain("Nothing was charged.");
    /* Her sentence is about her picture, never about our configuration. */
    expect(said.toLowerCase()).not.toContain("flag");
    expect(said.toLowerCase()).not.toContain("scope");
  });

  it("does not fire for a hair ask riding the same picture — the negative control", async () => {
    /*
      Without this, a branch that fired on `reference && fromReference` alone
      would swallow every reference ask on the account and the arm above would
      still pass. The hair road must be untouched.
    */
    await refineCandidate(inkRoad({
      interpret: async () => ({
        ok: true as const,
        fromReference: true,
        delta: { free: { hairCut: "a mid-length wavy cut" } },
      }),
      hairTake: async () => "style" as const,
    }), { ...input, instruction: "copy this hairstyle", referenceId: "ref-public" });

    expect(painted, "the hair road stopped dispatching").toHaveLength(1);
  });

  /** The outcome, however it arrived — a note or a spoken refusal. Both roads
   *  say something to her, and the negative controls below are about WHICH. */
  const said = async (deps: Record<string, unknown>, instruction: string): Promise<string> => {
    try {
      const result = await refineCandidate(deps, { ...input, instruction, referenceId: "ref-public" });
      return result.note ?? `<${result.kind}>`;
    } catch (error) {
      return (error as Error).message;
    }
  };

  it("does not fire while the flag is off — the road she is not on", async () => {
    /*
      With the arm shut her ask meets the door it always met, and that door is
      not this branch. What this proves is that the branch is behind the FLAG
      and not behind the picture — a branch keyed on the picture alone would
      answer here and the arm above would still be green.
    */
    const off = await said(inkRoad({ inkReferenceEnabled: () => false }),
      "use this tattoo design on my left sleeve");

    expect(painted).toHaveLength(0);
    expect(off).not.toContain("I've got the design from your picture");
  });

  it("does not fire for a tattoo ask that never pointed at the picture", async () => {
    /* `fromReference` is the condition, not the handle: a picture riding along
       while she asks for something else documents nothing. */
    const unpointed = await said(inkRoad({
      interpret: async () => ({
        ok: true as const,
        delta: { free: { ink: "a small anchor on her neck" } },
      }),
    }), "give her a small anchor tattoo on her neck");

    expect(unpointed).not.toContain("I've got the design from your picture");
  });

  it("answers a MARK that names a design too — the star's own scar", async () => {
    /* D-158 in this branch: "a small star behind her ear" carries no word
       "tattoo" and files as a mark. If only `ink` reached here it would fall
       through to the hair lane and be rendered from words. */
    const result = await refineCandidate(inkRoad({
      interpret: async () => ({
        ok: true as const,
        fromReference: true,
        delta: { free: { marks: ["a small star from the attached picture"] } },
      }),
      inkTake: async () => ({ placement: { kind: "measured" as const, placement: "neck" as const }, side: "centre" as const }),
    }), { ...input, instruction: "put this star from the picture on her neck", referenceId: "ref-public" });

    /*
      RE-ANCHORED 2026-08-20 with the mint, and the routing fact it protects is
      unchanged. Before the mint this ask had nowhere to go and the evidence
      was the sentence; now it goes all the way, and the evidence is that the
      INK road handled it — a mark that fell through to the hair lane would cut
      a hair carrier and mint no design at all.
    */
    expect(minted, "a mark naming a design cut a HAIR carrier").toHaveLength(0);
    expect(inkMinted).toEqual([
      { placement: "neck", side: "centre", sourceDigest: REFERENCE.digest },
    ]);
    /*
      RE-ANCHORED AGAIN 2026-08-20 (fable-1156 §2), and the routing fact is
      still the whole point of this arm: a mark that fell through to the hair
      lane would cut a HAIR carrier and mint no design at all. What moved is
      where the ink road STOPS — at the shown cut rather than at the render — so
      the evidence is the offer about the row it minted.
    */
    expect(result.kind).toBe("asked");
    expect(result.reask?.kind).toBe("this-design");
  });

  it("says the picture landed even when the sentence could not be read", async () => {
    const result = await refineCandidate(inkRoad({ inkTake: async () => null }), {
      ...input, instruction: "use this tattoo design", referenceId: "ref-public",
    });

    expect(painted).toHaveLength(0);
    expect(result.note).toContain("couldn't tell where on her you meant");
  });
});


/*
  A REGENERATE RE-SENDS THE PICTURE SHE ATTACHED — the arm ordered in
  fable-1086, and it is now a question about STRUCTURE rather than about care.

  The design answer given to the founder was that a regenerate re-runs the SAME
  ask against the SAME parent state, so the ask holds its `referenceId`, the
  recipe re-composes with the original crop, and the failed attempt's harvest
  dies with the picture it came from — the reference keeps riding until a
  delivery is KEPT.

  With the source role in the type, that answer is true by construction rather
  than by anyone remembering it: a source belongs to an ask, so re-running the
  ask re-rides the source, and there is no path on which a replaced version's
  crop can arrive in its place. This arm drives both halves anyway, because
  "true by construction" is a claim about a road nobody has walked until a test
  walks it.
*/
describe("a regenerate re-sends the picture, and none of the replaced take", () => {
  const REFERENCE = {
    id: 7,
    storageKey: "casting-v2/reference/attached.png",
    provenance: "consented" as const,
    digest: "d".repeat(64),
    mime: "image/png",
    width: 120,
    height: 100,
  };

  const onePhotograph = async () => {
    const sharp = (await import("sharp")).default;
    const width = 120;
    const height = 100;
    const raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 3;
        raw[at] = Math.round(60 + (x / width) * 60);
        raw[at + 1] = Math.round(70 + (y / height) * 60);
        raw[at + 2] = 90;
      }
    }
    return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
  };

  const mask = (width: number, height: number, rect: { x: number; y: number; w: number; h: number }) => {
    const data = Buffer.alloc(width * height, 0);
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) data[y * width + x] = 255;
    }
    return { data, width, height };
  };

  const painted: Array<{ prompt: string; references: ReadonlyArray<{ bytes: Buffer; contentType: string }> }> = [];
  const minted: Buffer[] = [];

  /** The hair crop the REPLACED take minted — the thing that must not ride. */
  const HAIR_CARRY_KEY = "casting-v2/library/hair-from-the-take-being-replaced.png";

  const road = () => ({
    repaintEnabled: () => true,
    /* The hair road is open for this account — the lane gained its own reader
       of the hair flag on 2026-08-20 (fable-1163 §2), and this arm is about what
       a REGENERATE re-cuts rather than about who is on the road. */
    hairReferenceEnabled: () => true,
    repaintEngine: () => ({
      id: "test:repaint",
      edit: async (request: { prompt: string; references: ReadonlyArray<{ bytes: Buffer; contentType: string }>; width: number; height: number }) => {
        painted.push({ prompt: request.prompt, references: request.references });
        return {
          bytes: Buffer.from("repainted"),
          contentType: "image/png",
          width: request.width,
          height: request.height,
          latencyMs: 10,
          provenance: { provider: "fal" as const, model: "gpt-image-2", providerRef: "req-r" },
        };
      },
    }),
    readBytes: async (key: string) => (key === REFERENCE.storageKey
      ? { bytes: await onePhotograph(), contentType: "image/png" }
      : key === "casting-v2/reference-carrier/carrier.png"
        ? { bytes: minted.at(-1)!, contentType: "image/png" }
        : key === HAIR_CARRY_KEY
          ? { bytes: Buffer.from("the-replaced-take-s-hair"), contentType: "image/png" }
          : { bytes: TINY_MASTER_PNG, contentType: "image/png" }),
    mintCarrier: async ({ carrier }: { carrier: { bytes: Buffer } }) => {
      minted.push(carrier.bytes);
      const { createHash } = await import("node:crypto");
      return {
        key: "casting-v2/reference-carrier/carrier.png",
        sha: createHash("sha256").update(carrier.bytes).digest("hex"),
        contentType: "image/png",
        carrier: carrier as never,
      };
    },
    regions: {
      region: async ({ image, name }: { image: Buffer; name: string }) => {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(image).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        return name === "hair"
          ? mask(width, height, { x: 10, y: 10, w: 40, h: 40 })
          : mask(width, height, { x: 50, y: 20, w: 30, h: 30 });
      },
      subject: async () => { throw new Error("no subject matte on this road"); },
      landmark: async () => { throw new Error("no landmark on this road"); },
    },
    interpret: async () => ({ ok: true as const, delta: { free: { hairCut: "a mid-length wavy cut" } } }),
    harvest: unmasked,
  });

  beforeEach(() => {
    painted.length = 0;
    minted.length = 0;
    resolveAskReferenceMock.mockResolvedValue(REFERENCE);
    /*
      The take being redrawn: her chosen version, made by this very sentence,
      with a hair crop minted from the frame it delivered.

      THE FIXTURE IS DELIBERATELY MORE GENEROUS THAN PRODUCTION. A real re-roll
      hangs where the replaced version hangs — it takes the predecessor's
      PARENT — so the replaced take's own row is a sibling and the lineage walk
      never returns it. Handing it in anyway puts the stale crop in front of the
      recipe, which is the only way to prove the drop rather than to prove that
      nothing was there.
    */
    variantRows.push({
      id: 91,
      publicId: "variant-selected",
      imageKey: "casting-v2/variants/the-take-being-replaced.png",
      instructions: ["copy this hairstyle"],
      requestText: "copy this hairstyle",
      stepDeltas: [{ free: { hairCut: "a mid-length wavy cut" } }],
      deltas: { free: { hairCut: "a mid-length wavy cut" } },
      internalPrompt: {},
    } as never);
    candidateRow.selectedVariantPublicId = "variant-selected";
    lineageReferences = [{
      id: 1,
      publicId: "ref-hair",
      candidateId: 1,
      variantId: 91,
      role: "carry",
      slot: "hair",
      tier: "anatomy",
      noun: "hair",
      words: ["a mid-length wavy cut"],
      storageKey: HAIR_CARRY_KEY,
      maskKey: null,
      digest: null,
      geometry: null,
      guard: null,
      refusal: null,
      version: 1,
      retiredAt: null,
      createdAt: new Date("2026-08-19T00:00:00Z"),
    }];
  });
  afterEach(() => { resolveAskReferenceMock.mockReset(); });

  it("cuts the ORIGINAL picture again and sends it — and the replaced take's own crop does not ride", async () => {
    await refineCandidate(road() as never, {
      ...input,
      instruction: "copy this hairstyle",
      replayOf: "variant-selected",
      referenceId: "ref-public",
    });

    expect(painted).toHaveLength(1);
    const sent = painted[0]!.references;
    /* Master plus the carrier, and nothing else: the crop the replaced take
       minted is dropped because its slot is the one being edited (D-244 line
       2), and the SOURCE takes the place a stale carry would otherwise have. */
    expect(sent).toHaveLength(2);
    expect(sent[0]!.bytes).toEqual(TINY_MASTER_PNG);
    expect(sent[1]!.bytes).toEqual(minted.at(-1)!);
    expect(sent.some((one) => one.bytes.equals(Buffer.from("the-replaced-take-s-hair")))).toBe(false);
    /* And it is the picture SHE attached that was cut, not the version being
       replaced: the resolver was asked for her handle on this pass too. */
    expect(resolveAskReferenceMock).toHaveBeenCalledWith(expect.objectContaining({
      referencePublicId: "ref-public",
    }));
    /* The pronoun is this fixture's cast's, and the sentence is asserted
       without it — the pronoun has its own arm in the assembler's suite. */
    expect(painted[0]!.prompt).toContain("Reference 2 is the picture supplied for");
    expect(painted[0]!.prompt).toContain("plain grey form standing in for a head");
  });
});
