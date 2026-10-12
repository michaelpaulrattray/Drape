/**
 * #2456 — THE ADD CREDITS PANE ASKS WHETHER THE PLAN IS PAUSED, AND IT GETS THE
 * GATE'S OWN ANSWER.
 *
 * #2454 made `createTopupCheckout` refuse a pack on a paused plan, and the pane
 * still drew the packs: the pause lives only at Stripe (the stored status reads
 * `active` for both pause shapes), so nothing the pane read could tell. The
 * pane now asks `billing.getTopupStanding`, which reads the same live list
 * through the same predicate as the gate.
 *
 * #2454's harness, unchanged: the REAL router, the REAL `stripeService` over
 * the REAL Stripe library, only the network replaced — so every answer here is
 * `findLiveSubscriptionOnCustomer` itself, read at the wire.
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
      headers: { "content-type": "application/json", "request-id": "req_2456" },
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
      super(key || "sk_test_2456_guard", {
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

const subscriptionsListed = () =>
  harness.sent.some((r) => r.method === "GET" && r.path === "/v1/subscriptions");

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

const standing = () => caller().getTopupStanding();
const press = () =>
  caller()
    .createTopupCheckout({ units: 1 })
    .then(() => null, (error: unknown) => error as SpokenError);

describe("#2456 — the pane is told the plan is paused", () => {
  it("a plan Stripe holds as `paused` reads paused", async () => {
    harness.subscriptions = [sub("paused")];
    expect(await standing()).toEqual({ planPaused: true });
    expect(subscriptionsListed()).toBe(true);
  });

  it("an ACTIVE plan with collection paused (the portal's pause) reads paused", async () => {
    harness.subscriptions = [sub("active", { pause_collection: { behavior: "void" } })];
    expect(await standing()).toEqual({ planPaused: true });
  });

  it("⚠ the stored status says `active` in every arm — the answer comes from Stripe, not the row", async () => {
    harness.subscriptions = [sub("paused")];
    const row = await getSubscriptionByUserId(42);
    expect(row?.subscriptionStatus).toBe("active");
    expect(await standing()).toEqual({ planPaused: true });
  });
});

describe("#2456 — CONTROLS: nothing else reads paused", () => {
  it.each([["active"], ["trialing"], ["past_due"], ["unpaid"], ["incomplete"]])(
    "a %s plan does not read paused",
    async (status) => {
      harness.subscriptions = [sub(status)];
      expect(await standing()).toEqual({ planPaused: false });
    },
  );

  it("no live subscription at Stripe does not read paused", async () => {
    harness.subscriptions = [sub("canceled")];
    expect(await standing()).toEqual({ planPaused: false });
  });

  it("an account with no billing account answers without asking Stripe", async () => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      planTier: "free",
    } as unknown as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    expect(await standing()).toEqual({ planPaused: false });
    expect(harness.sent).toEqual([]);
  });

  it.each([429, 500, 503])("⚠ a %s from Stripe is UNREAD (null), never `false`", async (status) => {
    harness.subscriptions = status;
    expect(await standing()).toEqual({ planPaused: null });
    expect(subscriptionsListed()).toBe(true);
  });
});

describe("#2456 — the pane and the press cannot disagree", () => {
  it.each([
    [[sub("paused")]],
    [[sub("active", { pause_collection: { behavior: "keep_as_draft" } })]],
    [[sub("active")]],
    [[sub("past_due")]],
    [[sub("incomplete")]],
    [[sub("canceled")]],
  ])("fixture %#: paused on the pane exactly when the press is refused as paused", async (list) => {
    harness.subscriptions = list;
    const { planPaused } = await standing();
    const refusal = await press();
    const refusedAsPaused = refusal !== null && /paused/.test(refusal.message);
    expect(planPaused).toBe(refusedAsPaused);
  });
});
