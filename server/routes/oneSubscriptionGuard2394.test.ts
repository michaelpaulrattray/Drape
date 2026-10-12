import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #2394 — `createSubscriptionCheckout` refuses to sell a second subscription to
 * an account that already holds a live one at Stripe.
 *
 * The defect: a subscriber whose payment had failed (`past_due` / `unpaid`)
 * reads as `hasSubscription: false`, Change plan sent their Upgrade to
 * Checkout, and this procedure minted a session for a SECOND plan while Stripe
 * kept retrying the first one's invoice. Reproduced on dev by the relay's hunt,
 * both halves; the server half returned a `checkout.stripe.com` URL to an
 * account holding a live test-mode subscription.
 *
 * Driven through the real router with Stripe and the db mocked at the module
 * edge. The arm that matters is AT THE WIRE (working law 5): a refusal means
 * `createSubscriptionCheckoutSession` is never called — not merely an error
 * thrown after a session already exists. The question's own wire (what is
 * sent to Stripe, and how its pages are read) is
 * `server/stripe/liveSubscriptionOnCustomer2394.test.ts`.
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
  findLiveSubscriptionOnCustomer: vi.fn(),
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
  findLiveSubscriptionOnCustomer,
  getOrCreateStripeCustomer,
} from "../stripe/stripeService";
import { logAuditEvent } from "../auditLog";
import { SpokenError } from "../_core/spokenError";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

const FAILED_PAYMENT_SENTENCE =
  "Your last payment didn't go through, so your plan can't be changed until it does. Update your card under Billing, then try again.";

function live(status: string, collectionPaused = false) {
  vi.mocked(findLiveSubscriptionOnCustomer).mockResolvedValue({
    outcome: "live",
    subscriptionId: "sub_existing",
    status: status as never,
    collectionPaused,
  });
}

async function refusal() {
  const error = await caller()
    .createSubscriptionCheckout({ plan: "pro" })
    .then(() => null, (e: unknown) => e);
  expect(error).not.toBeNull();
  return error as SpokenError;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  // A returning customer: the id is saved, so the save branch is skipped.
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: "sub_existing",
    subscriptionStatus: "past_due",
  } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
  vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_existing");
  vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
  vi.mocked(createSubscriptionCheckoutSession).mockResolvedValue(
    "https://checkout.stripe.com/c/pay/test",
  );
});

describe("#2394 — one subscription per account, refused before a session is minted", () => {
  it.each(["past_due", "unpaid"])(
    "a %s subscriber is refused, told to update their card, and NO checkout is minted",
    async (status) => {
      live(status);

      const error = await refusal();
      expect(error).toBeInstanceOf(SpokenError);
      expect(error.code).toBe("CONFLICT");
      expect(error.message).toBe(FAILED_PAYMENT_SENTENCE);

      expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
      expect(logAuditEvent).not.toHaveBeenCalled();
    },
  );

  it("the question is asked about the customer the account resolved to", async () => {
    live("past_due");
    await refusal();
    expect(findLiveSubscriptionOnCustomer).toHaveBeenCalledWith("cus_existing");
  });

  it("an active plan is refused too — a second subscription is never the answer", async () => {
    live("active");

    const error = await refusal();
    expect(error).toBeInstanceOf(SpokenError);
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("You already have a plan");
    expect(error.message).toContain("Nothing was charged");
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it.each([
    ["paused", false],
    ["active", true],
  ] as const)("a paused plan (%s, collection paused: %s) is told to resume", async (status, paused) => {
    live(status, paused);

    const error = await refusal();
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("Resume it first");
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it("an incomplete plan (first payment still confirming) is refused in a purchase's words", async () => {
    live("incomplete");

    const error = await refusal();
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("first payment is still being confirmed");
    expect(error.message).toContain("Nothing was charged");
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it("a read that FAILED refuses rather than sells, in a sentence the customer is shown", async () => {
    vi.mocked(findLiveSubscriptionOnCustomer).mockResolvedValue({ outcome: "failed", error: "boom" });

    const error = await refusal();
    expect(error).toBeInstanceOf(SpokenError);
    expect(error.message).toContain("Nothing was charged");
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  it("positive control: an account holding no live subscription is sold one, exactly as before", async () => {
    vi.mocked(findLiveSubscriptionOnCustomer).mockResolvedValue({ outcome: "none" });

    const out = await caller().createSubscriptionCheckout({ plan: "pro" });

    expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/test");
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });
});
