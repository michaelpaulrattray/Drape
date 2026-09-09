/**
 * THE ANNUAL BILLING ARITHMETIC — declared once, read by both sides (#664).
 *
 * Until this file, `monthly × 12 × 0.83` lived twice: inline in the server's
 * checkout session builder and as `ANNUAL_RATE` in the client's `planMath.ts`.
 * Two copies of the number that decides what a year costs is working law 4's
 * exact shape — a mirror, and mirrors drift — and the drift here would be a
 * customer shown one year's price and charged another. Both sides import this
 * module now; neither declares its own rate, and
 * `server/annualBilling.test.ts` holds them to it.
 *
 * The names are deliberate:
 * - a `BillingIntervalChoice` ("monthly" | "annual") is the word the PRODUCT
 *   uses — it is what the toggle says, what the tRPC inputs parse, and what
 *   checkout metadata records;
 * - a `StripeBillingInterval` ("month" | "year") is the word STRIPE uses on a
 *   price's `recurring.interval`, and it is also what the `billingInterval`
 *   column caches, because that column is a cache OF the Stripe artifact.
 * The two vocabularies meet only through the converters below, so a value can
 * never be compared against the wrong dialect silently.
 */

/** 12 × 0.83 = 9.96 months paid for 12 — the "2 MONTHS FREE" badge derives
 *  from this number and must never be typed beside it. */
export const ANNUAL_RATE = 0.83;

/** The product's word for how a customer chooses to be billed. */
export type BillingIntervalChoice = "monthly" | "annual";

/** Stripe's word for the same fact, as carried on a price's `recurring.interval`. */
export type StripeBillingInterval = "month" | "year";

/** What a year costs, from the monthly price. The mutation's own arithmetic. */
export function annualPriceInCents(monthlyInCents: number): number {
  return Math.round(monthlyInCents * 12 * ANNUAL_RATE);
}

/** Whole months free at the annual rate — the badge, and never a percentage. */
export function monthsFreePerYear(): number {
  return Math.round(12 - 12 * ANNUAL_RATE);
}

/** What ONE PERIOD costs at the chosen interval — a month's price or a year's. */
export function periodPriceInCents(
  monthlyInCents: number,
  choice: BillingIntervalChoice,
): number {
  return choice === "annual" ? annualPriceInCents(monthlyInCents) : monthlyInCents;
}

/** How many months of allowance one period at this interval buys (#664
 *  decision 3: credits are granted by the period bought). */
export function monthsBought(interval: StripeBillingInterval): number {
  return interval === "year" ? 12 : 1;
}

export function stripeIntervalOf(choice: BillingIntervalChoice): StripeBillingInterval {
  return choice === "annual" ? "year" : "month";
}

/**
 * A Stripe `recurring.interval` read back as the product's word — or `null`
 * for anything else (a `week`/`day` price is nothing this product sells, and
 * pretending it is monthly would misprice it; callers decide the refusal).
 */
export function choiceOfStripeInterval(
  interval: string | null | undefined,
): BillingIntervalChoice | null {
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  return null;
}
