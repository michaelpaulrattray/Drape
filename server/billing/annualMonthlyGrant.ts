/**
 * A YEARLY PLAN'S CREDITS ARRIVE MONTH BY MONTH — #2152, the worker.
 *
 * His ruling on #2159, 2026-10-10 (terminal), verbatim: *"yearly credits apply
 * month by month it on the new notion card"*. The Desk item's rollover rules:
 * *"Yearly credits are granted month by month, not all 12 months up front. The
 * one-month rollover cap applies the same way on every plan, and there's no
 * separate yearly cap."*
 *
 * ## Who grants what
 *
 * Stripe sends ONE invoice a year, so it can only start a year:
 *
 * 1. **Month 1** — the paid annual invoice (`handleInvoicePaymentSucceeded`,
 *    server/stripe/webhooks.ts) grants one month and writes the paid year
 *    (`points.annualGrant*`) in the same compare-and-set write.
 * 2. **Months 2–12** — this worker. Every hour on every server it reads the
 *    accounts with a year in flight ({@link getAnnualGrantCandidates}: the year's
 *    columns set, its end ahead, the subscription that paid for it the live
 *    yearly one on the row, not moved to Free) and, for each, grants every
 *    month whose boundary has passed and whose ledger line is missing.
 *
 * ## How it finds due grants, and why it can never grant one twice
 *
 * A month's boundary is a twelfth of the PAID PERIOD (`annualMonthStartMs`), so
 * which months are due is arithmetic on two dates the invoice wrote. Which have
 * landed is the LEDGER: each month carries the reference
 * `annual-month:<subscription>:<periodStart>:<month>`, and the ledger's unique
 * `(userId, referenceId)` index rolls back any second write of it — a re-run, a
 * second server, a crash between the read and the write. Nothing counts months
 * anywhere else, so nothing can drift from what the customer was given.
 *
 * Each grant is `refreshMonthlyCredits` — the renewal's own write — so the cap
 * and the rollover run at every monthly grant exactly as they do for a monthly
 * plan: the plan's percentage of what is left, never more than one month's
 * worth, top-ups outside both. Months still owed are granted in order, oldest
 * first, so a server that was down for two boundaries applies the cap twice,
 * exactly as two renewals would have.
 *
 * ## What stops it
 *
 * The write is LOCKED to the year it was asked about (`onlyWhileYear`): the same
 * subscription, the same period start, a live yearly status, not Free —
 * checked on the row and in the WHERE of the write. So a cancellation (the
 * move to Free also clears the year), an interval switch to monthly (that
 * invoice clears it), or the next year's invoice landing between the read and
 * the write makes the grant miss rather than land in a year that is over.
 * Months past the paid period's end are never due.
 *
 * ## What the customer must learn — nothing
 *
 * The disappearing-technology gate, answered as the law asks: the customer sees
 * one sentence, *"Annual plans are charged once a year. Your credits arrive
 * each month."* No control, no decision, no term of art.
 */
import {
  getAnnualGrantCandidates,
  getCreditTransactionByRef,
  refreshMonthlyCredits,
} from "../db";
import type { AnnualGrantCandidate } from "../db/billing";
import { ANNUAL_YEAR_NOT_CURRENT } from "../db/billing";
import { normalizeCreditReferenceId } from "../db/credits";
import type { CreditWriteResult } from "../db/credits";
import { calculateRolloverCredits } from "../stripe/stripeService";
import {
  MONTHS_IN_A_PAID_YEAR,
  annualMonthLedgerRef,
  annualMonthStartMs,
  annualMonthsBegun,
} from "./annualCreditMonths";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("billing/annualMonthlyGrant");

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const SWEEP_FIRST_RUN_DELAY_MS = 90_000;

export type AnnualMonthOutcome = "granted" | "already-granted" | "year-over" | "failed";

export interface AnnualMonthlyGrantDeps {
  now: () => Date;
  candidates: (now: Date) => Promise<AnnualGrantCandidate[]>;
  alreadyGranted: (userId: number, referenceId: string) => Promise<boolean>;
  grant: typeof refreshMonthlyCredits;
}

export interface AnnualMonthlyGrantSweepResult {
  considered: number;
  outcomes: Partial<Record<AnnualMonthOutcome, number>>;
  creditsGranted: number;
}

const defaultDeps: AnnualMonthlyGrantDeps = {
  now: () => new Date(),
  candidates: (now) => getAnnualGrantCandidates(now),
  alreadyGranted: async (userId, referenceId) =>
    (await getCreditTransactionByRef(userId, normalizeCreditReferenceId(referenceId))) !== null,
  grant: (...args) => refreshMonthlyCredits(...args),
};

/**
 * Grant one month of one paid year. Exported for the suite; the sweep is its
 * only production caller.
 */
export async function grantAnnualMonth(
  year: AnnualGrantCandidate,
  k: number,
  deps: Pick<AnnualMonthlyGrantDeps, "grant">,
): Promise<{ outcome: AnnualMonthOutcome; result?: CreditWriteResult }> {
  const startMs = year.periodStart.getTime();
  const monthStart = new Date(annualMonthStartMs(startMs, year.periodEnd.getTime(), k));
  const monthly = year.monthlyCredits;
  const result = await deps.grant(
    year.userId,
    monthly,
    /* ⚠ THE SAME RULE AS A MONTHLY RENEWAL, AND THE SAME CAP (#2152): the
       plan's percentage of what is left of its allowance, never more than one
       month's worth — the month this grant itself is. "There's no separate
       yearly cap." */
    (balance: number) => calculateRolloverCredits(balance, year.planTier, monthly),
    annualMonthLedgerRef(year.subscriptionId, startMs, k),
    `Yearly plan, month ${k + 1} of ${MONTHS_IN_A_PAID_YEAR}: this month's allowance + rollover`,
    /* A plan change settled after this month began bought days of THIS month,
       so it crosses whole rather than at the percentage (#1937) — the same
       window the renewal draws at its own period start. */
    monthStart,
    { onlyWhileYear: { subscriptionId: year.subscriptionId, periodStart: year.periodStart } },
  );
  if (result.success) return { outcome: result.duplicate ? "already-granted" : "granted", result };
  if (result.error === ANNUAL_YEAR_NOT_CURRENT) return { outcome: "year-over", result };
  return { outcome: "failed", result };
}

/** One pass. Every month's outcome is counted, so a quiet sweep can be read. */
export async function runAnnualMonthlyGrantSweep(
  deps: AnnualMonthlyGrantDeps = defaultDeps,
): Promise<AnnualMonthlyGrantSweepResult> {
  const now = deps.now();
  const years = await deps.candidates(now);
  const sweep: AnnualMonthlyGrantSweepResult = { considered: years.length, outcomes: {}, creditsGranted: 0 };
  const count = (outcome: AnnualMonthOutcome) => {
    sweep.outcomes[outcome] = (sweep.outcomes[outcome] ?? 0) + 1;
  };

  for (const year of years) {
    const startMs = year.periodStart.getTime();
    const endMs = year.periodEnd.getTime();
    // Never past the paid period: a month that begins after the year ends is not this year's.
    const begun = annualMonthsBegun(startMs, endMs, Math.min(now.getTime(), endMs - 1));
    for (let k = 1; k < begun; k++) {
      const ref = annualMonthLedgerRef(year.subscriptionId, startMs, k);
      if (await deps.alreadyGranted(year.userId, ref)) continue;
      const { outcome } = await grantAnnualMonth(year, k, deps);
      count(outcome);
      if (outcome === "granted") {
        sweep.creditsGranted += year.monthlyCredits;
        log.info(
          { userId: year.userId, month: k + 1, monthlyCredits: year.monthlyCredits },
          "[annualMonthlyGrant] a yearly plan's month arrived",
        );
      } else if (outcome === "failed") {
        // Left ungranted: the next pass is the retry, and the months after it wait behind it.
        log.error({ userId: year.userId, month: k + 1 }, "[annualMonthlyGrant] grant failed — retried next pass");
        break;
      } else if (outcome === "year-over") {
        break;
      }
    }
  }
  return sweep;
}

export function startAnnualMonthlyGrantSweep(): void {
  const run = async () => {
    try {
      const result = await runAnnualMonthlyGrantSweep();
      if (Object.keys(result.outcomes).length > 0) log.info({ ...result }, "[annualMonthlyGrant] sweep complete");
    } catch (error) {
      log.error({ err: error }, "[annualMonthlyGrant] sweep failed");
    }
  };
  setTimeout(() => void run(), SWEEP_FIRST_RUN_DELAY_MS);
  setInterval(() => void run(), SWEEP_INTERVAL_MS);
}
