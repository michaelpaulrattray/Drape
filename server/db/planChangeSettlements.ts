/**
 * Plan-change credit settlements (#711) — the QUEUE half of the settlement
 * rule: a plan change's credit move is recorded here when Stripe accepts the
 * update, and applied (server/stripe/planChangeSettlement.ts) when the
 * change's own invoice settles.
 *
 * This table is bookkeeping, not the idempotency guard: the credit ledger's
 * unique (userId, referenceId) index — keyed on the invoice id — is what
 * stops a double application when changePlan and the invoice webhook race.
 * The status column exists so a row that will never apply (a final payment
 * failure) says so instead of reading as queued work forever.
 */
import { and, eq, gte, inArray } from "drizzle-orm";
import {
  creditTransactions,
  planChangeSettlements,
  type PlanChangeSettlement,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("db/planChangeSettlements");

/**
 * The ONE ledger key for a change invoice's credit move — `changePlan`, the
 * webhook and the renewal's netting reader all spell it from here.
 *
 * ⚠ **IT LIVED IN `server/stripe/planChangeSettlement.ts` UNTIL PR #1946's
 * REVIEW AND IS RE-EXPORTED THERE, NOT RE-DECLARED.** The netting reader has
 * to look the move up in the ledger, and that module imports `../db` — so
 * reading it from there would have closed an import cycle through the whole
 * database barrel. A second spelling beside the table would have been working
 * law 4 on the one string that makes two racing appliers safe.
 */
export function settlementLedgerRef(stripeInvoiceId: string): string {
  return `plan-change-settle:${stripeInvoiceId}`;
}

export type RecordPlanChangeSettlementInput = {
  userId: number;
  stripeInvoiceId: string;
  direction: "grant" | "unwind";
  credits: number;
  description: string;
  clientRequestId?: string;
};

export async function recordPlanChangeSettlement(
  input: RecordPlanChangeSettlementInput,
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };
  try {
    await db
      .insert(planChangeSettlements)
      .values({
        userId: input.userId,
        stripeInvoiceId: input.stripeInvoiceId,
        direction: input.direction,
        credits: input.credits,
        description: input.description,
        clientRequestId: input.clientRequestId ?? null,
      })
      // One invoice, one settlement: a replayed record for the same invoice
      // (a retried mutation that somehow re-read the same invoice) is a no-op.
      .onDuplicateKeyUpdate({ set: { stripeInvoiceId: input.stripeInvoiceId } });
    return { success: true };
  } catch (error) {
    log.error({ err: error, input }, "[Settlement] failed to record plan-change settlement");
    return { success: false, error: "Failed to record settlement" };
  }
}

export async function getPlanChangeSettlementByInvoice(
  stripeInvoiceId: string,
): Promise<PlanChangeSettlement | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(planChangeSettlements)
    .where(eq(planChangeSettlements.stripeInvoiceId, stripeInvoiceId))
    .limit(1);
  return rows[0] ?? null;
}

/** pending → applied/void. Only a pending row moves; returns whether one did. */
export async function resolvePlanChangeSettlement(
  stripeInvoiceId: string,
  status: "applied" | "void",
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .update(planChangeSettlements)
    .set({ status, resolvedAt: new Date() })
    .where(
      and(
        eq(planChangeSettlements.stripeInvoiceId, stripeInvoiceId),
        eq(planChangeSettlements.status, "pending"),
      ),
    );
  const affected = (result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0;
  return affected > 0;
}

/**
 * Void every pending settlement a user still has — the subscription-death
 * road (PR #755 review, finding 3): a subscription deleted while its change
 * invoice sat unpaid (voluntary cancel, dashboard action) strands the row
 * pending with no invoice event ever coming. The product holds one
 * subscription per user, so every pending row of theirs belongs to the dead
 * one. Voiding refuses movement, which is the safe direction on both
 * directions of the move.
 *
 * Returns the `stripeInvoiceId` of every row of theirs whose credit side is
 * now `void` — not a count (#765): the caller closes the INVOICE side of
 * each one too (founder ruling 2026-09-10, option A, *"close the invoice
 * too, the same as the payment-failure road"*), and a count gave it nothing
 * to void with. Two properties of that list, each from a PR #786 review
 * finding:
 *
 * - **It includes rows that were ALREADY void**, so a redelivered event
 *   retries an invoice void that failed transiently the first time
 *   (finding 1). `voidInvoice` reads the status first and treats a closed
 *   invoice as done, so the retry is one read per row and no money question.
 *   Without this the first delivery moved the rows to void, a Stripe blip
 *   failed the invoice void, and every redelivery found nothing pending and
 *   left the invoice payable forever — the exact defect, surviving one error.
 *   ⚠ The redelivery itself is the CALLER's doing (round 2): a failed invoice
 *   void fails the webhook event after the downgrade, so Stripe sends the
 *   same event again instead of recording it as done. This list only makes
 *   that retry reach the invoice; it cannot cause it.
 * - **It is read back AFTER the update, from the rows that are actually
 *   `void`** (finding 2). A row read as pending and concurrently resolved to
 *   `applied` by a racing `invoice.paid` is not re-voided (the update is
 *   guarded on `pending`) and is therefore NOT in the list — so the caller
 *   never asks Stripe to void an invoice whose credits DID move, and the
 *   already-paid alarm downstream is true whenever it fires.
 *
 * MySQL's UPDATE returns no rows, which is why this is three statements.
 */
/**
 * The invoice ids of every settlement of theirs whose credit side is ALREADY
 * `void` — a READ, never a write, so it is safe on a road where the writer
 * above is not (PR #794 review finding 1): a `subscription.deleted` event
 * whose invoice void failed is redelivered for days, and if the customer has
 * resubscribed by then the stale guard must keep the writer away from the NEW
 * subscription's pending row — but the OLD subscription's invoice still has
 * to close, or it stays payable on the hosted page against credits its void
 * row will refuse. A void row's invoice must never take money, whichever
 * subscription it hung on, so retrying `voidInvoice` on this list is always
 * the safe direction. Throws on a null db rather than answering `[]` (#791's
 * reader rule): an empty list here means "nothing to close", and a database
 * that cannot be read must not say that.
 */
/**
 * The SIGNED net of what every plan-change settlement of theirs APPLIED on or
 * after `since` ACTUALLY MOVED — read off the credit ledger, never off the
 * settlement row's quoted `credits` (#1937).
 *
 * ⚠ **THE QUOTED AMOUNT AND THE MOVED AMOUNT ARE DIFFERENT NUMBERS, AND
 * READING THE FIRST AS THE SECOND SUBTRACTED MONEY NOBODY TOOK** (PR #1946
 * review, repair 2). `applyPlanChangeSettlement` floors an unwind at the
 * plan's part of the live balance (#1661) and resolves the row `applied`
 * EVEN WHEN NOTHING MOVED — correctly, because the floor working is not a
 * failure. So an unwind quoted at 40,000 of which 10,000 was takeable nets
 * −40,000 off a quoted read, and −10,000 off this one; at `returnable = 0`
 * the quoted read docked the customer a take-back that never happened.
 *
 * ⚠ **SO THE DIRECTION COLUMN IS NOT CONSULTED AT ALL.** The ledger's
 * `amount` is already signed — `+credits` from `addCredits`, `-credits` from
 * `deductCredits` — and a sign derived a second time from a second column is
 * the mirror this reader exists to stop being.
 *
 * # WHAT IT IS FOR
 *
 * A renewal grant SETs the balance absolutely:
 *
 *     balance = grant + rollover(planAllowance) + purchasedRemaining
 *
 * A plan-change settlement is not a purchase, so it lands in `planAllowance`
 * — and the rollover percentage is then applied to it. That is right for a
 * change made inside the period being CLOSED (its proration bought days of
 * that period, and unspent allowance rolls at the plan's rate), and wrong for
 * one made inside the period being GRANTED, which is what the late-webhook
 * window produces: Stripe has already advanced the subscription, so the
 * change's proration buys days of the NEW period, and the renewal then hands
 * back a quarter of credits the customer paid for days they have not had yet.
 *
 * So the caller passes the invoice's own period start, and what comes back is
 * netted out of the rollover base and added whole — exactly the treatment
 * purchased credits already get, for the same reason. ⚠ What the CALLER adds
 * back is this number clamped at the plan's part, because what moved and what
 * is still on the balance are two facts and only the second can cross a
 * boundary; `server/db/billing.ts` carries that half.
 *
 * ⚠ **`since` IS THE INVOICE'S PERIOD START, NEVER `lastRefreshAt`, AND THE
 * DIFFERENCE IS THE WHOLE DISCRIMINATOR.** Both timestamps are to hand and
 * only one of them separates the two cases. `lastRefreshAt` would put every
 * ordinary mid-period plan change in the window — a customer who upgrades on
 * day 10 of a normally-processed cycle would carry that proration whole into
 * the next period instead of rolling it, which is an over-grant on the
 * commonest road in the product. The invoice's period start is later than any
 * change belonging to the closing period and earlier than any change made in
 * the window this card is about.
 *
 * ⚠ **`applied` ONLY.** A `pending` row has not moved the balance, and a
 * `void` row never will; netting either out would subtract a number that is
 * not there. `resolvedAt` is the moment the move actually landed, which is
 * why it rather than `createdAt` is the column compared. The ledger lookup
 * does not make the status filter redundant: a pending row has no ledger line
 * to find, but it is the WINDOW that is being asked for here, and the window
 * is a property of the settlement rather than of the ledger.
 *
 * ⚠ **A DUPLICATE APPLICATION CANNOT DOUBLE-COUNT, BY CONSTRUCTION.** The
 * ledger's unique (userId, referenceId) index is what makes the changePlan /
 * webhook race safe, so one invoice has at most one line whoever wins — which
 * is also why the lookup is keyed on the ref and not on a time range.
 *
 * Throws on an unreadable database rather than answering `0` (#791's reader
 * rule, and it bites harder here than usual): `0` is a perfectly ordinary
 * answer meaning *no plan change in the window*, so a failed read would be
 * indistinguishable from the common case and would silently restore the very
 * arithmetic this exists to replace.
 */
export async function netAppliedPlanChangeSettlementsSince(
  userId: number,
  since: Date,
): Promise<number> {
  const db = await getDb();
  if (!db) {
    log.error("[Settlement] Cannot read applied settlements: database not available");
    throw new Error("Database not available");
  }
  /* Which settlements fall in the window — the settlement row owns that
     question, because `resolvedAt` is the moment the move landed. */
  const settled = await db
    .select({ stripeInvoiceId: planChangeSettlements.stripeInvoiceId })
    .from(planChangeSettlements)
    .where(
      and(
        eq(planChangeSettlements.userId, userId),
        eq(planChangeSettlements.status, "applied"),
        gte(planChangeSettlements.resolvedAt, since),
      ),
    );
  const refs = settled
    .map((row) => row.stripeInvoiceId)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .map(settlementLedgerRef);
  /* The ordinary answer, and it is reached without a second statement. */
  if (refs.length === 0) return 0;

  /* HOW MUCH MOVED — the ledger's own signed amounts, user-scoped. `amount`
     is `+credits` on an add and `-credits` on a deduct (`server/db/credits.ts`),
     so the sum IS the signed net and the direction column is not consulted. */
  const moves = await db
    .select({ amount: creditTransactions.amount })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        inArray(creditTransactions.referenceId, refs),
      ),
    );
  let net = 0;
  for (const move of moves) {
    /* A column that cannot be read as a number contributes nothing rather
       than poisoning a money sum with NaN. */
    if (!Number.isFinite(move.amount)) continue;
    net += Math.trunc(move.amount);
  }
  return net;
}

export async function getVoidPlanChangeSettlementInvoiceIdsForUser(
  userId: number,
): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    log.error("[Settlement] Cannot read void settlements: database not available");
    throw new Error("Database not available");
  }
  const rows = await db
    .select({ stripeInvoiceId: planChangeSettlements.stripeInvoiceId })
    .from(planChangeSettlements)
    .where(
      and(
        eq(planChangeSettlements.userId, userId),
        eq(planChangeSettlements.status, "void"),
      ),
    );
  return rows.map((row) => row.stripeInvoiceId);
}

export async function voidPendingPlanChangeSettlementsForUser(
  userId: number,
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const candidates = await db
    .select({ stripeInvoiceId: planChangeSettlements.stripeInvoiceId })
    .from(planChangeSettlements)
    .where(
      and(
        eq(planChangeSettlements.userId, userId),
        inArray(planChangeSettlements.status, ["pending", "void"]),
      ),
    );
  const candidateIds = candidates.map((row) => row.stripeInvoiceId);
  if (candidateIds.length === 0) return [];
  await db
    .update(planChangeSettlements)
    .set({ status: "void", resolvedAt: new Date() })
    .where(
      and(
        eq(planChangeSettlements.userId, userId),
        eq(planChangeSettlements.status, "pending"),
        inArray(planChangeSettlements.stripeInvoiceId, candidateIds),
      ),
    );
  const voided = await db
    .select({ stripeInvoiceId: planChangeSettlements.stripeInvoiceId })
    .from(planChangeSettlements)
    .where(
      and(
        eq(planChangeSettlements.userId, userId),
        eq(planChangeSettlements.status, "void"),
        inArray(planChangeSettlements.stripeInvoiceId, candidateIds),
      ),
    );
  return voided.map((row) => row.stripeInvoiceId);
}
