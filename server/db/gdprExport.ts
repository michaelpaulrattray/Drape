/**
 * GDPR Data Export — collects all personal data associated with a user
 * into a structured JSON object for GDPR Article 20 (right to data portability).
 *
 * Sensitive fields (internal IDs, S3 keys, suspension metadata, IP addresses)
 * are excluded from the export to prevent information leakage.
 */

import { eq, desc, inArray } from "drizzle-orm";
import {
  users,
  credits,
  creditTransactions,
  models,
  modelAssets,
  generations,
  referrals,
  changeRequests,
  modelEvidenceCrops,
  modelReferencePlates,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import {
  resolveEvidenceOwnerDelivery,
  type EvidenceDeliveryAdapter,
} from "../casting/evidence/evidenceDelivery";
import { assertOwnedEvidenceStorageKey } from "../casting/evidence/evidenceLifecycle";

/**
 * How many casts' assets one `model_assets` statement asks for (#1989). It
 * bounds the length of one `IN (…)` list and nothing else — the chunks run
 * sequentially, so the export holds one pool slot at a time at any size.
 */
export const GDPR_EXPORT_ASSET_CHUNK = 500;

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
    /**
     * The cast's personality and voice lines, and the customer's own sentence
     * behind each one (#2219). The customer's own words, so they belong in the
     * customer's export. The cast's recipe (`masterPrompt`, `technicalSchema`,
     * `preferences`) is deliberately NOT here: whether it belongs in an export
     * is a separate question that has not been put to the founder.
     */
    personality: string | null;
    voice: string | null;
    personalityOwnWords: string | null;
    voiceOwnWords: string | null;
    assets: Array<{
      viewType: string;
      resolution: string;
      storageUrl: string;
      createdAt: string;
    }>;
  }>;
  evidence: {
    referencePlates: Array<{
      kind: string;
      mime: string;
      width: number;
      height: number;
      byteSize: number;
      createdAt: string;
      ownerDelivery: string;
    }>;
    crops: Array<{
      ontologyVersion: string;
      zone: string;
      surface: string;
      side: string;
      sourceRectangle: {
        x: string;
        y: string;
        width: string;
        height: string;
      };
      sourceImageWidth: number;
      sourceImageHeight: number;
      mime: string;
      width: number;
      height: number;
      byteSize: number;
      cropRecipeVersion: string;
      createdAt: string;
      ownerDelivery: string;
    }>;
  };
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
export async function exportUserData(
  userId: number,
  evidenceDelivery?: EvidenceDeliveryAdapter,
): Promise<GdprExportData | null> {
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

  /*
    ⚠ **ONE READ PER CHUNK OF CASTS, NEVER ONE READ PER CAST — #1989.**

    This was `Promise.all(userModels.map(… select from model_assets …))`: one
    query per cast, all fired at once, onto the ONE shared pool every request
    in the building draws on (`connection.ts`: `connectionLimit: 20`,
    `queueLimit: 50`). Twenty in flight plus fifty queued is seventy, and the
    seventy-first was rejected outright with `Queue limit reached.` — so an
    account with more than about seventy casts could not export its data at
    all (measured on the dev fixture's 77 casts: a 500 whose `cause` read
    exactly that, at `Promise.all (index 70)`). In production the ceiling was
    lower, because other requests hold slots of the same pool.

    Now the assets are read with `modelId IN (…)`, one statement per chunk of
    `GDPR_EXPORT_ASSET_CHUNK` casts, the chunks run ONE AFTER ANOTHER, and the
    rows are grouped in memory. The export holds at most one pool slot at a
    time whatever the account's size. The chunk only bounds the length of a
    single statement's `IN` list; it is not a concurrency knob.

    `server/gdprExportBounded.test.ts` drives the real procedure over 200
    casts on a pool that refuses past seventy, and reddens if the per-cast
    fan-out comes back.
  */
  const modelIds = userModels.map((model) => model.id);
  const assetsByModel = new Map<number, Array<{
    viewType: string;
    resolution: string;
    storageUrl: string;
    createdAt: Date;
  }>>();
  for (let at = 0; at < modelIds.length; at += GDPR_EXPORT_ASSET_CHUNK) {
    const chunk = modelIds.slice(at, at + GDPR_EXPORT_ASSET_CHUNK);
    const rows = await db
      .select({
        modelId: modelAssets.modelId,
        viewType: modelAssets.viewType,
        resolution: modelAssets.resolution,
        storageUrl: modelAssets.storageUrl,
        createdAt: modelAssets.createdAt,
      })
      .from(modelAssets)
      .where(inArray(modelAssets.modelId, chunk))
      .orderBy(desc(modelAssets.createdAt));
    for (const row of rows) {
      const list = assetsByModel.get(row.modelId);
      const asset = {
        viewType: row.viewType,
        resolution: row.resolution,
        storageUrl: row.storageUrl,
        createdAt: row.createdAt,
      };
      if (list) list.push(asset);
      else assetsByModel.set(row.modelId, [asset]);
    }
  }

  const modelsWithAssets = userModels.map((model) => ({
    name: model.name,
    agencyId: model.agencyId,
    status: model.status,
    createdAt: model.createdAt.toISOString(),
    personality: model.personality,
    voice: model.voice,
    personalityOwnWords: model.personalityOwnWords,
    voiceOwnWords: model.voiceOwnWords,
    assets: (assetsByModel.get(model.id) ?? []).map((a) => ({
      viewType: a.viewType,
      resolution: a.resolution,
      storageUrl: a.storageUrl,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  // Evidence contains customer-uploaded likeness data. It is exported only
  // through the owner-delivery adapter; raw object keys, ingestion receipts,
  // cleanup leases, and operation internals never enter the DTO.
  const referencePlates = await db
    .select()
    .from(modelReferencePlates)
    .where(eq(modelReferencePlates.userId, userId))
    .orderBy(desc(modelReferencePlates.createdAt));
  const evidenceCrops = await db
    .select()
    .from(modelEvidenceCrops)
    .where(eq(modelEvidenceCrops.userId, userId))
    .orderBy(desc(modelEvidenceCrops.createdAt));
  if ((referencePlates.length > 0 || evidenceCrops.length > 0) && !evidenceDelivery) {
    throw new Error("Evidence owner delivery is unavailable for GDPR export");
  }
  /*
    These two `Promise.all`s look like the fan-out above and are not (#1989,
    read at the code): neither one touches the database. Each row is checked
    against its owner in memory and handed to `resolveOwnerDelivery`, which in
    the shipping adapter (`privateEvidenceStorage.ts`) formats an
    `/api/evidence/…` path and returns — no pool slot, no network. They would
    become the same defect only if an adapter started doing I/O per row, and
    that adapter would have to bound itself.
  */
  const exportedReferencePlates = await Promise.all(referencePlates.map(async (plate) => {
    assertOwnedEvidenceStorageKey({
      storageKey: plate.storageKey,
      userId: plate.userId,
      modelId: plate.modelId,
      purpose: plate.kind,
    });
    return {
      kind: plate.kind,
      mime: plate.mime,
      width: plate.width,
      height: plate.height,
      byteSize: plate.byteSize,
      createdAt: plate.createdAt.toISOString(),
      ownerDelivery: await resolveEvidenceOwnerDelivery(evidenceDelivery!, {
        userId,
        key: plate.storageKey,
      }),
    };
  }));
  const exportedEvidenceCrops = await Promise.all(evidenceCrops.map(async (crop) => {
    assertOwnedEvidenceStorageKey({
      storageKey: crop.storageKey,
      userId: crop.userId,
      modelId: crop.modelId,
      purpose: "evidence_crop",
    });
    return {
      ontologyVersion: crop.ontologyVersion,
      zone: crop.zone,
      surface: crop.surface,
      side: crop.side,
      sourceRectangle: {
        x: crop.sourceX,
        y: crop.sourceY,
        width: crop.sourceWidth,
        height: crop.sourceHeight,
      },
      sourceImageWidth: crop.sourceImageWidth,
      sourceImageHeight: crop.sourceImageHeight,
      mime: crop.mime,
      width: crop.width,
      height: crop.height,
      byteSize: crop.byteSize,
      cropRecipeVersion: crop.cropRecipeVersion,
      createdAt: crop.createdAt.toISOString(),
      ownerDelivery: await resolveEvidenceOwnerDelivery(evidenceDelivery!, {
        userId,
        key: crop.storageKey,
      }),
    };
  }));

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
    evidence: {
      referencePlates: exportedReferencePlates,
      crops: exportedEvidenceCrops,
    },
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
