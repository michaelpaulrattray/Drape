/**
 * A REFUND THAT DID NOT PAY IS NOT "ISSUED" (#771) — founder ruling
 * 2026-09-10, option C: refuse the obvious failure at create time AND listen
 * for the later one, which is the road a real refund failure actually takes.
 *
 * Two halves, both driven against the real entrances with Stripe and the
 * database doubled at their module boundaries:
 *
 *   A. `issueStripeRefund` — Stripe creates the refund and reports it
 *      `failed` / `canceled` in the same breath. Before #771 the function
 *      logged that status inside a sentence saying "issued" and returned
 *      `success: true`, so the executor deducted the customer's credits.
 *      `pending` is COMMON AND BENIGN (a bank refund lands days later) and
 *      must keep succeeding, so the arm that matters most is the pending one.
 *
 *   B. the `refund.failed` webhook — the deduction has already happened days
 *      ago; the handler finds it by the tracking the refund carries in its
 *      Stripe metadata, puts the credits back once, writes the truth on the
 *      change request, and lands a critical audit row on the staff panels.
 *      Production has no Slack webhook, so the panels ARE the surface.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { refundsCreate, sessionsRetrieve } = vi.hoisted(() => ({
  refundsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    refunds = { create: refundsCreate };
    checkout = { sessions: { create: vi.fn(), retrieve: sessionsRetrieve } };
    invoices = { retrieve: vi.fn(), voidInvoice: vi.fn() };
    prices = { create: vi.fn() };
    subscriptions = { retrieve: vi.fn(), update: vi.fn() };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
  },
}));

const db = vi.hoisted(() => ({
  getUserByStripeCustomerId: vi.fn(),
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  refreshMonthlyCredits: vi.fn(),
  getUserCredits: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  getCreditTransactionByRef: vi.fn(),
  appendChangeRequestReviewNote: vi.fn(),
  voidPendingPlanChangeSettlementsForUser: vi.fn().mockResolvedValue([]),
  getDb: vi.fn().mockResolvedValue(null),
}));
vi.mock("../db", () => db);

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => undefined }) }),
  })),
}));

const audit = vi.hoisted(() => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../auditLog", async () => {
  const schema = await vi.importActual<typeof import("../../drizzle/schema")>("../../drizzle/schema");
  return { logAuditEvent: audit.logAuditEvent, AUDIT_ACTIONS: schema.AUDIT_ACTIONS };
});

vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: new Proxy({}, { get: () => vi.fn().mockResolvedValue(true) }),
}));

import {
  issueStripeRefund,
  REFUND_METADATA_USER_KEY,
  REFUND_METADATA_CHANGE_REQUEST_KEY,
} from "./stripeService";
import { handleStripeWebhook } from "./webhooks";
import { deploymentTag } from "../_core/env";

let eventSeq = 0;
function stripeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  eventSeq += 1;
  return {
    id: `evt_771_${eventSeq}`,
    type,
    data: { object },
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

async function deliverEvent(type: string, object: Record<string, unknown>) {
  const event = stripeEvent(type, object);
  const svc = await import("./stripeService");
  const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
  (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(event);
  return handleStripeWebhook("{}", "sig");
}

/** A refund object as `refund.failed` carries it, stamped the way we stamp. */
function failedRefund(overrides: Record<string, unknown> = {}) {
  return {
    id: "re_dead",
    object: "refund",
    amount: 40_00,
    currency: "usd",
    status: "failed",
    failure_reason: "expired_or_canceled_card",
    metadata: {
      env: deploymentTag(),
      reason: "Change request #7",
      [REFUND_METADATA_USER_KEY]: "42",
      [REFUND_METADATA_CHANGE_REQUEST_KEY]: "7",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionsRetrieve.mockResolvedValue({ payment_intent: "pi_1", amount_total: 60_00 });
  db.addCredits.mockResolvedValue({ success: true, newBalance: 550 });
  db.appendChangeRequestReviewNote.mockResolvedValue({ success: true });
  db.getCreditTransactionByRef.mockResolvedValue(null);
});

describe("A · issueStripeRefund — a create-time failed/canceled refund is REFUSED, nothing else is", () => {
  for (const status of ["failed", "canceled"] as const) {
    it(`Stripe creating the refund and answering "${status}" comes back as success:false with the status beside it`, async () => {
      refundsCreate.mockResolvedValue({
        id: "re_dead",
        amount: 40_00,
        status,
        failure_reason: "expired_or_canceled_card",
      });

      const result = await issueStripeRefund("cs_1", 40_00, "Change request #7", {
        userId: 42,
        changeRequestId: 7,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(status);
      expect(result.refundId).toBe("re_dead");
      expect(result.error).toContain(status);
      expect(result.error).toContain("expired_or_canceled_card");
      /* And it says what to do, in a support person's words. */
      expect(result.error).toContain("left alone");
    });
  }

  /*
    ⚠ THE ARM THAT KEEPS THIS FROM STALLING ORDINARY REFUNDS. `pending` is the
    normal answer for a card refund — the money lands days later — and
    `requires_action` is a refund waiting on the customer. Treating either as
    a failure would leave every routine refund for a human.
  */
  for (const status of ["pending", "succeeded", "requires_action"] as const) {
    it(`"${status}" is NOT a failure — the refund is reported issued`, async () => {
      refundsCreate.mockResolvedValue({ id: "re_ok", amount: 40_00, status });

      const result = await issueStripeRefund("cs_1", 40_00);

      expect(result.success).toBe(true);
      expect(result.refundId).toBe("re_ok");
      expect(result.status).toBe(status);
    });
  }

  it("stamps who and which request on the refund's Stripe metadata, beside the env tag (assert at the wire)", async () => {
    refundsCreate.mockResolvedValue({ id: "re_ok", amount: 40_00, status: "pending" });

    await issueStripeRefund("cs_1", 40_00, "Change request #7", { userId: 42, changeRequestId: 7 });

    expect(refundsCreate).toHaveBeenCalledTimes(1);
    const sent = refundsCreate.mock.calls[0][0] as Stripe.RefundCreateParams;
    expect(sent.metadata).toMatchObject({
      env: deploymentTag(),
      reason: "Change request #7",
      [REFUND_METADATA_USER_KEY]: "42",
      [REFUND_METADATA_CHANGE_REQUEST_KEY]: "7",
    });
  });

  it("a refund issued WITHOUT tracking carries the env tag and reason only — the keys are absent, not empty strings", async () => {
    refundsCreate.mockResolvedValue({ id: "re_ok", amount: 40_00, status: "pending" });

    await issueStripeRefund("cs_1", 40_00, "goodwill");

    const sent = refundsCreate.mock.calls[0][0] as Stripe.RefundCreateParams;
    expect(sent.metadata).toEqual({ env: deploymentTag(), reason: "goodwill" });
  });
});

describe("B · refund.failed — the later failure puts the credits back and tells the panels", () => {
  it("restores exactly the credits the change request deducted, once, keyed on its own ledger reference", async () => {
    db.getCreditTransactionByRef.mockResolvedValue({ id: 1, amount: -50, referenceId: "cr-stripe-refund:7" });

    const result = await deliverEvent("refund.failed", failedRefund());

    expect(result.success).toBe(true);
    expect(db.getCreditTransactionByRef).toHaveBeenCalledWith(42, "cr-stripe-refund:7");
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(db.addCredits).toHaveBeenCalledWith(
      42,
      50,
      "refund",
      expect.stringContaining("re_dead"),
      "cr-stripe-refund-failed:7",
    );
    expect(result.message).toContain("50 credits restored");
  });

  it("writes the truth onto the change request — the screen a support person reads", async () => {
    db.getCreditTransactionByRef.mockResolvedValue({ id: 1, amount: -50, referenceId: "cr-stripe-refund:7" });

    await deliverEvent("refund.failed", failedRefund());

    expect(db.appendChangeRequestReviewNote).toHaveBeenCalledTimes(1);
    const [crId, note] = db.appendChangeRequestReviewNote.mock.calls[0];
    expect(crId).toBe(7);
    expect(note).toContain("FAILED");
    expect(note).toContain("re_dead");
    expect(note).toContain("expired_or_canceled_card");
    expect(note).toContain("$40.00");
    expect(note).toContain("50 credits restored");
  });

  it("lands a CRITICAL billing.stripe_refund_failed audit row naming the customer, the request and what moved", async () => {
    db.getCreditTransactionByRef.mockResolvedValue({ id: 1, amount: -50, referenceId: "cr-stripe-refund:7" });

    await deliverEvent("refund.failed", failedRefund());

    expect(audit.logAuditEvent).toHaveBeenCalledTimes(1);
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "billing.stripe_refund_failed",
        resourceType: "billing",
        resourceId: "re_dead",
        severity: "critical",
        metadata: expect.objectContaining({
          targetUserId: 42,
          changeRequestId: 7,
          stripeRefundId: "re_dead",
          failureReason: "expired_or_canceled_card",
          refundAmountCents: 40_00,
          creditsRestored: 50,
          identified: true,
        }),
      }),
    );
  });

  it("a REDELIVERED event cannot restore twice — the ledger's duplicate verdict is read, not the balance", async () => {
    db.getCreditTransactionByRef.mockResolvedValue({ id: 1, amount: -50, referenceId: "cr-stripe-refund:7" });
    db.addCredits.mockResolvedValue({ success: true, duplicate: true, newBalance: 550 });

    const result = await deliverEvent("refund.failed", failedRefund());

    expect(result.success).toBe(true);
    expect(result.message).toContain("already restored");
    /* The note and the row still say what happened; nothing about the
       customer's balance is a second time. */
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ creditsRestored: 0 }) }),
    );
  });

  it("a request that deducted NOTHING (balance already spent) restores nothing and still reports", async () => {
    db.getCreditTransactionByRef.mockResolvedValue(null);

    const result = await deliverEvent("refund.failed", failedRefund());

    expect(result.success).toBe(true);
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.appendChangeRequestReviewNote).toHaveBeenCalledTimes(1);
    expect(String(db.appendChangeRequestReviewNote.mock.calls[0][1])).toContain("No credits were restored");
    expect(audit.logAuditEvent).toHaveBeenCalledTimes(1);
  });

  /*
    ⚠ THE NEGATIVE CONTROL. A refund made by hand in the Stripe dashboard
    carries none of our tracking. Guessing a customer from the charge and
    moving credits on a guess is the defect this card is about, one road
    over — so it is REPORTED for a person and nothing moves.
  */
  it("a refund WITHOUT our tracking metadata moves no credits and is reported as unidentified", async () => {
    const result = await deliverEvent("refund.failed", failedRefund({ metadata: { env: deploymentTag() } }));

    expect(result.success).toBe(true);
    expect(db.getCreditTransactionByRef).not.toHaveBeenCalled();
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.appendChangeRequestReviewNote).not.toHaveBeenCalled();
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "billing.stripe_refund_failed",
        severity: "critical",
        metadata: expect.objectContaining({ identified: false, stripeRefundId: "re_dead" }),
      }),
    );
  });

  it("tracking that does not parse as ids is treated as absent, never as user 0", async () => {
    const result = await deliverEvent(
      "refund.failed",
      failedRefund({
        metadata: {
          env: deploymentTag(),
          [REFUND_METADATA_USER_KEY]: "forty-two",
          [REFUND_METADATA_CHANGE_REQUEST_KEY]: "7",
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ identified: false }) }),
    );
  });

  it("a failed restore does not fail the event — the note and the row still land, and say so", async () => {
    db.getCreditTransactionByRef.mockResolvedValue({ id: 1, amount: -50, referenceId: "cr-stripe-refund:7" });
    db.addCredits.mockResolvedValue({ success: false, error: "db exploded" });

    const result = await deliverEvent("refund.failed", failedRefund());

    expect(result.success).toBe(true);
    expect(result.message).toContain("credit restore failed");
    expect(db.appendChangeRequestReviewNote).toHaveBeenCalledTimes(1);
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ creditsRestored: 0, reason: expect.stringContaining("credit restore failed") }),
      }),
    );
  });
});
