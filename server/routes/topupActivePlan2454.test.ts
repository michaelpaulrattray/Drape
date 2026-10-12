/**
 * #2454 — A CREDIT PACK IS SOLD ONLY ON AN ACTIVE PLAN.
 *
 * His word, 2026-10-12, verbatim: *"you need to be on an active plan to buy
 * credit packs."* `createTopupCheckout` decided on the plan RUNG alone, and the
 * rung reads `pro` for a subscriber whose card failed and for one whose plan is
 * paused — both were sold a pack.
 *
 * This suite runs the REAL router and the REAL `stripeService` over the REAL
 * Stripe library, replacing only the network (`checkoutCustomerFailClosed2394`'s
 * harness), so the live read is `findLiveSubscriptionOnCustomer` itself and the
 * assertions are at the wire (working law 5): a refusal means Stripe was never
 * asked for a checkout session, and the pass arm means it was.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { harness } = vi.hoisted(() => ({
  harness: {
    sent: [] as Array<{ method: string; path: string }>,
    /* What GET /v1/subscriptions answers: a list of subscriptions, or an
       HTTP status to fail with. */
    subscriptions: [] as Array<Record<string, unknown>> | number,
  },
}));

vi.mock("stripe", async (importOriginal) => {
  const actual = (await importOriginal()) as { default: any };
  const RealStripe = actual.default;
  const { topupBracketFor } = await import("../../shared/creditTopups");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "request-id": "req_2454" },
    });

  const recordingFetch = async (url: unknown, init?: { method?: string }) => {
    const u = new URL(String(url));
    const method = (init?.method ?? "GET").toUpperCase();
    harness.sent.push({ method, path: u.pathname });
    if (method === "GET" && u.pathname === "/v1/customers/cus_saved") {
      return json(200, { id: "cus_saved", object: "customer" });
    }
    if (method === "GET" && u.pathname === "/v1/subscriptions") {
      if (typeof harness.subscriptions === "number") {
        return json(harness.subscriptions, { error: { type: "api_error", message: "upstream trouble" } });
      }
      return json(200, {
        object: "list",
        url: "/v1/subscriptions",
        has_more: false,
        data: harness.subscriptions,
      });
    }
    if (method === "GET" && u.pathname === "/v1/prices") {
      const lookupKey = u.searchParams.get("lookup_keys[0]");
      return json(200, {
        object: "list",
        url: "/v1/prices",
        has_more: false,
        data: [{
          id: "price_pack",
          object: "price",
          lookup_key: lookupKey,
          recurring: null,
          unit_amount: topupBracketFor(1).centsPerUnit,
        }],
      });
    }
    if (method === "POST" && u.pathname === "/v1/checkout/sessions") {
      return json(200, {
        id: "cs_pack",
        object: "checkout.session",
        url: "https://checkout.stripe.com/c/pay/cs_pack",
      });
    }
    return json(500, { error: { type: "api_error", message: "not served by this harness" } });
  };

  class LocalStripe extends RealStripe {
    constructor(key: string, config?: Record<string, unknown>) {
      super(key || "sk_test_2454_guard", {
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
import { logAuditEvent } from "../auditLog";
import { SpokenError } from "../_core/spokenError";
import { TOPUP_NEEDS_A_PLAN_SENTENCE, TOPUP_PLAN_PAUSED_SENTENCE } from "../../shared/creditTopups";
import { SUPPORT_EMAIL } from "../../shared/supportEmail";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

const subscriptionsListed = () =>
  harness.sent.some((r) => r.method === "GET" && r.path === "/v1/subscriptions");
const sessionAsked = () => harness.sent.some((r) => r.path === "/v1/checkout/sessions");

const sub = (status: string, extra: Record<string, unknown> = {}) => ({
  id: `sub_${status}`,
  object: "subscription",
  status,
  pause_collection: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  harness.sent.length = 0;
  harness.subscriptions = [];
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  /* The rung reads Pro in every arm — the card's point is that it still does
     after the card fails or the plan is paused. */
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    stripeCustomerId: "cus_saved",
    stripeSubscriptionId: "sub_saved",
    subscriptionStatus: "active",
    planTier: "pro",
  } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
  vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
});

async function attempt() {
  return caller()
    .createTopupCheckout({ units: 1 })
    .then((value) => ({ value, error: null as unknown }), (error: unknown) => ({ value: null, error }));
}

describe("#2454 — an active plan buys a pack (the positive controls)", () => {
  it("CONTROL — an active, unpaused plan is sold the pack, and Stripe is asked for the session", async () => {
    harness.subscriptions = [sub("active")];
    const { value, error } = await attempt();
    expect(error).toBeNull();
    expect(value).toEqual({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_pack" });
    expect(subscriptionsListed()).toBe(true);
    expect(sessionAsked()).toBe(true);
    expect(logAuditEvent).toHaveBeenCalled();
  });

  it("CONTROL — a trialing plan counts as active (the card's own list)", async () => {
    harness.subscriptions = [sub("trialing")];
    const { error } = await attempt();
    expect(error).toBeNull();
    expect(sessionAsked()).toBe(true);
  });

  it("the live read runs BEFORE the session — the order on the wire", async () => {
    harness.subscriptions = [sub("active")];
    await attempt();
    const listedAt = harness.sent.findIndex((r) => r.path === "/v1/subscriptions");
    const sessionAt = harness.sent.findIndex((r) => r.path === "/v1/checkout/sessions");
    expect(listedAt).toBeGreaterThan(-1);
    expect(listedAt).toBeLessThan(sessionAt);
  });
});

describe("#2454 — anything but an active plan is refused, and no session is minted", () => {
  it.each([
    ["past_due", /payment didn't go through[\s\S]*update your card/],
    ["unpaid", /payment didn't go through[\s\S]*update your card/],
    ["incomplete", /first payment is still being confirmed/],
  ])("a %s plan is refused with a sentence that says what to do", async (status, sentence) => {
    harness.subscriptions = [sub(status)];
    const { error } = await attempt();
    expect(error).toBeInstanceOf(SpokenError);
    expect((error as SpokenError).code).toBe("FORBIDDEN");
    expect((error as SpokenError).message).toMatch(sentence);
    expect((error as SpokenError).message).toContain("Nothing was charged");
    /* The disappearing-technology law: no status word reaches the customer. */
    expect((error as SpokenError).message).not.toMatch(/past_due|unpaid|incomplete|trialing/);
    expect(subscriptionsListed()).toBe(true);
    expect(sessionAsked()).toBe(false);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  /* #2456: a paused plan's sentence names the one road that works — support —
     because nothing in the product resumes a pause. It is the pane's own
     constant, so the two cannot drift. */
  it("a paused plan is refused with the shared paused sentence, which names support", async () => {
    harness.subscriptions = [sub("paused")];
    const { error } = await attempt();
    expect(error).toBeInstanceOf(SpokenError);
    expect((error as SpokenError).code).toBe("FORBIDDEN");
    expect((error as SpokenError).message).toBe(TOPUP_PLAN_PAUSED_SENTENCE);
    expect(TOPUP_PLAN_PAUSED_SENTENCE).toContain(`Email ${SUPPORT_EMAIL}`);
    expect(TOPUP_PLAN_PAUSED_SENTENCE).not.toMatch(/under Billing|billing page/i);
    expect(sessionAsked()).toBe(false);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("an ACTIVE plan with collection paused (the portal's pause) is refused as paused", async () => {
    harness.subscriptions = [sub("active", { pause_collection: { behavior: "void" } })];
    const { error } = await attempt();
    expect((error as SpokenError).message).toBe(TOPUP_PLAN_PAUSED_SENTENCE);
    expect(sessionAsked()).toBe(false);
  });

  it("a status nobody named is refused rather than sold", async () => {
    harness.subscriptions = [sub("some_future_status")];
    const { error } = await attempt();
    expect(error).toBeInstanceOf(SpokenError);
    expect((error as SpokenError).message).toContain("isn't active");
    expect(sessionAsked()).toBe(false);
  });

  it("a Pro rung with NO live subscription at Stripe is refused as having no plan", async () => {
    harness.subscriptions = [sub("canceled")];
    const { error } = await attempt();
    expect(error).toMatchObject({ code: "FORBIDDEN", message: TOPUP_NEEDS_A_PLAN_SENTENCE });
    expect(sessionAsked()).toBe(false);
  });
});

describe("#2454 — Stripe cannot be read: fail closed", () => {
  it.each([429, 500, 503])("a %s on the subscription list refuses — no session", async (status) => {
    harness.subscriptions = status;
    const { error } = await attempt();
    expect(error).toBeInstanceOf(SpokenError);
    expect((error as SpokenError).code).toBe("INTERNAL_SERVER_ERROR");
    expect((error as SpokenError).message).toContain("Nothing was charged");
    expect(subscriptionsListed()).toBe(true);
    expect(sessionAsked()).toBe(false);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
