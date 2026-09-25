import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TRY AGAIN — the money sequence for ONE view asked for again (#1208 slice 2,
 * #1220 slice 2).
 *
 * **His rule, verbatim (2026-09-25): *"you pay 50 for each view you keep."***
 *
 * Every arm here is about what moves and in what order: every refusal free and
 * before the claim, the charge pinned to THIS operation, the refund under the
 * same reference, and — the two that matter most —
 *
 * - **a FREE try again never touches the deduct at all**, which is asserted
 *   rather than inferred from a zero, because "charged 0" and "never charged"
 *   are different rows in a ledger; and
 * - **a failed try again writes NO new failure marker.** On the unjudged road
 *   that would replace a picture the customer HAS with a confession, which is
 *   the worst thing this feature could do to the person it is for.
 */

vi.hoisted(() => {
  process.env.R2_ENDPOINT ||= "https://r2-unit-test.invalid";
  process.env.R2_BUCKET ||= "unit-test-bucket";
  process.env.R2_PUBLIC_URL ||= "https://pub-test.r2.dev";
  process.env.R2_ACCESS_KEY_ID ||= "unit-test-access-key";
  process.env.R2_SECRET_ACCESS_KEY ||= "unit-test-secret";
});

const OPERATION_ID = "44444444-4444-4444-8444-444444444444";

/** The frozen-account read, which every paid entrance makes first. */
vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ frozenAt: null }] }) }),
    }),
  }),
  withTransaction: async (run: (tx: unknown) => Promise<unknown>) => run({}),
}));

vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async () => ({ success: true, generationId: 1 })),
  updateGeneration: vi.fn(async () => ({ success: true })),
}));

vi.mock("../storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://public/${key}` })),
  storageDelete: vi.fn(async () => undefined),
  storageReadBytes: vi.fn(async () => ({ bytes: Buffer.from("anchor"), contentType: "image/png" })),
}));

const receipts = {
  success: vi.fn(async (_input: unknown) => undefined),
  failure: vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  }),
};
vi.mock("../casting/directOperation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../casting/directOperation")>()),
  completeDirectOperationSuccess: vi.fn(async (input: unknown) => receipts.success(input)),
  completeDirectOperationFailure: vi.fn(async (input: { error: unknown }) => receipts.failure(input)),
}));

/*
  HER TATTOOS AND HER CARRIED WORDS — the Sign's own two readers, stubbed so
  the arm below can see WHAT WAS ASKED FOR and WHERE IT WENT. The threading is
  the thing at risk: a retried view that quietly lost them would look fine and
  be a different woman.
*/
const carried = {
  inkAsked: vi.fn((_input: unknown) => undefined),
  wordsAsked: vi.fn((_input: unknown) => undefined),
};
vi.mock("./signService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./signService")>()),
  carriedInkCrops: vi.fn(async (_deps: unknown, request: unknown) => {
    carried.inkAsked(request);
    return {
      crops: [{
        cropPublicId: "crop-public",
        slot: "free.ink",
        placement: "upperChest" as const,
        side: "centre" as const,
        noun: "swallow",
        bytes: Buffer.from("her-tattoo"),
        contentType: "image/png",
      }],
      dispositions: [],
    };
  }),
  carriedFeatureWords: vi.fn(async (_deps: unknown, request: unknown) => {
    carried.wordsAsked(request);
    return [{
      slot: "free.tail",
      noun: "tail",
      words: ["a long banded tail"],
      region: "back" as const,
    }];
  }),
}));

import { TRPCError } from "@trpc/server";
import { CAST_PACKAGE_VIEW_PRICE } from "./castViewPackage";
import { retryCastView, type ViewRetryServiceDependencies } from "./viewRetryService";
import type { CastSlotProjection } from "./castProjection";

const journal: string[] = [];
const deducts: Array<{ amount: number; reference: string }> = [];
const refunds: Array<{ amount: number; reference: string }> = [];
const committed: Array<{ angle: string; pointsCost: number; provenance: Record<string, unknown> }> = [];
let chargeSucceeds = true;
let refundRecords = true;
/** What the engine does on each attempt, oldest first; the last value repeats. */
let engineAnswers: Array<"ok" | "throw"> = ["ok"];
let engineCalls = 0;
const enginePrompts: string[] = [];

function slot(overrides: Partial<CastSlotProjection> = {}): CastSlotProjection {
  return {
    angle: "backFull",
    label: "Back",
    state: "failed-refunded",
    url: null,
    note: "This view didn't arrive — refunded",
    refundedCredits: CAST_PACKAGE_VIEW_PRICE,
    retry: { priceCredits: CAST_PACKAGE_VIEW_PRICE },
    ...overrides,
  } as CastSlotProjection;
}

function dependencies(
  slots: CastSlotProjection[],
  overrides: Partial<ViewRetryServiceDependencies> = {},
): ViewRetryServiceDependencies {
  return {
    readSlots: async () => ({ modelId: 7, slots }),
    readSource: async () => ({
      modelId: 7,
      anchorStorageKey: "casting-v2/casts/op/anchor.png",
      identityRevisionId: "rev-1",
      identityText: "identity",
      technicalSchema: { subject: { sex: "female" } },
      /* No source candidate: her crops and carried words are the road's own
         subject and have their own arm; these arms are about the money. */
      candidateId: null,
      candidatePublicId: null,
      selectedVariantId: null,
      anchorDeltas: null,
    }),
    begin: async () => {
      journal.push("claim");
      return { type: "execute" as const, operationId: OPERATION_ID };
    },
    markRunning: (async () => {
      journal.push("running");
      return { operationId: OPERATION_ID, chargeReferenceId: `op:${OPERATION_ID}:charge` };
    }) as ViewRetryServiceDependencies["markRunning"],
    deduct: (async (_userId: number, amount: number, _k: string, _d: string, reference: string) => {
      journal.push("deduct");
      if (!chargeSucceeds) return { success: false, error: "Not enough credits" };
      deducts.push({ amount, reference });
      return { success: true };
    }) as ViewRetryServiceDependencies["deduct"],
    refund: (async (_userId: number, amount: number, _d: string, reference: string) => {
      journal.push("refund");
      if (!refundRecords) return { recorded: false, amount, reference, duplicate: false };
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference, duplicate: false };
    }) as ViewRetryServiceDependencies["refund"],
    commitRetried: (async (input: {
      angle: string;
      pointsCost: number;
      provenance: Record<string, unknown>;
    }) => {
      journal.push("commit");
      committed.push({ angle: input.angle, pointsCost: input.pointsCost, provenance: input.provenance });
      return 4242;
    }) as ViewRetryServiceDependencies["commitRetried"],
    identityEngine: () => ({
      generateView: async (request: { prompt: string }) => {
        const answer = engineAnswers[Math.min(engineCalls, engineAnswers.length - 1)] ?? "ok";
        engineCalls += 1;
        enginePrompts.push(request.prompt);
        journal.push("render");
        if (answer === "throw") throw new Error("engine down");
        return {
          bytes: Buffer.from("view"),
          contentType: "image/png",
          provenance: { model: "test-engine", provider: "test" },
        };
      },
    }) as never,
    judge: (() => async () => ({
      pass: true,
      method: "model",
      axes: {
        identity: { pass: true, note: "" },
        angle: { pass: true, note: "" },
        wardrobe: { pass: true, note: "" },
      },
    })) as never,
    storeImage: async () => ({ key: "views/new.png", url: "https://public/views/new.png" }),
    deleteObject: async () => ({ success: true as const }),
    wait: async () => undefined,
    ...overrides,
  };
}

const input = {
  userId: 1,
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  castId: "KI-AAAA-BBBB-CCCC-DDDD",
  angle: "backFull" as const,
};

beforeEach(() => {
  journal.length = 0;
  deducts.length = 0;
  refunds.length = 0;
  committed.length = 0;
  enginePrompts.length = 0;
  chargeSucceeds = true;
  refundRecords = true;
  engineAnswers = ["ok"];
  engineCalls = 0;
  receipts.success.mockClear();
  receipts.failure.mockClear();
  carried.inkAsked.mockClear();
  carried.wordsAsked.mockClear();
});

describe("try again on one view — what moves, and in what order", () => {
  it("a REFUNDED view costs 50, lands, and keeps the charge", async () => {
    const result = await retryCastView(dependencies([slot()]), input);
    expect(result.outcome).toBe("ready");
    expect(result.chargedCredits).toBe(CAST_PACKAGE_VIEW_PRICE);
    expect(result.refundedCredits).toBe(0);
    expect(deducts).toHaveLength(1);
    expect(refunds).toHaveLength(0);
    /* Rows before money, dispatch after money — the house order. */
    expect(journal).toEqual(["claim", "running", "deduct", "render", "commit"]);
    /* The sweep's fork variable, written with the picture in one statement. */
    expect(committed[0]?.provenance.retryOperationId).toBe(OPERATION_ID);
    expect(committed[0]?.pointsCost).toBe(CAST_PACKAGE_VIEW_PRICE);
  });

  it("a REFUNDED view that fails again gives the 50 back under THIS operation", async () => {
    engineAnswers = ["throw"];
    const result = await retryCastView(dependencies([slot()]), input);
    expect(result.outcome).toBe("failed");
    expect(result.refundedCredits).toBe(CAST_PACKAGE_VIEW_PRICE);
    expect(result.refundRecorded).toBe(true);
    expect(refunds).toHaveLength(1);
    /*
      The reference is derived from THIS operation, so it can never collide
      with the Sign's own slot refund — which is what makes a repeat harmless
      rather than a second refund.
    */
    expect(refunds[0]?.reference).toContain(OPERATION_ID);
    /* NO new failure marker: the confession already on the slot is still true. */
    expect(committed).toHaveLength(0);
  });

  it("an UNJUDGED view is FREE — the deduct is never called at all", async () => {
    const free = slot({
      state: "ready",
      url: "https://cdn.example/view.png",
      unjudged: true,
      note: "We didn't get to check this one",
      refundedCredits: null,
      retry: { priceCredits: 0 },
    });
    const result = await retryCastView(dependencies([free]), input);
    expect(result.outcome).toBe("ready");
    expect(result.chargedCredits).toBe(0);
    /*
      Asserted as ABSENCE, not as a zero: "charged 0" and "never charged" are
      different rows in a ledger, and only one of them is his ruling.
    */
    expect(journal).toEqual(["claim", "running", "render", "commit"]);
    expect(deducts).toHaveLength(0);
  });

  it("a FREE try again that fails refunds nothing, and leaves the picture she has alone", async () => {
    engineAnswers = ["throw"];
    const free = slot({
      state: "ready",
      url: "https://cdn.example/view.png",
      unjudged: true,
      refundedCredits: null,
      retry: { priceCredits: 0 },
    });
    const result = await retryCastView(dependencies([free]), input);
    expect(result.outcome).toBe("failed");
    expect(result.chargedCredits).toBe(0);
    expect(refunds).toHaveLength(0);
    expect(journal).not.toContain("refund");
    /* Nothing committed — so the delivered view is still what the room shows. */
    expect(committed).toHaveLength(0);
  });

  it("a slot with nothing to ask for is refused FREE, before the claim", async () => {
    const checked = slot({
      state: "ready",
      url: "https://cdn.example/view.png",
      note: null,
      refundedCredits: null,
      retry: undefined,
    });
    await expect(retryCastView(dependencies([checked]), input)).rejects.toThrow(TRPCError);
    /* The negative control that matters: nothing was claimed and nothing spent. */
    expect(journal).toEqual([]);
    expect(deducts).toHaveLength(0);
  });

  it("the server re-reads the offer and never trusts the button", async () => {
    /*
      The client sent a retry for a view whose tile said 50 a minute ago. The
      slot has since been filled — by a sweep, by another tab — so the answer
      is a free refusal rather than a second picture nobody asked for.
    */
    const filled = slot({ state: "ready", url: "https://cdn.example/x.png", retry: undefined });
    await expect(retryCastView(dependencies([filled]), input)).rejects.toThrow(
      /isn't one you can ask for again/,
    );
  });

  it("not enough credits refuses with the price, and nothing is rendered", async () => {
    chargeSucceeds = false;
    await expect(retryCastView(dependencies([slot()]), input)).rejects.toThrow(/Not enough credits/);
    expect(journal).toEqual(["claim", "running", "deduct"]);
    expect(enginePrompts).toHaveLength(0);
    expect(refunds).toHaveLength(0);
  });

  it("a lost fence refunds NOTHING here — the sweep owns that money", async () => {
    const deps = dependencies([slot()], {
      commitRetried: (async () => {
        journal.push("commit");
        return null;
      }) as ViewRetryServiceDependencies["commitRetried"],
    });
    await expect(retryCastView(deps, input)).rejects.toThrow(/settled while it rendered/);
    /*
      Refunding under a reference the sweep is about to use is how one failure
      becomes two refunds. The deduct stands; recovery reads the ledger.
    */
    expect(refunds).toHaveLength(0);
    expect(deducts).toHaveLength(1);
  });

  it("a refund that does not record is never reported as 'you weren't charged'", async () => {
    engineAnswers = ["throw"];
    refundRecords = false;
    const result = await retryCastView(dependencies([slot()]), input);
    expect(result.refundRecorded).toBe(false);
    expect(result.refundedCredits).toBe(0);
    expect(result.chargedCredits).toBe(CAST_PACKAGE_VIEW_PRICE);
  });

  it("an anchor that has gone away is a free refusal, not a charged render", async () => {
    const deps = dependencies([slot()], {
      readAnchorBytes: (async () => {
        throw new Error("NoSuchKey");
      }) as ViewRetryServiceDependencies["readAnchorBytes"],
    });
    await expect(retryCastView(deps, input)).rejects.toThrow(/signed face isn't available/);
    expect(journal).toEqual([]);
  });

  it("a retried view carries her tattoos and her carried words — the Sign's own composition", async () => {
    /*
      THE FIDELITY ARM, and the reason the Sign's attempt loop was extracted
      rather than copied. A view asked for again is composed by the same
      function the Sign composes with, so it rides her delivered ink crops and
      the words for what the waist-up anchor cannot show. A retry that lost
      them would come back a different woman, on the one tile a customer is
      already unhappy about.
    */
    const references: unknown[] = [];
    const deps = dependencies([slot()], {
      readSource: async () => ({
        modelId: 7,
        anchorStorageKey: "casting-v2/casts/op/anchor.png",
        identityRevisionId: "rev-1",
        identityText: "identity",
        technicalSchema: { subject: { sex: "female" }, wardrobe: { line: "a black slip" } },
        candidateId: 55,
        candidatePublicId: "candidate-public",
        selectedVariantId: 91,
        anchorDeltas: { worn: true },
      }),
      identityEngine: () => ({
        generateView: async (request: { prompt: string; references: unknown[] }) => {
          references.push(...request.references);
          enginePrompts.push(request.prompt);
          journal.push("render");
          return {
            bytes: Buffer.from("view"),
            contentType: "image/png",
            provenance: { model: "test-engine", provider: "test" },
          };
        },
      }) as never,
    });
    const result = await retryCastView(deps, input);
    expect(result.outcome).toBe("ready");

    /* Asked about THIS Cast's own candidate and THIS Cast's own branch. */
    expect(carried.inkAsked).toHaveBeenCalledWith(
      expect.objectContaining({ candidatePublicId: "candidate-public", anchorDeltas: { worn: true } }),
    );
    expect(carried.wordsAsked).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: 55, selectedVariantId: 91 }),
    );
    /* And it reached the wire: the anchor is reference 1, her crop is 2. */
    expect(references).toHaveLength(2);
    /* Her words ride in the composed prompt, not in a second call. */
    expect(enginePrompts[0]).toContain("banded tail");
  });

  it("the same request id returns the view it already bought", async () => {
    const already = { castId: input.castId, angle: input.angle, outcome: "ready" };
    const deps = dependencies([slot()], {
      begin: async () => ({ type: "replay" as const, operationId: OPERATION_ID, result: already }),
    });
    const result = await retryCastView(deps, input);
    expect(result).toEqual(already);
    expect(deducts).toHaveLength(0);
    expect(journal).toEqual([]);
  });
});
