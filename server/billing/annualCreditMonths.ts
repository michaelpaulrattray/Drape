/**
 * THE ARITHMETIC OF A YEARLY PLAN WHOSE CREDITS ARRIVE MONTH BY MONTH — #2152.
 *
 * His ruling on #2159, 2026-10-10 (terminal), verbatim: *"yearly credits apply
 * month by month it on the new notion card"*. The Desk item's rollover rules
 * now read: *"Yearly credits are granted month by month, not all 12 months up
 * front. The one-month rollover cap applies the same way on every plan, and
 * there's no separate yearly cap."*
 *
 * Pure: no database, no Stripe. Every road that has to agree about a paid
 * year's months reads them here — the annual invoice's first grant
 * (`server/stripe/webhooks.ts`), the monthly worker that grants the other
 * eleven (`./annualMonthlyGrant.ts`), and the plan-change quote that has to
 * know how much of the year has actually been handed over
 * (`quotePlanChange`, `server/stripe/stripeService.ts`).
 *
 * ## Where the month boundaries fall
 *
 * Month `k` of a paid year begins at `start + k × (end − start) / 12`, in whole
 * seconds. Twelfths of the PAID PERIOD rather than calendar months, on purpose:
 * the plan-change quote prices the unused part of a year in days of that same
 * period (`daysRemaining / totalDays`), so a boundary drawn any other way would
 * let the money and the credits disagree about where a month ends.
 */

export const MONTHS_IN_A_PAID_YEAR = 12;

/** When month `k` (0 = the month the invoice itself grants) of a paid year begins. */
export function annualMonthStartMs(periodStartMs: number, periodEndMs: number, k: number): number {
  const span = periodEndMs - periodStartMs;
  return Math.floor((periodStartMs + (span * k) / MONTHS_IN_A_PAID_YEAR) / 1000) * 1000;
}

/**
 * How many of a paid year's months have BEGUN by `nowMs` — 1 on the day it is
 * paid, 12 in its last month. Never more than 12 and never less than 1 inside
 * the year; 0 before it starts.
 */
export function annualMonthsBegun(periodStartMs: number, periodEndMs: number, nowMs: number): number {
  if (!(periodEndMs > periodStartMs) || nowMs < periodStartMs) return 0;
  let begun = 0;
  for (let k = 0; k < MONTHS_IN_A_PAID_YEAR; k++) {
    if (annualMonthStartMs(periodStartMs, periodEndMs, k) <= nowMs) begun = k + 1;
  }
  return begun;
}

/**
 * The ledger key of month `k` of one paid year — unique per (subscription,
 * paid year, month), and the `(userId, referenceId)` unique index on the
 * ledger is what makes a re-run, a second server or a crash between the read
 * and the write grant that month exactly once. Month 0 is the invoice's own
 * grant and carries the invoice's key (`stripe-invoice:<id>`), never this one.
 */
export function annualMonthLedgerRef(subscriptionId: string, periodStartMs: number, k: number): string {
  return `annual-month:${subscriptionId}:${Math.floor(periodStartMs / 1000)}:${k}`;
}

/**
 * ⚠ **HOW MANY MONTHS' WORTH OF THE CURRENT PERIOD'S CREDITS ARE ON THE
 * BALANCE FOR TIME NOT YET USED — the unit every plan-change take-back and
 * top-up is priced in.**
 *
 * The money side is simple: Stripe credits `daysRemaining / totalDays` of the
 * period's price. The credits side used to be the same fraction of the
 * period's WHOLE grant, because the whole grant was handed over on day one.
 * Under monthly granting only the months that have begun are on the balance,
 * so the credits that cover unused time are what was handed over minus what
 * the elapsed time used up:
 *
 *     granted − cycleMonths × (elapsed / total)       (never below 0)
 *
 * `monthsGranted === null` means the period was granted WHOLE (every monthly
 * plan, and a yearly plan granted up front before this change), and the
 * answer is then exactly the old one, `cycleMonths × daysRemaining / totalDays`
 * — written in that order so the figure is the same to the last bit.
 */
export function grantedShareMonths(
  cycleMonths: number,
  monthsGranted: number | null,
  daysRemaining: number,
  totalDays: number,
): number {
  if (monthsGranted === null || monthsGranted >= cycleMonths) {
    return cycleMonths * (daysRemaining / totalDays);
  }
  const elapsed = (totalDays - daysRemaining) / totalDays;
  return Math.max(0, Math.max(0, monthsGranted) - cycleMonths * elapsed);
}
