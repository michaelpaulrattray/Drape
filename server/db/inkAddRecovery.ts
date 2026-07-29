import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  generationOperationLocks,
  generationOperations,
  generations,
  modelAssets,
  modelIdentityFeatureIntents,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelPackageSnapshots,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
  storageCleanupBatches,
  type GenerationOperation,
} from "../../drizzle/schema";
import {
  INK_ADD_PRICE_CREDITS,
} from "../casting/evidence/evidenceCandidateContract";
import { parseEvidenceStorageKey } from "../casting/evidence/evidenceDelivery";
import { parseInkCandidatePublicStorageKey } from "../casting/evidence/inkCandidatePublicStorage";
import { availableModelWhere } from "../casting/modelAvailability";
import { modelOperationLockKey } from "../casting/operationContract";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { withTransaction } from "./connection";

const RECOVERY_FAILURE =
  "The tattoo preview stopped before it was ready. Any charged credits were refunded.";
const ACCEPT_RECOVERY_FAILURE =
  "The tattoo preview was not accepted. Your Cast was not changed.";
const CANCEL_RECOVERY_FAILURE =
  "The tattoo request could not be cancelled. Your Cast was not changed.";

export type InkEvidenceRecoveryDecision =
  | {
      type: "durable_success";
      result: Record<string, unknown>;
      chargedCredits: number;
      refundedCredits: number;
    }
  | {
      type: "terminal_failure";
      errorCode: "TIMEOUT" | "INTERNAL_SERVER_ERROR";
      publicMessage: string;
      chargedCredits: number;
      needsRefund: boolean;
    }
  | {
      type: "recovery_required";
    };

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown } | undefined)?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function isCandidateGenerationKind(
  kind: string,
): kind is "evidence_candidate_generate" | "evidence_candidate_retry" {
  return kind === "evidence_candidate_generate"
    || kind === "evidence_candidate_retry";
}

function assertPrivateAttemptKey(input: {
  key: string;
  userId: number;
  modelId: number;
  privatePlateId: string;
}): void {
  const parsed = parseEvidenceStorageKey(input.key);
  if (
    parsed.userId !== input.userId
    || parsed.modelId !== input.modelId
    || parsed.kind !== "candidate"
    || parsed.entityId !== input.privatePlateId
  ) {
    throw new Error("Evidence candidate recovery found an invalid private key");
  }
}

function assertPublicAttemptKey(input: {
  key: string;
  userId: number;
  modelId: number;
  candidateId: string;
}): void {
  const parsed = parseInkCandidatePublicStorageKey(input.key);
  if (
    parsed.userId !== input.userId
    || parsed.modelId !== input.modelId
    || parsed.candidateId !== input.candidateId
  ) {
    throw new Error("Evidence candidate recovery found an invalid public key");
  }
}

/**
 * Candidate-aware stale adjudication. This deliberately derives product truth
 * from the durable candidate graph, never from object-store existence and
 * never from the number of internal attempt children.
 */
export async function adjudicateStaleInkEvidenceOperation(input: {
  operation: GenerationOperation;
  chargedCredits: number;
  refundedCredits: number;
  now: Date;
}): Promise<InkEvidenceRecoveryDecision | null> {
  const { operation } = input;
  if (
    !isCandidateGenerationKind(operation.kind)
    && operation.kind !== "evidence_candidate_accept"
    && operation.kind !== "evidence_candidate_cancel"
  ) {
    return null;
  }
  if (!operation.modelId || operation.status !== "running") {
    return { type: "recovery_required" };
  }
  const modelId = operation.modelId;

  return withTransaction(async (tx): Promise<InkEvidenceRecoveryDecision> => {
    const [model] = await tx
      .select()
      .from(models)
      .where(and(
        eq(models.id, modelId),
        eq(models.userId, operation.userId),
        availableModelWhere(),
        eq(models.status, "draft"),
      ))
      .limit(1)
      .for("update");
    if (!model) return { type: "recovery_required" };
    const [lockedOperation] = await tx
      .select()
      .from(generationOperations)
      .where(and(
        eq(generationOperations.id, operation.id),
        eq(generationOperations.userId, operation.userId),
        eq(generationOperations.modelId, modelId),
        eq(generationOperations.kind, operation.kind),
        eq(generationOperations.status, "running"),
      ))
      .limit(1)
      .for("update");
    if (!lockedOperation) return { type: "recovery_required" };
    const [operationLock] = await tx
      .select({ operationId: generationOperationLocks.operationId })
      .from(generationOperationLocks)
      .where(and(
        eq(generationOperationLocks.lockKey, modelOperationLockKey(modelId)),
        eq(generationOperationLocks.operationId, operation.id),
        eq(generationOperationLocks.kind, operation.kind),
      ))
      .limit(1)
      .for("update");
    if (!operationLock) return { type: "recovery_required" };

    if (isCandidateGenerationKind(operation.kind)) {
      const [candidate] = await tx
        .select()
        .from(castingEvidenceCandidates)
        .where(and(
          eq(castingEvidenceCandidates.originatingOperationId, operation.id),
          eq(castingEvidenceCandidates.userId, operation.userId),
          eq(castingEvidenceCandidates.modelId, modelId),
        ))
        .limit(1)
        .for("update");
      if (!candidate) {
        return input.chargedCredits === 0
          ? {
              type: "terminal_failure",
              errorCode: "TIMEOUT",
              publicMessage: "The tattoo preview stopped before generation began. Nothing was charged.",
              chargedCredits: 0,
              needsRefund: false,
            }
          : { type: "recovery_required" };
      }
      const [intent] = await tx
        .select()
        .from(modelIdentityFeatureIntents)
        .where(and(
          eq(modelIdentityFeatureIntents.id, candidate.intentId),
          eq(modelIdentityFeatureIntents.userId, operation.userId),
          eq(modelIdentityFeatureIntents.modelId, modelId),
        ))
        .limit(1)
        .for("update");
      const attempts = await tx
        .select()
        .from(castingEvidenceCandidateAttempts)
        .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id))
        .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
        .for("update");
      const generationIds = attempts
        .map((attempt) => attempt.generationId)
        .filter((id): id is number => id !== null);
      const children = generationIds.length > 0
        ? await tx
          .select()
          .from(generations)
          .where(and(
            eq(generations.operationId, operation.id),
            inArray(generations.id, generationIds),
          ))
          .for("update")
        : [];
      if (!intent || attempts.length === 0 || children.length !== generationIds.length) {
        return { type: "recovery_required" };
      }
      for (const attempt of attempts) {
        if (attempt.privateStorageKey) {
          assertPrivateAttemptKey({
            key: attempt.privateStorageKey,
            userId: operation.userId,
            modelId,
            privatePlateId: attempt.privatePlateId,
          });
        }
        if (attempt.promotedPublicStorageKey) {
          assertPublicAttemptKey({
            key: attempt.promotedPublicStorageKey,
            userId: operation.userId,
            modelId,
            candidateId: candidate.id,
          });
        }
      }
      const readyAttempt = candidate.readyAttemptId
        ? attempts.find((attempt) => attempt.id === candidate.readyAttemptId)
        : null;
      const hasDurableReadyBoundary = !!readyAttempt
        && readyAttempt.overallOutcome === "pass"
        && (
          readyAttempt.status === "probe_passed"
          || readyAttempt.status === "promoted"
          || readyAttempt.status === "cleanup_pending"
          || readyAttempt.status === "cleaned"
        )
        && !!readyAttempt.privateStorageKey
        && !!readyAttempt.contentHash
        && !!readyAttempt.byteSize
        && !!candidate.expiresAt;
      if (hasDurableReadyBoundary) {
        if (
          input.chargedCredits !== INK_ADD_PRICE_CREDITS
          || input.refundedCredits !== 0
        ) {
          return { type: "recovery_required" };
        }
        return {
          type: "durable_success",
          result: {
            candidateId: candidate.id,
            status: "ready",
            expiresAt: candidate.expiresAt!.toISOString(),
            chargedCredits: INK_ADD_PRICE_CREDITS,
          },
          chargedCredits: INK_ADD_PRICE_CREDITS,
          refundedCredits: 0,
        };
      }
      if (
        candidate.readyAttemptId
        || candidate.acceptedAssetId
        || candidate.acceptedIdentitySnapshotId
        || candidate.acceptedPackageSnapshotId
        || intent.status !== "pending"
      ) {
        return { type: "recovery_required" };
      }
      if (candidate.status === "invalid") {
        if (!candidate.cleanupBatchId || candidate.activeSlot !== null) {
          return { type: "recovery_required" };
        }
        return {
          type: "terminal_failure",
          errorCode: "INTERNAL_SERVER_ERROR",
          publicMessage: RECOVERY_FAILURE,
          chargedCredits: input.chargedCredits,
          needsRefund: input.chargedCredits > input.refundedCredits,
        };
      }
      if (candidate.status !== "processing" || candidate.activeSlot !== "active") {
        return { type: "recovery_required" };
      }
      const storageItems = new Map<string, {
        storageKey: string;
        storageBackend: "private_evidence_r2" | "public_r2";
      }>();
      for (const attempt of attempts) {
        if (attempt.privateStorageKey) {
          storageItems.set(`private:${attempt.privateStorageKey}`, {
            storageKey: attempt.privateStorageKey,
            storageBackend: "private_evidence_r2",
          });
        }
        if (attempt.promotedPublicStorageKey) {
          storageItems.set(`public:${attempt.promotedPublicStorageKey}`, {
            storageKey: attempt.promotedPublicStorageKey,
            storageBackend: "public_r2",
          });
        }
      }
      const manifest = await createStorageCleanupManifestIn(tx, {
        id: randomUUID(),
        userId: operation.userId,
        operationId: randomUUID(),
        kind: "candidate_cleanup",
        storageItems: Array.from(storageItems.values()),
      });
      const queuedAttempts = await tx
        .update(castingEvidenceCandidateAttempts)
        .set({ status: "cleanup_pending", cleanupBatchId: manifest.id })
        .where(and(
          eq(castingEvidenceCandidateAttempts.candidateId, candidate.id),
          inArray(
            castingEvidenceCandidateAttempts.id,
            attempts.map((attempt) => attempt.id),
          ),
        ));
      if (affectedRows(queuedAttempts) !== attempts.length) {
        throw new Error("Evidence candidate recovery lost its attempt state race");
      }
      if (generationIds.length > 0) {
        await tx
          .update(generations)
          .set({
            status: "failed",
            resultUrl: null,
            errorMessage: RECOVERY_FAILURE,
            completedAt: input.now,
          })
          .where(and(
            eq(generations.operationId, operation.id),
            inArray(generations.id, generationIds),
            inArray(generations.status, ["pending", "processing"]),
          ));
      }
      const invalidated = await tx
        .update(castingEvidenceCandidates)
        .set({
          status: "invalid",
          activeSlot: null,
          cleanupBatchId: manifest.id,
          resolvedAt: input.now,
          resolvedByOperationId: operation.id,
        })
        .where(and(
          eq(castingEvidenceCandidates.id, candidate.id),
          eq(castingEvidenceCandidates.status, "processing"),
          eq(castingEvidenceCandidates.activeSlot, "active"),
          isNull(castingEvidenceCandidates.readyAttemptId),
          isNull(castingEvidenceCandidates.cleanupBatchId),
        ));
      if (affectedRows(invalidated) !== 1) {
        throw new Error("Evidence candidate recovery lost its candidate state race");
      }
      return {
        type: "terminal_failure",
        errorCode: input.chargedCredits > 0 ? "INTERNAL_SERVER_ERROR" : "TIMEOUT",
        publicMessage: input.chargedCredits > 0
          ? RECOVERY_FAILURE
          : "The tattoo preview stopped before paid generation began. Nothing was charged.",
        chargedCredits: input.chargedCredits,
        needsRefund: input.chargedCredits > input.refundedCredits,
      };
    }

    if (operation.kind === "evidence_candidate_accept") {
      const [candidate] = await tx
        .select()
        .from(castingEvidenceCandidates)
        .where(and(
          eq(castingEvidenceCandidates.userId, operation.userId),
          eq(castingEvidenceCandidates.modelId, modelId),
          eq(castingEvidenceCandidates.resolvedByOperationId, operation.id),
        ))
        .limit(1)
        .for("update");
      if (candidate?.status === "accepted") {
        const [intent] = await tx
          .select()
          .from(modelIdentityFeatureIntents)
          .where(and(
            eq(modelIdentityFeatureIntents.id, candidate.intentId),
            eq(modelIdentityFeatureIntents.status, "resolved"),
            eq(modelIdentityFeatureIntents.resolvedByOperationId, operation.id),
            eq(modelIdentityFeatureIntents.resolvedCandidateId, candidate.id),
          ))
          .limit(1)
          .for("update");
        const [feature] = await tx
          .select()
          .from(modelIdentityFeatures)
          .where(and(
            eq(modelIdentityFeatures.id, intent?.resolvedFeatureId ?? ""),
            eq(modelIdentityFeatures.modelId, modelId),
            eq(modelIdentityFeatures.createdByOperationId, operation.id),
          ))
          .limit(1);
        const [featureVersion] = await tx
          .select()
          .from(modelIdentityFeatureVersions)
          .where(and(
            eq(modelIdentityFeatureVersions.featureId, feature?.id ?? ""),
            eq(modelIdentityFeatureVersions.modelId, modelId),
            eq(modelIdentityFeatureVersions.createdByOperationId, operation.id),
          ))
          .limit(1);
        const [selection] = await tx
          .select()
          .from(modelSnapshotFeatureSelections)
          .where(and(
            eq(
              modelSnapshotFeatureSelections.identitySnapshotId,
              candidate.acceptedIdentitySnapshotId ?? "",
            ),
            eq(modelSnapshotFeatureSelections.featureId, feature?.id ?? ""),
            eq(
              modelSnapshotFeatureSelections.featureVersionId,
              featureVersion?.id ?? "",
            ),
          ))
          .limit(1);
        const [snapshot] = await tx
          .select()
          .from(modelPackageSnapshots)
          .where(and(
            eq(modelPackageSnapshots.id, candidate.acceptedPackageSnapshotId ?? ""),
            eq(modelPackageSnapshots.modelId, modelId),
            eq(
              modelPackageSnapshots.identitySnapshotId,
              candidate.acceptedIdentitySnapshotId ?? "",
            ),
          ))
          .limit(1);
        const [asset] = await tx
          .select()
          .from(modelAssets)
          .where(and(
            eq(modelAssets.id, candidate.acceptedAssetId ?? -1),
            eq(modelAssets.modelId, modelId),
          ))
          .limit(1);
        if (
          !intent
          || !feature
          || !featureVersion
          || !selection
          || !snapshot
          || !asset
          || featureVersion.acceptedAssetId !== candidate.acceptedAssetId
          || model.currentPackageSnapshotId !== snapshot.id
        ) {
          return { type: "recovery_required" };
        }
        return {
          type: "durable_success",
          result: {
            candidateId: candidate.id,
            status: "accepted",
            modelId,
            assetId: asset.id,
            featureId: feature.id,
            featureVersionId: featureVersion.id,
            identitySnapshotId: snapshot.identitySnapshotId,
            packageSnapshotId: snapshot.id,
            stateVersion: model.stateVersion,
            chargedCredits: 0,
          },
          chargedCredits: 0,
          refundedCredits: 0,
        };
      }
      const [reservedAttempt] = await tx
        .select({
          candidateId: castingEvidenceCandidates.id,
          publicStorageKey:
            castingEvidenceCandidateAttempts.promotedPublicStorageKey,
        })
        .from(castingEvidenceCandidateAttempts)
        .innerJoin(
          castingEvidenceCandidates,
          eq(
            castingEvidenceCandidates.id,
            castingEvidenceCandidateAttempts.candidateId,
          ),
        )
        .where(and(
          eq(castingEvidenceCandidates.userId, operation.userId),
          eq(castingEvidenceCandidates.modelId, modelId),
          eq(castingEvidenceCandidates.status, "ready"),
          eq(castingEvidenceCandidates.activeSlot, "active"),
          eq(
            castingEvidenceCandidateAttempts.id,
            castingEvidenceCandidates.readyAttemptId,
          ),
        ))
        .limit(1)
        .for("update");
      const publicKey = reservedAttempt?.publicStorageKey;
      if (publicKey) {
        assertPublicAttemptKey({
          key: publicKey,
          userId: operation.userId,
          modelId,
          candidateId: reservedAttempt.candidateId,
        });
        const [existingCleanup] = await tx
          .select({ id: storageCleanupBatches.id })
          .from(storageCleanupBatches)
          .where(eq(storageCleanupBatches.operationId, operation.id))
          .limit(1)
          .for("update");
        if (!existingCleanup) {
          await createStorageCleanupManifestIn(tx, {
            id: randomUUID(),
            userId: operation.userId,
            operationId: operation.id,
            kind: "candidate_cleanup",
            storageItems: [{
              storageKey: publicKey,
              storageBackend: "public_r2",
            }],
          });
        }
      }
      return {
        type: "terminal_failure",
        errorCode: "TIMEOUT",
        publicMessage: ACCEPT_RECOVERY_FAILURE,
        chargedCredits: 0,
        needsRefund: false,
      };
    }

    const [intent] = await tx
      .select()
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.userId, operation.userId),
        eq(modelIdentityFeatureIntents.modelId, modelId),
        eq(modelIdentityFeatureIntents.resolvedByOperationId, operation.id),
      ))
      .limit(1)
      .for("update");
    if (intent?.status === "cancelled") {
      const [candidate] = intent.resolvedCandidateId
        ? await tx
          .select()
          .from(castingEvidenceCandidates)
          .where(and(
            eq(castingEvidenceCandidates.id, intent.resolvedCandidateId),
            eq(castingEvidenceCandidates.status, "cancelled"),
            eq(castingEvidenceCandidates.resolvedByOperationId, operation.id),
          ))
          .limit(1)
          .for("update")
        : [];
      const [cleanup] = await tx
        .select()
        .from(storageCleanupBatches)
        .where(and(
          eq(storageCleanupBatches.operationId, operation.id),
          eq(storageCleanupBatches.userId, operation.userId),
          eq(storageCleanupBatches.kind, "candidate_cleanup"),
        ))
        .limit(1);
      if (intent.resolvedCandidateId && !candidate) {
        return { type: "recovery_required" };
      }
      return {
        type: "durable_success",
        result: {
          intentId: intent.id,
          candidateId: candidate?.id ?? null,
          status: "cancelled",
          cleanupObjects: cleanup?.expectedCount ?? 0,
          chargedCredits: 0,
        },
        chargedCredits: 0,
        refundedCredits: 0,
      };
    }
    return {
      type: "terminal_failure",
      errorCode: "TIMEOUT",
      publicMessage: CANCEL_RECOVERY_FAILURE,
      chargedCredits: 0,
      needsRefund: false,
    };
  });
}
