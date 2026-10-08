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
 *   the plan's part of the live balance (#1661; it floored at the TOTAL until
 *   2026-10-01), and the customer is never taken below zero; but no
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
  getCreditTransactionByRef,
  recordPlanChangeSettlement,
  getPlanChangeSettlementByInvoice,
  resolvePlanChangeSettlement,
  type RecordPlanChangeSettlementInput,
} from "../db";
import { planAllowanceRemaining } from "../db/credits";
import { settlementLedgerRef } from "../db/planChangeSettlements";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("stripe/planChangeSettlement");

/**
 * The one ledger key for a change invoice's credit move — shared by the
 * changePlan path and the webhook path, which is what makes their race safe.
 *
 * ⚠ **DECLARED IN `server/db/planChangeSettlements.ts` SINCE PR #1946's
 * REVIEW AND RE-EXPORTED HERE, NOT RE-DECLARED.** The renewal's netting
 * reader has to look a move up in the ledger by this key, and it lives beside
 * the table; this module imports `../db`, so reading it the other way would
 * have closed an import cycle. Every importer keeps its path, and there is
 * one spelling of the string two racing appliers rely on.
 */
export { settlementLedgerRef } from "../db/planChangeSettlements";

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

  // Unwind: deduct, floored at THE PLAN'S PART of the balance read now.
  //
  // ⚠ IT FLOORED AT THE TOTAL BALANCE UNTIL #1661 (2026-10-01), AND THAT
  // REVERSES A RECORDED REVIEW DECISION rather than transcribing one. The
  // docblock's stated limits cited #664's "deliberately coarse mirror" ruling —
  // the floor is the total balance, no per-source lots — and that ruling was
  // CORRECT when it was made: it was coarse because there was nothing to be
  // fine about. There were no per-source lots and no purchased credits either,
  // the one-time top-up having been removed in February (41a765ea). **#1604
  // creates the thing the ruling says does not exist.**
  //
  // A downgrade claws back the unconsumed share of the allowance the customer
  // is handing back, because Stripe returns that share's money in the same act.
  // Flooring at the TOTAL lets that settlement reach credits she BOUGHT:
  // 25,000 bought + 2,000 allowance left + an 8,000 mirror used to deduct
  // 8,000, of which 6,000 was her money. It is 2,000 now.
  //
  // Unreachable until #1606 sells top-ups again, which is why this is a fix
  // ahead of a feature rather than a repair after an incident — #1606 names it
  // as its blocker. Still coarse in #664's sense: one number, no lots.
  //
  // ⚠ A KNOWN-BENIGN FATAL CAN FIRE HERE (PR #755 review, finding 2): both
  // appliers can pass the pending check concurrently, each computes its own
  // floor from the LIVE row, and the loser — reading the row AFTER
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
  /* The plan's part, off the SAME row as the balance: one read, one moment. A
     null row answers 0 — the only direction that cannot claw back credits whose
     provenance could not be read. */
  const returnable = Math.min(row.credits, liveCredits ? planAllowanceRemaining(liveCredits) : 0);
  if (returnable <= 0) {
    // Nothing left to return — the allowance was spent, or every credit left
    // on the balance is one the customer BOUGHT (#1661). Either way that is the
    // floor rule working, not a failure; the row resolves so it stops reading
    // as queued work.
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

/** The ledger key for the part of an unwind collected after the period grant
 *  (#2054). Its own family, so it can never collide with the settlement's. */
export function settlementShortfallLedgerRef(stripeInvoiceId: string): string {
  return `plan-change-settle-shortfall:${stripeInvoiceId}`;
}

export type ShortfallResult =
  | { outcome: "none" }
  | { outcome: "already-collected" }
  | { outcome: "collected"; creditsMoved: number }
  | { outcome: "failed"; error: string };

/**
 * ⚠ **CREDITS SPENT WHILE A SWITCH INVOICE WAITS ARE TAKEN FROM THE PERIOD IT
 * BUYS (#2054).**
 *
 * The quote fixes the take-back (`creditUnwind`) and the spent-share charge at
 * Confirm, and Stripe credits the unused days' money for exactly that take-back
 * on the switch invoice. The take-back itself lands when that invoice is PAID,
 * floored at what is left of the allowance then. On a card that pays at once
 * the two moments are the same. On a 3DS card they are not: the invoice sits
 * open while she authenticates, the subscription has already moved, and
 * anything she spends in that window was refunded in money AND spent — the
 * floor turned it into money with nothing behind it.
 *
 * So once the invoice's own period grant has landed, whatever the floor could
 * not take is taken from the plan's part of the balance — which now holds the
 * new period's allowance. Her balance ends exactly where the confirm step said
 * it would (old balance − take-back + new grant), less what she spent since.
 * Never more than the quoted take-back, never out of credits she bought, and
 * no second charge to her card.
 *
 * Durable rather than carried: the shortfall is the settlement row's quoted
 * `credits` minus what the ledger says the settlement actually moved, so a
 * redelivery, or a settlement applied earlier by `changePlan`'s own fresh
 * read, computes the same number. Its own ledger key makes it run once.
 *
 * ⚠ **IT NEEDS THE PERIOD GRANT, AND ON STRIPE'S REAL SWITCH INVOICE THAT
 * GRANT DOES NOT LAND YET — #2069.** Driven in test mode: the new year is
 * billed as a PRORATION line, `periodBought` skips it, and the webhook exits
 * before the grant and before this. Until #2069 lands this collects nothing
 * (the plan's-part floor finds nothing to take), which is the safe direction;
 * with a grant present the same drive took every spent credit back.
 *
 * Declined alternatives, named: charging the difference in money (a second
 * charge after Confirm, possibly a second 3DS, not on the confirm step); and
 * holding or refusing her spending while the invoice is open (a product
 * decision about blocking her account).
 */
export async function collectPlanChangeShortfall(
  stripeInvoiceId: string,
): Promise<ShortfallResult> {
  const row = await getPlanChangeSettlementByInvoice(stripeInvoiceId);
  if (!row || row.direction !== "unwind" || row.status !== "applied") return { outcome: "none" };

  const shortfallRef = settlementShortfallLedgerRef(stripeInvoiceId);
  if (await getCreditTransactionByRef(row.userId, shortfallRef)) {
    return { outcome: "already-collected" };
  }

  const moveLine = await getCreditTransactionByRef(row.userId, settlementLedgerRef(stripeInvoiceId));
  const moved = moveLine ? Math.max(0, -Number(moveLine.amount)) : 0;
  const shortfall = Math.max(0, row.credits - moved);
  if (shortfall <= 0) return { outcome: "none" };

  const liveCredits = await getUserCredits(row.userId);
  const collectable = Math.min(shortfall, liveCredits ? planAllowanceRemaining(liveCredits) : 0);
  if (collectable <= 0) return { outcome: "none" };

  const result = await deductCredits(
    row.userId,
    collectable,
    "subscription",
    "Credits used between confirming your plan switch and its payment going through",
    shortfallRef,
    { toolKind: null },
  );
  if (!result.success && !result.duplicate) {
    log.error(
      { stripeInvoiceId, userId: row.userId, collectable, error: result.error },
      "[Settlement] shortfall collection failed — failing the event so a redelivery retries",
    );
    return { outcome: "failed", error: result.error ?? "shortfall failed" };
  }
  if (result.duplicate) return { outcome: "already-collected" };
  log.info(
    { stripeInvoiceId, userId: row.userId, quoted: row.credits, moved, collectable },
    "[Settlement] collected the part of a switch take-back spent before its invoice was paid",
  );
  return { outcome: "collected", creditsMoved: collectable };
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
