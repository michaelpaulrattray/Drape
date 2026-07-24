/**
 * Batch B — cross-surface status read-model agreement (R6 execution plan).
 *
 * One shared read model (shared/modelLifecycle) and every in-scope consumer
 * agrees with it across all four statuses:
 *
 *   package state (generation.packageState)     — minted is status truth
 *   mint-package result (executeMintPackage)    — minted is status truth, not the requested action
 *   picker (boardOps.listCastableModels)        — draft is status truth; unavailable rows never surface
 *   board fill (boardOps.fillFromLibrary)       — draft provenance is status truth
 *   registry (registry.lookup / registry.verify)— minted is status truth; the two agree
 *   export (generation.generatePdf)             — minted read-state + SEPARATE agencyId integrity
 *
 * Plus the agencyId-mismatch table: a stray ID on a draft never reads
 * minted; a missing ID on a minted row keeps minted READ state but still
 * fails the export whose integrity contract requires the ID; archived stays
 * deleted regardless of ID.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getModelById: vi.fn(),
    getModelAssets: vi.fn().mockResolvedValue([]),
    getModelByAgencyId: vi.fn(),
    getUserModels: vi.fn().mockResolvedValue([]),
    getHeadshotsForModels: vi.fn().mockResolvedValue(new Map()),
    getUserById: vi.fn(),
    getBoardItemById: vi.fn(),
    updateBoardItem: vi.fn().mockResolvedValue(undefined),
    addBoardItemVersion: vi.fn().mockResolvedValue(undefined),
    getLatestVersionNumber: vi.fn().mockResolvedValue(0),
    withTransaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({})),
    fillEmptyCastNodeWithVersionIn: vi.fn().mockResolvedValue("filled"),
    updateModel: vi.fn().mockResolvedValue({ success: true }),
    mintModelAtomically: vi.fn().mockResolvedValue({ success: true }),
    deductPoints: vi.fn().mockResolvedValue({ success: true }),
  };
});
vi.mock("./casting/pdfService", () => ({
  generatePremiumIdentityPdf: vi.fn().mockReturnValue("cGRm"),
  PdfModelData: {},
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
vi.mock("./casting/snapshotPdfImages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotPdfImages")>();
  return {
    ...actual,
    resolveSnapshotPdfImages: vi.fn(),
  };
});
vi.mock("./casting/snapshotTransitions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotTransitions")>();
  return {
    ...actual,
    commitGeneratedPackageSnapshot: vi.fn(async (input: {
      mode: "add_views" | "late_view" | "mint";
      candidates: Array<{ angle: string; storageUrl: string }>;
      mint?: { agencyId: string };
    }) => ({
      result: {
        generated: input.candidates.map((candidate, index) => ({
          angle: candidate.angle,
          imageUrl: candidate.storageUrl,
          assetId: 900 + index,
        })),
        agencyId: input.mode === "mint" ? input.mint?.agencyId ?? null : null,
        minted: input.mode === "mint" || input.mode === "late_view",
      },
    })),
  };
});

import {
  getModelById,
  getModelAssets,
  getModelByAgencyId,
  getUserModels,
  getHeadshotsForModels,
  getUserById,
  getBoardItemById,
} from "./db";
import { appRouter } from "./routers";
import { executeMintPackage } from "./casting/mintPackage";
import { listCastableModels, executeFillFromLibrary } from "./lib/boardOps";
import { captureSnapshotReadMode } from "./casting/snapshotReadScope";
import { resolveEffectiveCastStateForRead } from "./casting/effectiveCastRead";
import {
  resolveSnapshotPdfImages,
  SnapshotPdfImageError,
} from "./casting/snapshotPdfImages";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

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
  name: "Test Model",
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
const headshot = { id: 42, modelId: 7, viewType: "frontClose", storageUrl: `${R2_BASE}/models/7/frontClose.png`, pinned: false, status: null, createdAt: new Date() };

beforeEach(() => {
  vi.mocked(getModelById).mockReset();
  vi.mocked(getModelAssets).mockReset().mockResolvedValue([]);
  vi.mocked(getModelByAgencyId).mockReset();
  vi.mocked(getUserModels).mockReset().mockResolvedValue([]);
  vi.mocked(getHeadshotsForModels).mockReset().mockResolvedValue(new Map());
  vi.mocked(captureSnapshotReadMode).mockReset().mockReturnValue("r6");
  vi.mocked(resolveEffectiveCastStateForRead).mockReset();
  vi.mocked(resolveSnapshotPdfImages).mockReset();
});

// ─── generation.packageState — minted is status truth ──────────────────────

describe("packageState.minted agrees with the shared read model", () => {
  const cases: Array<[string, string | null, boolean]> = [
    ["draft", null, false],
    ["draft", "MOD-26-STRAY0", false], // stray ID never reads minted
    ["active", "MOD-26-ABCDEF", true],
    ["active", null, true], // read-state stays minted; integrity checks are separate
    ["locked", "MOD-26-LEGACY", true], // legacy minted alias
    ["locked", null, true],
  ];

  it.each(cases)("status=%s agencyId=%s → minted=%s", async (status, agencyId, minted) => {
    vi.mocked(getModelById).mockResolvedValue(model({ status, agencyId }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([headshot] as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.generation.packageState({ modelId: 7 });
    expect(res.minted).toBe(minted);
  });

  it("archived reads as deleted (NOT_FOUND) even carrying an agencyId", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived", agencyId: "MOD-26-GONE00" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.packageState({ modelId: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── executeMintPackage result — server truth, not the requested action ────

describe("mintPackage result.minted is status truth, never the requested action", () => {
  it("stays-draft (mint:false) on a clean draft reports minted:false", async () => {
    vi.mocked(getModelById).mockResolvedValue(model() as never);
    vi.mocked(getModelAssets).mockResolvedValue([headshot] as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "draft", characterName: "", mint: false, operationId: REQUEST_ID });
    expect(res.minted).toBe(false);
  });

  it("stays-draft (mint:false) on a draft with a STRAY agencyId still reports minted:false", async () => {
    // The old !!agencyId derivation read this inconsistent row as minted.
    vi.mocked(getModelById).mockResolvedValue(model({ agencyId: "MOD-26-STRAY0" }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([headshot] as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "draft", characterName: "", mint: false, operationId: REQUEST_ID });
    expect(res.minted).toBe(false);
  });

  it("upgrade (mint:false) on a legacy LOCKED model reports minted:true — even with the ID missing", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "locked", agencyId: null, mintedAt: new Date() }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([headshot] as never);
    const res = await executeMintPackage({ userId: 1, modelId: 7, tier: "draft", characterName: "", mint: false, operationId: REQUEST_ID });
    expect(res.minted).toBe(true);
  });
});

// ─── Picker — draft flag is status truth; unavailable rows never surface ───

describe("listCastableModels derives draft from status, never from 'not minted'", () => {
  it("draft flags per status; a stray agencyId draft is still a draft", async () => {
    vi.mocked(getUserModels).mockResolvedValue([
      model({ id: 1, status: "draft" }),
      model({ id: 2, status: "draft", agencyId: "MOD-26-STRAY0" }),
      model({ id: 3, status: "active", agencyId: "MOD-26-ABCDEF" }),
      model({ id: 4, status: "locked", agencyId: "MOD-26-LEGACY" }),
    ] as never);
    vi.mocked(getHeadshotsForModels).mockResolvedValue(
      new Map([[1, "u1"], [2, "u2"], [3, "u3"], [4, "u4"]]),
    );
    const out = await listCastableModels(1);
    const byId = new Map(out.map((m) => [m.id, m.draft]));
    expect(byId.get(1)).toBe(true);
    expect(byId.get(2)).toBe(true); // stray ID never demotes a draft to minted
    expect(byId.get(3)).toBe(false);
    expect(byId.get(4)).toBe(false); // legacy locked presents as minted
  });

  it("archived and unrecognized statuses never surface — not as drafts, not as minted", async () => {
    // Even if the getUserModels archived filter (Batch 0) ever regressed,
    // the read model refuses to present unavailable rows.
    vi.mocked(getUserModels).mockResolvedValue([
      model({ id: 1, status: "archived", agencyId: "MOD-26-GONE00" }),
      model({ id: 2, status: "somefuturestatus" }),
      model({ id: 3, status: "draft" }),
    ] as never);
    vi.mocked(getHeadshotsForModels).mockResolvedValue(new Map([[1, "u1"], [2, "u2"], [3, "u3"]]));
    const out = await listCastableModels(1);
    expect(out.map((m) => m.id)).toEqual([3]);
  });
});

// ─── Board fill — provenance draft flag is status truth ────────────────────

describe("fillFromLibrary stamps draft from status truth", () => {
  const boardItem = { id: 11, boardId: 3, deletedAt: null, metadata: {}, label: null };

  it.each([
    ["draft", "MOD-26-STRAY0", true], // stray ID: still a draft node
    ["active", "MOD-26-ABCDEF", false],
    ["locked", null, false], // legacy locked places as minted
  ])("status=%s agencyId=%s → draft=%s", async (status, agencyId, draft) => {
    vi.mocked(getBoardItemById).mockResolvedValue(boardItem as never);
    vi.mocked(getModelById).mockResolvedValue(model({ status, agencyId }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([headshot] as never);
    const res = await executeFillFromLibrary({ userId: 1, itemId: 11, modelId: 7 });
    expect(res.draft).toBe(draft);
  });

  it("archived source refuses NOT_FOUND (FR-4 degradation stays server-guarded)", async () => {
    vi.mocked(getBoardItemById).mockResolvedValue(boardItem as never);
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    await expect(executeFillFromLibrary({ userId: 1, itemId: 11, modelId: 7 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ─── Registry — lookup and verify agree; locked is retrievable ─────────────

describe("registry read model", () => {
  it("lookup returns a legacy LOCKED identity (minted by status)", async () => {
    vi.mocked(getModelByAgencyId).mockResolvedValue(
      model({ status: "locked", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    vi.mocked(getModelAssets).mockResolvedValue([headshot] as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.registry.lookup({ agencyId: "MOD-26-ABCDEF" });
    expect(res.agencyId).toBe("MOD-26-ABCDEF");
  });

  it("lookup refuses a draft carrying a stray agencyId (NOT_FOUND, never a bundle)", async () => {
    // hex-valid ID so the request passes input validation and reaches the read model
    vi.mocked(getModelByAgencyId).mockResolvedValue(model({ agencyId: "MOD-26-0AB1C2" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.registry.lookup({ agencyId: "MOD-26-0AB1C2" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lookup refuses an archived identity even with its ID intact", async () => {
    vi.mocked(getModelByAgencyId).mockResolvedValue(
      model({ status: "archived", agencyId: "MOD-26-ABCDEF", mintedAt: new Date() }) as never,
    );
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.registry.lookup({ agencyId: "MOD-26-ABCDEF" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("verify agrees with lookup for all four statuses — non-minted rows are PUBLICLY ABSENT", async () => {
    // Review correction 2: verify must not leak the existence of rows that
    // lookup hides. Draft/archived/unknown return the exact same shape as a
    // row that does not exist: exists:false, minted:false, no timestamp.
    const caller = appRouter.createCaller(authCtx());
    const mintedAt = new Date();
    const table: Array<[string, boolean]> = [
      ["draft", false], // stray-ID draft: publicly absent
      ["active", true],
      ["locked", true],
      ["archived", false], // FR-4: deleted everywhere, existence included
      ["somefuturestatus", false], // unknown: conservative absence
    ];
    for (const [status, minted] of table) {
      vi.mocked(getModelByAgencyId).mockResolvedValue(
        model({ status, agencyId: "MOD-26-ABCDEF", mintedAt }) as never,
      );
      const res = await caller.registry.verify({ agencyId: "MOD-26-ABCDEF" });
      expect(res.exists, `verify exists for ${status}`).toBe(minted);
      expect(res.minted, `verify minted for ${status}`).toBe(minted);
      expect("mintedAt" in res ? res.mintedAt : undefined, `verify mintedAt for ${status}`).toEqual(
        minted ? mintedAt : undefined,
      );
    }
    // The hidden-row shape is byte-identical to the no-row shape
    vi.mocked(getModelByAgencyId).mockResolvedValue(
      model({ status: "archived", agencyId: "MOD-26-ABCDEF", mintedAt }) as never,
    );
    const hidden = await caller.registry.verify({ agencyId: "MOD-26-ABCDEF" });
    vi.mocked(getModelByAgencyId).mockResolvedValue(null as never);
    const absent = await caller.registry.verify({ agencyId: "MOD-26-ABCDEF" });
    expect(hidden).toEqual(absent);
  });
});

// ─── Export — minted read-state + the SEPARATE agencyId integrity check ────

describe("generatePdf: status read-state and agencyId integrity are separate contracts", () => {
  const pdfInput = { modelId: 7, modelName: "TEST", images: {} };

  it("legacy LOCKED with its ID exports (minted by status)", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "locked", agencyId: "MOD-26-LEGACY", mintedAt: new Date() }) as never,
    );
    vi.mocked(getUserById).mockResolvedValue({ id: 1, name: "Owner", email: "o@x.test", createdAt: new Date() } as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.generation.generatePdf(pdfInput);
    expect(res.success).toBe(true);
  });

  it("ACTIVE missing its agencyId reads minted but the export still fails closed (integrity)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "active", agencyId: null }) as never);
    vi.mocked(getModelAssets).mockResolvedValue([headshot] as never);
    const caller = appRouter.createCaller(authCtx());
    // Read-state: minted
    const pkg = await caller.generation.packageState({ modelId: 7 });
    expect(pkg.minted).toBe(true);
    // Integrity: the dossier requires the ID — refuse
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("a draft with a stray agencyId is refused (never minted-by-ID)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ agencyId: "MOD-26-STRAY0" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  // ── Final review round A: the server route runs the SHARED contract ──────

  it.each([
    ["active", null],
    ["active", ""],
    ["active", "   "], // whitespace-only: the !!agencyId form let this through
    ["locked", null],
    ["locked", "   "],
  ])("minted %s with ID %j refuses with the REPAIR copy, never the mint prompt", async (status, agencyId) => {
    vi.mocked(getModelById).mockResolvedValue(model({ status, agencyId, mintedAt: new Date() }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("missing its agency ID"),
    });
  });

  it("an unminted model refuses with the MINT prompt (the two refusals stay distinct)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "draft", agencyId: "MOD-26-STRAY0" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.generatePdf(pdfInput)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Name & mint"),
    });
  });

  it("the PDF carries the resolver's TRIMMED verified ID — data and filename, no DRAFT anywhere", async () => {
    const { generatePremiumIdentityPdf } = await import("./casting/pdfService");
    vi.mocked(generatePremiumIdentityPdf).mockClear();
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "locked", agencyId: "  MOD-26-LEGACY  ", mintedAt: new Date() }) as never,
    );
    vi.mocked(getUserById).mockResolvedValue({ id: 1, name: "Owner", email: "o@x.test", openId: "o", createdAt: new Date() } as never);
    const caller = appRouter.createCaller(authCtx());
    const res = await caller.generation.generatePdf(pdfInput);
    expect(res.filename).toBe("LEGAL_IDENTITY_MOD-26-LEGACY.pdf");
    const pdfData = vi.mocked(generatePremiumIdentityPdf).mock.calls[0][0] as { agencyId: string; modelName: string };
    expect(pdfData.agencyId).toBe("MOD-26-LEGACY");
    // The legacy client field says TEST; the persisted server row is the
    // identity-name authority and must win.
    expect(pdfData.modelName).toBe("Test Model");
  });

  it("R6 keeps the client-prepared image manifest unchanged", async () => {
    const { generatePremiumIdentityPdf } = await import("./casting/pdfService");
    vi.mocked(generatePremiumIdentityPdf).mockClear();
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-R6", mintedAt: new Date() }) as never,
    );
    vi.mocked(getUserById).mockResolvedValue({
      id: 1,
      name: "Owner",
      openId: "owner",
      createdAt: new Date(),
    } as never);
    const clientImages = { headshot: "data:image/png;base64,CLIENT" };

    await appRouter.createCaller(authCtx()).generation.generatePdf({
      modelId: 7,
      images: clientImages,
    });

    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
    expect(resolveSnapshotPdfImages).not.toHaveBeenCalled();
    expect(vi.mocked(generatePremiumIdentityPdf).mock.calls[0][0]).toMatchObject({
      images: clientImages,
      masterPrompt: "prompt",
    });
  });

  it("snapshot mode ignores client images and uses selected views plus immutable identity documents", async () => {
    const { generatePremiumIdentityPdf } = await import("./casting/pdfService");
    vi.mocked(generatePremiumIdentityPdf).mockClear();
    const effectiveModel = model({
      status: "active",
      agencyId: "MOD-26-SNAPSHOT",
      mintedAt: new Date(),
      masterPrompt: "mutable prompt",
      technicalSchema: { subject: { age: "99" } },
      preferences: { hairColor: "Mutable" },
    });
    vi.mocked(captureSnapshotReadMode).mockReturnValueOnce("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValueOnce({
      authority: "snapshot",
      status: "current",
      model: effectiveModel,
      stateVersion: 1,
      package: {},
      identity: {
        masterPrompt: "immutable snapshot prompt",
        technicalSchema: { subject: { age: "30" } },
        preferences: { hairColor: "Brown" },
      },
      anchor: headshot,
      displayedHeadshot: headshot,
      selectedViews: [{ angle: "frontClose", asset: headshot }],
      sealedPackage: {},
      sealedIdentity: {},
      ledger: { assets: [headshot] },
    } as never);
    const serverImages = { headshot: "data:image/png;base64,SERVER" };
    vi.mocked(resolveSnapshotPdfImages).mockResolvedValueOnce(serverImages);
    vi.mocked(getUserById).mockResolvedValue({
      id: 1,
      name: "Owner",
      openId: "owner",
      createdAt: new Date(),
    } as never);

    await appRouter.createCaller(authCtx()).generation.generatePdf({
      modelId: 7,
      images: { headshot: "data:image/png;base64,CLIENT-FORGED" },
    });

    expect(captureSnapshotReadMode).toHaveBeenCalledTimes(1);
    expect(getModelById).not.toHaveBeenCalled();
    expect(resolveEffectiveCastStateForRead).toHaveBeenCalledWith({ userId: 1, modelId: 7 });
    expect(resolveSnapshotPdfImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ angle: "frontClose" })]),
    );
    expect(vi.mocked(generatePremiumIdentityPdf).mock.calls[0][0]).toMatchObject({
      images: serverImages,
      masterPrompt: "immutable snapshot prompt",
      preferences: expect.objectContaining({ age: "30", hairColor: "Brown" }),
    });
  });

  it("snapshot image preparation refuses with static copy before PDF generation", async () => {
    const { generatePremiumIdentityPdf } = await import("./casting/pdfService");
    vi.mocked(generatePremiumIdentityPdf).mockClear();
    vi.mocked(captureSnapshotReadMode).mockReturnValueOnce("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValueOnce({
      authority: "snapshot",
      status: "current",
      model: model({ status: "active", agencyId: "MOD-26-SNAPSHOT", mintedAt: new Date() }),
      stateVersion: 1,
      package: {},
      identity: { masterPrompt: "snapshot", technicalSchema: {}, preferences: {} },
      anchor: headshot,
      displayedHeadshot: headshot,
      selectedViews: [{ angle: "frontClose", asset: headshot }],
      sealedPackage: {},
      sealedIdentity: {},
      ledger: { assets: [headshot] },
    } as never);
    vi.mocked(resolveSnapshotPdfImages).mockRejectedValueOnce(new SnapshotPdfImageError());
    vi.mocked(getUserById).mockResolvedValue({
      id: 1,
      name: "Owner",
      openId: "owner",
      createdAt: new Date(),
    } as never);

    await expect(appRouter.createCaller(authCtx()).generation.generatePdf({
      modelId: 7,
      images: { headshot: "data:image/png;base64,CLIENT" },
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("No credits were used"),
    });
    expect(generatePremiumIdentityPdf).not.toHaveBeenCalled();
  });
});
