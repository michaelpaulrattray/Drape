import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { PublicGenerationOperation } from "./casting/operationContract";

const db = vi.hoisted(() => ({
  getPublicGenerationOperation: vi.fn(),
  getRecentPublicGenerationOperation: vi.fn(),
  listActivePublicGenerationOperations: vi.fn(),
  acknowledgeGenerationOperation: vi.fn(),
  landGenerationOperationResult: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...await importOriginal<typeof import("./db")>(),
  ...db,
}));

import { generationOperationsRouter } from "./routes/generation/generationOperations";

const OPERATION_ID = "6fa459ea-ee8a-4ca4-894e-db77e160355e";
const REQUEST_ID = "7fa459ea-ee8a-4ca4-894e-db77e160355f";
const NOW = "2026-07-19T00:00:00.000Z";

const operation: PublicGenerationOperation = {
  operationId: OPERATION_ID,
  clientRequestId: REQUEST_ID,
  kind: "canvas.cast",
  modelId: 44,
  originBoardId: 8,
  originItemId: 9,
  status: "succeeded",
  phase: "finalizing",
  progress: null,
  plannedCredits: 300,
  chargedCredits: 300,
  refundedCredits: 0,
  netCredits: 300,
  result: { modelId: 44, assetId: 71, placed: false },
  publicMessage: null,
  createdAt: NOW,
  updatedAt: NOW,
  completedAt: NOW,
  heartbeatAt: NOW,
  leaseExpiresAt: NOW,
  cancellable: false,
  landingStatus: "pending",
  landedItemId: null,
  landingAcknowledgedAt: null,
  children: [],
};

function authCtx(userId = 12): TrpcContext {
  return {
    user: { id: userId } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.getPublicGenerationOperation.mockResolvedValue(operation);
  db.getRecentPublicGenerationOperation.mockResolvedValue(operation);
  db.listActivePublicGenerationOperations.mockResolvedValue([operation]);
  db.acknowledgeGenerationOperation.mockResolvedValue({ type: "acknowledged", operation });
  db.landGenerationOperationResult.mockResolvedValue({ type: "landed", operation });
});

describe("R7-2C authenticated generation-operation router", () => {
  it("scopes every read to the authenticated user and preserves public DTOs", async () => {
    const caller = generationOperationsRouter.createCaller(authCtx(12));
    await expect(caller.operationState({ operationId: OPERATION_ID })).resolves.toEqual(operation);
    await expect(caller.recentOperation({ clientRequestId: REQUEST_ID })).resolves.toEqual(operation);
    await expect(caller.activeOperations({ boardId: 8, modelId: 44 })).resolves.toEqual([operation]);
    expect(db.getPublicGenerationOperation).toHaveBeenCalledWith(12, OPERATION_ID);
    expect(db.getRecentPublicGenerationOperation).toHaveBeenCalledWith({ userId: 12, clientRequestId: REQUEST_ID });
    expect(db.listActivePublicGenerationOperations).toHaveBeenCalledWith({ userId: 12, boardId: 8, modelId: 44 });
  });

  it("returns NOT_FOUND for a missing or other-user operation", async () => {
    db.getPublicGenerationOperation.mockResolvedValueOnce(null);
    const caller = generationOperationsRouter.createCaller(authCtx(99));
    await expect(caller.operationState({ operationId: OPERATION_ID })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not acknowledge running or unlanded terminal work", async () => {
    const caller = generationOperationsRouter.createCaller(authCtx());
    db.acknowledgeGenerationOperation.mockResolvedValueOnce({ type: "not_terminal" });
    await expect(caller.acknowledgeOperation({ operationId: OPERATION_ID }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    db.acknowledgeGenerationOperation.mockResolvedValueOnce({ type: "landing_required" });
    await expect(caller.acknowledgeOperation({ operationId: OPERATION_ID }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("lands through the free server authority and returns relink truth without hiding it", async () => {
    const caller = generationOperationsRouter.createCaller(authCtx());
    await caller.landOperationResult({ operationId: OPERATION_ID, boardId: 8, itemId: 9 });
    expect(db.landGenerationOperationResult).toHaveBeenCalledWith({
      userId: 12,
      operationId: OPERATION_ID,
      boardId: 8,
      itemId: 9,
    });
    db.landGenerationOperationResult.mockResolvedValueOnce({
      type: "relink_required",
      operation: { ...operation, landingStatus: "relink_required" },
    });
    await expect(caller.landOperationResult({ operationId: OPERATION_ID, boardId: 8, itemId: 10 }))
      .resolves.toMatchObject({ landingStatus: "relink_required" });
  });

  it("uses strict UUID and landing envelopes", async () => {
    const caller = generationOperationsRouter.createCaller(authCtx());
    await expect(caller.operationState({ operationId: "not-a-uuid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.landOperationResult({
      operationId: OPERATION_ID,
      boardId: 8,
      itemId: 9,
      clientRequestId: REQUEST_ID,
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
