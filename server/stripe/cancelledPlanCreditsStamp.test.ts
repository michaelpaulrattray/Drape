/**
 * A CANCELLED PLAN'S CREDITS GET A DEADLINE THE MOMENT THE PLAN ENDS (#2152)
 * — driven through the real webhook entry point, with Stripe and the database
 * doubled at their module boundaries (the harness is
 * `subscriptionNewerGuard.test.ts`'s, copied rather than shared because a
 * shared harness edited for one suite silently changes the other).
 *
 * His word, 2026-10-09: *"After cancelling, plan credits stay usable for 30
 * days past the paid period, then expire."* `handleSubscriptionDeleted` is the
 * only moment the paid period's end is known — the same UPDATE nulls it — so
 * the stamp is asserted on the outgoing write itself (law 5, assert at the
 * wire), and the sweep that acts on it is driven in
 * `server/billing/planCreditsExpiry.test.ts`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { subscriptionsRetrieve } = vi.hoisted(() => ({
  subscriptionsRetrieve: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: vi.fn() };
    subscriptions = { retrieve: subscriptionsRetrieve, update: vi.fn() };
    invoices = { retrieve: vi.fn(), voidInvoice: vi.fn() };
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
  getPlanChangeSettlementByInvoice: vi.fn().mockResolvedValue(null),
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
}));

vi.mock("../db", () => db);

/* The idempotency pre-check reads the connection module directly. The double
   RECORDS what the handler asks it to record, so the failed-read arm can see
   that a failed event was NOT marked processed — without that, a "redeliver
   to retry" arm cannot tell a real failure from an ACK. */
const processedEventInserts = vi.hoisted(() => [] as Array<{ eventId: string; eventType: string }>);
/* ⚠ The replay guard is a CLAIM since #1361: the product inserts FIRST, lets
   the unique index on `eventId` arbitrate, and RELEASES the row when the
   handler fails. A double still shaped for the old select-then-record road is
   INERT rather than red — it answers every call and models nothing — so it is
   shaped like the guard here. */
vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    insert: () => ({
      values: async (row: { eventId: string; eventType: string }) => {
        if (processedEventInserts.some((seen) => seen.eventId === row.eventId)) {
          throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 });
        }
        processedEventInserts.push(row);
      },
    }),
    /* One event in flight per arm, so the row dropped is the claim just made. */
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

import { handleStripeWebhook } from "./webhooks";
import { ENV_TAG_KEY } from "./environmentTag";
import { deploymentTag } from "../_core/env";

const DAY = 86_400;
const NOW_SEC = Math.floor(Date.now() / 1000);

const SUB_ID = "sub_cancelled";

function armAccount(storedSubscriptionId: string | null, planTier = "pro") {
  db.getUserByStripeCustomerId.mockResolvedValue({
    id: 7,
    name: "seven",
    email: "u@example.com",
    credits: { planTier, balance: 4000, stripeSubscriptionId: storedSubscriptionId },
  });
}

/** Stripe no longer knows it — the deleted road proceeds (#795). */
function armStripeGone() {
  subscriptionsRetrieve.mockImplementation(async (id: string) => {
    const err: Error & { code?: string } = new Error(`No such subscription: ${id}`);
    err.code = "resource_missing";
    throw err;
  });
}

let eventSeq = 0;
function stripeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  eventSeq += 1;
  return {
    id: `evt_stamp_${eventSeq}`,
    type,
    object: "event",
    api_version: "2023-10-16",
    created: NOW_SEC,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: {
      object: {
        ...object,
        metadata: {
          ...((object.metadata as Record<string, string> | undefined) ?? {}),
          [ENV_TAG_KEY]: deploymentTag(),
        },
      },
    },
  } as unknown as Stripe.Event;
}

async function deliver(object: Record<string, unknown>) {
  const event = stripeEvent("customer.subscription.deleted", object);
  const svc = await import("./stripeService");
  const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
  (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(event);
  return handleStripeWebhook("{}", "sig");
}

function deadSub(periodEndSec: number | null, endedAtSec: number | null): Record<string, unknown> {
  return {
    id: SUB_ID,
    customer: "cus_1",
    status: "canceled",
    ...(endedAtSec === null ? {} : { ended_at: endedAtSec }),
    items: {
      data: [
        {
          id: "si_1",
          price: { recurring: { interval: "month" } },
          ...(periodEndSec === null
            ? {}
            : { current_period_start: periodEndSec - 30 * DAY, current_period_end: periodEndSec }),
        },
      ],
    },
  };
}

/** The deadline the downgrade wrote, or undefined if nothing was written. */
function stamped(): Date | null | undefined {
  const call = db.updateUserSubscription.mock.calls.at(-1);
  return call?.[1]?.planCreditsExpireAt;
}

beforeEach(() => {
  vi.clearAllMocks();
  processedEventInserts.length = 0;
  db.updateUserSubscription.mockResolvedValue({ success: true });
  db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue([]);
  db.getVoidPlanChangeSettlementInvoiceIdsForUser.mockResolvedValue([]);
  armStripeGone();
});

describe("customer.subscription.deleted stamps the 30-day deadline in the downgrade write", () => {
  /* #2152, the relay's finding on head 18315b5f1, repair 3: a FINAL PAYMENT
     FAILURE already dropped the account to Free and stamped from the end of
     the PAID period; this event, arriving after, measures from the unpaid
     one. The earlier deadline must stand. */
  it("⚠ an earlier stamp from a final payment failure is never pushed later", async () => {
    const earlier = new Date((NOW_SEC + 5 * DAY) * 1000);
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7, name: "seven", email: "u@example.com",
      credits: { planTier: "free", balance: 4000, stripeSubscriptionId: null, planCreditsExpireAt: earlier },
    });
    const periodEnd = NOW_SEC + 300 * DAY; // the UNPAID year the dunning died in
    await deliver(deadSub(periodEnd, NOW_SEC));
    expect(stamped()).toEqual(earlier);
  });

  it("NEGATIVE CONTROL: a stamp on an account still on a paid plan is not carried — the deleted event stamps afresh", async () => {
    db.getUserByStripeCustomerId.mockResolvedValue({
      id: 7, name: "seven", email: "u@example.com",
      credits: { planTier: "pro", balance: 4000, stripeSubscriptionId: SUB_ID, planCreditsExpireAt: new Date((NOW_SEC + 5 * DAY) * 1000) },
    });
    const periodEnd = NOW_SEC - 60;
    await deliver(deadSub(periodEnd, periodEnd));
    expect(stamped()).toEqual(new Date((periodEnd + 30 * DAY) * 1000));
  });

  it("a plan cancelled at its period end: the deadline is that period's end plus 30 days", async () => {
    armAccount(SUB_ID);
    const periodEnd = NOW_SEC - 60;
    const result = await deliver(deadSub(periodEnd, periodEnd));
    expect(result.success).toBe(true);
    const call = db.updateUserSubscription.mock.calls.at(-1);
    // POSITIVE CONTROL: the downgrade itself is the same write it always was.
    expect(call?.[1]).toMatchObject({ planTier: "free", subscriptionStatus: "canceled", stripeSubscriptionId: null });
    expect(stamped()).toEqual(new Date((periodEnd + 30 * DAY) * 1000));
  });

  it("a plan ended EARLY keeps the days it paid for, plus the thirty", async () => {
    armAccount(SUB_ID);
    const periodEnd = NOW_SEC + 12 * DAY;
    await deliver(deadSub(periodEnd, NOW_SEC));
    expect(stamped()).toEqual(new Date((periodEnd + 30 * DAY) * 1000));
  });

  it("a redelivery of the same event lands on the same deadline, whenever it arrives", async () => {
    armAccount(SUB_ID);
    const ended = NOW_SEC - 2 * DAY;
    await deliver(deadSub(ended, ended));
    const first = stamped();
    armAccount(null); // the first delivery cleared the id
    await deliver(deadSub(ended, ended));
    expect(stamped()).toEqual(first);
    expect(first).toEqual(new Date((ended + 30 * DAY) * 1000));
  });

  it("with no period and no ended_at on the payload, the deadline runs from the moment we heard", async () => {
    armAccount(SUB_ID);
    const before = Date.now();
    await deliver(deadSub(null, null));
    const at = stamped();
    expect(at).toBeInstanceOf(Date);
    const ms = (at as Date).getTime();
    expect(ms).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000 + 30 * DAY * 1000 - 1000);
    expect(ms).toBeLessThanOrEqual(Date.now() + 30 * DAY * 1000);
  });

  it("⚠ NEGATIVE CONTROL: a STALE delivery (the customer resubscribed) stamps nothing at all", async () => {
    armAccount("sub_newer");
    const result = await deliver(deadSub(NOW_SEC, NOW_SEC));
    expect(result.success).toBe(true);
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
  });
});
