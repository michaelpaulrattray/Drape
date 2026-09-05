/**
 * ⚠ **THE ONE PRODUCTION BASE URL — #531 (his order, Crew reply #130,
 * 2026-09-04) and #467.** The order, and the two retired drape domains it
 * bans, are quoted VERBATIM in `server/productionBaseUrl.test.ts` — the
 * ordered guard — rather than here, because this file is inside the swept
 * population and the test file is its enumerated exclusion.
 *
 * Until this module existed, `server/routes/billing.ts` carried the same
 * three-line `NODE_ENV` ternary TWICE, both copies naming a domain the
 * production service has never served (#467: one Railway domain, type
 * `service`, and that domain is not on it). A paying customer was redirected
 * there the moment their checkout succeeded. Working law 4 is why this is a
 * module and not a fixed pair of literals: two copies of a base URL drift,
 * and those two had already drifted together onto a domain that was never
 * ours in production.
 *
 * ⚠ **CONFIGURED, NEVER DERIVED FROM THE `Origin` HEADER.** `routes/referral.ts`
 * derives its base from `ctx.req.headers.origin`, which is fine for a referral
 * link a user shares themselves — but an `Origin` header is attacker-supplied,
 * and a Stripe `success_url` built from it would let a forged request send a
 * paying customer to an attacker's page after checkout (#467 named this trap
 * before it could be copied here). The production origin is a fact about the
 * product, so it is a constant.
 *
 * `server/productionBaseUrl.test.ts` proves: this constant is the live
 * address, both Stripe returns are built from it ON THE WIRE, nothing in the
 * product names either retired drape domain, and the origin literal appears
 * in exactly this one file.
 */
export const PRODUCTION_APP_ORIGIN = "https://klieglabs.com";

/**
 * The bare hostname of the production origin, for the one non-URL use: the
 * synthetic placeholder email handed to Stripe when an account has no email
 * address (`user-<id>@…` in `routes/billing.ts`). Derived, never a second
 * literal.
 */
export const PRODUCTION_APP_HOSTNAME = new URL(PRODUCTION_APP_ORIGIN).hostname;

/**
 * The base URL customers are sent back to — production's live origin, or the
 * dev server everywhere else. Read at call time (not module load) so the
 * environment decides, matching how the two billing sites always behaved.
 */
export function appBaseUrl(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_APP_ORIGIN
    : "http://localhost:3000";
}
