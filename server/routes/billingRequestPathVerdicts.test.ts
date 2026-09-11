import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #796 — the two REQUEST-path writes in `routes/billing.ts` that dropped the db
 * helper's verdict (the law-7 remainder of #792, whose six sites were webhook
 * handlers). `updateUserSubscription` never throws: a failed write comes back
 * `{ success: false }`, and a caller that does not read it proceeds as if the
 * row moved.
 *
 * # Site 1 — `createSubscriptionCheckout`, the `stripeCustomerId` save
 *
 * Read at the code, the exposure is WORSE than the card's "second customer":
 * `customer.subscription.created` finds the account BY `stripeCustomerId`
 * (`getUserByStripeCustomerId`, the webhook's first read). With the id unsaved,
 * a session minted against that customer produces a paid subscription whose
 * every webhook fails on every redelivery — the customer pays and the account
 * never becomes the plan. So the fix REFUSES the checkout, and the arm that
 * matters is at the wire (working law 5): a failed save must mean NO call to
 * `createSubscriptionCheckoutSession`, not merely a thrown error after one.
 *
 * # Site 2 — `changePlan`, the local record write
 *
 * By that line Stripe has accepted the change. Throwing would tell a customer
 * their upgrade failed when it did not, and a retry meets "You are already on
 * this plan" because `changePlan` reads the current plan off Stripe. The
 * webhook (`subscription.updated`, failing its event on a lost write since
 * #794) is the corrector, so the procedure still answers success — and the
 * audit row names the road (`localRecord: deferred-to-webhook`), which is the
 * one artifact support can read when an account shows its old tier.
 *
 * Both sites are driven through the real router with Stripe and the db
 * mocked at the module edge, and each has its positive control.
 */

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
}));

vi.mock("../stripe/stripeService", () => ({
  stripe: {},
  getOrCreateStripeCustomer: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  getSubscriptionDetails: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  readSubscriptionBillingState: vi.fn(),
  quotePlanChange: vi.fn(),
  updateSubscriptionPlan: vi.fn(),
  calculateCreditAdjustment: vi.fn(),
  getCustomerInvoices: vi.fn(),
  getAllCustomerInvoices: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "./billing";
import { getSubscriptionByUserId, getUserById, updateUserSubscription } from "../db";
import {
  createSubscriptionCheckoutSession,
  getOrCreateStripeCustomer,
  quotePlanChange,
  readSubscriptionBillingState,
  updateSubscriptionPlan,
} from "../stripe/stripeService";
import { logAuditEvent } from "../auditLog";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_new");
  vi.mocked(createSubscriptionCheckoutSession).mockResolvedValue(
    "https://checkout.stripe.com/c/pay/test",
  );
});

describe("#796 site 1 — the stripeCustomerId save before a checkout", () => {
  beforeEach(() => {
    // A first-time buyer: no customer id on the account yet.
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: null,
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
  });

  it("a failed save REFUSES the checkout — no session is minted against a customer the account cannot claim", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({
      success: false,
      error: "Database not available",
    });

    await expect(caller().createSubscriptionCheckout({ plan: "starter" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("Nothing was charged"),
    });

    // The wire: the refusal happens BEFORE Stripe is asked for a session.
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("positive control: a successful save proceeds to mint the session", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });

    const out = await caller().createSubscriptionCheckout({ plan: "starter" });

    expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/test");
    expect(updateUserSubscription).toHaveBeenCalledWith(42, { stripeCustomerId: "cus_new" });
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("a saved id that Stripe no longer honours — the helper mints a NEW one — takes the same road: saved, and refused on a failed save (PR #797 review)", async () => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: "cus_stale",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_new");
    vi.mocked(updateUserSubscription).mockResolvedValue({
      success: false,
      error: "Database not available",
    });

    await expect(caller().createSubscriptionCheckout({ plan: "starter" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });

    expect(updateUserSubscription).toHaveBeenCalledWith(42, { stripeCustomerId: "cus_new" });
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();

    // And the successful save proceeds, against the NEW id.
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
    const out = await caller().createSubscriptionCheckout({ plan: "starter" });
    expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/test");
    expect(vi.mocked(createSubscriptionCheckoutSession).mock.calls[0][0]).toBe("cus_new");
  });

  it("a returning buyer with an id already saved never touches the save, so the guard cannot refuse them", async () => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: "cus_known",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_known");
    // Even a helper that WOULD fail is never asked.
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: false, error: "boom" });

    const out = await caller().createSubscriptionCheckout({ plan: "starter" });

    expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/test");
    expect(updateUserSubscription).not.toHaveBeenCalled();
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
  });
});

describe("#796 site 2 — changePlan's local record after Stripe has accepted the change", () => {
  beforeEach(() => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_known",
      planTier: "starter",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(readSubscriptionBillingState).mockResolvedValue({
      currentPlan: "starter",
      subscriptionItemId: "si_1",
    } as Awaited<ReturnType<typeof readSubscriptionBillingState>>);
    // An interval-neutral change with no credit movement: the credit road is
    // not what this arm measures, and keeping it out of the way makes the
    // record write the only db verdict on the road.
    vi.mocked(quotePlanChange).mockReturnValue({
      kind: "same-interval",
      currentPlan: "starter",
      currentInterval: "monthly",
      targetInterval: "monthly",
      creditAdjustment: 0,
      creditUnwind: 0,
      isUpgrade: true,
      proratedAmount: 0,
    } as ReturnType<typeof quotePlanChange>);
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: true,
      invoiceId: "in_1",
      invoiceStatus: "paid",
      invoicedAmount: 0,
    } as Awaited<ReturnType<typeof updateSubscriptionPlan>>);
  });

  const auditMetadata = () => {
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    return vi.mocked(logAuditEvent).mock.calls[0][0].metadata as Record<string, unknown>;
  };

  it("a failed record write does NOT fail the customer — Stripe already accepted the change and the webhook corrects the row — and the audit row says so", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({
      success: false,
      error: "Database not available",
    });

    const out = await caller().changePlan({ newPlan: "pro" });

    expect(out.success).toBe(true);
    expect(updateUserSubscription).toHaveBeenCalledWith(42, {
      planTier: "pro",
      billingInterval: "month",
    });
    expect(auditMetadata().localRecord).toBe("deferred-to-webhook");
  });

  it("positive control: a written record is recorded as written", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });

    const out = await caller().changePlan({ newPlan: "pro" });

    expect(out.success).toBe(true);
    expect(auditMetadata().localRecord).toBe("written");
  });
});
