import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ComposerImage } from "./composer/inkComposer";
import {
  assessInkProjectionProbe,
  applyInkProjectionPlacementAudit,
  buildInkEvidenceMosaic,
  buildInkCoverageProbeRequest,
  buildInkProjectionComposerRequest,
  buildInkProjectionPlacementAuditProbeRequest,
  buildInkProjectionProbeRequest,
  buildInkProjectionTargetGuideAuditProbeRequest,
  parseInkCoverageProbeResponse,
  parseInkProjectionPlacementAuditResponse,
  parseInkProjectionProbeResponse,
  parseInkProjectionTargetGuideAuditResponse,
  projectionTargetGuideAuditPasses,
  summarizeInkCoverageProbeResponse,
  type InkProjectionFeatureReference,
} from "./inkProjectionComposition";

async function image(colour: string): Promise<ComposerImage> {
  return {
    bytes: await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: colour,
      },
    }).png().toBuffer(),
    mime: "image/png",
  };
}

function coverageFields(
  featureIndex: number,
  input: {
    visible: boolean;
    certain: boolean;
    segments: readonly {
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  },
): Record<string, boolean | number> {
  const prefix = `feature${featureIndex}`;
  const result: Record<string, boolean | number> = {
    [`${prefix}RegionVisible`]: input.visible,
    [`${prefix}VerdictCertain`]: input.certain,
    [`${prefix}SegmentCount`]: input.segments.length,
  };
  for (let segmentIndex = 0; segmentIndex < 4; segmentIndex += 1) {
    const segment = input.segments[segmentIndex];
    const segmentPrefix = `${prefix}Segment${segmentIndex + 1}`;
    result[`${segmentPrefix}X`] = segment?.x ?? 0;
    result[`${segmentPrefix}Y`] = segment?.y ?? 0;
    result[`${segmentPrefix}Width`] = segment?.width ?? 0;
    result[`${segmentPrefix}Height`] = segment?.height ?? 0;
  }
  return result;
}

async function features(): Promise<InkProjectionFeatureReference[]> {
  const witness = await image("#c7a68b");
  return [
    {
      featureId: "feature-1",
      featureVersionId: "version-1",
      normalizedDescriptor: "black botanical full sleeve",
      anatomyLabel: "right arm - full sleeve",
      sideAuthority: "The subject's right appears on frame left.",
      targetGuideLabel: "SUBJECT RIGHT - FRAME LEFT",
      witnessSideAuthority:
        "The subject's right appears on frame left in the witness.",
      witnessGuideLabel: "SUBJECT RIGHT - FRAME LEFT",
      targetZone: { x: 0.08, y: 0.24, width: 0.25, height: 0.55 },
      targetZones: [
        { x: 0.08, y: 0.24, width: 0.2, height: 0.28 },
        { x: 0.1, y: 0.48, width: 0.18, height: 0.31 },
      ],
      witnessZone: { x: 0.08, y: 0.24, width: 0.25, height: 0.55 },
      witness,
      isProjectionTarget: true,
    },
    {
      featureId: "feature-2",
      featureVersionId: "version-2",
      normalizedDescriptor: "fine-line swallow",
      anatomyLabel: "left upper torso",
      sideAuthority: "The subject's left appears on frame right.",
      targetGuideLabel: "SUBJECT LEFT - FRAME RIGHT",
      witnessSideAuthority:
        "The subject's left appears on frame right in the witness.",
      witnessGuideLabel: "SUBJECT LEFT - FRAME RIGHT",
      targetZone: { x: 0.55, y: 0.2, width: 0.24, height: 0.24 },
      targetZones: [{ x: 0.55, y: 0.2, width: 0.24, height: 0.24 }],
      witnessZone: { x: 0.55, y: 0.2, width: 0.24, height: 0.24 },
      witness,
      isProjectionTarget: false,
    },
  ];
}

describe("multi-feature projection composition", () => {
  it("builds one bounded private mosaic and edits the clean target", async () => {
    const selected = await features();
    const mosaic = await buildInkEvidenceMosaic(selected);
    expect(mosaic).toMatchObject({
      mime: "image/png",
      width: 1024,
      height: 1024,
      featureCount: 2,
    });
    const base = await image("#999");
    const request = buildInkProjectionComposerRequest({
      identityText: "same immutable person",
      sourceAngle: "backFull",
      targetAngle: "backFull",
      features: selected,
      attemptNumber: 1,
      originalTarget: base,
      identityAnchor: base,
      guidedTarget: base,
      evidenceMosaic: mosaic,
    });
    expect(request.images.map((entry) => entry.role)).toEqual([
      "original_target",
      "guided_target",
      "identity_anchor",
      "evidence_mosaic",
    ]);
    expect(request.recipeVersion).toBe("ink.add.anywhere.projection.v6");
    expect(request.prompt).toContain(
      "CLEAN ORIGINAL TARGET AND IMMUTABLE OUTPUT CANVAS",
    );
    expect(request.prompt).toContain(
      "Blue F-label text is metadata and never authorizes ink",
    );
    expect(request.prompt).toContain("F1 (newly exposed continuation)");
    expect(request.prompt).toContain("F2 (already evidenced)");
    expect(request.prompt).toContain("canonical backFull");
    expect(request.prompt).toContain(
      "Anatomical laterality is semantic, not a matching frame coordinate",
    );
    expect(request.prompt).toContain(
      "WITNESS: The subject's right appears on frame left in the witness.",
    );
    expect(request.prompt).toContain(
      "Never reconstruct it from another image",
    );
  });

  it("refuses to reconstruct a missing target angle from another camera", async () => {
    const selected = await features();
    const base = await image("#999");
    const mosaic = await buildInkEvidenceMosaic(selected);
    expect(() =>
      buildInkProjectionComposerRequest({
        identityText: "same immutable person",
        sourceAngle: "frontFull",
        targetAngle: "backFull",
        features: selected,
        attemptNumber: 1,
        originalTarget: base,
        identityAnchor: base,
        guidedTarget: base,
        evidenceMosaic: mosaic,
      })
    ).toThrow("requires an exact target-angle canvas");
  });

  it("independently refuses a mirrored or out-of-zone feature", async () => {
    const selected = await features();
    const base = await image("#999");
    const request = buildInkProjectionPlacementAuditProbeRequest({
      targetAngle: "threeQuarter",
      features: selected,
      candidate: base,
      placementAuditCandidate: base,
    });
    expect(request.kind).toBe("feature_projection_placement");
    expect(request.recipeVersion)
      .toBe("ink.add.anywhere.projection-placement-audit.v2");
    expect(request.images.map((entry) => entry.role)).toEqual([
      "candidate",
      "placement_audit_candidate",
    ]);
    expect(request.prompt).toContain(
      "The subject's left appears on frame right.",
    );
    expect(request.prompt).toContain(
      "nose/toes toward frame-right expose anatomical RIGHT",
    );
    const placement = parseInkProjectionPlacementAuditResponse({
      confidence: 96,
      feature1AnatomicalSideCorrect: true,
      feature1InsideAuthorizedZone: true,
      feature2AnatomicalSideCorrect: false,
      feature2InsideAuthorizedZone: false,
    }, 2);
    const baseTruth = assessInkProjectionProbe(
      parseInkProjectionProbeResponse({
        confidence: 96,
        identityMatch: true,
        cameraAndFramingMatch: true,
        noUnexpectedInk: true,
        feature1Present: true,
        feature1MatchesEvidence: true,
        feature2Present: true,
        feature2MatchesEvidence: true,
      }, 2),
    );
    expect(applyInkProjectionPlacementAudit(baseTruth, placement))
      .toMatchObject({
        placementOutcome: "fail",
        priorInkOutcome: "fail",
        overallOutcome: "fail",
        placementDetail: {
          semanticPlacement: "pass",
          anatomicalSide: "fail",
          authorizedZone: "fail",
          noOutsideChange: "pass",
        },
        placementAudit: {
          anatomicalSideCorrect: false,
          insideAuthorizedZone: false,
          conflictingOutsideChange: false,
          confidence: 96,
        },
      });
  });

  it("requires an exact positive result for every listed feature", async () => {
    const selected = await features();
    const base = await image("#999");
    const mosaic = await buildInkEvidenceMosaic(selected);
    const request = buildInkProjectionProbeRequest({
      sourceAngle: "backFull",
      targetAngle: "backFull",
      features: selected,
      identityAnchor: base,
      originalTarget: base,
      evidenceMosaic: mosaic,
      candidate: base,
    });
    expect(Object.keys(request.responseSchema)).toEqual([
      "confidence",
      "identityMatch",
      "cameraAndFramingMatch",
      "noUnexpectedInk",
      "feature1Present",
      "feature1MatchesEvidence",
      "feature2Present",
      "feature2MatchesEvidence",
    ]);
    const response = parseInkProjectionProbeResponse({
      confidence: 94,
      identityMatch: true,
      cameraAndFramingMatch: true,
      noUnexpectedInk: true,
      feature1Present: true,
      feature1MatchesEvidence: true,
      feature2Present: true,
      feature2MatchesEvidence: false,
    }, 2);
    expect(assessInkProjectionProbe(response)).toMatchObject({
      featureMatchOutcome: "fail",
      priorInkOutcome: "fail",
      overallOutcome: "fail",
    });
  });

  it("refuses dropped or extra feature results", () => {
    expect(() => parseInkProjectionProbeResponse({
      confidence: 95,
      identityMatch: true,
      cameraAndFramingMatch: true,
      noUnexpectedInk: true,
      feature1Present: true,
      feature1MatchesEvidence: true,
      extra: true,
    }, 1)).toThrow("Invalid projection probe response");
  });

  it("keeps observed-coverage telemetry closed and fails low confidence", async () => {
    const selected = await features();
    const base = await image("#999");
    const request = buildInkCoverageProbeRequest({
      targetAngle: "threeQuarter",
      features: selected.slice(0, 1).map((feature) => ({
        featureVersionId: feature.featureVersionId,
        normalizedDescriptor: feature.normalizedDescriptor,
        anatomyLabel: feature.anatomyLabel,
        sideAuthority: feature.sideAuthority,
        targetZone: feature.targetZone,
        witness: feature.witness,
      })),
      target: base,
      coordinateGuide: base,
    });
    expect(request.kind).toBe("coverage");
    expect(request.recipeVersion).toBe("ink.add.anywhere.coverage-probe.v9");
    expect(request.prompt).toContain(
      "partial upper arm or forearm counts as visible",
    );
    expect(request.prompt).toContain("exactly three ordered images");
    expect(request.prompt).toContain(
      "placement was computed deterministically",
    );
    expect(request.prompt).toContain("Do not return or infer coordinates");
    expect(request.prompt).not.toContain(
      JSON.stringify(selected[0]!.targetZone),
    );
    expect(request.prompt).toContain("black botanical full sleeve");
    expect(request.images.map(({ role }) => role)).toEqual([
      "original_target",
      "coordinate_guide",
      "evidence_reference",
    ]);
    expect(() => buildInkCoverageProbeRequest({
      targetAngle: "threeQuarter",
      features: selected,
      target: base,
      coordinateGuide: base,
    })).toThrow("Coverage localization requires one feature");
    const raw = {
      ...coverageFields(1, {
        visible: true,
        certain: true,
        segments: [
          { x: 10, y: 20, width: 15, height: 40 },
          { x: 22, y: 45, width: 18, height: 35 },
        ],
      }),
      ...coverageFields(2, {
        visible: false,
        certain: false,
        segments: [],
      }),
    };
    expect(summarizeInkCoverageProbeResponse(raw, 2)).toEqual({
      responseShape: "valid_object",
      features: [
        {
          regionVisible: true,
          verdictCertain: true,
          targetZones: [
            { x: 0.1, y: 0.2, width: 0.15, height: 0.4 },
            { x: 0.22, y: 0.45, width: 0.18, height: 0.35 },
          ],
        },
        {
          regionVisible: false,
          verdictCertain: false,
          targetZones: null,
        },
      ],
    });
    expect(() => parseInkCoverageProbeResponse(raw, [
      "version-1",
      "version-2",
    ])).toThrow("Observed coverage is unknown");
    const oneVisibleSegment = {
      ...coverageFields(1, {
        visible: true,
        certain: true,
        segments: [{ x: 10, y: 20, width: 15, height: 40 }],
      }),
    };
    expect(() => parseInkCoverageProbeResponse({
      ...oneVisibleSegment,
      feature1SegmentCount: 5,
    }, ["version-1"])).toThrow("Invalid observed-coverage segments");
    expect(() => parseInkCoverageProbeResponse({
      ...oneVisibleSegment,
      feature1RegionVisible: false,
    }, ["version-1"])).toThrow("Invalid hidden observed-coverage segments");
    expect(() => parseInkCoverageProbeResponse({
      ...oneVisibleSegment,
      feature1Segment2X: 1,
    }, ["version-1"])).toThrow("Invalid observed-coverage segments");
    expect(summarizeInkCoverageProbeResponse("not-json", 1)).toEqual({
      responseShape: "invalid",
      features: [{
        regionVisible: null,
        verdictCertain: null,
        targetZones: null,
      }],
    });
  });

  it("independently approves only anatomy-safe localized target guides", async () => {
    const selected = await features();
    const clean = await image("#999");
    const guided = await image("#a00");
    const request = buildInkProjectionTargetGuideAuditProbeRequest({
      targetAngle: "threeQuarter",
      features: selected,
      originalTarget: clean,
      guidedTarget: guided,
    });
    expect(request).toMatchObject({
      kind: "projection_target_guide",
      recipeVersion:
        "ink.add.anywhere.projection-target-guide-audit.v2",
    });
    expect(request.prompt).toContain("accepted tattoo witnesses");
    expect(request.prompt).toContain("black botanical full sleeve");
    expect(request.prompt).toContain(
      "Compare its red pixel mask with witness Image 3",
    );
    expect(request.prompt).toContain("red pixel mask");
    expect(request.images.map(({ role }) => role)).toEqual([
      "original_target",
      "guided_target",
      "evidence_reference",
      "evidence_reference",
    ]);
    const raw = {
      confidence: 94,
      feature1GuideCoversVisibleSurface: true,
      feature1GuideTouchesOppositeSide: false,
      feature1GuideIncludesConflictingAnatomy: false,
      feature2GuideCoversVisibleSurface: true,
      feature2GuideTouchesOppositeSide: false,
      feature2GuideIncludesConflictingAnatomy: false,
    };
    expect(projectionTargetGuideAuditPasses(
      parseInkProjectionTargetGuideAuditResponse(raw, 2),
    )).toBe(true);
    expect(projectionTargetGuideAuditPasses(
      parseInkProjectionTargetGuideAuditResponse({
        ...raw,
        feature2GuideTouchesOppositeSide: true,
      }, 2),
    )).toBe(false);
  });
});
