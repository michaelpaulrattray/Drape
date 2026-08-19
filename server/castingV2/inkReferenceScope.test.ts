import { describe, expect, it } from "vitest";

import {
  CASTING_INK_REFERENCE_SCOPE_ENV,
  CastingInkReferenceCoverageError,
  CastingInkReferenceScopeConfigurationError,
  captureCastingInkReferenceEnabled,
  parseCastingInkReferenceScope,
  validateCastingInkReferenceEnvironment,
} from "./castingV2Scope";

/**
 * THE TATTOO-FROM-A-REFERENCE FLAG, AND WHAT NOW DECIDES WHETHER IT MAY OPEN.
 *
 * # The guard that used to live here, and why its arms are gone rather than
 * # rewritten
 *
 * `INK_REFERENCE_TAKE_BUILT` refused any non-off scope while nothing read a
 * placement out of her sentence — the gate's reference arm having shipped one
 * commit ahead of the take that answers what gets through it (fable-1116 §4,
 * moved from a commit boundary to an instrument at fable-1117 §1). **The take
 * has landed, so the guard was deleted in the same commit its own message named,
 * and its arms went with it**: a test of a branch that no longer exists is a
 * suite reporting on nothing, which is the shape this campaign keeps exhuming
 * from the other direction.
 *
 * What replaces them is not a smaller guard — it is the PARENT COVERAGE below,
 * which was written the same day and driven then through the guard's injectable
 * half precisely so that it would already be proven on the day the take landed.
 * It is now the only thing between this flag and the road, and every one of its
 * refusals is driven here.
 */
describe("the parent coverage is what decides", () => {
  it("refuses while the attach door is shut — no handle, no picture", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "all", attachScope: "off",
    })).toThrow(/cannot be enabled while CASTING_REFERENCE_ATTACH_SCOPE is off/);
  });

  it("refuses with the coverage error's own type, not a bare throw", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "users:1", attachScope: "off",
    })).toThrow(CastingInkReferenceCoverageError);
  });

  it("refuses `all` while the attach door is limited to named users", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "all", attachScope: "users:1",
    })).toThrow(/cannot be "all"/);
  });

  it("refuses a user the attach door does not cover, and names them", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "users:1,7", attachScope: "users:1",
    })).toThrow(/names users outside CASTING_REFERENCE_ATTACH_SCOPE: 7/);
  });

  it("admits a covered user", () => {
    expect(validateCastingInkReferenceEnvironment({
      scope: "users:1", attachScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("lets `off` through untouched, because there is nothing to cover", () => {
    /* The negative control: a validator that refused everything would pass every
       arm above and be useless. */
    expect(validateCastingInkReferenceEnvironment({
      scope: undefined, attachScope: undefined,
    })).toEqual({ kind: "off" });
    expect(validateCastingInkReferenceEnvironment({
      scope: "off", attachScope: "off",
    })).toEqual({ kind: "off" });
  });
});

describe("the grammar, and the point of use", () => {
  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingInkReferenceScope("everyone"))
      .toThrow(CastingInkReferenceScopeConfigurationError);
  });

  it("absent means off", () => {
    expect(parseCastingInkReferenceScope(undefined)).toEqual({ kind: "off" });
  });

  it("is off for every user with nothing set — the state everywhere today", () => {
    /*
      The point-of-use answer, read with the environment as it actually is. The
      boot guard and this are two different controls: a boot check nobody invoked
      is the second way a flag pair goes wrong, and a point-of-use read that
      trusted the boot check would be the first.
    */
    const before = process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
    delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
    try {
      expect(captureCastingInkReferenceEnabled(1)).toBe(false);
      expect(captureCastingInkReferenceEnabled(999)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
      else process.env[CASTING_INK_REFERENCE_SCOPE_ENV] = before;
    }
  });
});
