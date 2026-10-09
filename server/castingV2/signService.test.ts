import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Sign ceremony's ORDER and its MONEY (plan §F, §H.4, D-92).
 *
 * Sign inverts the roll's ordering: the charge comes BEFORE the durable
 * boundary, because that boundary creates authority — a Cast, and a spent
 * candidate — and an unpaid Cast is unacceptable. Everything in between must
 * therefore be compensable, and this file is the proof, case by case, of the
 * one invariant the whole design serves:
 *
 *   **authority exists ⟹ money was taken.**
 *
 * The sequence is asserted as an OBSERVED ORDER of calls rather than by reading
 * the code, because the adjudicator's verdicts are only correct while that
 * order holds: swap the deduct and the boundary and a crash between them
 * silently produces a free Cast; move the manifest after the copy and a crash
 * leaks a customer's face into the bucket with nothing pointing at it.
 */

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const journal: string[] = [];

const ledger = {
  charges: [] as Array<{ amount: number; reference: string }>,
  refunds: [] as Array<{ amount: number; reference: string }>,
};
/**
 * THE SHEET THIS CANDIDATE WAS CAST ON WEARS — the two paths (design §3.1).
 *
 * Both NULL is every Cast signed to date: the sheet was cast before the paths
 * existed. Mutable so the wardrobe arms can move it and everything else keeps
 * exercising the unpathed product.
 */
/** Every `buildPackage` call's argument object, in order. */
const packageInputs: Record<string, unknown>[] = [];

let rollWardrobe: { path: "wardrobe" | "basics" | null; line: string | null } = {
  path: null,
  line: null,
};

/**
 * The roll's compiled brief, as the Sign gate reads it (#176). `{}` — no
 * register — is a HOUSE-road roll, which is every fixture in this file unless
 * an arm says otherwise; the author-road arms move it.
 */
let rollCompiledBrief: unknown = {};

let chargeSucceeds = true;
let refundRecords = true;

/** The candidate row, with a REAL compare-and-set on it. */
const candidateRow = {
  id: 55,
  publicId: "candidate-public",
  status: "ready" as string,
  signedCastId: null as number | null,
  imageKey: "casting-v2/candidates/abc.png",
  thumbKey: "casting-v2/candidates/abc-thumb.png",
  position: 3,
  /* `unknown` because it IS unknown at the boundary this fixture stands in for
     — a JSON column written across several eras — and because one arm below
     drives the shape where `$.prompt` is absent. */
  internalPrompt: { prompt: "the composed casting instruction", resolved: { sex: "female" } } as unknown,
};

/**
 * The selected refinement, when the test sets one (M8 §11/§14).
 *
 * Null in every test that predates Refine, which is the parity these suites
 * prove: with nothing selected, Sign must behave exactly as it did.
 */
let selectedVariant: {
  id: number;
  publicId: string;
  imageKey: string;
  thumbKey: string | null;
  internalPrompt: unknown;
} | null = null;

/** What the durable boundary was actually handed, for the record-lies checks. */
const boundaryInputs: Array<Record<string, unknown>> = [];
/** Which object the anchor was copied FROM. */
const copiedFrom: string[] = [];

const casts: Array<{ modelId: number; agencyId: string; candidateId: number }> = [];
let nextModelId = 900;
let copyThrows = false;
let manifestThrows = false;
const cleanupBatches: string[] = [];
const receipts: Array<Record<string, unknown>> = [];
/** Her own correction sentences, as the Sign's read would hand them over. */
let editSentences: readonly string[] = [];
/** What N2b's write was handed, for the arms that read it. */
const personaWrites: Array<Record<string, unknown>> = [];
/** What #1429's recorder was handed, in order — the terminal product event. */
const terminalEvents: Array<Record<string, unknown>> = [];

class TestSignPersistenceError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/**
 * WHAT THE LOG SAID, because for two of N2b's failures the sentence IS the
 * whole defect (#1242).
 *
 * A reader that throws and a write that throws both leave the Sign sealed and
 * the receipt recorded, so EVERY outcome assertion in this file is green under
 * either. Measured by sabotage: removing the reader's own backstop and removing
 * the write's own catch each survived five arms apiece. What actually changes is
 * which sentence a human reads when they come looking — and the wrong one says
 * "the package could not be sealed - leaving it for the recovery sweep" about a
 * package that was sealed, on a money road, because two lines of prose failed.
 */
const logged: string[] = [];
vi.mock("../logging/logger", () => {
  const record = (fields: unknown, message?: string) => {
    logged.push(typeof fields === "string" ? fields : String(message ?? ""));
  };
  const shape = {
    error: record, warn: record, info: record, debug: record, fatal: record, trace: record,
    child: () => shape,
  };
  return { logger: shape, createModuleLogger: () => shape };
});

vi.mock("./spendGuards", () => ({ assertNotFrozen: vi.fn(async () => undefined) }));

vi.mock("../db/castingV2Sign", () => ({
  SignPersistenceError: TestSignPersistenceError,
  /*
    N2b's write (#1242), present in this mock ON PURPOSE.

    `signService` falls back to the real `writeCastPersonaLines` when no
    `writePersona` is injected, and a module mock that omitted it would make
    that fallback `undefined()` - a TypeError thrown INSIDE the seal's own
    catch, which logs and hands the operation to the sweep. Every arm in this
    file would still be green, and the production default would be broken. So
    it is here, it journals, and `personaWrites` is asserted below.
  */
  writeCastPersonaLines: vi.fn(async (write: Record<string, unknown>) => {
    journal.push("persona:write");
    personaWrites.push(write);
    return true;
  }),
  getSignableCandidate: vi.fn(async () => {
    journal.push("read");
    if (candidateRow.status !== "ready") return null;
    return {
      candidate: candidateRow,
      face: selectedVariant
        ? {
          variantId: selectedVariant.id,
          variantPublicId: selectedVariant.publicId,
          imageKey: selectedVariant.imageKey,
          thumbKey: selectedVariant.thumbKey,
          internalPrompt: selectedVariant.internalPrompt,
          /* The branch's composed state, read in the same statement as its
             pixels — which is what says WHICH tattoos this face wears. */
          deltas: (selectedVariant as { deltas?: unknown }).deltas ?? null,
          /* What she typed while refining this face - N2b's second source. */
          editSentences: editSentences,
        }
        : {
          variantId: null,
          variantPublicId: null,
          imageKey: candidateRow.imageKey,
          thumbKey: candidateRow.thumbKey,
          internalPrompt: candidateRow.internalPrompt,
          /* The pristine master, which wears nothing. */
          deltas: null,
          /* And which she said nothing about - she never refined it. */
          editSentences: [],
        },
      roll: {
        id: 22,
        publicId: "roll-public",
        briefText: "a redhead in her 30s",
        cohortKey: "photoreal-human",
        styleKey: null,
        styleProfile: null,
        createdAt: new Date("2026-08-02T10:00:00Z"),
        /* The two paths. NULL on both is every Cast signed to date — the sheet
           was cast before the paths existed. Overridden by the arms that care. */
        path: rollWardrobe.path,
        wardrobeLine: rollWardrobe.line,
        /* The Sign gate's read (#176) — house-shaped unless an arm moves it. */
        compiledBrief: rollCompiledBrief,
      },
      session: { id: 10, publicId: "session-public" },
    };
  }),
  signCandidateIntoCast: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("boundary");
    boundaryInputs.push(input);
    /*
      The CAS, for real: `status='ready' AND signedCastId IS NULL`, plus the
      selection fence. Null-safe on both sides, mirroring the `<=>` in the
      statement — a JS `===` between two nulls is true, which is precisely the
      behaviour SQL needed `<=>` to get.
    */
    if (candidateRow.status !== "ready" || candidateRow.signedCastId !== null) {
      throw new TestSignPersistenceError("candidate_unavailable");
    }
    if ((input.selectedVariantId ?? null) !== (selectedVariant?.id ?? null)) {
      throw new TestSignPersistenceError("candidate_unavailable");
    }
    nextModelId += 1;
    candidateRow.status = "signed";
    candidateRow.signedCastId = nextModelId;
    // The manifest is discharged inside the same transaction.
    const index = cleanupBatches.indexOf(input.cleanupBatchId as string);
    if (index >= 0) cleanupBatches.splice(index, 1);
    casts.push({
      modelId: nextModelId,
      agencyId: input.agencyId as string,
      candidateId: input.candidateId as number,
    });
    return {
      modelId: nextModelId,
      agencyId: input.agencyId as string,
      anchorAssetId: 1,
      identitySnapshotId: "snapshot-1",
      identityRevisionId: input.identityRevisionId as string,
    };
  }),
}));

vi.mock("../db/credits", () => ({
  deductCredits: vi.fn(async (_userId: number, amount: number, _type: string, _label: string, reference: string) => {
    journal.push("deduct");
    if (!chargeSucceeds) return { success: false, error: "Not enough credits" };
    ledger.charges.push({ amount, reference });
    return { success: true };
  }),
}));

vi.mock("../casting/atomicCredits", () => ({
  recordRefund: vi.fn(async (_userId: number, amount: number, _label: string, chargeReference: string) => {
    journal.push("refund");
    const reference = `refund:${chargeReference}`;
    if (!refundRecords) return { recorded: false, amount: 0, reference };
    if (ledger.refunds.some((entry) => entry.reference === reference)) {
      // The ledger's uniqueness: a repeated reference is a no-op, not a second
      // refund.
      return { recorded: true, amount, reference };
    }
    ledger.refunds.push({ amount, reference });
    return { recorded: true, amount, reference };
  }),
  refundReferenceFor: (reference: string) => `refund:${reference}`,
}));

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("claim");
    return { type: "execute", operationId: OPERATION_ID };
  }),
  completeDirectOperationFailure: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:failure");
    receipts.push({ kind: "failure", ...input });
    throw input.error;
  }),
  failClaimedDirectOperation: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:claimed-failure");
    receipts.push({ kind: "claimed-failure", ...input });
    throw input.error;
  }),
  /*
    THE TERMINAL PRODUCT EVENT (#1429). It goes in the JOURNAL rather than in a
    private array of its own because the journal is this file's own ordering
    instrument, and the fact worth proving is an ORDER: the event must come after
    `seal:success` and must not exist at all when the seal did not happen. A
    separate array could only ever say "an event was recorded".
  */
  recordDirectOperationDelivered: vi.fn((input: Record<string, unknown>) => {
    journal.push("event:delivered");
    terminalEvents.push(input);
  }),
}));

vi.mock("../db/generationOperations", () => ({
  markGenerationOperationRunning: vi.fn(async () => {
    journal.push("running");
  }),
  finalizeGenerationOperationSuccess: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:success");
    receipts.push({ kind: "success", ...input });
  }),
  bindGenerationOperationModel: vi.fn(async () => {
    journal.push("bind");
  }),
  markGenerationOperationRecoveryRequired: vi.fn(async (input: Record<string, unknown>) => {
    journal.push("seal:recovery");
    receipts.push({ kind: "recovery", ...input });
  }),
  handoffGenerationOperationToRecovery: vi.fn(async () => {
    journal.push("handoff");
  }),
}));

/*
  The road's own adjudicator, reached in-process when the refund write throws
  (#869). Its money law is `signRecovery.test.ts`'s and is not re-proven here:
  each arm dictates its verdict and asserts what the service does with it.
*/
const adjudicator = {
  verdict: null as null | (() => Promise<unknown>),
};
const adjudicatedOperations: unknown[] = [];
vi.mock("./signRecovery", () => ({
  recoverCastingV2SignOperation: vi.fn(async (operation: unknown) => {
    journal.push("adjudicate");
    adjudicatedOperations.push(operation);
    if (!adjudicator.verdict) throw new Error("no verdict dictated");
    return adjudicator.verdict();
  }),
}));

vi.mock("../db/storageCleanup", () => ({
  createStorageCleanupManifestIn: vi.fn(async (_tx: unknown, input: Record<string, unknown>) => {
    journal.push("manifest");
    if (manifestThrows) throw new Error("manifest failed");
    cleanupBatches.push(input.id as string);
    return { id: input.id as string };
  }),
}));

vi.mock("../db/connection", () => ({
  withTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({})),
}));

vi.mock("../storage", () => ({
  storageCopyExact: vi.fn(async (input: { sourceKey: string; destinationKey: string }) => {
    journal.push("copy");
    copiedFrom.push(input.sourceKey);
    if (copyThrows) throw new Error("copy failed");
    return {
      key: input.destinationKey,
      url: `https://cdn.example/${input.destinationKey}`,
      byteSize: 10,
      contentHash: "hash",
      contentType: "image/png",
    };
  }),
  storageReadBytes: vi.fn(async () => ({ bytes: Buffer.from("anchor"), contentType: "image/png" })),
  storagePut: vi.fn(async () => ({ key: "k", url: "u" })),
  storageDelete: vi.fn(async () => ({ success: true })),
  storagePublicUrl: (key: string) => `https://cdn.example/${key}`,
}));

const { signCandidate } = await import("./signService");
/* Types only, so this import cannot change which module the mocks above
   intercept — the value import on the line above is dynamic for exactly that
   reason and stays as it is. */
import type { SignServiceDependencies } from "./signService";
import type { CastPersonaReader } from "./castPersona";
const { CASTING_V2_SIGN_PRICE_CREDITS } = await import("../casting/castingCreditCosts");
/**
 * ⚠ **EVERY MONEY ARM BELOW PINNED `450` UNTIL 2026-10-01 AND ALL OF THEM WENT
 * RED ON TWO CONSTANT EDITS** (#1601 item 1: a Sign is 3,500 + 5 x 1,000 =
 * 8,500 ledger / 1,700 display). A suite that writes a price as a literal is a
 * second copy of that price — working law 4 — and these arms are about
 * CONSERVATION, which is true at any price. So they read the product's own
 * numbers, and a Sign repriced again moves nothing here.
 *
 * The `450`s and `50`s left in this file are PROSE, narrating what a decision
 * cost on the day it was made; rewriting those would falsify a record.
 */
/**
 * What a view's slice was refunded under the rule #1968 retired — a LEDGER and
 * ROW fact, not a product constant.
 *
 * ⚠ **It was `CAST_PACKAGE_VIEW_PRICE` and that constant is gone.** His word of
 * 2026-10-08 makes a Sign one flat charge with no per-view refund, so nothing
 * in the tree can produce this number any more — but Casts signed before it
 * carry slot markers that say exactly this, and the room still reads them. A
 * literal on purpose: deriving it from a live constant would be a fiction that
 * moves with his next price word.
 */
const LEGACY_VIEW_SLICE = 1000;
const SIGN_PRICE = CASTING_V2_SIGN_PRICE_CREDITS;
const VIEW_PRICE = LEGACY_VIEW_SLICE;
const { basicsWardrobeLine } = await import("./wardrobeLine");

/** A package that behaves however the case needs it to. */
/** What the package build is handed — typed so `mock.calls` carries it, rather
 *  than recording the arguments and handing them back as `never`. */
type PackageBuildInput = {
  userId: number;
  operationId: string;
  anchor: { bytes: Buffer; contentType: string };
  inkPlates?: ReadonlyArray<{
    designPublicId: string;
    placement: string;
    side: string;
    bytes: Buffer;
    contentType: string;
  }>;
  /* The delivered-crop lane's half of the same wire. */
  inkCrops?: ReadonlyArray<{
    cropPublicId: string;
    slot: string;
    placement: string;
    side: string;
    noun: string;
    bytes: Buffer;
    contentType: string;
  }>;
  pronouns?: { subject: string; object: string; possessive: string; plural: boolean };
};

function packageReturning(result: {
  committed?: number;
  failed?: number;
  refundedCredits?: number;
  refundUnrecorded?: boolean;
}) {
  return vi.fn(async (_dependencies: unknown, buildInput: PackageBuildInput) => {
    journal.push("package");
    /* What the package was actually asked to build — the wire the wardrobe
       line has to cross, and the one a snapshot arm cannot see. */
    packageInputs.push(buildInput as unknown as Record<string, unknown>);
    return {
      committed: Array.from({ length: result.committed ?? 5 }, () => "frontFull" as const),
      failed: Array.from({ length: result.failed ?? 0 }, () => "backFull" as const),
      refundedCredits: result.refundedCredits ?? 0,
      refundUnrecorded: result.refundUnrecorded ?? false,
      activated: true,
      totalLoss: (result.committed ?? 5) === 0,
    };
  });
}

/** Tests await the package; production detaches it. */
const awaitPackage = (run: () => Promise<void>) => run();

beforeEach(() => {
  journal.length = 0;
  ledger.charges.length = 0;
  ledger.refunds.length = 0;
  receipts.length = 0;
  terminalEvents.length = 0;
  cleanupBatches.length = 0;
  boundaryInputs.length = 0;
  copiedFrom.length = 0;
  casts.length = 0;
  chargeSucceeds = true;
  refundRecords = true;
  /* A stateful fixture re-establishes its state in front of every row it is
     asked about — the census corpus's own first law, arriving in a unit suite. */
  rollWardrobe = { path: null, line: null };
  rollCompiledBrief = {};
  packageInputs.length = 0;
  copyThrows = false;
  manifestThrows = false;
  candidateRow.status = "ready";
  candidateRow.signedCastId = null;
  /* Restored here as well, because one arm below drives a candidate whose
     compiled prompt is missing and a fixture that keeps a mutation is how a
     later arm silently reads a state nobody chose for it. */
  candidateRow.internalPrompt = { prompt: "the composed casting instruction", resolved: { sex: "female" } };
  selectedVariant = null;
  editSentences = [];
  personaWrites.length = 0;
  logged.length = 0;
  vi.clearAllMocks();
});

const input = {
  userId: 1,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
  candidatePublicId: "candidate-public",
  name: "Nine",
};

describe("the Sign ceremony's order", () => {
  it("charges BEFORE the durable boundary, and registers the copy before making it", async () => {
    await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(journal).toEqual([
      "read",
      "claim",
      "running",
      "deduct",
      "manifest",
      "copy",
      "boundary",
      "package",
      "bind",
      "seal:success",
      "event:delivered",
    ]);
  });

  it("binds the Cast to its receipt before the receipt is sealed", async () => {
    // `bindGenerationOperationModel` is gated on `running`; sealing first would
    // make it a control that is never on the path.
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(journal.indexOf("bind")).toBeLessThan(journal.indexOf("seal:success"));
  });
});

describe("Sign's money", () => {
  it("takes the whole price once, and gives nothing back when everything lands", async () => {
    const result = await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(result.chargedCredits).toBe(CASTING_V2_SIGN_PRICE_CREDITS);
    expect(ledger.charges).toHaveLength(1);
    expect(ledger.charges[0].amount).toBe(SIGN_PRICE);
    expect(ledger.refunds).toHaveLength(0);
    expect(casts).toHaveLength(1);
    expect(receipts.at(-1)).toMatchObject({ kind: "success", chargedCredits: SIGN_PRICE, refundedCredits: 0 });
  });

  it("refuses for free when the balance is short — no claim spent, no candidate spent", async () => {
    chargeSucceeds = false;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/Not enough credits/);

    expect(ledger.charges).toHaveLength(0);
    expect(ledger.refunds).toHaveLength(0);
    expect(casts).toHaveLength(0);
    expect(candidateRow.status).toBe("ready");
    expect(receipts.at(-1)).toMatchObject({ kind: "failure", chargedCredits: 0, refundedCredits: 0 });
  });

  /**
   * D-92's crash table, row "deduct / copy": a charge exists, the CAS is unset
   * and no model exists. That is a PAID failure and the whole price goes back.
   */
  it("refunds the whole price when the copy fails after the charge", async () => {
    copyThrows = true;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();

    expect(ledger.charges[0].amount).toBe(SIGN_PRICE);
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.refunds[0].amount).toBe(SIGN_PRICE);
    // The candidate is untouched: it can be signed again.
    expect(candidateRow.status).toBe("ready");
    expect(candidateRow.signedCastId).toBeNull();
    expect(casts).toHaveLength(0);
  });

  it("leaves the copy owned by its cleanup manifest when the boundary never commits", async () => {
    copyThrows = true;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();

    // The manifest survives the failure — the worker deletes the orphan. If the
    // manifest were registered after the copy, this list would be empty and the
    // object would be unreachable forever.
    expect(cleanupBatches).toHaveLength(1);
  });

  it("discharges the manifest inside the boundary, so a live Cast's anchor is never swept", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(cleanupBatches).toHaveLength(0);
  });

  it("tells the truth when a refund does not record", async () => {
    copyThrows = true;
    refundRecords = false;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/support will restore the balance/);
    expect(receipts.at(-1)).toMatchObject({ chargedCredits: SIGN_PRICE, refundedCredits: 0 });
  });
});

/**
 * #869 — the throw from INSIDE the compensating catch.
 *
 * The Sign's compensable section sits in a try/catch that ends in the
 * finalizer, so the exposed window is `recordRefund` REJECTING (a refund that
 * returns `recorded: false` is the arm above). Before this, such a throw
 * escaped the mutation before the finalizer: the heartbeat kept renewing, the
 * lease never lapsed, and the sweep never came. The road's own adjudicator
 * now runs in-process; if it throws too, the lease is handed to the sweep.
 */
describe("a refund write that throws is settled by the Sign's own adjudicator (#869)", () => {
  const torn = Object.assign(new Error("read ECONNRESET"), { code: "ER_NET_READ_INTERRUPTED" });

  beforeEach(() => {
    adjudicator.verdict = null;
    adjudicatedOperations.length = 0;
  });

  it("adjudicates in-process when the refund write throws, and says what the receipt says", async () => {
    copyThrows = true;
    const { recordRefund } = await import("../casting/atomicCredits");
    vi.mocked(recordRefund).mockRejectedValueOnce(torn);
    adjudicator.verdict = async () => ({ type: "paid_failure", chargedCredits: SIGN_PRICE, refundedCredits: SIGN_PRICE });

    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/Everything you paid was refunded/);

    // The adjudicator was handed THIS operation, running, at the price charged
    // and the price planned — the figure the running transition wrote.
    expect(adjudicatedOperations).toEqual([
      expect.objectContaining({
        id: OPERATION_ID,
        status: "running",
        chargedCredits: SIGN_PRICE,
        refundedCredits: 0,
        plannedCredits: SIGN_PRICE,
      }),
    ]);
    // It sealed the receipt itself: no second seal, no lease left to the sweep.
    expect(journal).toContain("adjudicate");
    expect(journal).not.toContain("seal:failure");
    expect(journal).not.toContain("handoff");
    // The service refunded nothing on its own — the ledger is the adjudicator's.
    expect(ledger.refunds).toEqual([]);
    // And the candidate is untouched: it can be signed again.
    expect(candidateRow.status).toBe("ready");
    expect(casts).toHaveLength(0);
  });

  it("hands the lease to the sweep when the adjudicator throws too", async () => {
    copyThrows = true;
    const { recordRefund } = await import("../casting/atomicCredits");
    vi.mocked(recordRefund).mockRejectedValueOnce(torn);
    adjudicator.verdict = async () => { throw new Error("database unavailable"); };

    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/still being settled\. Operation/);

    expect(journal).toContain("handoff");
    expect(journal).not.toContain("seal:failure");
    expect(ledger.refunds).toEqual([]);
  });

  it("parks with the support sentence when the adjudicator cannot decide", async () => {
    copyThrows = true;
    const { recordRefund } = await import("../casting/atomicCredits");
    vi.mocked(recordRefund).mockRejectedValueOnce(torn);
    adjudicator.verdict = async () => ({
      type: "recovery_required", reason: "the full Sign refund did not record", chargedCredits: SIGN_PRICE, refundedCredits: 0,
    });

    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/needs support review before it can be retried\. Operation/);
    expect(journal).not.toContain("handoff");
  });

  it("CONTROL: a refund that merely fails to record still takes the receipt road, not the adjudicator", async () => {
    copyThrows = true;
    refundRecords = false;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/support will restore the balance/);
    expect(journal).toContain("seal:failure");
    expect(journal).not.toContain("adjudicate");
  });
});

describe("the double Sign", () => {
  /**
   * Two distinct `clientRequestId`s racing one candidate charge twice by
   * construction — idempotency is per request, and neither request is a replay
   * of the other. The CAS decides who gets the Cast; the loser must take the
   * paid-failure exit.
   *
   * The assertion the review asked for is the LOSER'S MONEY, not merely the
   * winner's Cast: a test that only checks "one Cast exists" passes just as
   * happily when the loser was charged 500 and never refunded.
   */
  it("gives exactly one Cast, and gives the loser every credit back", async () => {
    const deps = { schedulePackage: awaitPackage, buildPackage: packageReturning({}) };
    const first = signCandidate(deps, input);
    const second = signCandidate(deps, {
      ...input,
      clientRequestId: "33333333-3333-4333-8333-333333333333",
    }).catch((error: Error) => error);

    const winner = await first;
    const loser = await second;

    expect(casts).toHaveLength(1);
    expect(winner.castPublicId).toBeTruthy();
    expect(loser).toBeInstanceOf(Error);
    expect((loser as Error).message).toMatch(/already signed or discarded/);

    // Both were charged — that is the construction, not a bug.
    expect(ledger.charges).toHaveLength(2);
    // And exactly one full refund exists: the loser's.
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.refunds[0].amount).toBe(SIGN_PRICE);
    // Conservation: the money kept equals one Sign.
    const charged = ledger.charges.reduce((sum, entry) => sum + entry.amount, 0);
    const refunded = ledger.refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(charged - refunded).toBe(SIGN_PRICE);
  });

  it("refuses a candidate that was signed by an earlier ceremony", async () => {
    candidateRow.status = "signed";
    candidateRow.signedCastId = 901;
    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow(/discarded, expired, or already signed/);
    // Refused before the claim: free.
    expect(ledger.charges).toHaveLength(0);
  });
});

describe("the package's money, after the boundary", () => {
  it("keeps the promotion and refunds only the views that failed", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 3, failed: 2, refundedCredits: 100 }),
      },
      input,
    );

    // 450 charged, 2 × 50 back. The promotion is never refunded once the CAS is
    // set — the customer has the locked face it bought.
    expect(ledger.charges[0].amount).toBe(SIGN_PRICE);
    expect(receipts.at(-1)).toMatchObject({
      kind: "success",
      chargedCredits: SIGN_PRICE,
      refundedCredits: 100,
      terminalStatus: "partial",
    });
    expect(casts).toHaveLength(1);
  });

  it("still delivers a Cast when every view fails, and refunds every view", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 0, failed: 5, refundedCredits: 5 * VIEW_PRICE }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({
      chargedCredits: SIGN_PRICE,
      refundedCredits: 5 * VIEW_PRICE,
      terminalStatus: "partial",
    });
    // 200 kept — the promotion, which is exactly what was delivered.
    expect(candidateRow.status).toBe("signed");
  });

  it("never seals a clean receipt over a refund that did not record", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 4, failed: 1, refundedCredits: 0, refundUnrecorded: true }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({ kind: "recovery" });
    expect(journal).not.toContain("seal:success");
  });

  it("leaves the Cast standing when the package throws — the sweep finishes it", async () => {
    const exploding = vi.fn(async () => {
      throw new Error("the package exploded");
    });
    // The mutation resolves: the Cast exists, and that is what the customer is
    // told. Nothing is refunded here, because nothing here knows what landed.
    const result = await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: exploding },
      input,
    );
    expect(result.castPublicId).toBeTruthy();
    expect(casts).toHaveLength(1);
    expect(journal).not.toContain("seal:success");
    expect(ledger.refunds).toHaveLength(0);
  });
});

/**
 * WHAT A CAST IS WEARING, SNAPSHOTTED AT SIGN (design §3.1 and condition (v)).
 *
 * A Cast is immutable at Sign, so the outfit its five views are composed from
 * and judged against has to be decided here, once. The arms below assert on
 * `technicalSchema` — the sensitive blob that never crosses a projection
 * boundary — because that is where the recipe for reproducing this Cast lives.
 */
describe("the Cast's wardrobe snapshot", () => {
  it("⚠ UNPATHED is what every Cast signed to date carries, and it says so", async () => {
    /*
      NULL on both columns is not an error and never becomes one: it means the
      sheet was cast before the paths existed. The snapshot has to be able to
      SAY that rather than resolve to a house line, or a Cast that predates the
      feature becomes indistinguishable from one that chose Wardrobe.
    */
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.technicalSchema).toMatchObject({
      wardrobe: { path: null, line: null, source: null },
    });
  });

  it("carries the roll's born line and where it came from", async () => {
    rollWardrobe = { path: "wardrobe", line: "a red apron over a plain white tee" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(boundaryInputs.at(-1)!.technicalSchema).toMatchObject({
      wardrobe: {
        path: "wardrobe",
        line: "a red apron over a plain white tee",
        source: "born",
      },
    });
  });

  it("carries the BASICS path, which is a different promise", async () => {
    rollWardrobe = { path: "basics", line: "shirtless, in plain black fitted shorts, barefoot" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(boundaryInputs.at(-1)!.technicalSchema).toMatchObject({
      wardrobe: { path: "basics", source: "born" },
    });
  });

  it("⚠ AT THE WIRE — the package is BUILT from the line the Cast records", async () => {
    /*
      The seam a snapshot arm cannot see, and it was genuinely untested until a
      sabotage said so: replacing this hand-off with `null` left 81 arms green.
      The five views are composed from this value and the judge judges against
      it, so what matters is that the sentence crossing into the package is the
      Cast's own — not re-resolved at the call site, where it could differ from
      the record by the time anyone compares them.
    */
    rollWardrobe = { path: "wardrobe", line: "a red apron over a plain white tee" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(packageInputs).toHaveLength(1);
    expect(packageInputs[0].wardrobeLine).toBe("a red apron over a plain white tee");
  });

  it("⚠ CONTROL — an unpathed Cast builds its package with no line at all", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(packageInputs).toHaveLength(1);
    expect(packageInputs[0].wardrobeLine).toBeNull();
  });

  it("⚠ the outfit is NOT folded into the identity fingerprint", async () => {
    /*
      `identityText` opens "THIS PERSON MUST MATCH THE REFERENCE IMAGE EXACTLY"
      and is hashed onto the identity snapshot. An outfit is not a fact about a
      face — folding one in would make two Casts of the same person in different
      clothes read as two different people to everything that compares the
      fingerprint.
    */
    rollWardrobe = { path: "wardrobe", line: "a red apron over a plain white tee" };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.identityText).not.toContain("apron");
    /* CONTROL — the same string DOES carry the identity, so the arm above is
       reading an exclusion and not an empty field. */
    expect(boundary.identityText).toContain("IDENTITY");
  });
});

/**
 * THE IDENTITY DOCUMENTS NEVER HOLD AN UNSENT RECORD (#176).
 *
 * An author-road roll's per-slice `resolved` record is the house dice's output
 * on a roll whose ONE authored prompt never carried it — candidate 578's
 * claims 100% South Asian heritage and a goatee about a clean-shaven
 * Mediterranean-looking man. Snapshotting it at Sign would stamp the fiction
 * into `identityText` under "THIS PERSON MUST MATCH THE REFERENCE IMAGE
 * EXACTLY", permanently, against a reference image showing none of it. The
 * gate reads BOTH signals because rows exist both ways: the `unsent: true`
 * mark on records written after the fix, and the roll's own `register.kind`
 * for rows written before it. (Fable review of PR #178, finding 1: this gate
 * shipped untested and the mock's roll carried no `compiledBrief` at all, so
 * every arm exercised only the house path.)
 */
describe("the identity documents refuse the unsent record (#176)", () => {
  const FICTION = {
    sex: "male",
    heritage: [{ pct: 100, heritage: "South Asian" }],
    realized: { facialHair: "goatee", beardGrey: "salt and pepper" },
  };

  it("an AUTHOR-road roll's record is snapshotted as {} and no fiction word reaches the fingerprint", async () => {
    rollCompiledBrief = { register: { kind: "author", mode: "seed" }, intent: {} };
    candidateRow.internalPrompt = { prompt: "the authored prompt", resolved: FICTION };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.technicalSchema).toMatchObject({ subject: {} });
    expect((boundary.technicalSchema as { subject: object }).subject).toEqual({});
    for (const word of ["South Asian", "goatee", "salt and pepper"]) {
      expect(boundary.identityText, word).not.toContain(word);
    }
    /* The authored prompt IS the identity's casting spec — that half stays. */
    expect(boundary.masterPrompt).toBe("the authored prompt");
    expect(boundary.identityText).toContain("Full casting spec: the authored prompt");
  });

  it("a record marked `unsent: true` is refused even when the roll's brief cannot say which road", async () => {
    rollCompiledBrief = {};
    candidateRow.internalPrompt = { prompt: "the authored prompt", resolved: { ...FICTION, unsent: true } };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect((boundaryInputs.at(-1)!.technicalSchema as { subject: object }).subject).toEqual({});
  });

  it("positive control — a HOUSE-road sign still snapshots the record whole", async () => {
    rollCompiledBrief = {};
    candidateRow.internalPrompt = { prompt: "the composed casting instruction", resolved: FICTION };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.technicalSchema).toMatchObject({
      subject: { heritage: [{ pct: 100, heritage: "South Asian" }] },
    });
    expect(boundary.identityText).toContain("South Asian");
  });

  it("positive control — the superseded creative register (`kind: creative`) is a sent record and keeps it", async () => {
    rollCompiledBrief = { register: { kind: "creative" } };
    candidateRow.internalPrompt = { prompt: "the composed casting instruction", resolved: FICTION };
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(boundaryInputs.at(-1)!.identityText).toContain("South Asian");
  });
});

/**
 * Signing a REFINED face — §11's first landmine, and the fence that guards it.
 *
 * The whole reason Refine touches Sign at all. A refined candidate has two
 * faces on file: the original the sheet rolled, and the variant the user asked
 * for and is looking at. Sign must take BOTH the pixels and the identity
 * documents from the second one, and it must take them from the same read —
 * because a Cast's masterPrompt and technicalSchema are what every future
 * generation of that person is reproduced from, and a Cast whose record
 * describes a face it does not have is wrong permanently and silently.
 */
describe("Sign reads the selected face, not the candidate", () => {
  const REFINED = {
    id: 77,
    publicId: "variant-public",
    imageKey: "casting-v2/variants/refined.png",
    thumbKey: null,
    internalPrompt: {
      prompt: "the composed casting instruction, with green eyes",
      resolved: { sex: "female", eyeColour: "green" },
    },
  };

  it("copies the VARIANT's pixels and snapshots the VARIANT's record", async () => {
    selectedVariant = REFINED;
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);

    expect(copiedFrom).toEqual([REFINED.imageKey]);
    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.masterPrompt).toBe(REFINED.internalPrompt.prompt);
    expect(boundary.technicalSchema).toMatchObject({ subject: { eyeColour: "green" } });
    expect(boundary.identityText).toContain("green");
    /* Lineage names the refinement, so the record does not credit the original. */
    expect(boundary.preferences).toMatchObject({ sourceVariantPublicId: REFINED.publicId });
  });

  it("still signs the original when nothing is selected, and says so in lineage", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);

    expect(copiedFrom).toEqual([candidateRow.imageKey]);
    expect(boundaryInputs.at(-1)!.masterPrompt).toBe("the composed casting instruction");
    expect(boundaryInputs.at(-1)!.preferences).toMatchObject({ sourceVariantPublicId: null });
  });

  /*
    THE NULL FENCE. `selectedVariantId` is NULL for every candidate nobody has
    refined, and SQL's `x = NULL` is never true — so a fence written as ordinary
    equality would fail EVERY Sign in the product, not just the racing ones.
    The statement uses `<=>`; this is the case that would have caught it.
  */
  it("passes the fence when nothing was selected and nothing is selected", async () => {
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);

    expect(boundaryInputs.at(-1)!.selectedVariantId).toBeNull();
    expect(casts).toHaveLength(1);
    expect(ledger.refunds).toHaveLength(0);
  });

  it("arms the fence with the value it QUOTED, so a switch mid-Sign refunds", async () => {
    selectedVariant = REFINED;
    await signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input);
    expect(boundaryInputs.at(-1)!.selectedVariantId).toBe(REFINED.id);

    /*
      Now the user switches selection between the quote and the commit. The CAS
      finds a different pointer and refuses; the money comes back whole, exactly
      as it does for a candidate discarded mid-Sign.
    */
    candidateRow.status = "ready";
    candidateRow.signedCastId = null;
    ledger.charges.length = 0;
    ledger.refunds.length = 0;
    const stale = { ...REFINED };
    selectedVariant = stale;
    (
      vi.mocked(await import("../db/castingV2Sign")).getSignableCandidate as unknown as {
        mockImplementationOnce: (fn: () => Promise<unknown>) => void;
      }
    ).mockImplementationOnce(async () => {
      /* Quoted against the old variant… */
      const quoted = {
        candidate: candidateRow,
        face: {
          variantId: stale.id,
          variantPublicId: stale.publicId,
          imageKey: stale.imageKey,
          thumbKey: stale.thumbKey,
          internalPrompt: stale.internalPrompt,
        },
        roll: {
          id: 22,
          publicId: "roll-public",
          briefText: "a redhead in her 30s",
          cohortKey: "photoreal-human",
          styleKey: null,
          styleProfile: null,
          createdAt: new Date("2026-08-02T10:00:00Z"),
        },
        session: { id: 10, publicId: "session-public" },
      };
      /* …and the selection moves before the boundary runs. */
      selectedVariant = { ...REFINED, id: 78, publicId: "variant-public-2" };
      return quoted;
    });

    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();
    expect(ledger.refunds.at(-1)?.amount).toBe(ledger.charges.at(-1)?.amount);
  });
});

/**
 * THE TATTOOS A SIGN CARRIES INTO ITS VIEWS — and it is ONE lane now.
 *
 * ⚠ **#1158 slice 4f DELETED THE PLATE LANE AND THREE DESCRIBE BLOCKS WITH IT.**
 * His ruling of 2026-09-24 — *"It retires with N2"* — retired the ink studio;
 * `carriedInkPlates`, its disposition type and `listCandidateInkPlates` are
 * gone, so twenty-odd arms here lost their subject in one commit. They are
 * listed rather than quietly dropped, because "the arms went with the code" and
 * "we deleted coverage of a live rule" look identical in a diff:
 *
 *   "the tattoos a Sign carries into its views"   the three refusals (noPlate,
 *                                                 engineUndecided, bytesGone),
 *                                                 the empty read, the statement
 *                                                 failing, and the two-lane
 *                                                 no-tattoo-twice rule
 *   "what a Cast's views carry, design by design" the whole disposition surface,
 *                                                 whose TYPE is deleted
 *   "a covered surface says so ..."               `placementRideCoverage` driven
 *                                                 through the plate lane
 *
 * **WHERE EACH LIVE RULE IS STILL PROVED, named so this can be checked rather
 * than believed:**
 *
 *   the surface/outfit rule    `inkViewReferences.test.ts`, on
 *                              `placementRideCoverage` DIRECTLY — including the
 *                              basics cases and the unread-outfit case, which
 *                              is a better altitude than through a lane
 *   every crop-lane refusal    `signInkCrops.test.ts` — covered surface, open
 *                              placement, bytes moved, bytes unreadable, the
 *                              store refusing, one refusal never silencing a
 *                              ride, and the log carrying slots only
 *   the Sign never failing
 *   over a table               `signInkCrops.test.ts`, "NEVER fails the Sign
 *                              when the store will not answer"
 *
 * What survives HERE is the one thing those files cannot see: that the crops
 * actually reach `buildPackage`. That is the wire, and it is the arm below.
 */
describe("the tattoos a Sign carries into its views", () => {
  /* The branch state a Cast wearing one delivered tattoo has: the composed
     delta names the slot and the crop id, which is what the Sign reads. Written
     here rather than re-read from the store — the words, the picture and the
     branch state describing one face is a property of being read TOGETHER. */
  const inkedBranch = () => ({
    id: 77,
    publicId: "variant-public",
    imageKey: "casting-v2/variants/refined.png",
    thumbKey: null,
    internalPrompt: {
      prompt: "the composed casting instruction",
      resolved: { sex: "male", eyeColour: "green" },
    },
    deltas: { inkDelivered: { "ink:upperArm@left": "11111111-1111-4111-8111-111111111111" } },
  });


  it("carries the tattoos the BRANCH wears into the package, as crops of her own frame", async () => {
    /*
      THE WIRE, end to end through a real Sign (fable-1297 §3). The plate lane
      above has never carried anything in either world — its table is empty
      while the mannequin road is parked — and this is the lane that does.

      Asserted on what leaves the building rather than on a constant beside it.
    */
    selectedVariant = inkedBranch();
    const buildPackage = packageReturning({});

    await signCandidate({
      schedulePackage: awaitPackage,
      buildPackage,
      listInkDeliveryCrops: async () => [{
        publicId: "11111111-1111-4111-8111-111111111111",
        designPublicId: null,
        slot: "ink:upperArm@left",
        storageKey: "casting-v2/candidates/ink-delivery/arm.png",
        digest: createHash("sha256").update(Buffer.from("bytes:casting-v2/candidates/ink-delivery/arm.png")).digest("hex"),
        width: 224,
        height: 348,
      }] as never,
      readBytes: async (key: string) => ({
        bytes: Buffer.from(`bytes:${key}`), contentType: "image/png",
      }),
    }, input);

    const sent = buildPackage.mock.calls[0]![1];
    expect(sent.inkCrops?.map((crop) => crop.slot)).toEqual(["ink:upperArm@left"]);
    expect(sent.inkCrops?.[0]!.noun).toBe("left upper arm tattoo");
    /* And the Cast's own pronoun rides with it, from the documents this Sign
       just sealed rather than from a default. */
    expect(sent.pronouns?.possessive).toBe("his");
  });
});


/**
 * THE `masterPrompt` FALLBACK — the branch with no production population.
 *
 * `identityDocumentsFor` composes the Cast's "Full casting spec" from the
 * FACE's own compiled prompt and falls back to the roll's raw brief when that
 * prompt is missing or blank:
 *
 *   masterPrompt = internal.prompt ?? source.roll.briefText
 *
 * ⚠ **Nothing in production has ever taken the second road, and until this arm
 * nothing drove it either.** Read at the rows 2026-08-25: `internalPrompt` is
 * NULL on 0 of 63 candidates and `$.prompt` is absent on 0 of them, so the
 * branch is defensive rather than exercised — which is precisely the shape this
 * repository has paid for before (a corner declared unreachable is a corner
 * with no test). It is driven here rather than deleted, because the column is
 * JSON written across several eras and a Sign that throws on a missing key
 * would be a worse answer than a degraded one.
 *
 * The chase that produced this arm also CLOSED a different question: the two
 * production Casts whose `masterPrompt` is nine characters are not this branch
 * at all — they read `[deleted]`, which is `finalCastDeletion.ts`'s tombstone
 * scrubbing the sensitive field group on a permanently deleted Cast, working
 * exactly as designed.
 */
describe("the Full casting spec when the face carries no compiled prompt", () => {
  it("falls back to the roll's own brief rather than throwing or writing nothing", async () => {
    candidateRow.internalPrompt = { resolved: { sex: "female" } };

    await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    const boundary = boundaryInputs.at(-1)!;
    expect(boundary.masterPrompt).toBe("a redhead in her 30s");
    expect(boundary.identityText).toContain("Full casting spec: a redhead in her 30s");
  });

  it("treats a blank prompt as no prompt — whitespace is not a casting spec", async () => {
    candidateRow.internalPrompt = { prompt: "   ", resolved: { sex: "female" } };

    await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(boundaryInputs.at(-1)!.masterPrompt).toBe("a redhead in her 30s");
  });

  it("CONTROL — an ordinary candidate still snapshots its own compiled prompt", async () => {
    await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(boundaryInputs.at(-1)!.masterPrompt).toBe("the composed casting instruction");
  });
});

/**
 * THE TERMINAL PRODUCT EVENT FOR A SUCCESSFUL SIGN (#1429, #509 part 2).
 *
 * The defect these arms exist for: `signService.ts` held no `captureProductEvent`
 * call at all. `beginDirectOperation` emits `generation started` at the claim,
 * both of Sign's failure roads go through capturing completers — and success
 * settled with `finalizeGenerationOperationSuccess` directly, inside the
 * DETACHED `completeSignPackage`. So **a Cast he signed successfully was a
 * generation that started and never ended**, on the most expensive operation in
 * the product, and the recorded failure rate for the `sign` action was 100% of
 * everything the strip could see.
 *
 * These arms drive the real `signCandidate` through the harness above, which is
 * the point: the event has to arrive from the same detached callback that seals,
 * after the seal, and NOT when the seal never happened. An arm calling the
 * recorder directly would prove a payload and skip all three.
 */
describe("a signed Cast records its terminal event (#1429)", () => {
  it("sends exactly one delivery, after the seal, with the money the receipt carries", async () => {
    await signCandidate(
      { schedulePackage: awaitPackage, buildPackage: packageReturning({}) },
      input,
    );

    expect(terminalEvents).toHaveLength(1);
    expect(terminalEvents[0]).toEqual({
      userId: 1,
      operationId: OPERATION_ID,
      chargedCredits: SIGN_PRICE,
      refundedCredits: 0,
      terminalStatus: "succeeded",
    });
    /* AFTER the seal. The whole reason the payload is held in a variable and
       sent below the `try` is that a seal which threw must send nothing. */
    expect(journal.indexOf("seal:success")).toBeLessThan(journal.indexOf("event:delivered"));
  });

  it("calls a Sign that lost views a PARTIAL, and says how much went back", async () => {
    /* The distinction the strip needs to see a view engine getting worse: four
       of five committed is not the same fact as five of five, and the receipt
       says so — `terminalStatus: "partial"` plus the refund. */
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 3, failed: 2, refundedCredits: 100 }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({ kind: "success", terminalStatus: "partial" });
    expect(terminalEvents).toEqual([{
      userId: 1,
      operationId: OPERATION_ID,
      chargedCredits: SIGN_PRICE,
      refundedCredits: 100,
      terminalStatus: "partial",
    }]);
  });

  it("records NOTHING when the seal threw and the sweep owns the operation", async () => {
    /* `completeSignPackage`'s catch hands a half-sealed Sign to the recovery
       sweep, which sends its own terminal event (#1425). An event from here as
       well would be two terminals for one operation — the exact duplication the
       held-payload shape prevents. */
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: vi.fn(async () => {
          throw new Error("the package could not be built");
        }),
      },
      input,
    );

    expect(journal).not.toContain("seal:success");
    expect(terminalEvents).toEqual([]);
  });

  it("records NOTHING when an unrecorded refund parks the operation for a human", async () => {
    /* A park is not a terminal — the operation has not ended, it is waiting for
       support, and it will end later. #1425 made the same call for the same
       reason, and this is the road that reaches it on the live side. */
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({ committed: 4, failed: 1, refundUnrecorded: true }),
      },
      input,
    );

    expect(receipts.at(-1)).toMatchObject({ kind: "recovery" });
    expect(journal).not.toContain("seal:success");
    expect(terminalEvents).toEqual([]);
  });

  it("records NOTHING when the charge was refused, because nothing started running", async () => {
    chargeSucceeds = false;

    await expect(
      signCandidate({ schedulePackage: awaitPackage, buildPackage: packageReturning({}) }, input),
    ).rejects.toThrow();

    /* The failure road records its own terminal through
       `completeDirectOperationFailure`, which this file mocks — so the absence
       here is the absence of a DOUBLE, not of any event at all. */
    expect(receipts.at(-1)).toMatchObject({ kind: "failure" });
    expect(terminalEvents).toEqual([]);
  });
});

/**
 * WHO SHE IS ON CAMERA, AND HOW SHE SOUNDS — N2b's wiring (#1242).
 *
 * `castPersona.test.ts` drives the READER and `castPersonaWrite.test.ts` drives
 * the statement. These arms are about the thing neither can see: **whether the
 * mint actually calls it, with what, in what order, and what happens to the
 * Sign when it does not work.** His brief's two hard conditions are both
 * orderings — *"no step added to the Sign ceremony"* and *"a read that fails
 * leaves both lines empty"* — and an ordering is only ever visible from here.
 */
/** The sentence the seal logs when it genuinely fails — never about these. */
const SEAL_LIE = "the package could not be sealed";

describe("N2b's two lines are born inside the Sign", () => {
  type PersonaAsk = Parameters<CastPersonaReader["read"]>[0];
  const reader = (lines: { personality: string; voice: string } | null) => ({
    /* The argument is DECLARED rather than inferred: `tsconfig.casting-tests`
       reads an undeclared `vi.fn(async () => …)` as taking none, so
       `mock.calls[0][0]` is an index into an empty tuple. */
    read: vi.fn(async (_ask: PersonaAsk) => {
      journal.push("persona:read");
      return lines;
    }),
  });
  const LINES = { personality: "Unhurried, hands still.", voice: "Low and level." };

  it("carries all three of his sources: her brief, her corrections and the signed frame", async () => {
    /*
      ⚠ A REFINED BRANCH, because the sentences live on the VARIANT and a
      pristine master honestly has none. The first version of this arm set the
      sentences and left the master selected, and it went red - which is the
      fixture telling the truth about where her corrections come from.
    */
    selectedVariant = {
      id: 77,
      publicId: "variant-public",
      imageKey: "casting-v2/variants/refined.png",
      thumbKey: null,
      internalPrompt: { prompt: "composed", resolved: { sex: "female" } },
    };
    editSentences = ["make her hair shorter", "actually older"];
    const persona = reader(LINES);
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({}),
        personaReader: () => persona,
      },
      input,
    );

    expect(persona.read).toHaveBeenCalledTimes(1);
    const ask = persona.read.mock.calls[0]?.[0] as Record<string, unknown>;
    /* The ROLL's brief in her own words — never the composed master prompt. */
    expect(ask.brief).toBe("a redhead in her 30s");
    /* Her corrections, in order, from the same read as the face. */
    expect(ask.editSentences).toEqual(["make her hair shorter", "actually older"]);
    /* The frame she signed — the only reason two siblings differ. */
    expect(ask.anchor).toBeTruthy();
    /* Her pronouns, so the lines read as English about the right person. */
    expect(ask.pronouns).toMatchObject({ subject: "she" });
  });

  /*
    ⚠ THE WHOLE OF "OFF THE CUSTOMER'S WAIT", and the only place it is visible.

    The read is STARTED before the package is built and AWAITED after the seal.
    An arm that only checked "the reader was called" would be green with the
    await moved above `buildCastPackage` — which would add the read's whole
    latency to the first picture she sees, and is exactly the step his brief
    forbids being added to the ceremony.
  */
  /*
    ⚠ **THIS ARM IS DEFERRED AND THE REASON IS A SURVIVING SABOTAGE.** Its first
    shape read the journal — `persona:read` before `package`, `persona:write`
    after `seal:success` — and turning `derivePersonaLines(...)` into
    `await derivePersonaLines(...)` LEFT IT GREEN: a reader that resolves
    immediately journals its entry first either way, so the arm could not tell
    *started before* from *awaited before*, which is the entire claim.

    So the reader's promise is now resolved BY the package build. If the code
    awaits the read before dispatching the package, nothing ever resolves it and
    this arm hangs to its timeout instead of passing — which is the discriminator
    the first shape did not have.
  */
  it("starts the read BEFORE the package and lands the write AFTER the seal", async () => {
    let release: (() => void) | null = null;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const deferred = {
      read: vi.fn(async (_ask: PersonaAsk) => {
        journal.push("persona:read");
        await held;
        return LINES;
      }),
    };

    await signCandidate(
      {
        schedulePackage: awaitPackage,
        /* The package is what lets the read finish, so an awaited read cannot
           reach this at all. */
        buildPackage: (async (...args: unknown[]) => {
          release?.();
          return (packageReturning({}) as unknown as (...a: unknown[]) => Promise<unknown>)(...args);
        }) as unknown as SignServiceDependencies["buildPackage"],
        personaReader: () => deferred,
      },
      input,
    );

    expect(deferred.read).toHaveBeenCalledTimes(1);
    expect(journal.indexOf("persona:write")).toBeGreaterThan(journal.indexOf("seal:success"));
    expect(personaWrites).toHaveLength(1);
    expect(personaWrites[0]).toMatchObject({ modelId: expect.any(Number), ...LINES });
  });

  it("writes nothing at all when the read comes back empty — no badge, no blank card", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({}),
        personaReader: () => reader(null),
      },
      input,
    );
    expect(personaWrites).toHaveLength(0);
    /* And the Sign is finished regardless — this is his "leaves both lines
       empty", not "fails the Sign". */
    expect(journal).toContain("seal:success");
  });

  it("signs normally on a deployment with no reader at all", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({}),
        /* Production's own value when `OPENROUTER_API_KEY` is absent. */
        personaReader: () => null,
      },
      input,
    );
    expect(personaWrites).toHaveLength(0);
    expect(journal).toContain("seal:success");
    expect(receipts).toHaveLength(1);
  });

  /*
    ⚠ A READER THAT THROWS. The reader swallows its own faults, so this arm is
    about the BACKSTOP being a property of `derivePersonaLines` rather than a
    belief about another module — and about the promise never rejecting, since
    it is created minutes before it is awaited.
  */
  it("a reader that throws does not fail the Sign", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({}),
        personaReader: () => ({
          read: vi.fn(async (_ask: PersonaAsk) => {
            throw new Error("the reader exploded");
          }),
        }),
      },
      input,
    );
    expect(journal).toContain("seal:success");
    expect(receipts).toHaveLength(1);
    expect(personaWrites).toHaveLength(0);
    /*
      ⚠ AND IT IS CAUGHT BY THE READ'S OWN BACKSTOP, NOT BY THE SEAL'S CATCH.
      Both leave the Sign sealed — measured by sabotage, every assertion above
      survives the backstop's removal — so the only thing that distinguishes
      them is the sentence a human reads afterwards. Letting the throw reach the
      seal's catch would log "the package could not be sealed" about a package
      that was sealed, and that is what sends somebody looking at the money.
    */
    expect(logged.some((line) => line.includes("the two-line read threw"))).toBe(true);
    expect(logged.some((line) => line.includes(SEAL_LIE))).toBe(false);
  });

  /*
    ⚠ AND A WRITE THAT THROWS MUST NOT BE MISTAKEN FOR A SEAL FAILURE. This
    arm exists because the first placement of this call let the throw reach
    `completeSignPackage`'s catch, which logs *"the package could not be
    sealed"* — a false sentence about a sealed package, on a money road.
  */
  it("a write that throws leaves the receipt sealed and the delivery recorded", async () => {
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({}),
        personaReader: () => reader(LINES),
        writePersona: vi.fn(async () => {
          throw new Error("the write exploded");
        }),
      },
      input,
    );
    expect(journal).toContain("seal:success");
    expect(journal).not.toContain("seal:recovery");
    expect(receipts).toHaveLength(1);
    expect(terminalEvents).toHaveLength(1);
    /* The sentence is the defect — see the arm above. */
    expect(logged.some((line) => line.includes("could not be saved"))).toBe(true);
    expect(logged.some((line) => line.includes(SEAL_LIE))).toBe(false);
  });

  it("asks nothing and writes nothing when she refined nothing but still gets her lines", async () => {
    editSentences = [];
    const persona = reader(LINES);
    await signCandidate(
      {
        schedulePackage: awaitPackage,
        buildPackage: packageReturning({}),
        personaReader: () => persona,
      },
      input,
    );
    const ask = persona.read.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(ask.editSentences).toEqual([]);
    expect(personaWrites).toHaveLength(1);
  });
});
