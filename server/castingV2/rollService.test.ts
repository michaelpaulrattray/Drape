import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The roll service's money and its ordering (plan §F, §H).
 *
 * Two things are under test here, and they are the two things a billing review
 * should refuse to take on faith:
 *
 *   1. THE SEQUENCE. rows → running → charge → dispatch, in that order, every
 *      time. It is asserted as an observed order of calls rather than by
 *      reading the code, because the recovery adjudicator's central rule —
 *      "rows exist but no ledger charge means nothing was taken" — is only
 *      true while this order holds. Swap two lines and the adjudicator starts
 *      refunding money that was never charged; this test fails first.
 *
 *   2. CONSERVATION, per slice. A roll is eight independently refundable
 *      units, so the assertions are always of the sharp form: exactly the
 *      candidates that did not arrive were refunded, never one that did, never
 *      twice, never more than was charged.
 *
 * Every case constructs the exact state a crash or a race would leave and then
 * proves what happens to the money.
 */

type Journal = string[];
const journal: Journal = [];

const rows = {
  candidates: [] as Array<Record<string, unknown>>,
};

const refunds: Array<{ amount: number; reference: string }> = [];
let refundRecords = true;
let chargeSucceeds = true;

const dbCalls = {
  createRoll: vi.fn(),
  failCandidate: vi.fn(),
  setRollStatus: vi.fn(),
  cancelQueued: vi.fn(),
  markDispatched: vi.fn(),
  land: vi.fn(),
};

vi.mock("../db/castingV2", () => ({
  CastingV2OwnershipError: class extends Error {},
  createRollWithCandidates: vi.fn(async () => {
    journal.push("rows");
    dbCalls.createRoll();
    return {
      session: { id: 10 },
      roll: { id: 100, publicId: "roll-public", sessionId: 10, operationId: OPERATION_ID, priceCredits: 160 },
      candidates: rows.candidates,
    };
  }),
  listRollCandidates: vi.fn(async () => rows.candidates),
  getRollByOperation: vi.fn(async () => ({
    id: 100,
    publicId: "roll-public",
    priceCredits: 160,
    operationId: OPERATION_ID,
  })),
  getOwnedRoll: vi.fn(async () => ({
    id: 100,
    publicId: "roll-public",
    status: "generating",
    operationId: OPERATION_ID,
  })),
  markCandidateDispatched: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.markDispatched(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.status !== "queued") return false;
    row.status = "dispatched";
    return true;
  }),
  landCandidate: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.land(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.cancelledMidFlight) {
      row.status = "expired";
      return "expired";
    }
    if (row) row.status = "ready";
    return "ready";
  }),
  failCandidate: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.failCandidate(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row) row.status = "failed";
    return true;
  }),
  cancelQueuedCandidate: vi.fn(async ({ candidateId }: { candidateId: number }) => {
    dbCalls.cancelQueued(candidateId);
    const row = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (row?.status !== "queued") return false;
    row.status = "cancelled";
    return true;
  }),
  setRollStatus: vi.fn(async ({ status }: { status: string }) => {
    dbCalls.setRollStatus(status);
    return true;
  }),
  touchCastingSession: vi.fn(async () => undefined),
}));

vi.mock("../db/connection", () => ({
  // No frozen account in these scenarios; the frozen path has its own case.
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ frozenAt: null }] }) }),
    }),
  }),
}));

vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async () => ({ success: true, generationId: 1 })),
  updateGeneration: vi.fn(async () => ({ success: true })),
}));

vi.mock("../casting/atomicCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../casting/atomicCredits")>();
  return {
    ...actual,
    recordRefund: vi.fn(async (_userId: number, amount: number, _d: string, reference: string) => {
      journal.push("refund");
      if (!refundRecords) return { recorded: false, amount: 0, reference };
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference };
    }),
  };
});

const receipts = {
  // Takes its input like the other two. It was declared with none and called
  // with one — invisible while the typecheck skipped test files.
  success: vi.fn(async (_input: unknown) => undefined),
  failure: vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  }),
  claimedFailure: vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  }),
};

vi.mock("../casting/directOperation", () => ({
  beginDirectOperation: vi.fn(async () => {
    journal.push("claim");
    return { type: "execute", operationId: OPERATION_ID };
  }),
  completeDirectOperationSuccess: vi.fn(async (input: any) => receipts.success(input)),
  completeDirectOperationFailure: vi.fn(async (input: any) => receipts.failure(input)),
  failClaimedDirectOperation: vi.fn(async (input: any) => receipts.claimedFailure(input)),
}));

const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const { createRoll, cancelRoll } = await import("./rollService");
const { deterministicBriefCompiler } = await import("./briefCompiler");
const { candidateChargeReference } = await import("./rollRecovery");
const { ProviderError } = await import("../providers/types");

function seedCandidates(count = 8) {
  rows.candidates = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    publicId: `cand-${index + 1}`,
    position: index,
    pointsCost: 20,
    status: "queued",
  }));
}

/** An engine whose per-candidate outcome the test dictates. */
function engineWhere(fails: (position: number) => boolean) {
  let call = 0;
  return () => ({
    id: "fal:test",
    generateCandidate: vi.fn(async () => {
      const position = call++;
      if (fails(position)) throw new ProviderError("transport", "provider blew up");
      journal.push("dispatch");
      return {
        bytes: Buffer.from("image"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: "openai/gpt-image-2", providerRef: "req" },
      };
    }),
  });
}

function baseDependencies(fails: (position: number) => boolean = () => false) {
  return {
    engine: engineWhere(fails),
    /*
      Compile without an interpreter. These tests are about the billing
      sequence, and the default compiler now reaches for a text transport —
      which, with a real key in `.env`, turns a 17ms unit suite into 32
      seconds of live API calls against someone's account. A unit test that
      silently spends money is not a unit test.
    */
    compileBrief: deterministicBriefCompiler,
    admit: () => ({ admitted: true as const }),
    markRunning: vi.fn(async () => {
      journal.push("running");
      return { operationId: OPERATION_ID, chargeReferenceId: `op:${OPERATION_ID}:charge` };
    }),
    deduct: vi.fn(async () => {
      journal.push("charge");
      return chargeSucceeds
        ? { success: true, newBalance: 100 }
        : { success: false, error: "Insufficient credits" };
    }),
    storeImage: vi.fn(async () => ({ key: "casting-v2/candidates/x.png" })),
  } as never;
}

const INPUT = {
  userId: 7,
  clientRequestId: "44444444-4444-4444-8444-444444444444",
  sessionPublicId: "55555555-5555-4555-8555-555555555555",
  briefText: "a wiry cyclist in her 20s, freckled, mid-laugh",
};

beforeEach(() => {
  journal.length = 0;
  refunds.length = 0;
  refundRecords = true;
  chargeSucceeds = true;
  seedCandidates();
  vi.clearAllMocks();
  receipts.success.mockImplementation(async () => undefined);
});

describe("the sequence", () => {
  it("commits rows before it charges, and dispatches only after", async () => {
    await createRoll(baseDependencies(), INPUT);

    const first = journal.filter((entry) =>
      ["claim", "rows", "running", "charge", "dispatch"].includes(entry),
    );
    // The adjudicator's rule — rows without a charge means nothing was taken —
    // is only true while this order holds.
    expect(first.slice(0, 4)).toEqual(["claim", "rows", "running", "charge"]);
    expect(first[4]).toBe("dispatch");
  });

  it("refuses at the door without claiming or charging when the queue is full", async () => {
    const dependencies = baseDependencies();
    await expect(
      createRoll({ ...(dependencies as object), admit: () => ({ admitted: false, reason: "busy" }) } as never, INPUT),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    // §H.8: pressure produces an honest refusal, never a silent queue of paid
    // work — and nothing was claimed, so there is no receipt to reconcile.
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
  });

  it("refuses an uninterpretable brief for free", async () => {
    await expect(
      createRoll({ ...(baseDependencies() as object) } as never, { ...INPUT, briefText: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(journal).not.toContain("claim");
    expect(journal).not.toContain("charge");
  });
});

describe("insufficient credits", () => {
  it("dispatches nothing, refunds nothing, and drives the rows terminal", async () => {
    chargeSucceeds = false;
    await expect(createRoll(baseDependencies(), INPUT)).rejects.toBeTruthy();

    expect(journal).not.toContain("dispatch");
    // Refunding here would return money that was never taken.
    expect(refunds).toHaveLength(0);
    expect(rows.candidates.every((candidate) => candidate.status === "failed")).toBe(true);
    expect(dbCalls.setRollStatus).toHaveBeenCalledWith("failed");
    expect(receipts.failure).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 0, refundedCredits: 0 }),
    );
  });
});

describe("settlement per slice", () => {
  it("charges once and refunds nothing when all eight arrive", async () => {
    await createRoll(baseDependencies(), INPUT);
    expect(refunds).toHaveLength(0);
    expect(receipts.success).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 0, terminalStatus: "succeeded" }),
    );
  });

  it("refunds exactly the slices that failed, and records a partial", async () => {
    await createRoll(baseDependencies((position) => position < 2), INPUT);

    expect(refunds.map((refund) => refund.amount)).toEqual([20, 20]);
    const total = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    expect(total).toBe(40);
    expect(total).toBeLessThan(160);
    expect(receipts.success).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 40, terminalStatus: "partial" }),
    );
  });

  it("refunds the whole sheet and fails when nothing arrives", async () => {
    await expect(createRoll(baseDependencies(() => true), INPUT)).rejects.toBeTruthy();
    const total = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    expect(total).toBe(160);
    // Conservation's outer bound: never more than was charged.
    expect(total).toBeLessThanOrEqual(160);
    expect(receipts.failure).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 160 }),
    );
  });

  it("derives refund references identically to the recovery adjudicator", async () => {
    await createRoll(baseDependencies((position) => position === 0), INPUT);
    // Writer and recovery must agree byte for byte, or the ledger's uniqueness
    // cannot make a retry idempotent and the user is refunded twice.
    expect(refunds[0].reference).toBe(candidateChargeReference(OPERATION_ID, "cand-1"));
  });

  it("never reports 'you weren't charged' when a refund did not record", async () => {
    refundRecords = false;
    await expect(createRoll(baseDependencies(() => true), INPUT)).rejects.toMatchObject({
      message: expect.stringContaining("could not be recorded"),
    });
  });
});

describe("replay", () => {
  it("returns the existing roll instead of charging again", async () => {
    const directOperation = await import("../casting/directOperation");
    vi.mocked(directOperation.beginDirectOperation).mockResolvedValueOnce({
      type: "replay",
      operationId: OPERATION_ID,
      result: {},
    });

    const result = await createRoll(baseDependencies(), INPUT);

    expect(result.rollPublicId).toBe("roll-public");
    // Idempotency, not an error (§F): one request id, one roll, one charge.
    expect(journal).not.toContain("charge");
    expect(journal).not.toContain("rows");
  });
});

describe("cancel", () => {
  it("refunds only the candidates its CAS won", async () => {
    // Four already dispatched — the provider is working on them.
    rows.candidates.slice(0, 4).forEach((candidate) => {
      candidate.status = "dispatched";
    });

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });

    expect(result.cancelled).toBe(4);
    expect(result.refundedCredits).toBe(80);
    // Delivered work is never refunded (§H.6), and a candidate can only be won
    // by cancel or by dispatch — never both.
    expect(refunds).toHaveLength(4);
    expect(dbCalls.setRollStatus).toHaveBeenCalledWith("cancelled");

    /*
      The sheet paints from these two, and it cannot derive either: §J's
      projection collapses queued and dispatched into one `casting` status, so
      a client guessing which tiles to mark cancelled would paint over the four
      that are about to arrive.
    */
    expect(result.stillFinishing).toBe(4);
    expect(result.cancelledCandidateIds).toHaveLength(4);
    // Exactly the ones the CAS won — never the dispatched four.
    const dispatched = rows.candidates.slice(0, 4).map((candidate) => candidate.publicId);
    for (const id of result.cancelledCandidateIds) {
      expect(dispatched).not.toContain(id);
    }
  });

  it("refunds a candidate that lands unseen after the cancel", async () => {
    rows.candidates = [
      { id: 1, publicId: "cand-1", position: 0, pointsCost: 20, status: "queued", cancelledMidFlight: true },
    ];
    // The whole sheet here is one cancelled-mid-flight candidate, so the
    // create call ends in a refusal — and its wording must blame the cancel,
    // not us. "None of the sheet arrived" would read as our failure.
    await expect(createRoll(baseDependencies(), INPUT)).rejects.toMatchObject({
      message: expect.stringContaining("cancelled"),
    });

    // The generosity ruling (founder, 2026-07-31): we paid the provider, but
    // the user never saw it, so the credits go back. "Cancel refunds
    // everything you haven't seen" is the promise this test holds up.
    expect(rows.candidates[0].status).toBe("expired");
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount).toBe(20);
  });

  it("refunds the unseen landing under its own reference, not the failure one", async () => {
    rows.candidates = [
      { id: 1, publicId: "cand-1", position: 0, pointsCost: 20, status: "queued", cancelledMidFlight: true },
    ];
    await expect(createRoll(baseDependencies(), INPUT)).rejects.toThrow();

    // Absorbed COGS and "we failed you" are different events. The ledger has
    // to be able to tell them apart, or the generosity rule is invisible in
    // the accounts it costs money in.
    const failureReference = candidateChargeReference(OPERATION_ID, "cand-1");
    expect(refunds[0].reference).not.toBe(failureReference);
    expect(refunds[0].reference).toContain("unseen");
  });

  it("is a no-op on a terminal roll rather than a refusal", async () => {
    const castingDb = await import("../db/castingV2");
    vi.mocked(castingDb.getOwnedRoll).mockResolvedValueOnce({
      id: 100,
      publicId: "roll-public",
      status: "complete",
      operationId: OPERATION_ID,
    } as never);

    const result = await cancelRoll({ userId: 7, rollPublicId: "roll-public" });
    expect(result).toEqual({
      cancelled: 0,
      refundedCredits: 0,
      refundUnrecorded: false,
      // Nothing was stopped and nothing is coming — the sheet needs both to
      // say "this had already finished" rather than reporting a bare zero.
      stillFinishing: 0,
      cancelledCandidateIds: [],
    });
    expect(refunds).toHaveLength(0);
  });
});

/**
 * D-93's smoke alarm, in the mode the founder ruled it must ship in.
 *
 * "The detector classifies, persists its verdict, and alarms — but does NOT
 * auto-fail or refund — until its false-positive rate is measured on real
 * founder traffic."
 *
 * That is a promise about MONEY, so it is asserted against money: the real
 * D-93 specimen goes through the paid path and the customer keeps every
 * candidate and every credit.
 */
describe("the render-fault detector in shadow mode", () => {
  it("delivers and charges normally even when every candidate is a contact sheet", async () => {
    const { readFile } = await import("node:fs/promises");
    const specimen = await readFile(
      new URL("../../docs/specs/references/nine-tile-sheet.png", import.meta.url),
    );

    // `baseDependencies` is typed `never` for the callers that pass it
    // straight through; spreading needs a shape.
    const dependencies = {
      ...(baseDependencies() as Record<string, unknown>),
      engine: () => ({
        id: "fal:test",
        generateCandidate: vi.fn(async () => ({
          // The actual failure, not a stand-in. If the detector ever moves to
          // enforcing without this test being rewritten, this goes red.
          bytes: specimen,
          contentType: "image/png",
          latencyMs: 1,
          provenance: { provider: "fal" as const, model: "openai/gpt-image-2", providerRef: "req" },
        })),
      }),
    } as never;

    const result = await createRoll(dependencies, INPUT);

    expect(result.ready).toBe(8);
    expect(result.failed).toBe(0);
    // The whole point: no slice was taken back, because shadow mode does not
    // decide anything about money.
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toHaveLength(0);
  });
});
