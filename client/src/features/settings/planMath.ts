/**
 * THE FOUR CONSTANTS, AND EVERYTHING THE THREE SURFACES SAY ABOUT THEM.
 *
 * Section 03 §6a, verbatim: *"Every number here is derived, never written.
 * Four constants are the source — days left in cycle, cycle length, credits
 * spent, credits remaining — and the burn rate, empty date and dry period are
 * computed from them. This copy exists to make the charge believable; if a
 * customer checks the dates and the charge disagrees, it has done the opposite
 * of its job."*
 *
 * The failure he is describing already happened once in his prototype:
 * hand-written dates put *"the 21st"* against a proration of 19/31 days, which
 * implies the 24th. So this module exists to make that shape impossible — the
 * copy in `ChangePlanModal` and `AddCreditsModal` reads these fields and owns
 * no arithmetic of its own.
 *
 * ⚠ **THE FOUR CONSTANTS ARE READ OFF `billing.getStatus`, NOT INVENTED.**
 * `creditsUsed`, `balance`, `currentPeriodStart` and `currentPeriodEnd` are all
 * on that projection today (`server/routes/billing.ts`). A user with no
 * subscription row has no period at all, which is why every function here takes
 * the possibility of `null` and answers `null` rather than guessing a month —
 * a burn rate over an invented cycle is exactly the invented number the brief
 * bans.
 */

/** Milliseconds in a day, named because `86_400_000` in a formula reads as noise. */
const DAY_MS = 86_400_000;

export type BillingCycle = {
  /**
   * ⚠ **THIS IS A LIFETIME FIGURE WEARING A CYCLE'S NAME — SEE #385.**
   *
   * It reads `points.creditsUsed`, which is set to 0 when the row is created
   * and only ever incremented (`server/db/credits.ts`); nothing resets it at a
   * period boundary. This comment said *"Credits spent so far this cycle"* until
   * #381's law-7 sweep, and that sentence is how the defect survived — the
   * Usage pane had the identical bug and he caught it by eye
   * (`115,695 credits used · of 5,000 this month`).
   *
   * **Measured on production the day it was found: ZERO rows can reach
   * `readCycle` at all** — nobody has both `currentPeriodStart` and
   * `currentPeriodEnd`, so no customer has ever been shown a number derived
   * from this. It goes live the moment the first subscription exists, which is
   * why it is carded rather than left as a comment.
   */
  spent: number;
  /** Credits still on the balance. */
  remaining: number;
  /** Whole days between now and the renewal. Never negative. */
  daysLeft: number;
  /** Whole days the cycle runs for. */
  cycleLength: number;
  /** The renewal date itself, for the copy that names it. */
  renewsAt: Date;
};

/**
 * Read the cycle off what the server actually returns, or answer `null`.
 *
 * `null` is a real answer and the surfaces must render it: a free account has
 * no Stripe period, so it has no burn rate, no empty date and no proration —
 * and the honest copy for that is a different sentence, not a zero.
 */
export function readCycle(
  status:
    | {
        creditsUsed?: number | null;
        balance?: number | null;
        currentPeriodStart?: Date | string | null;
        currentPeriodEnd?: Date | string | null;
      }
    | null
    | undefined,
  now: Date = new Date(),
): BillingCycle | null {
  if (!status?.currentPeriodStart || !status?.currentPeriodEnd) return null;
  const start = new Date(status.currentPeriodStart);
  const end = new Date(status.currentPeriodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const cycleLength = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
  return {
    spent: Math.max(0, status.creditsUsed ?? 0),
    remaining: Math.max(0, status.balance ?? 0),
    daysLeft: Math.min(daysLeft, cycleLength),
    cycleLength,
    renewsAt: end,
  };
}

export type BurnReading = {
  /** Credits a day, averaged over the days already elapsed. */
  perDay: number;
  /** Days of balance left at that rate. `null` when nothing has been spent. */
  daysToEmpty: number | null;
  /** The date the balance reaches zero. `null` when nothing has been spent. */
  emptyOn: Date | null;
  /**
   * Whole days between running dry and the renewal. `0` when the balance
   * outlasts the cycle — which is the case the band must NOT dramatise.
   */
  dryDays: number;
};

/**
 * The burn rate and what it implies, from the cycle alone.
 *
 * ⚠ **A ZERO BURN IS NOT A ZERO DATE.** Somebody who has spent nothing this
 * cycle has no rate, and dividing by the days elapsed would put the empty date
 * at infinity — so `daysToEmpty` and `emptyOn` are `null` and the caller says
 * something else. The same guard covers the first day of a cycle, where the
 * days elapsed are zero and the division is undefined rather than merely large.
 */
export function readBurn(cycle: BillingCycle, now: Date = new Date()): BurnReading {
  const elapsed = Math.max(0, cycle.cycleLength - cycle.daysLeft);
  if (elapsed <= 0 || cycle.spent <= 0) {
    return { perDay: 0, daysToEmpty: null, emptyOn: null, dryDays: 0 };
  }
  const perDay = cycle.spent / elapsed;
  const daysToEmpty = cycle.remaining / perDay;
  const emptyOn = new Date(now.getTime() + daysToEmpty * DAY_MS);
  const dryDays = Math.max(0, Math.round(cycle.daysLeft - daysToEmpty));
  return { perDay, daysToEmpty, emptyOn, dryDays };
}

/**
 * The share of the cycle still to run — the multiplier a proration uses.
 *
 * The prototype's defect was that the charge and the date were written by
 * different hands. Here the charge is `priceDelta * prorationFactor(cycle)`,
 * and the date the copy names is `cycle.renewsAt`, so the two cannot disagree.
 */
export function prorationFactor(cycle: BillingCycle): number {
  return Math.min(1, Math.max(0, cycle.daysLeft / cycle.cycleLength));
}

/** Cost per credit in cents, the value argument the ladder is sold on. */
export function centsPerCredit(priceInCents: number, credits: number): number {
  if (credits <= 0) return 0;
  return priceInCents / credits;
}

/**
 * Cost per credit, rendered at the precision that actually separates our tiers.
 *
 * ⚠ **THE BRIEF'S OWN FIGURES ARE THE MOCKUP'S, NOT OURS, AND TWO DECIMALS
 * COLLAPSES OUR LADDER TO ONE NUMBER.** It quotes *"2.79¢ / 2.63¢ / 2.48¢ /
 * 2.33¢ / 1.87¢"*; our real ladder is `PLAN_TIERS` in `drizzle/schema.ts` —
 * Starter $27 for 75,000 credits is **0.036¢** a credit, and Enterprise, the
 * offered top since #391, is 0.02¢. At the brief's two decimals our tiers
 * print `0.04¢`, `0.03¢` or `0.02¢` and the descent it exists to show
 * disappears. Three decimals is the smallest precision at which every
 * adjacent pair differs, which is the only thing the number has to do.
 */
export function formatCentsPerCredit(priceInCents: number, credits: number): string {
  const cents = centsPerCredit(priceInCents, credits);
  if (cents <= 0) return "free";
  return `${cents.toFixed(3)}¢`;
}

/** `12 Aug` — the short form every date in these three surfaces uses. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** `$149.00`, from cents. Prices are stored in cents and never in floats. */
export function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** `$149` — the card price, where the cents are always zero and add nothing. */
export function formatWholeDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/**
 * Re-cut the cycle so the copy and the CHARGE cannot disagree.
 *
 * ⚠ **THIS IS THE PROTOTYPE'S DEFECT, CLOSED AT THE WIRE.** `previewPlanChange`
 * is the server's own proration read — it returns `daysRemaining` and
 * `totalDays` alongside the `immediateCharge` it computed FROM them. The copy
 * beside that charge must quote those two numbers and not a second pair derived
 * from `currentPeriodStart`/`currentPeriodEnd` on the client, because the two
 * pairs can differ by a day at a boundary and the customer checking our
 * arithmetic is exactly who this copy is for.
 *
 * So: where a preview exists, its days win. Where it does not, the client's own
 * reading stands, and nothing is being charged for it to disagree with.
 */
export function alignToPreview(
  cycle: BillingCycle,
  preview: { daysRemaining?: number | null; totalDays?: number | null } | null | undefined,
): BillingCycle {
  if (!preview?.totalDays || preview.totalDays <= 0) return cycle;
  const cycleLength = Math.round(preview.totalDays);
  const daysLeft = Math.max(0, Math.min(cycleLength, Math.round(preview.daysRemaining ?? 0)));
  return { ...cycle, cycleLength, daysLeft };
}

/**
 * THE ANNUAL DISCOUNT, AND THE BADGE DERIVED FROM IT.
 *
 * `BillingModal` charged `monthly * 12 * 0.83` for a year and called it
 * `-17%`. §6b rules on the framing rather than the number: *"`2 MONTHS FREE`
 * rather than `-17%`: identical arithmetic, far more vivid. Use one framing
 * everywhere; the prototype briefly had the badge on one modal and the
 * percentage on the other."*
 *
 * ⚠ **SO THE BADGE IS COMPUTED FROM THE RATE, NOT TYPED.** `12 × 0.83` is
 * 9.96 months paid, which is 2.04 free — the badge reads `2 MONTHS FREE`
 * because the arithmetic says so, and if the rate is ever changed the badge
 * follows it instead of quietly becoming a lie.
 */
export const ANNUAL_RATE = 0.83;

/** What a year costs, from the monthly price. The mutation's own arithmetic. */
export function annualPrice(monthlyInCents: number): number {
  return Math.round(monthlyInCents * 12 * ANNUAL_RATE);
}

/** Whole months free at the annual rate — the badge, and never a percentage. */
export function monthsFree(): number {
  return Math.round(12 - 12 * ANNUAL_RATE);
}

/**
 * WHAT A YEAR COSTS, SAID BY THE MONTH — card 390 item 2.
 *
 * ⚠ **A CUSTOMER TOGGLING FROM `$149 / month` TO `$1,490 / year` READS A
 * TENFOLD PRICE RISE.** That is his design agent's sentence and it is the whole
 * reason this exists: the annual toggle was rendering the YEAR's total against
 * a `2 MONTHS FREE` badge, so the one control that claims a saving was the one
 * making the number bigger — and the badge became unverifiable, because nothing
 * on screen was comparable to the monthly figure beside it.
 *
 * So every price the plan surfaces show is a MONTH's price in both intervals,
 * with `billed yearly` carrying the interval. **The full annual figure belongs
 * in the confirm step**, where it is what actually gets charged.
 *
 * ⚠ **DERIVED FROM `annualPrice`, NEVER FROM `ANNUAL_RATE` A SECOND TIME.**
 * The figure a customer divides in their head must be the figure we charge
 * divided by twelve; computing it from the rate would let a rounding change in
 * `annualPrice` put the two a cent apart, which is exactly the class of defect
 * `alignToPreview` exists to close one surface further down.
 */
export function monthlyEquivalent(monthlyInCents: number): number {
  return Math.round(annualPrice(monthlyInCents) / 12);
}

/**
 * Credits per dollar — the value argument, the right way up (card 390 item 4).
 *
 * ⚠ **`0.036¢ A CREDIT` IS NOT A VALUE ARGUMENT.** His agent's reading, and it
 * is right at the arithmetic: at sub-penny precision our rungs separate in
 * the THIRD decimal, so the number that exists to show a descent needs three
 * decimals to show one at all — and a figure a customer cannot hold in their
 * head is not an argument, whatever it proves.
 *
 * Inverted, the same fact reads as a whole number that goes UP as you climb:
 * **2,778 credits per $1 on Starter, 5,000 on Enterprise.** Every adjacent
 * pair differs by hundreds, so the ladder argues for itself at a glance.
 *
 * ⚠ **THE MONOTONIC CHECK SURVIVES THE INVERSION AND CHANGES DIRECTION.** Cost
 * per credit had to DESCEND up the ladder; credits per dollar must ASCEND. It
 * is the same claim — *"the figure must improve at every rung"* — and
 * `planMath.test.ts` asserts it against `PLAN_TIERS` itself rather than a
 * fixture, so a future price edit that breaks the argument still goes red.
 *
 * `centsPerCredit` stays, and is not dead: `AddCreditsModal` sells credit PACKS
 * with it in a two-value sentence (*"0.036¢ a credit, down from 0.041¢"*) where
 * the descent is stated in words rather than read off a ladder. That surface is
 * outside this card and is filed rather than swept.
 */
export function creditsPerDollar(priceInCents: number, credits: number): number {
  if (priceInCents <= 0) return 0;
  return credits / (priceInCents / 100);
}

/** `2,778` — credits per dollar, whole, because fractions of a credit buy nothing. */
export function formatCreditsPerDollar(priceInCents: number, credits: number): string {
  const perDollar = creditsPerDollar(priceInCents, credits);
  if (perDollar <= 0) return "free";
  return Math.round(perDollar).toLocaleString("en-US");
}
