import { eq, and, sql, desc } from "drizzle-orm";
import { users, referrals, REFERRAL_REWARD_CREDITS, AUDIT_ACTIONS } from "../../drizzle/schema";
import { addCredits } from "./credits";
import { getDb } from "./connection";
import { logAuditEvent } from "../auditLog";
import crypto from "crypto";

/**
 * Generate a unique referral code like "FORMA-A3K9X2"
 */
function createReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return `FORMA-${code}`;
}

/**
 * Validate referral code format: FORMA-XXXXXX (6 alphanumeric chars)
 */
export function isValidReferralCodeFormat(code: string): boolean {
  return /^FORMA-[A-Z2-9]{6}$/.test(code.toUpperCase());
}

/**
 * Get or create a referral code for a user.
 * Idempotent: returns existing code if already generated.
 */
export async function getOrCreateReferralCode(
  userId: number,
  ipAddress?: string
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select({ referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = createReferralCode();
    try {
      await db
        .update(users)
        .set({ referralCode: code })
        .where(and(eq(users.id, userId), sql`referralCode IS NULL`));

      const [updated] = await db
        .select({ referralCode: users.referralCode })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (updated?.referralCode) {
        await logAuditEvent({
          userId,
          action: AUDIT_ACTIONS.REFERRAL_CODE_GENERATED,
          resourceType: "referral",
          resourceId: updated.referralCode,
          metadata: {},
          ipAddress: ipAddress,
        });
        return updated.referralCode;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Look up a user by their referral code.
 */
export async function getUserByReferralCode(
  code: string
): Promise<{ id: number; name: string | null; email: string | null } | null> {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.referralCode, code.toUpperCase()))
    .limit(1);

  return user || null;
}

/**
 * Claim a referral code during/after signup.
 * Security: one-time claim per user ever, self-referral blocked, IP flagging.
 */
export async function claimReferral(
  referredUserId: number,
  referralCode: string,
  referredIp?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  // Validate code format
  if (!isValidReferralCodeFormat(referralCode)) {
    return { success: false, error: "Invalid referral code format" };
  }

  const referrer = await getUserByReferralCode(referralCode);
  if (!referrer) return { success: false, error: "Invalid referral code" };

  // Prevent self-referral
  if (referrer.id === referredUserId) {
    return { success: false, error: "Cannot use your own referral code" };
  }

  // Check if this user has EVER been referred (one-time only)
  const [existingClaim] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.referredUserId, referredUserId))
    .limit(1);

  if (existingClaim) {
    await logAuditEvent({
      userId: referredUserId,
      action: AUDIT_ACTIONS.REFERRAL_MULTI_CLAIM_BLOCKED,
      resourceType: "referral",
      resourceId: referralCode,
      metadata: { attemptedCode: referralCode, existingReferralId: existingClaim.id },
      severity: "warning",
      ipAddress: referredIp,
    });
    return { success: false, error: "You have already used a referral code" };
  }

  // Check IP match with referrer for fraud detection
  const [referrerReferrals] = await db
    .select({ referrerIp: referrals.referrerIp })
    .from(referrals)
    .where(eq(referrals.referrerUserId, referrer.id))
    .limit(1);

  const isSameIp = referredIp && referrerReferrals?.referrerIp === referredIp;

  // Create the referral record
  await db.insert(referrals).values({
    referrerUserId: referrer.id,
    referredUserId: referredUserId,
    referredEmail: null,
    status: "signed_up",
    referredIp: referredIp || null,
    sameIpFlag: !!isSameIp,
  });

  // Update the referred user's record
  await db
    .update(users)
    .set({ referredByUserId: referrer.id })
    .where(eq(users.id, referredUserId));

  // Audit log
  await logAuditEvent({
    userId: referredUserId,
    action: AUDIT_ACTIONS.REFERRAL_CLAIMED,
    resourceType: "referral",
    resourceId: referralCode,
    metadata: {
      referrerId: referrer.id,
      sameIpFlag: !!isSameIp,
    },
    ipAddress: referredIp,
  });

  // Flag same IP
  if (isSameIp) {
    await logAuditEvent({
      userId: referredUserId,
      action: AUDIT_ACTIONS.REFERRAL_SAME_IP_FLAG,
      resourceType: "referral",
      resourceId: referralCode,
      metadata: {
        referrerId: referrer.id,
        sharedIp: referredIp,
      },
      severity: "warning",
      ipAddress: referredIp,
    });
  }

  return { success: true };
}

/**
 * Redeem a referral code (explicit action from modal).
 * Same as claim but with different audit action.
 */
export async function redeemReferralCode(
  userId: number,
  code: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await claimReferral(userId, code, ipAddress);

  if (result.success) {
    await logAuditEvent({
      userId,
      action: AUDIT_ACTIONS.REFERRAL_REDEEMED,
      resourceType: "referral",
      resourceId: code,
      metadata: {},
      ipAddress,
    });
  }

  return result;
}

/**
 * Complete a referral and award credits to both parties.
 * Called when the referred user completes their first generation.
 * Idempotent: safe to call multiple times.
 */
export async function completeReferral(referredUserId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [referral] = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referredUserId, referredUserId),
        eq(referrals.status, "signed_up")
      )
    )
    .limit(1);

  if (!referral) return false;
  if (referral.referrerCredited && referral.referredCredited) return false;

  // Block credit award if same IP flagged (fraud prevention)
  if (referral.sameIpFlag) {
    await logAuditEvent({
      userId: referredUserId,
      action: AUDIT_ACTIONS.REFERRAL_SAME_IP_FLAG,
      resourceType: "referral",
      resourceId: String(referral.id),
      metadata: { blocked: true, reason: "Same IP as referrer" },
      severity: "warning",
    });
    // Still mark as completed but don't award credits
    await db
      .update(referrals)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(referrals.id, referral.id));
    return false;
  }

  const reward = REFERRAL_REWARD_CREDITS;

  if (!referral.referrerCredited) {
    await addCredits(
      referral.referrerUserId,
      reward,
      "bonus",
      `Referral bonus: friend completed first generation`,
      `referral-referrer-${referral.id}`
    );
  }

  if (!referral.referredCredited) {
    await addCredits(
      referredUserId,
      reward,
      "bonus",
      `Welcome bonus: referred by a friend`,
      `referral-referred-${referral.id}`
    );
  }

  await db
    .update(referrals)
    .set({
      status: "completed",
      referrerCredited: true,
      referredCredited: true,
      creditsAwarded: reward,
      completedAt: new Date(),
    })
    .where(eq(referrals.id, referral.id));

  await logAuditEvent({
    userId: referredUserId,
    action: AUDIT_ACTIONS.REFERRAL_COMPLETED,
    resourceType: "referral",
    resourceId: String(referral.id),
    metadata: {
      referrerId: referral.referrerUserId,
      creditsAwarded: reward,
    },
  });

  return true;
}

/**
 * Get referral stats for a user (as referrer).
 */
export async function getReferralStats(userId: number): Promise<{
  totalReferrals: number;
  completedReferrals: number;
  totalCreditsEarned: number;
  referralCode: string | null;
}> {
  const db = await getDb();
  if (!db) {
    return { totalReferrals: 0, completedReferrals: 0, totalCreditsEarned: 0, referralCode: null };
  }

  const allReferrals = await db
    .select({
      status: referrals.status,
      creditsAwarded: referrals.creditsAwarded,
    })
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId));

  const [user] = await db
    .select({ referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const completed = allReferrals.filter(
    (r: { status: string }) => r.status === "completed"
  );

  return {
    totalReferrals: allReferrals.length,
    completedReferrals: completed.length,
    totalCreditsEarned: completed.reduce(
      (sum: number, r: { creditsAwarded: number }) => sum + r.creditsAwarded,
      0
    ),
    referralCode: user?.referralCode || null,
  };
}

/**
 * Get referral history for a user (as referrer).
 * Returns individual referral records with referred user info.
 */
export async function getReferralHistory(userId: number): Promise<
  Array<{
    id: number;
    referredName: string | null;
    referredEmail: string | null;
    status: string;
    creditsAwarded: number;
    sameIpFlag: boolean;
    createdAt: Date;
    completedAt: Date | null;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  const history = await db
    .select({
      id: referrals.id,
      referredUserId: referrals.referredUserId,
      referredEmail: referrals.referredEmail,
      status: referrals.status,
      creditsAwarded: referrals.creditsAwarded,
      sameIpFlag: referrals.sameIpFlag,
      createdAt: referrals.createdAt,
      completedAt: referrals.completedAt,
    })
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId))
    .orderBy(desc(referrals.createdAt));

  // Fetch referred user names
  const results = await Promise.all(
    history.map(async (ref) => {
      let referredName: string | null = null;
      if (ref.referredUserId) {
        const [refUser] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, ref.referredUserId))
          .limit(1);
        referredName = refUser?.name || null;
      }
      return {
        id: ref.id,
        referredName,
        referredEmail: ref.referredEmail,
        status: ref.status,
        creditsAwarded: ref.creditsAwarded,
        sameIpFlag: ref.sameIpFlag,
        createdAt: ref.createdAt,
        completedAt: ref.completedAt,
      };
    })
  );

  return results;
}

/**
 * Record an email invitation (creates a pending referral).
 */
export async function recordEmailInvite(
  referrerUserId: number,
  email: string,
  referrerIp?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };

  // Check if already invited this email
  const [existing] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, referrerUserId),
        eq(referrals.referredEmail, email.toLowerCase())
      )
    )
    .limit(1);

  if (existing) {
    return { success: false, error: "Already invited this email" };
  }

  await db.insert(referrals).values({
    referrerUserId,
    referredEmail: email.toLowerCase(),
    status: "pending",
    referrerIp: referrerIp || null,
  });

  await logAuditEvent({
    userId: referrerUserId,
    action: AUDIT_ACTIONS.REFERRAL_INVITE_SENT,
    resourceType: "referral",
    metadata: { invitedEmail: email.toLowerCase() },
    ipAddress: referrerIp,
  });

  return { success: true };
}
