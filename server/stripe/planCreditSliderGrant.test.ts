/**
 * A RENEWAL GRANTS `base + the dial's steps` — driven through the real webhook
 * entry point (#1832).
 *
 * This is the arm the slider cannot ship without. A customer on the dial's
 * rung pays for `base + steps × 5,000` a month; if the renewal grants `base`
 * alone they are short every month, for as long as they stay, with nothing in
 * the request path looking wrong and no error anywhere — the silent-short
 * failure the #664 review named one branch up, pointed at a line item instead
 * of a period.
 *
 * Three facts are asserted, and each is a decision rather than arithmetic:
 *
 *  1 · **the figure is `base + steps`, times the months bought.** The annual
 *      leg matters most: a year's invoice on a dial at 20 steps grants
 *      12 × (base + 20 steps), and getting the multiplication on the wrong
 *      side of the addition costs eleven months of the add-on.
 *  2 · **the steps come off the SUBSCRIPTION, not off our own row.** The
 *      add-on item's quantity is the artifact that bills; a cached column
 *      would be a mirror of a number Stripe owns and the drift would be an
 *      allowance that disagrees with the invoice (working law 4, on credits).
 *  3 · **a rung with no dial makes no Stripe read at all.** Every renewal on
 *      Starter, Pro or a hand-sold rung takes exactly the road it took before
 *      this card, which is what confines the new failure mode below to the one
 *      rung that can carry steps.
 *
 * ⚠ **AND THE NEW FAILURE MODE IS ASSERTED AS A REFUSAL, BECAUSE ITS OTHER
 * SHAPE WOULD BE THE DEFECT.** On the dial's rung the grant now depends on a
 * Stripe read. A read that fails and falls through to `base` is the short
 * grant above; a read that fails and REFUSES means Stripe redelivers and the
 * failure is visible. The arm drives the refusal and checks that nothing was
 * granted.
 *
 * The harness is `annualInvoiceGrant.test.ts`'s, with one difference that is
 * the point of this suite: `./stripeService` is mocked WITH
 * `readSubscriptionBillingState`, and `getMonthlyCredits` is the real-shaped
 * base so the sum is a real sum.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: async () => undefined }),
    delete: () => ({ where: async () => undefined }),
  })),
}));

const { refreshMonthlyCredits, planTierOnRecord } = vi.hoisted(() => ({
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 1 }),
  planTierOnRecord: { value: "studio" },
}));

vi.mock("../db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  getUserByStripeCustomerId: vi.fn().mockImplementation(async () => ({
    id: 7,
    name: "a subscriber with the dial up",
    email: "seven@example.com",
    credits: { planTier: planTierOnRecord.value, balance: 4_000 },
  })),
  refreshMonthlyCredits,
  getUserCredits: vi.fn(),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addTopupCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(false),
  recordPlanChangeSettlement: vi.fn().mockResolvedValue({ success: true }),
  getPlanChangeSettlementByInvoice: vi.fn().mockResolvedValue(null),
  resolvePlanChangeSettlement: vi.fn().mockResolvedValue(true),
  appendChangeRequestReviewNote: vi.fn().mockResolvedValue(true),
}));

const { readSubscriptionBillingState, planCreditsAddonPriceId } = vi.hoisted(() => ({
  planCreditsAddonPriceId: vi.fn(),
  readSubscriptionBillingState: vi.fn(),
}));

vi.mock("./stripeService", async () => {
  /* The REAL plan table's figures, because the sum being asserted is
     `PLAN_TIERS[rung].monthlyCredits + steps` and a fixture base would make
     the arm about this file's own arithmetic. */
  const { PLAN_TIERS } = await import("../../drizzle/schema");
  const allowanceOf = PLAN_TIERS as Record<string, { monthlyCredits: number }>;
  return {
    constructWebhookEvent: vi.fn(),
    mapStripeStatus: vi.fn().mockReturnValue("active"),
    mapPlanToTier: vi.fn().mockReturnValue("studio"),
    calculateRolloverCredits: vi.fn().mockReturnValue(0),
    getMonthlyCredits: vi.fn((tier: string) => allowanceOf[tier].monthlyCredits),
    cancelSubscription: vi.fn().mockResolvedValue(true),
    voidInvoice: vi.fn().mockResolvedValue(true),
    retrieveLiveSubscription: vi.fn(),
    subscriptionItemsOf: vi.fn(() => ({ base: null, addon: null })),
    readSubscriptionBillingState,
    planCreditsAddonPriceId,
    REFUND_METADATA_USER_KEY: "userId",
    REFUND_METADATA_CHANGE_REQUEST_KEY: "changeRequestId",
  };
});

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { planCreditSliderLedgerCredits } from "@shared/planCreditSlider";
import { PLAN_CREDIT_SLIDER_MAX_UNITS, PLAN_CREDIT_SLIDER_PLAN } from "./planCreditSlider";
import { planCreditsPriceLookupKey, priceLookupKey } from "./stripePriceCatalogue";

const PLAN = (() => {
  if (PLAN_CREDIT_SLIDER_PLAN === null) {
    throw new Error("no rung carries the dial, so this whole suite would assert nothing");
  }
  return PLAN_CREDIT_SLIDER_PLAN as PlanTier;
})();

const DAY_S = 86_400;
const T = 1_788_900_000;
let eventSeq = 0;

/** The clover line shape production actually delivers (#664 review finding 2). */
const periodLine = (days: number) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
  period: { start: T, end: T + days * DAY_S },
});

function deliver(invoice: Record<string, unknown>) {
  eventSeq += 1;
  vi.mocked(constructWebhookEvent).mockReturnValue({
    id: `evt_slider_grant_${eventSeq}`,
    type: "invoice.payment_succeeded",
    data: { object: invoice },
    object: "event",
    api_version: "2026-01-28.clover",
    created: T,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event);
  return handleStripeWebhook("payload", "sig");
}

const renewal = (days: number) => ({
  id: `in_${eventSeq + 1}`,
  customer: "cus_1",
  billing_reason: "subscription_cycle",
  parent: { subscription_details: { subscription: "sub_1" } },
  lines: { data: [periodLine(days)] },
  metadata: { env: "local" },
});

/** The grant figure the handler actually asked for. */
function grantedCredits(): number {
  expect(refreshMonthlyCredits, "no grant was made at all").toHaveBeenCalledTimes(1);
  return refreshMonthlyCredits.mock.calls[0][1] as number;
}

/** A subscription read answering `steps` on the dial. */
function subscriptionAt(steps: number, plan: PlanTier = PLAN) {
  readSubscriptionBillingState.mockResolvedValue({
    subscriptionItemId: "si_base",
    currentPlan: plan,
    currentInterval: "monthly",
    periodStartSec: T,
    periodEndSec: T + 30 * DAY_S,
    currentCreditUnits: steps,
    creditItemId: steps > 0 ? "si_addon" : null,
  });
}


/* ── THE INVOICE THAT WAS PAID, as production's dialect delivers it ─────────
   The `periodLine` above carries NO price identity at all, which is what
   makes every arm written before this repair exercise the FALLBACK road (a
   line that cannot be identified → read the subscription). That is worth
   having and is now named as such, but it cannot test the repair, because the
   repair is about reading the invoice. These lines carry what clover really
   sends: a price **id** under `pricing.price_details.price`, no lookup key,
   and the quantity that bills. */
const BASE_PRICE_ID = "price_base_rung_monthly";
const ADDON_PRICE_ID = "price_addon_credits_monthly";

const cloverLine = (days: number, priceId: string, quantity: number | null) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
  period: { start: T, end: T + days * DAY_S },
  pricing: { type: "price_details", price_details: { price: priceId, product: "prod_1" } },
  ...(quantity === null ? {} : { quantity }),
});

/** A pre-Basil line, whose price object carries its key inline. */
const classicLine = (days: number, lookupKey: string, quantity: number) => ({
  proration: false,
  price: { id: "price_whatever", lookup_key: lookupKey, recurring: { interval: "month" } },
  period: { start: T, end: T + days * DAY_S },
  quantity,
});

/**
 * A renewal whose own lines say what was billed. `steps === null` is the
 * invoice of a customer billed at the bottom of the dial — there is NO add-on
 * line, because the item is deleted off the subscription rather than zeroed.
 */
const billedRenewal = (days: number, steps: number | null) => ({
  id: `in_${eventSeq + 1}`,
  customer: "cus_1",
  billing_reason: "subscription_cycle",
  parent: { subscription_details: { subscription: "sub_1" } },
  lines: {
    data:
      steps === null
        ? [cloverLine(days, BASE_PRICE_ID, 1)]
        : [cloverLine(days, BASE_PRICE_ID, 1), cloverLine(days, ADDON_PRICE_ID, steps)],
  },
  metadata: { env: "local" },
});

const expectedFor = (steps: number, months = 1) =>
  (PLAN_TIERS[PLAN].monthlyCredits + planCreditSliderLedgerCredits(steps)) * months;

beforeEach(() => {
  vi.clearAllMocks();
  refreshMonthlyCredits.mockResolvedValue({ success: true, newBalance: 1 });
  planTierOnRecord.value = PLAN;
  planCreditsAddonPriceId.mockResolvedValue(ADDON_PRICE_ID);
});

describe("1 · the grant is base + the dial's steps", () => {
  it("a MONTH bought at 20 steps grants the plan plus twenty steps", async () => {
    subscriptionAt(20);
    const result = await deliver(renewal(30));
    expect(result.success).toBe(true);
    expect(grantedCredits()).toBe(
      PLAN_TIERS[PLAN].monthlyCredits + planCreditSliderLedgerCredits(20),
    );
  });

  it("⚠ a YEAR bought grants the WHOLE month now, and the paid year's month carries the steps too", async () => {
    /*
      The arm most worth having in this file. A year's credits arrive month by
      month since #2152 (his ruling on #2159), so the eleven months still to
      come are sized by the paid year's month — and a month that left the dial
      out would short every one of them by the add-on, once a month, with no
      error anywhere.
    */
    subscriptionAt(20);
    await deliver(renewal(365));
    const month = PLAN_TIERS[PLAN].monthlyCredits + planCreditSliderLedgerCredits(20);
    expect(grantedCredits()).toBe(month);
    expect(refreshMonthlyCredits.mock.calls[0][6].annualYear.monthlyCredits).toBe(month);
  });

  it("the dial at the bottom grants exactly the plan — the control", async () => {
    subscriptionAt(0);
    await deliver(renewal(30));
    expect(grantedCredits()).toBe(PLAN_TIERS[PLAN].monthlyCredits);
  });

  it("the dial at the TOP grants the top of the dial", async () => {
    subscriptionAt(PLAN_CREDIT_SLIDER_MAX_UNITS);
    await deliver(renewal(30));
    expect(grantedCredits()).toBe(
      PLAN_TIERS[PLAN].monthlyCredits
      + planCreditSliderLedgerCredits(PLAN_CREDIT_SLIDER_MAX_UNITS),
    );
  });

  it("⚠ a quantity past the ceiling is CLAMPED, not granted", async () => {
    /* The quantity comes from Stripe, where a dashboard edit can put anything.
       The clamp gives the customer the dial's top and leaves the mismatch in
       the log rather than minting an allowance no screen has shown. */
    subscriptionAt(PLAN_CREDIT_SLIDER_MAX_UNITS + 1_000);
    await deliver(renewal(30));
    expect(grantedCredits()).toBe(
      PLAN_TIERS[PLAN].monthlyCredits
      + planCreditSliderLedgerCredits(PLAN_CREDIT_SLIDER_MAX_UNITS),
    );
  });
});

describe("2 · a rung with no dial takes exactly the road it took before", () => {
  it("⚠ Pro's renewal makes NO subscription read and grants Pro's allowance", async () => {
    planTierOnRecord.value = "pro";
    await deliver(renewal(30));
    expect(
      readSubscriptionBillingState,
      "a rung with no dial paid for a Stripe round trip it cannot need",
    ).not.toHaveBeenCalled();
    expect(grantedCredits()).toBe(PLAN_TIERS.pro.monthlyCredits);
  });

  it("the free rung still grants nothing and still reads nothing", async () => {
    planTierOnRecord.value = "free";
    const result = await deliver(renewal(30));
    expect(result.success).toBe(true);
    expect(refreshMonthlyCredits).not.toHaveBeenCalled();
    expect(readSubscriptionBillingState).not.toHaveBeenCalled();
  });
});

describe("3 · a read that fails REFUSES rather than granting a short allowance", () => {
  it("⚠ the event fails loudly and nothing is granted", async () => {
    readSubscriptionBillingState.mockResolvedValue(null);
    const result = await deliver(renewal(30));
    expect(result.success, "a paid period granted something on a reading it could not make").toBe(
      false,
    );
    expect(result.message).toMatch(/could not read subscription/i);
    expect(
      refreshMonthlyCredits,
      "the short grant landed — the exact defect this refusal exists for",
    ).not.toHaveBeenCalled();
  });

  it("⚠ AND THE POSITIVE CONTROL: the same invoice succeeds once the read answers", async () => {
    /* A refusal arm whose fixture cannot succeed proves nothing (working law
       2) — this is the same delivery with the read restored. */
    subscriptionAt(3);
    const result = await deliver(renewal(30));
    expect(result.success).toBe(true);
    expect(grantedCredits()).toBe(
      PLAN_TIERS[PLAN].monthlyCredits + planCreditSliderLedgerCredits(3),
    );
  });
});

/* ───────────────────────────────────────────────────────────────────────────
   4 · THE GRANT IS SIZED BY THE INVOICE THAT WAS PAID, NOT BY THE DIAL AS IT
   STANDS NOW — the relay's finding on PR #1910.

   The first three sections mock `readSubscriptionBillingState` and feed an
   invoice carrying no price identity, so they prove the arithmetic and the
   fallback and CANNOT see this defect: the figure they assert comes from the
   very read the defect is about. These arms set the invoice and the
   subscription to DIFFERENT numbers, which is the only shape that can tell
   the two artifacts apart.

   The money at stake, from the finding: a checkout at 0 steps whose customer
   raises the dial to the ceiling before the webhook is processed — Stripe's
   redelivery window is up to ~3 days — gets a whole extra month of the
   ceiling that no invoice ever charged, and this rung keeps its balance at
   renewal, so nothing claws it back.
   ─────────────────────────────────────────────────────────────────────────── */
describe("4 · the invoice is the artifact, and it disagrees with the dial", () => {
  it("⚠ the invoice's add-on line WINS over a live subscription that says otherwise", async () => {
    subscriptionAt(PLAN_CREDIT_SLIDER_MAX_UNITS); // the dial, moved after paying
    const result = await deliver(billedRenewal(30, 5)); // the invoice billed five
    expect(result.success).toBe(true);
    expect(grantedCredits(), "the grant followed the dial instead of the bill").toBe(
      expectedFor(5),
    );
  });

  it("⚠ AND IT NEVER ASKS: no subscription round trip when the invoice can be read", async () => {
    subscriptionAt(PLAN_CREDIT_SLIDER_MAX_UNITS);
    await deliver(billedRenewal(30, 5));
    expect(
      readSubscriptionBillingState,
      "the live read still happened, so the stale figure is still reachable",
    ).not.toHaveBeenCalled();
  });

  it("⚠ THE FINDING'S OWN FIRST EXAMPLE: billed at 0 steps, dial since raised to the top", async () => {
    /*
      The over-grant, and the reason an ABSENT add-on line must read as ZERO
      rather than as "ask the subscription". A 0-step invoice has no add-on
      line BY DESIGN — the item is deleted off the subscription, not set to
      zero — so a fallback here would leave this exact case as broken as it
      was before the repair.
    */
    subscriptionAt(PLAN_CREDIT_SLIDER_MAX_UNITS);
    const result = await deliver(billedRenewal(30, null));
    expect(result.success).toBe(true);
    expect(grantedCredits(), "a whole month of the ceiling was granted unbilled").toBe(
      PLAN_TIERS[PLAN].monthlyCredits,
    );
    expect(readSubscriptionBillingState).not.toHaveBeenCalled();
  });

  it("the UNDER-grant mirror: billed at 40 steps, dial since dropped to the bottom", async () => {
    subscriptionAt(0);
    await deliver(billedRenewal(30, 40));
    expect(grantedCredits()).toBe(expectedFor(40));
  });

  it("⚠ a YEAR bought off the invoice sizes its month by the invoice's steps", async () => {
    /* The annual leg of the same defect: eleven months of the add-on ride on
       getting the multiplication on the right side of the addition, and the
       steps now come off the invoice. */
    subscriptionAt(0);
    await deliver(billedRenewal(365, 20));
    /* One month now (#2152), and the year's month the invoice's steps — not
       the live subscription's zero. */
    expect(grantedCredits()).toBe(expectedFor(20));
    expect(refreshMonthlyCredits.mock.calls[0][6].annualYear.monthlyCredits).toBe(expectedFor(20));
  });

  it("a quantity past the ceiling on the INVOICE is clamped too", async () => {
    subscriptionAt(0);
    await deliver(billedRenewal(30, PLAN_CREDIT_SLIDER_MAX_UNITS + 1_000));
    expect(grantedCredits()).toBe(expectedFor(PLAN_CREDIT_SLIDER_MAX_UNITS));
  });
});

describe("5 · how the add-on line is identified, in both dialects", () => {
  it("⚠ a pre-Basil line is identified by its INLINE lookup key, with no price lookup at all", async () => {
    const key = planCreditsPriceLookupKey(PLAN as never, "monthly");
    subscriptionAt(0);
    await deliver({
      id: `in_${eventSeq + 1}`,
      customer: "cus_1",
      billing_reason: "subscription_cycle",
      parent: { subscription_details: { subscription: "sub_1" } },
      lines: {
        data: [
          {
            proration: false,
            price: {
              id: "price_base",
              lookup_key: priceLookupKey(PLAN as never, "monthly"),
              recurring: { interval: "month" },
            },
            period: { start: T, end: T + 30 * DAY_S },
            quantity: 1,
          },
          classicLine(30, key, 11),
        ],
      },
      metadata: { env: "local" },
    });
    expect(grantedCredits()).toBe(expectedFor(11));
    expect(
      planCreditsAddonPriceId,
      "a key was right there on the line and Stripe's catalogue was asked anyway",
    ).not.toHaveBeenCalled();
  });

  it("a clover line is identified by price id, and the catalogue is asked ONCE", async () => {
    subscriptionAt(0);
    await deliver(billedRenewal(30, 7));
    expect(grantedCredits()).toBe(expectedFor(7));
    expect(planCreditsAddonPriceId).toHaveBeenCalledTimes(1);
  });

  it("the annual invoice asks the catalogue for the ANNUAL price", async () => {
    /* The wrong interval here would compare a year's line against a month's
       price id, fail to identify it, and silently fall back to the live read. */
    subscriptionAt(0);
    await deliver(billedRenewal(365, 3));
    expect(planCreditsAddonPriceId.mock.calls[0][1]).toBe("annual");
  });
});

describe("6 · an UNKNOWN falls back to the dial, and only an unknown", () => {
  it("a line carrying no price identity at all falls back to the subscription", async () => {
    /* `periodLine` is that line — which is why every arm above section 4
       takes this road. Named here so the fallback has coverage of its own. */
    subscriptionAt(9);
    await deliver(renewal(30));
    expect(readSubscriptionBillingState).toHaveBeenCalledTimes(1);
    expect(grantedCredits()).toBe(expectedFor(9));
  });

  it("⚠ a catalogue that cannot answer is an UNKNOWN, never a zero", async () => {
    /* If the add-on's price id cannot be resolved, a clover line cannot be
       classified — so the absence of an identified add-on proves nothing and
       the live read must stand in. Reading 0 here would short every customer
       on the dial whenever Stripe's price list hiccuped. */
    planCreditsAddonPriceId.mockResolvedValue(null);
    subscriptionAt(12);
    await deliver(billedRenewal(30, 12));
    expect(readSubscriptionBillingState).toHaveBeenCalledTimes(1);
    expect(grantedCredits()).toBe(expectedFor(12));
  });

  it("⚠ an add-on line with NO readable quantity is an unknown, never a zero", async () => {
    /* The line IS the add-on and is identified as such; what is missing is the
       figure. Absent LINE means zero; absent QUANTITY means unknown, and
       conflating the two would short a paying customer. */
    subscriptionAt(6);
    await deliver({
      id: `in_${eventSeq + 1}`,
      customer: "cus_1",
      billing_reason: "subscription_cycle",
      parent: { subscription_details: { subscription: "sub_1" } },
      lines: {
        data: [cloverLine(30, BASE_PRICE_ID, 1), cloverLine(30, ADDON_PRICE_ID, null)],
      },
      metadata: { env: "local" },
    });
    expect(readSubscriptionBillingState).toHaveBeenCalledTimes(1);
    expect(grantedCredits()).toBe(expectedFor(6));
  });

  it("⚠ an unknown whose subscription ALSO cannot be read still refuses", async () => {
    readSubscriptionBillingState.mockResolvedValue(null);
    const result = await deliver(renewal(30));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/could not read subscription/i);
    expect(refreshMonthlyCredits).not.toHaveBeenCalled();
  });
});
