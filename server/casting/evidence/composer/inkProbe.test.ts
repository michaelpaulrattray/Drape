import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ComposerImage } from "./inkComposer";
import {
  buildInkFeaturePlacementProbeRequest,
  buildInkIdentityPoseProbeRequest,
  parseInkIdentityPoseProbe,
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
    });
  });
});
