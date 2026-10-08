import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderError } from "../providers/types";

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
/*
  THE SETTLED LINE'S SINK (#1608).

  `vi.hoisted` rather than a bare `const`: `vi.mock` is lifted above this file's
  static imports, and the module under test is imported statically at the bottom
  of the import block — so a plain const declared here would still be in its
  temporal dead zone when the factory first runs.

  Only `info` is captured and every arm filters on the message, because this mock
  replaces `createModuleLogger` for EVERY module the suite pulls in — the
  orchestrator's own per-attempt lines come through the same sink and would
  otherwise be counted as settles.
*/
const { loggedInfo } = vi.hoisted(() => ({ loggedInfo: [] as unknown[][] }));
vi.mock("../logging/logger", () => {
  const sink = (...args: unknown[]) => { loggedInfo.push(args); };
  const shape = { info: sink, warn: () => {}, error: () => {}, debug: () => {} };
  return { logger: shape, createModuleLogger: () => shape };
});

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
import { CASTING_V2_VIEW_RETRY_PRICE_CREDITS } from "../casting/castingCreditCosts";
import { CAST_PACKAGE_VIEW_PRICE } from "./castViewPackage";

/**
 * TWO PRICES SINCE 2026-10-01, AND THIS SUITE READ ONE CONSTANT FOR BOTH.
 *
 * ⚠ **#1601 item 1 made the paid Try again its own price (1,850 ledger / 370
 * display) where it had been a view's (1,000 / 200).** Every arm below that
 * said `CAST_PACKAGE_VIEW_PRICE` was saying one of two different things, and
 * while the numbers agreed nothing could tell them apart:
 *
 *   • what went BACK for the original view — the view's own slice, which is
 *     what was charged for it. Still `CAST_PACKAGE_VIEW_PRICE`.
 *   • what asking AGAIN costs — the Try again price, which is what this
 *     service charges, refunds and writes onto the new row.
 *
 * The slot fixtures keep the first; every assertion about this operation's own
 * money takes the second.
 */
const TRY_AGAIN_PRICE = CASTING_V2_VIEW_RETRY_PRICE_CREDITS;
import { castPronouns } from "./castPronouns";
import { outfitReferenceClause } from "./outfitPlate";
import { CONFORMANCE_AXES } from "./viewConformance";
import {
  deliveredOutfitKeysFrom,
  retryCastView,
  VIEW_RETRY_ALREADY_ASKING_MESSAGE,
  type ViewRetryServiceDependencies,
} from "./viewRetryService";
import type { CastSlotProjection } from "./castProjection";

const journal: string[] = [];
const deducts: Array<{ amount: number; reference: string }> = [];
const refunds: Array<{ amount: number; reference: string }> = [];
const committed: Array<{ angle: string; pointsCost: number; provenance: Record<string, unknown> }> = [];
/** The fenced exit's handoffs (#2073) — the one write that exit may make. */
const handoffs: Array<{ userId: number; operationId: string }> = [];
let chargeSucceeds = true;
let refundRecords = true;
/**
 * What the engine does on each attempt, oldest first; the last value repeats.
 *
 * ⚠ **`bought` AND `unreachable` ARE THE #1966 PAIR, and they differ only
 * in whether the provider FINISHED.** `bought` is the shape `falTransport.ts`
 * raises after a job reports `COMPLETED` — the frame exists, we were billed for
 * it, and asking again renders a NEW one. `unreachable` is the same class with
 * the job never run. The arrival loop must tell them apart, and the two arms
 * below are what say it does.
 */
let engineAnswers: Array<"ok" | "throw" | "bought" | "unreachable"> = ["ok"];
let engineCalls = 0;
const enginePrompts: string[] = [];
/**
 * WHICH FULL-LENGTH VIEWS HAVE ALREADY BEEN DELIVERED (#1474).
 *
 * ⚠ **The default is EMPTY on purpose.** Every arm written before #1474 is
 * about the fresh-plate road, and an empty map is exactly the state that takes
 * it — so those arms keep asserting what they were written to assert, and the
 * sibling road is reached only by the arms that ask for it.
 */
let deliveredOutfitKeys: Partial<Record<"frontFull" | "backFull", string>> = {};
/** Every storage key the service asked for an outfit reference, in order. */
const outfitReads: string[] = [];

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
    retry: { priceCredits: TRY_AGAIN_PRICE, reason: "refunded" },
    ...overrides,
  } as CastSlotProjection;
}

function dependencies(
  slots: CastSlotProjection[],
  overrides: Partial<ViewRetryServiceDependencies> = {},
): ViewRetryServiceDependencies {
  return {
    /*
      ⚠ **A SPENT-FREE-ASK LIST STOOD IN THIS FIXTURE AND IS RETIRED — #1903
      slice 3.** It was EMPTY by default so that every arm kept the pre-#1601
      answer (an unchecked view's first ask is free), and an arm wanting the
      SECOND ask overrode `readSlots` to say which angle was spent. There is no
      free ask to ration now, so the read carries two facts instead of three and
      `viewRetryNoFreeAsk.test.ts` owns the rule; what this file owns is still
      what the till does with it.

      ⚠ The lesson below is KEPT because it is about the READING and not about
      the deleted field, and it was paid for twice — once when the field arrived
      and again when it left: 36 arms in this file went red at RUN time on the
      removed property, and `pnpm check` would have named the line instead.
      Driven after the fact — the bare
      `tsc -p tsconfig.json` that had been run exits 0 (the root project excludes
      every test file) while `pnpm check` exits 2 and points at the property.
      Two of its five projects exist to typecheck tests, and BOTH of them include
      this file and report the same TS2322 when run alone: `check:casting-tests`
      and `check:server-tests`. Which one a `pnpm check` run names is a race —
      the five run in parallel and a failure cuts the others off, measured as
      casting-tests on three runs of four and server-tests on the other — so no
      single project name belongs in this paragraph as the one that catches it.
      A hand-assembled typecheck is not the typecheck.
    */
    readSlots: async () => ({
      /* `ready` on every fixture in this file: a Try again is only ever
         offered on a terminal package, and `castSlotRetryOffer` refuses any
         slot that is not. The field arrived with the redo (#1903), which reads
         it to refuse a Cast still being made. */
      modelId: 7, status: "ready" as const, slots, deliveredOutfitKeys,
    }),
    readOutfitBytes: async (key: string) => {
      outfitReads.push(key);
      return { bytes: Buffer.from("delivered-sibling-view"), contentType: "image/png" };
    },
    readSource: async () => ({
      modelId: 7,
      anchorStorageKey: "casting-v2/casts/op/anchor.png",
      identityRevisionId: "rev-1",
      identityText: "identity",
      technicalSchema: { subject: { sex: "female" } },
      /* No brief on record — the default fixture is a Cast with no source roll,
         which is 4 of 6 minted casts (#1278 part 1). */
      briefText: null,
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
        /* The transport's own error objects, built the way `falTransport.ts`
           builds them (#1966). */
        if (answer === "bought") {
          throw new ProviderError("transport", "could not download fal.ai result", {
            providerRef: "req-bought",
            completed: true,
          });
        }
        if (answer === "unreachable") {
          throw new ProviderError("transport", "fal.ai unreachable");
        }
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
        intact: { pass: true, note: "" },
        people: { pass: true, note: "" },
      },
    })) as never,
    storeImage: async () => ({ key: "views/new.png", url: "https://public/views/new.png" }),
    deleteObject: async () => ({ success: true as const }),
    wait: async () => undefined,
    handoffToRecovery: (async (request: { userId: number; operationId: string }) => {
      journal.push("handoff");
      handoffs.push({ userId: request.userId, operationId: request.operationId });
    }) as ViewRetryServiceDependencies["handoffToRecovery"],
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
  handoffs.length = 0;
  enginePrompts.length = 0;
  chargeSucceeds = true;
  refundRecords = true;
  engineAnswers = ["ok"];
  engineCalls = 0;
  loggedInfo.length = 0;
  deliveredOutfitKeys = {};
  outfitReads.length = 0;
  receipts.success.mockClear();
  receipts.failure.mockClear();
  carried.inkAsked.mockClear();
  carried.wordsAsked.mockClear();
});

describe("try again on one view — what moves, and in what order", () => {
  it("⚠ a retried view carries the SAME brief the original five were composed from (#1278)", async () => {
    /*
      A Try again replaces one tile of a package. If the brief reached the Sign
      road and not this one, the replacement would be composed from a different
      prompt than the slot beside it — the unkeyed half outliving its keyed
      sibling, and invisible because both pictures look plausible.

      Driven at the WIRE (working law 5): the assertion is on the prompt the engine
      was handed, not on the field being set near it.
    */
    const deps = dependencies([slot()], {
      readSource: async () => ({
        modelId: 7,
        anchorStorageKey: "casting-v2/casts/op/anchor.png",
        identityRevisionId: "rev-1",
        identityText: "identity",
        technicalSchema: { subject: { sex: "female" } },
        briefText: "A pale cyberpunk woman in a worn white qipao dress with industrial straps.",
        candidateId: null,
        candidatePublicId: null,
        selectedVariantId: null,
        anchorDeltas: null,
      }),
    });
    const result = await retryCastView(deps, input);
    expect(result.outcome).toBe("ready");
    expect(enginePrompts).toHaveLength(1);
    expect(enginePrompts[0]).toContain("DESCRIPTION: A pale cyberpunk woman in a worn white qipao dress");
    /* And the sentence that would contradict it is gone from the retried prompt too. */
    expect(enginePrompts[0]).not.toContain("there is no written description of this person");
  });

  it("a retried view of a Cast with NO brief composes what it always did (#1278)", async () => {
    /* The other direction, so the arm above cannot pass by always being true:
       4 of 6 minted casts have no source roll and must not move. */
    const result = await retryCastView(dependencies([slot()]), input);
    expect(result.outcome).toBe("ready");
    expect(enginePrompts).toHaveLength(1);
    expect(enginePrompts[0]).toContain("there is no written description of this person");
    expect(enginePrompts[0]).not.toMatch(/^DESCRIPTION: /m);
  });

  it("a REFUNDED view costs the Try again price, lands, and keeps the charge", async () => {
    const result = await retryCastView(dependencies([slot()]), input);
    expect(result.outcome).toBe("ready");
    expect(result.chargedCredits).toBe(TRY_AGAIN_PRICE);
    expect(result.refundedCredits).toBe(0);
    expect(deducts).toHaveLength(1);
    expect(refunds).toHaveLength(0);
    /* Rows before money, dispatch after money — the house order. */
    expect(journal).toEqual(["claim", "running", "deduct", "render", "commit"]);
    /* The sweep's fork variable, written with the picture in one statement. */
    expect(committed[0]?.provenance.retryOperationId).toBe(OPERATION_ID);
    expect(committed[0]?.pointsCost).toBe(TRY_AGAIN_PRICE);
  });

  /*
    ⚠ **THE PER-VIEW HALF OF #1966's MONEY FINDING (the relay, on PR
    #1982).** The sheet road's arrival loop stopped re-buying a frame the
    provider had already finished; this is the OTHER arrival loop —
    `renderViewAttempts`, which a Try again and a redo render on, and it had the
    identical defect. Four of fal's faults are raised after the job reports
    `COMPLETED` and every one of their classes is retryable, so a frame already
    paid for bought up to two more.

    Her money is the same either way — this slice refunds whether the loop gave
    up once or three times. What changes is what the HOUSE spends, and what she
    stops doing is waiting through spaced retries for a refund she is already
    owed.
  */
  it("asks ONCE for a frame the provider already finished, and still refunds the slice", async () => {
    engineAnswers = ["bought"];
    const result = await retryCastView(dependencies([slot()]), input);

    expect(engineCalls, "a frame that was already bought was re-bought").toBe(1);
    expect(result.outcome).toBe("failed");
    /* Her money is untouched by the change: the slice comes back exactly as it
       does for any view that did not arrive. */
    expect(result.refundedCredits).toBe(TRY_AGAIN_PRICE);
    expect(refunds).toHaveLength(1);
  });

  it("THE CONTROL: the same class with the job never run is still asked more than once", async () => {
    engineAnswers = ["unreachable"];
    await retryCastView(dependencies([slot()]), input);

    expect(
      engineCalls,
      "a job that never ran stopped being re-asked — it is still owed its attempts",
    ).toBeGreaterThan(1);
  });

  it("a REFUNDED view that fails again gives the Try again price back under THIS operation", async () => {
    engineAnswers = ["throw"];
    const result = await retryCastView(dependencies([slot()]), input);
    expect(result.outcome).toBe("failed");
    expect(result.refundedCredits).toBe(TRY_AGAIN_PRICE);
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

  /**
   * ⚠ **FIVE ARMS ON THE FREE ROAD STOOD HERE AND ARE REPLACED BY ONE ON THE
   * ROAD THAT REPLACED IT — #1903 slice 3, his ruling of 2026-10-07.**
   *
   * They drove: an unjudged view charged nothing; the SECOND ask on it charged
   * (#1601 item 4's one-free-then-paid rule); that second ask refunding when it
   * failed; a spent ask on one angle leaving another alone; and a free ask that
   * failed refunding nothing. Every one of them was right about the rule it
   * tested, and **the rule is deleted** — there is no free per-view ask, so
   * there is nothing to ration and no second price to reach.
   *
   * What replaces them is the arm below, and it is deliberately the HARDEST of
   * the five rather than the easiest: the stale free button. That is the only
   * one of these shapes that can still arrive at the till in production — a tab
   * left open before this deploy, carrying `priceCredits: 0`, pressed after it.
   * The suite's own neighbour ("the server re-reads the offer and never trusts
   * the button") is the rule it rests on; this holds that rule against the
   * specific payload this change creates.
   */
  it("⚠ a STALE free button from before #1903 is REFUSED, not honoured at 0", async () => {
    /*
      Byte-for-byte the slot the deleted arms drove — `ready`, holding her
      picture, with a `retry` saying the ask is free. A client that cached this
      before the deploy sends exactly this.

      `unjudged` is deliberately NOT set: it is off the wire now, so a payload
      that still carries it would be testing a field the server no longer reads.
      What makes this press refusable is the SLOT's state, which is the only
      thing `castSlotRetryOffer` looks at.
    */
    const stale = slot({
      state: "ready",
      url: "https://cdn.example/view.png",
      note: null,
      refundedCredits: null,
      retry: { priceCredits: 0, reason: "refunded" },
    });
    await expect(retryCastView(dependencies([stale]), input)).rejects.toThrow(TRPCError);
    /*
      THE MONEY ARMS, and they run in both directions.

      Not charged is the obvious half. The half that matters as much: nothing
      was CLAIMED and nothing RENDERED — so a stale free button cannot buy a 2K
      view at the house's expense either, which is the loop #1601 item 4 was
      filed about and this closes by removing the road rather than metering it.
    */
    expect(deducts).toHaveLength(0);
    expect(refunds).toHaveLength(0);
    expect(journal).toEqual([]);
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
      The client sent a retry for a view whose tile carried a price a minute ago. The
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
    /*
      ⚠ AND NO RECEIPT IS SEALED HERE — THE LEASE IS HANDED OVER (#2073).
      The fence now refuses while the sweep is mid-adjudication with the row
      still `running`; a failure receipt from this exit would land first with
      `refundedCredits: 0` over the refund the sweep is recording, and the
      sweep's own seal would then find nothing `running` to correct. The
      handoff is the positive control: this exit still does its one write.
    */
    expect(receipts.failure).not.toHaveBeenCalled();
    expect(receipts.success).not.toHaveBeenCalled();
    expect(handoffs).toEqual([{ userId: input.userId, operationId: OPERATION_ID }]);
    expect(journal.at(-1)).toBe("handoff");
  });

  it("a handoff the sweep has already overtaken still answers the customer the same way", async () => {
    /* The row was sealed before this exit ran, so the handoff (which needs
       `running`) refuses. That is logged, never thrown at her: she reads the
       same sentence, and still nothing is refunded or sealed from here. */
    const deps = dependencies([slot()], {
      commitRetried: (async () => null) as ViewRetryServiceDependencies["commitRetried"],
      handoffToRecovery: (async () => {
        throw new Error("Only the owned running operation can enter recovery");
      }) as ViewRetryServiceDependencies["handoffToRecovery"],
    });
    await expect(retryCastView(deps, input)).rejects.toThrow(/settled while it rendered/);
    expect(refunds).toHaveLength(0);
    expect(receipts.failure).not.toHaveBeenCalled();
  });

  /*
    ⚠ **A COMMIT THAT COMMITTED AND LOST ITS ACKNOWLEDGEMENT (#2080).**

    The fake below is the database's side of that fault, faithfully: the row
    is written (into `rows`, which is what `retriedViewLanded` reads — the
    stamp the real commit writes), and THEN the call throws. Before the card
    the loop's catch dropped the bytes the row points at and the failed exit
    refunded 50 credits — a refund AND a broken tile.
  */
  describe("a commit that throws after it committed (#2080)", () => {
    const LIVE_KEY = "views/new.png";
    let rows: Array<{ retryOperationId: string; storageKey: string }>;
    let dropped: string[];
    let landedAsks: number;

    function lostAck(options: { writes: boolean; landedRead?: "throws" }) {
      return dependencies([slot()], {
        commitRetried: (async (request: {
          operationId: string;
          storageKey: string;
        }) => {
          journal.push("commit");
          if (options.writes) {
            rows.push({ retryOperationId: request.operationId, storageKey: request.storageKey });
          }
          throw new Error("Connection lost: The server closed the connection.");
        }) as ViewRetryServiceDependencies["commitRetried"],
        retriedLanded: (async (request: { operationId: string }) => {
          landedAsks += 1;
          journal.push("landed?");
          if (options.landedRead === "throws") throw new Error("Connection lost again");
          return rows.some((row) => row.retryOperationId === request.operationId);
        }) as ViewRetryServiceDependencies["retriedLanded"],
        deleteObject: (async (key: string) => {
          dropped.push(key);
          return { success: true as const };
        }) as ViewRetryServiceDependencies["deleteObject"],
      });
    }

    beforeEach(() => {
      rows = [];
      dropped = [];
      landedAsks = 0;
    });

    it("THE CARD: the row landed — delivered, ONE asset, its bytes live, nothing refunded", async () => {
      const result = await retryCastView(lostAck({ writes: true }), input);

      expect(result.outcome).toBe("ready");
      expect(result.url).toBe("https://public/views/new.png");
      expect(result.chargedCredits).toBe(TRY_AGAIN_PRICE);
      expect(result.refundedCredits).toBe(0);
      expect(refunds, "a landed view was refunded").toHaveLength(0);
      /* Exactly one asset, and the object it points at was never deleted. */
      expect(rows).toEqual([{ retryOperationId: OPERATION_ID, storageKey: LIVE_KEY }]);
      expect(dropped, "the bytes the landed row points at were deleted").not.toContain(LIVE_KEY);
      /* Never another frame (#1994): one render, one commit, one question. */
      expect(engineCalls).toBe(1);
      expect(journal).toEqual(["claim", "running", "deduct", "render", "commit", "landed?"]);
      expect(receipts.success).toHaveBeenCalledTimes(1);
      expect(handoffs).toHaveLength(0);
    });

    it("CONTROL: the commit truly failed — the bytes are dropped and the 50 credits go back", async () => {
      const result = await retryCastView(lostAck({ writes: false }), input);

      expect(result.outcome).toBe("failed");
      expect(result.url).toBeNull();
      expect(result.refundedCredits).toBe(TRY_AGAIN_PRICE);
      expect(refunds).toHaveLength(1);
      expect(rows).toHaveLength(0);
      expect(dropped).toEqual([LIVE_KEY]);
      expect(landedAsks).toBe(1);
      expect(engineCalls, "a failed commit bought another frame").toBe(1);
    });

    it("CONTROL: a commit that does NOT throw never asks the question", async () => {
      await retryCastView(dependencies([slot()], {
        retriedLanded: (async () => {
          landedAsks += 1;
          return false;
        }) as ViewRetryServiceDependencies["retriedLanded"],
      }), input);
      expect(landedAsks).toBe(0);
    });

    it("the question cannot be answered — no refund, no drop, the sweep owns it", async () => {
      await expect(retryCastView(lostAck({ writes: true, landedRead: "throws" }), input))
        .rejects.toThrow(/could not be read/);

      /* Neither reading is acted on: the bytes stay for a row that may point
         at them, and no refund is written for a view she may be holding. The
         operation is left `running` — no receipt — so the sweep reads the
         asset rows and settles it. */
      expect(dropped).toHaveLength(0);
      expect(refunds).toHaveLength(0);
      expect(receipts.success).not.toHaveBeenCalled();
      expect(receipts.failure).not.toHaveBeenCalled();
      expect(engineCalls).toBe(1);
    });
  });

  it("CONTROL: a view that lands seals its receipt and never hands off", async () => {
    await retryCastView(dependencies([slot()]), input);
    expect(receipts.success).toHaveBeenCalledTimes(1);
    expect(handoffs).toHaveLength(0);
  });

  it("a refund that does not record is never reported as 'you weren't charged'", async () => {
    engineAnswers = ["throw"];
    refundRecords = false;
    const result = await retryCastView(dependencies([slot()]), input);
    expect(result.refundRecorded).toBe(false);
    expect(result.refundedCredits).toBe(0);
    expect(result.chargedCredits).toBe(TRY_AGAIN_PRICE);
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
        briefText: null,
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
   * `castSlotRetryOffer` re-read `failed-refunded`, still offered a paid ask, and
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
      { amount: TRY_AGAIN_PRICE, reference: `op:${OPERATION_ID}:charge` },
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

  it("⚠ THE CLAIM SAYS WHAT IT WILL COST, so a paid ask that dies before it runs is not read as her free one (#1767)", async () => {
    /*
      THE DEFECT, DRIVEN AS ITS OWN SEQUENCE.

      `plannedCredits = 0` is how the product recognises a FREE Try again
      (`spentFreeViewRetryFilter`, `server/db/castingV2ViewRetry.ts`). It used to
      be written by `markGenerationOperationRunning`, ONE STATEMENT AFTER the
      claim, over a schema default of 0 — so a PAID retry whose `markRunning`
      threw settled as `failed` still carrying that 0, indistinguishable from the
      free ask she had not used. Nothing was charged; she simply found her one
      free Try again on that view gone, and was asked to pay 370 credits for it.

      Asserted at the WIRE (invariant 5) rather than on the constant beside it:
      what is read is the claim the entrance actually sent. And `markRunning`
      THROWS here, which is the whole point — a version of this arm with a
      healthy `markRunning` would pass against the old code too, because the old
      code wrote the right figure one statement later.
    */
    const claims: Array<{ plannedCredits?: number }> = [];
    const deps = dependencies([slot()], {
      begin: async (claim) => {
        journal.push("claim");
        claims.push(claim as never);
        return { type: "execute" as const, operationId: OPERATION_ID };
      },
      markRunning: (async () => {
        journal.push("running");
        throw new Error("the process died between the claim and the running transition");
      }) as ViewRetryServiceDependencies["markRunning"],
    });

    /* The settle itself is the real `completeDirectOperationFailure`, which is
       not injectable here and needs a database, so the entrance rethrows rather
       than returning. That is this fixture's shape, not the product's — in
       production the row is written `failed` and the customer is told. What
       matters for THIS arm is the sequence and what the claim carried, both of
       which are complete before the settle is reached. */
    await expect(retryCastView(deps, input)).rejects.toThrow(/died between the claim and the running transition/);

    /* The ask really did die inside the gap — the defect's own sequence, not a
       convenient one. Nothing was charged, which was always correct. */
    expect(journal).toEqual(["claim", "running"]);
    expect(deducts).toEqual([]);

    /* And the claim had already said what it was going to cost. */
    expect(claims).toHaveLength(1);
    expect(
      claims[0]!.plannedCredits,
      "the claim did not carry the price — a paid Try again that dies here reads as her spent free one",
    ).toBe(TRY_AGAIN_PRICE);
    expect(claims[0]!.plannedCredits, "the fixture's price is the default 0 — this arm proves nothing").not.toBe(0);
  });

  /*
    ⚠ **THE OTHER-DIRECTION ARM STOOD HERE AND IS RETIRED — #1903 slice 3, and
    its JOB IS DISCHARGED RATHER THAN DROPPED.**

    It drove a FREE ask and held `plannedCredits` at 0, as the control stopping
    the arm above from being satisfied by an entrance that wrote the paid price
    onto every claim — which would have spent a customer's free ask the moment
    she used it.

    **With no free ask there is no second value on this road, so the worry it
    guarded cannot exist**: writing the Try again price onto every
    `castingV2.viewRetry` claim is now simply correct. What survives of the
    control is the line immediately above — `.not.toBe(0)` — which is what stops
    the sibling passing on a fixture whose price was the column default all
    along, and that is the half that was ever about this suite's own honesty.
  */

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

describe("deliveredOutfitKeysFrom — which key belongs to which angle (#1474)", () => {
  /*
    ⚠ **THE TRANSPOSITION ARM.** TypeScript cannot see this defect: both keys
    are `string`, so a mapping that filed the front view's key under `backFull`
    would typecheck, and every other arm in this file would stay green — while a
    `backFull` retry dressed itself from the very picture the customer pressed
    Try again to be rid of. That is the only reason the mapping is a separate,
    exported, pure function.
  */
  const row = (overrides: Record<string, unknown>) => ({
    id: 100,
    modelId: 7,
    viewType: "frontFull",
    resolution: "2K",
    storageUrl: "https://cdn.example/view.png",
    storageKey: "key",
    pointsCost: CAST_PACKAGE_VIEW_PRICE,
    pinned: false,
    status: null,
    provenance: {},
    createdAt: new Date(),
    ...overrides,
  }) as never;

  it("⚠ files each angle's key under ITS OWN angle", () => {
    const keys = deliveredOutfitKeysFrom([
      row({ id: 200, viewType: "backFull", storageKey: "THE-BACK-KEY" }),
      row({ id: 100, viewType: "frontFull", storageKey: "THE-FRONT-KEY" }),
    ]);
    expect(keys).toEqual({ frontFull: "THE-FRONT-KEY", backFull: "THE-BACK-KEY" });
  });

  it("newest wins per angle, and the other three views are never in the map", () => {
    const keys = deliveredOutfitKeysFrom([
      row({ id: 300, viewType: "frontFull", storageKey: "NEW" }),
      row({ id: 200, viewType: "frontFull", storageKey: "OLD" }),
      row({ id: 100, viewType: "closeUp", storageKey: "A-CLOSE-UP" }),
    ]);
    expect(keys).toEqual({ frontFull: "NEW" });
  });

  it("a row with a URL and NO key is left out — bytes need a key", () => {
    /* Then the retry mints a plate exactly as it did before #1474, rather than
       asking storage for `null`. */
    expect(deliveredOutfitKeysFrom([row({ viewType: "frontFull", storageKey: null })])).toEqual({});
    expect(deliveredOutfitKeysFrom([row({ viewType: "frontFull", storageKey: "" })])).toEqual({});
  });

  it("a written-off view is not a delivered one", () => {
    expect(deliveredOutfitKeysFrom([
      row({
        viewType: "frontFull",
        storageUrl: "",
        storageKey: "a-key-on-a-confession",
        status: { state: "failed", reason: "didn't arrive", refunded: CAST_PACKAGE_VIEW_PRICE },
      }),
    ])).toEqual({});
  });
});

describe("a retried full-length view wears the outfit it already has — #1474", () => {
  /*
    THE DEFECT, IN ONE SENTENCE: a Try again used to mint a FRESH plate, and a
    fresh plate is a fresh invention — so the retried back could arrive in a
    different outfit from the front the customer is already holding. That is his
    own hem-and-shoes complaint re-run on the one slot he disliked.

    Every arm below drives the real service and reads the OUTGOING request
    (invariant 5). The fixture's angle is `backFull`, so the sibling it should
    dress from is the delivered `frontFull`.
  */

  /** Capture both doors at once: what the plate engine was asked, and what the
   *  view engine was sent. A plate arm that only counted renders could not tell
   *  "no plate" from "a plate nobody used". */
  function watchBothDoors() {
    const plateRequests: Array<{ references: Array<{ bytes: Buffer }> }> = [];
    const viewRequests: Array<{ prompt: string; references: Array<{ bytes: Buffer }> }> = [];
    return {
      plateRequests,
      viewRequests,
      overrides: {
        outfitPlateEngine: () => ({
          editWithReferences: async (request: { references: Array<{ bytes: Buffer }> }) => {
            plateRequests.push({ references: request.references });
            return { bytes: Buffer.from("plate-bytes"), contentType: "image/png" };
          },
        }),
        identityEngine: () => ({
          generateView: async (request: {
            prompt: string;
            references: Array<{ bytes: Buffer }>;
          }) => {
            viewRequests.push({ prompt: request.prompt, references: request.references });
            return {
              bytes: Buffer.from("view"),
              contentType: "image/png",
              provenance: { model: "test-engine", provider: "test" },
            };
          },
        /* `as never` is this file's own idiom for the identity engine: the real
           type is the provider's and a fake only needs `generateView`. */
        }) as never,
      } as Partial<ViewRetryServiceDependencies>,
    };
  }

  it("⚠ sends the DELIVERED SIBLING as the outfit reference and renders NO plate", async () => {
    deliveredOutfitKeys = { frontFull: "casting-v2/casts/op/views/front.png" };
    const watch = watchBothDoors();

    await retryCastView(dependencies([slot()], watch.overrides), input);

    /* 1 · The sibling's own key was read — the one the projection named, not a
       key this test invented a second way. */
    expect(outfitReads).toEqual(["casting-v2/casts/op/views/front.png"]);
    /* 2 · NO PLATE. This is the money half: the plate is house-money and 56–71
       seconds (#1471), and neither is spent when the outfit already exists. A
       zero here is the whole of #1474's saving, and it is asserted as "never
       asked" rather than inferred from a picture. */
    expect(watch.plateRequests).toEqual([]);
    /* 3 · The delivered bytes reached the OUTGOING view request, after the
       anchor. Not "a reference was passed" — the right picture. */
    expect(watch.viewRequests).toHaveLength(1);
    const references = watch.viewRequests[0].references;
    expect(references[0].bytes).toEqual(Buffer.from("anchor"));
    expect(references[references.length - 1].bytes).toEqual(Buffer.from("delivered-sibling-view"));
    /* 4 · And the prompt says what that picture IS. Derived from the clause
       rather than retyped (working law 4). */
    expect(watch.viewRequests[0].prompt).toContain(
      outfitReferenceClause({ ordinal: 2, side: "front", kind: "delivered", pronouns: castPronouns({ subject: { sex: "female" } }) }),
    );
  });

  it("⚠ names the SIBLING's side, never the retried view's — the defect the old default hid", async () => {
    /*
      THE ARM THAT WOULD HAVE CAUGHT THE WORST VERSION OF THIS CHANGE.

      A `backFull` retry is dressed by a picture facing the FRONT. The clause
      before #1474 read its side from `input.outfitPlateSide ?? "front"` — two
      optional fields that had to agree — and on the plate road the view's side
      and the picture's side are the same, so nothing could tell them apart.
      They are opposites here: a clause saying "from behind" would order a paid
      render to copy garments from a side its reference does not show.
    */
    deliveredOutfitKeys = { frontFull: "casting-v2/casts/op/views/front.png" };
    const watch = watchBothDoors();

    await retryCastView(dependencies([slot()], watch.overrides), input);

    const prompt = watch.viewRequests[0].prompt;
    /* The reference faces the front, and the sentence says so. */
    expect(prompt).toContain("in the outfit this person wears in every picture of them, seen from the front");
    /* The positive control the loose form would pass by accident: the retried
       view IS the back view, and its own directive still says so. So this pair
       proves the clause and the directive disagree on purpose rather than
       proving the word "front" appears somewhere. */
    expect(prompt).toContain("FULL BODY FROM BEHIND");
    expect(prompt).not.toContain("in the outfit this person wears in every picture of them, seen from behind");
  });

  it("mints a fresh plate when NO sibling has landed — the road before #1474, kept", async () => {
    /* A first Try again on a Sign whose other full-length view failed, and every
       Cast older than path E. Nothing about that road moves. */
    deliveredOutfitKeys = {};
    const watch = watchBothDoors();

    await retryCastView(dependencies([slot()], watch.overrides), input);

    expect(outfitReads).toEqual([]);
    expect(watch.plateRequests).toHaveLength(1);
    /* The plate is edited from her master (#1471) — unchanged by this card. */
    expect(watch.plateRequests[0].references[0].bytes).toEqual(Buffer.from("anchor"));
  });

  it("falls back to a fresh plate when the sibling's object cannot be read — never a refusal", async () => {
    /*
      The row says a picture is there and the bucket disagrees. The customer has
      been charged for a VIEW, so this drops one rung and renders; it must not
      become a failed retry over a reference nobody sees.
    */
    deliveredOutfitKeys = { frontFull: "casting-v2/casts/op/views/gone.png" };
    const watch = watchBothDoors();

    const result = await retryCastView(
      dependencies([slot()], {
        ...watch.overrides,
        readOutfitBytes: async () => { throw new Error("NoSuchKey"); },
      } as Partial<ViewRetryServiceDependencies>),
      input,
    );

    expect(result.outcome).toBe("ready");
    expect(result.refundedCredits).toBe(0);
    expect(watch.plateRequests).toHaveLength(1);
  });

  it("a close-up retry is untouched: no sibling read, no plate, no outfit clause", async () => {
    /* The inertness half. Three of the five views have never had an outfit
       reference and this card must not give them one. */
    deliveredOutfitKeys = { frontFull: "casting-v2/casts/op/views/front.png" };
    const watch = watchBothDoors();

    await retryCastView(
      dependencies([slot({ angle: "closeUp" })], watch.overrides),
      { ...input, angle: "closeUp" },
    );

    expect(outfitReads).toEqual([]);
    expect(watch.plateRequests).toEqual([]);
    expect(watch.viewRequests[0].prompt).not.toContain("THE OUTFIT — reference");
  });
});

describe("a retry's plate is edited from her master too — #1471", () => {
  it("hands the plate engine the anchor this retry is about to render from", async () => {
    /*
      ⚠ **THE RETRY ROAD HAD NO PLATE ARM AT ALL**, and #1471 gave
      `renderOutfitPlate` a required `anchor`. TypeScript proves a value was
      passed; only a driven arm proves it is the RIGHT picture — the anchor
      this retry fetched — rather than some other buffer in scope.

      The default fixture's angle is `backFull`, which is a plate angle, so the
      plate road is the one these arms were already walking; what was missing
      was anyone looking at what went out.
    */
    const requests: Array<{ references: Array<{ bytes: Buffer; contentType: string }> }> = [];
    const plateBytes = await (await import("sharp")).default({
      create: { width: 8, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
    }).png().toBuffer();

    await retryCastView(
      dependencies([slot()], {
        outfitPlateEngine: () => ({
          editWithReferences: async (request: {
            references: Array<{ bytes: Buffer; contentType: string }>;
          }) => {
            requests.push({ references: request.references });
            return { bytes: plateBytes, contentType: "image/png" };
          },
        }),
      } as Partial<ViewRetryServiceDependencies>),
      input,
    );

    expect(requests).toHaveLength(1);
    /* `storageReadBytes` is mocked to answer `Buffer.from("anchor")` for
       `anchorStorageKey` — so this is the retry's own master, read back at the
       wire rather than assumed from the call site. */
    expect(requests[0].references).toHaveLength(1);
    expect(requests[0].references[0].bytes).toEqual(Buffer.from("anchor"));
    /* The words-only road, named so its return reddens here. */
    expect(requests[0].references).not.toEqual([]);
  });
});

/**
 * ⚠ **A TRY AGAIN TAKES THE SAME RULE, BECAUSE IT TAKES THE SAME LOOP —
 * #1612 part 2, his ruling 2026-09-30.**
 *
 * The Sign's five views and a Try again both render through
 * `renderViewAttempts`, so `viewConformanceRefuses` covers both roads from one
 * call site. These arms exist anyway, at this altitude, because the MONEY is
 * settled here and not there: a retry charges at dispatch and refunds when the
 * view does not arrive, so a rule that changed what "arrive" means changes what
 * this file pays out. Arms that only lived beside the orchestrator would prove
 * the branch and say nothing about the till.
 */
describe("only a catastrophe takes a retried picture away", () => {
  /*
    ⚠ **#1903 REPLACED THE AXES THIS FIXTURE NAMED.** It built an `angle` and a
    `wardrobe` verdict, because those were the two that delivered. They do not
    exist; the two that replace them are catastrophes and they REFUSE. So the
    delivering arm below is driven on the road that still delivers — a judge
    that could not answer at all — which is the retry's half of D-246 and is
    the only remaining way a Try again arrives unchecked.
  */
  const rejectingJudge = (axes: Partial<Record<"identity" | "intact" | "people", boolean>>) =>
    (() => async () => ({
      pass: false,
      method: "judge:test",
      axes: {
        identity: { pass: axes.identity !== false, note: "" },
        intact: { pass: axes.intact !== false, note: "" },
        people: { pass: axes.people !== false, note: "" },
      },
    })) as never;

  /** The retry's D-246 road: nobody could look, so the picture is delivered. */
  const unreachableJudge = (() => async () => ({
    pass: false,
    method: "unavailable",
    unjudged: true,
    axes: {
      identity: { pass: false, note: "the view could not be checked" },
      intact: { pass: false, note: "the view could not be checked" },
      people: { pass: false, note: "the view could not be checked" },
    },
  })) as never;

  it("a PAID try again nobody could judge still ARRIVES — charged, kept, not refunded", async () => {
    const refunded = slot({
      state: "failed-refunded",
      refundedCredits: CAST_PACKAGE_VIEW_PRICE,
      retry: { priceCredits: TRY_AGAIN_PRICE, reason: "refunded" },
    });
    const result = await retryCastView(
      dependencies([refunded], { judge: unreachableJudge }),
      input,
    );

    expect(result.outcome).toBe("ready");
    expect(result.chargedCredits).toBe(TRY_AGAIN_PRICE);
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toHaveLength(0);
    expect(committed).toHaveLength(1);
  });

  it("⚠ and one whose IDENTITY is turned down still does not arrive, and the money goes back", async () => {
    const refunded = slot({
      state: "failed-refunded",
      refundedCredits: CAST_PACKAGE_VIEW_PRICE,
      retry: { priceCredits: TRY_AGAIN_PRICE, reason: "refunded" },
    });
    const result = await retryCastView(
      dependencies([refunded], { judge: rejectingJudge({ identity: false }) }),
      input,
    );

    expect(result.outcome).toBe("failed");
    expect(result.refundedCredits).toBe(TRY_AGAIN_PRICE);
    expect(refunds).toHaveLength(1);
    /* No new failure marker — the confession already on the slot is still true. */
    expect(committed).toHaveLength(0);
  });

  /*
    A FREE try again on an unchecked view that comes back unchecked again is
    still delivered and still free. That is not a loophole: the customer asked
    for a different picture and got one, and it is still a picture nothing can
    vouch for, which is the entire basis of the free offer.

    ⚠ Driven on the unreachable judge since #1903 — `wardrobe` was the axis
    that used to produce "unchecked again" and it no longer exists.
  */
  /**
   * ⚠ **THIS ARM DROVE A FREE ASK UNTIL #1903 SLICE 3 AND NOW DRIVES A PAID
   * ONE — same question, and the money answer is the one that moved.**
   *
   * Its question is D-246's and is untouched: a retry whose own result nobody
   * could judge **delivers** rather than being thrown away. What changed is
   * that the only Try again left is PAID, so the interesting half is no longer
   * *"nothing is charged"* but **"the charge STANDS"** — an unjudgeable result
   * is not a refund, because the customer has the picture.
   */
  it("a PAID try again that comes back unjudged still delivers, and the charge STANDS", async () => {
    const result = await retryCastView(
      dependencies([slot()], { judge: unreachableJudge }),
      input,
    );

    expect(result.outcome).toBe("ready");
    /* Delivered, and paid for — the two halves of D-246 under his pricing. */
    expect(committed).toHaveLength(1);
    expect(result.chargedCredits).toBe(TRY_AGAIN_PRICE);
    expect(deducts).toHaveLength(1);
    /*
      AND NOTHING WENT BACK. This is the arm that would catch a reader treating
      "could not be judged" as a failure: she would keep the picture AND the
      money, which is the shape #2073 was filed about on the other road.
    */
    expect(refunds).toHaveLength(0);
  });

  /*
    ⚠ **HIS OTHER TWO CATASTROPHES REACH THIS TILL TOO — #1903.** The retry
    charges at dispatch and refunds when the view does not arrive, so a new
    refusal road is a new refund road, and a rule proven only beside the
    orchestrator would say nothing about what this file pays out.
  */
  for (const axis of ["intact", "people"] as const) {
    it(`a PAID try again refused on ${axis} does not arrive, and the money goes back`, async () => {
      const refunded = slot({
        state: "failed-refunded",
        refundedCredits: CAST_PACKAGE_VIEW_PRICE,
        retry: { priceCredits: TRY_AGAIN_PRICE, reason: "refunded" },
      });
      const result = await retryCastView(
        dependencies([refunded], { judge: rejectingJudge({ [axis]: false }) }),
        input,
      );

      expect(result.outcome).toBe("failed");
      expect(result.refundedCredits).toBe(TRY_AGAIN_PRICE);
      expect(refunds).toHaveLength(1);
    });
  }
});

/**
 * ⚠ THE SETTLED LINE — ONE PER TRY AGAIN, AT THE SETTLE POINT (#1608).
 *
 * Cid reads the double-render rate after month one against Squall's 30–60%
 * estimate, so `attempts` is the load-bearing field and these arms exist to stop
 * it being quietly wrong.
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS THE ARRIVAL-FAILURE ONE**, and it is the
 * reason `renderViewAttempts` returns a tally at all. A verdict is pushed only
 * once a picture has come back AND the judge has answered, so a first render that
 * never arrived contributes nothing to `verdicts` — a Try again that rendered
 * TWICE would have reported `attempts: 1` had this line read `verdicts.length`,
 * understating the very rate it exists to measure by exactly the arrival
 * failures. That arm fails against `verdicts.length` and passes against the
 * tally, which is the only way to tell the two readings apart.
 *
 * Nothing here asserts a price, a refund or a prompt: those are the arms above,
 * unchanged, and #1608 is monitoring only.
 */
describe("the settled line, one per Try again (#1608)", () => {
  const settled = () =>
    loggedInfo
      .filter((args) => args[1] === "[viewRetryService] retry settled")
      .map((args) => args[0] as Record<string, unknown>);

  const paidSlot = () =>
    slot({
      state: "failed-refunded",
      refundedCredits: CAST_PACKAGE_VIEW_PRICE,
      retry: { priceCredits: TRY_AGAIN_PRICE, reason: "refunded" },
    });

  it("a ONE-render settle says so, with the money that actually moved", async () => {
    const result = await retryCastView(dependencies([paidSlot()]), input);

    expect(result.outcome).toBe("ready");
    const lines = settled();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      outcome: "ready",
      paid: true,
      chargedCredits: TRY_AGAIN_PRICE,
      refundedCredits: 0,
      refundRecorded: true,
      attempts: 1,
      arrivalFailures: 0,
      judgedAttempts: 1,
      doubleRendered: false,
      judged: true,
    });
  });

  /*
    ⚠ THE READING THAT SEPARATES THE TALLY FROM `verdicts.length`. The first
    render throws and never produces a picture, so the judge is never asked about
    it and `verdicts` holds ONE entry — while two renders were paid for in house
    time. `attempts: 2` is the honest answer and `doubleRendered` must be true.
  */
  it("⚠ counts a render that never ARRIVED — the half verdicts.length cannot see", async () => {
    engineAnswers = ["throw", "ok"];
    const result = await retryCastView(dependencies([paidSlot()]), input);

    expect(result.outcome).toBe("ready");
    const lines = settled();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      outcome: "ready",
      attempts: 2,
      arrivalFailures: 1,
      judgedAttempts: 1,
      doubleRendered: true,
    });
  });

  /* A TWO-render settle on the judged road: the first draw is turned down on
     identity — the one axis that still takes a picture away (#1612) — and the
     second lands. Both attempts reached the judge, so here `verdicts.length`
     would have agreed; that is exactly why the arm above is the control. */
  it("a TWO-render settle on the judged road reports both attempts", async () => {
    let call = 0;
    const judge = (() => async () => {
      call += 1;
      const pass = call > 1;
      /* ⚠ The two non-identity axes were `angle` and `wardrobe` until #1903
         retired them, and this fixture kept their names: it survived only
         because the orchestrator short-circuited on `!verdict.pass` before
         anything read an axis by name. Derived from the product's own set so
         it cannot drift again (working law 4). */
      return {
        pass,
        method: "judge:test",
        axes: Object.fromEntries(
          CONFORMANCE_AXES.map((axis) => [axis, { pass: axis === "identity" ? pass : true, note: "" }]),
        ),
      };
    }) as never;

    const result = await retryCastView(dependencies([paidSlot()], { judge }), input);

    expect(result.outcome).toBe("ready");
    expect(settled()[0]).toMatchObject({
      outcome: "ready",
      attempts: 2,
      arrivalFailures: 0,
      judgedAttempts: 2,
      doubleRendered: true,
      judged: true,
    });
  });

  /**
   * ⚠ **THIS ARM HELD `paid: false` UNTIL #1903 SLICE 3 — THE UNPAID
   * POPULATION NO LONGER EXISTS ON THIS ROAD.**
   *
   * It drove a free ask and asserted the settled line marked it unpaid, so a
   * failure rate could never mix the free population with the paid one. Every
   * Try again is paid now, so `paid` cannot read `false` here.
   *
   * ⚠ **THE FIELD IS KEPT, DELIBERATELY, AND IT IS A JUDGEMENT WORTH SAYING OUT
   * LOUD.** It is `price > 0` — still a true statement about the row rather
   * than a flag with a dead branch — and this is the `retry settled` line P1
   * named as a monitoring surface, so silently changing its shape would break a
   * reader outside this suite for a tidiness gain. What the arm holds now is
   * the live fact: a Try again reports itself PAID, with the price beside it, so
   * the rate it feeds is one population by construction instead of by a filter.
   */
  it("a Try again is marked PAID with its price, so the rate is one population", async () => {
    const result = await retryCastView(dependencies([slot()]), input);

    expect(result.outcome).toBe("ready");
    expect(settled()[0]).toMatchObject({
      paid: true,
      chargedCredits: TRY_AGAIN_PRICE,
      attempts: 1,
    });
    /* The control: the figure really is the price and not a flag coerced to 1. */
    expect(TRY_AGAIN_PRICE).toBeGreaterThan(1);
  });

  it("a view that never arrived settles with judged null — not false", async () => {
    engineAnswers = ["throw", "throw", "throw"];
    const result = await retryCastView(dependencies([paidSlot()]), input);

    expect(result.outcome).toBe("failed");
    const lines = settled();
    expect(lines).toHaveLength(1);
    /* `null` and `false` are two different facts: nothing was delivered, versus
       a delivered picture nobody looked at. */
    expect(lines[0].judged).toBeNull();
    expect(lines[0]).toMatchObject({
      outcome: "failed",
      /* What THIS operation gave back, which is what it charged — the Try again
         price, not the view's slice the original Sign refunded. */
      refundedCredits: TRY_AGAIN_PRICE,
      doubleRendered: true,
    });
  });

  it("⚠ ONE line per settle, never one per attempt", async () => {
    engineAnswers = ["throw", "ok"];
    await retryCastView(dependencies([paidSlot()]), input);

    expect(settled()).toHaveLength(1);
  });

  /*
    The free refusals settle no money and run no render, so they emit no settled
    line — a row for them would put denominator entries into the rate that never
    rendered anything.
  */
  it("a free refusal before the claim writes no settled line at all", async () => {
    /* The refusal THROWS rather than returning a result — read at the code after
       the first draft of this arm assumed otherwise. What is being asserted is
       the same fact either way: a road that settles no money and renders nothing
       contributes no row, because a denominator entry that never rendered would
       drag the double-render rate toward zero. */
    await expect(
      retryCastView(dependencies([slot({ state: "ready", url: "https://x/y.png" })]), input),
    ).rejects.toThrow(TRPCError);

    expect(settled()).toHaveLength(0);
    expect(deducts).toHaveLength(0);
  });
});
