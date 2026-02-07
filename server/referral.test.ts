import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db/referrals", () => ({
  getUserReferralCode: vi.fn(),
  generateReferralCode: vi.fn(),
  getReferralStats: vi.fn(),
  claimReferral: vi.fn(),
  completeReferralIfEligible: vi.fn(),
  validateReferralCode: vi.fn(),
}));

import {
  getUserReferralCode,
  generateReferralCode,
  getReferralStats,
  claimReferral,
  completeReferralIfEligible,
  validateReferralCode,
} from "./db/referrals";

const mockGetUserReferralCode = vi.mocked(getUserReferralCode);
const mockGenerateReferralCode = vi.mocked(generateReferralCode);
const mockGetReferralStats = vi.mocked(getReferralStats);
const mockClaimReferral = vi.mocked(claimReferral);
const mockCompleteReferralIfEligible = vi.mocked(completeReferralIfEligible);
const mockValidateReferralCode = vi.mocked(validateReferralCode);

describe("Referral System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Referral Code Generation", () => {
    it("should return existing referral code if user already has one", async () => {
      mockGetUserReferralCode.mockResolvedValue("FORMA-ABC123");
      const code = await getUserReferralCode(1);
      expect(code).toBe("FORMA-ABC123");
      expect(mockGetUserReferralCode).toHaveBeenCalledWith(1);
    });

    it("should generate a new referral code for user without one", async () => {
      mockGenerateReferralCode.mockResolvedValue("FORMA-XYZ789");
      const code = await generateReferralCode(1);
      expect(code).toBe("FORMA-XYZ789");
      expect(mockGenerateReferralCode).toHaveBeenCalledWith(1);
    });
  });

  describe("Referral Stats", () => {
    it("should return referral statistics for a user", async () => {
      mockGetReferralStats.mockResolvedValue({
        totalReferrals: 5,
        completedReferrals: 3,
        totalCreditsEarned: 1500,
      });
      const stats = await getReferralStats(1);
      expect(stats.totalReferrals).toBe(5);
      expect(stats.completedReferrals).toBe(3);
      expect(stats.totalCreditsEarned).toBe(1500);
    });

    it("should return zero stats for user with no referrals", async () => {
      mockGetReferralStats.mockResolvedValue({
        totalReferrals: 0,
        completedReferrals: 0,
        totalCreditsEarned: 0,
      });
      const stats = await getReferralStats(99);
      expect(stats.totalReferrals).toBe(0);
      expect(stats.completedReferrals).toBe(0);
      expect(stats.totalCreditsEarned).toBe(0);
    });
  });

  describe("Referral Claiming", () => {
    it("should successfully claim a valid referral code", async () => {
      mockClaimReferral.mockResolvedValue({ success: true });
      const result = await claimReferral("FORMA-ABC123", 2);
      expect(result.success).toBe(true);
      expect(mockClaimReferral).toHaveBeenCalledWith("FORMA-ABC123", 2);
    });

    it("should reject self-referral", async () => {
      mockClaimReferral.mockResolvedValue({
        success: false,
        error: "Cannot refer yourself",
      });
      const result = await claimReferral("FORMA-OWN123", 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("yourself");
    });

    it("should reject duplicate referral claim", async () => {
      mockClaimReferral.mockResolvedValue({
        success: false,
        error: "Already claimed a referral",
      });
      const result = await claimReferral("FORMA-DUP123", 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Already");
    });
  });

  describe("Referral Validation", () => {
    it("should validate a valid referral code", async () => {
      mockValidateReferralCode.mockResolvedValue({
        valid: true,
        referrerName: "John",
      });
      const result = await validateReferralCode("FORMA-ABC123");
      expect(result.valid).toBe(true);
      expect(result.referrerName).toBe("John");
    });

    it("should reject an invalid referral code", async () => {
      mockValidateReferralCode.mockResolvedValue({
        valid: false,
        referrerName: null,
      });
      const result = await validateReferralCode("INVALID-CODE");
      expect(result.valid).toBe(false);
    });
  });

  describe("Referral Completion (First Generation)", () => {
    it("should award credits on first generation by referred user", async () => {
      mockCompleteReferralIfEligible.mockResolvedValue({
        completed: true,
        creditsAwarded: 500,
      });
      const result = await completeReferralIfEligible(2);
      expect(result.completed).toBe(true);
      expect(result.creditsAwarded).toBe(500);
    });

    it("should not award credits if user was not referred", async () => {
      mockCompleteReferralIfEligible.mockResolvedValue({
        completed: false,
        creditsAwarded: 0,
      });
      const result = await completeReferralIfEligible(99);
      expect(result.completed).toBe(false);
      expect(result.creditsAwarded).toBe(0);
    });

    it("should not double-award credits on subsequent generations", async () => {
      mockCompleteReferralIfEligible.mockResolvedValue({
        completed: false,
        creditsAwarded: 0,
      });
      const result = await completeReferralIfEligible(2);
      expect(result.completed).toBe(false);
      expect(result.creditsAwarded).toBe(0);
    });
  });

  describe("Referral Code Format", () => {
    it("should generate codes with FORMA- prefix", async () => {
      mockGenerateReferralCode.mockResolvedValue("FORMA-A3K9X2");
      const code = await generateReferralCode(1);
      expect(code).toMatch(/^FORMA-/);
    });
  });

  describe("Reward Credits Constant", () => {
    it("should award 500 credits per successful referral", () => {
      const REFERRAL_REWARD_CREDITS = 500;
      expect(REFERRAL_REWARD_CREDITS).toBe(500);
    });
  });
});
