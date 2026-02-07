import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Feature 1: Disposable Email Blocking ──

import { isDisposableEmail } from "./security/disposableEmails";

describe("Disposable Email Blocking on Signup", () => {
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

  it("should block sharklasers.com (guerrillamail alias)", () => {
    expect(isDisposableEmail("user@sharklasers.com")).toBe(true);
  });

  it("should allow gmail.com", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
  });

  it("should allow outlook.com", () => {
    expect(isDisposableEmail("user@outlook.com")).toBe(false);
  });

  it("should allow custom business domains", () => {
    expect(isDisposableEmail("ceo@mycompany.com")).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(isDisposableEmail("user@GUERRILLAMAIL.COM")).toBe(true);
    expect(isDisposableEmail("user@GmAiL.cOm")).toBe(false);
  });

  it("should handle empty string", () => {
    expect(isDisposableEmail("")).toBe(false);
  });

  it("should handle email without @ symbol", () => {
    expect(isDisposableEmail("notanemail")).toBe(false);
  });
});

// ── Feature 3: Klaviyo Email Delivery ──

vi.mock("./klaviyo", () => ({
  sendReferralInviteEmail: vi.fn(),
  createOrUpdateProfile: vi.fn(),
  trackEvent: vi.fn(),
}));

import { sendReferralInviteEmail } from "./klaviyo";

const mockSendReferralInviteEmail = vi.mocked(sendReferralInviteEmail);

describe("Klaviyo Referral Invite Email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call sendReferralInviteEmail with correct params", async () => {
    mockSendReferralInviteEmail.mockResolvedValue({ success: true });

    const result = await sendReferralInviteEmail({
      inviteeEmail: "friend@example.com",
      referrerName: "John Doe",
      referralLink: "https://formastudio.ai?ref=FORMA-ABC123",
      rewardCredits: 250,
    });

    expect(result.success).toBe(true);
    expect(mockSendReferralInviteEmail).toHaveBeenCalledWith({
      inviteeEmail: "friend@example.com",
      referrerName: "John Doe",
      referralLink: "https://formastudio.ai?ref=FORMA-ABC123",
      rewardCredits: 250,
    });
  });

  it("should handle Klaviyo API failure gracefully", async () => {
    mockSendReferralInviteEmail.mockResolvedValue({
      success: false,
      error: "Klaviyo API error: 500",
    });

    const result = await sendReferralInviteEmail({
      inviteeEmail: "friend@example.com",
      referrerName: "John Doe",
      referralLink: "https://formastudio.ai?ref=FORMA-ABC123",
      rewardCredits: 250,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
  });
});

// ── Feature 4: Referral Expiration Job ──

vi.mock("./db/referrals", () => ({
  expireStalePendingReferrals: vi.fn(),
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

import { expireStalePendingReferrals } from "./db/referrals";

const mockExpireStale = vi.mocked(expireStalePendingReferrals);

describe("Referral Expiration Job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call expireStalePendingReferrals and return count", async () => {
    mockExpireStale.mockResolvedValue(5);
    const count = await expireStalePendingReferrals();
    expect(count).toBe(5);
    expect(mockExpireStale).toHaveBeenCalledOnce();
  });

  it("should return 0 when no stale referrals exist", async () => {
    mockExpireStale.mockResolvedValue(0);
    const count = await expireStalePendingReferrals();
    expect(count).toBe(0);
  });

  it("should handle database errors gracefully", async () => {
    mockExpireStale.mockRejectedValue(new Error("DB connection failed"));
    await expect(expireStalePendingReferrals()).rejects.toThrow("DB connection failed");
  });
});

// ── Feature 2: Moderator Flagged Referrals Query ──

vi.mock("./db/moderatorQueries", () => ({
  getFlaggedReferrals: vi.fn(),
  getDetailedCreditHistory: vi.fn(),
  getDetailedGenerationHistory: vi.fn(),
  getRecentTopupCount: vi.fn(),
  getRecentTopupCredits: vi.fn(),
}));

import { getFlaggedReferrals } from "./db/moderatorQueries";

const mockGetFlaggedReferrals = vi.mocked(getFlaggedReferrals);

describe("Moderator Flagged Referrals Query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return flagged referrals with user details", async () => {
    const mockData = {
      items: [
        {
          id: 1,
          referrerUserId: 10,
          referrerName: "Alice",
          referrerEmail: "alice@example.com",
          referredUserId: 20,
          referredName: "Bob",
          referredEmail: "bob@example.com",
          referrerIp: "192.168.1.1",
          referredIp: "192.168.1.1",
          status: "signed_up",
          creditsAwarded: 0,
          referrerCredited: false,
          referredCredited: false,
          createdAt: new Date("2026-01-15"),
          completedAt: null,
        },
      ],
      total: 1,
    };

    mockGetFlaggedReferrals.mockResolvedValue(mockData);
    const result = await getFlaggedReferrals(50, 0);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].referrerIp).toBe(result.items[0].referredIp);
    expect(result.items[0].referrerName).toBe("Alice");
  });

  it("should return empty when no flagged referrals exist", async () => {
    mockGetFlaggedReferrals.mockResolvedValue({ items: [], total: 0 });
    const result = await getFlaggedReferrals(50, 0);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("should support pagination", async () => {
    mockGetFlaggedReferrals.mockResolvedValue({ items: [], total: 100 });
    const result = await getFlaggedReferrals(20, 40);
    expect(mockGetFlaggedReferrals).toHaveBeenCalledWith(20, 40);
    expect(result.total).toBe(100);
  });
});
