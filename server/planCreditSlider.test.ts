/**
 * THE PLAN CREDIT SLIDER — ITS THREE SAFETY PROPERTIES, ITS BOUND, AND THE
 * PRICE IT CHARGES ON (#1832, his approved brief #1774 §5).
 *
 * # Why this suite exists where it does
 *
 * The three properties below were already driven, in
 * `client/src/features/settings/pricingPhase2Prototype-guard.test.ts`, against
 * a `SLIDER_DOLLARS_PER_UNIT` declared in a PROTOTYPE HTML file. That was the
 * right place while the slider was a proposal on a page he was judging, and it
 * is the wrong place now: the card's own build line says *"the guard from PR
 * #1789 already drives these over the real constants; **move it from the
 * prototype to the surface**"*. So these arms read
 * `PLAN_CREDIT_SLIDER_CENTS_PER_UNIT` — the number the server composes the
 * charge from — and the prototype's arms stay where they are, now as a check
 * that the PICTURE he approved still matches the tree.
 *
 * ⚠ **THEY ARE PROPERTIES OF HIS NUMBER, NOT TESTS OF ARITHMETIC.** Each one
 * fails if $9 stops being a safe price — which is the point: *"His to move; the
 * three arms are what tell him what moving it would cost."* $8 breaks property
 * 1 on the whole ladder's invariant; $8.50 breaks property 2 and hollows out
 * the band the sales conversation is for. The arms are driven at the bottom of
 * this file against both, so they are proven able to fail rather than trusted
 * (working law 2).
 *
 * # The money half
 *
 * The rest of the suite drives what a customer is actually charged and
 * granted: the lookup keys the catalogue is asked for, the four refusals the
 * resolver makes, and that the renewal grant is `base + steps` rather than
 * `base`. Every one of those is a reading of the real module, not a fixture of
 * its shape.
 */
import { describe, expect, it, vi } from "vitest";

import { PLAN_TIERS, type PlanTier } from "../drizzle/schema";
import { annualPriceInCents, periodPriceInCents } from "../shared/annualBilling";
import { displayBalance } from "../shared/creditDisplay";
import {
  TOPUP_MAX_UNITS,
  TOPUP_UNIT_DISPLAY_CREDITS,
  TOPUP_UNIT_LEDGER_CREDITS,
  topupPriceInCents,
} from "../shared/creditTopups";
import {
  isSellablePlanCreditSliderUnits,
  PLAN_CREDIT_SLIDER_CENTS_PER_UNIT,
  PLAN_CREDIT_SLIDER_STEP_DISPLAY_CREDITS,
  PLAN_CREDIT_SLIDER_STEP_LEDGER_CREDITS,
  planCreditSliderLedgerCredits,
  planCreditSliderMaxUnits,
  planCreditSliderPriceInCents,
} from "../shared/planCreditSlider";
import {
  monthlyLedgerCreditsFor,
  PLAN_CREDIT_SLIDER_CEILING_PLAN,
  PLAN_CREDIT_SLIDER_MAX_UNITS,
  PLAN_CREDIT_SLIDER_PLAN,
  planCreditSliderSpec,
  planCreditSliderUnitsAllowed,
} from "./stripe/planCreditSlider";
import { ARRANGED_DIRECTLY_PLAN_TIERS, SELF_SERVE_PLAN_ORDER } from "./stripe/stripeProducts";

/** Credits a customer can see, per dollar — the ladder's own figure, the way
 *  up `planMath` prints it (card 390 item 4: it ASCENDS). */
const creditsPerDollar = (ledgerCredits: number, cents: number) =>
  displayBalance(ledgerCredits) / (cents / 100);

/** The dial's rung, refused rather than defaulted: every arm below is about a
 *  real slider, and a `null` here would make them all pass vacuously. */
function sliderPlan(): PlanTier {
  expect(
    PLAN_CREDIT_SLIDER_PLAN,
    "no rung carries the dial, so every arm in this suite would be about nothing",
  ).not.toBeNull();
  return PLAN_CREDIT_SLIDER_PLAN as PlanTier;
}

describe("the dial's rung and its ceiling are DERIVED from the ladder", () => {
  it("the dial sits on the dearest paid rung the self-serve ladder draws", () => {
    const plan = sliderPlan();
    /* Derived here the same way the module derives it, from the same two
       declarations — so this is a second reader of the ladder rather than a
       copy of the module's answer. */
    const paid = SELF_SERVE_PLAN_ORDER.filter((tier) => PLAN_TIERS[tier].price > 0);
    expect(paid.length, "the self-serve ladder draws no paid rung at all").toBeGreaterThan(0);
    const dearest = paid.reduce((best, tier) =>
      PLAN_TIERS[tier].price > PLAN_TIERS[best].price ? tier : best,
    );
    expect(plan).toBe(dearest);
    /* And the design's own sentence: it is the biggest of the three. */
    expect(paid.length, "the design's three individual plans are no longer three").toBe(3);
  });

  it("the ceiling is the cheapest rung that is arranged directly — the rung it replaces", () => {
    expect(PLAN_CREDIT_SLIDER_CEILING_PLAN).not.toBeNull();
    const cheapest = (ARRANGED_DIRECTLY_PLAN_TIERS as readonly string[])
      .filter((tier): tier is PlanTier => tier in PLAN_TIERS)
      .reduce((best, tier) => (PLAN_TIERS[tier].price < PLAN_TIERS[best].price ? tier : best));
    expect(PLAN_CREDIT_SLIDER_CEILING_PLAN).toBe(cheapest);
  });

  it("⚠ the step is the TOP-UP's step, not a second 5,000", () => {
    /*
      The design's §7 answer to *"what must the customer learn"* is *one
      slider, and they have already met it on Add credits — same step, same
      unit*. A step of its own would let the two drift, and then a customer
      meets two dials that look identical and move by different amounts.
    */
    expect(PLAN_CREDIT_SLIDER_STEP_DISPLAY_CREDITS).toBe(TOPUP_UNIT_DISPLAY_CREDITS);
    expect(PLAN_CREDIT_SLIDER_STEP_LEDGER_CREDITS).toBe(TOPUP_UNIT_LEDGER_CREDITS);
  });

  it("the ceiling floors, and it stops exactly where the rung above began", () => {
    const plan = sliderPlan();
    const base = PLAN_TIERS[plan].monthlyCredits;
    const ceiling = PLAN_TIERS[PLAN_CREDIT_SLIDER_CEILING_PLAN as PlanTier].monthlyCredits;
    expect(PLAN_CREDIT_SLIDER_MAX_UNITS).toBe(
      Math.floor((ceiling - base) / TOPUP_UNIT_LEDGER_CREDITS),
    );
    /* ⚠ THE DIRECTION IS THE WHOLE POINT OF THE BOUND: the top of the dial
       must not reach PAST the rung it is drawn from, because that rung's price
       is what the $9 was derived against. */
    const atTheTop = base + planCreditSliderLedgerCredits(PLAN_CREDIT_SLIDER_MAX_UNITS);
    expect(atTheTop).toBeLessThanOrEqual(ceiling);
    expect(
      base + planCreditSliderLedgerCredits(PLAN_CREDIT_SLIDER_MAX_UNITS + 1),
      "one more step would clear the rung the ceiling is drawn from, so the floor is doing nothing",
    ).toBeGreaterThan(ceiling);
  });

  it("a ceiling at or below the base is no dial at all, not a negative one", () => {
    expect(planCreditSliderMaxUnits(430_000, 430_000)).toBe(0);
    expect(planCreditSliderMaxUnits(430_000, 10)).toBe(0);
    /* Positive control: the real pair answers a real dial. */
    expect(planCreditSliderMaxUnits(430_000, 2_350_000)).toBeGreaterThan(0);
  });
});

describe("⚠ HIS $9 STILL HOLDS ITS OWN ARGUMENT — the design's §5, over the real constants", () => {
  /** The ladder the slider actually sells, at `cents` a step. */
  function sliderLadder(centsPerUnit: number) {
    const plan = sliderPlan();
    return {
      baseLedger: PLAN_TIERS[plan].monthlyCredits,
      baseCents: PLAN_TIERS[plan].price,
      centsPerUnit,
      maxUnits: PLAN_CREDIT_SLIDER_MAX_UNITS,
    };
  }

  /** PROPERTY 1 — the rate rises along the whole dial. */
  function rateRisesAllTheWay(centsPerUnit: number): boolean {
    const { baseLedger, baseCents, maxUnits } = sliderLadder(centsPerUnit);
    let previous = -Infinity;
    for (let units = 0; units <= maxUnits; units += 1) {
      const rate = creditsPerDollar(
        baseLedger + units * TOPUP_UNIT_LEDGER_CREDITS,
        baseCents + units * centsPerUnit,
      );
      if (!(rate > previous)) return false;
      previous = rate;
    }
    return true;
  }

  /** PROPERTY 2 — the top of the dial never reaches a hand-sold rung's rate. */
  function staysBelowTheConversation(centsPerUnit: number): boolean {
    const { baseLedger, baseCents, maxUnits } = sliderLadder(centsPerUnit);
    const ceilingPrice = PLAN_TIERS[PLAN_CREDIT_SLIDER_CEILING_PLAN as PlanTier].price;
    const bestHandSold = Math.max(
      ...Object.values(PLAN_TIERS)
        .filter((tier) => tier.price > ceilingPrice)
        .map((tier) => creditsPerDollar(tier.monthlyCredits, tier.price)),
    );
    const atTheTop = creditsPerDollar(
      baseLedger + maxUnits * TOPUP_UNIT_LEDGER_CREDITS,
      baseCents + maxUnits * centsPerUnit,
    );
    return atTheTop < bestHandSold;
  }

  it("1 · credits per dollar RISES along the whole dial, so the ladder's invariant survives", () => {
    expect(rateRisesAllTheWay(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT)).toBe(true);
    /* It holds BECAUSE the marginal rate beats the base rate, and for no other
       reason — stated in the design and worth asserting, because it is what a
       reader needs to predict what moving the number does. */
    const { baseLedger, baseCents } = sliderLadder(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT);
    expect(
      creditsPerDollar(TOPUP_UNIT_LEDGER_CREDITS, PLAN_CREDIT_SLIDER_CENTS_PER_UNIT),
    ).toBeGreaterThan(creditsPerDollar(baseLedger, baseCents));
  });

  it("2 · it never reaches the rate a sales conversation is for", () => {
    expect(staysBelowTheConversation(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT)).toBe(true);
  });

  it("3 · every position still beats the best credit pack, so Add credits' nudge stays true", () => {
    const { baseLedger, baseCents } = sliderLadder(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT);
    const bestPackRate = creditsPerDollar(
      TOPUP_MAX_UNITS * TOPUP_UNIT_LEDGER_CREDITS,
      topupPriceInCents(TOPUP_MAX_UNITS),
    );
    /* Step 0 is the worst the dial ever is — property 1 is why checking it is
       enough, and property 1 is asserted above rather than assumed here. */
    expect(creditsPerDollar(baseLedger, baseCents)).toBeGreaterThan(bestPackRate);
  });

  it("⚠ AND THE ARMS CAN FAIL — driven in BOTH directions off his number", () => {
    /*
      THE NEGATIVE CONTROLS, and they are the reason these arms are worth
      anything (working law 2). An arm that cannot go red is decoration, and
      three of them on the number that prices a plan is worse than none.

      Both controls are measured rather than chosen — the figures below were
      computed over the real constants before this arm was written, and they
      reproduce the design's own two: $8 tops out at **607.6** credits per
      dollar against the hand-sold rung's 580.0, and $8.50 at **578.9**.
    */
    /* DOWNWARD — the direction the design worried about. $8 was declined for
       being *"better value than any plan we have ever published, bought on a
       slider with no conversation"*, and property 2 is the arm that sees it. */
    expect(
      staysBelowTheConversation(800),
      "$8 clears a hand-sold rung's rate and property 2 cannot see it",
    ).toBe(false);
    /* UPWARD — the direction nothing in the design discusses, and a real one:
       a price RISE past ~$9.24 makes the dial worse value than the plain plan,
       so a customer who drags the thumb is paying more per credit than they
       were. Property 1 is the arm that sees it. */
    expect(
      rateRisesAllTheWay(925),
      "$9.25 makes the dial worse value than the plan under it and property 1 cannot see it",
    ).toBe(false);
  });

  it("⚠ AND THE FLOOR, SAID OUT LOUD: these arms do NOT catch $8.50", () => {
    /*
      **The design declined $8.50 and these three properties all pass at it.**
      Its reason was a MARGIN judgement — *"tops out at 578.9, within 0.2% of
      Enterprise's own rate, which would hollow out the band the sales
      conversation is for"* — and 578.9 is genuinely below 580.0, so property 2
      holds by a fraction rather than failing.

      This is asserted rather than left as a gap, because the alternative is a
      reader assuming the three arms encode every reason the design gave. They
      do not: they encode the three that are checkable. **How close is too
      close is his, and no arm here will tell him.**

      ⚠ **AND THE ARM IS MEASURED AGAINST A HIGHER BAR THAN THE DESIGN'S OWN
      FIGURE, WHICH WAS FOUND BY DRIVING IT RATHER THAN READING IT.** The
      design quotes the Enterprise rung's 580.0; property 2 compares against
      the BEST hand-sold rate, which is the hidden rung's **583.33** (#391 —
      `ultimate`, real, arranged by email, and genuinely above the dial). That
      is the arm's own stated claim — *the hand-sold rungs above the slider,
      whatever they are* — and it is the more conservative of the two. So the
      measured boundary is **$8.42 a step**, not the $8.47 the design's figure
      implies: at $8.41 the dial tops out at 583.84 and property 2 refuses.
    */
    expect(rateRisesAllTheWay(850)).toBe(true);
    expect(staysBelowTheConversation(850)).toBe(true);
    /* The boundary, so a future reader can see how much room property 2 really
       leaves rather than deriving it again. */
    expect(staysBelowTheConversation(842)).toBe(true);
    expect(staysBelowTheConversation(841)).toBe(false);
  });
});

describe("the bound is asked per RUNG, in one place", () => {
  it("only the dial's rung sells steps; every other rung sells none", () => {
    const plan = sliderPlan();
    expect(planCreditSliderUnitsAllowed(plan)).toBe(PLAN_CREDIT_SLIDER_MAX_UNITS);
    for (const tier of Object.keys(PLAN_TIERS) as PlanTier[]) {
      if (tier === plan) continue;
      expect(
        planCreditSliderUnitsAllowed(tier),
        `${tier} sells credit steps, and only the dial's rung may`,
      ).toBe(0);
    }
    /* A rung this product does not declare at all is 0 too, not a throw: the
       column still accepts four folded legacy values. */
    expect(planCreditSliderUnitsAllowed("legacy_whatever")).toBe(0);
  });

  it("sellable steps include zero and stop at the ceiling", () => {
    const max = PLAN_CREDIT_SLIDER_MAX_UNITS;
    expect(isSellablePlanCreditSliderUnits(0, max)).toBe(true);
    expect(isSellablePlanCreditSliderUnits(max, max)).toBe(true);
    expect(isSellablePlanCreditSliderUnits(max + 1, max)).toBe(false);
    expect(isSellablePlanCreditSliderUnits(-1, max)).toBe(false);
    expect(isSellablePlanCreditSliderUnits(1.5, max)).toBe(false);
  });

  it("⚠ the monthly allowance CLAMPS rather than trusting a quantity from Stripe", () => {
    /*
      The steps reaching `monthlyLedgerCreditsFor` come from the subscription
      at grant time. A quantity edited in the Stripe dashboard past the
      ceiling would otherwise grant an allowance no screen in this product has
      ever shown; the clamp is the conservative direction.
    */
    const plan = sliderPlan();
    const atTheTop = monthlyLedgerCreditsFor(plan, PLAN_CREDIT_SLIDER_MAX_UNITS);
    expect(monthlyLedgerCreditsFor(plan, PLAN_CREDIT_SLIDER_MAX_UNITS + 500)).toBe(atTheTop);
    expect(monthlyLedgerCreditsFor(plan, -5)).toBe(PLAN_TIERS[plan].monthlyCredits);
    /* And a rung with no dial is its own allowance whatever it is handed. */
    expect(monthlyLedgerCreditsFor("starter", 40)).toBe(PLAN_TIERS.starter.monthlyCredits);
  });

  it("the served spec is the derived pair, so no client decides which card has the dial", () => {
    const spec = planCreditSliderSpec();
    expect(spec.planId).toBe(sliderPlan());
    expect(spec.maxUnits).toBe(PLAN_CREDIT_SLIDER_MAX_UNITS);
    expect(spec.stepDisplayCredits).toBe(TOPUP_UNIT_DISPLAY_CREDITS);
    expect(spec.stepLedgerCredits).toBe(TOPUP_UNIT_LEDGER_CREDITS);
    expect(spec.centsPerUnit).toBe(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT);
  });
});

describe("what the steps cost for one period", () => {
  it("the monthly leg is his number times the quantity", () => {
    expect(planCreditSliderPriceInCents(0, "monthly")).toBe(0);
    expect(planCreditSliderPriceInCents(1, "monthly")).toBe(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT);
    expect(planCreditSliderPriceInCents(34, "monthly")).toBe(
      PLAN_CREDIT_SLIDER_CENTS_PER_UNIT * 34,
    );
  });

  it("⚠ the yearly leg is the product's OWN annual function, which is why Stripe holds 9000¢", () => {
    /*
      His hand created `klieg_studio_credits_yearly_v2` at 9000¢ a step on
      2026-10-07, and the figure came from `annualPriceInCents(900)` rather
      than from anybody typing $90. If a separate annual rule ever appears
      here, the *2 MONTHS FREE* badge stops being true of the figure under it.
    */
    expect(annualPriceInCents(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT)).toBe(9000);
    expect(planCreditSliderPriceInCents(1, "annual")).toBe(9000);
    expect(planCreditSliderPriceInCents(3, "annual")).toBe(27_000);
    /* ⚠ AND IT IS PER UNIT TIMES QUANTITY, NOT THE ANNUAL RULE OVER THE
       WHOLE ORDER — the two differ, which is the measured reason
       `creditStepsPriceAMonth` cannot route through `monthlyEquivalent`.
       Three steps: 27,000¢ against annualPriceInCents(2700) = 26,900¢. */
    expect(annualPriceInCents(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT * 3)).not.toBe(27_000);
  });

  it("a fractional or negative step count is refused rather than priced", () => {
    expect(() => planCreditSliderPriceInCents(1.5, "monthly")).toThrow(RangeError);
    expect(() => planCreditSliderPriceInCents(-1, "monthly")).toThrow(RangeError);
    expect(() => planCreditSliderLedgerCredits(2.5)).toThrow(RangeError);
    expect(() => planCreditSliderLedgerCredits(-2)).toThrow(RangeError);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   THE PRICE THE CATALOGUE IS ASKED FOR, AND THE FOUR REFUSALS.

   The Stripe double answers `prices.list`, so the REAL resolver runs — mocking
   it would assert that a caller forwards what it is handed, which is not the
   contract (`checkoutProductText.test.ts`'s own reasoning).
   ────────────────────────────────────────────────────────────────────────── */
describe("the add-on price is found by its lookup key, or refused", () => {
  /* Imported lazily so the module graph above stays free of the Stripe client. */
  async function catalogue() {
    return await import("./stripe/stripePriceCatalogue");
  }

  const priceRow = (overrides: Record<string, unknown> = {}) => ({
    id: "price_addon",
    lookup_key: "klieg_studio_credits_monthly_v2",
    unit_amount: PLAN_CREDIT_SLIDER_CENTS_PER_UNIT,
    recurring: { interval: "month" },
    ...overrides,
  });

  const clientWith = (rows: unknown[]) => ({
    prices: { list: vi.fn().mockResolvedValue({ data: rows }) },
  }) as never;

  it("composes the two keys his hand created, from the rung ID", async () => {
    const { planCreditsPriceLookupKey } = await catalogue();
    const plan = sliderPlan();
    expect(planCreditsPriceLookupKey(plan as never, "monthly")).toBe(
      "klieg_studio_credits_monthly_v2",
    );
    expect(planCreditsPriceLookupKey(plan as never, "annual")).toBe(
      "klieg_studio_credits_yearly_v2",
    );
  });

  it("⚠ the add-on key is told from a plan key by the COMPOSER, not a substring", async () => {
    const { isPlanCreditsLookupKey, planCreditsPriceLookupKey, priceLookupKey } = await catalogue();
    const plan = sliderPlan();
    expect(isPlanCreditsLookupKey(planCreditsPriceLookupKey(plan as never, "monthly"))).toBe(true);
    expect(isPlanCreditsLookupKey(planCreditsPriceLookupKey(plan as never, "annual"))).toBe(true);
    /* THE NEGATIVE CONTROLS, and the first is the one that matters: the base
       price sits beside the add-on on the same subscription, and reading it as
       the add-on is how a plan change would re-price the wrong line. */
    expect(isPlanCreditsLookupKey(priceLookupKey(plan as never, "monthly"))).toBe(false);
    expect(isPlanCreditsLookupKey(priceLookupKey(plan as never, "annual"))).toBe(false);
    expect(isPlanCreditsLookupKey("klieg_topup_5000_v2")).toBe(false);
    expect(isPlanCreditsLookupKey(null)).toBe(false);
    expect(isPlanCreditsLookupKey("")).toBe(false);
  });

  it("returns the id when the catalogue holds exactly one active price at the right amount", async () => {
    const { resolvePlanCreditsPriceId } = await catalogue();
    const client = clientWith([priceRow()]);
    await expect(resolvePlanCreditsPriceId(client, sliderPlan() as never, "monthly", 4)).resolves.toBe(
      "price_addon",
    );
  });

  it("refuses a rung with no dial, and a step count past the ceiling", async () => {
    const { resolvePlanCreditsPriceId } = await catalogue();
    const client = clientWith([priceRow()]);
    await expect(
      resolvePlanCreditsPriceId(client, "starter" as never, "monthly", 1),
    ).rejects.toThrow(/carries none/);
    await expect(
      resolvePlanCreditsPriceId(
        client,
        sliderPlan() as never,
        "monthly",
        PLAN_CREDIT_SLIDER_MAX_UNITS + 1,
      ),
    ).rejects.toThrow(/not between 1 and/);
    /* ⚠ ZERO IS REFUSED TOO: a plain plan sends no add-on line at all, so a
       zero here is a caller that has not asked itself whether it needs one. */
    await expect(
      resolvePlanCreditsPriceId(client, sliderPlan() as never, "monthly", 0),
    ).rejects.toThrow(/not between 1 and/);
  });

  it("refuses an absent key, an ambiguous key, and a price whose own key is null", async () => {
    const { resolvePlanCreditsPriceId } = await catalogue();
    const plan = sliderPlan();
    await expect(
      resolvePlanCreditsPriceId(clientWith([]), plan as never, "monthly", 1),
    ).rejects.toThrow(/no active price/);
    await expect(
      resolvePlanCreditsPriceId(
        clientWith([priceRow(), priceRow({ id: "price_other" })]),
        plan as never,
        "monthly",
        1,
      ),
    ).rejects.toThrow(/claimed by 2 active prices/);
    /* Asked by key AND filtered by key: a price with no key of its own is not
       the answer to a question about one. */
    await expect(
      resolvePlanCreditsPriceId(
        clientWith([priceRow({ lookup_key: null })]),
        plan as never,
        "monthly",
        1,
      ),
    ).rejects.toThrow(/no active price/);
  });

  it("⚠ refuses a price that does not RECUR — a step is subscribed to, not bought once", async () => {
    const { resolvePlanCreditsPriceId } = await catalogue();
    await expect(
      resolvePlanCreditsPriceId(
        clientWith([priceRow({ recurring: null })]),
        sliderPlan() as never,
        "monthly",
        1,
      ),
    ).rejects.toThrow(/recurs not at all/);
    /* And the wrong recurrence: the yearly key on the monthly road would bill
       a year's add-on beside a monthly plan. */
    await expect(
      resolvePlanCreditsPriceId(
        clientWith([priceRow({ recurring: { interval: "year" } })]),
        sliderPlan() as never,
        "monthly",
        1,
      ),
    ).rejects.toThrow(/recurs year and not per month/);
  });

  it("⚠ refuses an amount this product's screens do not show — PER STEP, not per order", async () => {
    const { resolvePlanCreditsPriceId } = await catalogue();
    const plan = sliderPlan();
    await expect(
      resolvePlanCreditsPriceId(
        clientWith([priceRow({ unit_amount: 1000 })]),
        plan as never,
        "monthly",
        1,
      ),
    ).rejects.toThrow(/not the 900 cents this product shows/);
    /* THE ARM THAT MATTERS: the comparison is against ONE step's price, so a
       four-step order at the right per-step price passes. Comparing against
       the whole order would refuse every order but a one-step one. */
    await expect(
      resolvePlanCreditsPriceId(clientWith([priceRow()]), plan as never, "monthly", 4),
    ).resolves.toBe("price_addon");
    /* And the annual leg's expected amount is the annual one. */
    await expect(
      resolvePlanCreditsPriceId(
        clientWith([
          priceRow({
            lookup_key: "klieg_studio_credits_yearly_v2",
            unit_amount: periodPriceInCents(PLAN_CREDIT_SLIDER_CENTS_PER_UNIT, "annual"),
            recurring: { interval: "year" },
          }),
        ]),
        plan as never,
        "annual",
        2,
      ),
    ).resolves.toBe("price_addon");
  });
});
