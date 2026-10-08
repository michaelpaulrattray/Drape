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
 * ⚠ **THE FOUR CONSTANTS ARE READ, NOT INVENTED — BUT THEY DO NOT ALL COME
 * FROM ONE PLACE, AND #385 IS WHAT HAPPENS WHEN THEY ARE ASSUMED TO.**
 * `balance`, `currentPeriodStart` and `currentPeriodEnd` are on
 * `billing.getStatus` (`server/routes/billing.ts`). **CREDITS SPENT IS NOT** —
 * that projection's only spend field is a lifetime counter, so the cycle's
 * spend is READ SEPARATELY, from `usage.getCycleSpend`, and passed in. (It was
 * summed on the client from `usage.getDailyUsage`'s day buckets until #624 —
 * which could not see a period that begins mid-day, and every real one does.)
 * A user with no subscription row has no period at all, which is why every
 * function here takes the possibility of `null` and answers `null` rather than
 * guessing a month — a burn rate over an invented cycle is exactly the
 * invented number the brief bans.
 */

/** Milliseconds in a day, named because `86_400_000` in a formula reads as noise. */
const DAY_MS = 86_400_000;

export type BillingCycle = {
  /**
   * Credits spent inside THIS cycle — and the caller supplies it, because this
   * module cannot get it right on its own (#385, closed).
   *
   * ⚠ **IT USED TO READ `points.creditsUsed` AND THAT IS A LIFETIME COUNTER.**
   * It is set to 0 when the row is created and only ever incremented
   * (`server/db/credits.ts`); nothing resets it at a period boundary. This
   * comment said *"Credits spent so far this cycle"* until #381's law-7 sweep,
   * and that sentence is how the defect survived — the Usage pane had the
   * identical bug and he caught it by eye
   * (`115,695 credits used · of 5,000 this month`).
   *
   * **Measured on production the day it was found: ZERO rows could reach
   * `readCycle` at all** — nobody had both `currentPeriodStart` and
   * `currentPeriodEnd`, so no customer was ever shown a number derived from
   * it. It would have gone live the moment the first subscription existed.
   *
   * ⚠ **THE REPAIR IS A SIGNATURE, NOT A CORRECTED READ.** `readCycle` no
   * longer looks at any spend field on `status`, so the wrong number is not
   * merely unused here — it is unreachable, and a future caller cannot
   * reintroduce it by passing the same projection. The cycle's real spend
   * comes from `usage.getCycleSpend` via
   * `client/src/features/billing/useCycleSpend.ts`.
   *
   * A `null` spend (the sum not yet loaded) lands here as `0`, and `readBurn`
   * answers no rate at all for a zero — so the surfaces hide the band rather
   * than printing a rate off a figure nobody has.
   */
  spent: number;
  /**
   * ⚠ **HOW MANY DAYS `spent` COVERS, AND IT IS THE ONLY DIVISOR `readBurn`
   * MAY USE** (PR #622 review, finding 1).
   *
   * ⚠ **THE CAP IS GONE AND THE PRINCIPLE IS NOT (#624).** The spend used to
   * be summed over a window the server capped at 90 days while the days ELAPSED
   * in the period could be 365 — dividing one by the other understated an
   * annual subscriber's burn by more than half. `usage.getCycleSpend` sums the
   * whole period at timestamp precision, so the two now agree by construction;
   * carrying the span beside the sum is what keeps them agreeing when the
   * window changes again, because a caller cannot supply one without the other.
   *
   * It is FRACTIONAL — the exact elapsed time of the window that was summed —
   * and `readCycle` clamps it at a day, because an hour-old cycle has a real
   * spend and no meaningful rate.
   */
  spentOverDays: number;
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
 *
 * ⚠ **`spend` IS REQUIRED AND HAS NO DEFAULT — THAT IS THE FIX FOR #385.**
 * The dates come off `status`; the SPEND cannot, because the only spend field
 * on that projection is a lifetime counter (see `BillingCycle.spent`). Making
 * it a second positional argument with no default means a caller must decide
 * where its cycle spend comes from, and the old wrong read cannot come back by
 * somebody passing the same object.
 *
 * ⚠ **AND IT CARRIES THE SPAN IT COVERS, not a bare number** (PR #622 review,
 * finding 1). A sum whose window a caller can forget to mention is how the
 * repair itself came to divide a 90-day total by 200 elapsed days.
 *
 * `null` means *not known yet* — the per-day sum is still loading — and lands
 * as a spend of `0`, which `readBurn` turns into no rate rather than a zero
 * rate.
 */
export function readCycle(
  status:
    | {
        balance?: number | null;
        currentPeriodStart?: Date | string | null;
        currentPeriodEnd?: Date | string | null;
      }
    | null
    | undefined,
  spend: { spent: number; days: number } | null,
  now: Date = new Date(),
): BillingCycle | null {
  if (!status?.currentPeriodStart || !status?.currentPeriodEnd) return null;
  const start = new Date(status.currentPeriodStart);
  const end = new Date(status.currentPeriodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const cycleLength = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
  return {
    spent: Math.max(0, spend?.spent ?? 0),
    /* At least 1: it is a divisor, and a window that has begun is a day old. */
    spentOverDays: Math.max(1, spend?.days ?? 1),
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
 *
 * ⚠ **THE GUARD AND THE DIVISOR ARE TWO DIFFERENT NUMBERS, DELIBERATELY** (PR
 * #622 review, finding 1). *Has this cycle begun?* is answered by the days
 * elapsed in the PERIOD — that is what stops a rate being printed for a cycle
 * that has not started. *Over how many days was this spent?* is answered by
 * the window the sum actually covers, which the server caps at 90. They agree
 * on a monthly plan and differ by a factor of four on an annual one, and using
 * the first for both is what understated an annual subscriber's burn to 450 a
 * day against a real 1,000.
 */
export function readBurn(cycle: BillingCycle, now: Date = new Date()): BurnReading {
  const elapsed = Math.max(0, cycle.cycleLength - cycle.daysLeft);
  if (elapsed <= 0 || cycle.spent <= 0) {
    return { perDay: 0, daysToEmpty: null, emptyOn: null, dryDays: 0 };
  }
  const perDay = cycle.spent / cycle.spentOverDays;
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

/*
  ⚠ `centsPerCredit` AND `formatCentsPerCredit` ARE GONE (#403, and card 390
  item 4 before it). The product argued one fact in two units — cents per credit
  on Add credits, credits per dollar on Change plan — and a customer who opened
  both in one session met both. There is now ONE unit, below, and no second
  formatter for a future surface to reach for by accident.

  What was lost with them: three-decimal cents were the smallest precision at
  which adjacent rungs differed at all, which was the whole argument for the
  unit and against it. `card390-guard.test.ts` makes the same two claims of the
  surviving unit against `PLAN_TIERS` itself — every rung improves, every rung
  prints a distinct figure — so no assertion left the tree with the functions.
*/

/**
 * `12 Aug` — the short form every date in these three surfaces uses.
 *
 * ⚠ **THE IMPLEMENTATION MOVED TO `shared/customerDate.ts` (#1936) AND THIS
 * EXPORT STAYS.** The server now composes a sentence carrying this same date
 * (*"Pro starts on 7 Nov"* on a deferred plan change), and the toast and the
 * Billing tab must not be able to name two different days. Delegating rather
 * than moving leaves every call site and the guard on this module's surface
 * untouched, with one implementation.
 */
export function formatShortDate(date: Date): string {
  return formatCustomerShortDate(date);
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
 *
 * ⚠ **IT IS FOR THE SENTENCE BESIDE THE CHARGE, AND FOR NOTHING ELSE — #1739.**
 * "Its days win" is correct about the proration line and WRONG about any
 * sentence describing the balance the customer already holds: a preview of a
 * plan they have not bought carries that plan's period, so an account billed
 * monthly previewing the annual option gets 343 days where its own cycle has 8.
 * `AddCreditsModal`'s burn band read this result for exactly that reason and
 * told a customer their credits would run out *"80 days before it resets"* when
 * the reset was 8 days away. The surface keeps BOTH readings under names that
 * say which is which (`ownCycle` / `chargeCycle`); a new caller here is
 * answering "what are we charging for?" and never "what does this account
 * hold?".
 *
 * ⚠ **The result is not interchangeable with its input even when they agree.**
 * They agree on a same-interval change — which is every case a reader is likely
 * to try first — and differ only when the intervals do, so a wrong basis here
 * tests clean and ships. Measured: one caller in the product (`AddCreditsModal`,
 * the renewal line), and `ChangePlanModal` deliberately not one.
 *
 * ⚠ **THAT LAST CLAUSE WAS THE DEFECT — #1730.** *"Nothing is being charged"*
 * is true of the CHARGE and false of the COPY: the renewal line beside the
 * figure stated a proration basis in the unaligned days while the quote was
 * still in flight. Driven on the yearly fixture: **"Prorated for the 8 days
 * left in this cycle"** became **"Prorated for the 343 days left in this
 * cycle"** a second later — two bases for one charge, a second apart, each
 * stated with the same confidence.
 *
 * A caller cannot tell the two returns apart by looking at the result, because
 * a cycle that was never aligned and one Stripe happened to agree with are the
 * same object. So the question is ASKABLE now, from the same predicate this
 * function branches on — one declaration, two readers, rather than a copy of
 * the condition at the surface that needs it (working law 4).
 */
export function alignsToPreview(
  preview: { daysRemaining?: number | null; totalDays?: number | null } | null | undefined,
): boolean {
  return Boolean(preview?.totalDays && preview.totalDays > 0);
}

export function alignToPreview(
  cycle: BillingCycle,
  preview: { daysRemaining?: number | null; totalDays?: number | null } | null | undefined,
): BillingCycle {
  /* The predicate above is the authority on WHETHER; the `?? 0` only narrows
     the type, and the guard below is the same answer rather than a second one. */
  const totalDays = alignsToPreview(preview) ? preview?.totalDays ?? 0 : 0;
  if (totalDays <= 0) return cycle;
  const cycleLength = Math.round(totalDays);
  const daysLeft = Math.max(0, Math.min(cycleLength, Math.round(preview?.daysRemaining ?? 0)));
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
/*
  ⚠ **THE RATE LIVES IN `@shared/annualBilling` NOW (#664)** — the server's
  checkout builder carried its own `* 12 * 0.83` inline, which made this
  constant a MIRROR of the number that actually charges the card (working
  law 4). One declaration, two readers; the re-exports keep this module the
  client's one door to the arithmetic, under the names its surfaces and
  suites already use.
*/
export {
  annualPriceInCents as annualPrice,
  monthsFreePerYear as monthsFree,
} from "@shared/annualBilling";
import { annualPriceInCents as sharedAnnualPrice } from "@shared/annualBilling";
import { displayBalance } from "@shared/creditDisplay";
import { formatCustomerShortDate } from "@shared/customerDate";
import { planCreditSliderPriceInCents } from "@shared/planCreditSlider";

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
  return perMonthOfYear(sharedAnnualPrice(monthlyInCents));
}

/**
 * A year's price said by the month — the ÷12 on its own, because two callers
 * now need it and the one rule must not be written twice (#1832).
 *
 * `monthlyEquivalent` above gets its year from `annualPrice`;
 * {@link creditStepsPriceAMonth} below gets its year from the credit slider's
 * per-step price times a quantity, which is a DIFFERENT year for a reason that
 * is measured rather than stylistic — see that function.
 */
function perMonthOfYear(yearInCents: number): number {
  return Math.round(yearInCents / 12);
}

/**
 * WHAT THE CREDIT SLIDER'S STEPS COST A MONTH at the selected interval — the
 * figure that moves under the thumb (#1832).
 *
 * ⚠ **IT CANNOT GO THROUGH `monthlyEquivalent`, AND THE REASON IS A MEASURED
 * DOLLAR RATHER THAN A PREFERENCE.** `annualPrice` rounds the WHOLE amount to
 * whole dollars (`Math.round(cents × 12 × 0.83 / 100) × 100`), which is right
 * for a plan — one price, one object, one charge. The slider is **one per-step
 * price times a quantity**: Stripe holds `klieg_studio_credits_yearly_v2` at
 * 9000¢ a step, so three steps is exactly 27,000¢ a year, where
 * `annualPrice(2700)` is **26,900¢**. A dollar apart, and the wrong one would
 * be the figure on the card against the figure on the invoice — which is the
 * one defect this surface may not have.
 *
 * So the year comes from the shared per-step function (the same one the server
 * composes the charge from) and only the ÷12 is shared with the plan's own
 * price. The annual leg is a MONTH's price in both intervals, exactly as every
 * other price on this surface is (card 390 item 2).
 */
export function creditStepsPriceAMonth(units: number, annual: boolean): number {
  const period = planCreditSliderPriceInCents(units, annual ? "annual" : "monthly");
  return annual ? perMonthOfYear(period) : period;
}

/**
 * THE PRICE A MONTH AT THE SELECTED INTERVAL — the ONE expression, so the rate
 * and the price beside it cannot disagree (#661).
 *
 * ⚠ **A CUSTOMER COULD CHECK OUR ARITHMETIC AND FIND IT WRONG.** With Annual
 * on, a Change plan card read `2,778 CREDITS PER $1` directly above
 * `$132 / month` — because the price went through `monthlyEquivalent` and the
 * rate went on dividing by the monthly `$159`. Two numbers in one card, and
 * the stated rate does not reproduce from the stated price. Add credits had
 * the same shape a line apart, which is what #661 was filed about.
 *
 * The fix is not a second calculation, it is the REMOVAL of one: every surface
 * that shows a price and a rate now derives BOTH from this call, so a future
 * interval change moves them together or moves neither. Working law 4 — the
 * three call sites this replaced were a mirror, and mirrors drift.
 *
 * ⚠ **IT DOES NOT CHANGE WHAT ANYONE IS CHARGED.** `annualPrice` is still what
 * the year costs and still what the confirm step shows; this is the same money
 * said by the month, which is card 390 item 2's rule for every plan surface.
 */
export function priceAMonth(monthlyInCents: number, annual: boolean): number {
  return annual ? monthlyEquivalent(monthlyInCents) : monthlyInCents;
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
 * ⚠ **AND THE SURFACE THAT WAS FILED RATHER THAN SWEPT IS SWEPT NOW (#403).**
 * This paragraph used to end *"`centsPerCredit` stays, and is not dead:
 * `AddCreditsModal` sells credit PACKS with it"* — true when written, and the
 * reason it did not last is the one card 390 left open: two billing surfaces
 * arguing one fact in two units. Add credits reads this function too, and its
 * sentence now runs *"2,941 credits per $1, up from 2,778"* — the real
 * Starter → Pro pair, read off `PLAN_TIERS` and seen in the running app. **The
 * first draft of this line quoted `up from 2,439`, which no rung on this
 * ladder can produce** (it runs 2,778 → 2,941 → 3,145 → 3,571 → 4,167 →
 * 5,000); the PR #660 reviewer caught it. A comment cannot fail a test, so an
 * invented figure in one survives until somebody quotes it.
 */
export function creditsPerDollar(priceInCents: number, credits: number): number {
  if (priceInCents <= 0) return 0;
  return credits / (priceInCents / 100);
}

/**
 * `556` — credits per dollar, whole, because fractions of a credit buy nothing.
 *
 * ⚠ **THE CONVERSION TO THE CUSTOMER'S SCALE HAPPENS HERE AND NOT AT THE THREE
 * CALL SITES (#1600), AND THAT PLACEMENT IS THE WHOLE POINT.** A customer reads
 * credits on the display scale, so the rate they are quoted has to be on it
 * too. Converting at the call sites would have converted it for
 * `creditsPerDollar` as well — and that function is what
 * `card390-guard.test.ts` uses to assert the founder's bar that value per
 * dollar must improve at every rung. Dividing both sides of a comparison moves
 * nothing, so the assertion would have survived unchanged while no longer
 * reading the ledger it is about.
 *
 * So the split is deliberate: `creditsPerDollar` answers the LEDGER question
 * the guards ask, this answers the SCREEN question a customer asks, and the
 * figure the example shows is a fifth of what it used to be for that reason
 * rather than because any price moved.
 *
 * ⚠ Its own `Math.round(perDollar)` is still on the census as unrouted, and it
 * is staying there: a RATE is not a credit count, and passing it through
 * `displayBalance` would divide by five twice. The census reads a NAME and
 * cannot see through a function boundary — a limit its own docblock states.
 */
export function formatCreditsPerDollar(priceInCents: number, credits: number): string {
  const perDollar = creditsPerDollar(priceInCents, displayBalance(credits));
  if (perDollar <= 0) return "free";
  return Math.round(perDollar).toLocaleString("en-US");
}
