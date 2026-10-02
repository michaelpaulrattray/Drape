import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import { OFFERED_PLAN_ORDER } from "../../../../server/stripe/stripeProducts";
import {
  alignsToPreview,
  alignToPreview,
  annualPrice,
  creditsPerDollar,
  formatCreditsPerDollar,
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

/**
 * The real ladder, in the real order, exactly as the modal builds it — the
 * OFFERED seven (#391): `billing.getPlans` serves `OFFERED_PLAN_ORDER`, so the
 * hidden rung never reaches these functions in production and must not appear
 * in the fixture either. The arm below pins the fold itself.
 */
const OFFERED = [
  "free",
  "starter",
  "pro",
  "studio",
  "business",
  "scale",
  "enterprise",
] as const;

/* Card #391's own pin — the fold this fixture must not silently outlive. */
describe("card 391 — the fixture IS the ladder the server serves", () => {
  it("OFFERED matches OFFERED_PLAN_ORDER, seven rungs ending at Enterprise", () => {
    /* Mirrored on purpose and pinned here: if the product's offered ladder
       moves, this fixture must be re-read, not silently re-derived. */
    expect([...OFFERED]).toEqual(OFFERED_PLAN_ORDER);
    expect(OFFERED).toHaveLength(7);
    expect(OFFERED[OFFERED.length - 1]).toBe("enterprise");
  });
});

const LADDER: LadderPlan[] = OFFERED.map((id) => ({
  id,
  name: PLAN_TIERS[id].name,
  priceInCents: PLAN_TIERS[id].price,
  credits: PLAN_TIERS[id].monthlyCredits,
  rolloverPercent: PLAN_TIERS[id].rolloverPercent,
}));

const cycleOf = (over: Partial<BillingCycle> = {}): BillingCycle => ({
  spent: 4_760,
  /* The span the sum covers, and the divisor every arm below quotes. It was
     `cycleLength - daysLeft` (31 - 19 = 12) until PR #622 review finding 1;
     the fixture keeps the same 12 so the arithmetic each arm states is still
     the arithmetic that runs. */
  spentOverDays: 12,
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
        balance: 1_240,
        currentPeriodStart: "2026-07-12T00:00:00Z",
        currentPeriodEnd: "2026-08-12T00:00:00Z",
      },
      { spent: 4_760, days: 12 },
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
    const spend = { spent: 10, days: 12 };
    expect(readCycle({ balance: 5 }, spend)).toBeNull();
    expect(readCycle(null, spend)).toBeNull();
    expect(readCycle(undefined, spend)).toBeNull();
    expect(
      readCycle({ currentPeriodStart: "not a date", currentPeriodEnd: "also not" }, spend),
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

  /*
    ⚠ **AND A CALLER CAN NOW ASK WHETHER IT ALIGNED — #1730.** The two returns
    above are indistinguishable at the result: a cycle Stripe never spoke about
    and one Stripe happened to agree with are the same object. The renewal line
    beside the charge needs the difference, because an unaligned cycle is the
    CREDIT cycle and the sentence claims to describe the proration — it said
    *"Prorated for the 8 days left in this cycle"* and became *"343 days"* a
    second later on the yearly fixture.

    Held HERE rather than at the surface so the predicate and the branch cannot
    drift: `alignToPreview` calls this, so a change to one is a change to both.
  */
  it("says whether the preview had anything to align to", () => {
    /* The positive half first: every input the function actually re-cuts on. */
    expect(alignsToPreview({ daysRemaining: 18, totalDays: 30 })).toBe(true);
    expect(alignsToPreview({ daysRemaining: 0, totalDays: 365 })).toBe(true);
    expect(alignsToPreview({ totalDays: 1 })).toBe(true);

    /* And the three ways there is nothing to align to. */
    expect(alignsToPreview(null)).toBe(false);
    expect(alignsToPreview(undefined)).toBe(false);
    expect(alignsToPreview({ totalDays: 0 })).toBe(false);

    /*
      ⚠ **THE ARM THAT MAKES THE PAIR HONEST**: the predicate agrees with the
      function at every one of those inputs. Without it the two could part — the
      sentence declining on a cycle that WAS aligned, or stating a basis on one
      that was not — which is exactly the shape a surface-side copy of the
      condition would eventually take.
    */
    const base = cycleOf();
    for (const preview of [
      { daysRemaining: 18, totalDays: 30 },
      { daysRemaining: 0, totalDays: 365 },
      { totalDays: 1 },
      { totalDays: 0 },
      null,
      undefined,
    ] as const) {
      const moved = alignToPreview(base, preview);
      const reCut = moved.cycleLength !== base.cycleLength || moved.daysLeft !== base.daysLeft;
      /* ⚠ The equivalence below is only a reading while every ALIGNING fixture
         actually moves the base — a fixture that happened to match it would
         make this arm vacuous rather than red. Said out loud, not assumed. */
      if (alignsToPreview(preview)) {
        expect(
          reCut,
          `the ${JSON.stringify(preview)} fixture no longer differs from the base cycle, so`
          + " this arm cannot tell an alignment from a no-op — change the fixture, not the arm",
        ).toBe(true);
      }
      expect(
        alignsToPreview(preview),
        `the predicate and the re-cut disagree about ${JSON.stringify(preview)}`,
      ).toBe(reCut);
    }
  });

  it("keeps the proration factor inside [0, 1] whatever the cycle says", () => {
    expect(prorationFactor(cycleOf({ daysLeft: 40, cycleLength: 31 }))).toBe(1);
    expect(prorationFactor(cycleOf({ daysLeft: 0 }))).toBe(0);
  });

  it("the annual badge is the arithmetic, not a typed number", () => {
    expect(monthsFree()).toBe(2);
    /*
      12 months at 0.83 = 9.96 months paid; the badge and the price agree.

      ⚠ **THE PRICE LINE USED TO READ `Math.round(15_900 * 12 * 0.83)`, WHICH IS
      THE FUNCTION'S OWN BODY TYPED OUT A SECOND TIME** — and with the rate
      typed again rather than imported, so it mirrored two things at once. It
      could only fail if the function stopped matching the line beside it, and
      it was green on all four rungs where our yearly price disagreed with the
      one Stripe charges (#1605 bullet 2). The expectation is now Studio's real
      `klieg_studio_yearly_v2` `unit_amount`; the whole ladder is driven on the
      server side, in `server/annualBilling.test.ts`.
    */
    expect(annualPrice(15_900)).toBe(158_400);
    expect(annualPrice(15_900)).toBeLessThan(15_900 * 12);
    /* Whole dollars — no price this product shows carries cents. */
    expect(annualPrice(15_900) % 100).toBe(0);
  });
});

describe("the ladder, against the product's real price table", () => {
  it("⚠ THE VALUE ARGUMENT IMPROVES AT EVERY RUNG — now read in the one unit both surfaces use", () => {
    /*
      §6c: *"Cost per credit is on every card, and it must descend monotonically
      up the ladder … a ladder that argues against itself cannot be sold."* His
      prototype had Starter beating Pro and needed a data fix; ours does not,
      and this arm is what keeps it that way through the next price change.

      ⚠ **THE CLAIM IS UNCHANGED AND ITS UNIT IS INVERTED (#403).** Cost per
      credit had to DESCEND; credits per dollar must ASCEND. It is the same
      sentence — *the figure must improve at every rung* — read against the same
      real table.

      This suite's population is the OFFERED ladder, which is why the arm stays
      here rather than folding into `card390-guard.test.ts`: that one reads
      every PAID tier, including the hidden top rung no customer is shown.
    */
    const paid = LADDER.filter((plan) => plan.priceInCents > 0);
    expect(paid.length, "no paid plans found — the reader is broken").toBeGreaterThan(5);
    for (let index = 1; index < paid.length; index += 1) {
      const before = creditsPerDollar(paid[index - 1].priceInCents, paid[index - 1].credits);
      const after = creditsPerDollar(paid[index].priceInCents, paid[index].credits);
      expect(
        after,
        `${paid[index].name} buys fewer credits per dollar than ${paid[index - 1].name}`,
      ).toBeGreaterThan(before);
    }
  });

  it("⚠ AND THE CHECKER CAN FAIL — a rung made worse is caught", () => {
    /*
      Working law 2, and it is why the arm above may be re-expressed rather than
      merely deleted with the unit it used to read: a green comparison proves
      nothing until the same comparison has been seen to go red.
    */
    const paid = LADDER.filter((plan) => plan.priceInCents > 0);
    const sabotaged = paid.map((plan, index) =>
      index === 3 ? { ...plan, credits: Math.round(plan.credits / 4) } : plan);
    const ascends = sabotaged.every((plan, index) =>
      index === 0
      || creditsPerDollar(plan.priceInCents, plan.credits)
        > creditsPerDollar(sabotaged[index - 1].priceInCents, sabotaged[index - 1].credits));
    expect(ascends, "the monotonic check passed a ladder that argues against itself").toBe(false);
  });

  it("⚠ AND EVERY OFFERED RUNG PRINTS A DISTINCT FIGURE", () => {
    /*
      The claim the deleted three-decimal arm carried, in the surviving unit:
      whole credits per dollar run into the thousands and every adjacent pair
      differs by hundreds, which is the whole reason card 390 inverted it.
    */
    const paid = LADDER.filter((plan) => plan.priceInCents > 0);
    const printed = paid.map((plan) => formatCreditsPerDollar(plan.priceInCents, plan.credits));
    expect(new Set(printed).size, `two rungs print the same figure: ${printed.join(" ")}`)
      .toBe(printed.length);
    for (const figure of printed) {
      expect(figure, `\`${figure}\` is not a whole number of credits`).toMatch(/^[\d,]+$/);
    }
  });

  it("recommends the cheapest plan that covers the PROJECTED spend, or nothing", () => {
    const studio = LADDER.findIndex((plan) => plan.id === "studio");
    const covers = LADDER[studio].credits;
    /* Projected below the current allowance: nothing to recommend. */
    expect(recommendPlan(LADDER, "studio", covers - 1)).toBeNull();
    /* Just over it: the next rung that actually covers it. */
    const fit = recommendPlan(LADDER, "studio", covers + 1);
    expect(fit?.id).toBe("business");
    /*
      Far over it: it skips past the rungs that do not cover the projection.

      ⚠ THIS PROJECTION WAS THE LITERAL `2_500_000` UNTIL #1602 AND IT WAS THE
      ONE THING IN THIS FILE THE LADDER COULD BREAK. Everything else here reads
      `PLAN_TIERS` directly, so his adopted ladder moved through it untouched;
      a hard-coded spend cannot. Business fell 3,000,000 → 2,350,000 ledger, so
      the old number stopped being covered by the rung the arm named and the
      answer became `scale` — a correct recommendation failing a stale fixture.

      Derived instead, from the rung BELOW the expected answer, so the arm
      states its property rather than a number: a spend one credit past Studio
      cannot be met by Pro or Studio and must land on Business.
    */
    const studioCovers = LADDER[studio].credits;
    const pastStudio = studioCovers + 1;
    expect(recommendPlan(LADDER, "starter", pastStudio)?.id).toBe("business");
    /* And the skip is asserted, not inferred from the name: both intervening
       rungs genuinely fail to cover it, which is what makes the answer a skip
       rather than simply the next rung up. */
    for (const skipped of ["pro", "studio"] as const) {
      expect(
        LADDER.find((plan) => plan.id === skipped)!.credits,
        `${skipped} now covers the projection, so this arm no longer tests a skip`,
      ).toBeLessThan(pastStudio);
    }
    /* Beyond the top rung: the top rung is still the best answer we have —
       and since #391 that top is Enterprise; what sits above it is asked for
       by email, never recommended by a card. */
    expect(recommendPlan(LADDER, "studio", Number.MAX_SAFE_INTEGER)?.id).toBe("enterprise");
    /* An unknown plan id answers nothing rather than guessing. */
    expect(recommendPlan(LADDER, "nonesuch", 10)).toBeNull();
  });

  it("draws three cards — current, recommendation, anchor — and never fewer", () => {
    const recommended = recommendPlan(LADDER, "studio", PLAN_TIERS.studio.monthlyCredits + 1);
    const trio = cardTrio(LADDER, "studio", recommended);
    expect(trio.map((plan) => plan.id)).toEqual(["studio", "business", "scale"]);

    /* No recommendation: still three, still including the plan they are on. */
    const flat = cardTrio(LADDER, "studio", null);
    expect(flat).toHaveLength(3);
    expect(flat.map((plan) => plan.id)).toContain("studio");

    /* At the TOP of the ladder there is nothing above, so it fills downwards
       rather than drawing one card. */
    const top = cardTrio(LADDER, "enterprise", null);
    expect(top).toHaveLength(3);
    expect(top.map((plan) => plan.id)).toContain("enterprise");
  });

  it("the compare window is five wide and always holds both the plan and the offer", () => {
    /* Derived for the same reason as the arm above (#1602): this one only
       asserts the window's SHAPE, so the stale literal passed either way —
       which is exactly why it would have been left behind. */
    const recommended = recommendPlan(
      LADDER,
      "starter",
      LADDER.find((plan) => plan.id === "studio")!.credits + 1,
    );
    const window = compareWindow(LADDER, "starter", recommended);
    expect(window).toHaveLength(COMPARE_COLUMNS);
    expect(window.map((plan) => plan.id)).toContain("starter");
    expect(window.map((plan) => plan.id)).toContain(recommended!.id);

    /* Bottom of the ladder: the window cannot slide below index 0. */
    expect(compareWindow(LADDER, "free", null)[0].id).toBe("free");
    /* Top of the ladder: nor past the end. */
    const atTop = compareWindow(LADDER, "enterprise", null);
    expect(atTop[atTop.length - 1].id).toBe("enterprise");
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
