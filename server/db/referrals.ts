import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import {
  users,
  referrals,
  REFERRAL_REWARD_CREDITS,
  REFERRAL_LIFETIME_CAP,
  AUDIT_ACTIONS,
} from "../../drizzle/schema";
import { addCredits, isDuplicateCreditReferenceError } from "./credits";
import { getDb } from "./connection";
import { logAuditEvent } from "../auditLog";
import crypto from "crypto";
import {
  REFERRAL_CODE_BODY_LENGTH,
  REFERRAL_CODE_FORMAT_MESSAGE,
  REFERRAL_CODE_MINT_ALPHABET,
  REFERRAL_CODE_PREFIX,
  REFERRAL_CODE_SEPARATOR,
  referralCodePattern,
} from "../../shared/referralCodeFormat";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("db/referrals");

/**
 * Generate a unique referral code — `DRAPE-A3K9X2` in today's shape.
 *
 * Every part of that shape comes from `shared/referralCodeFormat.ts`. It used
 * to be spelled here and quoted, by hand, in the refusal one file away; the
 * FormaStudio→Drape rename fixed this file and missed that quotation, so every
 * mistyping customer was told to type `FORMA-XXXXXX` for six months.
 */
function createReferralCode(): string {
  const chars = REFERRAL_CODE_MINT_ALPHABET; // No I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_BODY_LENGTH; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return `${REFERRAL_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${code}`;
}

/**
 * Validate referral code format: `DRAPE-XXXXXX` (6 minted characters).
 *
 * The pattern is derived, not written — see `referralCodePattern` for why the
 * accepted class is deliberately wider than the mint alphabet.
 */
export function isValidReferralCodeFormat(code: string): boolean {
  return referralCodePattern().test(code.toUpperCase());
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
 * Get total referral credits earned by a user (as referrer).
 * Used to enforce the lifetime cap.
 */
export async function getReferralCreditsEarned(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const rows = await db
    .select({ creditsAwarded: referrals.creditsAwarded })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, userId),
        eq(referrals.referrerCredited, true)
      )
    );

  return rows.reduce((sum, r) => sum + r.creditsAwarded, 0);
}

/**
 * Check if referrer IP was used by referred user within 24 hours.
 * Soft flag — does NOT block, just marks for moderator review.
 */
/**
 * The one answer to a second claim, whichever guard caught it — the read
 * before the insert, or `uq_referrals_referred_user` at the insert itself.
 * Both write the same `REFERRAL_MULTI_CLAIM_BLOCKED` row, so the moderator's
 * audit view does not depend on which tab lost the race. `existingReferralId`
 * is null on the index road: the row that won is not re-read to name it.
 */
/** The index that says one referred user, one claim (`drizzle/0064`). */
export const ONE_CLAIM_PER_USER_INDEX = "uq_referrals_referred_user";

/**
 * Was this insert refused by THAT index — not merely by A unique key?
 *
 * `isDuplicateCreditReferenceError` answers "was it a duplicate key" and walks
 * the cause chain drizzle wraps the driver error in; this asks the narrower
 * question, because "already used a referral code" is only the right answer
 * when `uq_referrals_referred_user` is the key that refused. Today it is the
 * table's only unique key besides the primary, so the two questions have one
 * answer — but a later unique key on this table (say `referredEmail` for the
 * invite road) would otherwise have its violation reported as a second claim
 * and audited as one. MySQL names the key in the message
 * (`Duplicate entry '99' for key 'referrals.uq_referrals_referred_user'`), so
 * the name is read out of it, along the same cause chain.
 */
export function isOneClaimPerUserRefusal(error: unknown): boolean {
  if (!isDuplicateCreditReferenceError(error)) return false;
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { message?: unknown; sqlMessage?: unknown; cause?: unknown };
    for (const text of [candidate.message, candidate.sqlMessage]) {
      if (typeof text === "string" && text.includes(ONE_CLAIM_PER_USER_INDEX)) return true;
    }
    current = candidate.cause;
  }
  return false;
}

async function alreadyUsed(
  referredUserId: number,
  referralCode: string,
  referredIp: string | undefined,
  existingReferralId: number | null,
): Promise<{ success: false; error: string }> {
  await logAuditEvent({
    userId: referredUserId,
    action: AUDIT_ACTIONS.REFERRAL_MULTI_CLAIM_BLOCKED,
    resourceType: "referral",
    resourceId: referralCode,
    metadata: { attemptedCode: referralCode, existingReferralId },
    severity: "warning",
    ipAddress: referredIp,
  });
  return { success: false, error: "You have already used a referral code" };
}

async function checkSameIpWithin24h(
  referrerId: number,
  referredIp: string | undefined
): Promise<boolean> {
  if (!referredIp) return false;
  const db = await getDb();
  if (!db) return false;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check referrer's own IP from recent referrals they sent
  const recentReferrals = await db
    .select({ referrerIp: referrals.referrerIp })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, referrerId),
        gte(referrals.createdAt, twentyFourHoursAgo)
      )
    );

  return recentReferrals.some((r) => r.referrerIp === referredIp);
}

/**
 * Claim a referral code during/after signup.
 * Security: one-time claim per user ever, self-referral blocked, IP soft-flagging.
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
    return { success: false, error: REFERRAL_CODE_FORMAT_MESSAGE };
  }

  const referrer = await getUserByReferralCode(referralCode);
  if (!referrer) return { success: false, error: "Invalid referral code" };

  // Prevent self-referral
  if (referrer.id === referredUserId) {
    return { success: false, error: "Cannot use your own referral code" };
  }

  // Check if this user has EVER been referred (one-time only). This read is
  // the friendly answer, not the guard — the guard is the unique index below.
  const [existingClaim] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(eq(referrals.referredUserId, referredUserId))
    .limit(1);

  if (existingClaim) {
    return alreadyUsed(referredUserId, referralCode, referredIp, existingClaim.id);
  }

  // Soft IP flag: check if referred IP matches referrer IP within 24hrs
  const isSameIp = await checkSameIpWithin24h(referrer.id, referredIp);

  // Create the referral record.
  //
  // ONE CLAIM PER USER IS ENFORCED BY `uq_referrals_referred_user`, IN THIS
  // STATEMENT — not by the SELECT above (invariant 1: a check-then-write keyed
  // on id alone is a race). The race became reachable the day #1010 mounted
  // `useReferralClaim` at the app root: the claim fires automatically on login
  // in EVERY open tab, so two tabs signing in together both pass the read and
  // both insert — and `completeReferral` pays the welcome bonus once PER ROW,
  // `creditReferrerOnPaidAction` credits the referrer once per row. The index
  // makes the second insert fail; this catch turns that failure into the same
  // answer the read gives, so the customer sees one outcome whichever tab won.
  try {
    await db.insert(referrals).values({
      referrerUserId: referrer.id,
      referredUserId: referredUserId,
      referredEmail: null,
      status: "signed_up",
      referredIp: referredIp || null,
      sameIpFlag: isSameIp,
    });
  } catch (error) {
    if (isOneClaimPerUserRefusal(error)) {
      return alreadyUsed(referredUserId, referralCode, referredIp, null);
    }
    throw error;
  }

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
    metadata: { referrerId: referrer.id, sameIpFlag: isSameIp },
    ipAddress: referredIp,
  });

  // Soft flag same IP for moderator review (don't block)
  if (isSameIp) {
    await logAuditEvent({
      userId: referredUserId,
      action: AUDIT_ACTIONS.REFERRAL_SAME_IP_FLAG,
      resourceType: "referral",
      resourceId: referralCode,
      metadata: {
        referrerId: referrer.id,
        sharedIp: referredIp,
        note: "Flagged for moderator review — same IP within 24hrs",
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
 * Complete a referral — REFEREE side only.
 * Called when the referred user completes their first generation.
 * Awards credits to the REFEREE (welcome bonus).
 * Referrer credits are awarded separately on first paid action.
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
  if (referral.referredCredited) return false;

  const reward = REFERRAL_REWARD_CREDITS;

  // Award credits to REFEREE (welcome bonus)
  await addCredits(
    referredUserId,
    reward,
    "bonus",
    `Welcome bonus: referred by a friend`,
    `referral-referred-${referral.id}`
  );

  // Mark status as completed (referee credited), referrer awaits paid action
  await db
    .update(referrals)
    .set({
      status: "completed",
      referredCredited: true,
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
      refereeCredited: reward,
      note: "Referee credited on first generation. Referrer awaits first paid action.",
    },
  });

  return true;
}

/**
 * Complete referrer credit — called when referee makes first PAID subscription.
 * Triggered from Stripe webhook (checkout.session.completed for subscription).
 * Enforces lifetime cap. Respects same-IP flag (still awards, but logged).
 * Idempotent: safe to call multiple times.
 */
export async function creditReferrerOnPaidAction(
  referredUserId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Find the referral where referee has been credited but referrer hasn't
  const [referral] = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referredUserId, referredUserId),
        eq(referrals.referrerCredited, false)
      )
    )
    .limit(1);

  if (!referral) return false;

  const reward = REFERRAL_REWARD_CREDITS;

  // Check lifetime cap for referrer
  const earned = await getReferralCreditsEarned(referral.referrerUserId);
  if (earned >= REFERRAL_LIFETIME_CAP) {
    await logAuditEvent({
      userId: referral.referrerUserId,
      action: AUDIT_ACTIONS.REFERRAL_COMPLETED,
      resourceType: "referral",
      resourceId: String(referral.id),
      metadata: {
        blocked: true,
        reason: "Lifetime referral cap reached",
        lifetimeEarned: earned,
        cap: REFERRAL_LIFETIME_CAP,
      },
      severity: "info",
    });
    // Mark referral as subscribed but don't award credits
    await db
      .update(referrals)
      .set({ status: "subscribed", referrerCredited: true, creditsAwarded: 0 })
      .where(eq(referrals.id, referral.id));
    return false;
  }

  // Award credits to referrer
  await addCredits(
    referral.referrerUserId,
    reward,
    "bonus",
    `Referral bonus: friend subscribed to a paid plan`,
    `referral-referrer-${referral.id}`
  );

  await db
    .update(referrals)
    .set({
      status: "subscribed",
      referrerCredited: true,
      creditsAwarded: reward,
    })
    .where(eq(referrals.id, referral.id));

  await logAuditEvent({
    userId: referral.referrerUserId,
    action: AUDIT_ACTIONS.REFERRAL_COMPLETED,
    resourceType: "referral",
    resourceId: String(referral.id),
    metadata: {
      referredUserId,
      referrerCredited: reward,
      sameIpFlag: referral.sameIpFlag,
      lifetimeEarned: earned + reward,
      note: "Referrer credited on referee's first paid subscription.",
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
  lifetimeCap: number;
  referralCode: string | null;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalReferrals: 0,
      completedReferrals: 0,
      totalCreditsEarned: 0,
      lifetimeCap: REFERRAL_LIFETIME_CAP,
      referralCode: null,
    };
  }

  const allReferrals = await db
    .select({
      status: referrals.status,
      creditsAwarded: referrals.creditsAwarded,
      referrerCredited: referrals.referrerCredited,
    })
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId));

  const [user] = await db
    .select({ referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const credited = allReferrals.filter(
    (r) => r.referrerCredited && r.creditsAwarded > 0
  );

  return {
    totalReferrals: allReferrals.length,
    completedReferrals: credited.length,
    totalCreditsEarned: credited.reduce((sum, r) => sum + r.creditsAwarded, 0),
    lifetimeCap: REFERRAL_LIFETIME_CAP,
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

/**
 * Expire stale pending referrals older than 30 days.
 * Called on a daily interval from server startup.
 * Only affects referrals in "pending" status (link shared but no signup).
 */
export async function expireStalePendingReferrals(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await db
    .update(referrals)
    .set({ status: "expired" })
    .where(
      and(
        eq(referrals.status, "pending"),
        lte(referrals.createdAt, thirtyDaysAgo)
      )
    );

  const expiredCount = result[0]?.affectedRows ?? 0;

  if (expiredCount > 0) {
    log.info(`[Referral] Expired ${expiredCount} stale pending referrals (>30 days old)`);
    await logAuditEvent({
      action: AUDIT_ACTIONS.REFERRAL_REDEEMED, // reuse closest action
      resourceType: "referral",
      resourceId: "batch-expiration",
      metadata: {
        expiredCount,
        cutoffDate: thirtyDaysAgo.toISOString(),
        reason: "Stale pending referrals expired after 30 days",
      },
      severity: "info",
    });
  }

  return expiredCount;
}
