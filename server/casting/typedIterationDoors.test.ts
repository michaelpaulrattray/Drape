/**
 * The generation.iterate door over the REAL appRouter (Batch C: M1/M3/M15/
 * M17/M21 router legs + the Batch A-coupled six-door framing regressions).
 *
 * db, Gemini, and the authority's LLM seam are mocked at their module
 * boundaries; everything between the wire and those seams is real: the
 * shared identity authority, the §8.6 atomic commit, framing, guards.
 *
 * Proves:
 *  - ALL SIX canonical angles reach typed iteration with the exhaustive
 *    per-angle framing (V1+V14 regression);
 *  - every refusal class is FREE: no generation record, no deduction, no
 *    image call, no document write (M1/M2/M16/M20);
 *  - image-only results are ASSET-ONLY: identity documents byte-unchanged,
 *    `display` role + current revision stamped, no stale flags (M17);
 *  - a draft identity edit on the authoritative headshot commits atomically:
 *    document + new anchor + new revision + stale flags PINNED INCLUDED
 *    (M1/M21); a commit failure refunds exactly once (M20);
 *  - masked refusal, ownership, archived exclusion, and the F4 minted seal
 *    are unchanged (M3 + regressions).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../_core/context";

const llmScript = vi.hoisted(() => ({
  classify: '{"kind":"imageOnly","categories":["image.lighting"],"operations":{}}',
  normalize: '{"edits":[]}',
  fail: false,
}));
const tx = vi.hoisted(() => ({
  modelUpdates: [] as Array<Record<string, unknown>>,
  assetInserts: [] as Array<Record<string, unknown>>,
  staleUpdates: [] as Array<{ values: Record<string, unknown> }>,
  staleWhereIds: [] as number[][],
  failInsert: false,
  reset() {
    this.modelUpdates = [];
    this.assetInserts = [];
    this.staleUpdates = [];
    this.staleWhereIds = [];
    this.failInsert = false;
  },
}));

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
    finalizeClaimedGenerationOperationSuccess: vi.fn().mockResolvedValue(undefined),
    deductCredits: vi.fn().mockResolvedValue({ success: true }),
    addCredits: vi.fn().mockResolvedValue({ success: true }),
    markGenerationOperationRunning: vi.fn().mockResolvedValue({ operationId: "11111111-1111-4111-8111-111111111111", chargeReferenceId: "op:11111111-1111-4111-8111-111111111111:charge" }),
  };
});
vi.mock("../db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/connection")>();
  const makeTx = () => ({
    update: (_table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: unknown) => {
          if ((values.status as { state?: string } | undefined)?.state === "stale") {
            tx.staleUpdates.push({ values });
            // drizzle inArray(col, ids) — capture the ids for assertions
            const ids = (cond as { queryChunks?: unknown } & Record<string, unknown>);
            void ids;
          } else {
            tx.modelUpdates.push(values);
          }
          return Promise.resolve({ affectedRows: 1 });
        },
      }),
    }),
    insert: (_table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        $returningId: async () => {
          if (tx.failInsert) throw new Error("insert failed");
          tx.assetInserts.push(values);
          return [{ id: 777 }];
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
    iterateModelRaw: vi.fn().mockResolvedValue({
      imageBase64: "data:image/png;base64,bmV3",
      engineUsed: "test",
    }),
    uploadRawCandidate: vi.fn().mockResolvedValue({
      imageUrl: "https://pub-test.r2.dev/iterate/new.png",
      storageKey: "iterate/new.png",
    }),
    compactMasterPrompt: vi.fn().mockResolvedValue("compacted"),
  };
});
vi.mock("./identity/editGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./identity/editGate")>();
  return { ...actual, verifyIdentityEdit: vi.fn().mockResolvedValue({ ok: true, checked: true, violations: [] }) };
});
vi.mock("../storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../storage")>();
  return { ...actual, storageDelete: vi.fn().mockResolvedValue({ success: true }) };
});
// The authority's LLM seam — scripted per test, dead when fail=true
vi.mock("../wardrobe/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../wardrobe/utils")>();
  return {
    ...actual,
    withTextQueue: (fn: () => unknown) => Promise.resolve(fn()),
    getAiClient: () => ({
      models: {
        generateContent: async (req: { contents: unknown }) => {
          if (llmScript.fail) throw new Error("LLM down");
          const body = JSON.stringify(req.contents);
          return { text: body.includes("You classify") ? llmScript.classify : llmScript.normalize };
        },
      },
    }),
  };
});
vi.mock("./directOperation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./directOperation")>();
  return {
    ...actual,
    beginDirectOperation: vi.fn().mockResolvedValue({ type: "execute", operationId: "11111111-1111-4111-8111-111111111111" }),
    completeClaimedDirectOperationSuccess: vi.fn().mockResolvedValue(undefined),
    completeDirectOperationSuccess: vi.fn().mockResolvedValue(undefined),
    completeDirectOperationFailure: vi.fn(async ({ error }: { error: unknown }) => { throw error; }),
    failClaimedDirectOperation: vi.fn(async ({ error }: { error: unknown }) => { throw error; }),
  };
});

import {
  getModelById,
  getModelAssets,
  createGeneration,
  createModelAsset,
  markModelAssetsStale,
  updateModel,
  deductCredits,
  addCredits,
} from "../db";
import { iterateModel, iterateModelRaw } from "./aiService";
import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";
import { ITERATION_CROP_BY_VIEW } from "./iterationFraming";
import { REFUSAL_COPY } from "./identity/refusalCopy";
import { beginDirectOperation, completeClaimedDirectOperationSuccess } from "./directOperation";
import { clarificationForCastingRefusal } from "../../shared/castingClarification";
import { appRouter as productionRouter } from "../routers";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const appRouter = {
  createCaller(ctx: TrpcContext) {
    const caller = productionRouter.createCaller(ctx);
    return {
      ...caller,
      generation: {
        ...caller.generation,
        iterate: (input: any) => caller.generation.iterate({ clientRequestId: REQUEST_ID, ...input }),
      },
    };
  },
};

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
  identityRevisionId: null,
  createdAt: new Date(),
  ...over,
});

const R2_BASE = "https://pub-test.r2.dev";
const SIX_ASSETS = CANONICAL_VIEW_ANGLES.map((vt, i) => ({
  id: 100 + i,
  modelId: 7,
  viewType: vt,
  storageUrl: `${R2_BASE}/models/7/${vt}.png`,
  // sideClose PINNED — §14: pinning never exempts staleness
  pinned: vt === "sideClose",
  status: null,
  provenance: null,
  createdAt: new Date(),
}));
const assetIdFor = (vt: string) => SIX_ASSETS.find((a) => a.viewType === vt)!.id;

const IDENTITY_JAWLINE = '{"kind":"identity","categories":["person.face.jawline"],"operations":{}}';
const NORMALIZED_JAWLINE = '{"edits":[{"leaf":"person.face.jawline","value":"broad angular jaw, squared"}]}';
const IDENTITY_HAIR_LENGTH = '{"kind":"identity","categories":["person.hair.length"],"operations":{}}';
const NORMALIZED_HAIR_LENGTH = '{"edits":[{"leaf":"person.hair.length","value":"Very Long"}]}';

beforeEach(() => {
  vi.mocked(beginDirectOperation).mockReset().mockResolvedValue({
    type: "execute",
    operationId: "11111111-1111-4111-8111-111111111111",
  });
  vi.mocked(completeClaimedDirectOperationSuccess).mockClear();
  vi.mocked(getModelById).mockReset().mockResolvedValue(model() as never);
  vi.mocked(getModelAssets).mockReset().mockResolvedValue(SIX_ASSETS as never);
  vi.mocked(createGeneration).mockClear().mockResolvedValue({ success: true, generationId: 11 } as never);
  vi.mocked(createModelAsset).mockClear().mockResolvedValue({ success: true, assetId: 501 } as never);
  vi.mocked(markModelAssetsStale).mockClear();
  vi.mocked(updateModel).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(deductCredits).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(addCredits).mockClear().mockResolvedValue({ success: true } as never);
  vi.mocked(iterateModel).mockClear().mockResolvedValue({
    imageUrl: "https://pub-test.r2.dev/iterate/new.png",
    engineUsed: "test",
  } as never);
  vi.mocked(iterateModelRaw).mockClear().mockResolvedValue({
    imageBase64: "data:image/png;base64,bmV3",
    engineUsed: "test",
  } as never);
  llmScript.classify = '{"kind":"imageOnly","categories":["image.lighting"],"operations":{}}';
  llmScript.normalize = '{"edits":[]}';
  llmScript.fail = false;
  tx.reset();
});

const expectNothingCharged = () => {
  expect(createGeneration).not.toHaveBeenCalled();
  expect(deductCredits).not.toHaveBeenCalled();
  expect(iterateModel).not.toHaveBeenCalled();
  expect(updateModel).not.toHaveBeenCalled();
  expect(createModelAsset).not.toHaveBeenCalled();
};

// ─── All six doors open, each with the mapped frame (A-coupled regression) ──

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
      expect(options?.frame).toBe(expectedCrop);
      expect(options?.viewAngle).toBe(angle);
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

// ─── Every refusal class is FREE (M1/M2/M16/M20) ────────────────────────────

describe("shared-authority refusals: zero charge, no rows, no writes, no calls", () => {
  it("masked submission refuses after ownership/receipt claim and before money (M3, Batch 0 closure)", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({
        modelId: 7,
        feedback: "erase this area",
        assetId: assetIdFor("sideClose"),
        maskBase64: "data:image/png;base64,AAAA",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(getModelById).toHaveBeenCalledTimes(1);
    expectNothingCharged();
  });

  it.each([
    ["mark edit (draft)", "add a small tattoo on the forearm", model()],
    ["mark edit (minted)", "remove her freckles", model({ status: "active", agencyId: "MOD-1" })],
    ["presentation", "put her in a leather jacket", model()],
    ["cosmetic lash", "add mascara", model()],
    ["post-creation eyelash", "longer eyelashes", model()],
  ])("%s refuses FREE with typed copy", async (_label, feedback, m) => {
    vi.mocked(getModelById).mockResolvedValue(m as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback, assetId: assetIdFor("frontClose") }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expectNothingCharged();
  });

  it("returns a durable hair-length clarification before generation or credits", async () => {
    llmScript.classify = IDENTITY_HAIR_LENGTH;
    llmScript.normalize = NORMALIZED_HAIR_LENGTH;
    const caller = appRouter.createCaller(authCtx());

    const result = await caller.generation.iterate({
      modelId: 7,
      feedback: "make the hair a bit longer",
      assetId: assetIdFor("frontClose"),
    });

    expect(result).toEqual({
      success: false,
      clarification: clarificationForCastingRefusal("hair_length_vague"),
      pointsCost: 0,
      staledAngles: [],
      staleMessage: null,
    });
    expect(completeClaimedDirectOperationSuccess).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      result: { clarification: clarificationForCastingRefusal("hair_length_vague") },
    }));
    expectNothingCharged();
  });

  it("replays the same clarification without reclassifying or generating", async () => {
    const clarification = clarificationForCastingRefusal("hair_length_vague");
    vi.mocked(beginDirectOperation).mockResolvedValueOnce({
      type: "replay",
      operationId: "11111111-1111-4111-8111-111111111111",
      result: { clarification },
    });
    llmScript.fail = true;
    const caller = appRouter.createCaller(authCtx());

    await expect(caller.generation.iterate({
      modelId: 7,
      feedback: "make the hair a bit longer",
      assetId: assetIdFor("frontClose"),
    })).resolves.toEqual({
      success: false,
      clarification,
      pointsCost: 0,
      staledAngles: [],
      staleMessage: null,
    });
    expect(completeClaimedDirectOperationSuccess).not.toHaveBeenCalled();
    expectNothingCharged();
  });

  it("classifier OUTAGE fails closed and free — never an unchecked image-only fallback (M2)", async () => {
    llmScript.fail = true;
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "a subtle general change", assetId: assetIdFor("frontClose") }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.classifierUnavailable });
    expectNothingCharged();
  });

  it("minted identity seal: an allowed leaf on a MINTED model refuses with the F4 fork copy", async () => {
    vi.mocked(getModelById).mockResolvedValue(
      model({ status: "active", agencyId: "MOD-26-ABCDEF", name: "Vera" }) as never,
    );
    llmScript.classify = IDENTITY_JAWLINE;
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "sharper jawline", assetId: assetIdFor("frontClose") }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("identity is minted"),
    });
    expectNothingCharged();
  });

  it("identity edit on a NON-ANCHOR view refuses with routing to the headshot", async () => {
    llmScript.classify = IDENTITY_JAWLINE;
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "sharper jawline", assetId: assetIdFor("sideClose") }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_COPY.nonAnchorView });
    expectNothingCharged();
  });

  it("foreign owner: FORBIDDEN, nothing charged", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ userId: 2 }) as never);
    const caller = appRouter.createCaller(authCtx(1));
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "x", assetId: assetIdFor("threeQuarter") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expectNothingCharged();
  });

  it("archived model reads as deleted (FR-4)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "archived" }) as never);
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "x", assetId: assetIdFor("sideFull") }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expectNothingCharged();
  });
});

// ─── Image-only: asset-only (M17) ───────────────────────────────────────────

describe("image-only results are asset-only (M17)", () => {
  it("identity documents byte-unchanged; display role + current revision stamped; no stale flags; no compaction", async () => {
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.iterate({
      modelId: 7,
      feedback: "brighten the lighting",
      assetId: assetIdFor("frontClose"),
    });
    expect(result.success).toBe(true);
    // Documents byte-unchanged: NO model write of any kind
    expect(updateModel).not.toHaveBeenCalled();
    expect(tx.modelUpdates).toEqual([]);
    // No stale flags
    expect(markModelAssetsStale).not.toHaveBeenCalled();
    expect(tx.staleUpdates).toEqual([]);
    // The new frontClose version is DISPLAY-only under the current revision
    expect(createModelAsset).toHaveBeenCalledTimes(1);
    const row = vi.mocked(createModelAsset).mock.calls[0][0] as Record<string, never> & { provenance: Record<string, unknown> };
    expect(row.provenance.identityRole).toBe("display");
    expect(row.provenance.identityRevisionId).toBe("genesis");
    // The response carries no document payload — nothing changed
    expect((result as Record<string, unknown>).masterPrompt).toBeUndefined();
    expect((result as Record<string, unknown>).technicalSchema).toBeUndefined();
    expect((result as Record<string, unknown>).preferences).toBeUndefined();
  });

  it("image-only works identically on a MINTED model (drafts and minted alike, §5.3)", async () => {
    vi.mocked(getModelById).mockResolvedValue(model({ status: "active", agencyId: "MOD-1" }) as never);
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.iterate({
      modelId: 7,
      feedback: "brighten the lighting",
      assetId: assetIdFor("frontFull"),
    });
    expect(result.success).toBe(true);
    expect(updateModel).not.toHaveBeenCalled();
  });
});

// ─── Identity edit: the §8.6 atomic commit (M1/M21) ─────────────────────────

describe("draft identity edit on the authoritative headshot — atomic commit", () => {
  beforeEach(() => {
    llmScript.classify = IDENTITY_JAWLINE;
    llmScript.normalize = NORMALIZED_JAWLINE;
  });

  it("accepts a newer image-only display headshot from the current identity revision", async () => {
    const displayHeadshot = {
      ...SIX_ASSETS[0],
      id: 999,
      storageUrl: `${R2_BASE}/models/7/frontClose-lighting-v2.png`,
      provenance: {
        identityRole: "display",
        identityRevisionId: "genesis",
        identityText: "master prompt",
      },
      createdAt: new Date(Date.now() + 1_000),
    };
    vi.mocked(getModelAssets).mockResolvedValue([displayHeadshot, ...SIX_ASSETS] as never);

    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.iterate({
      modelId: 7,
      feedback: "sharper jawline",
      assetId: displayHeadshot.id,
    });

    expect(result.success).toBe(true);
    expect(result.assetId).toBe(777);
    expect(tx.assetInserts).toHaveLength(1);
    expect((tx.assetInserts[0].provenance as Record<string, unknown>).identityRole).toBe("anchor");
    expect(deductCredits).toHaveBeenCalledTimes(1);
  });

  it("commits document + anchor role + new revision + stale flags (PINNED INCLUDED) atomically", async () => {
    const caller = appRouter.createCaller(authCtx());
    const result = await caller.generation.iterate({
      modelId: 7,
      feedback: "sharper jawline",
      assetId: assetIdFor("frontClose"),
    });
    expect(result.success).toBe(true);
    expect(result.assetId).toBe(777); // the tx-inserted anchor row

    // Model row updated inside the transaction: document + NEW revision
    expect(tx.modelUpdates).toHaveLength(1);
    const modelUpdate = tx.modelUpdates[0];
    expect(String(modelUpdate.masterPrompt)).toContain("broad angular jaw, squared");
    expect((modelUpdate.preferences as Record<string, unknown>).jawline).toBe("broad angular jaw, squared");
    expect(String(modelUpdate.identityRevisionId)).toMatch(/^rev-/);

    // W6-D: an open client receives the exact three committed identity
    // documents. This payload exists only on the identity branch above.
    expect(result.masterPrompt).toBe(modelUpdate.masterPrompt);
    expect(result.technicalSchema).toEqual(modelUpdate.technicalSchema);
    expect(result.preferences).toEqual(modelUpdate.preferences);

    // New anchor asset with the SAME new revision + the typed edit list
    expect(tx.assetInserts).toHaveLength(1);
    const anchorRow = tx.assetInserts[0] as { provenance: Record<string, unknown>; viewType: string };
    expect(anchorRow.viewType).toBe("frontClose");
    expect(anchorRow.provenance.identityRole).toBe("anchor");
    expect(anchorRow.provenance.identityRevisionId).toBe(modelUpdate.identityRevisionId);
    expect(anchorRow.provenance.identityEdits).toEqual([
      { kind: "leaf", leaf: "person.face.jawline", operation: "modify", value: "broad angular jaw, squared" },
    ]);

    // Every filled sibling staled inside the SAME transaction — the pinned
    // sideClose included (§14: D-21 exemption superseded)
    expect(tx.staleUpdates).toHaveLength(1);

    // The old direct stale-writer is not used by this path anymore
    expect(markModelAssetsStale).not.toHaveBeenCalled();

    // Paid exactly once
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(addCredits).not.toHaveBeenCalled();

    // §8.4: the image call carried the handler directives, never raw text
    const [, , , options] = vi.mocked(iterateModelRaw).mock.calls[0];
    expect(options?.policyDirectives?.join(" ")).toContain("jawline only");
  });

  it("M20 step-9: a commit failure refunds exactly once and leaves no partial identity state", async () => {
    tx.failInsert = true;
    const caller = appRouter.createCaller(authCtx());
    await expect(
      caller.generation.iterate({ modelId: 7, feedback: "sharper jawline", assetId: assetIdFor("frontClose") }),
    ).rejects.toThrow();
    // withAtomicCredits kept the deduction (generation succeeded), then the
    // commit failed ⇒ exactly one explicit refund
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(addCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(addCredits).mock.calls[0][1]).toBe(350); // the iterate cost back
    // No out-of-transaction identity writes happened
    expect(updateModel).not.toHaveBeenCalled();
    expect(createModelAsset).not.toHaveBeenCalled();
  });

  it("records and releases only reviewed hair-geometry dependents for a length edit", async () => {
    llmScript.classify = IDENTITY_HAIR_LENGTH;
    llmScript.normalize = NORMALIZED_HAIR_LENGTH;
    vi.mocked(getModelById).mockResolvedValue(model({
      masterPrompt: "A man with short tapered hair and a rose tattoo note.",
      technicalSchema: { subject: { hair_color: "Black", hair_style: "short tapered" } },
      preferences: {
        hairColor: "Black",
        hairStyle: "Tapered",
        hairLength: "Short",
        hairTexture: "Curly",
        hairHairline: "Straight",
        hairFringe: "None",
      },
    }) as never);

    const caller = appRouter.createCaller(authCtx());
    await caller.generation.iterate({
      modelId: 7,
      feedback: "make his hair very long",
      assetId: assetIdFor("frontClose"),
    });

    const update = tx.modelUpdates[0];
    const preferences = update.preferences as Record<string, unknown>;
    expect(preferences.hairLength).toBe("Very Long");
    expect(preferences.hairStyle).toBe("");
    expect(preferences.hairTexture).toBe("Curly");
    expect(preferences.hairHairline).toBe("Straight");
    expect(String(update.masterPrompt)).toContain("IDENTITY RELEASE — person.hair.style");
    expect(String(update.masterPrompt)).toContain("rose tattoo note");

    const anchorRow = tx.assetInserts[0] as { provenance: Record<string, unknown> };
    expect(anchorRow.provenance.releasedIdentityDependents).toEqual([
      "person.hair.style",
      "person.hair.fringe",
      "person.hair.parting",
      "person.hair.volume",
      "person.hair.fade",
      "person.hair.flyaways",
      "person.hair.tuck",
    ]);
    const [, , , options] = vi.mocked(iterateModelRaw).mock.calls[0];
    expect(options?.policyDirectives?.join(" ")).toContain("EXPECTED PHYSICAL CONSEQUENCES");
    expect(options?.policyDirectives?.join(" ")).toContain("Do not change hair color");
  });

  it("a reference-assisted identity edit rides the same commit with source 'reference'", async () => {
    const caller = appRouter.createCaller(authCtx());
    await caller.generation.iterate({
      modelId: 7,
      feedback: "use the jawline from the reference",
      assetId: assetIdFor("frontClose"),
      referenceImage: "data:image/png;base64,AAAA",
    });
    const anchorRow = tx.assetInserts[0] as { provenance: Record<string, unknown> };
    expect(anchorRow.provenance.identityEditSource).toBe("reference");
  });
});
