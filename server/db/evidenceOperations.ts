import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  castingEvidenceIngestions,
  generationOperationLocks,
  generationOperations,
  modelEvidenceCrops,
  modelReferencePlates,
  models,
} from "../../drizzle/schema";
import {
  buildReferencePlateStorageKey,
  parseEvidenceStorageKey,
} from "../casting/evidence/evidenceDelivery";
import type { CanonicalEvidenceImage } from "../casting/evidence/imageValidation";
import type { EvidenceModelHead } from "../casting/evidence/referencePlateIngestion";
import { modelOperationLockKey } from "../casting/operationContract";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { getDb, withTransaction, type TransactionHandle } from "./connection";
import { finalizeClaimedGenerationOperationSuccessIn } from "./generationOperations";

export class EvidenceOperationStateError extends Error {
  readonly code:
    | "model_unavailable"
    | "operation_unavailable"
    | "receipt_conflict"
    | "snapshot_head_changed"
    | "plate_unavailable"
    | "plate_in_use";

  constructor(code: EvidenceOperationStateError["code"]) {
    super("The reference image action could not be completed. Nothing was charged.");
    this.name = "EvidenceOperationStateError";
    this.code = code;
  }
}

export interface PreparedEvidencePlate {
  ingestionId: string;
  plateId: string;
  storageKey: string;
  status: "planned" | "stored";
  expectedHead: EvidenceModelHead;
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function headFromModel(model: {
  stateVersion: number;
  currentPackageSnapshotId: string | null;
  identityRevisionId: string | null;
}): EvidenceModelHead {
  return {
    stateVersion: model.stateVersion,
    currentPackageSnapshotId: model.currentPackageSnapshotId ?? null,
    identityRevisionId: model.identityRevisionId ?? null,
  };
}

async function lockOwnedDraftModelIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
) {
  const [model] = await tx
    .select({
      id: models.id,
      userId: models.userId,
      stateVersion: models.stateVersion,
      currentPackageSnapshotId: models.currentPackageSnapshotId,
      identityRevisionId: models.identityRevisionId,
    })
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      eq(models.status, "draft"),
      isNull(models.deletedAt),
    ))
    .limit(1)
    .for("update");
  if (!model) throw new EvidenceOperationStateError("model_unavailable");
  return model;
}

async function lockClaimedEvidenceOperationIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    kind: "evidence_plate_ingest" | "evidence_plate_discard";
  },
) {
  const [operation] = await tx
    .select()
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.modelId, input.modelId),
      eq(generationOperations.kind, input.kind),
      eq(generationOperations.status, "claimed"),
    ))
    .limit(1)
    .for("update");
  if (!operation) throw new EvidenceOperationStateError("operation_unavailable");
  const [lock] = await tx
    .select()
    .from(generationOperationLocks)
    .where(and(
      eq(generationOperationLocks.lockKey, modelOperationLockKey(input.modelId)),
      eq(generationOperationLocks.operationId, input.operationId),
      eq(generationOperationLocks.kind, input.kind),
    ))
    .limit(1)
    .for("update");
  if (!lock) throw new EvidenceOperationStateError("operation_unavailable");
  return operation;
}

function expectedHeadFromOperation(operation: {
  expectedStateVersion: number | null;
  expectedPackageSnapshotId: string | null;
  expectedIdentityRevisionId: string | null;
}): EvidenceModelHead | null {
  if (operation.expectedStateVersion === null) return null;
  return {
    stateVersion: operation.expectedStateVersion,
    currentPackageSnapshotId: operation.expectedPackageSnapshotId ?? null,
    identityRevisionId: operation.expectedIdentityRevisionId ?? null,
  };
}

function headsEqual(left: EvidenceModelHead, right: EvidenceModelHead): boolean {
  return left.stateVersion === right.stateVersion
    && left.currentPackageSnapshotId === right.currentPackageSnapshotId
    && left.identityRevisionId === right.identityRevisionId;
}

export async function inspectOwnedDraftEvidenceTarget(input: {
  userId: number;
  modelId: number;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [model] = await db
    .select({ id: models.id })
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      eq(models.status, "draft"),
      isNull(models.deletedAt),
    ))
    .limit(1);
  return Boolean(model);
}

export async function prepareReferencePlateOperation(input: {
  userId: number;
  modelId: number;
  operationId: string;
  ingestionId: string;
  plateId: string;
  image: CanonicalEvidenceImage;
}): Promise<PreparedEvidencePlate> {
  return withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input);
    const operation = await lockClaimedEvidenceOperationIn(tx, {
      ...input,
      kind: "evidence_plate_ingest",
    });
    const currentHead = headFromModel(model);
    const existingExpectedHead = expectedHeadFromOperation(operation);

    const [existing] = await tx
      .select()
      .from(castingEvidenceIngestions)
      .where(and(
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.operationId, input.operationId),
      ))
      .limit(1)
      .for("update");
    if (existing) {
      if (
        !existingExpectedHead
        || !headsEqual(currentHead, existingExpectedHead)
        || existing.purpose !== "reference_plate"
        || (existing.status !== "planned" && existing.status !== "stored")
        || existing.mime !== input.image.mime
        || existing.width !== input.image.width
        || existing.height !== input.image.height
        || existing.byteSize !== input.image.byteSize
        || existing.contentHash !== input.image.contentHash
      ) {
        throw new EvidenceOperationStateError(
          existingExpectedHead && !headsEqual(currentHead, existingExpectedHead)
            ? "snapshot_head_changed"
            : "receipt_conflict",
        );
      }
      const parsed = parseEvidenceStorageKey(existing.storageKey);
      if (
        parsed.userId !== input.userId
        || parsed.modelId !== input.modelId
        || parsed.kind !== "plate"
      ) {
        throw new EvidenceOperationStateError("receipt_conflict");
      }
      return {
        ingestionId: existing.id,
        plateId: parsed.entityId,
        storageKey: existing.storageKey,
        status: existing.status,
        expectedHead: existingExpectedHead,
      };
    }

    if (existingExpectedHead) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
    const storageKey = buildReferencePlateStorageKey({
      userId: input.userId,
      modelId: input.modelId,
      plateId: input.plateId,
    });
    const quoted = await tx
      .update(generationOperations)
      .set({
        expectedStateVersion: currentHead.stateVersion,
        expectedPackageSnapshotId: currentHead.currentPackageSnapshotId,
        expectedIdentityRevisionId: currentHead.identityRevisionId,
      })
      .where(and(
        eq(generationOperations.id, input.operationId),
        eq(generationOperations.userId, input.userId),
        eq(generationOperations.modelId, input.modelId),
        eq(generationOperations.kind, "evidence_plate_ingest"),
        eq(generationOperations.status, "claimed"),
        isNull(generationOperations.expectedStateVersion),
      ));
    if (affectedRows(quoted) !== 1) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
    await tx.insert(castingEvidenceIngestions).values({
      id: input.ingestionId,
      userId: input.userId,
      modelId: input.modelId,
      operationId: input.operationId,
      purpose: "reference_plate",
      status: "planned",
      storageKey,
      mime: input.image.mime,
      width: input.image.width,
      height: input.image.height,
      byteSize: input.image.byteSize,
      contentHash: input.image.contentHash,
    });
    return {
      ingestionId: input.ingestionId,
      plateId: input.plateId,
      storageKey,
      status: "planned",
      expectedHead: currentHead,
    };
  });
}

export async function markReferencePlateOperationStored(input: {
  userId: number;
  modelId: number;
  operationId: string;
  prepared: PreparedEvidencePlate;
  image: CanonicalEvidenceImage;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const [receipt] = await tx
      .select()
      .from(castingEvidenceIngestions)
      .where(and(
        eq(castingEvidenceIngestions.id, input.prepared.ingestionId),
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.operationId, input.operationId),
        eq(castingEvidenceIngestions.storageKey, input.prepared.storageKey),
        eq(castingEvidenceIngestions.contentHash, input.image.contentHash),
      ))
      .limit(1)
      .for("update");
    if (!receipt || (receipt.status !== "planned" && receipt.status !== "stored")) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
    if (receipt.status === "stored") return;
    const updated = await tx
      .update(castingEvidenceIngestions)
      .set({ status: "stored" })
      .where(and(
        eq(castingEvidenceIngestions.id, receipt.id),
        eq(castingEvidenceIngestions.status, "planned"),
        eq(castingEvidenceIngestions.storageKey, receipt.storageKey),
        eq(castingEvidenceIngestions.contentHash, receipt.contentHash),
      ));
    if (affectedRows(updated) !== 1) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
  });
}

export interface EvidencePlateClosedResult {
  plateId: string;
  mime: "image/webp";
  width: number;
  height: number;
  byteSize: number;
  contentHash: string;
}

export async function attachAndCompleteReferencePlateOperation(input: {
  userId: number;
  modelId: number;
  operationId: string;
  prepared: PreparedEvidencePlate;
  image: CanonicalEvidenceImage;
}): Promise<EvidencePlateClosedResult> {
  const result: EvidencePlateClosedResult = {
    plateId: input.prepared.plateId,
    mime: input.image.mime,
    width: input.image.width,
    height: input.image.height,
    byteSize: input.image.byteSize,
    contentHash: input.image.contentHash,
  };
  return withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input);
    const operation = await lockClaimedEvidenceOperationIn(tx, {
      ...input,
      kind: "evidence_plate_ingest",
    });
    const expectedHead = expectedHeadFromOperation(operation);
    if (!expectedHead || !headsEqual(headFromModel(model), expectedHead)) {
      throw new EvidenceOperationStateError("snapshot_head_changed");
    }
    const [receipt] = await tx
      .select()
      .from(castingEvidenceIngestions)
      .where(and(
        eq(castingEvidenceIngestions.id, input.prepared.ingestionId),
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.operationId, input.operationId),
        eq(castingEvidenceIngestions.purpose, "reference_plate"),
        eq(castingEvidenceIngestions.status, "stored"),
        eq(castingEvidenceIngestions.storageKey, input.prepared.storageKey),
        eq(castingEvidenceIngestions.contentHash, input.image.contentHash),
      ))
      .limit(1)
      .for("update");
    if (!receipt) throw new EvidenceOperationStateError("receipt_conflict");

    const inserted = await tx.execute(sql`
      INSERT INTO model_reference_plates (
        id, userId, modelId, kind, storageKey, mime, width, height,
        byteSize, contentHash, createdByOperationId
      )
      SELECT
        ${input.prepared.plateId}, ${input.userId}, ${input.modelId},
        'uploaded_reference', ${input.prepared.storageKey}, ${input.image.mime},
        ${input.image.width}, ${input.image.height}, ${input.image.byteSize},
        ${input.image.contentHash}, ${input.operationId}
      FROM models
      WHERE models.id = ${input.modelId}
        AND models.userId = ${input.userId}
        AND models.status = 'draft'
        AND models.deletedAt IS NULL
        AND models.stateVersion = ${expectedHead.stateVersion}
        AND models.currentPackageSnapshotId <=> ${expectedHead.currentPackageSnapshotId}
        AND models.identityRevisionId <=> ${expectedHead.identityRevisionId}
    `);
    if (affectedRows(inserted) !== 1) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
    const attached = await tx
      .update(castingEvidenceIngestions)
      .set({
        status: "attached",
        attachedEntityKind: "reference_plate",
        attachedEntityId: input.prepared.plateId,
        attachedAt: new Date(),
      })
      .where(and(
        eq(castingEvidenceIngestions.id, receipt.id),
        eq(castingEvidenceIngestions.status, "stored"),
        eq(castingEvidenceIngestions.storageKey, receipt.storageKey),
        eq(castingEvidenceIngestions.contentHash, receipt.contentHash),
      ));
    if (affectedRows(attached) !== 1) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
    await finalizeClaimedGenerationOperationSuccessIn(tx, {
      userId: input.userId,
      operationId: input.operationId,
      result,
    });
    return result;
  });
}

export async function findOwnedEvidencePlateById(input: {
  userId: number;
  plateId: string;
}): Promise<{
  modelId: number;
  storageKey: string;
  result: EvidencePlateClosedResult;
} | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [plate] = await db
    .select()
    .from(modelReferencePlates)
    .where(and(
      eq(modelReferencePlates.id, input.plateId),
      eq(modelReferencePlates.userId, input.userId),
    ))
    .limit(1);
  if (!plate) return null;
  return {
    modelId: plate.modelId,
    storageKey: plate.storageKey,
    result: {
      plateId: plate.id,
      mime: "image/webp",
      width: plate.width,
      height: plate.height,
      byteSize: plate.byteSize,
      contentHash: plate.contentHash,
    },
  };
}

export async function inspectOwnedDraftPlate(input: {
  userId: number;
  plateId: string;
}): Promise<{ modelId: number } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ modelId: modelReferencePlates.modelId })
    .from(modelReferencePlates)
    .innerJoin(models, and(
      eq(models.id, modelReferencePlates.modelId),
      eq(models.userId, input.userId),
      eq(models.status, "draft"),
      isNull(models.deletedAt),
    ))
    .where(and(
      eq(modelReferencePlates.id, input.plateId),
      eq(modelReferencePlates.userId, input.userId),
    ))
    .limit(1);
  return row ?? null;
}

export async function discardReferencePlateOperation(input: {
  userId: number;
  modelId: number;
  plateId: string;
  operationId: string;
}): Promise<{ plateId: string; discarded: true }> {
  return withTransaction(async (tx) => {
    await lockOwnedDraftModelIn(tx, input);
    await lockClaimedEvidenceOperationIn(tx, {
      ...input,
      kind: "evidence_plate_discard",
    });
    const [plate] = await tx
      .select()
      .from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.id, input.plateId),
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, input.modelId),
      ))
      .limit(1)
      .for("update");
    if (!plate) throw new EvidenceOperationStateError("plate_unavailable");
    const [crop] = await tx
      .select({ id: modelEvidenceCrops.id })
      .from(modelEvidenceCrops)
      .where(and(
        eq(modelEvidenceCrops.userId, input.userId),
        eq(modelEvidenceCrops.modelId, input.modelId),
        eq(modelEvidenceCrops.plateId, input.plateId),
      ))
      .limit(1)
      .for("update");
    if (crop) throw new EvidenceOperationStateError("plate_in_use");
    const [receipt] = await tx
      .select()
      .from(castingEvidenceIngestions)
      .where(and(
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.operationId, plate.createdByOperationId),
        eq(castingEvidenceIngestions.status, "attached"),
        eq(castingEvidenceIngestions.attachedEntityKind, "reference_plate"),
        eq(castingEvidenceIngestions.attachedEntityId, input.plateId),
        eq(castingEvidenceIngestions.storageKey, plate.storageKey),
      ))
      .limit(1)
      .for("update");
    if (!receipt) throw new EvidenceOperationStateError("receipt_conflict");
    const parsed = parseEvidenceStorageKey(plate.storageKey);
    if (
      parsed.userId !== input.userId
      || parsed.modelId !== input.modelId
      || parsed.kind !== "plate"
      || parsed.entityId !== input.plateId
    ) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
    const manifest = await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.userId,
      operationId: input.operationId,
      kind: "evidence_cleanup",
      storageItems: [{
        storageKey: plate.storageKey,
        storageBackend: "private_evidence_r2",
      }],
    });
    const queued = await tx
      .update(castingEvidenceIngestions)
      .set({
        status: "cleanup_pending",
        cleanupBatchId: manifest.id,
        cleanupQueuedAt: new Date(),
      })
      .where(and(
        eq(castingEvidenceIngestions.id, receipt.id),
        eq(castingEvidenceIngestions.status, "attached"),
        isNull(castingEvidenceIngestions.cleanupBatchId),
        eq(castingEvidenceIngestions.storageKey, plate.storageKey),
      ));
    if (affectedRows(queued) !== 1) {
      throw new EvidenceOperationStateError("receipt_conflict");
    }
    const deleted = await tx
      .delete(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.id, input.plateId),
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, input.modelId),
        eq(modelReferencePlates.storageKey, plate.storageKey),
      ));
    if (affectedRows(deleted) !== 1) {
      throw new EvidenceOperationStateError("plate_unavailable");
    }
    const result = { plateId: input.plateId, discarded: true as const };
    await finalizeClaimedGenerationOperationSuccessIn(tx, {
      userId: input.userId,
      operationId: input.operationId,
      result,
    });
    return result;
  });
}
