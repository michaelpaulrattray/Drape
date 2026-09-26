/**
 * AN OLDER SUBSCRIPTION NEVER OVERWRITES A NEWER ONE (#804, PR #803 review
 * finding 1) — driven through the real webhook entry point, with Stripe and
 * the database doubled at their module boundaries.
 *
 * THE DEFECT. `handleSubscriptionUpdated` wrote `stripeSubscriptionId: live.id`
 * keyed on the USER, and `stripeSubscriptionId` appeared exactly once in the
 * whole handler — as that value. It was never compared against the id already
 * on the account. `cancelSubscription` is period-end, so a cancelled
 * subscription stays `active` at Stripe for weeks; a customer can therefore
 * hold two live subscriptions at once, and the older one's trailing `updated`
 * events passed #795's live read (it really is alive) and overwrote the newer
 * one's id, tier, interval and period. When the old one finally died, its
 * `deleted` event found ITSELF on record, read *not stale*, and downgraded a
 * paying account to free while the new subscription was alive and billing.
 * That last step is arm 9, and it is the money.
 *
 * THE SHAPE OF THE GUARD, and why it is not #794's. The other three
 * subscription roads skip on `storedId !== eventSubId`. This road cannot: it
 * is the road that legitimately installs a new id on resubscribe, so that
 * guard would break every resubscribe — which is arm 2, the positive control
 * that has to stay green for the fix to be worth anything.
 *
 * ⚠ EVERY REFUSAL ARM IS PAIRED WITH AN ARM THAT PROCEEDS. A guard that
 * refuses everything would pass arms 1 and 9 and be a catastrophe in
 * production; arms 2–8 are what make arm 1 mean something.
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

/**
 * OLD is a subscription created 90 days ago and cancelled at period end — so
 * Stripe still reports it `active`, which is the whole premise. NEW is
 * yesterday's resubscribe. Their `created` stamps are the only thing that
 * orders them, and nothing else in either object differs in a way the
 * handler reads.
 */
const OLD_ID = "sub_old";
const NEW_ID = "sub_new";

function liveSub(
  id: string,
  createdSec: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    customer: "cus_1",
    status: "active",
    created: createdSec,
    metadata: { plan: id === OLD_ID ? "starter" : "pro" },
    items: {
      data: [
        {
          id: `si_${id}`,
          price: { recurring: { interval: "month" } },
          current_period_start: NOW_SEC - 5 * DAY,
          current_period_end: NOW_SEC + 25 * DAY,
        },
      ],
    },
    ...overrides,
  };
}

const OLD_LIVE = liveSub(OLD_ID, NOW_SEC - 90 * DAY);
const NEW_LIVE = liveSub(NEW_ID, NOW_SEC - 1 * DAY);

/** Answer `subscriptions.retrieve` per id, so one arm can hold two truths. */
function armStripe(byId: Record<string, unknown | "missing" | "throws">) {
  subscriptionsRetrieve.mockImplementation(async (id: string) => {
    const answer = byId[id];
    if (answer === undefined || answer === "missing") {
      const err: Error & { code?: string } = new Error(`No such subscription: ${id}`);
      err.code = "resource_missing";
      throw err;
    }
    if (answer === "throws") throw new Error("Stripe is having a moment");
    return answer;
  });
}

/** What the account row says right now. */
function armAccount(storedSubscriptionId: string | null, planTier = "pro") {
  db.getUserByStripeCustomerId.mockResolvedValue({
    id: 7,
    name: "seven",
    email: "u@example.com",
    credits: { planTier, balance: 4000, stripeSubscriptionId: storedSubscriptionId },
  });
}

let eventSeq = 0;
function stripeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  eventSeq += 1;
  return {
    id: `evt_${eventSeq}`,
    type,
    object: "event",
    api_version: "2023-10-16",
    created: NOW_SEC,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    /* ⚠ The environment tag rides in the OBJECT's metadata and every
       subscription event type is tagged — an untagged one is REFUSED before
       any handler runs, so an arm that forgot it would pass for the wrong
       reason: nothing written, because nothing ran. */
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

async function deliver(type: string, object: Record<string, unknown>) {
  const event = stripeEvent(type, object);
  const svc = await import("./stripeService");
  const stripeInstance = (svc as { stripe: { webhooks: { constructEvent: unknown } } }).stripe;
  (stripeInstance.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue(event);
  return handleStripeWebhook("{}", "sig");
}

/** The id this write put on the account, or undefined if nothing was written. */
function writtenSubscriptionId(): string | null | undefined {
  const call = db.updateUserSubscription.mock.calls.at(-1);
  return call?.[1]?.stripeSubscriptionId;
}

beforeEach(() => {
  vi.clearAllMocks();
  processedEventInserts.length = 0;
  db.updateUserSubscription.mockResolvedValue({ success: true });
  db.getPlanChangeSettlementByInvoice.mockResolvedValue(null);
  db.voidPendingPlanChangeSettlementsForUser.mockResolvedValue([]);
  db.getVoidPlanChangeSettlementInvoiceIdsForUser.mockResolvedValue([]);
});

describe("customer.subscription.updated — the older subscription loses", () => {
  it("1 · THE DEFECT: a trailing event for the OLD still-live subscription writes NOTHING over the newer one", async () => {
    armAccount(NEW_ID);
    armStripe({ [OLD_ID]: OLD_LIVE, [NEW_ID]: NEW_LIVE });

    const result = await deliver("customer.subscription.updated", {
      id: OLD_ID,
      customer: "cus_1",
    });

    /* ACKed, because a redelivery would make exactly the same decision — but
       the account is untouched. Before the guard this wrote sub_old/starter
       over sub_new/pro. */
    expect(result.success).toBe(true);
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
    expect(result.message).toContain(OLD_ID);
    expect(result.message).toContain(NEW_ID);
  });

  it("2 · THE POSITIVE CONTROL — a RESUBSCRIBE still installs the new subscription over the older one on record", async () => {
    armAccount(OLD_ID, "starter");
    armStripe({ [OLD_ID]: OLD_LIVE, [NEW_ID]: NEW_LIVE });

    const result = await deliver("customer.subscription.updated", {
      id: NEW_ID,
      customer: "cus_1",
    });

    expect(result.success).toBe(true);
    expect(writtenSubscriptionId()).toBe(NEW_ID);
    expect(db.updateUserSubscription.mock.calls[0][1]).toMatchObject({
      planTier: "pro",
      subscriptionStatus: "active",
      billingInterval: "month",
    });
  });

  it("3 · the ORDINARY event — same subscription as the record — writes, and costs no second Stripe read", async () => {
    armAccount(NEW_ID);
    armStripe({ [NEW_ID]: NEW_LIVE });

    const result = await deliver("customer.subscription.updated", {
      id: NEW_ID,
      customer: "cus_1",
    });

    expect(result.success).toBe(true);
    expect(writtenSubscriptionId()).toBe(NEW_ID);
    /* The comparison read fires ONLY when the ids differ — the common event
       must not pay for a guard about a rare one. */
    expect(subscriptionsRetrieve).toHaveBeenCalledTimes(1);
  });

  it("4 · a stored subscription Stripe says is DEAD does not freeze the record on a corpse", async () => {
    armAccount(OLD_ID, "starter");
    /* The stored one is newer BUT cancelled — so `created` alone would refuse
       the write and strand the account on a dead subscription. */
    armStripe({
      [OLD_ID]: liveSub(OLD_ID, NOW_SEC - 1 * DAY, { status: "canceled" }),
      [NEW_ID]: liveSub(NEW_ID, NOW_SEC - 90 * DAY),
    });

    const result = await deliver("customer.subscription.updated", {
      id: NEW_ID,
      customer: "cus_1",
    });

    expect(result.success).toBe(true);
    expect(writtenSubscriptionId()).toBe(NEW_ID);
  });

  it("5 · a stored subscription Stripe does not know is gone — the event's subscription takes the record", async () => {
    armAccount("sub_vanished", "starter");
    armStripe({ [NEW_ID]: NEW_LIVE });

    const result = await deliver("customer.subscription.updated", {
      id: NEW_ID,
      customer: "cus_1",
    });

    expect(result.success).toBe(true);
    expect(writtenSubscriptionId()).toBe(NEW_ID);
  });

  it("6 · a TRANSIENT read failure on the stored subscription fails the event — it never guesses", async () => {
    armAccount(NEW_ID);
    armStripe({ [OLD_ID]: OLD_LIVE, [NEW_ID]: "throws" });

    const result = await deliver("customer.subscription.updated", {
      id: OLD_ID,
      customer: "cus_1",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("redeliver to retry");
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
    /* And it is NOT recorded as processed, or Stripe's redelivery — the retry
       this message promises — would be dropped on arrival. */
    expect(processedEventInserts).toHaveLength(0);
  });

  it("7 · two subscriptions created in the SAME SECOND are not orderable, and the handler keeps its old behaviour", async () => {
    const sameSec = NOW_SEC - 10 * DAY;
    armAccount("sub_tie_b");
    armStripe({
      sub_tie_a: liveSub("sub_tie_a", sameSec),
      sub_tie_b: liveSub("sub_tie_b", sameSec),
    });

    const result = await deliver("customer.subscription.updated", {
      id: "sub_tie_a",
      customer: "cus_1",
    });

    /* Strictly-greater on purpose: this change only ever ADDS a refusal, in
       the case where the record provably holds something newer. */
    expect(result.success).toBe(true);
    expect(writtenSubscriptionId()).toBe("sub_tie_a");
  });

  it("8 · an account with NO subscription on record writes, and asks Stripe nothing extra", async () => {
    armAccount(null, "free");
    armStripe({ [NEW_ID]: NEW_LIVE });

    const result = await deliver("customer.subscription.updated", {
      id: NEW_ID,
      customer: "cus_1",
    });

    expect(result.success).toBe(true);
    expect(writtenSubscriptionId()).toBe(NEW_ID);
    expect(subscriptionsRetrieve).toHaveBeenCalledTimes(1);
  });
});

describe("the money — what the overwrite cost two events later", () => {
  it("9 · the OLD subscription's death leaves the paying account alone, because it never reached the record", async () => {
    armAccount(NEW_ID);
    armStripe({ [OLD_ID]: OLD_LIVE, [NEW_ID]: NEW_LIVE });

    /* Step 1: the trailing `updated` for the old subscription. */
    await deliver("customer.subscription.updated", { id: OLD_ID, customer: "cus_1" });
    expect(db.updateUserSubscription).not.toHaveBeenCalled();

    /* Step 2: weeks later the old subscription finally dies. Stripe now
       reports it canceled, so the deleted road's live read agrees. */
    armStripe({
      [OLD_ID]: liveSub(OLD_ID, NOW_SEC - 90 * DAY, { status: "canceled" }),
      [NEW_ID]: NEW_LIVE,
    });
    const death = await deliver("customer.subscription.deleted", {
      id: OLD_ID,
      customer: "cus_1",
    });

    /* The record still holds the NEW subscription, so the deleted road's own
       #794 guard reads this as a stale delivery and downgrades nothing. That
       is the whole point: before the fix, step 1 put sub_old on the record and
       step 2 then found it *not* stale — and took a paying customer to free
       while sub_new was alive and billing. */
    expect(death.success).toBe(true);
    expect(db.updateUserSubscription).not.toHaveBeenCalled();
  });
});
