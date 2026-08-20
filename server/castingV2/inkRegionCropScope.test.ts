import { describe, expect, it } from "vitest";

import {
  CASTING_INK_CUT_SCOPE_ENV,
  CASTING_INK_REGION_CROP_SCOPE_ENV,
  CastingInkRegionCropCoverageError,
  CastingInkRegionCropScopeConfigurationError,
  captureCastingInkRegionCropEnabled,
  parseCastingInkRegionCropScope,
  validateCastingInkRegionCropEnvironment,
} from "./castingV2Scope";

/**
 * THE FLAG THAT DECIDES WHETHER THE CUT IS THE SURFACE OR THE PATCH INSIDE IT
 * (`CASTING_INK_REGION_CROP_SCOPE`, approved fable-1183 §2, countersigned
 * fable-1201).
 *
 * Two controls, and they are not the same control: the BOOT GUARD refuses a
 * configuration that could not work, and the POINT OF USE answers for one
 * account on one request. A boot check nobody invoked is the second way a flag
 * pair goes wrong, and a point-of-use read that trusted the boot check is the
 * first — so both are driven here, exactly as its sibling's are.
 *
 * # Why the parent is the CUT scope and nothing else
 *
 * The region road is an ESCALATION of the `cut` route: it is reached only after
 * the routing has already decided to cut, so a user whose uploads are stored
 * whole has no road to escalate. Arming this over such a user would be arming a
 * step of a road they cannot enter — inert, and indistinguishable from mistaken.
 * The studio, repaint, library and transport parents ride in through the cut
 * flag's own check rather than being restated, because two checks of one fact
 * drift apart.
 *
 * # What these arms do NOT prove, said so it is not assumed
 *
 * Nothing here says the road is SAFE to flip. That is two things this file
 * cannot hold: the design floor (both founder specimens measure 183 and 229
 * against 256, so the road is inert by arithmetic today — driven in
 * `inkReferenceCutter.test.ts`), and fable-919 §3's founder gate, which is his
 * eyes on the frames and no arm's. Both live in the flag's own docblock.
 */
describe("the boot guard", () => {
  it("refuses while the cut door is shut — nothing to escalate", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "all", cutScope: "off",
    })).toThrow(/cannot be enabled while CASTING_INK_CUT_SCOPE is off/);
  });

  it("refuses with the coverage error's own type, not a bare throw", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "users:1", cutScope: "off",
    })).toThrow(CastingInkRegionCropCoverageError);
  });

  it("refuses `all` while the cut door is limited to named users", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "all", cutScope: "users:1",
    })).toThrow(/cannot be "all"/);
  });

  it("refuses a user the cut door does not cover, and NAMES them", () => {
    expect(() => validateCastingInkRegionCropEnvironment({
      scope: "users:1,7", cutScope: "users:1",
    })).toThrow(/names users outside CASTING_INK_CUT_SCOPE: 7/);
  });

  it("admits a covered user", () => {
    expect(validateCastingInkRegionCropEnvironment({
      scope: "users:1", cutScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("admits `all` under an `all` parent", () => {
    expect(validateCastingInkRegionCropEnvironment({
      scope: "all", cutScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, because there is nothing to cover", () => {
    /* THE NEGATIVE CONTROL. A validator that refused everything would pass
       every arm above and be useless. */
    expect(validateCastingInkRegionCropEnvironment({
      scope: undefined, cutScope: undefined,
    })).toEqual({ kind: "off" });
    expect(validateCastingInkRegionCropEnvironment({
      scope: "off", cutScope: "off",
    })).toEqual({ kind: "off" });
  });
});

describe("the grammar, and the point of use", () => {
  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingInkRegionCropScope("everyone"))
      .toThrow(CastingInkRegionCropScopeConfigurationError);
  });

  it("absent means off", () => {
    expect(parseCastingInkRegionCropScope(undefined)).toEqual({ kind: "off" });
  });

  it("is off for every user with nothing set — the state everywhere today", () => {
    const before = process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
    delete process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
    try {
      expect(captureCastingInkRegionCropEnabled(1)).toBe(false);
      expect(captureCastingInkRegionCropEnabled(999)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
      else process.env[CASTING_INK_REGION_CROP_SCOPE_ENV] = before;
    }
  });

  it("⚠ stays off for a named user when the PARENT is shut, at the point of use", () => {
    /*
      The AND of the whole chain, answered where it is asked rather than trusted
      from boot. This is the arm that would go red if
      `captureCastingInkRegionCropEnabled` were ever simplified to read its own
      variable alone — which is how a sub-flag comes to be armed over a road its
      user cannot enter.
    */
    const before = process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
    const beforeCut = process.env[CASTING_INK_CUT_SCOPE_ENV];
    process.env[CASTING_INK_REGION_CROP_SCOPE_ENV] = "users:1";
    delete process.env[CASTING_INK_CUT_SCOPE_ENV];
    try {
      expect(captureCastingInkRegionCropEnabled(1)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_REGION_CROP_SCOPE_ENV];
      else process.env[CASTING_INK_REGION_CROP_SCOPE_ENV] = before;
      if (beforeCut === undefined) delete process.env[CASTING_INK_CUT_SCOPE_ENV];
      else process.env[CASTING_INK_CUT_SCOPE_ENV] = beforeCut;
    }
  });
});
