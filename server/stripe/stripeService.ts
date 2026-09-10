/**
 * Stripe Service
 * 
 * Handles all Stripe integration for subscriptions and one-time payments.
 */

import Stripe from "stripe";
import { ENV } from "../_core/env";
import { SUBSCRIPTION_PRODUCTS, SubscriptionPlan } from "./stripeProducts";
import {
  periodPriceInCents,
  stripeIntervalOf,
  choiceOfStripeInterval,
  monthsBought,
  type BillingIntervalChoice,
} from "@shared/annualBilling";
import { environmentMetadata } from "./environmentTag";
import { subscriptionPeriodSec } from "./subscriptionPeriods";
import { PLAN_TIERS, PlanTier } from "../../drizzle/schema";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("stripe/stripeService");

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
      log.info(`[Stripe] Customer ${existingCustomerId} not found, creating new one`);
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      userId: userId.toString(),
      ...environmentMetadata(),
    },
  });

  log.info(`[Stripe] Created customer ${customer.id} for user ${userId}`);
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
  
  // The annual arithmetic lives in shared/annualBilling.ts (#664): this
  // builder used to carry its own `* 12 * 0.83` inline while the client
  // declared ANNUAL_RATE separately — working law 4's mirror, on the number
  // that charges the card.
  const isAnnual = interval === "annual";
  const unitAmount = periodPriceInCents(product.priceInCents, interval);
  const billingInterval = stripeIntervalOf(interval);
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
      ...environmentMetadata(),
    },
    subscription_data: {
      metadata: {
        userId: userId.toString(),
        plan,
        interval,
        ...environmentMetadata(),
      },
    },
  });

  log.info(`[Stripe] Created ${interval} subscription checkout session ${session.id} for plan ${plan}`);
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

  log.info(`[Stripe] Created customer portal session for customer ${customerId}`);
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
  /** The interval the customer is actually billed on, read from the price
   *  itself (#664 decision 5) — never from metadata a writer might drop. */
  billingInterval: "month" | "year" | null;
} | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Extract plan from metadata
    const plan = (subscription.metadata.plan as SubscriptionPlan) || null;
    
    // The period lives on the subscription ITEM on this API version — see
    // subscriptionPeriods.ts; the sub-level read was taking its fallback.
    const { startSec, endSec } = subscriptionPeriodSec(subscription);

    const stripeInterval = (subscription as any).items?.data?.[0]?.price?.recurring?.interval;

    return {
      status: subscription.status,
      currentPeriodStart: new Date(startSec * 1000),
      currentPeriodEnd: new Date(endSec * 1000),
      plan,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      billingInterval:
        stripeInterval === "year" || stripeInterval === "month" ? stripeInterval : null,
    };
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to get subscription ${subscriptionId}:`);
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
    log.info(`[Stripe] Subscription ${subscriptionId} set to cancel at period end`);
    return true;
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to cancel subscription ${subscriptionId}:`);
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
    log.info(`[Stripe] Subscription ${subscriptionId} reactivated`);
    return true;
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to reactivate subscription ${subscriptionId}:`);
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
/**
 * A Stripe subscription's `metadata.plan` mapped to a tier the product still
 * DECLARES — or `null` when it names one we no longer do (#391 folded four
 * rungs out of `PLAN_TIERS`). The front door refuses those plans at the
 * parser; this is the back door, and a bare cast here would persist a folded
 * tier that `getMonthlyCredits` then throws on at the next renewal — a
 * failed webhook AFTER a successful charge. The caller decides the fallback
 * (it keeps the account's current tier), because this function cannot know it.
 */
export function mapPlanToTier(plan: SubscriptionPlan): PlanTier | null {
  return plan in PLAN_TIERS ? (plan as PlanTier) : null;
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
 * THE SUBSCRIPTION'S BILLING STATE, READ AT THE ARTIFACT (#664 decision 5).
 *
 * The interval comes from the subscription item's own price — the thing that
 * actually bills — never from `metadata.interval`, which a writer can drop
 * without anything failing. The plan still comes from metadata because a plan
 * is OUR word, not Stripe's; a metadata plan the product no longer declares
 * answers null and the caller refuses, exactly as the webhook does (#391).
 */
export type SubscriptionBillingState = {
  subscriptionItemId: string;
  currentPlan: SubscriptionPlan;
  currentInterval: BillingIntervalChoice;
  /** Unix seconds, straight off the subscription. */
  periodStartSec: number;
  periodEndSec: number;
};

export async function readSubscriptionBillingState(
  subscriptionId: string,
): Promise<SubscriptionBillingState | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const item = (subscription as any).items?.data?.[0];
    if (!item?.id) {
      log.error(`[Stripe] Subscription ${subscriptionId} has no subscription item`);
      return null;
    }

    const currentInterval = choiceOfStripeInterval(item.price?.recurring?.interval);
    if (!currentInterval) {
      log.error(
        `[Stripe] Subscription ${subscriptionId} bills on an interval this product does not sell (${item.price?.recurring?.interval ?? "none"})`,
      );
      return null;
    }

    const currentPlan = subscription.metadata.plan as SubscriptionPlan | undefined;
    if (!currentPlan || !(currentPlan in SUBSCRIPTION_PRODUCTS)) {
      log.error(
        `[Stripe] Subscription ${subscriptionId} names no plan the product declares ("${currentPlan ?? ""}")`,
      );
      return null;
    }

    const { startSec, endSec } = subscriptionPeriodSec(subscription);

    return {
      subscriptionItemId: item.id,
      currentPlan,
      currentInterval,
      periodStartSec: startSec,
      periodEndSec: endSec,
    };
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to read billing state for ${subscriptionId}:`);
    return null;
  }
}

/**
 * WHAT A PLAN CHANGE DOES TODAY, QUOTED BEFORE IT IS DONE (#664).
 *
 * Two shapes, and Stripe's own documented behaviour decides which one runs
 * (verified at the docs, not assumed — the design comment on #664 quotes it):
 *
 * - **same-interval** — the item's price changes, the cycle keeps its dates,
 *   and `always_invoice` bills the prorated difference immediately. Both
 *   plans are priced at the CYCLE'S OWN interval: the maths this replaces
 *   priced an annual subscriber's plans at their monthly rate over a 365-day
 *   period, which understated every figure by ~12×.
 *
 * - **interval-switch** — Stripe resets the billing cycle anchor to now and
 *   invoices the full new period immediately, minus credit for the unused
 *   share of the old one. `creditAdjustment` is 0 here ON PURPOSE: the switch
 *   invoice buys a whole period, so the invoice webhook grants the whole
 *   period's allowance (decision 3), and a local top-up would double-grant.
 *
 * Day-granular where Stripe prorates to the second, exactly as the maths it
 * replaces was — these figures feed the credit adjustment and the copy, while
 * the money is Stripe's own computation, read back off the invoice after the
 * update (`updateSubscriptionPlan`).
 */
export type PlanChangeQuote = {
  kind: "same-interval" | "interval-switch";
  currentInterval: BillingIntervalChoice;
  targetInterval: BillingIntervalChoice;
  /** Tier direction, judged at monthly rates — an interval switch on one tier
   *  is neither an upgrade nor a downgrade of the plan itself. */
  isUpgrade: boolean;
  /** Signed cents: what today's action nets across credit and charge. */
  proratedAmount: number;
  immediateCharge: number;
  creditBalance: number;
  /** Per PERIOD at its own interval — a year's price on the annual leg. */
  newPlanPrice: number;
  currentPlanPrice: number;
  daysRemaining: number;
  totalDays: number;
  /**
   * SIGNED credits `changePlan` itself applies for a same-interval change
   * (#664 review findings 1+3 — the mirror rule: credits move with the
   * money's own proration, in BOTH directions). Positive on an upgrade —
   * the remaining-cycle share of the higher allowance, paid for today.
   * NEGATIVE on a downgrade — the remaining-cycle share of the allowance
   * being handed back, because `always_invoice` returns that share's MONEY
   * to the customer's balance in the same act; a grant kept while its money
   * comes back is the credit-minting loop the review found. 0 on an
   * interval switch (the invoice grants; `creditUnwind` deducts).
   */
  creditAdjustment: number;
  /**
   * The unconsumed share of the OLD period's grant, deducted on an
   * interval switch — the same fraction of the same period Stripe credits
   * back in money. Without it, switch → switch-back alternation mints a
   * period's allowance per round trip. 0 for same-interval changes.
   */
  creditUnwind: number;
};

export function quotePlanChange(
  state: SubscriptionBillingState,
  newPlan: SubscriptionPlan,
  requestedInterval?: BillingIntervalChoice,
  nowSec: number = Math.floor(Date.now() / 1000),
): PlanChangeQuote {
  // Absent means KEEP the interval the customer is on. This is also the fix
  // for the sibling defect the #664 read found: the old update path minted
  // every replacement price as monthly, silently converting an annual
  // subscriber to monthly billing on any tier change.
  const targetInterval = requestedInterval ?? state.currentInterval;
  const kind: PlanChangeQuote["kind"] =
    targetInterval === state.currentInterval ? "same-interval" : "interval-switch";

  const DAY = 24 * 60 * 60;
  const totalDays = Math.max(1, Math.ceil((state.periodEndSec - state.periodStartSec) / DAY));
  const daysRemaining = Math.min(
    totalDays,
    Math.max(0, Math.ceil((state.periodEndSec - nowSec) / DAY)),
  );

  const currentPlanPrice = periodPriceInCents(
    SUBSCRIPTION_PRODUCTS[state.currentPlan].priceInCents,
    state.currentInterval,
  );
  const newPlanPrice = periodPriceInCents(
    SUBSCRIPTION_PRODUCTS[newPlan].priceInCents,
    targetInterval,
  );

  const unusedValue = Math.floor((currentPlanPrice * daysRemaining) / totalDays);
  const proratedAmount =
    kind === "same-interval"
      ? Math.floor((newPlanPrice * daysRemaining) / totalDays) - unusedValue
      : newPlanPrice - unusedValue;

  const isUpgrade =
    SUBSCRIPTION_PRODUCTS[newPlan].priceInCents >
    SUBSCRIPTION_PRODUCTS[state.currentPlan].priceInCents;

  const cycleMonths = monthsBought(stripeIntervalOf(state.currentInterval));
  const creditAdjustment =
    kind === "same-interval"
      ? calculateCreditAdjustment(
          state.currentPlan as PlanTier,
          newPlan as PlanTier,
          daysRemaining,
          totalDays,
          cycleMonths,
        )
      : 0;

  // The switch unwind mirrors Stripe's own money credit: the same fraction
  // (daysRemaining / totalDays) of the same period's grant.
  const creditUnwind =
    kind === "interval-switch"
      ? Math.floor(
          PLAN_TIERS[state.currentPlan as PlanTier].monthlyCredits *
            cycleMonths *
            (daysRemaining / totalDays),
        )
      : 0;

  return {
    kind,
    currentInterval: state.currentInterval,
    targetInterval,
    isUpgrade,
    proratedAmount,
    immediateCharge: Math.max(proratedAmount, 0),
    creditBalance: Math.max(-proratedAmount, 0),
    newPlanPrice,
    currentPlanPrice,
    daysRemaining,
    totalDays,
    creditAdjustment,
    creditUnwind,
  };
}

/**
 * Update the subscription to the new plan at the target interval.
 *
 * `always_invoice`, not `create_prorations` (#664 decision 2): the default
 * defers the prorated charge to the NEXT invoice — a month away on monthly,
 * up to a YEAR away on annual — while every surface says "due today".
 * Verified at the docs: only `always_invoice` bills the change immediately,
 * and switching to a price with a different `recurring.interval` resets the
 * billing cycle anchor to now, which invoices the new period at once.
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  newPlan: SubscriptionPlan,
  userId: number,
  targetInterval: BillingIntervalChoice,
  subscriptionItemId?: string,
): Promise<{
  success: boolean;
  /** What Stripe actually invoiced for the change, when it can be read. */
  invoicedAmount?: number | null;
  /** The change's own invoice (in_xxx) — the artifact the credit settlement
   *  hangs on (#711). Null only when Stripe attached no invoice, which
   *  `always_invoice` should make unreachable. */
  invoiceId?: string | null;
  /** The invoice's status AT THIS READ ("paid", "open", …) — a snapshot,
   *  not a promise; the settlement path re-reads before deferring. */
  invoiceStatus?: string | null;
  error?: string;
}> {
  try {
    let itemId = subscriptionItemId;
    if (!itemId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      itemId = (subscription as any).items?.data?.[0]?.id;
      if (!itemId) {
        return { success: false, error: "No subscription items found" };
      }
    }

    const newProduct = SUBSCRIPTION_PRODUCTS[newPlan];

    // Create a new price for the plan AT THE INTERVAL BEING BOUGHT — the old
    // mint was unconditionally monthly, which is the sibling defect above.
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: periodPriceInCents(newProduct.priceInCents, targetInterval),
      recurring: {
        interval: stripeIntervalOf(targetInterval),
      },
      product_data: {
        name: targetInterval === "annual" ? `${newProduct.name} (Annual)` : newProduct.name,
      },
    });

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: itemId,
          price: price.id,
        },
      ],
      proration_behavior: "always_invoice",
      metadata: {
        userId: userId.toString(),
        plan: newPlan,
        // Parity with checkout metadata; the READ side never trusts this —
        // the interval is read off the price (readSubscriptionBillingState).
        interval: targetInterval,
        ...environmentMetadata(),
      },
    });

    // The figure the customer was actually billed, read at the artifact —
    // and the invoice's identity and status, which is what the credit
    // settlement hangs on (#711).
    let invoicedAmount: number | null = null;
    let invoiceStatus: string | null = null;
    const latestInvoice = (updated as any).latest_invoice;
    const invoiceId: string | null =
      (typeof latestInvoice === "string" ? latestInvoice : latestInvoice?.id) ?? null;
    if (invoiceId) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (typeof invoice.amount_due === "number") invoicedAmount = invoice.amount_due;
        invoiceStatus = invoice.status ?? null;
      } catch (invoiceErr) {
        log.warn(
          { err: invoiceErr },
          `[Stripe] Could not read the change invoice for ${subscriptionId}`,
        );
      }
    }

    log.info(
      `[Stripe] Updated subscription ${subscriptionId} to ${newPlan} (${targetInterval}), invoiced immediately`,
    );
    return { success: true, invoicedAmount, invoiceId, invoiceStatus };
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to update subscription ${subscriptionId}:`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update subscription",
    };
  }
}

/**
 * The invoice's status, read fresh (#711). The settlement path calls this
 * before DEFERRING a credit move: a webhook that fired before the settlement
 * row existed can never re-fire, so "not paid at the update" must be
 * re-checked after the row is recorded — a fresh "paid" here is how that
 * race resolves.
 *
 * ⚠ Null means THE READ FAILED, and deferring on it is not free (PR #755
 * review, finding 1): if the invoice paid synchronously and its webhook was
 * consumed before the row existed, this read is the LAST road to the
 * credits — a null here strands the row pending until support finds it. The
 * caller therefore retries this read before deferring, and the residue (all
 * retries failing inside that exact race window) is a stated limit, not a
 * covered case.
 */
export async function getInvoiceStatus(invoiceId: string): Promise<string | null> {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return invoice.status ?? null;
  } catch (error) {
    log.warn({ err: error }, `[Stripe] Could not read invoice ${invoiceId} status`);
    return null;
  }
}

/**
 * Void an invoice that must no longer be able to take money (#756).
 *
 * The case it exists for: a plan change's payment has FINALLY failed, so the
 * credit side is closed — the settlement row goes void, the subscription
 * auto-cancels — while the invoice itself stays `open` and payable through
 * Stripe's hosted invoice page. A customer paying it later hands over money
 * for credits that will never move (the void row refuses, by design) against a
 * plan that is already gone. Voiding is what makes the two sides agree.
 *
 * ⚠ TWO STATUSES ARE VOIDABLE, NOT ONE, AND THE SECOND IS THE ONE THAT MATTERS
 * HERE. This read said `open` alone until the PR #764 review, on a docblock
 * claim of mine that was simply wrong. Stripe's own words:
 *
 *   "You can only void an invoice in `open` or `uncollectible` status."
 *   uncollectible → "Change the invoice's status to `void` or `paid`."
 *   — https://docs.stripe.com/invoicing/overview
 *
 * So `uncollectible` IS voidable and, more to the point, is **still payable**:
 * `void` is the terminal status, not `uncollectible`. Treating it as closed
 * would have left this card's exact defect alive on the one road built for a
 * finally-failed invoice — somebody writing it off as bad debt in the
 * dashboard — while logging a line claiming it was handled.
 *
 * The status is read rather than assumed because Stripe rejects `voidInvoice`
 * on a draft, a paid or an already-void invoice, and it re-delivers events for
 * days: a blind call would log a failure on every benign re-delivery.
 * `already-closed` is a SUCCESS shape, not an error — the invoice cannot take
 * money, which is the whole point of the call.
 *
 * The read-then-void race is real and is deliberately left as a stated limit:
 * if the invoice is paid in the gap, the void fails and we report it. That
 * lands in the pre-existing late-payment case, where the void settlement row
 * already refuses the credits.
 */
const VOIDABLE_INVOICE_STATUSES = ["open", "uncollectible"] as const;

export async function voidInvoice(
  invoiceId: string,
): Promise<"voided" | "already-closed" | "failed"> {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const status = invoice?.status ?? null;
    if (!VOIDABLE_INVOICE_STATUSES.includes(status as never)) {
      log.info(
        `[Stripe] Invoice ${invoiceId} is "${status}" — not voidable and cannot take money; nothing to do`,
      );
      return "already-closed";
    }
    await stripe.invoices.voidInvoice(invoiceId);
    log.info(`[Stripe] Invoice ${invoiceId} voided — it can no longer take money`);
    return "voided";
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to void invoice ${invoiceId}:`);
    return "failed";
  }
}

/**
 * SIGNED credit adjustment for a same-interval plan change (#664, and the
 * review's mirror rule): the remaining-cycle share of the allowance
 * difference, × the months the cycle runs (12 on an annual cycle).
 *
 * Positive on an upgrade — the higher allowance is being paid for today
 * (`always_invoice` charges the same fraction of the money difference in
 * the same act, and no invoice fires that would grant it).
 *
 * ⚠ NEGATIVE ON A DOWNGRADE — this returned 0 for downgrades until the
 * #664 review, and that zero was one half of a credit-minting loop: the
 * money difference for the remaining cycle comes BACK to the customer
 * (Stripe's proration credit), so the credits that same difference bought
 * must go back with it, or upgrade-then-downgrade alternation keeps the
 * allowance while recovering the money. The caller floors the deduction at
 * the live balance — credits already spent are spent.
 */
export function calculateCreditAdjustment(
  currentPlan: PlanTier,
  newPlan: PlanTier,
  daysRemaining: number,
  totalDays: number,
  monthsInCycle: number = 1,
): number {
  const currentCredits = PLAN_TIERS[currentPlan].monthlyCredits;
  const newCredits = PLAN_TIERS[newPlan].monthlyCredits;

  const deltaForCycle = (newCredits - currentCredits) * monthsInCycle;
  const fraction = daysRemaining / totalDays;

  if (deltaForCycle >= 0) {
    return Math.floor(deltaForCycle * fraction);
  }
  // Downgrade: the same share, the other way. Truncate toward zero so the
  // deduction never exceeds the mirror of what an upgrade would have granted.
  return -Math.floor(-deltaForCycle * fraction);
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
    log.error({ err: error }, `[Stripe] Failed to fetch invoices for customer ${customerId}:`);
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
    log.error({ err: error }, `[Stripe] Failed to fetch all invoices for customer ${customerId}:`);
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
    log.error({ err: error }, `[Stripe] Failed to retrieve session ${sessionId}:`);
    return null;
  }
}

/**
 * What the customer was actually charged for a checkout session, in cents.
 *
 * This is THE source for a refund's "original amount" (#418). It used to be
 * recomputed from a credit count by a bare magic float on the moderator's
 * client (`credits * 0.00072`, which turned a 10,000-credit top-up into 7
 * cents); `amount_total` is the figure Stripe charged the card, it is
 * immutable on a completed session, and reading it means no constant exists
 * to drift. Returns null when the session cannot be read or carries no
 * charge — callers on the money path must REFUSE on null, never guess.
 */
export async function getSessionChargedAmountCents(sessionId: string): Promise<number | null> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const amount = session.amount_total;
    return typeof amount === "number" && amount > 0 ? amount : null;
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to read charged amount for session ${sessionId}:`);
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
  // An EXPLICIT non-positive amount is refused, never silently upgraded: the
  // falsy-check below turns 0 into "omit the amount", and an omitted amount
  // means FULL refund to Stripe. A caller that computed zero meant zero
  // (PR #704 review, finding 1). Omitting the parameter still means full.
  if (amountCents !== undefined && !(Number.isFinite(amountCents) && amountCents > 0)) {
    return { success: false, error: `Refund amount must be a positive number of cents (got ${amountCents}) — omit it entirely for a full refund` };
  }
  try {
    const paymentIntentId = await getPaymentIntentFromSession(sessionId);
    if (!paymentIntentId) {
      return { success: false, error: `No payment intent found for session ${sessionId}` };
    }

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: {
        ...environmentMetadata(),
      },
    };

    if (amountCents && amountCents > 0) {
      refundParams.amount = amountCents;
    }

    if (reason) {
      refundParams.metadata = { reason, ...environmentMetadata() };
    }

    const refund = await stripe.refunds.create(refundParams);

    log.info(`[Stripe] Refund ${refund.id} issued for session ${sessionId}: ${refund.status} ($${(refund.amount / 100).toFixed(2)})`);

    return {
      success: true,
      refundId: refund.id,
      status: refund.status ?? undefined,
    };
  } catch (error: any) {
    log.error({ err: error }, `[Stripe] Failed to issue refund for session ${sessionId}:`);
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
