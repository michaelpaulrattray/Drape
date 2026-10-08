/**
 * THE ONE SEAM THE PRODUCT EVENT STREAM IS WIRED AT (#509 part 2).
 *
 * `server/casting/directOperation.ts` claims, finishes or fails every
 * generation this product performs, so the stream is derived from that lifecycle
 * rather than mirrored by a `capture()` in each service. This suite drives the
 * REAL functions — with the database faked, not the functions — and holds four
 * things that a reading of the diff could not settle:
 *
 *   1. **The order.** Every capture sits AFTER the receipt it describes, so an
 *      operation whose receipt failed is never counted as delivered.
 *   2. **The replay.** A retried request id is claimed once and delivered once.
 *      Without this, a customer's flaky connection would inflate exactly the
 *      number the founder would read first.
 *   3. **The action.** The completion functions never see a `kind`, so the noun
 *      is remembered at the claim — and when it is NOT remembered (a deploy
 *      between the two halves) the event says `unnamed action` rather than
 *      guessing.
 *   4. **The money, both ways.** A failure that refunded everything and one that
 *      refunded nothing are different facts about the product.
 *
 * ⚠ It does NOT assert that nothing throws by wrapping in try/catch and hoping.
 * The capture is placed outside the `try` that guards each receipt, and the arm
 * for that drives a transport which throws.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  claimGenerationOperation: vi.fn(),
  acquireGenerationOperationLock: vi.fn(),
  acquireCastingCandidateOperationLock: vi.fn(),
  finalizeClaimedGenerationOperationSuccess: vi.fn(),
  finalizeClaimedGenerationOperationFailure: vi.fn(),
  finalizeGenerationOperationSuccess: vi.fn(),
  finalizeGenerationOperationFailure: vi.fn(),
  getGenerationOperationOutcome: vi.fn(),
  markClaimedGenerationOperationRecoveryRequired: vi.fn(),
  markGenerationOperationRecoveryRequired: vi.fn(),
}));

vi.mock("./db", () => db);

const {
  beginDirectOperation,
  completeClaimedDirectOperationSuccess,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
  resetDirectOperationActionsForTests,
} = await import("./casting/directOperation");
const {
  productEventStreamStatus,
  resetProductEventsForTests,
  setProductEventClientForTests,
} = await import("./monitoring/productEvents");

interface Captured {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
}

let sent: Captured[] = [];

/** The order in which the fakes were called, so "after the receipt" is readable. */
let order: string[] = [];

beforeEach(() => {
  sent = [];
  order = [];
  vi.clearAllMocks();
  resetProductEventsForTests();
  resetDirectOperationActionsForTests();
  setProductEventClientForTests({
    capture: (payload) => {
      order.push(`capture:${(payload as Captured).event}`);
      sent.push(payload as Captured);
    },
    flush: async () => undefined,
    shutdown: async () => undefined,
  });
  db.acquireGenerationOperationLock.mockResolvedValue({ type: "acquired" });
  db.acquireCastingCandidateOperationLock.mockResolvedValue({ type: "acquired" });
});

afterEach(() => {
  resetProductEventsForTests();
  resetDirectOperationActionsForTests();
});

async function claimARoll(operationId = "op-1"): Promise<void> {
  db.claimGenerationOperation.mockResolvedValue({ type: "claimed", operationId });
  await beginDirectOperation({
    userId: 7,
    clientRequestId: "req-1",
    kind: "castingV2.roll",
    payload: {},
  });
}

describe("a customer's action begins", () => {
  it("records the start, in the product's own word", async () => {
    await claimARoll();
    expect(sent).toEqual([
      { distinctId: "7", event: "generation started", properties: { action: "roll", world: "local" } },
    ]);
  });

  it("⚠ records NOTHING on a replay — a retried request id is not a second roll", async () => {
    db.claimGenerationOperation.mockResolvedValue({
      type: "replay_success",
      operationId: "op-1",
      result: { kind: "noop" },
    });
    const gate = await beginDirectOperation({
      userId: 7,
      clientRequestId: "req-1",
      kind: "castingV2.roll",
      payload: {},
    });
    expect(gate.type).toBe("replay");
    expect(sent).toEqual([]);
  });

  it("⚠ records NOTHING when the claim is refused — a refusal at the door is not a start", async () => {
    db.claimGenerationOperation.mockResolvedValue({
      type: "in_progress",
      operationId: "op-1",
    });
    await expect(
      beginDirectOperation({ userId: 7, clientRequestId: "req-1", kind: "castingV2.roll", payload: {} }),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(sent).toEqual([]);
  });
});

describe("a customer's action ends", () => {
  it("records a whole delivery, with the money on it", async () => {
    await claimARoll();
    db.finalizeGenerationOperationSuccess.mockImplementation(async () => {
      order.push("receipt");
      return { type: "replay_success", operationId: "op-1", result: {} };
    });

    await completeDirectOperationSuccess({
      userId: 7,
      operationId: "op-1",
      result: { kind: "noop" } as never,
      chargedCredits: 160,
      refundedCredits: 0,
    });

    expect(sent[1]).toEqual({
      distinctId: "7",
      event: "generation delivered",
      properties: { action: "roll", outcome: "complete", creditsCharged: 160, creditsRefunded: 0, world: "local" },
    });
    /* ⚠ THE ORDER, read rather than reasoned about. */
    expect(order).toEqual(["capture:generation started", "receipt", "capture:generation delivered"]);
  });

  it("⚠ carries `partial` through — six of eight and eight of eight are different facts", async () => {
    await claimARoll();
    db.finalizeGenerationOperationSuccess.mockResolvedValue({ type: "replay_success", operationId: "op-1", result: {} });

    await completeDirectOperationSuccess({
      userId: 7,
      operationId: "op-1",
      result: { kind: "noop" } as never,
      chargedCredits: 160,
      refundedCredits: 40,
      terminalStatus: "partial",
    });

    expect(sent[1].properties).toMatchObject({ outcome: "partial", creditsCharged: 160, creditsRefunded: 40 });
  });

  it("⚠ records NOTHING when the receipt was already written — the delivery was counted then", async () => {
    await claimARoll();
    db.finalizeGenerationOperationSuccess.mockRejectedValue(new Error("lost its state race"));
    db.getGenerationOperationOutcome.mockResolvedValue({ type: "replay_success", operationId: "op-1", result: {} });

    await completeDirectOperationSuccess({
      userId: 7,
      operationId: "op-1",
      result: { kind: "noop" } as never,
      chargedCredits: 160,
      refundedCredits: 0,
    });

    expect(sent.map((event) => event.event)).toEqual(["generation started"]);
  });

  it("⚠ records NOTHING when the receipt failed and recovery was marked", async () => {
    await claimARoll();
    db.finalizeGenerationOperationSuccess.mockRejectedValue(new Error("write failed"));
    db.getGenerationOperationOutcome.mockResolvedValue(null);
    db.markGenerationOperationRecoveryRequired.mockResolvedValue(undefined);

    await expect(
      completeDirectOperationSuccess({
        userId: 7,
        operationId: "op-1",
        result: { kind: "noop" } as never,
        chargedCredits: 160,
        refundedCredits: 0,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(sent.map((event) => event.event)).toEqual(["generation started"]);
  });

  it("records a failure with its code and the money both ways", async () => {
    await claimARoll();
    db.finalizeGenerationOperationFailure.mockImplementation(async () => {
      order.push("receipt");
    });

    await expect(
      completeDirectOperationFailure({
        userId: 7,
        operationId: "op-1",
        error: new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The engine refused: a tall woman in a red coat" }),
        chargedCredits: 160,
        refundedCredits: 160,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(sent[1]).toEqual({
      distinctId: "7",
      event: "generation failed",
      properties: {
        action: "roll",
        errorCode: "SERVICE_UNAVAILABLE",
        creditsCharged: 160,
        creditsRefunded: 160,
        world: "local",
      },
    });
    expect(order).toEqual(["capture:generation started", "receipt", "capture:generation failed"]);
  });

  it("⚠ never carries the refusal's SENTENCE, which is the field that can quote her brief", async () => {
    await claimARoll();
    db.finalizeGenerationOperationFailure.mockResolvedValue(undefined);

    await expect(
      completeDirectOperationFailure({
        userId: 7,
        operationId: "op-1",
        error: new TRPCError({ code: "BAD_REQUEST", message: "The engine refused: a tall woman in a red coat" }),
        chargedCredits: 0,
        refundedCredits: 0,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(JSON.stringify(sent)).not.toContain("a tall woman in a red coat");
    /*
      ⚠ AND THE SEAM ATTACHED NOTHING THE CATALOGUE HAD TO DROP.

      The arm above alone is satisfied by the ALLOWLIST doing its job, which is
      defence in depth and is exactly what should happen — measured: sabotaging
      this call site to attach `publicMessage: error.message` leaves that arm
      green, because the gate drops the key before the wire. That is the control
      working, and it is also a defect nobody would see.

      `droppedProperties` is what makes the attempt visible. A call site that
      starts sending something undeclared moves this counter off zero even
      though nothing leaks, so the try is caught rather than silently absorbed.
    */
    expect(productEventStreamStatus().droppedProperties).toBe(0);
  });

  it("records a pre-start failure with zero on it", async () => {
    await claimARoll();
    db.finalizeClaimedGenerationOperationFailure.mockResolvedValue(undefined);

    await expect(
      failClaimedDirectOperation({
        userId: 7,
        operationId: "op-1",
        error: new TRPCError({ code: "CONFLICT", message: "already running" }),
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(sent[1].properties).toMatchObject({
      action: "roll",
      errorCode: "CONFLICT",
      creditsCharged: 0,
      creditsRefunded: 0,
    });
  });

  it("⚠ closes a free pre-start answer, so starts never exceed deliveries plus failures", async () => {
    await claimARoll();
    db.finalizeClaimedGenerationOperationSuccess.mockResolvedValue(undefined);

    await completeClaimedDirectOperationSuccess({
      userId: 7,
      operationId: "op-1",
      result: { kind: "noop" } as never,
    });

    expect(sent[1]).toEqual({
      distinctId: "7",
      event: "generation delivered",
      properties: { action: "roll", outcome: "complete", creditsCharged: 0, creditsRefunded: 0, world: "local" },
    });
  });
});

describe("the remembered action, and what happens when it is not remembered", () => {
  it("names each kind in the product's own word", async () => {
    for (const [kind, noun] of [
      ["castingV2.roll", "roll"],
      ["castingV2.sign", "sign"],
      ["castingV2.refine", "refine"],
      ["castingV2.viewRetry", "view retry"],
    ] as const) {
      sent = [];
      db.claimGenerationOperation.mockResolvedValue({ type: "claimed", operationId: `op-${kind}` });
      await beginDirectOperation({ userId: 7, clientRequestId: "r", kind, payload: {} });
      expect(sent[0].properties.action).toBe(noun);
    }
  });

  it("⚠ says `unnamed action` when the claim happened in another process — never a guess", async () => {
    /* A deploy between the claim and the receipt, or the recovery sweep
       finalizing in its own process. The memory is per-process and this is what
       that costs, stated in the event rather than left to be inferred. */
    db.finalizeGenerationOperationSuccess.mockResolvedValue({ type: "replay_success", operationId: "op-elsewhere", result: {} });

    await completeDirectOperationSuccess({
      userId: 7,
      operationId: "op-elsewhere",
      result: { kind: "noop" } as never,
      chargedCredits: 450,
      refundedCredits: 0,
    });

    expect(sent[0].properties.action).toBe("unnamed action");
  });

  it("⚠ forgets an operation once it has ended, so the memory cannot grow without bound", async () => {
    await claimARoll("op-bounded");
    db.finalizeGenerationOperationSuccess.mockResolvedValue({ type: "replay_success", operationId: "op-bounded", result: {} });

    const deliver = async (): Promise<void> =>
      completeDirectOperationSuccess({
        userId: 7,
        operationId: "op-bounded",
        result: { kind: "noop" } as never,
        chargedCredits: 160,
        refundedCredits: 0,
      });

    await deliver();
    expect(sent[1].properties.action).toBe("roll");
    await deliver();
    /* The second read finds nothing, because the first one took it. */
    expect(sent[2].properties.action).toBe("unnamed action");
  });
});

describe("⚠ the stream can never cost a customer their receipt", () => {
  it("a transport that throws does not turn a written receipt into a recovery", async () => {
    await claimARoll();
    setProductEventClientForTests({
      capture: () => {
        throw new Error("the SDK exploded");
      },
      flush: async () => undefined,
      shutdown: async () => undefined,
    });
    db.finalizeGenerationOperationSuccess.mockResolvedValue({ type: "replay_success", operationId: "op-1", result: {} });

    await expect(
      completeDirectOperationSuccess({
        userId: 7,
        operationId: "op-1",
        result: { kind: "noop" } as never,
        chargedCredits: 160,
        refundedCredits: 0,
      }),
    ).resolves.toBeUndefined();

    /* The receipt was written once and recovery was never marked — which is the
       failure the placement of the capture outside the `try` exists to prevent. */
    expect(db.finalizeGenerationOperationSuccess).toHaveBeenCalledTimes(1);
    expect(db.markGenerationOperationRecoveryRequired).not.toHaveBeenCalled();
  });
});

/**
 * A PRESS REFUSED BEFORE IT STARTED IS NOT A FAILED GENERATION (#1943 item 2).
 *
 * `generation started` is emitted at the BOTTOM of `beginDirectOperation`, after
 * the locks, because that is the moment the customer's action began. Both
 * lock-refused exits sit ABOVE it and used to send a terminal `generation failed`
 * anyway — so the stream carried a failure with no start before it, and because
 * `rememberAction` is on the start event's own line, the failure's action read
 * `unnamed action`. A customer pressing *Try again* on a view that is already
 * rendering produced exactly that: *"a generation failed, we do not know which
 * kind"*, for a press that rendered nothing and charged nothing.
 *
 * The receipt is still written either way — #1932's whole point, and the arms
 * below assert it rather than assuming it, because a repair that stopped settling
 * the row would leave the slot reading *"being made"* for six minutes and these
 * arms would be the only thing that could have said so.
 */
describe("a press refused before it started sends nothing", () => {
  async function pressWithBusySlotLock(): Promise<unknown> {
    db.claimGenerationOperation.mockResolvedValue({ type: "claimed", operationId: "op-busy" });
    db.acquireGenerationOperationLock.mockResolvedValue({ type: "resource_busy" });
    db.finalizeClaimedGenerationOperationFailure.mockResolvedValue(undefined);
    return beginDirectOperation({
      userId: 7,
      clientRequestId: "req-busy",
      kind: "castingV2.viewRetry",
      payload: {},
      lockKey: "model:7",
      lockBusyMessage: "That view is already being made.",
    }).catch((error: unknown) => error);
  }

  it("⚠ a busy slot lock settles the row and emits NO event — not a start, not a failure", async () => {
    const error = await pressWithBusySlotLock();

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("CONFLICT");
    /* The receipt IS written: #1932's repair is untouched by this one. */
    expect(db.finalizeClaimedGenerationOperationFailure).toHaveBeenCalledTimes(1);
    /* And the stream heard nothing, because nothing happened to a generation. */
    expect(sent).toEqual([]);
  });

  it("the positive control: the same press with the lock FREE does send its start", async () => {
    /*
      Without this, the arm above passes on a suite where the capture client was
      never installed, or where `beginDirectOperation` threw before reaching
      either road — both of which look exactly like *"no event was sent"*.
    */
    db.claimGenerationOperation.mockResolvedValue({ type: "claimed", operationId: "op-free" });
    db.acquireGenerationOperationLock.mockResolvedValue({ type: "acquired" });
    await beginDirectOperation({
      userId: 7,
      clientRequestId: "req-free",
      kind: "castingV2.viewRetry",
      payload: {},
      lockKey: "model:7",
    });
    expect(sent.map((event) => event.event)).toEqual(["generation started"]);
  });

  it("a busy CANDIDATE lock does the same, and keeps her own sentence", async () => {
    db.claimGenerationOperation.mockResolvedValue({ type: "claimed", operationId: "op-cand" });
    db.acquireCastingCandidateOperationLock.mockResolvedValue({ type: "resource_busy" });
    db.finalizeClaimedGenerationOperationFailure.mockResolvedValue(undefined);

    const error = await beginDirectOperation({
      userId: 7,
      clientRequestId: "req-cand",
      kind: "castingV2.refine",
      payload: {},
      candidateLockPublicId: "cand-1",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).message).toContain("already being made");
    expect(db.finalizeClaimedGenerationOperationFailure).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });

  it("⚠ THE FENCE: no exit inside `beginDirectOperation` may take the event-sending road", () => {
    /*
      THE CLASS, NOT THE TWO INSTANCES. The population is bounded by the code's
      own shape — only a statement between the claim and the start event can emit
      a terminal before a start, and every one of those lives in this function —
      so a THIRD lock, gate or refusal added here is the whole of the risk, and a
      driven arm per instance could never see it.

      Sliced out of the function rather than searched for in the file: every other
      caller of `failClaimedDirectOperation` in the tree is past the gate, so its
      operation did start and its terminal event is owed (#1636's class — a
      whole-file assertion is satisfied by a neighbour).
    */
    const source = readFileSync(resolve(import.meta.dirname, "casting/directOperation.ts"), "utf8");
    const start = source.indexOf("export async function beginDirectOperation");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('  return { type: "execute", operationId: claim.operationId };', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);

    expect(body).not.toContain("failClaimedDirectOperation(");
    /* The positive control on the slice itself: if this stopped being the
       refusal road, both counts would be zero and the arm would be vacuous. */
    expect(body.split("refuseClaimedBeforeStart(").length - 1).toBe(2);
  });
});
