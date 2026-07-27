import { createHash, randomUUID } from "node:crypto";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateEvidenceStorageAdapter } from "./casting/evidence/evidenceDelivery";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;
const webp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);
const webpHash = createHash("sha256").update(webp).digest("hex");

describeWithDatabase("R7-7D D2 storage, lifecycle and Fork durability (disposable DB)", () => {
  let connection: Connection;
  let forkEvidenceAwareCast: typeof import("./casting/evidence/evidenceFork").forkEvidenceAwareCast;
  let settleNextCompletedEvidenceForkCleanup:
    typeof import("./casting/evidence/evidenceFork").settleNextCompletedEvidenceForkCleanup;
  let expireNextReadyEvidenceCandidate:
    typeof import("./db/evidenceCandidates").expireNextReadyEvidenceCandidate;
  let settleNextCompletedCandidateCleanup:
    typeof import("./db/evidenceCandidates").settleNextCompletedCandidateCleanup;
  let settleNextCompletedSupersededAttemptCleanup:
    typeof import("./db/evidenceCandidates").settleNextCompletedSupersededAttemptCleanup;
  let prepareInkCandidateGeneration:
    typeof import("./db/inkAddCandidates").prepareInkCandidateGeneration;
  let markInkCandidateAttemptGenerating:
    typeof import("./db/inkAddCandidates").markInkCandidateAttemptGenerating;
  let markInkCandidateAttemptStored:
    typeof import("./db/inkAddCandidates").markInkCandidateAttemptStored;
  let prepareIncludedInkCandidateRetry:
    typeof import("./db/inkAddCandidates").prepareIncludedInkCandidateRetry;
  let completeInkCandidateReady:
    typeof import("./db/inkAddCandidates").completeInkCandidateReady;
  let invalidateInkCandidate:
    typeof import("./db/inkAddCandidates").invalidateInkCandidate;
  let findActiveOwnedInkCandidate:
    typeof import("./db/inkAddCandidates").findActiveOwnedInkCandidate;
  let getUserDailyGenerationCount:
    typeof import("./db/dailyQuota").getUserDailyGenerationCount;
  let readOwnedEvidenceDelivery:
    typeof import("./db/evidenceDelivery").readOwnedEvidenceDelivery;
  let getModelById: typeof import("./db/models").getModelById;
  let getUserModels: typeof import("./db/models").getUserModels;
  let resolveEffectiveCastStateForRead:
    typeof import("./casting/effectiveCastRead").resolveEffectiveCastStateForRead;
  let processNextStorageCleanupBatch:
    typeof import("./casting/storageCleanupWorker").processNextStorageCleanupBatch;
  let commitBeginInkAddIntent:
    typeof import("./db/inkAddIntents").commitBeginInkAddIntent;
  let stageOwnedInkIntentReference:
    typeof import("./casting/evidence/evidenceOperations").stageOwnedInkIntentReference;

  beforeAll(async () => {
    const parsed = new URL(testDatabaseUrl!);
    if (!parsed.pathname.slice(1).startsWith("drape_r7_7d_d2_disposable_")) {
      throw new Error("R7-7D D2 DB tests require the guarded D2 disposable database");
    }
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    ({
      forkEvidenceAwareCast,
      settleNextCompletedEvidenceForkCleanup,
    } = await import("./casting/evidence/evidenceFork"));
    ({
      expireNextReadyEvidenceCandidate,
      settleNextCompletedCandidateCleanup,
      settleNextCompletedSupersededAttemptCleanup,
    } = await import("./db/evidenceCandidates"));
    ({
      prepareInkCandidateGeneration,
      markInkCandidateAttemptGenerating,
      markInkCandidateAttemptStored,
      prepareIncludedInkCandidateRetry,
      completeInkCandidateReady,
      invalidateInkCandidate,
      findActiveOwnedInkCandidate,
    } = await import("./db/inkAddCandidates"));
    ({ getUserDailyGenerationCount } = await import("./db/dailyQuota"));
    ({ readOwnedEvidenceDelivery } = await import("./db/evidenceDelivery"));
    ({ getModelById, getUserModels } = await import("./db/models"));
    ({ resolveEffectiveCastStateForRead } = await import("./casting/effectiveCastRead"));
    ({ processNextStorageCleanupBatch } = await import("./casting/storageCleanupWorker"));
    ({ commitBeginInkAddIntent } = await import("./db/inkAddIntents"));
    ({ stageOwnedInkIntentReference } = await import("./casting/evidence/evidenceOperations"));
  });

  beforeEach(async () => {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "storage_cleanup_items",
      "storage_cleanup_batches",
      "generation_operation_locks",
      "generation_operations",
      "generations",
      "casting_evidence_candidate_attempts",
      "casting_evidence_candidates",
      "model_identity_feature_intents",
      "model_snapshot_feature_selections",
      "model_identity_feature_versions",
      "model_identity_features",
      "model_evidence_crops",
      "model_reference_plates",
      "casting_evidence_ingestions",
      "model_package_snapshot_slots",
      "model_package_snapshots",
      "model_identity_snapshots",
      "model_assets",
      "models",
      "users",
    ]) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }, 60_000);

  afterAll(async () => {
    await connection?.end().catch(() => undefined);
    const db = await (await import("./db/connection")).getDb();
    await (db as { $client?: { end?: () => Promise<void> } } | null)
      ?.$client?.end?.();
    delete process.env.DATABASE_URL;
  });

  async function fixture(
    input: { withFeature?: boolean; status?: "active" | "draft" } = {},
  ) {
    const [user] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'D2 owner', 1, 1)",
      [`r7-d2-${randomUUID()}`],
    );
    const userId = user.insertId;
    const identityId = randomUUID();
    const packageId = randomUUID();
    const [model] = await connection.execute<ResultSetHeader>(
      "INSERT INTO models (userId, name, masterPrompt, technicalSchema, preferences, status, currentPackageSnapshotId, stateVersion) VALUES (?, 'Source', 'identity', JSON_OBJECT(), JSON_OBJECT(), ?, ?, 1)",
      [userId, input.status ?? "active", packageId],
    );
    const modelId = model.insertId;
    const [head] = await connection.execute<ResultSetHeader>(
      "INSERT INTO model_assets (modelId, viewType, storageUrl, storageKey, pointsCost, pinned, provenance) VALUES (?, 'frontClose', ?, ?, 0, 0, JSON_OBJECT('identityRole', 'anchor'))",
      [modelId, "https://public.example/source-head.webp", `users/${userId}/models/${modelId}/source-head.webp`],
    );
    const [full] = await connection.execute<ResultSetHeader>(
      "INSERT INTO model_assets (modelId, viewType, storageUrl, storageKey, pointsCost, pinned) VALUES (?, 'frontFull', ?, ?, 0, 0)",
      [modelId, "https://public.example/source-full.webp", `users/${userId}/models/${modelId}/source-full.webp`],
    );
    await connection.execute(
      "INSERT INTO model_identity_snapshots (id, modelId, sequence, reason, masterPrompt, technicalSchema, preferences, identityText, identityTextHash, anchorAssetId, recipeVersion) VALUES (?, ?, 1, 'create', 'identity', JSON_OBJECT(), JSON_OBJECT(), 'identity', ?, ?, 'd2')",
      [
        identityId,
        modelId,
        createHash("sha256").update("identity").digest("hex"),
        head.insertId,
      ],
    );
    await connection.execute(
      "INSERT INTO model_package_snapshots (id, modelId, identitySnapshotId, sequence, reason) VALUES (?, ?, ?, 1, 'create')",
      [packageId, modelId, identityId],
    );
    await connection.execute(
      "INSERT INTO model_package_snapshot_slots (id, packageSnapshotId, viewAngle, selectedAssetId, compatibility, selectionReason) VALUES (?, ?, 'frontClose', ?, 'current', 'generated'), (?, ?, 'frontFull', ?, 'current', 'generated')",
      [randomUUID(), packageId, head.insertId, randomUUID(), packageId, full.insertId],
    );
    let privateSourceKey: string | null = null;
    if (input.withFeature) {
      const operationId = randomUUID();
      const plateId = randomUUID();
      const featureId = randomUUID();
      const versionId = randomUUID();
      privateSourceKey =
        `users/${userId}/models/${modelId}/evidence/plates/${plateId}.webp`;
      await connection.execute(
        "INSERT INTO model_reference_plates (id, userId, modelId, kind, storageKey, mime, width, height, byteSize, contentHash, createdByOperationId, createdByOperationStepKey) VALUES (?, ?, ?, 'accepted_candidate', ?, 'image/webp', 512, 768, ?, ?, ?, 'accepted')",
        [plateId, userId, modelId, privateSourceKey, webp.length, webpHash, operationId],
      );
      await connection.execute(
        "INSERT INTO model_identity_features (id, modelId, category, createdByOperationId) VALUES (?, ?, 'ink', ?)",
        [featureId, modelId, operationId],
      );
      await connection.execute(
        "INSERT INTO model_identity_feature_versions (id, modelId, featureId, operation, ontologyVersion, zone, surface, side, normalizedDescriptor, sourceAssetId, sourceViewAngle, acceptedCandidatePlateId, recipeVersion, createdByOperationId) VALUES (?, ?, ?, 'present', 'd2', 'upper_torso', 'front', 'center', 'fine-line rose', ?, 'frontFull', ?, 'd2', ?)",
        [versionId, modelId, featureId, full.insertId, plateId, operationId],
      );
      await connection.execute(
        "INSERT INTO model_snapshot_feature_selections (id, modelId, identitySnapshotId, featureId, featureVersionId, selectionReason) VALUES (?, ?, ?, ?, ?, 'accepted')",
        [randomUUID(), modelId, identityId, featureId, versionId],
      );
    }
    return {
      userId,
      modelId,
      identityId,
      packageId,
      headAssetId: head.insertId,
      fullAssetId: full.insertId,
      privateSourceKey,
    };
  }

  async function claimedFork(userId: number, modelId: number) {
    const operationId = randomUUID();
    await connection.execute(
      "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash, status) VALUES (?, ?, ?, 'evidence_fork_copy', ?, ?, 'claimed')",
      [operationId, userId, randomUUID(), modelId, "b".repeat(64)],
    );
    await connection.execute(
      "INSERT INTO generation_operation_locks (lockKey, operationId, kind, expiresAt) VALUES (?, ?, 'evidence_fork_copy', DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
      [`model:${modelId}`, operationId],
    );
    return operationId;
  }

  async function claimedIntentBegin(userId: number, modelId: number) {
    const operationId = randomUUID();
    await connection.execute(
      "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash, status) VALUES (?, ?, ?, 'evidence_intent_begin', ?, ?, 'claimed')",
      [operationId, userId, randomUUID(), modelId, "c".repeat(64)],
    );
    await connection.execute(
      "INSERT INTO generation_operation_locks (lockKey, operationId, kind, expiresAt) VALUES (?, ?, 'evidence_intent_begin', DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
      [`model:${modelId}`, operationId],
    );
    return operationId;
  }

  async function pendingInkIntent(
    source: Awaited<ReturnType<typeof fixture>>,
  ) {
    const operationId = await claimedIntentBegin(source.userId, source.modelId);
    const intentId = randomUUID();
    await commitBeginInkAddIntent({
      userId: source.userId,
      modelId: source.modelId,
      operationId,
      intentId,
      sourceAssetId: source.fullAssetId,
      side: "left",
      normalizedDescriptor: "small black geometric sun",
    });
    return intentId;
  }

  async function runningCandidateOperation(
    source: Awaited<ReturnType<typeof fixture>>,
    kind: "evidence_candidate_generate" | "evidence_candidate_retry",
  ) {
    const operationId = randomUUID();
    await connection.execute(
      "INSERT INTO generation_operations (id, userId, clientRequestId, kind, modelId, payloadHash, status, expectedStateVersion, expectedIdentitySnapshotId, expectedPackageSnapshotId, plannedCredits, phase) VALUES (?, ?, ?, ?, ?, ?, 'running', 1, ?, ?, 350, 'validating')",
      [
        operationId,
        source.userId,
        randomUUID(),
        kind,
        source.modelId,
        "d".repeat(64),
        source.identityId,
        source.packageId,
      ],
    );
    await connection.execute(
      "INSERT INTO generation_operation_locks (lockKey, operationId, kind, expiresAt) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
      [`model:${source.modelId}`, operationId, kind],
    );
    return operationId;
  }

  function passCandidateProbe() {
    return {
      predictedVisibility: "pass" as const,
      identityOutcome: "pass" as const,
      placementOutcome: "pass" as const,
      featureMatchOutcome: "pass" as const,
      poseFramingOutcome: "pass" as const,
      unexpectedInkOutcome: "pass" as const,
      overallOutcome: "pass" as const,
    };
  }

  function privateAdapter(objects: Map<string, Buffer>): PrivateEvidenceStorageAdapter {
    return {
      putCanonical: vi.fn(async (key, bytes) => {
        objects.set(key, Buffer.from(bytes));
        return { key };
      }),
      readCanonical: vi.fn(async ({ key, expectedByteSize }) => {
        const bytes = objects.get(key);
        if (!bytes || bytes.length !== expectedByteSize) throw new Error("missing");
        return {
          key,
          mime: "image/webp" as const,
          byteSize: bytes.length,
          body: {
            async *[Symbol.asyncIterator]() {
              yield bytes;
            },
          },
          abort: vi.fn(),
        };
      }),
      resolveOwnerDelivery: vi.fn(),
      deleteExact: vi.fn(),
      listCanonicalKeys: vi.fn(),
    } as PrivateEvidenceStorageAdapter;
  }

  it("publishes a free independent Fork only after every object and graph copy verifies", async () => {
    const source = await fixture({ withFeature: true });
    const operationId = await claimedFork(source.userId, source.modelId);
    const privateObjects = new Map<string, Buffer>([
      [source.privateSourceKey!, webp],
    ]);
    const publicCopies = new Map<string, Buffer>();
    let workerTickedDuringCopy = false;
    const result = await forkEvidenceAwareCast({
      privateStorage: privateAdapter(privateObjects),
      copyPublic: vi.fn(async ({ destinationKey }) => {
        if (!workerTickedDuringCopy) {
          workerTickedDuringCopy = true;
          await expect(processNextStorageCleanupBatch({
            deleteObject: vi.fn(async () => ({ success: true })),
            deletePrivateObject: vi.fn(async () => ({ success: true })),
          })).resolves.toEqual({
            claimed: false,
            deleted: 0,
            retried: 0,
            failed: 0,
          });
        }
        publicCopies.set(destinationKey, webp);
        return {
          key: destinationKey,
          url: `https://public.example/${destinationKey}`,
          byteSize: webp.length,
          contentHash: webpHash,
          contentType: "image/webp",
        };
      }),
    }, {
      userId: source.userId,
      sourceModelId: source.modelId,
      operationId,
    });

    const [[target]] = await connection.query<RowDataPacket[]>(
      "SELECT status, currentPackageSnapshotId, stateVersion, agencyId, mintedAt FROM models WHERE id = ?",
      [result.modelId],
    );
    expect(target).toMatchObject({
      status: "draft",
      stateVersion: 1,
      agencyId: null,
      mintedAt: null,
    });
    expect(target.currentPackageSnapshotId).toBeTruthy();
    const [targetAssets] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey, pointsCost, pinned FROM model_assets WHERE modelId = ? ORDER BY id",
      [result.modelId],
    );
    expect(targetAssets).toHaveLength(2);
    expect(targetAssets.every((asset) =>
      asset.pointsCost === 0
      && asset.pinned === 0
      && asset.storageKey.includes(`/models/${result.modelId}/fork/${operationId}/`)
    )).toBe(true);
    const [[featureCounts]] = await connection.query<RowDataPacket[]>(
      "SELECT (SELECT COUNT(*) FROM model_identity_features WHERE modelId = ?) AS features, (SELECT COUNT(*) FROM model_identity_feature_versions WHERE modelId = ?) AS versions, (SELECT COUNT(*) FROM model_snapshot_feature_selections WHERE modelId = ?) AS selections, (SELECT COUNT(*) FROM model_reference_plates WHERE modelId = ?) AS plates",
      [result.modelId, result.modelId, result.modelId, result.modelId],
    );
    expect(featureCounts).toEqual({
      features: 1,
      versions: 1,
      selections: 1,
      plates: 1,
    });
    const [[operation]] = await connection.query<RowDataPacket[]>(
      "SELECT status, chargedCredits, refundedCredits FROM generation_operations WHERE id = ?",
      [operationId],
    );
    expect(operation).toEqual({
      status: "succeeded",
      chargedCredits: 0,
      refundedCredits: 0,
    });
    const [cleanup] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM storage_cleanup_batches WHERE operationId = ?",
      [operationId],
    );
    expect(cleanup).toEqual([]);
    expect(workerTickedDuringCopy).toBe(true);
    expect(await getModelById(result.modelId)).toMatchObject({ status: "draft" });
    await expect(resolveEffectiveCastStateForRead({
      userId: source.userId,
      modelId: result.modelId,
    })).resolves.toMatchObject({ status: "current" });

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      await connection.execute(
        "DELETE s FROM model_package_snapshot_slots s JOIN model_package_snapshots p ON p.id = s.packageSnapshotId WHERE p.modelId = ?",
        [source.modelId],
      );
      for (const table of [
        "model_snapshot_feature_selections",
        "model_identity_feature_versions",
        "model_identity_features",
        "model_reference_plates",
        "model_package_snapshots",
        "model_identity_snapshots",
        "model_assets",
      ]) {
        await connection.execute(`DELETE FROM \`${table}\` WHERE modelId = ?`, [source.modelId]);
      }
      await connection.execute("DELETE FROM models WHERE id = ?", [source.modelId]);
    } finally {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }
    await expect(resolveEffectiveCastStateForRead({
      userId: source.userId,
      modelId: result.modelId,
    })).resolves.toMatchObject({ status: "current" });
    expect(Array.from(privateObjects.keys()).some((key) =>
      key.includes(`/models/${result.modelId}/evidence/plates/`)
    )).toBe(true);
  }, 90_000);

  it("keeps failed provisioning invisible and removes it only after exact cleanup succeeds", async () => {
    const source = await fixture();
    const operationId = await claimedFork(source.userId, source.modelId);
    await expect(forkEvidenceAwareCast({
      privateStorage: privateAdapter(new Map()),
      copyPublic: vi.fn(async () => {
        throw new Error("copy unavailable");
      }),
    }, {
      userId: source.userId,
      sourceModelId: source.modelId,
      operationId,
    })).rejects.toMatchObject({ code: "copy_unavailable" });
    const [[child]] = await connection.query<RowDataPacket[]>(
      "SELECT DISTINCT modelId FROM generations WHERE operationId = ?",
      [operationId],
    );
    expect(await getModelById(child.modelId)).toBeNull();
    expect((await getUserModels(source.userId)).map((model) => model.id))
      .not.toContain(child.modelId);
    const [[batch]] = await connection.query<RowDataPacket[]>(
      "SELECT id, expectedCount FROM storage_cleanup_batches WHERE operationId = ?",
      [operationId],
    );
    await connection.execute("DELETE FROM storage_cleanup_items WHERE batchId = ?", [batch.id]);
    await connection.execute(
      "UPDATE storage_cleanup_batches SET status = 'succeeded', deletedCount = expectedCount, failedCount = 0 WHERE id = ?",
      [batch.id],
    );
    await expect(settleNextCompletedEvidenceForkCleanup()).resolves.toEqual({
      operationId,
      modelId: child.modelId,
    });
    const [shells] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM models WHERE id = ?",
      [child.modelId],
    );
    expect(shells).toEqual([]);
  }, 90_000);

  it("delivers only live ready owner candidates and expires/scrubs them through cleanup", async () => {
    const source = await fixture();
    const intentId = randomUUID();
    const candidateId = randomUUID();
    const attemptId = randomUUID();
    const privatePlateId = randomUUID();
    const privateKey =
      `users/${source.userId}/models/${source.modelId}/evidence/candidates/${privatePlateId}.webp`;
    await connection.execute(
      "INSERT INTO model_identity_feature_intents (id, userId, modelId, capabilityKey, activeCapabilityKey, status, category, operation, ontologyVersion, zone, surface, side, normalizedDescriptor, sourceAssetId, expectedStateVersion, identitySnapshotId, packageSnapshotId, createdByOperationId) VALUES (?, ?, ?, 'ink.add.front_upper_torso.v1', 'ink.add.front_upper_torso.v1', 'pending', 'ink', 'add', 'd2', 'upper_torso', 'front', 'center', 'fine-line rose', ?, 1, ?, ?, ?)",
      [intentId, source.userId, source.modelId, source.fullAssetId, source.identityId, source.packageId, randomUUID()],
    );
    await connection.execute(
      "INSERT INTO casting_evidence_candidates (id, userId, modelId, intentId, originatingOperationId, capabilityKey, activeSlot, expectedStateVersion, identitySnapshotId, packageSnapshotId, targetViewAngle, sourceAssetId, status, readyAttemptId, composerRecipeVersion, probeRecipeVersion, expiresAt) VALUES (?, ?, ?, ?, ?, 'ink.add.front_upper_torso.v1', 'active', 1, ?, ?, 'frontFull', ?, 'ready', ?, 'd2', 'd2', DATE_ADD(NOW(), INTERVAL 1 HOUR))",
      [candidateId, source.userId, source.modelId, intentId, randomUUID(), source.identityId, source.packageId, source.fullAssetId, attemptId],
    );
    await connection.execute(
      "INSERT INTO casting_evidence_candidate_attempts (id, candidateId, attemptNumber, status, privatePlateId, privateStorageKey, mime, width, height, byteSize, contentHash, actualImageEngine, composerRecipeVersion, probeModel, probeRecipeVersion, overallOutcome) VALUES (?, ?, 1, 'probe_passed', ?, ?, 'image/webp', 512, 768, ?, ?, 'gemini-pro-image', 'd2', 'probe', 'd2', 'pass')",
      [attemptId, candidateId, privatePlateId, privateKey, webp.length, webpHash],
    );
    await expect(readOwnedEvidenceDelivery({
      userId: source.userId,
      kind: "candidate",
      entityId: candidateId,
    })).resolves.toMatchObject({
      entityId: candidateId,
      storageEntityId: privatePlateId,
      storageKey: privateKey,
    });
    await expect(readOwnedEvidenceDelivery({
      userId: source.userId + 1,
      kind: "candidate",
      entityId: candidateId,
    })).resolves.toBeNull();

    const expiresAt = new Date("2020-01-01T00:00:00.000Z");
    await connection.execute(
      "UPDATE casting_evidence_candidates SET expiresAt = ? WHERE id = ?",
      [expiresAt, candidateId],
    );
    await expect(expireNextReadyEvidenceCandidate({
      now: new Date("2030-01-01T00:00:00.000Z"),
    })).resolves.toMatchObject({ candidateId, cleanupObjects: 1 });
    await expect(readOwnedEvidenceDelivery({
      userId: source.userId,
      kind: "candidate",
      entityId: candidateId,
    })).resolves.toBeNull();
    const [[candidate]] = await connection.query<RowDataPacket[]>(
      "SELECT status, activeSlot, cleanupBatchId FROM casting_evidence_candidates WHERE id = ?",
      [candidateId],
    );
    expect(candidate).toMatchObject({ status: "expired", activeSlot: null });
    await connection.execute(
      "DELETE FROM storage_cleanup_items WHERE batchId = ?",
      [candidate.cleanupBatchId],
    );
    await connection.execute(
      "UPDATE storage_cleanup_batches SET status = 'succeeded', deletedCount = expectedCount, failedCount = 0 WHERE id = ?",
      [candidate.cleanupBatchId],
    );
    await expect(settleNextCompletedCandidateCleanup()).resolves.toEqual({
      candidateId,
      cleanupBatchId: candidate.cleanupBatchId,
    });
    const [[attempt]] = await connection.query<RowDataPacket[]>(
      "SELECT status, privateStorageKey, contentHash, byteSize FROM casting_evidence_candidate_attempts WHERE id = ?",
      [attemptId],
    );
    expect(attempt).toEqual({
      status: "cleaned",
      privateStorageKey: null,
      contentHash: null,
      byteSize: null,
    });
    const [[intent]] = await connection.query<RowDataPacket[]>(
      "SELECT status, normalizedDescriptor FROM model_identity_feature_intents WHERE id = ?",
      [intentId],
    );
    expect(intent).toEqual({ status: "cancelled", normalizedDescriptor: null });
  }, 90_000);

  it("creates one exact-head intent and attaches one owner-scoped private reference", async () => {
    const source = await fixture({ status: "draft" });
    const operationId = await claimedIntentBegin(source.userId, source.modelId);
    const intentId = randomUUID();
    await expect(commitBeginInkAddIntent({
      userId: source.userId,
      modelId: source.modelId,
      operationId,
      intentId,
      sourceAssetId: source.fullAssetId,
      side: "left",
      normalizedDescriptor: "fine-line Gemini twins",
    })).resolves.toEqual({ intentId });

    const [[intent]] = await connection.query<RowDataPacket[]>(
      "SELECT userId, modelId, status, side, normalizedDescriptor, sourceAssetId, expectedStateVersion, identitySnapshotId, packageSnapshotId FROM model_identity_feature_intents WHERE id = ?",
      [intentId],
    );
    expect(intent).toMatchObject({
      userId: source.userId,
      modelId: source.modelId,
      status: "pending",
      side: "left",
      normalizedDescriptor: "fine-line Gemini twins",
      sourceAssetId: source.fullAssetId,
      expectedStateVersion: 1,
      identitySnapshotId: source.identityId,
      packageSnapshotId: source.packageId,
    });
    const [[completed]] = await connection.query<RowDataPacket[]>(
      "SELECT status, result, expectedStateVersion, expectedPackageSnapshotId FROM generation_operations WHERE id = ?",
      [operationId],
    );
    expect(completed.status).toBe("succeeded");
    expect(completed.expectedStateVersion).toBe(1);
    expect(completed.expectedPackageSnapshotId).toBe(source.packageId);
    expect(completed.result).toEqual({ intentId });
    const [[lockCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM generation_operation_locks WHERE operationId = ?",
      [operationId],
    );
    expect(Number(lockCount.count)).toBe(0);

    const png = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 30, g: 30, b: 30, alpha: 1 },
      },
    }).png().toBuffer();
    const objects = new Map<string, Buffer>();
    const delivery = privateAdapter(objects);
    vi.mocked(delivery.resolveOwnerDelivery).mockImplementation(
      async (_userId, key) => {
        const id = key.split("/").at(-1)!.replace(/\.webp$/, "");
        return `/api/evidence/plate/${id}`;
      },
    );
    const imageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const referenceRequestId = randomUUID();
    const reference = await stageOwnedInkIntentReference({ delivery }, {
      userId: source.userId,
      intentId,
      clientRequestId: referenceRequestId,
      imageDataUrl,
    });
    expect(reference.delivery).toBe(`/api/evidence/plate/${reference.plateId}`);
    expect(objects.size).toBe(1);
    const [[plate]] = await connection.query<RowDataPacket[]>(
      "SELECT userId, modelId, featureIntentId, kind, storageKey, contentHash FROM model_reference_plates WHERE id = ?",
      [reference.plateId],
    );
    expect(plate).toMatchObject({
      userId: source.userId,
      modelId: source.modelId,
      featureIntentId: intentId,
      kind: "uploaded_reference",
      contentHash: reference.contentHash,
    });

    await expect(stageOwnedInkIntentReference({ delivery }, {
      userId: source.userId,
      intentId,
      clientRequestId: referenceRequestId,
      imageDataUrl,
    })).resolves.toEqual(reference);
    expect(objects.size).toBe(1);
    await expect(stageOwnedInkIntentReference({ delivery }, {
      userId: source.userId,
      intentId,
      clientRequestId: randomUUID(),
      imageDataUrl,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(stageOwnedInkIntentReference({ delivery }, {
      userId: source.userId + 999,
      intentId,
      clientRequestId: randomUUID(),
      imageDataUrl,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [[plateCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM model_reference_plates WHERE featureIntentId = ?",
      [intentId],
    );
    expect(Number(plateCount.count)).toBe(1);
  }, 90_000);

  it("reserves and publishes one owner-only private candidate from locked snapshot truth", async () => {
    const source = await fixture({ status: "draft" });
    const intentId = await pendingInkIntent(source);
    const operationId = await runningCandidateOperation(
      source,
      "evidence_candidate_generate",
    );
    const prepared = await prepareInkCandidateGeneration({
      userId: source.userId,
      modelId: source.modelId,
      intentId,
      operationId,
      operationKind: "evidence_candidate_generate",
      candidateId: randomUUID(),
      attemptId: randomUUID(),
      privatePlateId: randomUUID(),
    });
    expect(prepared).toMatchObject({
      userId: source.userId,
      modelId: source.modelId,
      operationId,
      intentId,
      attemptNumber: 1,
      sourceAssetId: source.fullAssetId,
      identitySnapshotId: source.identityId,
      packageSnapshotId: source.packageId,
    });
    const [[child]] = await connection.query<RowDataPacket[]>(
      "SELECT status, pointsCost, resultUrl, metadata FROM generations WHERE id = ?",
      [prepared.generationId],
    );
    expect(child).toMatchObject({
      status: "pending",
      pointsCost: 350,
      resultUrl: null,
    });
    expect(child.metadata).toEqual({
      candidateId: prepared.candidateId,
      attemptNumber: 1,
      billingRole: "charged_attempt",
      engine: "gemini-3-pro-image-preview",
      recipeVersion: "ink.add.front_upper_torso.composer.v1",
    });

    await markInkCandidateAttemptGenerating(prepared);
    await markInkCandidateAttemptStored({
      prepared,
      image: {
        mime: "image/webp",
        width: 512,
        height: 768,
        byteSize: webp.length,
        contentHash: webpHash,
      },
    });
    await completeInkCandidateReady({
      prepared,
      probe: passCandidateProbe(),
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    await expect(findActiveOwnedInkCandidate({
      userId: source.userId,
      intentId,
    })).resolves.toMatchObject({
      id: prepared.candidateId,
      status: "ready",
    });
    await expect(findActiveOwnedInkCandidate({
      userId: source.userId + 1,
      intentId,
    })).resolves.toBeNull();
    await expect(readOwnedEvidenceDelivery({
      userId: source.userId,
      kind: "candidate",
      entityId: prepared.candidateId,
    })).resolves.toMatchObject({
      entityId: prepared.candidateId,
      storageEntityId: prepared.privatePlateId,
      storageKey: prepared.privateStorageKey,
    });
    await expect(readOwnedEvidenceDelivery({
      userId: source.userId + 1,
      kind: "candidate",
      entityId: prepared.candidateId,
    })).resolves.toBeNull();
  }, 90_000);

  it("keeps an included retry under one quota unit, scrubs attempt one, and replaces ready atomically", async () => {
    const source = await fixture({ status: "draft" });
    const intentId = await pendingInkIntent(source);
    const operationId = await runningCandidateOperation(
      source,
      "evidence_candidate_generate",
    );
    const first = await prepareInkCandidateGeneration({
      userId: source.userId,
      modelId: source.modelId,
      intentId,
      operationId,
      operationKind: "evidence_candidate_generate",
      candidateId: randomUUID(),
      attemptId: randomUUID(),
      privatePlateId: randomUUID(),
    });
    await markInkCandidateAttemptGenerating(first);
    await markInkCandidateAttemptStored({
      prepared: first,
      image: {
        mime: "image/webp",
        width: 512,
        height: 768,
        byteSize: webp.length,
        contentHash: webpHash,
      },
    });
    const second = await prepareIncludedInkCandidateRetry({
      prepared: first,
      probe: {
        ...passCandidateProbe(),
        placementOutcome: "fail",
        overallOutcome: "fail",
      },
      attemptId: randomUUID(),
      privatePlateId: randomUUID(),
    });
    expect(second.attemptNumber).toBe(2);
    const [children] = await connection.query<RowDataPacket[]>(
      "SELECT status, pointsCost, resultUrl FROM generations WHERE operationId = ? ORDER BY id",
      [operationId],
    );
    expect(children).toEqual([
      { status: "failed", pointsCost: 350, resultUrl: null },
      { status: "pending", pointsCost: 0, resultUrl: null },
    ]);
    await expect(getUserDailyGenerationCount(source.userId)).resolves.toBe(1);

    await markInkCandidateAttemptGenerating(second);
    await markInkCandidateAttemptStored({
      prepared: second,
      image: {
        mime: "image/webp",
        width: 512,
        height: 768,
        byteSize: webp.length,
        contentHash: webpHash,
      },
    });
    await completeInkCandidateReady({
      prepared: second,
      probe: passCandidateProbe(),
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const [[firstAttempt]] = await connection.query<RowDataPacket[]>(
      "SELECT cleanupBatchId FROM casting_evidence_candidate_attempts WHERE id = ?",
      [first.attemptId],
    );
    await connection.execute(
      "DELETE FROM storage_cleanup_items WHERE batchId = ?",
      [firstAttempt.cleanupBatchId],
    );
    await connection.execute(
      "UPDATE storage_cleanup_batches SET status = 'succeeded', deletedCount = expectedCount, failedCount = 0 WHERE id = ?",
      [firstAttempt.cleanupBatchId],
    );
    await expect(settleNextCompletedSupersededAttemptCleanup()).resolves.toEqual({
      candidateId: first.candidateId,
      attemptId: first.attemptId,
      cleanupBatchId: firstAttempt.cleanupBatchId,
    });
    const [[scrubbed]] = await connection.query<RowDataPacket[]>(
      "SELECT status, privateStorageKey, contentHash, byteSize FROM casting_evidence_candidate_attempts WHERE id = ?",
      [first.attemptId],
    );
    expect(scrubbed).toEqual({
      status: "cleaned",
      privateStorageKey: null,
      contentHash: null,
      byteSize: null,
    });
    await connection.execute(
      "DELETE FROM generation_operation_locks WHERE operationId = ?",
      [operationId],
    );
    await connection.execute(
      "UPDATE generation_operations SET status = 'succeeded', chargedCredits = 350, completedAt = NOW() WHERE id = ?",
      [operationId],
    );

    const retryOperationId = await runningCandidateOperation(
      source,
      "evidence_candidate_retry",
    );
    const replacement = await prepareInkCandidateGeneration({
      userId: source.userId,
      modelId: source.modelId,
      intentId,
      operationId: retryOperationId,
      operationKind: "evidence_candidate_retry",
      candidateId: randomUUID(),
      attemptId: randomUUID(),
      privatePlateId: randomUUID(),
    });
    const [candidates] = await connection.query<RowDataPacket[]>(
      "SELECT id, status, activeSlot FROM casting_evidence_candidates WHERE intentId = ? ORDER BY createdAt, id",
      [intentId],
    );
    expect(candidates).toEqual([
      { id: first.candidateId, status: "rejected", activeSlot: null },
      { id: replacement.candidateId, status: "processing", activeSlot: "active" },
    ]);
  }, 90_000);

  it("fails every child attempt and consumes no quota when an included retry aborts", async () => {
    const source = await fixture({ status: "draft" });
    const intentId = await pendingInkIntent(source);
    const operationId = await runningCandidateOperation(
      source,
      "evidence_candidate_generate",
    );
    const first = await prepareInkCandidateGeneration({
      userId: source.userId,
      modelId: source.modelId,
      intentId,
      operationId,
      operationKind: "evidence_candidate_generate",
      candidateId: randomUUID(),
      attemptId: randomUUID(),
      privatePlateId: randomUUID(),
    });
    await markInkCandidateAttemptGenerating(first);
    await markInkCandidateAttemptStored({
      prepared: first,
      image: {
        mime: "image/webp",
        width: 512,
        height: 768,
        byteSize: webp.length,
        contentHash: webpHash,
      },
    });
    const second = await prepareIncludedInkCandidateRetry({
      prepared: first,
      probe: {
        ...passCandidateProbe(),
        placementOutcome: "fail",
        overallOutcome: "fail",
      },
      attemptId: randomUUID(),
      privatePlateId: randomUUID(),
    });
    await markInkCandidateAttemptGenerating(second);

    // The service catch path may still hold attempt one. Invalidation closes
    // the whole candidate episode, not merely the supplied child attempt.
    await invalidateInkCandidate({
      prepared: first,
      publicError: "candidate_failed",
    });

    const [children] = await connection.query<RowDataPacket[]>(
      "SELECT status, resultUrl, completedAt FROM generations WHERE operationId = ? ORDER BY id",
      [operationId],
    );
    expect(children).toHaveLength(2);
    expect(children.every((child) =>
      child.status === "failed"
      && child.resultUrl === null
      && child.completedAt instanceof Date
    )).toBe(true);
    await expect(getUserDailyGenerationCount(source.userId)).resolves.toBe(0);
    const [[candidate]] = await connection.query<RowDataPacket[]>(
      "SELECT status, activeSlot FROM casting_evidence_candidates WHERE id = ?",
      [first.candidateId],
    );
    expect(candidate).toEqual({ status: "invalid", activeSlot: null });
  }, 90_000);

  it("refuses foreign selected assets and already-selected typed features before intent creation", async () => {
    const victim = await fixture({ status: "draft" });
    const attacker = await fixture({ status: "draft" });
    const foreignOperationId = await claimedIntentBegin(
      attacker.userId,
      attacker.modelId,
    );
    await expect(commitBeginInkAddIntent({
      userId: attacker.userId,
      modelId: attacker.modelId,
      operationId: foreignOperationId,
      intentId: randomUUID(),
      sourceAssetId: victim.fullAssetId,
      side: "right",
      normalizedDescriptor: "small black star",
    })).rejects.toMatchObject({ code: "source_unavailable" });
    const [[foreignCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM model_identity_feature_intents WHERE modelId = ?",
      [attacker.modelId],
    );
    expect(Number(foreignCount.count)).toBe(0);

    await connection.execute(
      "DELETE FROM generation_operation_locks WHERE operationId = ?",
      [foreignOperationId],
    );
    const featureId = randomUUID();
    const versionId = randomUUID();
    const featureOperationId = randomUUID();
    await connection.execute(
      "INSERT INTO model_identity_features (id, modelId, category, createdByOperationId) VALUES (?, ?, 'ink', ?)",
      [featureId, attacker.modelId, featureOperationId],
    );
    await connection.execute(
      "INSERT INTO model_identity_feature_versions (id, modelId, featureId, operation, ontologyVersion, zone, surface, side, normalizedDescriptor, sourceAssetId, sourceViewAngle, acceptedCandidatePlateId, recipeVersion, createdByOperationId) VALUES (?, ?, ?, 'present', 'd4a', 'front_upper_torso', 'anterior', 'left', 'existing star', ?, 'frontFull', ?, 'd4a', ?)",
      [
        versionId,
        attacker.modelId,
        featureId,
        attacker.fullAssetId,
        randomUUID(),
        featureOperationId,
      ],
    );
    await connection.execute(
      "INSERT INTO model_snapshot_feature_selections (id, modelId, identitySnapshotId, featureId, featureVersionId, selectionReason) VALUES (?, ?, ?, ?, ?, 'accepted')",
      [
        randomUUID(),
        attacker.modelId,
        attacker.identityId,
        featureId,
        versionId,
      ],
    );
    const featureBlockedOperationId = await claimedIntentBegin(
      attacker.userId,
      attacker.modelId,
    );
    await expect(commitBeginInkAddIntent({
      userId: attacker.userId,
      modelId: attacker.modelId,
      operationId: featureBlockedOperationId,
      intentId: randomUUID(),
      sourceAssetId: attacker.fullAssetId,
      side: "right",
      normalizedDescriptor: "small black star",
    })).rejects.toMatchObject({ code: "feature_already_selected" });
    const [[featureBlockedCount]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM model_identity_feature_intents WHERE modelId = ?",
      [attacker.modelId],
    );
    expect(Number(featureBlockedCount.count)).toBe(0);
  }, 90_000);
});
