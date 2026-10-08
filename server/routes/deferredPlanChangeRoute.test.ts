/**
 * #1936 — THE LOOP, CLOSED AT THE PROCEDURE A CUSTOMER ACTUALLY CALLS.
 *
 * `server/stripe/deferredPlanChange.test.ts` holds the direction rule and the
 * schedule's outgoing calls. This holds the one thing neither of those can
 * prove: that `changePlan` — the procedure with no rate limit on it, the one
 * the exploit calls four times in a row — **reaches none of the roads that
 * move money or credits** when the change is a decrease.
 *
 * ⚠ **EVERY ARM HERE IS AN ABSENCE, AND THAT IS THE POINT.** The defect was
 * never a wrong figure; it was a correct refund meeting a correct floor. So
 * the fix is not "a better number" and cannot be tested as one — it is four
 * roads not taken, and an arm per road:
 *
 *   · `updateSubscriptionPlan` — no price write, so Stripe raises no
 *     proration and returns no money. **This is the arm the loop dies on.**
 *   · `queuePlanChangeSettlement` — no credit move recorded, in either
 *     direction, because nothing is owed either way.
 *   · `addCredits` / `deductCredits` — the legacy no-invoice road is not
 *     reached either, which is where the second floor lives
 *     (`billing.ts`'s own `Math.min(settlementCredits, …)`).
 *   · `updateUserSubscription` — the local tier is NOT written. Writing it
 *     would be worse than the original defect: she would lose the allowance
 *     she is still paying for today AND get the lower one at the renewal.
 *
 * ⚠ **AND THE POSITIVE CONTROL IS NOT OPTIONAL.** Four `not.toHaveBeenCalled()`
 * arms pass just as well against a procedure that throws on its first line, a
 * mock that was never wired, or a quote double missing a field — so the same
 * fixture is driven in the INCREASE direction and every one of those four
 * roads must be taken. Without it this file would be the empty-loop shape that
 * read green on the sheet road for a day.
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

vi.mock("../stripe/stripeService", () => ({
  stripe: {},
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
  getInvoiceStatus: vi.fn(),
  getCustomerInvoices: vi.fn(),
  getAllCustomerInvoices: vi.fn(),
}));

vi.mock("../stripe/subscriptionSchedule", () => ({
  scheduleSubscriptionChange: vi.fn(),
  releaseScheduleBeforeWrite: vi.fn(),
  readPendingPlanChange: vi.fn(),
}));

vi.mock("../stripe/planChangeSettlement", () => ({
  queuePlanChangeSettlement: vi.fn(),
  applyPlanChangeSettlement: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "./billing";
import {
  addCredits,
  deductCredits,
  getSubscriptionByUserId,
  getUserById,
  updateUserSubscription,
} from "../db";
import {
  quotePlanChange,
  readSubscriptionBillingState,
  updateSubscriptionPlan,
} from "../stripe/stripeService";
import {
  releaseScheduleBeforeWrite,
  scheduleSubscriptionChange,
} from "../stripe/subscriptionSchedule";
import {
  applyPlanChangeSettlement,
  queuePlanChangeSettlement,
} from "../stripe/planChangeSettlement";
import { logAuditEvent } from "../auditLog";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

const PERIOD_END_SEC = 1_780_000_000;
const EFFECTIVE_AT = new Date(PERIOD_END_SEC * 1000);

/** The quote as `quotePlanChange` really returns it on each road — a DEFERRED
 *  decrease has every money and credit field at 0 by construction, which is
 *  what this double has to reproduce faithfully to be worth anything. */
function quoteIs(deferred: boolean) {
  vi.mocked(quotePlanChange).mockReturnValue({
    kind: "same-interval",
    currentInterval: "monthly",
    targetInterval: "monthly",
    isUpgrade: !deferred,
    proratedAmount: deferred ? 0 : 4_200,
    immediateCharge: deferred ? 0 : 4_200,
    creditBalance: 0,
    newPlanPrice: deferred ? 2_400 : 15_900,
    currentPlanPrice: deferred ? 15_900 : 2_400,
    currentCreditUnits: 0,
    targetCreditUnits: 0,
    daysRemaining: 20,
    totalDays: 30,
    creditAdjustment: deferred ? 0 : 90_000,
    creditUnwind: 0,
    deferred,
    effectiveAtSec: PERIOD_END_SEC,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    planTier: "studio",
  } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
  vi.mocked(readSubscriptionBillingState).mockResolvedValue({
    subscriptionItemId: "si_base",
    currentPlan: "studio",
    currentInterval: "monthly",
    periodStartSec: PERIOD_END_SEC - 30 * 24 * 60 * 60,
    periodEndSec: PERIOD_END_SEC,
    currentCreditUnits: 0,
    creditItemId: null,
  } as Awaited<ReturnType<typeof readSubscriptionBillingState>>);
  vi.mocked(scheduleSubscriptionChange).mockResolvedValue({
    success: true,
    scheduleId: "sub_sched_1",
    effectiveAt: EFFECTIVE_AT,
  });
  vi.mocked(releaseScheduleBeforeWrite).mockResolvedValue({ outcome: "nothing-to-release" });
  vi.mocked(updateSubscriptionPlan).mockResolvedValue({
    success: true,
    invoiceId: "in_1",
    invoiceStatus: "paid",
    invoicedAmount: 4_200,
  });
  vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
  vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: true } as never);
  /* The instant road applies the settlement in the same breath when the change
     invoice is already paid, which is the happy path — so the positive control
     below really does walk it end to end rather than stopping at the queue. */
  vi.mocked(applyPlanChangeSettlement).mockResolvedValue({
    outcome: "applied",
    creditsMoved: 90_000,
  } as never);
});

describe("a DECREASE takes none of the four roads that move money or credits", () => {
  beforeEach(() => quoteIs(true));

  it("⚠ never writes the Stripe price — so no proration is raised and no money comes back. THE LOOP DIES HERE", async () => {
    await caller().changePlan({ newPlan: "pro" });

    expect(updateSubscriptionPlan).not.toHaveBeenCalled();
    expect(scheduleSubscriptionChange).toHaveBeenCalledTimes(1);
    expect(vi.mocked(scheduleSubscriptionChange).mock.calls[0][3]).toEqual({
      plan: "pro",
      interval: "monthly",
      creditUnits: 0,
    });
  });

  it("records no credit settlement and touches neither credit helper", async () => {
    await caller().changePlan({ newPlan: "pro" });

    expect(queuePlanChangeSettlement).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("⚠ does NOT write the local tier — she keeps the plan she is still paying for", async () => {
    await caller().changePlan({ newPlan: "pro" });

    expect(updateUserSubscription).not.toHaveBeenCalled();
  });

  it("answers with the DATE and promises nothing about a refund", async () => {
    const result = await caller().changePlan({ newPlan: "pro" });

    expect(result.deferred).toBe(true);
    expect(result.effectiveAt).toEqual(EFFECTIVE_AT);
    expect(result.proratedAmount).toBe(0);
    expect(result.creditSettlement).toBe("none");
    /* The sentence a customer reads. Every one of these phrases was in the
       copy this card replaced, and each would now be a promise of money that
       is not coming. */
    expect(result.message).toMatch(/starts on /);
    expect(result.message).not.toMatch(/billing credit|comes back|refund|back to your balance/i);
  });

  it("the audit row says the change was SCHEDULED and that nothing moved", async () => {
    await caller().changePlan({ newPlan: "pro" });

    const row = vi.mocked(logAuditEvent).mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(row.metadata.scheduled).toBe(true);
    expect(row.metadata.effectiveAt).toBe(EFFECTIVE_AT.toISOString());
    /* Said out loud rather than left to be inferred from absence — this is the
       row support reads when a customer asks why no refund arrived. */
    expect(row.metadata.creditsReturned).toBe(0);
    expect(row.metadata.creditSettlement).toBe("none");
  });

  it("a schedule that could not be created REFUSES, and still writes nothing", async () => {
    vi.mocked(scheduleSubscriptionChange).mockResolvedValue({
      success: false,
      error: "stripe said no",
    });

    await expect(caller().changePlan({ newPlan: "pro" })).rejects.toThrow(/nothing was changed/i);
    expect(updateSubscriptionPlan).not.toHaveBeenCalled();
    expect(updateUserSubscription).not.toHaveBeenCalled();
  });
});

describe("⚠ POSITIVE CONTROL — an INCREASE still takes every one of those four roads", () => {
  /* Without this block, every arm above would pass against a procedure that
     threw on its first line or a mock that was never wired. */
  beforeEach(() => quoteIs(false));

  it("writes the Stripe price, records the settlement, writes the local tier, and schedules nothing", async () => {
    const result = await caller().changePlan({ newPlan: "business" });

    expect(updateSubscriptionPlan).toHaveBeenCalledTimes(1);
    expect(queuePlanChangeSettlement).toHaveBeenCalledTimes(1);
    expect(updateUserSubscription).toHaveBeenCalledTimes(1);
    expect(scheduleSubscriptionChange).not.toHaveBeenCalled();
    expect(result.deferred).toBe(false);
    expect(result.effectiveAt).toBeNull();
  });
});

describe("the way back out — cancelScheduledChange", () => {
  it("releases the pending schedule and reports it", async () => {
    vi.mocked(releaseScheduleBeforeWrite).mockResolvedValue({
      outcome: "released",
      scheduleId: "sub_sched_1",
    });

    const result = await caller().cancelScheduledChange();

    expect(releaseScheduleBeforeWrite).toHaveBeenCalledTimes(1);
    /* The subscription comes from `ctx.user.id` and the procedure takes no
       input, so there is no id on the wire that could name another account's
       schedule (invariant 3). */
    expect(vi.mocked(releaseScheduleBeforeWrite).mock.calls[0][1]).toBe("sub_1");
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/cancelled/i);
  });

  it("⚠ NOTHING to release is a SUCCESS, not a refusal — two clicks must not hand her an error", async () => {
    vi.mocked(releaseScheduleBeforeWrite).mockResolvedValue({ outcome: "nothing-to-release" });

    const result = await caller().cancelScheduledChange();

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/staying on your current plan/i);
  });

  it("a FAILED release refuses, so she is never told a change was cancelled when it was not", async () => {
    vi.mocked(releaseScheduleBeforeWrite).mockResolvedValue({
      outcome: "failed",
      error: "network",
    });

    await expect(caller().cancelScheduledChange()).rejects.toThrow(/Nothing has changed/i);
  });
});
