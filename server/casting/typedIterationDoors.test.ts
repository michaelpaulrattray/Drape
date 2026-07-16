/**
 * V1+V14 (R6 Batch A-coupled) — the six typed-iteration doors at the router.
 *
 * Proves, over the real generation.iterate procedure (appRouter caller, db
 * and Gemini mocked at their module boundaries):
 *  - ALL SIX canonical angles reach ordinary typed iteration — no three-view
 *    allowlist survives anywhere in the request path;
 *  - each angle's request hands the REAL iterateModel call the frame from
 *    the exhaustive canonical map (close trio HEADSHOT, body trio FULL_BODY);
 *  - a non-canonical stored viewType refuses BEFORE any generation record,
 *    deduction, or image call — it never silently defaults to a frame;
 *  - every non-angle gate is preserved: masked refusal (Batch 0), ownership,
 *    archived exclusion (FR-4), the D-43 minted identity seal, and the F6
 *    draft stale-writer (which marks siblings — it does not regenerate them;
 *    typed iteration has no propagation).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    getModelById: vi.fn(),
    getModelAssets: vi.fn(),
    createGeneration: vi.fn().mockResolvedValue({ success: true, generationId: 11 }),
    updateGeneration: vi.fn().mockResolvedValue({ success: true }),
    updateModel: vi.fn().mockResolvedValue({ success: true }),
    createModelAsset: vi.fn().mockResolvedValue({ success: true, assetId: 501 }),
    markModelAssetsStale: vi.fn().mockResolvedValue({ success: true }),
    deductCredits: vi.fn().mockResolvedValue({ success: true }),
    addCredits: vi.fn().mockResolvedValue({ success: true }),
  };
});
vi.mock("../db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/connection")>();
  return { ...actual, getDb: vi.fn().mockResolvedValue(null) };
});
vi.mock("../db/dailyQuota", () => ({
  enforceDailyQuota: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../security/rateLimit")>();
  return { ...actual, checkRateLimit: vi.fn().mockReturnValue({ allowed: true }) };
});
vi.mock("./aiService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./aiService")>();
  return {
    ...actual,
    iterateModel: vi.fn().mockResolvedValue({
      imageUrl: "https://pub-test.r2.dev/iterate/new.png",
      engineUsed: "test",
    }),
    updateSchemaForIteration: vi.fn().mockResolvedValue({ updated: true }),
    compactMasterPrompt: vi.fn().mockResolvedValue("compacted"),
  };
});
vi.mock("./editClassifier", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./editClassifier")>();
  return {
    ...actual,
    classifyEditIdentityImpact: vi.fn().mockResolvedValue({ identityLevel: false, checked: true }),
  };
});

import {
  getModelById,
  getModelAssets,
  createGeneration,
  createModelAsset,
  markModelAssetsStale,
  deductCredits,
} from "../db";
import { iterateModel } from "./aiService";
import { classifyEditIdentityImpact } from "./editClassifier";
import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";
import { ITERATION_CROP_BY_VIEW } from "./iterationFraming";
import { appRouter } from "../routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function authCtx(userId = 1): TrpcContext {
  const user = {
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
  masterPrompt: "master prompt",
  technicalSchema: {},
  preferences: {},
  createdAt: new Date(),
  ...over,
});

const R2_BASE = "https://pub-test.r2.dev";
const SIX_ASSETS = CANONICAL_VIEW_ANGLES.map((vt, i) => ({
  id: 100 + i,
  modelId: 7,
  viewType: vt,
  storageUrl: `${R2_BASE}/models/7/${vt}.png`,
  pinned: false,
  status: null,
  provenance: null,
  createdAt: new Date(),
}));
const assetIdFor = (vt: string) => SIX_ASSETS.find((a) => a.viewType === vt)!.id;

beforeEach(() => {
  vi.mocked(getModelById).mockReset().mockResolvedValue(model() as never);
  vi.mocked(getModelAssets).mockReset().mockResolvedValue(SIX_ASSETS as never);
  vi.mocked(createGeneration).mockClear().mockResolvedValue({ success: true, generationId: 11 } as never);
  vi.mocked(createModelAsset).mockClear().mockResolvedValue({ success: true, assetId: 501 } as never);
  vi.mocked(markModelAssetsStale).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(deductCredits).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(iterateModel).mockClear().mockResolvedValue({
    imageUrl: "https://pub-test.r2.dev/iterate/new.png",
    engineUsed: "test",
  } as never);
  vi.mocked(classifyEditIdentityImpact)
    .mockReset()
    .mockResolvedValue({ identityLevel: false, checked: true } as never);
});

// ─── All six doors open, each with the mapped frame ─────────────────────────

describe("typed iteration reaches every canonical view with the complete typed framing", () => {
  it.each(CANONICAL_VIEW_ANGLES.map((a) => [a, ITERATION_CROP_BY_VIEW[a]] as const))(
    "%s iterates successfully and hands iterateModel crop %s plus its own canonical angle",
    async (angle, expectedCrop) => {
      const caller = appRouter.createCaller(authCtx());
      const result = await caller.generation.iterate({
        modelId: 7,
        feedback: "brighten the lighting",
        assetId: assetIdFor(angle),
      });
      expect(result.success).toBe(true);
      expect(iterateModel).toHaveBeenCalledTimes(1);
      const [, sourceUrl, , options] = vi.mocked(iterateModel).mock.calls[0];
      expect(sourceUrl).toBe(`${R2_BASE}/models/7/${angle}.png`);
      // The COMPLETE typed framing travels: crop class AND the canonical
      // angle that selects the orientation-preservation directive (V14) —
      // never the crop token alone.
      expect(options?.frame).toBe(expectedCrop);
      expect(options?.viewAngle).toBe(angle);
      // Money moved exactly once, and only after the frame resolved
      expect(deductCredits).toHaveBeenCalledTimes(1);
    },
  );
});

// ─── Fail-safe: non-canonical stored viewType refuses before money ──────────

describe("non-canonical stored viewType fails closed", () => {
  it.each(["side", "walk", "body"])(
    "legacy viewType %j refuses before generation records, deductions, or image calls",
    async (legacy) => {
      vi.mocked(getModelAssets).mockResolvedValue([
        { ...SIX_ASSETS[0], id: 900, viewType: legacy },
      ] as never);
      const caller = appRouter.createCaller(authCtx());
      await expect(
        caller.generation.iterate({ modelId: 7, feedback: "brighten the lighting", assetId: 900 }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(createGeneration).not.toHaveBeenCalled();
      expect(deductCredits).not.toHaveBeenCalled();
      expect(iterateModel).not.toHaveBeenCalled();
    },
  );
});

// ─── Non-angle gates preserved ───────────────────────────────────────────────

describe("non-angle gates are unchanged by the six-door opening", () => {
  it("masked submission still refuses before touching the model (Batch 0 closure)", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({
        modelId: 7,
        feedback: "erase this area",
        assetId: assetIdFor("sideClose"),
        maskBase64: "data:image/png;base64,AAAA",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getModelById).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
  });

  it("foreign owner: FORBIDDEN on a newly opened view, nothing charged", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ userId: 2 }) as never);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "x", assetId: assetIdFor("threeQuarter") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
  });

  it("archived model: reads as deleted (FR-4) on a newly opened view", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "x", assetId: assetIdFor("sideFull") }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
  });

  it("minted identity seal (D-43): identity-level edit on a newly opened view still refuses with the F4 copy", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", name: "Vera" }) as never,
    );
    vi.mocked(classifyEditIdentityImpact).mockResolvedValue({
      identityLevel: true,
      checked: true,
    } as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({
        modelId: 7,
        feedback: "add a small tattoo on the forearm",
        assetId: assetIdFor("sideClose"),
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("identity is minted"),
    });
    expect(createGeneration).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
    expect(iterateModel).not.toHaveBeenCalled();
  });

  it("F6 stale-writer: a draft identity edit on a newly opened view marks siblings stale — it does NOT regenerate them (no propagation)", async () => {
    vi.mocked(classifyEditIdentityImpact).mockResolvedValue({
      identityLevel: true,
      checked: true,
    } as never);
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.iterate({
      modelId: 7,
      feedback: "add a small tattoo on the forearm",
      assetId: assetIdFor("threeQuarter"),
    });
    expect(result.success).toBe(true);
    expect(markModelAssetsStale).toHaveBeenCalledTimes(1);
    const staleIds = vi.mocked(markModelAssetsStale).mock.calls[0][0] as number[];
    expect(staleIds).not.toContain(assetIdFor("threeQuarter"));
    expect(staleIds.length).toBeGreaterThan(0);
    // One image call for the selected view only — siblings are flagged, never generated
    expect(iterateModel).toHaveBeenCalledTimes(1);
  });

  it("cosmetic draft edit marks nothing stale (D-43.2 unchanged)", async () => {
    const caller = appRouter.createCaller(authCtx());
    await caller.generation.iterate({
      modelId: 7,
      feedback: "brighten the lighting",
      assetId: assetIdFor("sideClose"),
    });
    expect(markModelAssetsStale).not.toHaveBeenCalled();
  });
});
