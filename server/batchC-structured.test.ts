/**
 * Batch C — the structured attribute editor (M6, ratified R3), creation-path
 * ordering (M22 ⊕: the deduct-before-parse doors reordered), and the
 * Canvas/Wardrobe isolation boundary (M19).
 *
 * applyModelEdit's UPDATE branch is a `source:"structured"` §8.6 commit:
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
    deductPoints: vi.fn().mockResolvedValue({ success: true }),
    addCredits: vi.fn().mockResolvedValue({ success: true }),
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
          if ((values.status as { state?: string } | undefined)?.state === "stale") tx.staleUpdates.push(values);
          else tx.modelUpdates.push(values);
          return Promise.resolve();
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
    generateCastingImage: vi.fn().mockResolvedValue({ imageUrl: "https://pub-test.r2.dev/casting/new.png", engineUsed: "test" }),
  };
});
vi.mock("./casting/promptParser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/promptParser")>();
  return { ...actual, parseCastingPrompt: vi.fn().mockResolvedValue({}) };
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
} from "./db";
import { generateMasterPrompt, generateCastingImage } from "./casting/aiService";
import {
  executeApplyModelEdit,
  executeRunGeneration,
  executeRunVariations,
} from "./lib/boardOps";
import { REFUSAL_COPY } from "./casting/identity/refusalCopy";
import { appRouter } from "./routers";

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
  tx.reset();
});

// ─── M6: the wire boundary ───────────────────────────────────────────────────

describe("applyModelEdit wire schema (M6)", () => {
  it("unknown keys are REJECTED at the router, never silently stripped", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.boardOps.applyModelEdit.execute({
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
      boardId: 2, itemId: 3,
      attributes: { gender: "Female", age: 24, castingVibe: { editorial: 1, commercial: 0, runway: 0 } },
      userPrompt: "sharp editorial Nordic face",
    });
    expect(result.success).toBe(true);
  });
});

// ─── M6: the update branch is a structured §8.6 commit ──────────────────────

describe("applyModelEdit UPDATE = source:'structured' §8.6 commit (M6)", () => {
  it("a valid identity change commits document + anchor + new revision + stale flags (pinned included), FREE validation first", async () => {
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
      expect(src, `${file} must not write model identity`).not.toMatch(/\bupdateModel\b|\bmintModel\b|\bcommitIdentityEdit\b/);
    }
  });
});
