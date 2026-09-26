/**
 * THE GATE THAT STOPS A REDELIVERED STRIPE EVENT BEING PAID TWICE.
 *
 * ⚠ THIS FILE EXISTS BECAUSE A DOCBLOCK CLAIMED IT ALREADY DID.
 * `server/pathB-completion.test.ts` opens *"Tests for the 3 final production
 * hardening items: … 2. Stripe webhook idempotency — duplicate event
 * detection"*. Read at the arms, that file proves the table is exported from
 * the schema, that it has columns, and that `handleStripeWebhook` is a
 * function; one of its sections is headed *"STRIPE WEBHOOK IDEMPOTENCY —
 * recordProcessedEvent is internal"* over an arm asserting an interface is
 * exported. **Nothing anywhere drove a redelivery.** Found 2026-08-25 by the
 * label sweep, ruled fable-1634.
 *
 * Two files could have covered it silently and neither does:
 * `environmentTag.test.ts` drives the same entry point but for WORLD TAGGING,
 * and `webhookSecurity.test.ts` has an arm reading *"should handle duplicate
 * restore (idempotency)"* — which is the DISPUTE-RESTORE being idempotent, a
 * different thing one section away. That near-miss is why this was read rather
 * than guessed at.
 *
 * **Stripe delivers at least once by design.** A redelivered
 * `checkout.session.completed` reaches `creditReferrerOnPaidAction`, which
 * pays the named user's referrer — so this gate failing silently is credits
 * granted twice, and nothing in the suite would have said so.
 *
 * The harness is `environmentTag.test.ts`'s, with one thing added: the
 * `stripeWebhookEvents` double is STATEFUL, so the second delivery of an event
 * meets the row the first delivery wrote.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

// ── The fake table. Module-level because the mock factory is hoisted. ────
/** The rows the table holds, as a unique index on `eventId` would hold them. */
const recordedEventIds = new Set<string>();
/** Every row the CLAIM inserted, in order. */
const insertedRows: Array<Record<string, unknown>> = [];
/** Every `where(...)` a release built, in order. */
const releaseConditions: unknown[] = [];
/** Set to make the claim insert fail with something that is NOT a duplicate. */
let claimThrows = false;
/** Set to make the release fail — the one hole the claim shape has. */
let releaseThrows = false;

/** What MySQL raises when a unique index refuses a second row. */
function duplicateKeyError(): Error {
  return Object.assign(new Error("Duplicate entry for key 'eventId'"), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
  });
}

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    /*
      THE CLAIM. The insert carries the whole guard now, so this fake models the
      UNIQUE INDEX rather than a lookup: a second insert of an id already in the
      set raises the driver's own duplicate error, which is the signal the
      product reads.
    */
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        if (claimThrows) throw new Error("the events table is unreachable");
        if (recordedEventIds.has(String(row.eventId))) throw duplicateKeyError();
        insertedRows.push(row);
        recordedEventIds.add(String(row.eventId));
      },
    }),
    delete: () => ({
      where: async (condition: unknown) => {
        releaseConditions.push(condition);
        if (releaseThrows) throw new Error("the events table is unreachable");
        /* The fake cannot read a drizzle condition, so it releases whichever id
           is in flight — and the CONDITION gets its own arm below, against one
           built here from the same schema column. */
        recordedEventIds.delete(eventIdInFlight);
      },
    }),
  })),
}));

/** Which event id is in flight, for the release the fake cannot read. */
let eventIdInFlight = "";

vi.mock("./stripeService", () => ({
  constructWebhookEvent: vi.fn(),
  mapStripeStatus: vi.fn().mockReturnValue("active"),
  mapPlanToTier: vi.fn().mockReturnValue("pro"),
  calculateRolloverCredits: vi.fn().mockReturnValue(0),
  getMonthlyCredits: vi.fn().mockReturnValue(100),
  cancelSubscription: vi.fn().mockResolvedValue(true),
}));

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
}));

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { creditReferrerOnPaidAction } from "../db";
import { ENV_TAG_KEY } from "./environmentTag";
import { stripeWebhookEvents } from "../../drizzle/schema";

const THIS_WORLD_IS = "railway:production";

/**
 * ⚠ The id may NOT start with `evt_test_`: `handleStripeWebhook` short-circuits
 * on that prefix as a Stripe dashboard verification ping, several steps before
 * the idempotency gate. An arm written with the file's usual id shape would
 * have been green without ever reaching the code under test.
 */
function checkoutEvent(id: string): Stripe.Event {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_live_redelivery",
        metadata: { userId: "1", type: "subscription", [ENV_TAG_KEY]: THIS_WORLD_IS },
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

/**
 * The same event with NO `userId` in its metadata — a REAL handler failure.
 *
 * ⚠ The obvious way to fail a delivery is to make `creditReferrerOnPaidAction`
 * reject, and it does not work: `handleCheckoutCompleted` catches that itself
 * ("non-blocking — don't fail the webhook for referral credit issues") and
 * still returns `success: true`. An arm built on it would have proved the
 * release path while never entering it. This road is the handler's own
 * documented failure: *"Missing userId in session metadata"*.
 */
function failingCheckoutEvent(id: string): Stripe.Event {
  const event = checkoutEvent(id) as unknown as { data: { object: { metadata: Record<string, unknown> } } };
  delete event.data.object.metadata.userId;
  return event as unknown as Stripe.Event;
}

/** One delivery of `event`, with the fake table told which id is in flight. */
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
  releaseConditions.length = 0;
  insertedRows.length = 0;
  eventIdInFlight = "";
  claimThrows = false;
  releaseThrows = false;
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

describe("a redelivered Stripe event does not pay twice", () => {
  it("CONTROL — a FRESH event id is processed, and the money line is reached", async () => {
    // The population control. Without it every arm below would pass against a
    // gate that refused everything, which is a different and worse product.
    const result = await deliver(checkoutEvent("evt_1FreshDelivery"));

    expect(creditReferrerOnPaidAction).toHaveBeenCalledWith(1);
    expect(result.success).toBe(true);
    expect(result.message).not.toContain("already processed");
  });

  it("the SAME event id delivered twice reaches the money line ONCE", async () => {
    const event = checkoutEvent("evt_1Redelivered");

    const first = await deliver(event);
    expect(creditReferrerOnPaidAction, "first delivery must pay").toHaveBeenCalledTimes(1);
    expect(first.success).toBe(true);

    const second = await deliver(event);

    // The whole point of the file, in one line.
    expect(
      creditReferrerOnPaidAction,
      "the redelivery must NOT have credited the referrer a second time",
    ).toHaveBeenCalledTimes(1);
    expect(second.success).toBe(true);
    expect(second.message).toContain("already processed");
  });

  it("a DIFFERENT event id is not caught by the gate — it discriminates", async () => {
    // Without this, an idempotency gate that keyed on nothing at all (refusing
    // every event after the first, whatever its id) would pass the arm above.
    await deliver(checkoutEvent("evt_1First"));
    await deliver(checkoutEvent("evt_1Second"));

    expect(creditReferrerOnPaidAction).toHaveBeenCalledTimes(2);
  });

  it("the first delivery RECORDS the event — the gate has something to find", async () => {
    await deliver(checkoutEvent("evt_1Recorded"));

    expect(insertedRows).toEqual([
      { eventId: "evt_1Recorded", eventType: "checkout.session.completed" },
    ]);
  });

  /*
   * ⚠ ASSERT AT THE WIRE (enforcement invariant 5's habit). The fake models
   * the unique INDEX — it raises the driver's duplicate error on a second row
   * for an id it already holds — so it cannot notice a RELEASE keyed on the
   * wrong column, which is how a claim would silently never be given back. The
   * condition the product builds is compared against one built here from the
   * same schema column.
   */
  it("the release is keyed on eventId — the WHERE, not just the answer", async () => {
    await deliver(failingCheckoutEvent("evt_1Keyed"));

    expect(releaseConditions).toHaveLength(1);
    expect(releaseConditions[0]).toEqual(eq(stripeWebhookEvents.eventId, "evt_1Keyed"));
  });

  /*
   * ⚠ THE GATE FAILS CLOSED NOW (#1361), AND THIS ARM WAS ITS OPPOSITE.
   *
   * It read *"if the lookup THROWS, the event is processed anyway — fail-open,
   * pinned"*, over a comment in `webhooks.ts` that said so outright. The claim
   * shape ends it: a guard that cannot be reached REFUSES, the route turns that
   * into a 400, and Stripe redelivers. A redelivery is cheap; paying an unknown
   * number of times during exactly the database blip a retry storm arrives in
   * is not.
   */
  it("⚠ if the guard is UNREACHABLE, the event is REFUSED rather than processed", async () => {
    claimThrows = true;

    const result = await deliver(checkoutEvent("evt_1GuardDown"));

    expect(creditReferrerOnPaidAction, "the money line must not be reached").not.toHaveBeenCalled();
    expect(result.success, "a refusal is a 400, which is what makes Stripe redeliver").toBe(false);
    expect(result.message).toContain("replay cannot be ruled out");
  });

  /*
   * THE CLAIM IS GIVEN BACK WHEN THE WORK FAILS, or a transient handler failure
   * would be permanent: the retry would read as a duplicate and the effect
   * would never land. This is the arm that makes claiming-before-working safe,
   * and it is the one a careless "simplification" of the catch block breaks.
   */
  it("a FAILED handler releases the claim, so the redelivery does the work", async () => {
    const failed = await deliver(failingCheckoutEvent("evt_1Transient"));
    expect(failed.success).toBe(false);
    expect(recordedEventIds.has("evt_1Transient"), "the claim must not outlive a failed handler").toBe(false);

    /* Stripe's redelivery, and it must do the work rather than read as done. */
    const retried = await deliver(checkoutEvent("evt_1Transient"));
    expect(retried.success).toBe(true);
    expect(creditReferrerOnPaidAction).toHaveBeenCalledWith(1);
  });

  it("⚠ a release that FAILS is logged, and the event stays claimed — the stated hole", async () => {
    /* Named rather than hidden: the same database that just failed is the only
       thing that could undo this, so what is owed is the loud line. Pinned so a
       later reader meets the limit here instead of in production. */
    releaseThrows = true;

    await deliver(failingCheckoutEvent("evt_1Stuck"));
    expect(recordedEventIds.has("evt_1Stuck")).toBe(true);
  });

  /*
   * ⚠ AND AN ARM THAT WOULD HAVE BEEN GREEN WITHOUT TESTING ANYTHING.
   * `handleStripeWebhook` returns before the gate for any id beginning
   * `evt_test_` — the shape `environmentTag.test.ts`'s own helper generates.
   * Pinned so the next person writing an arm here knows why the ids above look
   * the way they do.
   */
  it("⚠ an evt_test_ id short-circuits BEFORE the gate — why these ids are not that shape", async () => {
    const result = await deliver(checkoutEvent("evt_test_verification"));

    expect(result.message).toBe("Test event verified");
    expect(creditReferrerOnPaidAction).not.toHaveBeenCalled();
    expect(insertedRows, "the guard was never reached").toHaveLength(0);
  });
});
