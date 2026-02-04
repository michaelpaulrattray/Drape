import { describe, it, expect, vi, beforeEach } from "vitest";
import { PLAN_TIERS, PlanTier } from "../drizzle/schema";
import { SUBSCRIPTION_PRODUCTS, CREDIT_TOPUP_PRODUCTS } from "./stripeProducts";
import { calculateRolloverCredits, getMonthlyCredits, mapStripeStatus, mapPlanToTier } from "./stripeService";

describe("Billing - Plan Tiers Configuration", () => {
  it("should have correct pricing for all tiers", () => {
    expect(PLAN_TIERS.free.price).toBe(0);
    expect(PLAN_TIERS.starter.price).toBe(1200); // $12
    expect(PLAN_TIERS.pro.price).toBe(2900); // $29
    expect(PLAN_TIERS.studio.price).toBe(5900); // $59
  });

  it("should have correct monthly credits for all tiers", () => {
    expect(PLAN_TIERS.free.monthlyCredits).toBe(100);
    expect(PLAN_TIERS.starter.monthlyCredits).toBe(1500);
    expect(PLAN_TIERS.pro.monthlyCredits).toBe(4000);
    expect(PLAN_TIERS.studio.monthlyCredits).toBe(10000);
  });

  it("should have correct rollover percentages", () => {
    expect(PLAN_TIERS.free.rolloverPercent).toBe(0);
    expect(PLAN_TIERS.starter.rolloverPercent).toBe(50);
    expect(PLAN_TIERS.pro.rolloverPercent).toBe(75);
    expect(PLAN_TIERS.studio.rolloverPercent).toBe(100);
  });
});

describe("Billing - Subscription Products", () => {
  it("should have all required subscription plans", () => {
    expect(SUBSCRIPTION_PRODUCTS.starter).toBeDefined();
    expect(SUBSCRIPTION_PRODUCTS.pro).toBeDefined();
    expect(SUBSCRIPTION_PRODUCTS.studio).toBeDefined();
  });

  it("should have correct pricing matching PLAN_TIERS", () => {
    expect(SUBSCRIPTION_PRODUCTS.starter.priceInCents).toBe(PLAN_TIERS.starter.price);
    expect(SUBSCRIPTION_PRODUCTS.pro.priceInCents).toBe(PLAN_TIERS.pro.price);
    expect(SUBSCRIPTION_PRODUCTS.studio.priceInCents).toBe(PLAN_TIERS.studio.price);
  });

  it("should have correct credits matching PLAN_TIERS", () => {
    expect(SUBSCRIPTION_PRODUCTS.starter.credits).toBe(PLAN_TIERS.starter.monthlyCredits);
    expect(SUBSCRIPTION_PRODUCTS.pro.credits).toBe(PLAN_TIERS.pro.monthlyCredits);
    expect(SUBSCRIPTION_PRODUCTS.studio.credits).toBe(PLAN_TIERS.studio.monthlyCredits);
  });

  it("should have features array for each plan", () => {
    expect(Array.isArray(SUBSCRIPTION_PRODUCTS.starter.features)).toBe(true);
    expect(SUBSCRIPTION_PRODUCTS.starter.features.length).toBeGreaterThan(0);
    expect(Array.isArray(SUBSCRIPTION_PRODUCTS.pro.features)).toBe(true);
    expect(SUBSCRIPTION_PRODUCTS.pro.features.length).toBeGreaterThan(0);
    expect(Array.isArray(SUBSCRIPTION_PRODUCTS.studio.features)).toBe(true);
    expect(SUBSCRIPTION_PRODUCTS.studio.features.length).toBeGreaterThan(0);
  });
});

describe("Billing - Credit Top-up Products", () => {
  it("should have all required top-up packages", () => {
    expect(CREDIT_TOPUP_PRODUCTS.small).toBeDefined();
    expect(CREDIT_TOPUP_PRODUCTS.medium).toBeDefined();
    expect(CREDIT_TOPUP_PRODUCTS.large).toBeDefined();
    expect(CREDIT_TOPUP_PRODUCTS.xl).toBeDefined();
  });

  it("should have correct credit amounts", () => {
    expect(CREDIT_TOPUP_PRODUCTS.small.credits).toBe(100);
    expect(CREDIT_TOPUP_PRODUCTS.medium.credits).toBe(500);
    expect(CREDIT_TOPUP_PRODUCTS.large.credits).toBe(1000);
    expect(CREDIT_TOPUP_PRODUCTS.xl.credits).toBe(5000);
  });

  it("should have volume discounts for larger packages", () => {
    // Base rate: $1.50 per 100 credits
    const baseRate = CREDIT_TOPUP_PRODUCTS.small.priceInCents / CREDIT_TOPUP_PRODUCTS.small.credits;
    
    // Medium should be cheaper per credit
    const mediumRate = CREDIT_TOPUP_PRODUCTS.medium.priceInCents / CREDIT_TOPUP_PRODUCTS.medium.credits;
    expect(mediumRate).toBeLessThan(baseRate);
    
    // Large should be cheaper than medium
    const largeRate = CREDIT_TOPUP_PRODUCTS.large.priceInCents / CREDIT_TOPUP_PRODUCTS.large.credits;
    expect(largeRate).toBeLessThan(mediumRate);
    
    // XL should be cheapest
    const xlRate = CREDIT_TOPUP_PRODUCTS.xl.priceInCents / CREDIT_TOPUP_PRODUCTS.xl.credits;
    expect(xlRate).toBeLessThan(largeRate);
  });
});

describe("Billing - Rollover Calculation", () => {
  it("should calculate 0% rollover for free tier", () => {
    const rollover = calculateRolloverCredits(100, "free");
    expect(rollover).toBe(0);
  });

  it("should calculate 50% rollover for starter tier", () => {
    const rollover = calculateRolloverCredits(100, "starter");
    expect(rollover).toBe(50);
  });

  it("should calculate 75% rollover for pro tier", () => {
    const rollover = calculateRolloverCredits(100, "pro");
    expect(rollover).toBe(75);
  });

  it("should calculate 100% rollover for studio tier", () => {
    const rollover = calculateRolloverCredits(100, "studio");
    expect(rollover).toBe(100);
  });

  it("should floor rollover credits to whole numbers", () => {
    const rollover = calculateRolloverCredits(33, "starter"); // 33 * 0.5 = 16.5
    expect(rollover).toBe(16);
  });

  it("should handle zero unused credits", () => {
    const rollover = calculateRolloverCredits(0, "pro");
    expect(rollover).toBe(0);
  });
});

describe("Billing - Monthly Credits", () => {
  it("should return correct monthly credits for each tier", () => {
    expect(getMonthlyCredits("free")).toBe(100);
    expect(getMonthlyCredits("starter")).toBe(1500);
    expect(getMonthlyCredits("pro")).toBe(4000);
    expect(getMonthlyCredits("studio")).toBe(10000);
    expect(getMonthlyCredits("enterprise")).toBe(50000);
  });
});

describe("Billing - Stripe Status Mapping", () => {
  it("should map active status correctly", () => {
    expect(mapStripeStatus("active")).toBe("active");
  });

  it("should map canceled status correctly", () => {
    expect(mapStripeStatus("canceled")).toBe("canceled");
  });

  it("should map past_due status correctly", () => {
    expect(mapStripeStatus("past_due")).toBe("past_due");
  });

  it("should map unpaid status correctly", () => {
    expect(mapStripeStatus("unpaid")).toBe("unpaid");
  });

  it("should map trialing status correctly", () => {
    expect(mapStripeStatus("trialing")).toBe("trialing");
  });

  it("should default to canceled for unknown statuses", () => {
    expect(mapStripeStatus("incomplete" as any)).toBe("canceled");
    expect(mapStripeStatus("incomplete_expired" as any)).toBe("canceled");
  });
});

describe("Billing - Plan to Tier Mapping", () => {
  it("should map subscription plans to plan tiers", () => {
    expect(mapPlanToTier("starter")).toBe("starter");
    expect(mapPlanToTier("pro")).toBe("pro");
    expect(mapPlanToTier("studio")).toBe("studio");
  });
});
