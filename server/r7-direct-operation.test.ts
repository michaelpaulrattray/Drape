import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const db = vi.hoisted(() => ({
  claimGenerationOperation: vi.fn(),
  acquireGenerationOperationLock: vi.fn(),
  finalizeClaimedGenerationOperationSuccess: vi.fn(),
  finalizeClaimedGenerationOperationFailure: vi.fn(),
  finalizeGenerationOperationFailure: vi.fn(),
  finalizeGenerationOperationSuccess: vi.fn(),
  getGenerationOperationOutcome: vi.fn(),
  markClaimedGenerationOperationRecoveryRequired: vi.fn(),
  markGenerationOperationRecoveryRequired: vi.fn(),
}));
vi.mock("./db", () => db);

import {
  beginDirectOperation,
  completeClaimedDirectOperationSuccess,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "./casting/directOperation";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const mock of Object.values(db)) mock.mockReset();
  db.acquireGenerationOperationLock.mockResolvedValue({
    type: "acquired",
    operationId: OPERATION_ID,
    lockKey: "model:7",
    expiresAt: new Date(),
  });
});

describe("R7-1D direct operation adapter", () => {
  it("returns replay before trying to acquire a new resource lock", async () => {
    db.claimGenerationOperation.mockResolvedValue({
      type: "replay_success",
      operationId: OPERATION_ID,
      result: { assetId: 9 },
    });
    await expect(beginDirectOperation({
      userId: 1,
      clientRequestId: OPERATION_ID,
      kind: "casting.headshot",
      modelId: 7,
      payload: { modelId: 7 },
      lockKey: "model:7",
    })).resolves.toEqual({ type: "replay", operationId: OPERATION_ID, result: { assetId: 9 } });
    expect(db.acquireGenerationOperationLock).not.toHaveBeenCalled();
  });

  it("a busy lock says the caller's sentence when it has one, and the staff one otherwise", async () => {
    /*
      #1257. Five roads take a `model:`/`board-item:` lock and share the staff
      sentence below — right for them, because a customer meeting it asked for
      something about the whole Cast. The per-slot road is different: it already
      refuses the common case in its own words, from the slot's state, a few
      hundred milliseconds earlier, so the race loser must hear the same thing.

      BOTH directions are asserted. Testing only the override would pass just as
      well if the default had been deleted, and four live roads depend on it.
    */
    db.claimGenerationOperation.mockResolvedValue({
      type: "claimed",
      operationId: OPERATION_ID,
      payloadHash: "hash",
    });
    db.acquireGenerationOperationLock.mockResolvedValue({
      type: "resource_busy",
      operationId: OPERATION_ID,
      lockKey: "cast-view:7:closeUp",
      ownerOperationId: "22222222-2222-4222-8222-222222222222",
    });

    const claim = {
      userId: 1,
      clientRequestId: OPERATION_ID,
      kind: "castingV2.viewRetry" as const,
      modelId: 7,
      payload: { castId: "KI-A", angle: "closeUp" },
      lockKey: "cast-view:7:closeUp",
    };

    await expect(beginDirectOperation({ ...claim, lockBusyMessage: "That view is already being asked for. Nothing was charged." }))
      .rejects.toThrow("That view is already being asked for. Nothing was charged.");
    await expect(beginDirectOperation(claim))
      .rejects.toThrow("Another operation is already changing this Cast. Wait for it to finish before retrying.");

    /* A refusal, not a silent pass: the caller never reaches its money. */
    await expect(beginDirectOperation(claim)).rejects.toBeInstanceOf(TRPCError);
  });

  it("seals a claimed receipt for recovery when its free-failure finalization is uncertain", async () => {
    db.finalizeClaimedGenerationOperationFailure.mockRejectedValue(new Error("response lost"));
    db.getGenerationOperationOutcome.mockResolvedValue({
      type: "in_progress",
      operationId: OPERATION_ID,
      status: "claimed",
    });
    db.markClaimedGenerationOperationRecoveryRequired.mockResolvedValue(undefined);

    await expect(failClaimedDirectOperation({
      userId: 1,
      operationId: OPERATION_ID,
      error: new TRPCError({ code: "PRECONDITION_FAILED", message: "Free refusal" }),
    })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining(OPERATION_ID),
    });
    expect(db.markClaimedGenerationOperationRecoveryRequired).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      operationId: OPERATION_ID,
    }));
  });

  it("accepts a free claimed result that committed when its response was lost", async () => {
    const result = { clarification: { kind: "hair_length" } };
    db.finalizeClaimedGenerationOperationSuccess.mockRejectedValue(new Error("connection reset"));
    db.getGenerationOperationOutcome.mockResolvedValue({
      type: "replay_success",
      operationId: OPERATION_ID,
      result,
    });

    await expect(completeClaimedDirectOperationSuccess({
      userId: 1,
      operationId: OPERATION_ID,
      result,
    })).resolves.toBeUndefined();
    expect(db.markClaimedGenerationOperationRecoveryRequired).not.toHaveBeenCalled();
  });

  it("accepts a success receipt that committed even when its response was lost", async () => {
    db.finalizeGenerationOperationSuccess.mockRejectedValue(new Error("connection reset"));
    db.getGenerationOperationOutcome.mockResolvedValue({
      type: "replay_success",
      operationId: OPERATION_ID,
      result: { assetId: 9 },
    });

    await expect(completeDirectOperationSuccess({
      userId: 1,
      operationId: OPERATION_ID,
      result: { assetId: 9 },
      chargedCredits: 350,
      refundedCredits: 0,
    })).resolves.toBeUndefined();
    expect(db.markGenerationOperationRecoveryRequired).not.toHaveBeenCalled();
  });
});
