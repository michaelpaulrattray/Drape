/**
 * CREDITS MOVE WHEN THE MONEY THEY MIRROR SETTLES (#711).
 *
 * Until this module, `changePlan` moved credits the moment Stripe ACCEPTED
 * the subscription update — before the `always_invoice` charge had settled.
 * A declined card kept an upgrade's credits (×12 on annual) with the invoice
 * sitting unpaid; an interval switch whose invoice declined left the customer
 * DEDUCTED their old cycle's unconsumed grant with no new grant until retry
 * or auto-cancel. Both directions, one rule:
 *
 *   The credit move is RECORDED against the change's own invoice, and
 *   APPLIED when that invoice is paid. When Stripe reports the invoice
 *   already paid in the same breath as the update — the common instant
 *   case for a working card, and every zero-due downgrade invoice — it
 *   applies right there and the change feels exactly as it did.
 *
 * THE RACE, AND WHY IT CANNOT DROP A SETTLEMENT: the `invoice.payment_succeeded`
 * webhook can arrive before `changePlan` has recorded the row (Stripe pays the
 * change invoice synchronously). So the order in `changePlan` is: record the
 * row FIRST, then read the invoice's status FRESH, and apply if paid. A webhook
 * that fired before the row existed implies the invoice was already paid, which
 * the fresh read sees; a webhook that fires after the row exists finds it. Both
 * sides call the same applier, and the credit ledger's unique
 * (userId, referenceId) index — keyed `plan-change-settle:<invoiceId>` — makes
 * the second application a typed duplicate no-op, whoever wins.
 *
 * A final payment failure VOIDS the pending row (the auto-cancel already drops
 * the plan); an intermediate failure leaves it pending, because Stripe's own
 * retry schedule is the retry loop, and each success redelivers the settling
 * event.
 *
 * STATED LIMITS (the #664 "coarse mirror" precedent, extended):
 * - A second plan change made while a prior change's invoice is still unpaid
 *   nets coarsely — each row mirrors its own invoice, the unwind floors at
 *   the live balance, and the customer is never taken below zero; but no
 *   lot-tracking reconciles a pending grant against a later deduction.
 *   Stripe's own money side is equally coarse there (the earlier invoice
 *   stays due), and the final-failure endgame dissolves the chain.
 * - The webhook-first race's LAST road is the fresh status re-read, which
 *   `changePlan` retries before deferring; if every retry fails inside that
 *   exact window, the row sits pending until support finds it (PR #755
 *   review, finding 1). Narrow, named, not covered.
 * - An invoice voided or marked uncollectible from the Stripe DASHBOARD
 *   sends no event this module hooks; its row stays pending (credits never
 *   move — the safe direction). The two in-product death roads DO void:
 *   final payment failure here, and subscription deletion in the webhook's
 *   deleted handler (finding 3).
 */
import {
  addCredits,
  deductCredits,
  getUserCredits,
  recordPlanChangeSettlement,
  getPlanChangeSettlementByInvoice,
  resolvePlanChangeSettlement,
  type RecordPlanChangeSettlementInput,
} from "../db";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("stripe/planChangeSettlement");

/** The one ledger key for a change invoice's credit move — shared by the
 *  changePlan path and the webhook path, which is what makes their race safe. */
export function settlementLedgerRef(stripeInvoiceId: string): string {
  return `plan-change-settle:${stripeInvoiceId}`;
}

export type SettlementApplyResult =
  | { outcome: "applied"; creditsMoved: number }
  | { outcome: "already-applied" }
  | { outcome: "none" } // no settlement recorded for this invoice
  | { outcome: "void" } // the row was voided — nothing may move
  | { outcome: "failed"; error: string };

/**
 * Record a change's credit move against its invoice. Called by `changePlan`
 * immediately after the Stripe update succeeds, BEFORE any status read —
 * see the race note in the module header.
 */
export async function queuePlanChangeSettlement(
  input: RecordPlanChangeSettlementInput,
): Promise<{ success: boolean; error?: string }> {
  return recordPlanChangeSettlement(input);
}

/**
 * Apply the settlement recorded for this invoice, if one is pending.
 * Idempotent across callers: the ledger referenceId arbitrates, and a
 * duplicate application resolves the row rather than moving credits twice.
 *
 * The UNWIND floors at the live balance AT APPLICATION TIME — the customer
 * may have spent between the change and the settlement, and spent credits
 * are spent (#664's floor rule, unchanged in substance, moved in time).
 */
export async function applyPlanChangeSettlement(
  stripeInvoiceId: string,
): Promise<SettlementApplyResult> {
  const row = await getPlanChangeSettlementByInvoice(stripeInvoiceId);
  if (!row) return { outcome: "none" };
  if (row.status === "applied") return { outcome: "already-applied" };
  if (row.status === "void") {
    log.warn(
      { stripeInvoiceId, userId: row.userId },
      "[Settlement] a settling invoice has a VOID settlement row — an invoice paid after final failure; not moving credits",
    );
    return { outcome: "void" };
  }

  const ref = settlementLedgerRef(stripeInvoiceId);

  if (row.direction === "grant") {
    const result = await addCredits(row.userId, row.credits, "bonus", row.description, ref);
    if (!result.success && !result.duplicate) {
      log.error(
        { stripeInvoiceId, userId: row.userId, error: result.error },
        "[Settlement] grant application failed — leaving the row pending so a redelivery retries",
      );
      return { outcome: "failed", error: result.error ?? "grant failed" };
    }
    await resolvePlanChangeSettlement(stripeInvoiceId, "applied");
    return result.duplicate
      ? { outcome: "already-applied" }
      : { outcome: "applied", creditsMoved: row.credits };
  }

  // Unwind: deduct, floored at the balance read now.
  //
  // ⚠ A KNOWN-BENIGN FATAL CAN FIRE HERE (PR #755 review, finding 2): both
  // appliers can pass the pending check concurrently, each computes its own
  // floor from the LIVE balance, and the loser — reading the balance AFTER
  // the winner's deduct — can hit the unique ledger ref with a DIFFERENT
  // amount, which credits.ts classifies as a CRITICAL reference collision
  // at log.fatal. For THIS reference family (`plan-change-settle:`) on the
  // unwind direction, that alarm's cause is this benign race: money is
  // conserved (the winner's deduct stood, the loser moved nothing) and the
  // row resolves applied. An alarm reader seeing that FATAL on a
  // plan-change-settle ref should check for two near-simultaneous appliers
  // before treating it as a real collision. The grant direction cannot hit
  // this — its amount is fixed by the row, so a replay always
  // semantics-matches.
  const liveCredits = await getUserCredits(row.userId);
  const returnable = Math.min(row.credits, Math.max(0, liveCredits?.balance ?? 0));
  if (returnable <= 0) {
    // Nothing left to return — the allowance was spent. That is the floor
    // rule working, not a failure; the row resolves so it stops reading as
    // queued work.
    await resolvePlanChangeSettlement(stripeInvoiceId, "applied");
    return { outcome: "applied", creditsMoved: 0 };
  }
  const result = await deductCredits(
    row.userId,
    returnable,
    "subscription",
    row.description,
    ref,
    // Not a tool spend: the unwind returns unconsumed allowance beside
    // Stripe's money credit for the same days (#401's null-toolKind class).
    { toolKind: null },
  );
  if (!result.success && !result.duplicate) {
    log.error(
      { stripeInvoiceId, userId: row.userId, returnable, error: result.error },
      "[Settlement] unwind application failed — leaving the row pending so a redelivery retries",
    );
    return { outcome: "failed", error: result.error ?? "unwind failed" };
  }
  await resolvePlanChangeSettlement(stripeInvoiceId, "applied");
  return result.duplicate
    ? { outcome: "already-applied" }
    : { outcome: "applied", creditsMoved: returnable };
}

/**
 * The invoice will never settle (final payment failure — the same signal that
 * auto-cancels the subscription). A pending row goes void; an applied row is
 * left alone, because credits that moved against a payment that later
 * hard-failed are the dispute/refund machinery's business, not this queue's.
 */
export async function voidPlanChangeSettlement(stripeInvoiceId: string): Promise<boolean> {
  const row = await getPlanChangeSettlementByInvoice(stripeInvoiceId);
  if (!row || row.status !== "pending") return false;
  const moved = await resolvePlanChangeSettlement(stripeInvoiceId, "void");
  if (moved) {
    log.info(
      { stripeInvoiceId, userId: row.userId, direction: row.direction, credits: row.credits },
      "[Settlement] voided — the change's invoice will never settle, so its credits never move",
    );
  }
  return moved;
}
