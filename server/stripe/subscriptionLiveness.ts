/**
 * WHICH STRIPE SUBSCRIPTION STATUSES MEAN "DEAD" — one declaration, read by
 * the webhook roads (#795) and by the checkout road's one-subscription guard
 * (#2394).
 *
 * It lived inside `webhooks.ts` until #2394 needed the same answer on the
 * request path. A second copy there would be the mirror this repository keeps
 * paying for (working law 4): the day Stripe adds a terminal status and one
 * list learns it, the webhook would treat a subscription as dead while the
 * checkout guard still called it live, or the other way round — and the other
 * way round is a second subscription sold to a paying account.
 *
 * Its own module rather than an export of `stripeService.ts` on purpose: most
 * suites mock `stripeService` wholesale with an explicit list of members, and
 * a constant hidden behind that mock would read as `undefined` in every one of
 * them.
 *
 * Everything NOT in this set is alive — `active`, `past_due`, `unpaid`,
 * `paused`, `trialing`, `incomplete`, and anything Stripe adds later. That
 * direction is deliberate on the checkout road: a status nobody named is
 * treated as a subscription that still exists, so the unknown case refuses a
 * second purchase rather than selling one.
 */
export const DEAD_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
]);

export function isSubscriptionAlive(status: string): boolean {
  return !DEAD_SUBSCRIPTION_STATUSES.has(status);
}
