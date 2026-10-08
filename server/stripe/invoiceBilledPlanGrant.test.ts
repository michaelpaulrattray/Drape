/**
 * THE RENEWAL GRANT IS SIZED BY THE PLAN THE INVOICE WAS BILLED FOR, NOT BY
 * THE PLAN THE ACCOUNT IS ON WHEN THE WEBHOOK RUNS (#1930) — driven through
 * the real webhook entry point.
 *
 * #1930 is the #1832 repair's class one field over. That repair moved the
 * credit dial's STEPS off the live subscription and onto the paid invoice's own
 * add-on line; its arms are `server/stripe/planCreditSliderGrant.test.ts`
 * section 4. The PLAN was still read off our own `credits.planTier` row — the
 * row the `subscription.updated` handler writes — so three figures inside a
 * handler whose whole subject is an artifact that already billed were sized by
 * state as it stands now:
 *
 *   · the base allowance        `getMonthlyCredits(planTier) × grantMonths`
 *   · what carries over         `calculateRolloverCredits(balance, planTier)`
 *   · whether the rung has a dial, and where that dial stops
 *
 * ⚠ **THE WINDOW IS DAYS WIDE, NOT SECONDS.** `subscription.updated` and
 * `invoice.payment_succeeded` are separate events with no ordering between
 * them, and Stripe redelivers an unprocessed invoice event for up to ~3 days.
 * A renewal paid on one rung whose plan change lands before the invoice event
 * is processed was granted the OTHER rung's allowance for a period the first
 * one paid for, and `applyPlanChangeSettlement` moves the PRORATION money
 * without re-sizing this grant.
 *
 * ## What each section is for
 *
 *  1 · **the reader**, at both dialect positions and in every shape that means
 *      *nothing to read* — the instrument before its verdicts count (law 2).
 *  2 · **the two artifacts set to DIFFERENT plans**, which is the only shape
 *      that can tell them apart. The arms that would have passed before this
 *      repair are useless here for the same reason section 4 of the slider
 *      suite exists: the figure they assert comes from the very read the
 *      defect is about.
 *  3 · **an unreadable plan takes exactly the old road** — the negative
 *      control, and the one that matters most in production, where every
 *      invoice this product has ever received is this case.
 *  4 · **the `free` row still gates the handler**, which is a decision rather
 *      than a leftover and is argued at the code.
 *
 * The harness is `planCreditSliderGrant.test.ts`'s. Two deliberate
 * differences: `getMonthlyCredits` carries the REAL plan table's figures so
 * the sums are real sums, and `calculateRolloverCredits` is a spy whose
 * ARGUMENT is asserted rather than its result — the question this card asks of
 * the rollover is *whose percentage*, not what a percentage computes to, and
 * re-deriving the arithmetic here would make the arm about this file.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: async () => undefined }),
    delete: () => ({ where: async () => undefined }),
  })),
}));

const { refreshMonthlyCredits, planTierOnRecord } = vi.hoisted(() => ({
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 1 }),
  planTierOnRecord: { value: "studio" },
}));

vi.mock("../db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  getUserByStripeCustomerId: vi.fn().mockImplementation(async () => ({
    id: 11,
    name: "a subscriber whose plan changed mid-window",
    email: "eleven@example.com",
    credits: { planTier: planTierOnRecord.value, balance: 4_000 },
  })),
  refreshMonthlyCredits,
  getUserCredits: vi.fn(),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addTopupCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(false),
  recordPlanChangeSettlement: vi.fn().mockResolvedValue({ success: true }),
  getPlanChangeSettlementByInvoice: vi.fn().mockResolvedValue(null),
  resolvePlanChangeSettlement: vi.fn().mockResolvedValue(true),
  appendChangeRequestReviewNote: vi.fn().mockResolvedValue(true),
}));

const { readSubscriptionBillingState, planCreditsAddonPriceId, calculateRolloverCredits } =
  vi.hoisted(() => ({
    planCreditsAddonPriceId: vi.fn(),
    readSubscriptionBillingState: vi.fn(),
    calculateRolloverCredits: vi.fn().mockReturnValue(0),
  }));

vi.mock("./stripeService", async () => {
  /* The REAL plan table's allowances, because the figure being asserted is
     `PLAN_TIERS[rung].monthlyCredits` and a fixture base would make the arm
     about this file's own arithmetic rather than about which rung was read. */
  const { PLAN_TIERS } = await import("../../drizzle/schema");
  const allowanceOf = PLAN_TIERS as Record<string, { monthlyCredits: number }>;
  return {
    constructWebhookEvent: vi.fn(),
    mapStripeStatus: vi.fn().mockReturnValue("active"),
    mapPlanToTier: vi.fn().mockReturnValue("studio"),
    calculateRolloverCredits,
    getMonthlyCredits: vi.fn((tier: string) => allowanceOf[tier].monthlyCredits),
    cancelSubscription: vi.fn().mockResolvedValue(true),
    voidInvoice: vi.fn().mockResolvedValue(true),
    retrieveLiveSubscription: vi.fn(),
    subscriptionItemsOf: vi.fn(() => ({ base: null, addon: null })),
    readSubscriptionBillingState,
    planCreditsAddonPriceId,
    REFUND_METADATA_USER_KEY: "userId",
    REFUND_METADATA_CHANGE_REQUEST_KEY: "changeRequestId",
  };
});

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { invoiceSubscriptionMetadata } from "./invoiceLines";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { planCreditSliderLedgerCredits } from "@shared/planCreditSlider";
import { PLAN_CREDIT_SLIDER_PLAN, planCreditSliderUnitsAllowed } from "./planCreditSlider";
import { SELF_SERVE_PLAN_ORDER } from "./stripeProducts";

/* ── THE TWO RUNGS THIS SUITE PLAYS OFF EACH OTHER, BOTH DERIVED ────────────
   Typed as `"studio"` and `"pro"` these would be two string literals on a
   money surface that his own rename week has already moved once (#1900), and
   the ladder's shape is a thing #1832 derives everywhere else. So: the dial's
   rung, and the dearest paid rung that has no dial. */
const DIAL_PLAN = (() => {
  if (PLAN_CREDIT_SLIDER_PLAN === null) {
    throw new Error("no rung carries the dial, so half this suite would assert nothing");
  }
  return PLAN_CREDIT_SLIDER_PLAN as PlanTier;
})();

/**
 * ⚠ **THE RUNG BELOW THE DIAL, AND IT IS READ OFF THE SELF-SERVE LADDER
 * RATHER THAN OFF EVERY PAID RUNG.** The first derivation here took the
 * dearest paid rung with no dial, which resolves to the HIDDEN hand-sold one
 * (`HIDDEN_PLAN_TIERS`) — dearer than the dial's rung, so every arm's prose
 * about an upgrade or a downgrade said the opposite of what its fixture did.
 * The contrast this suite wants is the one the card describes: the rung a
 * customer walks up FROM.
 */
const PLAIN_PLAN = (() => {
  const found = SELF_SERVE_PLAN_ORDER.filter(
    (tier) => PLAN_TIERS[tier].price > 0 && planCreditSliderUnitsAllowed(tier) === 0,
  ).reduce<PlanTier | null>(
    (dearest, tier) =>
      dearest === null || PLAN_TIERS[tier].price > PLAN_TIERS[dearest].price ? tier : dearest,
    null,
  );
  if (found === null) throw new Error("every paid rung carries a dial — this suite cannot contrast");
  return found;
})();

/* The ladder's direction, asserted rather than described: the arms below say
   "upgraded" and "downgraded" in their own prose, and a ladder edit that put
   the dial on a cheaper rung would leave every one of those sentences lying
   while the assertions went on passing. */
if (PLAN_TIERS[PLAIN_PLAN].price >= PLAN_TIERS[DIAL_PLAN].price) {
  throw new Error(
    `${PLAIN_PLAN} is not below ${DIAL_PLAN} on the ladder, so this suite's upgrade/downgrade prose is false`,
  );
}

/* The arms below can only tell the two artifacts apart if the two rungs grant
   different amounts. Asserted rather than assumed, because a ladder edit that
   made them equal would leave every arm in section 2 passing while proving
   nothing. */
if (PLAN_TIERS[DIAL_PLAN].monthlyCredits === PLAN_TIERS[PLAIN_PLAN].monthlyCredits) {
  throw new Error(
    `${DIAL_PLAN} and ${PLAIN_PLAN} grant the same allowance, so this suite cannot tell which rung was read`,
  );
}

const DAY_S = 86_400;
const T = 1_788_900_000;
let eventSeq = 0;

function deliver(invoice: Record<string, unknown>) {
  eventSeq += 1;
  vi.mocked(constructWebhookEvent).mockReturnValue({
    id: `evt_billed_plan_${eventSeq}`,
    type: "invoice.payment_succeeded",
    data: { object: invoice },
    object: "event",
    api_version: "2026-01-28.clover",
    created: T,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event);
  return handleStripeWebhook("payload", "sig");
}

const BASE_PRICE_ID = "price_base_rung";
const ADDON_PRICE_ID = "price_addon_credits";

/** The clover line shape production actually delivers. */
const cloverLine = (days: number, priceId: string, quantity: number) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
  period: { start: T, end: T + days * DAY_S },
  pricing: { type: "price_details", price_details: { price: priceId, product: "prod_1" } },
  quantity,
});

/** A line carrying no price identity at all — the add-on reading is UNKNOWN. */
const anonymousLine = (days: number) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
  period: { start: T, end: T + days * DAY_S },
});

/**
 * A paid renewal. `billedPlan` is what Stripe froze onto the invoice when it
 * finalized it; `steps` adds the dial's own add-on line when given.
 */
function renewal(opts: {
  days?: number;
  billedPlan?: string | null;
  subscriptionMetadata?: Record<string, unknown> | null;
  steps?: number;
}) {
  const days = opts.days ?? 30;
  const metadata =
    opts.subscriptionMetadata !== undefined
      ? opts.subscriptionMetadata
      : opts.billedPlan === null || opts.billedPlan === undefined
        ? null
        : { userId: "11", plan: opts.billedPlan, interval: days >= 300 ? "annual" : "monthly" };
  return {
    id: `in_${eventSeq + 1}`,
    customer: "cus_1",
    billing_reason: "subscription_cycle",
    parent: {
      subscription_details: { subscription: "sub_1", ...(metadata === null ? {} : { metadata }) },
    },
    lines: {
      data:
        opts.steps === undefined
          ? [cloverLine(days, BASE_PRICE_ID, 1)]
          : [cloverLine(days, BASE_PRICE_ID, 1), cloverLine(days, ADDON_PRICE_ID, opts.steps)],
    },
    metadata: { env: "local" },
  };
}

/** The grant figure the handler actually asked for. */
function grantedCredits(): number {
  expect(refreshMonthlyCredits, "no grant was made at all").toHaveBeenCalledTimes(1);
  return refreshMonthlyCredits.mock.calls[0][1] as number;
}

/**
 * The rung the handler's rollover RULE asks about.
 *
 * `refreshMonthlyCredits` is mocked, so the closure it was handed is never
 * run — which is the whole design of that argument (#664 review round 2: the
 * rule is passed, not a number, so it computes from the balance its own
 * compare-and-set is conditioned on). Driving it here is what turns "a rule
 * was passed" into "the rule names this rung".
 */
function rolloverAskedAbout(): string {
  const rule = refreshMonthlyCredits.mock.calls[0][2] as (balance: number) => number;
  calculateRolloverCredits.mockClear();
  rule(1_000);
  expect(calculateRolloverCredits, "the rollover rule consulted no plan at all").toHaveBeenCalledTimes(
    1,
  );
  return calculateRolloverCredits.mock.calls[0][1] as string;
}

/** A live subscription read answering `steps` on the dial. */
function subscriptionAt(steps: number, plan: PlanTier = DIAL_PLAN) {
  readSubscriptionBillingState.mockResolvedValue({
    subscriptionItemId: "si_base",
    currentPlan: plan,
    currentInterval: "monthly",
    periodStartSec: T,
    periodEndSec: T + 30 * DAY_S,
    currentCreditUnits: steps,
    creditItemId: steps > 0 ? "si_addon" : null,
  });
}

const allowanceOf = (plan: PlanTier, months = 1) => PLAN_TIERS[plan].monthlyCredits * months;

beforeEach(() => {
  vi.clearAllMocks();
  refreshMonthlyCredits.mockResolvedValue({ success: true, newBalance: 1 });
  calculateRolloverCredits.mockReturnValue(0);
  planCreditsAddonPriceId.mockResolvedValue(ADDON_PRICE_ID);
  planTierOnRecord.value = DIAL_PLAN;
});

describe("1 · the reader, before its verdicts count", () => {
  it("reads the snapshot at the clover position — the dialect production receives", () => {
    expect(
      invoiceSubscriptionMetadata({
        parent: { subscription_details: { subscription: "sub_1", metadata: { plan: "pro" } } },
      }),
    ).toEqual({ plan: "pro" });
  });

  it("reads it at the pre-Basil top-level position too", () => {
    expect(
      invoiceSubscriptionMetadata({ subscription_details: { metadata: { plan: "starter" } } }),
    ).toEqual({ plan: "starter" });
  });

  it("⚠ NEGATIVE CONTROL: an invoice with no snapshot anywhere answers null", () => {
    expect(
      invoiceSubscriptionMetadata({
        parent: { subscription_details: { subscription: "sub_1" } },
      }),
    ).toBeNull();
  });

  it("⚠ an explicit `metadata: null` is null and not an empty record", () => {
    /* Stripe's own type is `Stripe.Metadata | null`, and a caller that read a
       null as `{}` would be asking a record for a key it can never hold — the
       same answer, reached without noticing the field was absent. */
    expect(
      invoiceSubscriptionMetadata({
        parent: { subscription_details: { subscription: "sub_1", metadata: null } },
      }),
    ).toBeNull();
  });

  it("a non-object in the field is null, not a crash", () => {
    expect(invoiceSubscriptionMetadata({ subscription_details: { metadata: "plan=pro" } })).toBeNull();
    expect(invoiceSubscriptionMetadata(null)).toBeNull();
    expect(invoiceSubscriptionMetadata({})).toBeNull();
  });
});

describe("2 · the invoice and our own row name DIFFERENT plans", () => {
  it("⚠ THE CARD'S OWN EXAMPLE: billed on the plain rung, upgraded to the dial's before the event ran", async () => {
    /* The over-grant. Before this repair the handler read the row, found the
       dial's rung, and granted its whole monthly allowance for a period the
       cheaper rung paid for. */
    planTierOnRecord.value = DIAL_PLAN;
    subscriptionAt(0);
    const result = await deliver(renewal({ billedPlan: PLAIN_PLAN }));
    expect(result.success).toBe(true);
    expect(grantedCredits(), "the grant followed our own row instead of the bill").toBe(
      allowanceOf(PLAIN_PLAN),
    );
  });

  it("⚠ THE MIRROR, AND IT IS THE WORSE ONE: billed on the dial's rung WITH steps, downgraded before the event ran", async () => {
    /*
      Two figures were wrong at once here, which is why this arm is the one to
      keep. The row said the plain rung, so (a) the base allowance was the
      plain rung's, and (b) `planCreditSliderUnitsAllowed` answered 0 — so the
      add-on line on the customer's own invoice was never even read, and the
      forty steps they had just paid for were granted as nothing.
    */
    planTierOnRecord.value = PLAIN_PLAN;
    subscriptionAt(0, PLAIN_PLAN);
    const steps = 40;
    const result = await deliver(renewal({ billedPlan: DIAL_PLAN, steps }));
    expect(result.success).toBe(true);
    expect(grantedCredits()).toBe(
      allowanceOf(DIAL_PLAN) + planCreditSliderLedgerCredits(steps),
    );
  });

  it("⚠ the rollover rule is asked about the BILLED rung, not the row's", async () => {
    /* `calculateRolloverCredits` decides what share of the old balance
       survives, and the share is a plan FEATURE — 50% on the cheapest rung,
       100% at the top. Asked about the wrong rung it forfeits paid-for credits
       in one direction and invents them in the other. */
    planTierOnRecord.value = DIAL_PLAN;
    subscriptionAt(0);
    await deliver(renewal({ billedPlan: PLAIN_PLAN }));
    expect(rolloverAskedAbout()).toBe(PLAIN_PLAN);
  });

  it("⚠ a YEAR bought multiplies the BILLED rung's allowance, twelve times over", async () => {
    planTierOnRecord.value = DIAL_PLAN;
    subscriptionAt(0);
    await deliver(renewal({ days: 365, billedPlan: PLAIN_PLAN }));
    expect(grantedCredits()).toBe(allowanceOf(PLAIN_PLAN, 12));
  });

  it("a billed plan that AGREES with the row grants the same figure it always did", async () => {
    /* The control for the whole section: the repair must be invisible on every
       invoice nobody changed a plan under, which is all of them so far. */
    planTierOnRecord.value = DIAL_PLAN;
    subscriptionAt(0);
    await deliver(renewal({ billedPlan: DIAL_PLAN, steps: 3 }));
    expect(grantedCredits()).toBe(allowanceOf(DIAL_PLAN) + planCreditSliderLedgerCredits(3));
  });

  it("⚠ the plain rung billed makes NO subscription round trip, whatever the row says", async () => {
    /* A rung with no dial reads no live state at all — #1832's own third
       decision, and it is the row that used to decide which rung that was. */
    planTierOnRecord.value = DIAL_PLAN;
    subscriptionAt(0);
    await deliver(renewal({ billedPlan: PLAIN_PLAN }));
    expect(readSubscriptionBillingState).not.toHaveBeenCalled();
    expect(planCreditsAddonPriceId).not.toHaveBeenCalled();
  });
});

describe("3 · an unreadable plan takes exactly the road it took before", () => {
  it("⚠ THE PRODUCTION CASE: no snapshot on the invoice, so our own row sizes it", async () => {
    /* Every invoice this product has received is this arm. A repair that
       refused here, or read a zero, would break the ordinary renewal to fix
       the rare one. */
    planTierOnRecord.value = PLAIN_PLAN;
    const result = await deliver(renewal({ billedPlan: null }));
    expect(result.success).toBe(true);
    expect(grantedCredits()).toBe(allowanceOf(PLAIN_PLAN));
    expect(rolloverAskedAbout()).toBe(PLAIN_PLAN);
  });

  it("a snapshot with no `plan` key falls back to the row", async () => {
    planTierOnRecord.value = PLAIN_PLAN;
    await deliver(renewal({ subscriptionMetadata: { userId: "11", interval: "monthly" } }));
    expect(grantedCredits()).toBe(allowanceOf(PLAIN_PLAN));
  });

  it("⚠ a plan the product no longer declares is an UNKNOWN, never a tier", async () => {
    /* The `planTier` column deliberately still accepts four folded legacy
       values (`ownPlanFacts`), and `getMonthlyCredits` would throw on one —
       a TypeError naming nothing, on a paid invoice. */
    planTierOnRecord.value = PLAIN_PLAN;
    const result = await deliver(renewal({ billedPlan: "creator_legacy" }));
    expect(result.success).toBe(true);
    expect(grantedCredits()).toBe(allowanceOf(PLAIN_PLAN));
  });

  it("⚠ a snapshot naming `free` is an unknown too — a paid period is never sized at nothing", async () => {
    planTierOnRecord.value = PLAIN_PLAN;
    await deliver(renewal({ billedPlan: "free" }));
    expect(grantedCredits()).toBe(allowanceOf(PLAIN_PLAN));
  });

  it("an empty plan string is an unknown", async () => {
    planTierOnRecord.value = PLAIN_PLAN;
    await deliver(renewal({ billedPlan: "" }));
    expect(grantedCredits()).toBe(allowanceOf(PLAIN_PLAN));
  });

  it("the dial's UNKNOWN road is untouched: an unidentifiable line still reads the subscription", async () => {
    /* The two unknowns are independent. The PLAN is readable off the snapshot
       and the STEPS are not readable off the lines, so the one falls back and
       the other does not. */
    planTierOnRecord.value = PLAIN_PLAN;
    subscriptionAt(9);
    await deliver({
      id: `in_${eventSeq + 1}`,
      customer: "cus_1",
      billing_reason: "subscription_cycle",
      parent: {
        subscription_details: {
          subscription: "sub_1",
          metadata: { userId: "11", plan: DIAL_PLAN },
        },
      },
      lines: { data: [anonymousLine(30)] },
      metadata: { env: "local" },
    });
    expect(readSubscriptionBillingState).toHaveBeenCalledTimes(1);
    expect(grantedCredits()).toBe(allowanceOf(DIAL_PLAN) + planCreditSliderLedgerCredits(9));
  });
});

describe("4 · the `free` row still gates the handler, and that is a decision", () => {
  it("⚠ a free row grants nothing even when the invoice names a paid plan", async () => {
    /*
      `subscription.deleted` writes `free`, so this is a subscription this
      product has already ended — and a renewal invoice redelivered after that
      cancellation must not resurrect a grant on the strength of the plan it
      names. Whether such an invoice SHOULD grant is a different question about
      a cancelled account and nobody has asked it; what this arm pins is that
      #1930's repair did not answer it by accident.
    */
    planTierOnRecord.value = "free";
    const result = await deliver(renewal({ billedPlan: DIAL_PLAN, steps: 5 }));
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/free tier/i);
    expect(refreshMonthlyCredits).not.toHaveBeenCalled();
  });
});

/**
 * 5 · THE SETTLEMENT WINDOW THE GRANT IS SIZED AGAINST (#1937).
 *
 * The same handler and the same window as section 2, one money figure
 * further on. #1930 asked *whose allowance* — this asks *what counts as last
 * period's leftover*, and the artifact is again the invoice rather than the
 * state as it stands now.
 *
 * `applyPlanChangeSettlement` moves its credits into the plan's part of the
 * balance, so the renewal's rollover percentage is applied to them. For a
 * change made inside the period being granted — Stripe having already
 * advanced the subscription — that hands back a quarter of a proration the
 * customer paid for on Pro, and half on Starter.
 *
 * ⚠ **WHAT THESE ARMS PIN IS THE HANDLER'S HALF, WHICH IS WHICH DATE GOES
 * DOWN.** The netting arithmetic, the reader and both money directions are
 * `server/renewalSettlementNetting.test.ts`, driven against the real
 * compare-and-set loop. Asserting a balance here would be asserting a mock's
 * return value: `refreshMonthlyCredits` is a spy in this harness, which is
 * exactly why it can show what it was ASKED.
 */
describe("5 · the settlement window — the invoice says when its period began", () => {
  /** The sixth argument: when the period this grant is for began, or null. */
  function settlementWindowAsked(): Date | null {
    expect(refreshMonthlyCredits, "no grant was made at all").toHaveBeenCalledTimes(1);
    return refreshMonthlyCredits.mock.calls[0][5] as Date | null;
  }

  it("⚠ the window is the BOUGHT line's own period start, to the second", async () => {
    await deliver(renewal({ billedPlan: "pro" }));
    const asked = settlementWindowAsked();
    expect(asked).toBeInstanceOf(Date);
    /* `T` is the period start the fixture's line declares; the handler must
       hand down that instant and not "now", which is what every naive
       reading of "this period" turns into. */
    expect(asked!.getTime()).toBe(T * 1000);
  });

  it("⚠ an UNREADABLE period start takes the old road — null, never an epoch", async () => {
    /*
      THE ARM THAT MATTERS MOST IN PRODUCTION, and it is the #1930 clause's
      sibling: a line with no readable period is the shape whose months are
      already a fallback guess. `0` would be 1970 and would net out every
      settlement the account has ever had; `Date.now()` would net out none and
      lie about why. Null says the invoice could not answer, and the grant is
      computed exactly as it was before this card.
    */
    await deliver({
      id: "in_noperiod",
      customer: "cus_1",
      billing_reason: "subscription_cycle",
      parent: {
        subscription_details: {
          subscription: "sub_1",
          metadata: { userId: "11", plan: "pro", interval: "monthly" },
        },
      },
      lines: {
        data: [
          {
            parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
            price: { recurring: { interval: "month" } },
            period: { start: null, end: null },
          },
        ],
      },
      metadata: { env: "local" },
    });
    expect(settlementWindowAsked()).toBeNull();
  });

  it("an annual invoice hands down its own start, not a month ago", async () => {
    /* A yearly line spans 365 days, so the window a naive "one month back"
       would compute sits eleven months inside the period it is meant to open
       — and would roll a proration bought in month two. */
    await deliver(renewal({ billedPlan: "pro", days: 365 }));
    expect(settlementWindowAsked()!.getTime()).toBe(T * 1000);
  });
});
