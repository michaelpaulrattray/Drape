/**
 * #1936 — A DECREASE DOES NOT HAPPEN TODAY, AND WHAT THAT CLOSES.
 *
 * The defect, in one sentence: `always_invoice` handed the unused share of the
 * period back as money while the credit take-back floored at what was LEFT of
 * the allowance, so raise → spend → lower → raise minted credits out of the
 * refund — up to 380,000 display credits a round trip on the dial's rung, with
 * no rate limit on `changePlan`.
 *
 * **His ruling: option 1** — a decrease takes effect at the next renewal, with
 * no refund and no credit take-back; an increase stays instant.
 *
 * The harness is `planCreditSliderWire.test.ts`'s, for its stated reason: the
 * Stripe double carries `prices.list` so the REAL price resolvers run, because
 * mocking the resolver would assert that a builder forwards what it is handed,
 * which is not the contract. Working law 5 throughout — every claim about what
 * is sent is read off the outgoing call.
 *
 * ⚠ **THE TWO ARMS THIS SUITE WOULD BE WORTHLESS WITHOUT ARE THE NEGATIVE
 * CONTROLS IN §1**, and they are negative controls for a reason that was
 * nearly a defect: the obvious way to write the direction test is *"anything
 * that reduces the allowance"*, which defers **monthly → annual** (the largest
 * upgrade this product sells — every interval switch carries a `creditUnwind`)
 * and defers **a move up the ladder that drops the dial's steps** (where the
 * allowance falls and the customer is paying MORE). Both would be deferring an
 * increase, against his word. Neither can be minted from, because no money
 * comes back. So they are pinned as things that must NOT be deferred.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  pricesList,
  subscriptionsRetrieve,
  subscriptionsUpdate,
  invoicesRetrieve,
  schedulesCreate,
  schedulesUpdate,
  schedulesRelease,
  schedulesRetrieve,
} = vi.hoisted(() => ({
  pricesList: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  invoicesRetrieve: vi.fn(),
  schedulesCreate: vi.fn(),
  schedulesUpdate: vi.fn(),
  schedulesRelease: vi.fn(),
  schedulesRetrieve: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeDouble {
    checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
    prices = { create: vi.fn(), list: pricesList };
    subscriptions = { retrieve: subscriptionsRetrieve, update: subscriptionsUpdate };
    subscriptionSchedules = {
      create: schedulesCreate,
      update: schedulesUpdate,
      release: schedulesRelease,
      retrieve: schedulesRetrieve,
    };
    invoices = { retrieve: invoicesRetrieve };
    customers = { retrieve: vi.fn(), create: vi.fn() };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
    refunds = { create: vi.fn() };
  },
}));

import {
  cancelSubscription,
  quotePlanChange,
  stripe,
  updateSubscriptionPlan,
  type SubscriptionBillingState,
} from "./stripeService";
import {
  readPendingPlanChange,
  releaseScheduleBeforeWrite,
  scheduleSubscriptionChange,
} from "./subscriptionSchedule";
import { planCreditsPriceLookupKey, priceLookupKey } from "./stripePriceCatalogue";
import { PLAN_CREDIT_SLIDER_PLAN } from "./planCreditSlider";
import { planCreditSliderPriceInCents } from "@shared/planCreditSlider";
import { periodPriceInCents } from "@shared/annualBilling";
import { SUBSCRIPTION_PRODUCTS } from "./stripeProducts";
import type { PlanTier } from "../../drizzle/schema";

/** The dial's rung, REFUSED rather than defaulted — a suite that silently
 *  asserted nothing about the dial is the thing this card is about. */
const DIAL_PLAN = (() => {
  if (PLAN_CREDIT_SLIDER_PLAN === null) {
    throw new Error("no rung carries the dial, so §1's dial arms would assert nothing");
  }
  return PLAN_CREDIT_SLIDER_PLAN as PlanTier;
})();

/** A rung strictly cheaper than the dial's, so "downgrade" is real rather than
 *  assumed — derived from the catalogue, never typed. */
const LOWER_PLAN = (() => {
  const dialPrice = SUBSCRIPTION_PRODUCTS[DIAL_PLAN].priceInCents;
  const cheaper = Object.keys(SUBSCRIPTION_PRODUCTS).find(
    (plan) => SUBSCRIPTION_PRODUCTS[plan].priceInCents < dialPrice,
  );
  if (!cheaper) throw new Error("no rung is cheaper than the dial's, so no downgrade exists to test");
  return cheaper as PlanTier;
})();

/** And one strictly dearer, for the upgrade arms. */
const HIGHER_PLAN = (() => {
  const dialPrice = SUBSCRIPTION_PRODUCTS[DIAL_PLAN].priceInCents;
  const dearer = Object.keys(SUBSCRIPTION_PRODUCTS).find(
    (plan) => SUBSCRIPTION_PRODUCTS[plan].priceInCents > dialPrice,
  );
  if (!dearer) throw new Error("no rung is dearer than the dial's, so no upgrade exists to test");
  return dearer as PlanTier;
})();

const BASE_PRICE_ID = "price_dialplan_base";
const ADDON_PRICE_ID = "price_dialplan_addon";
const NOW_SEC = 1_780_000_000;
const DAY = 24 * 60 * 60;

/** Mid-period on purpose: a change with days left on both sides is the only
 *  state in which any of this moves money at all. */
function stateAt(overrides: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState {
  return {
    subscriptionItemId: "si_base",
    currentPlan: DIAL_PLAN,
    currentInterval: "monthly",
    periodStartSec: NOW_SEC - 10 * DAY,
    periodEndSec: NOW_SEC + 20 * DAY,
    currentCreditUnits: 0,
    creditItemId: null,
    endsAtSec: null,
    status: "active",
    collectionPaused: false,
    ...overrides,
  };
}

/** The catalogue at the REAL amounts, so every resolver refusal stays live. */
function catalogueHolds(interval: "monthly" | "annual") {
  const stripeInterval = interval === "annual" ? "year" : "month";
  const shelf = new Map<string, Record<string, unknown>>();
  for (const plan of Object.keys(SUBSCRIPTION_PRODUCTS)) {
    shelf.set(priceLookupKey(plan as never, interval), {
      id: plan === DIAL_PLAN ? BASE_PRICE_ID : `price_${plan}_base`,
      lookup_key: priceLookupKey(plan as never, interval),
      unit_amount: periodPriceInCents(SUBSCRIPTION_PRODUCTS[plan].priceInCents, interval),
      recurring: { interval: stripeInterval },
    });
  }
  shelf.set(planCreditsPriceLookupKey(DIAL_PLAN as never, interval), {
    id: ADDON_PRICE_ID,
    lookup_key: planCreditsPriceLookupKey(DIAL_PLAN as never, interval),
    unit_amount: planCreditSliderPriceInCents(1, interval),
    recurring: { interval: stripeInterval },
  });
  pricesList.mockImplementation(async ({ lookup_keys }: { lookup_keys: string[] }) => {
    const row = shelf.get(lookup_keys[0]);
    return { data: row ? [row] : [] };
  });
}

/** A schedule as Stripe mints it from an existing subscription: ONE phase,
 *  matching the live billing period, carrying the live items. */
function mintedSchedule(items: { price: string; quantity?: number }[]) {
  return {
    id: "sub_sched_1",
    status: "active",
    current_phase: { start_date: NOW_SEC - 10 * DAY, end_date: NOW_SEC + 20 * DAY },
    phases: [
      {
        start_date: NOW_SEC - 10 * DAY,
        end_date: NOW_SEC + 20 * DAY,
        items,
        metadata: { plan: DIAL_PLAN, userId: "42" },
        discounts: [],
        default_tax_rates: [],
        trial_end: null,
      },
    ],
  };
}

function sentScheduleUpdate(): Record<string, any> {
  expect(schedulesUpdate).toHaveBeenCalledTimes(1);
  return schedulesUpdate.mock.calls[0][1] as Record<string, any>;
}

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", schedule: null, items: { data: [] } });
  subscriptionsUpdate.mockResolvedValue({ latest_invoice: null });
  schedulesCreate.mockResolvedValue(mintedSchedule([{ price: BASE_PRICE_ID, quantity: 1 }]));
  schedulesUpdate.mockImplementation(async (_id: string, params: Record<string, any>) => ({
    id: "sub_sched_1",
    phases: params.phases.map((phase: Record<string, any>, index: number) => ({
      ...phase,
      start_date: index === 0 ? NOW_SEC - 10 * DAY : NOW_SEC + 20 * DAY,
    })),
  }));
  schedulesRelease.mockResolvedValue({ id: "sub_sched_1", status: "released" });
  /* ⚠ #2190 — `updateSubscriptionPlan` now READS what a schedule holds before
     it releases it, so a held change can put it back. A bare `vi.fn()` here
     answered `undefined`, which no Stripe read returns, and the plan change
     then refused for that reason rather than for the one an arm is about. The
     default is a live schedule with nothing after the phase in progress; an
     arm about a pending change says so. */
  schedulesRetrieve.mockResolvedValue({
    id: "sub_sched_old",
    status: "active",
    current_phase: { start_date: NOW_SEC - 10 * DAY, end_date: NOW_SEC + 20 * DAY },
    phases: [{ start_date: NOW_SEC - 10 * DAY, items: [], metadata: {} }],
  });
});

describe("1 · the direction — what is deferred and, above all, what is NOT", () => {
  it("a rung DOWNGRADE is deferred, and every money and credit field reads 0", () => {
    const quote = quotePlanChange(stateAt(), LOWER_PLAN as never, undefined, NOW_SEC);

    expect(quote.deferred).toBe(true);
    /* The zeroing is the mechanism: the charge road, the settlement road and
       all three surfaces read these and nothing else, so one place being 0 is
       what makes every one of them do nothing. */
    expect(quote.proratedAmount).toBe(0);
    expect(quote.immediateCharge).toBe(0);
    expect(quote.creditBalance).toBe(0);
    expect(quote.creditAdjustment).toBe(0);
    expect(quote.creditUnwind).toBe(0);
    /* And it names WHEN, off the period the customer has paid for. */
    expect(quote.effectiveAtSec).toBe(NOW_SEC + 20 * DAY);
  });

  it("⚠ the same change WOULD have returned money before the fix — so the zeroes above are a change, not a tautology", () => {
    /* The positive control for the arm above. The downgrade's money is real
       arithmetic: at the same instant, the quote in the UP direction between
       the same two rungs charges a non-zero figure. If the fields above were
       zero because this fixture simply has nothing to move, this would be zero
       too and the whole suite would be asserting nothing. */
    const up = quotePlanChange(
      stateAt({ currentPlan: LOWER_PLAN }),
      DIAL_PLAN as never,
      undefined,
      NOW_SEC,
    );
    expect(up.deferred).toBe(false);
    expect(up.immediateCharge).toBeGreaterThan(0);
    expect(up.creditAdjustment).toBeGreaterThan(0);
  });

  it("a DIAL-DOWN on the same rung is deferred — the shape the card was filed about", () => {
    const quote = quotePlanChange(
      stateAt({ currentCreditUnits: 20, creditItemId: "si_addon" }),
      DIAL_PLAN as never,
      undefined,
      NOW_SEC,
      4,
    );
    expect(quote.deferred).toBe(true);
    expect(quote.creditBalance).toBe(0);
    expect(quote.creditAdjustment).toBe(0);
  });

  it("ANNUAL → MONTHLY is deferred — the sibling the card named and the loop the unwind had", () => {
    const quote = quotePlanChange(
      stateAt({
        currentInterval: "annual",
        periodStartSec: NOW_SEC - 30 * DAY,
        periodEndSec: NOW_SEC + 335 * DAY,
      }),
      DIAL_PLAN as never,
      "monthly",
      NOW_SEC,
    );
    expect(quote.kind).toBe("interval-switch");
    expect(quote.deferred).toBe(true);
    expect(quote.creditUnwind).toBe(0);
    expect(quote.creditBalance).toBe(0);
  });

  it("⚠ NEGATIVE CONTROL — MONTHLY → ANNUAL is NOT deferred, though it carries an unwind", () => {
    /* Every interval switch computes a `creditUnwind`, so a direction test
       written as "anything that unwinds credits" would defer the largest
       upgrade this product sells. No money comes back, so nothing can be
       minted from it. */
    const quote = quotePlanChange(stateAt(), DIAL_PLAN as never, "annual", NOW_SEC);
    expect(quote.kind).toBe("interval-switch");
    expect(quote.deferred).toBe(false);
    expect(quote.immediateCharge).toBeGreaterThan(0);
    expect(quote.creditUnwind).toBeGreaterThan(0);
  });

  it("⚠ NEGATIVE CONTROL — a rung UPGRADE that DROPS the dial's steps is not deferred", () => {
    /* The dial is clamped to the TARGET rung, so moving up off the dial's rung
       drops its steps entirely — the one shape in which an upgrade's allowance
       arithmetic could plausibly come out negative. */
    const quote = quotePlanChange(
      stateAt({ currentCreditUnits: 60, creditItemId: "si_addon" }),
      HIGHER_PLAN as never,
      undefined,
      NOW_SEC,
    );
    expect(quote.targetCreditUnits).toBe(0);
    expect(quote.immediateCharge).toBeGreaterThan(0);
    expect(quote.deferred).toBe(false);
  });

  it("⚠ AND THE LADDER FACT THAT MAKES THE `creditAdjustment` CLAUSE MOOT TODAY — read here so a price change cannot quietly falsify it", () => {
    /* **This arm is a correction to this card's own first draft, kept because
       the correction is the useful part.** `deferred`'s docblock argues that a
       `|| creditAdjustment < 0` clause would be wrong because it could defer a
       change the customer is PAYING MORE for — and the first version of this
       suite asserted that case directly and FAILED: on today's ladder the
       dial's rung at its maximum is STILL below the next rung's allowance
       (measured here), so an upgrade's `creditAdjustment` cannot be negative
       and the clause is unreachable rather than merely wrong.

       Both facts matter and they point the same way. The clause stays out
       because it is wrong in principle; this arm exists because the only thing
       standing between "wrong in principle" and "wrong in practice" is a
       coincidence of two numbers in a price table that has already been
       re-cut twice this month. **If a future ladder makes the dial's rung
       richer than the rung above it, this reddens — and `deferred`'s reasoning
       has to be re-read before the numbers ship.** */
    const dialRungAtMax = quotePlanChange(
      stateAt({ currentCreditUnits: 60, creditItemId: "si_addon" }),
      HIGHER_PLAN as never,
      undefined,
      NOW_SEC,
    );
    expect(dialRungAtMax.creditAdjustment).toBeGreaterThan(0);
  });

  it("an UPGRADE keeps its real figures — the instant road is untouched", () => {
    const quote = quotePlanChange(
      stateAt({ currentPlan: LOWER_PLAN }),
      HIGHER_PLAN as never,
      undefined,
      NOW_SEC,
    );
    expect(quote.deferred).toBe(false);
    expect(quote.proratedAmount).toBeGreaterThan(0);
    expect(quote.immediateCharge).toBe(quote.proratedAmount);
  });
});

describe("2 · the schedule, read off the outgoing calls", () => {
  it("creates ONE schedule from the subscription and adds the target in ONE update", async () => {
    catalogueHolds("monthly");
    const result = await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: LOWER_PLAN,
      interval: "monthly",
      creditUnits: 0,
    });

    expect(result.success).toBe(true);
    expect(schedulesCreate).toHaveBeenCalledTimes(1);
    expect(schedulesCreate.mock.calls[0][0]).toEqual({ from_subscription: "sub_1" });
    expect(sentScheduleUpdate().phases).toHaveLength(2);
    /* ⚠ AND NOTHING WAS WRITTEN TO THE SUBSCRIPTION ITSELF. That is the whole
       of his option 1 at the wire: no price change, no proration, no invoice,
       so no money comes back and there is nothing to keep. */
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("the current phase is echoed with BOTH of its items and its own dates", async () => {
    /* Stripe unsets omitted parameters, so an echo that dropped the dial's
       line would silently cancel the add-on the customer is paying for — for
       the rest of the period she has already been billed for. */
    schedulesCreate.mockResolvedValue(
      mintedSchedule([
        { price: ADDON_PRICE_ID, quantity: 20 },
        { price: BASE_PRICE_ID, quantity: 1 },
      ]),
    );
    catalogueHolds("monthly");

    await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: DIAL_PLAN,
      interval: "monthly",
      creditUnits: 4,
    });

    const [current] = sentScheduleUpdate().phases;
    expect(current.items).toEqual([
      { price: ADDON_PRICE_ID, quantity: 20 },
      { price: BASE_PRICE_ID, quantity: 1 },
    ]);
    expect(current.start_date).toBe(NOW_SEC - 10 * DAY);
    expect(current.end_date).toBe(NOW_SEC + 20 * DAY);
  });

  it("the target phase names the plan and interval in its METADATA — which is why the renewal needs no new code", async () => {
    /* Phase metadata is applied to the subscription when the phase is entered,
       and every read in this product takes the plan off
       `subscription.metadata.plan`. Without this the boundary would pass and
       the live subscription would still name the OLD plan, so the renewal
       grant would hand her the allowance she is leaving. */
    catalogueHolds("monthly");
    await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: LOWER_PLAN,
      interval: "monthly",
      creditUnits: 0,
    });

    const [, target] = sentScheduleUpdate().phases;
    expect(target.metadata.plan).toBe(LOWER_PLAN);
    expect(target.metadata.interval).toBe("monthly");
    expect(target.metadata.userId).toBe("42");
  });

  it("the target phase runs ONE period of the TARGET's cycle and then the schedule lets go", async () => {
    catalogueHolds("annual");
    await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: LOWER_PLAN,
      interval: "annual",
      creditUnits: 0,
    });

    const sent = sentScheduleUpdate();
    expect(sent.end_behavior).toBe("release");
    /* `duration`, not `iterations` — the SDK in this tree has no `iterations`
       on a phase, and the interval is the one being BOUGHT. */
    expect(sent.phases[1].duration).toEqual({ interval: "year", interval_count: 1 });
    expect(sent.phases[1].iterations).toBeUndefined();
  });

  it("the target phase carries the dial as a second item, and ONE item when the dial is at zero", async () => {
    catalogueHolds("monthly");
    await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: DIAL_PLAN,
      interval: "monthly",
      creditUnits: 7,
    });
    expect(sentScheduleUpdate().phases[1].items).toEqual([
      { price: BASE_PRICE_ID },
      { price: ADDON_PRICE_ID, quantity: 7 },
    ]);

    vi.clearAllMocks();
    schedulesCreate.mockResolvedValue(mintedSchedule([{ price: BASE_PRICE_ID, quantity: 1 }]));
    schedulesUpdate.mockResolvedValue({ id: "sub_sched_1", phases: [] });
    catalogueHolds("monthly");
    await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: LOWER_PLAN,
      interval: "monthly",
      creditUnits: 0,
    });
    expect(sentScheduleUpdate().phases[1].items).toEqual([{ price: `price_${LOWER_PLAN}_base` }]);
  });

  it("⚠ a catalogue that cannot price the target refuses BEFORE any schedule exists", async () => {
    /* Resolving after the create would leave the customer attached to a
       one-phase schedule with no target — managed, for nothing — which is
       strictly worse than a refusal. */
    pricesList.mockResolvedValue({ data: [] });

    await expect(
      scheduleSubscriptionChange(stripe, "sub_1", 42, {
        plan: LOWER_PLAN,
        interval: "monthly",
        creditUnits: 0,
      }),
    ).rejects.toThrow();

    expect(schedulesCreate).not.toHaveBeenCalled();
    expect(schedulesUpdate).not.toHaveBeenCalled();
  });

  it("⚠ a failed update RELEASES the schedule again rather than leaving her managed for nothing", async () => {
    catalogueHolds("monthly");
    schedulesUpdate.mockRejectedValue(new Error("stripe said no"));

    const result = await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: LOWER_PLAN,
      interval: "monthly",
      creditUnits: 0,
    });

    expect(result.success).toBe(false);
    expect(schedulesRelease).toHaveBeenCalledWith("sub_sched_1");
  });

  it("a minted schedule with no readable current phase is refused AND released", async () => {
    catalogueHolds("monthly");
    schedulesCreate.mockResolvedValue({ id: "sub_sched_1", status: "active", phases: [] });

    const result = await scheduleSubscriptionChange(stripe, "sub_1", 42, {
      plan: LOWER_PLAN,
      interval: "monthly",
      creditUnits: 0,
    });

    expect(result.success).toBe(false);
    expect(schedulesUpdate).not.toHaveBeenCalled();
    expect(schedulesRelease).toHaveBeenCalledWith("sub_sched_1");
  });
});

describe("3 · release first — one rule, three write paths", () => {
  it("a pending schedule is released, and only THEN is the subscription written", async () => {
    catalogueHolds("monthly");
    subscriptionsRetrieve.mockResolvedValue({
      id: "sub_1",
      schedule: "sub_sched_old",
      items: { data: [{ id: "si_base", price: { recurring: { interval: "month" } } }] },
    });

    const result = await updateSubscriptionPlan(
      "sub_1",
      HIGHER_PLAN as never,
      42,
      "monthly",
      "si_base",
    );

    expect(result.success).toBe(true);
    expect(schedulesRelease).toHaveBeenCalledWith("sub_sched_old");
    /* The ORDER is the contract, not merely that both happened: an update that
       landed first would be a write to a schedule-managed subscription. */
    expect(schedulesRelease.mock.invocationCallOrder[0]).toBeLessThan(
      subscriptionsUpdate.mock.invocationCallOrder[0],
    );
  });

  it("⚠ a FAILED release refuses the plan change, and nothing is sent to Stripe", async () => {
    catalogueHolds("monthly");
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", schedule: "sub_sched_old" });
    schedulesRelease.mockRejectedValue(new Error("network"));

    const result = await updateSubscriptionPlan(
      "sub_1",
      HIGHER_PLAN as never,
      42,
      "monthly",
      "si_base",
    );

    expect(result.success).toBe(false);
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("a cancellation releases the schedule and then cancels — Stripe's own documented order", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", schedule: "sub_sched_old" });

    expect(await cancelSubscription("sub_1")).toBe(true);
    expect(schedulesRelease).toHaveBeenCalledWith("sub_sched_old");
    expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    expect(schedulesRelease.mock.invocationCallOrder[0]).toBeLessThan(
      subscriptionsUpdate.mock.invocationCallOrder[0],
    );
  });

  it("⚠ a cancellation whose release fails is REFUSED rather than attempted", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", schedule: "sub_sched_old" });
    schedulesRelease.mockRejectedValue(new Error("network"));

    expect(await cancelSubscription("sub_1")).toBe(false);
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("nothing pending costs one read and no release — the happy path is not slowed down", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", schedule: null });

    const released = await releaseScheduleBeforeWrite(stripe, "sub_1");

    expect(released.outcome).toBe("nothing-to-release");
    expect(schedulesRelease).not.toHaveBeenCalled();
  });

  it("a schedule that is already gone reads as nothing to release, not as a failure", async () => {
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", schedule: "sub_sched_old" });
    schedulesRelease.mockRejectedValue(
      Object.assign(new Error("This schedule has already been released."), { code: "" }),
    );

    const released = await releaseScheduleBeforeWrite(stripe, "sub_1");

    expect(released.outcome).toBe("nothing-to-release");
  });

  it("⚠ a failure naming `not_started` is a REAL failure — that status is releasable", async () => {
    /*
      `not_started` was in the already-gone list and is the one status that must
      not be: release is documented as available *"if the status is
      `not_started` or `active`"*, and `not_started` is the status every schedule
      this module mints passes through. So the word was turning a real release
      failure on a brand-new schedule into "nothing to release" — and the write
      that follows would then land on a schedule-managed subscription, which is
      the single state this product must not guess about.
    */
    subscriptionsRetrieve.mockResolvedValue({ id: "sub_1", schedule: "sub_sched_1" });
    schedulesRelease.mockRejectedValue(
      Object.assign(new Error("The subscription schedule is not_started, so the request did not apply."), {
        code: "api_error",
      }),
    );

    const released = await releaseScheduleBeforeWrite(stripe, "sub_1");

    expect(released.outcome).toBe("failed");
  });
});

describe("4 · what is pending, read off the schedule", () => {
  it("reports the plan, the interval, the dial and the date", async () => {
    catalogueHolds("monthly");
    schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      status: "active",
      current_phase: { start_date: NOW_SEC - 10 * DAY, end_date: NOW_SEC + 20 * DAY },
      phases: [
        { start_date: NOW_SEC - 10 * DAY, items: [], metadata: {} },
        {
          start_date: NOW_SEC + 20 * DAY,
          /* ⚠ THE BASE LINE CARRIES `quantity: 1`, BECAUSE STRIPE RETURNS ONE
             ON A LICENSED PRICE WHETHER OR NOT WE SENT IT. This fixture used
             to leave it off, which is the one shape Stripe never produces —
             and leaving it off is what hid the defect the arms below are
             about. */
          items: [
            { price: BASE_PRICE_ID, quantity: 1 },
            { price: ADDON_PRICE_ID, quantity: 4 },
          ],
          metadata: { plan: DIAL_PLAN, interval: "monthly" },
        },
      ],
    });

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    expect(read.outcome).toBe("pending");
    if (read.outcome !== "pending") throw new Error("unreachable");
    expect(read.change.plan).toBe(DIAL_PLAN);
    expect(read.change.interval).toBe("monthly");
    expect(read.change.creditUnits).toBe(4);
    expect(read.change.effectiveAt.getTime()).toBe((NOW_SEC + 20 * DAY) * 1000);
  });

  it("⚠ takes the phase that starts AFTER the one in progress, never `phases[1]` by position", async () => {
    /* A schedule that has already advanced carries its COMPLETED phases in the
       same array, so an index would report a change that has already happened
       as still pending — telling a customer her plan is about to drop when it
       dropped a month ago. */
    schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      status: "active",
      current_phase: { start_date: NOW_SEC, end_date: NOW_SEC + 30 * DAY },
      phases: [
        { start_date: NOW_SEC - 60 * DAY, items: [], metadata: { plan: HIGHER_PLAN, interval: "monthly" } },
        { start_date: NOW_SEC, items: [], metadata: { plan: DIAL_PLAN, interval: "monthly" } },
        {
          start_date: NOW_SEC + 30 * DAY,
          items: [],
          metadata: { plan: LOWER_PLAN, interval: "monthly" },
        },
      ],
    });

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    if (read.outcome !== "pending") throw new Error("expected a pending change");
    expect(read.change.plan).toBe(LOWER_PLAN);
    expect(read.change.effectiveAt.getTime()).toBe((NOW_SEC + 30 * DAY) * 1000);
  });

  it("a phase naming a plan this product does not sell reports NOTHING pending", async () => {
    schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      status: "active",
      current_phase: { start_date: NOW_SEC, end_date: NOW_SEC + 30 * DAY },
      phases: [
        { start_date: NOW_SEC, items: [], metadata: {} },
        { start_date: NOW_SEC + 30 * DAY, items: [], metadata: { plan: "legend", interval: "monthly" } },
      ],
    });

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    expect(read.outcome).toBe("none");
  });

  it("⚠ a schedule that could not be READ is `failed`, never `none`", async () => {
    /* Collapsing the two would tell a customer her scheduled downgrade had
       vanished because one API call timed out. */
    schedulesRetrieve.mockRejectedValue(new Error("timeout"));

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    expect(read.outcome).toBe("failed");
  });

  it("a subscription with no schedule answers `none` without asking Stripe anything else", async () => {
    const read = await readPendingPlanChange(stripe, { id: "sub_1", schedule: null } as never);

    expect(read.outcome).toBe("none");
    expect(schedulesRetrieve).not.toHaveBeenCalled();
  });

  it("⚠ A PHASE WITH NO ADD-ON LINE READS THE DIAL AS 0, though Stripe puts a quantity on the plan line", async () => {
    /*
      THE DEFECT THIS ARM IS ABOUT, and it is the commonest decrease the
      product sells: the dial to 0 on the dial's own rung. That schedules a
      LONE plan line — and Stripe returns `quantity: 1` on a licensed price's
      phase item whether or not one was sent. The read used to take the largest
      quantity on the phase, so it answered 1, and the surface then promised
      one extra 5,000-credit step from the renewal date that the invoice would
      never grant.

      The old reading's own arm could not see it, because its fixture left the
      quantity off the base line — a shape Stripe does not produce.
    */
    catalogueHolds("monthly");
    schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      status: "active",
      current_phase: { start_date: NOW_SEC - 10 * DAY, end_date: NOW_SEC + 20 * DAY },
      phases: [
        { start_date: NOW_SEC - 10 * DAY, items: [], metadata: {} },
        {
          start_date: NOW_SEC + 20 * DAY,
          items: [{ price: BASE_PRICE_ID, quantity: 1 }],
          metadata: { plan: DIAL_PLAN, interval: "monthly" },
        },
      ],
    });

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    if (read.outcome !== "pending") throw new Error("expected a pending change");
    expect(read.change.plan).toBe(DIAL_PLAN);
    expect(read.change.creditUnits).toBe(0);
  });

  it("the add-on line is found by its PRICE, so a one-step dial reads 1 — and reads it off the add-on", async () => {
    /*
      The positive control for the arm above, and the reason "the largest
      quantity" cannot simply be replaced by "0 when there is one item": a dial
      at one step is itself `quantity: 1`, so the two readings agree on the
      number and disagree on where it came from. This pins the WHERE — the
      catalogue is asked for the PLAN's own price, which is the derivation the
      repair rests on.
    */
    catalogueHolds("monthly");
    schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      status: "active",
      current_phase: { start_date: NOW_SEC - 10 * DAY, end_date: NOW_SEC + 20 * DAY },
      phases: [
        { start_date: NOW_SEC - 10 * DAY, items: [], metadata: {} },
        {
          start_date: NOW_SEC + 20 * DAY,
          items: [
            { price: BASE_PRICE_ID, quantity: 1 },
            { price: ADDON_PRICE_ID, quantity: 1 },
          ],
          metadata: { plan: DIAL_PLAN, interval: "monthly" },
        },
      ],
    });

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    if (read.outcome !== "pending") throw new Error("expected a pending change");
    expect(read.change.creditUnits).toBe(1);
    expect(pricesList).toHaveBeenCalledWith(
      expect.objectContaining({ lookup_keys: [priceLookupKey(DIAL_PLAN as never, "monthly")] }),
    );
  });

  it("a rung that sells no dial reads 0 without asking the catalogue anything", async () => {
    catalogueHolds("monthly");
    schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      status: "active",
      current_phase: { start_date: NOW_SEC - 10 * DAY, end_date: NOW_SEC + 20 * DAY },
      phases: [
        { start_date: NOW_SEC - 10 * DAY, items: [], metadata: {} },
        {
          start_date: NOW_SEC + 20 * DAY,
          items: [{ price: `price_${LOWER_PLAN}_base`, quantity: 1 }],
          metadata: { plan: LOWER_PLAN, interval: "monthly" },
        },
      ],
    });

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    if (read.outcome !== "pending") throw new Error("expected a pending change");
    expect(read.change.creditUnits).toBe(0);
    expect(pricesList).not.toHaveBeenCalled();
  });

  it("⚠ a catalogue that cannot name the plan's price falls back to the STRUCTURAL floor, never to a guessed step", async () => {
    /* `resolvePriceId` refuses on an absent, ambiguous, wrongly-recurring or
       inconsistently-priced key, and none of those is a reason to tell a
       customer her scheduled dial is a number it is not. A single-item phase
       still reads 0 — the case the old reading got wrong — rather than
       inheriting the plan line's echoed 1. */
    pricesList.mockResolvedValue({ data: [] });
    schedulesRetrieve.mockResolvedValue({
      id: "sub_sched_1",
      status: "active",
      current_phase: { start_date: NOW_SEC - 10 * DAY, end_date: NOW_SEC + 20 * DAY },
      phases: [
        { start_date: NOW_SEC - 10 * DAY, items: [], metadata: {} },
        {
          start_date: NOW_SEC + 20 * DAY,
          items: [{ price: BASE_PRICE_ID, quantity: 1 }],
          metadata: { plan: DIAL_PLAN, interval: "monthly" },
        },
      ],
    });

    const read = await readPendingPlanChange(stripe, {
      id: "sub_1",
      schedule: "sub_sched_1",
    } as never);

    if (read.outcome !== "pending") throw new Error("expected a pending change");
    expect(read.change.creditUnits).toBe(0);
  });
});
