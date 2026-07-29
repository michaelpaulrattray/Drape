import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("R7-7D D4B candidate generation contract", () => {
  it("keeps generation scope-gated, owner-derived, strict, and client-inert", async () => {
    const [scope, route, client] = await Promise.all([
      source("./casting/evidence/evidenceComposerScope.ts"),
      source("./routes/evidence.ts"),
      source("../client/src/features/studio/components/CastingWorkspace.tsx"),
    ]);
    expect(scope).toContain("INK_ADD_PRODUCT_READY = true");
    expect(route).toContain("generateInkAddCandidate: protectedProcedure");
    expect(route).toContain("retryInkAddCandidate: protectedProcedure");
    expect(route.match(/\.input\(z\.object\(\{/g)?.length).toBe(
      route.match(/\.strict\(\)/g)?.length,
    );
    expect(route).not.toContain(".passthrough()");
    expect(route).toContain("userId: ctx.user.id");
    expect(route).not.toMatch(
      /userId:\s*z\.|ownerId:\s*z\.|operationId:\s*z\.|storageKey:\s*z\.|engine:\s*z\./,
    );
    expect(client).not.toMatch(
      /generateInkAddCandidate|retryInkAddCandidate|cancelInkAddIntent/,
    );
  });

  it("reserves one server-owned episode under model and operation locks", async () => {
    const db = await source("./db/inkAddCandidates.ts");
    const prepare = db.indexOf("export async function prepareInkCandidateGeneration");
    const modelLock = db.indexOf("lockOwnedDraftModelIn(tx, input)", prepare);
    const operationLock = db.indexOf("lockRunningOperationIn(", prepare);
    const snapshotRead = db.indexOf("readSnapshotShadowStateIn(tx, input)", prepare);
    const candidateInsert = db.indexOf(
      "await tx.insert(castingEvidenceCandidates)",
      prepare,
    );
    const attemptInsert = db.indexOf(
      "await createAttemptIn(tx",
      candidateInsert,
    );
    expect(modelLock).toBeGreaterThan(prepare);
    expect(operationLock).toBeGreaterThan(modelLock);
    expect(snapshotRead).toBeGreaterThan(operationLock);
    expect(candidateInsert).toBeGreaterThan(snapshotRead);
    expect(attemptInsert).toBeGreaterThan(candidateInsert);
    expect(db).toContain("assertOperationHead(operation");
    expect(db).toContain("feature_already_selected");
    expect(db).toContain('activeSlot: "active"');
    expect(db).toContain(
      "pointsCost: input.attemptNumber === 1 ? input.priceCredits : 0",
    );
    expect(db).toContain("resultUrl: null");
    expect(db).not.toMatch(/deductPoints|refundPoints|generateContent|storagePut/);
  });

  it("replays only an exact server-owned intent claim", async () => {
    const [service, operations, intents] = await Promise.all([
      source("./casting/evidence/inkCandidateGeneration.ts"),
      source("./db/generationOperations.ts"),
      source("./db/inkAddIntents.ts"),
    ]);
    expect(service).toContain("findOwnedInkIntentClaimSubject");
    expect(service).toContain(
      "dependencies.getOutcomeByClaim ?? getGenerationOperationOutcomeByClaim",
    );
    expect(service).toContain("modelId: claimSubject.modelId");
    expect(service).toContain("payload: { intentId: input.intentId }");
    expect(operations).toContain(
      "operation.kind !== input.kind || operation.payloadHash !== payloadHash",
    );
    expect(intents).toContain("findOwnedInkIntentClaimSubject");
    expect(intents).toContain("eq(models.userId, input.userId)");
  });

  it("keeps visibility free and wraps both deterministic attempts in one charge", async () => {
    const service = await source(
      "./casting/evidence/inkCandidateGeneration.ts",
    );
    const attemptStart = service.indexOf("async function runAttempt");
    const executeStart = service.indexOf("async function executeCandidate");
    const projectionStart = service.indexOf(
      "async function executeProjectionCandidate",
    );
    const attempt = service.slice(attemptStart, executeStart);
    const execute = service.slice(executeStart, projectionStart);
    const quota = execute.indexOf(
      "dependencies.enforceQuota ?? enforceDailyQuota",
    );
    const begin = execute.indexOf("const begin = dependencies.begin");
    const visibility = execute.indexOf(
      'const visibility = prepared.authority.kind === "legacy_v1"',
    );
    const charge = execute.indexOf("const charge = dependencies.charge");
    const firstAttempt = execute.indexOf("let outcome = await runAttempt({");
    const receiptSuccess = execute.indexOf(
      "dependencies.completeSuccess ?? completeDirectOperationSuccess",
    );
    const durableReady = attempt.indexOf(
      "dependencies.completeReady ?? completeInkCandidateReady",
    );
    const includedRetry = attempt.indexOf(
      "dependencies.prepareIncludedRetry ?? prepareIncludedInkCandidateRetry",
    );
    expect(quota).toBeGreaterThan(-1);
    expect(begin).toBeGreaterThan(quota);
    expect(visibility).toBeGreaterThan(begin);
    expect(charge).toBeGreaterThan(visibility);
    expect(firstAttempt).toBeGreaterThan(charge);
    expect(includedRetry).toBeGreaterThan(durableReady);
    expect(durableReady).toBeGreaterThan(-1);
    expect(receiptSuccess).toBeGreaterThan(firstAttempt);
    expect(execute.match(/await runAttempt\(\{/g)).toHaveLength(2);
    expect(service).toContain("chargedCredits: INK_ADD_PRICE_CREDITS");
    expect(service).not.toContain("verifyViewIdentity");
  });

  it("records, verifies, and privately delivers the exact candidate object", async () => {
    const [service, delivery, db] = await Promise.all([
      source("./casting/evidence/inkCandidateGeneration.ts"),
      source("./casting/evidence/evidenceDelivery.ts"),
      source("./db/inkAddCandidates.ts"),
    ]);
    const attemptStart = service.indexOf("async function runAttempt");
    const executeStart = service.indexOf("async function executeCandidate");
    const attempt = service.slice(attemptStart, executeStart);
    const generating = attempt.indexOf(
      "dependencies.markGenerating ?? markInkCandidateAttemptGenerating",
    );
    const put = attempt.indexOf("await putCanonicalEvidence");
    const verify = attempt.indexOf("await readPrivateExact");
    const stored = attempt.indexOf(
      "dependencies.markStored ?? markInkCandidateAttemptStored",
    );
    expect(generating).toBeGreaterThan(-1);
    expect(put).toBeGreaterThan(generating);
    expect(verify).toBeGreaterThan(put);
    expect(stored).toBeGreaterThan(verify);
    expect(attempt).toContain("readPrivateExact(dependencies.delivery");
    expect(service).toContain("adapter.readCanonical");
    expect(service).not.toContain("err: error");
    expect(delivery).toContain('kind: "candidate"');
    expect(db).toContain("privateStorageKey");
    expect(db).toContain("contentHash");
    expect(db).toContain("readyAttemptId");
  });

  it("counts an included retry once and scrubs superseded private metadata", async () => {
    const [quota, db, lifecycle, worker] = await Promise.all([
      source("./db/dailyQuota.ts"),
      source("./db/inkAddCandidates.ts"),
      source("./db/evidenceCandidates.ts"),
      source("./casting/storageCleanupWorker.ts"),
    ]);
    expect(quota).toContain("COUNT(DISTINCT CASE");
    expect(quota).toContain("CONCAT('operation:'");
    expect(db).toContain("prepareIncludedInkCandidateRetry");
    expect(db).toContain('status: "cleanup_pending"');
    expect(lifecycle).toContain(
      "settleNextCompletedSupersededAttemptCleanup",
    );
    expect(lifecycle).toContain('status: "cleaned"');
    expect(lifecycle).toContain("privateStorageKey: null");
    expect(worker).toContain(
      "await settleNextCompletedSupersededAttemptCleanup()",
    );
  });
});
