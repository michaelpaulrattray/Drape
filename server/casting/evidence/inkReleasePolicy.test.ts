import { describe, expect, it } from "vitest";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import {
  INK_RELEASE_POLICY_VERSION,
  isInkAuthoringTupleReleased,
  isInkProjectionAngleReleased,
  releasedInkProjectionAngles,
} from "./inkReleasePolicy";

describe("R7-7G release policy", () => {
  it("releases only exact founder-confirmed authoring tuples", () => {
    expect(INK_RELEASE_POLICY_VERSION)
      .toBe("ink.add.release-policy.2026-07-30.v2");
    expect(isInkAuthoringTupleReleased({
      zone: "full_arm",
      surface: "circumferential",
      side: "right",
    })).toBe(true);
    expect(isInkAuthoringTupleReleased({
      zone: "full_arm",
      surface: "circumferential",
      side: "left",
    })).toBe(false);
    expect(isInkAuthoringTupleReleased({
      zone: "thigh",
      surface: "anterior",
      side: "left",
    })).toBe(true);
    expect(isInkAuthoringTupleReleased({
      zone: "thigh",
      surface: "posterior",
      side: "left",
    })).toBe(false);
  });

  it("opens only three-quarter for the scoped v4 calibration", () => {
    expect(releasedInkProjectionAngles()).toEqual(["threeQuarter"]);
    for (const angle of CANONICAL_VIEW_ANGLES) {
      expect(isInkProjectionAngleReleased(angle))
        .toBe(angle === "threeQuarter");
    }
  });
});
