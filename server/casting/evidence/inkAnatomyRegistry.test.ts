import { describe, expect, it } from "vitest";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import {
  ALL_SUPPORTED_INK_ANATOMY_TUPLES,
  INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION,
  INK_ANYWHERE_READABLE_COVERAGE_PROBE_RECIPE_VERSIONS,
  chooseCurrentInkAuthoringSource,
  inkAnatomicalSideAuthority,
  inkAnatomyLabel,
  inkAuthoringSourcePreferences,
  inkInvalidatedAnglesV2,
  inkViewDirectiveV2,
  isSupportedInkAnatomyTuple,
} from "./inkAnatomyRegistry";

describe("all-body ink anatomy registry", () => {
  it("keeps v1 coverage evidence readable after the confidence clarification", () => {
    expect(INK_ANYWHERE_COVERAGE_PROBE_RECIPE_VERSION)
      .toBe("ink.add.anywhere.coverage-probe.v2");
    expect(INK_ANYWHERE_READABLE_COVERAGE_PROBE_RECIPE_VERSIONS).toEqual([
      "ink.add.anywhere.coverage-probe.v1",
      "ink.add.anywhere.coverage-probe.v2",
    ]);
  });

  it("closes every supported tuple across every canonical angle", () => {
    expect(ALL_SUPPORTED_INK_ANATOMY_TUPLES.length).toBeGreaterThan(100);
    for (const tuple of ALL_SUPPORTED_INK_ANATOMY_TUPLES) {
      expect(isSupportedInkAnatomyTuple(tuple)).toBe(true);
      expect(inkAnatomyLabel(tuple).length).toBeGreaterThan(0);
      expect(inkAuthoringSourcePreferences(tuple).length).toBeGreaterThan(0);
      for (const angle of CANONICAL_VIEW_ANGLES) {
        const directive = inkViewDirectiveV2(tuple, angle);
        expect([
          "affected",
          "unaffected",
          "uncertain",
        ]).toContain(directive.impact);
        expect([
          "reproduce_visible",
          "hidden_omit",
          "outside_frame_omit",
          "below_resolution_omit",
          "conditional_probe",
        ]).toContain(directive.visibility);
        if (directive.impact === "uncertain") {
          expect(directive.visibility).toBe("conditional_probe");
          expect(directive.requiresObservedCoverage).toBe(true);
          expect(directive.normalizedTargetZone).not.toBeNull();
        }
        if (directive.normalizedTargetZone) {
          const zone = directive.normalizedTargetZone;
          expect(zone.x).toBeGreaterThanOrEqual(0);
          expect(zone.y).toBeGreaterThanOrEqual(0);
          expect(zone.width).toBeGreaterThan(0);
          expect(zone.height).toBeGreaterThan(0);
          expect(zone.x + zone.width).toBeLessThanOrEqual(1);
          expect(zone.y + zone.height).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("supports a right-arm full sleeve and makes all full views relevant", () => {
    const tuple = {
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    } as const;
    expect(isSupportedInkAnatomyTuple(tuple)).toBe(true);
    expect(inkAnatomyLabel(tuple)).toBe("Right arm · full sleeve");
    expect(inkViewDirectiveV2(tuple, "frontFull").impact).toBe("affected");
    expect(inkViewDirectiveV2(tuple, "sideFull").impact).toBe("affected");
    expect(inkViewDirectiveV2(tuple, "backFull").impact).toBe("affected");
    expect(inkViewDirectiveV2(tuple, "threeQuarter")).toMatchObject({
      impact: "uncertain",
      visibility: "conditional_probe",
      requiresObservedCoverage: true,
    });
    expect(inkViewDirectiveV2(tuple, "sideClose")).toMatchObject({
      impact: "uncertain",
      visibility: "conditional_probe",
      requiresObservedCoverage: true,
    });
    expect(inkInvalidatedAnglesV2(tuple)).toEqual([
      "threeQuarter",
      "frontFull",
      "sideClose",
      "sideFull",
      "backFull",
    ]);
    expect(inkAnatomicalSideAuthority(tuple, "frontFull")).toMatchObject({
      guideLabel: "SUBJECT RIGHT - FRAME LEFT",
    });
    expect(inkAnatomicalSideAuthority(tuple, "backFull")).toMatchObject({
      guideLabel: "SUBJECT RIGHT - FRAME RIGHT",
    });
    const frontRight = inkViewDirectiveV2(tuple, "frontFull")
      .normalizedTargetZone!;
    const frontLeft = inkViewDirectiveV2(
      { ...tuple, side: "left" },
      "frontFull",
    ).normalizedTargetZone!;
    expect(frontRight.x + frontRight.width).toBeLessThan(0.5);
    expect(frontLeft.x).toBeGreaterThan(0.5);
    expect(frontRight.x + frontRight.width).toBeLessThan(frontLeft.x);
    expect(frontRight.width).toBeLessThanOrEqual(0.36);
  });

  it("keeps every front/back sided guide disjoint from the frame midline", () => {
    for (const tuple of ALL_SUPPORTED_INK_ANATOMY_TUPLES) {
      if (tuple.side !== "right") continue;
      const left = { ...tuple, side: "left" as const };
      if (!isSupportedInkAnatomyTuple(left)) continue;
      for (const angle of ["frontClose", "frontFull", "backFull"] as const) {
        const rightZone = inkViewDirectiveV2(tuple, angle)
          .normalizedTargetZone;
        const leftZone = inkViewDirectiveV2(left, angle)
          .normalizedTargetZone;
        if (!rightZone || !leftZone) continue;
        const rightAuthority = inkAnatomicalSideAuthority(tuple, angle);
        const rightUsesFrameLeft =
          rightAuthority.guideLabel.includes("FRAME LEFT");
        const frameLeftZone = rightUsesFrameLeft ? rightZone : leftZone;
        const frameRightZone = rightUsesFrameLeft ? leftZone : rightZone;
        expect(frameLeftZone.x + frameLeftZone.width).toBeLessThan(0.5);
        expect(frameRightZone.x).toBeGreaterThan(0.5);
        expect(frameLeftZone.x + frameLeftZone.width)
          .toBeLessThan(frameRightZone.x);
      }
    }
  });

  it("uses lower hand/thigh bands for knee-framed front/back slots only", () => {
    const leftHand = {
      zone: "hand",
      surface: "dorsal",
      side: "left",
    } as const;
    const leftThigh = {
      zone: "thigh",
      surface: "anterior",
      side: "left",
    } as const;
    const front = inkViewDirectiveV2(leftHand, "frontFull")
      .normalizedTargetZone!;
    const back = inkViewDirectiveV2(leftHand, "backFull")
      .normalizedTargetZone!;
    const walk = inkViewDirectiveV2(leftHand, "sideFull")
      .normalizedTargetZone!;
    const frontThigh = inkViewDirectiveV2(leftThigh, "frontFull")
      .normalizedTargetZone!;
    const walkThigh = inkViewDirectiveV2(leftThigh, "sideFull")
      .normalizedTargetZone!;
    expect(front).toMatchObject({ y: 0.65, height: 0.27 });
    expect(back).toMatchObject({ y: 0.65, height: 0.27 });
    expect(walk).toMatchObject({ y: 0.58, height: 0.17 });
    expect(frontThigh).toMatchObject({ y: 0.79, height: 0.205 });
    expect(frontThigh.x).toBeCloseTo(0.53);
    expect(frontThigh.width).toBeCloseTo(0.11);
    expect(walkThigh).toMatchObject({ y: 0.55, height: 0.25 });
    expect(front.x).toBeGreaterThan(0.5);
    expect(back.x + back.width).toBeLessThan(0.5);
    expect(frontThigh.x + frontThigh.width).toBeLessThanOrEqual(0.64);
  });

  it("routes anatomy below the knees away from knee-framed slots", () => {
    for (const zone of ["lower_leg", "full_leg", "foot"] as const) {
      const tuple = {
        zone,
        surface: zone === "foot" ? "dorsal" : "circumferential",
        side: "left",
      } as const;
      expect(inkViewDirectiveV2(tuple, "frontFull")).toMatchObject({
        impact: "unaffected",
        visibility: "outside_frame_omit",
        normalizedTargetZone: null,
      });
      expect(inkViewDirectiveV2(tuple, "backFull")).toMatchObject({
        impact: "unaffected",
        visibility: "outside_frame_omit",
        normalizedTargetZone: null,
      });
      expect(inkAuthoringSourcePreferences(tuple)[0]?.angle)
        .toBe("sideFull");
    }
  });

  it("distinguishes below-resolution truth from hidden anatomy", () => {
    const face = {
      zone: "face",
      surface: "anterior",
      side: "left",
    } as const;
    expect(inkViewDirectiveV2(face, "frontClose").visibility)
      .toBe("reproduce_visible");
    expect(inkViewDirectiveV2(face, "frontFull")).toMatchObject({
      impact: "unaffected",
      visibility: "below_resolution_omit",
      normalizedTargetZone: null,
    });
  });

  it("keeps direction-dependent Walk visibility uncertain until observed", () => {
    const leftForearm = {
      zone: "forearm",
      surface: "lateral",
      side: "left",
    } as const;
    expect(inkViewDirectiveV2(leftForearm, "sideFull")).toMatchObject({
      impact: "uncertain",
      visibility: "conditional_probe",
      requiresObservedCoverage: true,
    });
  });

  it("chooses only a current, unpinned server-owned source", () => {
    const tuple = {
      zone: "upper_torso",
      surface: "posterior",
      side: "centre",
    } as const;
    expect(chooseCurrentInkAuthoringSource(tuple, [
      {
        angle: "backFull",
        assetId: 41,
        compatibility: "stale",
        pinned: false,
      },
      {
        angle: "sideFull",
        assetId: 42,
        compatibility: "current",
        pinned: false,
      },
    ])).toEqual({
      angle: "sideFull",
      assetId: 42,
      requiresCoverageProbe: true,
    });
    expect(chooseCurrentInkAuthoringSource(tuple, [
      {
        angle: "backFull",
        assetId: 41,
        compatibility: "current",
        pinned: true,
      },
    ])).toBeNull();
  });

  it("rejects unsupported tuples instead of normalizing them", () => {
    expect(isSupportedInkAnatomyTuple({
      zone: "full_arm",
      surface: "anterior",
      side: "right",
    })).toBe(false);
    expect(isSupportedInkAnatomyTuple({
      zone: "upper_torso",
      surface: "anterior",
      side: "bilateral",
    })).toBe(false);
    expect(isSupportedInkAnatomyTuple({
      zone: "intimate",
      surface: "anterior",
      side: "centre",
    })).toBe(false);
  });
});
