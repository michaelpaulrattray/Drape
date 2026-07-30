import type {
  ModelAsset,
  ModelIdentityFeature,
  ModelIdentityFeatureProjectionEvidence,
  ModelIdentityFeatureVersion,
  ModelReferencePlate,
  ModelSnapshotFeatureSelection,
} from "../../../drizzle/schema";
import {
  MAX_EVIDENCE_CANONICAL_BYTES,
  MAX_EVIDENCE_DIMENSION,
  MAX_EVIDENCE_PIXELS,
  MIN_EVIDENCE_DIMENSION,
} from "./imageValidation";
import { parseEvidenceStorageKey } from "./evidenceDelivery";
import {
  INK_ADD_COMPOSER_RECIPE_VERSION,
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SURFACE,
  INK_ADD_TARGET_VIEW,
  INK_ADD_ZONE,
  INK_ADD_SIDES,
} from "./composer/inkAddRecipe";
import {
  INK_ANYWHERE_ONTOLOGY_VERSION,
  INK_ANYWHERE_READABLE_COMPOSER_RECIPE_VERSIONS,
  INK_ANYWHERE_READABLE_PROJECTION_RECIPE_VERSIONS,
  inkAuthoringSourcePreferences,
  inkViewDirectiveV2,
  isSupportedInkAnatomyTuple,
  type InkAnatomyTuple,
} from "./inkAnatomyRegistry";
import type { EvidencePackageFeatureGraph } from "./evidencePackagePlan";

export interface ClosedInkFeatureEntry {
  selection: ModelSnapshotFeatureSelection;
  feature: ModelIdentityFeature;
  version: ModelIdentityFeatureVersion;
  authoringPlate: ModelReferencePlate;
  authoringAsset: ModelAsset;
  projections: readonly {
    evidence: ModelIdentityFeatureProjectionEvidence;
    plate: ModelReferencePlate;
    asset: ModelAsset;
  }[];
  contract: "legacy_front_upper_torso_v1" | "all_body_v2";
}

export interface ClosedInkFeatureGraph {
  entries: readonly ClosedInkFeatureEntry[];
}

function positiveId(value: number | null | undefined): value is number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0;
}

function uniqueNonEmpty(values: readonly string[]): boolean {
  return values.length > 0 && new Set(values).size === values.length;
}

function validPlate(
  graph: EvidencePackageFeatureGraph,
  plate: ModelReferencePlate,
): boolean {
  let parsed;
  try {
    parsed = parseEvidenceStorageKey(plate.storageKey);
  } catch {
    return false;
  }
  return plate.userId === graph.userId
    && plate.modelId === graph.modelId
    && plate.kind === "accepted_candidate"
    && parsed.userId === graph.userId
    && parsed.modelId === graph.modelId
    && plate.mime === "image/webp"
    && Number.isSafeInteger(plate.byteSize)
    && plate.byteSize > 0
    && plate.byteSize <= MAX_EVIDENCE_CANONICAL_BYTES
    && /^[0-9a-f]{64}$/.test(plate.contentHash)
    && Number.isSafeInteger(plate.width)
    && Number.isSafeInteger(plate.height)
    && plate.width >= MIN_EVIDENCE_DIMENSION
    && plate.height >= MIN_EVIDENCE_DIMENSION
    && plate.width <= MAX_EVIDENCE_DIMENSION
    && plate.height <= MAX_EVIDENCE_DIMENSION
    && plate.width * plate.height <= MAX_EVIDENCE_PIXELS;
}

function validAsset(
  graph: EvidencePackageFeatureGraph,
  asset: ModelAsset,
  expectedAngle: string,
): boolean {
  return positiveId(asset.id)
    && asset.modelId === graph.modelId
    && asset.viewType === expectedAngle
    && asset.resolution === "1K"
    && typeof asset.storageUrl === "string"
    && asset.storageUrl.length > 0;
}

function contractForVersion(
  version: ModelIdentityFeatureVersion,
): "legacy_front_upper_torso_v1" | "all_body_v2" | null {
  if (
    version.ontologyVersion === INK_ADD_ONTOLOGY_VERSION
    && version.zone === INK_ADD_ZONE
    && version.surface === INK_ADD_SURFACE
    && (INK_ADD_SIDES as readonly string[]).includes(version.side)
    && version.sourceViewAngle === INK_ADD_TARGET_VIEW
    && version.recipeVersion === INK_ADD_COMPOSER_RECIPE_VERSION
  ) {
    return "legacy_front_upper_torso_v1";
  }
  const anatomy = {
    zone: version.zone,
    surface: version.surface,
    side: version.side,
  };
  if (
    version.ontologyVersion !== INK_ANYWHERE_ONTOLOGY_VERSION
    || !(INK_ANYWHERE_READABLE_COMPOSER_RECIPE_VERSIONS as readonly string[])
      .includes(version.recipeVersion)
    || !isSupportedInkAnatomyTuple(anatomy)
  ) {
    return null;
  }
  const allowedSources = inkAuthoringSourcePreferences(
    anatomy as InkAnatomyTuple,
  ).map((preference) => preference.angle);
  return allowedSources.includes(version.sourceViewAngle)
    ? "all_body_v2"
    : null;
}

/**
 * Positive closure for an arbitrary selected tattoo set. Every selected row
 * and every accepted evidence/asset witness must join exactly; unknown or
 * partial graphs return null rather than degrading to best-effort prompts.
 */
export function assessClosedInkFeatureGraph(
  graph: EvidencePackageFeatureGraph,
): ClosedInkFeatureGraph | null {
  if (
    !positiveId(graph.userId)
    || !positiveId(graph.modelId)
    || !graph.identitySnapshotId
    || !uniqueNonEmpty(graph.selections.map((row) => row.id))
    || !uniqueNonEmpty(graph.selections.map((row) => row.featureId))
    || !uniqueNonEmpty(graph.selections.map((row) => row.featureVersionId))
    || graph.features.length !== graph.selections.length
    || graph.versions.length !== graph.selections.length
    || !graph.projections
    || !graph.assets
  ) {
    return null;
  }

  const features = new Map(graph.features.map((row) => [row.id, row]));
  const versions = new Map(graph.versions.map((row) => [row.id, row]));
  const plates = new Map(graph.plates.map((row) => [row.id, row]));
  const assets = new Map(graph.assets.map((row) => [row.id, row]));
  if (
    features.size !== graph.features.length
    || versions.size !== graph.versions.length
    || plates.size !== graph.plates.length
    || assets.size !== graph.assets.length
  ) {
    return null;
  }

  const projectionIds = graph.projections.map((row) => row.id);
  const projectionOperationSteps = graph.projections.map(
    (row) => `${row.createdByOperationId}:${row.createdByOperationStepKey}`,
  );
  const projectionVersionAngles = graph.projections.map(
    (row) => `${row.featureVersionId}:${row.targetViewAngle}`,
  );
  if (
    (projectionIds.length > 0 && new Set(projectionIds).size !== projectionIds.length)
    || new Set(projectionOperationSteps).size !== projectionOperationSteps.length
    || new Set(projectionVersionAngles).size !== projectionVersionAngles.length
  ) {
    return null;
  }

  const authoringPlateIds = graph.versions.map(
    (version) => version.acceptedCandidatePlateId,
  );
  const authoringAssetIds = graph.versions.map(
    (version) => version.acceptedAssetId,
  );
  if (
    !uniqueNonEmpty(authoringPlateIds)
    || authoringAssetIds.some((id) => !positiveId(id))
    || new Set(authoringAssetIds).size !== authoringAssetIds.length
  ) {
    return null;
  }
  const authoringPlateIdSet = new Set(authoringPlateIds);
  const authoringAssetIdSet = new Set(authoringAssetIds as number[]);
  const referencedPlateIds = new Set<string>();
  const referencedAssetIds = new Set<number>();
  const projectionWitnessByPlate = new Map<string, string>();
  const projectionWitnessByAsset = new Map<number, string>();
  const entries: ClosedInkFeatureEntry[] = [];
  for (const selection of graph.selections) {
    const feature = features.get(selection.featureId);
    const version = versions.get(selection.featureVersionId);
    if (
      selection.modelId !== graph.modelId
      || selection.identitySnapshotId !== graph.identitySnapshotId
      || !feature
      || !version
      || feature.modelId !== graph.modelId
      || feature.category !== "ink"
      || version.modelId !== graph.modelId
      || version.featureId !== feature.id
      || version.operation !== "present"
      || !positiveId(version.acceptedAssetId)
      || (
        version.sourceAssetId !== null
        && (
          !positiveId(version.sourceAssetId)
          || version.sourceAssetId === version.acceptedAssetId
        )
      )
    ) {
      return null;
    }
    const contract = contractForVersion(version);
    const authoringPlate = plates.get(version.acceptedCandidatePlateId);
    const authoringAsset = assets.get(version.acceptedAssetId);
    if (
      !contract
      || !authoringPlate
      || !authoringAsset
      || !validPlate(graph, authoringPlate)
      || !validAsset(graph, authoringAsset, version.sourceViewAngle)
    ) {
      return null;
    }
    referencedPlateIds.add(authoringPlate.id);
    referencedAssetIds.add(authoringAsset.id);

    const projections = graph.projections
      .filter((row) => row.featureVersionId === version.id);
    if (contract === "legacy_front_upper_torso_v1" && projections.length > 0) {
      return null;
    }
    const closedProjections: ClosedInkFeatureEntry["projections"][number][] = [];
    for (const evidence of projections) {
      const plate = plates.get(evidence.acceptedCandidatePlateId);
      const asset = assets.get(evidence.acceptedAssetId);
      const anatomy = {
        zone: version.zone,
        surface: version.surface,
        side: version.side,
      } as InkAnatomyTuple;
      if (
        contract !== "all_body_v2"
        || evidence.userId !== graph.userId
        || evidence.modelId !== graph.modelId
        || evidence.featureId !== feature.id
        || !INK_ANYWHERE_READABLE_PROJECTION_RECIPE_VERSIONS.some(
          (recipeVersion) => recipeVersion === evidence.recipeVersion,
        )
        || evidence.targetViewAngle === version.sourceViewAngle
        || inkViewDirectiveV2(anatomy, evidence.targetViewAngle).impact
          !== "affected"
        || !positiveId(evidence.acceptedAssetId)
        || (
          evidence.sourceAssetId !== null
          && (
            !positiveId(evidence.sourceAssetId)
            || evidence.sourceAssetId === evidence.acceptedAssetId
          )
        )
        || !plate
        || !asset
        || !validPlate(graph, plate)
        || !validAsset(graph, asset, evidence.targetViewAngle)
        || authoringPlateIdSet.has(plate.id)
        || authoringAssetIdSet.has(asset.id)
      ) {
        return null;
      }
      const witnessKey = JSON.stringify([
        evidence.targetViewAngle,
        evidence.sourceAssetId,
        evidence.acceptedAssetId,
        evidence.acceptedCandidatePlateId,
        evidence.recipeVersion,
        evidence.createdByOperationId,
      ]);
      const plateWitness = projectionWitnessByPlate.get(plate.id);
      const assetWitness = projectionWitnessByAsset.get(asset.id);
      if (
        (plateWitness !== undefined && plateWitness !== witnessKey)
        || (assetWitness !== undefined && assetWitness !== witnessKey)
      ) {
        return null;
      }
      projectionWitnessByPlate.set(plate.id, witnessKey);
      projectionWitnessByAsset.set(asset.id, witnessKey);
      referencedPlateIds.add(plate.id);
      referencedAssetIds.add(asset.id);
      closedProjections.push(Object.freeze({ evidence, plate, asset }));
    }
    entries.push(Object.freeze({
      selection,
      feature,
      version,
      authoringPlate,
      authoringAsset,
      projections: Object.freeze(closedProjections),
      contract,
    }));
  }

  const selectedVersionIds = new Set(graph.selections.map(
    (selection) => selection.featureVersionId,
  ));
  if (
    graph.projections.some(
      (projection) => !selectedVersionIds.has(projection.featureVersionId),
    )
    || referencedPlateIds.size !== graph.plates.length
    || referencedAssetIds.size !== graph.assets.length
  ) {
    return null;
  }
  return Object.freeze({ entries: Object.freeze(entries) });
}
