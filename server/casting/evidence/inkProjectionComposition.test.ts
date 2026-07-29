import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ComposerImage } from "./composer/inkComposer";
import {
  assessInkProjectionProbe,
  buildInkEvidenceMosaic,
  buildInkCoverageProbeRequest,
  buildInkProjectionComposerRequest,
  buildInkProjectionProbeRequest,
  parseInkCoverageProbeResponse,
  parseInkProjectionProbeResponse,
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

async function features(): Promise<InkProjectionFeatureReference[]> {
  const witness = await image("#c7a68b");
  return [
    {
      featureId: "feature-1",
      featureVersionId: "version-1",
      normalizedDescriptor: "black botanical full sleeve",
      anatomyLabel: "right arm - full sleeve",
      targetZone: { x: 0.08, y: 0.24, width: 0.25, height: 0.55 },
      witnessZone: { x: 0.08, y: 0.24, width: 0.25, height: 0.55 },
      witness,
      isProjectionTarget: true,
    },
    {
      featureId: "feature-2",
      featureVersionId: "version-2",
      normalizedDescriptor: "fine-line swallow",
      anatomyLabel: "left upper torso",
      targetZone: { x: 0.55, y: 0.2, width: 0.24, height: 0.24 },
      witnessZone: { x: 0.55, y: 0.2, width: 0.24, height: 0.24 },
      witness,
      isProjectionTarget: false,
    },
  ];
}

describe("multi-feature projection composition", () => {
  it("builds one bounded private mosaic and a three-image composer request", async () => {
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
      sourceAngle: "frontFull",
      targetAngle: "backFull",
      features: selected,
      attemptNumber: 1,
      identityAnchor: base,
      guidedTarget: base,
      evidenceMosaic: mosaic,
    });
    expect(request.images.map((entry) => entry.role)).toEqual([
      "identity_anchor",
      "guided_target",
      "evidence_mosaic",
    ]);
    expect(request.prompt).toContain("F1 (newly exposed continuation)");
    expect(request.prompt).toContain("F2 (already evidenced)");
    expect(request.prompt).toContain("canonical backFull");
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
      features: selected,
      target: base,
    });
    expect(request.kind).toBe("coverage");
    expect(request.recipeVersion).toBe("ink.add.anywhere.coverage-probe.v3");
    expect(request.prompt).toContain(
      "definitely hidden or absent region may be RegionVisible false",
    );
    const raw = {
      feature1RegionVisible: true,
      feature1VerdictCertain: true,
      feature2RegionVisible: false,
      feature2VerdictCertain: false,
    };
    expect(summarizeInkCoverageProbeResponse(raw, 2)).toEqual({
      responseShape: "valid_object",
      features: [
        { regionVisible: true, verdictCertain: true },
        { regionVisible: false, verdictCertain: false },
      ],
    });
    expect(() => parseInkCoverageProbeResponse(raw, [
      "version-1",
      "version-2",
    ])).toThrow("Observed coverage is unknown");
    expect(summarizeInkCoverageProbeResponse("not-json", 1)).toEqual({
      responseShape: "invalid",
      features: [{ regionVisible: null, verdictCertain: null }],
    });
  });
});
