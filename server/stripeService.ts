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
  userId: number,
  interval: "monthly" | "annual" = "monthly"
): Promise<string> {
  const product = SUBSCRIPTION_PRODUCTS[plan];
  
  // Calculate price based on interval
  // Annual billing gets 17% discount
  const isAnnual = interval === "annual";
  const monthlyPrice = product.priceInCents;
  const unitAmount = isAnnual 
    ? Math.round(monthlyPrice * 12 * 0.83) // 17% off annual
    : monthlyPrice;
  const billingInterval = isAnnual ? "year" : "month";
  const planName = isAnnual 
    ? `${product.name} (Annual)` 
    : product.name;
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: planName,
            description: product.description,
          },
          unit_amount: unitAmount,
          recurring: {
            interval: billingInterval,
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
      interval,
      type: "subscription",
    },
    subscription_data: {
      metadata: {
        userId: userId.toString(),
        plan,
        interval,
      },
    },
  });

  console.log(`[Stripe] Created ${interval} subscription checkout session ${session.id} for plan ${plan}`);
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


/**
 * Calculate prorated amount for plan change
 * Returns the amount in cents that will be charged/credited
 */
export async function calculateProration(
  subscriptionId: string,
  newPlan: SubscriptionPlan
): Promise<{
  proratedAmount: number;
  isUpgrade: boolean;
  immediateCharge: number;
  creditBalance: number;
  newPlanPrice: number;
  currentPlanPrice: number;
  daysRemaining: number;
  totalDays: number;
} | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get current plan from metadata
    const currentPlan = subscription.metadata.plan as SubscriptionPlan | undefined;
    if (!currentPlan) {
      console.error("[Stripe] No current plan found in subscription metadata");
      return null;
    }

    // Get pricing
    const currentPlanPrice = SUBSCRIPTION_PRODUCTS[currentPlan].priceInCents;
    const newPlanPrice = SUBSCRIPTION_PRODUCTS[newPlan].priceInCents;
    
    // Calculate time remaining in current period
    const periodStart = (subscription as any).current_period_start || Math.floor(Date.now() / 1000);
    const periodEnd = (subscription as any).current_period_end || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    
    const totalDays = Math.ceil((periodEnd - periodStart) / (24 * 60 * 60));
    const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / (24 * 60 * 60)));
    
    // Calculate prorated amounts
    const dailyCurrentRate = currentPlanPrice / totalDays;
    const dailyNewRate = newPlanPrice / totalDays;
    
    const unusedValue = Math.floor(dailyCurrentRate * daysRemaining);
    const newPeriodCost = Math.floor(dailyNewRate * daysRemaining);
    
    const proratedAmount = newPeriodCost - unusedValue;
    const isUpgrade = newPlanPrice > currentPlanPrice;
    
    return {
      proratedAmount,
      isUpgrade,
      immediateCharge: isUpgrade ? proratedAmount : 0,
      creditBalance: !isUpgrade ? Math.abs(proratedAmount) : 0,
      newPlanPrice,
      currentPlanPrice,
      daysRemaining,
      totalDays,
    };
  } catch (error) {
    console.error(`[Stripe] Failed to calculate proration for ${subscriptionId}:`, error);
    return null;
  }
}

/**
 * Update subscription to a new plan with proration
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  newPlan: SubscriptionPlan,
  userId: number
): Promise<{
  success: boolean;
  proratedAmount?: number;
  error?: string;
}> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get the current subscription item
    const items = (subscription as any).items?.data;
    if (!items || items.length === 0) {
      return { success: false, error: "No subscription items found" };
    }
    
    const subscriptionItemId = items[0].id;
    const newProduct = SUBSCRIPTION_PRODUCTS[newPlan];
    
    // Create a new price for the plan
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: newProduct.priceInCents,
      recurring: {
        interval: newProduct.interval,
      },
      product_data: {
        name: newProduct.name,
      },
    });

    // Update the subscription with proration
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: price.id,
        },
      ],
      proration_behavior: "create_prorations",
      metadata: {
        userId: userId.toString(),
        plan: newPlan,
      },
    });

    // Calculate the prorated amount for logging
    const proration = await calculateProration(subscriptionId, newPlan);
    
    console.log(`[Stripe] Updated subscription ${subscriptionId} to ${newPlan} with proration`);
    return {
      success: true,
      proratedAmount: proration?.proratedAmount || 0,
    };
  } catch (error) {
    console.error(`[Stripe] Failed to update subscription ${subscriptionId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update subscription",
    };
  }
}

/**
 * Calculate credit adjustment for plan change
 * When upgrading: add the difference in monthly credits immediately
 * When downgrading: no immediate credit change (takes effect next billing cycle)
 */
export function calculateCreditAdjustment(
  currentPlan: PlanTier,
  newPlan: PlanTier,
  daysRemaining: number,
  totalDays: number
): number {
  const currentCredits = PLAN_TIERS[currentPlan].monthlyCredits;
  const newCredits = PLAN_TIERS[newPlan].monthlyCredits;
  
  if (newCredits <= currentCredits) {
    // Downgrade: no immediate credit change
    return 0;
  }
  
  // Upgrade: prorate the additional credits
  const additionalCredits = newCredits - currentCredits;
  const proratedCredits = Math.floor(additionalCredits * (daysRemaining / totalDays));
  
  return proratedCredits;
}


/**
 * Get invoices for a customer
 */
export async function getCustomerInvoices(
  customerId: string,
  limit: number = 10
): Promise<{
  invoices: Array<{
    id: string;
    date: Date;
    amount: number;
    status: string;
    pdfUrl: string | null;
    hostedUrl: string | null;
    description: string | null;
  }>;
  hasMore: boolean;
}> {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: limit + 1, // Fetch one extra to check if there are more
    });

    const hasMore = invoices.data.length > limit;
    const invoiceData = invoices.data.slice(0, limit).map((invoice) => ({
      id: invoice.id,
      date: new Date((invoice.created || 0) * 1000),
      amount: invoice.amount_paid || 0,
      status: invoice.status || "unknown",
      pdfUrl: invoice.invoice_pdf || null,
      hostedUrl: invoice.hosted_invoice_url || null,
      description: invoice.description || (invoice.lines?.data?.[0]?.description || null),
    }));

    return {
      invoices: invoiceData,
      hasMore,
    };
  } catch (error) {
    console.error(`[Stripe] Failed to fetch invoices for customer ${customerId}:`, error);
    return {
      invoices: [],
      hasMore: false,
    };
  }
}

/**
 * Get all invoices for a customer (paginated)
 */
export async function getAllCustomerInvoices(
  customerId: string,
  startingAfter?: string
): Promise<{
  invoices: Array<{
    id: string;
    date: Date;
    amount: number;
    status: string;
    pdfUrl: string | null;
    hostedUrl: string | null;
    description: string | null;
  }>;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  try {
    const params: Stripe.InvoiceListParams = {
      customer: customerId,
      limit: 25,
    };
    
    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    const invoices = await stripe.invoices.list(params);

    const invoiceData = invoices.data.map((invoice) => ({
      id: invoice.id,
      date: new Date((invoice.created || 0) * 1000),
      amount: invoice.amount_paid || 0,
      status: invoice.status || "unknown",
      pdfUrl: invoice.invoice_pdf || null,
      hostedUrl: invoice.hosted_invoice_url || null,
      description: invoice.description || (invoice.lines?.data?.[0]?.description || null),
    }));

    return {
      invoices: invoiceData,
      hasMore: invoices.has_more,
      nextCursor: invoices.data.length > 0 ? invoices.data[invoices.data.length - 1].id : null,
    };
  } catch (error) {
    console.error(`[Stripe] Failed to fetch all invoices for customer ${customerId}:`, error);
    return {
      invoices: [],
      hasMore: false,
      nextCursor: null,
    };
  }
}



/**
 * Get the payment intent ID from a checkout session.
 * Needed for issuing refunds since we store session IDs, not payment intent IDs.
 */
export async function getPaymentIntentFromSession(sessionId: string): Promise<string | null> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntent = session.payment_intent;
    if (!paymentIntent) return null;
    return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
  } catch (error) {
    console.error(`[Stripe] Failed to retrieve session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Issue a Stripe refund for a payment.
 * Supports full or partial refunds via amountCents parameter.
 * 
 * @param sessionId - The original Stripe checkout session ID
 * @param amountCents - Refund amount in cents (omit for full refund)
 * @param reason - Reason for the refund
 * @returns Refund result with Stripe refund ID and status
 */
export async function issueStripeRefund(
  sessionId: string,
  amountCents?: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; status?: string; error?: string }> {
  try {
    const paymentIntentId = await getPaymentIntentFromSession(sessionId);
    if (!paymentIntentId) {
      return { success: false, error: `No payment intent found for session ${sessionId}` };
    }

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
    };

    if (amountCents && amountCents > 0) {
      refundParams.amount = amountCents;
    }

    if (reason) {
      refundParams.metadata = { reason };
    }

    const refund = await stripe.refunds.create(refundParams);

    console.log(`[Stripe] Refund ${refund.id} issued for session ${sessionId}: ${refund.status} ($${(refund.amount / 100).toFixed(2)})`);

    return {
      success: true,
      refundId: refund.id,
      status: refund.status ?? undefined,
    };
  } catch (error: any) {
    console.error(`[Stripe] Failed to issue refund for session ${sessionId}:`, error);
    return {
      success: false,
      error: error.message || "Failed to issue Stripe refund",
    };
  }
}

/**
 * Calculate proportional refund amount based on credits used.
 * Credits to deduct is floored at the user's current balance (never goes negative).
 * Refund amount is proportional to the credits we can actually claw back.
 * 
 * @param originalAmountCents - Original purchase amount in cents
 * @param originalCredits - Credits from the original purchase
 * @param currentBalance - User's current credit balance
 * @returns Object with refund amount and credits to deduct
 */
export function calculateProportionalRefund(
  originalAmountCents: number,
  originalCredits: number,
  currentBalance: number
): {
  refundAmountCents: number;
  creditsToDeduct: number;
  creditsUsed: number;
  unusedCredits: number;
} {
   // Guard against zero division
  if (originalCredits === 0) {
    return { refundAmountCents: 0, creditsToDeduct: 0, creditsUsed: 0, unusedCredits: 0 };
  }
  // Credits to deduct is the lesser of original credits and current balance (floor at 0)
  const creditsToDeduct = Math.min(originalCredits, currentBalance);
  // Unused credits = what we can actually claw back
  const unusedCredits = creditsToDeduct;
  const creditsUsed = originalCredits - unusedCredits;
  // Proportional refund: (unused / original) * price
  const refundAmountCents = Math.round((unusedCredits / originalCredits) * originalAmountCents);

  return {
    refundAmountCents,
    creditsToDeduct,
    creditsUsed,
    unusedCredits,
  };
}
