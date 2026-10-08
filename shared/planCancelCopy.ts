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
 *    touches no balance, so the credits stay;
 *  - top-ups never expire and a renewal leaves them alone (#1660).
 */

import { formatCustomerShortDate } from "./customerDate";

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
  return `Your plan stays active ${until}. After that you won't be charged again and your account moves to Free. Your credits stay on your balance.`;
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

/** #1952 item 5, version A — the short cancel line. */
export const CANCEL_ANY_TIME_SHORT = "Cancel any time. Your credits stay on your balance.";

/** #1952 item 5, version A — what a renewal does to credits. */
export const RENEWAL_BALANCE_SENTENCE =
  "At each renewal, unspent plan credits follow the rule on your plan's card. "
  + "Credits you buy as top-ups are never removed by a renewal.";
