import { describe, it, expect, vi, beforeEach } from "vitest";
import { PLAN_TIERS, PlanTier } from "../drizzle/schema";
import { SUBSCRIPTION_PRODUCTS } from "./stripe/stripeProducts";
import { calculateRolloverCredits, getMonthlyCredits, mapStripeStatus, mapPlanToTier } from "./stripe/stripeService";

describe("Billing - Plan Tiers Configuration", () => {
  it("should have correct pricing for all tiers", () => {
    expect(PLAN_TIERS.free.price).toBe(0);
    expect(PLAN_TIERS.starter.price).toBe(2700);
    expect(PLAN_TIERS.pro.price).toBe(6800);
    expect(PLAN_TIERS.studio.price).toBe(15900);
    expect(PLAN_TIERS.studio_plus.price).toBe(37500);
    expect(PLAN_TIERS.business.price).toBe(84000);
    expect(PLAN_TIERS.business_plus.price).toBe(195000);
    expect(PLAN_TIERS.scale.price).toBe(480000);
    expect(PLAN_TIERS.scale_plus.price).toBe(880000);
    expect(PLAN_TIERS.enterprise.price).toBe(1500000);
    expect(PLAN_TIERS.enterprise_plus.price).toBe(2700000);
    expect(PLAN_TIERS.ultimate.price).toBe(4800000);
  });

  it("should have correct monthly credits for all tiers", () => {
    expect(PLAN_TIERS.free.monthlyCredits).toBe(5000);
    expect(PLAN_TIERS.starter.monthlyCredits).toBe(75000);
    expect(PLAN_TIERS.pro.monthlyCredits).toBe(200000);
    expect(PLAN_TIERS.studio.monthlyCredits).toBe(500000);
    expect(PLAN_TIERS.studio_plus.monthlyCredits).toBe(1250000);
    expect(PLAN_TIERS.business.monthlyCredits).toBe(3000000);
    expect(PLAN_TIERS.business_plus.monthlyCredits).toBe(7500000);
    expect(PLAN_TIERS.scale.monthlyCredits).toBe(20000000);
    expect(PLAN_TIERS.scale_plus.monthlyCredits).toBe(40000000);
    expect(PLAN_TIERS.enterprise.monthlyCredits).toBe(75000000);
    expect(PLAN_TIERS.enterprise_plus.monthlyCredits).toBe(150000000);
    expect(PLAN_TIERS.ultimate.monthlyCredits).toBe(300000000);
  });

  it("should have correct rollover percentages", () => {
    expect(PLAN_TIERS.free.rolloverPercent).toBe(0);
    expect(PLAN_TIERS.starter.rolloverPercent).toBe(50);
    expect(PLAN_TIERS.pro.rolloverPercent).toBe(75);
    expect(PLAN_TIERS.studio.rolloverPercent).toBe(100);
    expect(PLAN_TIERS.ultimate.rolloverPercent).toBe(100);
  });

  it("should have 12 total tiers", () => {
    expect(Object.keys(PLAN_TIERS).length).toBe(12);
  });

  it("should have progressively increasing credits", () => {
    const tiers = Object.values(PLAN_TIERS);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].monthlyCredits).toBeGreaterThan(tiers[i - 1].monthlyCredits);
    }
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
    expect(getMonthlyCredits("free")).toBe(5000);
    expect(getMonthlyCredits("starter")).toBe(75000);
    expect(getMonthlyCredits("pro")).toBe(200000);
    expect(getMonthlyCredits("studio")).toBe(500000);
    expect(getMonthlyCredits("studio_plus")).toBe(1250000);
    expect(getMonthlyCredits("business")).toBe(3000000);
    expect(getMonthlyCredits("business_plus")).toBe(7500000);
    expect(getMonthlyCredits("scale")).toBe(20000000);
    expect(getMonthlyCredits("scale_plus")).toBe(40000000);
    expect(getMonthlyCredits("enterprise")).toBe(75000000);
    expect(getMonthlyCredits("enterprise_plus")).toBe(150000000);
    expect(getMonthlyCredits("ultimate")).toBe(300000000);
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


import { calculateCreditAdjustment } from "./stripe/stripeService";

describe("Billing - Low Balance Warning", () => {
  const LOW_BALANCE_THRESHOLD = 2500; // 50x multiplier (was 50)

  it("should trigger warning when balance is below threshold", () => {
    expect(2499 < LOW_BALANCE_THRESHOLD).toBe(true);
    expect(2500 < LOW_BALANCE_THRESHOLD).toBe(false);
    expect(0 < LOW_BALANCE_THRESHOLD).toBe(true);
  });

  it("should identify critical balance at zero", () => {
    const isCritical = (balance: number) => balance === 0;
    expect(isCritical(0)).toBe(true);
    expect(isCritical(1)).toBe(false);
    expect(isCritical(2500)).toBe(false);
  });

  it("should identify very low balance under 500", () => {
    const isVeryLow = (balance: number) => balance < 500; // 50x multiplier (was 10)
    expect(isVeryLow(0)).toBe(true);
    expect(isVeryLow(499)).toBe(true);
    expect(isVeryLow(500)).toBe(false);
    expect(isVeryLow(2499)).toBe(false);
  });
});

describe("Billing - Credit Adjustment for Plan Changes", () => {
  it("should return 0 for downgrade (no immediate credit change)", () => {
    // Pro to Starter
    expect(calculateCreditAdjustment("pro", "starter", 15, 30)).toBe(0);
    // Studio to Pro
    expect(calculateCreditAdjustment("studio", "pro", 15, 30)).toBe(0);
    // Studio to Starter
    expect(calculateCreditAdjustment("studio", "starter", 15, 30)).toBe(0);
  });

  it("should calculate prorated credits for upgrade", () => {
    // Starter (75,000) to Pro (200,000), 15 days remaining of 30
    // Additional credits: 200,000 - 75,000 = 125,000
    // Prorated: 125,000 * (15/30) = 62,500
    expect(calculateCreditAdjustment("starter", "pro", 15, 30)).toBe(62500);
  });

  it("should calculate full credits for upgrade at start of period", () => {
    // Starter to Pro, 30 days remaining of 30
    // Additional credits: 125,000
    // Prorated: 125,000 * (30/30) = 125,000
    expect(calculateCreditAdjustment("starter", "pro", 30, 30)).toBe(125000);
  });

  it("should calculate minimal credits for upgrade near end of period", () => {
    // Starter to Pro, 1 day remaining of 30
    // Additional credits: 125,000
    // Prorated: 125,000 * (1/30) = 4,166
    expect(calculateCreditAdjustment("starter", "pro", 1, 30)).toBe(4166);
  });

  it("should handle upgrade from free tier", () => {
    // Free (5,000) to Starter (75,000), 15 days remaining of 30
    // Additional credits: 75,000 - 5,000 = 70,000
    // Prorated: 70,000 * (15/30) = 35,000
    expect(calculateCreditAdjustment("free", "starter", 15, 30)).toBe(35000);
  });

  it("should handle upgrade to studio tier", () => {
    // Pro (200,000) to Studio (500,000), 20 days remaining of 30
    // Additional credits: 500,000 - 200,000 = 300,000
    // Prorated: 300,000 * (20/30) = 200,000
    expect(calculateCreditAdjustment("pro", "studio", 20, 30)).toBe(200000);
  });

  it("should return 0 for same plan", () => {
    expect(calculateCreditAdjustment("pro", "pro", 15, 30)).toBe(0);
    expect(calculateCreditAdjustment("starter", "starter", 15, 30)).toBe(0);
  });
});


describe("Billing - Invoice Retrieval", () => {
  it("should format invoice date correctly", () => {
    const date = new Date("2026-02-04T10:30:00Z");
    const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    expect(formatted).toBe("Feb 4, 2026");
  });

  it("should format invoice amount correctly", () => {
    const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;
    expect(formatAmount(1200)).toBe("$12.00");
    expect(formatAmount(2999)).toBe("$29.99");
    expect(formatAmount(0)).toBe("$0.00");
    expect(formatAmount(100)).toBe("$1.00");
  });

  it("should handle empty invoice list", () => {
    const invoices: Array<{ id: string }> = [];
    expect(invoices.length).toBe(0);
    expect(invoices).toEqual([]);
  });

  it("should identify paid vs unpaid invoices", () => {
    const isPaid = (status: string) => status === "paid";
    expect(isPaid("paid")).toBe(true);
    expect(isPaid("open")).toBe(false);
    expect(isPaid("draft")).toBe(false);
    expect(isPaid("void")).toBe(false);
  });
});

describe("Billing - Subscription Details", () => {
  it("should identify active subscription", () => {
    const isActive = (status: string) => status === "active" || status === "trialing";
    expect(isActive("active")).toBe(true);
    expect(isActive("trialing")).toBe(true);
    expect(isActive("canceled")).toBe(false);
    expect(isActive("past_due")).toBe(false);
  });

  it("should calculate days until renewal", () => {
    const now = new Date("2026-02-04");
    const renewalDate = new Date("2026-02-20");
    const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysUntilRenewal).toBe(16);
  });

  it("should identify canceling subscription", () => {
    const isCanceling = (cancelAtPeriodEnd: boolean, status: string) => 
      cancelAtPeriodEnd && status === "active";
    expect(isCanceling(true, "active")).toBe(true);
    expect(isCanceling(false, "active")).toBe(false);
    expect(isCanceling(true, "canceled")).toBe(false);
  });
});


// ============ Usage Analytics Tests ============

describe("Usage Analytics - Stats Calculation", () => {
  it("should calculate total credits used from transactions", () => {
    const transactions = [
      { amount: -10, type: "generation" },
      { amount: -5, type: "generation" },
      { amount: 100, type: "topup" },
      { amount: -15, type: "generation" },
    ];
    
    const totalUsed = transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    expect(totalUsed).toBe(30);
  });

  it("should count generations correctly", () => {
    const transactions = [
      { amount: -10, type: "generation" },
      { amount: -5, type: "generation" },
      { amount: 100, type: "topup" },
      { amount: -15, type: "generation" },
      { amount: 50, type: "subscription" },
    ];
    
    const generationCount = transactions.filter(tx => tx.amount < 0).length;
    expect(generationCount).toBe(3);
  });

  it("should calculate daily average correctly", () => {
    const totalCreditsUsed = 300;
    const days = 30;
    const average = Math.round((totalCreditsUsed / days) * 10) / 10;
    expect(average).toBe(10);
  });

  it("should handle zero usage", () => {
    const transactions: Array<{ amount: number }> = [];
    const totalUsed = transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    expect(totalUsed).toBe(0);
  });

  it("should group usage by type", () => {
    const transactions = [
      { amount: -10, type: "generation" },
      { amount: -5, type: "generation" },
      { amount: -20, type: "generation" },
    ];
    
    const byType: Record<string, { count: number; credits: number }> = {};
    for (const tx of transactions) {
      if (tx.amount < 0) {
        const type = tx.type;
        if (!byType[type]) {
          byType[type] = { count: 0, credits: 0 };
        }
        byType[type].count++;
        byType[type].credits += Math.abs(tx.amount);
      }
    }
    
    expect(byType["generation"]).toEqual({ count: 3, credits: 35 });
  });
});

describe("Usage Analytics - Daily Aggregation", () => {
  it("should aggregate transactions by date", () => {
    const transactions = [
      { amount: -10, createdAt: new Date("2026-02-01T10:00:00Z") },
      { amount: -5, createdAt: new Date("2026-02-01T14:00:00Z") },
      { amount: -15, createdAt: new Date("2026-02-02T09:00:00Z") },
    ];
    
    const dailyMap = new Map<string, number>();
    for (const tx of transactions) {
      const dateStr = tx.createdAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr) || 0;
      dailyMap.set(dateStr, existing + Math.abs(tx.amount));
    }
    
    expect(dailyMap.get("2026-02-01")).toBe(15);
    expect(dailyMap.get("2026-02-02")).toBe(15);
  });

  it("should handle empty days in date range", () => {
    const days = 7;
    const dailyMap = new Map<string, { creditsUsed: number; generationCount: number }>();
    
    // Initialize all days with zero values
    for (let i = 0; i < days; i++) {
      const date = new Date("2026-02-01");
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { creditsUsed: 0, generationCount: 0 });
    }
    
    expect(dailyMap.size).toBe(7);
    expect(dailyMap.get("2026-02-01")).toEqual({ creditsUsed: 0, generationCount: 0 });
  });

  it("should format date correctly for display", () => {
    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
    
    // Use explicit UTC dates to avoid timezone issues
    const date1 = new Date(Date.UTC(2026, 1, 4, 12, 0, 0));
    const date2 = new Date(Date.UTC(2026, 11, 25, 12, 0, 0));
    
    // Just verify the format pattern works (month + day)
    expect(formatDate(date1)).toMatch(/Feb \d+/);
    expect(formatDate(date2)).toMatch(/Dec \d+/);
  });
});

describe("Usage Analytics - Transaction History", () => {
  it("should paginate transactions correctly", () => {
    const allTransactions = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const pageSize = 10;
    const page = 0;
    
    const paginated = allTransactions.slice(page * pageSize, (page + 1) * pageSize);
    expect(paginated.length).toBe(10);
    expect(paginated[0].id).toBe(1);
    expect(paginated[9].id).toBe(10);
  });

  it("should calculate total pages correctly", () => {
    const total = 25;
    const pageSize = 10;
    const totalPages = Math.ceil(total / pageSize);
    expect(totalPages).toBe(3);
  });

  it("should handle last page with fewer items", () => {
    const allTransactions = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const pageSize = 10;
    const page = 2; // Third page (0-indexed)
    
    const paginated = allTransactions.slice(page * pageSize, (page + 1) * pageSize);
    expect(paginated.length).toBe(5);
    expect(paginated[0].id).toBe(21);
    expect(paginated[4].id).toBe(25);
  });

  it("should identify transaction types correctly", () => {
    const getTypeLabel = (type: string) => {
      switch (type) {
        case "generation": return "Generation";
        case "purchase": return "Purchase";
        case "bonus": return "Bonus";
        case "refund": return "Refund";
        case "signup": return "Welcome Bonus";
        case "topup": return "Credit Top-up";
        case "subscription": return "Subscription";
        default: return type;
      }
    };
    
    expect(getTypeLabel("generation")).toBe("Generation");
    expect(getTypeLabel("topup")).toBe("Credit Top-up");
    expect(getTypeLabel("signup")).toBe("Welcome Bonus");
    expect(getTypeLabel("unknown")).toBe("unknown");
  });

  it("should format credit amounts with sign", () => {
    const formatAmount = (amount: number) => {
      return amount > 0 ? `+${amount}` : `${amount}`;
    };
    
    expect(formatAmount(100)).toBe("+100");
    expect(formatAmount(-10)).toBe("-10");
    expect(formatAmount(0)).toBe("0");
  });
});
