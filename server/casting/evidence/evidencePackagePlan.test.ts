import { describe, expect, it } from "vitest";
import type {
  ModelIdentityFeature,
  ModelIdentityFeatureVersion,
  ModelReferencePlate,
  ModelSnapshotFeatureSelection,
} from "../../../drizzle/schema";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import {
  INK_ADD_COMPOSER_RECIPE_VERSION,
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SURFACE,
  INK_ADD_ZONE,
} from "./composer/inkAddRecipe";
import {
  assessSupportedInkFeatureGraph,
  computeEvidencePackageSyncPlan,
  type EvidencePackageFeatureGraph,
  type EvidencePackageSlotState,
} from "./evidencePackagePlan";

const NOW = new Date("2026-07-28T00:00:00.000Z");
const MODEL_ID = 7;
const USER_ID = 1;
const IDENTITY_ID = "11111111-1111-4111-8111-111111111111";
const FEATURE_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const PLATE_ID = "44444444-4444-4444-8444-444444444444";

function graph(side: "left" | "centre" | "right" = "left"): EvidencePackageFeatureGraph {
  const selection: ModelSnapshotFeatureSelection = {
    id: "55555555-5555-4555-8555-555555555555",
    modelId: MODEL_ID,
    identitySnapshotId: IDENTITY_ID,
    featureId: FEATURE_ID,
    featureVersionId: VERSION_ID,
    selectionReason: "accepted",
    sourceSelectionId: null,
    createdAt: NOW,
  };
  const feature: ModelIdentityFeature = {
    id: FEATURE_ID,
    modelId: MODEL_ID,
    category: "ink",
    createdByOperationId: "66666666-6666-4666-8666-666666666666",
    createdAt: NOW,
  };
  const version: ModelIdentityFeatureVersion = {
    id: VERSION_ID,
    modelId: MODEL_ID,
    featureId: FEATURE_ID,
    operation: "present",
    ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
    zone: INK_ADD_ZONE,
    surface: INK_ADD_SURFACE,
    side,
    normalizedDescriptor: "small black star",
    sourceAssetId: 30,
    sourceViewAngle: "frontFull",
    sourceReferencePlateId: null,
    acceptedCandidatePlateId: PLATE_ID,
    evidenceCropId: null,
    recipeVersion: INK_ADD_COMPOSER_RECIPE_VERSION,
    createdByOperationId: "66666666-6666-4666-8666-666666666666",
    createdAt: NOW,
    acceptedAssetId: 31,
  };
  const plate: ModelReferencePlate = {
    id: PLATE_ID,
    userId: USER_ID,
    modelId: MODEL_ID,
    featureIntentId: null,
    kind: "accepted_candidate",
    storageKey:
      `users/${USER_ID}/models/${MODEL_ID}/evidence/candidates/${PLATE_ID}.webp`,
    mime: "image/webp",
    width: 1024,
    height: 1536,
    byteSize: 1234,
    contentHash: "a".repeat(64),
    createdByOperationId: "66666666-6666-4666-8666-666666666666",
    createdByOperationStepKey: "accepted_candidate",
    createdAt: NOW,
  };
  return {
    userId: USER_ID,
    modelId: MODEL_ID,
    identitySnapshotId: IDENTITY_ID,
    selections: [selection],
    features: [feature],
    versions: [version],
    plates: [plate],
  };
}

function slots(input: {
  walk?: "current" | "stale" | "unverified" | "missing" | "failed";
  walkPinned?: boolean;
} = {}): EvidencePackageSlotState[] {
  const walk = input.walk ?? "stale";
  return CANONICAL_VIEW_ANGLES.map((angle, index) => {
    if (angle === "frontFull") {
      return {
        angle,
        selectedAssetId: 31,
        compatibility: "current",
        pinned: false,
        failed: false,
      };
    }
    if (angle === "sideFull") {
      return {
        angle,
        selectedAssetId:
          walk === "missing" || walk === "failed" ? null : 40,
        compatibility:
          walk === "missing" || walk === "failed" ? null : walk,
        pinned: input.walkPinned ?? false,
        failed: walk === "failed",
      };
    }
    return {
      angle,
      selectedAssetId: 100 + index,
      compatibility: "current",
      pinned: false,
      failed: false,
    };
  });
}

function plan(input: {
  side?: "left" | "centre" | "right";
  walk?: "current" | "stale" | "unverified" | "missing" | "failed";
  walkPinned?: boolean;
  status?: unknown;
  unresolved?: boolean;
} = {}) {
  return computeEvidencePackageSyncPlan({
    modelId: MODEL_ID,
    modelStatus: input.status ?? "draft",
    graph: graph(input.side),
    slots: slots({
      walk: input.walk,
      walkPinned: input.walkPinned,
    }),
    requiredMintAngles: ["frontClose", "threeQuarter", "frontFull"],
    hasUnresolvedIntentOrReadyCandidate: input.unresolved ?? false,
    releasedProjectionAngles: CANONICAL_VIEW_ANGLES,
  });
}

describe("evidence-aware package plan", () => {
  it("proves the exact positive feature graph", () => {
    expect(assessSupportedInkFeatureGraph(graph(), 31)).not.toBeNull();
    const wrongPlate = graph();
    wrongPlate.plates = [{ ...wrongPlate.plates[0], userId: 2 }];
    expect(assessSupportedInkFeatureGraph(wrongPlate, 31)).toBeNull();
    const wrongKeyOwner = graph();
    wrongKeyOwner.plates = [{
      ...wrongKeyOwner.plates[0],
      storageKey:
        `users/2/models/${MODEL_ID}/evidence/candidates/${PLATE_ID}.webp`,
    }];
    expect(assessSupportedInkFeatureGraph(wrongKeyOwner, 31)).toBeNull();
    const oversizedPlate = graph();
    oversizedPlate.plates = [{
      ...oversizedPlate.plates[0],
      byteSize: Number.MAX_SAFE_INTEGER,
    }];
    expect(assessSupportedInkFeatureGraph(oversizedPlate, 31)).toBeNull();
    const missingAccepted = graph();
    missingAccepted.versions = [{
      ...missingAccepted.versions[0],
      acceptedAssetId: null,
    }];
    expect(assessSupportedInkFeatureGraph(missingAccepted, 31)).toBeNull();
    const mismatchedAccepted = graph();
    mismatchedAccepted.versions = [{
      ...mismatchedAccepted.versions[0],
      acceptedAssetId: 32,
    }];
    expect(assessSupportedInkFeatureGraph(mismatchedAccepted, 31)).toBeNull();
    const sourceEqualsAccepted = graph();
    sourceEqualsAccepted.versions = [{
      ...sourceEqualsAccepted.versions[0],
      sourceAssetId: 31,
    }];
    expect(assessSupportedInkFeatureGraph(sourceEqualsAccepted, 31)).toBeNull();
    const forked = graph();
    forked.versions = [{ ...forked.versions[0], sourceAssetId: null }];
    expect(assessSupportedInkFeatureGraph(forked, 31)).not.toBeNull();
  });

  it("refuses paid regeneration for a falsely stale anterior-pec Walk", () => {
    const result = plan({ side: "left", walk: "stale" });
    expect(result).toMatchObject({
      supported: true,
      actionableAngles: [],
      refreshableAngles: [],
      missingAngles: [],
      totalCost: 0,
    });
    expect(result.slots.find((slot) => slot.angle === "sideFull"))
      .toMatchObject({
        status: "attention",
        cost: 0,
        refusal: "compatibility_repair_required",
      });
  });

  it.each(["left", "centre", "right"] as const)(
    "keeps a current %s anterior-pec Walk free but can add a missing one deliberately",
    (side) => {
      expect(plan({ side, walk: "current" })).toMatchObject({
        actionableAngles: [],
        totalCost: 0,
      });
      expect(plan({ side, walk: "missing" })).toMatchObject({
        actionableAngles: ["sideFull"],
        missingAngles: ["sideFull"],
        totalCost: 300,
      });
    },
  );

  it("refuses unverified compatibility instead of guessing", () => {
    const result = plan({ walk: "unverified" });
    expect(result.actionableAngles).toEqual([]);
    expect(result.slots.find((slot) => slot.angle === "sideFull"))
      .toMatchObject({
        status: "attention",
        cost: 0,
        refusal: "compatibility_unverified",
      });
  });

  it("refuses a pinned stale view instead of silently replacing accepted work", () => {
    const result = plan({ walk: "stale", walkPinned: true });
    expect(result.actionableAngles).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.slots.find((slot) => slot.angle === "sideFull"))
      .toMatchObject({
        status: "attention",
        cost: 0,
        refusal: "pinned",
      });
  });

  it("makes zero-generation mint available only over current required truth", () => {
    expect(plan({ walk: "stale" }).zeroGenerationMintAvailable).toBe(true);
    expect(plan({ walk: "stale", unresolved: true }).zeroGenerationMintAvailable)
      .toBe(false);
  });

  it("returns a closed public refusal for unsupported state and permits post-mint expansion", () => {
    const invalid = graph();
    invalid.versions = [{
      ...invalid.versions[0],
      ontologyVersion: "future",
    }];
    const unsupported = computeEvidencePackageSyncPlan({
      modelId: MODEL_ID,
      modelStatus: "draft",
      graph: invalid,
      slots: slots(),
      requiredMintAngles: ["frontClose"],
      hasUnresolvedIntentOrReadyCandidate: false,
      releasedProjectionAngles: CANONICAL_VIEW_ANGLES,
    });
    expect(unsupported.supported).toBe(false);
    expect(JSON.stringify(unsupported)).not.toMatch(
      /private\/models|small black star|44444444/,
    );
    expect(plan({ status: "active" })).toMatchObject({
      supported: true,
      actionableAngles: [],
      totalCost: 0,
      zeroGenerationMintAvailable: false,
    });
  });
});
