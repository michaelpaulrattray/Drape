/**
 * THE LOOKUP-KEY RESOLVER, DRIVEN DIRECTLY (#1605 bullet 1) — working law 3:
 * a backstop needs a test the model cannot rescue, and the generalisation this
 * suite takes from it is that a refusal is driven at its own function rather
 * than through the two money paths that call it. `resolvePriceId` takes the
 * Stripe client as an argument precisely so these arms can hand it a plain
 * object and assert the refusal itself, not a service's behaviour around one.
 *
 * # The four refusals, and why each is here rather than assumed
 *
 * Each of them is a way for this product to charge a price nobody chose, and
 * exactly one of them is the card's own stated rule:
 *
 *   1 · **the key names nothing** — the card's rule, verbatim: *"A missing
 *       lookup key is a refusal … that names the key, never a silent fallback
 *       to inline pricing (invariant 7)."*
 *   2 · **two active prices claim the key** — Stripe does not enforce
 *       uniqueness across an archive-and-replace, and picking the first of two
 *       is picking an amount by list order.
 *   3 · **the price does not recur at the interval asked for** — the sibling
 *       of a defect this product has already shipped once (#664: a plan change
 *       minted an unconditionally MONTHLY price for an annual purchase).
 *   4 · **the amount is not the amount the page shows** — this card's headline
 *       sentence is a page saying one number above a charge that is another.
 *
 * ⚠ **Refusal 4 should never fire, and that is the argument for it.** Bullet 2
 * made the app's yearly figures whole dollars so they equal Stripe's by
 * construction, and all fourteen agreed when read in test mode on 2026-10-01.
 * What it guards is a price edited in the Stripe dashboard alone — after which
 * every screen in this product shows a figure that is not what the card is
 * charged, with nothing in either system looking wrong.
 *
 * # Where the fourteen keys in the first arm came from
 *
 * They are a READING, not a belief: `prices.list` against Stripe in test mode,
 * 2026-10-01, fourteen keys present and active, every `unit_amount` equal to
 * what `periodPriceInCents` computes (the table is on #1605). The arm pins the
 * composed keys against that reading, and derives its POPULATION from
 * `SUBSCRIPTION_PRODUCTS` so that a new rung reddens it instead of quietly
 * being a fifteenth key nobody ever asked Stripe for.
 */
import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  priceLookupKey,
  resolvePriceId,
  StripePriceUnavailableError,
  PRICE_LOOKUP_KEY_VERSION,
} from "./stripePriceCatalogue";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import { periodPriceInCents } from "@shared/annualBilling";

/** The fourteen keys read out of Stripe in test mode on 2026-10-01. */
const READ_FROM_STRIPE = [
  "klieg_starter_monthly_v2",
  "klieg_starter_yearly_v2",
  "klieg_pro_monthly_v2",
  "klieg_pro_yearly_v2",
  "klieg_studio_monthly_v2",
  "klieg_studio_yearly_v2",
  "klieg_business_monthly_v2",
  "klieg_business_yearly_v2",
  "klieg_scale_monthly_v2",
  "klieg_scale_yearly_v2",
  "klieg_enterprise_monthly_v2",
  "klieg_enterprise_yearly_v2",
  "klieg_ultimate_monthly_v2",
  "klieg_ultimate_yearly_v2",
];

/** A client whose `prices.list` returns exactly what an arm hands it. */
function clientReturning(data: Array<Partial<Stripe.Price>>) {
  const list = vi.fn().mockResolvedValue({ data });
  return { client: { prices: { list } } as unknown as Pick<Stripe, "prices">, list };
}

/** A well-formed active price for a plan/interval, as Stripe would return it. */
function priceFor(
  plan: string,
  interval: "monthly" | "annual",
  overrides: Partial<Stripe.Price> = {},
): Partial<Stripe.Price> {
  return {
    id: `price_${plan}_${interval}`,
    lookup_key: priceLookupKey(plan, interval),
    unit_amount: periodPriceInCents(SUBSCRIPTION_PRODUCTS[plan].priceInCents, interval),
    recurring: { interval: interval === "annual" ? "year" : "month" } as Stripe.Price.Recurring,
    ...overrides,
  };
}

describe("the key this product composes is the key Stripe actually holds", () => {
  it("composes exactly the fourteen keys that were read out of the catalogue", () => {
    const composed = Object.keys(SUBSCRIPTION_PRODUCTS).flatMap((plan) => [
      priceLookupKey(plan, "monthly"),
      priceLookupKey(plan, "annual"),
    ]);
    expect([...composed].sort()).toEqual([...READ_FROM_STRIPE].sort());
  });

  it("the population is the whole ladder, so a table that failed to build cannot pass", () => {
    /* An empty products table composes zero keys, and `[] === []` would read
       as agreement with the catalogue. */
    expect(Object.keys(SUBSCRIPTION_PRODUCTS).length).toBe(READ_FROM_STRIPE.length / 2);
    expect(Object.keys(SUBSCRIPTION_PRODUCTS).length).toBeGreaterThanOrEqual(7);
  });

  it("⚠ a year is `yearly` in the key and `annual` in this product — the trap, pinned", () => {
    expect(priceLookupKey("pro", "annual")).toBe("klieg_pro_yearly_v2");
    /* The positive control: the key the product's own word would have built,
       which exists nowhere in the catalogue. */
    expect(priceLookupKey("pro", "annual")).not.toBe("klieg_pro_annual_v2");
    expect(READ_FROM_STRIPE).not.toContain("klieg_pro_annual_v2");
    expect(priceLookupKey("pro", "monthly")).toBe("klieg_pro_monthly_v2");
  });

  it("carries the catalogue generation, so a v3 cannot be half-rolled-out by a typo", () => {
    expect(PRICE_LOOKUP_KEY_VERSION).toBe("v2");
    expect(READ_FROM_STRIPE.every((k) => k.endsWith(`_${PRICE_LOOKUP_KEY_VERSION}`))).toBe(true);
  });
});

describe("resolvePriceId — the happy path asks Stripe the narrowest question", () => {
  it("returns the id of the one active price the key names", async () => {
    const { client, list } = clientReturning([priceFor("pro", "annual")]);
    await expect(resolvePriceId(client, "pro", "annual")).resolves.toBe("price_pro_annual");
    expect(list).toHaveBeenCalledWith({
      lookup_keys: ["klieg_pro_yearly_v2"],
      active: true,
      limit: 2,
    });
  });

  it("the monthly leg is the negative control — a different key, a different id", async () => {
    const { client, list } = clientReturning([priceFor("pro", "monthly")]);
    await expect(resolvePriceId(client, "pro", "monthly")).resolves.toBe("price_pro_monthly");
    expect(list.mock.calls[0][0].lookup_keys).toEqual(["klieg_pro_monthly_v2"]);
  });

  it("every rung at both intervals resolves, so no single rung stands in for the ladder", async () => {
    for (const plan of Object.keys(SUBSCRIPTION_PRODUCTS)) {
      for (const interval of ["monthly", "annual"] as const) {
        const { client } = clientReturning([priceFor(plan, interval)]);
        await expect(resolvePriceId(client, plan, interval)).resolves.toBe(
          `price_${plan}_${interval}`,
        );
      }
    }
  });
});

describe("resolvePriceId — the refusals, each naming the key", () => {
  /** Every refusal must be this error type AND carry the key as a field, not
   *  only inside a sentence: the call sites read `.lookupKey`. */
  async function refusalFor(
    data: Array<Partial<Stripe.Price>>,
    plan = "pro",
    interval: "monthly" | "annual" = "annual",
  ) {
    const { client } = clientReturning(data);
    const error = await resolvePriceId(client, plan, interval).then(
      (id) => ({ resolvedInsteadOfRefusing: id }) as unknown,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(StripePriceUnavailableError);
    return error as StripePriceUnavailableError;
  }

  it("1 · an absent key refuses and never returns a fallback price", async () => {
    const error = await refusalFor([]);
    expect(error.lookupKey).toBe("klieg_pro_yearly_v2");
    expect(error.message).toContain("klieg_pro_yearly_v2");
    expect(error.message).toMatch(/no active price/i);
  });

  it("2 · two active prices claiming one key refuses rather than taking the first", async () => {
    const error = await refusalFor([
      priceFor("pro", "annual", { id: "price_old" }),
      priceFor("pro", "annual", { id: "price_new" }),
    ]);
    expect(error.message).toContain("price_old");
    expect(error.message).toContain("price_new");
  });

  it("3 · a key whose price recurs monthly refuses an annual purchase (#664's sibling)", async () => {
    const error = await refusalFor([
      priceFor("pro", "annual", { recurring: { interval: "month" } as Stripe.Price.Recurring }),
    ]);
    expect(error.message).toMatch(/recurs month and not per year/);
  });

  it("3b · a one-off price with no recurrence refuses rather than reading as either", async () => {
    const error = await refusalFor([priceFor("pro", "annual", { recurring: null })]);
    expect(error.message).toMatch(/recurs not at all/);
  });

  it("4 · an amount that is not what the page shows refuses, naming both numbers", async () => {
    const shown = periodPriceInCents(SUBSCRIPTION_PRODUCTS.pro.priceInCents, "annual");
    const error = await refusalFor([priceFor("pro", "annual", { unit_amount: shown - 100 })]);
    expect(error.message).toContain(String(shown));
    expect(error.message).toContain(String(shown - 100));
  });

  it("a price with no lookup_key is not the answer to a question about one", async () => {
    /* Stripe is asked BY key, so this should be unreachable — which is why it
       is driven. A stub, a proxy or a future SDK returning a near-match would
       otherwise be accepted as the price to charge. */
    const error = await refusalFor([priceFor("pro", "annual", { lookup_key: null })]);
    expect(error.message).toMatch(/no active price/i);
  });

  it("a plan this product does not sell refuses by name, not by TypeError", async () => {
    const error = await refusalFor([], "starter_plus");
    expect(error.message).toContain("starter_plus");
    expect(error.message).toMatch(/no plan this product sells/);
  });

  it("the refusal is the only outcome — nothing resolves to undefined or empty", async () => {
    /* The shape that would make every arm above vacuous: a resolver that
       returned a falsy id instead of throwing. */
    const { client } = clientReturning([]);
    await expect(resolvePriceId(client, "pro", "annual")).rejects.toBeInstanceOf(
      StripePriceUnavailableError,
    );
  });
});
