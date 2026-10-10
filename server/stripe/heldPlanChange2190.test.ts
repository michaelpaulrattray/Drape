/**
 * A PLAN CHANGE MOVES STRIPE'S PRICE ONLY WHEN ITS CHARGE GOES THROUGH (#2190,
 * his word 2026-10-10: "only switch the price once the payment succeeds …
 * Either way, add a check that compares the app's plan with Stripe's price at
 * renewal and flags any mismatch before Stripe charges").
 *
 * Three subjects, each driven through its real entrance with Stripe and the
 * database doubled at their module boundaries:
 *
 *  1. THE WIRE — `updateSubscriptionPlan` asks Stripe to hold every change
 *     until paid, and then reads WHY a held change was held: a decline is
 *     cancelled (and a scheduled change it cleared is put back, or the
 *     customer is told it was not), a bank confirmation is KEPT with its page,
 *     and an invoice paid in the gap is a change that went through.
 *  2. THE FAILED-CHARGE WEBHOOK — decided from the invoice's own lines
 *     against the live items, never from the subscription's status: a held
 *     change is cancelled and nothing else moves, whether the subscription is
 *     `active` or `past_due`; the old road (Stripe applied it) still ends the
 *     plan; a bank confirmation is left alone; and when the confirmation is
 *     paid, the payment's event runs the credit settlement.
 *  3. THE RENEWAL FLAG — our row (before this event writes it) against the
 *     billed price, in the renewal's draft hour; a scheduled change entering
 *     its phase is the one expected disagreement; one row per invoice.
 *
 * What Stripe really does with each request was measured in test mode on the
 * pinned 2026-01-28.clover — the receipts are on the PR. These arms prove what
 * THIS code does with those answers. Arms named for the relay's findings on
 * head dd580ce2 carry its number (F1–F6).
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
  schedulesRetrieve: vi.fn(),
  schedulesRelease: vi.fn(),
  schedulesCreate: vi.fn(),
  schedulesUpdate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: vi.fn(), list: s.pricesList };
    products = { retrieve: s.productsRetrieve };
    subscriptions = { retrieve: s.subscriptionsRetrieve, update: s.subscriptionsUpdate };
    subscriptionSchedules = {
      create: s.schedulesCreate,
      update: s.schedulesUpdate,
      release: s.schedulesRelease,
      retrieve: s.schedulesRetrieve,
    };
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
  installAnnualMonthlyCredits: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
  withTransaction: vi.fn(),
}));
vi.mock("../db", () => db);

/* The replay guard's claim — shaped like the guard (insert first, the unique
   index arbitrates, release on failure), as `subscriptionNewerGuard.test.ts`
   carries why — plus the one SELECT this card adds: whether a renewal invoice
   has already been flagged (`flaggedRows` is what that read finds). */
const claims = vi.hoisted(() => [] as string[]);
const flaggedRows = vi.hoisted(() => ({ rows: [] as Array<{ id: number }> }));
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
    select: () => ({ from: () => ({ where: () => ({ limit: async () => flaggedRows.rows }) }) }),
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
  PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
} from "./stripeService";
import { handleStripeWebhook } from "./webhooks";
import { priceLookupKey, planCreditsPriceLookupKey } from "./stripePriceCatalogue";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import { periodPriceInCents } from "@shared/annualBilling";
import { formatCustomerShortDate } from "@shared/customerDate";
import { ENV_TAG_KEY } from "./environmentTag";
import { deploymentTag } from "../_core/env";
import { AUDIT_ACTIONS } from "../../drizzle/schema";

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;
const priceId = (plan: string, interval: "monthly" | "annual") => `price_${priceLookupKey(plan, interval)}`;

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
            id: priceId(plan, interval),
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

/**
 * One invoice as Stripe holds it, mutable the way Stripe's is: `retrieve`
 * reads it (with or without the expanded payment attempt), `voidInvoice`
 * voids it. `paidOnVoid` models a payment landing between the read and the
 * void — Stripe then refuses the void, and the invoice reads paid.
 */
const invoice = {
  status: "paid" as string,
  pi: null as string | null,
  hosted: "https://invoice.stripe.example/i/held" as string | null,
  amountDue: 2_777,
  paidOnVoid: false,
  voidFails: false,
};
function invoiceIs(next: Partial<typeof invoice>) {
  Object.assign(invoice, { paidOnVoid: false, voidFails: false }, next);
}

const SCHEDULED = { plan: "starter", interval: "monthly" as const, effectiveSec: NOW + 20 * DAY };
/** A subscription with a decrease to Starter scheduled for its renewal. */
function withScheduledDecrease() {
  s.subscriptionsRetrieve.mockResolvedValue(liveSub("pro", "monthly", { schedule: "sub_sched_old" }));
  s.schedulesRetrieve.mockResolvedValue({
    id: "sub_sched_old",
    status: "active",
    current_phase: { start_date: NOW - 10 * DAY, end_date: SCHEDULED.effectiveSec },
    phases: [
      { start_date: NOW - 10 * DAY, items: [{ price: priceId("pro", "monthly"), quantity: 1 }], metadata: { plan: "pro" } },
      {
        start_date: SCHEDULED.effectiveSec,
        items: [{ price: priceId(SCHEDULED.plan, SCHEDULED.interval), quantity: 1 }],
        metadata: { plan: SCHEDULED.plan, interval: SCHEDULED.interval },
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  claims.length = 0;
  flaggedRows.rows = [];
  catalogue();
  invoiceIs({ status: "paid", pi: "succeeded", hosted: "https://invoice.stripe.example/i/held", amountDue: 2_777 });
  s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly"));
  s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_change", pending_update: null });
  s.invoicesRetrieve.mockImplementation(async () => ({
    status: invoice.status,
    amount_due: invoice.amountDue,
    hosted_invoice_url: invoice.hosted,
    payments: { data: invoice.pi ? [{ payment: { payment_intent: { status: invoice.pi } } }] : [] },
  }));
  s.invoicesVoid.mockImplementation(async () => {
    if (invoice.paidOnVoid) {
      invoice.status = "paid";
      throw new Error("You can only void an open invoice");
    }
    if (invoice.voidFails) throw new Error("Stripe is having a moment");
    invoice.status = "void";
    return { status: "void" };
  });
  s.schedulesRetrieve.mockResolvedValue(null);
  s.schedulesRelease.mockResolvedValue({ id: "sub_sched_old", status: "released" });
  s.schedulesCreate.mockResolvedValue({
    id: "sub_sched_new",
    phases: [
      {
        start_date: NOW - 10 * DAY,
        end_date: SCHEDULED.effectiveSec,
        items: [{ price: priceId("pro", "monthly"), quantity: 1 }],
        metadata: { plan: "pro" },
      },
    ],
  });
  s.schedulesUpdate.mockImplementation(async (_id: string, params: Record<string, any>) => ({
    id: "sub_sched_new",
    phases: params.phases.map((phase: Record<string, any>, i: number) => ({
      ...phase,
      start_date: i === 0 ? NOW - 10 * DAY : SCHEDULED.effectiveSec,
    })),
  }));
  db.updateUserSubscription.mockResolvedValue({ success: true });
  db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);
  db.resolvePlanChangeSettlement.mockResolvedValue(true);
  db.addCredits.mockResolvedValue({ success: true });
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
    expect(params.items[0]).toEqual({ id: "si_base", price: priceId("pro", to) });
    /* The plan's metadata rides the SAME request, so Stripe holds it with the
       price and applies both or neither (measured at the pinned version). */
    expect(params.metadata.plan).toBe("pro");
    expect(s.invoicesVoid).not.toHaveBeenCalled();
  });

  it("a DECLINE (requires_payment_method) is refused, with the hold cancelled by voiding its invoice", async () => {
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    invoiceIs({ status: "open", pi: "requires_payment_method" });

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_base");

    expect(result).toMatchObject({
      success: false,
      paymentDeclined: true,
      heldChangeCancelled: true,
      invoiceId: "in_held",
      error: PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE,
    });
    expect(result.scheduledChangeRestored).toBeUndefined();
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_held");
  });

  it("a hold whose void keeps failing is still refused — tried three times and reported as not cancelled, never as applied", async () => {
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    invoiceIs({ status: "open", pi: "requires_payment_method", voidFails: true });

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_base");

    expect(result.success).toBe(false);
    expect(result.paymentDeclined).toBe(true);
    expect(result.heldChangeCancelled).toBe(false);
    expect(s.invoicesVoid).toHaveBeenCalledTimes(3);
  });

  it("F3 · a BANK CONFIRMATION (requires_action) is KEPT — not voided — and comes back with its page and the confirm sentence", async () => {
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_3ds", pending_update: HELD });
    invoiceIs({ status: "open", pi: "requires_action", hosted: "https://invoice.stripe.example/i/3ds" });

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_base");

    expect(result).toMatchObject({
      success: false,
      confirmationRequired: true,
      confirmUrl: "https://invoice.stripe.example/i/3ds",
      invoiceId: "in_3ds",
      error: PLAN_CHANGE_CONFIRM_PAYMENT_SENTENCE,
    });
    expect(result.paymentDeclined).toBeUndefined();
    expect(s.invoicesVoid).not.toHaveBeenCalled();
  });

  it("F5 · a held invoice already PAID when it is read is a change that went through", async () => {
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    invoiceIs({ status: "paid", pi: "succeeded" });

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_base");

    expect(result).toMatchObject({ success: true, invoiceId: "in_held", invoiceStatus: "paid" });
    expect(result.paymentDeclined).toBeUndefined();
    expect(s.invoicesVoid).not.toHaveBeenCalled();
  });

  it("F5 · a payment landing between the read and the void is a change that went through, and files no 'paid after the plan ended' alarm", async () => {
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    invoiceIs({ status: "open", pi: "requires_payment_method", paidOnVoid: true });

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "monthly", "si_base");

    expect(result).toMatchObject({ success: true, invoiceId: "in_held", invoiceStatus: "paid" });
    expect(audit.logAuditEvent).not.toHaveBeenCalled();
  });

  it("F2 · a declined change PUTS BACK the scheduled change it had to clear, with the same plan and date", async () => {
    withScheduledDecrease();
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    invoiceIs({ status: "open", pi: "requires_payment_method" });

    const result = await updateSubscriptionPlan("sub_1", "studio", 7, "monthly", "si_base");

    expect(s.schedulesRelease).toHaveBeenCalledWith("sub_sched_old");
    expect(result).toMatchObject({ paymentDeclined: true, scheduledChangeRestored: true });
    expect(result.error).toBe(PLAN_CHANGE_PAYMENT_DECLINED_SENTENCE);
    /* Put back AFTER the hold is cancelled, from the subscription as it now
       stands, with the target the customer had chosen. */
    expect(s.schedulesCreate).toHaveBeenCalledWith({ from_subscription: "sub_1" });
    expect(s.invoicesVoid.mock.invocationCallOrder[0]).toBeLessThan(s.schedulesCreate.mock.invocationCallOrder[0]);
    const phases = s.schedulesUpdate.mock.calls[0][1].phases;
    expect(phases[1].metadata).toMatchObject({ plan: SCHEDULED.plan, interval: SCHEDULED.interval });
    expect(phases[1].items).toEqual([{ price: priceId(SCHEDULED.plan, SCHEDULED.interval) }]);
  });

  it("F2 · a scheduled change that cannot be put back is SAID, with its date — never 'your plan has not changed' alone", async () => {
    withScheduledDecrease();
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_held", pending_update: HELD });
    invoiceIs({ status: "open", pi: "requires_payment_method" });
    s.schedulesCreate.mockRejectedValue(new Error("Stripe is having a moment"));

    const result = await updateSubscriptionPlan("sub_1", "studio", 7, "monthly", "si_base");

    expect(result).toMatchObject({ paymentDeclined: true, scheduledChangeRestored: false });
    expect(result.error).toContain("was cleared");
    expect(result.error).toContain(formatCustomerShortDate(new Date(SCHEDULED.effectiveSec * 1000)));
  });

  it("F2 + F3 · a bank confirmation that had to clear a scheduled change is cancelled, the schedule put back, and the customer told what to do", async () => {
    withScheduledDecrease();
    s.subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_3ds", pending_update: HELD });
    invoiceIs({ status: "open", pi: "requires_action" });

    const result = await updateSubscriptionPlan("sub_1", "studio", 7, "monthly", "si_base");

    expect(result.confirmationRequired).toBeUndefined();
    expect(result).toMatchObject({ paymentDeclined: true, scheduledChangeRestored: true });
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_3ds");
    expect(result.error).toContain("Keep my plan");
  });

  it("NEGATIVE CONTROL — a PAID change with a scheduled one does not put the schedule back (the change replaced it)", async () => {
    withScheduledDecrease();
    invoiceIs({ status: "paid", pi: "succeeded" });

    const result = await updateSubscriptionPlan("sub_1", "studio", 7, "monthly", "si_base");

    expect(result.success).toBe(true);
    expect(s.schedulesRelease).toHaveBeenCalledWith("sub_sched_old");
    expect(s.schedulesCreate).not.toHaveBeenCalled();
  });

  it("a schedule that cannot be READ refuses before anything is released or charged", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("pro", "monthly", { schedule: "sub_sched_old" }));
    s.schedulesRetrieve.mockRejectedValue(new Error("Stripe is having a moment"));

    const result = await updateSubscriptionPlan("sub_1", "studio", 7, "monthly", "si_base");

    expect(result.success).toBe(false);
    expect(s.schedulesRelease).not.toHaveBeenCalled();
    expect(s.subscriptionsUpdate).not.toHaveBeenCalled();
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

/** A clover invoice line for a subscription item (the shape measured). */
function line(price: string, amount: number, quantity = 1, proration = true) {
  return {
    amount,
    quantity,
    pricing: { price_details: { price } },
    parent: { type: "subscription_item_details", subscription_item_details: { proration } },
  };
}

/** A declined Starter → Pro change invoice, as `invoice.payment_failed` sends it. */
function changeInvoice(lines: unknown[] = [
  line(priceId("starter", "monthly"), -2_700),
  line(priceId("pro", "monthly"), 6_800),
]) {
  return {
    id: "in_held",
    customer: "cus_1",
    billing_reason: "subscription_update",
    next_payment_attempt: null,
    amount_due: 4_100,
    currency: "usd",
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } },
    lines: { data: lines },
  };
}

// ─── 2 · THE FAILED-CHARGE WEBHOOK ──────────────────────────────────────────

describe("invoice.payment_failed on a plan-change invoice", () => {
  it("a HELD change (its target price is not on the subscription) is cancelled and nothing else moves", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly", { pending_update: HELD }));
    invoiceIs({ status: "open", pi: "requires_payment_method" });

    const result = await deliver("invoice.payment_failed", changeInvoice());

    expect(result.success).toBe(true);
    expect(cancelCalls()).toHaveLength(0);
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_held");
    expect(audit.logAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.BILLING_PAYMENT_FINAL_FAILURE }),
    );
  });

  it("F4 · a held change on a PAST_DUE subscription is cancelled too — never a cancel to Free over a declined change", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly", { status: "past_due" }));
    invoiceIs({ status: "open", pi: "requires_payment_method" });

    const result = await deliver("invoice.payment_failed", changeInvoice());

    expect(result.success).toBe(true);
    expect(cancelCalls()).toHaveLength(0);
    expect(db.updateUserSubscription).not.toHaveBeenCalledWith(7, expect.objectContaining({ planTier: "free" }));
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_held");
  });

  it("F4 · a held DIAL move is read by its quantity — the add-on price is on the subscription, at the old quantity", async () => {
    const addon = `price_${planCreditsPriceLookupKey("studio", "monthly")}`;
    const live = liveSub("studio", "monthly", { status: "past_due" });
    (live.items.data as unknown[]).push({ id: "si_addon", quantity: 2, price: { id: addon, lookup_key: planCreditsPriceLookupKey("studio", "monthly") } });
    s.subscriptionsRetrieve.mockResolvedValue(live);
    invoiceIs({ status: "open", pi: "requires_payment_method" });

    const result = await deliver("invoice.payment_failed", changeInvoice([line(addon, -1_800, 2), line(addon, 2_700, 3)]));

    expect(result.success).toBe(true);
    expect(cancelCalls()).toHaveLength(0);
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_held");
  });

  it("NEGATIVE CONTROL — a change Stripe APPLIED (old road: the target price IS on the subscription) still ends the plan as before", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("pro", "monthly", { status: "past_due" }));
    invoiceIs({ status: "open", pi: "requires_payment_method" });

    const result = await deliver("invoice.payment_failed", changeInvoice());

    expect(result.success).toBe(true);
    expect(cancelCalls()).toHaveLength(1);
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", subscriptionStatus: "canceled" }),
    );
  });

  it("lines that say nothing fall back to Stripe's own pending_update naming this invoice", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(
      liveSub("starter", "monthly", { status: "past_due", pending_update: HELD, latest_invoice: "in_held" }),
    );
    invoiceIs({ status: "open", pi: "requires_payment_method" });

    const result = await deliver("invoice.payment_failed", changeInvoice([]));

    expect(result.success).toBe(true);
    expect(cancelCalls()).toHaveLength(0);
    expect(s.invoicesVoid).toHaveBeenCalledWith("in_held");
  });

  it("F3 · a change waiting on the customer's BANK is left held — no void, no cancel", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly", { pending_update: HELD }));
    invoiceIs({ status: "open", pi: "requires_action" });

    const result = await deliver("invoice.payment_failed", changeInvoice());

    expect(result.success).toBe(true);
    expect(s.invoicesVoid).not.toHaveBeenCalled();
    expect(cancelCalls()).toHaveLength(0);
    expect(db.resolvePlanChangeSettlement).not.toHaveBeenCalled();
  });

  it("F5 · an invoice PAID since the failure applied its change — no void, no cancel, its payment event settles it", async () => {
    s.subscriptionsRetrieve.mockResolvedValue(liveSub("starter", "monthly"));
    invoiceIs({ status: "paid", pi: "succeeded" });
    /* Its credits are queued and owed: voiding that row here would leave a
       paid change with no credits, which is the half of F5 a void hides. */
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      stripeInvoiceId: "in_held", userId: 7, direction: "grant", credits: 90_000, status: "pending",
    });

    const result = await deliver("invoice.payment_failed", changeInvoice());

    expect(result.success).toBe(true);
    expect(s.invoicesVoid).not.toHaveBeenCalled();
    expect(cancelCalls()).toHaveLength(0);
    expect(db.resolvePlanChangeSettlement).not.toHaveBeenCalled();
  });

  it("a live read that fails fails the event, so Stripe redelivers rather than this guessing", async () => {
    s.subscriptionsRetrieve.mockRejectedValue(new Error("Stripe is having a moment"));

    const result = await deliver("invoice.payment_failed", changeInvoice());

    expect(result.success).toBe(false);
    expect(cancelCalls()).toHaveLength(0);
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
  });
});

describe("F3 · paying the bank's confirmation later", () => {
  it("runs the credit settlement queued against that invoice when its payment lands", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      stripeInvoiceId: "in_3ds",
      userId: 7,
      direction: "grant",
      credits: 90_000,
      status: "pending",
      description: "Prorated credits for upgrade to pro",
      annualMonthlyCredits: null,
      annualPeriodStart: null,
    });

    await deliver("invoice.payment_succeeded", {
      ...changeInvoice(),
      id: "in_3ds",
      status: "paid",
      amount_paid: 4_100,
    });

    expect(db.addCredits).toHaveBeenCalledWith(
      7,
      90_000,
      "bonus",
      "Prorated credits for upgrade to pro",
      expect.stringContaining("in_3ds"),
    );
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_3ds", "applied");
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

/** A renewal moment: Stripe bills `pricePlan` with `metadata.plan` `metaPlan`;
 *  our row says `rowPlan`; the latest invoice is `inv`. */
function renewal(
  pricePlan: string,
  rowPlan: string,
  inv: Record<string, unknown> | "throws",
  metaPlan: string = pricePlan,
  overrides: Record<string, unknown> = {},
) {
  const live = liveSub(pricePlan, "monthly", { latest_invoice: "in_renew", ...overrides });
  (live.metadata as Record<string, string>).plan = metaPlan;
  s.subscriptionsRetrieve.mockResolvedValue(live);
  db.getUserByStripeCustomerId.mockResolvedValue({
    id: 7,
    name: "seven",
    email: "u@example.com",
    credits: { planTier: rowPlan, balance: 4000, stripeSubscriptionId: "sub_1", billingInterval: "month" },
  });
  if (inv === "throws") s.invoicesRetrieve.mockRejectedValue(new Error("Stripe is having a moment"));
  else s.invoicesRetrieve.mockResolvedValue(inv);
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
  it("F1 · THE CASE IT EXISTS FOR — our row says Starter, Stripe bills Pro with metadata 'pro' — one warning row before the charge, nothing changed", async () => {
    const live = renewal("pro", "starter", DRAFT_RENEWAL, "pro");

    const result = await deliver("customer.subscription.updated", live);

    expect(result.success).toBe(true);
    const rows = mismatchRows();
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({
      userId: 7,
      severity: "warning",
      resourceId: "in_renew",
      metadata: expect.objectContaining({
        appPlan: "starter",
        billedPlan: "pro",
        billedInterval: "monthly",
        stripeInvoiceId: "in_renew",
        amountDueCents: 6_800,
        chargesAt: new Date((NOW + 3600) * 1000).toISOString(),
      }),
    });
    expect(s.subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL — when the price and our row agree it stays silent and does not even read the invoice", async () => {
    const live = renewal("pro", "pro", DRAFT_RENEWAL);

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
    expect(s.invoicesRetrieve).not.toHaveBeenCalled();
  });

  it("a decrease SCHEDULED for this renewal (the phase in progress names the billed plan) is the expected disagreement — silent", async () => {
    const live = renewal("starter", "pro", DRAFT_RENEWAL, "starter", { schedule: "sub_sched_1" });
    s.schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      current_phase: { start_date: NOW, end_date: NOW + 30 * DAY },
      phases: [
        { start_date: NOW - 30 * DAY, metadata: { plan: "pro" } },
        { start_date: NOW, metadata: { plan: "starter" } },
      ],
    });

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
  });

  it("…but a schedule whose phase names a DIFFERENT plan does not excuse it", async () => {
    const live = renewal("pro", "starter", DRAFT_RENEWAL, "pro", { schedule: "sub_sched_1" });
    s.schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      current_phase: { start_date: NOW, end_date: NOW + 30 * DAY },
      phases: [{ start_date: NOW, metadata: { plan: "starter" } }],
    });

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(1);
  });

  it("one row per renewal invoice — a second event in the draft hour finds it flagged and writes nothing", async () => {
    const live = renewal("pro", "starter", DRAFT_RENEWAL, "pro");
    flaggedRows.rows = [{ id: 1 }];

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
  });

  it.each([
    ["already charged", { ...DRAFT_RENEWAL, status: "paid" }],
    ["open (finalised)", { ...DRAFT_RENEWAL, status: "open" }],
    ["a change's invoice, not a renewal", { ...DRAFT_RENEWAL, billing_reason: "subscription_update" }],
  ])("a mismatch outside the renewal's draft window — %s — is not flagged here", async (_n, inv) => {
    const live = renewal("pro", "starter", inv, "pro");

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
  });

  it("a price this catalogue does not compose is 'cannot say', not a mismatch", async () => {
    const live = renewal("pro", "starter", DRAFT_RENEWAL, "pro");
    (live.items.data[0].price as Record<string, unknown>).lookup_key = null;

    await deliver("customer.subscription.updated", live);

    expect(mismatchRows()).toHaveLength(0);
  });

  it("an invoice read that fails never fails the event — the subscription write goes ahead", async () => {
    const live = renewal("pro", "starter", "throws", "pro");

    const result = await deliver("customer.subscription.updated", live);

    expect(result.success).toBe(true);
    expect(mismatchRows()).toHaveLength(0);
    expect(db.updateUserSubscription).toHaveBeenCalledTimes(1);
  });
});
