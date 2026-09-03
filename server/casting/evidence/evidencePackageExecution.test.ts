import sharp from "sharp";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PrivateEvidenceStorageAdapter } from "./evidenceDelivery";
import type { EvidencePackagePrivateAuthority } from "./evidencePackageAuthority";
import {
  EvidencePackageSettlementUncertainError,
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
      background: "#d8d8d8",
    },
  }).png().toBuffer();
  webp = await sharp(png).webp().toBuffer();
});

function body(bytes: Buffer): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      yield bytes;
    },
  };
}

function delivery(): PrivateEvidenceStorageAdapter {
  return {
    putCanonical: vi.fn(async (key) => ({ key })),
    resolveOwnerDelivery: vi.fn(async () => "/private"),
    deleteExact: vi.fn(async () => ({ success: true as const })),
    listCanonicalKeys: vi.fn(async () => []),
    readCanonical: vi.fn(async ({ key }) => ({
      key,
      mime: "image/webp" as const,
      byteSize: webp.length,
      body: body(webp),
      abort: vi.fn(),
    })),
  };
}

function authority(): EvidencePackagePrivateAuthority {
  return {
    model: { id: 4, userId: 1, status: "draft" },
    identity: { id: "identity-1", identityText: "same person" },
    identityAnchor: { id: 10, storageUrl: "https://images.test/head.png" },
    authoringTruth: { id: 20, storageUrl: "https://images.test/full.png" },
    graph: {
      selection: { id: "selection-1" },
      feature: { id: "feature-1" },
      version: {
        id: "version-1",
        side: "left",
        ontologyVersion: "ink.v1",
        zone: "front_upper_torso",
        surface: "skin",
        sourceViewAngle: "frontFull",
        normalizedDescriptor: "small black five-point star tattoo",
      },
      plate: {
        id: "plate-1",
        storageKey: "users/1/models/4/evidence/plates/00000000-0000-4000-8000-000000000001.webp",
        byteSize: 0,
        contentHash: "",
        mime: "image/webp",
      },
    },
    acceptedPlate: {
      id: "plate-1",
      storageKey: "users/1/models/4/evidence/plates/00000000-0000-4000-8000-000000000001.webp",
      byteSize: webp.length,
      contentHash: createHash("sha256").update(webp).digest("hex"),
      mime: "image/webp",
    },
    plan: {
      modelId: 4,
      supported: true,
      slots: [{
        angle: "sideFull",
        label: "Walk",
        status: "stale",
        cost: 300,
        refusal: null,
      }],
      actionableAngles: ["sideFull"],
      refreshableAngles: ["sideFull"],
      missingAngles: [],
      totalCost: 300,
      zeroGenerationMintAvailable: false,
    },
    slots: [{
      angle: "sideFull",
      target: {
        id: 30,
        viewType: "sideFull",
        storageUrl: "https://images.test/walk.png",
      },
      directive: {
        existingSelectionImpact: "affected",
        missingViewAuthority: "compose",
        visibility: "reproduce_visible",
        requiredVisibleAnatomicalSide: "left",
        facingDirective: "camera_sees_anatomical_left_walk_frame_left",
        normalizedTargetZone: {
          x: 0.34,
          y: 0.17,
          width: 0.3,
          height: 0.27,
        },
      },
    }],
  } as unknown as EvidencePackagePrivateAuthority;
}

function passProbe() {
  return {
    samePerson: true,
    canonicalFraming: true,
    continuityPreserved: true,
    observedVisibleAnatomicalSide: "left",
    observedTravelDirection: "frame_left",
    featureRegionVisibility: "visible",
    authorizedFeatureVisible: true,
    acceptedFeatureMatches: true,
    correctPlacement: true,
    noUnexpectedFeature: true,
    confidence: 96,
  };
}

function dependencies(
  overrides: Partial<EvidencePackageExecutionDependencies> = {},
): EvidencePackageExecutionDependencies {
  return {
    delivery: delivery(),
    loadAuthority: vi.fn(async () => authority()),
    fetchImage: vi.fn(async () => ({
      bytes: png,
      mime: "image/png" as const,
      contentLength: png.length,
    })),
    generate: vi.fn(async () =>
      `data:image/png;base64,${png.toString("base64")}`
    ),
    probe: vi.fn(async () => passProbe()),
    canonicalize: vi.fn(async () => ({
      bytes: png,
      mime: "image/png" as const,
      width: 512,
      height: 768,
      byteSize: png.length,
      contentHash: "a".repeat(64),
    })),
    reserveCleanup: vi.fn(async () => "cleanup-1"),
    releaseCleanup: vi.fn(async () => undefined),
    putPublic: vi.fn(async (key) => ({
      key,
      url: `https://images.test/${key}`,
    })),
    deletePublic: vi.fn(async () => ({ success: true as const })),
    createAudit: vi.fn(async () => ({ success: true as const, generationId: 81 })),
    updateAudit: vi.fn(async () => ({ success: true as const })),
    createFailureMarker: vi.fn(async () => ({ success: true as const, assetId: 91 })),
    deduct: vi.fn(async () => ({ success: true as const, newBalance: 1000 })),
    refund: vi.fn(async (_userId, amount, _description, reference) => ({
      recorded: true,
      amount,
      reference: `refund:${reference}`,
    })),
    commit: vi.fn(async ({ candidates }) => ({
      result: {
        refreshed: candidates.map((candidate, index) => ({
          angle: candidate.angle,
          imageUrl: candidate.storageUrl,
          assetId: 100 + index,
        })),
      },
      modelId: 4,
      identitySnapshotId: "identity-1",
      packageSnapshotId: "package-2",
      stateVersion: 3,
      selectedSlotCount: 4,
    })),
    generateId: vi.fn(() => "00000000-0000-4000-8000-000000000099"),
    ...overrides,
  };
}

const INPUT = {
  userId: 1,
  modelId: 4,
  operationId: "00000000-0000-4000-8000-000000000010",
  angles: ["sideFull"] as const,
  chargeReferenceId: "op:00000000-0000-4000-8000-000000000010:charge",
};

describe("R7-7E2 evidence package executor", () => {
  it("charges once, composes from server-owned references and commits a passing view", async () => {
    const deps = dependencies();
    const result = await executeEvidencePackageSync(deps, INPUT);

    expect(result.failed).toEqual([]);
    expect(result.refreshed).toEqual([{
      angle: "sideFull",
      imageUrl: expect.stringContaining("evidence-package/1/4/sideFull"),
      assetId: 100,
    }]);
    expect(deps.deduct).toHaveBeenCalledTimes(1);
    expect(deps.deduct).toHaveBeenCalledWith(
      1,
      300,
      "generation",
      expect.any(String),
      INPUT.chargeReferenceId,
      { toolKind: "image", engineUsed: expect.any(String) },
    );
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.probe).toHaveBeenCalledTimes(1);
    expect(deps.refund).not.toHaveBeenCalled();
    expect(deps.commit).toHaveBeenCalledWith(expect.objectContaining({
      candidates: [expect.objectContaining({
        angle: "sideFull",
        featureVersionId: "version-1",
        cleanupBatchId: "cleanup-1",
        requiredVisibleAnatomicalSide: "left",
        observedVisibleAnatomicalSide: "left",
        observedTravelDirection: "frame_left",
      })],
    }));
  });

  it("includes one server-owned retry without a second charge", async () => {
    const probe = vi
      .fn()
      .mockResolvedValueOnce({
        ...passProbe(),
        observedVisibleAnatomicalSide: "right",
      })
      .mockResolvedValueOnce(passProbe());
    const deps = dependencies({
      probe,
      createAudit: vi
        .fn()
        .mockResolvedValueOnce({ success: true, generationId: 81 })
        .mockResolvedValueOnce({ success: true, generationId: 82 }),
      reserveCleanup: vi
        .fn()
        .mockResolvedValueOnce("cleanup-1")
        .mockResolvedValueOnce("cleanup-2"),
    });

    const result = await executeEvidencePackageSync(deps, INPUT);

    expect(result.refreshed).toHaveLength(1);
    expect(deps.deduct).toHaveBeenCalledTimes(1);
    expect(deps.generate).toHaveBeenCalledTimes(2);
    expect(deps.deletePublic).toHaveBeenCalledTimes(1);
    expect(deps.releaseCleanup).toHaveBeenCalledTimes(1);
    expect(deps.refund).not.toHaveBeenCalled();
    expect(deps.commit).toHaveBeenCalledWith(expect.objectContaining({
      candidates: [expect.objectContaining({ cleanupBatchId: "cleanup-2" })],
    }));
  });

  it("refunds one terminal failed view and leaves canon untouched", async () => {
    const deps = dependencies({
      probe: vi.fn(async () => ({
        ...passProbe(),
        observedTravelDirection: "unknown",
      })),
    });

    const result = await executeEvidencePackageSync(deps, INPUT);

    expect(result.refreshed).toEqual([]);
    expect(result.failed).toEqual([expect.objectContaining({
      angle: "sideFull",
      failureCode: "probe_unknown",
      refunded: 300,
      markerPersisted: true,
    })]);
    expect(deps.deduct).toHaveBeenCalledTimes(1);
    expect(deps.refund).toHaveBeenCalledTimes(1);
    expect(deps.commit).not.toHaveBeenCalled();
    expect(deps.createFailureMarker).toHaveBeenCalledWith(
      expect.objectContaining({
        provenance: expect.objectContaining({
          evidencePackageFailureCode: "probe_unknown",
        }),
      }),
    );
    expect(deps.updateAudit).toHaveBeenCalledWith(
      81,
      expect.objectContaining({
        metadata: expect.objectContaining({
          failureCode: "probe_unknown",
        }),
      }),
    );
  });

  it.each([
    [
      "generation_provider",
      { generate: vi.fn(async () => { throw new Error("provider failed"); }) },
    ],
    [
      "candidate_storage",
      { putPublic: vi.fn(async () => { throw new Error("storage failed"); }) },
    ],
    [
      "probe_provider",
      { probe: vi.fn(async () => { throw new Error("probe failed"); }) },
    ],
  ] as const)(
    "persists only the closed %s execution stage before refunding",
    async (failureStage, overrides) => {
      const deps = dependencies(overrides);
      const result = await executeEvidencePackageSync(deps, INPUT);

      expect(result.refreshed).toEqual([]);
      expect(result.failed).toEqual([expect.objectContaining({
        angle: "sideFull",
        failureCode: "execution_error",
        refunded: 300,
      })]);
      expect(deps.updateAudit).toHaveBeenCalledWith(
        81,
        expect.objectContaining({
          metadata: expect.objectContaining({
            failureCode: "execution_error",
            failureStage,
          }),
        }),
      );
      expect(deps.refund).toHaveBeenCalledTimes(1);
      expect(deps.commit).not.toHaveBeenCalled();
    },
  );

  it("cleans and refunds a probed candidate when atomic settlement refuses", async () => {
    const deps = dependencies({
      commit: vi.fn(async () => {
        throw new TRPCError({
          code: "CONFLICT",
          message: "snapshot race",
        });
      }),
    });

    const result = await executeEvidencePackageSync(deps, INPUT);

    expect(result.refreshed).toEqual([]);
    expect(result.failed).toEqual([expect.objectContaining({
      failureCode: "settlement_refused",
      refunded: 300,
    })]);
    expect(deps.deletePublic).toHaveBeenCalledTimes(1);
    expect(deps.refund).toHaveBeenCalledTimes(1);
  });

  it("preserves candidate bytes and money when settlement may have committed", async () => {
    const deps = dependencies({
      commit: vi.fn(async () => {
        throw new Error("connection lost during commit");
      }),
    });

    await expect(executeEvidencePackageSync(deps, INPUT))
      .rejects.toBeInstanceOf(EvidencePackageSettlementUncertainError);

    expect(deps.deletePublic).not.toHaveBeenCalled();
    expect(deps.releaseCleanup).not.toHaveBeenCalled();
    expect(deps.refund).not.toHaveBeenCalled();
    expect(deps.createFailureMarker).not.toHaveBeenCalled();
  });
});
