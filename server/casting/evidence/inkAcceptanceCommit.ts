import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  modelAssets,
  modelIdentityFeatureIntents,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
} from "../../../drizzle/schema";
import { finalizeRunningGenerationOperationSuccessIn } from "../../db/generationOperations";
import {
  InkAcceptanceStateError,
  type PreparedInkCandidateAcceptance,
} from "../../db/inkAddAcceptance";
import { identityStampFor, mintRevisionId } from "../identity/anchorSelector";
import { commitModelSnapshotTransition } from "../snapshotTransitions";
import { INK_ADD_PRICE_CREDITS } from "./evidenceCandidateContract";
import { INK_ADD_TARGET_VIEW } from "./composer/inkAddRecipe";

const ACCEPT_RECIPE_VERSION = "r7-ink-add-accept-v1";

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown } | undefined)?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

export interface InkCandidateAcceptedResult {
  candidateId: string;
  status: "accepted";
  modelId: number;
  assetId: number;
  featureId: string;
  featureVersionId: string;
  identitySnapshotId: string;
  packageSnapshotId: string;
  stateVersion: number;
  chargedCredits: 0;
}

export async function commitInkCandidateAcceptance(input: {
  prepared: PreparedInkCandidateAcceptance;
  publicStorageUrl: string;
  now?: Date;
}): Promise<InkCandidateAcceptedResult> {
  if (!input.publicStorageUrl.trim()) {
    throw new InkAcceptanceStateError("public_key_changed");
  }
  const featureId = randomUUID();
  const featureVersionId = randomUUID();
  const acceptedAt = input.now ?? new Date();
  const committed = await commitModelSnapshotTransition({
    userId: input.prepared.userId,
    modelId: input.prepared.modelId,
    operationId: input.prepared.operationId,
    expectedKind: "evidence_candidate_accept",
    mutate: async (tx, context) => {
      if (!context.current || context.model.status !== "draft") {
        throw new InkAcceptanceStateError("model_unavailable");
      }
      const [candidate] = await tx
        .select()
        .from(castingEvidenceCandidates)
        .where(and(
          eq(castingEvidenceCandidates.id, input.prepared.candidateId),
          eq(castingEvidenceCandidates.userId, input.prepared.userId),
          eq(castingEvidenceCandidates.modelId, input.prepared.modelId),
          eq(castingEvidenceCandidates.status, "ready"),
          eq(castingEvidenceCandidates.activeSlot, "active"),
          gt(castingEvidenceCandidates.expiresAt, acceptedAt),
        ))
        .limit(1)
        .for("update");
      if (
        !candidate
        || candidate.readyAttemptId !== input.prepared.attemptId
        || candidate.intentId !== input.prepared.intentId
        || candidate.expectedStateVersion !== context.model.stateVersion
        || candidate.identitySnapshotId !== context.current.identitySnapshot.id
        || candidate.packageSnapshotId !== context.current.packageSnapshot.id
        || candidate.sourceAssetId !== input.prepared.sourceAssetId
      ) {
        throw new InkAcceptanceStateError("candidate_unavailable");
      }
      const [intent] = await tx
        .select()
        .from(modelIdentityFeatureIntents)
        .where(and(
          eq(modelIdentityFeatureIntents.id, input.prepared.intentId),
          eq(modelIdentityFeatureIntents.userId, input.prepared.userId),
          eq(modelIdentityFeatureIntents.modelId, input.prepared.modelId),
          eq(modelIdentityFeatureIntents.status, "pending"),
        ))
        .limit(1)
        .for("update");
      if (
        !intent
        || intent.normalizedDescriptor !== input.prepared.normalizedDescriptor
        || intent.sourceAssetId !== input.prepared.sourceAssetId
        || intent.identitySnapshotId !== input.prepared.identitySnapshotId
        || intent.packageSnapshotId !== input.prepared.packageSnapshotId
      ) {
        throw new InkAcceptanceStateError("candidate_unavailable");
      }
      const [attempt] = await tx
        .select()
        .from(castingEvidenceCandidateAttempts)
        .where(and(
          eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
          eq(
            castingEvidenceCandidateAttempts.candidateId,
            input.prepared.candidateId,
          ),
          eq(castingEvidenceCandidateAttempts.status, "probe_passed"),
          eq(castingEvidenceCandidateAttempts.overallOutcome, "pass"),
          eq(
            castingEvidenceCandidateAttempts.promotedPublicStorageKey,
            input.prepared.publicStorageKey,
          ),
        ))
        .limit(1)
        .for("update");
      if (
        !attempt
        || attempt.privatePlateId !== input.prepared.privatePlateId
        || attempt.privateStorageKey !== input.prepared.privateStorageKey
        || attempt.byteSize !== input.prepared.byteSize
        || attempt.contentHash !== input.prepared.contentHash
      ) {
        throw new InkAcceptanceStateError("attempt_unavailable");
      }
      const [selectedFeature] = await tx
        .select({ id: modelSnapshotFeatureSelections.id })
        .from(modelSnapshotFeatureSelections)
        .where(and(
          eq(modelSnapshotFeatureSelections.modelId, input.prepared.modelId),
          eq(
            modelSnapshotFeatureSelections.identitySnapshotId,
            context.current.identitySnapshot.id,
          ),
        ))
        .limit(1)
        .for("update");
      if (selectedFeature) {
        throw new InkAcceptanceStateError("feature_already_selected");
      }

      const revisionId = mintRevisionId();
      const advancedRevision = await tx
        .update(models)
        .set({ identityRevisionId: revisionId })
        .where(and(
          eq(models.id, input.prepared.modelId),
          eq(models.userId, input.prepared.userId),
          eq(models.status, "draft"),
          isNull(models.deletedAt),
          sql`${models.identityRevisionId} <=> ${context.model.identityRevisionId}`,
        ));
      if (affectedRows(advancedRevision) !== 1) {
        throw new InkAcceptanceStateError("snapshot_head_changed");
      }
      const [insertedAsset] = await tx
        .insert(modelAssets)
        .values({
          modelId: input.prepared.modelId,
          viewType: INK_ADD_TARGET_VIEW,
          resolution: "1K",
          storageUrl: input.publicStorageUrl,
          storageKey: input.prepared.publicStorageKey,
          pointsCost: INK_ADD_PRICE_CREDITS,
          pinned: false,
          status: { state: "current", at: acceptedAt.toISOString() },
          provenance: {
            engine: input.prepared.actualImageEngine,
            recipeVersion: input.prepared.composerRecipeVersion,
            evidenceCapability: "ink.add.front_upper_torso.v1",
            acceptedCandidateId: input.prepared.candidateId,
            ...identityStampFor({
              role: "display",
              revisionId,
              identityText: context.current.identitySnapshot.identityText,
            }),
          },
        })
        .$returningId();
      if (!insertedAsset?.id) {
        throw new Error("Accepted candidate asset could not be saved");
      }
      const staleAssetIds = Array.from(new Set(
        context.current.slots.map((slot) => slot.selectedAssetId),
      ));
      if (staleAssetIds.length > 0) {
        await tx
          .update(modelAssets)
          .set({ status: { state: "stale", at: acceptedAt.toISOString() } })
          .where(and(
            eq(modelAssets.modelId, input.prepared.modelId),
            inArray(modelAssets.id, staleAssetIds),
          ));
      }
      await tx.insert(modelReferencePlates).values({
        id: input.prepared.privatePlateId,
        userId: input.prepared.userId,
        modelId: input.prepared.modelId,
        featureIntentId: null,
        kind: "accepted_candidate",
        storageKey: input.prepared.privateStorageKey,
        mime: "image/webp",
        width: input.prepared.width,
        height: input.prepared.height,
        byteSize: input.prepared.byteSize,
        contentHash: input.prepared.contentHash,
        createdByOperationId: input.prepared.operationId,
        createdByOperationStepKey: "accepted_candidate",
      });
      await tx.insert(modelIdentityFeatures).values({
        id: featureId,
        modelId: input.prepared.modelId,
        category: "ink",
        createdByOperationId: input.prepared.operationId,
      });
      await tx.insert(modelIdentityFeatureVersions).values({
        id: featureVersionId,
        modelId: input.prepared.modelId,
        featureId,
        operation: "present",
        ontologyVersion: input.prepared.ontologyVersion,
        zone: input.prepared.zone,
        surface: input.prepared.surface,
        side: input.prepared.side,
        normalizedDescriptor: input.prepared.normalizedDescriptor,
        sourceAssetId: input.prepared.sourceAssetId,
        sourceViewAngle: INK_ADD_TARGET_VIEW,
        sourceReferencePlateId: input.prepared.sourceReferencePlateId,
        acceptedCandidatePlateId: input.prepared.privatePlateId,
        evidenceCropId: null,
        recipeVersion: input.prepared.composerRecipeVersion,
        createdByOperationId: input.prepared.operationId,
      });
      return {
        result: {
          assetId: insertedAsset.id,
          featureId,
          featureVersionId,
          identityRevisionId: revisionId,
        },
        transition: {
          packageReason: "evidence_accept" as const,
          identity: {
            reason: "evidence_accept" as const,
            anchorAssetId: context.current.identitySnapshot.anchorAssetId,
            recipeVersion: ACCEPT_RECIPE_VERSION,
          },
          slotChanges: [{
            viewAngle: INK_ADD_TARGET_VIEW,
            selectedAssetId: insertedAsset.id,
            compatibility: "current" as const,
            selectionReason: "evidence_accept" as const,
          }],
          featureSelections: {
            carryCurrent: true as const,
            additions: [{
              featureId,
              featureVersionId,
              selectionReason: "accepted" as const,
            }],
          },
        },
      };
    },
    finalize: async (tx, snapshot) => {
      const acceptedCandidate = await tx
        .update(castingEvidenceCandidates)
        .set({
          status: "accepted",
          activeSlot: null,
          acceptedAssetId: snapshot.result.assetId,
          acceptedIdentitySnapshotId: snapshot.identitySnapshotId,
          acceptedPackageSnapshotId: snapshot.packageSnapshotId,
          resolvedAt: acceptedAt,
          resolvedByOperationId: input.prepared.operationId,
        })
        .where(and(
          eq(castingEvidenceCandidates.id, input.prepared.candidateId),
          eq(castingEvidenceCandidates.status, "ready"),
          eq(castingEvidenceCandidates.activeSlot, "active"),
        ));
      const resolvedIntent = await tx
        .update(modelIdentityFeatureIntents)
        .set({
          status: "resolved",
          activeCapabilityKey: null,
          resolvedByOperationId: input.prepared.operationId,
          resolvedCandidateId: input.prepared.candidateId,
          resolvedFeatureId: snapshot.result.featureId,
          resolvedAt: acceptedAt,
        })
        .where(and(
          eq(modelIdentityFeatureIntents.id, input.prepared.intentId),
          eq(modelIdentityFeatureIntents.status, "pending"),
        ));
      const promotedAttempt = await tx
        .update(castingEvidenceCandidateAttempts)
        .set({ status: "promoted", promotedAt: acceptedAt })
        .where(and(
          eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
          eq(castingEvidenceCandidateAttempts.status, "probe_passed"),
        ));
      if (
        affectedRows(acceptedCandidate) !== 1
        || affectedRows(resolvedIntent) !== 1
        || affectedRows(promotedAttempt) !== 1
      ) {
        throw new InkAcceptanceStateError("candidate_unavailable");
      }
      await finalizeRunningGenerationOperationSuccessIn(tx, {
        userId: input.prepared.userId,
        operationId: input.prepared.operationId,
        result: {
          candidateId: input.prepared.candidateId,
          status: "accepted",
          modelId: input.prepared.modelId,
          assetId: snapshot.result.assetId,
          featureId: snapshot.result.featureId,
          featureVersionId: snapshot.result.featureVersionId,
          identitySnapshotId: snapshot.identitySnapshotId,
          packageSnapshotId: snapshot.packageSnapshotId,
          stateVersion: snapshot.stateVersion,
          chargedCredits: 0,
        },
      });
    },
  });
  if (!committed.identitySnapshotId || !committed.packageSnapshotId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The tattoo preview could not be accepted.",
    });
  }
  return {
    candidateId: input.prepared.candidateId,
    status: "accepted",
    modelId: input.prepared.modelId,
    assetId: committed.result.assetId,
    featureId: committed.result.featureId,
    featureVersionId: committed.result.featureVersionId,
    identitySnapshotId: committed.identitySnapshotId,
    packageSnapshotId: committed.packageSnapshotId,
    stateVersion: committed.stateVersion,
    chargedCredits: 0,
  };
}
