/**
 * A CANCELLED PLAN'S CREDITS EXPIRE 30 DAYS PAST THE PAID PERIOD — #2152.
 *
 * His word, 2026-10-09 (terminal), verbatim: *"pricing word card here ive
 * approved the code changes required too"*, on the Desk item "Pricing Phase 2:
 * final wording", whose rollover rules (Cid's) read: *"After cancelling, plan
 * credits stay usable for 30 days past the paid period, then expire."* and
 * *"Top-ups never expire and don't count toward the cap."*
 *
 * ## The two halves, and why it is a STAMPED DEADLINE plus a SWEEP
 *
 * 1. **The stamp** — `handleSubscriptionDeleted` (server/stripe/webhooks.ts)
 *    writes `points.planCreditsExpireAt` = {@link planCreditsExpiryFrom} in the
 *    same UPDATE that moves the account to Free. That write is the only moment
 *    the paid period's end is known: the same UPDATE nulls `currentPeriodEnd`
 *    and the subscription id, so a sweep that tried to DERIVE the deadline
 *    later would have nothing to derive it from.
 * 2. **The sweep** — {@link runPlanCreditsExpirySweep}, every six hours on
 *    every server, takes the plan's part of the balance off each due account
 *    through `expirePlanCredits` (server/db/billing.ts): a compare-and-set on
 *    the balance AND the stamp, the stamp cleared in the same write, and one
 *    ledger line under a reference unique per (account, deadline). Two
 *    sweepers, a redeploy mid-run, a spend landing between the read and the
 *    write: each ends in exactly one ledger line or none.
 *
 * Why not a delayed job or Stripe: there is no job queue for money in this
 * product, and Stripe holds no event 30 days after a subscription ends. The
 * yearly renewal reminder (#1941) set the shape this copies — a self-contained
 * sweep whose window tolerates days of downtime, because "the deadline has
 * passed and the stamp is still there" is true on every run after it.
 *
 * ## What it never touches
 *
 *  - **Top-ups, starting credits, referral rewards, staff goodwill and promos**
 *    (#2185). The new balance IS `creditsOutsidePlanRules`; promos leave only by
 *    their own clock ({@link runPromoCreditsExpirySweep}).
 *  - **An account that came back.** `updateUserSubscription` clears the stamp
 *    on any move to a paid tier, and the write is conditioned on `planTier =
 *    'free'` too, so a resubscription between the read and the write wins.
 *
 * ## What the customer must learn — nothing new
 *
 * The disappearing-technology gate, answered here as the law asks: the only
 * thing a customer sees is the sentence on the cancel dialog and the plans
 * page, *"You'll have 30 days to use your plan credits. Top-ups stay on your
 * balance."* — no decision, no term of art. The number in that sentence is
 * {@link CANCELLED_PLAN_GRACE_DAYS}, the same constant this module stamps with.
 */
import { CANCELLED_PLAN_GRACE_DAYS } from "@shared/planCancelCopy";
import {
  expirePlanCredits,
  getPlanCreditsExpiryCandidates,
} from "../db";
import {
  expirePromoCredits,
  getPromoCreditsExpiryCandidates,
  type PlanCreditsExpiryResult,
} from "../db/billing";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("billing/planCreditsExpiry");

const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SWEEP_FIRST_RUN_DELAY_MS = 120_000;

/**
 * The deadline for a subscription that just died: its paid period's end plus
 * {@link CANCELLED_PLAN_GRACE_DAYS}, and never earlier than `now` plus the same.
 *
 * ⚠ **THE PERIOD END IS READ ONLY WHERE STRIPE STATES ONE.** The shared
 * `subscriptionPeriodSec` fabricates a month when no period is present, which
 * is right for its callers and wrong here — a fabricated end could only push
 * the deadline later by a guess. With nothing stated, the deletion itself
 * (`ended_at`, or the moment we heard) is the period's end, which is when Stripe sends this event for a plan cancelled
 * at the period end (the road the cancel dialog walks). A subscription ended
 * EARLY (an immediate cancel) states a period end in the future, and the
 * customer keeps the days they paid for plus the thirty.
 */
export function planCreditsExpiryFrom(subscription: unknown, now: Date): Date {
  const sub = subscription as {
    items?: { data?: Array<{ current_period_end?: unknown }> } | null;
    current_period_end?: unknown;
    ended_at?: unknown;
  } | null;
  const isSec = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  const stated = [
    ...(sub?.items?.data ?? []).map((item) => item?.current_period_end),
    sub?.current_period_end,
  ].filter(isSec);
  /* The moment it ended is Stripe's `ended_at` where the payload states it —
     stable across redeliveries, so a redelivered event restamps the same
     deadline — and the moment we heard otherwise. */
  const endedMs = isSec(sub?.ended_at) ? sub.ended_at * 1000 : now.getTime();
  const periodEndMs = stated.length > 0 ? Math.max(...stated) * 1000 : endedMs;
  const from = Math.max(periodEndMs, endedMs);
  // Whole seconds: the column has no fractional part, and the sweep's write is
  // conditioned on the stamp it read back.
  return new Date(Math.floor((from + CANCELLED_PLAN_GRACE_DAYS * DAY_MS) / 1000) * 1000);
}

/**
 * The deadline for a plan that died of a FINAL PAYMENT FAILURE (#2152, the
 * relay's finding on head 18315b5f1, repair 3): the end of the period that WAS
 * paid for — the failed invoice's own period start — plus
 * {@link CANCELLED_PLAN_GRACE_DAYS}. Unreadable, it is the moment we heard.
 */
export function planCreditsExpiryFromPaidEnd(paidEndSec: number | null, now: Date): Date {
  const fromMs =
    typeof paidEndSec === "number" && Number.isFinite(paidEndSec) && paidEndSec > 0
      ? paidEndSec * 1000
      : now.getTime();
  return new Date(Math.floor((fromMs + CANCELLED_PLAN_GRACE_DAYS * DAY_MS) / 1000) * 1000);
}

export interface PlanCreditsExpiryDeps {
  now: () => Date;
  candidates: (now: Date) => Promise<Array<{ userId: number; planCreditsExpireAt: Date }>>;
  expire: (userId: number, expireAt: Date, now: Date) => Promise<PlanCreditsExpiryResult>;
}

export interface PlanCreditsExpirySweepResult {
  considered: number;
  outcomes: Partial<Record<PlanCreditsExpiryResult["outcome"], number>>;
  creditsRemoved: number;
}

const defaultDeps: PlanCreditsExpiryDeps = {
  now: () => new Date(),
  // Wrapped, not referenced: the webhook imports this module for the stamp,
  // and a bare reference would read the database barrel at load time.
  candidates: (now) => getPlanCreditsExpiryCandidates(now),
  expire: (userId, expireAt, now) => expirePlanCredits(userId, expireAt, now),
};

/** One pass. Every candidate's outcome is counted, so a quiet sweep can be read. */
export async function runPlanCreditsExpirySweep(
  deps: PlanCreditsExpiryDeps = defaultDeps,
): Promise<PlanCreditsExpirySweepResult> {
  const now = deps.now();
  const due = await deps.candidates(now);
  const result: PlanCreditsExpirySweepResult = { considered: due.length, outcomes: {}, creditsRemoved: 0 };
  for (const candidate of due) {
    const verdict = await deps.expire(candidate.userId, candidate.planCreditsExpireAt, now);
    result.outcomes[verdict.outcome] = (result.outcomes[verdict.outcome] ?? 0) + 1;
    if (verdict.outcome === "expired") {
      result.creditsRemoved += verdict.creditsRemoved;
      log.info(
        { userId: candidate.userId, creditsRemoved: verdict.creditsRemoved, newBalance: verdict.newBalance },
        "[planCreditsExpiry] a cancelled plan's credits expired",
      );
    } else if (verdict.outcome === "failed") {
      // Left stamped: the next pass is the retry.
      log.error({ userId: candidate.userId, error: verdict.error }, "[planCreditsExpiry] expiry failed — retried next pass");
    }
  }
  return result;
}

export interface PromoCreditsExpiryDeps {
  now: () => Date;
  candidates: (now: Date) => Promise<Array<{ userId: number; expireAt: Date }>>;
  expire: (userId: number, expireAt: Date, now: Date) => Promise<PlanCreditsExpiryResult>;
}

const defaultPromoDeps: PromoCreditsExpiryDeps = {
  now: () => new Date(),
  candidates: (now) => getPromoCreditsExpiryCandidates(now),
  expire: (userId, expireAt, now) => expirePromoCredits(userId, expireAt, now),
};

/**
 * ONE PASS OVER THE PROMOS THAT HAVE RUN OUT (#2185, his ruling 2026-10-10:
 * "promo and signup bonuses after 90 days? Expire after 90 days.", then for
 * the starting credits: "starting credits are just a default every account
 * starts with lets make them never expire to simplify things." — so a promo
 * is the only credit with its own clock). It rides this sweep's six-hour timer
 * because it is the same shape — a stamped deadline, a compare-and-set, one
 * ledger line under a unique reference — and a second timer would be a second
 * thing to keep alive for no gain.
 */
export async function runPromoCreditsExpirySweep(
  deps: PromoCreditsExpiryDeps = defaultPromoDeps,
): Promise<PlanCreditsExpirySweepResult> {
  const now = deps.now();
  const due = await deps.candidates(now);
  const result: PlanCreditsExpirySweepResult = { considered: due.length, outcomes: {}, creditsRemoved: 0 };
  for (const candidate of due) {
    const verdict = await deps.expire(candidate.userId, candidate.expireAt, now);
    result.outcomes[verdict.outcome] = (result.outcomes[verdict.outcome] ?? 0) + 1;
    if (verdict.outcome === "expired") {
      result.creditsRemoved += verdict.creditsRemoved;
      log.info(
        { userId: candidate.userId, creditsRemoved: verdict.creditsRemoved },
        "[planCreditsExpiry] promo credits expired",
      );
    } else if (verdict.outcome === "failed") {
      log.error(
        { userId: candidate.userId, error: verdict.error },
        "[planCreditsExpiry] promo expiry failed — retried next pass",
      );
    }
  }
  return result;
}

export function startPlanCreditsExpirySweep(): void {
  const run = async () => {
    try {
      const result = await runPlanCreditsExpirySweep();
      if (result.considered > 0) log.info({ ...result }, "[planCreditsExpiry] sweep complete");
    } catch (error) {
      log.error({ err: error }, "[planCreditsExpiry] sweep failed");
    }
    try {
      const promo = await runPromoCreditsExpirySweep();
      if (promo.considered > 0) log.info({ ...promo }, "[planCreditsExpiry] promo sweep complete");
    } catch (error) {
      log.error({ err: error }, "[planCreditsExpiry] promo sweep failed");
    }
  };
  setTimeout(() => void run(), SWEEP_FIRST_RUN_DELAY_MS);
  setInterval(() => void run(), SWEEP_INTERVAL_MS);
}
