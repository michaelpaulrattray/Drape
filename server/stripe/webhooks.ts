/**
 * Stripe Webhook Handler
 * 
 * Processes Stripe webhook events for subscriptions and payments.
 */

import Stripe from "stripe";
import { 
  constructWebhookEvent, 
  mapStripeStatus, 
  mapPlanToTier,
  calculateRolloverCredits,
  getMonthlyCredits,
  cancelSubscription,
  voidInvoice,
  REFUND_METADATA_USER_KEY,
  REFUND_METADATA_CHANGE_REQUEST_KEY,
} from "./stripeService";
import { 
  updateUserSubscription, 
  getUserByStripeCustomerId, 
  refreshMonthlyCredits,
  getUserCredits,
  suspendUser,
  unsuspendUser,
  deductCredits,
  addCredits,
  creditReferrerOnPaidAction,
  getCreditTransactionByRef,
  appendChangeRequestReviewNote,
} from "../db";
import { SlackAlerts } from "../slack/slackNotification";
import { SubscriptionPlan } from "./stripeProducts";
import { PlanTier, stripeWebhookEvents } from "../../drizzle/schema";
import { subscriptionPeriodSec } from "./subscriptionPeriods";
import { invoiceSubscriptionId, periodBought } from "./invoiceLines";
import {
  applyPlanChangeSettlement,
  voidPlanChangeSettlement,
} from "./planChangeSettlement";
import {
  voidPendingPlanChangeSettlementsForUser,
  getVoidPlanChangeSettlementInvoiceIdsForUser,
} from "../db";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { createModuleLogger } from "../logging/logger";
import { checkEventEnvironment } from "./environmentTag";
import { deploymentTag } from "../_core/env";
import { getDb } from "../db/connection";
import { eq } from "drizzle-orm";
const log = createModuleLogger("stripe/webhooks");

export interface WebhookResult {
  success: boolean;
  message: string;
  error?: string;
  /**
   * Set when the event was DELIBERATELY not fulfilled (the environment tag).
   * It rides on `success: true` so the endpoint ACKs and Stripe stops
   * redelivering — a foreign event will never succeed here, and retries would
   * eventually get the production endpoint disabled, which would break real
   * fulfilment. The refusal is loud in the log, not in the status code.
   */
  refused?: true;
}

/**
 * Process a Stripe webhook event
 */
export async function handleStripeWebhook(
  payload: string | Buffer,
  signature: string
): Promise<WebhookResult> {
  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(payload, signature);
  } catch (error) {
    log.error({ err: error }, "[Webhook] Failed to verify signature:");
    return { success: false, message: "Invalid signature", error: String(error) };
  }

  log.info({ eventId: event.id, eventType: event.type }, `[Webhook] Processing event: ${event.type}`);

  // Handle test events (Stripe webhook verification)
  if (event.id.startsWith('evt_test_')) {
    log.info('[Webhook] Test event detected, returning verification response');
    return { success: true, message: 'Test event verified' };
  }

  // WHICH WORLD MADE THIS? (L6) Development and production share one Stripe
  // account whose single registered endpoint is production's, so a dev
  // checkout arrives here, verifies here, and would be fulfilled here. Refused
  // BEFORE the switch — that is before any handler, any lookup and any money.
  const environment = checkEventEnvironment(event);
  if (!environment.accepted) {
    log.error(
      { eventId: event.id, eventType: event.type, deployment: deploymentTag() },
      `[Webhook] REFUSED — ${environment.reason}`,
    );
    return { success: true, refused: true, message: environment.reason };
  }

  // Idempotency check: skip if already processed
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const [existing] = await db
      .select({ id: stripeWebhookEvents.id })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, event.id))
      .limit(1);

    if (existing) {
      log.info({ eventId: event.id }, '[Webhook] Duplicate event, skipping');
      return { success: true, message: `Event ${event.id} already processed` };
    }
  } catch (idempotencyErr) {
    // If idempotency check fails, proceed anyway (fail open)
    log.warn({ err: idempotencyErr }, '[Webhook] Idempotency check failed, proceeding');
  }

  try {
    let result: WebhookResult;

    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        result = await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        result = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "charge.dispute.created":
        result = await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.closed":
        result = await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      case "refund.failed":
        result = await handleRefundFailed(event.data.object as Stripe.Refund);
        break;

      default:
        log.info(`[Webhook] Unhandled event type: ${event.type}`);
        return { success: true, message: `Unhandled event type: ${event.type}` };
    }

    // Record successfully processed event for idempotency
    if (result.success) {
      await recordProcessedEvent(event.id, event.type);
    }

    return result;
  } catch (error) {
    log.error({ err: error }, `[Webhook] Error processing ${event.type}:`);
    return { success: false, message: `Error processing ${event.type}`, error: String(error) };
  }
}

/**
 * Record a processed webhook event for idempotency.
 * Called after successful processing of each handler.
 */
async function recordProcessedEvent(eventId: string, eventType: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    await db.insert(stripeWebhookEvents).values({
      eventId,
      eventType,
    }).onDuplicateKeyUpdate({ set: { eventId } }); // No-op on duplicate
  } catch (err) {
    log.warn({ err, eventId }, '[Webhook] Failed to record processed event');
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<WebhookResult> {
  const userId = parseInt(session.metadata?.userId || "0", 10);
  const type = session.metadata?.type;

  if (!userId) {
    return { success: false, message: "Missing userId in session metadata" };
  }

  // For subscriptions — trigger referral credit for referrer on first paid action
  try {
    const credited = await creditReferrerOnPaidAction(userId);
    if (credited) {
      log.info(`[Webhook] Referrer credited for user ${userId}'s first paid subscription`);
    }
  } catch (err) {
    log.error({ err: err }, `[Webhook] Failed to credit referrer for user ${userId}:`);
    // Non-blocking — don't fail the webhook for referral credit issues
  }

  return { success: true, message: "Checkout completed, subscription will be processed separately" };
}

/**
 * Handle customer.subscription.created/updated events
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<WebhookResult> {
  const customerId = subscription.customer as string;
  const plan = subscription.metadata?.plan as SubscriptionPlan | undefined;

  // Get user by Stripe customer ID
  const userWithCredits = await getUserByStripeCustomerId(customerId);
  if (!userWithCredits) {
    log.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;
  // #391: a metadata.plan naming a tier the product no longer declares (a
  // folded rung on a stale checkout session) maps to null — keep the
  // account's current tier rather than persisting a value the renewal path
  // would later throw on, and say so in the log.
  const mappedTier = plan ? mapPlanToTier(plan) : null;
  if (plan && !mappedTier) {
    log.warn(
      `[Webhook] Subscription ${subscription.id} names a plan the product no longer declares ("${plan}") — keeping user ${userId}'s current tier`,
    );
  }
  const planTier = mappedTier ?? (userWithCredits.credits?.planTier || "free");

  // The period lives on the subscription ITEM on this API version (#664 —
  // see subscriptionPeriods.ts): the sub-level read was writing a fabricated
  // month into currentPeriodStart/End on every event.
  const { startSec: periodStart, endSec: periodEnd } = subscriptionPeriodSec(subscription);

  // The interval the customer is billed on, read off the price itself (#664
  // decision 5) — this column is a CACHE of the Stripe artifact, refreshed
  // every time Stripe tells us the subscription changed. Anything that is not
  // a month or a year is cached as unknown rather than guessed monthly.
  const stripeInterval = (subscription as any).items?.data?.[0]?.price?.recurring?.interval;
  const billingInterval =
    stripeInterval === "year" || stripeInterval === "month" ? stripeInterval : null;

  // Update subscription in database.
  //
  // ⚠ THE VERDICT IS READ, NOT DROPPED (#792, the class of #788/#789):
  // `updateUserSubscription` never throws — a failed write comes back
  // `{ success: false }` — and a handler that then returns success is ACKed
  // 200 and recorded as processed, so Stripe never redelivers and the plan or
  // status change it carried never lands: the customer pays and sees the old
  // plan until the NEXT event, which may be a month away. This write is the
  // whole handler and it is one idempotent UPDATE keyed on the user, so
  // Stripe's ~3 days of redeliveries are exactly the retry it needs. The
  // no-db arm of the helper is unreachable here — `getDb()` caches, and
  // `getUserByStripeCustomerId` above already threw on a null db — so the
  // failure that reaches this line is a transient the retry can clear.
  const updateResult = await updateUserSubscription(userId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: mapStripeStatus(subscription.status),
    planTier: planTier as PlanTier,
    billingInterval,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    planExpiresAt: new Date(periodEnd * 1000),
  });
  if (!updateResult.success) {
    log.error(
      `[Webhook] Subscription ${subscription.id} for user ${userId} could not be written (${updateResult.error}) — failing the event so Stripe redelivers and the write is retried`,
    );
    return {
      success: false,
      message: `Subscription update for user ${userId} could not be written — redeliver to retry`,
    };
  }

  log.info(`[Webhook] Updated subscription for user ${userId}: ${planTier} (${subscription.status})`);
  return { success: true, message: `Updated subscription for user ${userId}` };
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<WebhookResult> {
  const customerId = subscription.customer as string;

  // Get user by Stripe customer ID
  const userWithCredits = await getUserByStripeCustomerId(customerId);
  if (!userWithCredits) {
    log.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;

  const previousPlan = userWithCredits.credits?.planTier || "unknown";

  // A subscription dying takes its unsettled plan-change credit moves with
  // it (#711, PR #755 review finding 3): a voluntary cancel or dashboard
  // action while a change invoice sat unpaid would otherwise strand the
  // settlement row pending forever, with no invoice event ever coming.
  //
  // ⚠ ONLY when the dying subscription is the one on record (round-2
  // finding 1): Stripe redelivers failed events for days, so a stale
  // deleted event for an OLD subscription can arrive after the user has
  // resubscribed — and a void is irreversible, so it must not touch a NEWER
  // subscription's pending settlement. Null on record still voids: the
  // voluntary-cancel road this exists for may clear the stored id first.
  const storedSubscriptionId = userWithCredits.credits?.stripeSubscriptionId;
  const isStaleDelivery = !!storedSubscriptionId && storedSubscriptionId !== subscription.id;
  const invoiceVoidsFailed: string[] = [];
  if (!isStaleDelivery) {
    const voidedInvoiceIds = await voidPendingPlanChangeSettlementsForUser(userId);
    if (voidedInvoiceIds.length > 0) {
      log.info(
        `[Webhook] ${voidedInvoiceIds.length} plan-change settlement(s) for user ${userId} are void — the subscription died before the change's invoice settled`,
      );
      // AND THE INVOICES THEY HANG ON (#765, founder ruling 2026-09-10,
      // option A: "close the invoice too, the same as the payment-failure
      // road"). The void row closes the CREDIT side; the invoice stayed
      // `open` and payable through Stripe's hosted page indefinitely, so a
      // customer who cancelled could still pay for a plan they no longer
      // have, against credits the void row will refuse. Every one of these
      // invoices is for credits that were never granted, so nothing was
      // delivered for the money — which is why the fair answer and the
      // consistent one are the same one.
      //
      // The list carries rows that were ALREADY void too, on purpose (PR
      // #786 review, finding 1): `voidInvoice` reads the status first and
      // treats a closed invoice as done, so a redelivered event is one read
      // per row — and it is what RETRIES an invoice void that failed on a
      // Stripe blip the first time.
      //
      // ⚠ AND THE REDELIVERY HAS TO BE MADE TO HAPPEN (round 2): a handler
      // that returns success is ACKed 200 and recorded as processed, so
      // Stripe never sends the event again and the idempotency guard would
      // refuse it if it did. So a void that comes back `failed` is collected
      // here and FAILS THE EVENT below — after the downgrade, which must land
      // on the first attempt — the same way a failed settlement application
      // fails its event loud. Stripe redelivers for ~3 days; on the way back
      // the stored id is null (the downgrade cleared it) and the
      // void-inclusive list above is what makes the retry reach Stripe — OR
      // the customer has resubscribed in the meantime, the stored id is the
      // NEW one, and the retry takes the stale arm below instead.
      for (const invoiceId of voidedInvoiceIds) {
        const verdict = await voidInvoice(invoiceId);
        if (verdict === "failed") invoiceVoidsFailed.push(invoiceId);
      }
    }
  } else {
    // ⚠ A STALE DELIVERY STILL RETRIES THE INVOICE VOIDS (PR #794 review
    // finding 1). The WRITER above must not run here — it would void the
    // new subscription's pending settlement, irreversibly. But the retry
    // this road exists for is exactly a failed invoice void redelivered
    // into a window where the customer has resubscribed, and skipping it
    // left the OLD plan-change invoice payable on the hosted page forever,
    // against credits its void row will refuse — #756's two-sides-disagree
    // state, reached through this handler's own redelivery. So the stale arm
    // reads the rows that are ALREADY void (a read, never a write; a void
    // row's invoice must never take money whichever subscription it hung
    // on) and closes each invoice: one status read per row when it has
    // already succeeded, the real void when it has not.
    log.info(
      `[Webhook] Deleted event for ${subscription.id} but user ${userId}'s subscription on record is ${storedSubscriptionId} — a stale delivery; leaving pending settlements alone`,
    );
    const alreadyVoidInvoiceIds = await getVoidPlanChangeSettlementInvoiceIdsForUser(userId);
    for (const invoiceId of alreadyVoidInvoiceIds) {
      const verdict = await voidInvoice(invoiceId);
      if (verdict === "failed") invoiceVoidsFailed.push(invoiceId);
    }
  }

  // Downgrade to free tier.
  //
  // ⚠ UNDER THE SAME STALE GUARD AS THE VOID (#792): a `deleted` event for
  // an OLD subscription, redelivered after the customer has resubscribed,
  // used to downgrade the NEW subscription's account to free — the guard
  // above protected only the settlement rows. It matters more now that a
  // failed write below FAILS THE EVENT, because that is what makes the
  // redelivery happen: the first attempt's write did not land, the customer
  // resubscribes in the meantime, and the retry must find the newer id on
  // record and leave it alone. Null on record still downgrades (the
  // voluntary-cancel road may clear the id first), and a same-id retry is one
  // idempotent UPDATE.
  //
  // ⚠ AND ITS VERDICT IS READ, NOT DROPPED: `updateUserSubscription` never
  // throws, and a downgrade that silently failed left the account reading
  // paid after the subscription was gone at Stripe — with no further event
  // ever coming to correct it. A failed write fails the event beside the
  // failed voids; Stripe redelivers for ~3 days and the retry is the same
  // UPDATE.
  let downgradeFailed = false;
  if (isStaleDelivery) {
    log.info(
      `[Webhook] Leaving user ${userId}'s plan alone — the dying subscription ${subscription.id} is not the one on record`,
    );
  } else {
    const downgradeResult = await updateUserSubscription(userId, {
      stripeSubscriptionId: null,
      subscriptionStatus: "canceled",
      planTier: "free",
      billingInterval: null,
      planExpiresAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });
    if (downgradeResult.success) {
      log.info(`[Webhook] Subscription deleted for user ${userId} (was ${previousPlan}), downgraded to free tier`);
    } else {
      downgradeFailed = true;
      log.error(
        `[Webhook] Subscription deleted for user ${userId} but the downgrade could not be written (${downgradeResult.error}) — failing the event so Stripe redelivers and the downgrade is retried`,
      );
    }
  }

  if (downgradeFailed) {
    return {
      success: false,
      message: `Subscription deleted for user ${userId}, but the downgrade could not be written — redeliver to retry`,
    };
  }

  if (invoiceVoidsFailed.length > 0) {
    log.error(
      `[Webhook] ${invoiceVoidsFailed.length} plan-change invoice(s) for user ${userId} could not be voided (${invoiceVoidsFailed.join(", ")}) — failing the event so Stripe redelivers and the void is retried; the downgrade has already landed`,
    );
    return {
      success: false,
      message: `Subscription deleted for user ${userId}, but ${invoiceVoidsFailed.length} plan-change invoice(s) could not be voided — redeliver to retry`,
    };
  }

  return { success: true, message: `Subscription deleted for user ${userId}` };
}

/**
 * Handle invoice.payment_succeeded event (monthly credit refresh)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<WebhookResult> {
  // Only process subscription invoices. Read through the dialect helper: on
  // the clover payloads production actually receives, `invoice.subscription`
  // does not exist and this gate used to skip EVERY real invoice (#664
  // review finding 2 — the renewal refresh was structurally unreachable).
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return { success: true, message: "Not a subscription invoice, skipping" };
  }

  const customerId = invoice.customer as string;

  // Get user by Stripe customer ID
  const userWithCredits = await getUserByStripeCustomerId(customerId);
  if (!userWithCredits) {
    log.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;
  const planTier = userWithCredits.credits?.planTier || "free";

  // ⚠ THE PLAN-CHANGE CREDIT MOVE SETTLES HERE (#711) — before the period
  // logic, because an upgrade's grant rides a PRORATION-ONLY invoice, which
  // the periodBought branch below deliberately exits early for. `changePlan`
  // recorded the move against this invoice's id when Stripe accepted the
  // update; this event is the money actually arriving. Applied first so an
  // interval switch's unwind lands before the same invoice's period grant
  // (the refresh's compare-and-set tolerates either order; this one is
  // deterministic). A failed application fails the event LOUD — Stripe
  // redelivers, and the ledger's unique reference makes the retry safe.
  const settlement = await applyPlanChangeSettlement(invoice.id as string);
  if (settlement.outcome === "failed") {
    return {
      success: false,
      message: `Plan-change settlement for invoice ${invoice.id} failed — refusing so Stripe redelivers`,
      error: settlement.error,
    };
  }
  if (settlement.outcome === "applied") {
    log.info(
      `[Webhook] Applied plan-change credit settlement for invoice ${invoice.id} (user ${userId}): ${settlement.creditsMoved} credits`,
    );
  }

  // Skip if free tier (shouldn't happen but just in case)
  if (planTier === "free") {
    return { success: true, message: "Free tier, no credits to refresh" };
  }

  // ⚠ CREDITS ARE GRANTED WHEN A PERIOD IS BOUGHT, SIZED BY THE PERIOD
  // BOUGHT (#664 decision 3). This handler used to grant one month's credits
  // on ANY subscription invoice — which would have given an annual subscriber
  // one month's allowance for a year's money, and (under `always_invoice`)
  // would have RESET the balance on every tier change's proration invoice.
  // The invoice's own non-proration recurring line is the artifact that says
  // what was bought — read dialect-free (invoiceLines.ts), sized by the
  // line's own period span.
  const billingReason = (invoice as any).billing_reason;
  const bought = periodBought(invoice);

  if (!bought) {
    // A renewal or first purchase whose period cannot be read is a FULL
    // period paid with NO credits granted — the silent-zero-grant failure
    // the #664 review named. It fails loud: Stripe redelivers, and the
    // failure is visible instead of a happy log over an empty grant.
    if (billingReason === "subscription_create" || billingReason === "subscription_cycle") {
      log.error(
        `[Webhook] Invoice ${invoice.id} (${billingReason}) has NO readable period line — a paid period would grant nothing. Refusing so the failure is visible.`,
      );
      return {
        success: false,
        message: `Invoice ${invoice.id} bought a period this handler could not read — no credits granted, refusing loudly`,
      };
    }
    log.info(
      `[Webhook] Invoice ${invoice.id} bought no period (proration-only) — no allowance reset for user ${userId}`,
    );
    return {
      success: true,
      message: `Proration-only invoice for user ${userId} — no period bought, no credit refresh`,
    };
  }

  const grantMonths = bought.monthsBought;

  // ⚠ AN EARLY RENEWAL CARRIES THE BALANCE THROUGH IN FULL — because the
  // UNWIND lives in changePlan, not here (#664 review finding 1). An interval
  // switch's anchor reset invoices the new period with billing_reason
  // "subscription_update"; changePlan deducts the unconsumed share of the OLD
  // period's grant, mirroring the money credit Stripe issued for the same
  // days. So what remains on the balance is allowance the customer genuinely
  // paid for and kept — the plan's percentage would forfeit paid-for credits.
  // A cycle that RUNS OUT still keeps only its percentage.
  //
  // ⚠ The RULE is passed, not a number (#664 review round 2, finding 1):
  // refreshMonthlyCredits computes the rollover from the balance its own
  // compare-and-set write is conditioned on, so the unwind (or a spend)
  // landing mid-refresh makes the write miss and retry instead of being
  // silently erased by a SET computed from a stale read.
  const computeRollover =
    billingReason === "subscription_update"
      ? (balance: number) => balance
      : (balance: number) => calculateRolloverCredits(balance, planTier as PlanTier);

  const grantCredits = getMonthlyCredits(planTier as PlanTier) * grantMonths;

  // Refresh credits
  const result = await refreshMonthlyCredits(
    userId,
    grantCredits,
    computeRollover,
    `stripe-invoice:${invoice.id}`,
    grantMonths === 12
      ? `Annual credit grant — 12 months up front (${grantCredits} credits + rollover)`
      : undefined,
  );

  if (!result.success) {
    return { success: false, message: "Failed to refresh credits", error: result.error };
  }

  log.info(
    `[Webhook] Refreshed credits for user ${userId}: ${grantCredits} (${grantMonths} month${grantMonths === 1 ? "" : "s"} bought) + rollover = ${result.newBalance}`,
  );
  return { success: true, message: `Refreshed credits for user ${userId}` };
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookResult> {
  // Only process subscription invoices — dialect-free (#664 review finding 2,
  // law 7: the same dead gate as the success handler, swept with it). Under
  // the clover payloads the old `invoice.subscription` read was absent here
  // too, so the final-failure auto-cancel could never have fired.
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return { success: true, message: "Not a subscription invoice, skipping" };
  }

  const customerId = invoice.customer as string;

  // Get user by Stripe customer ID
  const userWithCredits = await getUserByStripeCustomerId(customerId);
  if (!userWithCredits) {
    log.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;

  // Check if Stripe has exhausted all retries (next_payment_attempt is null)
  const nextAttempt = (invoice as any).next_payment_attempt;
  const isFinalFailure = !nextAttempt;

  if (isFinalFailure) {
    // Final retry exhausted — auto-cancel the subscription and downgrade to free
    log.info(`[Webhook] Final payment failure for user ${userId}, auto-cancelling subscription`);

    // A pending plan-change credit move hanging on THIS invoice will never
    // settle — void it so a declined card's grant stays ungranted and the
    // row stops reading as queued work (#711).
    await voidPlanChangeSettlement(invoice.id as string);

    // ⚠ AND THE INVOICE ITSELF, OR THE TWO SIDES OF THE LEDGER DISAGREE (#756,
    // PR #755 round-2 review finding 2). Voiding the settlement closes the
    // CREDIT side; the invoice stayed `open` and payable through Stripe's
    // hosted invoice page, so a customer could still pay it days later —
    // money accepted, credits never moved (the void row refuses, by design
    // and pinned by the "void survives a late payment" arm), plan already
    // gone. It goes beside the settlement void, not after the cancel, because
    // an invoice that can still take money is the thing being closed here.
    //
    // ⚠ AND ITS VERDICT IS READ, NOT DROPPED (#788, PR #786's round-2 class
    // on this road): `voidInvoice` never throws — a Stripe blip comes back
    // `"failed"` — and a handler that then returns success is ACKed 200 and
    // recorded as processed, so Stripe never redelivers and the invoice stays
    // payable on the hosted page indefinitely. A failed void FAILS THE EVENT
    // below, AFTER the cancel and the downgrade have landed, so Stripe
    // redelivers for ~3 days; on the way back the settlement void and the
    // downgrade are idempotent, `cancelSubscription` on a dead subscription
    // is caught, and `voidInvoice` reads the status first, so a void that has
    // since succeeded costs one read.
    const invoiceVoidVerdict = await voidInvoice(invoice.id as string);

    try {
      await cancelSubscription(subscriptionId);
    } catch (cancelErr) {
      log.error({ err: cancelErr }, `[Webhook] Failed to cancel subscription ${subscriptionId}:`);
    }

    // ⚠ THE DOWNGRADE'S VERDICT IS READ TOO (#792, the class of #788): a
    // downgrade that silently failed left the account on its plan after the
    // card died and the subscription was cancelled at Stripe — nothing after
    // this event corrects it. And it is UNDER A STALE GUARD, because a failed
    // write now fails the event and Stripe redelivers for ~3 days: if the
    // customer has resubscribed by then, the id on record is the NEW one and
    // the retry must not downgrade it. Null on record still downgrades (a
    // `deleted` that landed first clears the id, and the retry is then one
    // idempotent UPDATE). The invoice void, the settlement void and the cancel
    // above are keyed on THIS invoice and THIS subscription, so they run
    // either way.
    const storedSubscriptionId = userWithCredits.credits?.stripeSubscriptionId;
    const isStaleDelivery = !!storedSubscriptionId && storedSubscriptionId !== subscriptionId;
    let downgradeFailed = false;
    if (isStaleDelivery) {
      log.info(
        `[Webhook] Leaving user ${userId}'s plan alone — the failed subscription ${subscriptionId} is not the one on record (${storedSubscriptionId})`,
      );
    } else {
      const downgradeResult = await updateUserSubscription(userId, {
        subscriptionStatus: "canceled",
        planTier: "free",
        stripeSubscriptionId: null,
        billingInterval: null,
        planExpiresAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });
      if (!downgradeResult.success) {
        downgradeFailed = true;
        log.error(
          `[Webhook] Final payment failure for user ${userId} but the downgrade could not be written (${downgradeResult.error}) — failing the event so Stripe redelivers and the downgrade is retried`,
        );
      }
    }

    // Only alert on final failure / auto-cancel
    const userName = userWithCredits.name || userWithCredits.email || `User #${userId}`;
    const amountDue = (invoice as any).amount_due || 0;
    const invoiceCurrency = invoice.currency || "usd";
    const failureMessage = (invoice as any).last_finalization_error?.message
      || (invoice as any).charge?.failure_message
      || "Unknown reason";
    await SlackAlerts.paymentFailed(
      userId,
      userName,
      amountDue,
      invoiceCurrency,
      `FINAL FAILURE — subscription auto-cancelled. Reason: ${failureMessage}`
    );

    log.info(`[Webhook] User ${userId} subscription auto-cancelled after final payment failure`);

    if (downgradeFailed) {
      return {
        success: false,
        message: `Payment failed for user ${userId}, subscription auto-cancelled, but the downgrade could not be written — redeliver to retry`,
      };
    }

    if (invoiceVoidVerdict === "failed") {
      log.error(
        `[Webhook] Invoice ${invoice.id} for user ${userId} could not be voided after the final payment failure — failing the event so Stripe redelivers and the void is retried; the cancel and the downgrade have already landed`,
      );
      return {
        success: false,
        message: `Payment failed for user ${userId}, subscription auto-cancelled, but invoice ${invoice.id} could not be voided — redeliver to retry`,
      };
    }
  } else {
    // Intermediate retry failure — mark as past_due, no alert.
    //
    // ⚠ THIS VERDICT IS READ AND DELIBERATELY NOT MADE TO FAIL THE EVENT
    // (#792 — the one site in the class that is declined, and why): the mark
    // is advisory, and the next invoice event on this subscription rewrites
    // the status either way (`payment_succeeded` → active, the final failure
    // → canceled). A redelivery, on the other hand, can land AFTER the
    // customer's card has since been charged successfully, and a stale
    // `past_due` written over an `active` account flips `hasSubscription`
    // false in `billing.getStatus` — which sends a paying customer to a
    // fresh checkout instead of a plan change. A missing mark costs a flag
    // the next event corrects; a stale one costs a customer money. So a
    // failed write is logged loud and the event is ACKed.
    //
    // ⚠ AND THE MARK IS UNDER THE SAME STALE GUARD AS THE DOWNGRADES (PR
    // #794 round-2 finding 1): the write is keyed on the USER, so a late
    // intermediate failure for an OLD subscription, landing while a NEW
    // active one is on record, would write `past_due` over the active
    // account on its FIRST delivery — the very harm the paragraph above
    // declines to risk on a redelivery. Null on record still marks.
    const storedSubscriptionId = userWithCredits.credits?.stripeSubscriptionId;
    if (storedSubscriptionId && storedSubscriptionId !== subscriptionId) {
      log.info(
        `[Webhook] Leaving user ${userId}'s status alone — the failed subscription ${subscriptionId} is not the one on record (${storedSubscriptionId})`,
      );
    } else {
      const markResult = await updateUserSubscription(userId, {
        subscriptionStatus: "past_due",
      });
      if (markResult.success) {
        log.info(`[Webhook] Payment failed for user ${userId}, marked as past_due (retry scheduled)`);
      } else {
        log.error(
          `[Webhook] Payment failed for user ${userId} but the past_due mark could not be written (${markResult.error}) — ACKing anyway: the next invoice event rewrites the status, and a redelivered mark could land over a since-successful payment`,
        );
      }
    }
  }
  return { success: true, message: `Payment failed for user ${userId}` };
}

/**
 * Handle refund.failed — THE ROAD A REAL REFUND FAILURE ACTUALLY TAKES (#771,
 * founder ruling 2026-09-10, option C's second half: "listen for Stripe
 * telling us later that it failed, and put the credits back").
 *
 * A refund on a change request deducts the customer's credits the moment
 * Stripe ACCEPTS it, and most refunds that fail do so days later — a closed
 * card, a bank rejection — by which time the request reads `approved`, the
 * audit row says issued, and the credits are gone. Until this handler the
 * event was not listened for at all, so the customer lost the credits AND
 * never got the money.
 *
 * What it does, in order, each step surviving the last one failing:
 *  1. finds who and which request from the refund's own metadata (stamped at
 *     creation by `issueStripeRefund`). ⚠ The ids are only meaningful in the
 *     world that wrote them: dev and production share one Stripe account and
 *     one endpoint, so `refund.failed` is in `TAGGED_EVENT_TYPES` and the env
 *     gate before the switch refuses a foreign or untagged refund before this
 *     handler sees it (PR #787 review finding 1). A refund that IS ours but
 *     carries no tracking — a code road that issued it without any — is
 *     REPORTED and not guessed at;
 *  2. puts back exactly the credits that deduction took, keyed on a ledger
 *     reference so a redelivered event cannot restore twice;
 *  3. writes the truth onto the change request's notes, since that is the
 *     screen a support person reads;
 *  4. writes a `billing.stripe_refund_failed` audit row at critical, which
 *     is what puts it on the admin overview's alerts feed and the staff
 *     audit log — production has no Slack webhook, so those panels are the
 *     surface (the login-attack alarm took the same road on his ruling).
 *
 * Returns success when the refund cannot be matched (the event has been
 * recorded where staff will see it, and a redelivery would only write the
 * same row again) — but ⚠ FAILS THE EVENT when the restore itself failed for
 * a reason that is not "already restored" (PR #787 review round 2): a
 * handler that ACKs a restore that did not happen is answered 200, recorded,
 * and never redelivered, so Stripe's ~3 days of free retries against an
 * idempotent restore are forfeited and recovery falls to a person reading
 * the panel. The note and the audit row are written FIRST, so the failed
 * attempt is still visible; the 400 is what brings the event back.
 */
async function handleRefundFailed(refund: Stripe.Refund): Promise<WebhookResult> {
  const amountCents = refund.amount;
  const currency = (refund.currency ?? "usd").toUpperCase();
  const failureReason = refund.failure_reason ?? "not_specified";
  const money = `$${(amountCents / 100).toFixed(2)} ${currency}`;

  const userIdRaw = refund.metadata?.[REFUND_METADATA_USER_KEY];
  const changeRequestIdRaw = refund.metadata?.[REFUND_METADATA_CHANGE_REQUEST_KEY];
  const userId = userIdRaw ? Number(userIdRaw) : NaN;
  const changeRequestId = changeRequestIdRaw ? Number(changeRequestIdRaw) : NaN;

  if (!Number.isInteger(userId) || !Number.isInteger(changeRequestId)) {
    // Not one of ours to unwind — no deduction is keyed to it. Said out loud
    // on the panel rather than guessed at from the charge.
    log.warn(
      `[Webhook] Refund ${refund.id} FAILED (${failureReason}, ${money}) but carries no Drape tracking metadata — no credits moved; a person has to look`,
    );
    // Named rather than inline: `environmentTag.test.ts` scans every inline
    // metadata literal in this directory for the Stripe env tag, and this
    // block goes to OUR audit log, never to Stripe.
    const untrackedDetail = {
      stripeRefundId: refund.id,
      failureReason,
      refundAmountCents: amountCents,
      currency,
      identified: false,
      reason: `Refund ${refund.id} failed (${failureReason}) — not a change-request refund, nothing restored`,
    };
    await logAuditEvent({
      action: AUDIT_ACTIONS.STRIPE_REFUND_FAILED,
      resourceType: "billing",
      resourceId: refund.id,
      metadata: untrackedDetail,
      severity: "critical",
    });
    return { success: true, message: `Refund ${refund.id} failed — untracked, reported for a human` };
  }

  const deductionRef = `cr-stripe-refund:${changeRequestId}`;
  const restoreRef = `cr-stripe-refund-failed:${changeRequestId}`;
  const actions: string[] = [];

  let creditsRestored = 0;
  let restoreFailed = false;
  const deduction = await getCreditTransactionByRef(userId, deductionRef);
  if (deduction && deduction.amount < 0) {
    const creditsToRestore = Math.abs(deduction.amount);
    const restore = await addCredits(
      userId,
      creditsToRestore,
      "refund",
      `Credits restored: Stripe refund ${refund.id} failed (${failureReason}) — ${money} never went back`,
      restoreRef,
    );
    if (restore.success && !restore.duplicate) {
      creditsRestored = creditsToRestore;
      actions.push(`${creditsToRestore} credits restored`);
      log.info(`[Webhook] Restored ${creditsToRestore} credits to user ${userId} — refund ${refund.id} failed`);
    } else if (restore.duplicate) {
      actions.push("credits already restored (duplicate)");
      log.info(`[Webhook] Credits already restored for refund ${refund.id} (duplicate delivery)`);
    } else {
      restoreFailed = true;
      actions.push(`credit restore failed: ${restore.error}`);
      log.error(`[Webhook] Failed to restore credits to user ${userId} after refund ${refund.id} failed: ${restore.error}`);
    }
  } else {
    // A refund whose request deducted nothing (balance already spent) has
    // nothing to put back; the money still did not go, so it is still a row.
    actions.push("no credit deduction on record to restore");
    log.info(`[Webhook] Refund ${refund.id} failed; no deduction keyed ${deductionRef} for user ${userId} — nothing to restore`);
  }

  const noted = await appendChangeRequestReviewNote(
    changeRequestId,
    `⚠ Stripe refund ${refund.id} FAILED (${failureReason}) on ${new Date().toISOString()} — ${money} never went back to the customer. ${creditsRestored > 0 ? `${creditsRestored} credits restored.` : "No credits were restored."} Needs a person.`,
  );
  if (!noted.success) {
    actions.push(`note not written: ${noted.error}`);
    log.error(`[Webhook] Could not annotate change request ${changeRequestId} after refund ${refund.id} failed: ${noted.error}`);
  }

  const detail = {
    targetUserId: userId,
    changeRequestId,
    stripeRefundId: refund.id,
    failureReason,
    refundAmountCents: amountCents,
    currency,
    creditsRestored,
    identified: true,
    reason: `Refund ${refund.id} failed (${failureReason}) — ${money} never went back; ${actions.join(", ")}`,
  };
  await logAuditEvent({
    action: AUDIT_ACTIONS.STRIPE_REFUND_FAILED,
    resourceType: "billing",
    resourceId: refund.id,
    metadata: detail,
    severity: "critical",
  });

  if (restoreFailed) {
    return {
      success: false,
      message: `Refund ${refund.id} failed for user #${userId} (CR #${changeRequestId}) — ${actions.join(", ")}; failing the event so Stripe redelivers and the restore is retried`,
    };
  }

  return {
    success: true,
    message: `Refund ${refund.id} failed for user #${userId} (CR #${changeRequestId}) — ${actions.join(", ")}`,
  };
}

/**
 * Handle charge.dispute.created event
 * Sends a critical Slack alert when a chargeback/dispute is filed.
 */
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<WebhookResult> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id || "unknown";
  const amount = dispute.amount; // in cents
  const currency = dispute.currency;
  const reason = dispute.reason || "not_specified";
  const disputeRef = `dispute_${dispute.id}`;

  // Try to identify the user from the customer field
  let userId: number | undefined;
  let userName: string | undefined;
  let userCreditsBalance: number | undefined;
  let stripeSubscriptionId: string | null | undefined;

  const disputeCustomerId = (dispute as any).customer as string | undefined;

  if (disputeCustomerId) {
    const userWithCredits = await getUserByStripeCustomerId(disputeCustomerId);
    if (userWithCredits) {
      userId = userWithCredits.id;
      userName = userWithCredits.name || userWithCredits.email || `User #${userWithCredits.id}`;
      userCreditsBalance = userWithCredits.credits?.balance;
      stripeSubscriptionId = userWithCredits.credits?.stripeSubscriptionId;
    }
  }

  // Send critical Slack alert (always, even if user not identified)
  await SlackAlerts.chargebackFiled(
    dispute.id,
    chargeId,
    amount,
    currency,
    reason,
    userId,
    userName
  );

  // If we identified the user, auto-suspend and revoke credits.
  //
  // ⚠ BOTH VERDICTS ARE READ, NOT DROPPED (#792, the class of #788/#789):
  // `suspendUser` and `deductCredits` never throw — a failure comes back
  // `{ success: false }` — and a handler that then returned success was
  // ACKed 200 and recorded, so Stripe never redelivered and a chargeback
  // could leave the account NOT suspended and its credits NOT frozen: the
  // protective control this handler exists for, silently absent. A failed
  // suspend or revoke FAILS THE EVENT below, after the alert has gone out,
  // and Stripe redelivers for ~3 days. On the way back: the suspend is one
  // idempotent UPDATE; the revoke is skipped when its ledger row already
  // exists (read by ref, below), because the amount is re-read from the
  // live balance and a balance that moved since the first revoke would
  // otherwise classify as a reference COLLISION rather than a duplicate.
  const actions: string[] = [];
  let mustRedeliver = false;
  if (userId) {
    // 1. Suspend the user account
    //    Using userId 0 as "system" since this is an automated action
    const suspendResult = await suspendUser(userId, `Chargeback filed: ${dispute.id} — $${(amount / 100).toFixed(2)} ${currency.toUpperCase()} — reason: ${reason}`, 0);
    if (suspendResult.success) {
      actions.push("account suspended");
      log.info(`[Webhook] User ${userId} auto-suspended due to dispute ${dispute.id}`);
    } else {
      mustRedeliver = true;
      actions.push(`suspend failed: ${suspendResult.error}`);
      log.error(`[Webhook] Failed to suspend user ${userId}: ${suspendResult.error}`);
    }

    // 2. Revoke credits — as a safe approach, revoke the user's entire current balance (they can be restored on win).
    //    The ledger row on `dispute_{disputeId}` is the idempotency: a
    //    redelivery that finds it already written revokes nothing more.
    const priorRevoke = await getCreditTransactionByRef(userId, disputeRef);
    const currentBalance = userCreditsBalance ?? 0;
    if (priorRevoke) {
      actions.push(`${Math.abs(priorRevoke.amount)} credits already revoked`);
      log.info(`[Webhook] Credits already revoked for dispute ${dispute.id} (ledger row ${priorRevoke.id}) — nothing more to revoke`);
    } else if (currentBalance > 0) {
      const revokeResult = await deductCredits(
        userId,
        currentBalance,
        "refund",
        `Credits frozen: chargeback ${dispute.id} — $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`,
        disputeRef,
        // Not a tool spend: this revoke freezes a disputed balance and makes
        // nothing. One of the two deliberate null-toolKind sites (#401, #664
        // — the other is the plan-change unwind in routes/billing.ts).
        { toolKind: null }
      );
      if (revokeResult.success) {
        actions.push(`${currentBalance} credits revoked`);
        log.info(`[Webhook] Revoked ${currentBalance} credits from user ${userId} (dispute ${dispute.id}). New balance: ${revokeResult.newBalance}`);
      } else if (revokeResult.duplicate) {
        // Raced by a concurrent delivery: the row landed between the read
        // above and this write. A collision (same ref, different amount) is
        // named as such — a redelivery cannot clear it, so the event is
        // still ACKed and the truth is in the message and the log.
        actions.push(revokeResult.collision ? "credit revoke collided with an existing ledger row" : "credits already revoked");
        log.warn(`[Webhook] Revoke for dispute ${dispute.id} met an existing ledger row (${revokeResult.error})`);
      } else {
        mustRedeliver = true;
        actions.push(`credit revoke failed: ${revokeResult.error}`);
        log.error(`[Webhook] Failed to revoke credits from user ${userId}: ${revokeResult.error}`);
      }
    } else {
      actions.push("0 credits — nothing to revoke");
      log.info(`[Webhook] User ${userId} has 0 credits — no credits to revoke for dispute ${dispute.id}`);
    }
  }

  log.info(`[Webhook] Dispute created: ${dispute.id}, amount: ${amount} ${currency}, reason: ${reason}, userId: ${userId || "unknown"}, actions: ${actions.join(", ")}`);

  if (mustRedeliver) {
    log.error(
      `[Webhook] Dispute ${dispute.id} filed against user ${userId} but the protective actions did not all land (${actions.join(", ")}) — failing the event so Stripe redelivers and they are retried`,
    );
    return {
      success: false,
      message: `Dispute ${dispute.id} filed — user #${userId}: ${actions.join(", ")}; failing the event so Stripe redelivers and the retry lands what did not`,
    };
  }

  return {
    success: true,
    message: `Dispute ${dispute.id} filed — user ${userId ? `#${userId}: ${actions.join(", ")}` : "not identified"} — Slack alert sent`,
  };
}

/**
 * Handle charge.dispute.closed event
 * On win: unsuspend user + restore credits.
 * On loss: keep suspended + cancel Stripe subscription.
 */
async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<WebhookResult> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id || "unknown";
  const amount = dispute.amount;
  const currency = dispute.currency;
  const status = dispute.status; // "won", "lost", "warning_closed", etc.
  const disputeRef = `dispute_${dispute.id}`;
  const restoreRef = `dispute_restore_${dispute.id}`;

  // Try to identify the user
  let userId: number | undefined;
  let userName: string | undefined;
  let stripeSubscriptionId: string | null | undefined;

  const disputeCustomerId = (dispute as any).customer as string | undefined;

  if (disputeCustomerId) {
    const userWithCredits = await getUserByStripeCustomerId(disputeCustomerId);
    if (userWithCredits) {
      userId = userWithCredits.id;
      userName = userWithCredits.name || userWithCredits.email || `User #${userWithCredits.id}`;
      stripeSubscriptionId = userWithCredits.credits?.stripeSubscriptionId;
    }
  }

  // Send Slack alert with outcome
  await SlackAlerts.chargebackResolved(
    dispute.id,
    chargeId,
    amount,
    currency,
    status,
    userId,
    userName
  );

  const actions: string[] = [];
  // ⚠ A restore that did not happen must FAIL THE EVENT (#789, PR #787's
  // round-2 class on this road): `addCredits` catches its own errors and
  // returns `{ success: false }`, and a handler that then returns success is
  // ACKed 200 and recorded as processed — Stripe never redelivers, and a
  // customer who WON their chargeback stays without their credits until a
  // person notices. The restore is idempotent on `dispute_restore_<id>`, so
  // Stripe's ~3 days of free redeliveries are exactly the retry it needs.
  // The alert still lands on the first attempt; only the verdict at the end
  // changes.
  //
  // ⚠ AND THE UNSUSPEND AND THE LOST-ROAD CANCEL ARE READ THE SAME WAY
  // (#792, the class of #789 on this same road): `unsuspendUser` returns
  // `{ success: false }` and `cancelSubscription` returns `false`, and both
  // were logged and ACKed — a customer who WON stayed suspended; a customer
  // who LOST kept a running subscription. The unsuspend is one idempotent
  // UPDATE and the cancel sets `cancel_at_period_end` (setting it twice is
  // the same call), so the ~3 days of redeliveries are the retry for both.
  // The cancel's one un-retryable case is a subscription Stripe has already
  // fully cancelled while our record still holds its id — a stale record,
  // which IS the finding; the redeliveries stop on their own after ~3 days.
  let mustRedeliver = false;

  if (userId && status === "won") {
    // DISPUTE WON: Restore the user's account and credits
    // 1. Unsuspend the user
    const unsuspendResult = await unsuspendUser(userId);
    if (unsuspendResult.success) {
      actions.push("account restored");
      log.info(`[Webhook] User ${userId} unsuspended after winning dispute ${dispute.id}`);
    } else {
      mustRedeliver = true;
      actions.push(`unsuspend failed: ${unsuspendResult.error}`);
      log.error(`[Webhook] Failed to unsuspend user ${userId}: ${unsuspendResult.error}`);
    }

    // 2. Restore the revoked credits
    //    Look up how many credits were deducted by the dispute_created handler
    //    by finding the transaction with referenceId `dispute_{disputeId}`
    const revokeTransaction = await getCreditTransactionByRef(userId, disputeRef);
    if (revokeTransaction && revokeTransaction.amount < 0) {
      const creditsToRestore = Math.abs(revokeTransaction.amount);
      const restoreResult = await addCredits(
        userId,
        creditsToRestore,
        "refund",
        `Credits restored: dispute ${dispute.id} won — $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`,
        restoreRef
      );
      if (restoreResult.success && !restoreResult.duplicate) {
        actions.push(`${creditsToRestore} credits restored`);
        log.info(`[Webhook] Restored ${creditsToRestore} credits to user ${userId} after winning dispute ${dispute.id}`);
      } else if (restoreResult.duplicate) {
        actions.push("credits already restored (duplicate)");
        log.info(`[Webhook] Credits already restored for dispute ${dispute.id} (duplicate)`);
      } else {
        mustRedeliver = true;
        actions.push(`credit restore failed: ${restoreResult.error}`);
        log.error(`[Webhook] Failed to restore credits for user ${userId}: ${restoreResult.error}`);
      }
    } else {
      actions.push("no revoked credits found to restore");
      log.info(`[Webhook] No revoked credits found for dispute ${dispute.id} — nothing to restore`);
    }
  } else if (userId && status === "lost") {
    // DISPUTE LOST: Keep suspended, cancel subscription
    actions.push("account remains suspended");

    // Cancel the user's Stripe subscription if they have one
    if (stripeSubscriptionId) {
      const cancelResult = await cancelSubscription(stripeSubscriptionId);
      if (cancelResult) {
        actions.push("subscription cancelled");
        log.info(`[Webhook] Cancelled subscription ${stripeSubscriptionId} for user ${userId} after losing dispute ${dispute.id}`);
      } else {
        mustRedeliver = true;
        actions.push("subscription cancel failed");
        log.error(`[Webhook] Failed to cancel subscription ${stripeSubscriptionId} for user ${userId}`);
      }
    } else {
      actions.push("no active subscription");
    }
  } else if (userId) {
    // Other statuses (warning_closed, etc.) — log but don't auto-action
    actions.push(`status: ${status} — no automatic action taken`);
  }

  log.info(`[Webhook] Dispute closed: ${dispute.id}, status: ${status}, userId: ${userId || "unknown"}, actions: ${actions.join(", ")}`);

  if (mustRedeliver) {
    log.error(
      `[Webhook] Dispute ${dispute.id} closed (${status}) for user ${userId} but not every action landed (${actions.join(", ")}) — failing the event so Stripe redelivers and the retry lands what did not`,
    );
    return {
      success: false,
      message: `Dispute ${dispute.id} closed (${status}) — ${actions.join(", ")}; failing the event so Stripe redelivers and the retry lands what did not`,
    };
  }

  return {
    success: true,
    message: `Dispute ${dispute.id} closed (${status}) — ${userId ? actions.join(", ") : "user not identified"} — Slack alert sent`,
  };
}
