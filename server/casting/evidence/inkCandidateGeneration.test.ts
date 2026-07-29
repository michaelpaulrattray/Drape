import sharp from "sharp";
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { PrivateEvidenceStorageAdapter } from "./evidenceDelivery";
import type { CanonicalEvidenceImage } from "./imageValidation";
import type { PreparedInkCandidateAttempt } from "../../db/inkAddCandidates";
import {
  buildInkProbeProviderConfig,
  generateInkAddCandidate,
  generateInkProjectionCandidate,
  retryInkAddCandidate,
  type InkCandidateGenerationDependencies,
} from "./inkCandidateGeneration";
import type { InkProbeRequest } from "./composer/inkProbe";

let png: Buffer;
let webp: Buffer;

beforeAll(async () => {
  png = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 3,
      background: "#d8b29b",
    },
  }).png().toBuffer();
  webp = await sharp(png).webp({ lossless: true }).toBuffer();
});

const prepared: PreparedInkCandidateAttempt = {
  userId: 7,
  modelId: 11,
  operationId: "11111111-1111-4111-8111-111111111111",
  operationKind: "evidence_candidate_generate",
  candidateId: "22222222-2222-4222-8222-222222222222",
  intentId: "33333333-3333-4333-8333-333333333333",
  attemptId: "44444444-4444-4444-8444-444444444444",
  attemptNumber: 1,
  generationId: 19,
  privatePlateId: "55555555-5555-4555-8555-555555555555",
  privateStorageKey:
    "users/7/models/11/evidence/candidates/55555555-5555-4555-8555-555555555555.webp",
  identitySnapshotId: "66666666-6666-4666-8666-666666666666",
  packageSnapshotId: "77777777-7777-4777-8777-777777777777",
  expectedStateVersion: 4,
  sourceAssetId: 31,
  sourceUrl: "https://example.r2.dev/target.webp",
  sourceViewAngle: "frontFull",
  anchorUrl: "https://example.r2.dev/anchor.webp",
  identityText: "The immutable same person.",
  authority: {
    kind: "legacy_v1",
    capabilityKey: "ink.add.front_upper_torso.v1",
    ontologyVersion: "body-zones.front-upper-torso.v1",
    anatomy: {
      zone: "front_upper_torso",
      surface: "anterior",
      side: "left",
    },
    normalizedTargetZone: { x: 0.54, y: 0.2, width: 0.27, height: 0.25 },
    composerRecipeVersion: "ink.add.front_upper_torso.composer.v1",
    probeRecipeVersion: "ink.add.front_upper_torso.probe.v1",
    visibilityRecipeVersion: "ink.add.front_upper_torso.visibility.v1",
  },
  normalizedDescriptor: "small black geometric sun",
  reference: null,
};

const anywherePrepared: PreparedInkCandidateAttempt = {
  ...prepared,
  sourceViewAngle: "sideFull",
  authority: {
    kind: "anywhere_v2",
    capabilityKey: "ink.add.anywhere.v2",
    ontologyVersion: "body-zones.ink.v2",
    anatomy: {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    },
    normalizedTargetZone: { x: 0.1, y: 0.2, width: 0.8, height: 0.48 },
    composerRecipeVersion: "ink.add.anywhere.composer.v6",
    probeRecipeVersion: "ink.add.anywhere.probe.v2",
    visibilityRecipeVersion: "ink.add.anywhere.visibility.v5",
  },
  normalizedDescriptor: "blackwork full sleeve on his right arm",
};

function canonical(): CanonicalEvidenceImage {
  return {
    bytes: webp,
    mime: "image/webp",
    width: 256,
    height: 256,
    byteSize: webp.length,
    contentHash: createHash("sha256").update(webp).digest("hex"),
  };
}

function delivery(): PrivateEvidenceStorageAdapter {
  return {
    putCanonical: vi.fn(async (key) => ({ key })),
    resolveOwnerDelivery: vi.fn(async () => "/api/evidence/candidate/x"),
    deleteExact: vi.fn(async () => ({ success: true })),
    readCanonical: vi.fn(async ({ key, expectedByteSize }) => ({
      key,
      mime: "image/webp" as const,
      byteSize: expectedByteSize,
      body: {
        async *[Symbol.asyncIterator]() {
          yield webp;
        },
      },
      abort: vi.fn(),
    })),
    listCanonicalKeys: vi.fn(async () => []),
  };
}

function passProbe(request: InkProbeRequest): unknown {
  if (request.recipeVersion === "ink.add.anywhere.placement-audit.v4") {
    return {
      anatomicalSideCorrect: true,
      insideAuthorizedZone: true,
      conflictingOutsideChange: false,
      confidence: 98,
    };
  }
  if (request.kind === "feature_projection") {
    return Object.fromEntries(Object.keys(request.responseSchema).map((key) => [
      key,
      key === "confidence" ? 98 : true,
    ]));
  }
  if (request.kind === "coverage") {
    return Object.fromEntries(Object.keys(request.responseSchema).map((key) => [
      key,
      key.endsWith("Confidence") ? 98 : true,
    ]));
  }
  if (request.kind === "guide_coverage") {
    return {
      guideCoversRequestedRegion: true,
      guideTouchesOppositeSide: false,
      guideIncludesConflictingAnatomy: false,
      confidence: 99,
    };
  }
  if (request.kind === "visibility") {
    if ("targetRegionVisible" in request.responseSchema) {
      return {
        targetRegionVisible: true,
        anatomicalSideReadable: true,
        materiallyOccluded: false,
        confidence: 99,
      };
    }
    return {
      upperTorsoVisible: true,
      materiallyOccluded: false,
      confidence: 99,
    };
  }
  if (request.kind === "identity_pose") {
    return { samePerson: true, poseFramingPreserved: true, confidence: 98 };
  }
  return {
    correctPlacement: true,
    requestedFeaturePresent: true,
    noUnexpectedInk: true,
    confidence: 97,
  };
}

function dependencies(
  overrides: Partial<InkCandidateGenerationDependencies> = {},
): InkCandidateGenerationDependencies {
  const completeFailure = vi.fn(async (input: { error: unknown }) => {
    throw input.error;
  });
  return {
    delivery: delivery(),
    enabledForUser: () => true,
    findClaimSubject: vi.fn(async () => ({
      id: prepared.intentId,
      modelId: prepared.modelId,
    })),
    getOutcomeByClaim: vi.fn(async () => null),
    findIntent: vi.fn(async () => ({
      id: prepared.intentId,
      userId: prepared.userId,
      modelId: prepared.modelId,
      capabilityKey: prepared.authority.capabilityKey,
      activeCapabilityKey: prepared.authority.capabilityKey,
      ontologyVersion: prepared.authority.ontologyVersion,
      zone: prepared.authority.anatomy.zone,
      surface: prepared.authority.anatomy.surface,
      side: prepared.authority.anatomy.side,
      normalizedDescriptor: prepared.normalizedDescriptor,
      sourceAssetId: prepared.sourceAssetId,
      expectedStateVersion: prepared.expectedStateVersion,
      identitySnapshotId: prepared.identitySnapshotId,
      packageSnapshotId: prepared.packageSnapshotId,
      referencePlateId: null,
    })),
    enforceQuota: vi.fn(async () => undefined),
    begin: vi.fn(async () => ({
      type: "execute",
      operationId: prepared.operationId,
    })),
    markRunning: vi.fn(async () => ({
      operationId: prepared.operationId,
      chargeReferenceId: `op:${prepared.operationId}:charge`,
    })),
    prepare: vi.fn(async () => ({ ...prepared })),
    markGenerating: vi.fn(async () => undefined),
    markStored: vi.fn(async () => undefined),
    completeReady: vi.fn(async () => undefined),
    invalidate: vi.fn(async () => undefined),
    fetchImage: vi.fn(async () => ({ bytes: png, mime: "image/png" })),
    generate: vi.fn(async () => "generated"),
    canonicalize: vi.fn(async () => canonical()),
    probe: vi.fn(async (request) => passProbe(request)),
    charge: vi.fn(async (options, operation) => {
      options.onCharged?.(350, `op:${prepared.operationId}:charge`);
      return operation();
    }) as InkCandidateGenerationDependencies["charge"],
    completeSuccess: vi.fn(async () => undefined),
    completeFailure: completeFailure as never,
    now: () => new Date("2026-07-28T00:00:00.000Z"),
    ...overrides,
  };
}

describe("ink candidate generation", () => {
  it("forwards the closed non-thinking probe configuration to the provider", () => {
    const config = buildInkProbeProviderConfig({
      kind: "visibility",
      model: "gemini-2.5-flash",
      recipeVersion: "ink.add.visibility.v1",
      responseMimeType: "application/json",
      responseSchema: {
        upperTorsoVisible: "boolean",
        materiallyOccluded: "boolean",
        confidence: "integer_0_100",
      },
      thinkingBudget: 0,
      includeThoughts: false,
      maxOutputTokens: 4096,
      prompt: "closed test prompt",
      images: [],
    });
    expect(config).toMatchObject({
      temperature: 0,
      responseMimeType: "application/json",
      thinkingConfig: {
        thinkingBudget: 0,
        includeThoughts: false,
      },
      maxOutputTokens: 4096,
    });
    expect(config.responseSchema).toMatchObject({
      required: [
        "upperTorsoVisible",
        "materiallyOccluded",
        "confidence",
      ],
    });
  });

  it("delivers one private ready candidate under one 350-credit parent charge", async () => {
    const deps = dependencies();
    const result = await generateInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "88888888-8888-4888-8888-888888888888",
    });

    expect(result).toEqual({
      candidateId: prepared.candidateId,
      status: "ready",
      expiresAt: "2026-08-27T00:00:00.000Z",
      chargedCredits: 350,
    });
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.delivery.putCanonical).toHaveBeenCalledWith(
      prepared.privateStorageKey,
      webp,
      "image/webp",
    );
    expect(deps.completeReady).toHaveBeenCalledTimes(1);
    expect(deps.completeSuccess).toHaveBeenCalledWith(expect.objectContaining({
      chargedCredits: 350,
      refundedCredits: 0,
      result: expect.not.objectContaining({
        delivery: expect.anything(),
        storageKey: expect.anything(),
      }),
    }));
  });

  it("runs the v2 anatomy guide, composer, visibility, and prior-ink probes", async () => {
    const generate = vi.fn(async () => "generated");
    const probe = vi.fn(async (request: InkProbeRequest) => {
      if (request.kind === "visibility") {
        return {
          targetRegionVisible: true,
          anatomicalSideReadable: true,
          materiallyOccluded: false,
          confidence: 96,
        };
      }
      if (request.kind === "guide_coverage") {
        return {
          guideCoversRequestedRegion: true,
          guideTouchesOppositeSide: false,
          guideIncludesConflictingAnatomy: false,
          confidence: 97,
        };
      }
      if (request.kind === "identity_pose") {
        return { samePerson: true, poseFramingPreserved: true, confidence: 97 };
      }
      if (request.recipeVersion === "ink.add.anywhere.placement-audit.v4") {
        return {
          anatomicalSideCorrect: true,
          insideAuthorizedZone: true,
          conflictingOutsideChange: false,
          confidence: 96,
        };
      }
      return {
        correctPlacement: true,
        requestedFeaturePresent: true,
        priorVisibleInkPreserved: true,
        noUnexpectedInk: true,
        confidence: 95,
      };
    });
    const deps = dependencies({
      prepare: vi.fn(async () => ({ ...anywherePrepared })),
      generate,
      probe,
    });
    await expect(generateInkAddCandidate(deps, {
      userId: anywherePrepared.userId,
      intentId: anywherePrepared.intentId,
      clientRequestId: "14141414-1414-4414-8414-141414141414",
    })).resolves.toMatchObject({
      candidateId: anywherePrepared.candidateId,
      status: "ready",
      chargedCredits: 350,
    });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      recipeVersion: "ink.add.anywhere.composer.v6",
      prompt: expect.stringContaining("zone=full_arm"),
    }));
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({
      recipeVersion: "ink.add.anywhere.visibility.v5",
    }));
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({
      recipeVersion: "ink.add.anywhere.probe.v2",
      responseSchema: expect.objectContaining({
        priorVisibleInkPreserved: "boolean",
      }),
    }));
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({
      recipeVersion: "ink.add.anywhere.placement-audit.v4",
      prompt: expect.stringContaining("subject faces toward frame-right"),
      images: expect.arrayContaining([
        expect.objectContaining({ role: "candidate" }),
        expect.objectContaining({ role: "placement_audit_candidate" }),
      ]),
    }));
  });

  it("refuses a mismatched v2 placement guide before charge or image work", async () => {
    const deps = dependencies({
      prepare: vi.fn(async () => ({ ...anywherePrepared })),
      probe: vi.fn(async (request) => {
        if (request.kind !== "guide_coverage") return passProbe(request);
        return {
          guideCoversRequestedRegion: false,
          guideTouchesOppositeSide: false,
          guideIncludesConflictingAnatomy: false,
          confidence: 97,
        };
      }),
    });
    await expect(generateInkAddCandidate(deps, {
      userId: anywherePrepared.userId,
      intentId: anywherePrepared.intentId,
      clientRequestId: "15151515-1515-4515-8515-151515151515",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Nothing was charged"),
    });
    expect(deps.charge).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
  });

  it("runs a private multi-feature projection episode without accepting it", async () => {
    const projectionPrepared: PreparedInkCandidateAttempt = {
      ...prepared,
      intentId: null,
      sourceViewAngle: "backFull",
      authority: {
        kind: "projection_v2",
        capabilityKey: "ink.add.anywhere.v2",
        ontologyVersion: "body-zones.ink.v2",
        targetAngle: "backFull",
        sourceAngle: "backFull",
        composerRecipeVersion: "ink.add.anywhere.projection.v1",
        probeRecipeVersion: "ink.add.anywhere.projection.probe.v1",
        visibilityRecipeVersion: "ink.add.anywhere.coverage-probe.v1",
        features: [{
          featureId: "feature-1",
          featureVersionId: "version-1",
          contract: "all_body_v2",
          normalizedDescriptor: "black botanical full sleeve",
          anatomyLabel: "right arm - full sleeve",
          anatomy: {
            zone: "full_arm",
            surface: "circumferential",
            side: "right",
          },
          targetZone: { x: 0.08, y: 0.2, width: 0.28, height: 0.62 },
          witnessZone: { x: 0.08, y: 0.2, width: 0.28, height: 0.62 },
          witnessViewAngle: "frontFull",
          witness: {
            plateId: "89898989-8989-4989-8989-898989898989",
            storageKey:
              "users/7/models/11/evidence/candidates/89898989-8989-4989-8989-898989898989.webp",
            byteSize: webp.length,
            contentHash: createHash("sha256").update(webp).digest("hex"),
          },
          impact: "affected",
          hasAcceptedTargetEvidence: false,
          isProjectionTarget: true,
          coverageBasis: "registry_affected",
        }],
      },
      normalizedDescriptor: "selected tattoo projection",
    };
    const preflight = {
      userId: projectionPrepared.userId,
      modelId: projectionPrepared.modelId,
      operationId: projectionPrepared.operationId,
      operationKind: projectionPrepared.operationKind,
      identitySnapshotId: projectionPrepared.identitySnapshotId,
      packageSnapshotId: projectionPrepared.packageSnapshotId,
      expectedStateVersion: projectionPrepared.expectedStateVersion,
      sourceAssetId: projectionPrepared.sourceAssetId,
      sourceUrl: projectionPrepared.sourceUrl,
      sourceViewAngle: projectionPrepared.sourceViewAngle,
      targetViewAngle: "backFull" as const,
      anchorUrl: projectionPrepared.anchorUrl,
      identityText: projectionPrepared.identityText,
      features: projectionPrepared.authority.kind === "projection_v2"
        ? projectionPrepared.authority.features
        : [],
    };
    const deps = dependencies({
      loadProjectionPreflight: vi.fn(async () => preflight),
      prepareProjection: vi.fn(async () => projectionPrepared),
    });
    const result = await generateInkProjectionCandidate(deps, {
      userId: projectionPrepared.userId,
      modelId: projectionPrepared.modelId,
      targetViewAngle: "backFull",
      clientRequestId: "90909090-9090-4090-8090-909090909090",
    });
    expect(result).toMatchObject({
      candidateId: projectionPrepared.candidateId,
      status: "ready",
      chargedCredits: 300,
    });
    expect(deps.charge).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 300 }),
      expect.any(Function),
    );
    expect(deps.generate).toHaveBeenCalledWith(expect.objectContaining({
      recipeVersion: "ink.add.anywhere.projection.v1",
      images: expect.arrayContaining([
        expect.objectContaining({ role: "evidence_mosaic" }),
      ]),
    }));
    expect(deps.probe).toHaveBeenCalledWith(expect.objectContaining({
      kind: "feature_projection",
      recipeVersion: "ink.add.anywhere.projection.probe.v1",
    }));
  });

  it("uses one included retry without a second charge", async () => {
    let featureProbe = 0;
    const second = {
      ...prepared,
      attemptId: "99999999-9999-4999-8999-999999999999",
      attemptNumber: 2 as const,
      generationId: 20,
      privatePlateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      privateStorageKey:
        "users/7/models/11/evidence/candidates/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp",
    };
    const deps = dependencies({
      probe: vi.fn(async (request) => {
        if (request.kind !== "feature_placement") return passProbe(request);
        featureProbe += 1;
        return {
          correctPlacement: featureProbe > 1,
          requestedFeaturePresent: true,
          noUnexpectedInk: true,
          confidence: 97,
        };
      }),
      prepareIncludedRetry: vi.fn(async () => second),
    });
    const result = await generateInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    expect(result.status).toBe("ready");
    expect(deps.charge).toHaveBeenCalledTimes(1);
    expect(deps.generate).toHaveBeenCalledTimes(2);
    expect(deps.prepareIncludedRetry).toHaveBeenCalledTimes(1);
    expect(deps.completeReady).toHaveBeenCalledWith(expect.objectContaining({
      prepared: expect.objectContaining({ attemptNumber: 2 }),
    }));
  });

  it("refuses an unknown visibility probe before charge", async () => {
    const deps = dependencies({
      probe: vi.fn(async () => {
        throw new Error("probe unavailable");
      }),
    });
    await expect(generateInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Nothing was charged"),
    });
    expect(deps.charge).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.invalidate).toHaveBeenCalledTimes(1);
  });

  it("replays a stored result without quota, provider, storage, or charge work", async () => {
    const replay = {
      candidateId: prepared.candidateId,
      status: "ready",
      expiresAt: "2026-08-27T00:00:00.000Z",
      chargedCredits: 350,
    };
    const deps = dependencies({
      getOutcomeByClaim: vi.fn(async () => ({
        type: "replay_success",
        operationId: prepared.operationId,
        result: replay,
      })),
    });
    await expect(generateInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    })).resolves.toEqual(replay);
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.enforceQuota).not.toHaveBeenCalled();
    expect(deps.begin).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.charge).not.toHaveBeenCalled();
  });

  it("refuses a reused request id whose exact intent claim does not match", async () => {
    const deps = dependencies({
      getOutcomeByClaim: vi.fn(async () => ({
        type: "payload_conflict",
        operationId: prepared.operationId,
      })),
    });
    await expect(generateInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "15151515-1515-4515-8515-151515151515",
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(deps.getOutcomeByClaim).toHaveBeenCalledWith({
      userId: prepared.userId,
      clientRequestId: "15151515-1515-4515-8515-151515151515",
      kind: "evidence_candidate_generate",
      modelId: prepared.modelId,
      payload: { intentId: prepared.intentId },
    });
    expect(deps.findIntent).not.toHaveBeenCalled();
    expect(deps.enforceQuota).not.toHaveBeenCalled();
    expect(deps.begin).not.toHaveBeenCalled();
  });

  it("refuses quota before claiming a receipt or model lock", async () => {
    const deps = dependencies({
      enforceQuota: vi.fn(async () => {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Daily generation limit reached.",
        });
      }),
    });
    await expect(generateInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "14141414-1414-4414-8414-141414141414",
    })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(deps.begin).not.toHaveBeenCalled();
    expect(deps.markRunning).not.toHaveBeenCalled();
    expect(deps.prepare).not.toHaveBeenCalled();
  });

  it("uses the separate retry operation kind and never mutates the request payload", async () => {
    const deps = dependencies();
    await retryInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });
    expect(deps.begin).toHaveBeenCalledWith(expect.objectContaining({
      kind: "evidence_candidate_retry",
      payload: { intentId: prepared.intentId },
    }));
    expect(deps.prepare).toHaveBeenCalledWith(expect.objectContaining({
      operationKind: "evidence_candidate_retry",
    }));
  });

  it("returns a fixed failure and one refund truth when both attempts fail", async () => {
    const second = {
      ...prepared,
      attemptId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      attemptNumber: 2 as const,
      generationId: 21,
      privatePlateId: "12121212-1212-4212-8212-121212121212",
      privateStorageKey:
        "users/7/models/11/evidence/candidates/12121212-1212-4212-8212-121212121212.webp",
    };
    const deps = dependencies({
      probe: vi.fn(async (request) => {
        if (request.kind === "visibility") return passProbe(request);
        if (request.kind === "identity_pose") {
          return { samePerson: false, poseFramingPreserved: true, confidence: 90 };
        }
        return passProbe(request);
      }),
      prepareIncludedRetry: vi.fn(async () => second),
      charge: vi.fn(async (options, operation) => {
        options.onCharged?.(350, `op:${prepared.operationId}:charge`);
        try {
          return await operation();
        } catch (error) {
          options.onRefunded?.({
            recorded: true,
            amount: 350,
            reference: `refund:op:${prepared.operationId}:charge`,
          });
          throw error;
        }
      }) as InkCandidateGenerationDependencies["charge"],
    });
    await expect(generateInkAddCandidate(deps, {
      userId: prepared.userId,
      intentId: prepared.intentId,
      clientRequestId: "13131313-1313-4313-8313-131313131313",
    })).rejects.toBeInstanceOf(TRPCError);
    expect(deps.charge).toHaveBeenCalledTimes(1);
    expect(deps.generate).toHaveBeenCalledTimes(2);
    expect(deps.completeFailure).toHaveBeenCalledWith(expect.objectContaining({
      chargedCredits: 350,
      refundedCredits: 350,
    }));
  });
});
