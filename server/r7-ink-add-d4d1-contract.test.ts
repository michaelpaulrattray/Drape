import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("R7-7D D4D1 cancellation and retry-cleanup contract", () => {
  it("keeps Cancel scope-gated, strict, owner-derived, free, and client-inert", async () => {
    const [scope, route, service, client] = await Promise.all([
      source("./casting/evidence/evidenceComposerScope.ts"),
      source("./routes/evidence.ts"),
      source("./casting/evidence/inkIntentCancellation.ts"),
      source("../client/src/features/studio/components/CastingWorkspace.tsx"),
    ]);
    expect(scope).toContain("INK_ADD_PRODUCT_READY = true");
    expect(route).toContain("cancelInkAddIntent: protectedProcedure");
    expect(route).toContain("intentId: z.string().uuid()");
    expect(route).toContain("clientRequestId: z.string().uuid()");
    expect(route).toContain("userId: ctx.user.id");
    expect(route).not.toMatch(
      /userId:\s*z\.|ownerId:\s*z\.|modelId:\s*z\.[\s\S]{0,180}cancelInkAddIntent/,
    );
    expect(service).toContain("plannedCredits: 0");
    expect(service).toContain("chargedCredits: 0");
    expect(service).toContain("refundedCredits: 0");
    expect(service).not.toMatch(
      /deductPoints|refundPoints|generateContent|storagePut|storageDelete/,
    );
    expect(client).not.toContain("cancelInkAddIntent");
  });

  it("locks model, operation, exact lock, candidate, intent, attempts, and reference before cleanup authority", async () => {
    const db = await source("./db/inkAddCancellation.ts");
    const start = db.indexOf("export async function commitCancelInkAddIntent");
    const modelLock = db.indexOf(".from(models)", start);
    const operationLock = db.indexOf(".from(generationOperations)", modelLock);
    const exactLock = db.indexOf(".from(generationOperationLocks)", operationLock);
    const candidateLock = db.indexOf(".from(castingEvidenceCandidates)", exactLock);
    const intentLock = db.indexOf(".from(modelIdentityFeatureIntents)", candidateLock);
    const attemptLock = db.indexOf(".from(castingEvidenceCandidateAttempts)", intentLock);
    const referenceLock = db.indexOf(".from(modelReferencePlates)", attemptLock);
    const manifest = db.indexOf("createStorageCleanupManifestIn(tx", referenceLock);
    const referenceDelete = db.indexOf(
      ".delete(modelReferencePlates)",
      manifest,
    );
    const finalizer = db.indexOf(
      "finalizeRunningGenerationOperationSuccessIn(tx",
      referenceDelete,
    );
    expect(modelLock).toBeGreaterThan(start);
    expect(operationLock).toBeGreaterThan(modelLock);
    expect(exactLock).toBeGreaterThan(operationLock);
    expect(candidateLock).toBeGreaterThan(exactLock);
    expect(intentLock).toBeGreaterThan(candidateLock);
    expect(attemptLock).toBeGreaterThan(intentLock);
    expect(referenceLock).toBeGreaterThan(attemptLock);
    expect(manifest).toBeGreaterThan(referenceLock);
    expect(referenceDelete).toBeGreaterThan(manifest);
    expect(finalizer).toBeGreaterThan(referenceDelete);
    expect(db).toContain("parseEvidenceStorageKey");
    expect(db).toContain("parseInkCandidatePublicStorageKey");
    expect(db).toContain('storageBackend: "private_evidence_r2"');
    expect(db).toContain('storageBackend: "public_r2"');
    expect(db).toContain('status: "cancelled"');
    expect(db).toContain("activeCapabilityKey: null");
    expect(db).not.toMatch(
      /deductPoints|refundPoints|generateContent|storagePut|storageDelete/,
    );
  });

  it("reuses a failed Accept reservation only after exact public cleanup is settled", async () => {
    const [acceptance, publicStorage, candidates] = await Promise.all([
      source("./db/inkAddAcceptance.ts"),
      source("./casting/evidence/inkCandidatePublicStorage.ts"),
      source("./db/inkAddCandidates.ts"),
    ]);
    expect(publicStorage).toContain(
      "users/${input.userId}/models/${input.modelId}/generated/ink/${input.candidateId}/${input.operationId}.webp",
    );
    expect(acceptance).toContain("parseInkCandidatePublicStorageKey");
    expect(acceptance).toContain(
      'eq(generationOperations.kind, "evidence_candidate_accept")',
    );
    expect(acceptance).toContain(
      'eq(generationOperations.status, "failed")',
    );
    expect(acceptance).toContain(
      'eq(storageCleanupItems.storageBackend, "public_r2")',
    );
    expect(acceptance).toContain('cleanup.status !== "succeeded"');
    expect(acceptance).toContain(
      "cleanup.expectedCount !== cleanup.deletedCount",
    );
    expect(acceptance).toContain("cleanup.failedCount !== 0");
    expect(candidates).toContain("attempt.promotedPublicStorageKey");
    expect(candidates).toContain('storageBackend: "public_r2"');
  });

  it("scrubs cancelled intent-only evidence only after its exact cleanup succeeds", async () => {
    const [lifecycle, worker] = await Promise.all([
      source("./db/evidenceCandidates.ts"),
      source("./casting/storageCleanupWorker.ts"),
    ]);
    expect(lifecycle).toContain("settleNextCompletedIntentOnlyCleanup");
    expect(lifecycle).toContain(
      "storageCleanupBatches.operationId,\n          modelIdentityFeatureIntents.resolvedByOperationId",
    );
    expect(lifecycle).toContain(
      'eq(storageCleanupBatches.status, "succeeded")',
    );
    expect(lifecycle).toContain("notExists(");
    expect(lifecycle).toContain("normalizedDescriptor: null");
    expect(worker.match(
      /await settleNextCompletedIntentOnlyCleanup\(\)/g,
    )).toHaveLength(2);
  });
});
