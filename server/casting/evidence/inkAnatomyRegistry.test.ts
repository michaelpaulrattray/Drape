import { describe, expect, it } from "vitest";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import {
  ALL_SUPPORTED_INK_ANATOMY_TUPLES,
  chooseCurrentInkAuthoringSource,
  inkAnatomyLabel,
  inkAuthoringSourcePreferences,
  inkViewDirectiveV2,
  isSupportedInkAnatomyTuple,
} from "./inkAnatomyRegistry";

describe("all-body ink anatomy registry", () => {
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
