/**
 * THE ONE SHORT DATE A CUSTOMER IS EVER SHOWN.
 *
 * ⚠ **IT LIVES HERE BECAUSE THE SERVER NOW COMPOSES A SENTENCE WITH A DATE IN
 * IT (#1936), AND THE CLIENT WAS ALREADY SHOWING THE SAME DATE.** A deferred
 * plan change answers *"Pro starts on 7 Nov"* from `changePlan`, and the
 * Billing tab shows that same boundary as the renewal date. Two formatters
 * would be working law 4 on a money surface — the toast and the tab
 * disagreeing about which day a customer's plan changes — and the product has
 * already paid for that shape once: `formatCentsPerCredit` and
 * `centsPerCredit` argued one fact in two units on two surfaces, and a
 * customer who opened both in one session met both (#403).
 *
 * `client/src/features/settings/planMath.ts` exports `formatShortDate`, which
 * DELEGATES to this. That is deliberate rather than a leftover: every client
 * call site and the guard that pins `planMath`'s surface stay exactly as they
 * were, and there is still only one implementation.
 */

/** `12 Aug` — the short form every customer-facing date uses. */
export function formatCustomerShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
