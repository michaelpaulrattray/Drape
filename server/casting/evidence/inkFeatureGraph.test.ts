import { describe, expect, it } from "vitest";
import type {
  ModelAsset,
  ModelIdentityFeature,
  ModelIdentityFeatureProjectionEvidence,
  ModelIdentityFeatureVersion,
  ModelReferencePlate,
  ModelSnapshotFeatureSelection,
} from "../../../drizzle/schema";
import type { EvidencePackageFeatureGraph } from "./evidencePackagePlan";
import { assessClosedInkFeatureGraph } from "./inkFeatureGraph";

const AUTHORING_PLATE_1 = "11111111-1111-4111-8111-111111111111";
const AUTHORING_PLATE_2 = "22222222-2222-4222-8222-222222222222";
const PROJECTION_PLATE_1 = "33333333-3333-4333-8333-333333333333";

function selection(index: number): ModelSnapshotFeatureSelection {
  return {
    id: `selection-${index}`,
    modelId: 35,
    identitySnapshotId: "identity-2",
    featureId: `feature-${index}`,
    featureVersionId: `version-${index}`,
    selectionReason: index === 1 ? "accepted" : "carried",
    sourceSelectionId: index === 1 ? null : `old-selection-${index}`,
    createdAt: new Date(),
  };
}

function feature(index: number): ModelIdentityFeature {
  return {
    id: `feature-${index}`,
    modelId: 35,
    category: "ink",
    createdByOperationId: `feature-operation-${index}`,
    createdAt: new Date(),
    createdByOperationStepKey: "primary",
  };
}

function version(index: number): ModelIdentityFeatureVersion {
  return {
    id: `version-${index}`,
    modelId: 35,
    featureId: `feature-${index}`,
    operation: "present",
    ontologyVersion: "body-zones.ink.v2",
    zone: "full_arm",
    surface: "circumferential",
    side: index === 1 ? "right" : "left",
    normalizedDescriptor:
      index === 1 ? "black botanical full sleeve" : "fine-line swallow",
    sourceAssetId: 100 + index,
    sourceViewAngle: "frontFull",
    sourceReferencePlateId: null,
    acceptedCandidatePlateId:
      index === 1 ? AUTHORING_PLATE_1 : AUTHORING_PLATE_2,
    evidenceCropId: null,
    recipeVersion: "ink.add.anywhere.composer.v1",
    createdByOperationId: `version-operation-${index}`,
    createdAt: new Date(),
    acceptedAssetId: 200 + index,
    createdByOperationStepKey: "primary",
  };
}

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
    createdByOperationId: `plate-operation-${id}`,
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

function projection(): ModelIdentityFeatureProjectionEvidence {
  return {
    id: "projection-1",
    userId: 1,
    modelId: 35,
    featureId: "feature-1",
    featureVersionId: "version-1",
    targetViewAngle: "backFull",
    sourceAssetId: 88,
    acceptedAssetId: 301,
    acceptedCandidatePlateId: PROJECTION_PLATE_1,
    recipeVersion: "ink.add.anywhere.projection.v1",
    createdByOperationId: "projection-operation-1",
    createdByOperationStepKey: "primary",
    createdAt: new Date(),
  };
}

function graph(): EvidencePackageFeatureGraph {
  return {
    userId: 1,
    modelId: 35,
    identitySnapshotId: "identity-2",
    selections: [selection(1), selection(2)],
    features: [feature(1), feature(2)],
    versions: [version(1), version(2)],
    projections: [projection()],
    plates: [
      plate(AUTHORING_PLATE_1),
      plate(AUTHORING_PLATE_2),
      plate(PROJECTION_PLATE_1),
    ],
    assets: [
      asset(201, "frontFull"),
      asset(202, "frontFull"),
      asset(301, "backFull"),
    ],
  };
}

describe("multi-feature tattoo graph closure", () => {
  it("closes two selected tattoos plus accepted projection evidence", () => {
    const closed = assessClosedInkFeatureGraph(graph());
    expect(closed?.entries).toHaveLength(2);
    expect(closed?.entries[0]).toMatchObject({
      contract: "all_body_v2",
      feature: { id: "feature-1" },
      projections: [{
        evidence: {
          targetViewAngle: "backFull",
          acceptedAssetId: 301,
        },
      }],
    });
    expect(closed?.entries[1].projections).toEqual([]);
  });

  it("allows one exact projection witness to prove several feature versions", () => {
    const value = graph();
    value.projections = [
      value.projections![0],
      {
        ...value.projections![0],
        id: "projection-2",
        featureId: "feature-2",
        featureVersionId: "version-2",
        createdByOperationStepKey: "projection:version-2",
      },
    ];
    const closed = assessClosedInkFeatureGraph(value);
    expect(closed?.entries.map((entry) => entry.projections.length))
      .toEqual([1, 1]);
    expect(closed?.entries[0].projections[0].plate.id)
      .toBe(closed?.entries[1].projections[0].plate.id);
    expect(closed?.entries[0].projections[0].asset.id)
      .toBe(closed?.entries[1].projections[0].asset.id);
  });

  it("refuses conflicting rows that reuse a projection plate", () => {
    const value = graph();
    value.projections = [
      value.projections![0],
      {
        ...value.projections![0],
        id: "projection-2",
        featureId: "feature-2",
        featureVersionId: "version-2",
        acceptedAssetId: 302,
        createdByOperationStepKey: "projection:version-2",
      },
    ];
    value.assets = [...value.assets!, asset(302, "backFull")];
    expect(assessClosedInkFeatureGraph(value)).toBeNull();
  });

  it.each([
    ["missing feature", (value: EvidencePackageFeatureGraph) => {
      value.features = value.features.slice(1);
    }],
    ["duplicate selection", (value: EvidencePackageFeatureGraph) => {
      value.selections = [value.selections[0], value.selections[0]];
    }],
    ["foreign plate", (value: EvidencePackageFeatureGraph) => {
      value.plates = value.plates.map((row, index) =>
        index === 0 ? { ...row, userId: 2 } : row);
    }],
    ["wrong accepted view", (value: EvidencePackageFeatureGraph) => {
      value.assets = value.assets?.map((row) =>
        row.id === 201 ? { ...row, viewType: "backFull" } : row);
    }],
    ["unknown tuple", (value: EvidencePackageFeatureGraph) => {
      value.versions = value.versions.map((row, index) =>
        index === 0 ? { ...row, surface: "anterior" } : row);
    }],
    ["orphan projection", (value: EvidencePackageFeatureGraph) => {
      value.projections = value.projections?.map((row) => ({
        ...row,
        featureVersionId: "not-selected",
      }));
    }],
    ["unknown projection recipe", (value: EvidencePackageFeatureGraph) => {
      value.projections = value.projections?.map((row) => ({
        ...row,
        recipeVersion: "unknown",
      }));
    }],
  ] as const)("%s fails the whole graph closed", (_label, mutate) => {
    const value = graph();
    mutate(value);
    expect(assessClosedInkFeatureGraph(value)).toBeNull();
  });

  it("keeps a legacy chest feature readable without v2 projection claims", () => {
    const value = graph();
    const legacyVersion = {
      ...value.versions[0],
      ontologyVersion: "body-zones.front-upper-torso.v1",
      zone: "front_upper_torso",
      surface: "anterior",
      side: "left",
      sourceViewAngle: "frontFull" as const,
      recipeVersion: "ink.add.front_upper_torso.composer.v1",
    };
    value.selections = [value.selections[0]];
    value.features = [value.features[0]];
    value.versions = [legacyVersion];
    value.projections = [];
    value.plates = [value.plates[0]];
    value.assets = [value.assets![0]];
    expect(assessClosedInkFeatureGraph(value)?.entries[0].contract)
      .toBe("legacy_front_upper_torso_v1");
  });
});
