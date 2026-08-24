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

// ── The fake table. Module-level because the mock factory is hoisted. ────────
const recordedEventIds = new Set<string>();
/** Every `where(...)` the idempotency lookup built, in order. */
const lookupConditions: unknown[] = [];
/** Every row the recorder inserted, in order. */
const insertedRows: Array<Record<string, unknown>> = [];
/**
 * Which event id the fake table should answer about.
 *
 * The fake cannot read a drizzle condition object, so it is told which id is
 * in flight and answers from `recordedEventIds`. That models the TABLE and not
 * the WHERE — so the WHERE gets its own arm below, asserting the condition the
 * product actually built. A fake that stood in for both would pass a lookup
 * keyed on the wrong column.
 */
let eventIdInFlight = "";
/** Set to make the lookup itself throw, for the documented fail-open path. */
let lookupThrows = false;

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: async () => {
            lookupConditions.push(condition);
            if (lookupThrows) throw new Error("idempotency lookup is down");
            return recordedEventIds.has(eventIdInFlight) ? [{ id: 1 }] : [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        onDuplicateKeyUpdate: async () => {
          insertedRows.push(row);
          recordedEventIds.add(String(row.eventId));
        },
      }),
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

vi.mock("../db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: {
    chargebackFiled: vi.fn().mockResolvedValue(true),
    chargebackResolved: vi.fn().mockResolvedValue(true),
    paymentFailed: vi.fn().mockResolvedValue(true),
  },
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
  lookupConditions.length = 0;
  insertedRows.length = 0;
  eventIdInFlight = "";
  lookupThrows = false;
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
   * ⚠ ASSERT AT THE WIRE (enforcement invariant 5's habit, applied to a
   * lookup). The stateful fake above models the TABLE — it is told which id is
   * in flight and answers from a Set. It therefore cannot notice a lookup
   * keyed on the wrong column, which is precisely how this gate would fail
   * silently. So the condition the product actually builds is compared against
   * one built here from the same schema column.
   */
  it("the lookup is keyed on eventId — the WHERE, not just the answer", async () => {
    const event = checkoutEvent("evt_1Keyed");
    await deliver(event);

    expect(lookupConditions).toHaveLength(1);
    expect(lookupConditions[0]).toEqual(eq(stripeWebhookEvents.eventId, "evt_1Keyed"));
  });

  /*
   * ⚠ THE GATE FAILS OPEN, ON PURPOSE, AND NOTHING SAID SO OUT LOUD.
   *
   * `webhooks.ts` catches a failed idempotency lookup and proceeds — its own
   * comment reads "If idempotency check fails, proceed anyway (fail open)".
   * That is a real decision with a real cost: a database blip during a Stripe
   * retry storm is the exact moment a duplicate would be paid. It is pinned as
   * CURRENT BEHAVIOUR rather than changed, so whoever decides it is a defect
   * is deciding rather than discovering.
   */
  it("⚠ if the lookup THROWS, the event is processed anyway — fail-open, pinned", async () => {
    lookupThrows = true;

    const result = await deliver(checkoutEvent("evt_1LookupDown"));

    expect(creditReferrerOnPaidAction).toHaveBeenCalledWith(1);
    expect(result.success).toBe(true);
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
    expect(lookupConditions, "the gate was never reached").toHaveLength(0);
  });
});
