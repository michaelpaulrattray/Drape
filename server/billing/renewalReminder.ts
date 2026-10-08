/**
 * THE YEARLY RENEWAL REMINDER — #1941, his word 2026-10-08 (terminal),
 * verbatim: *"on 1 and 2 go with your reccomendations"*, on Yuna's pre-launch
 * check C9.
 *
 * A yearly plan renews silently. One email goes out a month before it does,
 * saying the plan, the date, the amount, and how to stop it. It is good
 * practice, and for an annual auto-renewal it is also the law in several
 * places — California's Automatic Renewal Law (Business & Professions Code
 * §17602(a)(3)) requires a notice **15 to 45 days** before an automatic
 * renewal whose term is a year or longer, and that is the strictest rule this
 * product has to meet, so it is the one the window is built from.
 *
 * ## THE LEAD TIME, AND WHY IT IS A RANGE RATHER THAN A DAY
 *
 * {@link REMINDER_LEAD_DAYS} is **30**, which sits in the middle of 15–45 on
 * purpose. The sweep runs daily, and a day it does not run (a deploy, a
 * restart, a database blip) must not cost a customer their notice — so the
 * condition is *"the renewal is inside the next 30 days and we have not
 * written about it"*, which means the first run after day 30 sends it. That
 * leaves **fifteen days of tolerance** before the notice would fall outside
 * the lawful window, instead of the none a single-day check would leave.
 *
 * {@link MIN_NOTICE_DAYS} is the floor it is measured against: a notice sent
 * with less than that left is still SENT — a late notice beats silence for the
 * customer — and says so at `warn`, because the only way to get there is for
 * the sweep to have been down for over two weeks.
 *
 * ## WHY A SWEEP AND NOT `invoice.upcoming`
 *
 * Stripe pushes an `invoice.upcoming` event before a renewal, and that was the
 * card's own suggestion. It is not what this does, and the reason is not
 * preference:
 *
 *   * Its lead time is a **single account-wide setting in the Stripe
 *     dashboard**, shared with every monthly subscription. Set to satisfy a
 *     yearly notice, it fires for a monthly plan at about the moment that
 *     plan's last renewal completed.
 *   * It needs a dashboard registration (the event on the endpoint) and a
 *     dashboard setting, both of which are his hand. A feature whose
 *     compliance waits on somebody opening a web page is invariant 7's shape —
 *     written, documented, and not invoked.
 *   * Whether that setting even REACHES 15 days is a fact about a third
 *     party's console that cannot be read from here, and law 7b forbids
 *     guessing it. A design whose legality depends on an unverifiable setting
 *     is the wrong design while a self-contained one exists.
 *
 * What Stripe is used for is the thing only Stripe knows: **the amount.** The
 * upcoming-invoice preview (`invoices.createPreview`) is what the customer
 * will actually be charged, discounts, credit-slider add-on, proration and tax
 * included. Deriving it from `PLAN_TIERS` would be our arithmetic about their
 * invoice, and a renewal notice stating the wrong number is worse than none.
 * ⚠ **So a preview we cannot read REFUSES to send** and leaves the claim
 * released for tomorrow; it never falls back to a figure of our own.
 *
 * ## EXACTLY ONE, PROVEN BY A UNIQUE INDEX
 *
 * The claim (`claimRenewalReminder`) is inserted BEFORE the send and deleted
 * if the send fails — `claimWebhookEvent`'s shape, keyed on
 * (subscription, periodEnd). A redelivered anything, a second server, two
 * overlapping sweeps: the index arbitrates, and the loser is told
 * `already-sent` by the database rather than by a SELECT it could have raced.
 *
 * ## WHAT THE RENEWAL ACTUALLY BUYS, WHEN A CHANGE IS WAITING FOR IT
 *
 * Since #1963 a plan or dial DECREASE is a subscription schedule whose next
 * phase begins at the renewal, and the preview above prices that phase. So the
 * plan the email NAMES comes from {@link pendingRenewalPlan} rather than from
 * the subscription metadata alone: the pending phase when one begins at this
 * renewal, the phase in progress otherwise. A pending MONTHLY phase earns no
 * notice at all, because there is then no annual renewal to warn about.
 *
 * ## WHAT THE CUSTOMER MUST LEARN TO USE THIS — none of it
 *
 * The disappearing-technology gate (CLAUDE.md), answered in this file because
 * the law says a feature answers it in its own body: there is nothing to
 * learn, no decision put in front of anybody, and no technology on show. The
 * email names the plan, a date, a price and where to cancel. No engine, no
 * provider, no percentage, no term of art — and no credit figure at all, which
 * keeps the one number a customer could misread out of it entirely.
 */
import type Stripe from "stripe";

import { PRODUCT_NAME } from "@shared/brand";
import { ASSETS_BASE_URL } from "@shared/const";
import { PLAN_TIERS, type PlanTier } from "../../drizzle/schema";
import { appBaseUrl } from "../_core/appOrigin";
import {
  claimRenewalReminder,
  getYearlyRenewalReminderCandidates,
  releaseRenewalReminderClaim,
  type RenewalReminderCandidate,
  type RenewalReminderClaim,
} from "../db";
import { createModuleLogger } from "../logging/logger";
import { escapeEmailHtml, sendProductEmail, type MailResult, type ProductEmail } from "../mail";
import {
  retrieveLiveSubscription,
  stripe,
  type LiveSubscriptionRead,
} from "../stripe/stripeService";
import { subscriptionPeriodSec } from "../stripe/subscriptionPeriods";
import {
  readPendingPlanChange,
  type PendingChangeRead,
} from "../stripe/subscriptionSchedule";

const log = createModuleLogger("billing/renewalReminder");

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far ahead of a yearly renewal the notice goes out. Inside California's
 * 15–45 day window with room on both sides — see the header.
 */
export const REMINDER_LEAD_DAYS = 30;

/** The lawful floor. A notice later than this is sent anyway, and warns. */
export const MIN_NOTICE_DAYS = 15;

/** How often the sweep wakes up, and how long after boot the first run is. */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SWEEP_FIRST_RUN_DELAY_MS = 90_000;

/**
 * What Stripe will charge at the renewal, read from Stripe's own preview of
 * the invoice it has not minted yet.
 */
export interface RenewalCharge {
  amountCents: number;
  /** Stripe's lowercase ISO code. Formatted by `Intl`, never assumed to be USD. */
  currency: string;
}

/**
 * Everything the sweep reaches outside itself, in one place so the whole thing
 * can be driven without a database, a Stripe account or a mail provider.
 */
export interface RenewalReminderDeps {
  now: () => Date;
  candidates: (windowStart: Date, windowEnd: Date) => Promise<RenewalReminderCandidate[]>;
  readSubscription: (subscriptionId: string) => Promise<LiveSubscriptionRead>;
  /**
   * What is scheduled to take effect at the period boundary, read off the
   * subscription Stripe just answered with rather than from a second read of
   * our own. Free when there is no schedule — {@link readPendingPlanChange}
   * answers `none` without calling Stripe at all.
   */
  readPendingChange: (subscription: Stripe.Subscription) => Promise<PendingChangeRead>;
  previewRenewal: (subscriptionId: string) => Promise<RenewalCharge | null>;
  claim: (row: {
    userId: number;
    stripeSubscriptionId: string;
    periodEnd: Date;
    planTier: PlanTier;
    amountCents: number;
    currency: string;
  }) => Promise<RenewalReminderClaim>;
  release: (stripeSubscriptionId: string, periodEnd: Date) => Promise<void>;
  send: (email: ProductEmail) => Promise<MailResult>;
}

/**
 * Why a shortlisted candidate was not written to. Every skip has a name, so a
 * quiet sweep can be read rather than assumed.
 */
export type RenewalSkipReason =
  | "stripe-read-failed"
  | "subscription-missing"
  | "not-renewing"
  | "status-not-live"
  | "not-yearly"
  | "renewal-outside-window"
  | "pending-change-unreadable"
  | "pending-not-yearly"
  | "amount-unreadable"
  | "already-sent"
  | "claim-unreachable"
  | "send-failed";

export type RenewalVerdict =
  | { due: true; periodEnd: Date; planTier: PlanTier }
  | { due: false; reason: RenewalSkipReason };

export interface RenewalSweepResult {
  considered: number;
  sent: number;
  skipped: Partial<Record<RenewalSkipReason, number>>;
}

/**
 * Does this live subscription earn a notice now?
 *
 * ⚠ **IT JUDGES THE LIVE SUBSCRIPTION AND NEVER OUR CACHED ROW** — #795's
 * repair, applied here for a different reason. The webhook distrusts its
 * payload because Stripe does not order deliveries; this distrusts
 * `points.currentPeriodEnd` because a single missed webhook makes it stale,
 * and a stale period end is a reminder telling a paying customer the wrong
 * date. The cached row chooses who to ASK about; Stripe answers.
 *
 * The four refusals are each their own fact rather than one combined test:
 *
 *   * `not-renewing` — `cancel_at_period_end` is set, so nothing renews and a
 *     renewal notice would be a false statement (and an alarming one).
 *   * `status-not-live` — past due, unpaid, canceled, incomplete. Stripe's own
 *     dunning owns that conversation; a cheerful "renews in 30 days" over the
 *     top of it is the wrong email.
 *   * `not-yearly` — read off the subscription's own price interval, because
 *     the cached column is a cache. Monthly plans get no notice: the law is
 *     about terms of a year or more, and twelve of these a year is spam.
 *   * `renewal-outside-window` — the live period end disagrees with the cache.
 */
export function renewalVerdict(
  candidate: RenewalReminderCandidate,
  subscription: Stripe.Subscription,
  now: Date,
): RenewalVerdict {
  if (subscription.cancel_at_period_end) return { due: false, reason: "not-renewing" };

  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return { due: false, reason: "status-not-live" };
  }

  if (!isYearly(subscription)) return { due: false, reason: "not-yearly" };

  const { endSec } = subscriptionPeriodSec(subscription);
  const periodEnd = new Date(endSec * 1000);
  const msAway = periodEnd.getTime() - now.getTime();
  if (msAway <= 0 || msAway > REMINDER_LEAD_DAYS * DAY_MS) {
    return { due: false, reason: "renewal-outside-window" };
  }

  return { due: true, periodEnd, planTier: planTierOf(subscription, candidate.planTier) };
}

/**
 * The interval the customer is actually billed on, read off the price itself.
 *
 * ⚠ **ANY item's `year` is enough, and that is deliberate.** #1832's law-7
 * sweep taught `getSubscriptionDetails` to read the PLAN's item rather than
 * `data[0]`, because reading the credit-slider add-on would make the two
 * items' agreement load-bearing. Here the question is different and looser:
 * *is this a yearly commitment at all*. A subscription with any yearly line is
 * one, and refusing it because the base item could not be told from the add-on
 * would silently drop the notice this whole module exists to send.
 */
function isYearly(subscription: Stripe.Subscription): boolean {
  return (subscription.items?.data ?? []).some(
    (item) => item?.price?.recurring?.interval === "year",
  );
}

/**
 * WHICH PLAN THIS RENEWAL ACTUALLY BUYS, WHEN A CHANGE IS WAITING AT THE
 * BOUNDARY — the relay's finding on PR #1975, and it only became wrong when
 * #1963 shipped.
 *
 * `subscription.metadata.plan` is the phase IN PROGRESS. Since #1963 a
 * scheduled decrease lives on a subscription schedule whose next phase begins
 * at the renewal, and `invoices.createPreview` prices THAT phase — so a
 * customer with a pending decrease would have been told *"Your Pro Plus plan
 * renews on 21 November"* beside the lower plan's amount, which is two facts
 * from two different months in one sentence. Worse, a pending yearly → monthly
 * change would have announced a yearly renewal that is not going to happen.
 *
 * Three answers, and each is a different fact rather than one combined test:
 *
 *   * `current` — nothing is pending, or what is pending begins AFTER this
 *     renewal, so this invoice still bills the phase in progress and the
 *     subscription's own metadata is the right name. ⚠ The comparison is
 *     against the renewal we are writing about, not against "soon": a phase
 *     starting later prices a later invoice, and naming it here would be the
 *     mirror image of the defect.
 *   * `refuse` — we cannot say what this renewal buys. A schedule read that
 *     FAILED is not a subscription with nothing pending (`readPendingPlanChange`
 *     keeps those three apart for exactly this reason), and a pending phase
 *     naming a plan this product does not price cannot be captioned. Both
 *     refuse rather than falling back to the current plan's name, on the same
 *     ground the module already refuses an unreadable amount: a notice stating
 *     the wrong plan is worse than a notice sent a day later.
 *   * `named` — the pending phase is what the customer is about to be billed
 *     for, so it is the plan the email names, beside the amount Stripe
 *     previewed for the same phase.
 *
 * ⚠ **AND A PENDING MONTHLY PHASE IS A REFUSAL, NOT A RENAME.** The notice
 * exists because an annual term renews silently; if the next phase is monthly
 * there is no annual renewal to warn about, and the law this module is built
 * from is about terms of a year or more.
 */
export type PendingRenewalPlan =
  | { outcome: "current" }
  | { outcome: "named"; planTier: PlanTier }
  | { outcome: "refuse"; reason: "pending-change-unreadable" | "pending-not-yearly" };

export function pendingRenewalPlan(read: PendingChangeRead, periodEnd: Date): PendingRenewalPlan {
  if (read.outcome === "failed") return { outcome: "refuse", reason: "pending-change-unreadable" };
  if (read.outcome === "none") return { outcome: "current" };

  const { change } = read;
  if (change.effectiveAt.getTime() > periodEnd.getTime()) return { outcome: "current" };
  if (change.interval !== "annual") return { outcome: "refuse", reason: "pending-not-yearly" };

  /* ⚠ UNREACHABLE TODAY AND KEPT AS A DRIFT GUARD, said plainly rather than
     left to be discovered: `readPendingPlanChange` already refuses a phase
     whose plan is not a key of `SUBSCRIPTION_PRODUCTS`, and every one of those
     keys is a `PLAN_TIERS` key. This arm is what happens the day those two
     lists stop agreeing — a refusal, never a plan name this product cannot
     price. */
  if (!(change.plan in PLAN_TIERS)) {
    return { outcome: "refuse", reason: "pending-change-unreadable" };
  }
  return { outcome: "named", planTier: change.plan as PlanTier };
}

/**
 * Which plan to NAME in the email.
 *
 * Stripe's `metadata.plan` is what checkout and `updateSubscriptionPlan` wrote,
 * so it is the live answer; the cached tier is the fallback for a subscription
 * created before that metadata existed. An unrecognised value falls back too,
 * rather than captioning a plan this product does not sell.
 */
function planTierOf(subscription: Stripe.Subscription, cached: PlanTier): PlanTier {
  const fromStripe = subscription.metadata?.plan;
  if (fromStripe && fromStripe in PLAN_TIERS) return fromStripe as PlanTier;
  return cached;
}

/**
 * Read what Stripe is about to charge.
 *
 * `invoices.createPreview` creates nothing — it is Stripe's own answer to
 * "what would this subscription's next invoice be", discounts and tax
 * included. `amount_due` is what the customer pays.
 */
async function previewRenewalCharge(subscriptionId: string): Promise<RenewalCharge | null> {
  try {
    const preview = await stripe.invoices.createPreview({ subscription: subscriptionId });
    if (typeof preview.amount_due !== "number" || !preview.currency) return null;
    return { amountCents: preview.amount_due, currency: preview.currency };
  } catch (error) {
    log.error({ err: error, subscriptionId }, "[renewalReminder] could not preview the renewal invoice");
    return null;
  }
}

export function liveRenewalReminderDeps(): RenewalReminderDeps {
  return {
    now: () => new Date(),
    candidates: getYearlyRenewalReminderCandidates,
    readSubscription: retrieveLiveSubscription,
    readPendingChange: (subscription) => readPendingPlanChange(stripe, subscription),
    previewRenewal: previewRenewalCharge,
    claim: claimRenewalReminder,
    release: releaseRenewalReminderClaim,
    send: sendProductEmail,
  };
}

/**
 * One pass: shortlist, confirm against Stripe, claim, send, release on failure.
 *
 * Nothing here throws on one candidate's behalf — a Stripe read that fails for
 * one subscription must not cost the other accounts their notice, so each is
 * its own decision and its own named skip.
 */
export async function runYearlyRenewalReminderSweep(
  deps: RenewalReminderDeps = liveRenewalReminderDeps(),
): Promise<RenewalSweepResult> {
  const now = deps.now();
  const candidates = await deps.candidates(now, new Date(now.getTime() + REMINDER_LEAD_DAYS * DAY_MS));

  const result: RenewalSweepResult = { considered: candidates.length, sent: 0, skipped: {} };
  const skip = (reason: RenewalSkipReason) => {
    result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
  };

  for (const candidate of candidates) {
    const read = await deps.readSubscription(candidate.stripeSubscriptionId);
    if (read.outcome === "failed") {
      skip("stripe-read-failed");
      continue;
    }
    if (read.outcome === "missing") {
      skip("subscription-missing");
      continue;
    }

    const verdict = renewalVerdict(candidate, read.subscription, now);
    if (!verdict.due) {
      skip(verdict.reason);
      continue;
    }

    /**
     * ⚠ **WHAT IS WAITING AT THE BOUNDARY IS READ BEFORE THE PREVIEW IS PAID
     * FOR**, because a pending monthly phase means no notice at all and there
     * is no reason to ask Stripe to price an invoice nobody is going to be
     * told about. It costs nothing on the common road: with no schedule on the
     * subscription, `readPendingPlanChange` answers `none` without calling
     * Stripe.
     */
    const pending = pendingRenewalPlan(
      await deps.readPendingChange(read.subscription),
      verdict.periodEnd,
    );
    if (pending.outcome === "refuse") {
      skip(pending.reason);
      continue;
    }
    /* The plan the renewal actually buys — the pending phase's when one begins
       at this renewal, the subscription's own otherwise. It is used for the
       email AND for the claim row, so the record and the sentence cannot
       disagree. */
    const planTier = pending.outcome === "named" ? pending.planTier : verdict.planTier;

    const charge = await deps.previewRenewal(candidate.stripeSubscriptionId);
    if (!charge) {
      skip("amount-unreadable");
      continue;
    }

    const claim = await deps.claim({
      userId: candidate.userId,
      stripeSubscriptionId: candidate.stripeSubscriptionId,
      periodEnd: verdict.periodEnd,
      planTier,
      amountCents: charge.amountCents,
      currency: charge.currency,
    });
    if (claim === "already-sent") {
      skip("already-sent");
      continue;
    }
    if (claim === "unreachable") {
      skip("claim-unreachable");
      continue;
    }

    const daysLeft = (verdict.periodEnd.getTime() - now.getTime()) / DAY_MS;
    if (daysLeft < MIN_NOTICE_DAYS) {
      log.warn(
        { userId: candidate.userId, daysLeft: Math.floor(daysLeft) },
        `[renewalReminder] sending a renewal notice with under ${MIN_NOTICE_DAYS} days left — the sweep has not run for a while`,
      );
    }

    /**
     * ⚠ **A THROWN SEND IS A FAILED SEND, AND NOTHING ELSE WOULD MAKE "EXACTLY
     * ONCE" MEAN "NEVER"** — the relay's finding on PR #1975. The default
     * `send` is `sendProductEmail`, which THROWS when `RESEND_API_KEY` is
     * unset and whenever the provider's own call rejects; only a RETURNED
     * `{ success: false }` ever reached the release below. So an unconfigured
     * key left the claim row standing, every later pass read `already-sent`,
     * and that renewal lost its notice silently and permanently — and the
     * throw also aborted the loop, so every remaining candidate in the pass
     * was skipped as well.
     *
     * The catch converts the throw into the shape the failure path already
     * handles: the claim goes back, the skip is counted, and the NEXT
     * candidate is still written to. It carries the message and never the
     * address — the metadata-only boundary applies to a log line as it does
     * to a third party.
     */
    let sent: MailResult;
    try {
      sent = await deps.send(
        renewalReminderEmail({
          to: candidate.email,
          name: candidate.name,
          planTier,
          periodEnd: verdict.periodEnd,
          charge,
        }),
      );
    } catch (error) {
      sent = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    if (!sent.success) {
      /* The claim goes back, so tomorrow's pass tries again — the window has
         weeks left in it. Releasing is the whole reason the claim is a claim
         and not a log. */
      await deps.release(candidate.stripeSubscriptionId, verdict.periodEnd);
      log.error(
        { userId: candidate.userId, err: sent.error },
        "[renewalReminder] the renewal notice did not send; the claim was released",
      );
      skip("send-failed");
      continue;
    }

    result.sent += 1;
    log.info(
      { userId: candidate.userId, planTier },
      "[renewalReminder] renewal notice sent",
    );
  }

  return result;
}

/**
 * Start the daily-ish sweep. Four times a day rather than once, because the
 * window is 30 days wide and a six-hour cadence makes a restart cost hours
 * instead of a day — and every pass after the first is a single indexed read
 * that finds nothing while nobody is on a yearly plan.
 */
export function startYearlyRenewalReminderSweep(): void {
  const run = async () => {
    try {
      const result = await runYearlyRenewalReminderSweep();
      if (result.sent > 0 || result.considered > 0) {
        log.info({ ...result }, "[renewalReminder] sweep complete");
      }
    } catch (error) {
      log.error({ err: error }, "[renewalReminder] sweep failed");
    }
  };
  setTimeout(() => void run(), SWEEP_FIRST_RUN_DELAY_MS);
  setInterval(() => void run(), SWEEP_INTERVAL_MS);
}

/* ==========================================================================
   THE EMAIL
   ========================================================================== */

export interface RenewalReminderCopy {
  to: string;
  name: string | null;
  planTier: PlanTier;
  periodEnd: Date;
  charge: RenewalCharge;
}

/**
 * The amount, in the currency Stripe named.
 *
 * ⚠ **`Intl`, not a `$` and `toFixed(2)`.** Every existing money string on the
 * server is an internal log or an admin note and hard-codes a dollar sign;
 * this one is read by the customer, and it states what their card will be
 * charged. A zero-decimal currency (JPY) and a non-USD account both come out
 * right, and the cents-to-units division is the formatter's rather than ours.
 */
export function formatRenewalAmount(charge: RenewalCharge): string {
  const currency = charge.currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      charge.amountCents / 100,
    );
  } catch {
    /* ⚠ THE CATCH IS FOR A MALFORMED CODE, NOT AN UNKNOWN ONE, and the
       difference was measured rather than assumed: `Intl` accepts any
       well-formed three-letter code and prints `ZZZ 5.00` for one it does not
       know, so only a code of the wrong SHAPE throws. Either way the number
       survives, which is the only thing this arm is here to guarantee. */
    return `${(charge.amountCents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * The renewal date, written the way a person reads a date.
 *
 * `en-GB` long form — `21 November 2026`. It is the notation the plan surfaces
 * a customer already reads use (`client/src/features/settings/planMath.ts`'s
 * `formatShortDate`, also `en-GB`), and #903's ruling is that one piece of
 * furniture does not carry two date notations. UTC because the renewal instant
 * is Stripe's, and a server with no reader in front of it has no other clock
 * it could honestly use.
 */
export function formatRenewalDate(periodEnd: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(periodEnd);
}

/**
 * The notice itself.
 *
 * Four facts and one door, in the order a person wants them: which plan, when,
 * how much, and where to stop it. ⚠ **It names no button.** The Billing
 * surface's cancel control is being re-worded by #1940 and is a modal rather
 * than an address, so an email quoting its label would be wrong the week after
 * it shipped, and a deep link to it does not exist — a reminder that sends
 * somebody to a 404 is worse than one that tells them where to look.
 *
 * It does not mention credits either, deliberately: the renewal grants an
 * allowance, and the one number a customer can misread is a credit figure in
 * two scales. The plan page says it, in the display scale, where the shared
 * helper owns it.
 */
export function renewalReminderEmail(copy: RenewalReminderCopy): ProductEmail {
  const planName = PLAN_TIERS[copy.planTier].name;
  const amount = formatRenewalAmount(copy.charge);
  const date = formatRenewalDate(copy.periodEnd);
  /* ⚠ ESCAPED, because `users.name` is free text the customer typed — see
     `escapeEmailHtml`'s own header for the class and the sibling it swept. */
  const firstName = escapeEmailHtml(copy.name ? copy.name.split(" ")[0] : "there");
  const logoUrl = `${ASSETS_BASE_URL}/drape-logo-tight.png`;
  /**
   * ⚠ **THE DOOR GOES TO THE APP, AND THE BUTTON NOW SAYS SO** — the relay's
   * finding on PR #1975. It read `Open Billing` over this address, which is
   * the app home: a button promising a surface it does not reach is the
   * machinery showing through from the other side, and the customer presses
   * it, lands somewhere else and has to go looking.
   *
   * There is no address to point it at, read at the code rather than assumed:
   * Billing is a SECTION of a modal held in component state
   * (`client/src/features/settings/AccountSurfaces.tsx` renders
   * `SettingsModal` off `state.settings`), it has no route in `App.tsx`, and
   * nothing reads a search parameter or a hash to open it. So the repair is
   * the words, not a deep link — inventing a route for an email's benefit is a
   * client feature, not a repair, and the sentence above already tells them
   * where Billing lives once they are inside.
   */
  const appUrl = `${appBaseUrl()}/app`;

  return {
    purpose: "billing",
    to: copy.to,
    subject: `Your ${planName} plan renews on ${date}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #EBEBEB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #EBEBEB; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <img src="${logoUrl}" alt="${PRODUCT_NAME}" height="24" style="display: block; height: 24px; width: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #0A0A0A; letter-spacing: -0.02em; line-height: 1.3;">
                Your yearly plan renews soon
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 32px 0 32px;">
              <p style="margin: 0; font-size: 15px; color: #555555; line-height: 1.6;">
                Hi ${firstName},
              </p>
              <p style="margin: 12px 0 0 0; font-size: 15px; color: #555555; line-height: 1.6;">
                This is a heads-up, not a bill. Your yearly plan renews automatically, and here is what will happen.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E5E5E5; border-radius: 12px;">
                <tr>
                  <td style="padding: 16px 20px 0 20px;">
                    <p style="margin: 0; font-size: 12px; color: #999999; letter-spacing: 0.04em; text-transform: uppercase;">Plan</p>
                    <p style="margin: 2px 0 0 0; font-size: 15px; color: #0A0A0A;">${planName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px 0 20px;">
                    <p style="margin: 0; font-size: 12px; color: #999999; letter-spacing: 0.04em; text-transform: uppercase;">Renews on</p>
                    <p style="margin: 2px 0 0 0; font-size: 15px; color: #0A0A0A;">${date}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px 18px 20px;">
                    <p style="margin: 0; font-size: 12px; color: #999999; letter-spacing: 0.04em; text-transform: uppercase;">Amount</p>
                    <p style="margin: 2px 0 0 0; font-size: 15px; color: #0A0A0A;">${amount}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <p style="margin: 0; font-size: 15px; color: #555555; line-height: 1.6;">
                If you want to carry on, do nothing. If you would rather not renew, you can cancel any time before that date in your account's Billing settings &mdash; your plan then runs to the end of the period you have already paid for.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; background-color: #0A0A0A; color: #ffffff; padding: 14px 40px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.01em;">
                      Open your account
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <p style="margin: 0; font-size: 13px; color: #999999; line-height: 1.5;">
                Questions about any of this? Reply to this email and a person will answer.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 0 32px;">
              <hr style="border: none; border-top: 1px solid #E5E5E5; margin: 0;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 32px 32px;">
              <p style="margin: 0; font-size: 12px; color: #BFBFBF; line-height: 1.5; letter-spacing: 0.02em;">
                ${PRODUCT_NAME} &mdash; Your next campaign, cast in minutes.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}
