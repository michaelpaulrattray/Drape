import { describe, expect, it } from "vitest";
import { auditEvidenceOrphans } from "./evidenceOrphanAudit";

const plateId = "11111111-1111-4111-8111-111111111111";
const cropId = "22222222-2222-4222-8222-222222222222";
const plateOperationId = "33333333-3333-4333-8333-333333333333";
const cropOperationId = "44444444-4444-4444-8444-444444444444";

function validState() {
  const plateKey = `users/7/models/9/evidence/plates/${plateId}.webp`;
  const cropKey = `users/7/models/9/evidence/crops/${cropId}.webp`;
  return {
    models: [{ id: 9, userId: 7 }],
    receipts: [
      {
        id: "plate-receipt",
        userId: 7,
        modelId: 9,
        operationId: plateOperationId,
        purpose: "reference_plate" as const,
        status: "attached" as const,
        storageKey: plateKey,
        attachedEntityKind: "reference_plate" as const,
        attachedEntityId: plateId,
        cleanupBatchId: null,
      },
      {
        id: "crop-receipt",
        userId: 7,
        modelId: 9,
        operationId: cropOperationId,
        purpose: "evidence_crop" as const,
        status: "attached" as const,
        storageKey: cropKey,
        attachedEntityKind: "evidence_crop" as const,
        attachedEntityId: cropId,
        cleanupBatchId: null,
      },
    ],
    referencePlates: [{
      id: plateId,
      userId: 7,
      modelId: 9,
      storageKey: plateKey,
      createdByOperationId: plateOperationId,
    }],
    crops: [{
      id: cropId,
      userId: 7,
      modelId: 9,
      plateId,
      storageKey: cropKey,
      createdByOperationId: cropOperationId,
    }],
    cleanupBatches: [],
    cleanupItems: [],
  };
}

describe("R7-7C3 evidence rollback orphan audit", () => {
  it("accepts complete attached plate and crop closure without returning private data", () => {
    const report = auditEvidenceOrphans(validState());
    expect(report).toEqual({
      receipts: 2,
      referencePlates: 1,
      crops: 1,
      invalidKeys: 0,
      keyOwnershipMismatches: 0,
      missingModels: 0,
      modelOwnerMismatches: 0,
      entityReceiptMismatches: 0,
      attachedReceiptMismatches: 0,
      cropPlateMismatches: 0,
      cleanupLinkMismatches: 0,
      outstandingNonAttachedReceipts: 0,
      cleanedReceipts: 0,
      clean: true,
    });
    expect(JSON.stringify(report)).not.toContain("users/7/");
  });

  it("fails closed on malformed ownership, broken closure and outstanding receipt state", () => {
    const state = validState();
    state.models = [];
    state.receipts[0] = {
      ...state.receipts[0],
      status: "stored",
      storageKey: "users/8/models/9/evidence/plates/not-a-uuid.webp",
      attachedEntityKind: null,
      attachedEntityId: null,
    };
    state.crops[0] = { ...state.crops[0], plateId: "missing" };
    const report = auditEvidenceOrphans(state);
    expect(report.clean).toBe(false);
    expect(report.invalidKeys).toBeGreaterThan(0);
    expect(report.missingModels).toBeGreaterThan(0);
    expect(report.entityReceiptMismatches).toBeGreaterThan(0);
    expect(report.cropPlateMismatches).toBe(1);
    expect(report.outstandingNonAttachedReceipts).toBe(1);
  });

  it("requires a cleanup-pending receipt to bind one exact evidence manifest item", () => {
    const state = validState();
    const receipt = state.receipts[0];
    receipt.status = "cleanup_pending";
    receipt.attachedEntityKind = null;
    receipt.attachedEntityId = null;
    receipt.cleanupBatchId = "batch-1";
    state.referencePlates = [];
    state.crops = [];
    state.receipts = [receipt];
    state.cleanupBatches = [{
      id: "batch-1",
      userId: 7,
      operationId: plateOperationId,
      kind: "evidence_cleanup",
    }];
    state.cleanupItems = [{
      batchId: "batch-1",
      storageKey: receipt.storageKey,
    }];
    const linked = auditEvidenceOrphans(state);
    expect(linked.cleanupLinkMismatches).toBe(0);
    expect(linked.outstandingNonAttachedReceipts).toBe(1);
    expect(linked.clean).toBe(false);

    state.cleanupItems[0] = {
      ...state.cleanupItems[0],
      storageKey: `users/7/models/9/evidence/plates/${cropId}.webp`,
    };
    expect(auditEvidenceOrphans(state).cleanupLinkMismatches).toBe(1);
  });
});
