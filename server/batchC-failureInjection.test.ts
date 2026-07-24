/**
 * Batch C review findings 2+3 — failure injection at the PAID DURABLE-EFFECT
 * boundaries. Each test injects a result-style database failure (the layer
 * returns { success:false } — it does not throw) or a thrown board write and
 * asserts BOTH the durable outcome and the credit outcome:
 *
 *  - BEFORE the durable paid result commits: failure ⇒ no usable result
 *    survives and the deterministic refund is recorded exactly once;
 *  - AFTER it commits: audit/board synchronization failure ⇒ NO refund and
 *    NO retryable "generation failed" answer that could duplicate the work.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

const tx = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  /** Fail board-item inserts (values carrying `kind`) — the atomic
   *  placement's FIRST write. */
  failBoardItemInsert: false,
  /** Fail version-row inserts (values carrying `version`) — the atomic
   *  landing's SECOND write. */
  failVersionInsert: false,
  /** Fail the node STAMP update (values carrying imageUrl + metadata) —
   *  the identity landing's board-item write (final correction 3). */
  failStampUpdate: false,
  /** Fail metadata-only updates — the downstream STALE status writes
   *  (final correction 3: never silently swallowed). */
  failStaleStatusUpdate: false,
  fillResult: "filled" as "filled" | "not_found" | "not_empty",
  reset() {
    this.inserts = [];
    this.updates = [];
    this.failBoardItemInsert = false;
    this.failVersionInsert = false;
    this.failStampUpdate = false;
    this.failStaleStatusUpdate = false;
    this.fillResult = "filled";
  },
}));
const llmScript = vi.hoisted(() => ({
  classify: '{"kind":"imageOnly","categories":["image.lighting"],"operations":{}}',
  normalize: '{"edits":[{"leaf":"person.face.jawline","value":"broad angular jaw, squared"}]}',
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getBoardById: vi.fn(),
    getBoardItemById: vi.fn(),
    getModelById: vi.fn(),
    getModelAssets: vi.fn(),
    createModel: vi.fn(),
    createGeneration: vi.fn(),
    updateGeneration: vi.fn(),
    updateModel: vi.fn(),
    markGenerationOperationRunning: vi.fn().mockResolvedValue({ operationId: "11111111-1111-4111-8111-111111111111", chargeReferenceId: "op:11111111-1111-4111-8111-111111111111:charge" }),
    assertGenerationOperationSnapshotHead: vi.fn().mockResolvedValue(undefined),
    createModelAsset: vi.fn(),
    markModelAssetsStale: vi.fn(),
    updateBoardItem: vi.fn(),
    addBoardItemVersion: vi.fn(),
    getLatestVersionNumber: vi.fn(),
    addBoardItem: vi.fn(),
    fillEmptyCastNodeWithVersionIn: vi.fn(async () => {
      if (tx.failStampUpdate) throw new Error("board stamp update failed");
      if (tx.failVersionInsert) throw new Error("version insert failed");
      if (tx.fillResult !== "filled") return tx.fillResult;
      tx.updates.push({ imageUrl: "https://pub-test.r2.dev/x.png", metadata: {} });
      tx.inserts.push({ itemId: 3, version: 1 });
      return "filled" as const;
    }),
    stampBoardItemWithVersionIn: vi.fn(async (_transaction: unknown, input: {
      itemId: number;
      update: Record<string, unknown>;
      version: Record<string, unknown>;
    }) => {
      if (tx.failStampUpdate) throw new Error("board stamp update failed");
      tx.updates.push(input.update);
      if (tx.failVersionInsert) throw new Error("version insert failed");
      tx.inserts.push({ ...input.version, itemId: input.itemId });
    }),
    placeLinkedBoardItem: vi.fn(async (input: {
      item: Record<string, unknown>;
      edge: Record<string, unknown>;
      initialVersion?: Record<string, unknown>;
    }) => {
      if (tx.failBoardItemInsert) throw new Error("board item insert failed");
      const itemId = 888;
      tx.inserts.push(input.item);
      if (input.initialVersion) {
        if (tx.failVersionInsert) throw new Error("version insert failed");
        tx.inserts.push({ ...input.initialVersion, itemId, version: 1 });
      }
      tx.inserts.push({ ...input.edge, targetItemId: itemId });
      return itemId;
    }),
    updateBoardItemIn: vi.fn(async (_transaction: unknown, _itemId: number, values: Record<string, unknown>) => {
      if (tx.failStaleStatusUpdate) throw new Error("downstream stale write failed");
      tx.updates.push(values);
      return { success: true };
    }),
    deductPoints: vi.fn(),
    deductCredits: vi.fn(),
    addCredits: vi.fn(),
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
    update: (_t: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if (tx.failStampUpdate && "imageUrl" in values && "metadata" in values) {
            return Promise.reject(new Error("board stamp update failed"));
          }
          const keys = Object.keys(values);
          if (tx.failStaleStatusUpdate && keys.length === 1 && keys[0] === "metadata") {
            return Promise.reject(new Error("downstream stale write failed"));
          }
          tx.updates.push(values);
          return Promise.resolve({ affectedRows: 1 });
        },
      }),
    }),
    insert: (_t: unknown) => ({
      // Thenable like the real drizzle builder: version/edge rows are
      // awaited WITHOUT $returningId, item/asset rows WITH it — both must
      // run the shape-selective failure and record the values.
      values: (values: Record<string, unknown>) => {
        const run = () => {
          if (tx.failBoardItemInsert && "kind" in values) throw new Error("board item insert failed");
          if (tx.failVersionInsert && "version" in values && "itemId" in values) throw new Error("version insert failed");
          tx.inserts.push(values);
        };
        return {
          $returningId: async () => {
            run();
            return [{ id: 888 }];
          },
          then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            try {
              run();
              return Promise.resolve(undefined).then(onFulfilled, onRejected);
            } catch (e) {
              return Promise.reject(e).then(onFulfilled, onRejected);
            }
          },
        };
      },
    }),
  });
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    withTransaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(makeTx())),
  };
});
vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>();
  return { ...actual, storageDelete: vi.fn().mockResolvedValue({ success: true }) };
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
    generateMasterPrompt: vi.fn().mockResolvedValue({ naturalDescription: "desc", technicalSchema: {} }),
    generateCastingImage: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/x.png", storageKey: "casting/x.png", engineUsed: "test" }),
    generateCastingImageRaw: vi.fn().mockResolvedValue({ imageBase64: "data:image/png;base64,eA==", engineUsed: "test" }),
    uploadRawCandidate: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/gated.png", storageKey: "casting/gated.png" }),
    generateFullBody: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/b.png", storageKey: "casting/b.png", engineUsed: "test" }),
    generateRemainingViews: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/v.png", storageKey: "casting/v.png", engineUsed: "test" }),
    iterateModel: vi.fn().mockResolvedValue({
      imageUrl: "https://pub-test.r2.dev/i.png",
      storageKey: "iterate/i.png",
      engineUsed: "test",
    }),
    iterateModelRaw: vi.fn().mockResolvedValue({ imageBase64: "data:image/png;base64,aQ==", engineUsed: "test" }),
    clearCastingSession: vi.fn(),
  };
});
vi.mock("./casting/identity/editGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/identity/editGate")>();
  return { ...actual, verifyIdentityEdit: vi.fn().mockResolvedValue({ ok: true, checked: true, violations: [] }) };
});
vi.mock("./casting/promptParser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/promptParser")>();
  return { ...actual, parseCastingPrompt: vi.fn().mockResolvedValue({}) };
});
vi.mock("./casting/backViewGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/backViewGate")>();
  return { ...actual, verifyViewIdentity: vi.fn().mockResolvedValue({ ok: true }) };
});
vi.mock("./wardrobe/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./wardrobe/utils")>();
  return {
    ...actual,
    withTextQueue: (fn: () => unknown) => Promise.resolve(fn()),
    getAiClient: () => ({
      models: {
        generateContent: async (req: { contents: unknown }) => {
          const body = JSON.stringify(req.contents);
          return { text: body.includes("You classify") ? llmScript.classify : llmScript.normalize };
        },
      },
    }),
  };
});
vi.mock("./casting/directOperation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/directOperation")>();
  return {
    ...actual,
    beginDirectOperation: vi.fn().mockResolvedValue({ type: "execute", operationId: "11111111-1111-4111-8111-111111111111" }),
    completeDirectOperationSuccess: vi.fn().mockResolvedValue(undefined),
    completeDirectOperationFailure: vi.fn(async ({ error }: { error: unknown }) => { throw error; }),
    failClaimedDirectOperation: vi.fn(async ({ error }: { error: unknown }) => { throw error; }),
  };
});
vi.mock("./casting/snapshotBootstrap", () => ({
  bootstrapModelSnapshot: vi.fn().mockResolvedValue({
    status: "bootstrapped",
    modelId: 7,
    identitySnapshotId: "11111111-1111-4111-8111-111111111114",
    packageSnapshotId: "11111111-1111-4111-8111-111111111115",
    stateVersion: 1,
    selectedSlotCount: 1,
  }),
}));
vi.mock("./casting/snapshotReadScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotReadScope")>();
  return {
    ...actual,
    captureSnapshotReadMode: vi.fn().mockReturnValue("r6"),
  };
});
vi.mock("./casting/effectiveCastRead", () => ({
  resolveEffectiveCastStateForRead: vi.fn(),
}));
vi.mock("./casting/snapshotTransitions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotTransitions")>();
  return {
    ...actual,
    commitHeadshotSnapshot: vi.fn(async (input: any) => {
      const db = await import("./db");
      const created = await db.createModelAsset({
        modelId: input.modelId,
        viewType: "frontClose",
        storageUrl: input.candidate.storageUrl,
        storageKey: input.candidate.storageKey,
        pointsCost: input.candidate.pointsCost,
        provenance: { identityRole: "anchor", identityRevisionId: "genesis" },
      });
      if (!created.success || !created.assetId) throw new Error("insert failed");
      return {
        result: {
          assetId: created.assetId,
          isReRoll: false,
          identityRevisionId: "genesis",
          staledAssetIds: [],
        },
      };
    }),
    commitImageRefineSnapshot: vi.fn(async (input: any) => {
      const db = await import("./db");
      const rows = await db.getModelAssets(input.modelId);
      const target = rows.find((row) => row.id === input.candidate.targetAssetId)!;
      const created = await db.createModelAsset({
        modelId: input.modelId,
        viewType: target.viewType,
        storageUrl: input.candidate.storageUrl,
        storageKey: input.candidate.storageKey,
        pointsCost: input.candidate.pointsCost,
        provenance: { identityRole: "display", identityRevisionId: "rev-a" },
      });
      if (!created.success || !created.assetId) throw new Error("insert failed");
      return { result: { assetId: created.assetId } };
    }),
    commitIteratedIdentitySnapshot: vi.fn(async (input: any) => {
      const db = await import("./db");
      const identity = await import("./casting/identity/identityCommit");
      const model = await db.getModelById(input.modelId);
      const assets = await db.getModelAssets(input.modelId);
      const target = assets.find((row) => row.id === input.candidate.targetAssetId)!;
      const result = await identity.commitIdentityEdit({
        model: model!,
        patch: input.patch,
        newAnchor: {
          storageUrl: input.candidate.storageUrl,
          pointsCost: input.candidate.pointsCost,
          engine: input.candidate.engine,
          inputs: [{ viewAngle: target.viewType, imageUrl: target.storageUrl }],
        },
        assets,
      });
      return { result };
    }),
    commitCanvasRecastSnapshot: vi.fn(async (input: any) => {
      const db = await import("./db");
      const identity = await import("./casting/identity/identityCommit");
      const gemini = await import("./casting/geminiClient");
      const model = await db.getModelById(input.modelId);
      const assets = await db.getModelAssets(input.modelId);
      if (!model) throw new Error("model fixture missing");
      const result = input.patch
        ? await identity.commitIdentityEdit({
            model,
            patch: input.patch,
            newAnchor: {
              storageUrl: input.candidate.storageUrl,
              pointsCost: input.candidate.pointsCost,
              engine: input.candidate.engine,
            },
            assets,
            landing: input.landing,
          })
        : await identity.commitAnchorReRoll({
            modelId: input.modelId,
            storageUrl: input.candidate.storageUrl,
            pointsCost: input.candidate.pointsCost,
            engine: input.candidate.engine,
            identityText: gemini.buildIdentityAnchor(model.masterPrompt || "", model.technicalSchema ?? undefined),
            assets,
            landing: input.landing,
          });
      return { result };
    }),
    commitGeneratedPackageSnapshot: vi.fn(async (input: any) => ({
      result: {
        generated: input.candidates.map((candidate: any, index: number) => ({
          angle: candidate.angle,
          imageUrl: candidate.storageUrl,
          assetId: 800 + index,
        })),
        agencyId: input.mode === "mint" ? input.mint.agencyId : null,
        minted: input.mode === "mint" || input.mode === "late_view",
      },
    })),
  };
});

import {
  getBoardById,
  getBoardItemById,
  getModelById,
  getModelAssets,
  createModel,
  createGeneration,
  updateGeneration,
  updateModel,
  createModelAsset,
  updateBoardItem,
  addBoardItemVersion,
  getLatestVersionNumber,
  addBoardItem,
  deductPoints,
  deductCredits,
  addCredits,
  assertGenerationOperationSnapshotHead,
} from "./db";
import { addBoardEdge, getEdgesFrom } from "./db/boardEdges";
import {
  iterateModel, iterateModelRaw, generateCastingImage, generateCastingImageRaw,
  generateMasterPrompt, generateRemainingViews, uploadRawCandidate, clearCastingSession,
} from "./casting/aiService";
import { verifyIdentityEdit } from "./casting/identity/editGate";
import { refundReferenceFor } from "./casting/atomicCredits";
import { PublicError } from "./lib/publicError";
import { executeMintPackage } from "./casting/mintPackage";
import {
  executeApplyModelEdit as executeApplyModelEditRaw,
  executeRunGeneration as executeRunGenerationRaw,
  executeRunVariations as executeRunVariationsRaw,
} from "./lib/boardOps";
import { appRouter as productionRouter } from "./routers";
import { storageDelete } from "./storage";
import {
  commitGeneratedPackageSnapshot,
  commitImageRefineSnapshot,
  commitIteratedIdentitySnapshot,
} from "./casting/snapshotTransitions";
import { captureSnapshotReadMode } from "./casting/snapshotReadScope";
import { resolveEffectiveCastStateForRead } from "./casting/effectiveCastRead";
import { assertPublicOperationResult } from "./casting/operationContract";

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
const appRouter = {
  createCaller(ctx: TrpcContext) {
    const caller = productionRouter.createCaller(ctx);
    return {
      ...caller,
      generation: {
        ...caller.generation,
        iterate: (input: any) => caller.generation.iterate({ clientRequestId: REQUEST_ID, ...input }),
        castingImage: (input: any) => caller.generation.castingImage({ clientRequestId: REQUEST_ID, ...input }),
      },
    };
  },
};

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

const model = (over: Record<string, unknown> = {}) => ({
  id: 7, userId: 1, name: "Draft", status: "draft", agencyId: null, mintedAt: null,
  masterPrompt: "prompt", technicalSchema: {}, preferences: { gender: "Female" },
  identityRevisionId: "rev-a", createdAt: new Date(), ...over,
});
const asset = (over: Record<string, unknown> = {}) => ({
  id: 100, modelId: 7, viewType: "frontClose", storageUrl: "https://r2/head.png",
  pinned: false, status: null, provenance: { identityRole: "anchor", identityRevisionId: "rev-a" }, createdAt: new Date(), ...over,
});
const effectiveState = (over: Record<string, unknown> = {}) => ({
  status: "current",
  model: model({
    masterPrompt: "mutable drift",
    technicalSchema: { context: { casting_for: "Mutable Drift" } },
    preferences: { gender: "Male" },
    stateVersion: 1,
    currentPackageSnapshotId: "11111111-1111-4111-8111-111111111115",
  }),
  identity: {
    id: "11111111-1111-4111-8111-111111111114",
    modelId: 7,
    masterPrompt: "immutable snapshot prompt",
    technicalSchema: { context: { casting_for: "Snapshot Brand" } },
    preferences: { gender: "Female" },
    identityText: "immutable identity text",
    anchorAssetId: 100,
  },
  anchor: asset(),
  displayedHeadshot: asset(),
  selectedViews: [{
    angle: "frontClose",
    compatibility: "current",
    asset: asset(),
  }],
  ledger: { assets: [asset()] },
  ...over,
});
const boardItem = (over: Record<string, unknown> = {}) => ({
  id: 3, boardId: 2, kind: "image", label: "Cast", imageUrl: "https://r2/head.png",
  positionX: 0, positionY: 0, width: 280, height: 420, deletedAt: null, sourceModelId: 7,
  metadata: { provenance: { type: "cast_root", modelId: 7, viewAngle: "frontClose" } }, ...over,
});

beforeEach(() => {
  vi.mocked(getBoardById).mockReset().mockResolvedValue({ id: 2, userId: 1 } as never);
  vi.mocked(getBoardItemById).mockReset().mockResolvedValue(boardItem() as never);
  vi.mocked(getModelById).mockReset().mockResolvedValue(model() as never);
  vi.mocked(getModelAssets).mockReset().mockResolvedValue([asset()] as never);
  vi.mocked(createModel).mockReset().mockResolvedValue({ success: true, modelId: 88 } as never);
  vi.mocked(createGeneration).mockReset().mockResolvedValue({ success: true, generationId: 11 } as never);
  vi.mocked(updateGeneration).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(updateModel).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(commitGeneratedPackageSnapshot).mockReset().mockImplementation(async (input) => ({
    result: {
      generated: input.candidates.map((candidate, index) => ({
        angle: candidate.angle,
        imageUrl: candidate.storageUrl,
        assetId: 800 + index,
      })),
      agencyId: input.mode === "mint" ? input.mint?.agencyId ?? null : null,
      minted: input.mode === "mint" || input.mode === "late_view",
    },
  }) as never);
  vi.mocked(createModelAsset).mockReset().mockResolvedValue({ success: true, assetId: 501 } as never);
  vi.mocked(updateBoardItem).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(addBoardItemVersion).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(getLatestVersionNumber).mockReset().mockResolvedValue(1 as never);
  vi.mocked(addBoardItem).mockReset().mockResolvedValue(55 as never);
  vi.mocked(addBoardEdge).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(getEdgesFrom).mockReset().mockResolvedValue([] as never);
  vi.mocked(deductPoints).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(deductCredits).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(addCredits).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(iterateModel).mockClear();
  vi.mocked(iterateModelRaw).mockClear();
  vi.mocked(generateCastingImage).mockClear();
  vi.mocked(generateCastingImageRaw).mockClear();
  vi.mocked(clearCastingSession).mockClear();
  vi.mocked(assertGenerationOperationSnapshotHead).mockReset().mockResolvedValue(undefined);
  vi.mocked(captureSnapshotReadMode).mockReset().mockReturnValue("r6");
  vi.mocked(resolveEffectiveCastStateForRead).mockReset();
  vi.mocked(commitImageRefineSnapshot).mockClear();
  vi.mocked(commitIteratedIdentitySnapshot).mockClear();
  vi.mocked(uploadRawCandidate).mockReset().mockResolvedValue({
    imageUrl: "https://pub-test.r2.dev/gated.png",
    storageKey: "casting/gated.png",
  });
  vi.mocked(verifyIdentityEdit).mockReset().mockResolvedValue({
    ok: true, checked: true, violations: [],
  });
  vi.mocked(storageDelete).mockReset().mockResolvedValue({ success: true });
  vi.mocked(generateMasterPrompt).mockClear();
  vi.mocked(generateRemainingViews).mockClear();
  llmScript.classify = '{"kind":"imageOnly","categories":["image.lighting"],"operations":{}}';
  tx.reset();
});

/** A core-tier package with exactly ONE missing slot (threeQuarter) so the
 *  mint generates a single slot — the failure-injection target. */
const CORE_MINUS_ONE = [
  asset({ id: 1 }),
  asset({ id: 2, viewType: "sideClose", storageUrl: "https://r2/side.png", provenance: { identityRevisionId: "rev-a" } }),
  asset({ id: 3, viewType: "frontFull", storageUrl: "https://r2/body.png", provenance: { identityRevisionId: "rev-a" } }),
];

// ── Mint/refresh slot: asset write failure (the finding's named regression) ──

describe("mint slot — createModelAsset returns { success:false }", () => {
  it("the slot is NOT ok, the model does NOT mint, the refund records once, the marker tells the truth", async () => {
    vi.mocked(getModelAssets).mockResolvedValue(CORE_MINUS_ONE as never);
    vi.mocked(commitGeneratedPackageSnapshot).mockRejectedValueOnce(new Error("atomic package insert failed"));
    vi.mocked(createModelAsset).mockResolvedValue({ success: true, assetId: 900 } as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera", operationId: REQUEST_ID });

    expect(res.minted).toBe(false);
    expect((res as Record<string, unknown>).mintAborted).toBe(true);
    expect(updateModel).not.toHaveBeenCalled(); // no name write on an aborted transition
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].reason).toContain("couldn't be saved");
    expect(res.failed[0].refunded).toBeGreaterThan(0);
    // Refund recorded exactly once, under the slot's deterministic id
    expect(addCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addCredits).mock.calls[0][4]).toBe(refundReferenceFor("legacy-mint-7:slot:threeQuarter"));
    expect(storageDelete).toHaveBeenCalledWith("casting/v.png");
    // The durable marker reflects the recorded refund
    const markerCall = vi.mocked(createModelAsset).mock.calls[0][0] as { status: { refunded: number } };
    expect(markerCall.status.refunded).toBe(res.failed[0].refunded);
  });

  it("a FAILED slot refund is persisted honestly: the marker says refunded 0, never a phantom refund", async () => {
    vi.mocked(getModelAssets).mockResolvedValue(CORE_MINUS_ONE as never);
    vi.mocked(commitGeneratedPackageSnapshot).mockRejectedValueOnce(new Error("atomic package insert failed"));
    vi.mocked(createModelAsset).mockResolvedValue({ success: true, assetId: 900 } as never);
    vi.mocked(addCredits).mockResolvedValue({ success: false, error: "db down" } as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera", operationId: REQUEST_ID });
    expect(res.failed[0].refunded).toBe(0);
    const markerCall = vi.mocked(createModelAsset).mock.calls[0][0] as { status: { refunded: number } };
    expect(markerCall.status.refunded).toBe(0);
  });

  it("MARKER persistence is result-checked (final correction 6): a failed marker is reported, never promised", async () => {
    vi.mocked(getModelAssets).mockResolvedValue(CORE_MINUS_ONE as never);
    vi.mocked(commitGeneratedPackageSnapshot).mockRejectedValueOnce(new Error("atomic package insert failed"));
    // The durable marker insert fails (result-style, no throw).
    vi.mocked(createModelAsset).mockResolvedValue({ success: false } as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera", operationId: REQUEST_ID });
    expect(res.minted).toBe(false);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].markerPersisted).toBe(false); // the truth reaches the response
    expect(res.failed[0].refundReference).toBe(refundReferenceFor("legacy-mint-7:slot:threeQuarter"));
  });

  it("a failed createGeneration fails the slot BEFORE any image call", async () => {
    vi.mocked(getModelAssets).mockResolvedValue(CORE_MINUS_ONE as never);
    vi.mocked(createGeneration).mockResolvedValue({ success: false } as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera", operationId: REQUEST_ID });
    expect(res.minted).toBe(false);
    expect(res.failed).toHaveLength(1);
    expect(generateRemainingViews).not.toHaveBeenCalled();
  });
});

// ── iterate: image-only asset failure vs post-commit audit failure ──────────

describe("generation.iterate boundaries", () => {
  it("snapshot image refinement generates from the selected immutable package truth", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(effectiveState() as never);

    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.iterate({
      modelId: 7,
      feedback: "brighten the lighting",
      assetId: 100,
    });

    expect(result.success).toBe(true);
    expect(resolveEffectiveCastStateForRead).toHaveBeenCalledTimes(2);
    expect(iterateModel).toHaveBeenCalledWith(
      expect.stringContaining("immutable snapshot prompt"),
      "https://r2/head.png",
      "brighten the lighting",
      expect.objectContaining({
        castingBrand: "Snapshot Brand",
        technicalSchema: { context: { casting_for: "Snapshot Brand" } },
      }),
    );
    expect(commitImageRefineSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        readMode: "snapshot",
        candidate: expect.objectContaining({ targetAssetId: 100 }),
      }),
    );
    expect(vi.mocked(assertGenerationOperationSnapshotHead).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(resolveEffectiveCastStateForRead).mock.invocationCallOrder[1]);
    expect(vi.mocked(resolveEffectiveCastStateForRead).mock.invocationCallOrder[1])
      .toBeLessThan(vi.mocked(iterateModel).mock.invocationCallOrder[0]);
  });

  it("snapshot iteration refuses an unselected historical asset before audit, money, or generation", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(effectiveState() as never);

    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({
        modelId: 7,
        feedback: "brighten the lighting",
        assetId: 999,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(resolveEffectiveCastStateForRead).toHaveBeenCalledTimes(1);
    expect(createGeneration).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
    expect(commitImageRefineSnapshot).not.toHaveBeenCalled();
  });

  it("snapshot iteration refuses a selected stale view instead of laundering it into current truth", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(effectiveState({
      selectedViews: [{
        angle: "frontClose",
        compatibility: "stale",
        asset: asset({ status: { state: "stale" } }),
      }],
    }) as never);

    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({
        modelId: 7,
        feedback: "brighten the lighting",
        assetId: 100,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(createGeneration).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
    expect(commitImageRefineSnapshot).not.toHaveBeenCalled();
  });

  it("snapshot authority drift after the running receipt fails free and seals the audit row", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead)
      .mockResolvedValueOnce(effectiveState() as never)
      .mockRejectedValueOnce(new Error("snapshot drift"));

    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({
        modelId: 7,
        feedback: "brighten the lighting",
        assetId: 100,
      }),
    ).rejects.toThrow("snapshot drift");

    expect(createGeneration).toHaveBeenCalledTimes(1);
    expect(updateGeneration).toHaveBeenCalledWith(11, expect.objectContaining({
      status: "failed",
    }));
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
    expect(commitImageRefineSnapshot).not.toHaveBeenCalled();
  });

  it("snapshot identity iteration threads immutable documents and mode into the atomic writer", async () => {
    llmScript.classify = '{"kind":"identity","categories":["person.face.jawline"],"operations":{}}';
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(effectiveState() as never);

    const caller = appRouter.createCaller(authCtx());
    await caller.generation.iterate({
      modelId: 7,
      feedback: "make the jawline broader",
      assetId: 100,
    });

    expect(iterateModelRaw).toHaveBeenCalledWith(
      expect.stringContaining("immutable snapshot prompt"),
      "https://r2/head.png",
      "make the jawline broader",
      expect.objectContaining({
        castingBrand: "Snapshot Brand",
        technicalSchema: { context: { casting_for: "Snapshot Brand" } },
      }),
    );
    expect(commitIteratedIdentitySnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        readMode: "snapshot",
        candidate: expect.objectContaining({ targetAssetId: 100 }),
      }),
    );
  });

  it("image-only: generation success + asset write failure ⇒ refund once (derived id), honest error", async () => {
    vi.mocked(createModelAsset).mockResolvedValue({ success: false } as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "brighten the lighting", assetId: 100 }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });
    expect(iterateModel).toHaveBeenCalledTimes(1);
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(addCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addCredits).mock.calls[0][4]).toBe(refundReferenceFor("op:11111111-1111-4111-8111-111111111111:charge"));
    expect(storageDelete).toHaveBeenCalledWith("iterate/i.png");
    expect(verifyIdentityEdit).not.toHaveBeenCalled();
  });

  it("createGeneration failure refuses BEFORE any deduction or image call", async () => {
    vi.mocked(createGeneration).mockResolvedValue({ success: false } as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "brighten the lighting", assetId: 100 }),
    ).rejects.toMatchObject({ message: expect.stringContaining("weren't charged") });
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
  });

  it("identity commit success + audit-row completion failure ⇒ the result STANDS, no refund", async () => {
    llmScript.classify = '{"kind":"identity","categories":["person.face.jawline"],"operations":{}}';
    vi.mocked(updateGeneration).mockResolvedValue({ success: false } as never);
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.iterate({ modelId: 7, feedback: "sharper jawline", assetId: 100 });
    expect(result.success).toBe(true);
    expect(iterateModelRaw).toHaveBeenCalledTimes(1);
    expect(result.assetId).toBe(888); // the committed anchor
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("identity gate rejects both candidates ⇒ no upload or commit, charge refunded once", async () => {
    llmScript.classify = '{"kind":"identity","categories":["person.face.jawline"],"operations":{}}';
    vi.mocked(verifyIdentityEdit).mockResolvedValue({
      ok: false,
      checked: true,
      violations: ["overall.facialIdentity"],
    });

    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "make the jawline sharper", assetId: 100 }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("refunded"),
    });

    expect(iterateModelRaw).toHaveBeenCalledTimes(2);
    expect(uploadRawCandidate).not.toHaveBeenCalled();
    expect(tx.inserts.some((row) => "provenance" in row)).toBe(false);
    expect(addCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addCredits).mock.calls[0][4]).toBe(refundReferenceFor("op:11111111-1111-4111-8111-111111111111:charge"));
    expect(updateGeneration).toHaveBeenCalledWith(11, expect.objectContaining({
      status: "failed",
      metadata: expect.objectContaining({
        identityGate: expect.objectContaining({ attemptCount: 2 }),
      }),
    }));
  });

  it("identity verifier unavailable after one re-check ⇒ one candidate, no upload, and truthful refund", async () => {
    llmScript.classify = '{"kind":"identity","categories":["person.face.jawline"],"operations":{}}';
    vi.mocked(verifyIdentityEdit).mockResolvedValue({ ok: false, checked: false, violations: [] });

    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "make the jawline sharper", assetId: 100 }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/couldn't be verified.*refunded/i),
    });

    expect(iterateModelRaw).toHaveBeenCalledTimes(1);
    expect(verifyIdentityEdit).toHaveBeenCalledTimes(2);
    expect(uploadRawCandidate).not.toHaveBeenCalled();
    expect(tx.inserts).toHaveLength(0);
    expect(addCredits).toHaveBeenCalledTimes(1);
  });
});

// ── castingImage boundaries ──────────────────────────────────────────────────

describe("generation.castingImage boundaries", () => {
  it("createGeneration failure after the deduction refunds once and stops before the image call", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([] as never); // initial cast
    vi.mocked(createGeneration).mockResolvedValue({ success: false } as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.castingImage({ modelId: 7 })).rejects.toMatchObject({
      message: expect.stringContaining("refunded"),
    });
    expect(generateCastingImage).not.toHaveBeenCalled();
    expect(addCredits).toHaveBeenCalledTimes(1);
    const refundRef = vi.mocked(addCredits).mock.calls[0][4] as string;
    expect(refundRef).toBe(refundReferenceFor("op:11111111-1111-4111-8111-111111111111:charge"));
  });

  it("initial-cast asset write failure refunds once with honest copy", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([] as never);
    vi.mocked(createModelAsset).mockResolvedValue({ success: false } as never);
    vi.mocked(generateCastingImage).mockResolvedValueOnce({
      imageUrl: "https://pub-test.r2.dev/x.png",
      storageKey: "casting/x.png",
      engineUsed: "test",
    } as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.castingImage({ modelId: 7 })).rejects.toMatchObject({
      message: expect.stringContaining("refunded"),
    });
    expect(addCredits).toHaveBeenCalledTimes(1);
    expect(storageDelete).toHaveBeenCalledWith("casting/x.png");
  });
});

// ── applyModelEdit: post-commit board failure; fork placement failure ───────

describe("applyModelEdit boundaries", () => {
  // FINAL correction 3: the identity commit and its required board landing
  // (node stamp + version row + downstream stale statuses) are ONE
  // transaction. Any landing failure rolls the whole identity change back —
  // the user is refunded honestly, and no committed-identity/stale-board
  // split state can survive. A server log alone is never the recovery.
  it("UPDATE success: the stamp, version row, and downstream stale statuses land INSIDE the identity transaction", async () => {
    vi.mocked(getEdgesFrom).mockResolvedValue([{ targetItemId: 9 }] as never);
    const result = await executeApplyModelEdit({
      userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" },
    });
    expect(result.decision).toBe("update");
    // anchor row + version row in the same recorded transaction
    expect(tx.inserts.some((i) => "provenance" in i)).toBe(true);
    expect(tx.inserts.some((i) => "version" in i && "itemId" in i)).toBe(true);
    // the node stamp and the downstream stale status are tx writes too
    expect(tx.updates.some((u) => "imageUrl" in u && "metadata" in u)).toBe(true);
    const staleWrite = tx.updates.find((u) => {
      const keys = Object.keys(u);
      return keys.length === 1 && keys[0] === "metadata";
    }) as { metadata: { status?: { type?: string } } } | undefined;
    expect(staleWrite?.metadata.status?.type).toBe("stale");
    expect(addCredits).not.toHaveBeenCalled();
  });

  it.each([
    ["hair color", { hairColor: "Copper" }],
    ["skin tone", { skinTone: "Ebony / Dark" }],
    ["face field", { jawline: "Sharp / Chiseled" }],
  ])("UPDATE %s is an intentional structured recast, not a surgical identity edit", async (_label, changes) => {
    const result = await executeApplyModelEdit({
      userId: 1,
      itemId: 3,
      decision: "update",
      changes,
    });

    expect(result.decision).toBe("update");
    expect(verifyIdentityEdit).not.toHaveBeenCalled();
    expect(generateCastingImageRaw).toHaveBeenCalledTimes(1);
    expect(uploadRawCandidate).toHaveBeenCalledTimes(1);
    expect(tx.inserts.some((row) => "provenance" in row)).toBe(true);
  });

  it("UPDATE recast never consults the same-person verifier, even when that verifier is forced to fail", async () => {
    vi.mocked(verifyIdentityEdit).mockResolvedValue({
      ok: false,
      checked: true,
      violations: ["person.skinTone"],
    });

    const result = await executeApplyModelEdit({
      userId: 1,
      itemId: 3,
      decision: "update",
      changes: { jawline: "Sharp / Chiseled" },
    });

    expect(result.decision).toBe("update");
    expect(verifyIdentityEdit).not.toHaveBeenCalled();
    expect(generateCastingImageRaw).toHaveBeenCalledTimes(1);
    expect(uploadRawCandidate).toHaveBeenCalledTimes(1);
    expect(addCredits).not.toHaveBeenCalled();
    expect(updateGeneration).toHaveBeenCalledWith(11, expect.objectContaining({
      status: "completed",
      metadata: expect.objectContaining({
        operationMode: "structured_recast",
      }),
    }));
  });

  it("UPDATE: version-row (second write) failure rolls back the WHOLE landing — refund recorded, honest message, no half state", async () => {
    tx.failVersionInsert = true; // inside the shared identity+landing tx
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });
    // refund recorded exactly once under the derived id
    expect(addCredits).toHaveBeenCalledTimes(1);
    const refundRef = vi.mocked(addCredits).mock.calls[0][4] as string;
    expect(refundRef.startsWith("refund:apply-edit-3-")).toBe(true);
    // the transaction never produced the version row
    expect(tx.inserts.some((i) => "version" in i && "itemId" in i)).toBe(false);
    expect(storageDelete).toHaveBeenCalledWith("casting/gated.png");
  });

  it("UPDATE: passing-candidate cleanup failure is logged but never blocks the refund", async () => {
    tx.failVersionInsert = true;
    vi.mocked(storageDelete).mockRejectedValueOnce(new Error("R2 unavailable"));

    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });

    expect(storageDelete).toHaveBeenCalledTimes(1);
    expect(addCredits).toHaveBeenCalledTimes(1);
  });

  it("UPDATE: upload failure clears the rejected NEW-mode model session even without a storage key", async () => {
    vi.mocked(uploadRawCandidate).mockRejectedValueOnce(new Error("R2 upload unavailable"));

    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });

    expect(generateCastingImageRaw).toHaveBeenCalledTimes(1);
    expect(storageDelete).not.toHaveBeenCalled();
    expect(clearCastingSession).toHaveBeenCalledWith("1", 7);
    expect(addCredits).toHaveBeenCalledTimes(1);
  });

  it("UPDATE: node-stamp failure rolls back the WHOLE landing the same way", async () => {
    tx.failStampUpdate = true;
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });
    expect(addCredits).toHaveBeenCalledTimes(1);
  });

  it("UPDATE: a downstream stale-status write failure is NEVER swallowed — it aborts the landing atomically", async () => {
    vi.mocked(getEdgesFrom).mockResolvedValue([{ targetItemId: 9 }] as never);
    tx.failStaleStatusUpdate = true;
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });
    expect(addCredits).toHaveBeenCalledTimes(1);
  });

  it("UPDATE landing failure: raw internal error text never reaches the client — the safe wording + refund truth do", async () => {
    tx.failVersionInsert = true; // mock throws Error("version insert failed")
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({
      message: expect.not.stringContaining("version insert failed"),
    });
  });

  it("RERUN (anchor re-roll) rides the same atomic landing: version failure ⇒ rollback + refund", async () => {
    tx.failVersionInsert = true;
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: {}, intent: "rerun" }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });
    expect(addCredits).toHaveBeenCalledTimes(1);
    expect(verifyIdentityEdit).not.toHaveBeenCalled();
    expect(generateCastingImageRaw).not.toHaveBeenCalled();
    expect(generateCastingImage).toHaveBeenCalledTimes(1);
    expect(storageDelete).toHaveBeenCalledWith("casting/x.png");
  });

  it("RECAST (rerun, empty changes) is an anchor re-roll, not a 'nothing to change' refusal", async () => {
    const result = await executeApplyModelEdit({
      userId: 1, itemId: 3, decision: "update", changes: {}, intent: "rerun",
    });
    expect(result.decision).toBe("update");
    // The shared re-roll commit ran: anchor insert + revision
    const anchorInserts = tx.inserts.filter((i) => "provenance" in i);
    expect(anchorInserts).toHaveLength(1);
    expect((anchorInserts[0].provenance as Record<string, unknown>).identityRole).toBe("anchor");
    expect(tx.updates.some((u) => typeof u.identityRevisionId === "string")).toBe(true);
    expect(deductPoints).toHaveBeenCalledTimes(1);
  });

  it("FORK: candidate success + placement failure ⇒ TYPED PARTIAL SUCCESS (correction 5): resolves placed:false, NO refund, names the library", async () => {
    tx.failBoardItemInsert = true; // the atomic placement's first write
    const result = await executeApplyModelEdit({
      userId: 1, itemId: 3, decision: "fork", changes: { jawline: "Sharp / Chiseled" },
    });
    // RESOLVES — never an error shape a client could retry into a second charge
    expect(result.decision).toBe("fork");
    expect((result as Record<string, unknown>).placed).toBe(false);
    expect((result as Record<string, unknown>).newItemId).toBeNull();
    expect(String((result as Record<string, unknown>).placementMessage)).toContain("model library");
    expect(addCredits).not.toHaveBeenCalled();
    // atomic placement: the failed landing wrote NO item, NO version, NO edge
    expect(tx.inserts.some((i) => "kind" in i)).toBe(false);
    expect(tx.inserts.some((i) => "relation" in i)).toBe(false);
  });

  it("FORK: placement's SECOND/THIRD write failure also rolls the whole placement back (correction 4)", async () => {
    tx.failVersionInsert = true; // item insert succeeds, v1 row fails → tx rolls back
    const result = await executeApplyModelEdit({
      userId: 1, itemId: 3, decision: "fork", changes: { jawline: "Sharp / Chiseled" },
    });
    expect((result as Record<string, unknown>).placed).toBe(false);
    expect(addCredits).not.toHaveBeenCalled();
    // no half-versioned / unlinked placement escaped the transaction
    expect(tx.inserts.some((i) => "relation" in i)).toBe(false);
  });

  it("FORK: candidate failure (asset write) ⇒ refund once, deterministic id", async () => {
    vi.mocked(createModelAsset).mockResolvedValue({ success: false } as never);
    await expect(
      executeApplyModelEdit({ userId: 1, itemId: 3, decision: "fork", changes: { jawline: "Sharp / Chiseled" } }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });
    expect(addCredits).toHaveBeenCalledTimes(1);
    const refundRef = vi.mocked(addCredits).mock.calls[0][4] as string;
    expect(refundRef.startsWith("refund:apply-edit-3-")).toBe(true);
  });
});

// ── runGeneration + variations boundaries ────────────────────────────────────

describe("canvas creation boundaries", () => {
  it("runGeneration: asset success + board stamp SECOND-write failure ⇒ success stands, NO refund, stamp atomic", async () => {
    tx.failVersionInsert = true;
    const result = await executeRunGeneration({ userId: 1, itemId: 3, userPrompt: "sharp editorial Nordic face" });
    expect(result.success).toBe(true);
    expect(addCredits).not.toHaveBeenCalled();
    // the failed stamp landed no version row (one transaction, all-or-nothing)
    expect(tx.inserts.some((i) => "version" in i && "itemId" in i)).toBe(false);
  });

  it("runGeneration: a node filled while Gemini ran is never overwritten or refunded", async () => {
    tx.fillResult = "not_empty";
    const result = await executeRunGeneration({ userId: 1, itemId: 3, userPrompt: "sharp editorial Nordic face" });
    expect(result).toMatchObject({ success: true, placed: false });
    expect(result.placementMessage).toContain("model library");
    expect(addCredits).not.toHaveBeenCalled();
    expect(tx.updates.some((values) => "imageUrl" in values)).toBe(false);
    expect(tx.inserts.some((values) => "version" in values && "itemId" in values)).toBe(false);
  });

  it("runGeneration: asset write failure ⇒ refund once, honest error", async () => {
    vi.mocked(createModelAsset).mockResolvedValue({ success: false } as never);
    await expect(
      executeRunGeneration({ userId: 1, itemId: 3, userPrompt: "sharp editorial Nordic face" }),
    ).rejects.toMatchObject({ message: expect.stringContaining("refunded") });
    expect(addCredits).toHaveBeenCalledTimes(1);
    const refundRef = vi.mocked(addCredits).mock.calls[0][4] as string;
    expect(refundRef.startsWith("refund:board-item-3-")).toBe(true);
  });

  it("variations: candidate success + placement failure ⇒ NO refund, failure entry names the library", async () => {
    tx.failBoardItemInsert = true;
    const result = await executeRunVariations({ userId: 1, itemId: 3, count: 1 });
    expect(result).toMatchObject({
      variations: [],
      creditCost: 350,
      failures: [
        {
          index: 0,
          message: expect.stringContaining("model library"),
          refunded: 0,
        },
      ],
    });
    expect(addCredits).not.toHaveBeenCalled();
    // atomic placement: no unlinked node or dangling edge escaped
    expect(tx.inserts.some((i) => "kind" in i)).toBe(false);
    expect(tx.inserts.some((i) => "relation" in i)).toBe(false);
  });

  it("variations: candidate failure ⇒ per-candidate refund with a per-candidate id", async () => {
    vi.mocked(createModelAsset).mockResolvedValue({ success: false } as never);
    await expect(executeRunVariations({ userId: 1, itemId: 3, count: 2 })).rejects.toThrow();
    expect(addCredits).toHaveBeenCalledTimes(2);
    const refs = vi.mocked(addCredits).mock.calls.map((c) => c[4] as string);
    expect(new Set(refs).size).toBe(2); // distinct per candidate
    for (const r of refs) expect(r.startsWith("refund:variations-3-")).toBe(true);
  });

  it("variations: an unrecorded refund stays a terminal failure, not a false library partial-success", async () => {
    vi.mocked(createModelAsset).mockResolvedValue({ success: false } as never);
    vi.mocked(addCredits).mockResolvedValue({ success: false, error: "ledger unavailable" } as never);
    await expect(executeRunVariations({ userId: 1, itemId: 3, count: 1 })).rejects.toMatchObject({
      message: expect.stringContaining("support"),
    });
    expect(addCredits).toHaveBeenCalledTimes(1);
  });

  it("variations: a mixed success/failure result is safe to persist as the parent operation receipt", async () => {
    vi.mocked(createModelAsset)
      .mockResolvedValueOnce({ success: false } as never)
      .mockResolvedValue({ success: true, assetId: 888 } as never);
    const result = await executeRunVariations({ userId: 1, itemId: 3, count: 2 });
    expect(result.variations).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(() => assertPublicOperationResult(result)).not.toThrow();
  });
});

// ── Public error sanitization (FINAL correction 2) ───────────────────────────
//
// Raw provider/database/SDK error text must never reach clients, failed-slot
// records, board cards, or toasts — while the truthful refund outcome always
// does. Deliberately written TRPCError/PublicError wording passes through.

const RAW_INTERNAL = "connect ECONNREFUSED 10.7.7.7 x-api-key=SECRET_TOKEN payload={\"contents\":[…]}";

describe("public error sanitization at the paid doors", () => {
  it("iterate: a raw internal generation error reaches the client as safe wording + refund truth", async () => {
    vi.mocked(iterateModel).mockRejectedValue(new Error(RAW_INTERNAL));
    const caller = appRouter.createCaller(authCtx());
    let message = "";
    try {
      await caller.generation.iterate({ modelId: 7, feedback: "brighten the lighting", assetId: 100 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain("SECRET_TOKEN");
    expect(message).not.toContain("ECONNREFUSED");
    expect(message).not.toContain("10.7.7.7");
    expect(message).toContain("refunded"); // the refund truth still travels
    expect(addCredits).toHaveBeenCalledTimes(1);
  });

  it("mint slot: a raw internal error never lands in the PUBLIC failed-slot record; refund truth does", async () => {
    vi.mocked(getModelAssets).mockResolvedValue(CORE_MINUS_ONE as never);
    vi.mocked(generateRemainingViews).mockRejectedValueOnce(new Error(RAW_INTERNAL));
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera", operationId: REQUEST_ID });
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].reason).toBe("Generation failed");
    expect(res.failed[0].refunded).toBeGreaterThan(0);
    // the durable marker (rendered on ViewTabs/CastNode) carries the safe wording
    const markerCall = vi.mocked(createModelAsset).mock.calls.at(-1)![0] as { status: { reason: string } };
    expect(markerCall.status.reason).toBe("Generation failed");
  });

  it("mint slot: deliberately written PublicError wording (identity gate) passes through", async () => {
    vi.mocked(getModelAssets).mockResolvedValue(CORE_MINUS_ONE as never);
    vi.mocked(generateRemainingViews).mockRejectedValueOnce(new PublicError("The engine rejected this request. Adjust the instruction and try again."));
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera", operationId: REQUEST_ID });
    expect(res.failed[0].reason).toBe("The engine rejected this request. Adjust the instruction and try again.");
  });

  it("applyModelEdit recast: a raw generation error is sanitized while the refund truth travels", async () => {
    vi.mocked(generateCastingImageRaw).mockRejectedValue(new Error(RAW_INTERNAL));
    let message = "";
    try {
      await executeApplyModelEdit({ userId: 1, itemId: 3, decision: "update", changes: { jawline: "Sharp / Chiseled" } });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain("SECRET_TOKEN");
    expect(message).toContain("The recast failed.");
    expect(message).toContain("refunded");
  });

  it("variations: per-candidate failure copy is sanitized and still carries the refund sentence", async () => {
    vi.mocked(generateCastingImage).mockRejectedValue(new Error(RAW_INTERNAL));
    let message = "";
    try {
      await executeRunVariations({ userId: 1, itemId: 3, count: 1 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain("SECRET_TOKEN");
    expect(message).toContain("Generation failed.");
    expect(message).toContain("refunded");
  });

  it("runGeneration: the board card's error status carries safe wording + refund truth, never internals", async () => {
    vi.mocked(generateCastingImage).mockRejectedValue(new Error(RAW_INTERNAL));
    await expect(
      executeRunGeneration({ userId: 1, itemId: 3, userPrompt: "sharp editorial Nordic face" }),
    ).rejects.toMatchObject({ message: expect.not.stringContaining("SECRET_TOKEN") });
    // the persisted node status (board card copy) is sanitized too
    const statusWrite = vi.mocked(updateBoardItem).mock.calls.find(
      (c) => ((c[1] as { metadata?: { status?: { message?: string } } }).metadata?.status?.message ?? "").length > 0,
    );
    expect(statusWrite).toBeDefined();
    const statusMessage = (statusWrite![1] as { metadata: { status: { message: string } } }).metadata.status.message;
    expect(statusMessage).not.toContain("SECRET_TOKEN");
    expect(statusMessage).toContain("Generation failed.");
    expect(statusMessage).toContain("refunded");
  });
});
