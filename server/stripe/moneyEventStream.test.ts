/**
 * THE MONEY EDGES REACH THE EVENT STREAM — DRIVEN, NOT READ (#509 part 2).
 *
 * `server/moneyEventCatalogue.test.ts` proves the catalogue and the dispatcher's
 * switch agree about WHICH events exist. This suite proves the four things that
 * only running the dispatcher can prove, and three of them are about money
 * rather than about analytics:
 *
 *   1. **Exactly-once.** A redelivered Stripe event records nothing extra. The
 *      replay claim already guarantees one successful delivery per event id; this
 *      drives it rather than trusting the comment.
 *   2. **A FAILED delivery records nothing — and its retry records exactly one.**
 *      This is the arm that decides where the capture may live. The claim is
 *      RELEASED when a handler fails, so Stripe redelivers and the handler runs
 *      again; a capture placed inside a handler would fire once per ATTEMPT.
 *   3. ⚠ **A broken event stream never costs money.** `recordMoneyEvent` is
 *      called from inside the dispatcher's `try`, whose `catch` releases the
 *      claim and returns `success: false`. So if it could throw, a **settled
 *      payment would become a redelivery**. Both halves are driven: the client
 *      itself exploding, and the account lookup rejecting.
 *   4. **No account, no invented person.** An unidentified dispute records
 *      nothing rather than parking every unmatched money event on one fake id.
 *
 * ⚠ **THE HARNESS IS `webhookIdempotency.test.ts`'s, AND ITS TWO TRAPS ARE
 * INHERITED ON PURPOSE.** An event id starting `evt_test_` short-circuits many
 * steps before the code under test, and failing a checkout by making
 * `creditReferrerOnPaidAction` reject does NOT fail the delivery — that handler
 * catches it and still returns success. Both would have produced green arms that
 * never entered the path. The failure road used here is the handler's own
 * documented one: a missing `userId` in the session metadata.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";

/** The rows the claim table holds, as a unique index on `eventId` would. */
const recordedEventIds = new Set<string>();
/** Which event id is in flight, for the release the fake cannot read. */
let eventIdInFlight = "";

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
  getMonthlyCredits: vi.fn().mockReturnValue(600),
  cancelSubscription: vi.fn().mockResolvedValue(true),
  voidInvoice: vi.fn().mockResolvedValue(true),
  retrieveLiveSubscription: vi.fn(),
  REFUND_METADATA_USER_KEY: "userId",
  REFUND_METADATA_CHANGE_REQUEST_KEY: "changeRequestId",
}));

vi.mock("../db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  getUserByStripeCustomerId: vi.fn().mockResolvedValue(null),
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 1_400 }),
  getUserCredits: vi.fn().mockResolvedValue({ balance: 100 }),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(true),
  appendChangeRequestReviewNote: vi.fn().mockResolvedValue({ success: true }),
  voidPendingPlanChangeSettlementsForUser: vi.fn().mockResolvedValue([]),
  getVoidPlanChangeSettlementInvoiceIdsForUser: vi.fn().mockResolvedValue([]),
}));

/**
 * ⚠ **PARTIAL ON PURPOSE, AND IT USED TO BE A WHOLE-MODULE REPLACEMENT THAT
 * ENUMERATED ITS EXPORTS — WHICH IS A SECOND LIST SHADOWING A SOURCE OF TRUTH
 * (working law 4), AND IT WENT STALE (#1930).**
 *
 * What this suite means to say is narrow: *the subscription id and the period
 * bought are GIVEN, so the arms are about the event stream and not about
 * dialects.* Spelled as a two-key factory it said something much larger —
 * *`./invoiceLines` has exactly these two exports* — and every other reader the
 * handler reaches for became a runtime throw the day one was added.
 *
 * It had already half-happened and passed by luck: `nonProrationSubscriptionLines`
 * was absent here too, unreached only because this fixture's rung carries no
 * credit dial. `invoiceSubscriptionMetadata` is called unconditionally, so it
 * surfaced — two arms red with *No "invoiceSubscriptionMetadata" export is
 * defined on the "./invoiceLines" mock*, inside a handler these arms do not
 * claim to be testing.
 *
 * Spread from the real module, the two overrides are the whole statement and a
 * third reader arriving costs this suite nothing.
 */
vi.mock("./invoiceLines", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./invoiceLines")>()),
  invoiceSubscriptionId: vi.fn().mockReturnValue("sub_live_1"),
  periodBought: vi.fn().mockReturnValue({ monthsBought: 1 }),
}));

vi.mock("./planChangeSettlement", () => ({
  applyPlanChangeSettlement: vi.fn().mockResolvedValue({ outcome: "none" }),
  collectPlanChangeShortfall: vi.fn().mockResolvedValue({ outcome: "none" }),
  voidPlanChangeSettlement: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: new Proxy({}, { get: (_t, key) => String(key) }),
}));

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { getUserByStripeCustomerId, refreshMonthlyCredits } from "../db";
import { ENV_TAG_KEY } from "./environmentTag";
import {
  resetProductEventsForTests,
  setProductEventClientForTests,
  type ProductEventClient,
} from "../monitoring/productEvents";

const THIS_WORLD_IS = "railway:production";

/** Everything the stream was handed, so an arm reads the real payload. */
type Captured = { distinctId: string; event: string; properties: Record<string, unknown> };
let captured: Captured[] = [];
/** Set to make the installed client explode the way a broken SDK would. */
let captureThrows = false;

function recordingClient(): ProductEventClient {
  return {
    capture(payload) {
      if (captureThrows) throw new Error("the SDK exploded");
      captured.push(payload as Captured);
    },
    flush: async () => {},
    shutdown: async () => {},
  };
}

/**
 * ⚠ The id may NOT start with `evt_test_` — `handleStripeWebhook` treats that as
 * a dashboard verification ping and returns several steps before the claim.
 */
function event(id: string, type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id,
    type,
    data: { object: { ...object, metadata: { [ENV_TAG_KEY]: THIS_WORLD_IS, ...(object.metadata as object) } } },
    object: "event",
    api_version: "2023-10-16",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

function checkoutEvent(id: string): Stripe.Event {
  return event(id, "checkout.session.completed", {
    id: "cs_live_1",
    metadata: { userId: "7", type: "subscription" },
  });
}

/** The handler's own documented failure: *"Missing userId in session metadata"*. */
function failingCheckoutEvent(id: string): Stripe.Event {
  return event(id, "checkout.session.completed", { id: "cs_live_1", metadata: { type: "subscription" } });
}

function paidInvoiceEvent(id: string): Stripe.Event {
  return event(id, "invoice.payment_succeeded", {
    id: "in_live_1",
    customer: "cus_live_1",
    billing_reason: "subscription_cycle",
  });
}

/** A dispute with no `customer` — the real unidentified case. */
function anonymousDisputeEvent(id: string): Stripe.Event {
  return event(id, "charge.dispute.closed", {
    id: "dp_live_1",
    charge: "ch_live_1",
    amount: 1_900,
    currency: "usd",
    status: "lost",
  });
}

async function deliver(e: Stripe.Event) {
  eventIdInFlight = e.id;
  vi.mocked(constructWebhookEvent).mockReturnValue(e);
  return handleStripeWebhook("payload", "sig");
}

let savedRailway: string | undefined;
let savedRailwayName: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  recordedEventIds.clear();
  eventIdInFlight = "";
  captured = [];
  captureThrows = false;

  savedRailway = process.env.RAILWAY_ENVIRONMENT;
  savedRailwayName = process.env.RAILWAY_ENVIRONMENT_NAME;
  process.env.RAILWAY_ENVIRONMENT = "production";
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";

  /* Re-armed per arm, because the throw-safety arms deliberately break it. */
  setProductEventClientForTests(recordingClient());

  /*
    Restored defaults for ISOLATION, not because `clearAllMocks` needed it: it
    clears calls, never implementations, so a `mockResolvedValue` an arm sets
    would otherwise still be in place for the next one — which is how an arm
    comes to pass on its neighbour's fixture.
  */
  vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null as never);
  vi.mocked(refreshMonthlyCredits).mockResolvedValue({ success: true, newBalance: 1_400 } as never);
});

afterEach(() => {
  resetProductEventsForTests();
  if (savedRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
  else process.env.RAILWAY_ENVIRONMENT = savedRailway;
  if (savedRailwayName === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
  else process.env.RAILWAY_ENVIRONMENT_NAME = savedRailwayName;
});

describe("a money edge is recorded once, on the delivery that landed", () => {
  it("records the product word and the account, off the payload", async () => {
    const result = await deliver(checkoutEvent("evt_money_1"));

    expect(result.success).toBe(true);
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe("checkout completed");
    expect(captured[0].distinctId).toBe("7");
    /* The world rides on every event, the release only where a build sha exists,
       and NOTHING else does on this one. Written as two assertions rather than a
       set comparison against a list filtered by the object itself — that shape
       passes whatever the object holds, which is the `selector both states
       satisfy` class. */
    const keys = Object.keys(captured[0].properties);
    expect(keys).toContain("world");
    expect(keys.filter((k) => k !== "world" && k !== "release")).toEqual([]);
  });

  it("⚠ a REDELIVERY records nothing extra — the claim admits one delivery", async () => {
    await deliver(checkoutEvent("evt_money_2"));
    expect(captured).toHaveLength(1);

    const second = await deliver(checkoutEvent("evt_money_2"));

    expect(second.success).toBe(true);
    expect(second.message).toContain("already processed");
    expect(captured, "the redelivery recorded a second event").toHaveLength(1);
  });

  it("⚠ a FAILED delivery records NOTHING, and its retry records exactly one", async () => {
    /*
      THE ARM THAT DECIDES WHERE THE CAPTURE MAY LIVE. A failed handler hands the
      claim back so Stripe redelivers — so a capture inside a handler would fire
      once per ATTEMPT, and two attempts of one payment would read as two.
    */
    const failed = await deliver(failingCheckoutEvent("evt_money_3"));
    expect(failed.success).toBe(false);
    expect(captured, "a failed delivery recorded an event").toHaveLength(0);

    const retried = await deliver(checkoutEvent("evt_money_3"));
    expect(retried.success).toBe(true);
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe("checkout completed");
  });

  it("⚠ a FAILED delivery records nothing WHEN THE ACCOUNT IS PERFECTLY READABLE", async () => {
    /*
      ⚠ THIS ARM EXISTS BECAUSE THE ONE ABOVE PASSED FOR THE WRONG REASON, AND
      THE SABOTAGE PASS IS WHAT SAID SO. Making the capture unconditional — the
      double-count defect this whole placement exists to prevent — left the arm
      above GREEN. Its fixture fails precisely BECAUSE its metadata has no
      `userId`, and that same absence is what makes the account unreadable, so
      nothing was recorded whether the success gate existed or not. It was an
      accept arm inert by construction.

      Here the customer resolves fine and the handler fails LATER, at the credit
      refresh. So the only thing that can keep the stream silent is the gate.
    */
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 11,
      credits: { planTier: "pro", stripeSubscriptionId: "sub_live_1", balance: 0 },
    } as never);
    vi.mocked(refreshMonthlyCredits).mockResolvedValue({
      success: false,
      error: "the balance write missed",
    } as never);

    const failed = await deliver(paidInvoiceEvent("evt_money_11"));

    expect(failed.success, "the fixture did not actually fail — the arm would prove nothing").toBe(false);
    expect(captured, "a failed payment was recorded as a payment").toHaveLength(0);
    /* And the claim went back, so Stripe's redelivery is the retry. */
    expect(recordedEventIds.has("evt_money_11")).toBe(false);
  });

  it("carries the credits a paid period actually granted", async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 11,
      credits: { planTier: "pro", stripeSubscriptionId: "sub_live_1", balance: 800 },
    } as never);

    const result = await deliver(paidInvoiceEvent("evt_money_4"));

    expect(result.success).toBe(true);
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe("payment made");
    expect(captured[0].distinctId).toBe("11");
    /* The GRANT (600 × 1 month), not the new balance of 1,400 — a customer who
       bought 600 credits did not buy the rollover they already had. */
    expect(captured[0].properties.creditsGranted).toBe(600);
  });

  it("records nothing for an account it cannot read, and invents no person", async () => {
    const result = await deliver(anonymousDisputeEvent("evt_money_5"));

    expect(result.success).toBe(true);
    expect(captured, "an unidentified dispute was parked on a made-up id").toHaveLength(0);
  });
});

describe("⚠ a broken event stream never costs money", () => {
  it("a client that THROWS does not turn a settled delivery into a redelivery", async () => {
    captureThrows = true;

    const result = await deliver(checkoutEvent("evt_money_6"));

    /* If the throw escaped, the dispatcher's catch would release the claim and
       return failure — Stripe would redeliver a checkout already fulfilled. */
    expect(result.success).toBe(true);
    expect(captured).toHaveLength(0);
    expect(recordedEventIds.has("evt_money_6"), "the claim was released on a settled event").toBe(true);
  });

  it("an account lookup that REJECTS does not fail the delivery either", async () => {
    /*
      The handler's own lookup succeeds and the EXTRACTOR's rejects — `Once`
      ordering is what isolates this to the code under test. Without it the
      handler would fail first and this arm would prove nothing.
    */
    vi.mocked(getUserByStripeCustomerId)
      .mockResolvedValueOnce({
        id: 11,
        credits: { planTier: "pro", stripeSubscriptionId: "sub_live_1", balance: 0 },
      } as never)
      .mockRejectedValueOnce(new Error("the users table is unreachable"));

    const result = await deliver(paidInvoiceEvent("evt_money_7"));

    expect(result.success).toBe(true);
    expect(captured).toHaveLength(0);
    expect(recordedEventIds.has("evt_money_7")).toBe(true);
  });

  it("the stream being switched OFF records nothing and breaks nothing (the no-key world)", async () => {
    setProductEventClientForTests(null);

    const result = await deliver(checkoutEvent("evt_money_8"));

    expect(result.success).toBe(true);
    expect(captured).toHaveLength(0);
  });
});

describe("the harness itself is honest", () => {
  it("POSITIVE CONTROL — the recorder does record when everything is well", async () => {
    await deliver(checkoutEvent("evt_money_9"));
    expect(captured.length, "every arm above would pass over a recorder that never records").toBe(1);
  });

  it("NEGATIVE CONTROL — a Stripe type with no product word records nothing", async () => {
    /* `invoice.upcoming` reaches the switch's `default:` and returns before the
       tail, so this proves the unmapped road is silent rather than guessing. */
    const result = await deliver(event("evt_money_10", "invoice.upcoming", { id: "in_live_2" }));

    expect(result.success).toBe(true);
    expect(result.message).toContain("Unhandled event type");
    expect(captured).toHaveLength(0);
  });
});
