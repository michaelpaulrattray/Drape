import { and, eq, isNull, sql } from "drizzle-orm";
import {
  castingEvidenceIngestions,
  modelReferencePlates,
  models,
} from "../../drizzle/schema";
import type {
  EvidenceModelHead,
  PlannedReferencePlate,
  ReferencePlateAttachment,
  ReferencePlateIngestionPersistence,
} from "../casting/evidence/referencePlateIngestion";
import { withTransaction, type TransactionHandle } from "./connection";

function affectedRows(result: unknown): number {
  const candidate = result as
    | { affectedRows?: unknown }
    | [{ affectedRows?: unknown }]
    | [[{ affectedRows?: unknown }]];
  if (Array.isArray(candidate)) {
    const first = candidate[0];
    if (Array.isArray(first)) {
      return typeof first[0]?.affectedRows === "number" ? first[0].affectedRows : 0;
    }
    return typeof first?.affectedRows === "number" ? first.affectedRows : 0;
  }
  return typeof candidate?.affectedRows === "number" ? candidate.affectedRows : 0;
}

export class EvidenceIngestionStateError extends Error {
  readonly code:
    | "model_unavailable"
    | "plan_conflict"
    | "stored_state_changed"
    | "snapshot_head_changed"
    | "attachment_conflict";

  constructor(code: EvidenceIngestionStateError["code"]) {
    super("The reference image could not be attached. Nothing was charged.");
    this.name = "EvidenceIngestionStateError";
    this.code = code;
  }
}

async function lockOwnedDraftModelIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
): Promise<EvidenceModelHead> {
  const [model] = await tx
    .select({
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
  if (!model) throw new EvidenceIngestionStateError("model_unavailable");
  return {
    stateVersion: model.stateVersion,
    currentPackageSnapshotId: model.currentPackageSnapshotId ?? null,
    identityRevisionId: model.identityRevisionId ?? null,
  };
}

function headsEqual(left: EvidenceModelHead, right: EvidenceModelHead): boolean {
  return (
    left.stateVersion === right.stateVersion
    && left.currentPackageSnapshotId === right.currentPackageSnapshotId
    && left.identityRevisionId === right.identityRevisionId
  );
}

async function planReferencePlate(
  input: PlannedReferencePlate,
): Promise<EvidenceModelHead> {
  return withTransaction(async (tx) => {
    const head = await lockOwnedDraftModelIn(tx, input);
    const inserted = await tx.execute(sql`
      INSERT INTO casting_evidence_ingestions (
        id, userId, modelId, operationId, stepKey, purpose, status, storageKey,
        mime, width, height, byteSize, contentHash
      )
      SELECT
        ${input.ingestionId}, ${input.userId}, ${input.modelId},
        ${input.operationId}, ${input.stepKey}, 'reference_plate', 'planned', ${input.storageKey},
        ${input.image.mime}, ${input.image.width}, ${input.image.height},
        ${input.image.byteSize}, ${input.image.contentHash}
      FROM models
      WHERE models.id = ${input.modelId}
        AND models.userId = ${input.userId}
        AND models.status = 'draft'
        AND models.deletedAt IS NULL
        AND models.stateVersion = ${head.stateVersion}
        AND models.currentPackageSnapshotId <=> ${head.currentPackageSnapshotId}
        AND models.identityRevisionId <=> ${head.identityRevisionId}
    `);
    if (affectedRows(inserted) !== 1) {
      throw new EvidenceIngestionStateError("plan_conflict");
    }
    return head;
  });
}

async function markReferencePlateStored(
  input: PlannedReferencePlate,
): Promise<void> {
  await withTransaction(async (tx) => {
    const updated = await tx
      .update(castingEvidenceIngestions)
      .set({ status: "stored" })
      .where(and(
        eq(castingEvidenceIngestions.id, input.ingestionId),
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.operationId, input.operationId),
        eq(castingEvidenceIngestions.stepKey, input.stepKey),
        eq(castingEvidenceIngestions.purpose, "reference_plate"),
        eq(castingEvidenceIngestions.status, "planned"),
        eq(castingEvidenceIngestions.storageKey, input.storageKey),
        eq(castingEvidenceIngestions.mime, input.image.mime),
        eq(castingEvidenceIngestions.width, input.image.width),
        eq(castingEvidenceIngestions.height, input.image.height),
        eq(castingEvidenceIngestions.byteSize, input.image.byteSize),
        eq(castingEvidenceIngestions.contentHash, input.image.contentHash),
      ));
    if (affectedRows(updated) !== 1) {
      throw new EvidenceIngestionStateError("stored_state_changed");
    }
  });
}

async function attachReferencePlate(
  input: ReferencePlateAttachment,
): Promise<void> {
  await withTransaction(async (tx) => {
    const head = await lockOwnedDraftModelIn(tx, input);
    if (!headsEqual(head, input.expectedHead)) {
      throw new EvidenceIngestionStateError("snapshot_head_changed");
    }

    const [receipt] = await tx
      .select({
        id: castingEvidenceIngestions.id,
        storageKey: castingEvidenceIngestions.storageKey,
        contentHash: castingEvidenceIngestions.contentHash,
      })
      .from(castingEvidenceIngestions)
      .where(and(
        eq(castingEvidenceIngestions.id, input.ingestionId),
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.operationId, input.operationId),
        eq(castingEvidenceIngestions.stepKey, input.stepKey),
        eq(castingEvidenceIngestions.purpose, "reference_plate"),
        eq(castingEvidenceIngestions.status, "stored"),
        eq(castingEvidenceIngestions.storageKey, input.storageKey),
        eq(castingEvidenceIngestions.contentHash, input.image.contentHash),
      ))
      .limit(1)
      .for("update");
    if (!receipt) {
      throw new EvidenceIngestionStateError("stored_state_changed");
    }

    const inserted = await tx.execute(sql`
      INSERT INTO model_reference_plates (
        id, userId, modelId, kind, storageKey, mime, width, height,
        byteSize, contentHash, createdByOperationId, createdByOperationStepKey
      )
      SELECT
        ${input.plateId}, ${input.userId}, ${input.modelId},
        'uploaded_reference', ${input.storageKey}, ${input.image.mime},
        ${input.image.width}, ${input.image.height}, ${input.image.byteSize},
        ${input.image.contentHash}, ${input.operationId}, ${input.stepKey}
      FROM models
      WHERE models.id = ${input.modelId}
        AND models.userId = ${input.userId}
        AND models.status = 'draft'
        AND models.deletedAt IS NULL
        AND models.stateVersion = ${input.expectedHead.stateVersion}
        AND models.currentPackageSnapshotId <=> ${input.expectedHead.currentPackageSnapshotId}
        AND models.identityRevisionId <=> ${input.expectedHead.identityRevisionId}
    `);
    if (affectedRows(inserted) !== 1) {
      throw new EvidenceIngestionStateError("attachment_conflict");
    }

    const attachedAt = new Date();
    const updated = await tx
      .update(castingEvidenceIngestions)
      .set({
        status: "attached",
        attachedEntityKind: "reference_plate",
        attachedEntityId: input.plateId,
        attachedAt,
      })
      .where(and(
        eq(castingEvidenceIngestions.id, input.ingestionId),
        eq(castingEvidenceIngestions.userId, input.userId),
        eq(castingEvidenceIngestions.modelId, input.modelId),
        eq(castingEvidenceIngestions.operationId, input.operationId),
        eq(castingEvidenceIngestions.stepKey, input.stepKey),
        eq(castingEvidenceIngestions.status, "stored"),
        eq(castingEvidenceIngestions.storageKey, input.storageKey),
        eq(castingEvidenceIngestions.contentHash, input.image.contentHash),
      ));
    if (affectedRows(updated) !== 1) {
      throw new EvidenceIngestionStateError("attachment_conflict");
    }
  });
}

export const dbReferencePlateIngestionPersistence:
ReferencePlateIngestionPersistence = {
  planReferencePlate,
  markReferencePlateStored,
  attachReferencePlate,
};
