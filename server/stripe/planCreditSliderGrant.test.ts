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

const { readSubscriptionBillingState } = vi.hoisted(() => ({
  readSubscriptionBillingState: vi.fn(),
}));

vi.mock("./stripeService", async () => {
  /* The REAL plan table's figures, because the sum being asserted is
     `PLAN_TIERS[rung].monthlyCredits + steps` and a fixture base would make
     the arm about this file's own arithmetic. */
  const { PLAN_TIERS } = await import("../../drizzle/schema");
  return {
    constructWebhookEvent: vi.fn(),
    mapStripeStatus: vi.fn().mockReturnValue("active"),
    mapPlanToTier: vi.fn().mockReturnValue("studio"),
    calculateRolloverCredits: vi.fn().mockReturnValue(0),
    getMonthlyCredits: vi.fn((tier: string) => PLAN_TIERS[tier].monthlyCredits),
    cancelSubscription: vi.fn().mockResolvedValue(true),
    voidInvoice: vi.fn().mockResolvedValue(true),
    retrieveLiveSubscription: vi.fn(),
    subscriptionItemsOf: vi.fn(() => ({ base: null, addon: null })),
    readSubscriptionBillingState,
    REFUND_METADATA_USER_KEY: "userId",
    REFUND_METADATA_CHANGE_REQUEST_KEY: "changeRequestId",
  };
});

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { planCreditSliderLedgerCredits } from "@shared/planCreditSlider";
import { PLAN_CREDIT_SLIDER_MAX_UNITS, PLAN_CREDIT_SLIDER_PLAN } from "./planCreditSlider";

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

beforeEach(() => {
  vi.clearAllMocks();
  refreshMonthlyCredits.mockResolvedValue({ success: true, newBalance: 1 });
  planTierOnRecord.value = PLAN;
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

  it("⚠ a YEAR bought multiplies the WHOLE allowance, not just the plan", async () => {
    /*
      The arm most worth having in this file. `(base + steps) × 12` and
      `base × 12 + steps` differ by eleven months of the add-on — on a dial at
      20 steps that is 5.5 million ledger credits a customer paid for and did
      not get, once a year, with no error anywhere.
    */
    subscriptionAt(20);
    await deliver(renewal(365));
    expect(grantedCredits()).toBe(
      (PLAN_TIERS[PLAN].monthlyCredits + planCreditSliderLedgerCredits(20)) * 12,
    );
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
