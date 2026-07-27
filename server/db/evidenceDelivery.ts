import { and, eq, gt, isNotNull } from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  modelIdentityFeatureIntents,
  modelEvidenceCrops,
  modelReferencePlates,
  models,
} from "../../drizzle/schema";
import type {
  AuthorizedEvidenceDelivery,
} from "../casting/evidence/evidenceDeliveryHttp";
import type { EvidenceStorageKind } from "../casting/evidence/evidenceDelivery";
import { getDb } from "./connection";
import { availableModelWhere } from "../casting/modelAvailability";

/**
 * Resolve one evidence object through a statement that proves the child,
 * model, and authenticated owner together. Missing and foreign ids therefore
 * have the same result and no preceding guard carries authority.
 */
export async function readOwnedEvidenceDelivery(input: {
  userId: number;
  kind: EvidenceStorageKind;
  entityId: string;
}): Promise<AuthorizedEvidenceDelivery | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.kind === "candidate") {
    const [row] = await db
      .select({
        ownerId: castingEvidenceCandidates.userId,
        modelId: castingEvidenceCandidates.modelId,
        entityId: castingEvidenceCandidates.id,
        storageEntityId: castingEvidenceCandidateAttempts.privatePlateId,
        storageKey: castingEvidenceCandidateAttempts.privateStorageKey,
        byteSize: castingEvidenceCandidateAttempts.byteSize,
        contentHash: castingEvidenceCandidateAttempts.contentHash,
      })
      .from(castingEvidenceCandidates)
      .innerJoin(modelIdentityFeatureIntents, and(
        eq(modelIdentityFeatureIntents.id, castingEvidenceCandidates.intentId),
        eq(modelIdentityFeatureIntents.userId, input.userId),
        eq(modelIdentityFeatureIntents.modelId, castingEvidenceCandidates.modelId),
        eq(modelIdentityFeatureIntents.status, "pending"),
      ))
      .innerJoin(castingEvidenceCandidateAttempts, and(
        eq(castingEvidenceCandidateAttempts.id, castingEvidenceCandidates.readyAttemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, castingEvidenceCandidates.id),
        eq(castingEvidenceCandidateAttempts.status, "probe_passed"),
        isNotNull(castingEvidenceCandidateAttempts.privateStorageKey),
        isNotNull(castingEvidenceCandidateAttempts.byteSize),
        isNotNull(castingEvidenceCandidateAttempts.contentHash),
      ))
      .innerJoin(models, and(
        eq(models.id, castingEvidenceCandidates.modelId),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ))
      .where(and(
        eq(castingEvidenceCandidates.id, input.entityId),
        eq(castingEvidenceCandidates.userId, input.userId),
        eq(castingEvidenceCandidates.status, "ready"),
        isNotNull(castingEvidenceCandidates.expiresAt),
        gt(castingEvidenceCandidates.expiresAt, new Date()),
      ))
      .limit(1);
    if (
      !row
      || row.storageKey === null
      || row.byteSize === null
      || row.contentHash === null
    ) {
      return null;
    }
    return {
      ownerId: row.ownerId,
      modelId: row.modelId,
      kind: "candidate",
      entityId: row.entityId,
      storageKind: "candidate",
      storageEntityId: row.storageEntityId,
      storageKey: row.storageKey,
      byteSize: row.byteSize,
      contentHash: row.contentHash,
    };
  }
  if (input.kind === "plate") {
    const [row] = await db
      .select({
        ownerId: modelReferencePlates.userId,
        modelId: modelReferencePlates.modelId,
        entityId: modelReferencePlates.id,
        storageKey: modelReferencePlates.storageKey,
        byteSize: modelReferencePlates.byteSize,
        contentHash: modelReferencePlates.contentHash,
      })
      .from(modelReferencePlates)
      .innerJoin(models, and(
        eq(models.id, modelReferencePlates.modelId),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ))
      .where(and(
        eq(modelReferencePlates.id, input.entityId),
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, models.id),
      ))
      .limit(1);
    return row ? { ...row, kind: "plate" } : null;
  }
  const [row] = await db
    .select({
      ownerId: modelEvidenceCrops.userId,
      modelId: modelEvidenceCrops.modelId,
      entityId: modelEvidenceCrops.id,
      storageKey: modelEvidenceCrops.storageKey,
      byteSize: modelEvidenceCrops.byteSize,
      contentHash: modelEvidenceCrops.contentHash,
    })
    .from(modelEvidenceCrops)
    .innerJoin(models, and(
      eq(models.id, modelEvidenceCrops.modelId),
      eq(models.userId, input.userId),
      availableModelWhere(),
    ))
    .where(and(
      eq(modelEvidenceCrops.id, input.entityId),
      eq(modelEvidenceCrops.userId, input.userId),
      eq(modelEvidenceCrops.modelId, models.id),
    ))
    .limit(1);
  return row ? { ...row, kind: "crop" } : null;
}
