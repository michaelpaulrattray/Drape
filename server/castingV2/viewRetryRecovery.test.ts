import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE SWEEP'S HALF OF A TRY AGAIN (#1208 slice 2) — the money law.
 *
 * One question decides everything: **did a picture land under this operation?**
 * These arms drive the adjudicator over a fake ledger and a fake asset answer,
 * because the two facts it reasons from are exactly those and nothing else —
 * never the operation's own status, which is what a crash leaves wrong.
 *
 * The arm that earns its keep is the LAST one: a free try again has an empty
 * ledger, which looks identical to a paid one that died before its deduct, and
 * both must close free rather than refund something nobody paid.
 */

const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const CHARGE_REFERENCE = `op:${OPERATION_ID}:charge`;
const REFUND_REFERENCE = `refund:op:${OPERATION_ID}:charge`;

let ledger: Array<{ referenceId: string; type: string; amount: number }> = [];
/**
 * The Cast's asset rows, for the arms that drive the PRODUCTION `landed`
 * reader instead of injecting an answer (#1903).
 *
 * ⚠ **IT IS A SECOND CHAIN, AND IT HAS TO BE.** The ledger read is
 * `select().from().where()`; `pressViewLanded` is
 * `select().from().innerJoin().where()`. A mock that answered only the first
 * shape made every press arm inject its own answer — which is how the
 * default reader could be deleted with all sixteen arms green.
 */
let assets: Array<{ provenance: Record<string, unknown> }> = [];
/**
 * THE CAST'S STILL-OPEN VIEW-REPLACING OPERATIONS, for the arms that drive the
 * production `viewReplacementInFlight` reader rather than injecting an answer
 * (#1903 review finding, the sweep side of B1).
 *
 * ⚠ **IT IS A THIRD CHAIN, AND FOR THE REASON THE SECOND ONE EXISTS.** The
 * ledger read is `select().from().where()` awaited; `pressViewLanded` is
 * `select().from().innerJoin().where()`; this one is
 * `select().from().where().limit(1)`. The mock below tells them apart by SHAPE,
 * which is faithful to drizzle — `.where()` really does return something both
 * awaitable and `.limit()`-able — and it is what lets these arms exercise the
 * DEFAULT reader. Injecting `stillArriving` instead would leave the default
 * deletable with every arm green, which is the exact failure the `assets`
 * fixture above was written to stop.
 */
let openOperations: Array<{ id: string }> = [];
/**
 * A REDO PRESS'S SLOT ROWS, for the arms that drive the production
 * refused-sheet reader (#2133). Told apart from the ledger by TABLE rather
 * than by chain shape — both are `select().from().where()` awaited — which is
 * also what drizzle itself does. `.limit()` on the operations table is still
 * `viewReplacementInFlight`'s answer, `openOperations`.
 */
let slotRows: Array<{ status: string; result: unknown }> = [];
/** Every request id the refused-sheet reader asked for, read off its WHERE. */
let slotReads = 0;

vi.mock("../db/connection", async () => {
  const schema = await import("../../drizzle/schema");
  return {
    getDb: async () => ({
      select: () => ({
        from: (table: unknown) => ({
          /*
            AWAITED IT IS THE LEDGER (or, on the operations table, the press's
            slot rows); `.limit()`-ed IT IS THE OPEN OPERATIONS. See
            `openOperations` and `slotRows` above.
          */
          where: () => {
            const onOperations = table === schema.generationOperations;
            if (onOperations) slotReads += 1;
            const builder = Promise.resolve(onOperations ? slotRows : ledger) as Promise<unknown> & {
              limit: (count: number) => Promise<unknown>;
            };
            builder.limit = async () => {
              if (onOperations) slotReads -= 1;
              return openOperations;
            };
            return builder;
          },
          innerJoin: () => ({ where: async () => assets }),
        }),
      }),
    }),
  };
});

const finalizers = {
  success: vi.fn(async (_input: unknown) => undefined),
  failure: vi.fn(async (_input: unknown) => undefined),
  claimedFailure: vi.fn(async (_input: unknown) => undefined),
};
vi.mock("../db/generationOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/generationOperations")>()),
  finalizeGenerationOperationSuccess: vi.fn(async (input: unknown) => finalizers.success(input)),
  finalizeGenerationOperationFailure: vi.fn(async (input: unknown) => finalizers.failure(input)),
  finalizeClaimedGenerationOperationFailure: vi.fn(async (input: unknown) =>
    finalizers.claimedFailure(input)),
}));

import {
  PACKAGE_REDO_PRESS_RECOVERY_WORDING,
  PACKAGE_REDO_RECOVERY_WORDING,
  RECOVERED_VIEW_RETRY_FREE_SENTENCE,
  RECOVERED_VIEW_RETRY_SENTENCE,
  recoverCastingV2PackageRedoOperation,
  recoverCastingV2PackageRedoPressOperation,
  recoverCastingV2ViewRetryOperation,
  VIEW_RETRY_RECOVERY_WORDING,
} from "./viewRetryRecovery";

const refunds: Array<{ amount: number; reference: string }> = [];
let landed = false;

function dependencies() {
  return {
    landed: (async () => landed) as never,
    refund: (async (_userId: number, amount: number, _d: string, reference: string) => {
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference, duplicate: false };
    }) as never,
  };
}

const operation = {
  id: OPERATION_ID,
  /* The press road derives its slot rows from this (#2133); the Try again
     road ignores it. */
  clientRequestId: "99999999-9999-4999-8999-999999999999",
  userId: 1,
  modelId: 7,
  status: "running" as const,
  chargedCredits: 50,
  refundedCredits: 0,
};

beforeEach(() => {
  ledger = [];
  assets = [];
  openOperations = [];
  slotRows = [];
  slotReads = 0;
  refunds.length = 0;
  landed = false;
  finalizers.success.mockClear();
  finalizers.failure.mockClear();
  finalizers.claimedFailure.mockClear();
});

describe("a swept try again", () => {
  it("keeps the 50 when a picture landed under this operation", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 }];
    landed = true;
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: 50 });
    expect(refunds).toHaveLength(0);
    expect(finalizers.success).toHaveBeenCalledTimes(1);
  });

  it("gives the 50 back when nothing landed", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 }];
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: 50, refundedCredits: 50 });
    expect(refunds).toEqual([{ amount: 50, reference: CHARGE_REFERENCE }]);
  });

  it("never refunds twice — a refund already on the ledger is READ, not re-issued", async () => {
    ledger = [
      { referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 },
      { referenceId: REFUND_REFERENCE, type: "refund", amount: 50 },
    ];
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: 50, refundedCredits: 50 });
    expect(refunds).toHaveLength(0);
  });

  it("closes a FREE try again free — an empty ledger owes nothing", async () => {
    /*
      A free retry never charges, so its ledger is empty by design; a paid one
      that died before its deduct looks identical. Both owe nothing, and
      neither is a guess — the ledger was read.
    */
    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(outcome.type).toBe("free_failure");
    expect(refunds).toHaveLength(0);
    expect(finalizers.failure).toHaveBeenCalledTimes(1);
  });

  it("parks rather than refunds when it cannot ask whether a view landed", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 }];
    const outcome = await recoverCastingV2ViewRetryOperation(
      { ...operation, modelId: null },
      dependencies(),
    );
    expect(outcome.type).toBe("recovery_required");
    expect(refunds).toHaveLength(0);
    /* A parked row writes no receipt here — the sweep writes its own. */
    expect(finalizers.failure).not.toHaveBeenCalled();
  });

  it("a crash before the charge on a CLAIMED row takes the claimed finalizer", async () => {
    const outcome = await recoverCastingV2ViewRetryOperation(
      { ...operation, status: "claimed" },
      dependencies(),
    );
    expect(outcome.type).toBe("free_failure");
    expect(finalizers.claimedFailure).toHaveBeenCalledTimes(1);
    expect(finalizers.failure).not.toHaveBeenCalled();
  });
});

/**
 * THE SAME ADJUDICATOR, THE REDO'S WORDS (#1903 slice 2).
 *
 * A redo is five operations, each replacing one view, so its fork variable is
 * this one exactly — *did a picture land under THIS operation?* It therefore
 * REUSES the arms above rather than cloning two hundred lines of refund
 * arithmetic whose drift would be a customer refunded twice or not at all.
 *
 * What these arms own is the one thing that is NOT shared: the sentence. And
 * the first of them is the control that matters — if the wording did not
 * actually reach the receipt, every arm here would pass by agreeing with the
 * default.
 */
/**
 * THE PRESS OF A REDO, SWEPT — the flat price's whole money rule, read from
 * the rows alone (#1903, his word of 2026-10-08).
 *
 * ⚠ **THESE ARE THE FOUR CONTROLS THE RELAY ASKED FOR ON PR #1924**, and
 * they are here rather than in the service's suite because the sweep is the
 * reading that happens when the process that charged is GONE. The live service
 * decides from what its renders returned; this decides hours later from the
 * ledger and the asset rows, and the two must reach the same answer or a crash
 * pays a customer twice.
 *
 * `landed` is the whole difference between a press and a slot: for a slot it
 * asks *did a picture land under THIS operation*, for a press *did one land
 * under ANY of them*. The production reader is `pressViewLanded`; these arms
 * inject the answer, because what is under test is the DECISION.
 */
describe("whose sentence may speak about money", () => {
  /*
    ⚠ **A SLOT SPEAKS ABOUT A PICTURE; THE PRESS SPEAKS ABOUT THE MONEY (#1903
    review, the slot receipt).**

    `PACKAGE_REDO_RECOVERY_WORDING.freeSentence` read *"You were not charged."*
    — true of the slot ROW, which settles 0/0, and false of what the customer
    did: she paid 3,250 for the press. Nothing could see it, because no customer
    surface reads a redo slot's receipt today and #1940's vocabulary guard bans
    other spellings than this one. So the division is asserted here rather than
    left as a comment.

    ⚠ **IT IS NOT A BLANKET BAN, and the press arm below is what stops it
    becoming one.** The press's own `freeSentence` MAY say nothing was charged,
    because on that row it is the whole truth — it is reached only when the
    ledger is empty. An arm that forbade the phrase everywhere would have been
    satisfied by deleting a true sentence.
  */
  const MONEY_WORDS = /charg|credit|refund|cost|paid|money/i;

  it("a redo SLICE never claims anything about money", () => {
    for (const [name, sentence] of Object.entries(PACKAGE_REDO_RECOVERY_WORDING)) {
      expect(sentence, `the slot's ${name} speaks about money the slot row cannot know`)
        .not.toMatch(MONEY_WORDS);
    }
  });

  it("the PRESS may — it is the row the credits are on", () => {
    /* The positive control: if the arm above were a blanket ban on the phrase,
       this would be impossible to satisfy honestly. */
    expect(PACKAGE_REDO_PRESS_RECOVERY_WORDING.paidSentence).toMatch(MONEY_WORDS);
    expect(PACKAGE_REDO_PRESS_RECOVERY_WORDING.freeSentence).toMatch(MONEY_WORDS);
  });
});

describe("the roads that do NOT ask whether anything can still arrive", () => {
  /*
    ⚠ **THE NEGATIVE CONTROL ON #1903's SWEEP-SIDE GATE, and it is the arm that
    keeps the gate from being widened by accident.**

    The deferral belongs to a road whose pictures land under rows it does not
    own. The Try again's picture lands under the very row being adjudicated, so
    "can anything still arrive" is "am I still running" — which is always true
    at sweep time, and a Try again that asked it would defer for ever and never
    refund anybody. The redo SLOT is the same shape, and carries no credits
    besides.

    These two arms drive the production entry points with the Cast's operations
    OPEN. They must settle anyway.
  */
  const TRY_AGAIN_PRICE = 50;

  it("a swept Try again refunds even with a view-replacing operation open on the Cast", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -TRY_AGAIN_PRICE }];
    openOperations = [{ id: "something open on this Cast" }];

    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());

    expect(outcome, "a Try again was deferred — it can never un-defer itself").toEqual({
      type: "paid_failure",
      chargedCredits: TRY_AGAIN_PRICE,
      refundedCredits: TRY_AGAIN_PRICE,
    });
  });

  it("a swept redo SLICE settles free with an operation open on the Cast", async () => {
    /* A slot carries no credits under the flat price, so there is no refund to
       get wrong — and nothing to defer for. */
    openOperations = [{ id: "a sibling slot, still running" }];

    const outcome = await recoverCastingV2PackageRedoOperation(operation, dependencies());

    expect(outcome.type, "a redo slice was deferred").toBe("free_failure");
  });
});

describe("the press of a redo, swept", () => {
  const PRESS_PRICE = 3250;

  it("(a) keeps the whole charge when every view delivered", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    landed = true;

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(outcome).toEqual({ type: "durable_success", chargedCredits: PRESS_PRICE });
    expect(refunds).toEqual([]);
  });

  it("(b) keeps the whole charge when ONE of five delivered", async () => {
    /*
      ⚠ **THE ARM HIS RULE ACTUALLY TURNS ON.** One view is a delivered
      press: the customer has the work, the other slots kept the pictures they
      already had, and the house paid for both sheets either way. The reader
      cannot tell this case from (a) and must not try — *any* is the rule, so
      the same answer for one as for five is the point rather than a weakness.
    */
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    landed = true;

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(outcome.type).toBe("durable_success");
    expect(refunds).toEqual([]);
  });

  it("(c) gives the whole price back, ONCE, when nothing arrived", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    landed = false;

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(outcome).toEqual({
      type: "paid_failure",
      chargedCredits: PRESS_PRICE,
      refundedCredits: PRESS_PRICE,
    });
    /* ONE refund of the whole price — not five of a fifth, which is the
       shape this road used to have. */
    expect(refunds).toEqual([{ amount: PRESS_PRICE, reference: CHARGE_REFERENCE }]);
    /* And it speaks about the whole ask rather than about one view. */
    expect(finalizers.failure).toHaveBeenCalledWith(expect.objectContaining({
      publicMessage: PACKAGE_REDO_PRESS_RECOVERY_WORDING.paidSentence,
    }));
    expect(finalizers.failure).not.toHaveBeenCalledWith(expect.objectContaining({
      publicMessage: PACKAGE_REDO_RECOVERY_WORDING.paidSentence,
    }));
  });

  it("(d) a SECOND sweep pass refunds nothing — the ledger is read, never re-issued", async () => {
    /*
      THE CRASH CASE, DRIVEN DIRECTLY: the press charged, the process died with
      no slot settled, the sweep gave the price back — and then the sweep runs
      again, which it does on its own cadence. The refund already on the ledger
      is READ. A second pass that re-issued it would double a customer's
      credits on exactly the road his rule exists to make safe.
    */
    ledger = [
      { referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE },
      { referenceId: `refund:${CHARGE_REFERENCE}`, type: "refund", amount: PRESS_PRICE },
    ];
    landed = false;

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(outcome).toEqual({
      type: "paid_failure",
      chargedCredits: PRESS_PRICE,
      refundedCredits: PRESS_PRICE,
    });
    expect(refunds, "the sweep re-issued a refund that was already on the ledger").toEqual([]);
  });

  it("closes a press that never charged free", async () => {
    /* The press died before its deduct — nothing was taken, so nothing is
       owed, and the ledger says so rather than this being inferred. */
    ledger = [];
    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());
    expect(outcome.type).toBe("free_failure");
    expect(refunds).toEqual([]);
  });

  it("⚠ reads the PRESS's own key off the asset rows, with no reader injected", async () => {
    /*
      THE ARM THE SABOTAGE ASKED FOR. Every other press arm hands `landed` an
      answer, so the DEFAULT reader — the one production actually uses — was
      never exercised: deleting it and falling back to the slot's reader left
      all of them green.

      What that would cost a customer is this arm's fixture exactly. A redo's
      asset carries BOTH keys: `retryOperationId` is the slot that rendered it,
      `pressOperationId` is the press that paid. The slot's reader asks whether
      anything carries the PRESS id in `retryOperationId` — nothing ever does —
      so a delivered redo would read as a total loss and be refunded in full
      while the customer keeps five new pictures.
    */
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    assets = [
      { provenance: { retryOperationId: "slot-op-1", pressOperationId: operation.id } },
      { provenance: { retryOperationId: "slot-op-2", pressOperationId: operation.id } },
    ];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, {
      refund: (async (_userId: number, amount: number, _d: string, reference: string) => {
        refunds.push({ amount, reference });
        return { recorded: true, amount, reference, duplicate: false };
      }) as never,
      finalizeSuccess: finalizers.success as never,
      finalizeFailure: finalizers.failure as never,
      finalizeClaimedFailure: finalizers.claimedFailure as never,
    });

    expect(outcome.type, "a delivered redo was refunded in full").toBe("durable_success");
    expect(refunds).toEqual([]);
  });

  it("⚠ and refunds when the asset rows name a DIFFERENT press", async () => {
    /*
      The control for the arm above: the same chain, the same shape of row, one
      field different. Without it, a reader that answered `true` for any asset
      at all would pass.
    */
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    assets = [
      { provenance: { retryOperationId: "slot-op-1", pressOperationId: "some-other-press" } },
    ];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, {
      refund: (async (_userId: number, amount: number, _d: string, reference: string) => {
        refunds.push({ amount, reference });
        return { recorded: true, amount, reference, duplicate: false };
      }) as never,
      finalizeSuccess: finalizers.success as never,
      finalizeFailure: finalizers.failure as never,
      finalizeClaimedFailure: finalizers.claimedFailure as never,
    });

    expect(outcome.type).toBe("paid_failure");
    expect(refunds).toEqual([{ amount: PRESS_PRICE, reference: CHARGE_REFERENCE }]);
  });

  it("⚠ the press's reader is NOT the slot's, which is what makes (b) possible", async () => {
    /*
      THE CONTROL ON THE WIRING ITSELF. `recoverFlatPressCharge` refuses to take
      the default `landed` reader, because that one asks about ONE operation —
      and a press has no picture of its own, so the default would refund every
      press that ever ran, including the ones that delivered everything.

      Driven by handing it a reader that says yes and watching the charge be
      kept, then one that says no and watching it be given back: if the
      injection were dropped, both arms would reach the same answer.
    */
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    const asked: string[] = [];

    const kept = await recoverCastingV2PackageRedoPressOperation(operation, {
      ...dependencies(),
      landed: (async (request: { operationId: string }) => {
        asked.push(request.operationId);
        return true;
      }) as never,
    });
    expect(kept.type).toBe("durable_success");
    expect(asked, "the press asked about something other than itself").toEqual([operation.id]);
  });

  /* --------------------------------------------------------------------- *
   * THE SWEEP SIDE OF B1 — nothing is settled while a picture can arrive.
   * (#1903 review finding, head 6fe19c191.)
   *
   * The money fault these close: the press's lease lapses while its slots are
   * alive, the sweep reads "nothing landed" because nothing has committed YET,
   * refunds 3,250 and seals the press failed — and the slots, which fence on
   * the press being `running` and so were admitted all along, commit
   * afterwards. She keeps the new views AND the credits.
   *
   * ⚠ These arms drive the PRODUCTION reader through `openOperations`. The
   * interleave the relay asked for — a slot commit between the landed read and
   * the seal — is driven against a real database in
   * `scripts/_1924-press-defer-disposable.mts`, because the thing it proves is
   * a `WHERE status = 'running'` racing an uncommitted transaction, and
   * `vitest.setup.ts` strips `DATABASE_URL`.
   * --------------------------------------------------------------------- */

  it("(h) DEFERS while a view of this Cast can still arrive — no refund, no receipt", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    /* Nothing has committed yet — which is exactly the state that used to
       read as "nothing was delivered" and buy a refund. */
    assets = [];
    openOperations = [{ id: "a slot of this press, still running" }];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(outcome.type).toBe("deferred");
    expect(refunds, "the press was refunded while its views were still being made").toEqual([]);
    expect(finalizers.failure, "a deferred press must not be sealed").not.toHaveBeenCalled();
    expect(finalizers.success).not.toHaveBeenCalled();
    expect(finalizers.claimedFailure).not.toHaveBeenCalled();
  });

  it("(i) asks whether anything can still arrive BEFORE it reads whether anything landed", async () => {
    /*
      ⚠ **THE ORDER IS THE WHOLE REPAIR, so it is asserted rather than
      described.** Asking after the landed read puts the question on the wrong
      side of the race: the read would already have been taken against a world
      that was still changing, and a later "nothing is arriving" would be true
      of a moment the verdict was not formed in.
    */
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    const order: string[] = [];

    await recoverCastingV2PackageRedoPressOperation(operation, {
      ...dependencies(),
      stillArriving: (async () => {
        order.push("stillArriving");
        return false;
      }) as never,
      landed: (async () => {
        order.push("landed");
        return false;
      }) as never,
    });

    expect(order).toEqual(["stillArriving", "landed"]);
  });

  it("(j) settles normally once every view-replacing operation is terminal", async () => {
    /*
      The other half of (h), and the arm that stops the gate from being a
      permanent hold: with nothing open, nothing more can commit — a terminal
      slot can never pass `commitRetriedViewAsset`'s own `running` fence — so
      the landed read is stable and his rule applies.
    */
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    assets = [];
    openOperations = [];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(outcome).toEqual({
      type: "paid_failure",
      chargedCredits: PRESS_PRICE,
      refundedCredits: PRESS_PRICE,
    });
    expect(refunds).toEqual([{ amount: PRESS_PRICE, reference: CHARGE_REFERENCE }]);
  });

  it("(k) does not seal a press SUCCEEDED early either — the gate guards both directions", async () => {
    /*
      ⚠ **THE MIRROR HARM, and it is not hypothetical.** A success also moves
      the press out of `running`, so every slot still rendering would then be
      fenced out and its picture thrown away: the customer rightly charged, and
      short the views she paid for. That is why the gate sits above the fork
      rather than beside the refund.
    */
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    assets = [{ provenance: { pressOperationId: OPERATION_ID } }];
    openOperations = [{ id: "a sibling slot, still rendering" }];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(outcome.type).toBe("deferred");
    expect(finalizers.success, "a press was sealed while a sibling view was still coming")
      .not.toHaveBeenCalled();
  });
});

describe("a swept redo slice", () => {
  /**
   * ⚠ **A CHARGED SLICE IS PARKED, NOT REFUNDED — #1903's review finding, and
   * this arm used to assert the opposite.**
   *
   * It read: a slice carrying 350 is refunded 350, with the redo's sentence.
   * That was the per-slice price, and the flat price retired it — the money
   * for a redo is one 3,250 charge on the PRESS and the five slot rows plan 0
   * and settle 0/0. So a charged slot is not a case to pay out; it is a fact
   * nothing on this road can produce, and paying it out beside the press's own
   * settlement is one failure refunded twice. That branch stayed wired after
   * the price changed, which is the sibling shape working law 7 is about.
   *
   * The 350 is kept as the FIXTURE deliberately: it is the figure the dead
   * road would have refunded, so an arm that still refunded it would read
   * exactly as this one did.
   */
  it("PARKS a slice that somehow carries a charge, and refunds nothing", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -350 }];
    landed = false;

    const outcome = await recoverCastingV2PackageRedoOperation(operation, dependencies());

    expect(outcome).toEqual({
      type: "recovery_required",
      reason: "charged on a road whose rows settle at zero — the money is on another row",
      chargedCredits: 350,
      refundedCredits: 0,
    });
    /* THE WHOLE POINT: no money moved, in either direction. */
    expect(refunds).toEqual([]);
    /* And nothing was sealed — a parked row stays for a person to read. */
    expect(finalizers.failure).not.toHaveBeenCalled();
  });

  /**
   * THE POSITIVE CONTROL ON THAT PARK, and without it the arm above passes for
   * the wrong reason.
   *
   * `chargeIsExpected` is a per-road declaration, so a reader that simply
   * refused to refund anything would satisfy the park arm while breaking the
   * Try again — whose charge is perfectly ordinary and MUST come back. Driven
   * through the same adjudicator with the same ledger, one option apart.
   */
  it("still refunds the same charge on a road where a charge is expected", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -350 }];
    landed = false;

    const outcome = await recoverCastingV2PackageRedoOperation(operation, {
      ...dependencies(),
      chargeIsExpected: true,
    });

    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: 350, refundedCredits: 350 });
    expect(refunds).toEqual([{ amount: 350, reference: CHARGE_REFERENCE }]);
    /* The refund ROW says which road it came from, for whoever reads the
       ledger later. */
    expect(finalizers.failure).toHaveBeenCalledWith(expect.objectContaining({
      publicMessage: PACKAGE_REDO_RECOVERY_WORDING.paidSentence,
    }));
    /* THE NEGATIVE HALF: it must not be the Try again's sentence. Without
       this, a wording that never reached the receipt would pass the arm above
       by defaulting. */
    expect(finalizers.failure).not.toHaveBeenCalledWith(expect.objectContaining({
      publicMessage: RECOVERED_VIEW_RETRY_SENTENCE,
    }));
  });

  it("closes a slice that never charged free, in the redo's words", async () => {
    ledger = [];
    const outcome = await recoverCastingV2PackageRedoOperation(operation, dependencies());
    expect(outcome.type).toBe("free_failure");
    expect(refunds).toEqual([]);
    expect(finalizers.failure).toHaveBeenCalledWith(expect.objectContaining({
      publicMessage: PACKAGE_REDO_RECOVERY_WORDING.freeSentence,
    }));
  });

  /**
   * ⚠ **THE FALSE RECEIPT — #1903's review finding, and it is the redo's
   * ORDINARY road rather than an edge case.**
   *
   * A redo's slices charge nothing by design, so *every* slice swept after a
   * crash took the no-charge branch — and that branch returned before anything
   * asked whether a picture had arrived. A slice that HAD committed its
   * picture was therefore sealed *"That view didn't arrive when you asked for
   * all the views again. You were not charged."*: wrong about the only thing
   * she can see, while right about the money.
   *
   * So the ledger is no longer consulted ahead of the asset rows. The money
   * answer is unchanged — nothing charged, nothing back — and the receipt now
   * says the picture arrived, because it did.
   */
  it("seals a slice that charged nothing but DID land as a success, not as 'didn't arrive'", async () => {
    ledger = [];
    landed = true;

    const outcome = await recoverCastingV2PackageRedoOperation(operation, dependencies());

    expect(outcome).toEqual({ type: "durable_success", chargedCredits: 0 });
    expect(refunds).toEqual([]);
    /* THE NEGATIVE HALF, and it is the defect itself: she must not be told the
       view never came. */
    expect(finalizers.failure).not.toHaveBeenCalled();
    expect(finalizers.claimedFailure).not.toHaveBeenCalled();
    expect(finalizers.success).toHaveBeenCalledWith(expect.objectContaining({
      chargedCredits: 0,
      refundedCredits: 0,
      terminalStatus: "succeeded",
    }));
  });

  it("keeps the slice when a picture landed under it", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -350 }];
    landed = true;
    const outcome = await recoverCastingV2PackageRedoOperation(operation, {
      ...dependencies(),
      /* A charge on a slice is parked, so this arm declares the road where one
         is expected — otherwise it would be re-testing the park above. */
      chargeIsExpected: true,
    });
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: 350 });
    expect(refunds).toEqual([]);
  });

  it("leaves the Try again road's own sentences exactly where they were", async () => {
    /*
      ⚠ THE REGRESSION ARM FOR THE PARAMETERISATION. The wording became an
      option with a default, and a default read from the wrong constant would
      silently re-word a live road that has already settled real operations.
    */
    expect(VIEW_RETRY_RECOVERY_WORDING.paidSentence).toBe(RECOVERED_VIEW_RETRY_SENTENCE);
    expect(VIEW_RETRY_RECOVERY_WORDING.freeSentence).toBe(RECOVERED_VIEW_RETRY_FREE_SENTENCE);

    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -1850 }];
    landed = false;
    await recoverCastingV2ViewRetryOperation(operation, dependencies());
    expect(finalizers.failure).toHaveBeenCalledWith(expect.objectContaining({
      publicMessage: RECOVERED_VIEW_RETRY_SENTENCE,
    }));
  });
});

/*
  #2133 — THE PRESS'S REFUSED-SHEET SHARES, READ BY THE PRODUCTION READER.

  A Regenerate whose sheet the image provider refused twice owes one share per
  view that sheet would have made, even when the other sheet delivered. The
  refused slot writes that on its own sealed receipt, and the sweep reads it
  through `readPressRefusedSheetRefund` — driven here over `slotRows`, never
  injected, so deleting the default reader reddens these arms.
*/
describe("a swept press whose sheet was refused twice (#2133)", () => {
  const PRESS_PRICE = 3250;
  const SHARE = 650;
  const refusedRow = { status: "succeeded", result: { outcome: "failed", refusedByProvider: true } };
  const landedRow = { status: "succeeded", result: { outcome: "ready" } };
  const plainFailedRow = { status: "succeeded", result: { outcome: "failed" } };

  it("pays one share per refused view, once, under the press's own reference, and seals it a success", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    landed = true;
    slotRows = [refusedRow, refusedRow, refusedRow, landedRow, landedRow];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(slotReads, "the production reader was not asked").toBeGreaterThan(0);
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: PRESS_PRICE, refundedCredits: 3 * SHARE });
    expect(refunds).toEqual([{ amount: 3 * SHARE, reference: CHARGE_REFERENCE }]);
    expect(finalizers.success).toHaveBeenCalledWith(expect.objectContaining({ refundedCredits: 3 * SHARE }));
    expect(finalizers.failure).not.toHaveBeenCalled();
  });

  it("pays nothing when the live press already paid the same shares", async () => {
    ledger = [
      { referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE },
      { referenceId: REFUND_REFERENCE, type: "refund", amount: 3 * SHARE },
    ];
    landed = true;
    slotRows = [refusedRow, refusedRow, refusedRow, landedRow, landedRow];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(refunds).toEqual([]);
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: PRESS_PRICE, refundedCredits: 3 * SHARE });
  });

  it("NEGATIVE CONTROL — views lost any other way, or slots not yet sealed, owe nothing", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    landed = true;
    slotRows = [
      plainFailedRow,
      { status: "running", result: null },
      { status: "failed", result: { outcome: "failed", refusedByProvider: true } },
      landedRow,
      landedRow,
    ];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(refunds).toEqual([]);
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: PRESS_PRICE });
  });

  it("a total loss pays the whole charge only, never the shares on top", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
    landed = false;
    slotRows = [refusedRow, refusedRow, refusedRow, plainFailedRow, plainFailedRow];

    const outcome = await recoverCastingV2PackageRedoPressOperation(operation, dependencies());

    expect(refunds).toEqual([{ amount: PRESS_PRICE, reference: CHARGE_REFERENCE }]);
    expect(outcome).toEqual({ type: "paid_failure", chargedCredits: PRESS_PRICE, refundedCredits: PRESS_PRICE });
  });

  it("the Try again road never asks about refused sheets — a landed view still owes nothing", async () => {
    ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -50 }];
    landed = true;
    slotRows = [refusedRow, refusedRow, refusedRow];

    const outcome = await recoverCastingV2ViewRetryOperation(operation, dependencies());

    expect(slotReads).toBe(0);
    expect(refunds).toEqual([]);
    expect(outcome).toEqual({ type: "durable_success", chargedCredits: 50 });
  });
});
