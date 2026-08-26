import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { GENERATION_OPERATION_KINDS } from "../casting/operationContract";
import { FEATURE_TRANSITION_AUTHORITY } from "../casting/evidence/featureTransitionAuthority";
import { OPERATION_REPLAY_FAMILY_BY_KIND } from "../casting/evidence/operationReplayFamily";

/**
 * RECOVERY FOR A CRASHED RETRY (#122 shape 1).
 *
 * Crash-injection in the roll suite's style: each arm builds the exact
 * database state a crash would leave and proves what the adjudicator does
 * with it. The invariant is the roll's — a slice is refunded exactly when the
 * customer did not receive it, never when they did, and never twice — plus
 * the retry's own: with no lock to name the slice, NOTHING is guessed.
 */

const rows = {
  candidates: [] as Array<Record<string, unknown>>,
  ledger: [] as Array<Record<string, unknown>>,
};

function tableRows(table: unknown): Array<Record<string, unknown>> {
  const name = getTableName(table as never);
  if (name === "casting_candidates") return rows.candidates;
  if (name === "point_transactions") return rows.ledger;
  throw new Error(`Unexpected table in retry recovery: ${name}`);
}

vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          const source = tableRows(table);
          return Object.assign(Promise.resolve(source), { limit: async () => source });
        },
      }),
    }),
  }),
}));

const { recoverCastingV2RetryOperation, candidateIdOfLockKey, RECOVERED_RETRY_SENTENCE } = await import("./retryRecovery");
const { candidateChargeReference, candidateRefundReference } = await import("./rollRecovery");

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION = {
  id: OPERATION_ID,
  userId: 7,
  status: "running" as "running" | "claimed",
  chargedCredits: 0,
  refundedCredits: 0,
};

let casWins = true;
const claimCandidate = vi.fn(async ({ candidateId, failureClass }: { candidateId: number; failureClass: string }) => {
  if (!casWins) return false;
  const row = rows.candidates.find((candidate) => candidate.id === candidateId);
  if (!row) return false;
  row.status = "failed";
  row.failureClass = failureClass;
  return true;
});

let lockRow: { lockKey: string; kind: string } | null = { lockKey: "casting-candidate:1", kind: "castingV2.retry" };
const readLock = vi.fn(async () => lockRow);

const refunds: Array<{ userId: number; amount: number; reference: string }> = [];
let refundRecords = true;
const refund = vi.fn(async (userId: number, amount: number, _d: string, reference: string) => {
  if (!refundRecords) return { recorded: false, amount: 0, reference };
  refunds.push({ userId, amount, reference });
  return { recorded: true, amount, reference };
});

const finalizers = {
  finalizeSuccess: vi.fn(async () => ({}) as never),
  finalizeFailure: vi.fn(async () => ({}) as never),
  finalizeClaimedFailure: vi.fn(async () => ({}) as never),
};

function recover(operation: typeof OPERATION = OPERATION) {
  return recoverCastingV2RetryOperation(operation, {
    ...finalizers,
    claimCandidate: claimCandidate as never,
    readLock: readLock as never,
    refund: refund as never,
  });
}

function chargeRow(amount = 20) {
  return { userId: 7, referenceId: `op:${OPERATION_ID}:charge`, type: "generation", amount: -amount };
}

function priorRefundRow(amount = 20) {
  return { userId: 7, referenceId: candidateRefundReference(OPERATION_ID, "c-1"), type: "refund", amount };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return { id: 1, publicId: "c-1", rollId: 1, userId: 7, status: "dispatched", pointsCost: 20, imageKey: null, ...overrides };
}

beforeEach(() => {
  rows.candidates = [candidate()];
  rows.ledger = [chargeRow()];
  refunds.length = 0;
  refundRecords = true;
  casWins = true;
  lockRow = { lockKey: "casting-candidate:1", kind: "castingV2.retry" };
  vi.clearAllMocks();
});

describe("the kind is classified everywhere it must be", () => {
  it("exists and carries the intended entry in every exhaustive record", () => {
    expect(GENERATION_OPERATION_KINDS).toContain("castingV2.retry");
    expect(FEATURE_TRANSITION_AUTHORITY["castingV2.retry"]).toBe("not_applicable");
    expect(OPERATION_REPLAY_FAMILY_BY_KIND["castingV2.retry"]).toBeNull();
  });

  it("reads a candidate id out of the lock key and nothing else", () => {
    expect(candidateIdOfLockKey("casting-candidate:42")).toBe(42);
    expect(candidateIdOfLockKey("model:42")).toBeNull();
    expect(candidateIdOfLockKey("casting-candidate:0")).toBeNull();
    expect(candidateIdOfLockKey("casting-candidate:")).toBeNull();
  });
});

describe("the link", () => {
  it("parks the operation when it holds no candidate lock — nothing refunded on a guess", async () => {
    lockRow = null;
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "recovery_required", reason: expect.stringMatching(/no candidate lock/) });
    expect(refunds).toEqual([]);
    expect(finalizers.finalizeFailure).not.toHaveBeenCalled();
    expect(finalizers.finalizeSuccess).not.toHaveBeenCalled();
  });

  it("parks when the lock names something that is not a candidate", async () => {
    lockRow = { lockKey: "model:9", kind: "castingV2.retry" };
    expect(await recover()).toMatchObject({ type: "recovery_required" });
    expect(refunds).toEqual([]);
  });

  it("parks when the locked candidate is not this user's", async () => {
    rows.candidates = [candidate({ userId: 8 })];
    expect(await recover()).toMatchObject({ type: "recovery_required" });
    expect(refunds).toEqual([]);
  });
});

describe("the slice landed", () => {
  it("keeps the charge and seals a success", async () => {
    rows.candidates = [candidate({ status: "ready", imageKey: "casting-v2/candidates/x.png" })];
    const outcome = await recover();
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: 20 });
    expect(refunds).toEqual([]);
    expect(claimCandidate).not.toHaveBeenCalled();
    expect(finalizers.finalizeSuccess).toHaveBeenCalledWith(expect.objectContaining({
      operationId: OPERATION_ID, chargedCredits: 20, refundedCredits: 0, terminalStatus: "succeeded",
    }));
  });

  it("parks a landed slice with no recorded charge — impossible under the pinned sequence", async () => {
    rows.candidates = [candidate({ status: "ready", imageKey: "casting-v2/candidates/x.png" })];
    rows.ledger = [];
    expect(await recover()).toMatchObject({ type: "recovery_required" });
    expect(finalizers.finalizeSuccess).not.toHaveBeenCalled();
  });
});

describe("the slice did not land", () => {
  it("fails a dispatched slice by CAS, refunds it once under the retry's reference, and seals the failure", async () => {
    const outcome = await recover();
    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: 20, refundedCredits: 20 });
    expect(claimCandidate).toHaveBeenCalledWith({ userId: 7, candidateId: 1, failureClass: "unrecovered" });
    expect(refunds).toEqual([{ userId: 7, amount: 20, reference: candidateChargeReference(OPERATION_ID, "c-1") }]);
    expect(finalizers.finalizeFailure).toHaveBeenCalledWith(expect.objectContaining({
      publicMessage: RECOVERED_RETRY_SENTENCE, chargedCredits: 20, refundedCredits: 20,
    }));
  });

  it("settles a torn write — ready with no bytes — as a failure, the roll's rule", async () => {
    rows.candidates = [candidate({ status: "ready", imageKey: null })];
    expect(await recover()).toMatchObject({ type: "paid_failure", refundedCredits: 20 });
  });

  it("never refunds twice: a refund the service recorded before dying is read, not re-issued", async () => {
    rows.candidates = [candidate({ status: "failed", failureClass: "timeout" })];
    rows.ledger = [chargeRow(), priorRefundRow()];
    const outcome = await recover();
    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: 20, refundedCredits: 20 });
    expect(refunds).toEqual([]);
    expect(claimCandidate).not.toHaveBeenCalled();
    expect(finalizers.finalizeFailure).toHaveBeenCalledTimes(1);
  });

  it("pays the refund the service died before recording, on an already-failed row", async () => {
    rows.candidates = [candidate({ status: "failed", failureClass: "timeout" })];
    expect(await recover()).toEqual({ type: "paid_failure", chargedCredits: 20, refundedCredits: 20 });
    expect(refunds).toHaveLength(1);
  });

  it("closes free when the crash landed before the charge", async () => {
    rows.ledger = [];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "free_failure" });
    expect(refunds).toEqual([]);
    expect(rows.candidates[0].status).toBe("failed");
    expect(finalizers.finalizeFailure).toHaveBeenCalledWith(expect.objectContaining({ chargedCredits: 0, refundedCredits: 0 }));
  });

  it("uses the claimed finalizer for a crash that left the operation claimed", async () => {
    rows.ledger = [];
    await recover({ ...OPERATION, status: "claimed" });
    expect(finalizers.finalizeClaimedFailure).toHaveBeenCalledTimes(1);
    expect(finalizers.finalizeFailure).not.toHaveBeenCalled();
  });

  it("parks when a live process wins the CAS first, and adjudicates again next sweep", async () => {
    casWins = false;
    expect(await recover()).toMatchObject({ type: "recovery_required", reason: expect.stringMatching(/moved/) });
    expect(refunds).toEqual([]);
  });

  it("parks rather than lie when the refund does not record", async () => {
    refundRecords = false;
    expect(await recover()).toMatchObject({ type: "recovery_required", reason: "the refund did not record" });
    expect(finalizers.finalizeFailure).not.toHaveBeenCalled();
  });

  it("parks a slice in a state this road does not settle", async () => {
    rows.candidates = [candidate({ status: "discarded" })];
    expect(await recover()).toMatchObject({ type: "recovery_required" });
    expect(refunds).toEqual([]);
  });

  it("parks on an ambiguous ledger — two charge rows for one operation", async () => {
    rows.ledger = [chargeRow(), chargeRow()];
    expect(await recover()).toMatchObject({ type: "recovery_required" });
    expect(refunds).toEqual([]);
  });

  it("escalates when the receipt does not seal, keeping the settled money visible", async () => {
    finalizers.finalizeFailure.mockRejectedValueOnce(new Error("receipt write failed"));
    expect(await recover()).toMatchObject({ type: "recovery_required", reason: "receipt did not seal after adjudication" });
    expect(refunds).toHaveLength(1);
  });
});
