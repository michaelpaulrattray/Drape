import { describe, expect, it } from "vitest";
import type {
  ModelAsset,
  ModelIdentityFeature,
  ModelIdentityFeatureProjectionEvidence,
  ModelIdentityFeatureVersion,
  ModelReferencePlate,
  ModelSnapshotFeatureSelection,
} from "../../../drizzle/schema";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import {
  computeEvidencePackageSyncPlan,
  type EvidencePackageFeatureGraph,
  type EvidencePackageSlotState,
} from "./evidencePackagePlan";

const AUTHORING_PLATE = "11111111-1111-4111-8111-111111111111";
const PROJECTION_PLATE = "22222222-2222-4222-8222-222222222222";

function plate(id: string): ModelReferencePlate {
  return {
    id,
    userId: 1,
    modelId: 35,
    kind: "accepted_candidate",
    featureIntentId: null,
    storageKey: `users/1/models/35/evidence/candidates/${id}.webp`,
    mime: "image/webp",
    width: 1024,
    height: 1024,
    byteSize: 8_000,
    contentHash: "a".repeat(64),
    recipeVersion: "canonical-evidence-webp.v1",
    createdByOperationId: `plate-op-${id}`,
    createdByOperationStepKey: "primary",
    createdAt: new Date(),
  };
}

function asset(id: number, viewType: ModelAsset["viewType"]): ModelAsset {
  return {
    id,
    modelId: 35,
    viewType,
    resolution: "1K",
    storageUrl: `https://assets.example/${id}.webp`,
    storageKey: `models/35/${id}.webp`,
    pointsCost: 350,
    pinned: false,
    status: null,
    provenance: null,
    createdAt: new Date(),
  };
}

function graph(withBackProjection: boolean): EvidencePackageFeatureGraph {
  const selection = {
    id: "selection-1",
    modelId: 35,
    identitySnapshotId: "identity-2",
    featureId: "feature-1",
    featureVersionId: "version-1",
    selectionReason: "accepted",
    sourceSelectionId: null,
    createdAt: new Date(),
  } satisfies ModelSnapshotFeatureSelection;
  const feature = {
    id: "feature-1",
    modelId: 35,
    category: "ink",
    createdByOperationId: "feature-op",
    createdByOperationStepKey: "primary",
    createdAt: new Date(),
  } satisfies ModelIdentityFeature;
  const version = {
    id: "version-1",
    modelId: 35,
    featureId: "feature-1",
    operation: "present",
    ontologyVersion: "body-zones.ink.v2",
    zone: "full_arm",
    surface: "circumferential",
    side: "right",
    normalizedDescriptor: "private sleeve description",
    sourceAssetId: 100,
    sourceViewAngle: "frontFull",
    sourceReferencePlateId: null,
    acceptedCandidatePlateId: AUTHORING_PLATE,
    evidenceCropId: null,
    recipeVersion: "ink.add.anywhere.composer.v3",
    createdByOperationId: "version-op",
    createdByOperationStepKey: "primary",
    acceptedAssetId: 201,
    createdAt: new Date(),
  } satisfies ModelIdentityFeatureVersion;
  const projection = {
    id: "projection-1",
    userId: 1,
    modelId: 35,
    featureId: "feature-1",
    featureVersionId: "version-1",
    targetViewAngle: "backFull",
    sourceAssetId: 400,
    acceptedAssetId: 301,
    acceptedCandidatePlateId: PROJECTION_PLATE,
    recipeVersion: "ink.add.anywhere.projection.v1",
    createdByOperationId: "projection-op",
    createdByOperationStepKey: "primary",
    createdAt: new Date(),
  } satisfies ModelIdentityFeatureProjectionEvidence;
  return {
    userId: 1,
    modelId: 35,
    identitySnapshotId: "identity-2",
    selections: [selection],
    features: [feature],
    versions: [version],
    plates: withBackProjection
      ? [plate(AUTHORING_PLATE), plate(PROJECTION_PLATE)]
      : [plate(AUTHORING_PLATE)],
    projections: withBackProjection ? [projection] : [],
    assets: withBackProjection
      ? [asset(201, "frontFull"), asset(301, "backFull")]
      : [asset(201, "frontFull")],
  };
}

function slots(backAccepted: boolean): EvidencePackageSlotState[] {
  return CANONICAL_VIEW_ANGLES.map((angle, index) => ({
    angle,
    selectedAssetId: angle === "frontFull"
      ? 201
      : angle === "backFull" && backAccepted
        ? 301
        : 400 + index,
    compatibility:
      angle === "backFull" || angle === "sideFull"
        ? backAccepted && angle === "backFull"
          ? "current"
          : "stale"
        : "current",
    pinned: false,
    failed: false,
  }));
}

describe("R7-7G multi-feature package plan", () => {
  it("routes a first unseen sleeve surface through candidate acceptance", () => {
    const result = computeEvidencePackageSyncPlan({
      modelId: 35,
      modelStatus: "draft",
      graph: graph(false),
      slots: slots(false),
      requiredMintAngles: ["frontClose", "threeQuarter", "frontFull"],
      hasUnresolvedIntentOrReadyCandidate: false,
    });
    expect(result.supported).toBe(true);
    expect(result.slots.find((slot) => slot.angle === "backFull"))
      .toMatchObject({
        status: "stale",
        action: "projection",
        requiresCoverageProbe: false,
        refusal: null,
      });
    expect(result.slots.find((slot) => slot.angle === "sideFull"))
      .toMatchObject({ action: "projection" });
    expect(JSON.stringify(result)).not.toContain("private sleeve description");
  });

  it("recognises accepted projection evidence and leaves only unseen angles", () => {
    const result = computeEvidencePackageSyncPlan({
      modelId: 35,
      modelStatus: "draft",
      graph: graph(true),
      slots: slots(true),
      requiredMintAngles: ["frontClose", "threeQuarter", "frontFull"],
      hasUnresolvedIntentOrReadyCandidate: false,
    });
    expect(result.slots.find((slot) => slot.angle === "backFull"))
      .toMatchObject({
        status: "current",
        action: null,
        refusal: "already_current",
      });
    expect(result.slots.find((slot) => slot.angle === "sideFull"))
      .toMatchObject({ action: "projection" });
  });
});
