import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidateFeatureTargets,
  castingEvidenceCandidates,
  modelAssets,
  modelIdentityFeatureIntents,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelIdentityFeatureProjectionEvidence,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
} from "../../../drizzle/schema";
import { finalizeRunningGenerationOperationSuccessIn } from "../../db/generationOperations";
import {
  InkAcceptanceStateError,
  type PreparedInkCandidateAcceptance,
  type PreparedInkProjectionCandidateAcceptance,
} from "../../db/inkAddAcceptance";
import {
  currentRevisionId,
  identityStampFor,
} from "../identity/anchorSelector";
import { slotCost } from "../packagePricing";
import { commitModelSnapshotTransition } from "../snapshotTransitions";
import {
  INK_ADD_CAPABILITY_KEY,
  INK_ADD_PRICE_CREDITS,
} from "./evidenceCandidateContract";
import { affectedViewsForInkAdd } from "./inkViewImpact";
import {
  INK_ACTIVE_FAMILY_KEY,
  INK_ANYWHERE_CAPABILITY_KEY,
  assertSupportedInkAnatomyTuple,
  inkViewDirectiveV2,
} from "./inkAnatomyRegistry";
import {
  CANONICAL_VIEW_ANGLES,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";

const ACCEPT_RECIPE_VERSION = "r7-ink-add-accept-v1";
const PROJECTION_ACCEPT_RECIPE_VERSION =
  "r7-ink-projection-accept-v1";

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown } | undefined)?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

function affectedViewsForAcceptance(
  prepared: PreparedInkCandidateAcceptance,
): readonly CanonicalViewAngle[] {
  if (prepared.capabilityKey === INK_ADD_CAPABILITY_KEY) {
    return affectedViewsForInkAdd({
      capabilityKey: prepared.capabilityKey,
      ontologyVersion: prepared.ontologyVersion,
      zone: prepared.zone,
      surface: prepared.surface,
      side: prepared.side,
    });
  }
  const anatomy = {
    zone: prepared.zone,
    surface: prepared.surface,
    side: prepared.side,
  };
  assertSupportedInkAnatomyTuple(anatomy);
  return CANONICAL_VIEW_ANGLES.filter(
    (angle) => inkViewDirectiveV2(anatomy, angle).impact === "affected",
  );
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

export interface InkProjectionCandidateAcceptedResult {
  candidateId: string;
  status: "accepted";
  purpose: "feature_projection";
  modelId: number;
  assetId: number;
  targetViewAngle: CanonicalViewAngle;
  projectedFeatureVersionIds: string[];
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
    featureAuthority: "evidence_aware",
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
        || candidate.targetViewAngle !== input.prepared.sourceViewAngle
        || candidate.capabilityKey !== input.prepared.capabilityKey
        || candidate.purpose !== "feature_authoring"
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
        || intent.capabilityKey !== input.prepared.capabilityKey
        || intent.normalizedDescriptor !== input.prepared.normalizedDescriptor
        || intent.sourceAssetId !== input.prepared.sourceAssetId
        || intent.identitySnapshotId !== input.prepared.identitySnapshotId
        || intent.packageSnapshotId !== input.prepared.packageSnapshotId
        || intent.ontologyVersion !== input.prepared.ontologyVersion
        || intent.zone !== input.prepared.zone
        || intent.surface !== input.prepared.surface
        || intent.side !== input.prepared.side
      ) {
        throw new InkAcceptanceStateError("candidate_unavailable");
      }
      const legacyIntent = intent.capabilityKey === INK_ADD_CAPABILITY_KEY
        && intent.activeCapabilityKey === INK_ADD_CAPABILITY_KEY;
      const anywhereIntent = intent.capabilityKey === INK_ANYWHERE_CAPABILITY_KEY
        && intent.activeCapabilityKey === INK_ACTIVE_FAMILY_KEY;
      if (!legacyIntent && !anywhereIntent) {
        throw new InkAcceptanceStateError("candidate_unavailable");
      }
      const affectedViewAngles = affectedViewsForAcceptance(input.prepared);
      const affectedViewSet = new Set(affectedViewAngles);
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
        || (
          anywhereIntent
          && attempt.priorInkOutcome !== "pass"
        )
      ) {
        throw new InkAcceptanceStateError("attempt_unavailable");
      }
      if (legacyIntent) {
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
      }

      // Evidence changes the immutable feature graph, not the person's facial
      // identity. Keep the legacy identity revision stable so the unchanged
      // headshot remains a valid anchor while the new identity snapshot owns
      // the accepted feature selection and selective package staleness.
      const revisionId = currentRevisionId(context.model);
      const anchorBearing = anywhereIntent
        && input.prepared.sourceViewAngle === "frontClose"
        && (
          input.prepared.zone === "face"
          || input.prepared.zone === "scalp"
          || input.prepared.zone === "neck"
        );
      const [insertedAsset] = await tx
        .insert(modelAssets)
        .values({
          modelId: input.prepared.modelId,
          viewType: input.prepared.sourceViewAngle,
          resolution: "1K",
          storageUrl: input.publicStorageUrl,
          storageKey: input.prepared.publicStorageKey,
          pointsCost: INK_ADD_PRICE_CREDITS,
          pinned: false,
          status: { state: "current", at: acceptedAt.toISOString() },
          provenance: {
            engine: input.prepared.actualImageEngine,
            recipeVersion: input.prepared.composerRecipeVersion,
            evidenceCapability: input.prepared.capabilityKey,
            acceptedCandidateId: input.prepared.candidateId,
            ...identityStampFor({
              role: anchorBearing ? "anchor" : "display",
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
        context.current.slots
          .filter((slot) => affectedViewSet.has(slot.viewAngle))
          .map((slot) => slot.selectedAssetId),
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
        sourceViewAngle: input.prepared.sourceViewAngle,
        sourceReferencePlateId: input.prepared.sourceReferencePlateId,
        acceptedCandidatePlateId: input.prepared.privatePlateId,
        evidenceCropId: null,
        recipeVersion: input.prepared.composerRecipeVersion,
        createdByOperationId: input.prepared.operationId,
        acceptedAssetId: insertedAsset.id,
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
            anchorAssetId: anchorBearing
              ? insertedAsset.id
              : context.current.identitySnapshot.anchorAssetId,
            recipeVersion: ACCEPT_RECIPE_VERSION,
            staleViewAngles: affectedViewAngles,
            ...(anchorBearing
              ? { acceptsAnchorBearingEvidence: true as const }
              : {}),
          },
          slotChanges: [{
            viewAngle: input.prepared.sourceViewAngle,
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

export async function commitInkProjectionCandidateAcceptance(input: {
  prepared: PreparedInkProjectionCandidateAcceptance;
  publicStorageUrl: string;
  now?: Date;
}): Promise<InkProjectionCandidateAcceptedResult> {
  if (!input.publicStorageUrl.trim()) {
    throw new InkAcceptanceStateError("public_key_changed");
  }
  const acceptedAt = input.now ?? new Date();
  const committed = await commitModelSnapshotTransition({
    userId: input.prepared.userId,
    modelId: input.prepared.modelId,
    operationId: input.prepared.operationId,
    expectedKind: "evidence_candidate_accept",
    featureAuthority: "evidence_aware",
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
        || candidate.intentId !== null
        || candidate.purpose !== "feature_projection"
        || candidate.readyAttemptId !== input.prepared.attemptId
        || candidate.expectedStateVersion !== context.model.stateVersion
        || candidate.identitySnapshotId !== context.current.identitySnapshot.id
        || candidate.packageSnapshotId !== context.current.packageSnapshot.id
        || candidate.sourceAssetId !== input.prepared.sourceAssetId
        || candidate.targetViewAngle !== input.prepared.targetViewAngle
        || candidate.composerRecipeVersion
          !== input.prepared.composerRecipeVersion
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
          eq(castingEvidenceCandidateAttempts.priorInkOutcome, "pass"),
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
      const targetRows = await tx
        .select()
        .from(castingEvidenceCandidateFeatureTargets)
        .where(and(
          eq(
            castingEvidenceCandidateFeatureTargets.candidateId,
            input.prepared.candidateId,
          ),
          eq(
            castingEvidenceCandidateFeatureTargets.userId,
            input.prepared.userId,
          ),
          eq(
            castingEvidenceCandidateFeatureTargets.modelId,
            input.prepared.modelId,
          ),
          eq(
            castingEvidenceCandidateFeatureTargets.identitySnapshotId,
            context.current.identitySnapshot.id,
          ),
        ))
        .for("update");
      const expectedTargets = [...input.prepared.targets]
        .sort((left, right) =>
          left.featureVersionId.localeCompare(right.featureVersionId)
        );
      const actualTargets = [...targetRows]
        .sort((left, right) =>
          left.featureVersionId.localeCompare(right.featureVersionId)
        );
      if (
        actualTargets.length !== expectedTargets.length
        || actualTargets.some((target, index) =>
          target.featureId !== expectedTargets[index].featureId
          || target.featureVersionId
            !== expectedTargets[index].featureVersionId
          || target.coverageBasis !== expectedTargets[index].coverageBasis
        )
      ) {
        throw new InkAcceptanceStateError("candidate_unavailable");
      }
      const revisionId = currentRevisionId(context.model);
      const [insertedAsset] = await tx
        .insert(modelAssets)
        .values({
          modelId: input.prepared.modelId,
          viewType: input.prepared.targetViewAngle,
          resolution: "1K",
          storageUrl: input.publicStorageUrl,
          storageKey: input.prepared.publicStorageKey,
          pointsCost: slotCost(input.prepared.targetViewAngle),
          pinned: false,
          status: { state: "current", at: acceptedAt.toISOString() },
          provenance: {
            engine: input.prepared.actualImageEngine,
            recipeVersion: input.prepared.composerRecipeVersion,
            evidenceCapability: INK_ANYWHERE_CAPABILITY_KEY,
            evidencePurpose: "feature_projection",
            acceptedCandidateId: input.prepared.candidateId,
            projectedFeatureCount: expectedTargets.length,
            ...identityStampFor({
              role: "display",
              revisionId,
              identityText: context.current.identitySnapshot.identityText,
            }),
          },
        })
        .$returningId();
      if (!insertedAsset?.id) {
        throw new Error("Accepted projection asset could not be saved");
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
        createdByOperationStepKey: "accepted_projection",
      });
      await tx.insert(modelIdentityFeatureProjectionEvidence).values(
        expectedTargets.map((target) => ({
          id: randomUUID(),
          userId: input.prepared.userId,
          modelId: input.prepared.modelId,
          featureId: target.featureId,
          featureVersionId: target.featureVersionId,
          targetViewAngle: input.prepared.targetViewAngle,
          sourceAssetId: input.prepared.sourceAssetId,
          acceptedAssetId: insertedAsset.id,
          acceptedCandidatePlateId: input.prepared.privatePlateId,
          recipeVersion: input.prepared.composerRecipeVersion,
          createdByOperationId: input.prepared.operationId,
          createdByOperationStepKey:
            `projection:${target.featureVersionId}`,
        })),
      );
      return {
        result: {
          assetId: insertedAsset.id,
          targetViewAngle: input.prepared.targetViewAngle,
          projectedFeatureVersionIds: expectedTargets.map(
            (target) => target.featureVersionId,
          ),
        },
        transition: {
          packageReason: "slot_refresh" as const,
          slotChanges: [{
            viewAngle: input.prepared.targetViewAngle,
            selectedAssetId: insertedAsset.id,
            compatibility: "current" as const,
            selectionReason: "refreshed" as const,
          }],
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
      const promotedAttempt = await tx
        .update(castingEvidenceCandidateAttempts)
        .set({ status: "promoted", promotedAt: acceptedAt })
        .where(and(
          eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
          eq(castingEvidenceCandidateAttempts.status, "probe_passed"),
        ));
      if (
        affectedRows(acceptedCandidate) !== 1
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
          purpose: "feature_projection",
          modelId: input.prepared.modelId,
          assetId: snapshot.result.assetId,
          targetViewAngle: snapshot.result.targetViewAngle,
          projectedFeatureVersionIds:
            snapshot.result.projectedFeatureVersionIds,
          identitySnapshotId: snapshot.identitySnapshotId,
          packageSnapshotId: snapshot.packageSnapshotId,
          stateVersion: snapshot.stateVersion,
          chargedCredits: 0,
          recipeVersion: PROJECTION_ACCEPT_RECIPE_VERSION,
        },
      });
    },
  });
  if (!committed.identitySnapshotId || !committed.packageSnapshotId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The tattoo projection could not be accepted.",
    });
  }
  return {
    candidateId: input.prepared.candidateId,
    status: "accepted",
    purpose: "feature_projection",
    modelId: input.prepared.modelId,
    assetId: committed.result.assetId,
    targetViewAngle: committed.result.targetViewAngle,
    projectedFeatureVersionIds:
      committed.result.projectedFeatureVersionIds,
    identitySnapshotId: committed.identitySnapshotId,
    packageSnapshotId: committed.packageSnapshotId,
    stateVersion: committed.stateVersion,
    chargedCredits: 0,
  };
}
