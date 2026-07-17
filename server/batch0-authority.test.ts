/**
 * Batch 0 — authority, security, and masked-edit closure (R6 execution plan,
 * post-review round: every assertion is behavioral, no placeholders).
 *
 * Unit halves of drive invariants E6–E10:
 *  - E6: models.update rejects status (strict input), name-only, write-checked
 *  - E7: the legacy nameless-mint procedure is gone
 *  - E8: archived reads as deleted (shared guard + query filter + board info)
 *  - E9: reconcile takes an owned assetId, strict input, no client URL
 *  - E10: masked submissions refused before any money moves
 * Plus review fixes: castingImage authorization-before-money (fix 1),
 * executeMintPackage name-write abort (fix 2), generatePdf legal-minted gate
 * (fix 6), getItemModelInfo archived degradation (fix 7).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getModelById: vi.fn(),
    getModelAssets: vi.fn(),
    getUserById: vi.fn(),
    getBoardById: vi.fn(),
    getBoardItemById: vi.fn(),
    getBoardItems: vi.fn(),
    getModelStatusesIn: vi.fn().mockResolvedValue(new Map()),
    updateModel: vi.fn().mockResolvedValue({ success: true }),
    mintModel: vi.fn().mockResolvedValue({ success: true }),
    deleteModel: vi.fn().mockResolvedValue({ success: true }),
    deductPoints: vi.fn().mockResolvedValue({ success: true }),
    createGeneration: vi.fn().mockResolvedValue({ success: true, generationId: 1 }),
    createModelAsset: vi.fn().mockResolvedValue({ success: true, assetId: 99 }),
  };
});
vi.mock("./db/dailyQuota", () => ({
  enforceDailyQuota: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./auditLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auditLog")>();
  return { ...actual, logAuditEvent: vi.fn().mockResolvedValue(true) };
});
vi.mock("./casting/aiService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/aiService")>();
  return {
    ...actual,
    reconcileSchemaWithImage: vi.fn().mockResolvedValue({ schema: { s: 1 }, description: "desc" }),
    generateCastingImage: vi.fn().mockResolvedValue({ imageUrl: "" }),
  };
});

import {
  getModelById,
  getModelAssets,
  getUserById,
  getBoardById,
  getBoardItemById,
  getBoardItems,
  getModelStatusesIn,
  updateModel,
  mintModel,
  deleteModel,
  deductPoints,
  createModelAsset,
} from "./db";
import { CREDIT_COSTS, generateCastingImage } from "./casting/aiService";
import { buildIdentityAnchor } from "./casting/geminiClient";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function authCtx(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthenticatedUser;
  return {
    user,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const model = (over: Record<string, unknown> = {}) => ({
  id: 7,
  userId: 1,
  name: "Test Draft",
  status: "draft",
  agencyId: null,
  mintedAt: null,
  masterPrompt: "prompt",
  technicalSchema: {},
  preferences: {},
  createdAt: new Date(),
  ...over,
});

const R2_BASE = process.env.R2_PUBLIC_URL || "https://pub-test.r2.dev";
const asset = (over: Record<string, unknown> = {}) => ({
  id: 42,
  modelId: 7,
  viewType: "frontFull",
  storageUrl: `${R2_BASE}/models/7/frontFull.png`,
  pinned: false,
  status: null,
  provenance: null,
  createdAt: new Date(),
  ...over,
});

// Batch C (§14): mint validity now checks revision membership per view —
// the fixture package carries the D-12 legacy fingerprint matching the model
// fixture's canon, so it reads as a healthy legacy package (the genesis case).
const FIXTURE_CANON = buildIdentityAnchor("prompt", {});
const ALL_SIX = ["frontClose", "threeQuarter", "sideClose", "frontFull", "sideFull", "backFull"].map(
  (vt, i) => asset({
    id: 100 + i,
    viewType: vt,
    storageUrl: `${R2_BASE}/models/7/${vt}.png`,
    provenance: { identityText: FIXTURE_CANON },
  }),
);

beforeEach(() => {
  vi.mocked(getModelById).mockReset();
  vi.mocked(getModelAssets).mockReset();
  vi.mocked(getUserById).mockReset();
  vi.mocked(getBoardById).mockReset();
  vi.mocked(getBoardItemById).mockReset();
  vi.mocked(getBoardItems).mockReset();
  vi.mocked(getModelStatusesIn).mockReset().mockResolvedValue(new Map());
  vi.mocked(updateModel).mockClear().mockResolvedValue({ success: true });
  vi.mocked(mintModel).mockClear().mockResolvedValue({ success: true });
  vi.mocked(deleteModel).mockClear().mockResolvedValue({ success: true });
  vi.mocked(deductPoints).mockClear().mockResolvedValue({ success: true });
  vi.mocked(createModelAsset).mockClear().mockResolvedValue({ success: true, assetId: 99 } as never);
  vi.mocked(generateCastingImage).mockClear();
});

// ─── E7: legacy mint route is gone ─────────────────────────────────────────

describe("legacy generation.mint (B0.2 bypass)", () => {
  it("no longer exists on the generation router", async () => {
    const { castingExportRouter } = await import("./routes/generation/castingExport");
    expect(castingExportRouter._def.procedures).not.toHaveProperty("mint");
  });
});

// ─── Review fix 1: castingImage — authorization before money ───────────────

describe("generation.castingImage authorization order (review fix 1)", () => {
  it("foreign model: FORBIDDEN, no deduction, no Gemini call, no asset", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ userId: 2 }) as never);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.generation.castingImage({ modelId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(generateCastingImage).not.toHaveBeenCalled();
    expect(createModelAsset).not.toHaveBeenCalled();
  });

  it("archived model: NOT_FOUND, no deduction, no asset", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.castingImage({ modelId: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(createModelAsset).not.toHaveBeenCalled();
  });

  it("minted model: PRECONDITION_FAILED (headshot is identity), no deduction, no asset", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF" }) as never,
    );
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.castingImage({ modelId: 7 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(generateCastingImage).not.toHaveBeenCalled();
    expect(createModelAsset).not.toHaveBeenCalled();
  });

  it("legacy locked model is treated as minted (refused, no money)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "locked" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.castingImage({ modelId: 7 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(deductPoints).not.toHaveBeenCalled();
  });
});

// ─── E6: models.update — strict, name-only, write-checked ──────────────────

describe("models.update (E6, review fix 3)", () => {
  it("status-only input is REJECTED (strict schema), nothing written", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.models.update({ modelId: 7, status: "active" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateModel).not.toHaveBeenCalled();
  });

  it("name plus status is REJECTED (unknown key), nothing written", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.models.update({ modelId: 7, name: "X", status: "draft" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateModel).not.toHaveBeenCalled();
  });

  it("valid draft rename succeeds", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.models.update({ modelId: 7, name: "Renamed" });
    expect(res.success).toBe(true);
    expect(updateModel).toHaveBeenCalledWith(7, { name: "Renamed" });
  });

  it("FR-3(B): valid minted rename succeeds (display metadata)", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.models.update({ modelId: 7, name: "New Display Name" });
    expect(res.success).toBe(true);
    expect(updateModel).toHaveBeenCalledWith(7, { name: "New Display Name" });
  });

  it("FR-4: archived rename refused as NOT_FOUND", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.models.update({ modelId: 7, name: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(updateModel).not.toHaveBeenCalled();
  });

  it("database write failure is an error, never success", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    vi.mocked(updateModel).mockResolvedValue({ success: false, error: "db down" });
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.models.update({ modelId: 7, name: "x" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

// ─── E8: archived reads as deleted ──────────────────────────────────────────

describe("archived exclusion (FR-4 / E8)", () => {
  it("models.get returns NOT_FOUND for an archived model", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.models.get({ modelId: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("generation.iterate refuses an archived model", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "brighten the lighting", assetId: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("assertNotArchived guard: archived throws, everything else passes", async () => {
    const { assertNotArchived } = await import("./casting/modelGuards");
    expect(() => assertNotArchived({ id: 1, status: "draft" })).not.toThrow();
    expect(() => assertNotArchived({ id: 1, status: "active" })).not.toThrow();
    expect(() => assertNotArchived({ id: 1, status: "locked" })).not.toThrow();
    expect(() => assertNotArchived(null)).not.toThrow();
    expect(() => assertNotArchived({ id: 1, status: "archived" })).toThrow(TRPCError);
  });

  it("boards.getItemModelInfo hides an archived source model but keeps the item snapshot (review fix 7 + item 2)", async () => {
    vi.mocked(getBoardItemById).mockResolvedValue({
      id: 11, boardId: 3, type: "model", label: "Vera", imageUrl: `${R2_BASE}/x.png`,
      metadata: {}, createdAt: new Date(), sourceModelId: 7, deletedAt: null,
    } as never);
    vi.mocked(getBoardById).mockResolvedValue({ id: 3, userId: 1, status: "active" } as never);
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.boards.getItemModelInfo({ itemId: 11 });
    expect(res.item.label).toBe("Vera");
    expect(res.model).toBeNull();
    expect(res.sourceArchived).toBe(true); // explicit signal — never conflated with an unlinked item
    expect(res.assetCount).toBe(0);
    expect(getModelAssets).not.toHaveBeenCalled();
  });

  it("boards.getItemModelInfo still returns a live source model", async () => {
    vi.mocked(getBoardItemById).mockResolvedValue({
      id: 11, boardId: 3, type: "model", label: "Vera", imageUrl: `${R2_BASE}/x.png`,
      metadata: {}, createdAt: new Date(), sourceModelId: 7, deletedAt: null,
    } as never);
    vi.mocked(getBoardById).mockResolvedValue({ id: 3, userId: 1, status: "active" } as never);
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    vi.mocked(getModelAssets).mockResolvedValue([asset()] as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.boards.getItemModelInfo({ itemId: 11 });
    expect(res.model?.id).toBe(7);
    expect(res.sourceArchived).toBe(false);
    expect(res.sourceDraft).toBe(true);
    expect(res.assetCount).toBe(1);
  });

  it("boards.getItemModelInfo degrades a hard-deleted source like archived", async () => {
    vi.mocked(getBoardItemById).mockResolvedValue({
      id: 11, boardId: 3, type: "model", label: "Deleted draft", imageUrl: `${R2_BASE}/x.png`,
      metadata: {}, createdAt: new Date(), sourceModelId: 7, deletedAt: null,
    } as never);
    vi.mocked(getBoardById).mockResolvedValue({ id: 3, userId: 1, status: "active" } as never);
    vi.mocked(getModelById).mockResolvedValue(null);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.boards.getItemModelInfo({ itemId: 11 });
    expect(res.model).toBeNull();
    expect(res.sourceArchived).toBe(true);
    expect(res.sourceDraft).toBe(false);
    expect(getModelAssets).not.toHaveBeenCalled();
  });

  it("boards.getItems flags placements whose source model is archived (review item 2)", async () => {
    vi.mocked(getBoardById).mockResolvedValue({ id: 3, userId: 1, status: "active" } as never);
    vi.mocked(getBoardItems).mockResolvedValue([
      { id: 1, boardId: 3, sourceModelId: 7, label: "Archived-sourced" },
      { id: 2, boardId: 3, sourceModelId: 8, label: "Live-sourced" },
      { id: 3, boardId: 3, sourceModelId: null, label: "Unlinked" },
      { id: 4, boardId: 3, sourceModelId: 9, label: "Draft-sourced" },
      { id: 5, boardId: 3, sourceModelId: 10, label: "Deleted-sourced" },
    ] as never);
    vi.mocked(getModelStatusesIn).mockResolvedValue(new Map([
      [7, "archived"],
      [8, "active"],
      [9, "draft"],
    ]));
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.boards.getItems({ boardId: 3 });
    expect(res.map((i) => [i.id, i.sourceArchived, i.sourceDraft])).toEqual([
      [1, true, false],
      [2, false, false],
      [3, false, false],
      [4, false, true],
      [5, true, false],
    ]);
    // Stored snapshot survives — the flag ADDS, it never strips
    expect(res[0].label).toBe("Archived-sourced");
  });

  it("boards.getItems clears every duplicate placement's Draft truth after one mint", async () => {
    vi.mocked(getBoardById).mockResolvedValue({ id: 3, userId: 1, status: "active" } as never);
    vi.mocked(getBoardItems).mockResolvedValue([
      { id: 1, boardId: 3, sourceModelId: 9, label: "Chelsea" },
      { id: 2, boardId: 3, sourceModelId: 9, label: "Chelsea" },
    ] as never);
    vi.mocked(getModelStatusesIn)
      .mockResolvedValueOnce(new Map([[9, "draft"]]))
      .mockResolvedValueOnce(new Map([[9, "active"]]));

    const caller = appRouter.createCaller(authCtx());
    expect((await caller.boards.getItems({ boardId: 3 })).map((item) => item.sourceDraft)).toEqual([true, true]);
    expect((await caller.boards.getItems({ boardId: 3 })).map((item) => item.sourceDraft)).toEqual([false, false]);
  });
});

// ─── Review item 1: mint-transition invariant ──────────────────────────────

describe("executeMintPackage mint-transition invariant (review item 1)", () => {
  it("mint request on an ACTIVE model fails closed — no assets read, no money, no rename, no mint", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    const { executeMintPackage } = await import("./casting/mintPackage");
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getModelAssets).not.toHaveBeenCalled();
    expect(deductPoints).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
    expect(mintModel).not.toHaveBeenCalled();
  });

  it("mint request on a legacy LOCKED model fails closed the same way", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "locked", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    const { executeMintPackage } = await import("./casting/mintPackage");
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getModelAssets).not.toHaveBeenCalled();
    expect(deductPoints).not.toHaveBeenCalled();
    expect(mintModel).not.toHaveBeenCalled();
  });

  it("a draft carrying a stray agencyId is INCONSISTENT — fails closed, never returns minted:true", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ agencyId: "MOD-26-STRAY0" }) as never);
    const { executeMintPackage } = await import("./casting/mintPackage");
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getModelAssets).not.toHaveBeenCalled();
    expect(deductPoints).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled();
    expect(mintModel).not.toHaveBeenCalled();
  });

  it("a draft carrying a stray mintedAt fails closed the same way", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ mintedAt: new Date() }) as never);
    const { executeMintPackage } = await import("./casting/mintPackage");
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(mintModel).not.toHaveBeenCalled();
  });

  it("UPGRADE (mint:false) on a minted model adds views WITHOUT rename or mintModel and reports minted honestly", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    vi.mocked(getModelAssets).mockResolvedValue(ALL_SIX as never);
    const { executeMintPackage } = await import("./casting/mintPackage");
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "", mint: false });
    expect(res.minted).toBe(true); // honest: the model IS minted
    expect(updateModel).not.toHaveBeenCalled();
    expect(mintModel).not.toHaveBeenCalled();
  });

  it("mint:false nickname on a MINTED model never renames (nicknames are a draft affordance)", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    vi.mocked(getModelAssets).mockResolvedValue(ALL_SIX as never);
    const { executeMintPackage } = await import("./casting/mintPackage");
    await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Sneaky Rename", mint: false });
    expect(updateModel).not.toHaveBeenCalled();
  });
});

// ─── Review item 3 / founder ruling: models.delete is drafts-only ──────────

describe("models.delete drafts-only (founder ruling, review item 9)", () => {
  it("a draft hard-deletes successfully", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.models.delete({ modelId: 7 });
    expect(res.success).toBe(true);
    expect(deleteModel).toHaveBeenCalledWith(7);
  });

  it("a minted model refuses deletion", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF" }) as never,
    );
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.models.delete({ modelId: 7 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(deleteModel).not.toHaveBeenCalled();
  });

  it("a legacy locked model refuses deletion", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "locked" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.models.delete({ modelId: 7 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(deleteModel).not.toHaveBeenCalled();
  });

  it("an archived model reads as deleted (NOT_FOUND)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.models.delete({ modelId: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deleteModel).not.toHaveBeenCalled();
  });

  it("foreign ownership refuses deletion", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ userId: 2 }) as never);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(caller.models.delete({ modelId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deleteModel).not.toHaveBeenCalled();
  });

  it("a database delete failure is an error, never success", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    vi.mocked(deleteModel).mockResolvedValue({ success: false, error: "db down" });
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.models.delete({ modelId: 7 })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

// ─── E9: reconcile — owned asset id, strict input, write-checked ───────────

describe("generation.reconcile — DISABLED (Batch C, R7 ratified: keep off; M4)", () => {
  it("legacy imageUrl input is still REJECTED by the strict schema", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.reconcile({ modelId: 7, imageUrl: "https://evil.example/x.png" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getModelById).not.toHaveBeenCalled();
  });

  it("imageUrl alongside a valid assetId is still REJECTED (strict)", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.reconcile({ modelId: 7, assetId: 42, imageUrl: "https://evil.example/x.png" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("a well-formed request refuses on EVERY status — no path writes the document from an image", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      for (const m of [model(), model({ status: "active", agencyId: "MOD-26-ABCDEF" }), model({ status: "archived" })]) {
        vi.mocked(getModelById).mockResolvedValue(m as never);
        const caller = appRouter.createCaller(authCtx());
        await expect(caller.generation.reconcile({ modelId: 7, assetId: 42 })).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: expect.stringContaining("reconcile is off"),
        });
      }
      // The disabled procedure touches NOTHING: no asset read, no fetch, no write
      expect(getModelAssets).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(updateModel).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("compactPrompt refuses a minted model (same sealed-document boundary)", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF" }) as never,
    );
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.compactPrompt({ modelId: 7 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});

// ─── E10: masked submissions refused before money moves ────────────────────

describe("masked-edit closure (Batch 0.1 / E10)", () => {
  it("iterate refuses any request carrying maskBase64, before touching the model", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({
        modelId: 7,
        feedback: "FIX ARTIFACT: Remove the content in the masked area.",
        assetId: 1,
        maskBase64: "data:image/png;base64,AAAA",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getModelById).not.toHaveBeenCalled();
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("the board masked-edit surface is gone (ModelEditorOverlay + useBoardIteration deleted)", async () => {
    const fs = await import("node:fs");
    expect(fs.existsSync("client/src/features/boards/overlays/ModelEditorOverlay.tsx")).toBe(false);
    expect(fs.existsSync("client/src/features/boards/hooks/useBoardIteration.ts")).toBe(false);
  });
});

// ─── Review fix 2: executeMintPackage name persistence ─────────────────────

describe("executeMintPackage name guard + name persistence (review fix 2)", () => {
  it("refuses a nameless mint before loading the model", async () => {
    const { executeMintPackage } = await import("./casting/mintPackage");
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "  " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getModelById).not.toHaveBeenCalled();
  });

  it("stays-draft (mint:false) does not require a name at the guard", async () => {
    vi.mocked(getModelById).mockResolvedValue(null as never);
    const { executeMintPackage } = await import("./casting/mintPackage");
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "", mint: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getModelById).toHaveBeenCalled();
  });

  it("if the required name write fails, the mint ABORTS and mintModel is never called", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    vi.mocked(getModelAssets).mockResolvedValue(ALL_SIX as never); // full package → zero generation cost
    vi.mocked(updateModel).mockResolvedValue({ success: false, error: "db down" });
    const { executeMintPackage } = await import("./casting/mintPackage");
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "  Vera  " }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(updateModel).toHaveBeenCalledWith(7, { name: "Vera" }); // trimmed at the boundary
    expect(mintModel).not.toHaveBeenCalled();
  });

  it("happy path: trimmed name persists, then mintModel runs", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    vi.mocked(getModelAssets).mockResolvedValue(ALL_SIX as never);
    const { executeMintPackage } = await import("./casting/mintPackage");
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: " Vera " });
    expect(res.minted).toBe(true);
    expect(updateModel).toHaveBeenCalledWith(7, { name: "Vera" });
    expect(mintModel).toHaveBeenCalledTimes(1);
  });
});

// ─── Review fix 6: generatePdf legal-minted gate (FR-2A) ───────────────────

describe("generatePdf minted gate (FR-2A, review fix 6)", () => {
  const pdfInput = { modelId: 7, modelName: "TEST", images: {} };

  it("ordinary draft: refused", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("draft carrying a stray agencyId: still a draft, refused", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ agencyId: "MOD-26-ABCDEF" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("active without agencyId: inconsistent row, refused", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "active", agencyId: null }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("archived (even with agencyId): NOT_FOUND — deleted, not a mint hint", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "archived", agencyId: "MOD-26-ABCDEF" }) as never,
    );
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("valid active model: PDF generates", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    vi.mocked(getUserById).mockResolvedValue({
      id: 1, openId: "test-user-1", name: "Owner", displayName: "Owner",
    } as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.generation.generatePdf(pdfInput);
    expect(res.success).toBe(true);
    expect(res.pdfBase64).toBeTruthy();
  });

  it("valid legacy locked model: PDF generates (locked = minted alias)", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "locked", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    vi.mocked(getUserById).mockResolvedValue({
      id: 1, openId: "test-user-1", name: "Owner", displayName: "Owner",
    } as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.generation.generatePdf(pdfInput);
    expect(res.success).toBe(true);
  });
});

describe("W1 export plan price authority", () => {
  it("counts current filled canonical slots and prices 2K from the server upscale constant", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    vi.mocked(getModelAssets).mockResolvedValue(ALL_SIX as never);
    const caller = appRouter.createCaller(authCtx());
    const plan = await caller.generation.exportPlan({ modelId: 7 });
    expect(plan.viewCount).toBe(6);
    expect(plan.tiers["1K"].totalCost).toBe(0);
    expect(plan.tiers["2K"]).toMatchObject({ unitCost: CREDIT_COSTS.upscale, totalCost: 6 * CREDIT_COSTS.upscale });
  });
});
