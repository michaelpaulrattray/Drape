import { describe, expect, it } from "vitest";
import type { ClosedInkFeatureGraph } from "./inkFeatureGraph";
import { inkPackageAngleAuthority } from "./inkPackageImpactV2";

function entry(input: {
  id: string;
  zone: string;
  surface: string;
  side: string;
  sourceViewAngle: "frontFull" | "backFull";
  acceptedAssetId: number;
  projection?: { angle: "backFull"; assetId: number };
}): ClosedInkFeatureGraph["entries"][number] {
  return {
    selection: { id: `selection-${input.id}` },
    feature: { id: `feature-${input.id}` },
    version: {
      id: `version-${input.id}`,
      zone: input.zone,
      surface: input.surface,
      side: input.side,
      sourceViewAngle: input.sourceViewAngle,
      acceptedAssetId: input.acceptedAssetId,
    },
    authoringPlate: { id: `plate-${input.id}` },
    authoringAsset: { id: input.acceptedAssetId },
    projections: input.projection
      ? [{
          evidence: {
            targetViewAngle: input.projection.angle,
            acceptedAssetId: input.projection.assetId,
          },
          plate: { id: `projection-plate-${input.id}` },
          asset: { id: input.projection.assetId },
        }]
      : [],
    contract: "all_body_v2",
  } as ClosedInkFeatureGraph["entries"][number];
}

describe("multi-feature tattoo package angle authority", () => {
  const graph: ClosedInkFeatureGraph = {
    entries: [
      entry({
        id: "sleeve",
        zone: "full_arm",
        surface: "circumferential",
        side: "right",
        sourceViewAngle: "frontFull",
        acceptedAssetId: 201,
        projection: { angle: "backFull", assetId: 301 },
      }),
      entry({
        id: "chest",
        zone: "upper_torso",
        surface: "anterior",
        side: "left",
        sourceViewAngle: "frontFull",
        acceptedAssetId: 202,
      }),
    ],
  };

  it("uses accepted authoring and projection evidence without inventing more", () => {
    expect(inkPackageAngleAuthority(graph, "frontFull")).toMatchObject({
      impact: "affected",
      requiresCoverageProbe: false,
      requiresProjectionCandidate: false,
    });
    expect(inkPackageAngleAuthority(graph, "backFull")).toMatchObject({
      impact: "affected",
      requiresCoverageProbe: false,
      requiresProjectionCandidate: false,
    });
  });

  it("keeps conditional visibility behind a free coverage probe", () => {
    expect(inkPackageAngleAuthority(graph, "sideFull")).toMatchObject({
      impact: "affected",
      requiresCoverageProbe: true,
      requiresProjectionCandidate: true,
    });
  });

  it("does not let a sole uncertain surface bypass observed coverage", () => {
    const conditionalOnly: ClosedInkFeatureGraph = {
      entries: [entry({
        id: "lateral-upper-arm",
        zone: "upper_arm",
        surface: "lateral",
        side: "right",
        sourceViewAngle: "frontFull",
        acceptedAssetId: 203,
      })],
    };
    expect(inkPackageAngleAuthority(conditionalOnly, "sideFull"))
      .toMatchObject({
        impact: "uncertain",
        requiresCoverageProbe: true,
        requiresProjectionCandidate: true,
      });
  });

  it("requires acceptance before first newly visible evidence becomes canon", () => {
    const noProjection: ClosedInkFeatureGraph = {
      entries: [{
        ...graph.entries[0],
        projections: [],
      }],
    };
    expect(inkPackageAngleAuthority(noProjection, "backFull")).toMatchObject({
      impact: "affected",
      requiresCoverageProbe: false,
      requiresProjectionCandidate: true,
    });
  });
});
