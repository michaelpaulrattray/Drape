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
} from "./stripeService";
import { 
  updateUserSubscription, 
  getUserByStripeCustomerId, 
  refreshMonthlyCredits,
  addTopupCredits,
  getUserCredits,
} from "./db";
import { CREDIT_TOPUP_PRODUCTS, SubscriptionPlan, CreditTopupPackage } from "./stripeProducts";
import { PlanTier } from "../drizzle/schema";

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

    console.log(`[Webhook] Added ${credits} credits to user ${userId} from top-up`);
    return { success: true, message: `Added ${credits} credits to user ${userId}` };
  }

  // For subscriptions, the subscription.created event will handle the rest
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

  // Downgrade to free tier
  await updateUserSubscription(userId, {
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    planTier: "free",
    planExpiresAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  });

  console.log(`[Webhook] Subscription deleted for user ${userId}, downgraded to free tier`);
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

  // Update subscription status to past_due
  await updateUserSubscription(userId, {
    subscriptionStatus: "past_due",
  });

  console.log(`[Webhook] Payment failed for user ${userId}, marked as past_due`);
  return { success: true, message: `Payment failed for user ${userId}` };
}
