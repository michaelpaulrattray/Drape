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

/**
 * WHAT A YEAR COSTS, FROM THE MONTHLY PRICE — IN WHOLE DOLLARS, BECAUSE THAT
 * IS WHAT STRIPE CHARGES (#1605 bullet 2).
 *
 * ⚠ **IT ROUNDED TO THE CENT UNTIL 2026-10-02, AND STRIPE'S CATALOGUE DOES
 * NOT.** The card's own sentence — *"today `shared/annualBilling.ts` rounds to
 * the cent — Pro $677.28 — while Stripe's yearly price is a whole $677"* — is
 * driven here rather than quoted. Read at Stripe in test mode 2026-10-01, all
 * seven yearly prices under the `klieg_<plan>_yearly_v2` lookup keys are this
 * arithmetic rounded to the nearest whole DOLLAR, and four of the seven
 * disagreed with the cent rounding:
 *
 *   plan         monthly    cent-rounded   WHOLE DOLLARS   Stripe's unit_amount
 *   Starter        2,700          26,892          26,900          26,900
 *   Pro            6,800          67,728          67,700          67,700
 *   Studio        15,900         158,364         158,400         158,400
 *   Business      84,000         836,640         836,600         836,600
 *   Scale        480,000       4,780,800       4,780,800       4,780,800
 *   Enterprise 1,500,000      14,940,000      14,940,000      14,940,000
 *   Ultimate   4,800,000      47,808,000      47,808,000      47,808,000
 *
 * ⚠ **AND THE REASON THE DISAGREEMENT WAS INVISIBLE IS THE REASON IT MATTERS
 * NOW.** Checkout builds an inline `price_data` from this function, so today
 * the page and the charge are the same number and nothing on screen
 * contradicts anything. #1605 bullet 1 moves checkout onto the lookup keys —
 * at which point the charge becomes Stripe's and the page stays ours, and a
 * customer reads `$677.28` above a `$677.00` charge. **Fixing the rounding
 * FIRST is what makes that move cost nothing**, which is why bullet 2 ships
 * ahead of bullet 1 rather than beside it.
 *
 * It is also the product's own rule for a price, already written down one
 * module away: `formatWholeDollars` exists because *"the card price, where the
 * cents are always zero and add nothing"*. A yearly price carrying 28 cents
 * was the one price in the product that broke that sentence.
 *
 * ⚠ **THE RATE IS UNTOUCHED AND SO IS THE BADGE.** `12 × 0.83` is still what a
 * year costs before rounding, `monthsFreePerYear` still derives `2 MONTHS
 * FREE` from it, and no monthly price moves at all. What changed is the last
 * step, and it moves a yearly figure by at most 40 cents.
 */
export function annualPriceInCents(monthlyInCents: number): number {
  return Math.round((monthlyInCents * 12 * ANNUAL_RATE) / 100) * 100;
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
