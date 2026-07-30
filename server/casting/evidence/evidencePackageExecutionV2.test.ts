import { createHash } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  ModelAsset,
  ModelIdentityFeature,
  ModelIdentityFeatureProjectionEvidence,
  ModelIdentityFeatureVersion,
  ModelReferencePlate,
  ModelSnapshotFeatureSelection,
} from "../../../drizzle/schema";
import type { PrivateEvidenceStorageAdapter } from "./evidenceDelivery";
import type { ClosedInkFeatureGraph } from "./inkFeatureGraph";
import { inkPackageAngleAuthority } from "./inkPackageImpactV2";
import {
  executeEvidencePackageSync,
  type EvidencePackageExecutionDependencies,
} from "./evidencePackageExecution";

let png: Buffer;
let webp: Buffer;

beforeAll(async () => {
  png = await sharp({
    create: {
      width: 512,
      height: 768,
      channels: 3,
      background: "#b38c75",
    },
  }).png().toBuffer();
  webp = await sharp(png).webp({ lossless: true }).toBuffer();
});

function asset(id: number, viewType: ModelAsset["viewType"]): ModelAsset {
  return {
    id,
    modelId: 4,
    viewType,
    resolution: "1K",
    storageUrl: `https://assets.example/${id}.webp`,
    storageKey: `models/4/${id}.webp`,
    pointsCost: 300,
    pinned: false,
    status: null,
    provenance: null,
    createdAt: new Date(),
  };
}

function graph(): ClosedInkFeatureGraph {
  const selection = {
    id: "selection-1",
    modelId: 4,
    identitySnapshotId: "identity-1",
    featureId: "feature-1",
    featureVersionId: "version-1",
    selectionReason: "accepted",
    sourceSelectionId: null,
    createdAt: new Date(),
  } satisfies ModelSnapshotFeatureSelection;
  const feature = {
    id: "feature-1",
    modelId: 4,
    category: "ink",
    createdByOperationId: "feature-operation",
    createdByOperationStepKey: "primary",
    createdAt: new Date(),
  } satisfies ModelIdentityFeature;
  const plateId = "11111111-1111-4111-8111-111111111111";
  const projectionPlateId = "22222222-2222-4222-8222-222222222222";
  const version = {
    id: "version-1",
    modelId: 4,
    featureId: feature.id,
    operation: "present",
    ontologyVersion: "body-zones.ink.v2",
    zone: "full_arm",
    surface: "circumferential",
    side: "right",
    normalizedDescriptor: "black botanical full sleeve",
    sourceAssetId: 101,
    sourceViewAngle: "frontFull",
    sourceReferencePlateId: null,
    acceptedCandidatePlateId: plateId,
    evidenceCropId: null,
    recipeVersion: "ink.add.anywhere.composer.v3",
    createdByOperationId: "version-operation",
    createdByOperationStepKey: "primary",
    createdAt: new Date(),
    acceptedAssetId: 201,
  } satisfies ModelIdentityFeatureVersion;
  const plateBase = {
    userId: 1,
    modelId: 4,
    featureIntentId: null,
    kind: "accepted_candidate",
    mime: "image/webp",
    width: 512,
    height: 768,
    byteSize: webp.length,
    contentHash: createHash("sha256").update(webp).digest("hex"),
    recipeVersion: "canonical-evidence-webp.v1",
    createdByOperationStepKey: "primary",
    createdAt: new Date(),
  } as const;
  const authoringPlate = {
    ...plateBase,
    id: plateId,
    storageKey: `users/1/models/4/evidence/candidates/${plateId}.webp`,
    createdByOperationId: "plate-operation",
  } satisfies ModelReferencePlate;
  const projectionPlate = {
    ...plateBase,
    id: projectionPlateId,
    storageKey:
      `users/1/models/4/evidence/candidates/${projectionPlateId}.webp`,
    createdByOperationId: "projection-operation",
  } satisfies ModelReferencePlate;
  const projectionEvidence = {
    id: "projection-1",
    userId: 1,
    modelId: 4,
    featureId: feature.id,
    featureVersionId: version.id,
    targetViewAngle: "sideFull",
    sourceAssetId: 401,
    acceptedAssetId: 301,
    acceptedCandidatePlateId: projectionPlateId,
    recipeVersion: "ink.add.anywhere.projection.v1",
    createdByOperationId: "projection-operation",
    createdByOperationStepKey: "projection:version-1",
    createdAt: new Date(),
  } satisfies ModelIdentityFeatureProjectionEvidence;
  return {
    entries: [{
      selection,
      feature,
      version,
      authoringPlate,
      authoringAsset: asset(201, "frontFull"),
      projections: [{
        evidence: projectionEvidence,
        plate: projectionPlate,
        asset: asset(301, "sideFull"),
      }],
      contract: "all_body_v2",
    }],
  };
}

function delivery(): PrivateEvidenceStorageAdapter {
  return {
    putCanonical: vi.fn(),
    resolveOwnerDelivery: vi.fn(),
    deleteExact: vi.fn(),
    listCanonicalKeys: vi.fn(async () => []),
    readCanonical: vi.fn(async ({ key }) => ({
      key,
      mime: "image/webp" as const,
      byteSize: webp.length,
      body: {
        async *[Symbol.asyncIterator]() {
          yield webp;
        },
      },
      abort: vi.fn(),
    })),
  };
}

describe("v2 evidence package execution", () => {
  it("refreshes only from accepted multi-feature evidence", async () => {
    const closed = graph();
    const target = asset(401, "sideFull");
    const authority = {
      contract: "all_body_v2" as const,
      model: { id: 4, userId: 1 },
      identity: {
        id: "identity-1",
        identityText: "the immutable same person",
      },
      identityAnchor: asset(11, "frontClose"),
      graph: closed,
      plan: {
        modelId: 4,
        supported: true,
        slots: [{
          angle: "sideFull",
          label: "Walk",
          status: "stale",
          cost: 300,
          refusal: null,
          action: "refresh",
          requiresCoverageProbe: false,
        }],
        actionableAngles: ["sideFull"],
        refreshableAngles: ["sideFull"],
        missingAngles: [],
        totalCost: 300,
        zeroGenerationMintAvailable: false,
      },
      slots: [{
        angle: "sideFull" as const,
        target,
        angleAuthority: inkPackageAngleAuthority(closed, "sideFull"),
      }],
    };
    const committedCandidate = vi.fn();
    const dependencies: EvidencePackageExecutionDependencies = {
      delivery: delivery(),
      loadAuthority: vi.fn(async () => authority as never),
      fetchImage: vi.fn(async () => ({ bytes: png, mime: "image/png" })),
      generate: vi.fn(async () => "generated"),
      probe: vi.fn(async (request) => Object.fromEntries(
        Object.keys(request.responseSchema).map((key) => [
          key,
          key === "confidence" ? 97 : true,
        ]),
      )),
      canonicalize: vi.fn(async () => ({
        bytes: webp,
        mime: "image/webp",
        width: 512,
        height: 768,
        byteSize: webp.length,
        contentHash: createHash("sha256").update(webp).digest("hex"),
      })),
      putPublic: vi.fn(async (key) => ({
        key,
        url: `https://assets.example/${key}`,
      })),
      deletePublic: vi.fn(async () => ({ success: true, retryable: false })),
      reserveCleanup: vi.fn(async () => "cleanup-1"),
      releaseCleanup: vi.fn(async () => undefined),
      createAudit: vi.fn(async () => ({ success: true, generationId: 91 })),
      updateAudit: vi.fn(async () => ({ success: true })),
      deduct: vi.fn(async () => ({ success: true, balance: 1000 })),
      refund: vi.fn(async () => ({
        recorded: true,
        reference: "refund-1",
      })),
      commit: vi.fn(async (input) => {
        committedCandidate(input.candidates[0]);
        return {
          result: {
            refreshed: [{
              angle: "sideFull" as const,
              imageUrl: input.candidates[0].storageUrl,
              assetId: 501,
            }],
          },
        } as never;
      }),
    };
    await expect(executeEvidencePackageSync(dependencies, {
      userId: 1,
      modelId: 4,
      operationId: "33333333-3333-4333-8333-333333333333",
      angles: ["sideFull"],
      chargeReferenceId: "charge-1",
    })).resolves.toMatchObject({
      refreshed: [{ angle: "sideFull", assetId: 501 }],
      failed: [],
    });
    expect(committedCandidate).toHaveBeenCalledWith(expect.objectContaining({
      evidenceContract: "all_body_v2",
      featureVersionId: "version-1",
      featureVersionIds: ["version-1"],
      sourceAssetId: 401,
    }));
  });
});
