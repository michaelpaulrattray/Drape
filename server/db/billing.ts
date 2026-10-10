/**
 * Billing Domain — subscriptions, credit top-ups, and cycle spend.
 */

import { eq, and, gt, gte, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import {
  MONTHS_IN_A_PAID_YEAR,
  annualMonthLedgerRef,
} from "../billing/annualCreditMonths";
import {
  credits,
  creditTransactions,
  subscriptionRenewalReminders,
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
  creditBuckets,
  creditsOutsidePlanRules,
  planAllowanceRemaining,
  settledCreditBounds,
  type CreditWriteResult,
} from "./credits";
import { netAppliedPlanChangeSettlementsSince } from "./planChangeSettlements";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/billing");

/**
 * ⚠ THE THREE BOUNDS EXACTLY AS THEY WERE READ, FOR A COMPARE-AND-SET'S WHERE
 * (#2185, the relay's finding 2 on PR #2208). A write that states the balance
 * and the bounds outright from an earlier read is safe only if NEITHER moved in
 * between. `eq(balance, …)` alone is not enough: a grant and an equal spend
 * between the read and the write leave the balance where it was and the bounds
 * changed — a 2,000 referral landing and 2,000 spent, and a renewal would write
 * the referral bound back to 0, turning the reward into plan credits. With the
 * bounds in the WHERE, that interleave misses and the loop re-reads.
 */
function boundsAsRead(row: {
  purchasedBalance?: number | null;
  keptBalance?: number | null;
  promoBalance?: number | null;
}) {
  return [
    eq(credits.purchasedBalance, row.purchasedBalance ?? 0),
    eq(credits.keptBalance, row.keptBalance ?? 0),
    eq(credits.promoBalance, row.promoBalance ?? 0),
  ];
}

/**
 * THE PAID YEAR A YEARLY PLAN'S MONTHLY GRANTS BELONG TO (#2152, his ruling on
 * #2159, 2026-10-10: *"yearly credits apply month by month"*). Written by the
 * paid annual invoice in the same write as the year's first month, read by
 * `server/billing/annualMonthlyGrant.ts`. `monthlyCredits` is one month's
 * allowance in LEDGER credits — the base plus the dial's steps the invoice
 * billed.
 */
export type AnnualGrantYear = {
  subscriptionId: string;
  /** The paid invoice that opened the year — a lost dispute is matched against it. */
  invoiceId: string;
  periodStart: Date;
  periodEnd: Date;
  monthlyCredits: number;
};

/** The four year columns, cleared: no year is in flight. */
export const NO_ANNUAL_YEAR = {
  annualGrantSubscriptionId: null,
  annualGrantInvoiceId: null,
  annualGrantPeriodStart: null,
  annualGrantPeriodEnd: null,
  annualGrantMonthlyCredits: null,
} as const;

function annualYearColumns(year: AnnualGrantYear | null) {
  if (year === null) return NO_ANNUAL_YEAR;
  return {
    annualGrantSubscriptionId: year.subscriptionId,
    annualGrantInvoiceId: year.invoiceId,
    annualGrantPeriodStart: year.periodStart,
    annualGrantPeriodEnd: year.periodEnd,
    annualGrantMonthlyCredits: year.monthlyCredits,
  };
}

/**
 * The subscription statuses under which a paid year's months keep arriving.
 * `past_due` is in on purpose: on a yearly plan nothing falls due mid-year but
 * an upgrade's own invoice, and an unpaid UPGRADE must not stop the months of
 * a year that WAS paid — the upgrade's higher month is installed only when its
 * money settles, so what keeps arriving is what was paid for. `unpaid` is in
 * for the same reason (#2152 repair 1): Stripe's dunning can leave a failed
 * upgrade's subscription `unpaid` while the year it already paid for runs on,
 * and a failed RENEWAL cannot reach a year this way — its year's columns are
 * the last PAID year's, whose end has already passed. `canceled` is out: the
 * plan is over.
 */
export const ANNUAL_GRANT_LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid"] as const;

/** The answer a monthly grant gets when the year it was asked about is no longer the one in flight. */
export const ANNUAL_YEAR_NOT_CURRENT = "The paid year this month belongs to is no longer in flight";

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
    /** When a cancelled plan's credits expire (#2152). Stamped by the
     *  subscription-deleted webhook; see {@link expirePlanCredits}. */
    planCreditsExpireAt?: Date | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  /* ⚠ A RETURN TO A PAID PLAN CANCELS A PENDING EXPIRY (#2152). A customer who
     cancels and comes back inside the 30 days keeps their plan credits — the
     expiry was for an account that LEFT. Cleared here, in the one write every
     road to a paid tier passes through, rather than at each caller, so a road
     added later cannot forget it. An explicit stamp in the same call wins. */
  const returningToPaid =
    data.planTier !== undefined && data.planTier !== "free" && data.planCreditsExpireAt === undefined;
  /* ⚠ AND A MOVE TO FREE ENDS A YEARLY PLAN'S MONTHLY GRANTS (#2152, his
     ruling on #2159: "yearly credits apply month by month"). Cancelling stops
     the months still to come; the worker also refuses a Free row, so this is
     the second of two locks, and it is here for the same reason as the clear
     above — every road to Free passes through this one write. */
  const leavingForFree = data.planTier === "free";
  const values = {
    ...data,
    ...(returningToPaid ? { planCreditsExpireAt: null } : {}),
    ...(leavingForFree ? NO_ANNUAL_YEAR : {}),
  };

  try {
    await db.update(credits).set(values).where(eq(credits.userId, userId));
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
 *
 * ⚠ AND THE ROLLOVER RULE IS APPLIED TO THE PLAN'S PART OF THE BALANCE, NEVER
 * TO CREDITS THE CUSTOMER BOUGHT (#1604, P1-5).
 *
 * The rollover percentage is a rule about a plan's own monthly allowance. Until
 * this card it was applied to the WHOLE balance and the result SET, so a
 * customer holding 25,000 credits they had paid for kept 12,500 of them through
 * one Starter renewal and 6,250 through the next — their money, taken back by a
 * plan rule that was never about it. Nobody had lost anything only because the
 * one-time top-up product was removed in February and no road into
 * `addTopupCredits` exists today; #1606 sells top-ups again and this ships
 * first, which is the card's own stated order.
 *
 * So the balance the caller's rule sees is `planAllowanceRemaining(row)` — the
 * balance minus the purchased credits still on it — and the purchased part is
 * added back whole:
 *
 *     balance = grant + computeRollover(planPart) + purchasedRemaining
 *
 * The split is read from the SAME row the compare-and-set is conditioned on, so
 * a concurrent spend cannot make the protection read one balance and the write
 * another; and `purchasedBalance` is re-stated inside that same conditioned
 * UPDATE, which is where the upper bound gets settled against a balance the
 * customer has spent down.
 *
 * ⚠ `subscription_update` — the interval-switch road — passes the identity
 * rule, and it stays exactly what it was: identity over the plan part plus the
 * purchased part whole is identity over the balance. The behaviour of every
 * road that has no purchased credits on it is unchanged, arithmetically and
 * not merely in intent, which is why every existing arm in
 * `server/creditRefreshRace.test.ts` still reads the same numbers.
 * (Since #2152 that rule is identity CAPPED at one month's worth of the plan —
 * the cap is the caller's rule, and this function still only sees a rule.)
 *
 * ⚠ AND A PLAN-CHANGE MOVE SETTLED INSIDE THE PERIOD BEING GRANTED CROSSES
 * THE BOUNDARY WHOLE, EXACTLY LIKE A PURCHASED CREDIT (#1937, `carriedWhole`).
 *
 * It is the same defect as #1604's one source over, and the repair is
 * deliberately the same shape. A plan-change settlement is not a purchase, so
 * it lands in the plan's part of the balance and the rollover percentage is
 * applied to it. That is correct for a change made inside the period being
 * CLOSED. It is wrong for one made inside the period being GRANTED — the
 * late-webhook window, where Stripe has already advanced the subscription, so
 * the proration bought days of the NEW period and a quarter of it is handed
 * back on Pro (half on Starter) before the customer has had those days.
 *
 *     kept    = min(carried, planPart)
 *     balance = purchased + max(0, grant + rollover(planPart − kept) + kept)
 *
 * ⚠ **`carried` IS WHAT MOVED; `kept` IS WHAT IS STILL THERE, AND THE WHOLE
 * CARD TURNS ON NOT CONFUSING THEM** (PR #1946 review, repair 1). A proration
 * the customer has already SPENT is not on the balance to cross any boundary,
 * and crossing it whole regardless handed back up to its entire value: an
 * upgrade of 125,000 spent down to 30,000 granted 305,000 where the on-time
 * timeline gives 205,000. The clamp is inert on an unwind, where `carried` is
 * negative and `planPart` cannot be.
 *
 * ⚠ **THE TWO FLOORS ARE NOT DECORATION AND THEY ARE ON DIFFERENT THINGS.**
 * The rollover base is clamped at zero as belt and braces — with `kept`
 * clamped at `planPart` the subtraction can no longer go negative, and the
 * floor stays because it is one character and the alternative is a percentage
 * of a negative number on a money path. The outer clamp is on the plan's part
 * ALONE, with `purchased` added outside it, because an UNWIND bigger than the
 * new grant must never reach into credits the customer bought — #1604's law,
 * held here by construction rather than by the caller remembering it.
 *
 * ⚠ **ONE RESIDUE IS NAMED RATHER THAN CLAIMED CLOSED.** Nothing on the row
 * says WHICH credits a spend came out of, so a customer who spent part of
 * last period's leftover rather than the proration carries a little more than
 * the on-time timeline would give — bounded by `rolloverPercent × spend`
 * (2,500 ledger on a 10,000 spend at Pro), where the defect this closes was
 * bounded by the whole proration. Lot-tracking is the only exact answer and
 * is #664's "coarse mirror" ruling's own stated limit.
 *
 * ⚠ **EVERY EXISTING CALLER IS ARITHMETICALLY UNCHANGED, not merely unchanged
 * in intent.** `carriedWhole` defaults to 0, and with it zero the expression
 * is `purchased + max(0, grant + rollover(planPart))`, whose two terms are
 * both non-negative — so the clamp cannot bite and this is the old sum. That
 * is the property that lets this land on a money path without re-deriving
 * every arm in `creditRefreshRace.test.ts`.
 */
export async function refreshMonthlyCredits(
  userId: number,
  monthlyCredits: number,
  computeRollover: (currentBalance: number) => number,
  referenceId: string,
  /** Ledger line override — the annual grant says it is a year's allowance
   *  rather than calling 12 months a "monthly refresh" (#664). */
  description?: string,
  /**
   * When the period this grant is FOR began (#1937) — the caller's invoice
   * says, and `null` means it could not. Plan-change moves settled on or
   * after it are netted out of the rollover base and added back whole; `null`
   * takes the old road and rolls them, which is every call this product made
   * before this card.
   *
   * ⚠ It is a DATE and not the net itself, so the read happens INSIDE the
   * compare-and-set loop, off the same attempt as the balance it has to agree
   * with. A net read once by the caller and a balance re-read by a retry are
   * two moments: a settlement landing between them makes the CAS miss, the
   * loop re-read the balance, and then subtract a stale net from a fresh one.
   */
  periodStartForSettlements: Date | null = null,
  /**
   * The yearly road (#2152, his ruling on #2159: *"yearly credits apply month
   * by month"*).
   *
   * - `annualYear` — written IN THE SAME UPDATE as this grant: an object
   *   starts a paid year (the annual invoice's first month), `null` clears one
   *   (a monthly invoice: no year is in flight any more), absent leaves the
   *   columns alone (the monthly worker's own grants).
   * - `onlyWhileYear` — the monthly worker's lock. The grant lands only while
   *   that same paid year is still the one in flight on this row, on a live
   *   yearly subscription not moved to Free: checked on the row each attempt
   *   reads AND in the WHERE of the write, so a cancellation, an interval
   *   switch or the next year's invoice landing between the worker's read and
   *   its write makes the write miss rather than grant into a year that is
   *   over. Answered `{ success: false, error: ANNUAL_YEAR_NOT_CURRENT }`.
   */
  options: {
    annualYear?: AnnualGrantYear | null;
    onlyWhileYear?: AnnualYearLock;
  } = {},
): Promise<CreditWriteResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }
  const ledgerReferenceId = normalizeCreditReferenceId(referenceId);
  const lock = options.onlyWhileYear;

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const userCredits = await getUserCredits(userId);
      if (!userCredits) {
        return { success: false, error: "User credits not found" };
      }
      if (lock && !annualYearStillCurrent(userCredits, lock)) {
        return { success: false, error: ANNUAL_YEAR_NOT_CURRENT };
      }

      const balanceReadFrom = userCredits.balance;
      // Both halves come off the one row the UPDATE below is conditioned on.
      // What the plan's rules never touch — top-ups, referral rewards, staff
      // goodwill, starting credits and promos (#1604, #2185) — crosses whole.
      const outsidePlan = creditsOutsidePlanRules(userCredits);
      const planAllowance = planAllowanceRemaining(userCredits);
      // The part of the plan's allowance the percentage actually governs:
      // anything settled for the period being GRANTED is not last period's
      // leftover and does not roll (#1937). Read on this attempt, beside the
      // balance the write below is conditioned on.
      const carried =
        periodStartForSettlements === null
          ? 0
          : await netAppliedPlanChangeSettlementsSince(userId, periodStartForSettlements);
      /* ⚠ ONLY WHAT IS STILL ON THE PLAN'S PART CROSSES WHOLE. `carried` is
         what the settlement MOVED; this clamp is what survives of it, and the
         two are different numbers the moment the customer spends. An upgrade
         proration of 125,000 spent down to 30,000 carries 30,000, not 125,000
         — handing back a proration that is no longer there was an over-grant
         of up to its whole value, every time the window opened (PR #1946
         review, repair 1).
         An UNWIND is untouched by it: `carried` is negative there and
         `planAllowance` cannot be, so the minimum is the unwind itself. */
      const carriedKept = Math.min(carried, planAllowance);
      const rolloverBase = Math.max(0, planAllowance - carriedKept);
      const rolloverCredits = Math.max(0, Math.floor(computeRollover(rolloverBase)));
      // The credits outside the plan's rules are added OUTSIDE the clamp: an
      // unwind bigger than the new grant empties the plan's part and stops
      // there (#1604).
      const newBalance =
        outsidePlan + Math.max(0, monthlyCredits + rolloverCredits + carriedKept);

      const written = await withTransaction(async (tx) => {
        const updateResult = await tx
          .update(credits)
          .set({
            balance: newBalance,
            rolloverCredits: rolloverCredits,
            // Every bound settled against the balance it was read beside — a
            // customer who spent a bucket down does not carry a stale
            // protection into the next cycle (#1604, #2185).
            ...settledCreditBounds(userCredits),
            lastRefreshAt: new Date(),
            ...(options.annualYear !== undefined ? annualYearColumns(options.annualYear) : {}),
          })
          .where(
            and(
              eq(credits.userId, userId),
              eq(credits.balance, balanceReadFrom),
              ...boundsAsRead(userCredits),
              ...(lock ? annualYearLockConditions(lock) : []),
            ),
          );

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

/**
 * The monthly worker's lock: the year AND the month's size it read. The size
 * is in the lock because an upgrade's settlement can raise the paid year's
 * month between the worker's read and its write; granting the size read
 * before it would hand over the old plan's month for a month the new one was
 * paid for. A changed size misses, and the next pass grants the new one.
 */
export type AnnualYearLock = { subscriptionId: string; periodStart: Date; monthlyCredits: number };

type AnnualYearRow = {
  annualGrantMonthlyCredits?: number | null;
  annualGrantSubscriptionId?: string | null;
  annualGrantPeriodStart?: Date | null;
  stripeSubscriptionId?: string | null;
  planTier?: string | null;
  billingInterval?: string | null;
  subscriptionStatus?: string | null;
};

/** The row-side half of {@link refreshMonthlyCredits}'s `onlyWhileYear` lock. */
export function annualYearStillCurrent(row: AnnualYearRow, lock: AnnualYearLock): boolean {
  return (
    row.annualGrantSubscriptionId === lock.subscriptionId
    && row.annualGrantMonthlyCredits === lock.monthlyCredits
    && row.annualGrantPeriodStart instanceof Date
    && row.annualGrantPeriodStart.getTime() === lock.periodStart.getTime()
    && row.stripeSubscriptionId === lock.subscriptionId
    && row.planTier !== "free"
    && row.billingInterval === "year"
    && (ANNUAL_GRANT_LIVE_STATUSES as readonly string[]).includes(row.subscriptionStatus ?? "")
  );
}

/** The WHERE-side half of the same lock — the same seven facts, so the read and the write cannot disagree. */
function annualYearLockConditions(lock: AnnualYearLock) {
  return [
    eq(credits.annualGrantSubscriptionId, lock.subscriptionId),
    eq(credits.annualGrantMonthlyCredits, lock.monthlyCredits),
    eq(credits.annualGrantPeriodStart, lock.periodStart),
    eq(credits.stripeSubscriptionId, lock.subscriptionId),
    ne(credits.planTier, "free"),
    eq(credits.billingInterval, "year"),
    inArray(credits.subscriptionStatus, [...ANNUAL_GRANT_LIVE_STATUSES]),
  ];
}

/**
 * STOP A YEARLY PLAN'S MONTHS STILL TO COME — ONLY WHEN THE YEAR'S OWN MONEY
 * WAS LOST IN A DISPUTE (#2152; the relay's findings on heads 18315b5f1 and
 * e85357f6a). Scoped to the owner AND to the invoice that opened the year, in
 * the write itself: a dispute decided after the next year began, or a year
 * already cleared, matches nothing. Answers whether a year was cleared.
 */
export async function clearAnnualYear(userId: number, openedByInvoiceId: string): Promise<boolean | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db
      .update(credits)
      .set(NO_ANNUAL_YEAR)
      .where(and(eq(credits.userId, userId), eq(credits.annualGrantInvoiceId, openedByInvoiceId)));
    return ((result as any)[0]?.affectedRows ?? 0) > 0;
  } catch (error) {
    log.error({ err: error, userId }, "[Database] could not clear the paid year");
    return null;
  }
}

/** One account's paid year, as the monthly worker reads it. */
export type AnnualGrantCandidate = {
  userId: number;
  planTier: PlanTier;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  monthlyCredits: number;
};

/**
 * THE ACCOUNTS WITH A PAID YEAR IN FLIGHT (#2152) — how the monthly worker
 * finds its due grants. A year is in flight while its columns are set, its
 * end is still ahead, and the subscription that paid for it is the live
 * yearly one on the row. Which of its months are due, and which have already
 * landed, the worker works out per account (the boundaries from the period,
 * the landed months from the ledger) — a candidate is a year, not a month.
 */
export async function getAnnualGrantCandidates(now: Date): Promise<AnnualGrantCandidate[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      userId: credits.userId,
      planTier: credits.planTier,
      subscriptionId: credits.annualGrantSubscriptionId,
      periodStart: credits.annualGrantPeriodStart,
      periodEnd: credits.annualGrantPeriodEnd,
      monthlyCredits: credits.annualGrantMonthlyCredits,
    })
    .from(credits)
    /* ⚠ A SUSPENDED ACCOUNT RECEIVES NO MONTHS (#2152, repair 2) — a
       chargeback suspends; the months stop with the account. */
    .innerJoin(users, eq(users.id, credits.userId))
    .where(
      and(
        isNull(users.suspendedAt),
        isNotNull(credits.annualGrantSubscriptionId),
        isNotNull(credits.annualGrantPeriodStart),
        isNotNull(credits.annualGrantMonthlyCredits),
        gt(credits.annualGrantPeriodEnd, now),
        eq(credits.stripeSubscriptionId, credits.annualGrantSubscriptionId),
        ne(credits.planTier, "free"),
        eq(credits.billingInterval, "year"),
        inArray(credits.subscriptionStatus, [...ANNUAL_GRANT_LIVE_STATUSES]),
      ),
    );
  return rows.flatMap((row) =>
    row.subscriptionId && row.periodStart && row.periodEnd && row.monthlyCredits !== null
      ? [{
          userId: row.userId,
          planTier: row.planTier,
          subscriptionId: row.subscriptionId,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          monthlyCredits: row.monthlyCredits,
        }]
      : [],
  );
}

/**
 * HOW MANY OF THE YEAR IN FLIGHT'S MONTHS HAVE ACTUALLY LANDED (#2152) — read
 * off the LEDGER, never off a counter, so it cannot drift from what the
 * customer was given. Month 0 is the invoice's own grant and is on the row
 * the moment the year's columns are (one write); months 1..11 are counted by
 * their unique references.
 *
 * `null` means no year is in flight on this account — a monthly plan, or a
 * yearly one granted up front before this change — and the plan-change quote
 * then reads the period as granted whole, which is the truth for both.
 */
export async function getAnnualYearProgress(userId: number): Promise<{
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  monthsGranted: number;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await getUserCredits(userId);
  if (!row?.annualGrantSubscriptionId || !row.annualGrantPeriodStart || !row.annualGrantPeriodEnd) {
    return null;
  }
  const subscriptionId = row.annualGrantSubscriptionId;
  const startMs = row.annualGrantPeriodStart.getTime();
  const refs = Array.from({ length: MONTHS_IN_A_PAID_YEAR - 1 }, (_, i) =>
    normalizeCreditReferenceId(annualMonthLedgerRef(subscriptionId, startMs, i + 1)),
  );
  const landed = await db
    .select({ referenceId: creditTransactions.referenceId })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.userId, userId), inArray(creditTransactions.referenceId, refs)));
  return {
    subscriptionId,
    periodStart: row.annualGrantPeriodStart,
    periodEnd: row.annualGrantPeriodEnd,
    monthsGranted: 1 + new Set(landed.map((line) => line.referenceId)).size,
  };
}

/**
 * AN INSTANT UPGRADE ON A YEARLY PLAN RAISES THE MONTHS STILL TO COME (#2152).
 * Called when the upgrade's invoice is PAID (the settlement applier), so a
 * declined card never earns a higher month.
 *
 * ⚠ **SCOPED TO THE OWNER AND TO THE YEAR IT WAS BOUGHT FOR, IN THE WRITE
 * ITSELF.** The upgrade was quoted against one paid year; its invoice can be
 * paid days later (3DS, Stripe's retries), by which time the next year's
 * invoice, a switch to monthly or a cancellation may have replaced or cleared
 * that year. Trusting the year read at quote time would write the old month
 * onto a different year, so the UPDATE is conditioned on the period start the
 * change was made in: a year that is no longer on the row matches nothing,
 * and the months to come stay as that newer write set them (a new year is
 * sized by its own invoice). Matching nothing is a success: there is no year
 * left for this month to belong to.
 */
export async function installAnnualMonthlyCredits(
  userId: number,
  monthlyCredits: number,
  yearStart: Date,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db
      .update(credits)
      .set({ annualGrantMonthlyCredits: Math.max(0, Math.floor(monthlyCredits)) })
      .where(and(eq(credits.userId, userId), eq(credits.annualGrantPeriodStart, yearStart)));
    return true;
  } catch (error) {
    log.error({ err: error, userId }, "[Database] could not install the upgraded month on the paid year");
    return false;
  }
}

/** The accounts whose cancelled-plan credits are due to expire by `now`. */
export async function getPlanCreditsExpiryCandidates(
  now: Date,
): Promise<Array<{ userId: number; planCreditsExpireAt: Date }>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ userId: credits.userId, planCreditsExpireAt: credits.planCreditsExpireAt })
    .from(credits)
    .where(
      and(
        isNotNull(credits.planCreditsExpireAt),
        lt(credits.planCreditsExpireAt, now),
        eq(credits.planTier, "free"),
      ),
    );
  return rows.filter(
    (row): row is { userId: number; planCreditsExpireAt: Date } => row.planCreditsExpireAt !== null,
  );
}

/** The ledger key of one account's expiry, unique per stamped deadline. */
export function planCreditsExpiryLedgerRef(userId: number, expireAt: Date): string {
  return `plan-credits-expired:${userId}:${Math.floor(expireAt.getTime() / 1000)}`;
}

export type PlanCreditsExpiryResult =
  | { outcome: "expired"; creditsRemoved: number; newBalance: number }
  | { outcome: "nothing-to-expire" }
  | { outcome: "not-due" }
  | { outcome: "already-expired" }
  | { outcome: "failed"; error: string };

/**
 * TAKE A CANCELLED PLAN'S CREDITS OFF THE BALANCE, AND NOTHING ELSE (#2152).
 *
 * The plan's part is `planAllowanceRemaining` — the balance minus the top-ups,
 * referral rewards, staff goodwill, starting credits and promos still on it
 * (#2185) — read off the SAME row the write is conditioned on, exactly as the
 * renewal does it (#1604, #664 round 2). Those stay, whole: the new balance
 * IS `creditsOutsidePlanRules`. Promos leave only by their own clock
 * ({@link expirePromoCredits}).
 *
 * ⚠ **IDEMPOTENT THREE WAYS, because a sweep runs on every server and every
 * six hours.** (1) The write is a compare-and-set on the balance AND on the
 * stamp it was asked about, so a spend landing mid-expiry makes it miss and
 * re-read, and a second sweeper that already cleared the stamp makes it miss
 * for good. (2) The stamp is cleared in that same UPDATE. (3) The ledger line's
 * reference is unique per (account, deadline), so a duplicate insert rolls the
 * whole transaction back and is answered `already-expired`.
 *
 * ⚠ **IT RE-CHECKS THE ACCOUNT IS STILL ON FREE.** The candidate read and this
 * write are two moments; a customer who resubscribed between them has had the
 * stamp cleared by `updateUserSubscription`, and the conditioned write misses.
 */
export async function expirePlanCredits(
  userId: number,
  expireAt: Date,
  now: Date = new Date(),
): Promise<PlanCreditsExpiryResult> {
  const db = await getDb();
  if (!db) return { outcome: "failed", error: "Database not available" };
  const ledgerReferenceId = normalizeCreditReferenceId(planCreditsExpiryLedgerRef(userId, expireAt));

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await getUserCredits(userId);
      if (!row) return { outcome: "failed", error: "User credits not found" };
      if (
        row.planCreditsExpireAt === null ||
        row.planCreditsExpireAt === undefined ||
        row.planCreditsExpireAt.getTime() !== expireAt.getTime()
      ) {
        // Cleared by a return to a paid plan, or by another sweeper's write.
        return { outcome: "already-expired" };
      }
      if (row.planTier !== "free" || expireAt.getTime() > now.getTime()) {
        return { outcome: "not-due" };
      }

      const balanceReadFrom = row.balance;
      // Top-ups, referral rewards, staff goodwill, starting credits and promos
      // stay (#2185); only the plan's part expires here.
      const keptWhole = creditsOutsidePlanRules(row);
      const planPart = planAllowanceRemaining(row);

      const written = await withTransaction(async (tx) => {
        const updateResult = await tx
          .update(credits)
          .set({
            balance: keptWhole,
            /* ⚠ NO SETTLE ON A TIMER (#2185, the relay's finding 1 on PR
               #2208). #2193's refunds rely on no settle landing between a
               charge and its refund, and this sweep runs every six hours. A
               bound can stand above what its bucket holds only when every
               bucket spent before it is empty — the plan's part included — so
               with plan credits to take, every bound already equals its
               reading and writing it changes nothing; with none, no bound is
               written at all. */
            ...(planPart > 0 ? settledCreditBounds(row) : {}),
            rolloverCredits: 0,
            planCreditsExpireAt: null,
          })
          .where(
            and(
              eq(credits.userId, userId),
              eq(credits.balance, balanceReadFrom),
              ...boundsAsRead(row),
              eq(credits.planCreditsExpireAt, expireAt),
              eq(credits.planTier, "free"),
            ),
          );
        const affected = (updateResult as any)[0]?.affectedRows ?? 0;
        if (affected === 0) return null;

        if (planPart > 0) {
          await tx.insert(creditTransactions).values({
            userId,
            amount: -planPart,
            type: "subscription",
            description: "Plan credits expired 30 days after the plan ended",
            referenceId: ledgerReferenceId,
            balanceAfter: keptWhole,
            // No toolKind, as the renewal's own insert above: the column's
            // NULL already means "not a tool charge" (#401).
          });
        }
        return planPart > 0
          ? { outcome: "expired" as const, creditsRemoved: planPart, newBalance: keptWhole }
          : { outcome: "nothing-to-expire" as const };
      });
      if (written) return written;
    }
    return { outcome: "failed", error: "Balance changed during expiry — retry next sweep" };
  } catch (error) {
    if (isDuplicateCreditReferenceError(error)) {
      /* This deadline's line is already on the ledger (a restamp to the same
         deadline after it ran). The transaction rolled back; clear the stamp
         so the next pass does not ask again. */
      try {
        await db
          .update(credits)
          .set({ planCreditsExpireAt: null })
          .where(and(eq(credits.userId, userId), eq(credits.planCreditsExpireAt, expireAt)));
      } catch (clearError) {
        log.warn({ err: clearError, userId }, "[Database] could not clear an already-expired stamp");
      }
      return { outcome: "already-expired" };
    }
    log.error({ err: error, userId }, "[Database] plan-credit expiry failed");
    return { outcome: "failed", error: "Plan-credit expiry failed" };
  }
}

/**
 * THE ONE KIND OF CREDIT THAT EXPIRES ON ITS OWN CLOCK — A PROMO, 90 DAYS
 * AFTER IT WAS GIVEN (#2185, his ruling 2026-10-10: "promo and signup bonuses
 * after 90 days? Expire after 90 days.", then for the starting credits:
 * "starting credits are just a default every account starts with lets make
 * them never expire to simplify things."). Stamped by the grant in
 * `addCreditsIn`; no promo grant exists yet. A promo runs out on any plan,
 * Free included.
 */
export async function getPromoCreditsExpiryCandidates(
  now: Date,
): Promise<Array<{ userId: number; expireAt: Date }>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ userId: credits.userId, expireAt: credits.promoCreditsExpireAt })
    .from(credits)
    .where(and(isNotNull(credits.promoCreditsExpireAt), lt(credits.promoCreditsExpireAt, now)));
  return rows.flatMap((row) => (row.expireAt ? [{ userId: row.userId, expireAt: row.expireAt }] : []));
}

/** The ledger key of one promo expiry, unique per (account, deadline). */
export function promoCreditsExpiryLedgerRef(userId: number, expireAt: Date): string {
  return `promo-credits-expired:${userId}:${Math.floor(expireAt.getTime() / 1000)}`;
}

/**
 * TAKE THE PROMO BUCKET OFF THE BALANCE, AND NOTHING ELSE (#2185).
 *
 * The same three locks as {@link expirePlanCredits}, for the same reasons: a
 * compare-and-set on the balance, the bounds AND the stamp, the stamp cleared
 * in the same write, and a ledger reference unique per (account, deadline).
 * What is removed is the promo bucket's reading off the row the write is
 * conditioned on; every other bucket reads the same after it as before.
 */
export async function expirePromoCredits(
  userId: number,
  expireAt: Date,
  now: Date = new Date(),
): Promise<PlanCreditsExpiryResult> {
  const db = await getDb();
  if (!db) return { outcome: "failed", error: "Database not available" };
  const ledgerReferenceId = normalizeCreditReferenceId(promoCreditsExpiryLedgerRef(userId, expireAt));

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await getUserCredits(userId);
      if (!row) return { outcome: "failed", error: "User credits not found" };
      const stamped = row.promoCreditsExpireAt;
      if (!(stamped instanceof Date) || stamped.getTime() !== expireAt.getTime()) {
        return { outcome: "already-expired" };
      }
      if (expireAt.getTime() > now.getTime()) {
        return { outcome: "not-due" };
      }

      const balanceReadFrom = row.balance;
      const removed = creditBuckets(row).promo;
      const newBalance = balanceReadFrom - removed;

      const written = await withTransaction(async (tx) => {
        const updateResult = await tx
          .update(credits)
          /* ⚠ ONLY THE PROMO BOUND AND THE STAMP — NEVER A SETTLE (#2185, the
             relay's finding 1 on PR #2208). #2193's refunds rely on no settle
             landing between a charge and its refund, and this sweep runs on a
             timer. Removing the promo holding cannot change any other
             bucket's reading: a bound above its holding exists only when every
             bucket spent before it is empty, and then the promo holds nothing
             to remove. With nothing to remove, the stamp alone is cleared. */
          .set(
            removed > 0
              ? { balance: newBalance, promoBalance: 0, promoCreditsExpireAt: null }
              : { promoCreditsExpireAt: null },
          )
          .where(
            and(
              eq(credits.userId, userId),
              eq(credits.balance, balanceReadFrom),
              ...boundsAsRead(row),
              eq(credits.promoCreditsExpireAt, expireAt),
            ),
          );
        const affected = (updateResult as any)[0]?.affectedRows ?? 0;
        if (affected === 0) return null;

        if (removed > 0) {
          await tx.insert(creditTransactions).values({
            userId,
            amount: -removed,
            type: "bonus",
            description: "Promo credits expired 90 days after they were given",
            referenceId: ledgerReferenceId,
            balanceAfter: newBalance,
          });
        }
        return removed > 0
          ? { outcome: "expired" as const, creditsRemoved: removed, newBalance }
          : { outcome: "nothing-to-expire" as const };
      });
      if (written) return written;
    }
    return { outcome: "failed", error: "Balance changed during expiry — retry next sweep" };
  } catch (error) {
    if (isDuplicateCreditReferenceError(error)) {
      try {
        await db
          .update(credits)
          .set({ promoCreditsExpireAt: null })
          .where(and(eq(credits.userId, userId), eq(credits.promoCreditsExpireAt, expireAt)));
      } catch (clearError) {
        log.warn({ err: clearError, userId }, "[Database] could not clear an already-expired promo stamp");
      }
      return { outcome: "already-expired" };
    }
    log.error({ err: error, userId }, "[Database] promo-credit expiry failed");
    return { outcome: "failed", error: "Promo-credit expiry failed" };
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
    `amount` is negative for a spend (the deleted `getDailyUsage` filtered the
    same way), so
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

/* ==========================================================================
   THE YEARLY RENEWAL REMINDER (#1941)
   ========================================================================== */

/**
 * A yearly subscription whose renewal is close enough to write about.
 *
 * `email` comes from `users` in the same statement rather than a second read:
 * a reminder with no address is not a reminder, and joining here means the
 * sweep never holds a candidate it cannot act on.
 */
export interface RenewalReminderCandidate {
  userId: number;
  email: string;
  name: string | null;
  planTier: PlanTier;
  stripeSubscriptionId: string;
  /** Our cached period end. The sweep re-reads Stripe before it believes it. */
  currentPeriodEnd: Date;
}

/**
 * Every yearly subscription whose cached period end falls inside the window.
 *
 * ⚠ **IT IS A SHORTLIST, NOT A VERDICT.** Every column here is a CACHE written
 * by the subscription webhook, so a missed delivery makes it stale — and a
 * reminder is a statement to a customer about a date and an amount. The sweep
 * therefore re-reads the live subscription before it sends, and this statement
 * exists only to keep that read down to the handful of accounts that could
 * possibly be due. The `billingInterval` and status filters are here for the
 * same reason and are re-checked against Stripe.
 *
 * `trialing` is in the status set deliberately: a yearly plan on trial is
 * exactly the case an auto-renewal notice law is written about.
 */
export async function getYearlyRenewalReminderCandidates(
  windowStart: Date,
  windowEnd: Date,
): Promise<RenewalReminderCandidate[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      userId: credits.userId,
      email: users.email,
      name: users.name,
      planTier: credits.planTier,
      stripeSubscriptionId: credits.stripeSubscriptionId,
      currentPeriodEnd: credits.currentPeriodEnd,
    })
    .from(credits)
    .innerJoin(users, eq(users.id, credits.userId))
    .where(
      and(
        eq(credits.billingInterval, "year"),
        inArray(credits.subscriptionStatus, ["active", "trialing"]),
        isNotNull(credits.stripeSubscriptionId),
        gte(credits.currentPeriodEnd, windowStart),
        lt(credits.currentPeriodEnd, windowEnd),
      ),
    );

  const candidates: RenewalReminderCandidate[] = [];
  for (const row of rows) {
    /* The two NOT NULLs the query already asked for, narrowed for the type
       rather than asserted — and `email` is the one the query could not ask
       for, because `users.email` is nullable and an account without one has
       nowhere to be written to. */
    if (!row.stripeSubscriptionId || !row.currentPeriodEnd || !row.email) continue;
    candidates.push({
      userId: row.userId,
      email: row.email,
      name: row.name ?? null,
      planTier: row.planTier,
      stripeSubscriptionId: row.stripeSubscriptionId,
      currentPeriodEnd: row.currentPeriodEnd,
    });
  }
  return candidates;
}

/** What the claim says about one renewal: mine to write about, or already done. */
export type RenewalReminderClaim = "claimed" | "already-sent" | "unreachable";

/**
 * Claim this renewal, so exactly one sweep writes to the customer about it.
 *
 * The INSERT is the claim and the unique index on
 * (stripeSubscriptionId, periodEnd) is the arbiter — the shape
 * `claimWebhookEvent` (`server/stripe/webhooks.ts`) already uses, and for the
 * same three reasons its header gives: there is no prior SELECT to race
 * against, a duplicate key IS "already sent" decided at the only moment two
 * sweeps can be ordered, and anything else is `unreachable` rather than
 * `claimed`.
 *
 * ⚠ **THE THIRD ANSWER IS THE POINT** (invariant 7): a database we cannot
 * reach must not read as "go ahead", because the failure that follows is a
 * second email to a paying customer rather than a missing one.
 */
export async function claimRenewalReminder(row: {
  userId: number;
  stripeSubscriptionId: string;
  periodEnd: Date;
  planTier: PlanTier;
  amountCents: number;
  currency: string;
}): Promise<RenewalReminderClaim> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(subscriptionRenewalReminders).values(row);
    return "claimed";
  } catch (err) {
    if (isDuplicateCreditReferenceError(err)) return "already-sent";
    log.warn({ err, userId: row.userId }, "[billing] the renewal-reminder claim could not be reached");
    return "unreachable";
  }
}

/**
 * Give the claim back, so tomorrow's sweep can try again.
 *
 * ⚠ **ITS OWN FAILURE IS THE ONE HOLE IN THIS SHAPE AND IT IS LOGGED LOUDLY
 * RATHER THAN SWALLOWED**, exactly as `releaseWebhookEventClaim` records: a
 * release that does not land leaves the renewal looking written-about and the
 * customer gets no notice. It cannot be retried here — the same database is
 * what just failed — so what is owed is the line naming the subscription, and
 * the row is a plain DELETE anybody can undo by hand.
 *
 * It fails in the better of the two directions: the window is weeks wide, so a
 * released claim has many more chances, while an un-released one costs one
 * customer one notice.
 */
export async function releaseRenewalReminderClaim(
  stripeSubscriptionId: string,
  periodEnd: Date,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .delete(subscriptionRenewalReminders)
      .where(
        and(
          eq(subscriptionRenewalReminders.stripeSubscriptionId, stripeSubscriptionId),
          eq(subscriptionRenewalReminders.periodEnd, periodEnd),
        ),
      );
  } catch (err) {
    log.error(
      { err, stripeSubscriptionId },
      "[billing] the renewal-reminder claim could not be released — this renewal will get no notice until the row is deleted by hand",
    );
  }
}
