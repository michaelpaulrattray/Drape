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
  });

  it("annual → monthly mid-year nets NEGATIVE — nothing due today, the remainder becomes credit", () => {
    const now = T0 + 100 * DAY;
    const q = quotePlanChange(annualState(), "starter", "monthly", now);
    expect(q.kind).toBe("interval-switch");
    expect(q.proratedAmount).toBeLessThan(0);
    expect(q.immediateCharge).toBe(0);
    expect(q.creditBalance).toBe(-q.proratedAmount);
    expect(q.creditAdjustment).toBe(0);
  });

  it("the customer's OWN tier can switch cycles — same plan, different interval is a real change", () => {
    const q = quotePlanChange(monthlyState(), "starter", "annual", T0 + 15 * DAY);
    expect(q.kind).toBe("interval-switch");
    expect(q.isUpgrade).toBe(false);
    expect(q.newPlanPrice).toBe(annualPriceInCents(starterMonthly));
  });
});

describe("edges", () => {
  it("a change on the period's last day still divides by the real cycle, never by zero", () => {
    const q = quotePlanChange(monthlyState(), "pro", undefined, T0 + 30 * DAY);
    expect(q.daysRemaining).toBe(0);
    expect(q.proratedAmount).toBe(0);
    expect(q.creditAdjustment).toBe(0);
  });

  it("days remaining never exceeds the cycle (a clock skewed before the period start)", () => {
    const q = quotePlanChange(monthlyState(), "pro", undefined, T0 - 5 * DAY);
    expect(q.daysRemaining).toBe(q.totalDays);
  });
});
