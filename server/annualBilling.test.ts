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
import { PLAN_TIERS, type PlanTier } from "../drizzle/schema";
import { sourceBand } from "./testing/sourceBand";

const REPO = process.cwd();
const read = (...parts: string[]) => readFileSync(join(REPO, ...parts), "utf8");
/** Source with comments removed, so a story about the old code cannot match. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * ⚠ **STRIPE'S OWN YEARLY `unit_amount`s, READ OFF THE ACCOUNT**, not this
 * formula applied a second time. Read 2026-10-01 in test mode from the
 * `klieg_<id>_yearly_v2` lookup keys — the same objects #1605 bullet 1 resolves
 * checkout against — so these figures are what stops our arithmetic and
 * Stripe's catalogue drifting apart again. Deriving them here would make the
 * suite agree with itself and prove nothing, which is exactly how the cent
 * rounding survived.
 *
 * ⚠ **KEYED ON THE RUNG'S ID, NEVER ITS DISPLAY NAME — #1928.** It was keyed on
 * `tier.name` until 2026-10-08, so his #1900 rename (Studio → Pro Plus) MOVED a
 * lookup key on a money guard. A display name is a thing the founder renames; an
 * id is not, and the ids are also the stem of the very lookup keys these amounts
 * were read by, so an id-keyed table is strictly more faithful to its own
 * provenance. The `=== undefined` arm below stops being a rename alarm and
 * becomes a COVERAGE alarm, which is the thing actually worth guarding.
 *
 * ⚠ **ONE DECLARATION, read by both the positive arm and the negative control.**
 * It was typed out TWICE, identically, in the two arms below — working law 4's
 * mirror on the numbers that charge a card, and the second copy is where a
 * re-keying slip would have hidden. The negative control must compare the
 * superseded arithmetic against the SAME amounts the shipped arithmetic is
 * compared against, or it measures nothing.
 */
const STRIPE_YEARLY_UNIT_AMOUNTS: Record<string, number> = {
  starter: 26_900,
  pro: 67_700,
  studio: 158_400,
  business: 836_600,
  scale: 4_780_800,
  enterprise: 14_940_000,
  ultimate: 47_808_000,
};

/** The paid rungs by their STABLE ID; declaration order is ladder order. */
const PAID_RUNG_IDS = (Object.keys(PLAN_TIERS) as PlanTier[]).filter(
  (id) => PLAN_TIERS[id].price > 0,
);

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

      The expectations are Stripe's own `unit_amount`s, read off the account —
      the file-level `STRIPE_YEARLY_UNIT_AMOUNTS` above carries their provenance
      and the reason they are keyed on the rung's ID (#1928).

      ⚠ **THE MONTHLY SIDE IS READ FROM `PLAN_TIERS`, NEVER TYPED.** A price
      edit must redden this arm rather than slide past it: if a monthly price
      moves, the Stripe object has to move with it, and that is the finding.
    */
    expect(PAID_RUNG_IDS.length, "no paid rungs found — the reader is broken").toBe(7);

    const unpriced = PAID_RUNG_IDS.filter((id) => STRIPE_YEARLY_UNIT_AMOUNTS[id] === undefined);
    expect(
      unpriced,
      "a paid rung has no yearly price recorded from Stripe — read the account before shipping it",
    ).toEqual([]);

    for (const id of PAID_RUNG_IDS) {
      const tier = PLAN_TIERS[id];
      expect(
        annualPriceInCents(tier.price),
        `${tier.name} (rung \`${id}\`): yearly price is not the amount Stripe would charge`,
      ).toBe(STRIPE_YEARLY_UNIT_AMOUNTS[id]);
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

    /* ⚠ THE RUNGS ARE NAMED BY ID, so this measurement cannot be moved by a
       rename either — it read `["Starter", "Pro", "Pro Plus", "Business"]`
       until 2026-10-08, and the third of those four had already been edited
       once by #1900 for no reason but a display name (#1928). */
    const disagreed = PAID_RUNG_IDS.filter(
      (id) => centRounded(PLAN_TIERS[id].price) !== STRIPE_YEARLY_UNIT_AMOUNTS[id],
    );

    expect(
      disagreed,
      "the superseded cent rounding no longer disagrees with Stripe where it was measured to",
    ).toEqual(["starter", "pro", "studio", "business"]);
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
    /* ⚠ **THE `price_data` HALF READS THE TWO CHECKOUT BUILDERS, NOT THE FILE
       (#1965).** It read the whole module, and the module now holds ONE
       deliberate inline price that is not a checkout amount at all: the spent
       share of an interval switch, charged on the switch's own invoice through
       `add_invoice_items` (`updateSubscriptionPlan`). That figure is a
       proration — computed by definition, the way Stripe's own proration lines
       are — and no catalogue price can carry it. Its wire is pinned by
       `server/stripe/planChangeSpentShareAndStates.test.ts`. The checkout
       builders this arm is about are sliced out, so a `price_data` coming back
       to EITHER of them still reddens here, which is the arm's whole subject. */
    const checkoutBuilders = sourceBand(
      service,
      "export async function createSubscriptionCheckoutSession(",
      "export async function createCustomerPortalSession(",
      "the two checkout builders",
    );
    expect(checkoutBuilders, "an inline price_data came back to checkout").not.toContain("price_data");
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
