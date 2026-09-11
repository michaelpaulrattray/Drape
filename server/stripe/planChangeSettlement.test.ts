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
  voidPendingPlanChangeSettlementsForUser: vi.fn().mockResolvedValue([]),
  getVoidPlanChangeSettlementInvoiceIdsForUser: vi.fn().mockResolvedValue([]),
  getDb: vi.fn().mockResolvedValue(null),
  withTransaction: vi.fn(),
}));

vi.mock("../db", () => db);

/* The webhook's idempotency pre-check reads the connection module directly.
   The double RECORDS what the handler asks it to record (PR #786 round 2):
   a redelivery arm must be able to see that a failed event was NOT marked
   processed, or it drives a road production cannot take. */
const processedEventInserts = vi.hoisted(() => [] as Array<{ eventId: string; eventType: string }>);
vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({
      values: (row: { eventId: string; eventType: string }) => ({
        onDuplicateKeyUpdate: async () => {
          processedEventInserts.push(row);
        },
      }),
    }),
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
  db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue([]);
  db.getVoidPlanChangeSettlementInvoiceIdsForUser.mockResolvedValue([]);
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
  let lastEvent: Stripe.Event | null = null;
  async function deliverEvent(type: string, object: Record<string, unknown>) {
    const event = stripeEvent(type, object);
    lastEvent = event;
    const svc = await import("./stripeService");
    const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
    (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(event);
    return handleStripeWebhook("{}", "sig");
  }

  /** Stripe sending the SAME event again — same id, not a fresh one. */
  async function redeliverLastEvent() {
    if (!lastEvent) throw new Error("nothing delivered yet");
    const svc = await import("./stripeService");
    const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
    (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(lastEvent);
    return handleStripeWebhook("{}", "sig");
  }

  beforeEach(() => {
    processedEventInserts.length = 0;
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
    This arm used to pin the OPPOSITE — "a failing void does not fail the
    event", on the reasoning that a redelivery would re-run the settlement void
    and the auto-cancel to retry a call that would fail the same way, and that
    the invoice staying payable was a pre-existing exposure. #788 (PR #786's
    round-2 class, one road over): a handler that returns success is ACKed 200
    and RECORDED, so Stripe never redelivers and the invoice stays payable on
    the hosted page indefinitely. A transient Stripe error is exactly what a
    redelivery heals — the settlement void and the downgrade are idempotent,
    the cancel of a dead subscription is caught, and `voidInvoice` reads the
    status first. So a failed void now FAILS THE EVENT, after the cancel and
    the downgrade have landed, and the arm drives the SAME event id twice
    through the recording idempotency double — the road production takes.
  */
  it("a failed invoice void on the FINAL-FAILURE road FAILS THE EVENT after the cancel and downgrade land, and the SAME event redelivered voids it (#788)", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockRejectedValueOnce(new Error("stripe blipped"));

    const failedInvoice = {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    };

    /* First delivery: Stripe blips on the void. The event FAILS — that is
       what makes Stripe send it again — but the cancel and the downgrade
       have landed, and nothing was recorded as processed. */
    const first = await deliverEvent("invoice.payment_failed", failedInvoice);
    expect(first.success).toBe(false);
    expect(first.message).toContain("could not be voided");
    expect(invoicesVoid).toHaveBeenCalledTimes(1);
    expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
    );
    expect(processedEventInserts).toHaveLength(0);

    /* Redelivery of the SAME event id: the invoice — still open — is voided
       and the event is recorded. */
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
    const second = await redeliverLastEvent();
    expect(second.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledTimes(2);
    expect(invoicesVoid).toHaveBeenLastCalledWith("in_change");
    expect(processedEventInserts).toHaveLength(1);
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
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change"]);
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
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

  /*
    #765 — THE INVOICE SIDE OF THAT VOID, on the voluntary-cancel road. Founder
    ruling 2026-09-10, option A: "close the invoice too, the same as the
    payment-failure road". Until this arm the settlement row was voided and
    the invoice it hung on stayed `open` — payable through Stripe's hosted
    page for a plan the customer no longer had, against credits the void row
    would refuse. Every id the db helper hands back is voided, which is why
    the helper returns ids and not a count.
  */
  it("a subscription DYING also VOIDS every pending settlement's INVOICE — nobody can pay for a plan they cancelled (#765)", async () => {
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change", "in_switch"]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ status: "void" });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledTimes(2);
    expect(invoicesVoid).toHaveBeenCalledWith("in_change");
    expect(invoicesVoid).toHaveBeenCalledWith("in_switch");
    /* The downgrade still lands — the void is beside it, not instead of it. */
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
    );
  });

  /*
    PR #786 review, finding 1 (round 1) — the road it mirrors self-heals
    because it calls `voidInvoice` on every redelivery; this one gated the
    loop on rows that had JUST moved, so one transient Stripe error left the
    invoice payable forever. The helper now hands back already-void rows too.

    ⚠ AND ROUND 2 READ THE MACHINERY: a handler that returns success is ACKed
    200 and recorded, so Stripe never redelivers and the guard would refuse
    it if it did — the retry the docblock promised could not fire. So a
    failed void now FAILS THE EVENT (after the downgrade). The arm below
    drives the SAME event id twice, which is the road production takes, and
    the first delivery must NOT be recorded as processed.
  */
  it("a failed invoice void FAILS THE EVENT after the downgrade lands, and the SAME event redelivered voids it (review finding 1, rounds 1 and 2)", async () => {
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change"]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    const deleted = {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    };

    /* First delivery: Stripe blips on the void. The event FAILS — that is
       what makes Stripe send it again — but the downgrade has landed. */
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockRejectedValueOnce(new Error("stripe blipped"));
    const first = await deliverEvent("customer.subscription.deleted", deleted);
    expect(first.success).toBe(false);
    expect(first.message).toContain("could not be voided");
    expect(invoicesVoid).toHaveBeenCalledTimes(1);
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
    );
    expect(processedEventInserts).toHaveLength(0);

    /* Redelivery of the SAME event id: the row is already void; the helper
       still names its invoice, and the invoice — still open — is voided. */
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
    const second = await redeliverLastEvent();
    expect(second.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledTimes(2);
    expect(invoicesVoid).toHaveBeenLastCalledWith("in_change");
    expect(processedEventInserts).toHaveLength(1);
  });

  it("a subscription DYING with NOTHING pending touches no invoice (the control)", async () => {
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue([]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(invoicesRetrieve).not.toHaveBeenCalled();
    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  it("a void that Stripe refuses on the cancel road FAILS the event so it is redelivered — and the downgrade still lands first", async () => {
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change"]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockRejectedValue(new Error("stripe said no"));

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(false);
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free" }),
    );
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
    expect(invoicesVoid).not.toHaveBeenCalled();
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

  /*
    #792 — the class of #788/#789 on the subscription roads. `updateUserSubscription`
    never throws; a failed write came back `{ success: false }`, the handler
    dropped it and returned success, and the event was ACKed 200 and recorded —
    so Stripe never redelivered and the change the event carried never landed.
    Every arm drives the SAME event id twice through the recording double:
    first delivery fails and is NOT recorded, redelivery lands and is recorded
    once. A fresh id would prove nothing.
  */
  describe("#792 — the subscription roads read the write's verdict", () => {
    const monthlySub = (id: string, status = "active") => ({
      id,
      customer: "cus_1",
      status,
      metadata: { plan: "pro", env: deploymentTag() },
      items: {
        data: [
          {
            id: "si_1",
            price: { recurring: { interval: "month" } },
            current_period_start: NOW_SEC,
            current_period_end: NOW_SEC + 30 * DAY,
          },
        ],
      },
    });

    it("subscription.updated: a write that fails FAILS THE EVENT, and the SAME event redelivered writes the same state once", async () => {
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const first = await deliverEvent("customer.subscription.updated", monthlySub("sub_1"));
      expect(first.success).toBe(false);
      expect(first.message).toContain("could not be written");
      expect(first.message).toContain("redeliver");
      expect(processedEventInserts).toHaveLength(0);

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(2);
      /* The retry is the same UPDATE — the event's own state, not a guess. */
      expect(db.updateUserSubscription.mock.calls[0]).toEqual(db.updateUserSubscription.mock.calls[1]);
      expect(db.updateUserSubscription).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({ stripeSubscriptionId: "sub_1", planTier: "pro", billingInterval: "month" }),
      );
      expect(processedEventInserts).toHaveLength(1);
      expect(processedEventInserts[0].eventId).toBe(lastEvent!.id);
    });

    it("subscription.deleted: a downgrade that fails FAILS THE EVENT, and the SAME event redelivered downgrades", async () => {
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
      });
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const first = await deliverEvent("customer.subscription.deleted", monthlySub("sub_1", "canceled"));
      expect(first.success).toBe(false);
      expect(first.message).toContain("downgrade could not be written");
      expect(processedEventInserts).toHaveLength(0);

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(2);
      expect(db.updateUserSubscription).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null, subscriptionStatus: "canceled" }),
      );
      expect(processedEventInserts).toHaveLength(1);
    });

    it("subscription.deleted: a STALE delivery (a newer subscription on record) leaves the plan ALONE — the downgrade is under the same guard as the void", async () => {
      /* The failure above makes Stripe redeliver for days; if the customer
         resubscribes in that window, the retry must not downgrade sub_NEW. */
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });

      const result = await deliverEvent("customer.subscription.deleted", monthlySub("sub_OLD", "canceled"));
      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(1);
    });

    it("subscription.deleted: a failed invoice void redelivered AFTER the customer resubscribed still closes the OLD invoice — and never touches the new subscription's pending row (PR #794 review finding 1)", async () => {
      /* First delivery: sub_OLD dies on record, its settlement row goes
         void, Stripe blips on the invoice void. The event FAILS. */
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_OLD" },
      });
      db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_old_change"]);
      invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
      invoicesVoid.mockRejectedValueOnce(new Error("stripe blipped"));

      const first = await deliverEvent("customer.subscription.deleted", monthlySub("sub_OLD", "canceled"));
      expect(first.success).toBe(false);
      expect(first.message).toContain("could not be voided");
      expect(processedEventInserts).toHaveLength(0);

      /* The customer resubscribes as sub_NEW and changes plan — a PENDING
         settlement of theirs now exists that must survive. The redelivery
         finds sub_NEW on record. */
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });
      db.voidPendingPlanChangeSettlementsForUser.mockClear();
      db.getVoidPlanChangeSettlementInvoiceIdsForUser.mockResolvedValue(["in_old_change"]);
      invoicesVoid.mockResolvedValue({ id: "in_old_change", status: "void" });

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      /* The writer never ran on the stale road — sub_NEW's pending row is
         untouched — and the plan is left alone: the one downgrade on record
         is the FIRST delivery's, which landed before the void blipped. */
      expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(1);
      /* But the OLD invoice, whose credit side is already void, is closed. */
      expect(invoicesVoid).toHaveBeenCalledTimes(2);
      expect(invoicesVoid).toHaveBeenLastCalledWith("in_old_change");
      expect(processedEventInserts).toHaveLength(1);
    });

    it("subscription.deleted: NULL on record still downgrades (the voluntary-cancel road clears the id first) — the control", async () => {
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: null },
      });

      const result = await deliverEvent("customer.subscription.deleted", monthlySub("sub_1", "canceled"));
      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
      );
    });

    it("invoice.payment_failed FINAL: a downgrade that fails FAILS THE EVENT after the cancel and the voids, and the SAME event redelivered downgrades", async () => {
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
      });
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
      invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
      invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const failedInvoice = {
        id: "in_change",
        customer: "cus_1",
        subscription: "sub_1",
        next_payment_attempt: null,
        amount_due: 12_00,
        currency: "usd",
      };

      const first = await deliverEvent("invoice.payment_failed", failedInvoice);
      expect(first.success).toBe(false);
      expect(first.message).toContain("downgrade could not be written");
      /* Everything keyed on THIS invoice and THIS subscription landed first. */
      expect(invoicesVoid).toHaveBeenCalledTimes(1);
      expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
      expect(processedEventInserts).toHaveLength(0);

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(2);
      expect(db.updateUserSubscription).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
      );
      expect(processedEventInserts).toHaveLength(1);
    });

    it("invoice.payment_failed FINAL: a STALE delivery (a newer subscription on record) voids and cancels the OLD one but leaves the plan alone", async () => {
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
      invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
      invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });

      const result = await deliverEvent("invoice.payment_failed", {
        id: "in_change",
        customer: "cus_1",
        subscription: "sub_OLD",
        next_payment_attempt: null,
        amount_due: 12_00,
        currency: "usd",
      });

      expect(result.success).toBe(true);
      expect(invoicesVoid).toHaveBeenCalledWith("in_change");
      expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_OLD", { cancel_at_period_end: true });
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
    });

    it("invoice.payment_failed INTERMEDIATE: a past_due mark that fails is logged and the event is still ACKed — the one site in the class that is DECLINED", async () => {
      /* A redelivered mark could land over a since-successful payment and
         flip `hasSubscription` false on a paying account; the next invoice
         event rewrites the status either way. Pinned as a decision, not as an
         oversight — the verdict IS read (the failing write is what this arm
         supplies), it just does not fail the event. */
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const result = await deliverEvent("invoice.payment_failed", {
        id: "in_change",
        customer: "cus_1",
        subscription: "sub_1",
        next_payment_attempt: NOW_SEC + 3 * DAY,
        amount_due: 12_00,
        currency: "usd",
      });

      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(7, { subscriptionStatus: "past_due" });
      expect(processedEventInserts).toHaveLength(1);
    });

    it("invoice.payment_failed INTERMEDIATE: a STALE delivery (a newer subscription on record) does NOT mark the active account past_due (PR #794 round-2 finding 1)", async () => {
      /* The write is keyed on the user; a late failure for sub_OLD landing
         over an active sub_NEW would flip hasSubscription false on its
         FIRST delivery and send a paying customer to a fresh checkout. */
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

      const result = await deliverEvent("invoice.payment_failed", {
        id: "in_old_renewal",
        customer: "cus_1",
        subscription: "sub_OLD",
        next_payment_attempt: NOW_SEC + 3 * DAY,
        amount_due: 12_00,
        currency: "usd",
      });

      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(1);
    });
  });
});
