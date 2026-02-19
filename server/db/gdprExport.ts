/**
 * GDPR Data Export — collects all personal data associated with a user
 * into a structured JSON object for GDPR Article 20 (right to data portability).
 *
 * Sensitive fields (internal IDs, S3 keys, suspension metadata, IP addresses)
 * are excluded from the export to prevent information leakage.
 */

import { eq, desc, or } from "drizzle-orm";
import {
  users,
  credits,
  creditTransactions,
  models,
  modelAssets,
  generations,
  referrals,
  changeRequests,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export interface GdprExportData {
  exportedAt: string;
  profile: {
    name: string | null;
    displayName: string | null;
    email: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    role: string;
    createdAt: string;
    lastSignedIn: string;
  };
  subscription: {
    planTier: string;
    balance: number;
    creditsPurchased: number;
    creditsUsed: number;
    rolloverCredits: number;
    subscriptionStatus: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  creditHistory: Array<{
    amount: number;
    type: string;
    description: string | null;
    balanceAfter: number;
    createdAt: string;
  }>;
  models: Array<{
    name: string | null;
    agencyId: string | null;
    status: string;
    createdAt: string;
    assets: Array<{
      viewType: string;
      resolution: string;
      storageUrl: string;
      createdAt: string;
    }>;
  }>;
  generations: Array<{
    type: string;
    status: string;
    pointsCost: number;
    resultUrl: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  referrals: {
    referralCode: string | null;
    sent: Array<{
      referredEmail: string | null;
      status: string;
      creditsAwarded: number;
      createdAt: string;
    }>;
  };
  changeRequests: Array<{
    type: string;
    status: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
}

/**
 * Collect all personal data for a user in GDPR-compliant export format.
 * Excludes internal IDs, S3 keys, IP addresses, and admin metadata.
 */
export async function exportUserData(userId: number): Promise<GdprExportData | null> {
  const db = await getDb();
  if (!db) return null;

  // 1. Profile
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  // 2. Subscription / credits
  const [userCredits] = await db
    .select()
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);

  // 3. Credit history (all transactions)
  const txns = await db
    .select({
      amount: creditTransactions.amount,
      type: creditTransactions.type,
      description: creditTransactions.description,
      balanceAfter: creditTransactions.balanceAfter,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt));

  // 4. Models + assets
  const userModels = await db
    .select()
    .from(models)
    .where(eq(models.userId, userId))
    .orderBy(desc(models.createdAt));

  const modelsWithAssets = await Promise.all(
    userModels.map(async (model) => {
      const assets = await db
        .select({
          viewType: modelAssets.viewType,
          resolution: modelAssets.resolution,
          storageUrl: modelAssets.storageUrl,
          createdAt: modelAssets.createdAt,
        })
        .from(modelAssets)
        .where(eq(modelAssets.modelId, model.id))
        .orderBy(desc(modelAssets.createdAt));

      return {
        name: model.name,
        agencyId: model.agencyId,
        status: model.status,
        createdAt: model.createdAt.toISOString(),
        assets: assets.map((a) => ({
          viewType: a.viewType,
          resolution: a.resolution,
          storageUrl: a.storageUrl,
          createdAt: a.createdAt.toISOString(),
        })),
      };
    })
  );

  // 5. Generations
  const gens = await db
    .select({
      type: generations.type,
      status: generations.status,
      pointsCost: generations.pointsCost,
      resultUrl: generations.resultUrl,
      createdAt: generations.createdAt,
      completedAt: generations.completedAt,
    })
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt));

  // 6. Referrals sent by user
  const sentReferrals = await db
    .select({
      referredEmail: referrals.referredEmail,
      status: referrals.status,
      creditsAwarded: referrals.creditsAwarded,
      createdAt: referrals.createdAt,
    })
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId))
    .orderBy(desc(referrals.createdAt));

  // 7. Change requests submitted by user (as target)
  const userCRs = await db
    .select({
      type: changeRequests.type,
      status: changeRequests.status,
      title: changeRequests.title,
      description: changeRequests.description,
      createdAt: changeRequests.createdAt,
    })
    .from(changeRequests)
    .where(eq(changeRequests.targetUserId, userId))
    .orderBy(desc(changeRequests.createdAt));

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      lastSignedIn: user.lastSignedIn.toISOString(),
    },
    subscription: userCredits
      ? {
          planTier: userCredits.planTier,
          balance: userCredits.balance,
          creditsPurchased: userCredits.creditsPurchased,
          creditsUsed: userCredits.creditsUsed,
          rolloverCredits: userCredits.rolloverCredits,
          subscriptionStatus: userCredits.subscriptionStatus,
          currentPeriodStart: userCredits.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: userCredits.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    creditHistory: txns.map((t) => ({
      amount: t.amount,
      type: t.type,
      description: t.description,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt.toISOString(),
    })),
    models: modelsWithAssets,
    generations: gens.map((g) => ({
      type: g.type,
      status: g.status,
      pointsCost: g.pointsCost,
      resultUrl: g.resultUrl,
      createdAt: g.createdAt.toISOString(),
      completedAt: g.completedAt?.toISOString() ?? null,
    })),
    referrals: {
      referralCode: user.referralCode,
      sent: sentReferrals.map((r) => ({
        referredEmail: r.referredEmail,
        status: r.status,
        creditsAwarded: r.creditsAwarded,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    changeRequests: userCRs.map((cr) => ({
      type: cr.type,
      status: cr.status,
      title: cr.title,
      description: cr.description,
      createdAt: cr.createdAt.toISOString(),
    })),
  };
}
