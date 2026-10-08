/**
 * #1965 AND #1987 — DRIVEN AT THE PROCEDURES A CUSTOMER CALLS.
 *
 * `previewPlanChange` and `changePlan` are driven with the REAL
 * `quotePlanChange` (only the Stripe reads and writes are doubled), so these
 * arms prove the arithmetic and the gates on the road a press actually walks:
 *
 *  · **#1965** — both procedures read what is left of the allowance and hand it
 *    to the quote, the preview's "due today" includes the spent share, and
 *    `changePlan` sends that exact charge to `updateSubscriptionPlan`. A
 *    procedure that forgot the read would quote no charge at all — the mint —
 *    so the arm that reddens is the one with the balance spent.
 *  · **#1987** — every subscription state that may not take a change is
 *    refused on BOTH roads (instant and deferred), before anything is written,
 *    and the preview serves the same sentence the press would meet. A plan set
 *    to end by a `cancel_at` date is refused on the deferred road like one set
 *    by the flag.
 *
 * Each refusal block carries its positive control: the same fixture, running,
 * reaches the road it would otherwise have refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatCustomerShortDate } from "@shared/customerDate";

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  getUserCredits: vi.fn(),
}));

vi.mock("../stripe/stripeService", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readSubscriptionBillingState: vi.fn(),
  updateSubscriptionPlan: vi.fn(),
  getInvoiceStatus: vi.fn(),
}));

vi.mock("../stripe/subscriptionSchedule", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  scheduleSubscriptionChange: vi.fn(),
  releaseScheduleBeforeWrite: vi.fn(),
}));

vi.mock("../stripe/planChangeSettlement", () => ({
  queuePlanChangeSettlement: vi.fn(),
  applyPlanChangeSettlement: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "./billing";
import {
  getSubscriptionByUserId,
  getUserById,
  getUserCredits,
  updateUserSubscription,
} from "../db";
import {
  quotePlanChange,
  readSubscriptionBillingState,
  updateSubscriptionPlan,
  type SubscriptionBillingState,
} from "../stripe/stripeService";
import { scheduleSubscriptionChange } from "../stripe/subscriptionSchedule";
import {
  applyPlanChangeSettlement,
  queuePlanChangeSettlement,
} from "../stripe/planChangeSettlement";
import { logAuditEvent } from "../auditLog";
import { PURCHASABLE_PLANS } from "../stripe/stripeProducts";
import { planCreditSliderUnitsAllowed } from "../stripe/planCreditSlider";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

const DAY = 24 * 60 * 60;
/* "Now" is real time inside the procedures, so the period is placed around it. */
const NOW_SEC = Math.floor(Date.now() / 1000);
const PERIOD_START = NOW_SEC - 2 * DAY;
const PERIOD_END = PERIOD_START + 30 * DAY;

/* The rung that carries the dial — derived from the plans a customer can buy,
   never named (card390's rule). */
const DIAL_PLAN = PURCHASABLE_PLANS.find((plan) => planCreditSliderUnitsAllowed(plan) > 0)!;
const DIAL_UNITS = planCreditSliderUnitsAllowed(DIAL_PLAN);

function state(overrides: Partial<SubscriptionBillingState> = {}): SubscriptionBillingState {
  return {
    subscriptionItemId: "si_base",
    currentPlan: DIAL_PLAN,
    currentInterval: "monthly",
    periodStartSec: PERIOD_START,
    periodEndSec: PERIOD_END,
    currentCreditUnits: DIAL_UNITS,
    creditItemId: "si_addon",
    endsAtSec: null,
    status: "active",
    collectionPaused: false,
    ...overrides,
  };
}

/** The plan's part of the balance — `planAllowanceRemaining` is real here. */
function allowanceLeft(ledger: number) {
  vi.mocked(getUserCredits).mockResolvedValue({
    balance: ledger,
    purchasedBalance: 0,
  } as Awaited<ReturnType<typeof getUserCredits>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    planTier: DIAL_PLAN,
  } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
  vi.mocked(readSubscriptionBillingState).mockResolvedValue(state());
  allowanceLeft(100_000_000);
  vi.mocked(updateSubscriptionPlan).mockResolvedValue({
    success: true,
    invoiceId: "in_switch",
    invoiceStatus: "paid",
    invoicedAmount: 1,
  });
  vi.mocked(scheduleSubscriptionChange).mockResolvedValue({
    success: true,
    scheduleId: "sub_sched_1",
    effectiveAt: new Date(PERIOD_END * 1000),
  });
  vi.mocked(updateUserSubscription).mockResolvedValue({ success: true } as never);
  vi.mocked(queuePlanChangeSettlement).mockResolvedValue({ success: true } as never);
  vi.mocked(applyPlanChangeSettlement).mockResolvedValue({
    outcome: "applied",
    creditsMoved: 0,
  } as never);
});

/* ─────────────────────────────── #1965 ─────────────────────────────── */

describe("#1965 — the spent share, through the procedures", () => {
  it("⚠ spent allowance: the preview quotes the charge and changePlan sends exactly that charge", async () => {
    allowanceLeft(0);

    const preview = await caller().previewPlanChange({ newPlan: DIAL_PLAN, interval: "annual" });
    expect(preview.spentShareCharge).toBeGreaterThan(0);
    expect(preview.refusal).toBeNull();
    /* The credits the confirm step names come off the SAME quote (#1965 repair). */
    expect(preview.spentShareCredits).toBe(
      quotePlanChange(state(), DIAL_PLAN, "annual", undefined, undefined, 0).spentShareCredits,
    );
    expect(preview.spentShareCredits).toBeGreaterThan(0);

    const result = await caller().changePlan({ newPlan: DIAL_PLAN, interval: "annual" });
    expect(result.deferred).toBe(false);

    /* The 7th argument is the charge, and it is the quote's — the same figure
       the preview printed, so the confirm and the invoice are one arithmetic. */
    const sent = vi.mocked(updateSubscriptionPlan).mock.calls[0][6];
    expect(sent).toBe(preview.spentShareCharge);
    expect(preview.immediateCharge).toBe(
      quotePlanChange(state(), DIAL_PLAN, "annual", undefined, undefined, 0).immediateCharge,
    );

    /* Nothing is left to take back, so no unwind is queued — and the audit
       row says what was charged instead. */
    expect(queuePlanChangeSettlement).not.toHaveBeenCalled();
    const row = vi.mocked(logAuditEvent).mock.calls.at(-1)?.[0] as Record<string, any>;
    expect(row.metadata.spentShareCharge).toBe(sent);
    expect(row.metadata.spentShareCredits).toBeGreaterThan(0);
  });

  it("NEGATIVE CONTROL — allowance intact: no charge is sent and the full unwind is queued as before", async () => {
    await caller().changePlan({ newPlan: DIAL_PLAN, interval: "annual" });

    const preview = await caller().previewPlanChange({ newPlan: DIAL_PLAN, interval: "annual" });
    expect(preview.spentShareCharge).toBe(0);
    expect(preview.spentShareCredits).toBe(0);
    expect(vi.mocked(updateSubscriptionPlan).mock.calls[0][6]).toBe(0);
    expect(queuePlanChangeSettlement).toHaveBeenCalledTimes(1);
    const queued = vi.mocked(queuePlanChangeSettlement).mock.calls[0][0];
    expect(queued.direction).toBe("unwind");
    expect(queued.credits).toBe(
      quotePlanChange(state(), DIAL_PLAN, "annual").creditUnwind,
    );
  });

  it("⚠ part spent: the queued unwind is ONLY the part still on the balance — never charged for AND taken back", async () => {
    const whole = quotePlanChange(state(), DIAL_PLAN, "annual").creditUnwind;
    const left = Math.floor(whole / 2);
    allowanceLeft(left);

    await caller().changePlan({ newPlan: DIAL_PLAN, interval: "annual" });

    const queued = vi.mocked(queuePlanChangeSettlement).mock.calls[0][0];
    const charged = vi.mocked(updateSubscriptionPlan).mock.calls[0][6] as number;
    expect(queued.credits).toBe(left);
    expect(charged).toBeGreaterThan(0);
    /* If the webhook's year grant lands first, the unwind can no longer be
       floored by a spent balance — so what it may take must already exclude
       what was charged, or she pays twice for the same credits. */
    expect(queued.credits).toBeLessThan(whole);
  });
});

/* ─────────────────────────────── #1987 ─────────────────────────────── */

const REFUSED: Array<[string, Partial<SubscriptionBillingState>, RegExp]> = [
  ["past_due", { status: "past_due" }, /last payment didn't go through/i],
  ["unpaid", { status: "unpaid" }, /last payment didn't go through/i],
  ["paused", { status: "paused" }, /paused/i],
  ["active with collection paused", { collectionPaused: true }, /paused/i],
  ["trialing", { status: "trialing" }, /trial/i],
  ["incomplete", { status: "incomplete" }, /isn't active/i],
  ["canceled", { status: "canceled" }, /isn't active/i],
];

describe("#1987 — states that may not take a change are refused on BOTH roads, before anything is written", () => {
  for (const [name, overrides, sentence] of REFUSED) {
    it(`${name}: the instant road (an increase) is refused`, async () => {
      vi.mocked(readSubscriptionBillingState).mockResolvedValue(state(overrides));

      await expect(caller().changePlan({ newPlan: DIAL_PLAN, interval: "annual" })).rejects.toThrow(
        sentence,
      );
      expect(updateSubscriptionPlan).not.toHaveBeenCalled();
      expect(updateUserSubscription).not.toHaveBeenCalled();
    });

    it(`${name}: the deferred road (a decrease) is refused`, async () => {
      vi.mocked(readSubscriptionBillingState).mockResolvedValue(state(overrides));

      await expect(caller().changePlan({ newPlan: "pro" })).rejects.toThrow(sentence);
      expect(scheduleSubscriptionChange).not.toHaveBeenCalled();
    });

    it(`${name}: the preview serves the same sentence the press would meet`, async () => {
      vi.mocked(readSubscriptionBillingState).mockResolvedValue(state(overrides));

      const preview = await caller().previewPlanChange({ newPlan: "pro" });
      const refusal = await caller()
        .changePlan({ newPlan: "pro" })
        .then(() => null)
        .catch((error: { message: string }) => error.message);
      expect(preview.refusal).toMatch(sentence);
      expect(preview.refusal).toBe(refusal);
      /* The disappearing-technology law on a refusal: what and what to do,
         never the machinery. */
      expect(preview.refusal).not.toMatch(/stripe|status|past_due|incomplete|collection|schedule/i);
    });
  }

  it("POSITIVE CONTROL — an active plan takes both roads and the preview has nothing to refuse", async () => {
    const preview = await caller().previewPlanChange({ newPlan: "pro" });
    expect(preview.refusal).toBeNull();

    await caller().changePlan({ newPlan: DIAL_PLAN, interval: "annual" });
    expect(updateSubscriptionPlan).toHaveBeenCalledTimes(1);

    const decrease = await caller().changePlan({ newPlan: "pro" });
    expect(decrease.deferred).toBe(true);
    expect(scheduleSubscriptionChange).toHaveBeenCalledTimes(1);
  });
});

describe("#1987 — a plan set to end by a `cancel_at` DATE is refused on the deferred road", () => {
  const ENDS = PERIOD_END + 3 * DAY;

  it("⚠ the decrease is refused and names the day Stripe will end it", async () => {
    vi.mocked(readSubscriptionBillingState).mockResolvedValue(state({ endsAtSec: ENDS }));

    const preview = await caller().previewPlanChange({ newPlan: "pro" });
    expect(preview.deferred).toBe(true);
    expect(preview.refusal).toContain(formatCustomerShortDate(new Date(ENDS * 1000)));
    expect(preview.refusal).toMatch(/resume/i);

    await expect(caller().changePlan({ newPlan: "pro" })).rejects.toThrow(preview.refusal!);
    expect(scheduleSubscriptionChange).not.toHaveBeenCalled();
  });

  it("an increase on the same plan is untouched — #1936 scoped this refusal to the deferred road", async () => {
    vi.mocked(readSubscriptionBillingState).mockResolvedValue(state({ endsAtSec: ENDS }));

    const preview = await caller().previewPlanChange({ newPlan: DIAL_PLAN, interval: "annual" });
    expect(preview.refusal).toBeNull();
    await caller().changePlan({ newPlan: DIAL_PLAN, interval: "annual" });
    expect(updateSubscriptionPlan).toHaveBeenCalledTimes(1);
  });

  it("POSITIVE CONTROL — no ending date, and the same decrease is scheduled", async () => {
    const preview = await caller().previewPlanChange({ newPlan: "pro" });
    expect(preview.refusal).toBeNull();
    const result = await caller().changePlan({ newPlan: "pro" });
    expect(result.deferred).toBe(true);
  });
});
