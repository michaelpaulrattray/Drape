/**
 * Stripe Products and Prices Configuration
 * 
 * Progressive tier-based pricing with exponential scaling.
 * Prices are in cents (USD).
 */

import { PLAN_TIERS, PlanTier } from "../../drizzle/schema";

/**
 * The ladder's orders, DERIVED from `PLAN_TIERS` (working law 4 — this file
 * used to retype the key list by hand, which is the drift the #391 fold
 * removed). Declaration order in the table is ladder order.
 *
 * ⚠ THE HIDDEN RUNG (#391, founder ruling 2026-09-05): `ultimate` is a real,
 * hand-sold product — an account can BE on it and every proration/rollover
 * read works — but it is never OFFERED. It is absent from `billing.getPlans`
 * (so its price is never published), absent from every picker, and the
 * checkout/changePlan/preview enums are built from `PURCHASABLE_PLANS`, which
 * excludes it — a rung nobody can select in the UI but the API still accepts
 * would be an open money path with no surface (invariant 5). The customer's
 * door is an email line under the ladder; his approval sends a checkout link
 * by hand.
 */
export const HIDDEN_PLAN_TIERS = ["ultimate"] as const;
export type HiddenPlanTier = (typeof HIDDEN_PLAN_TIERS)[number];

export function isHiddenPlanTier(tier: PlanTier): boolean {
  return (HIDDEN_PLAN_TIERS as readonly string[]).includes(tier);
}

// Full plan order including free — every tier that EXISTS, hidden included.
export const PLAN_ORDER = Object.keys(PLAN_TIERS) as PlanTier[];

// All paid plan tier keys in order (excludes "free")
export const PAID_PLAN_ORDER: PlanTier[] = PLAN_ORDER.filter((tier) => tier !== "free");

// The ladder a customer is SHOWN — every tier minus the hidden ones.
export const OFFERED_PLAN_ORDER: PlanTier[] = PLAN_ORDER.filter(
  (tier) => !isHiddenPlanTier(tier),
);

// The rungs a customer can put into a checkout — offered and paid. This is
// what the three billing input enums parse against.
export const PURCHASABLE_PLANS = PAID_PLAN_ORDER.filter(
  (tier) => !isHiddenPlanTier(tier),
) as [PlanTier, ...PlanTier[]];

/**
 * The offered tiers as an object — `billing.getPlans`'s explicit `tiers`
 * projection (invariant 8: the full `PLAN_TIERS` must not cross the public
 * wire, because the hidden rung's price is deliberately unpublished).
 */
export const OFFERED_PLAN_TIERS = Object.fromEntries(
  OFFERED_PLAN_ORDER.map((tier) => [tier, PLAN_TIERS[tier]]),
) as { [K in Exclude<PlanTier, HiddenPlanTier>]: (typeof PLAN_TIERS)[K] };

/**
 * The OWN-ROW plan facts `billing.getStatus` serves (#391). A customer's own
 * tier is their data, and since `getPlans` stopped serving the hidden rung,
 * this is the ONLY road by which an account on it learns its own plan's name
 * — without it, Settings captions a hand-sold Ultimate account "Free", which
 * is the one thing a billing surface must never do (PR #583 finding 1).
 *
 * Takes the raw DB value rather than `PlanTier` because the column
 * deliberately still accepts the four folded legacy values. Zero rows hold
 * one today; if one ever appears it is captioned as WORDS, never as the
 * pipeline slug, and no price or allowance is claimed that the product no
 * longer states.
 */
export function ownPlanFacts(tier: string): {
  planName: string;
  planPriceInCents: number;
  planMonthlyCredits: number;
} {
  const known = (PLAN_TIERS as Record<string, { name: string; price: number; monthlyCredits: number }>)[tier];
  if (known) {
    return {
      planName: known.name,
      planPriceInCents: known.price,
      planMonthlyCredits: known.monthlyCredits,
    };
  }
  return {
    planName: tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, " "),
    planPriceInCents: 0,
    planMonthlyCredits: 0,
  };
}

// Subscription Plans — generated from PLAN_TIERS
export const SUBSCRIPTION_PRODUCTS: Record<string, {
  name: string;
  description: string;
  priceInCents: number;
  credits: number;
  interval: "month";
  features: string[];
}> = {
  starter: {
    name: PLAN_TIERS.starter.name,
    description: `${PLAN_TIERS.starter.monthlyCredits.toLocaleString()} credits/month with ${PLAN_TIERS.starter.rolloverPercent}% rollover`,
    priceInCents: PLAN_TIERS.starter.price,
    credits: PLAN_TIERS.starter.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.starter.monthlyCredits.toLocaleString()} credits per month`,
      `${PLAN_TIERS.starter.rolloverPercent}% unused credit rollover`,
      "All generation features",
      "Standard support",
    ],
  },
  pro: {
    name: PLAN_TIERS.pro.name,
    description: `${PLAN_TIERS.pro.monthlyCredits.toLocaleString()} credits/month with ${PLAN_TIERS.pro.rolloverPercent}% rollover`,
    priceInCents: PLAN_TIERS.pro.price,
    credits: PLAN_TIERS.pro.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.pro.monthlyCredits.toLocaleString()} credits per month`,
      `${PLAN_TIERS.pro.rolloverPercent}% unused credit rollover`,
      "All generation features",
      "Priority support",
      "Early access to new features",
    ],
  },
  studio: {
    name: PLAN_TIERS.studio.name,
    description: `${PLAN_TIERS.studio.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.studio.price,
    credits: PLAN_TIERS.studio.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.studio.monthlyCredits.toLocaleString()} credits per month`,
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Early access to new features",
    ],
  },
  business: {
    name: PLAN_TIERS.business.name,
    description: `${PLAN_TIERS.business.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.business.price,
    credits: PLAN_TIERS.business.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.business.monthlyCredits.toLocaleString()} credits per month`,
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Dedicated account manager",
    ],
  },
  scale: {
    name: PLAN_TIERS.scale.name,
    description: `${PLAN_TIERS.scale.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.scale.price,
    credits: PLAN_TIERS.scale.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.scale.monthlyCredits.toLocaleString()} credits per month`,
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Dedicated account manager",
      "Custom integrations",
    ],
  },
  enterprise: {
    name: PLAN_TIERS.enterprise.name,
    description: `${PLAN_TIERS.enterprise.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.enterprise.price,
    credits: PLAN_TIERS.enterprise.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.enterprise.monthlyCredits.toLocaleString()} credits per month`,
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
  // HIDDEN (#391): a real product for the account he approves by hand, so the
  // proration and rollover reads stay whole — but it is never offered.
  // `billing.getPlans` maps PURCHASABLE_PLANS, never this object's keys, so
  // this entry (and its price) stays off the public wire.
  ultimate: {
    name: PLAN_TIERS.ultimate.name,
    description: `${PLAN_TIERS.ultimate.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.ultimate.price,
    credits: PLAN_TIERS.ultimate.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.ultimate.monthlyCredits.toLocaleString()} credits per month`,
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "White-glove onboarding",
    ],
  },
};

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PRODUCTS;
