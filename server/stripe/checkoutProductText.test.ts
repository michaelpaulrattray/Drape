/**
 * WHAT THE CHECKOUT SESSION ACTUALLY CARRIES (#1605, P1-6) — working law 5: a
 * contract about what gets SENT is proven on the outgoing request, never on a
 * constant near it.
 *
 * Two of this card's bullets end at this one object, and both are asserted
 * here on the arguments `stripe.checkout.sessions.create` was really passed:
 *
 *   **bullet 3 — no credit number leaves as Stripe product text.** The defect
 *   was a sentence composed in `stripeProducts.ts` and handed over as
 *   `product_data.description`: `"200,000 credits/month with 75% rollover"`, a
 *   LEDGER amount printed on the one page in the flow this repository does not
 *   render, while every screen the customer owns moved to the display scale
 *   (P1-1: display = ledger ÷ 5).
 *
 *   **bullet 1 — the price is Stripe's object, found by its lookup key.** The
 *   session used to carry an inline `price_data` whose `unit_amount` this
 *   process computed, so the charge was this tree's arithmetic and Stripe's
 *   catalogue was a parallel copy of the prices rather than the thing being
 *   charged.
 *
 * ⚠ **THE SECOND OF THOSE WAS THIS SUITE'S OWN "DELIBERATELY NOT ASSERTED"
 * SECTION UNTIL 2026-10-02, AND IT SAID WHY, HONESTLY: *"today's session still
 * carries `price_data`, and an arm pretending otherwise would be a claim
 * rather than a reading."*** It is a reading now. The fourteen
 * `klieg_<plan>_<interval>_v2` keys were read out of Stripe in test mode on
 * 2026-10-01 — present, active, every amount equal to what this product
 * computes — so the road exists and these arms drive it.
 *
 * # Why the Stripe double carries `prices.list`
 *
 * So the REAL resolver runs. Mocking `resolvePriceId` would assert that this
 * builder forwards whatever it is handed, which is not the contract; the
 * contract is that an id reaches the wire and an amount does not. The double
 * answers the key lookup and the arms read the session.
 *
 * # The arm that is not about either bullet
 *
 * `metadata.env` is asserted beside the rest because #1605's body says to KEEP
 * stamping it (*"the webhook refuses untagged events"*), and a commit that
 * rewrites this exact object is the commit most likely to take it along. It is
 * sibling protection, not scope creep: one reading of one outgoing object,
 * asserting what must go and what must stay.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { sessionsCreate, pricesList, pricesCreate } = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  pricesList: vi.fn(),
  pricesCreate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    checkout = { sessions: { create: sessionsCreate, retrieve: vi.fn() } };
    prices = { create: pricesCreate, list: pricesList };
    subscriptions = { retrieve: vi.fn(), update: vi.fn() };
    invoices = { retrieve: vi.fn() };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

import { createSubscriptionCheckoutSession } from "./stripeService";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import { priceLookupKey, StripePriceUnavailableError } from "./stripePriceCatalogue";
import { annualPriceInCents, periodPriceInCents } from "@shared/annualBilling";

/** The catalogue's answer for `pro` at one interval, as Stripe returns it. */
function catalogueHolds(interval: "monthly" | "annual") {
  pricesList.mockResolvedValue({
    data: [
      {
        id: `price_pro_${interval}`,
        lookup_key: priceLookupKey("pro", interval),
        unit_amount: periodPriceInCents(SUBSCRIPTION_PRODUCTS.pro.priceInCents, interval),
        recurring: { interval: interval === "annual" ? "year" : "month" },
      },
    ],
  });
}

beforeEach(() => {
  sessionsCreate.mockReset().mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.test/cs_test",
  });
  pricesList.mockReset();
  pricesCreate.mockReset();
});

async function checkout(interval: "monthly" | "annual") {
  catalogueHolds(interval);
  await createSubscriptionCheckoutSession("cus_1", "pro", "https://ok", "https://no", 7, interval);
  expect(sessionsCreate).toHaveBeenCalledTimes(1);
  return { args: sessionsCreate.mock.calls[0][0] };
}

describe("the outgoing session carries a price ID and no price of its own", () => {
  it("the MONTHLY leg sends the resolved price id as the whole line item", async () => {
    const { args } = await checkout("monthly");
    expect(args.line_items).toEqual([{ price: "price_pro_monthly", quantity: 1 }]);
    /* Asserted as well as implied by toEqual: the KEY is the defect, and
       `price_data: undefined` would satisfy a value check and still be sent. */
    expect("price_data" in args.line_items[0]).toBe(false);
    expect(pricesList.mock.calls[0][0].lookup_keys).toEqual(["klieg_pro_monthly_v2"]);
  });

  it("the ANNUAL leg is the negative control — the other key, the other id", async () => {
    const { args } = await checkout("annual");
    expect(args.line_items).toEqual([{ price: "price_pro_annual", quantity: 1 }]);
    expect("price_data" in args.line_items[0]).toBe(false);
    /* The interval really did differ, so the two arms are not one arm twice. */
    expect(pricesList.mock.calls[0][0].lookup_keys).toEqual(["klieg_pro_yearly_v2"]);
  });

  it("⚠ no AMOUNT reaches the wire at either interval, which is the point of the move", async () => {
    /* The two numbers that used to be sent. A `unit_amount` anywhere in this
       object means the charge is again this tree's arithmetic. */
    const monthly = SUBSCRIPTION_PRODUCTS.pro.priceInCents;
    const annual = annualPriceInCents(monthly);
    for (const interval of ["monthly", "annual"] as const) {
      sessionsCreate.mockClear();
      const { args } = await checkout(interval);
      const wire = JSON.stringify(args);
      expect(wire).not.toContain("unit_amount");
      expect(wire).not.toContain(String(monthly));
      expect(wire).not.toContain(String(annual));
    }
  });

  it("⚠ composes no product text at all — Stripe's own product carries the name", async () => {
    /* Bullet 3 deleted the description and left a composed NAME behind, which
       `stripeProducts.ts` records as owed to this bullet: *"no product text is
       composed in this repository at all"* once checkout resolves by key. */
    const { args } = await checkout("annual");
    expect(JSON.stringify(args)).not.toContain("product_data");
    expect(JSON.stringify(args)).not.toContain(SUBSCRIPTION_PRODUCTS.pro.name);
  });

  it("no string anywhere in the outgoing session says the word credit", async () => {
    /* The arm that does not depend on knowing WHERE a description would be
       re-added. `product_data.description` was one road; a `custom_text`, a
       line-item `description` or a session `description` are three more, and
       each would print the same ledger figure on the same page. */
    const { args } = await checkout("monthly");
    expect(JSON.stringify(args)).not.toMatch(/credit/i);
  });

  it("still stamps the environment metadata the webhook refuses events without", async () => {
    const { args } = await checkout("monthly");
    expect(args.metadata.env).toBeTruthy();
    expect(args.subscription_data.metadata.env).toBe(args.metadata.env);
    expect(args.metadata.userId).toBe("7");
    expect(args.metadata.plan).toBe("pro");
    expect(args.metadata.interval).toBe("monthly");
  });
});

describe("⚠ a missing lookup key refuses — it does not fall back to inline pricing", () => {
  /* The card's own rule, and invariant 7: *"A missing lookup key is a refusal
     at boot or at checkout that names the key, never a silent fallback to
     inline pricing."* The refusal fires at CHECKOUT rather than at boot
     deliberately — a boot guard on a missing key crash-loops the service,
     which this repository has paid for once (2026-07-31). */

  it("nothing is created at all — the session call is never made", async () => {
    pricesList.mockResolvedValue({ data: [] });
    await expect(
      createSubscriptionCheckoutSession("cus_1", "pro", "https://ok", "https://no", 7, "annual"),
    ).rejects.toBeInstanceOf(StripePriceUnavailableError);

    /* The distinction that matters: not "a session that failed", but no
       session attempted — and above all no price minted to stand in for the
       missing one. */
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  it("the refusal names the key, so the repair is one read in Stripe", async () => {
    pricesList.mockResolvedValue({ data: [] });
    const error = await createSubscriptionCheckoutSession(
      "cus_1",
      "pro",
      "https://ok",
      "https://no",
      7,
      "annual",
    ).catch((e: unknown) => e as StripePriceUnavailableError);
    expect(error).toBeInstanceOf(StripePriceUnavailableError);
    expect((error as StripePriceUnavailableError).lookupKey).toBe("klieg_pro_yearly_v2");
    expect((error as StripePriceUnavailableError).message).toContain("klieg_pro_yearly_v2");
  });

  it("the positive control: with the key present the same call reaches the wire", async () => {
    /* Without this, every arm above would pass against a builder that always
       threw — including one broken for an unrelated reason. */
    const { args } = await checkout("annual");
    expect(args.line_items[0].price).toBe("price_pro_annual");
  });
});

describe("the table it reads from states no credit figure either", () => {
  it("no rung carries a description, and no feature line says credits", () => {
    const withDescription = Object.entries(SUBSCRIPTION_PRODUCTS)
      .filter(([, product]) => "description" in product)
      .map(([rung]) => rung);
    expect(withDescription).toEqual([]);

    /* ⚠ A PERCENTAGE IS NOT AN AMOUNT, and the first draft of this arm
       indicted all seven rungs for saying "75% unused credit rollover" — a
       RATE, which is scale-free and reads the same at either scale. What P1-1
       is about is a figure that must be divided by five, so the rule strips
       `<n>%` first and then looks for a surviving digit beside the word. An
       arm that refuses correct copy gets deleted rather than fixed. */
    const numeric = Object.entries(SUBSCRIPTION_PRODUCTS).flatMap(([rung, product]) =>
      product.features
        .filter((line) => /credits?\b/i.test(line) && /\d/.test(line.replace(/\d+(\.\d+)?\s*%/g, "")))
        .map((line) => `${rung}: ${line}`),
    );
    expect(numeric).toEqual([]);

    /* The positive control for the line above: the shape that was there until
       this card, run through the same filter. */
    const wasThere = "200,000 credits per month";
    expect(/credits?\b/i.test(wasThere) && /\d/.test(wasThere.replace(/\d+(\.\d+)?\s*%/g, ""))).toBe(true);
  });

  it("the population is the whole ladder, so an empty read cannot pass as a clean one", () => {
    /* A table that failed to build reports zero rungs, which is byte-identical
       to a table with no credit text in it. */
    expect(Object.keys(SUBSCRIPTION_PRODUCTS).length).toBeGreaterThanOrEqual(7);
    expect(Object.values(SUBSCRIPTION_PRODUCTS).every((p) => p.features.length > 0)).toBe(true);
  });
});
