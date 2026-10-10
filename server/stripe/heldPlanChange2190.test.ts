/**
 * A PLAN CHANGE MOVES STRIPE'S PRICE ONLY WHEN ITS CHARGE GOES THROUGH (#2190,
 * his word 2026-10-10: "only switch the price once the payment succeeds …
 * Either way, add a check that compares the app's plan with Stripe's price at
 * renewal and flags any mismatch before Stripe charges").
 *
 * Three subjects, each driven through its real entrance with Stripe and the
 * database doubled at their module boundaries:
 *
 *  1. THE WIRE — `updateSubscriptionPlan`'s outgoing request carries
 *     `payment_behavior: "pending_if_incomplete"` on every change (monthly,
 *     yearly, and the interval switch), and a change Stripe HELD comes back
 *     refused with the held change cancelled (working law 5: proven on the
 *     request, not on a constant beside it).
 *  2. THE FAILED-CHARGE WEBHOOK — a declined change invoice on a subscription
 *     Stripe still holds as `active` cancels the change and touches nothing
 *     else. Its negative control is the old road (`past_due`), which must
 *     still end the plan exactly as before.
 *  3. THE RENEWAL FLAG — a renewal draft about to bill a plan the app does
 *     not hold raises a warning audit row; agreement, a non-draft invoice, an
 *     unreadable price and a failed invoice read all stay silent.
 *
 * What Stripe really does with each request was measured in test mode on the
 * pinned 2026-01-28.clover, card 4000 0000 0000 0341 — the receipts are in the
 * PR body. These arms prove what THIS code does with those answers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const s = vi.hoisted(() => ({
  pricesList: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  invoicesRetrieve: vi.fn(),
  invoicesVoid: vi.fn(),
  productsRetrieve: vi.fn(),
  constructEvent: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: vi.fn(), list: s.pricesList };
    products = { retrieve: s.productsRetrieve };
    subscriptions = { retrieve: s.subscriptionsRetrieve, update: s.subscriptionsUpdate };
    subscriptionSchedules = { create: vi.fn(), update: vi.fn(), release: vi.fn(), retrieve: vi.fn() };
    invoices = { retrieve: s.invoicesRetrieve, voidInvoice: s.invoicesVoid };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: s.constructEvent };
    refunds = { create: vi.fn() };
  },
}));

const db = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  getUserCredits: vi.fn(),
  recordPlanChangeSettlement: vi.fn(),
  getPlanChangeSettlementByInvoice: vi.fn(),
  resolvePlanChangeSettlement: vi.fn(),
  getUserByStripeCustomerId: vi.fn(),
  refreshMonthlyCredits: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  getCreditTransactionByRef: vi.fn(),
  voidPendingPlanChangeSettlementsForUser: vi.fn(),
  getVoidPlanChangeSettlementInvoiceIdsForUser: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
  withTransaction: vi.fn(),
}));
vi.mock("../db", () => db);

/* The replay guard's claim — shaped like the guard (insert first, the unique
   index arbitrates, release on failure), as `subscriptionNewerGuard.test.ts`
   carries why. */
const claims = vi.hoisted(() => [] as string[]);
vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    insert: () => ({
      values: async (row: { eventId: string }) => {
        if (claims.includes(row.eventId)) {
          throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 });
        }
        claims.push(row.eventId);
      },
    }),
    delete: () => ({ where: async () => { claims.pop(); } }),
  })),
}));

const audit = vi.hoisted(() => ({ logAuditEvent: vi.fn() }));
vi.mock("../auditLog", async () => {
  const schema = await vi.importActual<typeof import("../../drizzle/schema")>("../../drizzle/schema");
  return { logAuditEvent: audit.logAuditEvent, AUDIT_ACTIONS: schema.AUDIT_ACTIONS };
});

import {
  updateSubscriptionPlan,
  planOfPlanPrice,
  PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE,
} from "./stripeService";
import { handleStripeWebhook } from "./webhooks";
import { priceLookupKey, planCreditsPriceLookupKey } from "./stripePriceCatalogue";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import { periodPriceInCents } from "@shared/annualBilling";
import { ENV_TAG_KEY } from "./environmentTag";
import { deploymentTag } from "../_core/env";
import { AUDIT_ACTIONS } from "../../drizzle/schema";

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;

/** The catalogue answers whatever key is asked, as Stripe's list does. */
function catalogue() {
  s.pricesList.mockImplementation(async ({ lookup_keys }: { lookup_keys: string[] }) => {
    const key = lookup_keys[0];
    const annual = key.endsWith("_yearly_v2");
    const plan = Object.keys(SUBSCRIPTION_PRODUCTS).find(
      (p) => priceLookupKey(p, annual ? "annual" : "monthly") === key,
    )!;
    return {
      data: [
        {
          id: `price_${key}`,
          lookup_key: key,
          unit_amount: periodPriceInCents(SUBSCRIPTION_PRODUCTS[plan].priceInCents, annual ? "annual" : "monthly"),
          recurring: { interval: annual ? "year" : "month" },
        },
      ],
    };
  });
}

/** A live subscription on `plan` at `interval`, as Stripe returns it. */
function liveSub(plan: string, interval: "monthly" | "annual", overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    created: NOW - 90 * DAY,
    schedule: null,
    currency: "usd",
    latest_invoice: "in_prev",
    metadata: { plan, interval, [ENV_TAG_KEY]: deploymentTag() },
    items: {
      data: [
        {
          id: "si_base",
          quantity: 1,
          price: {
            id: `price_${priceLookupKey(plan, interval)}`,
            lookup_key: priceLookupKey(plan, interval),
            product: "prod_plan",
            currency: "usd",
            recurring: { interval: interval === "annual" ? "year" : "month" },
          },
          current_period_start: NOW - 5 * DAY,
          current_period_end: NOW + 25 * DAY,
        },
      ],
    },
    ...overrides,
  };
}

/** What Stripe's `pending_update` looks like on a held change (trimmed). */
const HELD = { expires_at: NOW + 23 * 3600, subscription_items: [{ id: "si_base" }], metadata: null };

beforeEach(() => {
  vi.clearAllMocks();
  claims.length = 0;
  catalogue();
  s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly"));
  s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_change", pending_update: null });
  s.invoicesRetrieve.mockResolvedValue({ status: "paid", amount_due: 2_777 });
  s.invoicesVoid.mockResolvedValue({ status: "void" });
  db.updateUserSubscription.mockResolvedValue({ success: true });
  db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);
  db.resolvePlanChangeSettlement.mockResolvedValue(true);
  db.getUserByStripeCustomerId.mockResolvedValue({
    id: 7,
    name: "seven",
    email: "u@example.com",
    credits: { planTier: "starter", balance: 4000, stripeSubscriptionId: "sub_1", billingInterval: "month" },
  });
  audit.logAuditEvent.mockResolvedValue(undefined);
});

// ─── 1 · THE WIRE ───────────────────────────────────────────────────────────

describe("updateSubscriptionPlan — Stripe is asked to hold the change until it is paid", () => {
  it.each([
    ["a monthly upgrade", "monthly" as const, "monthly" as const],
    ["a yearly upgrade", "annual" as const, "annual" as const],
    ["a switch to yearly", "monthly" as const, "annual" as const],
  ])("%s carries payment_behavior pending_if_incomplete on the outgoing request", async (_n, from, to) => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", from));
    const result = await updateSubscriptionPlan("sub_1", "pro", 7, to, "si_base");

    expect(result.success).toBe(true);
    expect(result.paymentDeclined).toBeUndefined();
    const params = s.subscriptionsUpdate.mock.calls[0][1];
    expect(params.payment_behavior).toBe("pending_if_incomplete");
    expect(params.proration_behavior).toBe("always_invoice");
    expect(params.items[0]).toEqual({ id: "si_base", price: `price_${priceLookupKey("pro", to)}` });
    /* The plan's metadata rides the SAME request, so Stripe holds it with the
       price and applies both or neither (measured at the pinned version). */
    expect(params.metadata.plan).toBe("pro");
    /* A paid change voids nothing. */
    expect(s.invoicesVoid).not.toHaveBeenCalled();
  });

  it("a change Stripe HELD (the charge did not go through) comes back refused, with the hold cancelled by voiding its invoice", async () => {
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    s.invoicesRetrieve.mockResolvedValue({ status: "open", amount_due: 4_100 });

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_base");

    expect(result).toMatchObject({
      success: false,
      paymentDeclined: true,
      heldChangeCancelled: true,
      invoiceId: "in_held",
      error: PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE,
    });
    expect(s.invoicesVoid).toHaveBeenCalledTimes(1);
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_held");
  });

  it("a hold whose void keeps failing is still refused — tried three times and reported as not cancelled, never as applied", async () => {
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    s.invoicesRetrieve.mockResolvedValue({ status: "open" });
    s.invoicesVoid.mockRejectedValue(new Error("Stripe is having a moment"));

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_base");

    expect(result.success).toBe(false);
    expect(result.paymentDeclined).toBe(true);
    expect(result.heldChangeCancelled).toBe(false);
    expect(s.invoicesVoid).toHaveBeenCalledTimes(3);
  });
});

describe("planOfPlanPrice — derived from the one composer of the keys", () => {
  it("reads back every plan this product sells at both intervals", () => {
    for (const plan of Object.keys(SUBSCRIPTION_PRODUCTS)) {
      for (const interval of ["monthly", "annual"] as const) {
        expect(planOfPlanPrice({ lookup_key: priceLookupKey(plan, interval) })).toEqual({ plan, interval });
      }
    }
  });

  it("answers null — cannot say — for the dial's add-on, a hand-made price and a price with no key", () => {
    expect(planOfPlanPrice({ lookup_key: planCreditsPriceLookupKey("studio", "monthly") })).toBeNull();
    expect(planOfPlanPrice({ lookup_key: "something_else" })).toBeNull();
    expect(planOfPlanPrice({ lookup_key: null })).toBeNull();
    expect(planOfPlanPrice(undefined)).toBeNull();
  });
});

// ─── helpers for the webhook arms ───────────────────────────────────────────

let seq = 0;
async function deliver(type: string, object: Record<string, unknown>) {
  seq += 1;
  s.constructEvent.mockReturnValue({
    id: `evt_2190_${seq}`,
    type,
    object: "event",
    data: { object },
  } as unknown as Stripe.Event);
  return handleStripeWebhook("{}", "sig");
}

function cancelCalls() {
  return s.subscriptionsUpdate.mock.calls.filter(([, p]) => p?.cancel_at_period_end === true);
}

/** A declined change invoice, as Stripe sends `invoice.payment_failed` for one. */
const CHANGE_INVOICE = {
  id: "in_held",
  customer: "cus_1",
  billing_reason: "subscription_update",
  next_payment_attempt: null,
  amount_due: 4_100,
  currency: "usd",
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } },
  lines: { data: [] },
};

// ─── 2 · THE FAILED-CHARGE WEBHOOK ──────────────────────────────────────────

describe("invoice.payment_failed on a HELD plan change", () => {
  it("cancels the change and nothing else — no cancel, no drop to Free, no record write", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly", { pending_update: HELD }));
    s.invoicesRetrieve.mockResolvedValue({ status: "open" });

    const result = await deliver("invoice.payment_failed", CHANGE_INVOICE);

    expect(result.success).toBe(true);
    expect(cancelCalls()).toHaveLength(0);
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_held");
    expect(audit.logAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.BILLING_PAYMENT_FINAL_FAILURE }),
    );
  });

  it("NEGATIVE CONTROL — a change made on the old road (Stripe moved the price, the subscription went past_due) still ends the plan as before", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("pro", "annual", { status: "past_due" }));
    s.invoicesRetrieve.mockResolvedValue({ status: "open" });

    const result = await deliver("invoice.payment_failed", CHANGE_INVOICE);

    expect(result.success).toBe(true);
    expect(cancelCalls()).toHaveLength(1);
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", subscriptionStatus: "canceled" }),
    );
  });

  it("a live read that fails fails the event, so Stripe redelivers rather than this guessing", async () => {
    s.subscriptionsRetrieve.mockRejectedValue(new Error("Stripe is having a moment"));

    const result = await deliver("invoice.payment_failed", CHANGE_INVOICE);

    expect(result.success).toBe(false);
    expect(cancelCalls()).toHaveLength(0);
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
  });
});

describe("customer.subscription.updated while a change is held", () => {
  it("records the plan Stripe actually holds — the OLD one — and grants nothing", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly", { pending_update: HELD }));

    const result = await deliver("customer.subscription.updated", liveSub("starter", "monthly", { pending_update: HELD }));

    expect(result.success).toBe(true);
    expect(db.updateUserSubscription).toHaveBeenCalledWith(7, expect.objectContaining({ planTier: "starter" }));
    expect(db.addCredits).not.toHaveBeenCalled();
  });
});

// ─── 3 · THE RENEWAL FLAG ───────────────────────────────────────────────────

/** A renewal moment: the subscription bills `pricePlan` while its metadata (and
 *  so the app) says `appPlan`, and its latest invoice is `invoice`. */
function renewal(pricePlan: string, appPlan: string, invoice: Record<string, unknown> | "throws") {
  const live = liveSub(pricePlan, "monthly", { latest_invoice: "in_renew" });
  (live.metadata as Record<string, string>).plan = appPlan;
  s.subscriptionsRetrieve.mockResolvedValue(live);
  if (invoice === "throws") s.invoicesRetrieve.mockRejectedValue(new Error("Stripe is having a moment"));
  else s.invoicesRetrieve.mockResolvedValue(invoice);
  return live;
}
const DRAFT_RENEWAL = {
  status: "draft",
  billing_reason: "subscription_cycle",
  amount_due: 6_800,
  currency: "usd",
  next_payment_attempt: NOW + 3600,
};
function mismatchRows() {
  return audit.logAuditEvent.mock.calls.filter(
    ([e]) => e.action === AUDIT_ACTIONS.BILLING_RENEWAL_PLAN_MISMATCH,
  );
}

describe("the renewal mismatch flag", () => {
  it("a renewal draft about to bill Pro for an account the app holds on Starter raises one warning row, before the charge, and changes nothing", async () => {
    const live = renewal("pro", "starter", DRAFT_RENEWAL);

    const result = await deliver("customer.subscription.updated", live);

    expect(result.success).toBe(true);
    const rows = mismatchRows();
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({
      userId: 7,
      severity: "warning",
      resourceId: "sub_1",
      metadata: expect.objectContaining({
        appPlan: "starter",
        billedPlan: "pro",
        billedInterval: "monthly",
        stripeInvoiceId: "in_renew",
        amountDueCents: 6_800,
        chargesAt: new Date((NOW + 3600) * 1000).toISOString(),
      }),
    });
    /* Flagged, never fixed: no Stripe write, and the record write is the
       handler's ordinary one. */
    expect(s.subscriptionsUpdate).not.toHaveBeenCalled();
    expect(db.updateUserSubscription).toHaveBeenCalledTimes(1);
  });

  it("NEGATIVE CONTROL — when the price and the app agree it stays silent and does not even read the invoice", async () => {
    const live = renewal("pro", "pro", DRAFT_RENEWAL);

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
    expect(s.invoicesRetrieve).not.toHaveBeenCalled();
  });

  it.each([
    ["already charged", { ...DRAFT_RENEWAL, status: "paid" }],
    ["open (finalised)", { ...DRAFT_RENEWAL, status: "open" }],
    ["a change's invoice, not a renewal", { ...DRAFT_RENEWAL, billing_reason: "subscription_update" }],
  ])("a mismatch outside the renewal's draft window — %s — is not flagged here", async (_n, invoice) => {
    const live = renewal("pro", "starter", invoice);

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
  });

  it("a price this catalogue does not compose is 'cannot say', not a mismatch", async () => {
    const live = renewal("pro", "starter", DRAFT_RENEWAL);
    (live.items.data[0].price as Record<string, unknown>).lookup_key = null;

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
  });

  it("an invoice read that fails never fails the event — the subscription write goes ahead", async () => {
    const live = renewal("pro", "starter", "throws");

    const result = await deliver("customer.subscription.updated", live);

    expect(result.success).toBe(true);
    expect(mismatchRows()).toHaveLength(0);
    expect(db.updateUserSubscription).toHaveBeenCalledTimes(1);
  });
});
