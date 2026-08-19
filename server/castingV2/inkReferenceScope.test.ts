import { describe, expect, it } from "vitest";

import {
  CASTING_INK_REFERENCE_SCOPE_ENV,
  CastingInkReferenceCoverageError,
  CastingInkReferenceScopeConfigurationError,
  INK_REFERENCE_TAKE_BUILT,
  captureCastingInkReferenceEnabled,
  parseCastingInkReferenceScope,
  validateCastingInkReferenceEnvironment,
} from "./castingV2Scope";

/**
 * THE TATTOO-FROM-A-REFERENCE FLAG, AND THE GUARD THAT WILL NOT LET IT OPEN.
 *
 * The gate's reference arm shipped before the take that answers what gets
 * through it. fable-1116 §4 required the two in one commit so the window never
 * exists; fable-1117 §1 approved moving that guarantee from a commit boundary
 * to an INSTRUMENT — a scope that cannot be enabled while the take is absent.
 *
 * **A guard that has never been watched refuse is not a guard** (invariant 7,
 * working law 3), so its refusal is the first thing driven here and it is driven
 * directly, not through anything that might be feeling generous.
 */
describe("the guard refuses the flag while the take does not exist", () => {
  it("refuses `all`, and says what to delete and when", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "all",
      attachScope: "all",
      takeBuilt: false,
    })).toThrow(/tattoo TAKE does not exist/);
  });

  it("refuses a single named user just as hard — no back door for one account", () => {
    /* The obvious shape of a leak: "it is only him". The window is about what
       the code can do, not about who is behind it. */
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "users:1",
      attachScope: "users:1",
      takeBuilt: false,
    })).toThrow(CastingInkReferenceCoverageError);
  });

  it("carries its own deletion condition in the message", () => {
    /* The person who meets this refusal should not have to go looking for the
       answer in a mailbox — the instruction lives with the instrument. */
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "all", attachScope: "all", takeBuilt: false,
    })).toThrow(/INK_REFERENCE_TAKE_BUILT/);
  });

  it("refuses BEFORE the parents are considered", () => {
    /*
      Order asserted, and it matters: with perfect parents the refusal must still
      be the take's, because a scope that cannot be served at all does not get to
      be discussed in terms of who covers it. If the parent check ran first, a
      correct-looking configuration would produce a message about the wrong
      problem.
    */
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "all", attachScope: "all", takeBuilt: false,
    })).toThrow(/tattoo TAKE/);
  });

  it("is OFF in the code as it stands — the default this guard is protecting", () => {
    /* The premise of every arm above. If somebody flips the constant without
       landing the take, THIS is the arm that says so. */
    expect(INK_REFERENCE_TAKE_BUILT).toBe(false);
  });

  it("lets `off` through untouched, because there is no window to close", () => {
    /* The negative control on the guard itself: a guard that refused everything
       would pass every arm above and be useless. */
    expect(validateCastingInkReferenceEnvironment({
      scope: undefined, attachScope: undefined,
    })).toEqual({ kind: "off" });
    expect(validateCastingInkReferenceEnvironment({
      scope: "off", attachScope: "off",
    })).toEqual({ kind: "off" });
  });
});

describe("with the take built, the parent coverage is what decides", () => {
  /*
    These arms drive the guard's OTHER half through `takeBuilt: true`, so the
    coverage rules are proven now rather than discovered on the day the take
    lands. A rule written today and first executed months later is a rule nobody
    has run.
  */
  it("refuses while the attach door is shut — no handle, no picture", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "all", attachScope: "off", takeBuilt: true,
    })).toThrow(/cannot be enabled while CASTING_REFERENCE_ATTACH_SCOPE is off/);
  });

  it("refuses `all` while the attach door is limited to named users", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "all", attachScope: "users:1", takeBuilt: true,
    })).toThrow(/cannot be "all"/);
  });

  it("refuses a user the attach door does not cover, and names them", () => {
    expect(() => validateCastingInkReferenceEnvironment({
      scope: "users:1,7", attachScope: "users:1", takeBuilt: true,
    })).toThrow(/names users outside CASTING_REFERENCE_ATTACH_SCOPE: 7/);
  });

  it("admits a covered user", () => {
    expect(validateCastingInkReferenceEnvironment({
      scope: "users:1", attachScope: "users:1", takeBuilt: true,
    })).toEqual({ kind: "users", userIds: [1] });
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
