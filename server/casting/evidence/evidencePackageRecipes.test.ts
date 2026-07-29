import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import {
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SURFACE,
  INK_ADD_ZONE,
} from "./composer/inkAddRecipe";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import {
  buildEvidenceContextCrop,
  buildEvidenceGuidedTarget,
  buildEvidencePackageComposerRequest,
  evidenceCropProvenanceKey,
} from "./evidencePackageComposition";
import { inkPackageDirective } from "./evidencePackageRegistry";
import {
  assessEvidencePackageProbe,
  buildEvidencePackageProbeRequest,
  parseEvidencePackageProbeResponse,
  type EvidencePackageProbeResponse,
} from "./evidencePackageProbe";

let imageBytes: Buffer;

beforeAll(async () => {
  imageBytes = await sharp({
    create: {
      width: 800,
      height: 1200,
      channels: 3,
      background: { r: 190, g: 170, b: 155 },
    },
  }).png().toBuffer();
});

function directiveFor(
  side: "left" | "centre" | "right",
  angle: "frontClose" | "threeQuarter" | "frontFull" | "sideClose" | "sideFull" | "backFull",
) {
  return inkPackageDirective({
    capabilityKey: INK_ADD_CAPABILITY_KEY,
    ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
    zone: INK_ADD_ZONE,
    surface: INK_ADD_SURFACE,
    side,
    angle,
  })!;
}

function directive(side: "left" | "centre" | "right") {
  return directiveFor(side, "sideFull");
}

function image() {
  return { bytes: imageBytes, mime: "image/png" as const };
}

const PASS: EvidencePackageProbeResponse = {
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
  confidence: 95,
};

describe("evidence package pure recipes", () => {
  it("derives a contextual private-evidence crop entirely in memory", async () => {
    const crop = await buildEvidenceContextCrop({
      acceptedPlateBytes: imageBytes,
      side: "left",
      ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
      zone: INK_ADD_ZONE,
      surface: INK_ADD_SURFACE,
      sourceViewAngle: "frontFull",
    });
    expect(crop.mime).toBe("image/png");
    expect(crop.width).toBeLessThan(800);
    expect(crop.height).toBeLessThan(1200);
    expect(crop.provenanceKey).toBe(
      `${INK_ADD_ONTOLOGY_VERSION}:${INK_ADD_ZONE}:${INK_ADD_SURFACE}:left:frontFull`,
    );
    expect(() => evidenceCropProvenanceKey({
      ontologyVersion: "bad value",
      zone: INK_ADD_ZONE,
      surface: INK_ADD_SURFACE,
      side: "left",
      sourceViewAngle: "frontFull",
    })).toThrow("Invalid evidence crop provenance");
  });

  it("renders hidden-view guidance without changing target dimensions", async () => {
    const guided = await buildEvidenceGuidedTarget({
      targetBytes: imageBytes,
      directive: directive("left"),
      featureSide: "left",
    });
    expect(guided).toMatchObject({
      mime: "image/png",
      width: 800,
      height: 1200,
    });
    expect(guided.normalizedTargetZone).toBeNull();
    expect(Buffer.from(guided.bytes).equals(imageBytes)).toBe(false);
  });

  it("builds exactly three composer references with server-owned omission authority", async () => {
    const guided = await buildEvidenceGuidedTarget({
      targetBytes: imageBytes,
      directive: directive("right"),
      featureSide: "right",
    });
    const crop = await buildEvidenceContextCrop({
      acceptedPlateBytes: imageBytes,
      side: "right",
      ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
      zone: INK_ADD_ZONE,
      surface: INK_ADD_SURFACE,
      sourceViewAngle: "frontFull",
    });
    const request = buildEvidencePackageComposerRequest({
      identityText: "IDENTITY CONTEXT: same person",
      normalizedDescriptor: "small black star",
      featureSide: "right",
      directive: directive("right"),
      attemptNumber: 1,
      identityAnchor: image(),
      guidedTarget: guided,
      acceptedEvidenceCrop: crop,
    });
    expect(request.images.map((entry) => entry.role)).toEqual([
      "identity_anchor",
      "guided_target",
      "accepted_evidence_crop",
    ]);
    expect(request.prompt).toContain("anterior pec surface");
    expect(request.prompt).toContain("must be absent");
    expect(request.prompt).toContain("strict walking side profile");
    expect(request.prompt).not.toContain("Reproduce exactly");
  });

  it.each(["left", "centre", "right"] as const)(
    "keeps the %s anterior-pec feature hidden in a strict Walk",
    async (side) => {
      const guided = await buildEvidenceGuidedTarget({
        targetBytes: imageBytes,
        directive: directive(side),
        featureSide: side,
      });
      const request = buildEvidencePackageComposerRequest({
        identityText: "IDENTITY CONTEXT: same person",
        normalizedDescriptor: "small black star",
        featureSide: side,
        directive: directive(side),
        attemptNumber: 1,
        identityAnchor: image(),
        guidedTarget: guided,
        acceptedEvidenceCrop: image(),
      });
      expect(request.prompt).toContain("anterior-pec feature is hidden");
      expect(request.prompt).toContain("must be absent");
      expect(request.prompt).toContain("either direction is acceptable");
    },
  );

  it("makes a centre-profile composer explicitly omit the hidden mark", async () => {
    const guided = await buildEvidenceGuidedTarget({
      targetBytes: imageBytes,
      directive: directive("centre"),
      featureSide: "centre",
    });
    const request = buildEvidencePackageComposerRequest({
      identityText: "IDENTITY CONTEXT: same person",
      normalizedDescriptor: "small black star",
      featureSide: "centre",
      directive: directive("centre"),
      attemptNumber: 1,
      identityAnchor: image(),
      guidedTarget: guided,
      acceptedEvidenceCrop: image(),
    });
    expect(request.prompt).toContain("must be absent");
    expect(request.prompt).toContain("strict walking side profile");
  });

  it("uses candidate pixels—not requested direction—as probe authority", () => {
    const request = buildEvidencePackageProbeRequest({
      directive: directive("left"),
      identityAnchor: image(),
      originalTarget: image(),
      acceptedEvidence: image(),
      candidate: image(),
    });
    expect(request.prompt).toContain("candidate pixels themselves");
    expect(request.prompt).toContain("Never infer");
    expect(request.prompt).toContain(
      "frame-left expose the subject's anatomical",
    );
    expect(request.prompt).not.toContain("anatomical left front upper");
    expect(request.prompt).not.toContain("Required visible anatomical side");
    const hidden = {
      ...PASS,
      featureRegionVisibility: "hidden" as const,
      authorizedFeatureVisible: false,
      acceptedFeatureMatches: false,
      correctPlacement: false,
    };
    expect(assessEvidencePackageProbe({
      directive: directive("left"),
      response: hidden,
    })).toMatchObject({ outcome: "pass" });
    expect(assessEvidencePackageProbe({
      directive: directive("left"),
      response: { ...hidden, authorizedFeatureVisible: true },
    })).toEqual({ outcome: "fail", failure: "feature_visibility_mismatch" });
  });

  it("proves omission for hidden Walk views and keeps unknown sticky", () => {
    const hidden: EvidencePackageProbeResponse = {
      ...PASS,
      observedVisibleAnatomicalSide: "right",
      featureRegionVisibility: "hidden",
      authorizedFeatureVisible: false,
      acceptedFeatureMatches: false,
      correctPlacement: false,
    };
    for (const side of ["left", "centre", "right"] as const) {
      expect(assessEvidencePackageProbe({
        directive: directive(side),
        response: hidden,
      }).outcome).toBe("pass");
    }
    expect(assessEvidencePackageProbe({
      directive: directive("centre"),
      response: { ...hidden, authorizedFeatureVisible: true },
    })).toEqual({
      outcome: "fail",
      failure: "feature_visibility_mismatch",
    });
    expect(assessEvidencePackageProbe({
      directive: directive("left"),
      response: { ...PASS, observedTravelDirection: "unknown" },
    })).toEqual({ outcome: "unknown", failure: "probe_unknown" });
    expect(assessEvidencePackageProbe({
      directive: directive("centre"),
      response: { ...hidden, featureRegionVisibility: "outside_frame" },
    })).toEqual({
      outcome: "fail",
      failure: "feature_visibility_mismatch",
    });
  });

  it("fails closed when authoring truth reaches package composition or probing", async () => {
    const authoring = directiveFor("left", "frontFull");
    await expect(buildEvidenceGuidedTarget({
      targetBytes: imageBytes,
      directive: authoring,
      featureSide: "left",
    })).rejects.toThrow("Authoring truth is never composed");
    expect(() => buildEvidencePackageComposerRequest({
      identityText: "IDENTITY CONTEXT: same person",
      normalizedDescriptor: "small black star",
      featureSide: "left",
      directive: authoring,
      attemptNumber: 1,
      identityAnchor: image(),
      guidedTarget: image(),
      acceptedEvidenceCrop: image(),
    })).toThrow("Authoring truth is never composed");
    expect(() => buildEvidencePackageProbeRequest({
      directive: authoring,
      identityAnchor: image(),
      originalTarget: image(),
      acceptedEvidence: image(),
      candidate: image(),
    })).toThrow("Authoring truth is never package-verified");
    expect(() => assessEvidencePackageProbe({
      directive: authoring,
      response: PASS,
    })).toThrow("Authoring truth is never package-verified");
  });

  it("refuses a visible directive that lacks physical target geometry", async () => {
    const impossible = {
      ...directive("left"),
      existingSelectionImpact: "affected" as const,
      visibility: "reproduce_visible" as const,
      requiredVisibleAnatomicalSide: "left" as const,
      facingDirective: "camera_sees_anatomical_left_walk_frame_left" as const,
      normalizedTargetZone: null,
    };
    await expect(buildEvidenceGuidedTarget({
      targetBytes: imageBytes,
      directive: impossible,
      featureSide: "left",
    })).rejects.toThrow("requires a target zone");
    expect(() => buildEvidencePackageComposerRequest({
      identityText: "IDENTITY CONTEXT: same person",
      normalizedDescriptor: "small black star",
      featureSide: "left",
      directive: impossible,
      attemptNumber: 1,
      identityAnchor: image(),
      guidedTarget: image(),
      acceptedEvidenceCrop: image(),
    })).toThrow("requires a target zone");
  });

  it("keeps outside-frame omission distinct from hidden omission", () => {
    const outside = {
      ...PASS,
      observedVisibleAnatomicalSide: "none" as const,
      observedTravelDirection: "stationary" as const,
      featureRegionVisibility: "outside_frame" as const,
      authorizedFeatureVisible: false,
      acceptedFeatureMatches: false,
      correctPlacement: false,
    };
    expect(assessEvidencePackageProbe({
      directive: directiveFor("left", "threeQuarter"),
      response: outside,
    }).outcome).toBe("pass");
    expect(assessEvidencePackageProbe({
      directive: directiveFor("left", "threeQuarter"),
      response: { ...outside, featureRegionVisibility: "hidden" },
    })).toEqual({
      outcome: "fail",
      failure: "feature_visibility_mismatch",
    });
    expect(assessEvidencePackageProbe({
      directive: {
        ...directive("centre"),
        facingDirective: "camera_sees_anatomical_left_walk_frame_left",
      },
      response: {
        ...outside,
        featureRegionVisibility: "hidden",
        observedTravelDirection: "frame_right",
      },
    })).toEqual({
      outcome: "fail",
      failure: "travel_direction_mismatch",
    });
  });

  it("parses only the exact closed probe response", () => {
    expect(parseEvidencePackageProbeResponse(JSON.stringify(PASS))).toEqual(PASS);
    expect(() => parseEvidencePackageProbeResponse({
      ...PASS,
      rawAnalysis: "private",
    })).toThrow("Invalid evidence package probe response");
  });
});
