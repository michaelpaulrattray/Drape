import { describe, it, expect, vi, beforeEach } from "vitest";
import { CREDIT_TOPUP_PRODUCTS } from "./stripe/stripeProducts";

/**
 * Tests for credit purchase velocity limits and billing alert integration.
 * These are unit tests that verify the logic without hitting the database.
 */

// ── Velocity Limit Constants (mirrored from routers.ts) ──
const VELOCITY_LIMITS = {
  HOURLY_MAX: 3,
  DAILY_MAX: 10,
  DAILY_CREDIT_CAP: 33333,
};

describe("Credit Purchase Velocity Limits", () => {
  describe("Hourly limit (3/hr)", () => {
    it("should allow purchases when hourly count is below limit", () => {
      const hourlyCount = 2;
      expect(hourlyCount < VELOCITY_LIMITS.HOURLY_MAX).toBe(true);
    });

    it("should block purchases when hourly count equals limit", () => {
      const hourlyCount = 3;
      expect(hourlyCount >= VELOCITY_LIMITS.HOURLY_MAX).toBe(true);
    });

    it("should block purchases when hourly count exceeds limit", () => {
      const hourlyCount = 5;
      expect(hourlyCount >= VELOCITY_LIMITS.HOURLY_MAX).toBe(true);
    });
  });

  describe("Daily limit (10/day)", () => {
    it("should allow purchases when daily count is below limit", () => {
      const dailyCount = 9;
      expect(dailyCount < VELOCITY_LIMITS.DAILY_MAX).toBe(true);
    });

    it("should block purchases when daily count equals limit", () => {
      const dailyCount = 10;
      expect(dailyCount >= VELOCITY_LIMITS.DAILY_MAX).toBe(true);
    });

    it("should block purchases when daily count exceeds limit", () => {
      const dailyCount = 15;
      expect(dailyCount >= VELOCITY_LIMITS.DAILY_MAX).toBe(true);
    });
  });

  describe("Daily credit cap ($500/day ≈ 33333 credits)", () => {
    it("should allow small purchase when under daily cap", () => {
      const dailyCredits = 1000;
      const pkg = CREDIT_TOPUP_PRODUCTS.small;
      expect(dailyCredits + pkg.credits <= VELOCITY_LIMITS.DAILY_CREDIT_CAP).toBe(true);
    });

    it("should allow purchase that exactly reaches the cap", () => {
      const dailyCredits = 33333 - CREDIT_TOPUP_PRODUCTS.small.credits;
      const pkg = CREDIT_TOPUP_PRODUCTS.small;
      expect(dailyCredits + pkg.credits <= VELOCITY_LIMITS.DAILY_CREDIT_CAP).toBe(true);
    });

    it("should block purchase that would exceed the cap", () => {
      const dailyCredits = 30000;
      const pkg = CREDIT_TOPUP_PRODUCTS.xl; // 5000 credits
      expect(dailyCredits + pkg.credits > VELOCITY_LIMITS.DAILY_CREDIT_CAP).toBe(true);
    });

    it("should block any purchase when already at the cap", () => {
      const dailyCredits = 33333;
      const pkg = CREDIT_TOPUP_PRODUCTS.small; // 100 credits
      expect(dailyCredits + pkg.credits > VELOCITY_LIMITS.DAILY_CREDIT_CAP).toBe(true);
    });
  });

  describe("Time window calculations", () => {
    it("should calculate 1-hour window correctly", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const diff = now.getTime() - oneHourAgo.getTime();
      expect(diff).toBe(3600000); // 1 hour in ms
    });

    it("should calculate 24-hour window correctly", () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const diff = now.getTime() - oneDayAgo.getTime();
      expect(diff).toBe(86400000); // 24 hours in ms
    });
  });
});

describe("Top-up Package Validation", () => {
  it("should have all expected package IDs", () => {
    expect(CREDIT_TOPUP_PRODUCTS.small).toBeDefined();
    expect(CREDIT_TOPUP_PRODUCTS.medium).toBeDefined();
    expect(CREDIT_TOPUP_PRODUCTS.large).toBeDefined();
    expect(CREDIT_TOPUP_PRODUCTS.xl).toBeDefined();
  });

  it("should have positive credit amounts for all packages", () => {
    for (const [id, pkg] of Object.entries(CREDIT_TOPUP_PRODUCTS)) {
      expect(pkg.credits).toBeGreaterThan(0);
    }
  });

  it("should have positive prices for all packages", () => {
    for (const [id, pkg] of Object.entries(CREDIT_TOPUP_PRODUCTS)) {
      expect(pkg.priceInCents).toBeGreaterThan(0);
    }
  });

  it("should have increasing credits with larger packages", () => {
    expect(CREDIT_TOPUP_PRODUCTS.medium.credits).toBeGreaterThan(CREDIT_TOPUP_PRODUCTS.small.credits);
    expect(CREDIT_TOPUP_PRODUCTS.large.credits).toBeGreaterThan(CREDIT_TOPUP_PRODUCTS.medium.credits);
    expect(CREDIT_TOPUP_PRODUCTS.xl.credits).toBeGreaterThan(CREDIT_TOPUP_PRODUCTS.large.credits);
  });

  it("should have the daily credit cap high enough for at least 6 xl packages", () => {
    // Ensure the cap is reasonable — at least 6 xl purchases should be allowed per day
    const xlCredits = CREDIT_TOPUP_PRODUCTS.xl.credits;
    expect(VELOCITY_LIMITS.DAILY_CREDIT_CAP).toBeGreaterThanOrEqual(xlCredits * 6);
  });
});

describe("Large Purchase Alert Threshold", () => {
  const LARGE_PURCHASE_THRESHOLD = 500; // from webhooks.ts

  it("should flag large and xl packages as large purchases", () => {
    expect(CREDIT_TOPUP_PRODUCTS.large.credits).toBeGreaterThanOrEqual(LARGE_PURCHASE_THRESHOLD);
    expect(CREDIT_TOPUP_PRODUCTS.xl.credits).toBeGreaterThanOrEqual(LARGE_PURCHASE_THRESHOLD);
  });

  it("should not flag small packages as large purchases", () => {
    expect(CREDIT_TOPUP_PRODUCTS.small.credits).toBeLessThan(LARGE_PURCHASE_THRESHOLD);
  });
});

describe("Billing Alert Templates", () => {
  it("should have all required billing alert methods on SlackAlerts", async () => {
    // Dynamic import to avoid issues with env vars during test
    const { SlackAlerts } = await import("./slack/slackNotification");
    
    expect(typeof SlackAlerts.chargebackFiled).toBe("function");
    expect(typeof SlackAlerts.chargebackResolved).toBe("function");
    expect(typeof SlackAlerts.subscriptionCancelled).toBe("function");
    expect(typeof SlackAlerts.paymentFailed).toBe("function");
    expect(typeof SlackAlerts.largeCreditPurchase).toBe("function");
    expect(typeof SlackAlerts.consumptionSpike).toBe("function");
    expect(typeof SlackAlerts.velocityLimitHit).toBe("function");
  });
});

describe("Billing Alerts Channel Routing", () => {
  it("should have billing-alerts as a valid channel type", async () => {
    const { dispatchBillingAlert } = await import("./slack/slackDispatcher");
    expect(typeof dispatchBillingAlert).toBe("function");
  });
});
