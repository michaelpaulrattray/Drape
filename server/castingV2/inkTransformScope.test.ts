import { describe, expect, it } from "vitest";

import {
  CASTING_INK_TRANSFORM_SCOPE_ENV,
  CastingInkTransformCoverageError,
  CastingInkTransformScopeConfigurationError,
  captureCastingInkTransformEnabled,
  parseCastingInkTransformScope,
  validateCastingInkTransformEnvironment,
} from "./castingV2Scope";

/**
 * THE FLAG THAT DECIDES WHETHER SHE MAY CHANGE A TATTOO SHE ALREADY HAS
 * (founder-ordered fable-1269 §2, designed opus-940, countersigned fable-1274).
 *
 * Two controls and they are not the same control: the BOOT GUARD refuses a
 * configuration that could not work, and the POINT OF USE answers for one
 * account on one request. A boot check nobody invoked is the second way a flag
 * pair goes wrong; a point-of-use read that trusted the boot check is the
 * first. Both are driven here.
 *
 * # What OFF has to mean, and it is not "nothing happens"
 *
 * Off, *"make his chest tattoo bigger"* travels the road it travels today —
 * which is the WRONG road: it paints a fresh design invented from his prose,
 * charged, with his own piece never on the wire (driven, opus-948 §1). That is
 * nevertheless what a dark landing means, and the negative control in
 * `refineService.test.ts` is what proves the flag really is a flag.
 *
 * # Why the parent is the studio door
 *
 * A transform's whole content is a picture of a tattoo this product already
 * delivered, and the studio door is what makes a tattoo deliverable at all.
 * Armed over a user outside it, this flag would guard a lane whose subject
 * cannot exist — inert, and indistinguishable from mistaken.
 */
describe("the boot guard", () => {
  it("refuses while the studio door is shut — no tattoo, nothing to change", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "all", studioScope: "off",
    })).toThrow(/cannot be enabled while CASTING_INK_STUDIO_SCOPE is off/);
  });

  it("refuses with the coverage error's own type, not a bare throw", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "users:1", studioScope: "off",
    })).toThrow(CastingInkTransformCoverageError);
  });

  it("refuses `all` while the studio door is limited to named users", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "all", studioScope: "users:1",
    })).toThrow(/cannot be "all"/);
  });

  it("refuses a user the studio door does not cover, and NAMES them", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "users:1,7", studioScope: "users:1",
    })).toThrow(/names users outside CASTING_INK_STUDIO_SCOPE: 7/);
  });

  it("admits a covered user, and `all` under an `all` parent", () => {
    expect(validateCastingInkTransformEnvironment({
      scope: "users:1", studioScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingInkTransformEnvironment({
      scope: "all", studioScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, because there is nothing to cover", () => {
    /* THE NEGATIVE CONTROL. A validator that refused everything would pass
       every arm above and be useless. */
    expect(validateCastingInkTransformEnvironment({
      scope: undefined, studioScope: undefined,
    })).toEqual({ kind: "off" });
    expect(validateCastingInkTransformEnvironment({
      scope: "off", studioScope: "off",
    })).toEqual({ kind: "off" });
  });
});

describe("the grammar, and the point of use", () => {
  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingInkTransformScope("everyone"))
      .toThrow(CastingInkTransformScopeConfigurationError);
  });

  it("absent means off", () => {
    expect(parseCastingInkTransformScope(undefined)).toEqual({ kind: "off" });
  });

  it("is off for every user with nothing set — the state everywhere today", () => {
    const before = process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
    delete process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
    try {
      expect(captureCastingInkTransformEnabled(1)).toBe(false);
      expect(captureCastingInkTransformEnabled(999)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
      else process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = before;
    }
  });

  it("⚠ stays off for a named user when the PARENT is shut, at the point of use", () => {
    /*
      The AND of the whole chain, answered where it is asked rather than trusted
      from boot. This is the arm that would go red if the reader were ever
      simplified to consult its own variable alone — which is how a sub-flag
      comes to be armed over a road its user cannot enter.
    */
    const before = process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
    const beforeStudio = process.env.CASTING_INK_STUDIO_SCOPE;
    process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = "users:1";
    delete process.env.CASTING_INK_STUDIO_SCOPE;
    try {
      expect(captureCastingInkTransformEnabled(1)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
      else process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = before;
      if (beforeStudio === undefined) delete process.env.CASTING_INK_STUDIO_SCOPE;
      else process.env.CASTING_INK_STUDIO_SCOPE = beforeStudio;
    }
  });
});
