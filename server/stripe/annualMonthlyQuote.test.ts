/**
 * A PLAN CHANGE ON A YEARLY PLAN GRANTED MONTH BY MONTH (#2152, his ruling on
 * #2159, 2026-10-10: *"yearly credits apply month by month"*) — the quote, and
 * the one sentence of his ruling that is a number: *"Yearly must still show
 * better value per credit than monthly."*
 *
 * `quotePlanChange` is the one arithmetic behind the confirm step and the
 * charge, so these arms are the contract for both. Every figure is derived
 * from the product's own tables, never typed.
 */
import { describe, expect, it } from "vitest";
import { quotePlanChange, type SubscriptionBillingState } from "./stripeService";
import { SUBSCRIPTION_PRODUCTS, SELF_SERVE_PLAN_ORDER } from "./stripeProducts";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { periodPriceInCents } from "@shared/annualBilling";
import { planCreditSliderLedgerCredits, planCreditSliderPriceInCents } from "@shared/planCreditSlider";
import { wholeDisplayLedger } from "@shared/creditDisplay";
import { PLAN_CREDIT_SLIDER_MAX_UNITS, PLAN_CREDIT_SLIDER_PLAN } from "./planCreditSlider";
import { grantedShareMonths } from "../billing/annualCreditMonths";

const DAY = 86_400;
const T0 = 1_760_000_000;
const YEAR_DAYS = 365;

/* The two cheapest paid self-serve rungs, in ladder order — an upgrade between them. */
const PAID = SELF_SERVE_PLAN_ORDER.filter((tier) => PLAN_TIERS[tier].price > 0) as PlanTier[];
const LOW = PAID[0];
const HIGH = PAID[1];
if (!LOW || !HIGH || PLAN_TIERS[HIGH].monthlyCredits <= PLAN_TIERS[LOW].monthlyCredits) {
  throw new Error("the ladder has no paid upgrade to quote — this suite would assert nothing");
}

function annualState(over: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState {
  return {
    subscriptionItemId: "si_test",
    currentPlan: LOW as SubscriptionBillingState["currentPlan"],
    currentInterval: "annual",
    periodStartSec: T0,
    periodEndSec: T0 + YEAR_DAYS * DAY,
    currentCreditUnits: 0,
    creditItemId: null,
    endsAtSec: null,
    status: "active",
    collectionPaused: false,
    ...over,
  };
}

const q = (
  state: SubscriptionBillingState,
  plan: PlanTier,
  interval: "monthly" | "annual" | undefined,
  nowSec: number,
  months: number | null | undefined,
  allowanceLeft?: number,
) => quotePlanChange(state, plan as never, interval, nowSec, undefined, allowanceLeft, months);

describe("1 · a period granted WHOLE is quoted exactly as before", () => {
  it("absent, null, and a full twelve all give the identical quote — the identity every legacy year rides", () => {
    for (const elapsedDays of [10, 100, 200, 350]) {
      const now = T0 + elapsedDays * DAY;
      const legacy = quotePlanChange(annualState(), HIGH as never, undefined, now);
      expect(q(annualState(), HIGH, undefined, now, null)).toEqual(legacy);
      expect(q(annualState(), HIGH, undefined, now, 12)).toEqual(legacy);
    }
  });

  it("a monthly plan ignores the count entirely", () => {
    const monthly = annualState({ currentInterval: "monthly", periodEndSec: T0 + 30 * DAY });
    const now = T0 + 12 * DAY;
    expect(q(monthly, HIGH, undefined, now, 1)).toEqual(quotePlanChange(monthly, HIGH as never, undefined, now));
  });
});

describe("2 · an upgrade mid-year tops up the MONTH IN HAND, not the year", () => {
  it("half-way through month 4 with 4 months granted: half a month of the difference, not 8½ months of it", () => {
    const elapsedDays = YEAR_DAYS * (3.5 / 12);
    const now = T0 + Math.round(elapsedDays * DAY);
    const monthly = q(annualState(), HIGH, undefined, now, 4);
    const whole = q(annualState(), HIGH, undefined, now, null);
    const delta = PLAN_TIERS[HIGH].monthlyCredits - PLAN_TIERS[LOW].monthlyCredits;
    const share = grantedShareMonths(12, 4, monthly.daysRemaining, monthly.totalDays);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
    expect(monthly.creditAdjustment).toBe(wholeDisplayLedger(Math.floor(delta * share)));
    expect(monthly.creditAdjustment).toBeLessThan(whole.creditAdjustment);
    /* The money is unchanged: the year is still paid for to its end, and the
       months to come arrive at the new plan through the paid year's month. */
    expect(monthly.proratedAmount).toBe(whole.proratedAmount);
    expect(monthly.deferred).toBe(false);
  });

  it("⚠ a worker running late (fewer months landed than have begun) tops up nothing for the month in hand — never a negative", () => {
    const now = T0 + Math.round(YEAR_DAYS * (3.5 / 12) * DAY);
    expect(q(annualState(), HIGH, undefined, now, 3).creditAdjustment).toBe(0);
  });
});

describe("3 · a switch off a yearly plan takes back only what was handed over", () => {
  /* The instant switch to monthly is only reachable at the year's knife edge
     (anything earlier hands money back and is deferred, #1936) — so the arm
     sits in the last month, the one place it can happen. */
  const top = PAID[PAID.length - 1];
  const now = T0 + (YEAR_DAYS - 20) * DAY;

  it("all twelve months landed: the take-back is the old figure", () => {
    const quote = q(annualState(), top, "monthly", now, 12, 10_000_000);
    expect(quote.deferred).toBe(false);
    expect(quote.creditUnwind).toBeGreaterThan(0);
    expect(quote).toEqual(q(annualState(), top, "monthly", now, null, 10_000_000));
  });

  it("⚠ the last month never landed: nothing to take back, and nothing charged for credits never given", () => {
    const quote = q(annualState(), top, "monthly", now, 11, 0);
    const whole = q(annualState(), top, "monthly", now, null, 0);
    expect(whole.spentShareCharge).toBeGreaterThan(0); // the control: granted whole, an empty balance IS charged
    expect(quote.creditUnwind).toBe(0);
    expect(quote.spentShareCredits).toBe(0);
    expect(quote.spentShareCharge).toBe(0);
  });
});

describe("3b · a spent credit is charged at the rate of the months handed over, never the whole year's", () => {
  it("an instant switch off a yearly plan mid-year, all due months landed and the allowance spent", () => {
    /* Instant only where the new month costs more than the unused year it
       replaces (#1936 defers the rest) — found by scanning the ladder rather
       than typed, and the arm refuses to pass vacuously. */
    const top = PAID[PAID.length - 1];
    const units = top === PLAN_CREDIT_SLIDER_PLAN ? PLAN_CREDIT_SLIDER_MAX_UNITS : undefined;
    let checked = 0;
    for (let elapsedDays = 40; elapsedDays < 360; elapsedDays += 5) {
      const now = T0 + elapsedDays * DAY;
      const begun = Math.min(12, Math.floor((elapsedDays / YEAR_DAYS) * 12) + 1);
      const quote = quotePlanChange(annualState(), top as never, "monthly", now, units, 0, begun);
      if (quote.deferred || quote.spentShareCredits === 0 || begun >= 12) continue;
      const share = grantedShareMonths(12, begun, quote.daysRemaining, quote.totalDays);
      const wholeYearUnused = Math.floor((quote.currentPlanPrice * quote.daysRemaining) / quote.totalDays);
      const handedOverValue = Math.floor((quote.currentPlanPrice * share) / 12);
      expect(quote.spentShareCharge).toBe(Math.floor((handedOverValue * quote.spentShareCredits) / quote.spentShareCredits));
      expect(quote.spentShareCharge).toBeLessThan(wholeYearUnused);
      checked += 1;
    }
    if (checked === 0) throw new Error("no instant mid-year switch exists on this ladder — the arm would assert nothing");
  });
});

describe("4 · yearly still costs less per credit than monthly (his ruling, via Cid)", () => {
  it("on every paid rung, a year's credits cost less each than a month's", () => {
    for (const tier of PAID) {
      const credits = PLAN_TIERS[tier].monthlyCredits;
      const monthlyCents = SUBSCRIPTION_PRODUCTS[tier as keyof typeof SUBSCRIPTION_PRODUCTS].priceInCents;
      const perCreditMonthly = periodPriceInCents(monthlyCents, "monthly") / credits;
      /* Twelve monthly grants of the same month — the year's credits, arriving month by month. */
      const perCreditYearly = periodPriceInCents(monthlyCents, "annual") / (credits * 12);
      expect(perCreditYearly, `${tier}`).toBeLessThan(perCreditMonthly);
    }
  });

  it("and so do the dial's steps, at every position on it", () => {
    if (PLAN_CREDIT_SLIDER_PLAN === null || PLAN_CREDIT_SLIDER_MAX_UNITS === 0) {
      throw new Error("no rung carries the dial — this arm would assert nothing");
    }
    for (const units of [1, Math.ceil(PLAN_CREDIT_SLIDER_MAX_UNITS / 2), PLAN_CREDIT_SLIDER_MAX_UNITS]) {
      const credits = planCreditSliderLedgerCredits(units);
      const perMonthly = planCreditSliderPriceInCents(units, "monthly") / credits;
      const perYearly = planCreditSliderPriceInCents(units, "annual") / (credits * 12);
      expect(perYearly, `${units} steps`).toBeLessThan(perMonthly);
    }
  });
});
