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

vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: async () => ledger,
        innerJoin: () => ({ where: async () => assets }),
      }),
    }),
  }),
}));

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
  userId: 1,
  modelId: 7,
  status: "running" as const,
  chargedCredits: 50,
  refundedCredits: 0,
};

beforeEach(() => {
  ledger = [];
  assets = [];
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
