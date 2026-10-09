/**
 * WHAT CANCELLING A PLAN, AND RENEWING ONE, SAYS TO A CUSTOMER — one module,
 * read by the plan dialog, the Billing tab and the server's own receipt.
 *
 * His words, 2026-10-08 (terminal):
 *  - #1940 (Yuna's in-app money wording, B24–B26): *"on 1 and 2 go with your
 *    reccomendations"*.
 *  - #1952 (pricing wording for customers, cancel wording version A): *"yes"*.
 *
 * ⚠ **IT LIVES IN `shared/` BECAUSE THE SERVER AND THE CLIENT BOTH SAY IT.**
 * The cancel toast is composed by `billing.cancelSubscription` and the dialog
 * that leads to it is composed in the browser, about the same date. Two
 * spellings would be working law 4 on a money surface, and #1952's own rule is
 * *"keep one sentence per fact across all three"* cards.
 *
 * ⚠ **EVERY DATE IS THE PERIOD END THE SERVER ALREADY HOLDS, OR NO DATE AT
 * ALL.** A date nobody has read is never guessed: each sentence has a
 * date-less form that is still true (*"until the end of the period you've paid
 * for"*).
 *
 * The facts underneath, read at the code on 2026-10-08:
 *  - cancelling sets Stripe's `cancel_at_period_end` (`server/stripe` →
 *    `cancelSubscription`), so the plan runs to its period end;
 *  - at that end `handleSubscriptionDeleted` sets `planTier: "free"` and
 *    ~~touches no balance, so the credits stay~~ — **no longer true as of
 *    #2152 (2026-10-09)**: it now stamps a deadline {@link CANCELLED_PLAN_GRACE_DAYS}
 *    days past the paid period, and `server/billing/planCreditsExpiry.ts`
 *    takes the plan's part of the balance off when it passes;
 *  - unused plan credits carry into the next period up to one month's worth
 *    (`calculateRolloverCredits`, #2152);
 *  - top-ups never expire, a renewal leaves them alone (#1660), and the expiry
 *    leaves them alone too.
 *
 * #2152's wording is Yuna and Quistis's final pass ("Pricing Phase 2: final
 * wording", the Desk item his 2026-10-09 word approved), and it ships in the
 * SAME change as the code that makes it true, so the copy never promises what
 * the code does not do.
 */

import { formatCustomerShortDate } from "./customerDate";

/**
 * How many days a cancelled plan's credits stay usable after the paid period
 * ends (#2152). The webhook's stamp and every sentence below read this one
 * number, so the promise and the deadline cannot drift apart.
 */
export const CANCELLED_PLAN_GRACE_DAYS = 30;

/** The two sentences every cancel line ends on (#2152). */
const AFTER_CANCEL_CREDITS =
  `You'll have ${CANCELLED_PLAN_GRACE_DAYS} days to use your plan credits. Top-ups stay on your balance.`;

type PeriodEnd = Date | string | null | undefined;

function shortDate(periodEnd: PeriodEnd): string | null {
  if (periodEnd === null || periodEnd === undefined) return null;
  const date = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  return Number.isNaN(date.getTime()) ? null : formatCustomerShortDate(date);
}

/** #1940 B24 — the body of the "Cancel your plan?" dialog. */
export function cancelPlanBody(periodEnd: PeriodEnd): string {
  const on = shortDate(periodEnd);
  const until = on ? `until ${on}` : "until the end of the period you've paid for";
  return `Your plan stays active ${until}. After that you won't be charged again and your account moves to Free. ${AFTER_CANCEL_CREDITS}`;
}

/** #1940 B25 — the receipt `billing.cancelSubscription` answers with. */
export function planCancelledReceipt(periodEnd: PeriodEnd): string {
  const on = shortDate(periodEnd);
  const until = on ? `until ${on}` : "until the end of the period you've paid for";
  return `Your plan is cancelled. It stays active ${until}, and you won't be charged again.`;
}

/**
 * #1940 B26 — the Billing tab's plan line after a cancel, in place of
 * `renews {date}`. `null` when there is no date to state: the segment is
 * omitted rather than claiming a renewal that will not happen.
 */
export function cancelledPlanSegment(periodEnd: PeriodEnd): string | null {
  const on = shortDate(periodEnd);
  return on ? `ends ${on} · won't renew` : "won't renew";
}

/** #1952 item 4 — how renewal works. */
export const RENEWAL_SENTENCE =
  "Your plan renews automatically, every month or every year, until you cancel. "
  + "We charge the card on your account on the renewal date shown in Billing.";

/** #1952 item 5, reworded by #2152 — the short cancel line. */
export const CANCEL_ANY_TIME_SHORT =
  `Cancel any time. You'll have ${CANCELLED_PLAN_GRACE_DAYS} days to use your plan credits after your paid period ends.`;

/** #1952 item 5, reworded by #2152 — what a renewal, and a cancel, do to credits. */
export const RENEWAL_BALANCE_SENTENCE =
  "Unused plan credits carry into next month, up to one month's worth. "
  + `If you cancel, you have ${CANCELLED_PLAN_GRACE_DAYS} days to use them. Top-ups stay on your balance.`;

/**
 * #2152, the Desk row CPM:2268 — the compare table's line under a yearly
 * price, and it now says the second half of the rule too: a yearly plan is
 * CHARGED once a year and its credits ARRIVE month by month (his ruling on
 * #2159, 2026-10-10: *"yearly credits apply month by month"*).
 */
export const ANNUAL_CREDITS_ARRIVE_SENTENCE = "Your credits arrive each month.";
export const ANNUAL_CHARGE_SENTENCE =
  `Annual plans are charged once a year. ${ANNUAL_CREDITS_ARRIVE_SENTENCE}`;

/**
 * #2152 — what a switch to yearly billing does to credits, said once for the
 * confirm step and the receipt alike. It used to promise *"the full year of
 * credits lands as soon as the payment settles"*, which month-by-month
 * granting made false.
 */
export const YEARLY_SWITCH_ALLOWANCE_SENTENCE =
  "Your first month of credits lands as soon as the payment settles, replacing what was left of your current allowance, and your credits arrive each month after that.";
