import { eq, and, sql } from "drizzle-orm";
import { users, referrals, REFERRAL_REWARD_CREDITS } from "../../drizzle/schema";
import { addCredits } from "./credits";
import { getDb } from "./connection";
import crypto from "crypto";

/**
 * Generate a unique referral code like "FORMA-A3K9X2"
 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return `FORMA-${code}`;
}

/**
 * Get or create a referral code for a user.
 * Idempotent: returns existing code if already generated.
 */
export async function getOrCreateReferralCode(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  // Check if user already has a code
  const [user] = await db
    .select({ referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.referralCode) return user.referralCode;

  // Generate a unique code with retry
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await db
        .update(users)
        .set({ referralCode: code })
        .where(and(eq(users.id, userId), sql`referralCode IS NULL`));

      // Verify it was set (handles race conditions)
      const [updated] = await db
        .select({ referralCode: users.referralCode })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (updated?.referralCode) return updated.referralCode;
    } catch {
      // Unique constraint violation — retry with new code
      continue;
    }
  }
  return null;
}

/**
 * Look up a user by their referral code.
 */
export async function getUserByReferralCode(code: string): Promise<{ id: number; name: string | null } | null> {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.referralCode, code.toUpperCase()))
    .limit(1);

  return user || null;
}

/**
 * Record that a new user signed up via a referral code.
 * Called during the OAuth callback / user creation flow.
 */
export async function claimReferral(referredUserId: number, referralCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const referrer = await getUserByReferralCode(referralCode);
  if (!referrer) return false;

  // Prevent self-referral
  if (referrer.id === referredUserId) return false;

  // Check if this user was already referred
  const [existing] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.referredUserId, referredUserId))
    .limit(1);

  if (existing) return false; // Already referred

  // Create the referral record
  await db.insert(referrals).values({
    referrerUserId: referrer.id,
    referredUserId: referredUserId,
    status: "signed_up",
  });

  // Update the referred user's record
  await db
    .update(users)
    .set({ referredByUserId: referrer.id })
    .where(eq(users.id, referredUserId));

  return true;
}

/**
 * Complete a referral and award credits to both parties.
 * Called when the referred user completes their first generation.
 * Idempotent: safe to call multiple times.
 */
export async function completeReferral(referredUserId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Find the referral for this user
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

  if (!referral) return false; // No pending referral
  if (referral.referrerCredited && referral.referredCredited) return false; // Already completed

  const reward = REFERRAL_REWARD_CREDITS;

  // Award credits to referrer
  if (!referral.referrerCredited) {
    await addCredits(
      referral.referrerUserId,
      reward,
      "bonus",
      `Referral bonus: friend completed first generation`,
      `referral-referrer-${referral.id}`
    );
  }

  // Award credits to referred user
  if (!referral.referredCredited) {
    await addCredits(
      referredUserId,
      reward,
      "bonus",
      `Welcome bonus: referred by a friend`,
      `referral-referred-${referral.id}`
    );
  }

  // Mark referral as completed
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

  const completed = allReferrals.filter((r: { status: string }) => r.status === "completed");

  return {
    totalReferrals: allReferrals.length,
    completedReferrals: completed.length,
    totalCreditsEarned: completed.reduce((sum: number, r: { creditsAwarded: number }) => sum + r.creditsAwarded, 0),
    referralCode: user?.referralCode || null,
  };
}
