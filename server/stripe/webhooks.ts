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
  addTopupCredits,
  getUserCredits,
  suspendUser,
  unsuspendUser,
  deductCredits,
  addCredits,
  creditReferrerOnPaidAction,
} from "../db";
import { SlackAlerts } from "../slack/slackNotification";
import { CREDIT_TOPUP_PRODUCTS, SubscriptionPlan, CreditTopupPackage } from "./stripeProducts";
import { PlanTier } from "../../drizzle/schema";

export interface WebhookResult {
  success: boolean;
  message: string;
  error?: string;
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
    console.error("[Webhook] Failed to verify signature:", error);
    return { success: false, message: "Invalid signature", error: String(error) };
  }

  console.log(`[Webhook] Processing event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        return await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);

      case "customer.subscription.created":
      case "customer.subscription.updated":
        return await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);

      case "customer.subscription.deleted":
        return await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);

      case "invoice.payment_succeeded":
        return await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);

      case "invoice.payment_failed":
        return await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);

      case "charge.dispute.created":
        return await handleDisputeCreated(event.data.object as Stripe.Dispute);

      case "charge.dispute.closed":
        return await handleDisputeClosed(event.data.object as Stripe.Dispute);

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        return { success: true, message: `Unhandled event type: ${event.type}` };
    }
  } catch (error) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    return { success: false, message: `Error processing ${event.type}`, error: String(error) };
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

  if (type === "topup") {
    // Handle credit top-up
    const packageId = session.metadata?.packageId as CreditTopupPackage;
    const credits = parseInt(session.metadata?.credits || "0", 10);

    if (!packageId || !credits) {
      return { success: false, message: "Missing package info in session metadata" };
    }

    const result = await addTopupCredits(userId, credits, session.id);
    
    if (!result.success) {
      return { success: false, message: "Failed to add credits", error: result.error };
    }

    if (result.duplicate) {
      console.warn(`[Webhook] Duplicate checkout session ${session.id} for user ${userId} — credits already granted. Skipping.`);
      return { success: true, message: `Duplicate session ${session.id}, credits already granted` };
    }

    console.log(`[Webhook] Added ${credits} credits to user ${userId} from top-up`);
    return { success: true, message: `Added ${credits} credits to user ${userId}` };
  }

  // For subscriptions — trigger referral credit for referrer on first paid action
  try {
    const credited = await creditReferrerOnPaidAction(userId);
    if (credited) {
      console.log(`[Webhook] Referrer credited for user ${userId}'s first paid subscription`);
    }
  } catch (err) {
    console.error(`[Webhook] Failed to credit referrer for user ${userId}:`, err);
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
    console.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;
  const planTier = plan ? mapPlanToTier(plan) : (userWithCredits.credits?.planTier || "free");

  // Access period timestamps from the subscription object
  const periodStart = (subscription as any).current_period_start || Math.floor(Date.now() / 1000);
  const periodEnd = (subscription as any).current_period_end || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // Update subscription in database
  await updateUserSubscription(userId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: mapStripeStatus(subscription.status),
    planTier: planTier as PlanTier,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    planExpiresAt: new Date(periodEnd * 1000),
  });

  console.log(`[Webhook] Updated subscription for user ${userId}: ${planTier} (${subscription.status})`);
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
    console.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;

  const previousPlan = userWithCredits.credits?.planTier || "unknown";

  // Downgrade to free tier
  await updateUserSubscription(userId, {
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    planTier: "free",
    planExpiresAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  });

  console.log(`[Webhook] Subscription deleted for user ${userId} (was ${previousPlan}), downgraded to free tier`);
  return { success: true, message: `Subscription deleted for user ${userId}` };
}

/**
 * Handle invoice.payment_succeeded event (monthly credit refresh)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<WebhookResult> {
  // Only process subscription invoices
  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) {
    return { success: true, message: "Not a subscription invoice, skipping" };
  }

  const customerId = invoice.customer as string;

  // Get user by Stripe customer ID
  const userWithCredits = await getUserByStripeCustomerId(customerId);
  if (!userWithCredits) {
    console.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;
  const planTier = userWithCredits.credits?.planTier || "free";

  // Skip if free tier (shouldn't happen but just in case)
  if (planTier === "free") {
    return { success: true, message: "Free tier, no credits to refresh" };
  }

  // Get current credits to calculate rollover
  const currentCredits = await getUserCredits(userId);
  if (!currentCredits) {
    return { success: false, message: "User credits not found" };
  }

  // Calculate rollover based on plan tier
  const unusedCredits = currentCredits.balance;
  const rolloverCredits = calculateRolloverCredits(unusedCredits, planTier as PlanTier);
  const monthlyCredits = getMonthlyCredits(planTier as PlanTier);

  // Refresh credits
  const result = await refreshMonthlyCredits(userId, monthlyCredits, rolloverCredits);
  
  if (!result.success) {
    return { success: false, message: "Failed to refresh credits", error: result.error };
  }

  console.log(`[Webhook] Refreshed credits for user ${userId}: ${monthlyCredits} + ${rolloverCredits} rollover = ${result.newBalance}`);
  return { success: true, message: `Refreshed credits for user ${userId}` };
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookResult> {
  // Only process subscription invoices
  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) {
    return { success: true, message: "Not a subscription invoice, skipping" };
  }

  const customerId = invoice.customer as string;

  // Get user by Stripe customer ID
  const userWithCredits = await getUserByStripeCustomerId(customerId);
  if (!userWithCredits) {
    console.error(`[Webhook] No user found for customer ${customerId}`);
    return { success: false, message: `No user found for customer ${customerId}` };
  }

  const userId = userWithCredits.id;

  // Check if Stripe has exhausted all retries (next_payment_attempt is null)
  const nextAttempt = (invoice as any).next_payment_attempt;
  const isFinalFailure = !nextAttempt;

  if (isFinalFailure) {
    // Final retry exhausted — auto-cancel the subscription and downgrade to free
    console.log(`[Webhook] Final payment failure for user ${userId}, auto-cancelling subscription`);

    try {
      await cancelSubscription(subscriptionId);
    } catch (cancelErr) {
      console.error(`[Webhook] Failed to cancel subscription ${subscriptionId}:`, cancelErr);
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

    console.log(`[Webhook] User ${userId} subscription auto-cancelled after final payment failure`);
  } else {
    // Intermediate retry failure — mark as past_due, no alert
    await updateUserSubscription(userId, {
      subscriptionStatus: "past_due",
    });

    console.log(`[Webhook] Payment failed for user ${userId}, marked as past_due (retry scheduled)`);
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
      console.log(`[Webhook] User ${userId} auto-suspended due to dispute ${dispute.id}`);
    } else {
      console.error(`[Webhook] Failed to suspend user ${userId}: ${suspendResult.error}`);
    }

    // 2. Revoke credits — calculate how many credits the disputed amount corresponds to
    //    We use the dispute amount in cents. For topups, we stored the credit count in the transaction.
    //    As a safe approach, revoke the user's entire current balance (they can be restored on win).
    //    The idempotency referenceId `dispute_{disputeId}` prevents double-revocation on webhook replays.
    const currentBalance = userCreditsBalance ?? 0;
    if (currentBalance > 0) {
      const revokeResult = await deductCredits(
        userId,
        currentBalance,
        "refund",
        `Credits frozen: chargeback ${dispute.id} — $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`,
        disputeRef
      );
      if (revokeResult.success) {
        console.log(`[Webhook] Revoked ${currentBalance} credits from user ${userId} (dispute ${dispute.id}). New balance: ${revokeResult.newBalance}`);
      } else {
        console.error(`[Webhook] Failed to revoke credits from user ${userId}: ${revokeResult.error}`);
      }
    } else {
      console.log(`[Webhook] User ${userId} has 0 credits — no credits to revoke for dispute ${dispute.id}`);
    }
  }

  console.log(`[Webhook] Dispute created: ${dispute.id}, amount: ${amount} ${currency}, reason: ${reason}, userId: ${userId || "unknown"}`);
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
      console.log(`[Webhook] User ${userId} unsuspended after winning dispute ${dispute.id}`);
    } else {
      actions.push(`unsuspend failed: ${unsuspendResult.error}`);
      console.error(`[Webhook] Failed to unsuspend user ${userId}: ${unsuspendResult.error}`);
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
        console.log(`[Webhook] Restored ${creditsToRestore} credits to user ${userId} after winning dispute ${dispute.id}`);
      } else if (restoreResult.duplicate) {
        actions.push("credits already restored (duplicate)");
        console.log(`[Webhook] Credits already restored for dispute ${dispute.id} (duplicate)`);
      } else {
        actions.push(`credit restore failed: ${restoreResult.error}`);
        console.error(`[Webhook] Failed to restore credits for user ${userId}: ${restoreResult.error}`);
      }
    } else {
      actions.push("no revoked credits found to restore");
      console.log(`[Webhook] No revoked credits found for dispute ${dispute.id} — nothing to restore`);
    }
  } else if (userId && status === "lost") {
    // DISPUTE LOST: Keep suspended, cancel subscription
    actions.push("account remains suspended");

    // Cancel the user's Stripe subscription if they have one
    if (stripeSubscriptionId) {
      const cancelResult = await cancelSubscription(stripeSubscriptionId);
      if (cancelResult) {
        actions.push("subscription cancelled");
        console.log(`[Webhook] Cancelled subscription ${stripeSubscriptionId} for user ${userId} after losing dispute ${dispute.id}`);
      } else {
        actions.push("subscription cancel failed");
        console.error(`[Webhook] Failed to cancel subscription ${stripeSubscriptionId} for user ${userId}`);
      }
    } else {
      actions.push("no active subscription");
    }
  } else if (userId) {
    // Other statuses (warning_closed, etc.) — log but don't auto-action
    actions.push(`status: ${status} — no automatic action taken`);
  }

  console.log(`[Webhook] Dispute closed: ${dispute.id}, status: ${status}, userId: ${userId || "unknown"}, actions: ${actions.join(", ")}`);
  return {
    success: true,
    message: `Dispute ${dispute.id} closed (${status}) — ${userId ? actions.join(", ") : "user not identified"} — Slack alert sent`,
  };
}
