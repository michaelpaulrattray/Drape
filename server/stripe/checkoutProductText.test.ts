/**
 * NO CREDIT NUMBER LEAVES THIS PRODUCT AS STRIPE PRODUCT TEXT (#1605, P1-6) —
 * working law 5: a contract about what gets SENT is proven on the outgoing
 * request, never on a constant near it.
 *
 * The defect this closes was a sentence composed in `stripeProducts.ts` and
 * handed to Stripe as `product_data.description` on the checkout session:
 * `"200,000 credits/month with 75% rollover"` — a LEDGER amount, printed on
 * the one page in the flow this repository does not render, while every screen
 * the customer owns moves to the display scale (P1-1: display = ledger ÷ 5).
 *
 * # Why the arms are at the wire and not at the table
 *
 * Deleting the field from the table is the fix; asserting the table is not the
 * proof. `createSubscriptionCheckoutSession` builds `price_data` inline, so the
 * text it sends is assembled at the call rather than read from a constant — a
 * guard over the constant passes while a literal is interpolated two lines
 * later. So the Stripe SDK is doubled at the module boundary and these arms
 * read the object that was actually passed, for BOTH intervals, because the
 * annual leg composes its own name and is the place a second description would
 * most plausibly be added back.
 *
 * # The one arm that is not about this card
 *
 * `metadata.env` is asserted here beside the rest, because #1605's own body
 * says to KEEP stamping it (*"the webhook refuses untagged events"*) and a
 * commit that strips a field from this exact object is the commit most likely
 * to take it with it. It is a sibling-protection arm, not scope creep: one
 * reading of one outgoing object, asserting what must go and what must stay.
 *
 * # What is deliberately NOT asserted
 *
 * That the price is resolved from a `lookup_key`. That is this card's other
 * three bullets and they are gated on Stripe Price objects #1609 reserves for
 * his or the relay's hand; today's session still carries `price_data`, and an
 * arm pretending otherwise would be a claim rather than a reading.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { sessionsCreate } = vi.hoisted(() => ({ sessionsCreate: vi.fn() }));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    checkout = { sessions: { create: sessionsCreate, retrieve: vi.fn() } };
    prices = { create: vi.fn() };
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
import { annualPriceInCents } from "@shared/annualBilling";

beforeEach(() => {
  sessionsCreate.mockReset().mockResolvedValue({
    id: "cs_test",
    url: "https://checkout.stripe.test/cs_test",
  });
});

async function checkout(interval: "monthly" | "annual") {
  await createSubscriptionCheckoutSession("cus_1", "pro", "https://ok", "https://no", 7, interval);
  expect(sessionsCreate).toHaveBeenCalledTimes(1);
  const args = sessionsCreate.mock.calls[0][0];
  return { args, productData: args.line_items[0].price_data.product_data as Record<string, unknown> };
}

describe("the outgoing checkout session carries no composed credit number", () => {
  it("the MONTHLY leg sends product_data with a name and nothing else", async () => {
    const { productData } = await checkout("monthly");
    expect(productData).toEqual({ name: SUBSCRIPTION_PRODUCTS.pro.name });
    /* Asserted as well as implied by toEqual: the key itself is the defect,
       and `undefined` would satisfy a value check while still being sent. */
    expect("description" in productData).toBe(false);
  });

  it("the ANNUAL leg is the negative control — its own name, still no description", async () => {
    const { args, productData } = await checkout("annual");
    expect(productData).toEqual({ name: `${SUBSCRIPTION_PRODUCTS.pro.name} (Annual)` });
    expect("description" in productData).toBe(false);
    /* The interval really did differ, so the two arms are not one arm twice. */
    expect(args.line_items[0].price_data.recurring).toEqual({ interval: "year" });
    expect(args.line_items[0].price_data.unit_amount).toBe(
      annualPriceInCents(SUBSCRIPTION_PRODUCTS.pro.priceInCents),
    );
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
