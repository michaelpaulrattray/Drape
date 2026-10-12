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

/**
 * ⚠ **THE DAY IS READ IN UTC, ON EVERY MACHINE THAT RENDERS IT (#2363).**
 * This formatter runs on BOTH sides: the server composes *"Pro starts on
 * 7 Nov"* and *"stays active until 9 Sept"*, and the browser renders the
 * Billing tab, the cancel dialog and the change-plan step. With no `timeZone`
 * each side read the day off its own clock, so one Stripe instant could be two
 * days. Measured on the dev billing fixture's real test-mode period end,
 * `2027-09-09T03:06:18Z`: a browser in Los Angeles rendered **8 Sept** while
 * the server (UTC) rendered **9 Sept** — the cancel dialog and the receipt it
 * answers with naming different days; and `2026-11-07T20:00Z` read **8 Nov**
 * in Brisbane against the server's **7 Nov**.
 *
 * UTC rather than "the customer's own clock" because the server writes some
 * of these sentences (and the emails beside them) with no browser in front of
 * it, so the customer's clock is the one frame the server cannot use; UTC is
 * the frame Stripe's instants are kept in, the frame production's servers
 * already read by accident (no `TZ` is set), and the frame the renewal email
 * already states on purpose (`formatRenewalDate`, #903). One rule, one day.
 */
/** `12 Aug` — the short form every customer-facing date uses. */
export function formatCustomerShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
