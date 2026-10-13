/**
 * GDPR Data Export — collects all personal data associated with a user
 * into a structured JSON object for GDPR Article 20 (right to data portability).
 *
 * Sensitive fields (internal IDs, S3 keys, suspension metadata, IP addresses)
 * are excluded from the export to prevent information leakage.
 *
 * ⚠ **EVERY CREDIT FIGURE IN HERE IS ON THE CUSTOMER'S SCALE, AND IT WAS THE
 * LEDGER'S UNTIL #2475.** This file is a customer-facing surface wearing a
 * `server/db/` path: `account.exportData` hands what it returns to
 * `JSON.stringify` and a browser download (Settings → Security → *Export my
 * data*), with nothing between the rows and the file. So the founder's P1
 * ruling binds it exactly as it binds a screen — the display helper is *"the
 * ONLY source of any credit number a customer sees"* — and nine fields plus
 * the stored transaction sentence were shipping the internal figure, five
 * times what the balance chip showed the same person on the same account.
 *
 * The repair is at the READ and the stored rows are untouched (#2027's
 * precedent): each figure below goes through `shared/creditDisplay.ts` by its
 * own meaning — a balance DOWN, a charge UP, a signed history row by its sign
 * — and the transaction sentence is composed here rather than replayed, for
 * the reasons on `customerCreditNote`.
 *
 * ⚠ **Nothing in the credit-number census could see this file and nothing can
 * see one like it.** `server/testing/creditDisplaySites.ts` reads three
 * textual shapes, and `balance: userCredits.balance` inside an object literal
 * is none of them — so the one customer-facing surface that ships every credit
 * number at once was the surface outside the instrument. The guard here is
 * `server/gdprExportCreditScale.test.ts`, which drives the real procedure over
 * sentinel ledger rows and reads the serialized file; the census now names
 * this shape in its own "what it does NOT see" list.
 */

import { asc, eq, desc, inArray } from "drizzle-orm";
import {
  castCampaignMembers,
  castCampaigns,
  castCreationRecords,
  castVoices,
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
import {
  customerCreditNote,
  displayBalance,
  displayMovement,
  displayPrice,
  type DisplayCredits,
} from "../../shared/creditDisplay";
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
  /**
   * ⚠ **THE FOUR CREDIT FIGURES HERE ARE `DisplayCredits`, NOT `number`
   * (#2475)** — the brand is the half of the repair a reader cannot walk past:
   * assigning `userCredits.balance` back to any of them is a `pnpm check`
   * error at the line, not a wrong number in a customer's file.
   */
  subscription: {
    planTier: string;
    balance: DisplayCredits;
    /** Lifetime bought, so a balance-shaped figure: rounds DOWN. */
    creditsPurchased: DisplayCredits;
    /** Lifetime charged, so a price-shaped figure: rounds UP. */
    creditsUsed: DisplayCredits;
    rolloverCredits: DisplayCredits;
    subscriptionStatus: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  creditHistory: Array<{
    /** Signed, so the sign picks the rounding — `displayMovement` (#2475). */
    amount: DisplayCredits;
    type: string;
    /**
     * COMPOSED HERE, never the stored sentence (#2475, #1736). The stored one
     * holds ledger figures — *"Monthly credit refresh (180000 credits + 0
     * rollover)"* — and is already written, so it cannot be made correct for a
     * customer; `customerCreditNote` states the kind, the direction and the
     * same converted figure this record's `amount` carries. Never null, because
     * it no longer depends on a column that may be.
     */
    description: string;
    balanceAfter: DisplayCredits;
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
  /**
   * The customer's campaigns (#2257) — the names are their own words. Each
   * lists the public ids of the casts filed in it, which are the `agencyId`s
   * of the `models` above; internal row ids never leave.
   */
  campaigns: Array<{
    name: string;
    createdAt: string;
    castIds: string[];
  }>;
  /**
   * The signed, timestamped record behind each of the customer's Klieg IDs
   * (N2d-1, #2311; added on the relay's finding 3 on PR #2317) — it holds
   * their display name, account id and Klieg ID. Exported as the customer's
   * own evidence: the signed document, its signature and the authority's
   * token, everything needed to check it independently. Which authority
   * answered is internal and stays out, as it does from every customer
   * surface.
   */
  creationRecords: Array<{
    castId: string;
    recordVersion: string;
    record: string;
    recordSha256: string;
    signature: string;
    signingKeyId: string;
    timestampToken: string | null;
    stampedAt: string | null;
    /** When the owner turned the public check page on; null while it is off (#2313). */
    publicAt: string | null;
    createdAt: string;
  }>;
  /**
   * The voice behind each of the customer's casts (N4b-1, #2469).
   *
   * `designSentence` is their OWN WRITING — the voice line verbatim as it read
   * when the voice was made — so it belongs in their export, exactly as the
   * personality and voice lines on `models` above do. What stays out is ours
   * and internal: the storage key, the provider's saved-voice id, and the row
   * ids. The clip's `sha256` and byte size ARE here, because together they are
   * how a customer proves a copy they hold is the clip this record describes.
   *
   * ⚠ **The audition's bytes are not in the export.** A JSON document is the
   * wrong carrier for ninety seconds of audio per cast, and whether the clip
   * itself travels — it is a cloning source — is a question nobody has put to
   * the founder. Stated here rather than left as an apparent oversight: the
   * recipe (`masterPrompt`, `technicalSchema`, `preferences`) is absent from
   * this export for the same kind of reason, and this file already says so.
   */
  voices: Array<{
    castId: string;
    designSentence: string;
    passageVersion: number;
    clipSha256: string;
    clipBytes: number;
    keptAt: string;
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
    /** What this cost, so it rounds UP — never less than was charged (#2475). */
    pointsCost: DisplayCredits;
    resultUrl: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  referrals: {
    referralCode: string | null;
    sent: Array<{
      referredEmail: string | null;
      status: string;
      /** Credits the customer EARNED, so a balance: rounds DOWN (#2475). */
      creditsAwarded: DisplayCredits;
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

  /*
    3. Credit history (all transactions)

    ⚠ **`description` IS NOT SELECTED, AND THAT IS THE FIX RATHER THAN A
    TIDY-UP (#2475).** The stored sentence holds ledger figures and is not
    exported, so the column never enters this process — leaving it in the
    projection and declining to use it would put the wrong figure one keystroke
    from the file again. `server/gdprExportCreditScale.test.ts` reads the
    statement on the wire for it (working law 5).
  */
  const txns = await db
    .select({
      amount: creditTransactions.amount,
      type: creditTransactions.type,
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

  /*
    Campaigns (#2257). Both reads carry the owner in their own WHERE
    (invariant 1), and each member row is re-anchored IN MEMORY to the two
    owner-scoped sets already read — this customer's campaigns and this
    customer's casts (`userModels` above) — so a member row pointing at
    anyone else's campaign or cast cannot reach the export even if its
    denormalised `userId` were wrong (invariant 2). No `IN (…)` list is built,
    so the statement count stays fixed at any size (#1989). A cast's public id
    is its `agencyId`, the same id `models` above carries; internal ids
    (`cast_campaigns.id`, `models.id`) stay on the server.
  */
  const ownedCampaigns = await db
    .select({
      id: castCampaigns.id,
      name: castCampaigns.name,
      createdAt: castCampaigns.createdAt,
    })
    .from(castCampaigns)
    .where(eq(castCampaigns.userId, userId))
    .orderBy(asc(castCampaigns.sortOrder), asc(castCampaigns.id));
  const ownedMembers = await db
    .select({
      campaignId: castCampaignMembers.campaignId,
      modelId: castCampaignMembers.modelId,
    })
    .from(castCampaignMembers)
    .where(eq(castCampaignMembers.userId, userId))
    .orderBy(asc(castCampaignMembers.id));
  const castPublicIdByModel = new Map<number, string>();
  for (const model of userModels) {
    if (model.agencyId) castPublicIdByModel.set(model.id, model.agencyId);
  }
  const castIdsByCampaign = new Map<number, string[]>(
    ownedCampaigns.map((campaign) => [campaign.id, []]),
  );
  for (const member of ownedMembers) {
    const list = castIdsByCampaign.get(member.campaignId);
    const castId = castPublicIdByModel.get(member.modelId);
    if (list && castId) list.push(castId);
  }
  /*
    Creation records (N2d-1, #2311 — the relay's finding 3 on PR #2317). The
    owner is in the statement's own WHERE (invariant 1) and every row is
    re-anchored IN MEMORY to this customer's casts read above, so a record
    whose cast is not theirs, or is gone, cannot reach the export
    (invariant 2). Fixed statement count at any size (#1989).
  */
  const ownedCreationRecords = await db
    .select({
      modelId: castCreationRecords.modelId,
      recordVersion: castCreationRecords.recordVersion,
      recordJson: castCreationRecords.recordJson,
      recordSha256: castCreationRecords.recordSha256,
      signature: castCreationRecords.signature,
      signingKeyId: castCreationRecords.signingKeyId,
      timestampToken: castCreationRecords.timestampToken,
      stampedAt: castCreationRecords.stampedAt,
      /* The owner's public check-page switch (N2d-3, #2313): a publication
         choice they made, so it is theirs to see in the export. */
      publicAt: castCreationRecords.publicAt,
      createdAt: castCreationRecords.createdAt,
    })
    .from(castCreationRecords)
    .where(eq(castCreationRecords.userId, userId))
    .orderBy(asc(castCreationRecords.id));
  /*
    The kept voices (N4b-1, #2469), on the records' shape clause for clause: the
    owner is in the statement's own WHERE (invariant 1) and every row is
    re-anchored IN MEMORY to this customer's casts read above, so a voice whose
    cast is not theirs, or is gone, cannot reach the export (invariant 2). One
    statement at any size (#1989).
  */
  const ownedVoices = await db
    .select({
      modelId: castVoices.modelId,
      designSentence: castVoices.designSentence,
      passageVersion: castVoices.passageVersion,
      clipSha256: castVoices.clipSha256,
      clipBytes: castVoices.clipBytes,
      keptAt: castVoices.keptAt,
    })
    .from(castVoices)
    .where(eq(castVoices.userId, userId))
    .orderBy(asc(castVoices.id));
  const exportedVoices = ownedVoices.flatMap((voice) => {
    const castId = castPublicIdByModel.get(voice.modelId);
    if (!castId) return [];
    return [{
      castId,
      designSentence: voice.designSentence,
      passageVersion: voice.passageVersion,
      clipSha256: voice.clipSha256,
      clipBytes: voice.clipBytes,
      keptAt: voice.keptAt.toISOString(),
    }];
  });

  const exportedCreationRecords = ownedCreationRecords.flatMap((record) => {
    const castId = castPublicIdByModel.get(record.modelId);
    if (!castId) return [];
    return [{
      castId,
      recordVersion: record.recordVersion,
      record: record.recordJson,
      recordSha256: record.recordSha256,
      signature: record.signature,
      signingKeyId: record.signingKeyId,
      timestampToken: record.timestampToken,
      stampedAt: record.stampedAt?.toISOString() ?? null,
      publicAt: record.publicAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    }];
  });

  const exportedCampaigns = ownedCampaigns.map((campaign) => ({
    name: campaign.name,
    createdAt: campaign.createdAt.toISOString(),
    castIds: castIdsByCampaign.get(campaign.id) ?? [],
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
          /*
            Each by its own meaning, and the pairing is the house answer rather
            than a choice made here: the admin panel's own account detail reads
            these same two columns as `displayBalance(creditsPurchased)` and
            `displayPrice(creditsUsed)` (`client/src/features/admin/UserTable.tsx`).
          */
          balance: displayBalance(userCredits.balance),
          creditsPurchased: displayBalance(userCredits.creditsPurchased),
          creditsUsed: displayPrice(userCredits.creditsUsed),
          rolloverCredits: displayBalance(userCredits.rolloverCredits),
          subscriptionStatus: userCredits.subscriptionStatus,
          currentPeriodStart: userCredits.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: userCredits.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    creditHistory: txns.map((t) => {
      /*
        ONE conversion, read twice — the field and the sentence cannot disagree
        about the figure, which is the property the half-fix fails.
      */
      const amount = displayMovement(t.amount);
      return {
        amount,
        type: t.type,
        description: customerCreditNote(t.type, amount),
        balanceAfter: displayBalance(t.balanceAfter),
        createdAt: t.createdAt.toISOString(),
      };
    }),
    models: modelsWithAssets,
    campaigns: exportedCampaigns,
    creationRecords: exportedCreationRecords,
    voices: exportedVoices,
    evidence: {
      referencePlates: exportedReferencePlates,
      crops: exportedEvidenceCrops,
    },
    generations: gens.map((g) => ({
      type: g.type,
      status: g.status,
      pointsCost: displayPrice(g.pointsCost),
      resultUrl: g.resultUrl,
      createdAt: g.createdAt.toISOString(),
      completedAt: g.completedAt?.toISOString() ?? null,
    })),
    referrals: {
      referralCode: user.referralCode,
      sent: sentReferrals.map((r) => ({
        referredEmail: r.referredEmail,
        status: r.status,
        creditsAwarded: displayBalance(r.creditsAwarded),
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
