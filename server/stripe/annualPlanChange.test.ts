/**
 * THE ANNUAL PLAN-CHANGE WIRE (#664) — working law 5: contracts about what
 * gets sent are proven on the OUTGOING REQUEST, not on a constant near it.
 *
 * The Stripe SDK is doubled at the module boundary, and every arm asserts the
 * parameters `updateSubscriptionPlan` actually passed: the minted price's
 * amount and recurring interval, `always_invoice`, and the metadata parity
 * with checkout. The monthly arm is the annual arm's negative control — the
 * same call shape with the other interval, so a hardcoded "year" cannot pass
 * both.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { pricesCreate, subscriptionsUpdate, subscriptionsRetrieve, invoicesRetrieve } =
  vi.hoisted(() => ({
    pricesCreate: vi.fn(),
    subscriptionsUpdate: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    invoicesRetrieve: vi.fn(),
  }));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: pricesCreate };
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
import { annualPriceInCents } from "@shared/annualBilling";

beforeEach(() => {
  pricesCreate.mockReset().mockResolvedValue({ id: "price_minted" });
  subscriptionsUpdate.mockReset().mockResolvedValue({ latest_invoice: "in_change" });
  subscriptionsRetrieve.mockReset();
  invoicesRetrieve.mockReset().mockResolvedValue({ amount_due: 123_45 });
});

describe("updateSubscriptionPlan — the outgoing request", () => {
  it("the ANNUAL leg mints a yearly price at the shared arithmetic's amount", async () => {
    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1");
    expect(result.success).toBe(true);

    expect(pricesCreate).toHaveBeenCalledTimes(1);
    const priceArgs = pricesCreate.mock.calls[0][0];
    expect(priceArgs.unit_amount).toBe(annualPriceInCents(SUBSCRIPTION_PRODUCTS.pro.priceInCents));
    expect(priceArgs.recurring).toEqual({ interval: "year" });
    expect(priceArgs.product_data.name).toBe(`${SUBSCRIPTION_PRODUCTS.pro.name} (Annual)`);

    const [subId, updateArgs] = subscriptionsUpdate.mock.calls[0];
    expect(subId).toBe("sub_1");
    expect(updateArgs.items).toEqual([{ id: "si_1", price: "price_minted" }]);
    expect(updateArgs.proration_behavior).toBe("always_invoice");
    expect(updateArgs.metadata.plan).toBe("pro");
    expect(updateArgs.metadata.interval).toBe("annual");
    expect(updateArgs.metadata.userId).toBe("7");

    /* The item id was supplied, so nothing re-fetched the subscription. */
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it("the MONTHLY leg is the negative control — month interval, month amount, no suffix", async () => {
    await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_1");
    const priceArgs = pricesCreate.mock.calls[0][0];
    expect(priceArgs.unit_amount).toBe(SUBSCRIPTION_PRODUCTS.pro.priceInCents);
    expect(priceArgs.recurring).toEqual({ interval: "month" });
    expect(priceArgs.product_data.name).toBe(SUBSCRIPTION_PRODUCTS.pro.name);
    expect(subscriptionsUpdate.mock.calls[0][1].metadata.interval).toBe("monthly");
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
