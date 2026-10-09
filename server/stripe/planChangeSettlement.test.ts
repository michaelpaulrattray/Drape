/**
 * CREDITS MOVE WHEN THE MONEY THEY MIRROR SETTLES (#711) — driven through the
 * real `changePlan` procedure and the real webhook entry point, with Stripe
 * and the database doubled at their module boundaries.
 *
 * The defect: `changePlan` moved credits when Stripe ACCEPTED the update, not
 * when the `always_invoice` charge settled — a declined card kept an
 * upgrade's credits (×12 on annual), and a declined interval switch left the
 * customer deducted with no new grant. The rule under test:
 *
 *   record the move against the change's own invoice → apply if the invoice
 *   is already paid (the instant happy path) → otherwise the
 *   invoice.payment_succeeded webhook applies it, and a FINAL payment
 *   failure voids it.
 *
 * The arms that matter most are the two negative controls: the DECLINED card
 * moving nothing (arm 1 — red against the pre-#711 code), and the final
 * failure voiding the pending move (arm: void).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";

const { pricesCreate, pricesList, subscriptionsUpdate, subscriptionsRetrieve, invoicesRetrieve, invoicesVoid } =
  vi.hoisted(() => ({
    pricesCreate: vi.fn(),
    pricesList: vi.fn(),
    subscriptionsUpdate: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    invoicesRetrieve: vi.fn(),
    invoicesVoid: vi.fn(),
  }));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: pricesCreate, list: pricesList };
    /* The spent-share line's own catalogue product (#2023), read before a
       switch that carries one — present and active, as the ceremony leaves it. */
    products = { retrieve: vi.fn(async (id: string) => ({ id, active: true })) };
    subscriptions = { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate };
    invoices = { retrieve: invoicesRetrieve, voidInvoice: invoicesVoid };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

const db = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  getUserCredits: vi.fn(),
  recordPlanChangeSettlement: vi.fn(),
  getPlanChangeSettlementByInvoice: vi.fn(),
  resolvePlanChangeSettlement: vi.fn().mockResolvedValue(true),
  getUserByStripeCustomerId: vi.fn(),
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 1 }),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(false),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  voidPendingPlanChangeSettlementsForUser: vi.fn().mockResolvedValue([]),
  getVoidPlanChangeSettlementInvoiceIdsForUser: vi.fn().mockResolvedValue([]),
  getDb: vi.fn().mockResolvedValue(null),
  withTransaction: vi.fn(),
  /* #2152 — a yearly plan's months; null = no year in flight (every arm above). */
  getAnnualYearProgress: vi.fn().mockResolvedValue(null),
  installAnnualMonthlyCredits: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db", () => db);

/* The webhook's replay guard reads the connection module directly. The double
   RECORDS what the handler leaves recorded (PR #786 round 2): a redelivery arm
   must be able to see that a failed event was NOT marked processed, or it
   drives a road production cannot take.

   ⚠ THE GUARD IS A CLAIM SINCE #1361 and this double moved with it — the
   product inserts FIRST and lets the unique index arbitrate, then RELEASES the
   row when the handler fails. The question every arm here asks is unchanged
   (*was this event left recorded?*), and so are their expectations. */
const processedEventInserts = vi.hoisted(() => [] as Array<{ eventId: string; eventType: string }>);
vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    insert: () => ({
      values: async (row: { eventId: string; eventType: string }) => {
        if (processedEventInserts.some((seen) => seen.eventId === row.eventId)) {
          /* MySQL's own refusal from the unique index on `eventId`. */
          throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 });
        }
        processedEventInserts.push(row);
      },
    }),
    /* The release. One event is in flight per arm, so the row dropped is the
       claim just made — which is what `WHERE eventId = …` does in the product. */
    delete: () => ({ where: async () => { processedEventInserts.pop(); } }),
  })),
}));

vi.mock("../auditLog", async () => {
  const schema = await vi.importActual<typeof import("../../drizzle/schema")>(
    "../../drizzle/schema",
  );
  return {
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
    AUDIT_ACTIONS: schema.AUDIT_ACTIONS,
  };
});

import { billingRouter } from "../routes/billing";
import { handleStripeWebhook } from "./webhooks";
import { settlementLedgerRef, settlementShortfallLedgerRef } from "./planChangeSettlement";
import { PLAN_TIERS } from "../../drizzle/schema";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import { periodPriceInCents } from "@shared/annualBilling";
import { wholeDisplayLedger } from "@shared/creditDisplay";
import { deploymentTag } from "../_core/env";

const USER = { id: 7, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER } as never);

const NOW_SEC = Math.floor(Date.now() / 1000);
const DAY = 86_400;

/** A monthly `starter` subscription, 20 of 30 days remaining. */
function armStripeSubscription() {
  subscriptionsRetrieve.mockResolvedValue({
    /* A running plan — the only state `changePlan` lets change (#1987). */
    status: "active",
    metadata: { plan: "starter" },
    items: {
      data: [
        {
          id: "si_1",
          price: { recurring: { interval: "month" } },
          current_period_start: NOW_SEC - 10 * DAY,
          current_period_end: NOW_SEC + 20 * DAY,
        },
      ],
    },
  });
}

/** What the real quote computes for starter → pro over the same 20/30 days —
 *  re-derived here from the same constants so the assertion is exact.
 *
 *  ⚠ Both are quantised to a whole DISPLAYED credit since #1604 slice 2: the
 *  bare floor gave 83,333 for the upgrade share, which is 16,666.6 displayed
 *  credits, so a third of a credit would have sat on the balance unshowable.
 *  83,330 is exactly 16,666. */
const daysRemaining = Math.min(30, Math.max(0, Math.ceil((NOW_SEC + 20 * DAY - NOW_SEC) / DAY)));
const UPGRADE_CREDITS = wholeDisplayLedger(Math.floor(
  (PLAN_TIERS.pro.monthlyCredits - PLAN_TIERS.starter.monthlyCredits) * (daysRemaining / 30),
));
const UNWIND_CREDITS = wholeDisplayLedger(Math.floor(
  PLAN_TIERS.starter.monthlyCredits * (daysRemaining / 30),
));

beforeEach(() => {
  vi.clearAllMocks();
  db.getUserById.mockResolvedValue({ id: 7, frozenAt: null, email: "u@example.com" });
  db.getSubscriptionByUserId.mockResolvedValue({
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    planTier: "starter",
  });
  db.updateUserSubscription.mockResolvedValue({ success: true });
  db.recordPlanChangeSettlement.mockResolvedValue({ success: true });
  db.resolvePlanChangeSettlement.mockResolvedValue(true);
  db.addCredits.mockResolvedValue({ success: true, newBalance: 1000 });
  db.deductCredits.mockResolvedValue({ success: true, newBalance: 0 });
  db.getUserCredits.mockResolvedValue({ balance: 100_000 });
  db.refreshMonthlyCredits.mockResolvedValue({ success: true, newBalance: 1 });
  db.getAnnualYearProgress.mockResolvedValue(null);
  db.installAnnualMonthlyCredits.mockResolvedValue(true);
  db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue([]);
  db.getVoidPlanChangeSettlementInvoiceIdsForUser.mockResolvedValue([]);
  pricesCreate.mockResolvedValue({ id: "price_minted" });
  /* ⚠ THE PLAN'S PRICE IS NOW AN OBJECT IN STRIPE'S CATALOGUE (#1605 bullet
     1), so `updateSubscriptionPlan` resolves it by lookup key before it
     touches the subscription. This suite measures what happens to CREDITS
     after the change, so the catalogue simply answers; the resolver's own
     refusals are driven in `stripePriceCatalogue.test.ts` and its wire in
     `annualPlanChange.test.ts`.

     It answers for whichever plan and interval an arm asks for rather than for
     one fixed rung, because a hard-coded `pro` answer would refuse on the
     amount check the moment an arm changed rung — which is the refusal
     working, in a suite that is not about it. */
  pricesList.mockImplementation(async ({ lookup_keys }: { lookup_keys: string[] }) => {
    const key = lookup_keys[0];
    const match = /^klieg_(.+)_(monthly|yearly)_v2$/.exec(key);
    if (!match) return { data: [] };
    const [, plan, keyInterval] = match;
    const product = SUBSCRIPTION_PRODUCTS[plan];
    if (!product) return { data: [] };
    const interval = keyInterval === "yearly" ? "annual" : "monthly";
    return {
      data: [
        {
          id: `price_catalogue_${plan}_${keyInterval}`,
          lookup_key: key,
          unit_amount: periodPriceInCents(product.priceInCents, interval),
          recurring: { interval: keyInterval === "yearly" ? "year" : "month" },
        },
      ],
    };
  });
  subscriptionsUpdate.mockResolvedValue({ latest_invoice: "in_change" });
  armStripeSubscription();
});

describe("changePlan — the grant hangs on the invoice, not on the Stripe update", () => {
  it("a DECLINED card moves NOTHING: unpaid invoice → no credits, a pending settlement, honest copy", async () => {
    /* The invoice is open at the update read AND at the fresh re-read. */
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });

    const result = await caller().changePlan({ newPlan: "pro" });

    /* The whole point of #711: no credit moved on the Stripe update alone. */
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.deductCredits).not.toHaveBeenCalled();

    /* The move is recorded against the change's own invoice… */
    expect(db.recordPlanChangeSettlement).toHaveBeenCalledTimes(1);
    expect(db.recordPlanChangeSettlement.mock.calls[0][0]).toMatchObject({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
    });

    /* …and the customer is told the truth, in their vocabulary. */
    expect(result.creditSettlement).toBe("pending");
    expect(result.message).toContain("land as soon as the payment settles");
    expect(result.message).not.toContain("bonus credits added");
  });

  it("a WORKING card keeps the instant feel: invoice already paid → recorded AND applied in the same breath", async () => {
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "paid" });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(db.recordPlanChangeSettlement).toHaveBeenCalledTimes(1);
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(db.addCredits).toHaveBeenCalledWith(
      7,
      UPGRADE_CREDITS,
      "bonus",
      "Prorated credits for upgrade to pro",
      settlementLedgerRef("in_change"),
    );
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
    expect(result.creditSettlement).toBe("applied");
    expect(result.message).toContain("bonus credits added");
  });

  it("closes the webhook-first race: open at the update read, PAID at the fresh re-read → applied", async () => {
    /* First retrieve (inside updateSubscriptionPlan) says open; the fresh
       re-read AFTER the row is recorded says paid — the exact window where a
       synchronously-paid invoice's webhook fired before the row existed. */
    invoicesRetrieve
      .mockResolvedValueOnce({ amount_due: 12_00, status: "open" })
      .mockResolvedValueOnce({ status: "paid" });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    /* The re-read happened AFTER the record — the order is the race fix. */
    expect(db.recordPlanChangeSettlement.mock.invocationCallOrder[0]).toBeLessThan(
      invoicesRetrieve.mock.invocationCallOrder[1],
    );
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(result.creditSettlement).toBe("applied");
  });

  it("an interval switch's UNWIND waits for the switch invoice too — a declined card deducts nothing", async () => {
    invoicesRetrieve.mockResolvedValue({ amount_due: 500_00, status: "open" });

    const result = await caller().changePlan({ newPlan: "starter", interval: "annual" });

    expect(db.deductCredits).not.toHaveBeenCalled();
    expect(db.recordPlanChangeSettlement.mock.calls[0][0]).toMatchObject({
      stripeInvoiceId: "in_change",
      direction: "unwind",
      credits: UNWIND_CREDITS,
    });
    expect(result.creditSettlement).toBe("pending");
  });

  it("a transient failure of the fresh re-read RETRIES before deferring — the last road to a paid customer's credits (review finding 1)", async () => {
    /* update-time read: open. Fresh re-read attempt 1: the read itself
       fails. Attempt 2: paid. Deferring on attempt 1 would strand the row
       if the webhook was already consumed — the retry is the repair. */
    invoicesRetrieve
      .mockResolvedValueOnce({ amount_due: 12_00, status: "open" })
      .mockRejectedValueOnce(new Error("stripe 5xx"))
      .mockResolvedValueOnce({ status: "paid" });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: UPGRADE_CREDITS,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
    });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(invoicesRetrieve).toHaveBeenCalledTimes(3);
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(result.creditSettlement).toBe("applied");
  });

  it("a grant whose settlement cannot be RECORDED refuses loudly — money taken with nothing owing it back is not success", async () => {
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    db.recordPlanChangeSettlement.mockResolvedValue({ success: false, error: "db down" });

    await expect(caller().changePlan({ newPlan: "pro" })).rejects.toThrow(
      /credit adjustment could not be recorded/,
    );
  });

  it("the no-invoice road (unreachable under always_invoice) falls back to the immediate move, never to silence", async () => {
    subscriptionsUpdate.mockResolvedValue({ latest_invoice: null });

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(db.recordPlanChangeSettlement).not.toHaveBeenCalled();
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(result.creditSettlement).toBe("applied");
  });

  /**
   * ⚠ **THE SECOND SITE OF #1661, AND IT IS THE ONE THAT HAD NO ARM AT ALL.**
   *
   * The card names two places that floor a clawback, and this is the legacy
   * immediate road — reached only when the Stripe update produces no invoice,
   * which `always_invoice` should make unreachable. Its own comment says it is
   * *"loud, never silent"* rather than removed, so it is live code on a money
   * path and it floored at the TOTAL balance exactly as the webhook road did.
   *
   * ⚠ **IT WAS DRIVEN AS A PLAIN DOWNGRADE UNTIL #1936 CLOSED THAT ROAD, AND
   * THE RE-POINTING IS THAT CARD'S LAW-7 SWEEP REACHING THIS FILE.** His
   * option 1 defers every change that hands money back, so `changePlan` on a
   * downgrade now returns before `updateSubscriptionPlan` is ever called —
   * these two arms stopped exercising the unwind branch at all and started
   * failing on the schedule road instead. **The CONTROL is not dead and that
   * was checked before the fixture moved**: the unwind branch is still
   * reachable through `creditUnwind`, which every interval switch carries, and
   * **monthly → annual** is charged rather than refunded, so it stays instant.
   * That is the fixture now — same floor, same two numbers, a road that exists.
   *
   * The downgrade's own absence is covered where it belongs, by
   * `server/routes/deferredPlanChangeRoute.test.ts`, which asserts that
   * `deductCredits` is not reached at all on that road.
   */
  it("the legacy immediate unwind floors at the PLAN'S part too — both sites, one rule", async () => {
    db.getSubscriptionByUserId.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      planTier: "pro",
    });
    subscriptionsRetrieve.mockResolvedValue({
      /* Running, and stating its product and currency — a switch whose spent
         share is charged back (#1965) builds that line off them, and refuses
         without them. */
      status: "active",
      currency: "usd",
      metadata: { plan: "pro" },
      items: {
        data: [
          {
            id: "si_1",
            price: { product: "prod_pro", recurring: { interval: "month" } },
            current_period_start: NOW_SEC - 10 * DAY,
            current_period_end: NOW_SEC + 20 * DAY,
          },
        ],
      },
    });
    subscriptionsUpdate.mockResolvedValue({ latest_invoice: null });
    /* 25,000 bought with 2,000 of the allowance left — the card's own number.
       Whatever this switch's unwind works out to, it may not reach past 2,000,
       because everything above that is the customer's money. */
    db.getUserCredits.mockResolvedValue({ balance: 27_000, purchasedBalance: 25_000 });

    const result = await caller().changePlan({ newPlan: "pro", interval: "annual" });

    expect(result.creditSettlement).toBe("applied");
    expect(db.deductCredits).toHaveBeenCalledTimes(1);
    expect(db.deductCredits.mock.calls[0][1]).toBe(2000);
  });

  it("and deducts the full unwind on that road when nothing was bought", async () => {
    /* The positive control for the site above: a floor stuck at the plan's part
       of a purchased-only balance would be 0 here and would silently stop every
       legitimate unwind on this road. Same interval switch as the arm above —
       see its docblock for why this is no longer a downgrade (#1936). */
    db.getSubscriptionByUserId.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      planTier: "pro",
    });
    subscriptionsRetrieve.mockResolvedValue({
      /* Running, and stating its product and currency — a switch whose spent
         share is charged back (#1965) builds that line off them, and refuses
         without them. */
      status: "active",
      currency: "usd",
      metadata: { plan: "pro" },
      items: {
        data: [
          {
            id: "si_1",
            price: { product: "prod_pro", recurring: { interval: "month" } },
            current_period_start: NOW_SEC - 10 * DAY,
            current_period_end: NOW_SEC + 20 * DAY,
          },
        ],
      },
    });
    subscriptionsUpdate.mockResolvedValue({ latest_invoice: null });
    db.getUserCredits.mockResolvedValue({ balance: 100_000, purchasedBalance: 0 });

    await caller().changePlan({ newPlan: "pro", interval: "annual" });

    expect(db.deductCredits).toHaveBeenCalledTimes(1);
    /* ⚠ Asserted as STRICTLY MORE THAN the 2,000 the arm above deducted, rather
       than as a number re-derived from PLAN_TIERS here. That comparison is the
       only thing that proves the floor above actually BOUND something: if this
       road's mirror happened to be 2,000 or less, the arm above would be green
       with no floor applied at all. */
    expect(db.deductCredits.mock.calls[0][1]).toBeGreaterThan(2000);
  });
});

/* ────────────────────────── the webhook side ────────────────────────── */

let eventSeq = 0;
function stripeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  eventSeq += 1;
  return {
    id: `evt_711_${eventSeq}`,
    type,
    data: { object },
    object: "event",
    api_version: "2023-10-16",
    created: NOW_SEC,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

describe("the webhook settles what changePlan recorded", () => {
  const grantRow = {
    userId: 7,
    stripeInvoiceId: "in_change",
    direction: "grant" as const,
    credits: 4000,
    description: "Prorated credits for upgrade to pro",
    status: "pending" as const,
  };

  /* The service's own stripe instance was built from the double above; its
     `webhooks.constructEvent` mock is what turns a payload into our event. */
  let lastEvent: Stripe.Event | null = null;
  async function deliverEvent(type: string, object: Record<string, unknown>) {
    const event = stripeEvent(type, object);
    lastEvent = event;
    const svc = await import("./stripeService");
    const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
    (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(event);
    return handleStripeWebhook("{}", "sig");
  }

  /** Stripe sending the SAME event again — same id, not a fresh one. */
  async function redeliverLastEvent() {
    if (!lastEvent) throw new Error("nothing delivered yet");
    const svc = await import("./stripeService");
    const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
    (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(lastEvent);
    return handleStripeWebhook("{}", "sig");
  }

  /**
   * #795 — the subscription handlers fetch the live subscription and apply
   * THAT, never the event's payload. The deleted road proceeds only when the
   * live read agrees the subscription is dead, so every deleted arm arms the
   * retrieve with a dead one; an updated arm arms it with whatever the live
   * truth of its scenario is.
   */
  function armLiveRead(subscription: Record<string, unknown>) {
    subscriptionsRetrieve.mockResolvedValue(subscription);
  }
  const deadLiveSub = (id = "sub_1") => ({ id, status: "canceled" });

  beforeEach(() => {
    processedEventInserts.length = 0;
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000 },
    });
  });

  it("invoice.payment_succeeded applies a pending GRANT on its proration-only invoice", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.addCredits).toHaveBeenCalledWith(
      7,
      4000,
      "bonus",
      grantRow.description,
      settlementLedgerRef("in_change"),
    );
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
    /* Proration-only invoice: the period logic granted nothing on top. */
    expect(db.refreshMonthlyCredits).not.toHaveBeenCalled();
  });

  it("a REPLAY cannot double-grant: the ledger's duplicate verdict resolves the row and succeeds", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    db.addCredits.mockResolvedValue({ success: true, newBalance: 4000, duplicate: true });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.addCredits).toHaveBeenCalledTimes(1);
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
  });

  /**
   * ⚠ **THE SWITCH INVOICE'S REAL SHAPE (#2069).** This arm used to feed a
   * single year line with `proration: false` and no unused-time credit — a
   * shape Stripe never sent on this road, which is why the suite stayed green
   * while every real monthly → yearly switch granted nothing. Below is the
   * invoice Stripe sends since `updateSubscriptionPlan` asks for
   * `billing_cycle_anchor: "now"` on a switch, transcribed from the test-mode
   * drive (`2026-01-28.clover` dialect: the proration flag under `parent`,
   * the price as an id): the old month's unused time as a NEGATIVE proration
   * line, and the year as an ordinary period line.
   */
  const switchLines = (yearIsProration: boolean) => ({
    data: [
      {
        amount: -2700,
        description: "Unused time on Klieg Starter after 08 Oct 2026",
        quantity: 1,
        period: { start: NOW_SEC, end: NOW_SEC + 31 * DAY },
        pricing: { price_details: { price: "price_starter_monthly" } },
        parent: {
          type: "subscription_item_details",
          subscription_item_details: { proration: true, subscription_item: "si_1" },
        },
      },
      {
        amount: 26900,
        description: yearIsProration
          ? "Remaining time on Klieg Starter after 08 Oct 2026"
          : "1 × Klieg Starter (at $269.00 / year)",
        quantity: 1,
        period: { start: NOW_SEC, end: NOW_SEC + 365 * DAY },
        pricing: { price_details: { price: "price_starter_yearly" } },
        parent: {
          type: "subscription_item_details",
          subscription_item_details: { proration: yearIsProration, subscription_item: "si_1" },
        },
      },
    ],
  });

  it("an interval switch settles WHOLE: the unwind lands, then the same invoice's period grant", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 3000,
      description: "Unused monthly cycle credits returned with its refund",
    });
    db.getUserCredits.mockResolvedValue({ balance: 10_000 });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_1" } },
      billing_reason: "subscription_update",
      lines: switchLines(false),
    });

    expect(result.success).toBe(true);
    expect(db.deductCredits).toHaveBeenCalledTimes(1);
    expect(db.deductCredits.mock.calls[0].slice(0, 3)).toEqual([7, 3000, "subscription"]);
    expect(db.refreshMonthlyCredits).toHaveBeenCalledTimes(1);
    /* The YEAR's first month, granted once, on the invoice's own reference —
       the other eleven arrive monthly (#2152) — and the negative unused-time
       line is not read as a period of its own. */
    expect(db.refreshMonthlyCredits.mock.calls[0][0]).toBe(7);
    expect(db.refreshMonthlyCredits.mock.calls[0][1]).toBe(PLAN_TIERS.pro.monthlyCredits);
    expect(db.refreshMonthlyCredits.mock.calls[0][6].annualYear.monthlyCredits).toBe(PLAN_TIERS.pro.monthlyCredits);
    expect(db.refreshMonthlyCredits.mock.calls[0][3]).toBe("stripe-invoice:in_change");
    /* Deterministic order: the unwind before the grant. */
    expect(db.deductCredits.mock.invocationCallOrder[0]).toBeLessThan(
      db.refreshMonthlyCredits.mock.invocationCallOrder[0],
    );
  });

  /**
   * The shape the anchor exists to avoid, pinned so nobody mistakes the reader
   * for the fix: WITHOUT `billing_cycle_anchor: "now"` Stripe bills the year as
   * a PRORATION line, and the grant does not read proration lines — so the
   * repair for #2069 lives on the request (`annualPlanChange.test.ts`), and
   * `periodBought` keeps one rule for every road. The unwind still lands.
   */
  it("the pre-#2069 switch shape — the year as a proration line — grants no period", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 3000,
    });
    db.getUserCredits.mockResolvedValue({ balance: 10_000 });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_1" } },
      billing_reason: "subscription_update",
      lines: switchLines(true),
    });

    expect(result.success).toBe(true);
    expect(db.deductCredits).toHaveBeenCalledTimes(1);
    expect(db.refreshMonthlyCredits).not.toHaveBeenCalled();
  });

  it("the unwind floors at the LIVE balance at application time — spent credits are spent", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 3000,
    });
    db.getUserCredits.mockResolvedValue({ balance: 400 });

    await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(db.deductCredits.mock.calls[0][1]).toBe(400);
  });

  /**
   * ⚠ **AND IT FLOORS AT THE PLAN'S PART, NEVER AT THE TOTAL — #1661, the
   * #1604 sibling, and it REVERSES a recorded review decision.**
   *
   * A downgrade claws back the unconsumed share of the allowance the customer is
   * handing back, because Stripe returns that share's money in the same act. The
   * floor used to be the TOTAL balance on #664's *"deliberately coarse mirror"*
   * ruling — which was correct when it was made, because there were no
   * per-source lots and no purchased credits either: the one-time top-up had
   * been removed in February. **#1604 creates the thing that ruling says does
   * not exist**, and from then a plan dispute could be settled out of credits
   * the customer BOUGHT.
   *
   * `planAllowanceRemaining` is deliberately NOT mocked here — it comes from
   * `../db/credits`, not the `../db` double — so these arms drive the product's
   * real arithmetic rather than a stand-in that agrees with them.
   */
  it("floors the unwind at the PLAN'S part — never at credits the customer bought", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 8000,
    });
    /* The card's own worked number: 25,000 bought, 2,000 of the allowance left.
       The old floor deducted min(8,000, 27,000) = 8,000, and 6,000 of that was
       her money. */
    db.getUserCredits.mockResolvedValue({ balance: 27_000, purchasedBalance: 25_000 });

    await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(db.deductCredits).toHaveBeenCalledTimes(1);
    expect(db.deductCredits.mock.calls[0][1]).toBe(2000);
  });

  it("moves NOTHING when every credit left was bought, and resolves rather than retrying", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 8000,
    });
    /* The allowance is entirely spent; the balance is purchased credits only. */
    db.getUserCredits.mockResolvedValue({ balance: 25_000, purchasedBalance: 25_000 });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.deductCredits).not.toHaveBeenCalled();
    /* The row must still resolve, or it reads as queued work for ever — the
       zero-returnable branch's own stated reason. */
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
  });

  it("deducts the whole mirror when nothing was bought — the common case does not move", async () => {
    /* The positive control. A floor that always answered 0 would satisfy both
       arms above and stop every legitimate unwind in the product. */
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 3000,
    });
    db.getUserCredits.mockResolvedValue({ balance: 27_000, purchasedBalance: 0 });

    await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(db.deductCredits.mock.calls[0][1]).toBe(3000);
  });

  it("treats a row it cannot read as nothing to claw back, never as everything", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      ...grantRow,
      direction: "unwind" as const,
      credits: 8000,
    });
    /* No credits row at all. The old code read `liveCredits?.balance ?? 0`; the
       new one answers 0 the same way, and the direction matters on a money path:
       a provenance we could not read must never license a clawback. */
    db.getUserCredits.mockResolvedValue(null);

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.deductCredits).not.toHaveBeenCalled();
  });

  it("a FINAL payment failure VOIDS the pending move — the declined card's credits never arrive", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "void");
    expect(db.addCredits).not.toHaveBeenCalled();
  });

  /*
    #756 — THE OTHER HALF OF THAT VOID, AND WITHOUT IT THE TWO SIDES OF THE
    LEDGER DISAGREE. The arm above closes the CREDIT side. The INVOICE stayed
    `open` and payable through Stripe's hosted invoice page, so the customer
    could pay it days later: money accepted, credits refused by the void row,
    plan already cancelled.
  */
  it("a FINAL payment failure also VOIDS THE INVOICE — it can no longer take money", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledWith("in_change");
  });

  /*
    ⚠ THE NEGATIVE CONTROL, and it is the arm that stops this becoming noise.
    Stripe redelivers failed events for DAYS, and it rejects `voidInvoice` on
    anything not `open`. A blind call would log a failure on every benign
    redelivery of an invoice we already voided.
  */
  it("an invoice that is already closed is NOT voided again", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "void" });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  /*
    ⚠ AN `uncollectible` INVOICE IS VOIDED, AND THIS ARM IS THE PR #764 REVIEW'S
    FINDING 1 — a real defect in the first shape of this fix, caught because the
    docblock asserted something about Stripe that was never checked.

    `uncollectible` is bad-debt bookkeeping, which is EXACTLY what somebody
    marks a finally-failed invoice as. It is not terminal — Stripe allows
    uncollectible → paid, so the invoice can still take money — and it is
    voidable. Reading it as "already closed" left this card's whole defect
    alive on that road while logging that it had been handled.
  */
  it("an UNCOLLECTIBLE invoice IS voided — it is bad debt, not closed, and can still be paid", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "uncollectible" });
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });

    await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(invoicesVoid).toHaveBeenCalledWith("in_change");
  });

  /*
    PR #764 review note 2 — the blast radius is wider than this suite's framing
    and that is INTENDED, so it gets an arm rather than a sentence. The void
    sits in the final-failure branch unconditionally, so it also closes a plain
    RENEWAL's invoice, which carries no settlement row at all. That is the same
    ledger disagreement in a milder form — a late-paid renewal against a
    subscription already cancelled and downgraded to free — and it is the case
    production will meet first.
  */
  it("a finally-failed RENEWAL invoice is voided too, with no settlement row in sight", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);
    invoicesRetrieve.mockResolvedValue({ amount_due: 29_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_renewal", status: "void" });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_renewal",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 29_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledWith("in_renewal");
  });

  /*
    A paid invoice is the same refusal and is worth its own arm, because this
    is the one status where voiding would be actively wrong rather than merely
    rejected: the money is already ours.
  */
  it("a PAID invoice is never voided", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "paid" });

    await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  /*
    This arm used to pin the OPPOSITE — "a failing void does not fail the
    event", on the reasoning that a redelivery would re-run the settlement void
    and the auto-cancel to retry a call that would fail the same way, and that
    the invoice staying payable was a pre-existing exposure. #788 (PR #786's
    round-2 class, one road over): a handler that returns success is ACKed 200
    and RECORDED, so Stripe never redelivers and the invoice stays payable on
    the hosted page indefinitely. A transient Stripe error is exactly what a
    redelivery heals — the settlement void and the downgrade are idempotent,
    the cancel of a dead subscription is caught, and `voidInvoice` reads the
    status first. So a failed void now FAILS THE EVENT, after the cancel and
    the downgrade have landed, and the arm drives the SAME event id twice
    through the recording idempotency double — the road production takes.
  */
  it("a failed invoice void on the FINAL-FAILURE road FAILS THE EVENT after the cancel and downgrade land, and the SAME event redelivered voids it (#788)", async () => {
    /* An interval SWITCH's invoice (an unwind is recorded on it): its new
       period was never paid, so its final failure still ends the plan. An
       UPGRADE's invoice no longer does (#2152 repair 1, its own arms below). */
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow, direction: "unwind" as const });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockRejectedValueOnce(new Error("stripe blipped"));

    const failedInvoice = {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: null,
      amount_due: 12_00,
      currency: "usd",
    };

    /* First delivery: Stripe blips on the void. The event FAILS — that is
       what makes Stripe send it again — but the cancel and the downgrade
       have landed, and nothing was recorded as processed. */
    const first = await deliverEvent("invoice.payment_failed", failedInvoice);
    expect(first.success).toBe(false);
    expect(first.message).toContain("could not be voided");
    expect(invoicesVoid).toHaveBeenCalledTimes(1);
    expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
    );
    expect(processedEventInserts).toHaveLength(0);

    /* Redelivery of the SAME event id: the invoice — still open — is voided
       and the event is recorded. */
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
    const second = await redeliverLastEvent();
    expect(second.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledTimes(2);
    expect(invoicesVoid).toHaveBeenLastCalledWith("in_change");
    expect(processedEventInserts).toHaveLength(1);
  });

  it("an INTERMEDIATE failure leaves the invoice alone — Stripe's retry needs it payable", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });

    await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: NOW_SEC + 3 * DAY,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  it("an INTERMEDIATE failure leaves the move pending — Stripe's retry is the retry", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

    const result = await deliverEvent("invoice.payment_failed", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: NOW_SEC + 3 * DAY,
      amount_due: 12_00,
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(db.resolvePlanChangeSettlement).not.toHaveBeenCalled();
  });

  it("a failed application fails the EVENT loud, so Stripe redelivers", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
    db.addCredits.mockResolvedValue({ success: false, error: "db exploded" });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(false);
    expect(db.resolvePlanChangeSettlement).not.toHaveBeenCalled();
  });

  it("a VOID row stays void even if its invoice somehow pays later — nothing moves", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow, status: "void" as const });

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_change",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_update",
      lines: { data: [] },
    });

    expect(result.success).toBe(true);
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.deductCredits).not.toHaveBeenCalled();
  });

  it("a subscription DYING voids its user's pending settlements — the voluntary-cancel road (review finding 3)", async () => {
    armLiveRead(deadLiveSub());
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change"]);
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
    /* The dying subscription IS the one on record — the live-cancel case. */
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      /* subscription events are tag-checked — this one is ours. */
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(db.voidPendingPlanChangeSettlementsForUser).toHaveBeenCalledWith(7);
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.deductCredits).not.toHaveBeenCalled();
  });

  /*
    #765 — THE INVOICE SIDE OF THAT VOID, on the voluntary-cancel road. Founder
    ruling 2026-09-10, option A: "close the invoice too, the same as the
    payment-failure road". Until this arm the settlement row was voided and
    the invoice it hung on stayed `open` — payable through Stripe's hosted
    page for a plan the customer no longer had, against credits the void row
    would refuse. Every id the db helper hands back is voided, which is why
    the helper returns ids and not a count.
  */
  it("a subscription DYING also VOIDS every pending settlement's INVOICE — nobody can pay for a plan they cancelled (#765)", async () => {
    armLiveRead(deadLiveSub());
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change", "in_switch"]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ status: "void" });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledTimes(2);
    expect(invoicesVoid).toHaveBeenCalledWith("in_change");
    expect(invoicesVoid).toHaveBeenCalledWith("in_switch");
    /* The downgrade still lands — the void is beside it, not instead of it. */
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
    );
  });

  /*
    PR #786 review, finding 1 (round 1) — the road it mirrors self-heals
    because it calls `voidInvoice` on every redelivery; this one gated the
    loop on rows that had JUST moved, so one transient Stripe error left the
    invoice payable forever. The helper now hands back already-void rows too.

    ⚠ AND ROUND 2 READ THE MACHINERY: a handler that returns success is ACKed
    200 and recorded, so Stripe never redelivers and the guard would refuse
    it if it did — the retry the docblock promised could not fire. So a
    failed void now FAILS THE EVENT (after the downgrade). The arm below
    drives the SAME event id twice, which is the road production takes, and
    the first delivery must NOT be recorded as processed.
  */
  it("a failed invoice void FAILS THE EVENT after the downgrade lands, and the SAME event redelivered voids it (review finding 1, rounds 1 and 2)", async () => {
    armLiveRead(deadLiveSub());
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change"]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    const deleted = {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    };

    /* First delivery: Stripe blips on the void. The event FAILS — that is
       what makes Stripe send it again — but the downgrade has landed. */
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockRejectedValueOnce(new Error("stripe blipped"));
    const first = await deliverEvent("customer.subscription.deleted", deleted);
    expect(first.success).toBe(false);
    expect(first.message).toContain("could not be voided");
    expect(invoicesVoid).toHaveBeenCalledTimes(1);
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
    );
    expect(processedEventInserts).toHaveLength(0);

    /* Redelivery of the SAME event id: the row is already void; the helper
       still names its invoice, and the invoice — still open — is voided. */
    invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
    const second = await redeliverLastEvent();
    expect(second.success).toBe(true);
    expect(invoicesVoid).toHaveBeenCalledTimes(2);
    expect(invoicesVoid).toHaveBeenLastCalledWith("in_change");
    expect(processedEventInserts).toHaveLength(1);
  });

  it("a subscription DYING with NOTHING pending touches no invoice (the control)", async () => {
    armLiveRead(deadLiveSub());
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue([]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(invoicesRetrieve).not.toHaveBeenCalled();
    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  it("a void that Stripe refuses on the cancel road FAILS the event so it is redelivered — and the downgrade still lands first", async () => {
    armLiveRead(deadLiveSub());
    db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change"]);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockRejectedValue(new Error("stripe said no"));

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(false);
    expect(db.updateUserSubscription).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planTier: "free" }),
    );
  });

  it("a STALE redelivered deleted event (different subscription on record) does NOT void — a void is irreversible (round-2 finding 1)", async () => {
    /* The user cancelled sub_OLD, resubscribed as sub_NEW, and upgraded;
       sub_OLD's deleted event redelivers days later. Voiding here would
       kill sub_NEW's pending settlement forever. */
    armLiveRead(deadLiveSub("sub_OLD"));
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7,
      name: "seven",
      email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
    });

    const result = await deliverEvent("customer.subscription.deleted", {
      id: "sub_OLD",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    });

    expect(result.success).toBe(true);
    expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
    expect(invoicesVoid).not.toHaveBeenCalled();
  });

  /**
   * ⚠ #2054 — CREDITS SPENT WHILE A 3DS SWITCH INVOICE WAITS.
   *
   * The quote fixes the take-back at Confirm and Stripe credits its money on
   * the switch invoice; the take-back lands when that invoice is PAID, floored
   * at what is left then. Spend in between and the floor turns those credits
   * into money with nothing behind them. These arms run a small STATEFUL
   * ledger — the row flips to `applied` when resolved, a deduct writes a
   * signed line and moves the balance, the period grant adds to it — so the
   * shortfall is read off what the settlement really moved, the way the
   * product reads it, and never off a number the arm hands it.
   */
  describe("#2054 — a take-back spent before its switch invoice is paid comes out of the period it buys", () => {
    const QUOTED = 3000;
    const GRANT = 120_000;
    type RowStatus = "pending" | "applied" | "void";
    function armLedger(opts: { balanceAtPayment: number; purchased?: number; grant?: number; status?: RowStatus }) {
      const state = {
        row: {
          ...grantRow,
          direction: "unwind" as "unwind" | "grant",
          credits: QUOTED,
          description: "Unused monthly cycle credits returned with its refund",
          status: (opts.status ?? "pending") as RowStatus,
        },
        balance: opts.balanceAtPayment,
        purchased: opts.purchased ?? 0,
        lines: new Map<string, { amount: number }>(),
      };
      db.getPlanChangeSettlementByInvoice.mockImplementation(async () => ({ ...state.row }));
      db.resolvePlanChangeSettlement.mockImplementation(async (_id: string, status: RowStatus) => {
        state.row.status = status;
        return true;
      });
      db.getUserCredits.mockImplementation(async () => ({
        balance: state.balance,
        purchasedBalance: state.purchased,
      }));
      db.getCreditTransactionByRef.mockImplementation(async (_u: number, ref: string) =>
        state.lines.get(ref) ?? null,
      );
      db.deductCredits.mockImplementation(
        async (_u: number, amount: number, _t: string, _d: string, ref: string) => {
          if (state.lines.has(ref)) return { success: true, duplicate: true, newBalance: state.balance };
          state.lines.set(ref, { amount: -amount });
          state.balance -= amount;
          return { success: true, newBalance: state.balance };
        },
      );
      db.refreshMonthlyCredits.mockImplementation(async () => {
        state.balance += opts.grant ?? GRANT;
        return { success: true, newBalance: state.balance };
      });
      return state;
    }
    /* The switch invoice Stripe really sends since #2069's anchor reset —
       re-driven in test mode for this arm set (`in_1UOLGODkTxTcXBCH7ynzFzvh`:
       a −2,700 unused-time proration line and `1 × Klieg Starter (at $269.00
       / year)`, proration false, 365 days). */
    const switchInvoice = {
      id: "in_change",
      customer: "cus_1",
      parent: { subscription_details: { subscription: "sub_1" } },
      billing_reason: "subscription_update",
      lines: switchLines(false),
    };
    const shortfallCalls = () =>
      db.deductCredits.mock.calls.filter((c) => c[4] === settlementShortfallLedgerRef("in_change"));

    afterEach(() => {
      db.getCreditTransactionByRef.mockReset();
      db.getCreditTransactionByRef.mockResolvedValue(null);
      db.getPlanChangeSettlementByInvoice.mockReset();
      db.refreshMonthlyCredits.mockReset();
      db.getUserCredits.mockReset();
      db.deductCredits.mockReset();
      db.resolvePlanChangeSettlement.mockReset();
    });

    it("she spent 2,600 of the 3,000 between Confirm and paying: the 2,600 comes out of the new year, after its grant", async () => {
      /* 3,000 was left at Confirm (the quote's take-back); she spent 2,600 of it
         while the card asked her to authenticate. */
      const state = armLedger({ balanceAtPayment: 400 });

      const result = await deliverEvent("invoice.payment_succeeded", switchInvoice);

      expect(result.success).toBe(true);
      /* The settlement floored at the 400 that was left — unchanged. */
      expect(state.lines.get(settlementLedgerRef("in_change"))).toEqual({ amount: -400 });
      /* The rest is taken from the plan's part AFTER the year's grant landed. */
      expect(shortfallCalls()).toHaveLength(1);
      expect(shortfallCalls()[0].slice(0, 3)).toEqual([7, 2600, "subscription"]);
      expect(db.refreshMonthlyCredits.mock.invocationCallOrder[0]).toBeLessThan(
        db.deductCredits.mock.invocationCallOrder[1],
      );
      /* Exactly where an instant payment would have left her: the old month's
         3,000 handed back (2,600 of it already spent), plus the year. */
      expect(state.balance).toBe(GRANT - 2600);
    });

    it("the CONTROL: nothing spent in the window → the whole take-back moved and nothing more is taken", async () => {
      const state = armLedger({ balanceAtPayment: 10_000 });

      const result = await deliverEvent("invoice.payment_succeeded", switchInvoice);

      expect(result.success).toBe(true);
      expect(state.lines.get(settlementLedgerRef("in_change"))).toEqual({ amount: -QUOTED });
      expect(shortfallCalls()).toHaveLength(0);
      expect(state.balance).toBe(10_000 - QUOTED + GRANT);
    });

    it("a settlement already applied by changePlan's own fresh read is still made whole — the shortfall is read off the ledger, not carried", async () => {
      const state = armLedger({ balanceAtPayment: 0, status: "applied" });
      /* changePlan applied it in its own breath and moved 1,000. */
      state.lines.set(settlementLedgerRef("in_change"), { amount: -1000 });

      const result = await deliverEvent("invoice.payment_succeeded", switchInvoice);

      expect(result.success).toBe(true);
      expect(shortfallCalls()).toHaveLength(1);
      expect(shortfallCalls()[0][1]).toBe(2000);
    });

    it("a REDELIVERY takes nothing twice", async () => {
      const state = armLedger({ balanceAtPayment: 400 });
      await deliverEvent("invoice.payment_succeeded", switchInvoice);
      processedEventInserts.length = 0;
      /* The grant's own ledger key makes its replay a no-op in the product. */
      db.refreshMonthlyCredits.mockResolvedValue({ success: true, newBalance: state.balance });
      const after = state.balance;

      const again = await redeliverLastEvent();

      expect(again.success).toBe(true);
      expect(shortfallCalls()).toHaveLength(1);
      expect(state.balance).toBe(after);
    });

    it("never reaches credits she BOUGHT — the shortfall floors at the plan's part too", async () => {
      /* A grant of 0 isolates the floor: after the period lands, every credit
         left is one she bought, so nothing may be taken. */
      const state = armLedger({ balanceAtPayment: 5000, purchased: 5000, grant: 0 });

      const result = await deliverEvent("invoice.payment_succeeded", switchInvoice);

      expect(result.success).toBe(true);
      expect(shortfallCalls()).toHaveLength(0);
      expect(state.balance).toBe(5000);
    });

    it("a failed collection FAILS the event, so Stripe redelivers", async () => {
      armLedger({ balanceAtPayment: 400 });
      const settle = db.deductCredits.getMockImplementation()!;
      db.deductCredits.mockImplementation(async (...args: unknown[]) =>
        args[4] === settlementShortfallLedgerRef("in_change")
          ? { success: false, error: "db down" }
          : (settle as (...a: unknown[]) => unknown)(...args),
      );

      const result = await deliverEvent("invoice.payment_succeeded", switchInvoice);

      expect(result.success).toBe(false);
    });

    it("with no period grant (the pre-#2069 shape) it takes NOTHING — the floor finds no plan's part to take", async () => {
      const state = armLedger({ balanceAtPayment: 400 });

      const result = await deliverEvent("invoice.payment_succeeded", {
        ...switchInvoice,
        lines: switchLines(true),
      });

      expect(result.success).toBe(true);
      expect(db.refreshMonthlyCredits).not.toHaveBeenCalled();
      expect(shortfallCalls()).toHaveLength(0);
      expect(state.balance).toBe(0);
    });

    it("a GRANT row is never treated as a take-back", async () => {
      const state = armLedger({ balanceAtPayment: 0, status: "applied" });
      state.row.direction = "grant";

      await deliverEvent("invoice.payment_succeeded", switchInvoice);

      expect(shortfallCalls()).toHaveLength(0);
    });
  });

  it("an invoice with NO settlement recorded settles nothing and changes nothing (the control)", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);

    const result = await deliverEvent("invoice.payment_succeeded", {
      id: "in_renewal",
      customer: "cus_1",
      subscription: "sub_1",
      billing_reason: "subscription_cycle",
      lines: {
        data: [
          {
            price: { recurring: { interval: "month" } },
            proration: false,
            period: { start: NOW_SEC, end: NOW_SEC + 30 * DAY },
          },
        ],
      },
    });

    /* The ordinary renewal refresh is untouched by #711. */
    expect(result.success).toBe(true);
    expect(db.refreshMonthlyCredits).toHaveBeenCalledTimes(1);
    expect(db.addCredits).not.toHaveBeenCalled();
  });

  /*
    #792 — the class of #788/#789 on the subscription roads. `updateUserSubscription`
    never throws; a failed write came back `{ success: false }`, the handler
    dropped it and returned success, and the event was ACKed 200 and recorded —
    so Stripe never redelivered and the change the event carried never landed.
    Every arm drives the SAME event id twice through the recording double:
    first delivery fails and is NOT recorded, redelivery lands and is recorded
    once. A fresh id would prove nothing.
  */
  describe("#792 — the subscription roads read the write's verdict", () => {
    const monthlySub = (id: string, status = "active") => ({
      id,
      customer: "cus_1",
      status,
      metadata: { plan: "pro", env: deploymentTag() },
      items: {
        data: [
          {
            id: "si_1",
            price: { recurring: { interval: "month" } },
            current_period_start: NOW_SEC,
            current_period_end: NOW_SEC + 30 * DAY,
          },
        ],
      },
    });

    it("subscription.updated: a write that fails FAILS THE EVENT, and the SAME event redelivered writes the same state once", async () => {
      armLiveRead(monthlySub("sub_1"));
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const first = await deliverEvent("customer.subscription.updated", monthlySub("sub_1"));
      expect(first.success).toBe(false);
      expect(first.message).toContain("could not be written");
      expect(first.message).toContain("redeliver");
      expect(processedEventInserts).toHaveLength(0);

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(2);
      /* The retry is the same UPDATE — the event's own state, not a guess. */
      expect(db.updateUserSubscription.mock.calls[0]).toEqual(db.updateUserSubscription.mock.calls[1]);
      expect(db.updateUserSubscription).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({ stripeSubscriptionId: "sub_1", planTier: "pro", billingInterval: "month" }),
      );
      expect(processedEventInserts).toHaveLength(1);
      expect(processedEventInserts[0].eventId).toBe(lastEvent!.id);
    });

    it("subscription.deleted: a downgrade that fails FAILS THE EVENT, and the SAME event redelivered downgrades", async () => {
      armLiveRead(deadLiveSub());
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
      });
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const first = await deliverEvent("customer.subscription.deleted", monthlySub("sub_1", "canceled"));
      expect(first.success).toBe(false);
      expect(first.message).toContain("downgrade could not be written");
      expect(processedEventInserts).toHaveLength(0);

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(2);
      expect(db.updateUserSubscription).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null, subscriptionStatus: "canceled" }),
      );
      expect(processedEventInserts).toHaveLength(1);
    });

    it("subscription.deleted: a STALE delivery (a newer subscription on record) leaves the plan ALONE — the downgrade is under the same guard as the void", async () => {
      /* The failure above makes Stripe redeliver for days; if the customer
         resubscribes in that window, the retry must not downgrade sub_NEW. */
      armLiveRead(deadLiveSub("sub_OLD"));
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });

      const result = await deliverEvent("customer.subscription.deleted", monthlySub("sub_OLD", "canceled"));
      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(1);
    });

    it("subscription.deleted: a failed invoice void redelivered AFTER the customer resubscribed still closes the OLD invoice — and never touches the new subscription's pending row (PR #794 review finding 1)", async () => {
      /* First delivery: sub_OLD dies on record, its settlement row goes
         void, Stripe blips on the invoice void. The event FAILS. */
      armLiveRead(deadLiveSub("sub_OLD"));
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_OLD" },
      });
      db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_old_change"]);
      invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
      invoicesVoid.mockRejectedValueOnce(new Error("stripe blipped"));

      const first = await deliverEvent("customer.subscription.deleted", monthlySub("sub_OLD", "canceled"));
      expect(first.success).toBe(false);
      expect(first.message).toContain("could not be voided");
      expect(processedEventInserts).toHaveLength(0);

      /* The customer resubscribes as sub_NEW and changes plan — a PENDING
         settlement of theirs now exists that must survive. The redelivery
         finds sub_NEW on record. */
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });
      db.voidPendingPlanChangeSettlementsForUser.mockClear();
      db.getVoidPlanChangeSettlementInvoiceIdsForUser.mockResolvedValue(["in_old_change"]);
      invoicesVoid.mockResolvedValue({ id: "in_old_change", status: "void" });

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      /* The writer never ran on the stale road — sub_NEW's pending row is
         untouched — and the plan is left alone: the one downgrade on record
         is the FIRST delivery's, which landed before the void blipped. */
      expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(1);
      /* But the OLD invoice, whose credit side is already void, is closed. */
      expect(invoicesVoid).toHaveBeenCalledTimes(2);
      expect(invoicesVoid).toHaveBeenLastCalledWith("in_old_change");
      expect(processedEventInserts).toHaveLength(1);
    });

    it("subscription.deleted: NULL on record still downgrades (the voluntary-cancel road clears the id first) — the control", async () => {
      armLiveRead(deadLiveSub());
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: null },
      });

      const result = await deliverEvent("customer.subscription.deleted", monthlySub("sub_1", "canceled"));
      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
      );
    });

    it("invoice.payment_failed FINAL: a downgrade that fails FAILS THE EVENT after the cancel and the voids, and the SAME event redelivered downgrades", async () => {
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
      });
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow, direction: "unwind" as const });
      invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
      invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const failedInvoice = {
        id: "in_change",
        customer: "cus_1",
        subscription: "sub_1",
        next_payment_attempt: null,
        amount_due: 12_00,
        currency: "usd",
      };

      const first = await deliverEvent("invoice.payment_failed", failedInvoice);
      expect(first.success).toBe(false);
      expect(first.message).toContain("downgrade could not be written");
      /* Everything keyed on THIS invoice and THIS subscription landed first. */
      expect(invoicesVoid).toHaveBeenCalledTimes(1);
      expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
      expect(processedEventInserts).toHaveLength(0);

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(2);
      expect(db.updateUserSubscription).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
      );
      expect(processedEventInserts).toHaveLength(1);
    });

    it("invoice.payment_failed FINAL: a STALE delivery (a newer subscription on record) voids and cancels the OLD one but leaves the plan alone", async () => {
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow, direction: "unwind" as const });
      invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
      invoicesVoid.mockResolvedValue({ id: "in_change", status: "void" });

      const result = await deliverEvent("invoice.payment_failed", {
        id: "in_change",
        customer: "cus_1",
        subscription: "sub_OLD",
        next_payment_attempt: null,
        amount_due: 12_00,
        currency: "usd",
      });

      expect(result.success).toBe(true);
      expect(invoicesVoid).toHaveBeenCalledWith("in_change");
      expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_OLD", { cancel_at_period_end: true });
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
    });

    it("invoice.payment_failed INTERMEDIATE: a mark that fails now FAILS THE EVENT — #795's fetch removed the reason this site was declined", async () => {
      /* #792 declined to fail this site because a redelivered `past_due`
         could land over a since-successful payment. The mark is written from
         the LIVE status now, so a redelivery re-reads and can never write a
         stale one — the decline's reason is structurally gone, and the site
         joins the class. */
      armLiveRead({ id: "sub_1", status: "past_due" });
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });
      db.updateUserSubscription.mockResolvedValueOnce({ success: false, error: "Failed to update subscription" });

      const first = await deliverEvent("invoice.payment_failed", {
        id: "in_change",
        customer: "cus_1",
        subscription: "sub_1",
        next_payment_attempt: NOW_SEC + 3 * DAY,
        amount_due: 12_00,
        currency: "usd",
      });

      expect(first.success).toBe(false);
      expect(first.message).toContain("could not be written");
      expect(processedEventInserts).toHaveLength(0);

      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenLastCalledWith(7, { subscriptionStatus: "past_due" });
      expect(processedEventInserts).toHaveLength(1);
    });

    it("invoice.payment_failed INTERMEDIATE: a STALE delivery (a newer subscription on record) does NOT mark the active account past_due (PR #794 round-2 finding 1)", async () => {
      /* The write is keyed on the user; a late failure for sub_OLD landing
         over an active sub_NEW would flip hasSubscription false on its
         FIRST delivery and send a paying customer to a fresh checkout. */
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_NEW" },
      });
      db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...grantRow });

      const result = await deliverEvent("invoice.payment_failed", {
        id: "in_old_renewal",
        customer: "cus_1",
        subscription: "sub_OLD",
        next_payment_attempt: NOW_SEC + 3 * DAY,
        amount_due: 12_00,
        currency: "usd",
      });

      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(1);
    });
  });

  /*
    #795 — FETCH, DON'T TRUST (his word: repair 1). Stripe neither orders nor
    deduplicates delivery, and #792's own fail-the-event pattern is what armed
    the hazard: a redelivered OLDER subscription.updated used to write its
    payload — Pro over Ultimate — because the handler applied the snapshot the
    event was born with. The subscription handlers now read the subscription
    live at processing time and apply THAT; the payload is a trigger only.
  */
  describe("#795 — the subscription handlers apply the LIVE subscription, never the payload", () => {
    /** What Stripe holds NOW: the customer went Pro → Ultimate (annual). */
    const liveUltimate = {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { plan: "ultimate" },
      items: {
        data: [
          {
            id: "si_1",
            price: { recurring: { interval: "year" } },
            current_period_start: NOW_SEC,
            current_period_end: NOW_SEC + 365 * DAY,
          },
        ],
      },
    };
    /** The card's own scenario, as the payload: an OLDER updated event still
     *  carrying the Pro state, redelivered after the customer moved on. */
    const stalePayloadPro = {
      id: "sub_1",
      customer: "cus_1",
      status: "past_due",
      metadata: { plan: "pro", env: deploymentTag() },
      items: {
        data: [
          {
            id: "si_1",
            price: { recurring: { interval: "month" } },
            current_period_start: NOW_SEC - 40 * DAY,
            current_period_end: NOW_SEC - 10 * DAY,
          },
        ],
      },
    };
    const deletedPayload = {
      id: "sub_1",
      customer: "cus_1",
      metadata: { env: deploymentTag() },
      status: "canceled",
      items: { data: [{ id: "si_1", price: { recurring: { interval: "month" } } }] },
    };
    const intermediateInvoice = {
      id: "in_renewal",
      customer: "cus_1",
      subscription: "sub_1",
      next_payment_attempt: NOW_SEC + 3 * DAY,
      amount_due: 12_00,
      currency: "usd",
    };

    it("THE CARD'S SCENARIO: a redelivered older updated event writes the LIVE state — Ultimate, not the payload's Pro", async () => {
      armLiveRead(liveUltimate);

      const result = await deliverEvent("customer.subscription.updated", stalePayloadPro);

      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledTimes(1);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          planTier: "ultimate",
          subscriptionStatus: "active",
          billingInterval: "year",
          currentPeriodEnd: new Date((NOW_SEC + 365 * DAY) * 1000),
        }),
      );
    });

    it("updated: a live read that BLIPS fails the event — the redelivery is the retry, and it applies then-truth", async () => {
      subscriptionsRetrieve.mockRejectedValueOnce(new Error("stripe blipped"));

      const first = await deliverEvent("customer.subscription.updated", stalePayloadPro);
      expect(first.success).toBe(false);
      expect(first.message).toContain("could not be read live");
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(0);

      armLiveRead(liveUltimate);
      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ planTier: "ultimate", subscriptionStatus: "active" }),
      );
      expect(processedEventInserts).toHaveLength(1);
    });

    it("updated: a subscription DEAD at Stripe is never applied — a late event cannot re-attach a dead subscription's tier to an account that moved on", async () => {
      armLiveRead({ ...liveUltimate, status: "canceled" });

      const result = await deliverEvent("customer.subscription.updated", stalePayloadPro);

      expect(result.success).toBe(true);
      expect(result.message).toContain("nothing applied");
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(1);
    });

    it("updated: a subscription Stripe does not KNOW is ACKed loud — a redelivery cannot retry it into existence", async () => {
      subscriptionsRetrieve.mockRejectedValue(
        Object.assign(new Error("No such subscription"), { code: "resource_missing" }),
      );

      const result = await deliverEvent("customer.subscription.updated", stalePayloadPro);

      expect(result.success).toBe(true);
      expect(result.message).toContain("does not exist");
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
    });

    it("deleted: a payload claiming death is REFUSED when the live read says the subscription is ALIVE — nothing voided, nothing downgraded", async () => {
      armLiveRead({ id: "sub_1", status: "active" });
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
      });
      db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue(["in_change"]);

      const result = await deliverEvent("customer.subscription.deleted", deletedPayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain("refused");
      expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
    });

    it("deleted: a live read that BLIPS fails the event BEFORE anything irreversible — the redelivery retries the whole road", async () => {
      subscriptionsRetrieve.mockRejectedValueOnce(new Error("stripe blipped"));
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
      });

      const first = await deliverEvent("customer.subscription.deleted", deletedPayload);
      expect(first.success).toBe(false);
      expect(first.message).toContain("could not be read live");
      expect(db.voidPendingPlanChangeSettlementsForUser).not.toHaveBeenCalled();
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(0);

      armLiveRead(deadLiveSub());
      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
      );
      expect(processedEventInserts).toHaveLength(1);
    });

    it("deleted: a subscription Stripe no longer KNOWS still downgrades — whatever it is, it is not alive", async () => {
      subscriptionsRetrieve.mockRejectedValue(
        Object.assign(new Error("No such subscription"), { code: "resource_missing" }),
      );
      db.getUserByStripeCustomerId.mockResolvedValue({
        id: 7,
        name: "seven",
        email: "u@example.com",
        credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
      });

      const result = await deliverEvent("customer.subscription.deleted", deletedPayload);

      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ planTier: "free", stripeSubscriptionId: null }),
      );
    });

    it("intermediate payment_failed: the mark is the LIVE status — `active` when the card has since been charged, so a stale failure cannot flip a paying account off its plan", async () => {
      armLiveRead({ id: "sub_1", status: "active" });

      const result = await deliverEvent("invoice.payment_failed", intermediateInvoice);

      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(7, { subscriptionStatus: "active" });
    });

    it("intermediate payment_failed: a live read that BLIPS fails the event — the retry marks then-truth", async () => {
      subscriptionsRetrieve.mockRejectedValueOnce(new Error("stripe blipped"));

      const first = await deliverEvent("invoice.payment_failed", intermediateInvoice);
      expect(first.success).toBe(false);
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(0);

      armLiveRead({ id: "sub_1", status: "past_due" });
      const second = await redeliverLastEvent();
      expect(second.success).toBe(true);
      expect(db.updateUserSubscription).toHaveBeenCalledWith(7, { subscriptionStatus: "past_due" });
      expect(processedEventInserts).toHaveLength(1);
    });

    it("intermediate payment_failed: a DEAD subscription gets no mark — the deleted and final-failure roads own death", async () => {
      armLiveRead(deadLiveSub());

      const result = await deliverEvent("invoice.payment_failed", intermediateInvoice);

      expect(result.success).toBe(true);
      expect(db.updateUserSubscription).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(1);
    });
  });
});

/**
 * ⚠ #2152, his ruling on #2159 (2026-10-10): *"yearly credits apply month by
 * month"*. An instant upgrade on a YEARLY plan tops up the month in hand and
 * raises the months still to come — the second half only when its invoice is
 * paid. Driven through the real `changePlan` and the real applier.
 */
describe("#2152 — an upgrade on a yearly plan granted month by month", () => {
  const YEAR_START = NOW_SEC - 100 * DAY;
  const YEAR_END = YEAR_START + 365 * DAY;

  function armYearlyStarter() {
    subscriptionsRetrieve.mockResolvedValue({
      status: "active",
      metadata: { plan: "starter" },
      items: {
        data: [
          {
            id: "si_1",
            price: { recurring: { interval: "year" } },
            current_period_start: YEAR_START,
            current_period_end: YEAR_END,
          },
        ],
      },
    });
  }

  /** The figure the real quote computes, re-derived: the difference over the
   *  share of the months handed over that is still unused. */
  function monthInHandCredits(monthsGranted: number) {
    const totalDays = 365;
    const remaining = Math.min(totalDays, Math.max(0, Math.ceil((YEAR_END - NOW_SEC) / DAY)));
    const share = Math.max(0, monthsGranted - 12 * ((totalDays - remaining) / totalDays));
    return wholeDisplayLedger(
      Math.floor((PLAN_TIERS.pro.monthlyCredits - PLAN_TIERS.starter.monthlyCredits) * share),
    );
  }

  it("records the month-in-hand top-up AND the paid year's new month against the invoice", async () => {
    armYearlyStarter();
    db.getAnnualYearProgress.mockResolvedValue({
      subscriptionId: "sub_1",
      periodStart: new Date(YEAR_START * 1000),
      periodEnd: new Date(YEAR_END * 1000),
      monthsGranted: 4,
    });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });

    await caller().changePlan({ newPlan: "pro" });

    const recorded = db.recordPlanChangeSettlement.mock.calls[0][0];
    expect(recorded).toMatchObject({
      direction: "grant",
      annualMonthlyCredits: PLAN_TIERS.pro.monthlyCredits,
      /* The year it was bought for, so its install cannot land on another. */
      annualPeriodStart: new Date(YEAR_START * 1000),
    });
    expect(recorded.credits).toBe(monthInHandCredits(4));
    /* Not the old year-sized top-up: 12 × the difference over the days left. */
    const yearSized = wholeDisplayLedger(Math.floor(
      (PLAN_TIERS.pro.monthlyCredits - PLAN_TIERS.starter.monthlyCredits) * 12
        * (Math.ceil((YEAR_END - NOW_SEC) / DAY) / 365),
    ));
    expect(recorded.credits).toBeLessThan(yearSized);
    /* Declined so far: nothing installed, nothing granted. */
    expect(db.installAnnualMonthlyCredits).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: a year granted up front (no year on the row) keeps the old figure and installs nothing", async () => {
    armYearlyStarter();
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    await caller().changePlan({ newPlan: "pro" });
    const recorded = db.recordPlanChangeSettlement.mock.calls[0][0];
    expect(recorded.annualMonthlyCredits).toBeNull();
    expect(recorded.credits).toBe(monthInHandCredits(12));
  });

  it("a year on the row that is NOT Stripe's current period counts as nothing handed over, and no month is recorded against that stale year", async () => {
    armYearlyStarter();
    db.getAnnualYearProgress.mockResolvedValue({
      subscriptionId: "sub_1",
      periodStart: new Date((YEAR_START - 365 * DAY) * 1000),
      periodEnd: new Date(YEAR_START * 1000),
      monthsGranted: 12,
    });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    await caller().changePlan({ newPlan: "pro" });
    /* Nothing handed over → no top-up; and the stale year must not take the
       new month — the next year's invoice sizes that year by its own plan. */
    expect(db.recordPlanChangeSettlement).not.toHaveBeenCalled();
    expect(db.installAnnualMonthlyCredits).not.toHaveBeenCalled();
  });

  it("the applier installs the paid year's month when the invoice is PAID, and a zero top-up moves no credits", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: 0,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
      annualMonthlyCredits: PLAN_TIERS.pro.monthlyCredits,
      annualPeriodStart: new Date(YEAR_START * 1000),
    });
    const { applyPlanChangeSettlement } = await import("./planChangeSettlement");
    const outcome = await applyPlanChangeSettlement("in_change");
    expect(outcome).toEqual({ outcome: "applied", creditsMoved: 0 });
    expect(db.addCredits).not.toHaveBeenCalled();
    expect(db.installAnnualMonthlyCredits).toHaveBeenCalledWith(
      7,
      PLAN_TIERS.pro.monthlyCredits,
      new Date(YEAR_START * 1000),
    );
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_change", "applied");
  });

  it("an install that fails leaves the row PENDING for the redelivery", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: 5_000,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
      annualMonthlyCredits: PLAN_TIERS.pro.monthlyCredits,
      annualPeriodStart: new Date(YEAR_START * 1000),
    });
    db.installAnnualMonthlyCredits.mockResolvedValue(false);
    const { applyPlanChangeSettlement } = await import("./planChangeSettlement");
    const outcome = await applyPlanChangeSettlement("in_change");
    expect(outcome.outcome).toBe("failed");
    expect(db.resolvePlanChangeSettlement).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: a settlement with no year month installs nothing", async () => {
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({
      userId: 7,
      stripeInvoiceId: "in_change",
      direction: "grant",
      credits: 5_000,
      description: "Prorated credits for upgrade to pro",
      status: "pending",
      annualMonthlyCredits: null,
    });
    const { applyPlanChangeSettlement } = await import("./planChangeSettlement");
    await applyPlanChangeSettlement("in_change");
    expect(db.installAnnualMonthlyCredits).not.toHaveBeenCalled();
    expect(db.addCredits).toHaveBeenCalledTimes(1);
  });
});

/**
 * ⚠ #2152, the relay's finding on head 18315b5f1, repair 1: a FAILED UPGRADE
 * on a period already paid for voids the upgrade and keeps the plan. Until
 * this, its final failure cancelled the subscription and dropped the account
 * to Free, clearing months of a yearly plan that had been paid in full.
 */
describe("#2152 — a failed upgrade invoice keeps the plan already paid for", () => {
  const upgradeRow = {
    userId: 7,
    stripeInvoiceId: "in_upgrade",
    direction: "grant" as const,
    credits: 4000,
    description: "Prorated credits for upgrade to pro",
    status: "pending" as const,
  };
  async function deliverFinalFailure(id: string, extra: Record<string, unknown> = {}) {
    const event = {
      id: `evt_upgrade_fail_${id}_${Math.random().toString(36).slice(2)}`,
      type: "invoice.payment_failed",
      data: { object: { id, customer: "cus_1", subscription: "sub_1", next_payment_attempt: null, amount_due: 12_00, currency: "usd", ...extra } },
      object: "event",
      api_version: "2026-01-28.clover",
      created: NOW_SEC,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    } as unknown as Stripe.Event;
    const svc = await import("./stripeService");
    const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
    (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(event);
    return handleStripeWebhook("{}", "sig");
  }

  it("voids the upgrade (settlement and invoice) and neither cancels nor drops to Free", async () => {
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7, name: "seven", email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue({ ...upgradeRow });
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_upgrade", status: "void" });

    const result = await deliverFinalFailure("in_upgrade");

    expect(result.success).toBe(true);
    expect(db.resolvePlanChangeSettlement).toHaveBeenCalledWith("in_upgrade", "void");
    expect(invoicesVoid).toHaveBeenCalledWith("in_upgrade");
    expect(subscriptionsUpdate).not.toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: a failed RENEWAL (no plan change on the invoice) still ends the plan, stamped from the PAID period's end", async () => {
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7, name: "seven", email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_renewal", status: "void" });

    const result = await deliverFinalFailure("in_renewal");

    expect(result.success).toBe(true);
    expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    const write = db.updateUserSubscription.mock.calls[0][1];
    expect(write).toMatchObject({ planTier: "free" });
    /* #2152 repair 3: the drop to Free carries the 30-day stamp. This invoice
       states no period line, so it runs from the moment we heard. */
    expect(write.planCreditsExpireAt).toBeInstanceOf(Date);
  });

  it("⚠ a failed yearly RENEWAL's 30 days run from where the PAID year ended — the failed invoice's own period start", async () => {
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7, name: "seven", email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: "sub_1" },
    });
    db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);
    invoicesRetrieve.mockResolvedValue({ amount_due: 12_00, status: "open" });
    invoicesVoid.mockResolvedValue({ id: "in_year2", status: "void" });
    const paidEnd = NOW_SEC - 21 * DAY; // the year that was paid ended three weeks ago
    await deliverFinalFailure("in_year2", {
      lines: { data: [{
        parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
        period: { start: paidEnd, end: paidEnd + 365 * DAY },
      }] },
    });
    const write = db.updateUserSubscription.mock.calls[0][1];
    expect(write.planCreditsExpireAt).toEqual(new Date((paidEnd + 30 * DAY) * 1000));
  });
});
