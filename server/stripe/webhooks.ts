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
} from "../db";
import { SlackAlerts } from "../slack/slackNotification";
import { SubscriptionPlan } from "./stripeProducts";
import { PlanTier, stripeWebhookEvents } from "../../drizzle/schema";
import { subscriptionPeriodSec } from "./subscriptionPeriods";
import { invoiceSubscriptionId, periodBought } from "./invoiceLines";
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

  // Update subscription in database
  await updateUserSubscription(userId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: mapStripeStatus(subscription.status),
    planTier: planTier as PlanTier,
    billingInterval,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    planExpiresAt: new Date(periodEnd * 1000),
  });

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

  // Downgrade to free tier
  await updateUserSubscription(userId, {
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    planTier: "free",
    billingInterval: null,
    planExpiresAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  });

  log.info(`[Webhook] Subscription deleted for user ${userId} (was ${previousPlan}), downgraded to free tier`);
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

  // Get current credits to calculate rollover
  const currentCredits = await getUserCredits(userId);
  if (!currentCredits) {
    return { success: false, message: "User credits not found" };
  }

  // ⚠ AN EARLY RENEWAL CARRIES THE BALANCE THROUGH IN FULL — because the
  // UNWIND lives in changePlan, not here (#664 review finding 1). An interval
  // switch's anchor reset invoices the new period with billing_reason
  // "subscription_update"; changePlan has already deducted the unconsumed
  // share of the OLD period's grant, mirroring the money credit Stripe issued
  // for the same days. So what remains on the balance at this point is
  // allowance the customer has genuinely paid for and kept — rolling it at
  // the plan's percentage would forfeit paid-for credits, and rolling it in
  // full mints nothing (the mint was the missing unwind, and it is no longer
  // missing). A cycle that RUNS OUT still keeps only its percentage.
  // Ordering: this set (grant + full balance) and changePlan's deduct
  // commute, because a 100% rollover makes this write purely additive.
  const unusedCredits = currentCredits.balance;
  const rolloverCredits =
    billingReason === "subscription_update"
      ? unusedCredits
      : calculateRolloverCredits(unusedCredits, planTier as PlanTier);

  const grantCredits = getMonthlyCredits(planTier as PlanTier) * grantMonths;

  // Refresh credits
  const result = await refreshMonthlyCredits(
    userId,
    grantCredits,
    rolloverCredits,
    `stripe-invoice:${invoice.id}`,
    grantMonths === 12
      ? `Annual credit grant — 12 months up front (${grantCredits} credits + ${rolloverCredits} rollover)`
      : undefined,
  );

  if (!result.success) {
    return { success: false, message: "Failed to refresh credits", error: result.error };
  }

  log.info(
    `[Webhook] Refreshed credits for user ${userId}: ${grantCredits} (${grantMonths} month${grantMonths === 1 ? "" : "s"} bought) + ${rolloverCredits} rollover = ${result.newBalance}`,
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

    try {
      await cancelSubscription(subscriptionId);
    } catch (cancelErr) {
      log.error({ err: cancelErr }, `[Webhook] Failed to cancel subscription ${subscriptionId}:`);
    }

    await updateUserSubscription(userId, {
      subscriptionStatus: "canceled",
      planTier: "free",
      stripeSubscriptionId: null,
      planExpiresAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });

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
  } else {
    // Intermediate retry failure — mark as past_due, no alert
    await updateUserSubscription(userId, {
      subscriptionStatus: "past_due",
    });

    log.info(`[Webhook] Payment failed for user ${userId}, marked as past_due (retry scheduled)`);
  }
  return { success: true, message: `Payment failed for user ${userId}` };
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

  // If we identified the user, auto-suspend and revoke credits
  if (userId) {
    // 1. Suspend the user account
    //    Using userId 0 as "system" since this is an automated action
    const suspendResult = await suspendUser(userId, `Chargeback filed: ${dispute.id} — $${(amount / 100).toFixed(2)} ${currency.toUpperCase()} — reason: ${reason}`, 0);
    if (suspendResult.success) {
      log.info(`[Webhook] User ${userId} auto-suspended due to dispute ${dispute.id}`);
    } else {
      log.error(`[Webhook] Failed to suspend user ${userId}: ${suspendResult.error}`);
    }

    // 2. Revoke credits — as a safe approach, revoke the user's entire current balance (they can be restored on win).
    //    The idempotency referenceId `dispute_{disputeId}` prevents double-revocation on webhook replays.
    const currentBalance = userCreditsBalance ?? 0;
    if (currentBalance > 0) {
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
        log.info(`[Webhook] Revoked ${currentBalance} credits from user ${userId} (dispute ${dispute.id}). New balance: ${revokeResult.newBalance}`);
      } else {
        log.error(`[Webhook] Failed to revoke credits from user ${userId}: ${revokeResult.error}`);
      }
    } else {
      log.info(`[Webhook] User ${userId} has 0 credits — no credits to revoke for dispute ${dispute.id}`);
    }
  }

  log.info(`[Webhook] Dispute created: ${dispute.id}, amount: ${amount} ${currency}, reason: ${reason}, userId: ${userId || "unknown"}`);
  return {
    success: true,
    message: `Dispute ${dispute.id} filed — user ${userId ? `#${userId} suspended, ${userCreditsBalance ?? 0} credits revoked` : "not identified"} — Slack alert sent`,
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

  if (userId && status === "won") {
    // DISPUTE WON: Restore the user's account and credits
    // 1. Unsuspend the user
    const unsuspendResult = await unsuspendUser(userId);
    if (unsuspendResult.success) {
      actions.push("account restored");
      log.info(`[Webhook] User ${userId} unsuspended after winning dispute ${dispute.id}`);
    } else {
      actions.push(`unsuspend failed: ${unsuspendResult.error}`);
      log.error(`[Webhook] Failed to unsuspend user ${userId}: ${unsuspendResult.error}`);
    }

    // 2. Restore the revoked credits
    //    Look up how many credits were deducted by the dispute_created handler
    //    by finding the transaction with referenceId `dispute_{disputeId}`
    const { getCreditTransactionByRef } = await import("../db");
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
  return {
    success: true,
    message: `Dispute ${dispute.id} closed (${status}) — ${userId ? actions.join(", ") : "user not identified"} — Slack alert sent`,
  };
}
