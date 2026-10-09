/**
 * Stripe Service
 * 
 * Handles all Stripe integration for subscriptions and one-time payments.
 */

import Stripe from "stripe";
import { ENV } from "../_core/env";
import { SPENT_SHARE_PRODUCT, SUBSCRIPTION_PRODUCTS, SubscriptionPlan } from "./stripeProducts";
import {
  periodPriceInCents,
  stripeIntervalOf,
  choiceOfStripeInterval,
  monthsBought,
  type BillingIntervalChoice,
} from "@shared/annualBilling";
import { wholeDisplayLedger } from "@shared/creditDisplay";
import {
  isPlanCreditsLookupKey,
  resolvePlanCreditsPriceId,
  resolvePriceId,
  resolveTopupPriceId,
  StripePriceUnavailableError,
} from "./stripePriceCatalogue";
import { TOPUP_CHECKOUT_KIND, topupLedgerCredits } from "@shared/creditTopups";
import {
  planCreditSliderLedgerCredits,
  planCreditSliderPriceInCents,
} from "@shared/planCreditSlider";
import { planCreditSliderUnitsAllowed } from "./planCreditSlider";
import { grantedShareMonths } from "../billing/annualCreditMonths";
import { environmentMetadata } from "./environmentTag";
import { subscriptionPeriodSec } from "./subscriptionPeriods";
import {
  readPendingPlanChange,
  releaseScheduleBeforeWrite,
  releaseScheduleOn,
  type PendingPlanChange,
} from "./subscriptionSchedule";
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
  interval: "monthly" | "annual" = "monthly",
  /**
   * The credit slider's position (#1832) — 0 for a plain plan, which is every
   * rung but the one carrying the dial. A count the rung does not sell is
   * refused by `resolvePlanCreditsPriceId` before any session is minted.
   */
  creditUnits: number = 0,
): Promise<string> {
  // ⚠ THE PRICE IS STRIPE'S OBJECT, NOT A NUMBER COMPOSED HERE (#1605
  // bullet 1). This builder used to send an inline `price_data` carrying a
  // `unit_amount` computed from `PLAN_TIERS` and a `product_data.name`
  // composed in this process — so the charge was whatever this tree worked
  // out, and Stripe's own catalogue was a parallel copy of the prices rather
  // than the thing being charged (working law 4, on the number that moves
  // money). It now resolves the price by its lookup key and sends the id.
  //
  // Three things follow and each was a deliberate decision, not a side
  // effect of the edit:
  //   · NO `product_data` AT ALL. Stripe's own product carries the name and
  //     the identity line, which is what bullet 3 left owed when it deleted
  //     the composed description: `stripeProducts.ts`'s docblock says *"no
  //     product text is composed in this repository at all"* once this road
  //     exists, and now none is.
  //   · NO AMOUNT ON THE WIRE. `periodPriceInCents` still decides what the
  //     PAGE says; `resolvePriceId` refuses when Stripe's amount is not that
  //     number, so the two cannot drift apart silently.
  //   · A MISSING KEY REFUSES HERE, not at boot — the card allows either and
  //     a boot refusal crash-loops the service. The error names the key.
  const priceId = await resolvePriceId(stripe, plan, interval);

  /* ⚠ THE DIAL IS A SECOND LINE ON THE SAME SUBSCRIPTION, PRICED PER STEP
     (#1832, the design's §5: *"a base price plus a metered line item with a
     quantity"*). It is resolved from the catalogue by its own lookup key for
     the reason the base price is — no amount reaches the wire, and a key the
     catalogue cannot supply refuses here with nothing charged.

     `creditUnits === 0` sends ONE line and nothing else changes, which is what
     keeps every rung without a dial on exactly the road it was on. */
  const lineItems: { price: string; quantity: number }[] = [{ price: priceId, quantity: 1 }];
  if (creditUnits > 0) {
    lineItems.push({
      price: await resolvePlanCreditsPriceId(stripe, plan, interval, creditUnits),
      quantity: creditUnits,
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    /*
      ⚠ **THE DIAL'S POSITION IS DELIBERATELY NOT IN THE METADATA, AND AN
      EXISTING GUARD IS WHAT SETTLED IT (#1832).** A `creditUnits` key was
      written here first, for the audit trail;
      `server/stripe/checkoutProductText.test.ts`'s broad arm — *no string
      anywhere in the outgoing session says the word credit* — went red on it.

      Read at the arm's own reason, the indictment is not quite the one it
      states (metadata is not text Stripe prints on the checkout page), **and
      the field was wrong anyway for a better reason**: the add-on LINE ITEM
      carries the quantity, which is the artifact that bills and the artifact
      every reader here already consults — the grant, the quote and
      `getPlanCreditUnits` all read `subscriptionItemsOf`. A second copy on the
      metadata would be a mirror of a number Stripe owns (working law 4) with
      no reader and nothing to keep it true. Our own record of the intent is
      the audit row `createSubscriptionCheckout` writes, steps and ledger
      credits both.
    */
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

  log.info(
    `[Stripe] Created ${interval} subscription checkout session ${session.id} for plan ${plan}`
    + (creditUnits > 0 ? ` with ${creditUnits} credit step(s)` : ""),
  );
  return session.url!;
}

/**
 * Create a Stripe Checkout session for a one-off credit top-up (#1606).
 *
 * Three things here are decisions rather than transcription, and each is the
 * subscription builder's own reasoning read on a one-off sale:
 *
 *  · **ONE PRICE, `quantity` UNITS.** The ladder's rate bands ARE three Stripe
 *    prices quoted per 5,000 credits, so the band decides which price and the
 *    order decides the quantity. No amount is composed here — `resolveTopupPriceId`
 *    refuses when Stripe's figure is not the one this product shows, which is
 *    what keeps the screen and the charge from drifting apart silently.
 *  · **`mode: "payment"`.** A credit pack is bought once. The catalogue refuses
 *    a recurring price under these keys for the same reason.
 *  · **THE GRANT RIDES THE SESSION'S METADATA, IN LEDGER CREDITS.** The webhook
 *    grants `ledgerCredits` as it is written here; it never multiplies a price
 *    back into credits. That is the card's own rule ("the FIXED ledger amount,
 *    never dollars-to-credits arithmetic") and it is why a later price change
 *    cannot retroactively re-value a purchase that is already paid for.
 *
 * ⚠ The env tag is on the metadata because `checkout.session.completed` is one
 * of the tagged event types: without it this session's own completion would be
 * refused at production's webhook and the customer would pay for nothing.
 */
export async function createTopupCheckoutSession(
  customerId: string,
  units: number,
  successUrl: string,
  cancelUrl: string,
  userId: number,
): Promise<string> {
  const priceId = await resolveTopupPriceId(stripe, units);
  const ledgerCredits = topupLedgerCredits(units);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: units,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId.toString(),
      type: TOPUP_CHECKOUT_KIND,
      topupUnits: units.toString(),
      ledgerCredits: ledgerCredits.toString(),
      ...environmentMetadata(),
    },
  });

  log.info(
    `[Stripe] Created top-up checkout session ${session.id} for user ${userId} — ${units} unit(s), ${ledgerCredits} ledger credits`,
  );
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
  /**
   * ⚠ **THE CHANGE WAITING AT THE PERIOD BOUNDARY (#1936), AND THE DEFECT IS
   * WHAT HAPPENS WITHOUT IT.** This read is what every billing surface draws
   * its plan from, and it reads the tier off the subscription item — so a
   * scheduled downgrade would be completely invisible: the customer asks to
   * drop to Pro, is told it happens on 7 November, and then every screen she
   * looks at goes on saying Pro Plus with no sign that anything is coming.
   *
   * `null` means nothing is pending **or the schedule could not be read** —
   * the two are deliberately collapsed HERE and nowhere else, because this
   * function already collapses every failure into its own `null` return and a
   * surface that cannot be sure says nothing rather than claiming there is no
   * pending change. The road that must tell them apart (the undo) reads
   * `readPendingPlanChange` directly and gets all three outcomes.
   */
  pendingChange: PendingPlanChange | null;
} | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Extract plan from metadata
    const plan = (subscription.metadata.plan as SubscriptionPlan) || null;
    
    // The period lives on the subscription ITEM on this API version — see
    // subscriptionPeriods.ts; the sub-level read was taking its fallback.
    const { startSec, endSec } = subscriptionPeriodSec(subscription);

    /* ⚠ The PLAN's item, not `data[0]` — #1832's law-7 sweep. Both items of
       one subscription are re-priced together by `updateSubscriptionPlan`, so
       they agree on the interval today; reading the add-on for the answer
       would make that agreement load-bearing instead of incidental, and a
       quantity or price edited in the Stripe dashboard alone would then cache
       a cycle this product never sold. */
    const stripeInterval =
      subscriptionItemsOf(subscription).base?.price?.recurring?.interval;

    /* Read off the SAME subscription object the plan above came from, so the
       live plan and the pending one cannot be two different moments. */
    const pending = await readPendingPlanChange(stripe, subscription);

    return {
      status: subscription.status,
      currentPeriodStart: new Date(startSec * 1000),
      currentPeriodEnd: new Date(endSec * 1000),
      plan,
      /* Either of Stripe's two ending shapes (#1987's law-7 sweep) — the
         flag alone read a `cancel_at` ending as a plan that renews. */
      cancelAtPeriodEnd: subscriptionEndsAtSec(subscription, endSec) !== null,
      billingInterval:
        stripeInterval === "year" || stripeInterval === "month" ? stripeInterval : null,
      pendingChange: pending.outcome === "pending" ? pending.change : null,
    };
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to get subscription ${subscriptionId}:`);
    return null;
  }
}

/**
 * THE WEBHOOK'S LIVE READ (#795, his word: repair 1 — fetch, don't trust).
 *
 * Stripe neither orders nor deduplicates delivery, so an event's payload is a
 * snapshot of when the event was MADE, not of now — a redelivered older
 * `subscription.updated` carries a plan the customer has since left, and
 * since #792 the subscription roads fail events on purpose to make Stripe
 * redeliver, which widens that window. The subscription handlers therefore
 * treat the payload as a trigger only and apply what THIS read returns.
 *
 * The three outcomes stay apart on purpose: a transient failure FAILS the
 * event so Stripe redelivers and the read is retried, while a subscription
 * Stripe does not know cannot be retried into existence — collapsing them
 * (as `getSubscriptionDetails`'s single `null` does) would either burn three
 * days of redeliveries on nothing or drop a retryable read on the floor.
 */
export type LiveSubscriptionRead =
  | { outcome: "found"; subscription: Stripe.Subscription }
  | { outcome: "missing" }
  | { outcome: "failed"; error: string };

export async function retrieveLiveSubscription(
  subscriptionId: string,
): Promise<LiveSubscriptionRead> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return { outcome: "found", subscription };
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "resource_missing") {
      return { outcome: "missing" };
    }
    log.error({ err: error }, `[Stripe] Live read of subscription ${subscriptionId} failed:`);
    return { outcome: "failed", error: String(error) };
  }
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  try {
    /* ⚠ **RELEASE FIRST, THEN CANCEL — STRIPE'S OWN DOCUMENTED ORDER (#1936).**
       Their automatic dispute cancellation is specified exactly this way:
       *"For subscriptions managed with schedules, the subscription is first
       released from the schedule and then canceled."* So a customer who
       scheduled a downgrade and then decided to leave altogether is cancelled
       cleanly, and the pending change is discarded with the subscription —
       which is the right outcome, because she is going.

       A failed release REFUSES the cancellation rather than attempting it: a
       cancel that silently did not take is the one failure a leaving customer
       discovers on her next statement. */
    const released = await releaseScheduleBeforeWrite(stripe, subscriptionId);
    if (released.outcome === "failed") {
      log.error(
        { subscriptionId, error: released.error },
        "[Stripe] Refusing to cancel — the pending scheduled change could not be released",
      );
      return false;
    }

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
 * What of a plan's unspent allowance carries into the next period: the plan's
 * `rolloverPercent` of it, and NEVER MORE THAN ONE MONTH'S WORTH (#2152).
 *
 * His word, 2026-10-09 (terminal): *"pricing word card here ive approved the
 * code changes required too"*, on the Desk item "Pricing Phase 2: final
 * wording", whose rollover rules read: *"The bank is capped at one month's
 * worth of plan credits"* and *"A downgrade trims the bank to the new plan's
 * cap."*
 *
 * ⚠ **THE CAP IS A REQUIRED ARGUMENT, NOT A LOOKUP IN HERE.** One month's worth
 * is the plan's base allowance PLUS the credit dial's steps on the rung that
 * has one, and the steps are read off the paid invoice by the webhook (#1832) —
 * this function cannot know them. A default of the base allowance would cap a
 * customer on the dial below what they pay for each month, silently; making
 * the caller state it means the compiler refuses a call that forgot.
 *
 * ⚠ **THE DOWNGRADE TRIM IS THIS SAME LINE, NOT A SECOND MECHANISM.** A
 * decrease takes effect at the next renewal (#1936), and that renewal's
 * invoice is billed on the NEW plan (#1930), so the caller passes the new
 * plan's percentage and the new plan's month — the bank is trimmed to the new
 * cap at exactly the moment the new plan begins.
 *
 * Purchased credits never reach this function: `refreshMonthlyCredits` hands
 * it the plan's part of the balance only and adds the top-ups back whole
 * (#1604), so top-ups are outside the cap by construction.
 */
export function calculateRolloverCredits(
  unusedCredits: number,
  planTier: PlanTier,
  oneMonthAllowance: number,
): number {
  const tierConfig = PLAN_TIERS[planTier];
  const rolloverPercent = tierConfig.rolloverPercent;
  // A whole number of DISPLAY credits (#1604 done-when 2): a percentage of an
  // arbitrary balance is almost never a multiple of the display scale, and the
  // remainder would be ledger the customer holds and can never be shown.
  const carried = wholeDisplayLedger(Math.floor(unusedCredits * (rolloverPercent / 100)));
  // A cap that cannot be read caps at nothing rather than at everything: the
  // direction that cannot over-grant on a money path.
  const cap = Number.isFinite(oneMonthAllowance) ? Math.max(0, Math.floor(oneMonthAllowance)) : 0;
  return Math.min(carried, wholeDisplayLedger(cap));
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
  /**
   * The credit slider's position, read off the add-on item's own quantity
   * (#1832). 0 when the subscription carries no add-on line, which is every
   * subscription on a rung with no slider and every plain plan.
   */
  currentCreditUnits: number;
  /**
   * The add-on subscription item, when there is one — what `updateSubscriptionPlan`
   * re-prices or deletes. `null` means the line has to be ADDED.
   */
  creditItemId: string | null;
  /**
   * ⚠ **WHETHER THIS SUBSCRIPTION IS ALREADY SET TO END AT THE BOUNDARY, AND IT
   * IS HERE BECAUSE A DEFERRED CHANGE COULD OTHERWISE UNDO A CANCELLATION
   * (#1936 repair 2).** A scheduled decrease mints a two-phase schedule whose
   * second phase STARTS at the renewal, so a customer who had cancelled and
   * then lowered her plan got a subscription that continued past the date it
   * was meant to end — and was charged for it.
   *
   * It is read off the same `subscriptions.retrieve` as the period it concerns,
   * never off our own `subscriptions` row: the local mirror is written by a
   * webhook and a change made in Stripe's own portal reaches it late, so a
   * stale `false` here is exactly the reading that would schedule past a
   * cancellation.
   *
   * ⚠ **IT IS A DATE, NOT `cancel_at_period_end`, SINCE #1987 — AND THE
   * BOOLEAN WAS BLIND TO HALF OF THE WAYS A PLAN IS SET TO END.** This field
   * read `cancel_at_period_end === true` and nothing else, while Stripe
   * records an ending two ways: the flag, or a `cancel_at` timestamp (the
   * shape the 2025-07-30 `cancel_at` changelog widened, and the one a
   * portal or dashboard cancellation can produce depending on configuration
   * and API version). A plan ending by `cancel_at` read as not ending, and
   * #1936's refusal let the deferral through on exactly the shape it exists
   * to stop. So this is WHEN the plan ends — `cancel_at` when Stripe states
   * one, the period end when only the flag is set — and `null` only when
   * neither is.
   */
  endsAtSec: number | null;
  /**
   * The subscription's own status and whether its collection is paused, read
   * off the same retrieve (#1987). `changePlan` lets only an `active`,
   * unpaused plan change at all; every other state is refused in a sentence
   * — see `planChangeRefusal` in `routes/billing.ts`.
   */
  status: Stripe.Subscription.Status;
  collectionPaused: boolean;
};

/**
 * WHEN A SUBSCRIPTION IS SET TO END, IN EITHER OF STRIPE'S TWO SHAPES (#1987).
 *
 * `cancel_at` wins when it is present — it is the date Stripe will actually
 * end it, and it is ALSO what Stripe stamps beside `cancel_at_period_end`
 * when the flag is set. The flag alone answers the period end. One reader,
 * so the billing state and the Billing tab's details cannot disagree about
 * whether a plan is ending.
 */
export function subscriptionEndsAtSec(
  subscription: { cancel_at?: number | null; cancel_at_period_end?: boolean | null },
  periodEndSec: number,
): number | null {
  if (typeof subscription.cancel_at === "number" && subscription.cancel_at > 0) {
    return subscription.cancel_at;
  }
  return subscription.cancel_at_period_end === true ? periodEndSec : null;
}

/**
 * THE BASE ITEM AND THE ADD-ON ITEM, TOLD APART BY THEIR LOOKUP KEYS (#1832).
 *
 * ⚠ **THIS EXISTS BECAUSE `items.data[0]` STOPS BEING THE PLAN THE MOMENT A
 * SUBSCRIPTION HAS TWO LINES, AND STRIPE DOES NOT PROMISE THE ORDER.** Every
 * read in this file took `[0]` — the interval, the item id a plan change
 * re-prices, the plan's own period. With a credit add-on on the subscription
 * that index can be the add-on, and then: the interval is read off the right
 * price by luck, the plan change would re-price the ADD-ON to the new plan's
 * price, and a customer's $9 line would become their whole bill. So the split
 * is deliberate and it is one function.
 *
 * The test is {@link isPlanCreditsLookupKey}, which is derived from the key
 * composer rather than a substring — see its own note. A subscription with no
 * add-on answers `{ base: data[0], addon: null }`, which is every subscription
 * that exists today (production holds none at all; dev holds one).
 *
 * ⚠ **AN ITEM WHOSE PRICE HAS NO LOOKUP KEY IS TREATED AS THE BASE**, and that
 * is the conservative direction rather than an oversight: every price this
 * product charges on now comes from the catalogue by key (#1605), but a
 * subscription created before that — or one a hand-sold link produced — has an
 * ad-hoc price with `lookup_key: null`, and reading it as the base is what
 * keeps its plan change working. The add-on is only ever recognised
 * POSITIVELY.
 */
export function subscriptionItemsOf(subscription: unknown): {
  base: { id: string; price?: any; quantity?: number } | null;
  addon: { id: string; price?: any; quantity?: number } | null;
} {
  const items: any[] = (subscription as any)?.items?.data ?? [];
  let base: any = null;
  let addon: any = null;
  for (const item of items) {
    if (!item?.id) continue;
    if (isPlanCreditsLookupKey(item.price?.lookup_key)) {
      if (addon === null) addon = item;
      continue;
    }
    if (base === null) base = item;
  }
  return { base, addon };
}

export async function readSubscriptionBillingState(
  subscriptionId: string,
): Promise<SubscriptionBillingState | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    /* ⚠ The PLAN's item, not `data[0]` — see `subscriptionItemsOf`. Reading
       the add-on here would quote and re-price the wrong line. */
    const { base: item, addon } = subscriptionItemsOf(subscription);
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

    /* The dial's position is the add-on line's own quantity — the artifact
       that bills, never a number cached on our side. A line with no readable
       quantity reads as 0, which under-grants rather than over-grants; the
       grant road logs the disagreement rather than inventing a figure. */
    const addonQuantity = typeof addon?.quantity === "number" ? addon.quantity : 0;

    return {
      subscriptionItemId: item.id,
      currentPlan,
      currentInterval,
      periodStartSec: startSec,
      periodEndSec: endSec,
      currentCreditUnits: Math.max(0, Math.trunc(addonQuantity)),
      creditItemId: addon?.id ?? null,
      endsAtSec: subscriptionEndsAtSec(subscription, endSec),
      status: subscription.status,
      /* `pause_collection` is how the portal's "pause" feature pauses a plan
         while its status stays `active` — so status alone would let a paused
         plan through (#1987). */
      collectionPaused: subscription.pause_collection != null,
    };
  } catch (error) {
    log.error({ err: error }, `[Stripe] Failed to read billing state for ${subscriptionId}:`);
    return null;
  }
}

/**
 * THE ADD-ON'S PRICE ID AT AN INTERVAL, FOR IDENTIFYING AN INVOICE LINE —
 * `null` when the catalogue cannot answer (#1832 repair).
 *
 * The renewal grant has to decide whether a line on a paid invoice IS the
 * credit dial's add-on, and the dialect production speaks carries a price
 * **id** on its lines and no lookup key (`invoiceLines.ts`'s own reading of
 * the SDK types). So the comparison is id-to-id, and this is where the id
 * comes from, with the client kept private exactly as every other road here
 * keeps it.
 *
 * ⚠ **IT ASKS FOR ONE STEP, AND ONE STEP IS NOT A GUESS ABOUT THE CUSTOMER.**
 * A price id does not vary with the quantity billed against it — the dial's
 * position is the subscription item's `quantity`, never a different price —
 * so any sellable unit count resolves the same id, and `1` is simply the
 * count every rung with a dial is guaranteed to allow.
 * `resolvePlanCreditsPriceId` refuses `0`, which is why the argument is not
 * the honest-looking zero.
 *
 * ⚠ **AND IT RETURNS `null` RATHER THAN THROWING.** The caller is a webhook
 * deciding how much to grant; an unresolvable price means *this reading is
 * unavailable*, which is a fall-back-to-the-other-road fact and not an
 * invoice failure. Letting the throw out would turn a catalogue hiccup into a
 * refused payment event.
 */
export async function planCreditsAddonPriceId(
  plan: SubscriptionPlan,
  interval: BillingIntervalChoice,
): Promise<string | null> {
  if (planCreditSliderUnitsAllowed(plan) === 0) return null;
  try {
    return await resolvePlanCreditsPriceId(stripe, plan, interval, 1);
  } catch (error) {
    log.error(
      { err: error },
      `[Stripe] Could not resolve the credit add-on price for ${plan}/${interval} — an invoice line cannot be identified by id`,
    );
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
  /**
   * Per PERIOD at its own interval — a year's price on the annual leg.
   *
   * ⚠ **THE DIAL'S STEPS ARE IN BOTH FIGURES (#1832).** A plan change on the
   * slider's rung can move the plan, the cycle, the dial, or any two of them,
   * and the customer is quoted one number: what today's action nets. A
   * `newPlanPrice` that left the add-on out would under-state an upgrade of
   * the dial by $9 a step and the confirm step would disagree with the
   * invoice — which is this surface's one unforgivable defect.
   */
  newPlanPrice: number;
  currentPlanPrice: number;
  /** The dial's position today, and the one being bought (#1832). */
  currentCreditUnits: number;
  targetCreditUnits: number;
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
   *
   * ⚠ **THE NEGATIVE DIRECTION IS SUPERSEDED BY #1936 AND IS NO LONGER
   * REACHABLE ON A REAL DOWNGRADE — read the sentence above as history.** The
   * mirror rule was right and it could not win: it handed back the unused
   * share of the allowance while the take-back floored at what was LEFT of it
   * (*"spent credits are spent"*), so a customer who SPENT first kept the
   * credits and got the money anyway. That is the loop #1936 was filed about.
   * His option 1 removes the money instead — a decrease is scheduled for the
   * period boundary and moves nothing today — so there is no refund to mirror
   * and this field reads 0 whenever `deferred` is true. The POSITIVE direction
   * is untouched and still does exactly what the sentence above says.
   */
  creditAdjustment: number;
  /**
   * The unconsumed share of the OLD period's grant, deducted on an
   * interval switch — the same fraction of the same period Stripe credits
   * back in money. Without it, switch → switch-back alternation mints a
   * period's allowance per round trip. 0 for same-interval changes.
   *
   * ⚠ **SINCE #1965 IT IS ONLY THE PART OF THAT SHARE STILL ON THE BALANCE.**
   * The part already spent cannot be taken back (*"spent credits are spent"*),
   * so it is moved to {@link spentShareCredits} and paid for instead. The two
   * always add up to the whole unconsumed share of the old period's grant.
   */
  creditUnwind: number;
  /**
   * ⚠ **THE UNCONSUMED SHARE OF THE OLD PERIOD THAT IS ALREADY SPENT, AND WHAT
   * IT COSTS (#1965).** On an interval switch Stripe credits the unused share
   * of the old period — plan AND dial — against the new invoice. The credits
   * that share bought are taken back by `creditUnwind`, but only as far as
   * the allowance still holds them; whatever the customer has already spent
   * came back as MONEY with no credits behind it. Raise the dial early in the
   * month, spend the credits, switch to annual, and the dial's unused value
   * is deducted from the year while the take-back finds nothing.
   *
   * **The remedy taken is the first of the card's two: the shortfall is
   * charged**, as one line on the switch's own invoice, at exactly the rate
   * Stripe credited it — `unusedValue × spentShareCredits / (whole share)`,
   * rounded down so the customer is never charged a cent more than the
   * credit she received for those credits. Not the second ("don't credit the
   * dial's unused share"): that remedy is about the DIAL only, while the
   * allowance is one pool — nothing can say whether the credits she spent
   * were the plan's or the dial's — and the same hole is open on the plan's
   * own allowance. Charging the shortfall closes both with one number.
   *
   * 0 on a same-interval change, on a deferred change, and whenever the
   * allowance left covers the whole share. Absent `planAllowanceLeftLedger`
   * (the caller did not read the balance) also answers 0 — which is why both
   * procedures that quote a change read it first, and why
   * `server/routes/planChangeSpentShareAndStates.test.ts` drives that they do.
   */
  spentShareCredits: number;
  /** Cents — see {@link spentShareCredits}. Included in `proratedAmount` and
   *  `immediateCharge`, because it is due today on the same invoice. */
  spentShareCharge: number;
  /**
   * ⚠ **WHETHER THIS CHANGE HAPPENS NOW OR AT THE PERIOD BOUNDARY (#1936).**
   * His ruling, verbatim: *"1 for the slider fix"* — **a DECREASE takes effect
   * at the next renewal, with no refund and no credit take-back; an INCREASE
   * stays instant.**
   *
   * **`deferred` IS THE SINGLE TEST `proratedAmount < 0`, AND THE TWO TEMPTING
   * EXTRA CLAUSES ARE BOTH WRONG — worth saying here because each one looks
   * like extra safety.**
   *
   * The loop this closes is minted by MONEY COMING BACK while spent credits
   * stay spent, so money-back is the whole engine and `proratedAmount < 0` is
   * exactly the set of changes that return any.
   *
   * · Adding `|| creditAdjustment < 0` would defer a change the customer is
   *   PAYING MORE for — a move up the ladder that drops the dial's steps (the
   *   dial is clamped to the target rung) raises the price and could lower the
   *   allowance in one action. No money comes back **on that case**, so
   *   nothing can be minted from it, and deferring an upgrade is against his
   *   word. ⚠ **Measured rather than
   *   asserted, and the measurement corrected this sentence's first draft: on
   *   TODAY's ladder that case is UNREACHABLE** — the dial's rung at its
   *   maximum is still 20,000 ledger credits below the rung above it, so an
   *   upgrade's `creditAdjustment` cannot be negative. The clause stays out
   *   because it is wrong in principle; what keeps "wrong in principle" from
   *   becoming "wrong in practice" is a coincidence of two numbers in a price
   *   table that has been re-cut twice this month, so
   *   `deferredPlanChange.test.ts` pins that coincidence and reddens if a
   *   future ladder breaks it.
   * · Adding `|| creditUnwind > 0` would defer **monthly → annual**, which
   *   carries an unwind on every interval switch and is the largest upgrade
   *   this product sells.
   *
   * ⚠ **AND THE "NO MONEY COMES BACK" READING IS NOT TRUE OF EVERY INSTANT
   * CHANGE — IT IS SCOPED TO THE TWO BULLETS ABOVE.** On an instant interval
   * switch (monthly → annual, and annual → monthly at the knife edge) Stripe
   * DOES credit the unused share of the old period back against the new
   * invoice, plan and dial alike, and `proratedAmount < 0` does not catch it
   * because the switch charges a whole period up front. That money is
   * matched by `creditUnwind`, which floors at what is left of the
   * allowance — so when the allowance was SPENT, the money came back and the
   * credits did not: #1965, the same engine as #1936 on the one road this
   * test calls instant. ✅ **Closed by {@link PlanChangeQuote.spentShareCharge}
   * rather than by deferring the switch**: the share of that credit whose
   * credits are already spent is charged back on the same invoice, so the
   * customer is credited only for what she can still hand back. Deferral is
   * not this road's answer — monthly → annual is the largest upgrade the
   * product sells and his word keeps every increase instant.
   *
   * ⚠ **AND WHEN THIS IS TRUE, EVERY MONEY AND CREDIT FIELD ABOVE READS 0** —
   * see the end of {@link quotePlanChange}. That is the mechanism rather than
   * a courtesy: it means the charge road, the settlement road and every
   * surface do nothing on a deferred change by construction, instead of each
   * one remembering to ask.
   */
  deferred: boolean;
  /**
   * The end of the period the customer has paid for, as Unix seconds — when a
   * deferred change takes effect, and the renewal date on an instant one.
   * Carried on the quote so the confirm step's date and the scheduled phase's
   * start cannot be two readings.
   */
  effectiveAtSec: number;
};

export function quotePlanChange(
  state: SubscriptionBillingState,
  newPlan: SubscriptionPlan,
  requestedInterval?: BillingIntervalChoice,
  nowSec: number = Math.floor(Date.now() / 1000),
  /**
   * The dial being bought (#1832). Absent means *the dial the rung allows,
   * where the customer already has it* — which is what makes an interval
   * switch or a cycle change carry the slider through rather than silently
   * resetting it to zero and handing back an allowance nobody asked to lose.
   *
   * ⚠ **IT IS CLAMPED TO THE TARGET RUNG, NOT THE CURRENT ONE.** Moving from
   * the slider's rung DOWN to Pro has no dial to carry, so the steps are
   * dropped and their money and credits unwind with the rest of the change —
   * which is the same mirror rule the plan's own allowance already follows.
   */
  requestedCreditUnits?: number,
  /**
   * What is left of the PLAN's part of the customer's balance, in ledger
   * credits — `planAllowanceRemaining` of her credit row, read by the caller
   * (#1965). It decides how much of an interval switch's unconsumed share can
   * still be taken back and how much has to be paid for instead. Absent means
   * the caller did not read it, and answers as if the whole share were still
   * there: no charge, which is the road as it stood before #1965.
   */
  planAllowanceLeftLedger?: number,
  /**
   * ⚠ **HOW MANY OF THE CURRENT YEAR'S MONTHS HAVE ACTUALLY BEEN GRANTED
   * (#2152, his ruling on #2159: *"yearly credits apply month by month"*)** —
   * read off the ledger by the caller (`getAnnualYearProgress`). A yearly
   * plan's credits no longer arrive whole on day one, so the share of them
   * that covers unused time is what was handed over minus what the elapsed
   * time used (`grantedShareMonths`), and every credit figure below — the
   * switch's take-back, the upgrade's top-up, the spent-share charge — is
   * priced in that share instead of in the whole year.
   *
   * Absent or `null` means the period was granted WHOLE: every monthly plan,
   * and a yearly one granted up front before this change. The figures are
   * then exactly what they were.
   */
  annualMonthsGranted?: number | null,
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

  /* THE DIAL, ON EACH SIDE OF THE CHANGE (#1832). The target is clamped to
     what the TARGET rung sells, so a move off the slider's rung drops the
     steps rather than carrying a line the new rung has no price for. */
  const currentCreditUnits = Math.min(
    state.currentCreditUnits,
    planCreditSliderUnitsAllowed(state.currentPlan),
  );
  const targetCreditUnits = Math.max(
    0,
    Math.min(
      Math.trunc(requestedCreditUnits ?? state.currentCreditUnits),
      planCreditSliderUnitsAllowed(newPlan),
    ),
  );

  const currentPlanPrice =
    periodPriceInCents(
      SUBSCRIPTION_PRODUCTS[state.currentPlan].priceInCents,
      state.currentInterval,
    )
    + planCreditSliderPriceInCents(currentCreditUnits, state.currentInterval);
  const newPlanPrice =
    periodPriceInCents(SUBSCRIPTION_PRODUCTS[newPlan].priceInCents, targetInterval)
    + planCreditSliderPriceInCents(targetCreditUnits, targetInterval);

  const unusedValue = Math.floor((currentPlanPrice * daysRemaining) / totalDays);
  const proratedAmount =
    kind === "same-interval"
      ? Math.floor((newPlanPrice * daysRemaining) / totalDays) - unusedValue
      : newPlanPrice - unusedValue;

  /* ⚠ THE DIRECTION IS STILL THE PLAN'S, NOT THE BILL'S. A dial moved up on
     the same rung is neither an Upgrade nor a Downgrade of the PLAN, and the
     label on the button is about the rung — the same reason an interval switch
     on one tier is neither. What the dial changes is the FIGURE, which is in
     `proratedAmount` above and in the confirm step's sentence. */
  const isUpgrade =
    SUBSCRIPTION_PRODUCTS[newPlan].priceInCents >
    SUBSCRIPTION_PRODUCTS[state.currentPlan].priceInCents;

  const cycleMonths = monthsBought(stripeIntervalOf(state.currentInterval));
  /* ⚠ THE PERIOD WAS GRANTED WHOLE UNLESS THE CALLER SAYS OTHERWISE (#2152).
     `null` here takes every expression below down its pre-#2152 road, written
     in the same order, so a monthly plan's figures are the same to the last
     credit. */
  const monthsGranted =
    annualMonthsGranted === undefined || annualMonthsGranted === null || annualMonthsGranted >= cycleMonths
      ? null
      : Math.max(0, Math.floor(annualMonthsGranted));
  const grantedShare =
    monthsGranted === null ? null : grantedShareMonths(cycleMonths, monthsGranted, daysRemaining, totalDays);
  const creditAdjustment =
    kind === "same-interval"
      ? calculateCreditAdjustment(
          state.currentPlan as PlanTier,
          newPlan as PlanTier,
          daysRemaining,
          totalDays,
          cycleMonths,
          /* The dial's steps ride the same mirror rule as the plan's own
             allowance — paid for today on the way up, handed back with the
             money on the way down (#1832). */
          {
            currentExtraMonthlyCredits: planCreditSliderLedgerCredits(currentCreditUnits),
            targetExtraMonthlyCredits: planCreditSliderLedgerCredits(targetCreditUnits),
            /* A yearly plan granted month by month tops up only the month in
               hand; the months still to come arrive at the new plan through
               the paid year's own month (#2152). */
            ...(grantedShare === null ? {} : { grantedShareMonths: grantedShare }),
          },
        )
      : 0;

  // The switch unwind mirrors Stripe's own money credit: the same fraction
  // (daysRemaining / totalDays) of the same period's grant.
  // A whole number of DISPLAY credits, like the two shares above (#1604
  // done-when 2) — this is a prorated credit DEDUCTION and the same argument
  // applies to it.
  const creditUnwind =
    kind === "interval-switch"
      ? wholeDisplayLedger(
          Math.floor(
            /* ⚠ The DIAL'S steps are in the unwind too (#1832), because the
               old period's grant included them: Stripe credits back the same
               fraction of the whole old line — plan AND add-on — so an unwind
               that only knew the plan would leave the slider's share of the
               allowance on the balance with its money already returned. That
               is the credit-minting loop the #664 review found, one line item
               over. */
            grantedShare === null
              ? (PLAN_TIERS[state.currentPlan as PlanTier].monthlyCredits
                + planCreditSliderLedgerCredits(currentCreditUnits)) *
                cycleMonths *
                (daysRemaining / totalDays)
              /* ⚠ ONLY WHAT WAS HANDED OVER CAN BE TAKEN BACK (#2152). On a
                 yearly plan granted month by month the months not yet begun
                 were never on the balance — Stripe refunds their money, and
                 there are no credits behind it to return. */
              : (PLAN_TIERS[state.currentPlan as PlanTier].monthlyCredits
                + planCreditSliderLedgerCredits(currentCreditUnits)) *
                grantedShare,
          ),
        )
      : 0;

  /* ⚠ **THE DIRECTION, AND THEN THE DEFERRAL (#1936).** A change that hands
     money back does not happen today — his option 1. The test is the signed
     figure this quote has already computed, and the two tempting extra clauses
     are wrong for the reasons on `deferred`'s own declaration above.

     ⚠ **THE ZEROING BELOW IS THE MECHANISM, NOT A COURTESY.** Every road that
     moves money or credits on a plan change reads these fields and nothing
     else: `changePlan` derives its settlement `direction` from
     `creditAdjustment` and `creditUnwind`, and the confirm step derives
     "due today" from `immediateCharge` and "back to your balance" from
     `creditBalance`. Zeroing them in ONE place means the charge road, the
     settlement road and all three customer surfaces do nothing on a deferred
     change by construction — rather than each of them remembering to ask,
     which is how one of them would eventually forget. */
  const deferred = proratedAmount < 0;

  /* ⚠ **THE SPENT SHARE OF AN INTERVAL SWITCH IS PAID FOR, NOT GIVEN BACK
     (#1965).** `unusedValue` is the money Stripe credits for the old period's
     unused days, and `creditUnwind` is the SAME fraction of the same period's
     grant — one share, priced and counted. What the take-back cannot reach
     (the allowance is already spent) came back as money with nothing behind
     it, so that part of the credit is charged back at the rate it was given.

     ⚠ **IT IS DECIDED AFTER `deferred`, ON PURPOSE.** The deferral is his
     ruling about decreases and it reads the money Stripe would return; adding
     this charge first would turn a deferred annual → monthly into an instant
     one whenever she had spent, which re-rules his option 1 by arithmetic. */
  const allowanceLeft =
    planAllowanceLeftLedger === undefined
      ? creditUnwind
      : Math.max(0, Math.floor(planAllowanceLeftLedger));
  const spentShareCredits =
    !deferred && kind === "interval-switch" ? Math.max(0, creditUnwind - allowanceLeft) : 0;
  /* ⚠ PRICED AT THE RATE OF THE CREDITS IT STANDS FOR (#2152). Granted whole,
     the take-back and `unusedValue` are the same share of the same period, so
     the rate is `unusedValue / creditUnwind` exactly as before. Granted month
     by month, `unusedValue` also refunds months that were never handed over;
     only the money of the share that WAS handed over prices a spent credit,
     or a customer would be charged for months they never received. */
  const unusedValueOfGrantedShare =
    grantedShare === null
      ? unusedValue
      : Math.floor((currentPlanPrice * grantedShare) / cycleMonths);
  const spentShareCharge =
    spentShareCredits > 0 && creditUnwind > 0
      ? Math.floor((unusedValueOfGrantedShare * spentShareCredits) / creditUnwind)
      : 0;
  const keptUnwind = creditUnwind - spentShareCredits;
  const charged = proratedAmount + spentShareCharge;

  return {
    kind,
    currentInterval: state.currentInterval,
    targetInterval,
    isUpgrade,
    proratedAmount: deferred ? 0 : charged,
    immediateCharge: deferred ? 0 : Math.max(charged, 0),
    creditBalance: deferred ? 0 : Math.max(-charged, 0),
    newPlanPrice,
    currentPlanPrice,
    currentCreditUnits,
    targetCreditUnits,
    daysRemaining,
    totalDays,
    creditAdjustment: deferred ? 0 : creditAdjustment,
    creditUnwind: deferred ? 0 : keptUnwind,
    spentShareCredits,
    spentShareCharge,
    deferred,
    effectiveAtSec: state.periodEndSec,
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
 *
 * ⚠ **"Invoices the new period at once" was true of the money and false of the
 * line's shape (#2069)** — the implicit reset bills the period as a PRORATION
 * line, which the webhook's grant cannot see. An interval switch therefore
 * asks for `billing_cycle_anchor: "now"` explicitly; see the note at the
 * update call.
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  newPlan: SubscriptionPlan,
  userId: number,
  targetInterval: BillingIntervalChoice,
  subscriptionItemId?: string,
  /**
   * THE DIAL, AND THE ITEM IT LIVES ON (#1832) — both come from the quote the
   * caller already read, so this function makes no second decision about what
   * the customer is buying.
   *
   * `targetCreditUnits` 0 with a `creditItemId` present DELETES the line;
   * non-zero with no item ADDS one; non-zero with an item re-prices it at the
   * target interval and sets the quantity. Omitted means *leave the items
   * alone*, which is every caller that predates the slider.
   */
  credits?: { targetCreditUnits: number; creditItemId: string | null },
  /**
   * Cents — the quote's `spentShareCharge` (#1965): the part of the old
   * period's unused credit whose credits are already spent, charged back as
   * one line on the SAME invoice the switch raises. 0 or absent adds nothing.
   */
  spentShareCharge?: number,
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
    /* ⚠ **A PENDING SCHEDULED CHANGE IS RELEASED BEFORE THIS WRITE (#1936).**
       An instant change asked for while a decrease is pending — she lowered
       the dial yesterday and has thought better of it today — must REPLACE the
       pending one, and `subscriptions.update` on a schedule-managed
       subscription is not a state this product may guess about. The release
       moves no money and no price (`subscriptionSchedule.ts` quotes the
       documentation), so it costs one read when there is nothing pending.

       It REFUSES rather than carrying on: the alternative is attempting a
       charge against a subscription whose management we could not establish,
       and `changePlan` has nothing to undo once Stripe has invoiced. */
    /* ⚠ **ONE RETRIEVE, TWO QUESTIONS (#1936).** This read answers both the
       pending-schedule check below and the plan's item id when the caller did
       not supply one. The first draft asked twice — the release had its own
       read — and `annualPlanChange.test.ts`'s *"the item id was supplied, so
       nothing re-fetched the subscription"* arm caught it, having guarded that
       round trip since #664. */
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    /* ⚠ **THE SPENT SHARE'S LINE IS BUILT BEFORE ANYTHING IS WRITTEN (#1965).**
       It rides the same `subscriptions.update` as the price change —
       `add_invoice_items` is appended to the invoice that update raises, which
       under `always_invoice` is the switch's own invoice — so the customer is
       charged ONE figure for one action, and the line cannot land without the
       switch or the switch without the line. Its price is inline
       (`price_data`), so no price object is minted per switch.

       ⚠ **UNDER ITS OWN PRODUCT, NOT THE PLAN'S (#2023).** The plan's product
       put the plan's name on her invoice twice; {@link SPENT_SHARE_PRODUCT}'s
       name is the line's own words. The product is READ here, by its fixed
       id, rather than trusted to exist.

       ⚠ **AND A PRODUCT THIS CATALOGUE DOES NOT HOLD IS A DEGRADED INVOICE,
       NEVER A REFUSED UPGRADE — the relay's finding on PR #2053, and it is
       the clause that matters most here.** The first shape of this change
       REFUSED the whole switch when the product was missing or archived, so
       until the ceremony had been run against whichever Stripe account the
       running service uses, **every monthly → yearly switch out of a month
       with credits used would have been refused** — on production today, and
       again after the live-key switch if one line of #1609's checklist were
       skimmed. That trades a cosmetic defect (the plan's name twice) for a
       customer who cannot upgrade, which is the wrong side of the
       disappearing-technology law. So the fallback is the pre-#2023 road: the
       line is built under the PLAN's product, `log.error` says so loudly, and
       the customer's switch goes through.

       ⚠ **WHAT STILL REFUSES IS EXACTLY WHAT REFUSED BEFORE #2023** — no
       product readable at all (the line needs one; `price_data` cannot be
       stated without it) or a currency this read cannot state. Charging the
       switch without the line is the mint #1965 exists to close, so a line
       that genuinely cannot be built still stops before the pending-schedule
       release and before the update. */
    let spentShareLine: Record<string, unknown> | null = null;
    if (spentShareCharge !== undefined && spentShareCharge > 0) {
      let productId: string | null = null;
      try {
        const product = await stripe.products.retrieve(SPENT_SHARE_PRODUCT.id);
        productId = product?.active ? product.id : null;
        if (!productId) {
          log.error(
            { product: SPENT_SHARE_PRODUCT.id },
            "[Stripe] The spent-share product is archived in this mode's catalogue",
          );
        }
      } catch (productErr) {
        log.error(
          { err: productErr, product: SPENT_SHARE_PRODUCT.id },
          "[Stripe] The spent-share product could not be read",
        );
      }
      const planProduct = subscriptionItemsOf(subscription).base?.price?.product;
      /* The degraded road. `log.error` rather than a warning on purpose: this
         is a real catalogue gap that somebody must close by running
         `scripts/ceremony-spent-share-product-2023.mts` against this mode, and
         it is silent to the customer by design — all she sees is the plan's
         name on a line that is not the plan. */
      if (!productId) {
        productId =
          typeof planProduct === "string" ? planProduct : (planProduct?.id ?? null);
        if (productId) {
          log.error(
            { subscriptionId, product: SPENT_SHARE_PRODUCT.id, fallbackProduct: productId },
            "[Stripe] Billing the spent-share line under the PLAN's product — run scripts/ceremony-spent-share-product-2023.mts for this mode; her invoice will read the plan's name twice until it is run",
          );
        }
      }
      const currency =
        (subscription as any).currency
        ?? subscriptionItemsOf(subscription).base?.price?.currency
        ?? null;
      if (!productId || !currency) {
        log.error(
          { subscriptionId, productId, currency },
          "[Stripe] Refusing a switch whose spent-share line cannot be built — no product and no fallback, or the currency is unreadable",
        );
        return {
          success: false,
          error:
            "We could not work out today's charge for this change, so nothing was changed. Please try again.",
        };
      }
      spentShareLine = {
        price_data: {
          currency,
          product: productId,
          unit_amount: Math.trunc(spentShareCharge),
        },
        quantity: 1,
        metadata: { kind: "spent-allowance-share", ...environmentMetadata() },
      };
    }

    const released = await releaseScheduleOn(stripe, subscription);
    if (released.outcome === "failed") {
      return {
        success: false,
        error:
          "We could not clear the change already scheduled on your plan, so nothing was changed. Please try again.",
      };
    }

    let itemId = subscriptionItemId;
    if (!itemId) {
      /* ⚠ The PLAN's item, never `data[0]` — with a credit add-on on the
         subscription that index can be the $9 line, and re-pricing it to the
         new plan's price would make a customer's add-on their whole bill
         (`subscriptionItemsOf`, #1832). */
      itemId = subscriptionItemsOf(subscription).base?.id;
      if (!itemId) {
        return { success: false, error: "No subscription items found" };
      }
    }

    // ⚠ AN EXISTING PRICE, NOT A FRESHLY MINTED ONE (#1605 bullet 1). This
    // path called `stripe.prices.create` on every plan change, so each change
    // left a new ad-hoc Price and its own anonymous Product behind in the
    // catalogue — and the amount charged was this tree's arithmetic rather
    // than the catalogue's figure. Both halves are closed by resolving the
    // same lookup key checkout resolves.
    //
    // ⚠ The interval is still the one BEING BOUGHT and that is the sibling
    // defect this site has already been bitten by once (#664: the old mint was
    // unconditionally monthly). `resolvePriceId` now refuses a key whose price
    // does not recur at the asked-for interval, so the same mistake cannot be
    // made silently a second time — it would name the key and stop.
    const priceId = await resolvePriceId(stripe, newPlan, targetInterval);

    /* ⚠ THE DIAL'S LINE MOVES IN THE SAME `subscriptions.update` AS THE PLAN'S
       (#1832), and that is a correctness requirement rather than tidiness: two
       updates would be two prorations and two invoices for one action the
       customer was quoted ONE figure for, with the second able to fail after
       the first was charged.

       An interval switch re-prices the add-on too — its monthly and yearly
       prices are different Stripe objects, and leaving the old one on an
       annual subscription would bill $9 a month beside a yearly plan. */
    const items: Record<string, unknown>[] = [{ id: itemId, price: priceId }];
    if (credits) {
      if (credits.targetCreditUnits > 0) {
        const creditPriceId = await resolvePlanCreditsPriceId(
          stripe,
          newPlan,
          targetInterval,
          credits.targetCreditUnits,
        );
        items.push(
          credits.creditItemId === null
            ? { price: creditPriceId, quantity: credits.targetCreditUnits }
            : { id: credits.creditItemId, price: creditPriceId, quantity: credits.targetCreditUnits },
        );
      } else if (credits.creditItemId !== null) {
        /* The dial is back at zero, or the new rung has no dial — the line is
           REMOVED rather than left at quantity 0, because a zero-quantity item
           is still a line on the invoice and still a price the subscription
           carries. */
        items.push({ id: credits.creditItemId, deleted: true });
      }
    }

    /* ⚠ **AN INTERVAL SWITCH ASKS FOR THE NEW PERIOD AS A WHOLE LINE, BY NAME
       (#2069).** Stripe resets the cycle on an interval change by itself, but
       left to do so it bills the new year as a PRORATION line — *"Remaining
       time on Klieg Starter after 08 Oct 2026"*, `proration: true`, 365 days —
       and the webhook grants credits only off a non-proration line
       (`periodBought`), so every monthly → yearly switch paid for a year and
       was granted nothing for it. Asking for `billing_cycle_anchor: "now"`
       makes Stripe bill the same year as an ordinary period line (*"1 × Klieg
       Starter (at $269.00 / year)"*, `proration: false`) beside the same
       unused-time credit. **Driven in test mode, not assumed: the same switch
       with and without the anchor invoiced the same `amount_due` to the cent
       (24,200 on Starter; 166,800 on the dial's rung with three steps, where
       the add-on's year becomes a readable non-proration line too).**

       ⚠ **ONLY ON A SWITCH, AND THE SWITCH IS READ OFF THE SUBSCRIPTION
       ITSELF.** On a same-interval change the anchor would restart the cycle
       and bill a whole fresh period — a tier upgrade charged a month instead of
       its prorated share. The current interval is the base item's price, read
       through the same `choiceOfStripeInterval` the quote's
       `readSubscriptionBillingState` uses, off the retrieve this function
       already made. An interval it cannot read sends no anchor, which is the
       road as it stood before #2069 — and `changePlan` cannot reach here with
       one, because the quote refuses an unreadable interval first. */
    const currentInterval = choiceOfStripeInterval(
      subscriptionItemsOf(subscription).base?.price?.recurring?.interval,
    );
    const intervalSwitch = currentInterval !== null && currentInterval !== targetInterval;

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: items as any,
      ...(spentShareLine ? { add_invoice_items: [spentShareLine as any] } : {}),
      ...(intervalSwitch ? { billing_cycle_anchor: "now" as const } : {}),
      proration_behavior: "always_invoice",
      metadata: {
        userId: userId.toString(),
        plan: newPlan,
        // Parity with checkout metadata; the READ side never trusts this —
        // the interval is read off the price (readSubscriptionBillingState),
        // and the dial off the add-on item's own quantity. ⚠ The dial is
        // therefore NOT stamped here either; the checkout builder's note
        // carries why, and `changePlan`'s audit row is our record of it.
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
      `[Stripe] Updated subscription ${subscriptionId} to ${newPlan} (${targetInterval})`
      + (credits ? ` with ${credits.targetCreditUnits} credit step(s)` : "")
      + ", invoiced immediately",
    );
    return { success: true, invoicedAmount, invoiceId, invoiceStatus };
  } catch (error) {
    /* ⚠ A PRICE THE CATALOGUE CANNOT SUPPLY IS RETHROWN, NOT FOLDED INTO
       `{ success: false }` — and the reason is which sentence the customer
       ends up reading.

       Every other failure here is a Stripe call that was ATTEMPTED, so
       `success: false` is the honest shape and the route turns it into an
       unmarked `INTERNAL_SERVER_ERROR`, which the client answers with its own
       "we lost contact while changing your plan" line. For this one nothing
       was attempted at all: `resolvePriceId` runs before the single
       `subscriptions.update`, so a refusal here means the subscription was
       never touched. Telling somebody to go and check a plan that certainly
       did not change is the defect `shared/spokenError` was written about, so
       the route catches this type by name and speaks for it.

       The instance travels intact, key and all, because the route logs
       `.lookupKey`. */
    if (error instanceof StripePriceUnavailableError) throw error;
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
 *
 * ⚠ `paid` IS NOT "NOTHING TO DO" AND IS THE ONE STATUS THAT MUST NOT SHARE
 * THE BENIGN ROAD (#767, PR #764 round-2 review). Every other non-voidable
 * status — `draft`, `void` — means the invoice cannot take money, which is
 * what this call wanted. `paid` means it ALREADY TOOK IT, on the one road
 * built for an invoice whose payment has finally failed: money accepted for a
 * plan that is already cancelled and credits that will never move. Folding it
 * in logged that as routine at info, and for a finally-failed RENEWAL there is
 * no settlement row and therefore no second trace — that info line was the
 * only record the event left. It gets its own return shape so a caller can
 * tell "closed" from "paid", and its own line at warn so a reader can.
 */
const VOIDABLE_INVOICE_STATUSES = ["open", "uncollectible"] as const;

export async function voidInvoice(
  invoiceId: string,
): Promise<"voided" | "already-closed" | "already-paid" | "failed"> {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const status = invoice?.status ?? null;
    if (status === "paid") {
      log.warn(
        `[Stripe] Invoice ${invoiceId} is already PAID on a road that is closing the plan — money was taken for a plan that is being cancelled, and its credits will not move. Check this customer.`,
      );
      // THE SURFACE (#771, PR #770's reviewer): production has no Slack
      // webhook and nobody is subscribed to this log, so the warn alone was a
      // control nobody could see. A critical audit row lands it on the admin
      // overview's alerts feed and the staff audit log's billing filter —
      // the same road the login-attack alarm took on his ruling. It sits
      // HERE rather than at each caller so every road that voids an invoice
      // (final payment failure, voluntary cancel) reports the same way.
      // (Named, not inline: `environmentTag.test.ts` scans every inline
      // metadata literal here for the Stripe tag; this one is ours.)
      const { logAuditEvent, AUDIT_ACTIONS } = await import("../auditLog");
      const detail = {
        stripeInvoiceId: invoiceId,
        stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null,
        amountPaidCents: invoice.amount_paid ?? null,
        reason: `Invoice ${invoiceId} was already paid when the plan ended — money taken, credits will not move`,
      };
      await logAuditEvent({
        action: AUDIT_ACTIONS.INVOICE_PAID_AFTER_PLAN_ENDED,
        resourceType: "billing",
        resourceId: invoiceId,
        metadata: detail,
        severity: "critical",
      });
      return "already-paid";
    }
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
  /**
   * The credit slider's steps, as a MONTH'S ledger credits on each side
   * (#1832) — the dial's share of the allowance difference, which rides the
   * same mirror rule as the plan's own.
   *
   * ⚠ **AN OPTIONS OBJECT RATHER THAN TWO MORE POSITIONALS**, because a sixth
   * and seventh number on a function whose first five are already two plans
   * and three counts is a call site nobody can read — and this one decides
   * credits. Defaulting both to 0 keeps every existing caller and its arms
   * exactly as they were.
   */
  extra: {
    currentExtraMonthlyCredits?: number;
    targetExtraMonthlyCredits?: number;
    /**
     * The months' worth of the current period still on the balance for unused
     * time (#2152, `grantedShareMonths`) — given on a yearly plan granted month
     * by month, where it replaces `monthsInCycle × daysRemaining / totalDays`.
     * Absent keeps that product, and every existing caller with it.
     */
    grantedShareMonths?: number;
  } = {},
): number {
  const currentCredits =
    PLAN_TIERS[currentPlan].monthlyCredits + (extra.currentExtraMonthlyCredits ?? 0);
  const newCredits =
    PLAN_TIERS[newPlan].monthlyCredits + (extra.targetExtraMonthlyCredits ?? 0);

  const deltaForCycle =
    extra.grantedShareMonths === undefined
      ? (newCredits - currentCredits) * monthsInCycle
      : newCredits - currentCredits;
  const fraction =
    extra.grantedShareMonths === undefined ? daysRemaining / totalDays : extra.grantedShareMonths;

  // Both arms land on a whole number of DISPLAY credits (#1604 done-when 2).
  // `wholeDisplayLedger` truncates toward zero, which is the direction each arm
  // already wanted: a grant never more than can be shown, a deduction never
  // more than the mirror grant.
  if (deltaForCycle >= 0) {
    return wholeDisplayLedger(Math.floor(deltaForCycle * fraction));
  }
  // Downgrade: the same share, the other way. Truncate toward zero so the
  // deduction never exceeds the mirror of what an upgrade would have granted.
  return wholeDisplayLedger(-Math.floor(-deltaForCycle * fraction));
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
async function getPaymentIntentFromSession(sessionId: string): Promise<string | null> {
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
 * Refund statuses that mean NO MONEY IS GOING BACK, read off the object
 * `refunds.create` returns (#771, founder ruling 2026-09-10, option C — A
 * first: "refuse before touching their credits, and leave it for a human").
 *
 * Stripe's refund statuses are `pending`, `requires_action`, `succeeded`,
 * `failed` and `canceled`. ⚠ `pending` is COMMON AND BENIGN — a bank refund
 * lands days later — and `requires_action` is a refund waiting on the
 * customer, not one that has failed. So this is NOT "anything but succeeded
 * is a failure": only the two terminal no-money statuses are refused, and a
 * refund that fails LATER takes the `refund.failed` webhook road
 * (`handleRefundFailed` in webhooks.ts), which is the common shape.
 *
 * Before this constant existed the create-time status was logged inside a
 * sentence that said "issued" and returned `success: true` whatever it was,
 * so the caller went on to deduct the customer's credits, mark the change
 * request approved and write an audit row naming a refund that never paid.
 */
const REFUND_CREATE_FAILED_STATUSES: ReadonlySet<string> = new Set(["failed", "canceled"]);

/**
 * What a refund is FOR, written into its Stripe metadata so the asynchronous
 * road can find its way back: a `refund.failed` event carries the refund
 * object and nothing of ours, and the credit deduction it must undo is keyed
 * on the change request. Metadata values are strings on the wire.
 */
export type RefundTracking = {
  userId: number;
  changeRequestId: number;
};

export const REFUND_METADATA_USER_KEY = "drapeUserId";
export const REFUND_METADATA_CHANGE_REQUEST_KEY = "drapeChangeRequestId";

/**
 * Issue a Stripe refund for a payment.
 * Supports full or partial refunds via amountCents parameter.
 *
 * @param sessionId - The original Stripe checkout session ID
 * @param amountCents - Refund amount in cents (omit for full refund)
 * @param reason - Reason for the refund
 * @param tracking - who and which change request, stamped on the refund's
 *   metadata so a later `refund.failed` event can undo the credit deduction
 * @returns Refund result with Stripe refund ID and status. `success: false`
 *   with a `status` means Stripe CREATED the refund and reported it as
 *   `failed` / `canceled` in the same breath — no money is going back, and
 *   the caller must move nothing.
 */
export async function issueStripeRefund(
  sessionId: string,
  amountCents?: number,
  reason?: string,
  tracking?: RefundTracking,
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
        ...(reason ? { reason } : {}),
        ...(tracking
          ? {
              [REFUND_METADATA_USER_KEY]: String(tracking.userId),
              [REFUND_METADATA_CHANGE_REQUEST_KEY]: String(tracking.changeRequestId),
            }
          : {}),
      },
    };

    if (amountCents && amountCents > 0) {
      refundParams.amount = amountCents;
    }

    const refund = await stripe.refunds.create(refundParams);
    const status = refund.status ?? undefined;

    if (status && REFUND_CREATE_FAILED_STATUSES.has(status)) {
      const why = refund.failure_reason ? ` (${refund.failure_reason})` : "";
      log.warn(
        `[Stripe] Refund ${refund.id} for session ${sessionId} came back ${status}${why} — no money is going back; nothing moved`,
      );
      return {
        success: false,
        refundId: refund.id,
        status,
        error: `Stripe reported the refund as ${status}${why} — no money went back, so the customer's credits were left alone. Check the customer's payment method and try again, or refund another way.`,
      };
    }

    log.info(`[Stripe] Refund ${refund.id} created for session ${sessionId}: ${status ?? "no status"} ($${(refund.amount / 100).toFixed(2)})`);

    return {
      success: true,
      refundId: refund.id,
      status,
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
