/**
 * `referral.claim` IS RATE-LIMITED, ON THE SAME BUCKET AS `referral.redeem`
 * (#1010's review, finding 2).
 *
 * The two procedures are one road: `redeemReferralCode` is `claimReferral`
 * plus an audit row. `redeem` has had a 5-an-hour limiter since it was written;
 * `claim` had none — which cost nothing while `claim` had no caller, and #1010
 * is the commit that re-mounted its caller at the app root. So the limiter
 * lands in the same commit, and it shares `redeem`'s bucket on purpose: a
 * per-procedure bucket would hand a code-guesser ten tries an hour instead of
 * five.
 *
 * Asserted at the wire (working law 5): the config the limiter is CALLED with,
 * not a constant near it — `keyPrefix` is what makes two calls one bucket.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./security/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 4, resetIn: 0 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("./db/referrals", () => ({
  claimReferral: vi.fn(async () => ({ success: true })),
  redeemReferralCode: vi.fn(async () => ({ success: true })),
  getOrCreateReferralCode: vi.fn(),
  getUserByReferralCode: vi.fn(),
  getReferralStats: vi.fn(),
  getReferralHistory: vi.fn(),
  getReferralCreditsEarned: vi.fn(),
  recordEmailInvite: vi.fn(),
  completeReferral: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  isValidReferralCodeFormat: vi.fn(() => true),
}));

import { checkRateLimit } from "./security/rateLimit";
import { claimReferral, redeemReferralCode } from "./db/referrals";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function approvedCtx(): TrpcContext {
  const user = {
    id: 4242,
    openId: "rate-limit-fixture",
    email: "fixture@example.com",
    name: "Fixture",
    displayName: null,
    avatarUrl: null,
    avatarKey: null,
    bannerUrl: null,
    bannerKey: null,
    bio: null,
    loginMethod: "email",
    approved: true,
    role: "user",
    storageUsed: 0,
    storageLimit: 104857600,
    suspendedAt: null,
    suspendedReason: null,
    suspendedBy: null,
    frozenAt: null,
    frozenReason: null,
    frozenBy: null,
    referralCode: null,
    referredByUserId: null,
    accessCode: null,
    approvedAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthenticatedUser;
  return {
    user,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const CODE = "DRAPE-ABC234";

describe("referral.claim is rate-limited on redeem's bucket (#1010 review)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 4, resetIn: 0 } as never);
  });

  it("CONTROL — under the limit, the claim goes through to the helper", async () => {
    const caller = appRouter.createCaller(approvedCtx());
    await expect(caller.referral.claim({ referralCode: CODE })).resolves.toEqual({ claimed: true });
    expect(claimReferral).toHaveBeenCalledWith(4242, CODE, "127.0.0.1");
  });

  it("over the limit it is a real TOO_MANY_REQUESTS and the helper is never reached", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 30 * 60 * 1000 } as never);
    const caller = appRouter.createCaller(approvedCtx());
    await expect(caller.referral.claim({ referralCode: CODE })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(claimReferral).not.toHaveBeenCalled();
  });

  it("claim and redeem hand the limiter the SAME key and the SAME bucket", async () => {
    const caller = appRouter.createCaller(approvedCtx());
    await caller.referral.claim({ referralCode: CODE });
    await caller.referral.redeem({ code: CODE });
    expect(redeemReferralCode).toHaveBeenCalledTimes(1);

    const calls = vi.mocked(checkRateLimit).mock.calls;
    expect(calls).toHaveLength(2);
    const [claimKey, claimConfig] = calls[0]!;
    const [redeemKey, redeemConfig] = calls[1]!;
    expect(claimKey).toBe("4242");
    expect(claimKey).toBe(redeemKey);
    expect(claimConfig).toEqual(redeemConfig);
    expect(claimConfig).toMatchObject({ keyPrefix: "ref-redeem", maxRequests: 5 });
  });
});
