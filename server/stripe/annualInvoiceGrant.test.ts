/**
 * CREDITS ARE GRANTED WHEN A PERIOD IS BOUGHT, SIZED BY THE PERIOD BOUGHT
 * (#664 decision 3) — driven through the real webhook entry point.
 *
 * Before this rule the invoice handler granted ONE month's credits on ANY
 * subscription invoice: an annual subscriber would have received a month's
 * allowance for a year's money, and — once plan changes invoice immediately
 * (`always_invoice`) — every tier change's proration invoice would have RESET
 * the balance. The invoice's own non-proration recurring line is the artifact
 * that says what was bought; these arms drive all four shapes:
 *
 *   1. a YEAR bought   → 12 × the monthly allowance, said as annual
 *   2. a MONTH bought  → the unchanged renewal behaviour (the control)
 *   3. nothing bought  → proration-only invoice, NO balance reset
 *   4. an EARLY renewal (interval switch, billing_reason subscription_update)
 *      → the whole balance rolls over, not the plan's percentage (decision 4)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [] }),
      }),
    }),
    insert: () => ({
      values: () => ({ onDuplicateKeyUpdate: async () => undefined }),
    }),
  })),
}));

const { refreshMonthlyCredits, getUserCredits } = vi.hoisted(() => ({
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 1 }),
  getUserCredits: vi.fn(),
}));

vi.mock("../db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  getUserByStripeCustomerId: vi.fn().mockImplementation(async () => ({
    id: 7,
    name: "annual subscriber",
    email: "seven@example.com",
    credits: { planTier: "pro", balance: 4_000 },
  })),
  refreshMonthlyCredits,
  getUserCredits,
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(false),
  /* #711: no plan-change settlement pending on any of these invoices — the
     settle hook passes through, which is this suite's world. Its own arms
     live in planChangeSettlement.test.ts. */
  recordPlanChangeSettlement: vi.fn().mockResolvedValue({ success: true }),
  getPlanChangeSettlementByInvoice: vi.fn().mockResolvedValue(null),
  resolvePlanChangeSettlement: vi.fn().mockResolvedValue(true),
}));

const { MONTHLY_CREDITS, PERCENT_ROLLOVER } = vi.hoisted(() => ({
  MONTHLY_CREDITS: 5_000,
  PERCENT_ROLLOVER: 800,
}));

vi.mock("./stripeService", () => ({
  constructWebhookEvent: vi.fn(),
  mapStripeStatus: vi.fn().mockReturnValue("active"),
  mapPlanToTier: vi.fn().mockReturnValue("pro"),
  calculateRolloverCredits: vi.fn().mockReturnValue(PERCENT_ROLLOVER),
  getMonthlyCredits: vi.fn().mockReturnValue(MONTHLY_CREDITS),
  cancelSubscription: vi.fn().mockResolvedValue(true),
}));

vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: {
    chargebackFiled: vi.fn().mockResolvedValue(true),
    chargebackResolved: vi.fn().mockResolvedValue(true),
    paymentFailed: vi.fn().mockResolvedValue(true),
  },
}));

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";

let eventSeq = 0;

function invoiceEvent(invoice: Record<string, unknown>): Stripe.Event {
  eventSeq += 1;
  return {
    id: `evt_live_grant_${eventSeq}`,
    type: "invoice.payment_succeeded",
    data: { object: invoice },
    object: "event",
    api_version: "2023-10-16",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

function deliver(invoice: Record<string, unknown>) {
  vi.mocked(constructWebhookEvent).mockReturnValue(invoiceEvent(invoice));
  return handleStripeWebhook("payload", "sig");
}

/* Pre-Basil (classic) shapes — no period, so the reader falls back to the
   classic interval field. */
const periodLine = (interval: "month" | "year") => ({
  proration: false,
  price: { recurring: { interval } },
});
const prorationLine = { proration: true, price: { recurring: { interval: "month" } } };

/* Clover shapes — what the registered endpoint actually delivers
   (api_version 2026-01-28.clover, read at stripe.webhookEndpoints.list):
   no line.proration, no line.price; parent.subscription_item_details and a
   period whose SPAN says what was bought. */
const DAY_S = 86_400;
const T = 1_788_900_000;
const cloverPeriodLine = (days: number) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
  pricing: { price_details: { price: "price_x" }, unit_amount_decimal: "67728" },
  period: { start: T, end: T + days * DAY_S },
});
const cloverProrationLine = {
  parent: { type: "subscription_item_details", subscription_item_details: { proration: true } },
  pricing: { price_details: { price: "price_y" } },
  period: { start: T, end: T + 30 * DAY_S },
};

beforeEach(() => {
  refreshMonthlyCredits.mockClear();
  getUserCredits.mockReset().mockResolvedValue({ balance: 4_000 });
});

describe("the period-bought grant rule", () => {
  it("a YEAR bought grants 12 × the monthly allowance, up front, and says so on the ledger", async () => {
    const result = await deliver({
      id: "in_annual_create",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_create",
      lines: { data: [periodLine("year")] },
    });
    expect(result.success).toBe(true);
    expect(refreshMonthlyCredits).toHaveBeenCalledTimes(1);
    const [userId, grant, computeRollover, ref, description] = refreshMonthlyCredits.mock.calls[0];
    expect(userId).toBe(7);
    expect(grant).toBe(MONTHLY_CREDITS * 12);
    /* The rollover is a RULE now (round-2 finding 1): the refresh computes it
       from the balance its compare-and-set is conditioned on. A create keeps
       the plan's percentage. */
    expect(computeRollover(4_000)).toBe(PERCENT_ROLLOVER);
    expect(ref).toBe("stripe-invoice:in_annual_create");
    expect(description).toContain("Annual");
    expect(description).toContain("12 months");
  });

  it("a MONTH bought is the unchanged renewal — one month's grant, the plan's rollover, the default ledger line", async () => {
    const result = await deliver({
      id: "in_monthly_cycle",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_cycle",
      lines: { data: [periodLine("month")] },
    });
    expect(result.success).toBe(true);
    const [, grant, computeRollover, , description] = refreshMonthlyCredits.mock.calls[0];
    expect(grant).toBe(MONTHLY_CREDITS);
    expect(computeRollover(4_000)).toBe(PERCENT_ROLLOVER);
    expect(description).toBeUndefined();
  });

  it("⚠ a proration-only invoice buys no period and must NOT reset the balance — the tier-change invoice under always_invoice", async () => {
    const result = await deliver({
      id: "in_proration_only",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [prorationLine, { ...prorationLine }] },
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain("no period bought");
    expect(refreshMonthlyCredits).not.toHaveBeenCalled();
  });

  it("⚠ an EARLY renewal (interval switch) rolls the WHOLE balance — a cycle the customer ended early keeps what they paid for", async () => {
    const result = await deliver({
      id: "in_switch",
      customer: "cus_1",
      subscription: "sub_1",
      /* An anchor reset's full-period invoice arrives as subscription_update
         WITH a non-proration recurring line — that pairing is the switch. */
      billing_reason: "subscription_update",
      lines: { data: [prorationLine, periodLine("year")] },
    });
    expect(result.success).toBe(true);
    const [, grant, computeRollover] = refreshMonthlyCredits.mock.calls[0];
    expect(grant).toBe(MONTHLY_CREDITS * 12);
    /* The whole conditioned balance, not the 800 the percentage would keep —
       the unwind in changePlan is what made carrying it through honest. */
    expect(computeRollover(4_000)).toBe(4_000);
  });

  it("⚠ CLOVER dialect: a year read off the line's own period span grants 12× — the shape production actually receives", async () => {
    const result = await deliver({
      id: "in_clover_annual",
      customer: "cus_1",
      /* No invoice.subscription in this dialect — the id lives on parent. */
      parent: { subscription_details: { subscription: "sub_1" } },
      billing_reason: "subscription_cycle",
      lines: { data: [cloverPeriodLine(365)] },
    });
    expect(result.success).toBe(true);
    const [, grant] = refreshMonthlyCredits.mock.calls[0];
    expect(grant).toBe(MONTHLY_CREDITS * 12);
  });

  it("CLOVER dialect: a month's span grants one month", async () => {
    await deliver({
      id: "in_clover_month",
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_1" } },
      billing_reason: "subscription_cycle",
      lines: { data: [cloverPeriodLine(30)] },
    });
    const [, grant] = refreshMonthlyCredits.mock.calls[0];
    expect(grant).toBe(MONTHLY_CREDITS);
  });

  it("CLOVER dialect: a proration-only invoice still resets nothing", async () => {
    const result = await deliver({
      id: "in_clover_proration",
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_1" } },
      billing_reason: "subscription_update",
      lines: { data: [cloverProrationLine] },
    });
    expect(result.success).toBe(true);
    expect(refreshMonthlyCredits).not.toHaveBeenCalled();
  });

  it("⚠ A RENEWAL THE READER CANNOT SIZE FAILS LOUD — never a paid period with a silent zero grant (#664 review finding 2)", async () => {
    const result = await deliver({
      id: "in_unreadable",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_cycle",
      lines: { data: [] },
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("could not read");
    expect(refreshMonthlyCredits).not.toHaveBeenCalled();
  });

  it("a renewal that runs out keeps only the percentage — the decision-4 sentence's other half", async () => {
    await deliver({
      id: "in_cycle_percent",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_cycle",
      lines: { data: [periodLine("year")] },
    });
    const [, , computeRollover] = refreshMonthlyCredits.mock.calls[0];
    expect(computeRollover(4_000)).toBe(PERCENT_ROLLOVER);
  });
});
