/**
 * #1965 AND #1987 — THE QUOTE AND THE WIRE.
 *
 * **#1965.** On an interval switch Stripe credits the unused share of the old
 * period — plan and dial alike — against the new invoice, while the credit
 * take-back floors at what is LEFT of the allowance. Spend first, switch
 * second, and the unused value comes back as money with nothing behind it.
 * The remedy is to charge the spent part of that share back on the same
 * invoice, at the rate Stripe credited it (`spentShareCharge`). These arms run
 * the card's own scenario through the real `quotePlanChange` and prove no
 * credit leaves unpriced, then prove the charge reaches the outgoing
 * `subscriptions.update` (working law 5 — assert at the wire).
 *
 * **#1987.** The billing state now says WHEN a plan ends in either of
 * Stripe's two shapes (`cancel_at_period_end`, or a `cancel_at` date), its
 * status, and whether its collection is paused. The reader arms are here; the
 * refusals they feed are driven at the procedure in
 * `server/routes/planChangeSpentShareAndStates.test.ts`.
 *
 * Every figure is derived from the same product tables the subject reads, so
 * a price edit does not redden an arm — the RELATIONSHIP is what is asserted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  pricesList,
  subscriptionsUpdate,
  subscriptionsRetrieve,
  invoicesRetrieve,
  schedulesRelease,
} = vi.hoisted(() => ({
  pricesList: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  invoicesRetrieve: vi.fn(),
  schedulesRelease: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    prices = { create: vi.fn(), list: pricesList };
    subscriptions = { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate };
    subscriptionSchedules = {
      create: vi.fn(),
      update: vi.fn(),
      release: schedulesRelease,
      retrieve: vi.fn(),
    };
    invoices = { retrieve: invoicesRetrieve };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

import {
  quotePlanChange,
  readSubscriptionBillingState,
  subscriptionEndsAtSec,
  updateSubscriptionPlan,
  type SubscriptionBillingState,
} from "./stripeService";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import { planCreditSliderUnitsAllowed } from "./planCreditSlider";
import { priceLookupKey } from "./stripePriceCatalogue";
import { periodPriceInCents } from "@shared/annualBilling";
import {
  planCreditSliderLedgerCredits,
  planCreditSliderPriceInCents,
} from "@shared/planCreditSlider";
import { PLAN_TIERS } from "../../drizzle/schema";
import { environmentMetadata } from "./environmentTag";

const DAY = 24 * 60 * 60;
const T0 = 1_760_000_000;

/** The rung that carries the dial — derived, never named (card390's rule). */
const DIAL_PLAN = (Object.keys(SUBSCRIPTION_PRODUCTS) as Array<keyof typeof SUBSCRIPTION_PRODUCTS>)
  .find((plan) => planCreditSliderUnitsAllowed(plan) > 0)!;
const DIAL_UNITS = planCreditSliderUnitsAllowed(DIAL_PLAN);

function dialState(overrides: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState {
  return {
    subscriptionItemId: "si_base",
    currentPlan: DIAL_PLAN,
    currentInterval: "monthly",
    periodStartSec: T0,
    periodEndSec: T0 + 30 * DAY,
    /* The dial raised to its ceiling early in the month — the card's scenario. */
    currentCreditUnits: DIAL_UNITS,
    creditItemId: "si_addon",
    endsAtSec: null,
    status: "active",
    collectionPaused: false,
    ...overrides,
  };
}

/** Two days into a thirty-day month: most of the period is unused. */
const NOW = T0 + 2 * DAY;

/** The whole unconsumed share, as the quote counts it with nothing spent. */
function wholeShare(state: SubscriptionBillingState) {
  return quotePlanChange(state, DIAL_PLAN, "annual", NOW).creditUnwind;
}

describe("#1965 — the card's scenario: dial raised, credits spent, switch to annual", () => {
  it("the dial's value really is in the money Stripe credits back — the premise, read at the quote", () => {
    const q = quotePlanChange(dialState(), DIAL_PLAN, "annual", NOW, undefined, 0);
    const planOnly = periodPriceInCents(SUBSCRIPTION_PRODUCTS[DIAL_PLAN].priceInCents, "monthly");
    /* The old line's price includes the dial — without this the scenario
       would not exist and every arm below would be measuring nothing. */
    expect(q.currentPlanPrice).toBe(planOnly + planCreditSliderPriceInCents(DIAL_UNITS, "monthly"));
    expect(q.kind).toBe("interval-switch");
    expect(q.deferred).toBe(false);
  });

  it("⚠ with the allowance SPENT, the whole unused share is charged back — nothing leaves unpriced", () => {
    const whole = wholeShare(dialState());
    const q = quotePlanChange(dialState(), DIAL_PLAN, "annual", NOW, undefined, 0);
    const unusedValue = Math.floor((q.currentPlanPrice * q.daysRemaining) / q.totalDays);

    expect(q.spentShareCredits).toBe(whole);
    expect(q.creditUnwind).toBe(0);
    /* Every cent Stripe credits for the old period is charged back, because
       none of the credits it bought can be handed back. */
    expect(q.spentShareCharge).toBe(unusedValue);
    /* So today's figure is the year at full price — the honest one when the
       month was used up front. */
    expect(q.immediateCharge).toBe(q.newPlanPrice);
  });

  it("⚠ CONSERVATION — at any balance, money returned never exceeds the credits taken back, at Stripe's own rate", () => {
    const whole = wholeShare(dialState());
    for (const left of [0, 1_000, Math.floor(whole / 3), Math.floor(whole / 2), whole - 5, whole, whole * 2]) {
      const q = quotePlanChange(dialState(), DIAL_PLAN, "annual", NOW, undefined, left);
      const unusedValue = Math.floor((q.currentPlanPrice * q.daysRemaining) / q.totalDays);
      /* The two halves always make the whole share. */
      expect(q.creditUnwind + q.spentShareCredits).toBe(whole);
      expect(q.creditUnwind).toBe(Math.min(whole, left));
      /* Money that really comes back for the old period, against the value of
         the credits that really go back. The floor on the charge can leave her
         at most ONE cent ahead — never a credit's worth. */
      const moneyReturned = unusedValue - q.spentShareCharge;
      const creditsReturnedValue = (unusedValue * q.creditUnwind) / whole;
      expect(moneyReturned - creditsReturnedValue).toBeGreaterThanOrEqual(0);
      expect(moneyReturned - creditsReturnedValue).toBeLessThan(1);
      expect(q.immediateCharge).toBe(q.newPlanPrice - unusedValue + q.spentShareCharge);
    }
  });

  it("NEGATIVE CONTROL — with the allowance untouched, nothing is charged and the road is exactly as it was", () => {
    const before = quotePlanChange(dialState(), DIAL_PLAN, "annual", NOW);
    const q = quotePlanChange(dialState(), DIAL_PLAN, "annual", NOW, undefined, 10_000_000);
    expect(q.spentShareCharge).toBe(0);
    expect(q.spentShareCredits).toBe(0);
    expect(q.creditUnwind).toBe(before.creditUnwind);
    expect(q.immediateCharge).toBe(before.immediateCharge);
  });

  it("the plan's own allowance takes the same rule — one pool, so the dial is not special-cased", () => {
    /* No dial at all: a plain monthly plan spent on day one. Nothing can tell
       the plan's credits from the dial's once they are spent, so the remedy is
       on the whole share or it is not a remedy. */
    const plain = dialState({ currentCreditUnits: 0, creditItemId: null });
    const q = quotePlanChange(plain, DIAL_PLAN, "annual", NOW, undefined, 0);
    expect(q.spentShareCredits).toBeGreaterThan(0);
    expect(q.spentShareCharge).toBeGreaterThan(0);
    expect(q.spentShareCredits).toBe(
      quotePlanChange(plain, DIAL_PLAN, "annual", NOW).creditUnwind,
    );
    /* And the dial's state carries a bigger share by exactly its own steps. */
    expect(wholeShare(dialState()) - wholeShare(plain)).toBeGreaterThan(0);
    expect(planCreditSliderLedgerCredits(DIAL_UNITS)).toBeGreaterThan(0);
  });

  it("a DEFERRED annual → monthly is left deferred — the charge cannot re-rule his option 1", () => {
    const annual = dialState({
      currentInterval: "annual",
      periodEndSec: T0 + 365 * DAY,
    });
    const q = quotePlanChange(annual, DIAL_PLAN, "monthly", NOW, undefined, 0);
    expect(q.deferred).toBe(true);
    expect(q.spentShareCharge).toBe(0);
    expect(q.immediateCharge).toBe(0);
  });

  it("a same-interval change never carries the charge — no money comes back on an upgrade", () => {
    const q = quotePlanChange(
      dialState({ currentPlan: "pro", currentCreditUnits: 0, creditItemId: null }),
      DIAL_PLAN,
      undefined,
      NOW,
      undefined,
      0,
    );
    expect(q.kind).toBe("same-interval");
    expect(q.spentShareCharge).toBe(0);
    expect(q.spentShareCredits).toBe(0);
  });

  it("PLAN_TIERS still gives the dial's rung an allowance — the fixture's own precondition", () => {
    expect(PLAN_TIERS[DIAL_PLAN as keyof typeof PLAN_TIERS].monthlyCredits).toBeGreaterThan(0);
  });
});

/* ───────────────────────────── the wire ───────────────────────────── */

function catalogueAnswers() {
  pricesList.mockImplementation(async ({ lookup_keys }: { lookup_keys: string[] }) => {
    const key = lookup_keys[0];
    for (const plan of Object.keys(SUBSCRIPTION_PRODUCTS)) {
      for (const interval of ["monthly", "annual"] as const) {
        if (priceLookupKey(plan, interval) === key) {
          return {
            data: [
              {
                id: `price_${plan}_${interval}`,
                lookup_key: key,
                unit_amount: periodPriceInCents(
                  SUBSCRIPTION_PRODUCTS[plan as keyof typeof SUBSCRIPTION_PRODUCTS].priceInCents,
                  interval,
                ),
                recurring: { interval: interval === "annual" ? "year" : "month" },
              },
            ],
          };
        }
      }
    }
    return { data: [] };
  });
}

function liveSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    schedule: null,
    status: "active",
    currency: "usd",
    metadata: { plan: "pro" },
    items: {
      data: [
        {
          id: "si_1",
          price: { product: "prod_pro", currency: "usd", recurring: { interval: "month" } },
          current_period_start: T0,
          current_period_end: T0 + 30 * DAY,
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  pricesList.mockReset();
  catalogueAnswers();
  subscriptionsUpdate.mockReset().mockResolvedValue({ latest_invoice: "in_switch" });
  subscriptionsRetrieve.mockReset().mockResolvedValue(liveSubscription());
  schedulesRelease.mockReset();
  invoicesRetrieve.mockReset().mockResolvedValue({ amount_due: 10_000, status: "paid" });
});

describe("#1965 — the spent share reaches the outgoing subscriptions.update", () => {
  it("⚠ a charge rides the SAME update as the switch, inline-priced under the plan's own product", async () => {
    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1", undefined, 4_321);

    expect(result.success).toBe(true);
    expect(subscriptionsUpdate).toHaveBeenCalledTimes(1);
    const args = subscriptionsUpdate.mock.calls[0][1];
    expect(args.proration_behavior).toBe("always_invoice");
    expect(args.add_invoice_items).toEqual([
      {
        price_data: { currency: "usd", product: "prod_pro", unit_amount: 4_321 },
        quantity: 1,
        metadata: { kind: "spent-allowance-share", ...environmentMetadata() },
      },
    ]);
  });

  it("NEGATIVE CONTROL — no charge, no line: an ordinary switch's request is unchanged", async () => {
    await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1", undefined, 0);
    await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1");

    expect(subscriptionsUpdate).toHaveBeenCalledTimes(2);
    for (const call of subscriptionsUpdate.mock.calls) {
      expect(call[1]).not.toHaveProperty("add_invoice_items");
    }
  });

  it("an expanded product object is read by its id", async () => {
    subscriptionsRetrieve.mockResolvedValue(
      liveSubscription({
        items: {
          data: [
            {
              id: "si_1",
              price: { product: { id: "prod_expanded" }, recurring: { interval: "month" } },
              current_period_start: T0,
              current_period_end: T0 + 30 * DAY,
            },
          ],
        },
      }),
    );
    await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1", undefined, 100);
    expect(subscriptionsUpdate.mock.calls[0][1].add_invoice_items[0].price_data.product).toBe(
      "prod_expanded",
    );
  });

  it("⚠ a line that cannot be built REFUSES before anything is written — never the switch without its charge", async () => {
    subscriptionsRetrieve.mockResolvedValue(
      liveSubscription({
        schedule: "sub_sched_pending",
        items: {
          data: [
            {
              id: "si_1",
              price: { recurring: { interval: "month" } },
              current_period_start: T0,
              current_period_end: T0 + 30 * DAY,
            },
          ],
        },
      }),
    );

    const result = await updateSubscriptionPlan("sub_1", "pro", 7, "annual", "si_1", undefined, 4_321);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/nothing was changed/i);
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
    /* Not even the pending schedule is released — the refusal is before it. */
    expect(schedulesRelease).not.toHaveBeenCalled();
  });
});

/* ──────────────────────── #1987 — the reader ──────────────────────── */

describe("#1987 — when a plan ends, in either of Stripe's shapes", () => {
  const END = T0 + 30 * DAY;

  it("a `cancel_at` date alone is an ending — the shape the flag could not see", () => {
    expect(subscriptionEndsAtSec({ cancel_at: END + 5, cancel_at_period_end: false }, END)).toBe(END + 5);
  });

  it("the flag alone answers the period end", () => {
    expect(subscriptionEndsAtSec({ cancel_at: null, cancel_at_period_end: true }, END)).toBe(END);
  });

  it("both together answer Stripe's own date", () => {
    expect(subscriptionEndsAtSec({ cancel_at: END, cancel_at_period_end: true }, END)).toBe(END);
  });

  it("NEGATIVE CONTROL — neither is a plan that renews", () => {
    expect(subscriptionEndsAtSec({ cancel_at: null, cancel_at_period_end: false }, END)).toBeNull();
    expect(subscriptionEndsAtSec({}, END)).toBeNull();
  });

  it("⚠ readSubscriptionBillingState carries a `cancel_at` ending, the status and a paused collection off the one retrieve", async () => {
    subscriptionsRetrieve.mockResolvedValue(
      liveSubscription({
        cancel_at: T0 + 30 * DAY,
        cancel_at_period_end: false,
        status: "past_due",
        pause_collection: { behavior: "void" },
      }),
    );

    const state = await readSubscriptionBillingState("sub_1");

    expect(state?.endsAtSec).toBe(T0 + 30 * DAY);
    expect(state?.status).toBe("past_due");
    expect(state?.collectionPaused).toBe(true);
    expect(subscriptionsRetrieve).toHaveBeenCalledTimes(1);
  });

  it("POSITIVE CONTROL — a running plan reads as running", async () => {
    const state = await readSubscriptionBillingState("sub_1");
    expect(state?.endsAtSec).toBeNull();
    expect(state?.status).toBe("active");
    expect(state?.collectionPaused).toBe(false);
  });
});
