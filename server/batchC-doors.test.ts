/**
 * Batch C — door-by-door router/lib harness beyond iterate:
 *  - M10 castingImage: creation reference schema-REJECTED; initial headshot
 *    stamps anchor+genesis; a re-roll is an identity-changing anchor
 *    operation (new revision + stale flags PINNED INCLUDED, atomically);
 *    guard-order regressions hold.
 *  - M22 models.create: reference schema-rejected; presentation and
 *    cosmetic-lash briefs refuse BEFORE any save; natural-lash and ink
 *    briefs pass.
 *  - M5 compactPrompt: a rewrite that drops protected mark language is
 *    rejected and the raw text kept.
 *  - M7/M8/M9 (lib): mint integrity refuses before deduction; slot
 *    generation consumes the AUTHORITATIVE anchor (not a newer display
 *    headshot); a mid-mint slot failure aborts the mint transition; the
 *    filled-package retry mints free (M20); add-views and refresh stamp the
 *    current revision.
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

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getModelById: vi.fn(),
    getModelAssets: vi.fn(),
    createModel: vi.fn().mockResolvedValue({ success: true, modelId: 77 }),
    createGeneration: vi.fn().mockResolvedValue({ success: true, generationId: 11 }),
    updateGeneration: vi.fn().mockResolvedValue({ success: true }),
    updateModel: vi.fn().mockResolvedValue({ success: true }),
    mintModelAtomically: vi.fn().mockResolvedValue({ success: true }),
    bindGenerationOperationModel: vi.fn().mockResolvedValue(undefined),
    markGenerationOperationRunning: vi.fn().mockResolvedValue({ operationId: "11111111-1111-4111-8111-111111111111", chargeReferenceId: "op:11111111-1111-4111-8111-111111111111:charge" }),
    createModelAsset: vi.fn().mockResolvedValue({ success: true, assetId: 501 }),
    markModelAssetsStale: vi.fn().mockResolvedValue({ success: true }),
    deductPoints: vi.fn().mockResolvedValue({ success: true }),
    deductCredits: vi.fn().mockResolvedValue({ success: true }),
    addCredits: vi.fn().mockResolvedValue({ success: true }),
  };
});
vi.mock("./db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db/connection")>();
  const makeTx = () => ({
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
    generateMasterPrompt: vi.fn().mockResolvedValue({ naturalDescription: "desc", technicalSchema: {} }),
    generateCastingImage: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/casting/new.png", engineUsed: "test" }),
    generateFullBody: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/fullbody/new.png", engineUsed: "test" }),
    generateRemainingViews: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/view/new.png", engineUsed: "test" }),
    compactMasterPrompt: vi.fn(),
  };
});
vi.mock("./casting/backViewGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/backViewGate")>();
  return { ...actual, verifyViewIdentity: vi.fn().mockResolvedValue({ ok: true }) };
});
vi.mock("./casting/directOperation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/directOperation")>();
  return {
    ...actual,
    beginDirectOperation: vi.fn().mockResolvedValue({ type: "execute", operationId: "11111111-1111-4111-8111-111111111111" }),
    completeDirectOperationSuccess: vi.fn().mockResolvedValue(undefined),
    completeDirectOperationFailure: vi.fn(async ({ error }: { error: unknown }) => { throw error; }),
    failClaimedDirectOperation: vi.fn(async ({ error }: { error: unknown }) => { throw error; }),
    requireDirectOperationRecovery: vi.fn(async ({ cause }: { cause: unknown }) => { throw cause; }),
  };
});

import {
  getModelById,
  getModelAssets,
  createModel,
  createModelAsset,
  updateModel,
  mintModelAtomically,
  deductPoints,
  deductCredits,
  addCredits,
  createGeneration,
} from "./db";
import {
  generateMasterPrompt,
  generateCastingImage,
  generateRemainingViews,
  compactMasterPrompt,
} from "./casting/aiService";
import { buildIdentityAnchor } from "./casting/geminiClient";
import { executeMintPackage, executeRestoreSlotVersion } from "./casting/mintPackage";
import { executeRefreshSlots } from "./casting/refreshSlots";
import { REFUSAL_COPY } from "./casting/identity/refusalCopy";
import { appRouter as productionRouter } from "./routers";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const appRouter = {
  createCaller(ctx: TrpcContext) {
    const caller = productionRouter.createCaller(ctx);
    return {
      ...caller,
      models: {
        ...caller.models,
        create: (input: any) => caller.models.create({ clientRequestId: REQUEST_ID, ...input }),
      },
      generation: {
        ...caller.generation,
        castingImage: (input: any) => caller.generation.castingImage({ clientRequestId: REQUEST_ID, ...input }),
        compactPrompt: (input: any) => caller.generation.compactPrompt({ clientRequestId: REQUEST_ID, ...input }),
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
  masterPrompt: "prompt", technicalSchema: {}, preferences: {}, identityRevisionId: null,
  createdAt: new Date(), ...over,
});
const CANON = buildIdentityAnchor("prompt", {});
const asset = (over: Record<string, unknown> = {}) => ({
  id: 100, modelId: 7, viewType: "frontClose", storageUrl: "https://r2/head.png",
  pinned: false, status: null, provenance: { identityText: CANON }, createdAt: new Date(), ...over,
});

beforeEach(() => {
  vi.mocked(getModelById).mockReset().mockResolvedValue(model() as never);
  vi.mocked(getModelAssets).mockReset().mockResolvedValue([] as never);
  vi.mocked(createModel).mockClear().mockResolvedValue({ success: true, modelId: 77 } as never);
  vi.mocked(createModelAsset).mockClear().mockResolvedValue({ success: true, assetId: 501 } as never);
  vi.mocked(updateModel).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(mintModelAtomically).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(deductPoints).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(deductCredits).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(addCredits).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(createGeneration).mockClear().mockResolvedValue({ success: true, generationId: 11 } as never);
  vi.mocked(generateMasterPrompt).mockReset().mockResolvedValue({ naturalDescription: "desc", technicalSchema: {} } as never);
  vi.mocked(generateCastingImage).mockReset().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/casting/new.png", engineUsed: "test" } as never);
  vi.mocked(generateRemainingViews).mockReset().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/view/new.png", engineUsed: "test" } as never);
  vi.mocked(compactMasterPrompt).mockReset();
  tx.reset();
});

// ─── M10: castingImage ───────────────────────────────────────────────────────

describe("generation.castingImage (M10)", () => {
  it("a creation reference is schema-REJECTED before anything runs (§10.3)", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.castingImage({ modelId: 7, referenceImage: "data:image/png;base64,AAAA" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getModelById).not.toHaveBeenCalled();
    expect(deductPoints).not.toHaveBeenCalled();
    expect(generateCastingImage).not.toHaveBeenCalled();
  });

  it("INITIAL headshot on an empty draft: anchor role + genesis revision, no stale flags, no re-roll tx", async () => {
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.castingImage({ modelId: 7 });
    expect(result.success).toBe(true);
    expect(createModelAsset).toHaveBeenCalledTimes(1);
    const row = vi.mocked(createModelAsset).mock.calls[0][0] as { provenance: Record<string, unknown> };
    expect(row.provenance.identityRole).toBe("anchor");
    expect(row.provenance.identityRevisionId).toBe("genesis");
    expect(tx.assetInserts).toEqual([]); // no transactional re-roll path
    expect(tx.staleUpdates).toEqual([]);
  });

  it("RE-ROLL (R4): new anchor + NEW revision + stale flags PINNED INCLUDED, in one transaction", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([
      asset({ id: 1 }),
      asset({ id: 2, viewType: "sideClose", storageUrl: "https://r2/side.png", pinned: true }),
      asset({ id: 3, viewType: "frontFull", storageUrl: "https://r2/body.png" }),
    ] as never);
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.castingImage({ modelId: 7 });
    expect(result.success).toBe(true);
    // Everything landed inside the transaction
    expect(tx.assetInserts).toHaveLength(1);
    const anchorRow = tx.assetInserts[0] as { provenance: Record<string, unknown> };
    expect(anchorRow.provenance.identityRole).toBe("anchor");
    expect(String(anchorRow.provenance.identityRevisionId)).toMatch(/^rev-/);
    expect(tx.modelUpdates).toHaveLength(1); // models.identityRevisionId
    expect(String(tx.modelUpdates[0].identityRevisionId)).toMatch(/^rev-/);
    expect(tx.staleUpdates).toHaveLength(1); // sideClose (pinned!) + frontFull staled together
    expect(createModelAsset).not.toHaveBeenCalled(); // not the non-tx path
  });

  it("guard-order regression: minted refuses before deduction", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "active", agencyId: "MOD-1" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.castingImage({ modelId: 7 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(generateCastingImage).not.toHaveBeenCalled();
  });
});

// ─── M22: models.create ──────────────────────────────────────────────────────

describe("models.create intake (M22)", () => {
  it("referenceImage is schema-REJECTED, never silently ignored (§10.3)", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.models.create({ preferences: { referenceImage: "data:image/png;base64,AAAA" } as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createModel).not.toHaveBeenCalled();
  });

  it("presentation language in the brief refuses BEFORE any save — no silent stripping", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.models.create({ preferences: { userPrompt: "a girl in a red dress" } }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.creationPresentation });
    expect(generateMasterPrompt).not.toHaveBeenCalled();
    expect(createModel).not.toHaveBeenCalled();
  });

  it("cosmetic-lash creation language refuses before save; natural lash anatomy passes (§5.2)", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.models.create({ preferences: { features: "heavy mascara" } }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.creationCosmeticLash });
    expect(createModel).not.toHaveBeenCalled();

    const ok = await caller.models.create({ preferences: { features: "naturally long, dense lashes" } });
    expect(ok.success).toBe(true);
    expect(createModel).toHaveBeenCalledTimes(1);
  });

  it("brief-time ink marks remain valid input (R6)", async () => {
    const caller = appRouter.createCaller(authCtx());
    const ok = await caller.models.create({ preferences: { features: "a fine-line rose tattoo on the shoulder" } });
    expect(ok.success).toBe(true);
  });

  it("stores Open-choice authority but never sends it to intake or Gemini", async () => {
    const caller = appRouter.createCaller(authCtx());
    const ok = await caller.models.create({
      preferences: {
        gender: "Female",
        engineChoice: { gender: true, eyeColor: true },
      },
    });

    expect(ok.success).toBe(true);
    expect(generateMasterPrompt).toHaveBeenCalledWith({ gender: "Female" });
    expect(createModel).toHaveBeenCalledWith(expect.objectContaining({
      preferences: {
        gender: "Female",
        engineChoice: { gender: true, eyeColor: true },
      },
    }));
  });
});

// ─── M5: compactPrompt protected-language guard ──────────────────────────────

describe("generation.compactPrompt guard (M5)", () => {
  it("a rewrite that drops mark language is REJECTED — raw text kept, nothing written", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ masterPrompt: "She has a rose tattoo and light freckles." }) as never,
    );
    vi.mocked(compactMasterPrompt).mockResolvedValue("A clean editorial model." as never);
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.compactPrompt({ modelId: 7 });
    expect(result.masterPrompt).toBe("She has a rose tattoo and light freckles.");
    expect((result as Record<string, unknown>).protectedLanguageKept).toBe(true);
    expect(updateModel).not.toHaveBeenCalled();
  });

  it("a rewrite that keeps every mark family is accepted and written", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ masterPrompt: "She has a rose tattoo and light freckles." }) as never,
    );
    vi.mocked(compactMasterPrompt).mockResolvedValue("Editorial; rose tattoo; faint freckles." as never);
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.compactPrompt({ modelId: 7 });
    expect(result.masterPrompt).toBe("Editorial; rose tattoo; faint freckles.");
    expect(updateModel).toHaveBeenCalledWith(7, { masterPrompt: "Editorial; rose tattoo; faint freckles." });
  });
});

// ─── M7/M8/M9/M20: mint integrity, anchor consumption, revision stamps ──────

describe("executeMintPackage §14 integrity (M7) + anchor consumption (M21)", () => {
  it("a STALE anchor refuses the mint BEFORE any deduction, with the anchor copy", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([asset({ status: { state: "stale" } })] as never);
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "draft", characterName: "Vera" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.mintAnchorInvalid });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(mintModelAtomically).not.toHaveBeenCalled();
  });

  it("M7 case 1+2: a same-revision display headshot over an older anchor PASSES, and slot generation consumes the ANCHOR", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([
      asset({ id: 2, storageUrl: "https://r2/display.png", provenance: { identityRole: "display", identityText: CANON } }),
      asset({ id: 1, storageUrl: "https://r2/anchor.png", provenance: { identityRole: "anchor", identityText: CANON } }),
    ] as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" });
    expect(res.minted).toBe(true);
    // Every mint-time slot generated from the AUTHORITATIVE anchor, not the display row
    for (const call of vi.mocked(generateRemainingViews).mock.calls) {
      expect(call[1]).toBe("https://r2/anchor.png");
    }
  });

  it("a stale PINNED tier view refuses with the unpin-and-refresh copy", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([
      asset({ id: 1 }),
      asset({ id: 2, viewType: "threeQuarter", storageUrl: "https://r2/tq.png", pinned: true, status: { state: "stale" } }),
    ] as never);
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("unpin") });
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("a CROSS-REVISION tier view refuses before money", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ identityRevisionId: "rev-2" }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([
      asset({ id: 1, provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } }),
      asset({ id: 2, viewType: "threeQuarter", storageUrl: "https://r2/tq.png", provenance: { identityRevisionId: "rev-1" } }),
    ] as never);
    await expect(
      executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deductPoints).not.toHaveBeenCalled();
  });

  it("M8 ⊕: add-views (mint:false) consumes the anchor and stamps outputs with the CURRENT revision", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ identityRevisionId: "rev-2" }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([
      asset({ id: 1, provenance: { identityRole: "anchor", identityRevisionId: "rev-2" } }),
    ] as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "", mint: false });
    expect(res.minted).toBe(false);
    expect(res.generated.length).toBeGreaterThan(0);
    for (const call of vi.mocked(createModelAsset).mock.calls) {
      const prov = (call[0] as { provenance: Record<string, unknown> }).provenance;
      expect(prov.identityRole).toBe("display");
      expect(prov.identityRevisionId).toBe("rev-2");
    }
  });

  it("M20: a mid-mint slot failure ABORTS the transition — refund once, mint not taken, views kept", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([asset({ id: 1 })] as never);
    vi.mocked(generateRemainingViews).mockRejectedValue(new Error("engine down"));
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" });
    expect(res.minted).toBe(false);
    expect((res as Record<string, unknown>).mintAborted).toBe(true);
    expect(res.failed.length).toBeGreaterThan(0);
    expect(mintModelAtomically).not.toHaveBeenCalled();
    expect(updateModel).not.toHaveBeenCalled(); // no name write on an aborted transition
    // Each failed slot refunded exactly once, named
    expect(addCredits).toHaveBeenCalledTimes(res.failed.length);
  });

  it("M20: the filled-package mint-transition retry is FREE of generation charges", async () => {
    const full = ["frontClose", "threeQuarter", "sideClose", "frontFull", "sideFull", "backFull"].map((vt, i) =>
      asset({ id: 100 + i, viewType: vt, storageUrl: `https://r2/${vt}.png` }),
    );
    vi.mocked(getModelAssets).mockResolvedValue(full as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "core", characterName: "Vera" });
    expect(res.minted).toBe(true);
    expect(deductPoints).not.toHaveBeenCalled(); // zero missing ⇒ zero deduction
    expect(mintModelAtomically).toHaveBeenCalledTimes(1);
  });
});

describe("executeRefreshSlots consumes the §7 anchor (M9)", () => {
  it("regenerates from the AUTHORITATIVE anchor even when a newer display headshot exists, stamping the current revision", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ identityRevisionId: "rev-3" }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([
      asset({ id: 3, storageUrl: "https://r2/display.png", provenance: { identityRole: "display", identityRevisionId: "rev-3" } }),
      asset({ id: 2, storageUrl: "https://r2/anchor.png", provenance: { identityRole: "anchor", identityRevisionId: "rev-3" } }),
      asset({ id: 1, viewType: "threeQuarter", storageUrl: "https://r2/tq.png", provenance: { identityRevisionId: "rev-3" } }),
    ] as never);
    const res = await executeRefreshSlots({ userId: 1, modelId: 7, angles: ["threeQuarter"] });
    expect(res.refreshed).toHaveLength(1);
    expect(vi.mocked(generateRemainingViews).mock.calls[0][1]).toBe("https://r2/anchor.png");
    const prov = (vi.mocked(createModelAsset).mock.calls[0][0] as { provenance: Record<string, unknown> }).provenance;
    expect(prov.identityRevisionId).toBe("rev-3");
  });
});

// ─── M13 router leg: restore is free and revision-gated end to end ──────────

describe("executeRestoreSlotVersion stays free (M13/M20)", () => {
  it("a compatible restore moves no money", async () => {
    vi.mocked(getModelAssets).mockResolvedValue([
      asset({ id: 2, viewType: "threeQuarter", storageUrl: "https://r2/tq-2.png", provenance: { identityText: CANON } }),
      asset({ id: 1, viewType: "threeQuarter", storageUrl: "https://r2/tq-1.png", provenance: { identityText: CANON } }),
    ] as never);
    await executeRestoreSlotVersion({ userId: 1, modelId: 7, angle: "threeQuarter", assetId: 1 });
    expect(deductPoints).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
    const row = vi.mocked(createModelAsset).mock.calls[0][0] as { pointsCost: number };
    expect(row.pointsCost).toBe(0);
  });
});
