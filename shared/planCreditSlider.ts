/**
 * THE PLAN CREDIT SLIDER — what one extra step of credits a month costs, and
 * how far the dial goes (#1832, his approved brief #1774, the design's §5).
 *
 * His word opening the rung, 2026-10-03 (terminal, verbatim): *"phase 2 gets
 * built next not n2b"*; on the brief itself the same morning: *"frames right
 * numbers right"*, which approved the $9 below. His word creating the two
 * Stripe prices it charges on, 2026-10-07: *"Set up both. I'll run the command
 * to create the $9/month and $90/year slider prices."*
 *
 * # One judgement lives here and everything else is derived
 *
 * {@link PLAN_CREDIT_SLIDER_CENTS_PER_UNIT} is his number. The step, the
 * ledger arithmetic, the ceiling and the year's rate are all read from
 * something the product already declares, which is why this module is small:
 *
 *   · **the step is the top-up's step** — `TOPUP_UNIT_DISPLAY_CREDITS`, and
 *     deliberately not a second 5,000. The design's §7 answer to *"what must
 *     the customer learn"* is *one slider, and they have already met it on Add
 *     credits — same step, same unit, same readout shape*, and a step that was
 *     its own constant could drift away from that sentence silently.
 *   · **the ceiling is derived from the ladder** ({@link planCreditSliderMaxUnits}),
 *     because the slider replaces the rung above it and must stop where that
 *     rung began. Typing 76 here would be a figure that outlives a price move.
 *   · **the year's rate is `periodPriceInCents`** — the product's own annual
 *     function, the one that produces the *2 MONTHS FREE* badge. It is why the
 *     yearly price his hand created is 9000¢ and not a number anybody typed.
 *
 * # Why the arithmetic is shared rather than server-side
 *
 * The slider moves under a customer's thumb: the figure, the price and the
 * character count all recompute as they drag, and the charge is composed on
 * the server from the same unit count. Two copies of `units × step` on a money
 * surface is working law 4 at its worst — the screen would say one thing and
 * the invoice another. One declaration, two readers.
 *
 * ⚠ **THE SPEC THE CLIENT USES IS SERVED, NOT IMPORTED.** The slider's RUNG
 * and its CEILING are facts about `PLAN_TIERS`, which lives in the schema and
 * does not belong in the bundle — `server/stripe/planCreditSlider.ts` derives
 * them and `billing.getPlans` puts them on the wire, exactly as
 * `selfServeOrder` already is. What crosses this module is arithmetic, never a
 * ladder.
 */
import { type BillingIntervalChoice, periodPriceInCents } from "./annualBilling";
import { TOPUP_UNIT_DISPLAY_CREDITS, TOPUP_UNIT_LEDGER_CREDITS } from "./creditTopups";

/**
 * WHAT ONE EXTRA STEP COSTS A MONTH, IN CENTS — $9, and his.
 *
 * ⚠ **IT IS THE ONLY NUMBER IN THIS FEATURE THAT IS NOT DERIVED, AND THE
 * DESIGN SAYS SO IN TERMS**: *"This is the only number in this brief that is
 * not already in the product."* What argues for it is the marginal rate
 * between the two rungs the slider spans — `($840 − $159) ÷ 76.8 = $8.87`, to
 * the dollar — and three safety properties that are checkable rather than
 * asserted (the design's §5, driven over the real constants in
 * `server/planCreditSlider.test.ts`):
 *
 *   1. credits per dollar RISES along the whole slider, so the ladder's own
 *      invariant survives into it;
 *   2. the top of the slider never reaches the rate a hand-sold rung offers,
 *      so *talk to us for more* stays a true sentence;
 *   3. every slider position still beats the best credit pack, so Add
 *      credits' *a bigger plan gives more for the money* nudge stays true.
 *
 * $8.50 and $8 were considered and declined in the design for failing 2 and 1
 * respectively. **His to move; the three arms are what tell him what moving it
 * would cost.**
 */
export const PLAN_CREDIT_SLIDER_CENTS_PER_UNIT = 900;

/**
 * The display credits one step adds a month — the top-up's own unit, for the
 * reason in this module's header.
 */
export const PLAN_CREDIT_SLIDER_STEP_DISPLAY_CREDITS = TOPUP_UNIT_DISPLAY_CREDITS;

/** The same step in ledger credits — what a renewal actually grants. */
export const PLAN_CREDIT_SLIDER_STEP_LEDGER_CREDITS = TOPUP_UNIT_LEDGER_CREDITS;

/**
 * HOW FAR THE DIAL GOES, derived from the two rungs it spans.
 *
 * The slider replaces the rung above the one it sits on, so it runs as far as
 * that rung went and stops: *"Past it the answer is the Enterprise card —
 * which is what 'anything really high would be a sales department chat'
 * means."* Both arguments are LEDGER amounts, so the answer is scale-neutral
 * and no display conversion belongs in here.
 *
 * ⚠ **IT FLOORS, and the direction is the bound's whole purpose.** `quantity`
 * is what decides the charge, so this number is the refusal `TOPUP_MAX_UNITS`
 * is for the packs (invariant 4 on a money path) — an unbounded unit count
 * composed from a request body is an unbounded charge. Rounding UP would sell
 * a step past the rung the ceiling is drawn from.
 *
 * A ceiling at or below the base answers **0**, which is a real answer and the
 * surface draws no slider for it: a dial with one position is machinery
 * showing through. Nothing on today's ladder reaches that state.
 */
export function planCreditSliderMaxUnits(
  baseLedgerCredits: number,
  ceilingLedgerCredits: number,
): number {
  const room = ceilingLedgerCredits - baseLedgerCredits;
  if (room <= 0) return 0;
  return Math.floor(room / PLAN_CREDIT_SLIDER_STEP_LEDGER_CREDITS);
}

/** Whether a unit count is one this product sells, against a derived ceiling. */
export function isSellablePlanCreditSliderUnits(units: number, maxUnits: number): boolean {
  return Number.isInteger(units) && units >= 0 && units <= maxUnits;
}

/**
 * The ledger credits `units` steps add to a month's allowance.
 *
 * Zero units is a legitimate order — it is the plain plan, and it is where the
 * slider starts — so this answers 0 rather than refusing, which is the one
 * place its contract differs from `topupLedgerCredits`. The BOUND is the
 * caller's: {@link isSellablePlanCreditSliderUnits} against the served
 * ceiling, and the price resolver refuses past it as well.
 */
export function planCreditSliderLedgerCredits(units: number): number {
  if (!Number.isInteger(units) || units < 0) {
    throw new RangeError(
      `planCreditSliderLedgerCredits: ${String(units)} is not a whole number of steps`,
    );
  }
  return units * PLAN_CREDIT_SLIDER_STEP_LEDGER_CREDITS;
}

/**
 * What `units` steps cost for ONE PERIOD at the chosen interval.
 *
 * ⚠ **THE YEAR'S RATE IS `periodPriceInCents`, NOT A SECOND ANNUAL RULE.** The
 * two Stripe prices his hand created are 900¢ monthly and 9000¢ yearly, and
 * the 9000 is `annualPriceInCents(900)` — so the badge beside the toggle and
 * the slider's own total are computed by one function. A separate annual
 * constant here would be the drift that makes *2 MONTHS FREE* stop being true
 * of the figure under it.
 */
export function planCreditSliderPriceInCents(
  units: number,
  interval: BillingIntervalChoice,
): number {
  if (!Number.isInteger(units) || units < 0) {
    throw new RangeError(
      `planCreditSliderPriceInCents: ${String(units)} is not a whole number of steps`,
    );
  }
  return periodPriceInCents(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT, interval) * units;
}

/**
 * WHAT THE CLIENT IS TOLD ABOUT THE SLIDER — the served spec.
 *
 * `planId` is which drawn card carries the dial and `maxUnits` is how far it
 * goes. Both are derived on the server from `PLAN_TIERS`; the client reads
 * them off the wire and never names a rung, which is `card390-guard`'s
 * standing rule (no plan name is a literal on this surface) and the same
 * reason `selfServeOrder` is served rather than filtered.
 *
 * `maxUnits === 0` means **no slider**, and the surface draws none.
 */
export type PlanCreditSliderSpec = {
  readonly planId: string;
  readonly maxUnits: number;
  readonly stepDisplayCredits: number;
  readonly stepLedgerCredits: number;
  readonly centsPerUnit: number;
};
