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

/**
 * Successive ledger states, when a test needs the ledger to CHANGE between two
 * reads — the stalled-deduct race, where a charge commits after the gate has
 * already decided there was none. Each entry is consumed by one read; when it
 * runs out, `rows.ledger` answers as usual.
 */
let ledgerSequence: Array<Array<Record<string, unknown>>> = [];

function tableRows(table: unknown): Array<Record<string, unknown>> {
  const name = getTableName(table as never);
  if (name === "casting_rolls") return rows.rolls;
  if (name === "casting_candidates") return rows.candidates;
  // The ledger table is still named `point_transactions` from the credits
  // rename; `creditTransactions` is the drizzle handle onto it.
  if (name === "point_transactions") return ledgerSequence.shift() ?? rows.ledger;
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

const {
  recoverCastingV2RollOperation,
  candidateRefundReference,
  candidateUnseenChargeReference,
  candidateUnseenRefundReference,
  settleCancelledSlices,
} = await import("./rollRecovery");
const {
  ROLL_CANCEL_REFUND_DESCRIPTION,
  ROLL_UNSEEN_REFUND_DESCRIPTION,
  SLICE_REFUND_DESCRIPTION,
} = await import("./sliceRefundLedger");

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
let casWins = true;
/**
 * The race itself, injected per candidate.
 *
 * A CAS is lost because some OTHER process got to the row first, and what that
 * process managed to write before it died is the whole question. So a test
 * registers what the winner does — and it happens at exactly the moment the
 * real race happens, between this sweep's SELECT and its compare-and-swap.
 * Asserting on a row pre-set to `failed` would test a different defect (#868).
 */
const casLostTo = new Map<number, (row: Record<string, unknown>) => void>();
const claimCandidate = vi.fn(async ({ candidateId, failureClass }: { candidateId: number; failureClass: string }) => {
  const winner = casLostTo.get(candidateId);
  if (winner) {
    const stolen = rows.candidates.find((candidate) => candidate.id === candidateId);
    if (stolen) winner(stolen);
    return false;
  }
  if (!casWins) return false;
  const row = rows.candidates.find((candidate) => candidate.id === candidateId);
  if (!row) return false;
  const settleable =
    row.status === "queued" || row.status === "dispatched"
    || (row.status === "ready" && !row.imageKey);
  if (!settleable) return false;
  row.status = "failed";
  row.failureClass = failureClass;
  return true;
});

const finalizers = {
  finalizeSuccess: vi.fn(async () => ({}) as never),
  finalizeFailure: vi.fn(async () => ({}) as never),
  finalizeClaimedFailure: vi.fn(async () => ({}) as never),
};

function recover(
  operation: typeof OPERATION = OPERATION,
  options: Parameters<typeof recoverCastingV2RollOperation>[1] = {},
) {
  return recoverCastingV2RollOperation(operation, { ...finalizers, claimCandidate, ...options });
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
  casWins = true;
  casLostTo.clear();
  ledgerSequence = [];
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
    await recover({ ...OPERATION, status: "claimed" as never });
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

describe("delivered work is never refunded, however the crash arrives", () => {
  /*
    The defect this describes existed: the refund set was "everything that did
    not land", which swept in candidates the user had *already received*. The
    same candidate then got refunded or not depending purely on whether a
    process happened to crash — the cancellation law applied by coin toss.
  */
  it("never refunds a candidate the user discarded", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "discarded", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
    const outcome = await recover();

    // It was delivered, looked at, and thrown away. Refunding it would pay a
    // user for a candidate they consumed.
    expect(refunds.map((refund) => refund.reference)).toEqual([
      operationChargeReference(OPERATION_ID) + ":candidate:c-2",
    ]);
    expect(outcome).toMatchObject({ type: "partial", refundedCredits: 20 });
  });

  it("never refunds a candidate that landed after a cancel", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "expired", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled" }),
    ];
    /*
      ⚠ THE LEDGER ROW FOR c-2 WAS ADDED WITH #955, AND THE ASSERTION DID NOT
      MOVE. This arm held a `cancelled` row with NO refund on the ledger and
      asserted nothing was paid, on the stated ground that the cancel path had
      already refunded it — which is the one thing a `cancelled` row cannot
      prove. The arm was pinning the defect as correct. A cancel that finished
      leaves its refund under the slice's own reference, and that is the state
      this arm is about; the state without it is #955's own block below.
    */
    rows.ledger = [
      chargeRow(),
      {
        userId: OPERATION.userId,
        referenceId: candidateRefundReference(OPERATION_ID, "c-2"),
        type: "refund",
        amount: 20,
      },
    ];
    await recover();
    // `expired` is delivered-but-unshown (§F, §H.6): the provider was paid and
    // the user cancelled. `cancelled` was refunded by the cancel path, and the
    // ledger says so.
    expect(refunds).toHaveLength(0);
  });

  it("never refunds a signed candidate", async () => {
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "signed", imageKey: "k1" })];
    await recover();
    expect(refunds).toHaveLength(0);
  });

  it("counts a discarded candidate as delivered when classifying the roll", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "discarded", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
    const outcome = await recover();
    // Not a total failure: something was delivered, the user simply binned it.
    expect(outcome.type).toBe("partial");
    expect(rows.rolls[0].status).toBe("partial");
  });
});

describe("the CAS is claimed before the money moves", () => {
  it("refunds nothing when a live process settled the candidate first", async () => {
    /*
      The race that made this ordering necessary: a process can outlive its
      lease (one heartbeat failure stops the heartbeat permanently while
      dispatch keeps running), land the candidate, and only then have this
      sweep reach it. Refunding first and CASing afterwards meant the money was
      already gone when we discovered we had lost — delivered AND refunded.
    */
    casWins = false;
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "dispatched" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "paid_failure", refunded: 0 });
  });

  it("reads prior refunds from the ledger instead of re-issuing them", async () => {
    // A cancel already refunded c-1 under its own reference. The receipt must
    // include those credits, but this sweep must not record them again.
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "cancelled" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
    rows.ledger = [
      chargeRow(),
      {
        userId: OPERATION.userId,
        referenceId: candidateRefundReference(OPERATION_ID, "c-1"),
        type: "refund",
        amount: 20,
      },
    ];

    const outcome = await recover();

    // One new refund (c-2), and a total that accounts for both.
    expect(refunds).toHaveLength(1);
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 40 });
  });
});

describe("the torn write inside the live catch: `failed` written, the refund never recorded (#868)", () => {
  /*
    `dispatchCandidate`'s catch does two writes in order — `failCandidate`
    (row -> `failed`) then `recordRefund`. A dropped connection or a process
    death between them leaves `failed` on the row and nothing in the ledger,
    and `isSettleable` does not count a `failed` row, so the sweep used to
    seal the roll with the slice unpaid — forever, since nothing revisits a
    sealed receipt. The retry adjudicator already carries the rule (its header:
    "already `failed` means the service settled it and died after: the ledger
    decides whether the refund landed, and pays it once if not"); these arms
    hold the roll's to the same rule.
  */
  it("refunds a failed slice whose refund row is missing, once, under its own reference", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "failed", failureClass: "capability" }),
    ];
    // The charge, and no refund row for c-2 — the torn write.
    rows.ledger = [chargeRow()];

    const outcome = await recover();

    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ userId: OPERATION.userId, amount: 20 });
    // The SAME reference the live catch would have used, so a live process
    // racing this refund lands as the ledger's duplicate rather than a second
    // payment.
    expect(refunds[0].reference).toBe(`op:${OPERATION_ID}:charge:candidate:c-2`);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 1, refundedCredits: 20, chargedCredits: 160 });
    // Its row was already terminal; nothing about it is rewritten.
    expect(rows.candidates[1]).toMatchObject({ status: "failed", failureClass: "capability" });
    expect(finalizers.finalizeSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ chargedCredits: 160, refundedCredits: 20 }),
    );
  });

  it("does not refund a failed slice whose refund row is present — the idempotency control", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "failed", failureClass: "capability" }),
    ];
    rows.ledger = [
      chargeRow(),
      {
        userId: OPERATION.userId,
        referenceId: candidateRefundReference(OPERATION_ID, "c-2"),
        type: "refund",
        amount: 20,
      },
    ];

    const outcome = await recover();

    // The live catch settled it in full and died after; the sweep only reads,
    // and with nothing owed the roll closes on the same branch it always did.
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "durable_success", ready: 1 });
  });

  it("pays the torn slice beside the unfinished ones, inside one conservation ceiling", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "failed", failureClass: "capability" }),
      candidate({ id: 3, publicId: "c-3", status: "dispatched" }),
      candidate({ id: 4, publicId: "c-4", status: "failed", failureClass: "capability" }),
    ];
    rows.ledger = [
      chargeRow(),
      {
        userId: OPERATION.userId,
        referenceId: candidateRefundReference(OPERATION_ID, "c-4"),
        type: "refund",
        amount: 20,
      },
    ];

    const outcome = await recover();

    // c-3 (unfinished, CAS'd) and c-2 (torn) — never c-1 (landed), never c-4 (paid).
    expect(refunds.map((entry) => entry.reference)).toEqual([
      `op:${OPERATION_ID}:charge:candidate:c-3`,
      `op:${OPERATION_ID}:charge:candidate:c-2`,
    ]);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 2, refundedCredits: 60 });
    const total = refunds.reduce((sum, entry) => sum + entry.amount, 0) + 20;
    expect(total).toBeLessThanOrEqual(OPERATION.chargedCredits);
  });

  it("names the event the torn row recorded — a render fault's slice says so on the ledger", async () => {
    // The live catch composes the sentence from the failure class; the sweep
    // paying the same row must not describe a different event (PR #871 review).
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "failed", failureClass: "render_fault" }),
      candidate({ id: 2, publicId: "c-2", status: "failed", failureClass: "capability" }),
    ];
    const { recordRefund } = await import("../casting/atomicCredits");

    await recover();

    const descriptions = vi.mocked(recordRefund).mock.calls.map((call) => call[2]);
    expect(descriptions).toEqual([
      SLICE_REFUND_DESCRIPTION.renderFault,
      SLICE_REFUND_DESCRIPTION.candidateAbsent,
    ]);
  });

  it("never refunds a torn slice that was never charged for (pointsCost 0)", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "failed", failureClass: "capability", pointsCost: 0 }),
    ];
    const outcome = await recover();
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "durable_success", ready: 1 });
  });

  it("escalates instead of sealing when the torn slice's refund will not record", async () => {
    refundRecords = false;
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "failed", failureClass: "capability" }),
    ];
    const outcome = await recover();
    // The atomicCredits law: a refund that did not record is never sealed as
    // "settled". The user stays charged and support gets the operation.
    expect(outcome).toMatchObject({ type: "recovery_required", chargedCredits: 160, refundedCredits: 0 });
    expect(finalizers.finalizeSuccess).not.toHaveBeenCalled();
  });

  it("holds the ceiling over the torn slice too", async () => {
    // A mis-seeded pointsCost on a torn row must not refund past the charge.
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "failed", failureClass: "capability", pointsCost: 170 }),
    ];
    const outcome = await recover();
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "recovery_required", reason: "refund slices exceed the recorded charge" });
  });
});

describe("the CAS lost to a process that then died before its refund (#896)", () => {
  /*
    The same ending as #868 down a narrower road, and the road is what makes it
    invisible. #868 is the row that was ALREADY `failed` when this sweep took
    its snapshot. This is the row that was `dispatched` then and `failed` now:
    it went into `owed`, never into `torn` (which is derived from that same
    stale snapshot), lost its CAS to the dying process, and — before the fix —
    was skipped with a log line while the receipt sealed around it. Nothing
    revisits it afterwards: `isSettleable` cannot see a `failed` row.

    Every arm here injects the race at the moment the race happens, through the
    CAS itself. Pre-setting a row to `failed` would be #868's test, not this
    one.
  */

  /** The live process wins the row, writes `failed`, and dies. */
  const diesBeforeRefunding = (row: Record<string, unknown>) => {
    row.status = "failed";
    row.failureClass = "render_fault";
  };

  /** The live process wins the row and completes its settlement. */
  const settlesInFull = (publicId: string) => (row: Record<string, unknown>) => {
    diesBeforeRefunding(row);
    rows.ledger.push({
      userId: OPERATION.userId,
      referenceId: candidateRefundReference(OPERATION_ID, publicId),
      type: "refund",
      amount: 20,
    });
  };

  it("THE DEFECT: pays the slice the winner never paid, once, under its own reference", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, diesBeforeRefunding);

    const outcome = await recover();

    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ userId: OPERATION.userId, amount: 20 });
    expect(refunds[0].reference).toBe(`op:${OPERATION_ID}:charge:candidate:c-2`);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 1, refundedCredits: 20 });
    // The winner's row is read, never rewritten — it is already terminal and
    // its failure class is the winner's to state.
    expect(rows.candidates[1]).toMatchObject({ status: "failed", failureClass: "render_fault" });
  });

  it("names the event the winner recorded, not a constant", async () => {
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "dispatched" })];
    casLostTo.set(1, diesBeforeRefunding);

    await recover();

    const { recordRefund } = await import("../casting/atomicCredits");
    expect(recordRefund).toHaveBeenCalledWith(
      OPERATION.userId,
      20,
      SLICE_REFUND_DESCRIPTION.renderFault,
      `op:${OPERATION_ID}:charge:candidate:c-1`,
    );
  });

  it("THE CONTROL: pays nothing when the winner's refund did land", async () => {
    /*
      Without this arm the defect could be "fixed" by refunding every lost CAS,
      which pays a second time for every settlement that completed — the exact
      outcome the CAS-before-refund ordering exists to prevent.
    */
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, settlesInFull("c-2"));

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    // `partial`, not `durable_success`: the row WAS unfinished when this sweep
    // looked, so the early everything-landed branch is not the one taken. What
    // matters is the money, and no money moved.
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 0, refundedCredits: 0 });
  });

  it("THE CONTROL: pays nothing when the winner LANDED the candidate", async () => {
    // The original reason the CAS comes first: the process that beat us to the
    // row gave the user their image. Refunding here is delivered-and-refunded.
    //
    // ⚠ THE OUTCOME ON THIS ARM CHANGED WITH #956, AND THE MONEY DID NOT. It
    // read `paid_failure` until the counts were re-read at the seal, which is
    // this suite having pinned the defect as correct behaviour: the user is
    // holding the image the winner landed, and the receipt called the roll a
    // total failure because the snapshot predated the landing. `refunds` is
    // the assertion that must not move, and it has not.
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "dispatched" })];
    casLostTo.set(1, (row) => {
      row.status = "ready";
      row.imageKey = "k1";
    });

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 0 });
  });

  it("THE CONTROL: pays nothing when the winner left the row settleable", async () => {
    // A CAS can fail without the row moving at all. Nothing is owed on a row
    // still reading `dispatched`; the next sweep adjudicates it.
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "dispatched" })];
    casLostTo.set(1, () => {});

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "paid_failure", refunded: 0 });
  });

  it("pays the stranded slice exactly once when the unfinished rows are paid too", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "queued" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, diesBeforeRefunding);

    const outcome = await recover();

    expect(refunds.map((refund) => refund.reference)).toEqual([
      `op:${OPERATION_ID}:charge:candidate:c-1`,
      `op:${OPERATION_ID}:charge:candidate:c-2`,
    ]);
    expect(outcome).toMatchObject({ type: "paid_failure", refunded: 2, refundedCredits: 40 });
  });

  it("holds the conservation ceiling over a stranded slice too", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "queued", pointsCost: 150 }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched", pointsCost: 20 }),
    ];
    casLostTo.set(2, diesBeforeRefunding);

    const outcome = await recover();

    // 150 back, then a 20 slice that would take the total past the 160 charged.
    expect(refunds).toHaveLength(1);
    expect(outcome).toMatchObject({
      type: "recovery_required",
      reason: "refund slices exceed the recorded charge",
    });
  });

  it("never pays a stranded slice that was never charged for", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched", pointsCost: 0 }),
    ];
    casLostTo.set(2, diesBeforeRefunding);

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 0, refundedCredits: 0 });
  });

  it("escalates instead of sealing when the stranded slice's refund will not record", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, diesBeforeRefunding);
    refundRecords = false;

    const outcome = await recover();

    // The atomicCredits law reaches this road too: a refund that did not write
    // is never sealed as settled.
    expect(outcome).toMatchObject({ type: "recovery_required", refundedCredits: 0 });
    expect(finalizers.finalizeSuccess).not.toHaveBeenCalled();
  });
});

describe("the torn write inside the cancel: `cancelled` written, the refund never recorded (#955)", () => {
  /*
    `cancelRoll` does the live catch's two writes in the live catch's order —
    the `queued -> cancelled` CAS, then `recordRefund`. A process death between
    them left a slice in none of the sweep's sets: `isSettleable` excludes
    `cancelled`, `isTornFailure` asked only about `failed`, and `wasDelivered`
    does not name it. So the receipt sealed with the slice charged and nothing
    ever looked again. Production has never held a `cancelled` candidate, so
    these arms are the only road that has ever driven it.
  */
  const cancelRefund = (publicId: string, amount = 20) => ({
    userId: OPERATION.userId,
    referenceId: candidateRefundReference(OPERATION_ID, publicId),
    type: "refund",
    amount,
  });

  it("THE DEFECT: pays a cancelled slice whose refund row is missing, once, under the cancel's reference", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled" }),
    ];
    rows.ledger = [chargeRow()];

    const outcome = await recover();

    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ userId: OPERATION.userId, amount: 20 });
    // The reference `cancelRoll` passes, so a late refund from a cancel that
    // was only slow lands as the ledger's duplicate, never a second payment.
    expect(refunds[0].reference).toBe(`op:${OPERATION_ID}:charge:candidate:c-2`);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 1, refundedCredits: 20, chargedCredits: 160 });
    // Terminal already; the sweep reads it and never rewrites it.
    expect(rows.candidates[1]).toMatchObject({ status: "cancelled" });
  });

  it("says what the cancel would have said — the customer cancelled it, it did not fail to arrive", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "cancelled" }),
      candidate({ id: 2, publicId: "c-2", status: "failed", failureClass: "capability" }),
    ];
    const { recordRefund } = await import("../casting/atomicCredits");

    await recover();

    const descriptions = vi.mocked(recordRefund).mock.calls.map((call) => call[2]);
    expect(descriptions).toEqual([
      ROLL_CANCEL_REFUND_DESCRIPTION,
      SLICE_REFUND_DESCRIPTION.candidateAbsent,
    ]);
  });

  it("THE CONTROL: pays nothing when the cancel's refund did land", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled" }),
    ];
    rows.ledger = [chargeRow(), cancelRefund("c-2")];

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "durable_success", ready: 1 });
  });

  it("THE CONTROL: pays nothing for a cancelled slice when the roll was never charged", async () => {
    // The charge gate runs before any torn reading, so recovery never pays
    // back money the ledger does not show was taken.
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "cancelled" })];
    rows.ledger = [];

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome.type).toBe("free_failure");
  });

  it("never pays a cancelled slice that cost nothing", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled", pointsCost: 0 }),
    ];
    const outcome = await recover();
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "durable_success", ready: 1 });
  });

  it("holds the conservation ceiling over a torn cancel, counting refunds already on the ledger", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "cancelled", pointsCost: 150 }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled", pointsCost: 20 }),
    ];
    rows.ledger = [chargeRow(), cancelRefund("c-1", 150)];

    const outcome = await recover();

    // 150 already back; a 20 slice would take the total past the 160 charged.
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "recovery_required", reason: "refund slices exceed the recorded charge" });
  });

  it("escalates instead of sealing when the torn cancel's refund will not record", async () => {
    refundRecords = false;
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled" }),
    ];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "recovery_required", chargedCredits: 160, refundedCredits: 0 });
    expect(finalizers.finalizeSuccess).not.toHaveBeenCalled();
  });

  /*
    And #896's road, taken by a cancel: the row was `queued` in the snapshot,
    went into `owed`, and lost its CAS to a cancel that died before refunding.
    `torn` came from the stale snapshot and cannot hold it — only the re-read
    can. Injected through the CAS, at the moment the race happens.
  */
  it("THE DEFECT, BY THE LOST CLAIM: pays a slice a cancel won and never refunded", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
    casLostTo.set(2, (row) => {
      row.status = "cancelled";
    });
    const { recordRefund } = await import("../casting/atomicCredits");

    const outcome = await recover();

    expect(refunds.map((refund) => refund.reference)).toEqual([`op:${OPERATION_ID}:charge:candidate:c-2`]);
    expect(vi.mocked(recordRefund).mock.calls.map((call) => call[2])).toEqual([ROLL_CANCEL_REFUND_DESCRIPTION]);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 1, refundedCredits: 20 });
  });

  it("THE CONTROL, BY THE LOST CLAIM: pays nothing when the cancel that won finished its refund", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
    casLostTo.set(2, (row) => {
      row.status = "cancelled";
      rows.ledger.push(cancelRefund("c-2"));
    });

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 0, refundedCredits: 0 });
  });
});

describe("the torn write inside the unseen landing: `expired` written, the generosity refund never recorded (#994)", () => {
  /*
    A tile already with the provider when its roll was cancelled finishes, and
    `landCandidate` writes `expired` + `expiredReason = 'cancelled_unseen'` in
    one statement. The refund is a SECOND write. A death between them left the
    slice charged, and the sweep counted every `expired` row as delivered —
    because until migration 0018 it could not tell this landing from a retention
    expiry. Production held 0 such rows when this was written (24 unseen
    refunds have paid, all time), so these arms are the only road that drives it.
  */
  const unseenRefund = (publicId: string, amount = 20) => ({
    userId: OPERATION.userId,
    referenceId: candidateUnseenRefundReference(OPERATION_ID, publicId),
    type: "refund",
    amount,
  });
  it("THE DEFECT: pays an unseen landing whose refund row is missing, once, under the :unseen reference", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      unseen({ id: 2, publicId: "c-2" }),
    ];
    const { recordRefund } = await import("../casting/atomicCredits");

    const outcome = await recover();

    expect(refunds).toHaveLength(1);
    // The landing's own reference, so a refund from the live process that was
    // only slow lands as the ledger's duplicate, never a second payment.
    expect(refunds[0]).toMatchObject({
      userId: OPERATION.userId,
      amount: 20,
      reference: candidateUnseenChargeReference(OPERATION_ID, "c-2"),
    });
    expect(vi.mocked(recordRefund).mock.calls.map((call) => call[2])).toEqual([ROLL_UNSEEN_REFUND_DESCRIPTION]);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 1, refundedCredits: 20 });
    expect(rows.candidates[1]).toMatchObject({ status: "expired", expiredReason: "cancelled_unseen" });
  });

  it("THE CONTROL: pays nothing when the unseen refund did land", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      unseen({ id: 2, publicId: "c-2" }),
    ];
    rows.ledger = [chargeRow(), unseenRefund("c-2")];

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "durable_success", ready: 1 });
  });

  it("THE CONTROL: never pays a retention expiry — the customer looked at it for a week", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      unseen({ id: 2, publicId: "c-2", expiredReason: "retention" }),
    ];
    const outcome = await recover();
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "durable_success", ready: 1 });
  });

  it("THE CONTROL: never pays an `expired` row with no reason — the status alone is not the reading", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      unseen({ id: 2, publicId: "c-2", expiredReason: null }),
    ];
    const outcome = await recover();
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "durable_success", ready: 1 });
  });

  it("THE CONTROL: pays nothing for an unseen landing when the roll was never charged", async () => {
    rows.candidates = [unseen({ id: 1, publicId: "c-1" })];
    rows.ledger = [];
    const outcome = await recover();
    expect(refunds).toHaveLength(0);
    expect(outcome.type).toBe("free_failure");
  });

  it("never pays an unseen landing that cost nothing", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      unseen({ id: 2, publicId: "c-2", pointsCost: 0 }),
    ];
    await recover();
    expect(refunds).toHaveLength(0);
  });

  it("escalates instead of sealing when the unseen refund will not record", async () => {
    refundRecords = false;
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      unseen({ id: 2, publicId: "c-2" }),
    ];
    const outcome = await recover();
    expect(outcome).toMatchObject({ type: "recovery_required", chargedCredits: 160, refundedCredits: 0 });
    expect(finalizers.finalizeSuccess).not.toHaveBeenCalled();
  });

  /*
    THE LEDGER READ WIDENED WITH IT. An unseen refund that DID land was absent
    from `alreadyRefunded`, so it sat outside the conservation ceiling and off
    recovery's receipt, while the live receipt counted it.
  */
  it("counts an unseen refund already on the ledger toward the ceiling", async () => {
    rows.candidates = [
      unseen({ id: 1, publicId: "c-1", pointsCost: 150 }),
      candidate({ id: 2, publicId: "c-2", status: "queued", pointsCost: 20 }),
    ];
    rows.ledger = [chargeRow(), unseenRefund("c-1", 150)];

    const outcome = await recover();

    // 150 already back; a 20 slice would take the total past the 160 charged.
    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ type: "recovery_required", reason: "refund slices exceed the recorded charge" });
  });

  it("puts an unseen refund already on the ledger on recovery's receipt", async () => {
    rows.candidates = [
      unseen({ id: 1, publicId: "c-1" }),
      candidate({ id: 2, publicId: "c-2", status: "queued" }),
    ];
    rows.ledger = [chargeRow(), unseenRefund("c-1")];

    const outcome = await recover();

    expect(refunds).toHaveLength(1);
    expect(outcome).toMatchObject({ refundedCredits: 40 });
  });

  it("never counts a refund row under a reference this operation does not own", async () => {
    // The harness answers every row whatever the WHERE says, so this is the
    // arm that proves the sum is pinned to the reference set in code.
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "queued" })];
    rows.ledger = [
      chargeRow(),
      { userId: OPERATION.userId, referenceId: candidateRefundReference(OTHER_OPERATION_ID, "c-1"), type: "refund", amount: 20 },
    ];

    const outcome = await recover();

    expect(refunds).toHaveLength(1);
    expect(outcome).toMatchObject({ type: "paid_failure", refundedCredits: 20 });
  });

  it("THE DEFECT, BY THE LOST CLAIM: pays a tile that landed unseen and died before its refund", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, (row) => {
      Object.assign(row, { status: "expired", expiredReason: "cancelled_unseen", imageKey: "k2" });
    });

    const outcome = await recover();

    expect(refunds.map((refund) => refund.reference)).toEqual([candidateUnseenChargeReference(OPERATION_ID, "c-2")]);
    expect(outcome).toMatchObject({ refunded: 1, refundedCredits: 20 });
  });

  it("THE CONTROL, BY THE LOST CLAIM: pays nothing when the unseen landing finished its refund", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, (row) => {
      Object.assign(row, { status: "expired", expiredReason: "cancelled_unseen", imageKey: "k2" });
      rows.ledger.push(unseenRefund("c-2"));
    });

    const outcome = await recover();

    expect(refunds).toHaveLength(0);
    expect(outcome).toMatchObject({ refunded: 0, refundedCredits: 0 });
  });
});

describe("the live seal asks the ledger, not the rows, what a cancel refunded (#994)", () => {
  /*
    `createRoll`'s receipt summed every `cancelled` row's price as refunded. A
    row proves the cancel won its CAS, never that its refund recorded — and the
    live seal is the operation's last reader, so a slice a cancel failed to
    refund was stranded under a receipt saying it had come back.
  */
  const seal = () =>
    settleCancelledSlices({
      userId: OPERATION.userId,
      operationId: OPERATION_ID,
      candidates: rows.candidates as never,
    });
  const cancelRefund = (publicId: string) => ({
    userId: OPERATION.userId,
    referenceId: candidateRefundReference(OPERATION_ID, publicId),
    type: "refund",
    amount: 20,
  });

  it("counts a cancel refund the ledger holds, and pays nothing", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled" }),
    ];
    rows.ledger = [chargeRow(), cancelRefund("c-2")];

    expect(await seal()).toEqual({ refundedCredits: 20, unrecorded: 0 });
    expect(refunds).toHaveLength(0);
  });

  it("THE DEFECT: pays a cancelled slice the ledger shows unpaid, once, in the cancel's words", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "cancelled" }),
      candidate({ id: 2, publicId: "c-2", status: "cancelled" }),
    ];
    rows.ledger = [chargeRow(), cancelRefund("c-1")];
    const { recordRefund } = await import("../casting/atomicCredits");

    expect(await seal()).toEqual({ refundedCredits: 40, unrecorded: 0 });
    expect(refunds.map((refund) => refund.reference)).toEqual([`op:${OPERATION_ID}:charge:candidate:c-2`]);
    expect(vi.mocked(recordRefund).mock.calls.map((call) => call[2])).toEqual([ROLL_CANCEL_REFUND_DESCRIPTION]);
  });

  it("never reports a refund that will not record as refunded", async () => {
    refundRecords = false;
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "cancelled" })];

    expect(await seal()).toEqual({ refundedCredits: 0, unrecorded: 1 });
  });

  it("pays nothing, and reports every slice unrecorded, when the ledger shows no charge", async () => {
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "cancelled" })];
    rows.ledger = [];

    expect(await seal()).toEqual({ refundedCredits: 0, unrecorded: 1 });
    expect(refunds).toHaveLength(0);
  });

  it("pays nothing, and reports every slice unrecorded, when the ledger cannot be read", async () => {
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "cancelled" })];
    // Not an array, so the ledger read throws where a dropped connection would.
    ledgerSequence = [{} as never];

    expect(await seal()).toEqual({ refundedCredits: 0, unrecorded: 1 });
    expect(refunds).toHaveLength(0);
  });

  it("ignores rows that are not cancelled and slices that cost nothing", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "failed" }),
      unseen({ id: 2, publicId: "c-2" }),
      candidate({ id: 3, publicId: "c-3", status: "cancelled", pointsCost: 0 }),
    ];

    expect(await seal()).toEqual({ refundedCredits: 0, unrecorded: 0 });
    expect(refunds).toHaveLength(0);
  });
});

/** A tile that landed into a cancelled roll, as `landCandidate` writes it. */
function unseen(overrides: Record<string, unknown>) {
  return candidate({ status: "expired", expiredReason: "cancelled_unseen", imageKey: "k-unseen", ...overrides });
}

describe("a charge that lands while we adjudicate an unpaid roll", () => {
  it("escalates rather than sealing 'you were not charged' over a real charge", async () => {
    // The stalled-deduct TOCTOU: the sweep sees no charge, fails the rows, and
    // the live process's deduct commits a moment later. A terminal receipt
    // saying "not charged" is never revisited, so the user would be out the
    // money permanently.
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "queued" })];
    // Empty when the charge gate looks; charged by the time the recheck does.
    ledgerSequence = [[], [chargeRow()]];

    const outcome = await recover();

    expect(outcome).toMatchObject({ type: "recovery_required" });
    expect(refunds).toHaveLength(0);
  });
});

describe("the counts are re-read at the seal, so a late landing is not reported missing (#956)", () => {
  /*
    The half of #896's class that moves no money. A candidate that lands
    between this sweep's SELECT and its seal is in the customer's hands, and
    the sweep counted it from the snapshot — so the roll was written `failed`
    over a roll that delivered, and the receipt undercounted `ready`.

    EVERY ARM HERE ASSERTS `refunds` TOO. The fix touches what the customer is
    TOLD and must not touch what they are PAID: a re-read that started feeding
    the refund arithmetic would pay for rows this sweep never adjudicated, and
    that assertion is the only thing standing between the two.

    The race is injected through the CAS, where the real one happens.
  */

  /** The live process wins the row and lands the image the sweep never saw. */
  const landsTheImage = (key: string) => (row: Record<string, unknown>) => {
    row.status = "ready";
    row.imageKey = key;
  };

  it("THE DEFECT: a roll whose only slice landed mid-sweep is sealed partial, not failed", async () => {
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "dispatched" })];
    casLostTo.set(1, landsTheImage("k1"));

    const outcome = await recover();

    expect(outcome).toMatchObject({ type: "partial", ready: 1 });
    expect(rows.rolls[0].status).toBe("partial");
    expect(refunds).toHaveLength(0);
  });

  it("the receipt counts the late landing beside the one already there", async () => {
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, landsTheImage("k2"));

    const outcome = await recover();

    // `ready: 2` is the whole point — the snapshot saw one.
    expect(outcome).toMatchObject({ type: "partial", ready: 2, refunded: 0 });
    expect(refunds).toHaveLength(0);
  });

  it("counts a late DISCARD as delivered, exactly as the snapshot road does", async () => {
    // `wasDelivered` is wider than `hasLanded` on purpose: a candidate the
    // owner threw away was still delivered. The re-read must use the same
    // predicate, not a narrower one, or a discard mid-sweep reads as a failure.
    rows.candidates = [candidate({ id: 1, publicId: "c-1", status: "dispatched" })];
    casLostTo.set(1, (row) => {
      row.status = "discarded";
    });

    const outcome = await recover();

    expect(outcome).toMatchObject({ type: "partial", ready: 0 });
    expect(rows.rolls[0].status).toBe("partial");
    expect(refunds).toHaveLength(0);
  });

  it("THE CONTROL: a roll that really delivered nothing is still sealed failed", async () => {
    /*
      Without this arm the defect could be "fixed" by sealing every recovered
      roll `partial`, which tells a customer who got nothing that they got
      something — the opposite lie, and a likelier one to ship.
    */
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "queued" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];

    const outcome = await recover();

    expect(outcome).toMatchObject({ type: "paid_failure" });
    expect(rows.rolls[0].status).toBe("failed");
    // Both slices unfinished and unpaid: the money road is untouched by #956.
    expect(refunds).toHaveLength(2);
  });

  it("THE CONTROL: the re-read never pays anybody, even when it sees a torn row", async () => {
    /*
      A row that goes `failed` with no refund IS owed money — and it is owed it
      by #896's lost-claim block, which reads the ledger. If the seal re-read
      ever became a second money reader, this row would be paid twice. One
      refund is the correct answer and the count is the assertion.
    */
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    casLostTo.set(2, (row) => {
      row.status = "failed";
      row.failureClass = "render_fault";
    });

    const outcome = await recover();

    expect(refunds).toHaveLength(1);
    expect(refunds[0].reference).toBe(`op:${OPERATION_ID}:charge:candidate:c-2`);
    expect(outcome).toMatchObject({ type: "partial", ready: 1, refunded: 1 });
  });

  it("THE CONTROL: an empty re-read is disbelieved and the snapshot's count stands", async () => {
    /*
      The failure direction, driven rather than asserted in a comment. An empty
      result cannot mean every candidate vanished — the snapshot proved rows
      exist and nothing in this sweep deletes them — so it is a read that went
      wrong. Believing it would flip a delivered roll to `failed`, which is the
      exact harm this fix is about, arriving by the fix's own road.
    */
    rows.candidates = [
      candidate({ id: 1, publicId: "c-1", status: "ready", imageKey: "k1" }),
      candidate({ id: 2, publicId: "c-2", status: "dispatched" }),
    ];
    const snapshot = rows.candidates;
    casLostTo.set(2, (row) => {
      row.status = "failed";
      row.failureClass = "render_fault";
      // The table answers empty from here on — every later read, including the
      // seal's.
      rows.candidates = [];
    });

    const outcome = await recover();

    // The landed row is still reported, from the snapshot, because the empty
    // read was not believed.
    expect(outcome).toMatchObject({ type: "partial", ready: 1 });
    expect(snapshot[0]).toMatchObject({ status: "ready" });
  });
});
