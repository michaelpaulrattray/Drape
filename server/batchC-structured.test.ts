/**
 * Batch C — the structured attribute editor (M6, ratified R3), creation-path
 * ordering (M22 ⊕: the deduct-before-parse doors reordered), and the
 * Canvas/Wardrobe isolation boundary (M19).
 *
 * applyModelEdit's UPDATE branch is a `source:"structured"` recast commit:
 * unknown keys reject at the wire; non-identity keys refuse honestly;
 * presentation and `features` cannot be smuggled; the commit lands document +
 * anchor + new revision + stale flags (pinned included) atomically; minted
 * originals stay fork-only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

const tx = vi.hoisted(() => ({
  modelUpdates: [] as Array<Record<string, unknown>>,
  assetInserts: [] as Array<Record<string, unknown>>,
  staleUpdates: [] as Array<Record<string, unknown>>,
  reset() {
    this.modelUpdates = [];
    this.assetInserts = [];
    this.staleUpdates = [];
  },
}));

const operation = vi.hoisted(() => ({
  outcome: {
    type: "claimed" as const,
    operationId: "11111111-1111-4111-8111-111111111111",
    payloadHash: "a".repeat(64),
  } as Record<string, unknown>,
  reset() {
    this.outcome = {
      type: "claimed",
      operationId: "11111111-1111-4111-8111-111111111111",
      payloadHash: "a".repeat(64),
    };
  },
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getBoardById: vi.fn(),
    getBoardItemById: vi.fn(),
    getModelById: vi.fn(),
    getModelAssets: vi.fn(),
    createModel: vi.fn().mockResolvedValue({ success: true, modelId: 88 }),
    createGeneration: vi.fn().mockResolvedValue({ success: true, generationId: 11 }),
    updateGeneration: vi.fn().mockResolvedValue({ success: true }),
    updateModel: vi.fn().mockResolvedValue({ success: true }),
    createModelAsset: vi.fn().mockResolvedValue({ success: true, assetId: 501 }),
    updateBoardItem: vi.fn().mockResolvedValue({ success: true }),
    addBoardItemVersion: vi.fn().mockResolvedValue({ success: true }),
    getLatestVersionNumber: vi.fn().mockResolvedValue(1),
    addBoardItem: vi.fn().mockResolvedValue({ success: true, itemId: 55 }),
    fillEmptyCastNodeWithVersionIn: vi.fn().mockResolvedValue("filled"),
    deductPoints: vi.fn().mockResolvedValue({ success: true }),
    addCredits: vi.fn().mockResolvedValue({ success: true }),
    claimGenerationOperation: vi.fn().mockImplementation(async () => operation.outcome),
    acquireGenerationOperationLock: vi.fn().mockResolvedValue({
      type: "acquired",
      operationId: "11111111-1111-4111-8111-111111111111",
      lockKey: "board-item:3",
      expiresAt: new Date(Date.now() + 60_000),
    }),
    markGenerationOperationRunning: vi.fn().mockResolvedValue({
      operationId: "11111111-1111-4111-8111-111111111111",
      chargeReferenceId: "op:11111111-1111-4111-8111-111111111111:charge",
    }),
    bindGenerationOperationModel: vi.fn().mockResolvedValue(undefined),
    finalizeGenerationOperationSuccess: vi.fn().mockResolvedValue(undefined),
    finalizeGenerationOperationFailure: vi.fn().mockResolvedValue(undefined),
    finalizeClaimedGenerationOperationFailure: vi.fn().mockResolvedValue(undefined),
    markGenerationOperationRecoveryRequired: vi.fn().mockResolvedValue(undefined),
    markClaimedGenerationOperationRecoveryRequired: vi.fn().mockResolvedValue(undefined),
    getGenerationOperationOutcome: vi.fn().mockResolvedValue(null),
  };
});
vi.mock("./db/boardEdges", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/boardEdges")>();
  return {
    ...actual,
    getEdgesFrom: vi.fn().mockResolvedValue([]),
    addBoardEdge: vi.fn().mockResolvedValue({ success: true }),
  };
});
vi.mock("./db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/connection")>();
  const makeTx = () => ({
    select: (_shape?: unknown) => ({
      from: (_table: unknown) => ({
        where: (_condition: unknown) => ({
          limit: (_limit: number) => ({
            for: async (_mode: string) => [{ id: 7, userId: 1 }],
            then: (resolve: (rows: Array<{ id: number; userId: number }>) => unknown) =>
              Promise.resolve([{ id: 7, userId: 1 }]).then(resolve),
          }),
        }),
      }),
    }),
    update: (_t: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if ((values.status as { state?: string } | undefined)?.state === "stale") tx.staleUpdates.push(values);
          else tx.modelUpdates.push(values);
          return Promise.resolve({ affectedRows: 1 });
        },
      }),
    }),
    insert: (_t: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        $returningId: async () => {
          tx.assetInserts.push(values);
          return [{ id: 888 }];
        },
      }),
    }),
  });
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    withTransaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(makeTx())),
  };
});
vi.mock("./db/dailyQuota", () => ({ enforceDailyQuota: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/rateLimit")>();
  return { ...actual, checkRateLimit: vi.fn().mockReturnValue({ allowed: true }) };
});
vi.mock("./casting/aiService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/aiService")>();
  return {
    ...actual,
    generateMasterPrompt: vi.fn().mockResolvedValue({ naturalDescription: "new desc", technicalSchema: {} }),
    generateCastingImage: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/casting/new.png", storageKey: "casting/new.png", engineUsed: "test" }),
    generateCastingImageRaw: vi.fn().mockResolvedValue({ imageBase64: "data:image/png;base64,bmV3", engineUsed: "test" }),
    uploadRawCandidate: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/casting/new.png", storageKey: "casting/new.png" }),
  };
});
vi.mock("./casting/promptParser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/promptParser")>();
  return { ...actual, parseCastingPrompt: vi.fn().mockResolvedValue({}) };
});
vi.mock("./casting/snapshotBootstrap", () => ({
  bootstrapModelSnapshot: vi.fn().mockResolvedValue({
    status: "current",
    modelId: 7,
    packageSnapshotId: "pkg-current",
    identitySnapshotId: "identity-current",
    stateVersion: 1,
  }),
}));
vi.mock("./casting/snapshotTransitions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotTransitions")>();
  return { ...actual, commitCanvasRecastSnapshot: vi.fn() };
});

import {
  getBoardById,
  getBoardItemById,
  getModelById,
  getModelAssets,
  createModel,
  createModelAsset,
  updateModel,
  deductPoints,
  claimGenerationOperation,
  acquireGenerationOperationLock,
  markGenerationOperationRunning,
  bindGenerationOperationModel,
  finalizeGenerationOperationSuccess,
} from "./db";
import { generateMasterPrompt, generateCastingImage, generateCastingImageRaw } from "./casting/aiService";
import { bootstrapModelSnapshot } from "./casting/snapshotBootstrap";
import { commitCanvasRecastSnapshot } from "./casting/snapshotTransitions";
import { commitAnchorReRoll, commitIdentityEdit } from "./casting/identity/identityCommit";
import { buildIdentityAnchor } from "./casting/geminiClient";
import {
  executeApplyModelEdit as executeApplyModelEditRaw,
  executeRunGeneration as executeRunGenerationRaw,
  executeRunVariations as executeRunVariationsRaw,
} from "./lib/boardOps";
import { REFUSAL_COPY } from "./casting/identity/refusalCopy";
import { appRouter } from "./routers";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

const accounting = (reference: string) => ({
  chargeReferenceId: reference,
  onCharged: () => undefined,
  onRefunded: () => undefined,
});
const executeApplyModelEdit = (input: Omit<Parameters<typeof executeApplyModelEditRaw>[0], "chargeReferenceId" | "onCharged" | "onRefunded">) =>
  executeApplyModelEditRaw({ ...input, ...accounting(`apply-edit-${input.itemId}-test`) });
const executeRunGeneration = (input: Omit<Parameters<typeof executeRunGenerationRaw>[0], "chargeReferenceId" | "onCharged" | "onRefunded" | "onModelCreated">) =>
  executeRunGenerationRaw({ ...input, ...accounting(`board-item-${input.itemId}-test`), onModelCreated: () => undefined });
const executeRunVariations = (input: Omit<Parameters<typeof executeRunVariationsRaw>[0], "chargeReferenceId" | "onCharged" | "onRefunded">) =>
  executeRunVariationsRaw({ ...input, ...accounting(`variations-${input.itemId}-test`) });

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
function authCtx(userId = 1): TrpcContext {
  const user = {
    id: userId, openId: `t-${userId}`, email: `t${userId}@x.com`, name: "T",
    loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as AuthenticatedUser;
  return {
    user,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const boardItem = (over: Record<string, unknown> = {}) => ({
  id: 3,
  boardId: 2,
  kind: "image",
  label: "Cast",
  imageUrl: "https://r2/head.png",
  positionX: 0, positionY: 0, width: 280, height: 420,
  deletedAt: null,
  sourceModelId: 7,
  metadata: { provenance: { type: "cast_root", modelId: 7, viewAngle: "frontClose" } },
  ...over,
});
const model = (over: Record<string, unknown> = {}) => ({
  id: 7, userId: 1, name: "Draft", status: "draft", agencyId: null, mintedAt: null,
  masterPrompt: "prompt with a rose tattoo note", technicalSchema: {},
  preferences: { gender: "Female", jawline: "Soft / Rounded", features: "gap teeth" },
  identityRevisionId: null, createdAt: new Date(), ...over,
});

beforeEach(() => {
  vi.mocked(getBoardById).mockReset().mockResolvedValue({ id: 2, userId: 1 } as never);
  vi.mocked(getBoardItemById).mockReset().mockResolvedValue(boardItem() as never);
  vi.mocked(getModelById).mockReset().mockResolvedValue(model() as never);
  vi.mocked(getModelAssets).mockReset().mockResolvedValue([
    { id: 1, viewType: "frontClose", storageUrl: "https://r2/head.png", pinned: false, status: null, provenance: null, createdAt: new Date() },
    { id: 2, viewType: "sideClose", storageUrl: "https://r2/side.png", pinned: true, status: null, provenance: null, createdAt: new Date() },
  ] as never);
  vi.mocked(createModel).mockClear();
  vi.mocked(createModelAsset).mockClear();
  vi.mocked(updateModel).mockClear();
  vi.mocked(deductPoints).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(generateMasterPrompt).mockClear();
  vi.mocked(generateCastingImage).mockClear();
  vi.mocked(generateCastingImageRaw).mockClear();
  vi.mocked(claimGenerationOperation).mockClear();
  vi.mocked(acquireGenerationOperationLock).mockClear();
  vi.mocked(markGenerationOperationRunning).mockClear();
  vi.mocked(bindGenerationOperationModel).mockClear();
  vi.mocked(finalizeGenerationOperationSuccess).mockClear();
  vi.mocked(bootstrapModelSnapshot).mockClear().mockResolvedValue({
    status: "current",
    modelId: 7,
    packageSnapshotId: "pkg-current",
    identitySnapshotId: "identity-current",
    stateVersion: 1,
  });
  vi.mocked(commitCanvasRecastSnapshot).mockReset().mockImplementation(async (input) => {
    const currentModel = await getModelById(input.modelId);
    const assets = await getModelAssets(input.modelId);
    if (!currentModel) throw new Error("model fixture missing");
    const result = input.patch
      ? await commitIdentityEdit({
          model: currentModel,
          patch: input.patch,
          newAnchor: {
            storageUrl: input.candidate.storageUrl,
            pointsCost: input.candidate.pointsCost,
            engine: input.candidate.engine,
          },
          assets,
          landing: input.landing,
        })
      : await commitAnchorReRoll({
          modelId: input.modelId,
          storageUrl: input.candidate.storageUrl,
          pointsCost: input.candidate.pointsCost,
          engine: input.candidate.engine,
          identityText: buildIdentityAnchor(currentModel.masterPrompt || "", currentModel.technicalSchema ?? undefined),
          assets,
          landing: input.landing,
        });
    return {
      result: { ...result, releasedDependents: "releasedDependents" in result ? result.releasedDependents : [] },
      modelId: input.modelId,
      identitySnapshotId: "identity-next",
      packageSnapshotId: "package-next",
      stateVersion: 2,
      selectedSlotCount: 2,
    };
  });
  operation.reset();
  tx.reset();
});

// ─── M6: the wire boundary ───────────────────────────────────────────────────

describe("applyModelEdit wire schema (M6)", () => {
  it("unknown keys are REJECTED at the router, never silently stripped", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.boardOps.applyModelEdit.execute({
        clientRequestId: REQUEST_ID,
        boardId: 2, itemId: 3, decision: "update",
        changes: { totallyUnknownField: "x" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("the removed referenceImage/previousMasterPrompt channels are rejected too", async () => {
    const caller = appRouter.createCaller(authCtx());
    for (const key of ["referenceImage", "previousMasterPrompt"]) {
      await expect(
        caller.boardOps.applyModelEdit.execute({
          clientRequestId: REQUEST_ID,
          boardId: 2, itemId: 3, decision: "fork",
          changes: { [key]: "data:image/png;base64,AAAA" },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
});

// ─── Final correction 3: the Canvas creation-attribute WIRE boundary ────────

describe("runGeneration attributes wire schema (final correction 3)", () => {
  it.each([
    ["array in a prose key", { jawline: ["sharp", "red dress"] }],
    ["nested object in a prose key", { skinFinish: { sneaky: "heavy makeup" } }],
    ["unknown key", { totallyUnknown: "x" }],
    ["malformed blend container", { ethnicityBlend: { name: "Nordic", pct: 100 } }],
    ["malformed vibe shape", { castingVibe: { editorial: "high" } }],
    ["extra vibe key", { castingVibe: { editorial: 1, commercial: 0, runway: 0, extra: 1 } }],
  ])("%s is schema-REJECTED before deduction, save, or generation", async (_label, attributes) => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.boardOps.runGeneration.execute({
        clientRequestId: REQUEST_ID,
        boardId: 2, itemId: 3, attributes: attributes as never,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(createModel).not.toHaveBeenCalled();
    expect(generateCastingImage).not.toHaveBeenCalled();
  });

  it("well-typed attributes pass the wire and cast normally", async () => {
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.boardOps.runGeneration.execute({
      clientRequestId: REQUEST_ID,
      boardId: 2, itemId: 3,
      attributes: { gender: "Female", age: 24, castingVibe: { editorial: 1, commercial: 0, runway: 0 } },
      userPrompt: "sharp editorial Nordic face",
    });
    expect(result.success).toBe(true);
  });
});

// ─── M6: the update branch is a structured §8.6 commit ──────────────────────

describe("R7-1E Canvas operation receipts", () => {
  it("casts under the board-item lock, binds the created model, and replays without a second paid worker call", async () => {
    const caller = appRouter.createCaller(authCtx());
    const input = {
      clientRequestId: REQUEST_ID,
      boardId: 2,
      itemId: 3,
      userPrompt: "sharp editorial Nordic face",
    };

    const first = await caller.boardOps.runGeneration.execute(input);
    expect(claimGenerationOperation).toHaveBeenCalledWith(expect.objectContaining({
      kind: "canvas.cast",
      originBoardId: 2,
      originItemId: 3,
      modelId: undefined,
    }));
    expect(acquireGenerationOperationLock).toHaveBeenCalledWith(expect.objectContaining({
      kind: "canvas.cast",
      lockKey: "board-item:3",
    }));
    expect(markGenerationOperationRunning).toHaveBeenCalledWith(expect.objectContaining({
      plannedCredits: 350,
      requiredLockKey: "board-item:3",
    }));
    expect(bindGenerationOperationModel).toHaveBeenCalledWith(expect.objectContaining({ modelId: 88 }));
    expect(finalizeGenerationOperationSuccess).toHaveBeenCalledWith(expect.objectContaining({
      result: first,
      chargedCredits: 350,
      refundedCredits: 0,
    }));

    operation.outcome = { type: "replay_success", operationId: REQUEST_ID, result: first };
    const paidCalls = vi.mocked(generateCastingImage).mock.calls.length;
    const runningCalls = vi.mocked(markGenerationOperationRunning).mock.calls.length;
    const replay = await caller.boardOps.runGeneration.execute(input);
    expect(replay).toEqual(first);
    expect(generateCastingImage).toHaveBeenCalledTimes(paidCalls);
    expect(markGenerationOperationRunning).toHaveBeenCalledTimes(runningCalls);
  });

  it("recasts under the source-model lock and records the actual single charge", async () => {
    const caller = appRouter.createCaller(authCtx());
    const input = {
      clientRequestId: REQUEST_ID,
      boardId: 2,
      itemId: 3,
      decision: "update" as const,
      changes: { jawline: "Sharp / Chiseled" },
    };
    const result = await caller.boardOps.applyModelEdit.execute(input);

    expect(claimGenerationOperation).toHaveBeenCalledWith(expect.objectContaining({
      kind: "canvas.recast",
      modelId: 7,
      originBoardId: 2,
      originItemId: 3,
    }));
    expect(acquireGenerationOperationLock).toHaveBeenCalledWith(expect.objectContaining({
      lockKey: "model:7",
    }));
    expect(bootstrapModelSnapshot).toHaveBeenCalledWith({ userId: 1, modelId: 7 });
    expect(vi.mocked(bootstrapModelSnapshot).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(markGenerationOperationRunning).mock.invocationCallOrder[0],
    );
    expect(finalizeGenerationOperationSuccess).toHaveBeenCalledWith(expect.objectContaining({
      result,
      chargedCredits: 350,
      refundedCredits: 0,
    }));

    operation.outcome = { type: "replay_success", operationId: REQUEST_ID, result };
    const paidCalls = vi.mocked(generateCastingImageRaw).mock.calls.length;
    const replay = await caller.boardOps.applyModelEdit.execute(input);
    expect(replay).toEqual(result);
    expect(generateCastingImageRaw).toHaveBeenCalledTimes(paidCalls);
  });

  it("a headless Canvas recast refuses before running, charging, or generation", async () => {
    vi.mocked(bootstrapModelSnapshot).mockResolvedValueOnce({ status: "headless", modelId: 7 });
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.boardOps.applyModelEdit.execute({
      clientRequestId: REQUEST_ID,
      boardId: 2,
      itemId: 3,
      decision: "update",
      changes: { jawline: "Sharp / Chiseled" },
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Generate a headshot before recasting this Cast.",
    });
    expect(markGenerationOperationRunning).not.toHaveBeenCalled();
    expect(deductPoints).not.toHaveBeenCalled();
    expect(generateCastingImageRaw).not.toHaveBeenCalled();
  });

  it("forks under the source-model lock while preserving the new draft as the paid result", async () => {
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.boardOps.applyModelEdit.execute({
      clientRequestId: REQUEST_ID,
      boardId: 2,
      itemId: 3,
      decision: "fork",
      changes: {},
      intent: "rerun",
    });

    expect(claimGenerationOperation).toHaveBeenCalledWith(expect.objectContaining({
      kind: "canvas.fork",
      modelId: 7,
      originBoardId: 2,
      originItemId: 3,
    }));
    expect(acquireGenerationOperationLock).toHaveBeenCalledWith(expect.objectContaining({
      lockKey: "model:7",
    }));
    expect(bootstrapModelSnapshot).not.toHaveBeenCalled();
    expect(result).toMatchObject({ decision: "fork", modelId: 88, placed: true });
    expect(finalizeGenerationOperationSuccess).toHaveBeenCalledWith(expect.objectContaining({
      result,
      chargedCredits: 350,
      refundedCredits: 0,
    }));
  });

  it("variations share one parent receipt with model ownership and the full planned total", async () => {
    const caller = appRouter.createCaller(authCtx());
    const input = {
      clientRequestId: REQUEST_ID,
      boardId: 2,
      itemId: 3,
      count: 1,
    };
    const result = await caller.boardOps.runVariations.execute(input);

    expect(claimGenerationOperation).toHaveBeenCalledWith(expect.objectContaining({
      kind: "canvas.variations",
      modelId: 7,
      originBoardId: 2,
      originItemId: 3,
    }));
    expect(markGenerationOperationRunning).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 7,
      plannedCredits: 350,
      requiredLockKey: "model:7",
    }));
    expect(finalizeGenerationOperationSuccess).toHaveBeenCalledWith(expect.objectContaining({
      result,
      chargedCredits: 350,
      refundedCredits: 0,
    }));

    operation.outcome = { type: "replay_success", operationId: REQUEST_ID, result };
    const candidateCalls = vi.mocked(generateMasterPrompt).mock.calls.length;
    const replay = await caller.boardOps.runVariations.execute(input);
    expect(replay).toEqual(result);
    expect(generateMasterPrompt).toHaveBeenCalledTimes(candidateCalls);
  });

  it("a busy Canvas receipt refuses before marking running, charging, or generating", async () => {
    operation.outcome = {
      type: "resource_busy",
      operationId: REQUEST_ID,
      lockKey: "board-item:3",
      ownerOperationId: "22222222-2222-4222-8222-222222222222",
    };
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.boardOps.runGeneration.execute({
      clientRequestId: REQUEST_ID,
      boardId: 2,
      itemId: 3,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(markGenerationOperationRunning).not.toHaveBeenCalled();
    expect(deductPoints).not.toHaveBeenCalled();
    expect(generateCastingImage).not.toHaveBeenCalled();
  });
});

describe("applyModelEdit UPDATE = source:'structured' recast commit (M6)", () => {
  it("a valid recast commits document + new anchor/revision + stale flags (pinned included), FREE validation first", async () => {
    const result = await executeApplyModelEdit({
      userId: 1, itemId: 3, decision: "update",
      changes: { jawline: "Sharp / Chiseled", bodyType: "Athletic" },
    });
    expect(result.decision).toBe("update");
    // The atomic commit carried everything (the board stamp also rides the
    // fake tx now — select the IDENTITY update by shape)
    const update = tx.modelUpdates.find((u) => "identityRevisionId" in u)!;
    expect(update).toBeDefined();
    expect((update.preferences as Record<string, unknown>).jawline).toBe("Sharp / Chiseled");
    expect((update.preferences as Record<string, unknown>).bodyType).toBe("Athletic");
    expect(String(update.identityRevisionId)).toMatch(/^rev-/);
    // Protected amendment/mark language preserved (no wholesale re-derivation)
    expect(String(update.masterPrompt)).toContain("rose tattoo note");
    expect(generateMasterPrompt).not.toHaveBeenCalled();
    // New anchor + typed edit provenance
    const anchorRow = tx.assetInserts.find((i) => "provenance" in i) as { provenance: Record<string, unknown> };
    expect(anchorRow).toBeDefined();
    expect(anchorRow.provenance.identityRole).toBe("anchor");
    expect(anchorRow.provenance.identityEditSource).toBe("structured");
    // Stale flags include the PINNED sideClose
    expect(tx.staleUpdates).toHaveLength(1);
    // Paid exactly once, after validation
    expect(deductPoints).toHaveBeenCalledTimes(1);
    expect(generateCastingImageRaw).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ modelId: 7 }),
    );
  });

  it("non-identity keys (brand/vibe/brief/features) refuse the update FREE — the features escape hatch is closed", async () => {
    for (const changes of [
      { castingBrand: "Prada" },
      { castingVibe: { editorial: 1, commercial: 0, runway: 0 } },
      { userPrompt: "another brief" },
      { features: "add winged eyeliner" },
    ]) {
      await expect(
        executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    expect(deductPoints).not.toHaveBeenCalled();
    expect(tx.modelUpdates).toEqual([]);
  });

  it("closed-select fields reject prose entirely — eyelash smuggling can't even reach the content scan (finding 4)", async () => {
    await expect(
      executeApplyModelEdit({
        userId: 1, itemId: 3, decision: "update",
        changes: { eyeShape: "almond with naturally long eyelashes" },
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("pick a value") });
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("eyelash language cannot ride an OPEN structured channel either (§5.2/M16)", async () => {
    await expect(
      executeApplyModelEdit({
        userId: 1, itemId: 3, decision: "update",
        changes: { hairStyleOverride: "a bob framing naturally long eyelashes" },
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.eyelashPostCreation });
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("FINDING 4 corpus: forbidden content cannot ride ANY permitted structured key, free, before generation/writes", async () => {
    const cases: Array<Record<string, unknown>> = [
      { jawline: "scarred jawline with a tattoo" },            // closed field → prose rejected
      { skinFinish: "dewy makeup with highlighter" },          // closed field → prose rejected
      { eyeShape: "like the attached reference, with sunglasses" }, // closed field → prose rejected
      { hairStyleOverride: "slicked back with a small tattoo behind the ear" }, // open → mark refused
      { skinTextureOverride: "dewy makeup finish with highlighter" },           // open → presentation refused
      { facialHairOverride: "like the attached reference" },   // open → relational refused
      { hairHairline: "under a beanie" },                      // open (no UI list) → presentation refused
    ];
    for (const changes of cases) {
      await expect(
        executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    expect(deductPoints).not.toHaveBeenCalled();
    expect(generateCastingImage).not.toHaveBeenCalled();
    expect(tx.modelUpdates).toEqual([]);
  });

  it("FOUNDER FINAL RULING: every hair length is a valid durable structured edit — Long/Very Long included", async () => {
    for (const hairLength of ["Very Short", "Short", "Medium", "Long", "Very Long"]) {
      tx.reset();
      vi.mocked(deductPoints).mockClear();
      const ok = await executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { hairLength } });
      expect(ok.decision).toBe("update");
      // The real typed pathway ran: new anchor + new revision + stale flags
      const update = tx.modelUpdates[0];
      expect((update.preferences as Record<string, unknown>).hairLength).toBe(hairLength);
      expect(String(update.masterPrompt)).toContain(`hair length: ${hairLength}`);
      expect(String(update.identityRevisionId)).toMatch(/^rev-/);
      expect(tx.staleUpdates).toHaveLength(1); // the PINNED sideClose stales too
      expect(deductPoints).toHaveBeenCalledTimes(1); // paid once, never auto-regenerating siblings
    }
    // Long Layers is a STYLE and coexists with any length
    tx.reset();
    const layered = await executeApplyModelEdit({
      userId: 1, itemId: 3, decision: "update",
      changes: { hairStyle: "Long Layers", hairLength: "Very Long" },
    });
    expect(layered.decision).toBe("update");
    const prefs = tx.modelUpdates[0].preferences as Record<string, unknown>;
    expect(prefs.hairStyle).toBe("Long Layers");
    // rule-2 resets fire on a style change, then the explicit length lands
    expect(prefs.hairLength).toBe("Very Long");
  });

  it("off-list structured values refuse FREE (closed option sets)", async () => {
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { bodyType: "Bodybuilder" } }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("minted originals stay untouched: update refuses, fork is the boundary (D-43 regression)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "active", agencyId: "MOD-1" }) as never);
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deductPoints).not.toHaveBeenCalled();
  });
});

// ─── M22 ⊕: creation ordering — validation and refusal BEFORE money ─────────

describe("creation doors reordered: refusal precedes deduction (M22)", () => {
  it("fork intake refusal is FREE (this door used to deduct first)", async () => {
    await expect(
      executeApplyModelEdit({
        userId: 1, itemId: 3, decision: "fork",
        changes: { features: "always wearing sunglasses" },
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.creationPresentation });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(createModel).not.toHaveBeenCalled();
  });

  it("fork-from-refusal text passes intake when it is honest identity input (ink allowed at creation)", async () => {
    const result = await executeApplyModelEdit({
      userId: 1, itemId: 3, decision: "fork",
      changes: { features: "add a small tattoo on the forearm" },
    });
    expect(result.decision).toBe("fork");
    expect(deductPoints).toHaveBeenCalledTimes(1);
  });

  it("fork clears any persisted legacy referenceImage before creating the candidate (§10.3)", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ preferences: { gender: "Female", referenceImage: "data:image/png;base64,LEGACY" } }) as never,
    );
    await executeApplyModelEdit({ userId: 1, itemId: 3, decision: "fork", changes: { jawline: "Sharp / Chiseled" } });
    const prefs = vi.mocked(createModel).mock.calls[0][0].preferences as Record<string, unknown>;
    expect(prefs.referenceImage).toBeUndefined();
    expect(generateCastingImage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ modelId: 88 }),
    );
  });

  it("fork preserves untouched Open flags, clears an explicitly set flag, and never prompts with metadata", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({
      preferences: {
        castingBrand: "Prada",
        eyeColor: "Hazel",
        hairColor: "Dark Brown",
        engineChoice: { eyeColor: true, hairColor: true },
      },
    }) as never);

    await executeApplyModelEdit({
      userId: 1,
      itemId: 3,
      decision: "fork",
      changes: { eyeColor: "Blue" },
    });

    const promptPrefs = vi.mocked(generateMasterPrompt).mock.calls[0][0] as unknown as Record<string, unknown>;
    const storedPrefs = vi.mocked(createModel).mock.calls[0][0].preferences as Record<string, unknown>;
    expect(promptPrefs.engineChoice).toBeUndefined();
    expect(storedPrefs.engineChoice).toEqual({ hairColor: true });
    expect(storedPrefs.eyeColor).toBe("Blue");
  });

  it("canvas runGeneration: an intake refusal happens BEFORE the deduction (was deduct-then-parse)", async () => {
    await expect(
      executeRunGeneration({ userId: 1, itemId: 3, userPrompt: "girl in a leather jacket" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(createModel).not.toHaveBeenCalled();
  });

  it("canvas runGeneration: a clean brief creates with the anchor+genesis stamp", async () => {
    const result = await executeRunGeneration({ userId: 1, itemId: 3, userPrompt: "sharp editorial Nordic face" });
    expect(result.success).toBe(true);
    expect(deductPoints).toHaveBeenCalledTimes(1);
    const row = vi.mocked(createModelAsset).mock.calls[0][0] as { provenance: Record<string, unknown> };
    expect(row.provenance.identityRole).toBe("anchor");
    expect(row.provenance.identityRevisionId).toBe("genesis");
  });

  it("variations: base preferences validated and reference-cleared before the batch deduction", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ preferences: { gender: "Female", features: "gold hoop earrings" } }) as never,
    );
    await expect(
      executeRunVariations({ userId: 1, itemId: 3, count: 2 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("variations preserve Open flags on candidates but never send metadata to intake or Gemini", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({
      preferences: {
        castingBrand: "Prada",
        eyeColor: "Hazel",
        engineChoice: { eyeColor: true },
      },
    }) as never);

    const result = await executeRunVariations({ userId: 1, itemId: 3, count: 1 });
    expect(result.variations).toHaveLength(1);
    const promptPrefs = vi.mocked(generateMasterPrompt).mock.calls[0][0] as unknown as Record<string, unknown>;
    const storedPrefs = vi.mocked(createModel).mock.calls[0][0].preferences as Record<string, unknown>;
    expect(promptPrefs.engineChoice).toBeUndefined();
    expect(storedPrefs.engineChoice).toEqual({ eyeColor: true });
  });
});

// ─── M19: Canvas/Wardrobe two-sided isolation ────────────────────────────────

describe("Canvas/Wardrobe isolation (M19) — no blanket grep, both sides explicit", () => {
  it("ordinary Canvas generation NEVER mutates the source cast's identity", async () => {
    await executeRunGeneration({ userId: 1, itemId: 3, userPrompt: "sharp editorial Nordic face" });
    // creates a NEW model; the source model row is untouched (the fake tx
    // also records the BOARD stamp now — assert no IDENTITY-shaped write)
    expect(updateModel).not.toHaveBeenCalled();
    expect(tx.modelUpdates.every((u) => !("masterPrompt" in u) && !("identityRevisionId" in u))).toBe(true);
  });

  it("Edit Cast is the one deliberate door — and it reaches only the guarded update/fork boundary", async () => {
    // fork: the original model row is never written
    await executeApplyModelEdit({ userId: 1, itemId: 3, decision: "fork", changes: { jawline: "Sharp / Chiseled" } });
    expect(updateModel).not.toHaveBeenCalled();
    expect(tx.modelUpdates).toEqual([]);
  });

  it("wardrobe modules write their own tables only — no model-identity writer imports (source-level)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const wardrobeDir = path.join(__dirname, "wardrobe");
    for (const file of fs.readdirSync(wardrobeDir).filter((f) => f.endsWith(".ts"))) {
      const src = fs.readFileSync(path.join(wardrobeDir, file), "utf8");
      expect(src, `${file} must not write model identity`).not.toMatch(/\bupdateModel\b|\bmintModel(?:Atomically)?\b|\bcommitIdentityEdit\b/);
    }
  });
});
