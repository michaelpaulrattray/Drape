/**
 * THE BANK IS CAPPED AT ONE MONTH'S WORTH OF PLAN CREDITS, AND A DOWNGRADE
 * TRIMS IT TO THE NEW PLAN'S MONTH (#2152) — driven through the real webhook
 * entry point with the REAL rollover rule.
 *
 * His word, 2026-10-09 (terminal): *"pricing word card here ive approved the
 * code changes required too"*, on the Desk item "Pricing Phase 2: final
 * wording", whose rules read *"The bank is capped at one month's worth of plan
 * credits"* and *"A downgrade trims the bank to the new plan's cap."*
 *
 * The harness is `invoiceBilledPlanGrant.test.ts`'s (copied, not shared), with
 * one deliberate change: `calculateRolloverCredits` is the product's own, so
 * what each arm reads is the number the closure handed to
 * `refreshMonthlyCredits` actually carries for a given plan part. The closure
 * is the wire here: `refreshMonthlyCredits` runs exactly it over the plan's
 * part of the balance (`server/purchasedCreditsRenewal.test.ts` drives that
 * half, top-ups kept outside the cap).
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
    id: 11,
    name: "a subscriber whose plan changed mid-window",
    email: "eleven@example.com",
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

const { readSubscriptionBillingState, planCreditsAddonPriceId } =
  vi.hoisted(() => ({
    planCreditsAddonPriceId: vi.fn(),
    readSubscriptionBillingState: vi.fn(),
  }));

vi.mock("./stripeService", async (importOriginal) => {
  /* ⚠ THE REAL ROLLOVER RULE — the one difference from the harness this is
     copied from. That suite asks WHOSE percentage; this one asks what the rule
     the handler built actually carries, so the arithmetic must be the
     product's own. */
  const real = await importOriginal<typeof import("./stripeService")>();
  const calculateRolloverCredits = real.calculateRolloverCredits;
  /* The REAL plan table's allowances, because the figure being asserted is
     `PLAN_TIERS[rung].monthlyCredits` and a fixture base would make the arm
     about this file's own arithmetic rather than about which rung was read. */
  const { PLAN_TIERS } = await import("../../drizzle/schema");
  const allowanceOf = PLAN_TIERS as Record<string, { monthlyCredits: number }>;
  return {
    constructWebhookEvent: vi.fn(),
    mapStripeStatus: vi.fn().mockReturnValue("active"),
    mapPlanToTier: vi.fn().mockReturnValue("studio"),
    calculateRolloverCredits,
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
import { invoiceSubscriptionMetadata } from "./invoiceLines";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { planCreditSliderLedgerCredits } from "@shared/planCreditSlider";
import { PLAN_CREDIT_SLIDER_PLAN, planCreditSliderUnitsAllowed } from "./planCreditSlider";
import { SELF_SERVE_PLAN_ORDER } from "./stripeProducts";

/* ── THE TWO RUNGS THIS SUITE PLAYS OFF EACH OTHER, BOTH DERIVED ────────────
   Typed as `"studio"` and `"pro"` these would be two string literals on a
   money surface that his own rename week has already moved once (#1900), and
   the ladder's shape is a thing #1832 derives everywhere else. So: the dial's
   rung, and the dearest paid rung that has no dial. */
const DIAL_PLAN = (() => {
  if (PLAN_CREDIT_SLIDER_PLAN === null) {
    throw new Error("no rung carries the dial, so half this suite would assert nothing");
  }
  return PLAN_CREDIT_SLIDER_PLAN as PlanTier;
})();

/**
 * ⚠ **THE RUNG BELOW THE DIAL, AND IT IS READ OFF THE SELF-SERVE LADDER
 * RATHER THAN OFF EVERY PAID RUNG.** The first derivation here took the
 * dearest paid rung with no dial, which resolves to the HIDDEN hand-sold one
 * (`HIDDEN_PLAN_TIERS`) — dearer than the dial's rung, so every arm's prose
 * about an upgrade or a downgrade said the opposite of what its fixture did.
 * The contrast this suite wants is the one the card describes: the rung a
 * customer walks up FROM.
 */
const PLAIN_PLAN = (() => {
  const found = SELF_SERVE_PLAN_ORDER.filter(
    (tier) => PLAN_TIERS[tier].price > 0 && planCreditSliderUnitsAllowed(tier) === 0,
  ).reduce<PlanTier | null>(
    (dearest, tier) =>
      dearest === null || PLAN_TIERS[tier].price > PLAN_TIERS[dearest].price ? tier : dearest,
    null,
  );
  if (found === null) throw new Error("every paid rung carries a dial — this suite cannot contrast");
  return found;
})();

/* The ladder's direction, asserted rather than described: the arms below say
   "upgraded" and "downgraded" in their own prose, and a ladder edit that put
   the dial on a cheaper rung would leave every one of those sentences lying
   while the assertions went on passing. */
if (PLAN_TIERS[PLAIN_PLAN].price >= PLAN_TIERS[DIAL_PLAN].price) {
  throw new Error(
    `${PLAIN_PLAN} is not below ${DIAL_PLAN} on the ladder, so this suite's upgrade/downgrade prose is false`,
  );
}

/* The arms below can only tell the two artifacts apart if the two rungs grant
   different amounts. Asserted rather than assumed, because a ladder edit that
   made them equal would leave every arm in section 2 passing while proving
   nothing. */
if (PLAN_TIERS[DIAL_PLAN].monthlyCredits === PLAN_TIERS[PLAIN_PLAN].monthlyCredits) {
  throw new Error(
    `${DIAL_PLAN} and ${PLAIN_PLAN} grant the same allowance, so this suite cannot tell which rung was read`,
  );
}

const DAY_S = 86_400;
const T = 1_788_900_000;
let eventSeq = 0;

function deliver(invoice: Record<string, unknown>) {
  eventSeq += 1;
  vi.mocked(constructWebhookEvent).mockReturnValue({
    id: `evt_billed_plan_${eventSeq}`,
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

const BASE_PRICE_ID = "price_base_rung";
const ADDON_PRICE_ID = "price_addon_credits";

/** The clover line shape production actually delivers. */
const cloverLine = (days: number, priceId: string, quantity: number) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
  period: { start: T, end: T + days * DAY_S },
  pricing: { type: "price_details", price_details: { price: priceId, product: "prod_1" } },
  quantity,
});

/** A line carrying no price identity at all — the add-on reading is UNKNOWN. */
const anonymousLine = (days: number) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
  period: { start: T, end: T + days * DAY_S },
});

/**
 * A paid renewal. `billedPlan` is what Stripe froze onto the invoice when it
 * finalized it; `steps` adds the dial's own add-on line when given.
 */
function renewal(opts: {
  days?: number;
  billedPlan?: string | null;
  subscriptionMetadata?: Record<string, unknown> | null;
  steps?: number;
}) {
  const days = opts.days ?? 30;
  const metadata =
    opts.subscriptionMetadata !== undefined
      ? opts.subscriptionMetadata
      : opts.billedPlan === null || opts.billedPlan === undefined
        ? null
        : { userId: "11", plan: opts.billedPlan, interval: days >= 300 ? "annual" : "monthly" };
  return {
    id: `in_${eventSeq + 1}`,
    customer: "cus_1",
    billing_reason: "subscription_cycle",
    parent: {
      subscription_details: { subscription: "sub_1", ...(metadata === null ? {} : { metadata }) },
    },
    lines: {
      data:
        opts.steps === undefined
          ? [cloverLine(days, BASE_PRICE_ID, 1)]
          : [cloverLine(days, BASE_PRICE_ID, 1), cloverLine(days, ADDON_PRICE_ID, opts.steps)],
    },
    metadata: { env: "local" },
  };
}

/** The grant figure the handler actually asked for. */
function grantedCredits(): number {
  expect(refreshMonthlyCredits, "no grant was made at all").toHaveBeenCalledTimes(1);
  return refreshMonthlyCredits.mock.calls[0][1] as number;
}

/** A live subscription read answering `steps` on the dial. */
function subscriptionAt(steps: number, plan: PlanTier = DIAL_PLAN) {
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

const allowanceOf = (plan: PlanTier, months = 1) => PLAN_TIERS[plan].monthlyCredits * months;

beforeEach(() => {
  vi.clearAllMocks();
  refreshMonthlyCredits.mockResolvedValue({ success: true, newBalance: 1 });
  planCreditsAddonPriceId.mockResolvedValue(ADDON_PRICE_ID);
  planTierOnRecord.value = DIAL_PLAN;
});

/** What the rule the handler built carries for a plan part of `planPart`. */
function carried(planPart: number): number {
  expect(refreshMonthlyCredits, "no grant was made at all").toHaveBeenCalledTimes(1);
  const rule = refreshMonthlyCredits.mock.calls[0][2] as (balance: number) => number;
  return rule(planPart);
}

const HUGE = 50_000_000;

describe("the one-month cap, at the renewal", () => {
  it("a plain rung's untouched bank carries one month and not a ledger credit more", async () => {
    planTierOnRecord.value = PLAIN_PLAN;
    await deliver(renewal({ billedPlan: PLAIN_PLAN }));
    expect(carried(HUGE)).toBe(allowanceOf(PLAIN_PLAN));
  });

  it("POSITIVE CONTROL: under the cap the plan's own percentage still decides", async () => {
    planTierOnRecord.value = PLAIN_PLAN;
    await deliver(renewal({ billedPlan: PLAIN_PLAN }));
    const small = allowanceOf(PLAIN_PLAN) / 2;
    expect(carried(small)).toBe(Math.floor((small * PLAN_TIERS[PLAIN_PLAN].rolloverPercent) / 100));
    expect(carried(small)).toBeLessThan(allowanceOf(PLAIN_PLAN));
  });

  it("the dial's rung: one month INCLUDES the steps on the paid invoice", async () => {
    planTierOnRecord.value = DIAL_PLAN;
    const steps = 12;
    await deliver(renewal({ billedPlan: DIAL_PLAN, steps }));
    expect(carried(HUGE)).toBe(allowanceOf(DIAL_PLAN) + planCreditSliderLedgerCredits(steps));
  });

  it("an annual invoice grants twelve months but the bank is still capped at ONE", async () => {
    planTierOnRecord.value = PLAIN_PLAN;
    await deliver(renewal({ days: 365, billedPlan: PLAIN_PLAN }));
    expect(refreshMonthlyCredits.mock.calls[0][1]).toBe(allowanceOf(PLAIN_PLAN, 12));
    expect(carried(HUGE)).toBe(allowanceOf(PLAIN_PLAN));
  });

  it("an interval switch carries the whole balance, up to the same one month", async () => {
    planTierOnRecord.value = PLAIN_PLAN;
    await deliver({ ...renewal({ days: 365, billedPlan: PLAIN_PLAN }), billing_reason: "subscription_update" });
    const under = allowanceOf(PLAIN_PLAN) - 5_000;
    expect(carried(under)).toBe(under); // identity, not the percentage
    expect(carried(HUGE)).toBe(allowanceOf(PLAIN_PLAN));
  });
});

describe("a downgrade trims the bank to the NEW plan's month", () => {
  it("the dial's rung downgraded at renewal: the bank is cut to the plain rung's month", async () => {
    /* The downgrade took effect at this renewal (#1936), so the invoice is
       billed on the plain rung while a full dial-rung bank sits on the
       balance. The row may still say either; the invoice decides (#1930). */
    planTierOnRecord.value = DIAL_PLAN;
    const dialBank = allowanceOf(DIAL_PLAN) + planCreditSliderLedgerCredits(40);
    await deliver(renewal({ billedPlan: PLAIN_PLAN }));
    expect(carried(dialBank)).toBe(allowanceOf(PLAIN_PLAN));
    expect(allowanceOf(PLAIN_PLAN)).toBeLessThan(
      Math.floor((dialBank * PLAN_TIERS[PLAIN_PLAN].rolloverPercent) / 100),
    );
  });

  it("the dial lowered at renewal: the bank is cut to the month the FEWER steps buy", async () => {
    planTierOnRecord.value = DIAL_PLAN;
    const before = allowanceOf(DIAL_PLAN) + planCreditSliderLedgerCredits(40);
    await deliver(renewal({ billedPlan: DIAL_PLAN, steps: 2 }));
    expect(carried(before * 3)).toBe(allowanceOf(DIAL_PLAN) + planCreditSliderLedgerCredits(2));
  });
});
