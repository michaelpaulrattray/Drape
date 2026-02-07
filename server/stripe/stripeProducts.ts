/**
 * Stripe Products and Prices Configuration
 * 
 * Progressive tier-based pricing with exponential scaling.
 * Prices are in cents (USD).
 */

import { PLAN_TIERS, PlanTier } from "../../drizzle/schema";

// All paid plan tier keys in order (excludes "free")
export const PAID_PLAN_ORDER: PlanTier[] = [
  "starter", "pro", "studio", "studio_plus", "business",
  "business_plus", "scale", "scale_plus", "enterprise",
  "enterprise_plus", "ultimate",
];

// Full plan order including free
export const PLAN_ORDER: PlanTier[] = ["free", ...PAID_PLAN_ORDER];

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
  studio_plus: {
    name: PLAN_TIERS.studio_plus.name,
    description: `${PLAN_TIERS.studio_plus.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.studio_plus.price,
    credits: PLAN_TIERS.studio_plus.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.studio_plus.monthlyCredits.toLocaleString()} credits per month`,
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Dedicated account manager",
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
  business_plus: {
    name: PLAN_TIERS.business_plus.name,
    description: `${PLAN_TIERS.business_plus.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.business_plus.price,
    credits: PLAN_TIERS.business_plus.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.business_plus.monthlyCredits.toLocaleString()} credits per month`,
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
  scale_plus: {
    name: PLAN_TIERS.scale_plus.name,
    description: `${PLAN_TIERS.scale_plus.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.scale_plus.price,
    credits: PLAN_TIERS.scale_plus.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.scale_plus.monthlyCredits.toLocaleString()} credits per month`,
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
  enterprise_plus: {
    name: PLAN_TIERS.enterprise_plus.name,
    description: `${PLAN_TIERS.enterprise_plus.monthlyCredits.toLocaleString()} credits/month with full rollover`,
    priceInCents: PLAN_TIERS.enterprise_plus.price,
    credits: PLAN_TIERS.enterprise_plus.monthlyCredits,
    interval: "month",
    features: [
      `${PLAN_TIERS.enterprise_plus.monthlyCredits.toLocaleString()} credits per month`,
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
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
