/**
 * THE ENVIRONMENT TAG ON STRIPE OBJECTS (L6) — one account, one endpoint,
 * two worlds sending into it.
 *
 * Read at the account on 2026-08-17, with controls:
 *
 *   STRIPE_SECRET_KEY   dev and prod BYTE-IDENTICAL (sk_test_, md5 66938022b5)
 *   webhook endpoints registered on that one account: 1
 *     https://drape-production-0232.up.railway.app/api/webhooks/stripe
 *     enabled, subscribed to all eight event types this file's caller handles
 *
 * So a checkout completed on a developer laptop is not merely *able* to reach
 * production — production is the only place it goes, and it verifies there,
 * because it is signed with that endpoint's own secret. The money line behind
 * it is worth 12,500 credits (`REFERRAL_REWARD_CREDITS`, paid to the named
 * user's REFERRER), and the only reason nothing has been paid out is that
 * production holds zero referral rows today. That arms itself with the first
 * referral, which is a launch feature.
 *
 * The answer is a tag: every Stripe object we create carries the world that
 * made it, and the webhook refuses anything that does not say this world.
 *
 * ── THE BOUND, DECLARED RATHER THAN BURIED ────────────────────────────────
 * The check covers the objects WE create, which are the ones that can carry
 * our metadata: checkout sessions and subscriptions. Invoices and disputes are
 * authored by Stripe and by banks, carry no metadata of ours, and are NOT
 * checked here. Their world discriminator is the one they already had and it
 * is structural rather than populational only in part: they resolve the user
 * through `getUserByStripeCustomerId` against the LOCAL database, so a
 * customer created in the other world has no row and the handler returns "No
 * user found" without moving money. Verified 2026-08-17: production holds 0
 * rows with a `stripeCustomerId`, development 1, and the overlap is 0. The
 * customer object is tagged here too, so upgrading those two families to a
 * real tag check is one API read away if the overlap ever stops being zero.
 */
import { deploymentTag } from "../_core/env";

/** The metadata key. Short, because Stripe metadata keys are capped at 40. */
export const ENV_TAG_KEY = "env";

/**
 * Event types whose `data.object` carries metadata THIS CODEBASE wrote.
 * Anything not in here is out of the tag's scope by construction — see the
 * declared bound above — and is passed through to its handler unchanged.
 */
export const TAGGED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export type EnvironmentVerdict =
  | { accepted: true }
  | { accepted: false; reason: string };

/**
 * A Stripe object created by hand in the DASHBOARD is untagged by
 * construction. That is a legitimate action, so its refusal names itself
 * rather than reading as a swallow.
 */
export const UNTAGGED_REFUSAL =
  "untagged Stripe object refused — dashboard-created objects need the env tag "
  + `added to their metadata (metadata.${ENV_TAG_KEY})`;

/** The metadata block every object we create carries. */
export function environmentMetadata(): Record<string, string> {
  return { [ENV_TAG_KEY]: deploymentTag() };
}

/**
 * Decide whether an incoming event belongs to this world.
 *
 * Untagged is REFUSED, not admitted. That is normally the hard half — legacy
 * objects predate the tag — and here there are none: production holds zero
 * customers, zero subscriptions and zero referral rows. Today is the only day
 * failing closed costs nothing.
 */
export function checkEventEnvironment(event: {
  type: string;
  data?: { object?: unknown };
}): EnvironmentVerdict {
  if (!TAGGED_EVENT_TYPES.has(event.type)) return { accepted: true };

  const object = event.data?.object as { metadata?: Record<string, string> | null } | undefined;
  const stamped = object?.metadata?.[ENV_TAG_KEY];
  const mine = deploymentTag();

  if (!stamped) return { accepted: false, reason: UNTAGGED_REFUSAL };
  if (stamped !== mine) {
    return {
      accepted: false,
      reason:
        `foreign-environment Stripe object refused — the object says `
        + `${ENV_TAG_KEY}="${stamped}", this deployment is "${mine}". `
        + `Both worlds share one Stripe account and one webhook endpoint, so `
        + `this event was made somewhere else and must not be fulfilled here.`,
    };
  }
  return { accepted: true };
}
