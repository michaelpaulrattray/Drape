/**
 * WHO MAY BUY CREDITS, AND WHETHER THEY ARRIVE (#1606, P1-7) — the request path
 * and the grant, each driven through the real code with the edges doubled.
 *
 * # Part 1 — the procedure
 *
 * The card's rule is *"plan holders only, enforced server-side"*, and the arm
 * that matters is at the wire (working law 5): a refused account must mean NO
 * session was minted, not merely an error thrown after one. Every refusal here
 * has its positive control beside it, because a gate that refuses everybody
 * passes every refusal arm ever written (law 2).
 *
 * # Part 2 — the grant
 *
 * `addTopupCredits` has had no caller since the one-time top-up product was
 * removed in February (`41a765ea`), so this is the whole of its road and
 * nothing else proves it. Three things are driven rather than reasoned about:
 *
 *  · **A REPLAY GRANTS ONCE.** The event claim in `handleStripeWebhook` is the
 *    first answer and the ledger reference is the real one — so the harness
 *    models BOTH: the claim table and the ledger's unique `(userId,
 *    referenceId)` index are stateful doubles, and the hard arm is the one that
 *    releases the claim (a handler that granted and then failed) and delivers
 *    again. That is the only road on which a second grant is even possible, and
 *    it is the road Stripe takes after any failure.
 *  · **A SESSION THAT CONTRADICTS ITSELF GRANTS NOTHING.** `topupUnits` and
 *    `ledgerCredits` are written in one breath by one builder; a session where
 *    they disagree was not written by us. The env tag refuses another WORLD's
 *    objects and says nothing about a hand-made one in this world, which is
 *    what this check is for.
 *  · **AN UNPAID COMPLETION GRANTS NOTHING AND IS NOT RETRIED.**
 *
 * The harness is `webhookIdempotency.test.ts`'s, with the ledger added.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";

// ─────────────────────────── part 1: the procedure ───────────────────────────

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
}));

vi.mock("./stripe/stripeService", () => ({
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

vi.mock("./auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "./routes/billing";
import { getSubscriptionByUserId, getUserById, updateUserSubscription } from "./db";
import { createTopupCheckoutSession, getOrCreateStripeCustomer } from "./stripe/stripeService";
import { logAuditEvent } from "./auditLog";
import { AUDIT_ACTIONS } from "../shared/auditActions";
import {
  PRICE_UNAVAILABLE_SENTENCE,
  StripePriceUnavailableError,
} from "./stripe/stripePriceCatalogue";
import { SpokenError } from "./_core/spokenError";
import {
  TOPUP_MAX_UNITS,
  TOPUP_NEEDS_A_PLAN_SENTENCE,
  topupLedgerCredits,
  topupPriceInCents,
} from "../shared/creditTopups";
import { PLAN_TIERS } from "../drizzle/schema";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

/** The account as the database holds it: a plan rung and a saved customer. */
function accountOn(planTier: string, overrides: Record<string, unknown> = {}) {
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    planTier,
    stripeCustomerId: "cus_saved",
    subscriptionStatus: "active",
    ...overrides,
  } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_saved");
  vi.mocked(createTopupCheckoutSession).mockResolvedValue(
    "https://checkout.stripe.com/c/pay/topup",
  );
  vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
});

describe("createTopupCheckout — plan holders only, enforced at the wire", () => {
  it("CONTROL — a plan holder gets a session for the units they asked for", async () => {
    accountOn("pro");
    await expect(caller().createTopupCheckout({ units: 2 })).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.com/c/pay/topup",
    });
    expect(createTopupCheckoutSession).toHaveBeenCalledWith(
      "cus_saved",
      2,
      expect.stringContaining("credits=added"),
      expect.stringContaining("credits=canceled"),
      42,
    );
  });

  it("every paid rung may buy, so one rung does not stand in for the ladder", async () => {
    for (const tier of Object.keys(PLAN_TIERS).filter((t) => t !== "free")) {
      vi.clearAllMocks();
      vi.mocked(getUserById).mockResolvedValue({
        id: 42, frozenAt: null, email: "c@e.com",
      } as Awaited<ReturnType<typeof getUserById>>);
      vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_saved");
      vi.mocked(createTopupCheckoutSession).mockResolvedValue("https://checkout");
      accountOn(tier);
      await expect(caller().createTopupCheckout({ units: 1 })).resolves.toMatchObject({
        checkoutUrl: expect.any(String),
      });
    }
  });

  it("a free account is REFUSED and no session is minted", async () => {
    accountOn("free");
    const error = await caller().createTopupCheckout({ units: 1 }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "FORBIDDEN", message: TOPUP_NEEDS_A_PLAN_SENTENCE });
    expect(createTopupCheckoutSession).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("an account with no credits row at all is refused the same way", async () => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue(
      null as Awaited<ReturnType<typeof getSubscriptionByUserId>>,
    );
    await expect(caller().createTopupCheckout({ units: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("the refusal is SPOKEN, so the customer reads this sentence and not a fallback", async () => {
    /* `FORBIDDEN` is not on the client's OURS list, so an unmarked refusal
       would be answered by a generic sentence and the plan offer would never
       reach the person who needs it. */
    accountOn("free");
    const error = await caller().createTopupCheckout({ units: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SpokenError);
  });

  it("a frozen account is refused before the plan rung is even read", async () => {
    accountOn("pro");
    vi.mocked(getUserById).mockResolvedValue({
      id: 42,
      frozenAt: new Date(),
      email: "customer@example.com",
    } as Awaited<ReturnType<typeof getUserById>>);
    await expect(caller().createTopupCheckout({ units: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("under review"),
    });
    expect(createTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("a failed customer-id save REFUSES rather than minting against an unsaved id", async () => {
    accountOn("pro", { stripeCustomerId: null });
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_new");
    vi.mocked(updateUserSubscription).mockResolvedValue({
      success: false,
      error: "Database not available",
    });
    await expect(caller().createTopupCheckout({ units: 1 })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("Nothing was charged"),
    });
    expect(createTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("a price the catalogue cannot supply reaches the customer as the authored sentence", async () => {
    accountOn("pro");
    vi.mocked(createTopupCheckoutSession).mockRejectedValue(
      new StripePriceUnavailableError("klieg_topup_5000_v2", "names no active price"),
    );
    const error = await caller().createTopupCheckout({ units: 1 }).catch((e: unknown) => e);
    expect(error).toMatchObject({ message: PRICE_UNAVAILABLE_SENTENCE });
    /* And the key — which the repair needs and the customer must not see — is
       nowhere in what the customer is handed. */
    expect((error as Error).message).not.toContain("klieg_topup");
  });
});

describe("createTopupCheckout — the input is closed and bounded", () => {
  beforeEach(() => accountOn("pro"));

  it("refuses an unknown field rather than silently dropping it", async () => {
    await expect(
      caller().createTopupCheckout({ units: 1, priceInCents: 1 } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses a count above the ladder's maximum", async () => {
    await expect(
      caller().createTopupCheckout({ units: TOPUP_MAX_UNITS + 1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("accepts the maximum itself, so the bound is not off by one", async () => {
    await expect(
      caller().createTopupCheckout({ units: TOPUP_MAX_UNITS }),
    ).resolves.toMatchObject({ checkoutUrl: expect.any(String) });
  });

  it("refuses zero, a negative and a fraction", async () => {
    for (const units of [0, -1, 1.5]) {
      vi.mocked(createTopupCheckoutSession).mockClear();
      await expect(caller().createTopupCheckout({ units })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(createTopupCheckoutSession).not.toHaveBeenCalled();
    }
  });
});

describe("createTopupCheckout — the audit row records the intent", () => {
  it("names the units, the ledger credits and the money, under the billing action", async () => {
    accountOn("studio");
    await caller().createTopupCheckout({ units: 5 });
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: AUDIT_ACTIONS.CREDITS_PURCHASED,
        metadata: expect.objectContaining({
          units: 5,
          ledgerCredits: topupLedgerCredits(5),
          cents: topupPriceInCents(5),
          stage: "checkout_initiated",
        }),
      }),
    );
  });

  it("the row is written AFTER the session, so a refused checkout leaves no purchase row", async () => {
    accountOn("studio");
    vi.mocked(createTopupCheckoutSession).mockRejectedValue(new Error("stripe is down"));
    await expect(caller().createTopupCheckout({ units: 1 })).rejects.toThrow();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
