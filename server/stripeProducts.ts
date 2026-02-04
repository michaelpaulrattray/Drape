/**
 * Stripe Products and Prices Configuration
 * 
 * All subscription plans and credit top-up products are defined here.
 * Prices are in cents (USD).
 */

import { PLAN_TIERS } from "../drizzle/schema";

// Subscription Plans
export const SUBSCRIPTION_PRODUCTS = {
  starter: {
    name: "FormaStudio Starter",
    description: "1,500 credits/month with 50% rollover",
    priceInCents: PLAN_TIERS.starter.price, // $12/month
    credits: PLAN_TIERS.starter.monthlyCredits,
    interval: "month" as const,
    features: [
      "1,500 credits per month",
      "50% unused credit rollover",
      "All generation features",
      "Standard support",
    ],
  },
  pro: {
    name: "FormaStudio Pro",
    description: "4,000 credits/month with 75% rollover",
    priceInCents: PLAN_TIERS.pro.price, // $29/month
    credits: PLAN_TIERS.pro.monthlyCredits,
    interval: "month" as const,
    features: [
      "4,000 credits per month",
      "75% unused credit rollover",
      "All generation features",
      "Priority support",
      "Early access to new features",
    ],
  },
  studio: {
    name: "FormaStudio Studio",
    description: "10,000 credits/month with 100% rollover",
    priceInCents: PLAN_TIERS.studio.price, // $59/month
    credits: PLAN_TIERS.studio.monthlyCredits,
    interval: "month" as const,
    features: [
      "10,000 credits per month",
      "100% unused credit rollover",
      "All generation features",
      "Priority support",
      "Early access to new features",
      "Dedicated account manager",
    ],
  },
} as const;

// Credit Top-up Packages
export const CREDIT_TOPUP_PRODUCTS = {
  small: {
    name: "100 Credits",
    description: "One-time credit top-up",
    priceInCents: 150, // $1.50
    credits: 100,
  },
  medium: {
    name: "500 Credits",
    description: "One-time credit top-up (save 10%)",
    priceInCents: 675, // $6.75 (normally $7.50)
    credits: 500,
  },
  large: {
    name: "1,000 Credits",
    description: "One-time credit top-up (save 15%)",
    priceInCents: 1275, // $12.75 (normally $15)
    credits: 1000,
  },
  xl: {
    name: "5,000 Credits",
    description: "One-time credit top-up (save 20%)",
    priceInCents: 6000, // $60 (normally $75)
    credits: 5000,
  },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PRODUCTS;
export type CreditTopupPackage = keyof typeof CREDIT_TOPUP_PRODUCTS;
