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
import {
  castViewRetrySubjectHash,
  hashGenerationOperationClaim,
} from "../casting/operationContract";
import { CAST_PACKAGE_VIEW_PRICE } from "./castViewPackage";
import {
  retryCastView,
  VIEW_RETRY_ALREADY_ASKING_MESSAGE,
  type ViewRetryServiceDependencies,
} from "./viewRetryService";
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
    /*
      ⚠ The `as` below means this object does NOT have to satisfy the type, so
      `reason` was the only one of the three fixtures in this file that the
      compiler did not catch when the field was added (#1347). Carried anyway:
      a fixture that is a shape the projection can never produce teaches the
      reader something false about the service under it.
    */
    retry: { priceCredits: CAST_PACKAGE_VIEW_PRICE, reason: "refunded" },
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
      /* His ruling of 2026-09-26 replaced the sentence with the row's one word,
         so the note is null and the reason is what the room reads (#1347). */
      note: null,
      refundedCredits: null,
      retry: { priceCredits: 0, reason: "unchecked" },
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
      retry: { priceCredits: 0, reason: "unchecked" },
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

  /**
   * ⚠ THE DOUBLE CHARGE HIS THIRD REPORT FOUND (#1235).
   *
   * Press Try again, leave the room, come back, press it again. Until #1235 the
   * tile offered the button because the slot knew nothing about the operation:
   * `castSlotRetryOffer` re-read `failed-refunded`, still offered 50, and
   * `beginDirectOperation` keyed on the NEW request id — so nothing refused it.
   * Two renders, two charges, one slot, and the loser's picture orphaned.
   *
   * The refusal is not a new rule bolted on: the projection marks the slot
   * `building` while its own retry runs, and this entrance re-reads the SAME
   * offer function it always has. These arms prove the refusal is FREE and
   * before the claim, and that it names what is actually happening.
   */
  it("a view already being asked for is refused FREE, and says so", async () => {
    const asking = slot({
      /* Exactly what the projection produces for a slot with a running retry —
         and `retry: undefined` is not a fixture convenience, it is what the
         offer function answers for anything that is not finished. */
      state: "building",
      url: null,
      note: null,
      retrying: true,
      retry: undefined,
    });

    await expect(retryCastView(dependencies([asking]), input)).rejects.toThrow(
      /already being asked for/,
    );
    /* Nothing claimed, nothing charged — the whole point of the card. */
    expect(journal).toEqual([]);
    expect(deducts).toHaveLength(0);
  });

  it("accepts the same press once the first one has settled", async () => {
    /*
      THE POSITIVE CONTROL, and without it the arm above proves only that some
      refusal exists. The same request, same angle, same everything — with the
      retry no longer running — goes all the way through and pays once.
    */
    const settled = slot({ state: "failed-refunded", retrying: undefined });
    const result = await retryCastView(dependencies([settled]), input);

    expect(result.outcome).toBe("ready");
    expect(deducts).toEqual([
      { amount: CAST_PACKAGE_VIEW_PRICE, reference: `op:${OPERATION_ID}:charge` },
    ]);
  });

  it("distinguishes the two free refusals by their sentence", async () => {
    /*
      One refusal, two facts. "You cannot ask for that one" is WRONG about a
      view being made right now, and a customer who has just pressed a button is
      owed the reason it did nothing. The arm is here rather than on the
      constants because the branch is what could get them the wrong way round.
    */
    const nothing = slot({ state: "ready", url: "https://cdn.example/x.png", retry: undefined });
    await expect(retryCastView(dependencies([nothing]), input)).rejects.toThrow(
      /isn't one you can ask for again/,
    );
    const asking = slot({ state: "building", url: null, retrying: true, retry: undefined });
    await expect(retryCastView(dependencies([asking]), input)).rejects.toThrow(
      /already being asked for/,
    );
  });

  /**
   * ⚠ THE CLAIM AND THE BUSY READ MUST BE ABOUT THE SAME THING — ASSERTED AT
   * THE WIRE (#1235, invariant 5).
   *
   * The refusal above works because `listRunningViewRetryAngles` recognises
   * THIS claim's row by recomputing its subject hash. `generation_operations`
   * stores `payloadHash` and no payload, so that hash is the only thing
   * connecting a running operation to a slot — and if this entrance ever sends
   * a different payload shape, every arm in this file stays green while the
   * double charge quietly returns.
   *
   * So the claim is captured as it is MADE and hashed, rather than compared to a
   * constant near it. The negative control is the same hash for the wrong angle:
   * a shape that hashed identically for every view would pass the positive half
   * and destroy the per-slot independence his second report asked for.
   */
  it("claims a subject the busy read can recognise", async () => {
    const claims: Array<{ kind: string; modelId?: number | null; payload: unknown }> = [];
    const deps = dependencies([slot()], {
      begin: async (claim) => {
        claims.push(claim as never);
        journal.push("claim");
        return { type: "execute" as const, operationId: OPERATION_ID };
      },
    });

    await retryCastView(deps, input);

    expect(claims).toHaveLength(1);
    const claimed = hashGenerationOperationClaim({
      clientRequestId: input.clientRequestId,
      kind: claims[0]!.kind as never,
      modelId: claims[0]!.modelId,
      payload: claims[0]!.payload,
    });
    expect(claimed).toBe(castViewRetrySubjectHash({
      modelId: 7,
      castId: input.castId,
      angle: input.angle,
    }));
    /* The control: the reader must not recognise a DIFFERENT view as this one. */
    expect(claimed).not.toBe(castViewRetrySubjectHash({
      modelId: 7,
      castId: input.castId,
      angle: "closeUp",
    }));
  });

  it("locks THIS SLOT at the claim, and re-proves it when the money moves", async () => {
    /*
      ONE SLOT, ONE TRY AGAIN (#1257) — asserted at the WIRE (invariant 5).

      The admission read two arms up is the refusal a customer normally meets;
      it is a READ, and the window between it and the claim is a few hundred
      milliseconds because the entrance still has her render source and her
      signed face to fetch. The lock is what closes that window, and the only
      honest place to assert it is the outgoing claim.
    */
    const claims: Array<{ lockKey?: string; lockBusyMessage?: string }> = [];
    const proofs: Array<string | undefined> = [];
    const deps = dependencies([slot()], {
      begin: async (claim) => {
        claims.push(claim as never);
        return { type: "execute" as const, operationId: OPERATION_ID };
      },
      markRunning: (async (start: { requiredLockKey?: string }) => {
        proofs.push(start.requiredLockKey);
        return { operationId: OPERATION_ID, chargeReferenceId: `op:${OPERATION_ID}:charge` };
      }) as ViewRetryServiceDependencies["markRunning"],
    });

    await retryCastView(deps, input);

    expect(claims).toHaveLength(1);
    expect(claims[0]!.lockKey).toBe("cast-view:7:backFull");
    /* The sentence travels with the key, so the customer who loses the race is
       told what the customer who pressed twice slowly is told. */
    expect(claims[0]!.lockBusyMessage).toBe(VIEW_RETRY_ALREADY_ASKING_MESSAGE);
    /* Re-proved immediately before the deduct — the shape every other
       lock-taking road uses. */
    expect(proofs).toEqual(["cast-view:7:backFull"]);
  });

  it("a second view may be asked for while the first one renders — the key is per slot", async () => {
    /*
      HIS SECOND REPORT, GUARDED FROM THE OTHER SIDE (#1235, #1257).

      A `model:` key would have served the exclusion and re-broken this: asking
      for her profile while her close-up renders is a thing the product does on
      purpose, and a Cast-wide lock refuses it. The two keys must differ.
    */
    const keys: Array<string | undefined> = [];
    const capture = (slots: CastSlotProjection[]) => dependencies(slots, {
      begin: async (claim: { lockKey?: string }) => {
        keys.push(claim.lockKey);
        return { type: "execute" as const, operationId: OPERATION_ID };
      },
    });

    await retryCastView(capture([slot()]), input);
    await retryCastView(
      capture([slot({ angle: "closeUp", label: "Close-up" })]),
      { ...input, angle: "closeUp" },
    );

    expect(keys).toEqual(["cast-view:7:backFull", "cast-view:7:closeUp"]);
    expect(new Set(keys).size).toBe(2);
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
