/**
 * Stripe Service
 * 
 * Handles all Stripe integration for subscriptions and one-time payments.
 */

import Stripe from "stripe";
import { ENV } from "./_core/env";
import { SUBSCRIPTION_PRODUCTS, CREDIT_TOPUP_PRODUCTS, SubscriptionPlan, CreditTopupPackage } from "./stripeProducts";
import { PLAN_TIERS, PlanTier } from "../drizzle/schema";

// Initialize Stripe client
const stripe = new Stripe(ENV.stripeSecretKey);

export { stripe };

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  userId: number,
  email: string,
  name?: string,
  existingCustomerId?: string | null
): Promise<string> {
  // If we already have a customer ID, verify it exists
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) {
        return existingCustomerId;
      }
    } catch (error) {
      console.log(`[Stripe] Customer ${existingCustomerId} not found, creating new one`);
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      userId: userId.toString(),
    },
  });

  console.log(`[Stripe] Created customer ${customer.id} for user ${userId}`);
  return customer.id;
}

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createSubscriptionCheckoutSession(
  customerId: string,
  plan: SubscriptionPlan,
  successUrl: string,
  cancelUrl: string,
  userId: number
): Promise<string> {
  const product = SUBSCRIPTION_PRODUCTS[plan];
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.priceInCents,
          recurring: {
            interval: product.interval,
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId.toString(),
      plan,
      type: "subscription",
    },
    subscription_data: {
      metadata: {
        userId: userId.toString(),
        plan,
      },
    },
  });

  console.log(`[Stripe] Created subscription checkout session ${session.id} for plan ${plan}`);
  return session.url!;
}

/**
 * Create a Stripe Checkout session for credit top-up
 */
export async function createTopupCheckoutSession(
  customerId: string,
  packageId: CreditTopupPackage,
  successUrl: string,
  cancelUrl: string,
  userId: number
): Promise<string> {
  const topupPackage = CREDIT_TOPUP_PRODUCTS[packageId];
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: topupPackage.name,
            description: topupPackage.description,
          },
          unit_amount: topupPackage.priceInCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId.toString(),
      packageId,
      credits: topupPackage.credits.toString(),
      type: "topup",
    },
  });

  console.log(`[Stripe] Created topup checkout session ${session.id} for ${topupPackage.credits} credits`);
  return session.url!;
}

/**
 * Create a Stripe Customer Portal session for subscription management
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  console.log(`[Stripe] Created customer portal session for customer ${customerId}`);
  return session.url;
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscriptionDetails(subscriptionId: string): Promise<{
  status: Stripe.Subscription.Status;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: SubscriptionPlan | null;
  cancelAtPeriodEnd: boolean;
} | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Extract plan from metadata
    const plan = (subscription.metadata.plan as SubscriptionPlan) || null;
    
    // Access period timestamps from the subscription object
    const periodStart = (subscription as any).current_period_start || Math.floor(Date.now() / 1000);
    const periodEnd = (subscription as any).current_period_end || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    
    return {
      status: subscription.status,
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      plan,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  } catch (error) {
    console.error(`[Stripe] Failed to get subscription ${subscriptionId}:`, error);
    return null;
  }
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    console.log(`[Stripe] Subscription ${subscriptionId} set to cancel at period end`);
    return true;
  } catch (error) {
    console.error(`[Stripe] Failed to cancel subscription ${subscriptionId}:`, error);
    return false;
  }
}

/**
 * Reactivate a subscription that was set to cancel
 */
export async function reactivateSubscription(subscriptionId: string): Promise<boolean> {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    console.log(`[Stripe] Subscription ${subscriptionId} reactivated`);
    return true;
  } catch (error) {
    console.error(`[Stripe] Failed to reactivate subscription ${subscriptionId}:`, error);
    return false;
  }
}

/**
 * Construct and verify a Stripe webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    ENV.stripeWebhookSecret
  );
}

/**
 * Map Stripe subscription status to our database status
 */
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "canceled" | "past_due" | "unpaid" | "trialing" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "trialing":
      return "trialing";
    default:
      return "canceled";
  }
}

/**
 * Map plan name to PlanTier
 */
export function mapPlanToTier(plan: SubscriptionPlan): PlanTier {
  return plan as PlanTier;
}

/**
 * Calculate rollover credits based on plan tier
 */
export function calculateRolloverCredits(
  unusedCredits: number,
  planTier: PlanTier
): number {
  const tierConfig = PLAN_TIERS[planTier];
  const rolloverPercent = tierConfig.rolloverPercent;
  return Math.floor(unusedCredits * (rolloverPercent / 100));
}

/**
 * Get monthly credits for a plan tier
 */
export function getMonthlyCredits(planTier: PlanTier): number {
  return PLAN_TIERS[planTier].monthlyCredits;
}
