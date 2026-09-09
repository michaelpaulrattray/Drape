/**
 * THE QUOTE A PLAN CHANGE IS CONFIRMED AND CHARGED AGAINST (#664).
 *
 * `quotePlanChange` is the one arithmetic behind `previewPlanChange` AND
 * `changePlan`, so these arms are the contract for both: what a same-interval
 * change costs, what an interval switch costs, which leg grants credits
 * locally and which leaves the grant to the invoice webhook — and the sibling
 * fix, that an ABSENT interval keeps the cycle the customer is on.
 *
 * Figures are computed here from the same product table the function reads —
 * the arms assert the RELATIONSHIP (which prices, which fraction), not magic
 * numbers, so a price edit does not redden them (magic-number lesson).
 */
import { describe, expect, it } from "vitest";
import {
  quotePlanChange,
  calculateCreditAdjustment,
  type SubscriptionBillingState,
} from "./stripe/stripeService";
import { SUBSCRIPTION_PRODUCTS } from "./stripe/stripeProducts";
import { annualPriceInCents } from "../shared/annualBilling";
import { PLAN_TIERS } from "../drizzle/schema";

const DAY = 24 * 60 * 60;
const T0 = 1_760_000_000;

function monthlyState(overrides: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState {
  return {
    subscriptionItemId: "si_test",
    currentPlan: "starter",
    currentInterval: "monthly",
    periodStartSec: T0,
    periodEndSec: T0 + 30 * DAY,
    ...overrides,
  };
}

function annualState(overrides: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState {
  return {
    subscriptionItemId: "si_test",
    currentPlan: "starter",
    currentInterval: "annual",
    periodStartSec: T0,
    periodEndSec: T0 + 365 * DAY,
    ...overrides,
  };
}

const starterMonthly = SUBSCRIPTION_PRODUCTS.starter.priceInCents;
const proMonthly = SUBSCRIPTION_PRODUCTS.pro.priceInCents;

describe("same-interval changes", () => {
  it("a monthly tier upgrade prices both plans by the month over the real cycle", () => {
    const now = T0 + 15 * DAY;
    const q = quotePlanChange(monthlyState(), "pro", undefined, now);
    expect(q.kind).toBe("same-interval");
    expect(q.targetInterval).toBe("monthly");
    expect(q.currentPlanPrice).toBe(starterMonthly);
    expect(q.newPlanPrice).toBe(proMonthly);
    expect(q.totalDays).toBe(30);
    expect(q.daysRemaining).toBe(15);
    const expected =
      Math.floor((proMonthly * 15) / 30) - Math.floor((starterMonthly * 15) / 30);
    expect(q.proratedAmount).toBe(expected);
    expect(q.immediateCharge).toBe(expected);
    expect(q.isUpgrade).toBe(true);
    expect(q.creditAdjustment).toBe(
      calculateCreditAdjustment("starter", "pro", 15, 30, 1),
    );
  });

  it("⚠ an ANNUAL subscriber's tier change prices both plans by the YEAR — the maths this replaces used monthly prices over 365 days", () => {
    const now = T0 + 100 * DAY;
    const q = quotePlanChange(annualState(), "pro", undefined, now);
    expect(q.kind).toBe("same-interval");
    expect(q.currentPlanPrice).toBe(annualPriceInCents(starterMonthly));
    expect(q.newPlanPrice).toBe(annualPriceInCents(proMonthly));
    expect(q.totalDays).toBe(365);
    /* The credit top-up covers every month left of the YEAR — ×12, not the
       one month the old arithmetic would have granted. */
    const delta = PLAN_TIERS.pro.monthlyCredits - PLAN_TIERS.starter.monthlyCredits;
    expect(q.creditAdjustment).toBe(
      Math.floor(delta * 12 * (q.daysRemaining / q.totalDays)),
    );
    expect(q.creditAdjustment).toBe(
      calculateCreditAdjustment("starter", "pro", q.daysRemaining, q.totalDays, 12),
    );
  });

  it("⚠ THE SIBLING FIX — an absent interval KEEPS the customer's cycle, never resets it to monthly", () => {
    const q = quotePlanChange(annualState(), "pro", undefined, T0 + 10 * DAY);
    expect(q.targetInterval).toBe("annual");
    expect(q.kind).toBe("same-interval");
  });
});

describe("interval switches", () => {
  it("monthly → annual charges the full year minus the unused share of the month, and grants NO local credits", () => {
    const now = T0 + 15 * DAY;
    const q = quotePlanChange(monthlyState(), "pro", "annual", now);
    expect(q.kind).toBe("interval-switch");
    expect(q.targetInterval).toBe("annual");
    expect(q.newPlanPrice).toBe(annualPriceInCents(proMonthly));
    const unused = Math.floor((starterMonthly * 15) / 30);
    expect(q.proratedAmount).toBe(annualPriceInCents(proMonthly) - unused);
    expect(q.immediateCharge).toBe(q.proratedAmount);
    /* Decision 3: the switch's anchor-reset invoice buys a whole period, so
       the invoice webhook grants the year — a local top-up would double-grant. */
    expect(q.creditAdjustment).toBe(0);
    /* And the OLD period's unconsumed grant goes back — the same fraction of
       the same period Stripe credits back in money (#664 review finding 1). */
    expect(q.creditUnwind).toBe(
      Math.floor(PLAN_TIERS.starter.monthlyCredits * (15 / 30)),
    );
  });

  it("annual → monthly mid-year nets NEGATIVE — nothing due today, the remainder becomes credit", () => {
    const now = T0 + 100 * DAY;
    const q = quotePlanChange(annualState(), "starter", "monthly", now);
    expect(q.kind).toBe("interval-switch");
    expect(q.proratedAmount).toBeLessThan(0);
    expect(q.immediateCharge).toBe(0);
    expect(q.creditBalance).toBe(-q.proratedAmount);
    expect(q.creditAdjustment).toBe(0);
    /* Leaving a year mid-way unwinds the unconsumed share of the YEAR's grant. */
    expect(q.creditUnwind).toBe(
      Math.floor(PLAN_TIERS.starter.monthlyCredits * 12 * (q.daysRemaining / q.totalDays)),
    );
  });

  it("the customer's OWN tier can switch cycles — same plan, different interval is a real change", () => {
    const q = quotePlanChange(monthlyState(), "starter", "annual", T0 + 15 * DAY);
    expect(q.kind).toBe("interval-switch");
    expect(q.isUpgrade).toBe(false);
    expect(q.newPlanPrice).toBe(annualPriceInCents(starterMonthly));
  });
});

describe("the mirror rule holds — no change mints credits (#664 review finding 1)", () => {
  it("a same-interval DOWNGRADE returns the share an upgrade would grant", () => {
    const now = T0 + 15 * DAY;
    const up = quotePlanChange(monthlyState(), "pro", undefined, now);
    const down = quotePlanChange(
      monthlyState({ currentPlan: "pro" }),
      "starter",
      undefined,
      now,
    );
    expect(down.creditAdjustment).toBeLessThan(0);
    expect(down.creditAdjustment).toBe(-up.creditAdjustment);
    expect(down.creditUnwind).toBe(0);
  });

  it("⚠ THE LOOP IS DEAD: annual → monthly → annual nets ~zero free credits", () => {
    /*
      The review's reproduction, as arithmetic. Before the unwind existed,
      each round trip kept the old period's credits while Stripe returned the
      old period's money — ~12 months of allowance minted per alternation.
      Composing the shipped rules (webhook grants the period bought and
      carries the balance; changePlan deducts the unwind), the whole trip
      may cost the customer a few days and mint nothing.
    */
    const starterCredits = PLAN_TIERS.starter.monthlyCredits;
    // Day 0: buy Starter annual — the invoice grants the year.
    let balance = starterCredits * 12;

    // Day 1: switch to monthly.
    const s1 = quotePlanChange(
      annualState(),
      "starter",
      "monthly",
      T0 + 1 * DAY,
    );
    balance = balance - s1.creditUnwind + starterCredits * 1; // unwind, then the month's grant

    // Day 2: switch back to annual (a fresh 30-day monthly cycle began at day 1).
    const s2 = quotePlanChange(
      monthlyState({ periodStartSec: T0 + 1 * DAY, periodEndSec: T0 + 31 * DAY }),
      "starter",
      "annual",
      T0 + 2 * DAY,
    );
    balance = balance - s2.creditUnwind + starterCredits * 12;

    // What an honest fresh annual holds is 12 months; the trip may keep at
    // most the few days actually consumed (day-granularity rounding), never
    // months. Before the unwind this figure was ~25 months.
    expect(balance).toBeLessThanOrEqual(starterCredits * 12 + starterCredits);
    expect(balance).toBeGreaterThanOrEqual(starterCredits * 12 - starterCredits);
  });
});

describe("edges", () => {
  it("a change on the period's last day still divides by the real cycle, never by zero", () => {
    const q = quotePlanChange(monthlyState(), "pro", undefined, T0 + 30 * DAY);
    expect(q.daysRemaining).toBe(0);
    expect(q.proratedAmount).toBe(0);
    expect(q.creditAdjustment).toBe(0);
    expect(q.creditUnwind).toBe(0);
  });

  it("days remaining never exceeds the cycle (a clock skewed before the period start)", () => {
    const q = quotePlanChange(monthlyState(), "pro", undefined, T0 - 5 * DAY);
    expect(q.daysRemaining).toBe(q.totalDays);
  });
});
