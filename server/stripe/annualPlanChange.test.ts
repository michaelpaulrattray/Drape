/**
 * THE ANNUAL PLAN-CHANGE WIRE (#664) — working law 5: contracts about what
 * gets sent are proven on the OUTGOING REQUEST, not on a constant near it.
 *
 * The Stripe SDK is doubled at the module boundary, and every arm asserts the
 * parameters `updateSubscriptionPlan` actually passed: the price on the item,
 * `always_invoice`, and the metadata parity with checkout. The monthly arm is
 * the annual arm's negative control — the same call shape with the other
 * interval, so a hardcoded "year" cannot pass both.
 *
 * ⚠ **WHAT THE ARMS READ CHANGED ON 2026-10-02, AND THE CONTRACT IS NOW THE
 * OPPOSITE OF WHAT IT WAS (#1605 bullet 1).** This path used to MINT a price
 * on every plan change (`stripe.prices.create`), so the arms read the minted
 * price's `unit_amount` and its composed name — asserting that this repository
 * computed the right figure. The price is now an object in Stripe's catalogue
 * found by its lookup key, so the arms assert that **nothing is minted at all**
 * and that the item carries the resolved existing id.
 *
 * The amount has not stopped mattering; it moved. `resolvePriceId` refuses a
 * key whose `unit_amount` is not the figure this product's screens show, and
 * `stripePriceCatalogue.test.ts` drives that refusal directly — so the arm
 * that used to live here as `expect(priceArgs.unit_amount).toBe(…)` is a
 * refusal inside the resolver, where a wrong amount stops the change instead
 * of being charged.
 *
 * ⚠ **`pricesCreate` is still doubled, and it is an ASSERTION now rather than
 * a fixture.** A later edit reaching for `prices.create` again — the obvious
 * repair if a key is ever missing, and the exact *"silent fallback to inline
 * pricing"* the card forbids — reddens three arms by name.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { pricesCreate, pricesList, subscriptionsUpdate, subscriptionsRetrieve, invoicesRetrieve } =
  vi.hoisted(() => ({
    pricesCreate: vi.fn(),
    pricesList: vi.fn(),
    subscriptionsUpdate: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    invoicesRetrieve: vi.fn(),
  }));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: pricesCreate, list: pricesList };
    subscriptions = { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate };
    invoices = { retrieve: invoicesRetrieve };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

import {
  updateSubscriptionPlan,
  readSubscriptionBillingState,
} from "./stripeService";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import { priceLookupKey, StripePriceUnavailableError } from "./stripePriceCatalogue";
import { periodPriceInCents } from "@shared/annualBilling";

/** The catalogue's answer for a plan at an interval, as Stripe returns it. */
function catalogueHolds(plan: string, interval: "monthly" | "annual") {
  pricesList.mockResolvedValue({
    data: [
      {
        id: `price_catalogue_${interval}`,
        lookup_key: priceLookupKey(plan, interval),
        unit_amount: periodPriceInCents(SUBSCRIPTION_PRODUCTS[plan].priceInCents, interval),
        recurring: { interval: interval === "annual" ? "year" : "month" },
      },
    ],
  });
}

beforeEach(() => {
  pricesCreate.mockReset().mockResolvedValue({ id: "price_minted" });
  pricesList.mockReset();
  catalogueHolds("pro", "annual");
  subscriptionsUpdate.mockReset().mockResolvedValue({ latest_invoice: "in_change" });
  subscriptionsRetrieve.mockReset();
  invoicesRetrieve.mockReset().mockResolvedValue({ amount_due: 123_45 });
});

describe("updateSubscriptionPlan — the outgoing request", () => {
  it("the ANNUAL leg sends the catalogue's yearly price and mints nothing", async () => {
    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1");
    expect(result.success).toBe(true);

    /* The whole point of bullet 1: no price is created for this change. */
    expect(pricesCreate).not.toHaveBeenCalled();
    expect(pricesList.mock.calls[0][0].lookup_keys).toEqual(["klieg_pro_yearly_v2"]);

    const [subId, updateArgs] = subscriptionsUpdate.mock.calls[0];
    expect(subId).toBe("sub_1");
    expect(updateArgs.items).toEqual([{ id: "si_1", price: "price_catalogue_annual" }]);
    expect(updateArgs.proration_behavior).toBe("always_invoice");
    expect(updateArgs.metadata.plan).toBe("pro");
    expect(updateArgs.metadata.interval).toBe("annual");
    expect(updateArgs.metadata.userId).toBe("7");

    /* The item id was supplied, so nothing re-fetched the subscription. */
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it("the MONTHLY leg is the negative control — the other key, the other price", async () => {
    catalogueHolds("pro", "monthly");
    await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_1");
    expect(pricesCreate).not.toHaveBeenCalled();
    expect(pricesList.mock.calls[0][0].lookup_keys).toEqual(["klieg_pro_monthly_v2"]);
    expect(subscriptionsUpdate.mock.calls[0][1].items).toEqual([
      { id: "si_1", price: "price_catalogue_monthly" },
    ]);
    expect(subscriptionsUpdate.mock.calls[0][1].metadata.interval).toBe("monthly");
  });

  it("a missing key refuses: the subscription is never touched and no price is minted", async () => {
    /* The card's rule at this path - never a silent fallback to inline
       pricing. `prices.create` is the fallback that would exist if anybody
       added one, so its silence is an assertion. And this is the ONE failure
       this function throws rather than reporting, because nothing was
       attempted; the route turns it into the authored sentence. */
    pricesList.mockResolvedValue({ data: [] });
    const refusal = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1").then(
      (r) => ({ returnedInsteadOfThrowing: r }) as unknown,
      (e: unknown) => e,
    );
    expect(refusal).toBeInstanceOf(StripePriceUnavailableError);
    expect((refusal as StripePriceUnavailableError).lookupKey).toBe("klieg_pro_yearly_v2");
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  it("an ordinary Stripe failure still REPORTS rather than throwing", async () => {
    /* Without this, "the price refusal throws" would be indistinguishable from
       "this function throws on everything", and the route's `success: false`
       road would be dead code nobody noticed. */
    subscriptionsUpdate.mockRejectedValueOnce(new Error("card_declined"));
    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("card_declined");
  });

  it("reads what Stripe actually invoiced off the change invoice", async () => {
    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1");
    expect(invoicesRetrieve).toHaveBeenCalledWith("in_change");
    expect(result.invoicedAmount).toBe(123_45);
  });

  it("an unreadable invoice degrades to null, never to a failure of the change itself", async () => {
    invoicesRetrieve.mockRejectedValueOnce(new Error("invoice not ready"));
    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1");
    expect(result.success).toBe(true);
    expect(result.invoicedAmount).toBeNull();
  });
});

describe("readSubscriptionBillingState — the artifact, not the metadata", () => {
  it("reads the interval off the item's PRICE and the plan off metadata", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { plan: "starter", interval: "monthly" /* stale, must be ignored */ },
      items: {
        data: [
          {
            id: "si_9",
            price: { recurring: { interval: "year" } },
            /* ⚠ ITEM-level periods — where this API version actually keeps
               them (Basil moved them off the subscription). Measured live:
               sub.current_period_end is undefined, the item's is real. */
            current_period_start: 1_760_000_000,
            current_period_end: 1_760_000_000 + 365 * 86_400,
          },
        ],
      },
    });
    const state = await readSubscriptionBillingState("sub_9");
    expect(state).not.toBeNull();
    /* metadata said monthly; the PRICE says year — the price wins. */
    expect(state!.currentInterval).toBe("annual");
    expect(state!.currentPlan).toBe("starter");
    expect(state!.subscriptionItemId).toBe("si_9");
    /* And the period is the ITEM's year — not the 30-day fallback the old
       sub-level read silently produced on this API version. */
    expect(state!.periodStartSec).toBe(1_760_000_000);
    expect(state!.periodEndSec).toBe(1_760_000_000 + 365 * 86_400);
  });

  it("⚠ a subscription-level period (older shapes) still reads when no item carries one", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { plan: "starter" },
      items: { data: [{ id: "si_9", price: { recurring: { interval: "month" } } }] },
      current_period_start: 1_700_000_000,
      current_period_end: 1_700_000_000 + 30 * 86_400,
    });
    const state = await readSubscriptionBillingState("sub_9");
    expect(state!.periodStartSec).toBe(1_700_000_000);
    expect(state!.periodEndSec).toBe(1_700_000_000 + 30 * 86_400);
  });

  it("refuses an interval this product does not sell rather than guessing monthly", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { plan: "starter" },
      items: { data: [{ id: "si_9", price: { recurring: { interval: "week" } } }] },
    });
    expect(await readSubscriptionBillingState("sub_9")).toBeNull();
  });

  it("refuses a plan the product no longer declares (#391's back door, same rule)", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      metadata: { plan: "starter_plus" },
      items: { data: [{ id: "si_9", price: { recurring: { interval: "month" } } }] },
    });
    expect(await readSubscriptionBillingState("sub_9")).toBeNull();
  });
});
