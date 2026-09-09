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
      referralLink: "https://drape.ai?ref=DRAPE-ABC123",
      rewardCredits: 12500,
    });

    expect(result.success).toBe(true);
    expect(mockSendReferralInviteEmail).toHaveBeenCalledWith({
      inviteeEmail: "friend@example.com",
      referrerName: "John Doe",
      referralLink: "https://drape.ai?ref=DRAPE-ABC123",
      rewardCredits: 12500,
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
      referralLink: "https://drape.ai?ref=DRAPE-ABC123",
      rewardCredits: 12500,
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
/*
 * ── Feature 2: Moderator Flagged Referrals Query ── REMOVED (#697)
 *
 * Three arms lived here and not one of them entered the product. The file
 * mocked `./db/moderatorQueries` wholesale, imported the mocked
 * `getFlaggedReferrals`, CALLED IT ITSELF, and asserted on what it had just
 * told the mock to return — including an arm named "should support pagination"
 * that called the mock with (20, 40) and then asserted the mock had been called
 * with (20, 40). Deleting the real procedure from the router would not have
 * reddened any of them.
 *
 * The subject is driven for real in `server/moderator.test.ts` — through
 * `moderatorProcedure` and the actual router — where the defaults arm already
 * existed and an asked-for-page arm was added in this same commit to replace
 * the pagination claim rather than merely drop it.
 *
 * Found by PR #698's reviewer as a 13th file the card's own table missed: its
 * reader keyed on files mocking `./db` / `./auditLog`, and this one mocks the
 * deeper `./db/moderatorQueries`.
 */
