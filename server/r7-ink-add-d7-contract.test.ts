import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("R7-7D D7 product-ready and evidence-aware Fork contract", () => {
  it("opens only the compile-time product door while runtime scope still defaults off", async () => {
    const [scope, env] = await Promise.all([
      source("./casting/evidence/evidenceComposerScope.ts"),
      source("./_core/env.ts"),
    ]);
    expect(scope).toContain("INK_ADD_PRODUCT_READY = true as const");
    expect(scope).toContain(
      'if (raw === undefined || raw === "" || raw === "off") return { kind: "off" }',
    );
    expect(scope).toContain("INK_ADD_PRODUCT_READY\n    &&");
    expect(env).toContain(
      "productReady: EVIDENCE_PRODUCT_DELIVERY_READY && INK_ADD_PRODUCT_READY",
    );
  });

  it("routes Fork through the free claimed evidence-copy operation, not the paid recast executor", async () => {
    const route = await source("./routes/boardOps.ts");
    const forkStart = route.indexOf('if (input.decision === "fork")');
    const recastStart = route.indexOf("return executeCanvasOperation<CanvasRecastResult>");
    expect(forkStart).toBeGreaterThan(0);
    expect(recastStart).toBeGreaterThan(forkStart);
    const fork = route.slice(forkStart, recastStart);
    expect(fork).toContain('kind: "evidence_fork_copy"');
    expect(fork).toContain("forkEvidenceAwareCast(");
    expect(fork).toContain("productionEvidenceForkDependencies(privateStorage)");
    expect(fork).not.toContain("if (!privateStorage)");
    expect(fork).not.toContain("changes:");
    expect(fork).not.toContain("intent:");
    expect(fork).toContain("bootstrapModelSnapshot");
    expect(fork).toContain("modelOperationLockKey(model.id)");
    expect(fork).not.toMatch(
      /markGenerationOperationRunning|deductPoints|recordRefund|generateCastingImage/,
    );
    expect(route.slice(recastStart)).toContain('kind: "canvas.recast"');
  });

  it("commits copy publication, Canvas placement, lineage, and the landed receipt together", async () => {
    const [fork, boards, operations, recovery] = await Promise.all([
      source("./casting/evidence/evidenceFork.ts"),
      source("./db/boards.ts"),
      source("./db/generationOperations.ts"),
      source("./casting/operationRecovery.ts"),
    ]);
    expect(fork).toContain("placeEvidenceForkOnBoardIn(tx");
    expect(fork).toContain("finalizeClaimedGenerationOperationSuccessIn(tx");
    expect(fork).toContain("getGenerationOperationOutcome(");
    expect(fork).toContain('durableOutcome?.type === "replay_success"');
    expect(fork).toContain('status: "landed" as const');
    expect(fork).toContain("landedItemId: placementResult.newItemId");
    expect(fork).toContain('status: "draft"');
    expect(fork).toContain("removedBatch");
    expect(fork).toContain("prepared.privateObjects.length > 0 && !dependencies.privateStorage");
    expect(fork).toContain("markClaimedGenerationOperationRecoveryRequired");
    expect(boards).toContain("placeEvidenceForkOnBoardIn");
    expect(boards).toContain("eq(boards.userId, input.userId)");
    expect(boards).toContain("eq(boardItems.sourceModelId, input.sourceModelId)");
    expect(boards).toContain("isNull(boardItems.deletedAt)");
    expect(boards).toContain("tx.insert(boardItemVersions)");
    expect(boards).toContain("tx.insert(boardEdges)");
    expect(boards).toContain('relation: "forked_from"');
    expect(operations).toContain("landingStatus: input.landing.status");
    expect(operations).toContain(
      "landingAcknowledgedAt: input.landing.acknowledgedAt ?? null",
    );
    expect(recovery).toContain('evidence_fork_copy: "evidence_fork"');
    expect(recovery).toContain('recoveryStrategy === "evidence_fork"');
    expect(recovery).toContain('operation.status === "claimed"');
    expect(recovery).toContain("finalizeClaimedGenerationOperationFailure");
  });

  it("removes the old paid Fork executor and prices the product meaning truthfully", async () => {
    const [lib, popover, dialog, cost, projection, board, workspace, takeover] = await Promise.all([
      source("./lib/boardOps.ts"),
      source("../client/src/features/boards/canvas/ForkRecastPopover.tsx"),
      source("../client/src/features/studio/takeover/IdentityChangeDialog.tsx"),
      source("../client/src/features/boards/canvas/CostLabel.tsx"),
      source("../client/src/features/operations/generationOperationProjection.ts"),
      source("../client/src/features/boards/BoardPage.tsx"),
      source("../client/src/features/studio/components/CastingWorkspace.tsx"),
      source("../client/src/features/studio/takeover/CastingTakeover.tsx"),
    ]);
    expect(lib).toContain("forkCreditCost: 0");
    expect(lib).toContain("Fork is handled by the free exact-copy service.");
    expect(lib).not.toContain("Identity fork (pending)");
    expect(lib).not.toContain("generateCastCandidate({\n      userId: input.userId, prefs: merged");
    expect(popover).toContain('title="Fork to edit"');
    expect(popover).toContain("Create an independent editable copy");
    expect(dialog).toContain("The complete selected package and private evidence are copied");
    expect(dialog).toContain("edits still filled in");
    expect(cost).toContain('credits === 0 ? "Free"');
    expect(projection).toContain('"evidence_fork_copy": 8_000');
    expect(board).toContain("initialPreferenceOverrides: changes");
    expect(board).toContain("setCastEditContext((current) => current ??");
    expect(workspace).toContain("initialPreferenceOverridesRef");
    expect(workspace).toContain("mergeCastingPreferenceChanges");
    expect(workspace).toContain("delete engineChoice[field]");
    expect(takeover).toContain("draftUnsavedDiff");
    expect(takeover).toContain("Leaving discards those changes.");
  });

  it("has exactly one production caller and keeps the copy module provider-, credit-, and quota-free", async () => {
    const [route, fork, quota, serverMerge] = await Promise.all([
      source("./routes/boardOps.ts"),
      source("./casting/evidence/evidenceFork.ts"),
      source("./db/dailyQuota.ts"),
      source("./lib/boardOps.ts"),
    ]);
    expect(route.match(/forkEvidenceAwareCast\(/g)).toHaveLength(1);
    expect(fork).not.toMatch(
      /deductPoints|addCredits|recordRefund|generateCastingImage|generateContent/,
    );
    expect(quota).toContain("leftJoin(");
    expect(quota).toContain("generationOperations.kind");
    expect(quota).toContain("'evidence_fork_copy'");
    expect(quota).toContain("THEN NULL");
    expect(serverMerge).toContain("mergeCastingPreferenceChanges(current, changes)");
  });
});
