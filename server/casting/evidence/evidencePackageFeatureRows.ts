import { and, eq, inArray } from "drizzle-orm";
import {
  castingEvidenceCandidates,
  modelAssets,
  modelIdentityFeatureIntents,
  modelIdentityFeatureProjectionEvidence,
  modelIdentityFeatures,
  modelIdentityFeatureVersions,
  modelReferencePlates,
  modelSnapshotFeatureSelections,
} from "../../../drizzle/schema";
import type { TransactionHandle } from "../../db/connection";
import type { EvidencePackageFeatureGraph } from "./evidencePackagePlan";

/**
 * Low-level feature-graph read shared by locked execution and atomic
 * settlement. It deliberately imports no effective-state or package writer,
 * keeping the snapshot transition boundary free of circular dependencies.
 */
export async function readEvidencePackageFeatureRowsIn(
  tx: TransactionHandle,
  input: {
    userId: number;
    modelId: number;
    identitySnapshotId: string;
  },
): Promise<{
  graph: EvidencePackageFeatureGraph;
  hasUnresolvedIntentOrReadyCandidate: boolean;
}> {
  const selections = await tx
    .select()
    .from(modelSnapshotFeatureSelections)
    .where(and(
      eq(modelSnapshotFeatureSelections.modelId, input.modelId),
      eq(
        modelSnapshotFeatureSelections.identitySnapshotId,
        input.identitySnapshotId,
      ),
    ));
  const featureIds = selections.map((selection) => selection.featureId);
  const versionIds = selections.map((selection) => selection.featureVersionId);
  const features = featureIds.length
    ? await tx
      .select()
      .from(modelIdentityFeatures)
      .where(and(
        eq(modelIdentityFeatures.modelId, input.modelId),
        inArray(modelIdentityFeatures.id, featureIds),
      ))
    : [];
  const versions = versionIds.length
    ? await tx
      .select()
      .from(modelIdentityFeatureVersions)
      .where(and(
        eq(modelIdentityFeatureVersions.modelId, input.modelId),
        inArray(modelIdentityFeatureVersions.id, versionIds),
      ))
    : [];
  const projections = versionIds.length
    ? await tx
      .select()
      .from(modelIdentityFeatureProjectionEvidence)
      .where(and(
        eq(modelIdentityFeatureProjectionEvidence.userId, input.userId),
        eq(modelIdentityFeatureProjectionEvidence.modelId, input.modelId),
        inArray(
          modelIdentityFeatureProjectionEvidence.featureVersionId,
          versionIds,
        ),
      ))
    : [];
  const plateIds = Array.from(new Set([
    ...versions.map((version) => version.acceptedCandidatePlateId),
    ...projections.map((projection) => projection.acceptedCandidatePlateId),
  ]));
  const plates = plateIds.length
    ? await tx
      .select()
      .from(modelReferencePlates)
      .where(and(
        eq(modelReferencePlates.userId, input.userId),
        eq(modelReferencePlates.modelId, input.modelId),
        inArray(modelReferencePlates.id, plateIds),
      ))
    : [];
  const assetIds = Array.from(new Set([
    ...versions
      .map((version) => version.acceptedAssetId)
      .filter((id): id is number => id !== null),
    ...versions
      .map((version) => version.sourceAssetId)
      .filter((id): id is number => id !== null),
    ...projections.map((projection) => projection.acceptedAssetId),
    ...projections
      .map((projection) => projection.sourceAssetId)
      .filter((id): id is number => id !== null),
  ]));
  const assets = assetIds.length
    ? await tx
      .select()
      .from(modelAssets)
      .where(and(
        eq(modelAssets.modelId, input.modelId),
        inArray(modelAssets.id, assetIds),
      ))
    : [];
  const [pendingIntent] = await tx
    .select({ id: modelIdentityFeatureIntents.id })
    .from(modelIdentityFeatureIntents)
    .where(and(
      eq(modelIdentityFeatureIntents.userId, input.userId),
      eq(modelIdentityFeatureIntents.modelId, input.modelId),
      eq(modelIdentityFeatureIntents.category, "ink"),
      eq(modelIdentityFeatureIntents.status, "pending"),
    ))
    .limit(1);
  const [activeCandidate] = await tx
    .select({ id: castingEvidenceCandidates.id })
    .from(castingEvidenceCandidates)
    .where(and(
      eq(castingEvidenceCandidates.userId, input.userId),
      eq(castingEvidenceCandidates.modelId, input.modelId),
      inArray(castingEvidenceCandidates.status, ["processing", "ready"]),
    ))
    .limit(1);
  return {
    graph: {
      userId: input.userId,
      modelId: input.modelId,
      identitySnapshotId: input.identitySnapshotId,
      selections,
      features,
      versions,
      plates,
      projections,
      assets,
    },
    hasUnresolvedIntentOrReadyCandidate: !!pendingIntent || !!activeCandidate,
  };
}
