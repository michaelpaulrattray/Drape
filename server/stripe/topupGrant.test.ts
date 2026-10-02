/**
 * THE CREDITS A CUSTOMER BOUGHT, DRIVEN THROUGH THE REAL WEBHOOK (#1606, P1-7).
 *
 * `addTopupCredits` has had no caller since the one-time top-up product was
 * removed in February (`41a765ea`) — so `grantPurchasedCredits` is the whole of
 * its road, and nothing else in this repository proves it.
 *
 * # What is doubled, and why both doubles are STATEFUL
 *
 * A top-up has two independent replay answers and only a stateful harness can
 * tell them apart:
 *
 *   1 · the **event claim** (`stripeWebhookEvents.eventId`), which refuses a
 *       second delivery of one event id before any handler runs;
 *   2 · the **ledger reference** (`credit_transactions.(userId, referenceId)`),
 *       keyed on the SESSION, which is the one that still answers when the
 *       claim has been released or when Stripe sends a second event about the
 *       same paid session.
 *
 * ⚠ **The second is the one that matters and a one-event test cannot see it.**
 * A handler that fails hands its claim BACK by design, so every real retry
 * reaches the grant again; and the money question is not "is the claim table
 * working", it is "can this customer ever be granted 25,000 credits twice". The
 * arm named *a second event about the same paid session* is that question, and
 * it passes the claim on purpose.
 *
 * # The refusals, each one a way to be paid money and grant the wrong credits
 *
 * The env tag upstream refuses another WORLD's objects. It says nothing about a
 * session made by hand in THIS world, which is what the cross-check is for: the
 * unit count and the credit figure were written in one breath by one builder,
 * so a session where they disagree was not written by us. The sharpest shape of
 * it is the display scale — a session claiming 10,000 credits for two units,
 * which is a fifth of what was bought and looks entirely plausible.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";

// ── The claim table, as a unique index on `eventId` holds it. ───────────────
const recordedEventIds = new Set<string>();
/** Which event id is in flight, for the release the fake cannot read. */
let eventIdInFlight = "";

/** What MySQL raises when a unique index refuses a second row. */
function duplicateKeyError(): Error {
  return Object.assign(new Error("Duplicate entry for key 'eventId'"), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
  });
}

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        if (recordedEventIds.has(String(row.eventId))) throw duplicateKeyError();
        recordedEventIds.add(String(row.eventId));
      },
    }),
    delete: () => ({
      where: async () => {
        recordedEventIds.delete(eventIdInFlight);
      },
    }),
  })),
}));

vi.mock("./stripeService", () => ({
  constructWebhookEvent: vi.fn(),
  mapStripeStatus: vi.fn().mockReturnValue("active"),
  mapPlanToTier: vi.fn().mockReturnValue("pro"),
  calculateRolloverCredits: vi.fn().mockReturnValue(0),
  getMonthlyCredits: vi.fn().mockReturnValue(100),
  cancelSubscription: vi.fn().mockResolvedValue(true),
}));

// ── The ledger, as its unique (userId, referenceId) index holds it. ─────────
/** Every grant that actually landed, in order. */
const granted: Array<{ userId: number; amount: number; referenceId: string }> = [];
/** Set to make the grant fail the way an unreachable database does. */
let grantFails = false;

vi.mock("../db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  getUserByStripeCustomerId: vi.fn().mockResolvedValue(null),
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 100 }),
  getUserCredits: vi.fn().mockResolvedValue({ balance: 100 }),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(true),
  appendChangeRequestReviewNote: vi.fn().mockResolvedValue(undefined),
  voidPendingPlanChangeSettlementsForUser: vi.fn().mockResolvedValue([]),
  getVoidPlanChangeSettlementInvoiceIdsForUser: vi.fn().mockResolvedValue([]),
  addTopupCredits: vi.fn().mockImplementation(
    async (userId: number, amount: number, referenceId: string) => {
      if (grantFails) return { success: false, error: "Database not available" };
      /* The real helper answers `duplicate` off the unique ledger index rather
         than off a prior SELECT, so the double models the index. */
      if (granted.some((g) => g.userId === userId && g.referenceId === referenceId)) {
        return { success: true, newBalance: 999, duplicate: true };
      }
      granted.push({ userId, amount, referenceId });
      return { success: true, newBalance: 999 };
    },
  ),
}));

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { addTopupCredits, creditReferrerOnPaidAction } from "../db";
import { ENV_TAG_KEY } from "./environmentTag";
import {
  TOPUP_CHECKOUT_KIND,
  topupLedgerCredits,
  topupDisplayCredits,
} from "@shared/creditTopups";

const THIS_WORLD_IS = "railway:production";

/**
 * A completed top-up checkout.
 *
 * ⚠ The event id may NOT start with `evt_test_`: `handleStripeWebhook`
 * short-circuits on that prefix as a dashboard verification ping, several steps
 * before anything here runs.
 */
function topupEvent(opts: {
  eventId: string;
  sessionId?: string;
  units?: number;
  ledgerCredits?: number;
  paymentStatus?: string;
  type?: string;
  userId?: string;
}): Stripe.Event {
  const units = opts.units ?? 2;
  return {
    id: opts.eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: opts.sessionId ?? "cs_test_topup_1",
        payment_status: opts.paymentStatus ?? "paid",
        metadata: {
          userId: opts.userId ?? "42",
          type: opts.type ?? TOPUP_CHECKOUT_KIND,
          topupUnits: String(units),
          ledgerCredits: String(opts.ledgerCredits ?? topupLedgerCredits(units)),
          [ENV_TAG_KEY]: THIS_WORLD_IS,
        },
      },
    },
    object: "event",
    api_version: "2023-10-16",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

async function deliver(event: Stripe.Event) {
  eventIdInFlight = event.id;
  vi.mocked(constructWebhookEvent).mockReturnValue(event);
  return handleStripeWebhook("payload", "sig");
}

let savedRailway: string | undefined;
let savedRailwayName: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  recordedEventIds.clear();
  granted.length = 0;
  grantFails = false;
  eventIdInFlight = "";
  savedRailway = process.env.RAILWAY_ENVIRONMENT;
  savedRailwayName = process.env.RAILWAY_ENVIRONMENT_NAME;
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";
  delete process.env.RAILWAY_ENVIRONMENT;
});

afterEach(() => {
  if (savedRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
  else process.env.RAILWAY_ENVIRONMENT = savedRailway;
  if (savedRailwayName === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
  else process.env.RAILWAY_ENVIRONMENT_NAME = savedRailwayName;
});

describe("a paid top-up grants the credits the session names", () => {
  it("CONTROL — grants the LEDGER figure, keyed on the session", async () => {
    const result = await deliver(topupEvent({ eventId: "evt_1Topup" }));

    expect(granted).toEqual([
      { userId: 42, amount: topupLedgerCredits(2), referenceId: "topup_cs_test_topup_1" },
    ]);
    expect(result.success).toBe(true);
    expect(result.refused).toBeUndefined();
    expect(result.creditsGranted).toBe(topupLedgerCredits(2));
  });

  it("grants at every pack size, so one size does not stand in for the ladder", async () => {
    for (const units of [1, 2, 5]) {
      granted.length = 0;
      recordedEventIds.clear();
      await deliver(
        topupEvent({ eventId: `evt_1Pack${units}`, sessionId: `cs_pack_${units}`, units }),
      );
      expect(granted).toEqual([
        {
          userId: 42,
          amount: topupLedgerCredits(units),
          referenceId: `topup_cs_pack_${units}`,
        },
      ]);
    }
  });

  it("⚠ NEGATIVE CONTROL — a SUBSCRIPTION checkout grants no credits here", async () => {
    /* The branch is keyed on `metadata.type`, and the subscription road's
       credits arrive on its invoice. A branch that fired on every completed
       checkout would double-grant every new subscriber. */
    const result = await deliver(topupEvent({ eventId: "evt_1Sub", type: "subscription" }));
    expect(addTopupCredits).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBeUndefined();
  });

  it("still credits the referrer — a bought pack is a paid action", async () => {
    await deliver(topupEvent({ eventId: "evt_1Referral" }));
    expect(creditReferrerOnPaidAction).toHaveBeenCalledWith(42);
  });
});

describe("a replay never grants twice", () => {
  it("the same event id delivered twice grants ONCE (the claim answers)", async () => {
    const event = topupEvent({ eventId: "evt_1Redelivered" });
    await deliver(event);
    const second = await deliver(event);

    expect(granted).toHaveLength(1);
    expect(second.message).toContain("already processed");
  });

  it("⚠ a SECOND EVENT about the same paid session grants once (the ledger answers)", async () => {
    /* This is the road the claim cannot see — a different event id, so it is
       admitted, and the ledger reference is the only thing standing between
       the customer and a second 50,000 credits. It is also the shape every
       retry after a failed handler takes, since a failure RELEASES the claim. */
    await deliver(topupEvent({ eventId: "evt_1First", sessionId: "cs_one_session" }));
    const second = await deliver(
      topupEvent({ eventId: "evt_2Second", sessionId: "cs_one_session" }),
    );

    expect(granted).toHaveLength(1);
    expect(second.success).toBe(true);
    expect(second.message).toMatch(/already granted/i);
    /* Nothing was granted on THIS delivery, so the product event stream must
       not be told a figure was. */
    expect(second.creditsGranted).toBeUndefined();
  });

  it("a redelivery after a FAILED grant does the work (the claim was handed back)", async () => {
    grantFails = true;
    const failed = await deliver(topupEvent({ eventId: "evt_1Failing" }));
    expect(failed.success).toBe(false);
    expect(granted).toHaveLength(0);

    /* Stripe redelivers the same event id; the release means it is admitted. */
    grantFails = false;
    const retried = await deliver(topupEvent({ eventId: "evt_1Failing" }));
    expect(retried.success).toBe(true);
    expect(granted).toHaveLength(1);
  });
});

describe("a session that contradicts itself grants nothing", () => {
  it("⚠ the DISPLAY figure is refused — a fifth of what was bought", async () => {
    const result = await deliver(
      topupEvent({ eventId: "evt_1Display", units: 2, ledgerCredits: topupDisplayCredits(2) }),
    );
    expect(granted).toHaveLength(0);
    expect(result.refused).toBe(true);
    /* ACKed, not failed: a redelivery of a session we did not write would
       arrive at the same verdict for ever. */
    expect(result.success).toBe(true);
    expect(result.message).toContain("10000");
  });

  it("a figure larger than the units buy is refused", async () => {
    const result = await deliver(
      topupEvent({ eventId: "evt_1Inflated", units: 1, ledgerCredits: 10_000_000 }),
    );
    expect(granted).toHaveLength(0);
    expect(result.refused).toBe(true);
  });

  it("a unit count this product does not sell is refused", async () => {
    for (const [i, units] of [0, 999, -1].entries()) {
      recordedEventIds.clear();
      const result = await deliver(
        topupEvent({ eventId: `evt_1Unsellable${i}`, units, ledgerCredits: 25_000 }),
      );
      expect(granted).toHaveLength(0);
      expect(result.refused).toBe(true);
    }
  });

  it("a session with no top-up metadata at all is refused, not granted a default", async () => {
    const event = topupEvent({ eventId: "evt_1Bare" }) as unknown as {
      data: { object: { metadata: Record<string, unknown> } };
    };
    delete event.data.object.metadata.topupUnits;
    delete event.data.object.metadata.ledgerCredits;
    const result = await deliver(event as unknown as Stripe.Event);
    expect(granted).toHaveLength(0);
    expect(result.refused).toBe(true);
  });
});

describe("an unpaid completion grants nothing and is not retried", () => {
  it("refuses a session that completed without being paid", async () => {
    const result = await deliver(
      topupEvent({ eventId: "evt_1Unpaid", paymentStatus: "unpaid" }),
    );
    expect(granted).toHaveLength(0);
    expect(result.refused).toBe(true);
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/unpaid/);
  });

  it("CONTROL — the same session paid grants", async () => {
    const result = await deliver(
      topupEvent({ eventId: "evt_1Paid", paymentStatus: "paid" }),
    );
    expect(granted).toHaveLength(1);
    expect(result.refused).toBeUndefined();
  });
});

describe("a grant that could not be written FAILS the event", () => {
  it("returns failure so Stripe redelivers, rather than ACKing a paid customer's loss", async () => {
    grantFails = true;
    const result = await deliver(topupEvent({ eventId: "evt_1Unwritable" }));
    expect(result.success).toBe(false);
    expect(result.refused).toBeUndefined();
    expect(result.message).toMatch(/Failed to grant/);
  });
});
