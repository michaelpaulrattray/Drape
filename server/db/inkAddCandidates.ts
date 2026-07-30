import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  castingEvidenceCandidateFeatureTargets,
  castingEvidenceCandidateAttempts,
  castingEvidenceCandidates,
  generationOperationLocks,
  generationOperations,
  generations,
  modelIdentityFeatureIntents,
  modelPackageSnapshotSlots,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
  models,
} from "../../drizzle/schema";
import {
  INK_ADD_CAPABILITY_KEY,
  INK_ADD_PRICE_CREDITS,
  type EvidenceProbeOutcome,
} from "../casting/evidence/evidenceCandidateContract";
import {
  INK_ADD_COMPOSER_RECIPE_VERSION,
  INK_ADD_IMAGE_ENGINE,
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_PROBE_MODEL,
  INK_ADD_PROBE_RECIPE_VERSION,
  INK_ADD_SURFACE,
  INK_ADD_TARGET_VIEW,
  INK_ADD_VISIBILITY_RECIPE_VERSION,
  INK_ADD_ZONE,
  assertInkAddSide,
  type InkAddSide,
} from "../casting/evidence/composer/inkAddRecipe";
import type { NormalizedInkZone } from "../casting/evidence/composer/inkZoneGuide";
import type { InkCandidateProbeTruth } from "../casting/evidence/composer/inkProbe";
import {
  buildEvidenceCandidateStorageKey,
  parseEvidenceStorageKey,
} from "../casting/evidence/evidenceDelivery";
import { parseInkCandidatePublicStorageKey } from "../casting/evidence/inkCandidatePublicStorage";
import { availableModelWhere } from "../casting/modelAvailability";
import { modelOperationLockKey } from "../casting/operationContract";
import { slotCost } from "../casting/packagePricing";
import { buildEffectiveCastState } from "../casting/effectiveCastState";
import {
  INK_ACTIVE_FAMILY_KEY,
  INK_ANYWHERE_CAPABILITY_KEY,
  INK_ANYWHERE_COMPOSER_RECIPE_VERSION,
  INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_ONTOLOGY_VERSION,
  INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_PROJECTION_RECIPE_VERSION,
  INK_ANYWHERE_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_VISIBILITY_RECIPE_VERSION,
  assertSupportedInkAnatomyTuple,
  chooseCurrentInkAuthoringSource,
  inkViewDirectiveV2,
  inkAnatomyLabel,
  type InkAnatomyTuple,
} from "../casting/evidence/inkAnatomyRegistry";
import {
  FRONT_UPPER_TORSO_ZONES,
} from "../casting/evidence/composer/inkZoneGuide";
import type { CanonicalViewAngle } from "../../shared/boardTypes";
import { readSnapshotShadowStateIn } from "../casting/snapshotShadow";
import {
  assessClosedInkFeatureGraph,
  type ClosedInkFeatureEntry,
} from "../casting/evidence/inkFeatureGraph";
import { readEvidencePackageFeatureRowsIn } from "../casting/evidence/evidencePackageFeatureRows";
import { inkPackageAngleAuthority } from "../casting/evidence/inkPackageImpactV2";
import { inkPackageDirective } from "../casting/evidence/evidencePackageRegistry";
import { createStorageCleanupManifestIn } from "./storageCleanup";
import { withTransaction, type TransactionHandle } from "./connection";

export const INK_CANDIDATE_PUBLIC_FAILURE =
  "The tattoo preview could not be created. Any charged credits were refunded.";

export type InkCandidateStateCode =
  | "model_unavailable"
  | "operation_unavailable"
  | "intent_unavailable"
  | "candidate_unavailable"
  | "snapshot_head_changed"
  | "source_unavailable"
  | "feature_already_selected"
  | "candidate_already_active"
  | "attempt_unavailable"
  | "attempt_state_changed";

export class InkCandidateStateError extends Error {
  constructor(public readonly code: InkCandidateStateCode) {
    super(INK_CANDIDATE_PUBLIC_FAILURE);
    this.name = "InkCandidateStateError";
  }
}

export interface PreparedInkCandidateAttempt {
  userId: number;
  modelId: number;
  operationId: string;
  operationKind: "evidence_candidate_generate" | "evidence_candidate_retry";
  candidateId: string;
  intentId: string | null;
  attemptId: string;
  attemptNumber: 1 | 2;
  generationId: number;
  privatePlateId: string;
  privateStorageKey: string;
  identitySnapshotId: string;
  packageSnapshotId: string;
  expectedStateVersion: number;
  sourceAssetId: number;
  sourceUrl: string;
  sourceViewAngle: CanonicalViewAngle;
  anchorUrl: string;
  identityText: string;
  authority:
    | {
        kind: "legacy_v1";
        capabilityKey: typeof INK_ADD_CAPABILITY_KEY;
        ontologyVersion: typeof INK_ADD_ONTOLOGY_VERSION;
        anatomy: {
          zone: typeof INK_ADD_ZONE;
          surface: typeof INK_ADD_SURFACE;
          side: InkAddSide;
        };
        normalizedTargetZone: NormalizedInkZone;
        composerRecipeVersion: typeof INK_ADD_COMPOSER_RECIPE_VERSION;
        probeRecipeVersion: typeof INK_ADD_PROBE_RECIPE_VERSION;
        visibilityRecipeVersion: typeof INK_ADD_VISIBILITY_RECIPE_VERSION;
      }
    | {
        kind: "anywhere_v2";
        capabilityKey: typeof INK_ANYWHERE_CAPABILITY_KEY;
        ontologyVersion: typeof INK_ANYWHERE_ONTOLOGY_VERSION;
        anatomy: InkAnatomyTuple;
        normalizedTargetZone: NormalizedInkZone;
        composerRecipeVersion: typeof INK_ANYWHERE_COMPOSER_RECIPE_VERSION;
        probeRecipeVersion: typeof INK_ANYWHERE_PROBE_RECIPE_VERSION;
        visibilityRecipeVersion: typeof INK_ANYWHERE_VISIBILITY_RECIPE_VERSION;
      }
    | {
        kind: "projection_v2";
        capabilityKey: typeof INK_ANYWHERE_CAPABILITY_KEY;
        ontologyVersion: typeof INK_ANYWHERE_ONTOLOGY_VERSION;
        targetAngle: CanonicalViewAngle;
        sourceAngle: CanonicalViewAngle;
        composerRecipeVersion: typeof INK_ANYWHERE_PROJECTION_RECIPE_VERSION;
        probeRecipeVersion:
          typeof INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION;
        visibilityRecipeVersion:
          typeof INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION;
        features: readonly PreparedInkProjectionFeature[];
      };
  normalizedDescriptor: string;
  reference: null | {
    plateId: string;
    storageKey: string;
    byteSize: number;
    contentHash: string;
  };
}

export interface PreparedInkProjectionFeature {
  featureId: string;
  featureVersionId: string;
  contract: "legacy_front_upper_torso_v1" | "all_body_v2";
  normalizedDescriptor: string;
  anatomyLabel: string;
  anatomy: { zone: string; surface: string; side: string };
  targetZone: NormalizedInkZone;
  targetZones: readonly NormalizedInkZone[];
  witnessZone: NormalizedInkZone;
  witnessViewAngle: CanonicalViewAngle;
  witness: {
    plateId: string;
    storageKey: string;
    byteSize: number;
    contentHash: string;
  };
  witnessSource?: {
    assetId: number;
    storageUrl: string;
  };
  impact: "affected" | "uncertain";
  hasAcceptedTargetEvidence: boolean;
  isProjectionTarget: boolean;
  coverageBasis: "registry_affected" | "observed_visible" | null;
}

export interface ObservedInkProjectionCoverage {
  visible: boolean;
  targetZones: readonly NormalizedInkZone[] | null;
}

function boundingInkZone(
  zones: readonly NormalizedInkZone[],
): NormalizedInkZone {
  if (zones.length < 1 || zones.length > 4) {
    throw new InkCandidateStateError("source_unavailable");
  }
  const x = Math.min(...zones.map((zone) => zone.x));
  const y = Math.min(...zones.map((zone) => zone.y));
  const right = Math.max(...zones.map((zone) => zone.x + zone.width));
  const bottom = Math.max(...zones.map((zone) => zone.y + zone.height));
  if (
    ![x, y, right, bottom].every(Number.isFinite)
    || x < 0
    || y < 0
    || right > 1
    || bottom > 1
    || right <= x
    || bottom <= y
  ) {
    throw new InkCandidateStateError("source_unavailable");
  }
  return Object.freeze({
    x,
    y,
    width: right - x,
    height: bottom - y,
  });
}

function affectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return Number((result[0] as { affectedRows?: unknown })?.affectedRows ?? 0);
  }
  return Number((result as { affectedRows?: unknown })?.affectedRows ?? 0);
}

async function lockOwnedDraftModelIn(
  tx: TransactionHandle,
  input: { userId: number; modelId: number },
) {
  const [model] = await tx
    .select()
    .from(models)
    .where(and(
      eq(models.id, input.modelId),
      eq(models.userId, input.userId),
      eq(models.status, "draft"),
      isNull(models.deletedAt),
    ))
    .limit(1)
    .for("update");
  if (!model) throw new InkCandidateStateError("model_unavailable");
  return model;
}

async function lockRunningOperationIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    operationKind: PreparedInkCandidateAttempt["operationKind"];
  },
  plannedCredits: number,
) {
  const [operation] = await tx
    .select()
    .from(generationOperations)
    .where(and(
      eq(generationOperations.id, input.operationId),
      eq(generationOperations.userId, input.userId),
      eq(generationOperations.modelId, input.modelId),
      eq(generationOperations.kind, input.operationKind),
      eq(generationOperations.status, "running"),
      eq(generationOperations.plannedCredits, plannedCredits),
    ))
    .limit(1)
    .for("update");
  if (!operation) throw new InkCandidateStateError("operation_unavailable");
  const [lock] = await tx
    .select({ operationId: generationOperationLocks.operationId })
    .from(generationOperationLocks)
    .where(and(
      eq(generationOperationLocks.lockKey, modelOperationLockKey(input.modelId)),
      eq(generationOperationLocks.operationId, input.operationId),
      eq(generationOperationLocks.kind, input.operationKind),
    ))
    .limit(1)
    .for("update");
  if (!lock) throw new InkCandidateStateError("operation_unavailable");
  return operation;
}

function plannedCreditsForPrepared(
  prepared: PreparedInkCandidateAttempt,
): number {
  return prepared.authority.kind === "projection_v2"
    ? slotCost(prepared.authority.targetAngle)
    : INK_ADD_PRICE_CREDITS;
}

function assertOperationHead(
  operation: {
    expectedStateVersion: number | null;
    expectedIdentitySnapshotId: string | null;
    expectedPackageSnapshotId: string | null;
  },
  input: {
    stateVersion: number;
    identitySnapshotId: string;
    packageSnapshotId: string;
  },
): void {
  if (
    operation.expectedStateVersion !== input.stateVersion
    || operation.expectedIdentitySnapshotId !== input.identitySnapshotId
    || operation.expectedPackageSnapshotId !== input.packageSnapshotId
  ) {
    throw new InkCandidateStateError("snapshot_head_changed");
  }
}

async function createAttemptIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    candidateId: string;
    attemptId: string;
    attemptNumber: 1 | 2;
    privatePlateId: string;
    sourceViewAngle: CanonicalViewAngle;
    composerRecipeVersion: string;
    probeRecipeVersion: string;
    priceCredits: number;
  },
): Promise<{ generationId: number; privateStorageKey: string }> {
  const privateStorageKey = buildEvidenceCandidateStorageKey({
    userId: input.userId,
    modelId: input.modelId,
    privatePlateId: input.privatePlateId,
  });
  const [inserted] = await tx
    .insert(generations)
    .values({
      userId: input.userId,
      modelId: input.modelId,
      operationId: input.operationId,
      stepKey: `attempt:${input.attemptNumber}`,
      viewAngle: input.sourceViewAngle,
      type: "evidenceCandidate",
      status: "pending",
      pointsCost: input.attemptNumber === 1 ? input.priceCredits : 0,
      resultUrl: null,
      metadata: {
        candidateId: input.candidateId,
        attemptNumber: input.attemptNumber,
        billingRole: input.attemptNumber === 1
          ? "charged_attempt"
          : "included_retry",
        engine: INK_ADD_IMAGE_ENGINE,
        recipeVersion: input.composerRecipeVersion,
      },
    })
    .$returningId();
  await tx.insert(castingEvidenceCandidateAttempts).values({
    id: input.attemptId,
    candidateId: input.candidateId,
    attemptNumber: input.attemptNumber,
    generationId: inserted.id,
    status: "planned",
    privatePlateId: input.privatePlateId,
    privateStorageKey,
    actualImageEngine: INK_ADD_IMAGE_ENGINE,
    composerRecipeVersion: input.composerRecipeVersion,
    probeModel: INK_ADD_PROBE_MODEL,
    probeRecipeVersion: input.probeRecipeVersion,
  });
  return { generationId: inserted.id, privateStorageKey };
}

async function rejectReadyCandidateForRetryIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    intentId: string;
    operationId: string;
  },
): Promise<void> {
  const [candidate] = await tx
    .select()
    .from(castingEvidenceCandidates)
    .where(and(
      eq(castingEvidenceCandidates.userId, input.userId),
      eq(castingEvidenceCandidates.modelId, input.modelId),
      eq(castingEvidenceCandidates.intentId, input.intentId),
      eq(castingEvidenceCandidates.status, "ready"),
      eq(castingEvidenceCandidates.activeSlot, "active"),
    ))
    .limit(1)
    .for("update");
  if (!candidate) throw new InkCandidateStateError("candidate_unavailable");
  const attempts = await tx
    .select()
    .from(castingEvidenceCandidateAttempts)
    .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id))
    .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
    .for("update");
  const storageItems: Array<{
    storageKey: string;
    storageBackend: "private_evidence_r2" | "public_r2";
  }> = [];
  for (const attempt of attempts) {
    if (attempt.privateStorageKey) {
      const parsed = parseEvidenceStorageKey(attempt.privateStorageKey);
      if (
        parsed.userId !== input.userId
        || parsed.modelId !== input.modelId
        || parsed.kind !== "candidate"
        || parsed.entityId !== attempt.privatePlateId
      ) {
        throw new InkCandidateStateError("attempt_unavailable");
      }
      storageItems.push({
        storageKey: attempt.privateStorageKey,
        storageBackend: "private_evidence_r2",
      });
    }
    if (attempt.promotedPublicStorageKey) {
      const parsed = parseInkCandidatePublicStorageKey(
        attempt.promotedPublicStorageKey,
      );
      if (
        parsed.userId !== input.userId
        || parsed.modelId !== input.modelId
        || parsed.candidateId !== candidate.id
      ) {
        throw new InkCandidateStateError("attempt_unavailable");
      }
      storageItems.push({
        storageKey: attempt.promotedPublicStorageKey,
        storageBackend: "public_r2",
      });
    }
  }
  const manifest = await createStorageCleanupManifestIn(tx, {
    id: randomUUID(),
    userId: input.userId,
    operationId: randomUUID(),
    kind: "candidate_cleanup",
    storageItems,
  });
  if (attempts.length > 0) {
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "cleanup_pending", cleanupBatchId: manifest.id })
      .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id));
  }
  const updated = await tx
    .update(castingEvidenceCandidates)
    .set({
      status: "rejected",
      activeSlot: null,
      cleanupBatchId: manifest.id,
      resolvedAt: new Date(),
      resolvedByOperationId: input.operationId,
    })
    .where(and(
      eq(castingEvidenceCandidates.id, candidate.id),
      eq(castingEvidenceCandidates.status, "ready"),
      eq(castingEvidenceCandidates.activeSlot, "active"),
    ));
  if (affectedRows(updated) !== 1) {
    throw new InkCandidateStateError("candidate_unavailable");
  }
}

export interface InkProjectionCandidatePreflight {
  userId: number;
  modelId: number;
  operationId: string;
  operationKind: PreparedInkCandidateAttempt["operationKind"];
  identitySnapshotId: string;
  packageSnapshotId: string;
  expectedStateVersion: number;
  sourceAssetId: number;
  sourceUrl: string;
  sourceViewAngle: CanonicalViewAngle;
  targetViewAngle: CanonicalViewAngle;
  anchorUrl: string;
  identityText: string;
  features: readonly PreparedInkProjectionFeature[];
}

function projectionDirectiveForEntry(
  entry: ClosedInkFeatureEntry,
  angle: CanonicalViewAngle,
): {
  impact: "affected" | "unaffected" | "uncertain";
  normalizedTargetZone: NormalizedInkZone | null;
} {
  if (entry.contract === "legacy_front_upper_torso_v1") {
    const directive = inkPackageDirective({
      capabilityKey: INK_ADD_CAPABILITY_KEY,
      ontologyVersion: entry.version.ontologyVersion,
      zone: entry.version.zone,
      surface: entry.version.surface,
      side: entry.version.side,
      angle,
    });
    if (!directive) throw new InkCandidateStateError("source_unavailable");
    return {
      impact: directive.existingSelectionImpact,
      normalizedTargetZone: directive.normalizedTargetZone,
    };
  }
  const anatomy = {
    zone: entry.version.zone,
    surface: entry.version.surface,
    side: entry.version.side,
  };
  assertSupportedInkAnatomyTuple(anatomy);
  const directive = inkViewDirectiveV2(anatomy, angle);
  return {
    impact: directive.impact,
    normalizedTargetZone: directive.normalizedTargetZone,
  };
}

function projectionFeatureForEntry(
  entry: ClosedInkFeatureEntry,
  angle: CanonicalViewAngle,
): PreparedInkProjectionFeature | null {
  const targetDirective = projectionDirectiveForEntry(entry, angle);
  if (targetDirective.impact === "unaffected") return null;
  if (!targetDirective.normalizedTargetZone) {
    throw new InkCandidateStateError("source_unavailable");
  }
  const acceptedTargetProjection = entry.projections.find(
    (projection) => projection.evidence.targetViewAngle === angle,
  );
  const hasAcceptedTargetEvidence =
    entry.version.sourceViewAngle === angle || Boolean(acceptedTargetProjection);
  const witnessPlate = acceptedTargetProjection?.plate ?? entry.authoringPlate;
  const witnessSourceAsset = acceptedTargetProjection
    ? acceptedTargetProjection.sourceAsset
    : entry.authoringSourceAsset;
  const witnessViewAngle = acceptedTargetProjection?.evidence.targetViewAngle
    ?? entry.version.sourceViewAngle;
  const witnessDirective = projectionDirectiveForEntry(
    entry,
    witnessViewAngle,
  );
  if (!witnessDirective.normalizedTargetZone) {
    throw new InkCandidateStateError("source_unavailable");
  }
  if (!witnessSourceAsset?.storageUrl) {
    throw new InkCandidateStateError("source_unavailable");
  }
  const anatomy = {
    zone: entry.version.zone,
    surface: entry.version.surface,
    side: entry.version.side,
  };
  return {
    featureId: entry.feature.id,
    featureVersionId: entry.version.id,
    contract: entry.contract,
    normalizedDescriptor: entry.version.normalizedDescriptor,
    anatomyLabel: entry.contract === "all_body_v2"
      ? inkAnatomyLabel(anatomy as InkAnatomyTuple)
      : `${entry.version.side} chest`,
    anatomy,
    targetZone: targetDirective.normalizedTargetZone,
    targetZones: Object.freeze([targetDirective.normalizedTargetZone]),
    witnessZone: witnessDirective.normalizedTargetZone,
    witnessViewAngle,
    witness: {
      plateId: witnessPlate.id,
      storageKey: witnessPlate.storageKey,
      byteSize: witnessPlate.byteSize,
      contentHash: witnessPlate.contentHash,
    },
    witnessSource: {
      assetId: witnessSourceAsset.id,
      storageUrl: witnessSourceAsset.storageUrl,
    },
    impact: targetDirective.impact,
    hasAcceptedTargetEvidence,
    isProjectionTarget: !hasAcceptedTargetEvidence,
    coverageBasis: targetDirective.impact === "affected"
      && !hasAcceptedTargetEvidence
      ? "registry_affected"
      : null,
  };
}

function projectionSource(
  state: ReturnType<typeof buildEffectiveCastState> & { status: "current" },
  angle: CanonicalViewAngle,
) {
  const exact = state.selectedViews.find((view) => view.angle === angle);
  if (exact) {
    if (
      (exact.compatibility !== "current" && exact.compatibility !== "stale")
      || exact.asset.pinned
      || !exact.asset.storageUrl
    ) {
      throw new InkCandidateStateError("source_unavailable");
    }
    return exact;
  }
  const fallbackOrder: readonly CanonicalViewAngle[] = [
    "frontFull",
    "threeQuarter",
    "sideFull",
    "backFull",
    "frontClose",
    "sideClose",
  ];
  const fallback = fallbackOrder.flatMap((candidate) =>
    state.selectedViews.filter((view) =>
      view.angle === candidate
      && view.compatibility === "current"
      && !view.asset.pinned
      && Boolean(view.asset.storageUrl)
    )
  )[0];
  if (!fallback) throw new InkCandidateStateError("source_unavailable");
  return fallback;
}

async function loadProjectionCandidatePreflightIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    operationId: string;
    operationKind: PreparedInkCandidateAttempt["operationKind"];
    targetViewAngle: CanonicalViewAngle;
  },
): Promise<InkProjectionCandidatePreflight> {
  const model = await lockOwnedDraftModelIn(tx, input);
  const operation = await lockRunningOperationIn(
    tx,
    input,
    slotCost(input.targetViewAngle),
  );
  let state;
  try {
    state = buildEffectiveCastState({
      ...(await readSnapshotShadowStateIn(tx, input)),
      model,
    });
  } catch {
    throw new InkCandidateStateError("snapshot_head_changed");
  }
  if (state.status !== "current" || !state.identity || !state.package) {
    throw new InkCandidateStateError("snapshot_head_changed");
  }
  assertOperationHead(operation, {
    stateVersion: model.stateVersion,
    identitySnapshotId: state.identity.id,
    packageSnapshotId: state.package.id,
  });
  const [activeCandidate] = await tx
    .select()
    .from(castingEvidenceCandidates)
    .where(and(
      eq(castingEvidenceCandidates.modelId, input.modelId),
      eq(castingEvidenceCandidates.activeSlot, "active"),
    ))
    .limit(1)
    .for("update");
  if (input.operationKind === "evidence_candidate_generate") {
    if (activeCandidate) {
      throw new InkCandidateStateError("candidate_already_active");
    }
  } else if (
    !activeCandidate
    || activeCandidate.purpose !== "feature_projection"
    || activeCandidate.status !== "ready"
    || activeCandidate.targetViewAngle !== input.targetViewAngle
  ) {
    throw new InkCandidateStateError("candidate_unavailable");
  }
  const featureRows = await readEvidencePackageFeatureRowsIn(tx, {
    userId: input.userId,
    modelId: input.modelId,
    identitySnapshotId: state.identity.id,
  });
  const graph = assessClosedInkFeatureGraph(featureRows.graph);
  if (!graph) throw new InkCandidateStateError("source_unavailable");
  const angleAuthority = inkPackageAngleAuthority(
    graph,
    input.targetViewAngle,
  );
  if (!angleAuthority.requiresProjectionCandidate) {
    throw new InkCandidateStateError("source_unavailable");
  }
  const features = graph.entries.flatMap((entry) => {
    const feature = projectionFeatureForEntry(entry, input.targetViewAngle);
    return feature ? [feature] : [];
  });
  if (
    features.length < 1
    || features.length > 9
    || !features.some((feature) => feature.isProjectionTarget)
  ) {
    throw new InkCandidateStateError("source_unavailable");
  }
  const source = projectionSource(
    state as ReturnType<typeof buildEffectiveCastState> & { status: "current" },
    input.targetViewAngle,
  );
  if (!state.anchor.storageUrl) {
    throw new InkCandidateStateError("source_unavailable");
  }
  return {
    ...input,
    identitySnapshotId: state.identity.id,
    packageSnapshotId: state.package.id,
    expectedStateVersion: model.stateVersion,
    sourceAssetId: source.asset.id,
    sourceUrl: source.asset.storageUrl,
    sourceViewAngle: source.angle,
    anchorUrl: state.anchor.storageUrl,
    identityText: state.identity.identityText,
    features: Object.freeze(features.map((feature) => Object.freeze(feature))),
  };
}

export async function loadInkProjectionCandidatePreflight(input: {
  userId: number;
  modelId: number;
  operationId: string;
  operationKind: PreparedInkCandidateAttempt["operationKind"];
  targetViewAngle: CanonicalViewAngle;
}): Promise<InkProjectionCandidatePreflight> {
  return withTransaction((tx) => loadProjectionCandidatePreflightIn(tx, input));
}

async function rejectReadyProjectionCandidateForRetryIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    targetViewAngle: CanonicalViewAngle;
    operationId: string;
  },
): Promise<void> {
  const [candidate] = await tx
    .select()
    .from(castingEvidenceCandidates)
    .where(and(
      eq(castingEvidenceCandidates.userId, input.userId),
      eq(castingEvidenceCandidates.modelId, input.modelId),
      eq(castingEvidenceCandidates.targetViewAngle, input.targetViewAngle),
      eq(castingEvidenceCandidates.purpose, "feature_projection"),
      eq(castingEvidenceCandidates.status, "ready"),
      eq(castingEvidenceCandidates.activeSlot, "active"),
    ))
    .limit(1)
    .for("update");
  if (!candidate) throw new InkCandidateStateError("candidate_unavailable");
  const attempts = await tx
    .select()
    .from(castingEvidenceCandidateAttempts)
    .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id))
    .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
    .for("update");
  const storageItems = attempts.flatMap((attempt) => {
    const items: Array<{
      storageKey: string;
      storageBackend: "private_evidence_r2" | "public_r2";
    }> = [];
    if (attempt.privateStorageKey) {
      const parsed = parseEvidenceStorageKey(attempt.privateStorageKey);
      if (
        parsed.userId !== input.userId
        || parsed.modelId !== input.modelId
        || parsed.kind !== "candidate"
        || parsed.entityId !== attempt.privatePlateId
      ) {
        throw new InkCandidateStateError("attempt_unavailable");
      }
      items.push({
        storageKey: attempt.privateStorageKey,
        storageBackend: "private_evidence_r2",
      });
    }
    if (attempt.promotedPublicStorageKey) {
      const parsed = parseInkCandidatePublicStorageKey(
        attempt.promotedPublicStorageKey,
      );
      if (
        parsed.userId !== input.userId
        || parsed.modelId !== input.modelId
        || parsed.candidateId !== candidate.id
      ) {
        throw new InkCandidateStateError("attempt_unavailable");
      }
      items.push({
        storageKey: attempt.promotedPublicStorageKey,
        storageBackend: "public_r2",
      });
    }
    return items;
  });
  const manifest = await createStorageCleanupManifestIn(tx, {
    id: randomUUID(),
    userId: input.userId,
    operationId: randomUUID(),
    kind: "candidate_cleanup",
    storageItems,
  });
  if (attempts.length > 0) {
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "cleanup_pending", cleanupBatchId: manifest.id })
      .where(eq(castingEvidenceCandidateAttempts.candidateId, candidate.id));
  }
  const updated = await tx
    .update(castingEvidenceCandidates)
    .set({
      status: "rejected",
      activeSlot: null,
      cleanupBatchId: manifest.id,
      resolvedAt: new Date(),
      resolvedByOperationId: input.operationId,
    })
    .where(and(
      eq(castingEvidenceCandidates.id, candidate.id),
      eq(castingEvidenceCandidates.status, "ready"),
      eq(castingEvidenceCandidates.activeSlot, "active"),
    ));
  if (affectedRows(updated) !== 1) {
    throw new InkCandidateStateError("candidate_unavailable");
  }
}

export async function prepareInkProjectionCandidateGeneration(input: {
  preflight: InkProjectionCandidatePreflight;
  candidateId: string;
  attemptId: string;
  privatePlateId: string;
  observedCoverage: Readonly<
    Record<string, ObservedInkProjectionCoverage>
  >;
}): Promise<PreparedInkCandidateAttempt> {
  return withTransaction(async (tx) => {
    const current = await loadProjectionCandidatePreflightIn(
      tx,
      input.preflight,
    );
    if (
      current.identitySnapshotId !== input.preflight.identitySnapshotId
      || current.packageSnapshotId !== input.preflight.packageSnapshotId
      || current.expectedStateVersion !== input.preflight.expectedStateVersion
      || current.sourceAssetId !== input.preflight.sourceAssetId
      || current.sourceViewAngle !== input.preflight.sourceViewAngle
      || current.features.map((feature) => feature.featureVersionId).join(",")
        !== input.preflight.features
          .map((feature) => feature.featureVersionId)
          .join(",")
    ) {
      throw new InkCandidateStateError("snapshot_head_changed");
    }
    const observedKeys = Object.keys(input.observedCoverage).sort();
    const expectedObservedKeys = current.features
      .map((feature) => feature.featureVersionId)
      .sort();
    if (
      observedKeys.length !== expectedObservedKeys.length
      || observedKeys.some((key, index) => key !== expectedObservedKeys[index])
    ) {
      throw new InkCandidateStateError("source_unavailable");
    }
    if (current.operationKind === "evidence_candidate_retry") {
      await rejectReadyProjectionCandidateForRetryIn(tx, {
        ...current,
        operationId: current.operationId,
      });
    }
    const features = current.features.flatMap((feature) => {
      const observed = input.observedCoverage[feature.featureVersionId];
      if (!observed) {
        throw new InkCandidateStateError("source_unavailable");
      }
      if (
        observed.visible !== true
      ) {
        if (feature.impact === "affected") {
          throw new InkCandidateStateError("source_unavailable");
        }
        return [];
      }
      if (!observed.targetZones || observed.targetZones.length < 1) {
        throw new InkCandidateStateError("source_unavailable");
      }
      const isProjectionTarget = !feature.hasAcceptedTargetEvidence;
      return [{
        ...feature,
        targetZone: boundingInkZone(observed.targetZones),
        targetZones: observed.targetZones,
        isProjectionTarget,
        coverageBasis: isProjectionTarget
          ? feature.impact === "affected"
            ? "registry_affected" as const
            : "observed_visible" as const
          : null,
      }];
    });
    const targets = features.filter(
      (feature) => feature.isProjectionTarget && feature.coverageBasis,
    );
    if (targets.length < 1) {
      throw new InkCandidateStateError("source_unavailable");
    }
    await tx.insert(castingEvidenceCandidates).values({
      id: input.candidateId,
      userId: current.userId,
      modelId: current.modelId,
      intentId: null,
      originatingOperationId: current.operationId,
      capabilityKey: INK_ANYWHERE_CAPABILITY_KEY,
      activeSlot: "active",
      expectedStateVersion: current.expectedStateVersion,
      identitySnapshotId: current.identitySnapshotId,
      packageSnapshotId: current.packageSnapshotId,
      targetViewAngle: current.targetViewAngle,
      sourceAssetId: current.sourceAssetId,
      status: "processing",
      composerRecipeVersion: INK_ANYWHERE_PROJECTION_RECIPE_VERSION,
      probeRecipeVersion: INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION,
      purpose: "feature_projection",
    });
    await tx.insert(castingEvidenceCandidateFeatureTargets).values(
      targets.map((target) => ({
        id: randomUUID(),
        candidateId: input.candidateId,
        userId: current.userId,
        modelId: current.modelId,
        identitySnapshotId: current.identitySnapshotId,
        featureId: target.featureId,
        featureVersionId: target.featureVersionId,
        coverageBasis: target.coverageBasis!,
        coverageProbeRecipeVersion:
          target.coverageBasis === "observed_visible"
            ? INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION
            : null,
      })),
    );
    const attempt = await createAttemptIn(tx, {
      userId: current.userId,
      modelId: current.modelId,
      operationId: current.operationId,
      candidateId: input.candidateId,
      attemptId: input.attemptId,
      attemptNumber: 1,
      privatePlateId: input.privatePlateId,
      sourceViewAngle: current.targetViewAngle,
      composerRecipeVersion: INK_ANYWHERE_PROJECTION_RECIPE_VERSION,
      probeRecipeVersion: INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION,
      priceCredits: slotCost(current.targetViewAngle),
    });
    return {
      userId: current.userId,
      modelId: current.modelId,
      operationId: current.operationId,
      operationKind: current.operationKind,
      candidateId: input.candidateId,
      intentId: null,
      attemptId: input.attemptId,
      attemptNumber: 1,
      generationId: attempt.generationId,
      privatePlateId: input.privatePlateId,
      privateStorageKey: attempt.privateStorageKey,
      identitySnapshotId: current.identitySnapshotId,
      packageSnapshotId: current.packageSnapshotId,
      expectedStateVersion: current.expectedStateVersion,
      sourceAssetId: current.sourceAssetId,
      sourceUrl: current.sourceUrl,
      sourceViewAngle: current.sourceViewAngle,
      anchorUrl: current.anchorUrl,
      identityText: current.identityText,
      authority: {
        kind: "projection_v2",
        capabilityKey: INK_ANYWHERE_CAPABILITY_KEY,
        ontologyVersion: INK_ANYWHERE_ONTOLOGY_VERSION,
        targetAngle: current.targetViewAngle,
        sourceAngle: current.sourceViewAngle,
        composerRecipeVersion: INK_ANYWHERE_PROJECTION_RECIPE_VERSION,
        probeRecipeVersion: INK_ANYWHERE_PROJECTION_PROBE_RECIPE_VERSION,
        visibilityRecipeVersion: INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION,
        features: Object.freeze(features.map((feature) =>
          Object.freeze(feature)
        )),
      },
      normalizedDescriptor: "selected tattoo projection",
      reference: null,
    };
  });
}

/**
 * Reserve the complete paid episode and its first exact-key attempt while the
 * model/operation lock is held. No provider, storage, or credit work happens
 * in this transaction.
 */
export async function prepareInkCandidateGeneration(input: {
  userId: number;
  modelId: number;
  intentId: string;
  operationId: string;
  operationKind: PreparedInkCandidateAttempt["operationKind"];
  candidateId: string;
  attemptId: string;
  privatePlateId: string;
}): Promise<PreparedInkCandidateAttempt> {
  return withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input);
    const operation = await lockRunningOperationIn(
      tx,
      input,
      INK_ADD_PRICE_CREDITS,
    );

    let state;
    try {
      state = buildEffectiveCastState({
        ...(await readSnapshotShadowStateIn(tx, input)),
        model,
      });
    } catch {
      throw new InkCandidateStateError("snapshot_head_changed");
    }
    if (state.status !== "current" || !state.identity || !state.package) {
      throw new InkCandidateStateError("snapshot_head_changed");
    }
    assertOperationHead(operation, {
      stateVersion: model.stateVersion,
      identitySnapshotId: state.identity.id,
      packageSnapshotId: state.package.id,
    });

    const [activeCandidate] = await tx
      .select({ id: castingEvidenceCandidates.id })
      .from(castingEvidenceCandidates)
      .where(and(
        eq(castingEvidenceCandidates.intentId, input.intentId),
        eq(castingEvidenceCandidates.activeSlot, "active"),
      ))
      .limit(1)
      .for("update");
    if (input.operationKind === "evidence_candidate_retry") {
      if (!activeCandidate) {
        throw new InkCandidateStateError("candidate_unavailable");
      }
      await rejectReadyCandidateForRetryIn(tx, input);
    } else if (activeCandidate) {
      throw new InkCandidateStateError("candidate_already_active");
    }

    const [intent] = await tx
      .select()
      .from(modelIdentityFeatureIntents)
      .where(and(
        eq(modelIdentityFeatureIntents.id, input.intentId),
        eq(modelIdentityFeatureIntents.userId, input.userId),
        eq(modelIdentityFeatureIntents.modelId, input.modelId),
        eq(modelIdentityFeatureIntents.status, "pending"),
      ))
      .limit(1)
      .for("update");
    if (!intent || !intent.normalizedDescriptor) {
      throw new InkCandidateStateError("intent_unavailable");
    }
    if (intent.identitySnapshotId !== state.identity.id) {
      throw new InkCandidateStateError("source_unavailable");
    }
    let source: typeof state.selectedViews[number] | undefined;
    let authority: PreparedInkCandidateAttempt["authority"];
    if (intent.capabilityKey === INK_ADD_CAPABILITY_KEY) {
      if (
        intent.activeCapabilityKey !== INK_ADD_CAPABILITY_KEY
        || intent.ontologyVersion !== INK_ADD_ONTOLOGY_VERSION
        || intent.zone !== INK_ADD_ZONE
        || intent.surface !== INK_ADD_SURFACE
      ) {
        throw new InkCandidateStateError("intent_unavailable");
      }
      try {
        assertInkAddSide(intent.side);
      } catch {
        throw new InkCandidateStateError("intent_unavailable");
      }
      source = state.selectedViews.find(
        (view) => view.angle === INK_ADD_TARGET_VIEW,
      );
      if (intent.sourceAssetId !== source?.asset.id) {
        throw new InkCandidateStateError("source_unavailable");
      }
      authority = {
        kind: "legacy_v1",
        capabilityKey: INK_ADD_CAPABILITY_KEY,
        ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
        anatomy: {
          zone: INK_ADD_ZONE,
          surface: INK_ADD_SURFACE,
          side: intent.side,
        },
        normalizedTargetZone: FRONT_UPPER_TORSO_ZONES[intent.side],
        composerRecipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
        probeRecipeVersion: INK_ADD_PROBE_RECIPE_VERSION,
        visibilityRecipeVersion: INK_ADD_VISIBILITY_RECIPE_VERSION,
      };
    } else if (intent.capabilityKey === INK_ANYWHERE_CAPABILITY_KEY) {
      if (
        intent.activeCapabilityKey !== INK_ACTIVE_FAMILY_KEY
        || intent.ontologyVersion !== INK_ANYWHERE_ONTOLOGY_VERSION
      ) {
        throw new InkCandidateStateError("intent_unavailable");
      }
      const anatomy = {
        zone: intent.zone,
        surface: intent.surface,
        side: intent.side,
      };
      try {
        assertSupportedInkAnatomyTuple(anatomy);
      } catch {
        throw new InkCandidateStateError("intent_unavailable");
      }
      const choice = chooseCurrentInkAuthoringSource(
        anatomy,
        state.selectedViews.map((view) => ({
          angle: view.angle,
          assetId: view.asset.id,
          compatibility: view.compatibility,
          pinned: Boolean(view.asset.pinned),
        })),
      );
      if (!choice) {
        throw new InkCandidateStateError("source_unavailable");
      }
      source = state.selectedViews.find(
        (view) => view.angle === choice.angle
          && view.asset.id === choice.assetId,
      );
      const directive = inkViewDirectiveV2(anatomy, choice.angle);
      if (!directive.normalizedTargetZone) {
        throw new InkCandidateStateError("source_unavailable");
      }
      authority = {
        kind: "anywhere_v2",
        capabilityKey: INK_ANYWHERE_CAPABILITY_KEY,
        ontologyVersion: INK_ANYWHERE_ONTOLOGY_VERSION,
        anatomy,
        normalizedTargetZone: directive.normalizedTargetZone,
        composerRecipeVersion: INK_ANYWHERE_COMPOSER_RECIPE_VERSION,
        probeRecipeVersion: INK_ANYWHERE_PROBE_RECIPE_VERSION,
        visibilityRecipeVersion: INK_ANYWHERE_VISIBILITY_RECIPE_VERSION,
      };
    } else {
      throw new InkCandidateStateError("intent_unavailable");
    }
    if (
      !source
      || source.compatibility !== "current"
      || !source.asset.storageUrl
      || !state.anchor.storageUrl
    ) {
      throw new InkCandidateStateError("source_unavailable");
    }
    if (authority.kind === "legacy_v1") {
      const [selectedFeature] = await tx
        .select({ id: modelSnapshotFeatureSelections.id })
        .from(modelSnapshotFeatureSelections)
        .where(and(
          eq(modelSnapshotFeatureSelections.modelId, input.modelId),
          eq(modelSnapshotFeatureSelections.identitySnapshotId, state.identity.id),
        ))
        .limit(1)
        .for("update");
      if (selectedFeature) {
        throw new InkCandidateStateError("feature_already_selected");
      }
    }
    if (
      intent.expectedStateVersion !== model.stateVersion
      || intent.packageSnapshotId !== state.package.id
      || intent.sourceAssetId !== source.asset.id
    ) {
      const rebased = await tx
        .update(modelIdentityFeatureIntents)
        .set({
          expectedStateVersion: model.stateVersion,
          packageSnapshotId: state.package.id,
          sourceAssetId: source.asset.id,
        })
        .where(and(
          eq(modelIdentityFeatureIntents.id, intent.id),
          eq(modelIdentityFeatureIntents.status, "pending"),
          eq(modelIdentityFeatureIntents.identitySnapshotId, state.identity.id),
        ));
      if (affectedRows(rebased) !== 1) {
        throw new InkCandidateStateError("snapshot_head_changed");
      }
    }
    const [reference] = await tx
      .select()
      .from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.featureIntentId, intent.id),
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, input.modelId),
      ))
      .limit(1)
      .for("update");

    await tx.insert(castingEvidenceCandidates).values({
      id: input.candidateId,
      userId: input.userId,
      modelId: input.modelId,
      intentId: intent.id,
      originatingOperationId: input.operationId,
      capabilityKey: authority.capabilityKey,
      activeSlot: "active",
      expectedStateVersion: model.stateVersion,
      identitySnapshotId: state.identity.id,
      packageSnapshotId: state.package.id,
      targetViewAngle: source.angle,
      sourceAssetId: source.asset.id,
      status: "processing",
      composerRecipeVersion: authority.composerRecipeVersion,
      probeRecipeVersion: authority.probeRecipeVersion,
      purpose: "feature_authoring",
    });
    const attempt = await createAttemptIn(tx, {
      ...input,
      attemptNumber: 1,
      sourceViewAngle: source.angle,
      composerRecipeVersion: authority.composerRecipeVersion,
      probeRecipeVersion: authority.probeRecipeVersion,
      priceCredits: INK_ADD_PRICE_CREDITS,
    });
    return {
      ...input,
      attemptNumber: 1,
      generationId: attempt.generationId,
      privateStorageKey: attempt.privateStorageKey,
      identitySnapshotId: state.identity.id,
      packageSnapshotId: state.package.id,
      expectedStateVersion: model.stateVersion,
      sourceAssetId: source.asset.id,
      sourceUrl: source.asset.storageUrl,
      sourceViewAngle: source.angle,
      anchorUrl: state.anchor.storageUrl,
      identityText: state.identity.identityText,
      authority,
      normalizedDescriptor: intent.normalizedDescriptor,
      reference: reference
        ? {
            plateId: reference.id,
            storageKey: reference.storageKey,
            byteSize: reference.byteSize,
            contentHash: reference.contentHash,
          }
        : null,
    };
  });
}

export async function markInkCandidateAttemptGenerating(
  input: Pick<
    PreparedInkCandidateAttempt,
    "userId" | "modelId" | "operationId" | "candidateId" | "attemptId" | "generationId"
  >,
): Promise<void> {
  await withTransaction(async (tx) => {
    await lockOwnedDraftModelIn(tx, input);
    const attempt = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "generating" })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.candidateId),
        eq(castingEvidenceCandidateAttempts.generationId, input.generationId),
        eq(castingEvidenceCandidateAttempts.status, "planned"),
      ));
    if (affectedRows(attempt) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
    const generation = await tx
      .update(generations)
      .set({ status: "processing" })
      .where(and(
        eq(generations.id, input.generationId),
        eq(generations.operationId, input.operationId),
        eq(generations.status, "pending"),
      ));
    if (affectedRows(generation) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
  });
}

export async function markInkCandidateAttemptStored(input: {
  prepared: PreparedInkCandidateAttempt;
  image: {
    mime: "image/webp";
    width: number;
    height: number;
    byteSize: number;
    contentHash: string;
  };
}): Promise<void> {
  await withTransaction(async (tx) => {
    await lockOwnedDraftModelIn(tx, input.prepared);
    const updated = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({
        status: "stored",
        mime: input.image.mime,
        width: input.image.width,
        height: input.image.height,
        byteSize: input.image.byteSize,
        contentHash: input.image.contentHash,
        storedAt: new Date(),
      })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.prepared.candidateId),
        eq(castingEvidenceCandidateAttempts.status, "generating"),
        eq(
          castingEvidenceCandidateAttempts.privateStorageKey,
          input.prepared.privateStorageKey,
        ),
      ));
    if (affectedRows(updated) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
  });
}

function probeFields(probe: InkCandidateProbeTruth) {
  return {
    predictedVisibility: probe.predictedVisibility,
    identityOutcome: probe.identityOutcome,
    placementOutcome: probe.placementOutcome,
    featureMatchOutcome: probe.featureMatchOutcome,
    priorInkOutcome: probe.priorInkOutcome,
    poseFramingOutcome: probe.poseFramingOutcome,
    unexpectedInkOutcome: probe.unexpectedInkOutcome,
    overallOutcome: probe.overallOutcome,
    probedAt: new Date(),
  };
}

export async function prepareIncludedInkCandidateRetry(input: {
  prepared: PreparedInkCandidateAttempt;
  probe: InkCandidateProbeTruth;
  attemptId: string;
  privatePlateId: string;
}): Promise<PreparedInkCandidateAttempt> {
  return withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input.prepared);
    const operation = await lockRunningOperationIn(
      tx,
      input.prepared,
      plannedCreditsForPrepared(input.prepared),
    );
    assertOperationHead(operation, {
      stateVersion: model.stateVersion,
      identitySnapshotId: input.prepared.identitySnapshotId,
      packageSnapshotId: input.prepared.packageSnapshotId,
    });
    const failed = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "probe_failed", ...probeFields(input.probe) })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.prepared.candidateId),
        eq(castingEvidenceCandidateAttempts.status, "stored"),
      ));
    if (affectedRows(failed) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
    await tx
      .update(generations)
      .set({
        status: "failed",
        errorMessage: "Candidate validation did not pass.",
        completedAt: new Date(),
      })
      .where(eq(generations.id, input.prepared.generationId));
    const cleanup = await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.prepared.userId,
      operationId: randomUUID(),
      kind: "candidate_cleanup",
      storageItems: [{
        storageKey: input.prepared.privateStorageKey,
        storageBackend: "private_evidence_r2",
      }],
    });
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "cleanup_pending", cleanupBatchId: cleanup.id })
      .where(eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId));
    const attempt = await createAttemptIn(tx, {
      userId: input.prepared.userId,
      modelId: input.prepared.modelId,
      operationId: input.prepared.operationId,
      candidateId: input.prepared.candidateId,
      attemptId: input.attemptId,
      attemptNumber: 2,
      privatePlateId: input.privatePlateId,
      sourceViewAngle: input.prepared.sourceViewAngle,
      composerRecipeVersion:
        input.prepared.authority.composerRecipeVersion,
      probeRecipeVersion: input.prepared.authority.probeRecipeVersion,
      priceCredits: plannedCreditsForPrepared(input.prepared),
    });
    return {
      ...input.prepared,
      attemptId: input.attemptId,
      attemptNumber: 2,
      generationId: attempt.generationId,
      privatePlateId: input.privatePlateId,
      privateStorageKey: attempt.privateStorageKey,
    };
  });
}

export async function completeInkCandidateReady(input: {
  prepared: PreparedInkCandidateAttempt;
  probe: InkCandidateProbeTruth;
  expiresAt: Date;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const model = await lockOwnedDraftModelIn(tx, input.prepared);
    const operation = await lockRunningOperationIn(
      tx,
      input.prepared,
      plannedCreditsForPrepared(input.prepared),
    );
    assertOperationHead(operation, {
      stateVersion: model.stateVersion,
      identitySnapshotId: input.prepared.identitySnapshotId,
      packageSnapshotId: input.prepared.packageSnapshotId,
    });
    const attempt = await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "probe_passed", ...probeFields(input.probe) })
      .where(and(
        eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
        eq(castingEvidenceCandidateAttempts.candidateId, input.prepared.candidateId),
        eq(castingEvidenceCandidateAttempts.status, "stored"),
        isNull(castingEvidenceCandidateAttempts.overallOutcome),
      ));
    if (affectedRows(attempt) !== 1) {
      throw new InkCandidateStateError("attempt_state_changed");
    }
    const candidate = await tx
      .update(castingEvidenceCandidates)
      .set({
        status: "ready",
        readyAttemptId: input.prepared.attemptId,
        expiresAt: input.expiresAt,
      })
      .where(and(
        eq(castingEvidenceCandidates.id, input.prepared.candidateId),
        eq(castingEvidenceCandidates.userId, input.prepared.userId),
        eq(castingEvidenceCandidates.modelId, input.prepared.modelId),
        eq(castingEvidenceCandidates.status, "processing"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
        eq(
          castingEvidenceCandidates.expectedStateVersion,
          input.prepared.expectedStateVersion,
        ),
        eq(
          castingEvidenceCandidates.identitySnapshotId,
          input.prepared.identitySnapshotId,
        ),
        eq(
          castingEvidenceCandidates.packageSnapshotId,
          input.prepared.packageSnapshotId,
        ),
      ));
    if (affectedRows(candidate) !== 1) {
      throw new InkCandidateStateError("candidate_unavailable");
    }
    await tx
      .update(generations)
      .set({ status: "completed", resultUrl: null, completedAt: new Date() })
      .where(eq(generations.id, input.prepared.generationId));
  });
}

export async function invalidateInkCandidate(input: {
  prepared: PreparedInkCandidateAttempt;
  probe?: InkCandidateProbeTruth;
  publicError: string;
}): Promise<void> {
  await withTransaction(async (tx) => {
    await lockOwnedDraftModelIn(tx, input.prepared);
    const attempts = await tx
      .select()
      .from(castingEvidenceCandidateAttempts)
      .where(eq(
        castingEvidenceCandidateAttempts.candidateId,
        input.prepared.candidateId,
      ))
      .orderBy(asc(castingEvidenceCandidateAttempts.attemptNumber))
      .for("update");
    if (input.probe) {
      await tx
        .update(castingEvidenceCandidateAttempts)
        .set({
          status: input.probe.overallOutcome === "unknown"
            ? "probe_unknown"
            : "probe_failed",
          ...probeFields(input.probe),
        })
        .where(and(
          eq(castingEvidenceCandidateAttempts.id, input.prepared.attemptId),
          eq(castingEvidenceCandidateAttempts.status, "stored"),
        ));
    }
    const storageItems = attempts
      .filter((attempt) => attempt.privateStorageKey !== null)
      .map((attempt) => ({
        storageKey: attempt.privateStorageKey!,
        storageBackend: "private_evidence_r2" as const,
      }));
    const cleanup = await createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.prepared.userId,
      operationId: randomUUID(),
      kind: "candidate_cleanup",
      storageItems,
    });
    await tx
      .update(castingEvidenceCandidateAttempts)
      .set({ status: "cleanup_pending", cleanupBatchId: cleanup.id })
      .where(eq(
        castingEvidenceCandidateAttempts.candidateId,
        input.prepared.candidateId,
      ));
    const generationIds = attempts
      .map((attempt) => attempt.generationId)
      .filter((id): id is number => id !== null);
    if (generationIds.length > 0) {
      await tx
        .update(generations)
        .set({
          status: "failed",
          resultUrl: null,
          errorMessage: input.publicError,
          completedAt: new Date(),
        })
        .where(and(
          inArray(generations.id, generationIds),
          inArray(generations.status, ["pending", "processing"]),
        ));
    }
    const candidate = await tx
      .update(castingEvidenceCandidates)
      .set({
        status: "invalid",
        activeSlot: null,
        cleanupBatchId: cleanup.id,
        resolvedAt: new Date(),
        resolvedByOperationId: input.prepared.operationId,
      })
      .where(and(
        eq(castingEvidenceCandidates.id, input.prepared.candidateId),
        eq(castingEvidenceCandidates.status, "processing"),
        eq(castingEvidenceCandidates.activeSlot, "active"),
      ));
    if (affectedRows(candidate) !== 1) {
      throw new InkCandidateStateError("candidate_unavailable");
    }
  });
}

export async function findActiveOwnedInkCandidate(input: {
  userId: number;
  intentId: string;
}): Promise<{
  id: string;
  status: "processing" | "ready";
  expiresAt: Date | null;
} | null> {
  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        id: castingEvidenceCandidates.id,
        status: castingEvidenceCandidates.status,
        expiresAt: castingEvidenceCandidates.expiresAt,
      })
      .from(castingEvidenceCandidates)
      .innerJoin(models, and(
        eq(models.id, castingEvidenceCandidates.modelId),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ))
      .where(and(
        eq(castingEvidenceCandidates.userId, input.userId),
        eq(castingEvidenceCandidates.intentId, input.intentId),
        eq(castingEvidenceCandidates.activeSlot, "active"),
      ))
      .limit(1);
    if (!row || (row.status !== "processing" && row.status !== "ready")) {
      return null;
    }
    return {
      id: row.id,
      status: row.status,
      expiresAt: row.expiresAt,
    } as {
      id: string;
      status: "processing" | "ready";
      expiresAt: Date | null;
    };
  });
}


export async function findActiveOwnedInkProjectionCandidate(input: {
  userId: number;
  modelId: number;
}): Promise<{
  id: string;
  status: "processing" | "ready";
  targetViewAngle: CanonicalViewAngle;
  expiresAt: Date | null;
} | null> {
  return withTransaction(async (tx) => {
    const [row] = await tx
      .select({
        id: castingEvidenceCandidates.id,
        status: castingEvidenceCandidates.status,
        targetViewAngle: castingEvidenceCandidates.targetViewAngle,
        expiresAt: castingEvidenceCandidates.expiresAt,
      })
      .from(castingEvidenceCandidates)
      .innerJoin(models, and(
        eq(models.id, castingEvidenceCandidates.modelId),
        eq(models.userId, input.userId),
        availableModelWhere(),
      ))
      .where(and(
        eq(castingEvidenceCandidates.userId, input.userId),
        eq(castingEvidenceCandidates.modelId, input.modelId),
        eq(castingEvidenceCandidates.purpose, "feature_projection"),
        isNull(castingEvidenceCandidates.intentId),
        eq(castingEvidenceCandidates.activeSlot, "active"),
      ))
      .limit(1);
    if (!row || (row.status !== "processing" && row.status !== "ready")) {
      return null;
    }
    return {
      id: row.id,
      status: row.status,
      targetViewAngle: row.targetViewAngle,
      expiresAt: row.expiresAt,
    };
  });
}
