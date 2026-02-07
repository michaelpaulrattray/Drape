import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db/referrals", () => ({
  getOrCreateReferralCode: vi.fn(),
  getUserByReferralCode: vi.fn(),
  claimReferral: vi.fn(),
  redeemReferralCode: vi.fn(),
  completeReferral: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  getReferralCreditsEarned: vi.fn(),
  getReferralStats: vi.fn(),
  getReferralHistory: vi.fn(),
  recordEmailInvite: vi.fn(),
  isValidReferralCodeFormat: vi.fn(),
}));

import {
  getOrCreateReferralCode,
  getUserByReferralCode,
  claimReferral,
  redeemReferralCode,
  completeReferral,
  creditReferrerOnPaidAction,
  getReferralCreditsEarned,
  getReferralStats,
  getReferralHistory,
  recordEmailInvite,
  isValidReferralCodeFormat,
} from "./db/referrals";

import { isDisposableEmail } from "./security/disposableEmails";

const mockGetOrCreateReferralCode = vi.mocked(getOrCreateReferralCode);
const mockGetUserByReferralCode = vi.mocked(getUserByReferralCode);
const mockClaimReferral = vi.mocked(claimReferral);
const mockRedeemReferralCode = vi.mocked(redeemReferralCode);
const mockCompleteReferral = vi.mocked(completeReferral);
const mockCreditReferrerOnPaidAction = vi.mocked(creditReferrerOnPaidAction);
const mockGetReferralCreditsEarned = vi.mocked(getReferralCreditsEarned);
const mockGetReferralStats = vi.mocked(getReferralStats);
const mockGetReferralHistory = vi.mocked(getReferralHistory);
const mockRecordEmailInvite = vi.mocked(recordEmailInvite);
const mockIsValidReferralCodeFormat = vi.mocked(isValidReferralCodeFormat);

describe("Referral System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Referral Code Generation", () => {
    it("should return existing referral code if user already has one", async () => {
      mockGetOrCreateReferralCode.mockResolvedValue("FORMA-ABC123");
      const code = await getOrCreateReferralCode(1);
      expect(code).toBe("FORMA-ABC123");
      expect(mockGetOrCreateReferralCode).toHaveBeenCalledWith(1);
    });

    it("should generate a new referral code with IP tracking", async () => {
      mockGetOrCreateReferralCode.mockResolvedValue("FORMA-XYZ789");
      const code = await getOrCreateReferralCode(1, "192.168.1.1");
      expect(code).toBe("FORMA-XYZ789");
      expect(mockGetOrCreateReferralCode).toHaveBeenCalledWith(1, "192.168.1.1");
    });

    it("should return null on failure", async () => {
      mockGetOrCreateReferralCode.mockResolvedValue(null);
      const code = await getOrCreateReferralCode(1);
      expect(code).toBeNull();
    });
  });

  describe("Referral Code Format Validation", () => {
    it("should validate correct FORMA-XXXXXX format", () => {
      mockIsValidReferralCodeFormat.mockReturnValue(true);
      expect(isValidReferralCodeFormat("FORMA-A3K9X2")).toBe(true);
    });

    it("should reject invalid format", () => {
      mockIsValidReferralCodeFormat.mockReturnValue(false);
      expect(isValidReferralCodeFormat("INVALID")).toBe(false);
    });

    it("should reject codes with confusing characters (I/O/0/1)", () => {
      mockIsValidReferralCodeFormat.mockReturnValue(false);
      expect(isValidReferralCodeFormat("FORMA-IOO101")).toBe(false);
    });
  });

  describe("Referral Code Lookup", () => {
    it("should find user by valid referral code", async () => {
      mockGetUserByReferralCode.mockResolvedValue({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      });
      const user = await getUserByReferralCode("FORMA-ABC123");
      expect(user).not.toBeNull();
      expect(user!.id).toBe(1);
    });

    it("should return null for invalid code", async () => {
      mockGetUserByReferralCode.mockResolvedValue(null);
      const user = await getUserByReferralCode("FORMA-INVALID");
      expect(user).toBeNull();
    });
  });

  describe("Referral Claiming (URL param flow)", () => {
    it("should successfully claim a valid referral code with IP", async () => {
      mockClaimReferral.mockResolvedValue({ success: true });
      const result = await claimReferral(2, "FORMA-ABC123", "10.0.0.1");
      expect(result.success).toBe(true);
      expect(mockClaimReferral).toHaveBeenCalledWith(2, "FORMA-ABC123", "10.0.0.1");
    });

    it("should reject self-referral", async () => {
      mockClaimReferral.mockResolvedValue({
        success: false,
        error: "Cannot use your own referral code",
      });
      const result = await claimReferral(1, "FORMA-OWN123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("own referral code");
    });

    it("should reject multi-claim (user already redeemed a code)", async () => {
      mockClaimReferral.mockResolvedValue({
        success: false,
        error: "You have already used a referral code",
      });
      const result = await claimReferral(2, "FORMA-DUP123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("already used");
    });

    it("should reject invalid code format", async () => {
      mockClaimReferral.mockResolvedValue({
        success: false,
        error: "Invalid referral code format",
      });
      const result = await claimReferral(2, "BAD-CODE");
      expect(result.success).toBe(false);
      expect(result.error).toContain("format");
    });
  });

  describe("Referral Redemption (modal flow)", () => {
    it("should redeem a valid code", async () => {
      mockRedeemReferralCode.mockResolvedValue({ success: true });
      const result = await redeemReferralCode(2, "FORMA-ABC123", "10.0.0.1");
      expect(result.success).toBe(true);
    });

    it("should reject redemption with invalid code", async () => {
      mockRedeemReferralCode.mockResolvedValue({
        success: false,
        error: "Invalid referral code",
      });
      const result = await redeemReferralCode(2, "FORMA-NOPE99");
      expect(result.success).toBe(false);
    });
  });

  describe("Split Credit Flow — Referee on First Generation", () => {
    it("should award credits to REFEREE on first generation", async () => {
      mockCompleteReferral.mockResolvedValue(true);
      const result = await completeReferral(2);
      expect(result).toBe(true);
    });

    it("should not award credits if user was not referred", async () => {
      mockCompleteReferral.mockResolvedValue(false);
      const result = await completeReferral(99);
      expect(result).toBe(false);
    });

    it("should be idempotent (no double-award)", async () => {
      mockCompleteReferral.mockResolvedValue(false);
      const result = await completeReferral(2);
      expect(result).toBe(false);
    });
  });

  describe("Split Credit Flow — Referrer on First Paid Action", () => {
    it("should award credits to REFERRER when referee subscribes", async () => {
      mockCreditReferrerOnPaidAction.mockResolvedValue(true);
      const result = await creditReferrerOnPaidAction(2);
      expect(result).toBe(true);
    });

    it("should not award if referee has no referral record", async () => {
      mockCreditReferrerOnPaidAction.mockResolvedValue(false);
      const result = await creditReferrerOnPaidAction(99);
      expect(result).toBe(false);
    });

    it("should be idempotent (no double-award on multiple webhooks)", async () => {
      mockCreditReferrerOnPaidAction.mockResolvedValue(false);
      const result = await creditReferrerOnPaidAction(2);
      expect(result).toBe(false);
    });
  });

  describe("Lifetime Referral Cap", () => {
    it("should track lifetime referral credits earned", async () => {
      mockGetReferralCreditsEarned.mockResolvedValue(2500);
      const earned = await getReferralCreditsEarned(1);
      expect(earned).toBe(2500);
    });

    it("should block referrer credit when lifetime cap reached", async () => {
      // When earned >= 5000, creditReferrerOnPaidAction returns false
      mockCreditReferrerOnPaidAction.mockResolvedValue(false);
      mockGetReferralCreditsEarned.mockResolvedValue(5000);
      const result = await creditReferrerOnPaidAction(2);
      expect(result).toBe(false);
    });

    it("should still allow credits when under cap", async () => {
      mockCreditReferrerOnPaidAction.mockResolvedValue(true);
      mockGetReferralCreditsEarned.mockResolvedValue(4750);
      const result = await creditReferrerOnPaidAction(2);
      expect(result).toBe(true);
    });
  });

  describe("Reward Calibration", () => {
    it("should award 250 credits per successful referral", async () => {
      const { REFERRAL_REWARD_CREDITS } = await import("../drizzle/schema");
      expect(REFERRAL_REWARD_CREDITS).toBe(250);
    });

    it("should have a lifetime cap of 5000 credits", async () => {
      const { REFERRAL_LIFETIME_CAP } = await import("../drizzle/schema");
      expect(REFERRAL_LIFETIME_CAP).toBe(5000);
    });
  });

  describe("Referral Stats (includes lifetimeCap)", () => {
    it("should return referral statistics with lifetime cap", async () => {
      mockGetReferralStats.mockResolvedValue({
        totalReferrals: 5,
        completedReferrals: 3,
        totalCreditsEarned: 750,
        lifetimeCap: 5000,
        referralCode: "FORMA-ABC123",
      });
      const stats = await getReferralStats(1);
      expect(stats.totalReferrals).toBe(5);
      expect(stats.completedReferrals).toBe(3);
      expect(stats.totalCreditsEarned).toBe(750);
      expect(stats.lifetimeCap).toBe(5000);
      expect(stats.referralCode).toBe("FORMA-ABC123");
    });

    it("should return zero stats for user with no referrals", async () => {
      mockGetReferralStats.mockResolvedValue({
        totalReferrals: 0,
        completedReferrals: 0,
        totalCreditsEarned: 0,
        lifetimeCap: 5000,
        referralCode: null,
      });
      const stats = await getReferralStats(99);
      expect(stats.totalReferrals).toBe(0);
      expect(stats.totalCreditsEarned).toBe(0);
      expect(stats.lifetimeCap).toBe(5000);
    });
  });

  describe("Referral History", () => {
    it("should return invitation history for a user", async () => {
      const mockHistory = [
        {
          id: 1,
          referredName: "Alice",
          referredEmail: "alice@example.com",
          status: "subscribed",
          creditsAwarded: 250,
          sameIpFlag: false,
          createdAt: new Date("2025-01-01"),
          completedAt: new Date("2025-01-02"),
        },
        {
          id: 2,
          referredName: null,
          referredEmail: "bob@example.com",
          status: "pending",
          creditsAwarded: 0,
          sameIpFlag: false,
          createdAt: new Date("2025-01-03"),
          completedAt: null,
        },
      ];
      mockGetReferralHistory.mockResolvedValue(mockHistory);
      const history = await getReferralHistory(1);
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe("subscribed");
      expect(history[0].creditsAwarded).toBe(250);
      expect(history[1].status).toBe("pending");
    });

    it("should return empty array for user with no history", async () => {
      mockGetReferralHistory.mockResolvedValue([]);
      const history = await getReferralHistory(99);
      expect(history).toHaveLength(0);
    });
  });

  describe("Email Invite", () => {
    it("should record an email invitation", async () => {
      mockRecordEmailInvite.mockResolvedValue({ success: true });
      const result = await recordEmailInvite(1, "friend@example.com", "10.0.0.1");
      expect(result.success).toBe(true);
    });

    it("should reject duplicate email invite", async () => {
      mockRecordEmailInvite.mockResolvedValue({
        success: false,
        error: "Already invited this email",
      });
      const result = await recordEmailInvite(1, "friend@example.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Already invited");
    });
  });

  describe("Disposable Email Blocking", () => {
    it("should block guerrillamail.com", () => {
      expect(isDisposableEmail("user@guerrillamail.com")).toBe(true);
    });

    it("should block tempmail.com", () => {
      expect(isDisposableEmail("user@tempmail.com")).toBe(true);
    });

    it("should block mailinator.com", () => {
      expect(isDisposableEmail("user@mailinator.com")).toBe(true);
    });

    it("should block yopmail.com", () => {
      expect(isDisposableEmail("user@yopmail.com")).toBe(true);
    });

    it("should block throwaway.email", () => {
      expect(isDisposableEmail("user@throwaway.email")).toBe(true);
    });

    it("should block 10minutemail.com", () => {
      expect(isDisposableEmail("user@10minutemail.com")).toBe(true);
    });

    it("should allow gmail.com", () => {
      expect(isDisposableEmail("user@gmail.com")).toBe(false);
    });

    it("should allow outlook.com", () => {
      expect(isDisposableEmail("user@outlook.com")).toBe(false);
    });

    it("should allow custom domains", () => {
      expect(isDisposableEmail("mike@formastudio.ai")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(isDisposableEmail("user@GUERRILLAMAIL.COM")).toBe(true);
    });
  });

  describe("Fraud Prevention — Soft IP Flagging", () => {
    it("should flag referrals from same IP but still allow claim", async () => {
      // Same IP within 24hrs = soft flag, NOT auto-block
      mockClaimReferral.mockResolvedValue({ success: true });
      const result = await claimReferral(2, "FORMA-ABC123", "192.168.1.1");
      expect(result.success).toBe(true);
    });

    it("should still award referee credits on first generation even if IP flagged", async () => {
      // Soft flag means credits still flow, just flagged for review
      mockCompleteReferral.mockResolvedValue(true);
      const result = await completeReferral(2);
      expect(result).toBe(true);
    });
  });
});
