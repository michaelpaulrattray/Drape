import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import {
  alignToPreview,
  annualPrice,
  centsPerCredit,
  formatCentsPerCredit,
  monthsFree,
  prorationFactor,
  readBurn,
  readCycle,
  type BillingCycle,
} from "./planMath";
import {
  cardTrio,
  compareWindow,
  COMPARE_COLUMNS,
  framesFor,
  recommendPlan,
  rolloverSentence,
  type LadderPlan,
} from "./planLadder";

/**
 * The arithmetic behind every sentence the three surfaces say about money.
 *
 * Section 03 §6a is explicit that the copy is DERIVED — *"if a customer checks
 * the dates and the charge disagrees, it has done the opposite of its job"* —
 * so these are the arms that make that true rather than intended.
 *
 * ⚠ **THE LADDER ARMS RUN AGAINST THE REAL PRICE TABLE, NOT A FIXTURE.**
 * `PLAN_TIERS` is imported from `drizzle/schema.ts`, which is where the product
 * declares its prices, so a future price edit that breaks the value argument
 * goes red here on the day it lands. A fixture would have proved only that the
 * fixture is monotonic.
 */

/** The real ladder, in the real order, exactly as the modal builds it. */
const LADDER: LadderPlan[] = (
  [
    "free",
    "starter",
    "pro",
    "studio",
    "studio_plus",
    "business",
    "business_plus",
    "scale",
    "scale_plus",
    "enterprise",
    "enterprise_plus",
    "ultimate",
  ] as const
).map((id) => ({
  id,
  name: PLAN_TIERS[id].name,
  priceInCents: PLAN_TIERS[id].price,
  credits: PLAN_TIERS[id].monthlyCredits,
  rolloverPercent: PLAN_TIERS[id].rolloverPercent,
}));

const cycleOf = (over: Partial<BillingCycle> = {}): BillingCycle => ({
  spent: 4_760,
  remaining: 1_240,
  daysLeft: 19,
  cycleLength: 31,
  renewsAt: new Date("2026-08-12T00:00:00Z"),
  ...over,
});

describe("the four constants and what is derived from them", () => {
  it("reads the cycle off what the server really returns", () => {
    const now = new Date("2026-07-24T00:00:00Z");
    const cycle = readCycle(
      {
        creditsUsed: 4_760,
        balance: 1_240,
        currentPeriodStart: "2026-07-12T00:00:00Z",
        currentPeriodEnd: "2026-08-12T00:00:00Z",
      },
      now,
    );
    expect(cycle).not.toBeNull();
    expect(cycle!.cycleLength).toBe(31);
    expect(cycle!.daysLeft).toBe(19);
    expect(cycle!.spent).toBe(4_760);
  });

  it("answers NULL rather than inventing a month for an account with no period", () => {
    /*
      A free account has no Stripe period, so it has no burn rate and no empty
      date — and the surfaces render a different sentence. Guessing "30 days"
      here would put a confident, wrong date in front of a customer.
    */
    expect(readCycle({ creditsUsed: 10, balance: 5 })).toBeNull();
    expect(readCycle(null)).toBeNull();
    expect(readCycle(undefined)).toBeNull();
    expect(
      readCycle({ currentPeriodStart: "not a date", currentPeriodEnd: "also not" }),
    ).toBeNull();
  });

  it("computes the burn, the empty date and the dry period from the cycle alone", () => {
    const now = new Date("2026-07-24T00:00:00Z");
    const burn = readBurn(cycleOf(), now);
    /* 4,760 spent over 12 elapsed days = 396.67 a day. */
    expect(burn.perDay).toBeCloseTo(4_760 / 12, 5);
    /* 1,240 remaining at that rate = 3.13 days. */
    expect(burn.daysToEmpty).toBeCloseTo(1_240 / (4_760 / 12), 5);
    /* Which leaves 19 − 3.13 ≈ 16 days dry before the renewal. */
    expect(burn.dryDays).toBe(16);
    expect(burn.emptyOn!.toISOString().slice(0, 10)).toBe("2026-07-27");
  });

  it("⚠ A ZERO BURN IS NOT A ZERO DATE — nothing spent means no prediction", () => {
    /*
      The division is undefined on day one of a cycle and with nothing spent.
      Both must answer `null`, not Infinity and not the epoch — a surface that
      prints "you run out on 1 Jan 1970" is worse than one that says nothing.
    */
    const nothingSpent = readBurn(cycleOf({ spent: 0 }));
    expect(nothingSpent.daysToEmpty).toBeNull();
    expect(nothingSpent.emptyOn).toBeNull();
    expect(nothingSpent.dryDays).toBe(0);

    const firstDay = readBurn(cycleOf({ daysLeft: 31 }));
    expect(firstDay.daysToEmpty).toBeNull();
    expect(firstDay.perDay).toBe(0);
  });

  it("never dramatises an account whose balance outlasts the cycle", () => {
    /* 100 spent over 12 days, 100,000 left: it does not run dry, so no dry days. */
    const burn = readBurn(cycleOf({ spent: 100, remaining: 100_000 }));
    expect(burn.dryDays).toBe(0);
  });

  it("⚠ THE CHARGE AND THE COPY READ THE SAME TWO NUMBERS", () => {
    /*
      `previewPlanChange` returns the `daysRemaining`/`totalDays` its
      `immediateCharge` was computed from. Where they differ from the client's
      own reading — and at a boundary they can differ by a day — the server's
      win, because the customer checking our arithmetic is checking it against
      the charge.
    */
    const aligned = alignToPreview(cycleOf(), { daysRemaining: 18, totalDays: 30 });
    expect(aligned.daysLeft).toBe(18);
    expect(aligned.cycleLength).toBe(30);
    expect(prorationFactor(aligned)).toBeCloseTo(18 / 30, 6);

    /* With no preview, the client's own reading stands untouched. */
    expect(alignToPreview(cycleOf(), null)).toEqual(cycleOf());
    expect(alignToPreview(cycleOf(), { totalDays: 0 })).toEqual(cycleOf());
  });

  it("keeps the proration factor inside [0, 1] whatever the cycle says", () => {
    expect(prorationFactor(cycleOf({ daysLeft: 40, cycleLength: 31 }))).toBe(1);
    expect(prorationFactor(cycleOf({ daysLeft: 0 }))).toBe(0);
  });

  it("the annual badge is the arithmetic, not a typed number", () => {
    expect(monthsFree()).toBe(2);
    /* 12 months at 0.83 = 9.96 months paid; the badge and the price agree. */
    expect(annualPrice(15_900)).toBe(Math.round(15_900 * 12 * 0.83));
    expect(annualPrice(15_900)).toBeLessThan(15_900 * 12);
  });
});

describe("the ladder, against the product's real price table", () => {
  it("⚠ COST PER CREDIT DESCENDS AT EVERY RUNG — the value argument the cards are sold on", () => {
    /*
      §6c: *"Cost per credit is on every card, and it must descend monotonically
      up the ladder … a ladder that argues against itself cannot be sold."* His
      prototype had Starter beating Pro and needed a data fix; ours does not,
      and this arm is what keeps it that way through the next price change.
    */
    const paid = LADDER.filter((plan) => plan.priceInCents > 0);
    expect(paid.length, "no paid plans found — the reader is broken").toBeGreaterThan(5);
    for (let index = 1; index < paid.length; index += 1) {
      const before = centsPerCredit(paid[index - 1].priceInCents, paid[index - 1].credits);
      const after = centsPerCredit(paid[index].priceInCents, paid[index].credits);
      expect(
        after,
        `${paid[index].name} is worse value per credit than ${paid[index - 1].name}`,
      ).toBeLessThan(before);
    }
  });

  it("⚠ AND THE PRINTED FIGURE SEPARATES THEM — two decimals collapses our whole ladder", () => {
    /*
      The brief quotes `2.79¢ … 1.87¢`, which is the mockup's five-plan world.
      Ours runs 0.036¢ to 0.016¢, and at two decimals every rung prints the same
      thing. This arm is the reason `formatCentsPerCredit` uses three: a number
      whose only job is to show a descent must actually show one.
    */
    const paid = LADDER.filter((plan) => plan.priceInCents > 0);
    const printed = paid.map((plan) => formatCentsPerCredit(plan.priceInCents, plan.credits));
    expect(new Set(printed).size, `two rungs print the same unit price: ${printed.join(" ")}`)
      .toBe(printed.length);

    /* The control: at the brief's own precision they would NOT be distinct. */
    const atTwo = paid.map((plan) =>
      centsPerCredit(plan.priceInCents, plan.credits).toFixed(2),
    );
    expect(new Set(atTwo).size).toBeLessThan(atTwo.length);
  });

  it("recommends the cheapest plan that covers the PROJECTED spend, or nothing", () => {
    const studio = LADDER.findIndex((plan) => plan.id === "studio");
    const covers = LADDER[studio].credits;
    /* Projected below the current allowance: nothing to recommend. */
    expect(recommendPlan(LADDER, "studio", covers - 1)).toBeNull();
    /* Just over it: the next rung that actually covers it. */
    const fit = recommendPlan(LADDER, "studio", covers + 1);
    expect(fit?.id).toBe("studio_plus");
    /* Far over it: it skips past the rungs that do not cover the projection. */
    expect(recommendPlan(LADDER, "starter", 2_500_000)?.id).toBe("business");
    /* Beyond the top rung: the top rung is still the best answer we have. */
    expect(recommendPlan(LADDER, "studio", Number.MAX_SAFE_INTEGER)?.id).toBe("ultimate");
    /* An unknown plan id answers nothing rather than guessing. */
    expect(recommendPlan(LADDER, "nonesuch", 10)).toBeNull();
  });

  it("draws three cards — current, recommendation, anchor — and never fewer", () => {
    const recommended = recommendPlan(LADDER, "studio", PLAN_TIERS.studio.monthlyCredits + 1);
    const trio = cardTrio(LADDER, "studio", recommended);
    expect(trio.map((plan) => plan.id)).toEqual(["studio", "studio_plus", "business"]);

    /* No recommendation: still three, still including the plan they are on. */
    const flat = cardTrio(LADDER, "studio", null);
    expect(flat).toHaveLength(3);
    expect(flat.map((plan) => plan.id)).toContain("studio");

    /* At the TOP of the ladder there is nothing above, so it fills downwards
       rather than drawing one card. */
    const top = cardTrio(LADDER, "ultimate", null);
    expect(top).toHaveLength(3);
    expect(top.map((plan) => plan.id)).toContain("ultimate");
  });

  it("the compare window is five wide and always holds both the plan and the offer", () => {
    const recommended = recommendPlan(LADDER, "starter", 2_500_000);
    const window = compareWindow(LADDER, "starter", recommended);
    expect(window).toHaveLength(COMPARE_COLUMNS);
    expect(window.map((plan) => plan.id)).toContain("starter");
    expect(window.map((plan) => plan.id)).toContain(recommended!.id);

    /* Bottom of the ladder: the window cannot slide below index 0. */
    expect(compareWindow(LADDER, "free", null)[0].id).toBe("free");
    /* Top of the ladder: nor past the end. */
    const atTop = compareWindow(LADDER, "ultimate", null);
    expect(atTop[atTop.length - 1].id).toBe("ultimate");
    expect(atTop).toHaveLength(COMPARE_COLUMNS);
  });

  it("says rollover as a LOSS, and only where there is one", () => {
    /*
      §6c: *"Rollover said as loss, not percentage … Same fact; only one of them
      lands."* Ours carries 0, 50, 75 and 100, so the sentence has to cover a
      quarter as well as a half.
    */
    expect(rolloverSentence(100)).toEqual({
      text: "Nothing you pay for expires",
      isLoss: false,
    });
    expect(rolloverSentence(50).text).toBe("Half of anything unspent expires");
    expect(rolloverSentence(75).text).toBe("A quarter of anything unspent expires");
    expect(rolloverSentence(0).text).toBe("Anything unspent expires at renewal");
    expect(rolloverSentence(0).isLoss).toBe(true);

    /* Every rung of the real table produces a sentence, none of them empty. */
    for (const plan of LADDER) {
      expect(rolloverSentence(plan.rolloverPercent).text.length).toBeGreaterThan(10);
    }
  });

  it("translates credits into work, and refuses to divide by a price it does not have", () => {
    expect(framesFor(500_000, 350)).toBe(1_428);
    /* A missing cost reader answers 0, and the surfaces then say nothing at all
       rather than printing `Infinity frames`. */
    expect(framesFor(500_000, 0)).toBe(0);
  });
});
