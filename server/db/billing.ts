/**
 * Billing Domain — subscriptions, credit top-ups, usage stats, and daily usage charts.
 */

import { eq, and, desc, gte, lt, asc, sql } from "drizzle-orm";
import {
  credits,
  creditTransactions,
  users,
  PlanTier,
} from "../../drizzle/schema";
import { getDb, withTransaction } from "./connection";
import {
  addCredits,
  creditReferenceSemanticsMatch,
  getCreditTransactionByRef,
  getUserCredits,
  isDuplicateCreditReferenceError,
  normalizeCreditReferenceId,
  type CreditWriteResult,
} from "./credits";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/billing");

export async function updateUserSubscription(
  userId: number,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?:
      | "active"
      | "canceled"
      | "past_due"
      | "unpaid"
      | "trialing"
      | null;
    planTier?: PlanTier;
    /** Cache of the Stripe price's own recurring interval (#664); null when
     *  there is no subscription or the interval could not be read. */
    billingInterval?: "month" | "year" | null;
    planExpiresAt?: Date | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    await db.update(credits).set(data).where(eq(credits.userId, userId));
    return { success: true };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to update subscription:");
    return { success: false, error: "Failed to update subscription" };
  }
}

export async function getUserByStripeCustomerId(
  stripeCustomerId: string
) {
  const db = await getDb();
  if (!db) {
    // ⚠ THROWS, NEVER `null` (#789, PR #791 review finding 1): `null` here
    // meant both "no account holds this customer id" and "database
    // unavailable". Every caller is a Stripe webhook handler, and the two
    // dispute handlers read a null user as "user not identified" and ACK the
    // event — so a boot-time no-db window ACKed a won dispute (credits never
    // restored) and a filed dispute (no suspend, no revoke) FOREVER, because
    // Stripe never redelivers a 200. `getDb()` caches its instance, so this
    // is the FIRST read on every road and the one that decides. A throw
    // reaches the webhook's outer catch, which answers 400 so Stripe
    // redelivers; a genuinely unknown customer still comes back `null`.
    log.error("[Database] Cannot get user by Stripe customer id: database not available");
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(credits)
    .where(eq(credits.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (result.length === 0) return null;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, result[0].userId))
    .limit(1);

  return user.length > 0 ? { ...user[0], credits: result[0] } : null;
}

/**
 * ⚠ THE ROLLOVER IS COMPUTED FROM THE BALANCE THE WRITE IS CONDITIONED ON
 * (#664 review round 2, finding 1). This function used to take a rollover the
 * CALLER computed from its own earlier read and SET the balance absolutely —
 * so any write that landed between that read and the SET was silently erased.
 * The named exploit was the plan-change unwind racing the switch invoice's
 * grant (which reopened the credit-minting loop the unwind exists to close),
 * but the class is older and wider: a SPEND interleaving an ordinary renewal
 * refresh was erased the same way, in the customer's favour, on every renewal
 * since this function existed.
 *
 * So the caller passes HOW to compute the rollover (`computeRollover`), and
 * this function reads the balance, computes, and writes with a COMPARE-AND-
 * SET on the very balance it computed from — a concurrent write makes the
 * UPDATE match zero rows and the loop re-reads. Three misses fail loud; the
 * only caller is the Stripe webhook, and Stripe redelivers a failed event.
 */
export async function refreshMonthlyCredits(
  userId: number,
  monthlyCredits: number,
  computeRollover: (currentBalance: number) => number,
  referenceId: string,
  /** Ledger line override — the annual grant says it is a year's allowance
   *  rather than calling 12 months a "monthly refresh" (#664). */
  description?: string,
): Promise<CreditWriteResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }
  const ledgerReferenceId = normalizeCreditReferenceId(referenceId);

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const userCredits = await getUserCredits(userId);
      if (!userCredits) {
        return { success: false, error: "User credits not found" };
      }

      const balanceReadFrom = userCredits.balance;
      const rolloverCredits = Math.max(0, Math.floor(computeRollover(balanceReadFrom)));
      const newBalance = monthlyCredits + rolloverCredits;

      const written = await withTransaction(async (tx) => {
        const updateResult = await tx
          .update(credits)
          .set({
            balance: newBalance,
            rolloverCredits: rolloverCredits,
            lastRefreshAt: new Date(),
          })
          .where(and(eq(credits.userId, userId), eq(credits.balance, balanceReadFrom)));

        const affected = (updateResult as any)[0]?.affectedRows ?? 0;
        if (affected === 0) {
          // The balance moved under us — nothing written; re-read and retry.
          return null;
        }

        await tx.insert(creditTransactions).values({
          userId,
          amount: monthlyCredits,
          type: "subscription",
          description:
            description ?? `Monthly credit refresh (${monthlyCredits} credits + ${rolloverCredits} rollover)`,
          referenceId: ledgerReferenceId,
          balanceAfter: newBalance,
        });

        return { success: true as const, newBalance };
      });

      if (written) return written;
    }

    log.error(
      { userId, referenceId: ledgerReferenceId },
      "[Database] credit refresh lost the balance race three times — failing loud so the event is redelivered",
    );
    return { success: false, error: "Balance changed during refresh — retry" };
  } catch (error) {
    if (isDuplicateCreditReferenceError(error)) {
      const existing = await getCreditTransactionByRef(userId, ledgerReferenceId);
      if (!existing || !creditReferenceSemanticsMatch(
        existing,
        { type: "subscription", amount: monthlyCredits },
      )) {
        log.fatal(
          {
            userId,
            referenceId: ledgerReferenceId,
            existing: existing && { id: existing.id, type: existing.type, amount: existing.amount },
            requested: { type: "subscription", amount: monthlyCredits },
          },
          "[Database] CRITICAL monthly-refresh reference collision",
        );
        return {
          success: false,
          error: "Credit reference collision",
          duplicate: true,
          collision: true,
        };
      }
      const current = await getUserCredits(userId);
      if (!current) return { success: false, error: "User credits not found", duplicate: true };
      return { success: true, newBalance: current.balance, duplicate: true };
    }
    log.error({ err: error }, "[Database] Failed to refresh monthly credits:");
    return { success: false, error: "Failed to refresh credits" };
  }
}

export async function addTopupCredits(
  userId: number,
  creditAmount: number,
  referenceId: string
): Promise<{
  success: boolean;
  newBalance?: number;
  error?: string;
  duplicate?: boolean;
}> {
  return addCredits(
    userId,
    creditAmount,
    "topup",
    `Credit top-up: ${creditAmount} credits`,
    referenceId
  );
}

export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      planTier: credits.planTier,
      planExpiresAt: credits.planExpiresAt,
      stripeCustomerId: credits.stripeCustomerId,
      stripeSubscriptionId: credits.stripeSubscriptionId,
      subscriptionStatus: credits.subscriptionStatus,
      billingInterval: credits.billingInterval,
      currentPeriodStart: credits.currentPeriodStart,
      currentPeriodEnd: credits.currentPeriodEnd,
      balance: credits.balance,
      creditsPurchased: credits.creditsPurchased,
      creditsUsed: credits.creditsUsed,
      rolloverCredits: credits.rolloverCredits,
      lastRefreshAt: credits.lastRefreshAt,
    })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get credit transaction history with pagination.
 */
export async function getCreditHistory(
  userId: number,
  limit: number = 20,
  offset: number = 0
): Promise<{
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    description: string | null;
    referenceId: string | null;
    balanceAfter: number;
    engineUsed: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const db = await getDb();
  if (!db) {
    return { transactions: [], total: 0 };
  }

  try {
    const transactions = await db
      .select({
        id: creditTransactions.id,
        amount: creditTransactions.amount,
        type: creditTransactions.type,
        description: creditTransactions.description,
        referenceId: creditTransactions.referenceId,
        balanceAfter: creditTransactions.balanceAfter,
        engineUsed: creditTransactions.engineUsed,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    const total = countResult[0]?.count || 0;

    return { transactions, total };
  } catch (error) {
    log.error({ err: error }, "[Database] Failed to get credit history:");
    return { transactions: [], total: 0 };
  }
}

/**
 * THE SPEND WINDOW — which span a cycle's spend is summed over, decided in one
 * place because every surface that says "this cycle" must mean the same span.
 *
 * ⚠ **IT IS A TIMESTAMP, NOT A DAY** — that is the whole of #624. The window
 * begins at `currentPeriodStart` itself, which for every real Stripe
 * subscription is a mid-day instant (the period starts when the customer pays).
 * The old road asked `getDailyUsage` for whole UTC days and filtered on the
 * DAY of that instant, so a period that rolled over at 14:00 counted the
 * fourteen hours of the PREVIOUS cycle that shared its date — on a fresh cycle,
 * where the divisor is small, that error carries the whole burn rate and can
 * put the ink button on a rung above what the customer needs.
 *
 * `basis` says which window was actually used, and the copy on the surface is
 * derived from it rather than decided a second time from the same period start
 * (working law 4): a label that says "this billing period" over a rolling
 * 30-day sum is the same class of defect one layer up.
 */
export type SpendBasis = "period" | "rolling30";

export type SpendWindow = {
  /** The instant the window opens. */
  from: Date;
  /** Which window it is — the customer's cycle, or the fallback. */
  basis: SpendBasis;
};

/** Milliseconds in a day, named because `86_400_000` in a formula reads as noise. */
const DAY_MS = 86_400_000;

/** The rolling window an account with no billing period is measured over. */
const ROLLING_DAYS = 30;

/**
 * Which window this account's spend is summed over.
 *
 * ⚠ **A PERIOD START IN THE FUTURE IS NO PERIOD.** Stripe can hand us a period
 * that has not begun (a scheduled change), and a window with a negative span
 * would divide a spend by a negative number of days. The fallback is the same
 * one a free account gets, which is a real window that names itself.
 *
 * Pure, and exported so its boundary decisions can be driven without a
 * database — the SQL that uses it is proved separately against real rows.
 */
export function spendWindow(periodStart: Date | null | undefined, now: Date): SpendWindow {
  if (periodStart && !Number.isNaN(periodStart.getTime()) && periodStart.getTime() <= now.getTime()) {
    return { from: periodStart, basis: "period" };
  }
  return { from: new Date(now.getTime() - ROLLING_DAYS * DAY_MS), basis: "rolling30" };
}

/**
 * WHAT THIS ACCOUNT HAS SPENT INSIDE ITS CURRENT BILLING CYCLE — #624, his
 * approved option (a).
 *
 * ⚠ **IT REPLACES A REASSEMBLY, NOT A WRONG SUM.** Both money modals and the
 * Usage pane used to ask `getDailyUsage` for a chart's worth of whole-UTC-day
 * buckets and add the ones inside the window back up. That endpoint cannot
 * answer this question: its rows are keyed by day, so the sub-day edge the
 * period actually has does not survive the query, and it caps at 90 days, so an
 * annual subscriber's window could never be summed at all. This asks the ledger
 * the question the surfaces are actually asking, at the precision the period is
 * recorded at, with no cap.
 *
 * ⚠ **IT THROWS RATHER THAN ANSWERING ZERO.** Every other reader in this file
 * swallows its error and returns an empty shape, which is defensible for a
 * chart and is not defensible here: a spend of zero is a REAL answer on this
 * surface (somebody who has not cast this cycle), and it is the answer that
 * makes the burn band hide itself. Returning it for a database that did not
 * respond would be a confident wrong number on the screen where people pay.
 * The callers already render "not known yet" as no rate at all.
 *
 * The owner is in the WHERE of both statements (invariant 1) and comes from
 * `ctx.user.id` at the procedure (invariant 3); the projection is explicit
 * (invariant 8) and is two numbers and a word.
 */
export async function getCycleSpend(
  userId: number,
  now: Date = new Date(),
): Promise<{ spent: number; days: number; basis: SpendBasis; from: Date }> {
  const db = await getDb();
  if (!db) {
    throw new Error("[Database] getCycleSpend: no database connection");
  }

  const subscription = await db
    .select({ currentPeriodStart: credits.currentPeriodStart })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);

  const window = spendWindow(subscription[0]?.currentPeriodStart ?? null, now);

  /*
    SUMMED IN THE STATEMENT, not by reading rows back. A cycle can hold
    thousands of transactions and none of them is wanted here — only the total.
    `amount` is negative for a spend (`getDailyUsage` filters the same way), so
    the sum is taken over its absolute value.
  */
  const totals = await db
    .select({
      spent: sql<string | number | null>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        lt(creditTransactions.amount, 0),
        gte(creditTransactions.createdAt, window.from),
      ),
    );

  /* mysql2 returns a DECIMAL sum as a string; `Number` of it is exact at these
     magnitudes and `Number(null)` is 0, which no row set can otherwise produce
     because of the COALESCE. */
  const spent = Number(totals[0]?.spent ?? 0);

  return {
    spent: Number.isFinite(spent) ? Math.max(0, spent) : 0,
    /*
      ⚠ THE SPAN IS FRACTIONAL AND TRAVELS WITH THE SUM. It is the divisor a
      burn rate uses, and it is the exact elapsed time of the window that was
      actually summed — so a sum and its divisor cannot measure different spans,
      which is the defect (#385, #624) this whole family is made of. The
      caller clamps it before dividing; an hour-old cycle has a real spend and
      no meaningful rate.
    */
    days: Math.max(0, (now.getTime() - window.from.getTime()) / DAY_MS),
    basis: window.basis,
    from: window.from,
  };
}
