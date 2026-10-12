/**
 * #2394, the relay's finding on PR #2440 — A STRIPE BLIP MUST NOT MINT A NEW
 * CUSTOMER UNDER A SUBSCRIBER.
 *
 * `getOrCreateStripeCustomer` caught every error from `customers.retrieve` and
 * minted a fresh, empty customer. On a timeout, a 429 or a 5xx, a past_due
 * subscriber was handed a customer holding no subscriptions, so the
 * one-subscription guard found nothing and the checkout was sold — the double
 * charge that guard exists to refuse. `oneSubscriptionGuard2394.test.ts` mocks
 * the helper and could not see it.
 *
 * So this suite runs the REAL router and the REAL `stripeService` over the
 * REAL Stripe library, replacing only the network (the
 * `stripeApiVersionPin.test.ts` harness), and asserts at the wire (working
 * law 5): what the library actually tried to send after the read failed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { harness } = vi.hoisted(() => ({
  harness: {
    sent: [] as Array<{ method: string; path: string }>,
    /* How GET /v1/customers/:id answers. */
    retrieve: "ok" as "ok" | "missing" | number,
  },
}));

vi.mock("stripe", async (importOriginal) => {
  const actual = (await importOriginal()) as { default: any };
  const RealStripe = actual.default;
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "request-id": "req_2394" },
    });

  const recordingFetch = async (url: unknown, init?: { method?: string }) => {
    const u = new URL(String(url));
    const method = (init?.method ?? "GET").toUpperCase();
    harness.sent.push({ method, path: u.pathname });
    if (method === "GET" && u.pathname === "/v1/customers/cus_saved") {
      if (harness.retrieve === "ok") return json(200, { id: "cus_saved", object: "customer" });
      if (harness.retrieve === "missing") {
        return json(404, {
          error: { type: "invalid_request_error", code: "resource_missing", message: "No such customer: 'cus_saved'" },
        });
      }
      return json(harness.retrieve, { error: { type: "api_error", message: "upstream trouble" } });
    }
    if (method === "POST" && u.pathname === "/v1/customers") {
      return json(200, { id: "cus_minted", object: "customer" });
    }
    if (method === "GET" && u.pathname === "/v1/subscriptions") {
      return json(200, { object: "list", url: "/v1/subscriptions", has_more: false, data: [] });
    }
    // Anything further (the price catalogue, the session) is outside this
    // suite's question; it answers an error so nothing past it is believed.
    return json(500, { error: { type: "api_error", message: "not served by this harness" } });
  };

  class LocalStripe extends RealStripe {
    constructor(key: string, config?: Record<string, unknown>) {
      super(key || "sk_test_2394_guard", {
        ...config,
        httpClient: RealStripe.createFetchHttpClient(recordingFetch),
        maxNetworkRetries: 0,
      });
    }
  }
  return { ...actual, default: LocalStripe };
});

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "./billing";
import { getSubscriptionByUserId, getUserById, updateUserSubscription } from "../db";
import { SpokenError } from "../_core/spokenError";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

const minted = () => harness.sent.some((r) => r.method === "POST" && r.path === "/v1/customers");
const sessionAsked = () => harness.sent.some((r) => r.path === "/v1/checkout/sessions");
const subscriptionsListed = () => harness.sent.some((r) => r.path === "/v1/subscriptions");

beforeEach(() => {
  vi.clearAllMocks();
  harness.sent.length = 0;
  harness.retrieve = "ok";
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  // A subscriber whose payment failed — the account the finding is about.
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    stripeCustomerId: "cus_saved",
    stripeSubscriptionId: "sub_saved",
    subscriptionStatus: "past_due",
    planTier: "pro",
  } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
  vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
});

describe("#2394 — the saved customer cannot be read: refuse, never mint", () => {
  it.each([429, 500, 503])(
    "a %s on customers.retrieve refuses the checkout — no customers.create, no session, no id overwritten",
    async (status) => {
      harness.retrieve = status;

      const error = await caller()
        .createSubscriptionCheckout({ plan: "pro" })
        .then(() => null, (e: unknown) => e);

      expect(error).toBeInstanceOf(SpokenError);
      expect((error as SpokenError).message).toContain("Nothing was charged");
      expect(harness.sent).toContainEqual({ method: "GET", path: "/v1/customers/cus_saved" });
      expect(minted()).toBe(false);
      expect(subscriptionsListed()).toBe(false);
      expect(sessionAsked()).toBe(false);
      expect(updateUserSubscription).not.toHaveBeenCalled();
    },
  );

  it("the top-up road refuses the same way — it shares the helper", async () => {
    harness.retrieve = 503;

    const error = await caller()
      .createTopupCheckout({ units: 1 })
      .then(() => null, (e: unknown) => e);

    expect(error).toBeInstanceOf(SpokenError);
    expect(minted()).toBe(false);
    expect(sessionAsked()).toBe(false);
  });

  it("positive control: Stripe saying the customer is GONE (resource_missing) still mints a new one", async () => {
    harness.retrieve = "missing";

    // The session itself is outside this harness and fails; what is asserted
    // is that the mint happened and the guard then asked about the NEW id.
    await caller().createSubscriptionCheckout({ plan: "pro" }).catch(() => null);

    expect(minted()).toBe(true);
    expect(updateUserSubscription).toHaveBeenCalledWith(42, { stripeCustomerId: "cus_minted" });
    expect(subscriptionsListed()).toBe(true);
  });

  it("positive control: a customer that reads fine is used as it is — no mint", async () => {
    harness.retrieve = "ok";

    await caller().createSubscriptionCheckout({ plan: "pro" }).catch(() => null);

    expect(minted()).toBe(false);
    expect(subscriptionsListed()).toBe(true);
  });
});
