import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  GENERATION_OPERATION_KINDS,
  operationChargeReference,
} from "../casting/operationContract";
import { FEATURE_TRANSITION_AUTHORITY } from "../casting/evidence/featureTransitionAuthority";
import { OPERATION_REPLAY_FAMILY_BY_KIND } from "../casting/evidence/operationReplayFamily";

/**
 * Roll recovery adjudication (plan §E, §F, §H.6).
 *
 * These are crash-injection tests in the style the founder asked for: rather
 * than asserting that conservation holds, each case constructs the exact
 * database state a crash would leave behind and then proves what the
 * adjudicator does with it — including the cases where the refund itself
 * fails.
 *
 * The invariant under test throughout is credit conservation:
 *
 *     0 ≤ refunded ≤ charged
 *
 * and its sharper form — a user is refunded for exactly the candidates they
 * did not receive, never for one they did, and never twice.
 */

const rows = {
  rolls: [] as Array<Record<string, unknown>>,
  candidates: [] as Array<Record<string, unknown>>,
  /**
   * The credit ledger. It is in this harness because it is the ONLY authority
   * on whether money moved: the pinned sequence commits roll rows before the
   * deduct, so the rows alone cannot tell a paid roll from a crash one
   * statement earlier.
   */
  ledger: [] as Array<Record<string, unknown>>,
};
const refunds: Array<{ userId: number; amount: number; reference: string }> = [];
let refundRecords = true;

function tableRows(table: unknown): Array<Record<string, unknown>> {
  const name = getTableName(table as never);
  if (name === "casting_rolls") return rows.rolls;
  if (name === "casting_candidates") return rows.candidates;
  // The ledger table is still named `point_transactions` from the credits
  // rename; `creditTransactions` is the drizzle handle onto it.
  if (name === "point_transactions") return rows.ledger;
  throw new Error(`Unexpected table in roll recovery: ${name}`);
}

vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          const source = tableRows(table);
          return Object.assign(Promise.resolve(source), {
            limit: async () => source,
          });
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          for (const row of tableRows(table)) Object.assign(row, values);
          return undefined;
        },
      }),
    }),
  }),
}));

vi.mock("../casting/atomicCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../casting/atomicCredits")>();
  return {
    ...actual,
    recordRefund: vi.fn(async (userId: number, amount: number, _d: string, reference: string) => {
      if (!refundRecords) return { recorded: false, amount: 0, reference: `refund:${reference}` };
      refunds.push({ userId, amount, reference });
      return { recorded: true, amount, reference: `refund:${reference}` };
    }),
  };
});

const { recoverCastingV2RollOperation, candidateRefundReference } = await import("./rollRecovery");

// Real UUIDs: operationChargeReference asserts the shape, which is itself a
// guard worth keeping — an unparseable operation id must never reach the ledger.
const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION = {
  id: OPERATION_ID,
  userId: 7,
  status: "running" as const,
  chargedCredits: 160,
  refundedCredits: 0,
};

/**
 * Receipt finalizers, injected.
 *
 * Adjudication and sealing are separate concerns, and these spies let each
 * test assert BOTH: what happened to the money, and that the operation was
 * actually driven terminal. An adjudicator that settles perfectly but never
 * seals leaves the sweep re-examining the same operation forever and the
 * user's sheet spinning — so "which finalizer ran" is part of the contract.
 */
const finalizers = {
  finalizeSuccess: vi.fn(async () => ({}) as never),
  finalizeFailure: vi.fn(async () => ({}) as never),
  finalizeClaimedFailure: vi.fn(async () => ({}) as never),
};

function recover(
  operation: typeof OPERATION = OPERATION,
  options: Parameters<typeof recoverCastingV2RollOperation>[1] = {},
) {
  return recoverCastingV2RollOperation(operation, { ...finalizers, ...options });
}

/** The charge the pinned deduct would have written. */
function chargeRow(amount = 160) {
  return {
    userId: OPERATION.userId,
    referenceId: `op:${OPERATION_ID}:charge`,
    type: "generation",
    amount: -amount,
  };
}

function candidate(overrides: Record<string, unknown>) {
  return {
    id: 1,
    publicId: "c-1",
    rollId: 1,
    userId: 7,
    status: "queued",
    pointsCost: 20,
    imageKey: null,
    provider: null,
    providerRef: null,
    ...overrides,
  };
}

beforeEach(() => {
  rows.rolls = [{ id: 1, publicId: "roll-1", operationId: OPERATION_ID, userId: 7, status: "generating" }];
  rows.candidates = [];
  // Default: the roll was paid for. Cases that crash before the deduct empty
  // this deliberately, and say so.
  rows.ledger = [chargeRow()];
  refunds.length = 0;
  refundRecords = true;
  vi.clearAllMocks();
});

describe("the new operation kind is classified everywhere it must be", () => {
  it("exists and carries an explicit entry in every exhaustive record", () => {
    expect(GENERATION_OPERATION_KINDS).toContain("castingV2.roll");
    // These Records are typed as exhaustive, so a missing entry is a compile
    // error — but a *wrong* entry is not. Pin the intended classification.
    expect(FEATURE_TRANSITION_AUTHORITY["castingV2.roll"]).toBe("not_applicable");
    expect(OPERATION_REPLAY_FAMILY_BY_KIND["castingV2.roll"]).toBeNull();
  });
});

describe("refund references", () => {
  it("derives per-candidate references through the shared helper", () => {
    const first = candidateRefundReference(OPERATION_ID, "cand-a");
    const second = candidateRefundReference(OPERATION_ID, "cand-b");
    expect(first).not.toBe(second);
    // Writer and recovery must produce byte-identical references or the
    // ledger's uniqueness cannot make retries idempotent.
    expect(first).toBe(candidateRefundReference(OPERATION_ID, "cand-a"));

    // The composed reference is longer than the ledger's 64-character column,
    // so the helper hashes it. That is the reason to go through the helper at
    // all: a hand-built string would either overflow or be truncated
    // differently at the two call sites, and writer and recovery would stop
    // agreeing on the identity of a refund.
    expect(first.length).toBeLessThanOrEqual(64);
    expect(candidateRefundReference(OTHER_OPERATION_ID, "cand-a")).not.toBe(first);
  });
});

describe("crash: after the claim, before any rows were committed", () => {
  it("refunds nothing, because the charge happens only after rows are durable", async () => {
    rows.rolls = [];
    const outcome = await recover();
    expect(outcome).toEqual({ type: "free_failure", reason: "no roll rows were committed" });
    // Inventing a refund here would return money that was never taken.
    expect(refunds).toHaveLength(0);
    // And it is a FREE failure, not a paid one: "paid" is what downstream
    // accounting reads to decide money moved.
    expect(finalizers.finalizeFailure).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 0, refundedCredits: 0 }),
    );
  });
});

describe("crash: rows committed, charge not yet recorded", () => {
  /*
    The window the pinned sequence deliberately creates:

      claim → locked transaction → ROWS → running → pinned deduct → dispatch
                                     ↑ crash here

    Roll and candidate rows exist and look exactly like a paid roll that never
    finished. The only thing that distinguishes them is the absence of a
    charge in the ledger — and an adjudicator that refunded from the rows
    alone would mint 160 credits out of a crash, every time one happened.
  */
  beforeEach(() => {
    rows.ledger = [];
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "queued" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
  });

  it("refunds nothing at all", async () => {
    const outcome = await recover();
    expect(outcome.type).toBe("free_failure");
    expect(refunds).toHaveLength(0);
  });

  it("still drives the rows terminal so no sheet spins forever", async () => {
    await recover();
    expect(rows.rolls[0].status).toBe("failed");
    expect(rows.candidates.every((row) => row.status === "failed")).toBe(true);
    expect(rows.candidates.every((row) => row.failureClass === "unpaid")).toBe(true);
  });

  it("seals a claimed operation with the claimed finalizer", async () => {
    // A crash before `markRunning` leaves the operation `claimed`, and the
    // running finalizer refuses a claimed row outright — sealing it with the
    // wrong one would throw and strand the operation.
    await recover({ ...OPERATION, status: "claimed" });
    expect(finalizers.finalizeClaimedFailure).toHaveBeenCalledTimes(1);
    expect(finalizers.finalizeFailure).not.toHaveBeenCalled();
  });

  it("escalates rather than guessing when work landed with no charge", async () => {
    // Dispatch happens after the deduct, so this state is impossible under the
    // pinned sequence. If it appears anyway the sequence was violated, and
    // both silent answers — keep the images free, or refund nothing quietly —
    // are dishonest.
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" })];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "recovery_required" });
    expect(refunds).toHaveLength(0);
  });
});

describe("the ledger is read as evidence, not as a formality", () => {
  it("escalates on duplicate charge rows instead of picking one", async () => {
    rows.ledger = [chargeRow(), chargeRow()];
    rows.candidates = [candidate({ status: "queued" })];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "recovery_required" });
    expect(refunds).toHaveLength(0);
  });

  it("escalates when the charge reference holds something that is not a charge", async () => {
    rows.ledger = [{ ...chargeRow(), type: "refund", amount: 160 }];
    rows.candidates = [candidate({ status: "queued" })];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "recovery_required" });
  });

  it("never refunds more than the ledger says was taken", async () => {
    // A corrupted slice price is the realistic route to over-refunding: the
    // slice is read from the candidate's own row. Conservation is enforced,
    // not assumed.
    rows.ledger = [chargeRow(40)];
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "queued", pointsCost: 20 }),
      candidate({ id: 2, publicId: "c-2", status: "queued", pointsCost: 20 }),
      candidate({ id: 3, publicId: "c-3", status: "queued", pointsCost: 20 }),
    ];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "recovery_required" });
    const total = refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(total).toBeLessThanOrEqual(40);
  });
});

describe("crash: every candidate landed", () => {
  it("finalises the roll complete and refunds nothing", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "ready", imageKey: "k2" }),
    ];
    const outcome = await recover();
    expect(outcome).toEqual({ type: "durable_success", ready: 2, chargedCredits: 160 });
    expect(refunds).toHaveLength(0);
    expect(rows.rolls[0].status).toBe("complete");
  });

  it("treats ready-without-an-image as NOT landed", async () => {
    // Landed means the bytes are in our storage. A `ready` row with no
    // imageKey is a torn write, and paying nothing back for it would keep
    // money for an image the user cannot see.
    rows.candidates = [candidate({ status: "ready", imageKey: null })];
    const outcome = await recover();
    expect(outcome.type).toBe("paid_failure");
    expect(refunds).toHaveLength(1);
  });
});

describe("crash: mid-roll, some landed", () => {
  it("refunds exactly the slices that did not land", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "ready", imageKey: "k2" }),
      candidate({ id: 3, publicId: "c-3", status: "dispatched" }),
      candidate({ id: 4, publicId: "c-4", status: "queued" }),
    ];

    const outcome = await recover();

    expect(outcome).toMatchObject({ type: "partial", ready: 2, refunded: 2, refundedCredits: 40 });
    expect(refunds.map((entry) => entry.amount)).toEqual([20, 20]);
    // Conservation: never more than was charged, never for a delivered slice.
    const total = refunds.reduce((sum, entry) => sum + entry.amount, 0);
    expect(total).toBeLessThanOrEqual(OPERATION.chargedCredits);
    expect(refunds.every((entry) => !entry.reference.includes("c-1"))).toBe(true);
    expect(rows.rolls[0].status).toBe("partial");
  });

  it("refunds every slice and fails the roll when nothing landed", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "dispatched" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "paid_failure", refunded: 2, refundedCredits: 40 });
    expect(rows.rolls[0].status).toBe("failed");
  });
});

describe("the provider probe changes accounting, never the refund", () => {
  it("refunds a delivered-but-unlanded candidate and records that we ate the cost", async () => {
    rows.candidates = [
      candidate({ status: "dispatched", provider: "fal", providerRef: "req-1" }),
    ];

    const outcome = await recover(OPERATION, {
      probe: async () => "delivered",
    });

    // The user has no image, so they are refunded either way. What the probe
    // buys is knowing the difference.
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 20 });
    expect(rows.candidates[0].failureClass).toBe("provider_delivered_unlanded");
  });

  it("marks unrecovered when the provider says it never delivered", async () => {
    rows.candidates = [candidate({ status: "dispatched", providerRef: "req-2" })];
    await recover(OPERATION, { probe: async () => "not_delivered" });
    expect(rows.candidates[0].failureClass).toBe("unrecovered");
  });

  it("never probes a candidate that was never dispatched", async () => {
    const probe = vi.fn(async () => "delivered" as const);
    rows.candidates = [candidate({ status: "queued" })];
    await recover(OPERATION, { probe });
    // A queued candidate never reached the provider; asking about it would be
    // a pointless round trip on every sweep.
    expect(probe).not.toHaveBeenCalled();
  });

  it("still refunds when the probe itself throws", async () => {
    rows.candidates = [candidate({ status: "dispatched", providerRef: "req-3" })];
    const outcome = await recover(OPERATION, {
      probe: async () => {
        throw new Error("fal unreachable");
      },
    });
    // A provider outage must not strand a refund.
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 20 });
  });
});

describe("crash: the refund itself fails to record", () => {
  it("escalates to recovery_required instead of claiming conservation", async () => {
    refundRecords = false;
    rows.candidates = [candidate({ status: "dispatched" })];

    const outcome = await recover();

    // The atomicCredits law: a refund that failed to record is NEVER reported
    // as "you weren't charged". Silence here would leave a user out of pocket
    // with the ledger insisting otherwise.
    expect(outcome.type).toBe("recovery_required");
    expect(outcome).toMatchObject({ refundedCredits: 0 });
  });
});
