/**
 * `billing.changePlan` WHEN THE CHARGE DID NOT GO THROUGH (#2190) — driven
 * through the real router, with Stripe's service, the database, the schedule
 * module and the settlement module doubled at their boundaries.
 *
 * Before #2190 a declined upgrade still returned success: the record was
 * written to the new plan, a settlement was queued, and the customer read
 * "Upgraded to Pro! Your bonus credits land as soon as the payment settles".
 * Stripe now holds an unpaid change and `updateSubscriptionPlan` cancels the
 * hold, so the honest answer is a refusal in the customer's own words — and
 * nothing after it may run. The paid change is this file's positive control:
 * the same entrance, the same quote, and every one of those steps happens.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  getUserCredits: vi.fn(),
}));

vi.mock("./stripeService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripeService")>();
  return {
    stripe: {},
    PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE: actual.PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE,
    PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE: actual.PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
    planChangeNotChargedSentence: actual.planChangeNotChargedSentence,
    getOrCreateStripeCustomer: vi.fn(),
    createSubscriptionCheckoutSession: vi.fn(),
    createTopupCheckoutSession: vi.fn(),
    createCustomerPortalSession: vi.fn(),
    getSubscriptionDetails: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    readSubscriptionBillingState: vi.fn(),
    quotePlanChange: vi.fn(),
    updateSubscriptionPlan: vi.fn(),
    cancelHeldChange: vi.fn(),
    getInvoiceStatus: vi.fn(),
    getCustomerInvoices: vi.fn(),
    getAllCustomerInvoices: vi.fn(),
  };
});

vi.mock("./subscriptionSchedule", () => ({
  scheduleSubscriptionChange: vi.fn(),
  releaseScheduleBeforeWrite: vi.fn(),
  readPendingPlanChange: vi.fn(),
}));

vi.mock("./planChangeSettlement", () => ({
  queuePlanChangeSettlement: vi.fn(),
  applyPlanChangeSettlement: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "../routes/billing";
import {
  addCredits,
  getSubscriptionByUserId,
  getUserById,
  updateUserSubscription,
} from "../db";
import {
  PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE,
  PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
  planChangeNotChargedSentence,
  cancelHeldChange,
  getInvoiceStatus,
  quotePlanChange,
  readSubscriptionBillingState,
  updateSubscriptionPlan,
} from "./stripeService";
import { releaseScheduleBeforeWrite } from "./subscriptionSchedule";
import { applyPlanChangeSettlement, queuePlanChangeSettlement } from "./planChangeSettlement";
import { logAuditEvent } from "../auditLog";
import { SpokenError } from "../_core/spokenError";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);
const PERIOD_END_SEC = 1_780_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({ id: 42, frozenAt: null, email: "c@example.com" } as never);
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    planTier: "starter",
  } as never);
  vi.mocked(readSubscriptionBillingState).mockResolvedValue({
    subscriptionItemId: "si_base",
    currentPlan: "starter",
    currentInterval: "monthly",
    periodStartSec: PERIOD_END_SEC - 30 * 86_400,
    periodEndSec: PERIOD_END_SEC,
    currentCreditUnits: 0,
    creditItemId: null,
    endsAtSec: null,
    status: "active",
    collectionPaused: false,
  } as never);
  vi.mocked(quotePlanChange).mockReturnValue({
    kind: "same-interval",
    currentInterval: "monthly",
    targetInterval: "monthly",
    isUpgrade: true,
    proratedAmount: 4_100,
    immediateCharge: 4_100,
    creditBalance: 0,
    newPlanPrice: 6_800,
    currentPlanPrice: 2_700,
    currentCreditUnits: 0,
    targetCreditUnits: 0,
    daysRemaining: 20,
    totalDays: 30,
    creditAdjustment: 90_000,
    creditUnwind: 0,
    spentShareCredits: 0,
    spentShareCharge: 0,
    deferred: false,
    effectiveAtSec: PERIOD_END_SEC,
  } as never);
  vi.mocked(releaseScheduleBeforeWrite).mockResolvedValue({ outcome: "nothing-to-release" } as never);
  vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
  vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: true } as never);
  vi.mocked(applyPlanChangeSettlement).mockResolvedValue({ outcome: "applied", creditsMoved: 90_000 } as never);
  vi.mocked(cancelHeldChange).mockResolvedValue("voided" as never);
});

describe("changePlan — a charge that did not go through", () => {
  it("refuses in the customer's words, and writes no plan, queues no credits and logs no plan change", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      paymentDeclined: true,
      heldChangeCancelled: true,
      invoiceId: "in_held",
      invoiceStatus: null,
      error: PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE,
    });

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE);
    /* Marked as a sentence written for a person, so the formatter flags it
       `spoken` and the client shows it rather than its own fallback. */
    expect(error).toBeInstanceOf(SpokenError);
    expect((error as { code?: string }).code).toBe("BAD_REQUEST");

    expect(updateUserSubscription).not.toHaveBeenCalled();
    expect(queuePlanChangeSettlement).not.toHaveBeenCalled();
    expect(applyPlanChangeSettlement).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("POSITIVE CONTROL — a paid change still writes the new plan, settles its credits and is logged", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: true,
      invoiceId: "in_paid",
      invoiceStatus: "paid",
      invoicedAmount: 4_100,
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(result.success).toBe(true);
    expect(updateUserSubscription).toHaveBeenCalledWith(42, expect.objectContaining({ planTier: "pro" }));
    expect(queuePlanChangeSettlement).toHaveBeenCalledTimes(1);
    expect(applyPlanChangeSettlement).toHaveBeenCalledWith("in_paid");
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });
});

describe("changePlan — the bank wants a confirmation (the relay's finding 3)", () => {
  it("answers with the confirmation page, QUEUES the credits against that invoice, and writes no plan and logs no change yet", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      confirmationRequired: true,
      confirmUrl: "https://invoice.stripe.example/i/3ds",
      invoiceId: "in_3ds",
      invoiceStatus: "open",
      invoicedAmount: null,
      error: PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
    });
    vi.mocked(getInvoiceStatus).mockResolvedValue("open");

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(result).toMatchObject({
      success: true,
      message: PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
      confirmPaymentUrl: "https://invoice.stripe.example/i/3ds",
      creditSettlement: "pending",
    });
    /* The credits wait on THAT invoice — its payment event settles them. */
    expect(queuePlanChangeSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ stripeInvoiceId: "in_3ds", direction: "grant", credits: 90_000, previousPlanTier: "starter" }),
    );
    expect(applyPlanChangeSettlement).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
    /* Nothing has happened yet, so nothing says it has. */
    expect(updateUserSubscription).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("an ordinary paid change carries no confirmation page", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: true,
      invoiceId: "in_paid",
      invoiceStatus: "paid",
      invoicedAmount: 4_100,
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(result.confirmPaymentUrl).toBeNull();
  });

  /* The relay's finding 2 on head 1759052fc: with the plan held at Stripe,
     a settlement row that could not be written leaves an invoice the customer
     can still pay from their own invoice list — and paying it would apply the
     plan with nothing owing them the credits. */
  it("R2 · a settlement that cannot be recorded CANCELS the hold and says nothing changed — never 'the plan changed, but…'", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      confirmationRequired: true,
      confirmUrl: "https://invoice.stripe.example/i/3ds",
      invoiceId: "in_3ds",
      invoiceStatus: "open",
      invoicedAmount: null,
      error: PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
    });
    vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: false } as never);

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SpokenError);
    expect((error as Error).message).toBe(
      planChangeNotChargedSentence({ reason: "not-recorded", scheduleLostOn: null }),
    );
    expect((error as Error).message).not.toContain("The plan changed");
    /* The hold is gone, so that invoice can no longer be paid. */
    expect(cancelHeldChange).toHaveBeenCalledWith("in_3ds");
    expect(updateUserSubscription).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  /* What the cancel ANSWERED decides what is said — the relay's finding 5
     one road along. Only a hold that is actually gone earns "not charged". */
  it("R2 · a hold PAID in that instant is a change that went through, and is never reported as 'your card was not charged'", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      confirmationRequired: true,
      confirmUrl: "https://invoice.stripe.example/i/3ds",
      invoiceId: "in_3ds",
      invoiceStatus: "open",
      invoicedAmount: null,
      error: PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
    });
    vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: false } as never);
    vi.mocked(cancelHeldChange).mockResolvedValue("paid" as never);

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect((error as Error).message).toContain("The plan changed");
    expect((error as Error).message).not.toContain("was not charged");
    expect((error as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("R2 · a hold that could NOT be cancelled is still payable, so the outcome is not stated as 'not charged'", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      confirmationRequired: true,
      confirmUrl: "https://invoice.stripe.example/i/3ds",
      invoiceId: "in_3ds",
      invoiceStatus: "open",
      invoicedAmount: null,
      error: PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
    });
    vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: false } as never);
    vi.mocked(cancelHeldChange).mockResolvedValue("failed" as never);

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect((error as Error).message).toBe(
      planChangeNotChargedSentence({ reason: "unconfirmed", scheduleLostOn: null }),
    );
    expect((error as Error).message).not.toContain("was not charged");
    expect((error as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("R2 · an UNWIND whose settlement cannot be recorded is cancelled too — a payable hold is the customer's problem whichever way the credits were going", async () => {
    vi.mocked(quotePlanChange).mockReturnValue({
      kind: "interval-switch",
      currentInterval: "monthly",
      targetInterval: "annual",
      isUpgrade: true,
      proratedAmount: 60_000,
      immediateCharge: 60_000,
      creditBalance: 0,
      newPlanPrice: 68_000,
      currentPlanPrice: 2_700,
      currentCreditUnits: 0,
      targetCreditUnits: 0,
      daysRemaining: 20,
      totalDays: 30,
      creditAdjustment: 0,
      creditUnwind: 12_000,
      spentShareCredits: 0,
      spentShareCharge: 0,
      deferred: false,
      effectiveAtSec: PERIOD_END_SEC,
    } as never);
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      confirmationRequired: true,
      confirmUrl: "https://invoice.stripe.example/i/3ds",
      invoiceId: "in_3ds",
      invoiceStatus: "open",
      invoicedAmount: null,
      error: PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
    });
    vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: false } as never);

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SpokenError);
    expect(cancelHeldChange).toHaveBeenCalledWith("in_3ds");
  });

  it("POSITIVE CONTROL — the same failure on an APPLIED change keeps its old road: no void, and the plan did change", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: true,
      invoiceId: "in_paid",
      invoiceStatus: "paid",
      invoicedAmount: 4_100,
    });
    vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: false } as never);

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect((error as Error).message).toContain("The plan changed");
    expect(cancelHeldChange).not.toHaveBeenCalled();
  });
});

describe("changePlan — the hold's invoice could not be read (the relay's finding 1 on head 1759052fc)", () => {
  it("R1 · refuses RETRYABLY with the service's own sentence — not the declined refusal, and nothing is written", async () => {
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      outcomeUnknown: true,
      invoiceId: "in_held",
      invoiceStatus: null,
      invoicedAmount: null,
      error: planChangeNotChargedSentence({ reason: "unconfirmed", scheduleLostOn: null }),
    });

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SpokenError);
    expect((error as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
    expect((error as Error).message).toBe(
      planChangeNotChargedSentence({ reason: "unconfirmed", scheduleLostOn: null }),
    );
    expect((error as Error).message).not.toBe(PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE);
    expect(updateUserSubscription).not.toHaveBeenCalled();
    expect(queuePlanChangeSettlement).not.toHaveBeenCalled();
    expect(cancelHeldChange).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("the sentence itself", () => {
  it("names no engine or vendor and says what to do, in the label the customer sees", () => {
    expect(PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE).not.toMatch(/stripe|invoice|pending|webhook/i);
    expect(PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE).toContain("Update card");
    expect(PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE).toContain("has not changed");
  });

  it("every variant names no engine or vendor", () => {
    const all = [
      PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
      planChangeNotChargedSentence({ reason: "declined", scheduleLostOn: new Date(1_780_000_000_000) }),
      planChangeNotChargedSentence({ reason: "confirm-blocked-by-schedule", scheduleLostOn: null }),
      planChangeNotChargedSentence({ reason: "confirm-blocked-by-schedule", scheduleLostOn: new Date(1_780_000_000_000) }),
      planChangeNotChargedSentence({ reason: "unconfirmed", scheduleLostOn: null }),
      planChangeNotChargedSentence({ reason: "unconfirmed", scheduleLostOn: new Date(1_780_000_000_000) }),
      planChangeNotChargedSentence({ reason: "not-recorded", scheduleLostOn: null }),
    ];
    for (const sentence of all) expect(sentence).not.toMatch(/stripe|invoice|pending|webhook|3d secure|schedule /i);
  });

  /* The relay's third note on head 1759052fc: setting the scheduled change
     again is what blocked the confirmation, so it cannot come first. */
  it("R3 · every variant that mentions a lost scheduled change puts the RETRY before setting it again", () => {
    const lostOn = new Date(1_780_000_000_000);
    for (const reason of ["declined", "confirm-blocked-by-schedule"] as const) {
      const sentence = planChangeNotChargedSentence({ reason, scheduleLostOn: lostOn });
      const lower = sentence.toLowerCase();
      expect(lower).toContain("try");
      expect(lower.indexOf("try")).toBeLessThan(lower.indexOf("you had scheduled"));
      expect(sentence).not.toMatch(/scheduled for[^.]*\.\s*Then try/i);
    }
  });

  it("R1 · the unconfirmed sentence says nothing about the card, because the card may be fine", () => {
    const sentence = planChangeNotChargedSentence({ reason: "unconfirmed", scheduleLostOn: null });
    expect(sentence).not.toMatch(/card/i);
    expect(sentence).toContain("has not been changed");
    expect(sentence).toContain("Billing");
  });

  it("R2 · the not-recorded sentence says nothing about the card either, and does not claim the plan changed", () => {
    const sentence = planChangeNotChargedSentence({ reason: "not-recorded", scheduleLostOn: null });
    expect(sentence).not.toMatch(/Update card/i);
    expect(sentence).toContain("has not changed");
  });

  it("the routed refusal speaks the service's own sentence, so a lost scheduled change is said", async () => {
    const lost = planChangeNotChargedSentence({ reason: "declined", scheduleLostOn: new Date(1_780_000_000_000) });
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: false,
      paymentDeclined: true,
      heldChangeCancelled: true,
      scheduledChangeRestored: false,
      invoiceId: "in_held",
      invoiceStatus: null,
      error: lost,
    });

    const error = await caller().changePlan({ newPlan: "pro" }).catch((e: unknown) => e);

    expect((error as Error).message).toBe(lost);
  });
});
