import { and, eq, isNull, ne } from "drizzle-orm";
import {
  modelEvidenceCrops,
  modelReferencePlates,
  models,
} from "../../drizzle/schema";
import type {
  AuthorizedEvidenceDelivery,
} from "../casting/evidence/evidenceDeliveryHttp";
import type { EvidenceStorageKind } from "../casting/evidence/evidenceDelivery";
import { getDb } from "./connection";

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
        isNull(models.deletedAt),
        ne(models.status, "archived"),
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
      isNull(models.deletedAt),
      ne(models.status, "archived"),
    ))
    .where(and(
      eq(modelEvidenceCrops.id, input.entityId),
      eq(modelEvidenceCrops.userId, input.userId),
      eq(modelEvidenceCrops.modelId, models.id),
    ))
    .limit(1);
  return row ? { ...row, kind: "crop" } : null;
}
