import type { ModelReferencePlateKind } from "../../../drizzle/schema";
import { parseEvidenceStorageKey } from "./evidenceDelivery";
import { type EvidenceStoragePurpose, evidenceKeyKindIsDeclared } from "./evidenceLifecycle";

type EvidencePurpose = "reference_plate" | "evidence_crop";
type EvidenceStatus =
  | "planned"
  | "stored"
  | "attached"
  | "cleanup_pending"
  | "cleaned";

interface EvidenceReceiptAuditRow {
  id: string;
  userId: number;
  modelId: number;
  operationId: string;
  purpose: EvidencePurpose;
  status: EvidenceStatus;
  storageKey: string;
  attachedEntityKind: EvidencePurpose | null;
  attachedEntityId: string | null;
  cleanupBatchId: string | null;
}

interface EvidenceEntityAuditRow {
  id: string;
  userId: number;
  modelId: number;
  storageKey: string;
  createdByOperationId: string;
}

/**
 * A plate carries its own provenance, and the audit needs it (#308).
 *
 * It used to be handed the literal `"reference_plate"` for every plate, which
 * meant a plate key was the only shape it would accept. An `accepted_candidate`
 * plate legitimately names the candidate object it promoted in place, so the
 * whole of production's plate population would have counted as ownership
 * mismatches here.
 */
type ReferencePlateAuditRow = EvidenceEntityAuditRow & { kind: ModelReferencePlateKind };

interface EvidenceCleanupBatchAuditRow {
  id: string;
  userId: number;
  operationId: string;
  kind: string;
}

interface EvidenceCleanupItemAuditRow {
  batchId: string;
  storageKey: string;
  storageBackend: string;
}

interface EvidenceOperationAuditRow {
  id: string;
  userId: number;
  modelId: number | null;
  kind: string;
  subjectDeletedAt: Date | string | null;
}

export interface EvidenceOrphanAuditReport {
  receipts: number;
  referencePlates: number;
  crops: number;
  invalidKeys: number;
  keyOwnershipMismatches: number;
  missingModels: number;
  modelOwnerMismatches: number;
  entityReceiptMismatches: number;
  attachedReceiptMismatches: number;
  cropPlateMismatches: number;
  cleanupLinkMismatches: number;
  outstandingNonAttachedReceipts: number;
  cleanedReceipts: number;
  clean: boolean;
}

/**
 * Pure, counts-only rollback audit. No key, URL, prompt, hash, or customer
 * metadata is returned or logged.
 */
export function auditEvidenceOrphans(input: {
  users: Array<{ id: number }>;
  models: Array<{ id: number; userId: number }>;
  operations: EvidenceOperationAuditRow[];
  receipts: EvidenceReceiptAuditRow[];
  referencePlates: ReferencePlateAuditRow[];
  crops: Array<EvidenceEntityAuditRow & { plateId: string }>;
  cleanupBatches: EvidenceCleanupBatchAuditRow[];
  cleanupItems: EvidenceCleanupItemAuditRow[];
}): EvidenceOrphanAuditReport {
  const userIds = new Set(input.users.map((user) => user.id));
  const modelOwners = new Map(input.models.map((model) => [model.id, model.userId]));
  const operationById = new Map(
    input.operations.map((operation) => [operation.id, operation]),
  );
  const receiptByOperation = new Map(
    input.receipts.map((receipt) => [receipt.operationId, receipt]),
  );
  const receiptByCleanupBatch = new Map(
    input.receipts
      .filter((receipt) => receipt.cleanupBatchId !== null)
      .map((receipt) => [receipt.cleanupBatchId!, receipt]),
  );
  const plateById = new Map(input.referencePlates.map((plate) => [plate.id, plate]));
  const plateByIdAndReceipt = new Map(
    input.referencePlates.map((plate) => [plate.id, receiptByOperation.get(plate.createdByOperationId)]),
  );
  const cropById = new Map(input.crops.map((crop) => [crop.id, crop]));
  const batchesById = new Map(input.cleanupBatches.map((batch) => [batch.id, batch]));
  const itemsByBatch = new Map<string, EvidenceCleanupItemAuditRow[]>();
  for (const item of input.cleanupItems) {
    itemsByBatch.set(item.batchId, [...(itemsByBatch.get(item.batchId) ?? []), item]);
  }

  let invalidKeys = 0;
  let keyOwnershipMismatches = 0;
  let missingModels = 0;
  let modelOwnerMismatches = 0;
  const checkOwnedRow = (
    row: { userId: number; modelId: number; storageKey: string },
    purpose: EvidenceStoragePurpose,
  ) => {
    try {
      const parsed = parseEvidenceStorageKey(row.storageKey);
      if (
        parsed.userId !== row.userId
        || parsed.modelId !== row.modelId
        || !evidenceKeyKindIsDeclared(purpose, parsed.kind)
      ) {
        keyOwnershipMismatches += 1;
      }
    } catch {
      invalidKeys += 1;
    }
    const owner = modelOwners.get(row.modelId);
    if (owner === undefined) missingModels += 1;
    else if (owner !== row.userId) modelOwnerMismatches += 1;
  };
  for (const receipt of input.receipts) checkOwnedRow(receipt, receipt.purpose);
  for (const plate of input.referencePlates) checkOwnedRow(plate, plate.kind);
  for (const crop of input.crops) checkOwnedRow(crop, "evidence_crop");

  let entityReceiptMismatches = 0;
  for (const plate of input.referencePlates) {
    const receipt = receiptByOperation.get(plate.createdByOperationId);
    if (
      !receipt
      || receipt.status !== "attached"
      || receipt.userId !== plate.userId
      || receipt.modelId !== plate.modelId
      || receipt.purpose !== "reference_plate"
      || receipt.storageKey !== plate.storageKey
      || receipt.attachedEntityKind !== "reference_plate"
      || receipt.attachedEntityId !== plate.id
    ) {
      entityReceiptMismatches += 1;
    }
  }
  for (const crop of input.crops) {
    const receipt = receiptByOperation.get(crop.createdByOperationId);
    if (
      !receipt
      || receipt.status !== "attached"
      || receipt.userId !== crop.userId
      || receipt.modelId !== crop.modelId
      || receipt.purpose !== "evidence_crop"
      || receipt.storageKey !== crop.storageKey
      || receipt.attachedEntityKind !== "evidence_crop"
      || receipt.attachedEntityId !== crop.id
    ) {
      entityReceiptMismatches += 1;
    }
  }

  let attachedReceiptMismatches = 0;
  for (const receipt of input.receipts.filter((row) => row.status === "attached")) {
    const entity = receipt.attachedEntityKind === "reference_plate"
      ? plateById.get(receipt.attachedEntityId ?? "")
      : receipt.attachedEntityKind === "evidence_crop"
        ? cropById.get(receipt.attachedEntityId ?? "")
        : undefined;
    if (
      !entity
      || entity.userId !== receipt.userId
      || entity.modelId !== receipt.modelId
      || entity.storageKey !== receipt.storageKey
      || entity.createdByOperationId !== receipt.operationId
    ) {
      attachedReceiptMismatches += 1;
    }
  }

  let cropPlateMismatches = 0;
  for (const crop of input.crops) {
    const plate = plateById.get(crop.plateId);
    const plateReceipt = plateByIdAndReceipt.get(crop.plateId);
    if (
      !plate
      || plate.userId !== crop.userId
      || plate.modelId !== crop.modelId
      || !plateReceipt
      || plateReceipt.status !== "attached"
    ) {
      cropPlateMismatches += 1;
    }
  }

  let cleanupLinkMismatches = 0;
  for (const receipt of input.receipts.filter((row) => row.cleanupBatchId !== null)) {
    const batch = batchesById.get(receipt.cleanupBatchId!);
    const items = itemsByBatch.get(receipt.cleanupBatchId!) ?? [];
    const cleanupOperation = batch
      ? operationById.get(batch.operationId)
      : undefined;
    const operationMatchesReceipt =
      batch?.operationId === receipt.operationId
      || (
        cleanupOperation?.kind === "evidence_plate_discard"
        && cleanupOperation.userId === receipt.userId
        && cleanupOperation.modelId === receipt.modelId
      );
    const manifestMatchesReceipt = receipt.status === "cleaned"
      ? items.length === 0
      : (
        items.length === 1
        && items[0]?.storageKey === receipt.storageKey
        && items[0]?.storageBackend === "private_evidence_r2"
      );
    if (
      !batch
      || batch.kind !== "evidence_cleanup"
      || batch.userId !== receipt.userId
      || !operationMatchesReceipt
      || !manifestMatchesReceipt
    ) {
      cleanupLinkMismatches += 1;
    }
  }
  for (const batch of input.cleanupBatches.filter((row) => row.kind === "evidence_cleanup")) {
    if (receiptByCleanupBatch.has(batch.id)) continue;
    const operation = operationById.get(batch.operationId);
    const retainedItemsBelongToBatchOwner =
      (itemsByBatch.get(batch.id) ?? []).every((item) => {
        if (item.storageBackend !== "private_evidence_r2") return false;
        try {
          return parseEvidenceStorageKey(item.storageKey).userId === batch.userId;
        } catch {
          return false;
        }
      });
    const belongsToDeletedCast =
      operation?.userId === batch.userId
      && operation.subjectDeletedAt !== null;
    const belongsToDeletedAccount = !userIds.has(batch.userId);
    if (
      !retainedItemsBelongToBatchOwner
      || (!belongsToDeletedCast && !belongsToDeletedAccount)
    ) {
      cleanupLinkMismatches += 1;
    }
  }

  const outstandingNonAttachedReceipts = input.receipts.filter((receipt) =>
    receipt.status === "planned"
    || receipt.status === "stored"
    || receipt.status === "cleanup_pending"
  ).length;
  const cleanedReceipts = input.receipts.filter((receipt) => receipt.status === "cleaned").length;
  const discrepancies = [
    invalidKeys,
    keyOwnershipMismatches,
    missingModels,
    modelOwnerMismatches,
    entityReceiptMismatches,
    attachedReceiptMismatches,
    cropPlateMismatches,
    cleanupLinkMismatches,
    outstandingNonAttachedReceipts,
  ];
  return {
    receipts: input.receipts.length,
    referencePlates: input.referencePlates.length,
    crops: input.crops.length,
    invalidKeys,
    keyOwnershipMismatches,
    missingModels,
    modelOwnerMismatches,
    entityReceiptMismatches,
    attachedReceiptMismatches,
    cropPlateMismatches,
    cleanupLinkMismatches,
    outstandingNonAttachedReceipts,
    cleanedReceipts,
    clean: discrepancies.every((count) => count === 0),
  };
}
