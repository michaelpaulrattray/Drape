import { describe, expect, it, vi } from "vitest";
import type { InkIntentCancelledResult } from "../../db/inkAddCancellation";
import {
  cancelInkAddIntent,
  type InkIntentCancellationDependencies,
} from "./inkIntentCancellation";

const intentId = "11111111-1111-4111-8111-111111111111";
const operationId = "22222222-2222-4222-8222-222222222222";
const clientRequestId = "33333333-3333-4333-8333-333333333333";
const result: InkIntentCancelledResult = {
  intentId,
  candidateId: "44444444-4444-4444-8444-444444444444",
  status: "cancelled",
  cleanupObjects: 3,
  chargedCredits: 0,
};

function dependencies(
  overrides: Partial<InkIntentCancellationDependencies> = {},
): InkIntentCancellationDependencies {
  return {
    enabledForUser: () => true,
    findClaimSubject: vi.fn(async () => ({ id: intentId, modelId: 12 })),
    getOutcomeByClaim: vi.fn(async () => null),
    begin: vi.fn(async () => ({ type: "execute", operationId })),
    markRunning: vi.fn(async () => ({
      operationId,
      chargeReferenceId: `op:${operationId}:charge`,
    })),
    commit: vi.fn(async () => result),
    completeFailure: vi.fn(async (input) => {
      throw input.error;
    }) as never,
    requireRecovery: vi.fn(async () => {
      throw new Error("recovery_required");
    }) as never,
    ...overrides,
  };
}

describe("ink intent cancellation", () => {
  it("commits one free owner-derived cancellation", async () => {
    const deps = dependencies();
    await expect(cancelInkAddIntent(deps, {
      userId: 7,
      intentId,
      clientRequestId,
    })).resolves.toEqual(result);
    expect(deps.begin).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      kind: "evidence_candidate_cancel",
      modelId: 12,
      payload: { intentId },
      lockKey: "model:12",
    }));
    expect(deps.markRunning).toHaveBeenCalledWith(expect.objectContaining({
      plannedCredits: 0,
      phase: "cleaning",
    }));
    expect(deps.commit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      modelId: 12,
      intentId,
      operationId,
    }));
  });

  it("replays an exact terminal result before claiming a new operation", async () => {
    const deps = dependencies({
      getOutcomeByClaim: vi.fn(async () => ({
        type: "replay_success",
        operationId,
        result,
      })),
    });
    await expect(cancelInkAddIntent(deps, {
      userId: 7,
      intentId,
      clientRequestId,
    })).resolves.toEqual(result);
    expect(deps.begin).not.toHaveBeenCalled();
    expect(deps.commit).not.toHaveBeenCalled();
  });

  it("refuses while compile-closed before any lookup or receipt", async () => {
    const deps = dependencies({ enabledForUser: () => false });
    await expect(cancelInkAddIntent(deps, {
      userId: 7,
      intentId,
      clientRequestId,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deps.findClaimSubject).not.toHaveBeenCalled();
    expect(deps.begin).not.toHaveBeenCalled();
  });

  it("recovers an atomically committed cancellation after a lost response", async () => {
    let outcomeReads = 0;
    const deps = dependencies({
      getOutcomeByClaim: vi.fn(async () => {
        outcomeReads += 1;
        return outcomeReads === 1
          ? null
          : {
              type: "replay_success" as const,
              operationId,
              result,
            };
      }),
      commit: vi.fn(async () => {
        throw new Error("commit response lost");
      }),
    });
    await expect(cancelInkAddIntent(deps, {
      userId: 7,
      intentId,
      clientRequestId,
    })).resolves.toEqual(result);
    expect(deps.completeFailure).not.toHaveBeenCalled();
    expect(deps.requireRecovery).not.toHaveBeenCalled();
  });
});
