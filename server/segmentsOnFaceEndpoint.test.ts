import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * THE SEGMENTS PANEL'S ONLY READ, DRIVEN.
 *
 * A route test rather than a projection test: `segmentsOnFace.test.ts` owns the
 * copy, and this owns the wire — which query the panel is derived from, what
 * crosses the serialization boundary, and what happens to a face that is not
 * hers. Those are three different failures and only the middle one is about
 * strings.
 *
 * The db modules are mocked so the procedure itself runs: `pnpm test` strips
 * `DATABASE_URL` on purpose, and a route proved only by grepping its source is
 * proved against the text of a query rather than against the answer it returns.
 */

vi.mock("./db/castingV2Segments", () => ({
  listLineageSegments: vi.fn(),
  resolveOwnedCandidateId: vi.fn(),
}));
vi.mock("./db/castingV2Variants", () => ({
  listCandidateVariants: vi.fn(),
  listPendingVariants: vi.fn(),
  recordVariantOutcome: vi.fn(),
  selectVariant: vi.fn(),
}));
vi.mock("./security/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  rateLimitError: (seconds: number) => `wait ${seconds}s`,
  RATE_LIMITS: { castingPoll: {}, castingSheet: {}, castingRoll: {} },
}));
vi.mock("./castingV2/castingV2Scope", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  captureCastingV2Enabled: () => true,
}));
vi.mock("./storage", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  storagePublicUrl: (key: string) => `https://pub-test.r2.dev/${key}`,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { listLineageSegments, resolveOwnedCandidateId } from "./db/castingV2Segments";
import { listCandidateVariants } from "./db/castingV2Variants";

const CANDIDATE = "11111111-1111-4111-8111-111111111111";
const VARIANT = "22222222-2222-4222-8222-222222222222";

function ctxFor(userId = 1): TrpcContext {
  return {
    user: { id: userId, approved: true, role: "user" },
    req: { headers: {}, ip: "127.0.0.1" },
    res: {},
  } as unknown as TrpcContext;
}

/** One landed edit that delivered freckles, with its recipe as the row holds it. */
const VARIANT_ROW = {
  id: 501,
  publicId: VARIANT,
  candidateId: 9,
  parentVariantId: null,
  internalPrompt: {
    prompt: "…the paid prompt…",
    /* A real resolved identity's required shape — `readResolvedIdentity`
       refuses anything less, and a fixture it refuses would make the recipe-leak
       test below pass on an EMPTY answer, which is the flattering direction. */
    resolved: {
      sex: "female",
      ageBand: "20s",
      energy: "warm",
      heritage: ["northern european"],
      realized: { statedDetails: { marks: "freckles" } },
    },
    /* The three fields the founder's ruling calls the recipe for reproducing a
       cast. Present on the row on purpose: the test is that they do not come
       out the other side. */
    masterPrompt: "the complete recipe",
    technicalSchema: { everything: true },
    preferences: { secret: true },
  },
};

const SEGMENT_ROW = {
  id: 77,
  publicId: "33333333-3333-4333-8333-333333333333",
  candidateId: 9,
  variantId: 501,
  provenance: "edit_patch",
  facet: "marks",
  region: "face skin",
  version: 1,
  maskKey: "casting-v2/segments/a-mask.png",
  contentKey: "casting-v2/segments/a-content.png",
  geometry: { bbox: { x: 1, y: 2, width: 3, height: 4 }, frame: { width: 10, height: 10 } },
  verifiedAt: new Date(0),
  verdict: "verified",
  detector: null,
  retiredAt: null,
  createdAt: new Date(0),
};

beforeEach(() => {
  vi.clearAllMocks();
  (resolveOwnedCandidateId as any).mockResolvedValue(9);
  (listCandidateVariants as any).mockResolvedValue([VARIANT_ROW]);
  (listLineageSegments as any).mockResolvedValue([SEGMENT_ROW]);
});

describe("castingV2.segmentsOnFace", () => {
  it("answers with what this version keeps, in her own words", async () => {
    const caller = appRouter.createCaller(ctxFor());
    const result = await caller.castingV2.segmentsOnFace({ candidateId: CANDIDATE, variantId: VARIANT });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Her freckles");
    expect(result.rows[0].from).toBe("from an edit");
    expect(result.rows[0].prefill).toBe("her freckles — ");
    expect(result.rows[0].maskUrl).toBe("https://pub-test.r2.dev/casting-v2/segments/a-mask.png");
  });

  it("derives from the COMPOSITOR's own query, anchored on the version she is looking at", async () => {
    /*
      Law 4, at the one place it would hurt most. A panel with its own notion of
      what is kept would drift from the picture, and the drift would be
      invisible until a customer saw her freckles listed and absent. The anchor
      matters as much: fable-091's fork semantics mean "what is kept" is a
      question about a BRANCH, never about the candidate.
    */
    const caller = appRouter.createCaller(ctxFor(7));
    await caller.castingV2.segmentsOnFace({ candidateId: CANDIDATE, variantId: VARIANT });

    expect(listLineageSegments).toHaveBeenCalledWith({
      userId: 7,
      candidateId: 9,
      anchorVariantId: 501,
    });
  });

  it("takes userId from the session and never from the input", async () => {
    /* Invariant 3, asserted on the argument that actually reaches the db. */
    const caller = appRouter.createCaller(ctxFor(42));
    await caller.castingV2.segmentsOnFace({ candidateId: CANDIDATE, variantId: VARIANT });

    expect(resolveOwnedCandidateId).toHaveBeenCalledWith({
      userId: 42,
      candidatePublicId: CANDIDATE,
    });
    expect((listLineageSegments as any).mock.calls[0][0].userId).toBe(42);
  });

  it("NEVER lets the recipe cross the boundary", async () => {
    /*
      The founder's ruling of 2026-07-25: `masterPrompt`, `technicalSchema` and
      `preferences` together are the complete recipe for reproducing a cast, and
      they are treated like a password. They sit on the very row this route
      reads to find her words, so the projection being an explicit allowlist
      (invariant 8) is load-bearing here rather than theoretical.
    */
    const caller = appRouter.createCaller(ctxFor());
    const result = await caller.castingV2.segmentsOnFace({ candidateId: CANDIDATE, variantId: VARIANT });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("masterPrompt");
    expect(serialized).not.toContain("the complete recipe");
    expect(serialized).not.toContain("technicalSchema");
    expect(serialized).not.toContain("preferences");
    expect(serialized).not.toContain("the paid prompt");
    /* And nothing from the store's own vocabulary either — no region name, no
       pixel count, no detector, no version. */
    expect(serialized).not.toContain("face skin");
    expect(serialized).not.toContain("detector");
  });

  it("keeps nothing on the original, because a first edit carries nothing", async () => {
    /* fable-091. And it answers without touching the database at all, which is
       the difference between a rule and a comment about a rule. */
    const caller = appRouter.createCaller(ctxFor());
    const result = await caller.castingV2.segmentsOnFace({ candidateId: CANDIDATE, variantId: null });

    expect(result.rows).toEqual([]);
    expect(resolveOwnedCandidateId).not.toHaveBeenCalled();
    expect(listLineageSegments).not.toHaveBeenCalled();
  });

  it("refuses a version that is not on this face", async () => {
    (listCandidateVariants as any).mockResolvedValue([]);
    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.castingV2.segmentsOnFace({ candidateId: CANDIDATE, variantId: VARIANT }))
      .rejects.toThrow(/not found/i);
  });

  it("refuses a candidate that is not hers, as NOT_FOUND rather than a hint", async () => {
    (resolveOwnedCandidateId as any).mockRejectedValue(new Error("candidate"));
    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.castingV2.segmentsOnFace({ candidateId: CANDIDATE, variantId: VARIANT }))
      .rejects.toThrow(/not found/i);
    expect(listLineageSegments).not.toHaveBeenCalled();
  });

  it("refuses an unknown field rather than dropping it (invariant 4)", async () => {
    const caller = appRouter.createCaller(ctxFor());
    await expect(caller.castingV2.segmentsOnFace({
      candidateId: CANDIDATE,
      variantId: VARIANT,
      userId: 999,
    } as never)).rejects.toThrow();
  });
});
