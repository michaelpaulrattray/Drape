/**
 * THE ANNUAL ARITHMETIC IS DECLARED ONCE, AND BOTH SIDES READ IT (#664).
 *
 * Until this change `monthly × 12 × 0.83` lived twice — inline in the server's
 * checkout builder and as `ANNUAL_RATE` in the client's `planMath.ts` — which
 * is working law 4's mirror on the number that charges the card. The sweep
 * arms below hold the two former declaration sites to READING the shared
 * module rather than declaring their own, so the drift cannot come back
 * silently. Comments are stripped before matching: both files legitimately
 * QUOTE the old shape while telling its story.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANNUAL_RATE,
  annualPriceInCents,
  monthsFreePerYear,
  periodPriceInCents,
  monthsBought,
  stripeIntervalOf,
  choiceOfStripeInterval,
} from "../shared/annualBilling";
import { PLAN_TIERS } from "../drizzle/schema";

const REPO = process.cwd();
const read = (...parts: string[]) => readFileSync(join(REPO, ...parts), "utf8");
/** Source with comments removed, so a story about the old code cannot match. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the arithmetic itself", () => {
  it("a year is 12 months at the rate, rounded to a whole dollar", () => {
    /*
      ⚠ **THIS ARM USED TO RESTATE THE IMPLEMENTATION** — `toBe(Math.round(15_900
      * 12 * ANNUAL_RATE))` — so it could only ever go red if the function
      stopped computing what the line beside it computed. That is not a test of
      the price; it is a copy of the formula, and it was green on every one of
      the four rungs where our number and Stripe's disagreed.
    */
    expect(annualPriceInCents(15_900)).toBe(158_400);
    expect(annualPriceInCents(15_900)).toBeLessThan(15_900 * 12);
    /* Every yearly figure is whole dollars — no price in this product has cents. */
    expect(annualPriceInCents(15_900) % 100).toBe(0);
  });

  it("⚠ EVERY YEARLY PRICE IS THE ONE STRIPE CHARGES — #1605 bullet 2", () => {
    /*
      THE CARD'S SENTENCE, DRIVEN: *"today `shared/annualBilling.ts` rounds to
      the cent — Pro $677.28 — while Stripe's yearly price is a whole $677."*

      ⚠ **THE EXPECTATIONS ARE STRIPE'S OWN `unit_amount`s, READ OFF THE
      ACCOUNT**, not this formula applied a second time. Read 2026-10-01 in
      test mode from the `klieg_<plan>_yearly_v2` lookup keys — the same
      objects #1605 bullet 1 will resolve checkout against — so this arm is
      what stops our arithmetic and Stripe's catalogue drifting apart again.
      Deriving them here would make the suite agree with itself and prove
      nothing, which is exactly how the cent rounding survived.

      ⚠ **THE MONTHLY SIDE IS READ FROM `PLAN_TIERS`, NEVER TYPED.** A price
      edit must redden this arm rather than slide past it: if a monthly price
      moves, the Stripe object has to move with it, and that is the finding.
    */
    const STRIPE_YEARLY_UNIT_AMOUNTS: Record<string, number> = {
      Starter: 26_900,
      Pro: 67_700,
      Studio: 158_400,
      Business: 836_600,
      Scale: 4_780_800,
      Enterprise: 14_940_000,
      Ultimate: 47_808_000,
    };

    const paid = Object.values(PLAN_TIERS).filter((tier) => tier.price > 0);
    expect(paid.length, "no paid rungs found — the reader is broken").toBe(7);

    const unpriced = paid.filter((tier) => STRIPE_YEARLY_UNIT_AMOUNTS[tier.name] === undefined);
    expect(
      unpriced.map((tier) => tier.name),
      "a paid rung has no yearly price recorded from Stripe — read the account before shipping it",
    ).toEqual([]);

    for (const tier of paid) {
      expect(
        annualPriceInCents(tier.price),
        `${tier.name}'s yearly price is not the amount Stripe would charge`,
      ).toBe(STRIPE_YEARLY_UNIT_AMOUNTS[tier.name]);
    }
  });

  it("⚠ AND THE CENT ROUNDING IS KEPT AS THE NEGATIVE CONTROL — it fails on four rungs", () => {
    /*
      Working law 2: the arm above is green, and that is worth nothing until
      the same comparison is shown to go RED on the arithmetic this change
      replaced. So the superseded rounding is applied here and its disagreement
      with Stripe is named rung by rung — which is also the measurement that
      justified the change, kept where it cannot rot into prose.
    */
    const centRounded = (monthlyInCents: number) => Math.round(monthlyInCents * 12 * ANNUAL_RATE);
    const STRIPE_YEARLY_UNIT_AMOUNTS: Record<string, number> = {
      Starter: 26_900,
      Pro: 67_700,
      Studio: 158_400,
      Business: 836_600,
      Scale: 4_780_800,
      Enterprise: 14_940_000,
      Ultimate: 47_808_000,
    };

    const disagreed = Object.values(PLAN_TIERS)
      .filter((tier) => tier.price > 0)
      .filter((tier) => centRounded(tier.price) !== STRIPE_YEARLY_UNIT_AMOUNTS[tier.name])
      .map((tier) => tier.name);

    expect(
      disagreed,
      "the superseded cent rounding no longer disagrees with Stripe where it was measured to",
    ).toEqual(["Starter", "Pro", "Studio", "Business"]);
  });

  it("the badge derives from the rate — two months free at 0.83", () => {
    expect(monthsFreePerYear()).toBe(2);
  });

  it("a period's price is a month's or a year's, nothing else", () => {
    expect(periodPriceInCents(10_000, "monthly")).toBe(10_000);
    expect(periodPriceInCents(10_000, "annual")).toBe(annualPriceInCents(10_000));
  });

  it("a year buys twelve months of allowance; a month buys one", () => {
    expect(monthsBought("year")).toBe(12);
    expect(monthsBought("month")).toBe(1);
  });

  it("the two dialects convert exactly, and anything else answers null", () => {
    expect(stripeIntervalOf("annual")).toBe("year");
    expect(stripeIntervalOf("monthly")).toBe("month");
    expect(choiceOfStripeInterval("year")).toBe("annual");
    expect(choiceOfStripeInterval("month")).toBe("monthly");
    /* A week/day price is nothing this product sells — pretending it is
       monthly would misprice it, so the reader refuses to guess. */
    expect(choiceOfStripeInterval("week")).toBeNull();
    expect(choiceOfStripeInterval(undefined)).toBeNull();
    expect(choiceOfStripeInterval(null)).toBeNull();
  });
});

describe("one declaration — the mirror stays collapsed (working law 4)", () => {
  it("shared/annualBilling.ts is the only file that declares the rate", () => {
    const declaration = /ANNUAL_RATE\s*=\s*0?\.\d+/;
    expect(code(read("shared", "annualBilling.ts"))).toMatch(declaration);
    expect(
      code(read("client", "src", "features", "settings", "planMath.ts")),
      "planMath declares its own rate again — it must re-export the shared one",
    ).not.toMatch(declaration);
    expect(
      code(read("server", "stripe", "stripeService.ts")),
      "stripeService grew its own rate again",
    ).not.toMatch(declaration);
  });

  it("the server computes a period price through the shared module, not inline", () => {
    /* ⚠ THE SUBJECT OF THIS ARM MOVED ON 2026-10-02 AND THE FLOOR DID NOT.
       It used to read `periodPriceInCents(product.priceInCents, interval)` out
       of `stripeService.ts`'s CHECKOUT BUILDER. #1605 bullet 1 took the amount
       off that wire entirely — the session now carries a price id resolved
       from a lookup key — so the arm's own string went away while its
       SUBJECT, "the server works a year out through one module", did not: the
       amount is now computed to be COMPARED against Stripe's, inside
       `resolvePriceId`. Deleting the assertion would have been lowering the
       floor to fit the move; it is pointed at the new site instead, and the
       two negative controls stay on the service where the inline arithmetic
       actually lived. */
    const service = code(read("server", "stripe", "stripeService.ts"));
    expect(service).toContain('from "@shared/annualBilling"');
    expect(service, "the inline 12 × 0.83 came back").not.toMatch(/\*\s*12\s*\*\s*0?\.83/);

    const catalogue = code(read("server", "stripe", "stripePriceCatalogue.ts"));
    expect(catalogue).toContain('from "@shared/annualBilling"');
    expect(
      catalogue,
      "the catalogue grew its own year arithmetic instead of asking the shared module",
    ).not.toMatch(/\*\s*12\s*\*\s*0?\.83/);
    expect(catalogue).toContain("periodPriceInCents(product.priceInCents, interval)");
  });

  it("⚠ and the checkout builder sends no computed amount at all any more (#1605 bullet 1)", () => {
    /* The other half of the move, as a source reading rather than a belief:
       the builder that used to compose `unit_amount` no longer mentions it.
       `checkoutProductText.test.ts` proves the same thing at the wire, which
       is the stronger evidence — this arm is here so that a re-added inline
       price reddens the suite that OWNS the arithmetic too. */
    const service = code(read("server", "stripe", "stripeService.ts"));
    expect(service, "an inline price_data came back to checkout").not.toContain("price_data");
    expect(service, "an ad-hoc price mint came back").not.toContain("prices.create");
  });

  it("planMath re-exports the shared arithmetic under the names its surfaces use", () => {
    const planMath = code(read("client", "src", "features", "settings", "planMath.ts"));
    expect(planMath).toContain("annualPriceInCents as annualPrice");
    expect(planMath).toContain("monthsFreePerYear as monthsFree");
    expect(planMath, "planMath computes the year inline again").not.toMatch(
      /\*\s*12\s*\*\s*ANNUAL_RATE/,
    );
  });
});
