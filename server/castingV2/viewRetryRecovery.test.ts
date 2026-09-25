import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE SWEEP'S HALF OF A TRY AGAIN (#1208 slice 2) — the money law.
 *
 * One question decides everything: **did a picture land under this operation?**
 * These arms drive the adjudicator over a fake ledger and a fake asset answer,
 * because the two facts it reasons from are exactly those and nothing else —
 * never the operation's own status, which is what a crash leaves wrong.
 *
 * The arm that earns its keep is the LAST one: a free try again has an empty
 * ledger, which looks identical to a paid one that died before its deduct, and
 * both must close free rather than refund something nobody paid.
 */

const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const CHARGE_REFERENCE = `op:${OPERATION_ID}:charge`;
const REFUND_REFERENCE = `refund:op:${OPERATION_ID}:charge`;

let ledger: Array<{ referenceId: string; type: string; amount: number }> = [];

vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({ from: () => ({ where: async () => ledger }) }),
  }),
}));

const finalizers = {
  success: vi.fn(async (_input: unknown) => undefined),
  failure: vi.fn(async (_input: unknown) => undefined),
  claimedFailure: vi.fn(async (_input: unknown) => undefined),
};
vi.mock("../db/generationOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/generationOperations")>()),
  finalizeGenerationOperationSuccess: vi.fn(async (input: unknown) => finalizers.success(input)),
  finalizeGenerationOperationFailure: vi.fn(async (input: unknown) => finalizers.failure(input)),
  finalizeClaimedGenerationOperationFailure: vi.fn(async (input: unknown) =>
    finalizers.claimedFailure(input)),
}));

import { recoverCastingV2ViewRetryOperation } from "./viewRetryRecovery";

const refunds: Array<{ amount: number; reference: string }> = [];
let landed = false;

function dependencies() {
  return {
    landed: (async () => landed) as never,
    refund: (async (_userId: number, amount: number, _d: string, reference: string) => {
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference, duplicate: false };
    }) as never,
  };
}

const operation = {
  id: OPERATION_ID,
  userId: 1,
  modelId: 7,
  status: "running" as const,
  chargedCredits: 50,
  refundedCredits: 0,
};

beforeEach(() => {
  ledger = [];
  refunds.length = 0;
  landed = false;
  finalizers.success.mockClear();
  finalizers.failure.mockClear();
  finalizers.claimedFailure.mockClear();
});

describe("a swept try again", () => {
  it("keeps the 50 when a picture landed under this operation", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 }];
    landed = true;
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: 50 });
    expect(refunds).toHaveLength(0);
    expect(finalizers.success).toHaveBeenCalledTimes(1);
  });

  it("gives the 50 back when nothing landed", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 }];
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: 50, refundedCredits: 50 });
    expect(refunds).toEqual([{ amount: 50, reference: CHARGE_REFERENCE }]);
  });

  it("never refunds twice — a refund already on the ledger is READ, not re-issued", async () => {
    ledger = [
      { referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 },
      { referenceId: REFUND_REFERENCE, type: "refund", amount: 50 },
    ];
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: 50, refundedCredits: 50 });
    expect(refunds).toHaveLength(0);
  });

  it("closes a FREE try again free — an empty ledger owes nothing", async () => {
    /*
      A free retry never charges, so its ledger is empty by design; a paid one
      that died before its deduct looks identical. Both owe nothing, and
      neither is a guess — the ledger was read.
    */
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome.type).toBe("free_failure");
    expect(refunds).toHaveLength(0);
    expect(finalizers.failure).toHaveBeenCalledTimes(1);
  });

  it("parks rather than refunds when it cannot ask whether a view landed", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 }];
    const outcome = await recoverCastingV2ViewRetryOperation(
      { ...operation, modelId: null },
      dependencies(),
    );
    expect(outcome.type).toBe("recovery_required");
    expect(refunds).toHaveLength(0);
    /* A parked row writes no receipt here — the sweep writes its own. */
    expect(finalizers.failure).not.toHaveBeenCalled();
  });

  it("a crash before the charge on a CLAIMED row takes the claimed finalizer", async () => {
    const outcome = await recoverCastingV2ViewRetryOperation(
      { ...operation, status: "claimed" },
      dependencies(),
    );
    expect(outcome.type).toBe("free_failure");
    expect(finalizers.claimedFailure).toHaveBeenCalledTimes(1);
    expect(finalizers.failure).not.toHaveBeenCalled();
  });
});
