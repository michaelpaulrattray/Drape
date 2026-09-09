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

const periodLine = (interval: "month" | "year") => ({
  proration: false,
  price: { recurring: { interval } },
});
const prorationLine = { proration: true, price: { recurring: { interval: "month" } } };

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
    const [userId, grant, rollover, ref, description] = refreshMonthlyCredits.mock.calls[0];
    expect(userId).toBe(7);
    expect(grant).toBe(MONTHLY_CREDITS * 12);
    expect(rollover).toBe(PERCENT_ROLLOVER);
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
    const [, grant, rollover, , description] = refreshMonthlyCredits.mock.calls[0];
    expect(grant).toBe(MONTHLY_CREDITS);
    expect(rollover).toBe(PERCENT_ROLLOVER);
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
    const [, grant, rollover] = refreshMonthlyCredits.mock.calls[0];
    expect(grant).toBe(MONTHLY_CREDITS * 12);
    /* The full 4,000 on the balance, not the 800 the percentage would keep. */
    expect(rollover).toBe(4_000);
  });

  it("a renewal that runs out keeps only the percentage — the decision-4 sentence's other half", async () => {
    await deliver({
      id: "in_cycle_percent",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_cycle",
      lines: { data: [periodLine("year")] },
    });
    const [, , rollover] = refreshMonthlyCredits.mock.calls[0];
    expect(rollover).toBe(PERCENT_ROLLOVER);
  });
});
