/**
 * WHICH RUNG CARRIES THE CREDIT SLIDER, AND WHERE THE DIAL STOPS — derived
 * from the ladder, never typed (#1832, the design's §3 and §5).
 *
 * `shared/planCreditSlider.ts` holds the arithmetic and the one judgement
 * ($9 a step). This module holds the two facts that are read off `PLAN_TIERS`
 * and therefore cannot live in the bundle: the rung the dial sits on, and the
 * rung it stops at.
 *
 * ## ⚠ BOTH ARE DERIVED, AND THE REASON IS THE SAME ONE `SELF_SERVE_PLAN_ORDER`
 * ## IS DERIVED FOR
 *
 * His brief puts the slider on *"the biggest one"* of the three individual
 * plans and stops it where the first arranged-directly rung began. Written as
 * `"studio"` and `"business"` this would be two string literals on a money
 * surface, and the day he adds a fourth individual plan — or moves a rung into
 * the Enterprise band — the dial would sit on the wrong card or run past the
 * conversation it is supposed to hand over to. Both are read from the two
 * declarations that already decide the ladder's shape:
 *
 *   · the slider's rung is the **last paid rung of {@link SELF_SERVE_PLAN_ORDER}**
 *     — the same list `billing.getPlans` serves and the surface draws;
 *   · the ceiling is the **cheapest {@link ARRANGED_DIRECTLY_PLAN_TIERS} rung**
 *     — the one the slider replaces, which is exactly the design's
 *     *"it runs as far as that rung went"*.
 *
 * ⚠ **AND THE RENAME COMING FOR THAT RUNG IS WHY THIS MATTERS THIS WEEK.** His
 * word, 2026-10-07: *"rename the Studio plan to Pro Plus, everywhere a customer
 * sees it … The internal Stripe lookup names can stay as they are"* (#1900).
 * Nothing here reads a plan's NAME, so the rename moves one table and this
 * module does not notice; the lookup key keeps keying on the rung ID, which is
 * the half he said may stay.
 *
 * ## What a non-slider rung answers
 *
 * {@link planCreditSliderUnitsAllowed} answers **0** for every rung but the
 * slider's, which is what makes a unit count on a Starter checkout a REFUSAL
 * rather than a silent extra charge: the bound and the rung are one question
 * asked in one place, and every money road asks it here.
 */
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import {
  PLAN_CREDIT_SLIDER_CENTS_PER_UNIT,
  PLAN_CREDIT_SLIDER_STEP_DISPLAY_CREDITS,
  PLAN_CREDIT_SLIDER_STEP_LEDGER_CREDITS,
  type PlanCreditSliderSpec,
  planCreditSliderLedgerCredits,
  planCreditSliderMaxUnits,
} from "@shared/planCreditSlider";
import { ARRANGED_DIRECTLY_PLAN_TIERS, SELF_SERVE_PLAN_ORDER } from "./stripeProducts";

/**
 * The rung the dial sits on — the dearest PAID rung the self-serve ladder
 * draws.
 *
 * Read by price rather than by position, for `ChangePlanModal`'s own reason
 * (#1832: the direction of a move is read off the price, because a position in
 * a drawn subset cannot answer a question about the whole ladder). `free` is
 * excluded by the same `price > 0` test the surface uses to decide which rungs
 * get cards at all, so a rung's cardness and its sliderness cannot come apart.
 */
export const PLAN_CREDIT_SLIDER_PLAN: PlanTier | null =
  SELF_SERVE_PLAN_ORDER.filter((tier) => PLAN_TIERS[tier].price > 0).reduce<PlanTier | null>(
    (dearest, tier) =>
      dearest === null || PLAN_TIERS[tier].price > PLAN_TIERS[dearest].price ? tier : dearest,
    null,
  );

/**
 * The rung the dial stops at — the cheapest rung that is arranged directly.
 *
 * ⚠ **`null` IS A REAL ANSWER AND IT MEANS NO SLIDER.** With nothing above the
 * ladder there is no room to derive, and a ceiling invented here would be a
 * price nobody approved. {@link PLAN_CREDIT_SLIDER_MAX_UNITS} is then 0 and the
 * surface draws no dial — the same shape as a ceiling that sits at the base.
 */
export const PLAN_CREDIT_SLIDER_CEILING_PLAN: PlanTier | null =
  (ARRANGED_DIRECTLY_PLAN_TIERS as readonly string[])
    .filter((tier): tier is PlanTier => tier in PLAN_TIERS)
    .reduce<PlanTier | null>(
      (cheapest, tier) =>
        cheapest === null || PLAN_TIERS[tier].price < PLAN_TIERS[cheapest].price ? tier : cheapest,
      null,
    );

/**
 * How many steps the dial offers — 0 when there is no slider rung or no rung
 * above it to stop at.
 */
export const PLAN_CREDIT_SLIDER_MAX_UNITS: number =
  PLAN_CREDIT_SLIDER_PLAN === null || PLAN_CREDIT_SLIDER_CEILING_PLAN === null
    ? 0
    : planCreditSliderMaxUnits(
        PLAN_TIERS[PLAN_CREDIT_SLIDER_PLAN].monthlyCredits,
        PLAN_TIERS[PLAN_CREDIT_SLIDER_CEILING_PLAN].monthlyCredits,
      );

/**
 * THE BOUND, PER RUNG — and the one place every money road asks it.
 *
 * 0 for every rung but the slider's. A unit count above what this answers is
 * refused at the input schema AND at the resolver, because an input schema is
 * not the only caller a money helper can ever have (`topupBracketFor`'s own
 * reasoning, one module over).
 */
export function planCreditSliderUnitsAllowed(plan: string): number {
  if (PLAN_CREDIT_SLIDER_PLAN === null) return 0;
  return plan === PLAN_CREDIT_SLIDER_PLAN ? PLAN_CREDIT_SLIDER_MAX_UNITS : 0;
}

/**
 * A MONTH'S ALLOWANCE FOR A RUNG AT A SLIDER POSITION, in ledger credits — the
 * one declaration of *base + steps*, read by the renewal grant, by the
 * plan-change quote and by the surface alike.
 *
 * ⚠ **IT IS CLAMPED TO WHAT THE RUNG ALLOWS RATHER THAN TRUSTING ITS
 * ARGUMENT.** The units reaching this come from Stripe's own subscription at
 * grant time, and a quantity edited in the Stripe dashboard past the ceiling
 * would otherwise grant an allowance no screen in this product has shown. The
 * clamp is the conservative direction: the customer gets the dial's top, and
 * the mismatch is visible in the log line beside it rather than minted into a
 * balance.
 */
export function monthlyLedgerCreditsFor(plan: PlanTier, units: number): number {
  const allowed = planCreditSliderUnitsAllowed(plan);
  const steps = Math.max(0, Math.min(Math.trunc(units), allowed));
  return PLAN_TIERS[plan].monthlyCredits + planCreditSliderLedgerCredits(steps);
}

/**
 * The slider's spec for the wire (`billing.getPlans`).
 *
 * `planId` is the empty string when there is no slider, which the schema-free
 * client reads as *no dial* through `maxUnits === 0`; both are sent so a
 * surface cannot draw a dial on a rung by guessing which one is dearest.
 */
export function planCreditSliderSpec(): PlanCreditSliderSpec {
  return {
    planId: PLAN_CREDIT_SLIDER_PLAN ?? "",
    maxUnits: PLAN_CREDIT_SLIDER_MAX_UNITS,
    stepDisplayCredits: PLAN_CREDIT_SLIDER_STEP_DISPLAY_CREDITS,
    stepLedgerCredits: PLAN_CREDIT_SLIDER_STEP_LEDGER_CREDITS,
    centsPerUnit: PLAN_CREDIT_SLIDER_CENTS_PER_UNIT,
  };
}
