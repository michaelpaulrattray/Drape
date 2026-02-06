import { describe, it, expect } from "vitest";
import { calculateProportionalRefund } from "./stripeService";

describe("Stripe Refund", () => {
  describe("calculateProportionalRefund", () => {
    it("should calculate full refund when no credits used", () => {
      const result = calculateProportionalRefund(1500, 100, 100);
      expect(result.refundAmountCents).toBe(1500);
      expect(result.creditsToDeduct).toBe(100);
      expect(result.creditsUsed).toBe(0);
    });

    it("should calculate proportional refund when some credits used", () => {
      const result = calculateProportionalRefund(1500, 100, 60);
      // 60/100 = 60% unused → refund 60% of $15 = $9 = 900 cents
      expect(result.refundAmountCents).toBe(900);
      expect(result.creditsToDeduct).toBe(60);
      expect(result.creditsUsed).toBe(40);
    });

    it("should return zero refund when all credits used", () => {
      const result = calculateProportionalRefund(1500, 100, 0);
      expect(result.refundAmountCents).toBe(0);
      expect(result.creditsToDeduct).toBe(0);
      expect(result.creditsUsed).toBe(100);
    });

    it("should cap credits to deduct at current balance", () => {
      const result = calculateProportionalRefund(1500, 100, 30);
      // 30/100 = 30% unused → refund 30% of $15 = $4.50 = 450 cents
      expect(result.refundAmountCents).toBe(450);
      expect(result.creditsToDeduct).toBe(30);
      expect(result.creditsUsed).toBe(70);
    });

    it("should handle large package (5000 credits, $60)", () => {
      const result = calculateProportionalRefund(6000, 5000, 4500);
      // 4500/5000 = 90% unused → refund 90% of $60 = $54 = 5400 cents
      expect(result.refundAmountCents).toBe(5400);
      expect(result.creditsToDeduct).toBe(4500);
      expect(result.creditsUsed).toBe(500);
    });

    it("should handle medium package (500 credits, $6.75)", () => {
      const result = calculateProportionalRefund(675, 500, 250);
      // 250/500 = 50% unused → refund 50% of $6.75 = $3.375 → rounded to 338 cents
      expect(result.refundAmountCents).toBe(338);
      expect(result.creditsToDeduct).toBe(250);
      expect(result.creditsUsed).toBe(250);
    });

    it("should handle balance higher than original credits (extra credits from other sources)", () => {
      const result = calculateProportionalRefund(1500, 100, 200);
      // Balance > original credits → full refund, deduct only original credits
      expect(result.refundAmountCents).toBe(1500);
      expect(result.creditsToDeduct).toBe(100);
      expect(result.creditsUsed).toBe(0);
    });

    it("should round refund amount to nearest cent", () => {
      const result = calculateProportionalRefund(1000, 300, 100);
      // 100/300 = 33.33% unused → refund 33.33% of $10 = $3.333 → 333 cents
      expect(result.refundAmountCents).toBe(333);
      expect(result.creditsToDeduct).toBe(100);
      expect(result.creditsUsed).toBe(200);
    });

    it("should handle single credit refund", () => {
      const result = calculateProportionalRefund(150, 100, 1);
      // 1/100 = 1% unused → refund 1% of $1.50 = $0.015 → 2 cents (rounded)
      expect(result.refundAmountCents).toBe(2);
      expect(result.creditsToDeduct).toBe(1);
      expect(result.creditsUsed).toBe(99);
    });

    it("should handle zero original amount gracefully", () => {
      const result = calculateProportionalRefund(0, 100, 50);
      expect(result.refundAmountCents).toBe(0);
      expect(result.creditsToDeduct).toBe(50);
      expect(result.creditsUsed).toBe(50);
    });

    it("should handle zero original credits gracefully", () => {
      const result = calculateProportionalRefund(1500, 0, 50);
      // Can't calculate ratio with 0 credits → refund 0
      expect(result.refundAmountCents).toBe(0);
      expect(result.creditsToDeduct).toBe(0);
      expect(result.creditsUsed).toBe(0);
    });
  });
});
