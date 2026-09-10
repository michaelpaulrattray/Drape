/**
 * CREDITS MOVE WHEN THE MONEY THEY MIRROR SETTLES (#711) — driven through the
 * real `changePlan` procedure and the real webhook entry point, with Stripe
 * and the database doubled at their module boundaries.
 *
 * The defect: `changePlan` moved credits when Stripe ACCEPTED the update, not
 * when the `always_invoice` charge settled — a declined card kept an
 * upgrade's credits (×12 on annual), and a declined interval switch left the
 * customer deducted with no new grant. The rule under test:
 *
 *   record the move against the change's own invoice → apply if the invoice
 *   is already paid (the instant happy path) → otherwise the
 *   invoice.payment_succeeded webhook applies it, and a FINAL payment
 *   failure voids it.
 *
 * The arms that matter most are the two negative controls: the DECLINED card
 * moving nothing (arm 1 — red against the pre-#711 code), and the final
 * failure voiding the pending move (arm: void).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { pricesCreate, subscriptionsUpdate, subscriptionsRetrieve, invoicesRetrieve, invoicesVoid } =
  vi.hoisted(() => ({
    pricesCreate: vi.fn(),
    subscriptionsUpdate: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    invoicesRetrieve: vi.fn(),
    invoicesVoid: vi.fn(),
  }));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: pricesCreate };
    subscriptions = { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate };
    invoices = { retrieve: invoicesRetrieve, voidInvoice: invoicesVoid };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

const db = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  getUserCredits: vi.fn(),
  recordPlanChangeSettlement: vi.fn(),
  getPlanChangeSettlementByInvoice: vi.fn(),
  resolvePlanChangeSettlement: vi.fn().mockResolvedValue(true),
  getUserByStripeCustomerId: vi.fn(),
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 1 }),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(false),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  voidPendingPlanChangeSettlementsForUser: vi.fn().mockResolvedValue(0),
  getDb: vi.fn().mockResolvedValue(null),
  withTransaction: vi.fn(),
}));

vi.mock("../db", () => db);

/* The webhook's idempotency pre-check reads the connection module directly. */
vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
  })),
}));

vi.mock("../auditLog", async () => {
  const schema = await vi.importActual<typeof import("../../drizzle/schema")>(
    "../../drizzle/schema",
  );
  return {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: schema.AUDIT_ACTIONS,
  };
});

vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: new Proxy({}, { get: () => vi.fn().mockResolvedValue(true) }),
}));

import { billingRouter } from "../routes/billing";
import { handleStripeWebhook } from "./webhooks";
import { settlementLedgerRef } from "./planChangeSettlement";
import { PLAN_TIERS } from "../../drizzle/schema";
import { deploymentTag } from "../_core/env";

const USER = { id: 7, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER } as never);

const NOW_SEC = Math.floor(Date.now() / 1000);
const DAY = 86_400;

/** A monthly `starter` subscription, 20 of 30 days remaining. */
function armStripeSubscription() {
  subscriptionsRetrieve.mockResolvedValue({
    metadata: { plan: "starter" },
    items: {
      data: [
        {
          id: "si_1",
          price: { recurring: { interval: "month" } },
          current_period_start: NOW_SEC - 10 * DAY,
          current_period_end: NOW_SEC + 20 * DAY,
        },
      ],
    },
  });
}

/** What the real quote computes for starter → pro over the same 20/30 days —
 *  re-derived here from the same constants so the assertion is exact. */
const daysRemaining = Math.min(30, Math.max(0, Math.ceil((NOW_SEC + 20 * DAY - NOW_SEC) / DAY)));
const UPGRADE_CREDITS = Math.floor(
  (PLAN_TIERS.pro.monthlyCredits - PLAN_TIERS.starter.monthlyCredits) * (daysRemaining / 30),
);
const UNWIND_CREDITS = Math.floor(
  PLAN_TIERS.starter.monthlyCredits * (daysRemaining / 30),
);

beforeEach(() => {
  vi.clearAllMocks();
  db.getUserById.mockResolvedValue({ id: 7, frozenAt: null, email: "u@example.com" });
  db.getSubscriptionByUserId.mockResolvedValue({
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    planTier: "starter",
  });
  db.updateUserSubscription.mockResolvedValue({ success: true });
  db.recordPlanChangeSettlement.mockResolvedValue({ success: true });
  db.resolvePlanChangeSettlement.mockResolvedValue(true);
  db.addCredits.mockResolvedValue({ success: true, newBalance: 1000 });
  db.deductCredits.mockResolvedValue({ success: true, newBalance: 0 });
  db.getUserCredits.mockResolvedValue({ balance: 100_000 });
  db.refreshMonthlyCredits.mockResolvedValue({ success: true, newBalance: 1 });
  pricesCreate.mockResolvedValue({ id: "price_minted" });
  subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_change" });
  armStripeSubscription();
});

describe("changePlan — the grant hangs on the invoice, not on the Stripe update", () => {
  it("a DECLINED card moves NOTHING: unpaid invoice → no credits, a pending settlement, honest copy", async () => {
    /* The invoice is open at the update read AND at the fresh re-read. */
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });

    const result = await caller().changePlan({ newPlan: "pro" });

    /* The whole point of #711: no credit moved on the Stripe update alone. */
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.deductCredits).not.toHaveBeenCalled();

    /* The move is recorded against the change's own invoice… */
    expect(db.recordPlanChangeSettlement).toHaveBeenCalledTimes(1);
    expect(db.recordPlanChangeSettlement.mock.calls[0][0]).toMatchObject({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
    });

    /* …and the customer is told the truth, in their vocabulary. */
    expect(result.creditSettlement).toBe("pending");
    expect(result.message).toContain("land as soon as the payment settles");
    expect(result.message).not.toContain("bonus credits added");
  });

  it("a WORKING card keeps the instant feel: invoice already paid → recorded AND applied in the same breath", async () => {
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "paid" });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(db.recordPlanChangeSettlement).toHaveBeenCalledTimes(1);
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(db.addCredits).toHaveBeenCalledWith(
      7,
      UPGRADE_CREDITS,
      "bonus",
      "Prorated credits for upgrade to pro",
      settlementLedgerRef("in_change"),
    );
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
    expect(result.creditSettlement).toBe("applied");
    expect(result.message).toContain("bonus credits added");
  });

  it("closes the webhook-first race: open at the update read, PAID at the fresh re-read → applied", async () => {
    /* First retrieve (inside updateSubscriptionPlan) says open; the fresh
       re-read AFTER the row is recorded says paid — the exact window where a
       synchronously-paid invoice's webhook fired before the row existed. */
    invoicesRetrieve
      .mockResolvedValueOnce({ amount_due: 12_00, status: "open" })
      .mockResolvedValueOnce({ status: "paid" });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    /* The re-read happened AFTER the record — the order is the race fix. */
    expect(db.recordPlanChangeSettlement.mock.invocationCallOrder[0]).toBeLessThan(
      invoicesRetrieve.mock.invocationCallOrder[1],
    );
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(result.creditSettlement).toBe("applied");
  });

  it("an interval switch's UNWIND waits for the switch invoice too — a declined card deducts nothing", async () => {
    invoicesRetrieve.mockResolvedValue({ amount_due: 500_00, status: "open" });

    const result = await caller().changePlan({ newPlan: "starter", interval: "annual" });

    expect(db.deductCredits).not.toHaveBeenCalled();
    expect(db.recordPlanChangeSettlement.mock.calls[0][0]).toMatchObject({
      stripeInvoiceId: "in_change",
      direction: "unwind",
      credits: UNWIND_CREDITS,
    });
    expect(result.creditSettlement).toBe("pending");
  });

  it("a transient failure of the fresh re-read RETRIES before deferring — the last road to a paid customer's credits (review finding 1)", async () => {
    /* update-time read: open. Fresh re-read attempt 1: the read itself
       fails. Attempt 2: paid. Deferring on attempt 1 would strand the row
       if the webhook was already consumed — the retry is the repair. */
    invoicesRetrieve
      .mockResolvedValueOnce({ amount_due: 12_00, status: "open" })
      .mockRejectedValueOnce(new Error("stripe 5xx"))
      .mockResolvedValueOnce({ status: "paid" });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(invoicesRetrieve).toHaveBeenCalledTimes(3);
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(result.creditSettlement).toBe("applied");
  });

  it("a grant whose settlement cannot be RECORDED refuses loudly — money taken with nothing owing it back is not success", async () => {
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    db.recordPlanChangeSettlement.mockResolvedValue({ success: false, error: "db down" });

    await expect(caller().changePlan({ newPlan: "pro" })).rejects.toThrow(
      /credit adjustment could not be recorded/,
    );
  });

  it("the no-invoice road (unreachable under always_invoice) falls back to the immediate move, never to silence", async () => {
    subscriptionsUpdate.mockResolvedValue({ latest_invoice: null });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(db.recordPlanChangeSettlement).not.toHaveBeenCalled();
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(result.creditSettlement).toBe("applied");
  });
});

/* ────────────────────────── the webhook side ────────────────────────── */

let eventSeq = 0;
function stripeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  eventSeq += 1;
  return {
    id: `evt_711_${eventSeq}`,
    type,
    data: { object },
    object: "event",
    api_version: "2023-10-16",
    created: NOW_SEC,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

describe("the webhook settles what changePlan recorded", () => {
  const grantRow = {
    userId: 7,
    stripeInvoiceId: "in_change",
    direction: "grant" as const,
    credits: 4000,
    description: "Prorated credits for upgrade to pro",
    status: "pending" as const,
  };

  /* The service's own stripe instance was built from the double above; its
     `webhooks.constructEvent` mock is what turns a payload into our event. */
  async function deliverEvent(type: string, object: Record<string, unknown>) {
    const event = stripeEvent(type, object);
    const svc = await import("./stripeService");
    const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
    (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(event);
    return handleStripeWebhook("{}", "sig");
  }

  beforeEach(() => {
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000 },
    });
  });

  it("invoice.payment_succeeded applies a pending GRANT on its proration-only invoice", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.addCredits).toHaveBeenCalledWith(
      7,
      4000,
      "bonus",
      grantRow.description,
      settlementLedgerRef("in_change"),
    );
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
    /* Proration-only invoice: the period logic granted nothing on top. */
    expect(db.refreshMonthlyCredits).not.toHaveBeenCalled();
  });

  it("a REPLAY cannot double-grant: the ledger's duplicate verdict resolves the row and succeeds", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    db.addCredits.mockResolvedValue({ success: true, newBalance: 4000, duplicate: true });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
  });

  it("an interval switch settles WHOLE: the unwind lands, then the same invoice's period grant", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 3000,
      description: "Unused monthly cycle credits returned with its refund",
    });
    db.getUserCredits.mockResolvedValue({ balance: 10_000 });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: {
        data: [
          {
            price: { recurring: { interval: "year" } },
            proration: false,
            period: { start: NOW_SEC, end: NOW_SEC + 365 * DAY },
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    expect(db.deductCredits).toHaveBeenCalledTimes(1);
    expect(db.deductCredits.mock.calls[0].slice(0, 3)).toEqual([7, 3000, "subscription"]);
    expect(db.refreshMonthlyCredits).toHaveBeenCalledTimes(1);
    /* Deterministic order: the unwind before the grant. */
    expect(db.deductCredits.mock.invocationCallOrder[0]).toBeLessThan(
      db.refreshMonthlyCredits.mock.invocationCallOrder[0],
    );
  });

  it("the unwind floors at the LIVE balance at application time — spent credits are spent", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 3000,
    });
    db.getUserCredits.mockResolvedValue({ balance: 400 });

    await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(db.deductCredits.mock.calls[0][1]).toBe(400);
  });

  it("a FINAL payment failure VOIDS the pending move — the declined card's credits never arrive", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "void");
    expect(db.addCredits).not.toHaveBeenCalled();
  });

  /*
    #756 — THE OTHER HALF OF THAT VOID, AND WITHOUT IT THE TWO SIDES OF THE
    LEDGER DISAGREE. The arm above closes the CREDIT side. The INVOICE stayed
    `open` and payable through Stripe's hosted invoice page, so the customer
    could pay it days later: money accepted, credits refused by the void row,
    plan already cancelled.
  */
  it("a FINAL payment failure also VOIDS THE INVOICE — it can no longer take money", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledWith("in_change");
  });

  /*
    ⚠ THE NEGATIVE CONTROL, and it is the arm that stops this becoming noise.
    Stripe redelivers failed events for DAYS, and it rejects `voidInvoice` on
    anything not `open`. A blind call would log a failure on every benign
    redelivery of an invoice we already voided.
  */
  it("an invoice that is already closed is NOT voided again", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "void" });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  /*
    ⚠ AN `uncollectible` INVOICE IS VOIDED, AND THIS ARM IS THE PR #764 REVIEW'S
    FINDING 1 — a real defect in the first shape of this fix, caught because the
    docblock asserted something about Stripe that was never checked.

    `uncollectible` is bad-debt bookkeeping, which is EXACTLY what somebody
    marks a finally-failed invoice as. It is not terminal — Stripe allows
    uncollectible → paid, so the invoice can still take money — and it is
    voidable. Reading it as "already closed" left this card's whole defect
    alive on that road while logging that it had been handled.
  */
  it("an UNCOLLECTIBLE invoice IS voided — it is bad debt, not closed, and can still be paid", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "uncollectible" });
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });

    await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(invoicesVoid).toHaveBeenCalledWith("in_change");
  });

  /*
    PR #764 review note 2 — the blast radius is wider than this suite's framing
    and that is INTENDED, so it gets an arm rather than a sentence. The void
    sits in the final-failure branch unconditionally, so it also closes a plain
    RENEWAL's invoice, which carries no settlement row at all. That is the same
    ledger disagreement in a milder form — a late-paid renewal against a
    subscription already cancelled and downgraded to free — and it is the case
    production will meet first.
  */
  it("a finally-failed RENEWAL invoice is voided too, with no settlement row in sight", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);
    invoicesRetrieve.mockResolvedValue({ amount_due: 29_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_renewal", status: "void" });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_renewal",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 29_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledWith("in_renewal");
  });

  /*
    A paid invoice is the same refusal and is worth its own arm, because this
    is the one status where voiding would be actively wrong rather than merely
    rejected: the money is already ours.
  */
  it("a PAID invoice is never voided", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "paid" });

    await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  /*
    A void that throws must not fail the EVENT. Stripe would redeliver, and a
    redelivery re-runs the settlement void and the auto-cancel — both already
    done — to retry a call that will fail the same way. The invoice staying
    payable is the pre-existing exposure, not a new one.
  */
  it("a failing void does not fail the event", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockRejectedValue(new Error("stripe said no"));

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
  });

  it("an INTERMEDIATE failure leaves the invoice alone — Stripe's retry needs it payable", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });

    await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: NOW_SEC + 3 * DAY,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  it("an INTERMEDIATE failure leaves the move pending — Stripe's retry is the retry", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: NOW_SEC + 3 * DAY,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(db.resolvePlanChangeSettlement).not.toHaveBeenCalled();
  });

  it("a failed application fails the EVENT loud, so Stripe redelivers", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    db.addCredits.mockResolvedValue({ success: false, error: "db exploded" });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(false);
    expect(db.resolvePlanChangeSettlement).not.toHaveBeenCalled();
  });

  it("a VOID row stays void even if its invoice somehow pays later — nothing moves", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow, status: "void" as const });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.deductCredits).not.toHaveBeenCalled();
  });

  it("a subscription DYING voids its user's pending settlements — the voluntary-cancel road (review finding 3)", async () => {
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(1);
    /* The dying subscription IS the one on record — the live-cancel case. */
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      /* subscription events are tag-checked — this one is ours. */
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(db.voidPendingPlanChangeSettlementsForUser).toHaveBeenCalledWith(7);
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.deductCredits).not.toHaveBeenCalled();
  });

  it("a STALE redelivered deleted event (different subscription on record) does NOT void — a void is irreversible (round-2 finding 1)", async () => {
    /* The user cancelled sub_OLD, resubscribed as sub_NEW, and upgraded;
       sub_OLD's deleted event redelivers days later. Voiding here would
       kill sub_NEW's pending settlement forever. */
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
    });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_OLD",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
  });

  it("an invoice with NO settlement recorded settles nothing and changes nothing (the control)", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_renewal",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_cycle",
      lines: {
        data: [
          {
            price: { recurring: { interval: "month" } },
            proration: false,
            period: { start: NOW_SEC, end: NOW_SEC + 30 * DAY },
          },
        ],
      },
    });

    /* The ordinary renewal refresh is untouched by #711. */
    expect(result.success).toBe(true);
    expect(db.refreshMonthlyCredits).toHaveBeenCalledTimes(1);
    expect(db.addCredits).not.toHaveBeenCalled();
  });
});
