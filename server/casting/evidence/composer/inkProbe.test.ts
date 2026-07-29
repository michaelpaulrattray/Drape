import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ComposerImage } from "./inkComposer";
import {
  buildInkAnywhereFeaturePlacementProbeRequest,
  buildInkAnywhereGuideCoverageProbeRequest,
  buildInkAnywherePlacementAuditProbeRequest,
  buildInkAnywhereVisibilityProbeRequest,
  buildInkFeaturePlacementProbeRequest,
  buildInkIdentityPoseProbeRequest,
  buildInkVisibilityProbeRequest,
  parseInkIdentityPoseProbe,
  runInkAnywhereCandidateProbes,
  runInkAnywhereVisibilityProbe,
  runInkCandidateProbes,
  runInkVisibilityProbe,
} from "./inkProbe";
import { decideInkCandidateAttempt } from "./inkRetryDecision";

let image: ComposerImage;

beforeAll(async () => {
  image = {
    bytes: await sharp({
      create: {
        width: 300,
        height: 400,
        channels: 3,
        background: "white",
      },
    }).png().toBuffer(),
    mime: "image/png",
  };
});

const identityPass = {
  samePerson: true,
  poseFramingPreserved: true,
  confidence: 96,
};
const featurePass = {
  correctPlacement: true,
  requestedFeaturePresent: true,
  noUnexpectedInk: true,
  confidence: 93,
};

describe("R7-7D fail-closed structured probes", () => {
  it("pins Economy, strict JSON schemas, and independent three-image budgets", () => {
    const visibility = buildInkVisibilityProbeRequest({
      target: image,
    });
    const identity = buildInkIdentityPoseProbeRequest({
      identityAnchor: image,
      originalTarget: image,
      candidate: image,
    });
    const feature = buildInkFeaturePlacementProbeRequest({
      originalTarget: image,
      candidate: image,
      evidenceReference: image,
      side: "left",
      normalizedDescriptor: "fine-line rose",
    });
    expect(identity.model).toBe("gemini-2.5-flash");
    expect(identity.images.map((item) => item.role)).toEqual([
      "identity_anchor",
      "original_target",
      "candidate",
    ]);
    expect(feature.images.map((item) => item.role)).toEqual([
      "original_target",
      "candidate",
      "evidence_reference",
    ]);
    expect(identity.responseMimeType).toBe("application/json");
    expect(visibility).toMatchObject({
      thinkingBudget: 0,
      includeThoughts: false,
      maxOutputTokens: 4096,
    });
    expect(identity).toMatchObject({
      thinkingBudget: 0,
      includeThoughts: false,
      maxOutputTokens: 4096,
    });
    expect(feature).toMatchObject({
      thinkingBudget: 0,
      includeThoughts: false,
      maxOutputTokens: 4096,
    });
    expect(feature.prompt).toContain('"fine-line rose"');
  });

  it("rejects prose, extra keys, missing keys, and non-integer confidence", () => {
    expect(() => parseInkIdentityPoseProbe("YES")).toThrow();
    expect(() => parseInkIdentityPoseProbe({ ...identityPass, reason: "same" }))
      .toThrow();
    expect(() => parseInkIdentityPoseProbe({
      samePerson: true,
      confidence: 90,
    })).toThrow();
    expect(() => parseInkIdentityPoseProbe({
      ...identityPass,
      confidence: 90.5,
    })).toThrow();
  });

  it("returns pass only when every closed check passes", async () => {
    const probe = vi.fn(async (request: { kind: string }) => (
      request.kind === "identity_pose" ? identityPass : featurePass
    ));
    const truth = await runInkCandidateProbes({
      identityAnchor: image,
      originalTarget: image,
      candidate: image,
      side: "centre",
      normalizedDescriptor: "small black moth",
      predictedVisibility: "pass",
      probe,
    });
    expect(truth).toEqual({
      predictedVisibility: "pass",
      identityOutcome: "pass",
      placementOutcome: "pass",
      featureMatchOutcome: "pass",
      priorInkOutcome: "pass",
      poseFramingOutcome: "pass",
      unexpectedInkOutcome: "pass",
      overallOutcome: "pass",
    });
    expect(decideInkCandidateAttempt({ attemptNumber: 1, probe: truth }))
      .toEqual({ action: "ready" });
  });

  it("makes unknown sticky and forbids an uncalibrated retry", async () => {
    const truth = await runInkCandidateProbes({
      identityAnchor: image,
      originalTarget: image,
      candidate: image,
      side: "right",
      normalizedDescriptor: "small black moth",
      predictedVisibility: "pass",
      probe: async (request) => {
        if (request.kind === "identity_pose") throw new Error("unavailable");
        return { ...featurePass, correctPlacement: false };
      },
    });
    expect(truth).toMatchObject({
      identityOutcome: "unknown",
      placementOutcome: "fail",
      overallOutcome: "unknown",
    });
    expect(decideInkCandidateAttempt({ attemptNumber: 1, probe: truth }))
      .toEqual({ action: "fail_and_refund", outcome: "unknown" });
  });

  it("retries one deterministic failure with only closed correction keys", async () => {
    const truth = await runInkCandidateProbes({
      identityAnchor: image,
      originalTarget: image,
      candidate: image,
      side: "left",
      normalizedDescriptor: "small black moth",
      predictedVisibility: "pass",
      probe: async (request) => request.kind === "identity_pose"
        ? { ...identityPass, samePerson: false }
        : { ...featurePass, noUnexpectedInk: false },
    });
    expect(decideInkCandidateAttempt({ attemptNumber: 1, probe: truth }))
      .toEqual({
        action: "included_retry",
        nextAttemptNumber: 2,
        directives: ["identity", "unexpected_ink"],
      });
    expect(decideInkCandidateAttempt({ attemptNumber: 2, probe: truth }))
      .toEqual({ action: "fail_and_refund", outcome: "fail" });
  });

  it("treats malformed or unavailable visibility as unknown before money", async () => {
    await expect(runInkVisibilityProbe({
      target: image,
      probe: async () => ({ upperTorsoVisible: true, confidence: 90 }),
    })).resolves.toEqual({
      predictedVisibility: "unknown",
      confidence: null,
      detail: null,
    });
    await expect(runInkVisibilityProbe({
      target: image,
      probe: async () => ({
        upperTorsoVisible: true,
        materiallyOccluded: false,
        confidence: 92,
      }),
    })).resolves.toEqual({
      predictedVisibility: "pass",
      confidence: 92,
      detail: null,
    });
  });

  it("requires readable anatomy and exact prior-ink preservation for v2", async () => {
    const anatomy = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    } as const;
    const visibility = buildInkAnywhereVisibilityProbeRequest({
      target: image,
      anatomy,
    });
    const guideCoverage = buildInkAnywhereGuideCoverageProbeRequest({
      target: image,
      guidedTarget: image,
      anatomy,
    });
    const feature = buildInkAnywhereFeaturePlacementProbeRequest({
      originalTarget: image,
      candidate: image,
      anatomy,
      normalizedDescriptor: "blackwork full sleeve",
    });
    const placementAudit = buildInkAnywherePlacementAuditProbeRequest({
      originalTarget: image,
      candidate: image,
      placementAuditCandidate: image,
      anatomy,
      sourceAngle: "frontFull",
    });
    expect(visibility.recipeVersion)
      .toBe("ink.add.anywhere.visibility.v4");
    expect(visibility.prompt).toContain("anatomical side");
    expect(visibility.prompt).toContain("integer from 0 to 100");
    expect(visibility.images.map(({ role }) => role)).toEqual(
      ["original_target"],
    );
    expect(guideCoverage.recipeVersion)
      .toBe("ink.add.anywhere.visibility.v4");
    expect(guideCoverage.prompt).toContain("Audit only that guide");
    expect(guideCoverage.images.map(({ role }) => role)).toEqual([
      "original_target",
      "guided_target",
    ]);
    expect(feature.recipeVersion).toBe("ink.add.anywhere.probe.v2");
    expect(feature.responseSchema).toHaveProperty("priorVisibleInkPreserved");
    expect(feature.prompt).toContain("integer from 0 to 100");
    expect(placementAudit.recipeVersion)
      .toBe("ink.add.anywhere.placement-audit.v4");
    expect(placementAudit.prompt).toContain("FRAME LEFT");
    expect(placementAudit.prompt).toContain("clean, unannotated");
    expect(placementAudit.images.map(({ role }) => role)).toEqual([
      "original_target",
      "candidate",
      "placement_audit_candidate",
    ]);
    expect(placementAudit.responseSchema).toMatchObject({
      anatomicalSideCorrect: "boolean",
      insideAuthorizedZone: "boolean",
      conflictingOutsideChange: "boolean",
    });

    await expect(runInkAnywhereVisibilityProbe({
      target: image,
      guidedTarget: image,
      anatomy,
      probe: async (request) => request.kind === "guide_coverage"
        ? {
            guideCoversRequestedRegion: true,
            guideTouchesOppositeSide: false,
            guideIncludesConflictingAnatomy: false,
            confidence: 93,
          }
        : {
            targetRegionVisible: true,
            anatomicalSideReadable: true,
            materiallyOccluded: false,
            confidence: 91,
          },
    })).resolves.toEqual({
      predictedVisibility: "pass",
      confidence: 91,
      detail: {
        targetRegionVisible: true,
        anatomicalSideReadable: true,
        materiallyOccluded: false,
        guideCoversRequestedRegion: true,
        guideTouchesOppositeSide: false,
        guideIncludesConflictingAnatomy: false,
      },
    });
    await expect(runInkAnywhereVisibilityProbe({
      target: image,
      guidedTarget: image,
      anatomy,
      probe: async (request) => request.kind === "guide_coverage"
        ? {
            guideCoversRequestedRegion: true,
            guideTouchesOppositeSide: false,
            guideIncludesConflictingAnatomy: false,
            confidence: 93,
          }
        : {
            targetRegionVisible: true,
            anatomicalSideReadable: true,
            materiallyOccluded: false,
            confidence: 84,
          },
    })).resolves.toEqual({
      predictedVisibility: "fail",
      confidence: 84,
      detail: {
        targetRegionVisible: true,
        anatomicalSideReadable: true,
        materiallyOccluded: false,
        guideCoversRequestedRegion: true,
        guideTouchesOppositeSide: false,
        guideIncludesConflictingAnatomy: false,
      },
    });
    await expect(runInkAnywhereVisibilityProbe({
      target: image,
      guidedTarget: image,
      anatomy,
      probe: async (request) => request.kind === "guide_coverage"
        ? {
            guideCoversRequestedRegion: false,
            guideTouchesOppositeSide: false,
            guideIncludesConflictingAnatomy: false,
            confidence: 96,
          }
        : {
            targetRegionVisible: true,
            anatomicalSideReadable: true,
            materiallyOccluded: false,
            confidence: 98,
          },
    })).resolves.toEqual({
      predictedVisibility: "fail",
      confidence: 96,
      detail: {
        targetRegionVisible: true,
        anatomicalSideReadable: true,
        materiallyOccluded: false,
        guideCoversRequestedRegion: false,
        guideTouchesOppositeSide: false,
        guideIncludesConflictingAnatomy: false,
      },
    });

    const truth = await runInkAnywhereCandidateProbes({
      identityAnchor: image,
      originalTarget: image,
      candidate: image,
      placementAuditCandidate: image,
      anatomy,
      sourceAngle: "frontFull",
      normalizedDescriptor: "blackwork full sleeve",
      predictedVisibility: "pass",
      probe: async (request) => {
        if (request.kind === "identity_pose") return identityPass;
        if (
          request.recipeVersion === "ink.add.anywhere.placement-audit.v4"
        ) {
          return {
            anatomicalSideCorrect: true,
            insideAuthorizedZone: true,
            conflictingOutsideChange: false,
            confidence: 97,
          };
        }
        return {
            correctPlacement: true,
            requestedFeaturePresent: true,
            priorVisibleInkPreserved: false,
            noUnexpectedInk: true,
            confidence: 94,
          };
      },
    });
    expect(truth).toMatchObject({
      priorInkOutcome: "fail",
      overallOutcome: "fail",
    });
    expect(decideInkCandidateAttempt({ attemptNumber: 1, probe: truth }))
      .toEqual({
        action: "included_retry",
        nextAttemptNumber: 2,
        directives: ["prior_ink"],
      });
  });

  it("fails closed when the independent audit sees the opposite side", async () => {
    const anatomy = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    } as const;
    const truth = await runInkAnywhereCandidateProbes({
      identityAnchor: image,
      originalTarget: image,
      candidate: image,
      placementAuditCandidate: image,
      anatomy,
      sourceAngle: "frontFull",
      normalizedDescriptor: "blackwork full sleeve",
      predictedVisibility: "pass",
      probe: async (request) => {
        if (request.kind === "identity_pose") return identityPass;
        if (
          request.recipeVersion === "ink.add.anywhere.placement-audit.v4"
        ) {
          return {
            anatomicalSideCorrect: false,
            insideAuthorizedZone: false,
            conflictingOutsideChange: true,
            confidence: 99,
          };
        }
        return {
          correctPlacement: true,
          requestedFeaturePresent: true,
          priorVisibleInkPreserved: true,
          noUnexpectedInk: true,
          confidence: 95,
        };
      },
    });
    expect(truth).toMatchObject({
      placementOutcome: "fail",
      overallOutcome: "fail",
      placementDetail: {
        semanticPlacement: "pass",
        anatomicalSide: "fail",
        authorizedZone: "fail",
        noOutsideChange: "fail",
      },
      placementAudit: {
        anatomicalSideCorrect: false,
        insideAuthorizedZone: false,
        conflictingOutsideChange: true,
        confidence: 99,
      },
    });
    expect(decideInkCandidateAttempt({ attemptNumber: 1, probe: truth }))
      .toEqual({
        action: "included_retry",
        nextAttemptNumber: 2,
        directives: ["placement"],
      });
  });

  it("fails closed when an otherwise-positive placement audit is low confidence", async () => {
    const anatomy = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    } as const;
    const truth = await runInkAnywhereCandidateProbes({
      identityAnchor: image,
      originalTarget: image,
      candidate: image,
      placementAuditCandidate: image,
      anatomy,
      sourceAngle: "frontFull",
      normalizedDescriptor: "blackwork full sleeve",
      predictedVisibility: "pass",
      probe: async (request) => {
        if (request.kind === "identity_pose") return identityPass;
        if (
          request.recipeVersion === "ink.add.anywhere.placement-audit.v4"
        ) {
          return {
            anatomicalSideCorrect: true,
            insideAuthorizedZone: true,
            conflictingOutsideChange: false,
            confidence: 84,
          };
        }
        return {
          correctPlacement: true,
          requestedFeaturePresent: true,
          priorVisibleInkPreserved: true,
          noUnexpectedInk: true,
          confidence: 95,
        };
      },
    });
    expect(truth).toMatchObject({
      placementOutcome: "fail",
      overallOutcome: "fail",
      placementAudit: {
        anatomicalSideCorrect: true,
        insideAuthorizedZone: true,
        conflictingOutsideChange: false,
        confidence: 84,
      },
    });
    expect(decideInkCandidateAttempt({ attemptNumber: 1, probe: truth }))
      .toMatchObject({
        action: "included_retry",
        directives: ["placement"],
      });
  });
});
