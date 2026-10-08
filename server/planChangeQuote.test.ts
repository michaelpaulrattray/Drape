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
import { LEDGER_PER_DISPLAY_CREDIT, wholeDisplayLedger } from "../shared/creditDisplay";

const DAY = 24 * 60 * 60;
const T0 = 1_760_000_000;

function monthlyState(overrides: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState {
  return {
    subscriptionItemId: "si_test",
    currentPlan: "starter",
    currentInterval: "monthly",
    periodStartSec: T0,
    periodEndSec: T0 + 30 * DAY,
    /* ⚠ THE DIAL AT THE BOTTOM AND NO ADD-ON LINE (#1832) — which is the
       state of every subscription that exists today, and is what keeps every
       arm below about the PLAN's own proration rather than about the slider.
       The slider's own quote arms are in
       `server/stripe/planCreditSliderWire.test.ts`; an `overrides` here can
       raise the dial, which is how a future arm in this file would. */
    currentCreditUnits: 0,
    creditItemId: null,
    cancelAtPeriodEnd: false,
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
    /* ⚠ THE DIAL AT THE BOTTOM AND NO ADD-ON LINE (#1832) — which is the
       state of every subscription that exists today, and is what keeps every
       arm below about the PLAN's own proration rather than about the slider.
       The slider's own quote arms are in
       `server/stripe/planCreditSliderWire.test.ts`; an `overrides` here can
       raise the dial, which is how a future arm in this file would. */
    currentCreditUnits: 0,
    creditItemId: null,
    cancelAtPeriodEnd: false,
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
    /* Quantised to a whole displayed credit since #1604 slice 2 — the bare
       floor came to 1,089,041, which is not one. The multiple-of-5 assertion
       below is the PROPERTY; this line is only the share it is taken from. */
    expect(q.creditAdjustment).toBe(
      wholeDisplayLedger(Math.floor(delta * 12 * (q.daysRemaining / q.totalDays))),
    );
    expect(q.creditAdjustment % LEDGER_PER_DISPLAY_CREDIT).toBe(0);
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
    /* Already a whole displayed credit on these numbers; wrapped so it cannot
       quietly stop being one if a grant or a fraction changes (#1604 slice 2). */
    expect(q.creditUnwind).toBe(
      wholeDisplayLedger(Math.floor(PLAN_TIERS.starter.monthlyCredits * (15 / 30))),
    );
    expect(q.creditUnwind % LEDGER_PER_DISPLAY_CREDIT).toBe(0);
  });

  it("⚠ annual → monthly mid-year is DEFERRED — #1936 replaced the refund it used to quote", () => {
    /*
      **This arm asserted the refund and the unwind, and its old expectations
      are the measurement that now justifies deferring it.** It read
      `proratedAmount < 0`, `creditBalance === -proratedAmount`, and a
      `creditUnwind` of ~653,420 ledger credits — i.e. leaving a year mid-way
      returned most of a year's money AND clawed back most of a year's
      allowance, with the clawback floored at whatever was left.

      That pairing is the #1936 loop at its largest: spend the year's credits,
      switch to monthly for the money, switch back. His option 1 removes the
      money, so there is nothing to claw back and nothing to keep — the change
      waits for the annual boundary, which for an annual subscriber IS her next
      renewal.

      ⚠ **The unwind FORMULA is still live and still tested** — every interval
      switch carries one, and monthly → annual is charged rather than refunded,
      so it stays instant. Its arithmetic is asserted by the monthly → annual
      arm above, which is the direction that still moves.
    */
    const now = T0 + 100 * DAY;
    const q = quotePlanChange(annualState(), "starter", "monthly", now);
    expect(q.kind).toBe("interval-switch");
    expect(q.deferred).toBe(true);
    expect(q.effectiveAtSec).toBe(T0 + 365 * DAY);
    expect(q.proratedAmount).toBe(0);
    expect(q.immediateCharge).toBe(0);
    expect(q.creditBalance).toBe(0);
    expect(q.creditAdjustment).toBe(0);
    expect(q.creditUnwind).toBe(0);
  });

  it("the customer's OWN tier can switch cycles — same plan, different interval is a real change", () => {
    const q = quotePlanChange(monthlyState(), "starter", "annual", T0 + 15 * DAY);
    expect(q.kind).toBe("interval-switch");
    expect(q.isUpgrade).toBe(false);
    expect(q.newPlanPrice).toBe(annualPriceInCents(starterMonthly));
  });
});

describe("no change mints credits — #664's mirror rule, SUPERSEDED downward by #1936", () => {
  it("⚠ a same-interval DOWNGRADE no longer mirrors, because it no longer refunds", () => {
    /*
      **This asserted `down.creditAdjustment === -up.creditAdjustment` — the
      mirror rule — and that rule is superseded in its down direction.**

      The mirror was the right answer to this exact loop and it could not win.
      It handed back the unused share of the allowance beside Stripe's money,
      but the take-back floors at what is LEFT of the allowance (*"spent
      credits are spent"*), so a customer who SPENT first kept the credits and
      got the money anyway. #1936 removes the money instead.

      ⚠ **The UP direction is unchanged and is asserted here beside the 0**, so
      this arm still proves the mirror's live half rather than becoming a
      statement about nothing: an upgrade grants the remaining-cycle share, a
      downgrade moves nothing and is scheduled for the boundary.
    */
    const now = T0 + 15 * DAY;
    const up = quotePlanChange(monthlyState(), "pro", undefined, now);
    const down = quotePlanChange(
      monthlyState({ currentPlan: "pro" }),
      "starter",
      undefined,
      now,
    );
    expect(up.deferred).toBe(false);
    expect(up.creditAdjustment).toBeGreaterThan(0);
    expect(down.deferred).toBe(true);
    expect(down.creditAdjustment).toBe(0);
    expect(down.creditUnwind).toBe(0);
  });

  it("⚠ THE LOOP IS DEAD, AND SINCE #1936 IT CANNOT EVEN START: the first leg never happens", () => {
    /*
      **#664's reproduction, as arithmetic — and the arm that has most changed
      shape.** Before the unwind existed, each annual → monthly → annual round
      trip kept the old period's credits while Stripe returned the old
      period's money: ~12 months of allowance minted per alternation. The
      unwind answered it by deducting the unconsumed share, and this arm
      composed the shipped rules to show the whole trip netting ~zero.

      **The unwind's answer was correct and incomplete, which is #1936.** It
      floors at what is LEFT of the allowance — spent credits are spent — so a
      customer who spent the year's credits BEFORE switching kept them and
      took the money. The trip netted zero only for somebody who had not
      spent, which is not the person running the exploit.

      ⚠ **So the proof is now structural rather than arithmetic: leg 1 is a
      decrease, a decrease is scheduled for the period boundary, and nothing
      moves. There is no refund to fund leg 3 and no clawback to dodge.** The
      balance is asserted UNCHANGED through both legs, which is a stronger
      claim than the old "within a month of honest" band — and the old band is
      kept below as the fallback it no longer needs.
    */
    const starterCredits = PLAN_TIERS.starter.monthlyCredits;
    // Day 0: buy Starter annual — the invoice grants the year.
    const granted = starterCredits * 12;
    let balance = granted;

    // Day 1: ask to switch to monthly. This is the leg that used to pay for
    // the loop, and it is now deferred to the annual boundary.
    const s1 = quotePlanChange(annualState(), "starter", "monthly", T0 + 1 * DAY);
    expect(s1.deferred).toBe(true);
    expect(s1.creditUnwind).toBe(0);
    expect(s1.creditBalance).toBe(0);
    balance = balance - s1.creditUnwind;

    /* Day 2: ask to switch back. There is nothing to switch back FROM — she is
       still annual, because leg 1 did not take effect — so the product refuses
       it as no change at all (`changePlan`'s "already on this plan and billing
       cycle"). The quote is read anyway, because what matters is that it moves
       no credits either. */
    const s2 = quotePlanChange(annualState(), "starter", "annual", T0 + 2 * DAY);
    expect(s2.creditUnwind).toBe(0);
    expect(s2.creditAdjustment).toBe(0);
    balance = balance - s2.creditUnwind;

    /* Not "within a month of honest" — EXACTLY what the year granted. The
       round trip moves nothing at all now, in either direction. */
    expect(balance).toBe(granted);
  });

  it("⚠ POSITIVE CONTROL — the unwind still fires on the leg that is still instant", () => {
    /* Three arms above now assert zeroes. If `creditUnwind` had simply stopped
       working, they would all still pass. Monthly → annual is charged rather
       than refunded, so it stays instant and its unwind is real — and it is
       what still stops a customer banking a monthly allowance and then buying
       a year. */
    const q = quotePlanChange(monthlyState(), "starter", "annual", T0 + 15 * DAY);
    expect(q.deferred).toBe(false);
    expect(q.creditUnwind).toBeGreaterThan(0);
    expect(q.creditUnwind % LEDGER_PER_DISPLAY_CREDIT).toBe(0);
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
