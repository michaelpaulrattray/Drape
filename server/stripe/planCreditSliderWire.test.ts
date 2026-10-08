/**
 * WHAT THE CREDIT SLIDER ACTUALLY SENDS AND WHAT IT ACTUALLY GRANTS (#1832) —
 * working law 5: a contract about what gets SENT is proven on the outgoing
 * request, never on a constant near it.
 *
 * `server/planCreditSlider.test.ts` holds the dial's shape — his $9, the
 * derived ceiling, the three safety properties and the four refusals. This
 * suite holds the three places the dial becomes money, and every one of them
 * is read off a real outgoing call or a real grant figure:
 *
 *  1 · **the checkout session** carries a SECOND line item at the add-on's own
 *      price id with `quantity: steps`. One line and the customer is charged
 *      for a plan they did not pick; an amount on the wire and the charge is
 *      this tree's arithmetic again (#1605).
 *  2 · **the plan change** moves BOTH subscription items in ONE
 *      `subscriptions.update`. Two updates would be two prorations and two
 *      invoices for one action the customer was quoted one figure for, with
 *      the second able to fail after the first was charged.
 *  3 · **the renewal grant** is `base + steps`, sized off the subscription's
 *      own add-on quantity. A grant of `base` alone is a customer paying for
 *      an allowance they never receive, every month, silently.
 *
 * ⚠ **AND THE ONE THAT IS NOT ABOUT THE SLIDER AT ALL: `items.data[0]` STOPS
 * MEANING "THE PLAN" THE MOMENT A SUBSCRIPTION HAS TWO LINES.** Three readers
 * in this module family took that index — the interval, the item id a plan
 * change re-prices, and the period. `subscriptionItemsOf` is the split, and the
 * arms below drive it with the add-on FIRST in the array, because Stripe
 * promises no order and the defect is invisible when the plan happens to come
 * back first.
 *
 * The harness is `topupCheckoutWire.test.ts`'s: the Stripe double carries
 * `prices.list` so the REAL resolver runs, because mocking the resolver would
 * assert that a builder forwards what it is handed, which is not the contract.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { sessionsCreate, pricesList, subscriptionsRetrieve, subscriptionsUpdate, invoicesRetrieve } =
  vi.hoisted(() => ({
    sessionsCreate: vi.fn(),
    pricesList: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    subscriptionsUpdate: vi.fn(),
    invoicesRetrieve: vi.fn(),
  }));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    checkout = { sessions: { create: sessionsCreate, retrieve: vi.fn() } };
    prices = { create: vi.fn(), list: pricesList };
    subscriptions = { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate };
    invoices = { retrieve: invoicesRetrieve };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

import {
  createSubscriptionCheckoutSession,
  quotePlanChange,
  readSubscriptionBillingState,
  subscriptionItemsOf,
  updateSubscriptionPlan,
  type SubscriptionBillingState,
} from "./stripeService";
import { planCreditsPriceLookupKey, priceLookupKey } from "./stripePriceCatalogue";
import {
  PLAN_CREDIT_SLIDER_MAX_UNITS,
  PLAN_CREDIT_SLIDER_PLAN,
} from "./planCreditSlider";
import {
  PLAN_CREDIT_SLIDER_CENTS_PER_UNIT,
  planCreditSliderLedgerCredits,
  planCreditSliderPriceInCents,
} from "@shared/planCreditSlider";
import { periodPriceInCents } from "@shared/annualBilling";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";

/** The dial's rung, refused rather than defaulted — see the sibling suite. */
const PLAN = (() => {
  if (PLAN_CREDIT_SLIDER_PLAN === null) {
    throw new Error("no rung carries the dial, so this whole suite would assert nothing");
  }
  return PLAN_CREDIT_SLIDER_PLAN as PlanTier;
})();

const BASE_PRICE_ID = "price_plan_base";
const ADDON_PRICE_ID = "price_plan_addon";

/**
 * The catalogue holding every plan's base price and the dial's add-on, at the
 * REAL amounts — so the real resolvers return and all four of their refusals
 * stay live. Keyed by composing the same keys the resolvers compose, so a key
 * this harness does not know about comes back ABSENT rather than satisfied by
 * a catch-all, which is what keeps the "asked for the right key" arms honest.
 */
function catalogueHoldsBoth(interval: "monthly" | "annual") {
  const stripeInterval = interval === "annual" ? "year" : "month";
  const shelf = new Map<string, Record<string, unknown>>();
  for (const plan of Object.keys(SUBSCRIPTION_PRODUCTS)) {
    shelf.set(priceLookupKey(plan as never, interval), {
      id: plan === PLAN ? BASE_PRICE_ID : `price_${plan}_base`,
      lookup_key: priceLookupKey(plan as never, interval),
      unit_amount: periodPriceInCents(SUBSCRIPTION_PRODUCTS[plan].priceInCents, interval),
      recurring: { interval: stripeInterval },
    });
  }
  shelf.set(planCreditsPriceLookupKey(PLAN as never, interval), {
    id: ADDON_PRICE_ID,
    lookup_key: planCreditsPriceLookupKey(PLAN as never, interval),
    unit_amount: planCreditSliderPriceInCents(1, interval),
    recurring: { interval: stripeInterval },
  });
  pricesList.mockImplementation(async ({ lookup_keys }: { lookup_keys: string[] }) => {
    const row = shelf.get(lookup_keys[0]);
    return { data: row ? [row] : [] };
  });
}

function sentSession(): Record<string, any> {
  expect(sessionsCreate).toHaveBeenCalledTimes(1);
  return sessionsCreate.mock.calls[0][0] as Record<string, any>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout" });
  subscriptionsUpdate.mockResolvedValue({ latest_invoice: null });
});

describe("1 · the checkout session carries the dial as a second line item", () => {
  it("⚠ a plain plan sends ONE line, so every rung without a dial is untouched", async () => {
    catalogueHoldsBoth("monthly");
    await createSubscriptionCheckoutSession(
      "cus_1",
      "pro" as never,
      "https://ok",
      "https://no",
      7,
      "monthly",
      0,
    );
    const session = sentSession();
    expect(session.line_items).toHaveLength(1);
    /* And the add-on's key was never even asked for — a plain plan makes no
       second catalogue read, which is what keeps its latency where it was. */
    for (const call of pricesList.mock.calls) {
      expect(call[0].lookup_keys[0]).not.toMatch(/_credits_/);
    }
  });

  it("the dial's steps become a second line at the add-on's own price id", async () => {
    catalogueHoldsBoth("monthly");
    await createSubscriptionCheckoutSession(
      "cus_1",
      PLAN as never,
      "https://ok",
      "https://no",
      7,
      "monthly",
      34,
    );
    const session = sentSession();
    expect(session.line_items).toEqual([
      { price: BASE_PRICE_ID, quantity: 1 },
      { price: ADDON_PRICE_ID, quantity: 34 },
    ]);
    /* The id came from the key, which is what the catalogue was asked for. */
    expect(pricesList.mock.calls.map((call) => call[0].lookup_keys[0])).toContain(
      planCreditsPriceLookupKey(PLAN as never, "monthly"),
    );
  });

  it("⚠ NO AMOUNT REACHES THE WIRE — the dial's money is Stripe's object", async () => {
    catalogueHoldsBoth("annual");
    await createSubscriptionCheckoutSession(
      "cus_1",
      PLAN as never,
      "https://ok",
      "https://no",
      7,
      "annual",
      12,
    );
    const wire = JSON.stringify(sentSession());
    expect(wire).not.toContain("unit_amount");
    expect(wire).not.toContain("price_data");
    /* The three numbers that must not be composed into this object: one step's
       price at either interval, and the whole order's. */
    for (const amount of [
      PLAN_CREDIT_SLIDER_CENTS_PER_UNIT,
      planCreditSliderPriceInCents(1, "annual"),
      planCreditSliderPriceInCents(12, "annual"),
    ]) {
      expect(wire, `${amount} cents is composed onto the wire`).not.toContain(String(amount));
    }
  });

  it("⚠ and no credits FIGURE is on it either, which an existing guard found", async () => {
    /*
      `checkoutProductText.test.ts`'s broad arm — *no string anywhere in the
      outgoing session says the word credit* — went red on a `creditUnits`
      metadata key written here first. It was removed rather than the arm
      weakened, and for a better reason than the arm gives: the add-on LINE
      ITEM carries the quantity, which is the artifact that bills and the one
      every reader here consults, so a metadata copy was a mirror of a number
      Stripe owns with nothing to keep it true (working law 4).

      This arm is the one that keeps it gone on the DIAL'S road specifically —
      the sibling arm drives a plain Pro checkout and would stay green if a
      step count came back only when the dial is non-zero.
    */
    catalogueHoldsBoth("monthly");
    await createSubscriptionCheckoutSession(
      "cus_1",
      PLAN as never,
      "https://ok",
      "https://no",
      7,
      "monthly",
      34,
    );
    const wire = JSON.stringify(sentSession());
    expect(wire).not.toMatch(/credit/i);
    /* The ledger figure the steps are worth, in case a future writer reaches
       for it directly rather than for the word. */
    expect(wire).not.toContain(String(planCreditSliderLedgerCredits(34)));
  });

  it("a step count the rung does not sell refuses before any session is minted", async () => {
    catalogueHoldsBoth("monthly");
    await expect(
      createSubscriptionCheckoutSession(
        "cus_1",
        PLAN as never,
        "https://ok",
        "https://no",
        7,
        "monthly",
        PLAN_CREDIT_SLIDER_MAX_UNITS + 1,
      ),
    ).rejects.toThrow(/not between 1 and/);
    expect(sessionsCreate, "a session was minted for a dial this product does not sell").not
      .toHaveBeenCalled();
  });
});

describe("2 · the base item and the add-on are told apart, whatever order Stripe returns", () => {
  /** A subscription carrying both lines, ADD-ON FIRST on purpose. */
  const twoItemSubscription = (steps: number, interval: "month" | "year" = "month") => ({
    id: "sub_1",
    metadata: { plan: PLAN },
    items: {
      data: [
        {
          id: "si_addon",
          quantity: steps,
          price: {
            id: ADDON_PRICE_ID,
            lookup_key: planCreditsPriceLookupKey(
              PLAN as never,
              interval === "year" ? "annual" : "monthly",
            ),
            recurring: { interval },
          },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
        {
          id: "si_base",
          quantity: 1,
          price: {
            id: BASE_PRICE_ID,
            lookup_key: priceLookupKey(PLAN as never, interval === "year" ? "annual" : "monthly"),
            recurring: { interval },
          },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
      ],
    },
  });

  it("⚠ THE SPLIT IS BY LOOKUP KEY, NOT BY INDEX — the add-on sitting first proves it", () => {
    const { base, addon } = subscriptionItemsOf(twoItemSubscription(9));
    expect(base?.id, "the first item was taken as the plan, and it is the add-on").toBe("si_base");
    expect(addon?.id).toBe("si_addon");
    expect(addon?.quantity).toBe(9);
  });

  it("a subscription with no add-on answers the one item and a null — every one today", () => {
    const { base, addon } = subscriptionItemsOf({
      items: {
        data: [
          { id: "si_only", price: { lookup_key: priceLookupKey("pro" as never, "monthly") } },
        ],
      },
    });
    expect(base?.id).toBe("si_only");
    expect(addon).toBeNull();
  });

  it("⚠ an item whose price has NO lookup key reads as the base, which is conservative", () => {
    /*
      Every price this product charges on comes from the catalogue by key since
      #1605 — but a subscription created before that, or from a hand-sold link,
      carries an ad-hoc price with `lookup_key: null`. Reading it as the base is
      what keeps its plan change working; the add-on is only ever recognised
      POSITIVELY.
    */
    const { base, addon } = subscriptionItemsOf({
      items: { data: [{ id: "si_legacy", price: { lookup_key: null } }] },
    });
    expect(base?.id).toBe("si_legacy");
    expect(addon).toBeNull();
  });

  it("the billing state reads the dial off the add-on's own quantity", async () => {
    subscriptionsRetrieve.mockResolvedValue(twoItemSubscription(21));
    const state = await readSubscriptionBillingState("sub_1");
    expect(state).not.toBeNull();
    expect(state?.subscriptionItemId, "the quote would re-price the add-on").toBe("si_base");
    expect(state?.currentCreditUnits).toBe(21);
    expect(state?.creditItemId).toBe("si_addon");
    expect(state?.currentInterval).toBe("monthly");
  });

  it("a subscription with no add-on reads 0 steps and no item to move", async () => {
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_2",
      metadata: { plan: "pro" },
      items: {
        data: [
          {
            id: "si_only",
            price: {
              lookup_key: priceLookupKey("pro" as never, "monthly"),
              recurring: { interval: "month" },
            },
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_592_000,
          },
        ],
      },
    });
    const state = await readSubscriptionBillingState("sub_2");
    expect(state?.currentCreditUnits).toBe(0);
    expect(state?.creditItemId).toBeNull();
  });
});

describe("3 · the plan change moves both items in ONE update", () => {
  const state = (over: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState => ({
    subscriptionItemId: "si_base",
    currentPlan: PLAN as never,
    currentInterval: "monthly",
    periodStartSec: 1_700_000_000,
    periodEndSec: 1_702_592_000,
    currentCreditUnits: 0,
    creditItemId: null,
    cancelAtPeriodEnd: false,
    ...over,
  });

  it("adding steps to a plan that has none sends a NEW item beside the re-priced base", async () => {
    catalogueHoldsBoth("monthly");
    await updateSubscriptionPlan("sub_1", PLAN as never, 7, "monthly", "si_base", {
      targetCreditUnits: 5,
      creditItemId: null,
    });
    expect(subscriptionsUpdate, "two updates is two prorations for one action").toHaveBeenCalledTimes(
      1,
    );
    expect(subscriptionsUpdate.mock.calls[0][1].items).toEqual([
      { id: "si_base", price: BASE_PRICE_ID },
      { price: ADDON_PRICE_ID, quantity: 5 },
    ]);
  });

  it("moving the dial on a plan that has one re-prices the EXISTING item", async () => {
    catalogueHoldsBoth("monthly");
    await updateSubscriptionPlan("sub_1", PLAN as never, 7, "monthly", "si_base", {
      targetCreditUnits: 40,
      creditItemId: "si_addon",
    });
    expect(subscriptionsUpdate.mock.calls[0][1].items).toEqual([
      { id: "si_base", price: BASE_PRICE_ID },
      { id: "si_addon", price: ADDON_PRICE_ID, quantity: 40 },
    ]);
  });

  it("⚠ the dial back at zero DELETES the line rather than leaving quantity 0", async () => {
    catalogueHoldsBoth("monthly");
    await updateSubscriptionPlan("sub_1", PLAN as never, 7, "monthly", "si_base", {
      targetCreditUnits: 0,
      creditItemId: "si_addon",
    });
    expect(subscriptionsUpdate.mock.calls[0][1].items).toEqual([
      { id: "si_base", price: BASE_PRICE_ID },
      { id: "si_addon", deleted: true },
    ]);
  });

  it("⚠ AN INTERVAL SWITCH RE-PRICES THE ADD-ON TOO — the two are different objects", async () => {
    /*
      The monthly and yearly add-ons are two Stripe prices. Leaving the monthly
      one on a subscription that just became annual would bill $9 a month
      beside a yearly plan, which is a charge nothing on any screen states.
    */
    catalogueHoldsBoth("annual");
    await updateSubscriptionPlan("sub_1", PLAN as never, 7, "annual", "si_base", {
      targetCreditUnits: 3,
      creditItemId: "si_addon",
    });
    const asked = pricesList.mock.calls.map((call) => call[0].lookup_keys[0]);
    expect(asked).toContain(planCreditsPriceLookupKey(PLAN as never, "annual"));
    expect(asked).not.toContain(planCreditsPriceLookupKey(PLAN as never, "monthly"));
  });

  it("a caller that passes no dial leaves the items exactly as they were", async () => {
    catalogueHoldsBoth("monthly");
    await updateSubscriptionPlan("sub_1", "pro" as never, 7, "monthly", "si_base");
    expect(subscriptionsUpdate.mock.calls[0][1].items).toHaveLength(1);
  });

  it("⚠ the base item is found by KEY when the caller passes none", async () => {
    /* The add-on sits first in the array, so `data[0]` would re-price the $9
       line to the plan's price and make it the customer's whole bill. */
    catalogueHoldsBoth("monthly");
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_1",
      metadata: { plan: PLAN },
      items: {
        data: [
          {
            id: "si_addon",
            quantity: 4,
            price: { lookup_key: planCreditsPriceLookupKey(PLAN as never, "monthly") },
          },
          { id: "si_base", price: { lookup_key: priceLookupKey(PLAN as never, "monthly") } },
        ],
      },
    });
    await updateSubscriptionPlan("sub_1", PLAN as never, 7, "monthly");
    expect(subscriptionsUpdate.mock.calls[0][1].items[0].id).toBe("si_base");
  });
});

describe("4 · the quote prices the dial, in money and in credits", () => {
  const base = (over: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState => ({
    subscriptionItemId: "si_base",
    currentPlan: PLAN as never,
    currentInterval: "monthly",
    /* A whole 30-day cycle, nothing consumed, so `daysRemaining === totalDays`
       and every prorated share is the full figure — the arithmetic below is
       then about the dial rather than about a fraction. */
    periodStartSec: 1_700_000_000,
    periodEndSec: 1_700_000_000 + 30 * 86_400,
    currentCreditUnits: 0,
    creditItemId: null,
    cancelAtPeriodEnd: false,
    ...over,
  });
  const atStart = 1_700_000_000;

  it("the dial's steps are in BOTH period prices", () => {
    const quote = quotePlanChange(
      base({ currentCreditUnits: 10, creditItemId: "si_addon" }),
      PLAN as never,
      "monthly",
      atStart,
      20,
    );
    expect(quote.currentPlanPrice).toBe(
      SUBSCRIPTION_PRODUCTS[PLAN].priceInCents + planCreditSliderPriceInCents(10, "monthly"),
    );
    expect(quote.newPlanPrice).toBe(
      SUBSCRIPTION_PRODUCTS[PLAN].priceInCents + planCreditSliderPriceInCents(20, "monthly"),
    );
    /* A dial-only move on a full cycle costs exactly the ten extra steps. */
    expect(quote.proratedAmount).toBe(planCreditSliderPriceInCents(10, "monthly"));
    expect(quote.immediateCharge).toBe(planCreditSliderPriceInCents(10, "monthly"));
  });

  it("⚠ the credit adjustment follows the dial UP — and #1936 SUPERSEDED its down half", () => {
    const up = quotePlanChange(base(), PLAN as never, "monthly", atStart, 8);
    expect(up.creditAdjustment).toBe(planCreditSliderLedgerCredits(8));

    const down = quotePlanChange(
      base({ currentCreditUnits: 8, creditItemId: "si_addon" }),
      PLAN as never,
      "monthly",
      atStart,
      0,
    );
    /*
      ⚠ **THIS ASSERTED `-planCreditSliderLedgerCredits(8)` AND THE REASON IT
      GAVE IS THE REASON IT CHANGED. The old comment read:** *"NEGATIVE, for
      #664's mirror rule: `always_invoice` returns the money for the remaining
      cycle, so the credits that money bought go back with it or up-then-down
      alternation mints an allowance per round trip."*

      **Every clause of that was true, and the loop it names is the one #1936
      was filed about** — it minted anyway, because the take-back floors at
      what is LEFT of the allowance (*"spent credits are spent"*) while the
      money came back whole. The mirror was the right answer to the right
      problem and it could not win: spend first, and only the money returns.

      **His option 1 closes it at the source instead: a decrease hands back no
      money, so there is nothing to mirror.** A dial-down is now scheduled for
      the period boundary and moves nothing today, which is why this reads 0.
      ⚠ **The UP direction above is untouched** — an increase is still instant,
      still charged, and still grants the remaining cycle's share.

      `deferred` is asserted beside the 0, because a 0 on its own is what this
      arm would also read if the dial had simply stopped working.
    */
    expect(down.deferred).toBe(true);
    expect(down.creditAdjustment).toBe(0);
  });

  it("⚠ ABSENT MEANS KEEP THE DIAL, so a cycle switch does not hand credits back", () => {
    const state = base({ currentCreditUnits: 15, creditItemId: "si_addon" });
    const kept = quotePlanChange(state, PLAN as never, "annual", atStart);
    expect(kept.targetCreditUnits).toBe(15);
    /* And the unwind includes the dial's own share — the old period's grant
       had it in, and Stripe credits back the whole old line. */
    expect(kept.creditUnwind).toBe(
      PLAN_TIERS[PLAN].monthlyCredits + planCreditSliderLedgerCredits(15),
    );
  });

  it("⚠ a move OFF the dial's rung drops the steps rather than carrying a priceless line", () => {
    const quote = quotePlanChange(
      base({ currentCreditUnits: 30, creditItemId: "si_addon" }),
      "pro" as never,
      "monthly",
      atStart,
      30,
    );
    expect(quote.targetCreditUnits, "Pro has no dial and was quoted 30 steps").toBe(0);
    expect(quote.newPlanPrice).toBe(SUBSCRIPTION_PRODUCTS.pro.priceInCents);
  });

  it("a quantity past the ceiling is clamped in the quote, not trusted", () => {
    const quote = quotePlanChange(
      base(),
      PLAN as never,
      "monthly",
      atStart,
      PLAN_CREDIT_SLIDER_MAX_UNITS + 99,
    );
    expect(quote.targetCreditUnits).toBe(PLAN_CREDIT_SLIDER_MAX_UNITS);
  });
});
