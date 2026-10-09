/**
 * #1940 + #1952 — THE MONEY WORDING HE APPROVED, ASSERTED WHERE A CUSTOMER
 * READS IT.
 *
 * His words, 2026-10-08 (terminal): #1940 *"on 1 and 2 go with your
 * reccomendations"* (Yuna's in-app money wording, B13–B28); #1952 *"yes"*
 * (customer pricing wording, cancel version A).
 *
 * ⚠ **EVERY ARM DRIVES THE REAL PATH, NOT A CONSTANT COMPARED TO ITSELF.**
 *   · the cancel receipt is read off `billing.cancelSubscription` itself,
 *     through the real router, with the period end the ROW holds;
 *   · the refund sentence is read off `withAtomicCredits`'s thrown error —
 *     the wire a failed generation actually answers on;
 *   · the failed-view line is composed from `ViewTabs`' own expression, read
 *     off the tree, so a surface that stops trimming the reason's stop goes red.
 * Each has a control that fails the way the defect would.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatCustomerShortDate } from "@shared/customerDate";

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSubscriptionByUserId: vi.fn(),
}));

vi.mock("../stripe/stripeService", () => ({
  stripe: {},
  getOrCreateStripeCustomer: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  createTopupCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  getSubscriptionDetails: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  readSubscriptionBillingState: vi.fn(),
  quotePlanChange: vi.fn(),
  updateSubscriptionPlan: vi.fn(),
  getInvoiceStatus: vi.fn(),
  getCustomerInvoices: vi.fn(),
  getAllCustomerInvoices: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "./billing";
import { getSubscriptionByUserId } from "../db";
import { cancelSubscription } from "../stripe/stripeService";
import {
  ANNUAL_CHARGE_SENTENCE,
  YEARLY_SWITCH_ALLOWANCE_SENTENCE,
  CANCEL_ANY_TIME_SHORT,
  CANCELLED_PLAN_GRACE_DAYS,
  RENEWAL_BALANCE_SENTENCE,
  cancelPlanBody,
  cancelledPlanSegment,
  planCancelledReceipt,
} from "@shared/planCancelCopy";
import { bareReason, creditsReturnedText, joinSentences, refundOutcomeText } from "@shared/refundCopy";
import { displayRefund, formatCredits } from "@shared/creditDisplay";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);
const PERIOD_END = new Date(Date.UTC(2026, 10, 7, 12));

function subscriptionRow(currentPeriodEnd: Date | null) {
  vi.mocked(getSubscriptionByUserId).mockResolvedValue({
    stripeSubscriptionId: "sub_1",
    planTier: "pro",
    currentPeriodEnd,
  } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cancelSubscription).mockResolvedValue(true);
});

describe("#1940 B25 — the cancel receipt, read off the procedure", () => {
  it("names the date the plan stays active until, from the row", async () => {
    subscriptionRow(PERIOD_END);
    const result = await caller().cancelSubscription();
    expect(result.message).toBe(
      `Your plan is cancelled. It stays active until ${formatCustomerShortDate(PERIOD_END)}, and you won't be charged again.`,
    );
    expect(result.message).not.toContain("canceled at the end of the billing period");
  });

  it("CONTROL — no date on the row is never a guessed date", async () => {
    subscriptionRow(null);
    const result = await caller().cancelSubscription();
    expect(result.message).toBe(
      "Your plan is cancelled. It stays active until the end of the period you've paid for, and you won't be charged again.",
    );
  });

  it("CONTROL — a cancel Stripe did not take says nothing of the kind", async () => {
    subscriptionRow(PERIOD_END);
    vi.mocked(cancelSubscription).mockResolvedValue(false);
    await expect(caller().cancelSubscription()).rejects.toThrow("Failed to cancel subscription.");
  });
});

describe("#1940 B24/B26 — the dialog and the Billing line", () => {
  it("the dialog's body states the date, that nothing more is charged, and the 30 days the plan's credits keep (#2152)", () => {
    /* #2152 (his word 2026-10-09, Yuna's final wording): the old last sentence
       — "Your credits stay on your balance." — stopped being true the day the
       30-day expiry shipped, and it changed in the same change as the code. */
    const on = formatCustomerShortDate(PERIOD_END);
    expect(cancelPlanBody(PERIOD_END)).toBe(
      `Your plan stays active until ${on}. After that you won't be charged again and your account moves to Free. You'll have 30 days to use your plan credits. Top-ups stay on your balance.`,
    );
    // superjson can hand the client a string; both shapes read the same day.
    expect(cancelPlanBody(PERIOD_END.toISOString())).toBe(cancelPlanBody(PERIOD_END));
    // The no-date form keeps its own clause and takes the same last two sentences.
    expect(cancelPlanBody(null)).toBe(
      "Your plan stays active until the end of the period you've paid for. After that you won't be charged again and your account moves to Free. You'll have 30 days to use your plan credits. Top-ups stay on your balance.",
    );
    expect(cancelPlanBody("not a date")).not.toContain("Invalid");
    expect(cancelPlanBody(PERIOD_END)).not.toContain("Your credits stay on your balance");
  });

  it("#2152 — the plans page's renewal and cancel lines say the cap and the 30 days, in Yuna's words", () => {
    expect(CANCEL_ANY_TIME_SHORT).toBe(
      "Cancel any time. You'll have 30 days to use your plan credits after your paid period ends.",
    );
    expect(RENEWAL_BALANCE_SENTENCE).toBe(
      "Unused plan credits carry into next month, up to one month's worth. If you cancel, you have 30 days to use them. Top-ups stay on your balance.",
    );
  });

  it("#2152 (CPM:2268) — a yearly price says it is charged once a year AND that the credits arrive each month", () => {
    /* His ruling on #2159, 2026-10-10: "yearly credits apply month by month". */
    expect(ANNUAL_CHARGE_SENTENCE).toBe("Annual plans are charged once a year. Your credits arrive each month.");
    const modal = read("client/src/features/billing/ChangePlanModal.tsx");
    expect(modal).toContain('{interval === "annual" ? ` ${ANNUAL_CHARGE_SENTENCE}` : ""}');
    expect(modal).not.toContain('" Annual plans are charged once a year."');
  });

  it("#2152 — nothing promises the full year of credits up front any more, on the confirm step or the receipt", () => {
    expect(YEARLY_SWITCH_ALLOWANCE_SENTENCE).toContain("first month of credits");
    expect(YEARLY_SWITCH_ALLOWANCE_SENTENCE).toContain("your credits arrive each month after that");
    for (const file of ["client/src/features/billing/ChangePlanModal.tsx", "server/routes/billing.ts"]) {
      const source = read(file);
      expect(source, file).not.toContain("full year of credits");
      expect(source, file).toContain("${YEARLY_SWITCH_ALLOWANCE_SENTENCE}");
    }
  });

  it("#2152 — the 30 in every sentence IS the deadline the server stamps (derived, not mirrored)", () => {
    expect(CANCELLED_PLAN_GRACE_DAYS).toBe(30);
    const webhook = read("server/billing/planCreditsExpiry.ts");
    expect(webhook).toContain('import { CANCELLED_PLAN_GRACE_DAYS } from "@shared/planCancelCopy";');
    expect(webhook).toContain("CANCELLED_PLAN_GRACE_DAYS * DAY_MS");
  });

  it("Billing says ends {date} · won't renew, never renews", () => {
    expect(cancelledPlanSegment(PERIOD_END)).toBe(`ends ${formatCustomerShortDate(PERIOD_END)} · won't renew`);
    expect(cancelledPlanSegment(null)).toBe("won't renew");
  });

  it("the surfaces read these, and the old labels are gone", () => {
    const modal = read("client/src/features/billing/ChangePlanModal.tsx");
    expect(modal).toContain('title="Cancel your plan?"');
    expect(modal).toContain("body={cancelPlanBody(status?.currentPeriodEnd ?? null)}");
    expect(modal).toContain('confirmLabel="Cancel plan"');
    expect(modal).toContain('cancelLabel="Keep plan"');
    expect(modal).not.toMatch(/>\s*Drop to Free\s*</);
    expect(modal).not.toContain('confirmLabel="Drop to Free"');
    // The Billing tab must re-read the cancelled state after the press.
    expect(modal).toContain("utils.billing.getSubscriptionDetails.invalidate()");

    const billing = read("client/src/features/settings/sections/BillingSection.tsx");
    expect(billing).toMatch(
      /subscriptionDetails\?\.cancelAtPeriodEnd === true\s*\?\s*cancelledPlanSegment\(renewsAt\)/,
    );
  });
});

describe("#1940 B13/B14/B17 — one sentence for credits that came back", () => {
  it("says {N} credits returned, on the display scale", () => {
    expect(creditsReturnedText(350)).toBe(`${formatCredits(displayRefund(350))} credits returned.`);
    expect(refundOutcomeText({ refunded: 350 })).toBe(creditsReturnedText(350));
  });

  it("CONTROL — a refund that did not record never says returned", () => {
    expect(refundOutcomeText({ refunded: 0 })).not.toContain("returned");
    expect(refundOutcomeText({ refunded: 0, refundReference: "refund:x" })).toContain("quote refund:x");
  });

  it("no customer-facing sentence on the touched roads still says refunded", () => {
    /* The class, swept by name across the roads this card rewrote. A sentence
       in a comment is history; a string literal is what ships. */
    const literal = /["'`][^"'`\n]*(credits (were )?refunded|you weren't charged|credits are back)[^"'`\n]*["'`]/i;
    for (const file of [
      "shared/refundCopy.ts",
      "server/casting/atomicCredits.ts",
      "server/casting/operationRecovery.ts",
      "server/castingV2/retryService.ts",
      "server/castingV2/rollService.ts",
      "server/castingV2/refineRecovery.ts",
      "server/castingV2/retryRecovery.ts",
      "server/castingV2/viewRetryRecovery.ts",
      "client/src/pages/CastingRoom.tsx",
      "client/src/pages/CastingSheet.tsx",
      "client/src/features/castingV2/cancelNotice.ts",
    ]) {
      const code = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((line) => !/^\s*\/\//.test(line))
        .join("\n");
      expect(code, file).not.toMatch(literal);
    }
  });
});

describe("#1940 B18 — the failed view's line, composed the way ViewTabs composes it", () => {
  const source = read("client/src/features/casting/components/ImageViewer/ViewTabs.tsx");
  /*
    ⚠ **THE SURFACE JOINS NOW INSTEAD OF INTERPOLATING — #1968.** It read one
    template literal, `"${label}: ${bareReason(failure.reason)}. "` followed by
    the money half. A refused view on a signed package refunds nothing, so that
    half can be the empty string and interpolating it would leave a double
    space; the two parts go through `joinSentences` instead. Both are still read
    out of the real component, which is the whole point of this arm — a quoted
    composition is a mirror (working law 4) and this is what catches it moving.
  */
  const REASON_PART = "`${label}: ${bareReason(failure.reason)}.`";
  const MONEY_PART = "refundOutcomeText(failure)";

  it("the surface still composes the line this arm models", () => {
    expect(source).toContain(REASON_PART);
    expect(source).toContain(MONEY_PART);
    expect(source, "the join is what lets the money half be empty").toContain("joinSentences(");
    // One verb, Try again, everywhere — the failed slot's default action.
    expect(source).toContain("action = 'Try again'");
    expect(source).not.toContain("action = 'Retry'");
  });

  /*
    A REFUNDED fixture on purpose: this arm is about the STOP between the reason
    and the money, so it needs a money half to put a stop in front of. The
    refresh and mint roads still refund per slot, so a line with both halves is
    still a line the product composes — and the empty-half case is held in
    `packageOrchestrator.test.ts`, on the road that produces it.
  */
  const compose = (reason: string) =>
    joinSentences(`Front: ${bareReason(reason)}.`, refundOutcomeText({ refunded: 250 }));

  it("never doubles a stop, whichever way the reason arrives", () => {
    expect(compose("This view came out broken, so we didn't keep it")).not.toContain("..");
    expect(compose("This view came out broken, so we didn't keep it.")).not.toContain("..");
    expect(compose("Generation failed")).toBe(
      `Front: Generation failed. ${formatCredits(displayRefund(250))} credits returned.`,
    );
  });

  it("CONTROL — the bare join WITHOUT the trim does double the stop", () => {
    const reason = "This view came out broken, so we didn't keep it.";
    expect(joinSentences(`Front: ${reason}.`, refundOutcomeText({ refunded: 250 })))
      .toContain("..");
  });

  it("⚠ and it drops the money half entirely when nothing was owed (#1968)", () => {
    /*
      The sentence a refused view on a signed package actually gets. Without the
      join this reads *"…so we didn't keep it. "* with a trailing space, and
      under the pre-#1968 reading of a bare zero it read *"… The automatic refund
      couldn't be recorded — contact support"* about money nobody owed.
    */
    const line = joinSentences(
      "Front: This view came out broken, so we didn't keep it.",
      refundOutcomeText({ refunded: 0 }),
    );
    expect(line).toBe("Front: This view came out broken, so we didn't keep it.");
    expect(line).not.toContain("support");
    expect(line).toBe(line.trim());
  });
});
