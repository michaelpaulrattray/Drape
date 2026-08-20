import { describe, expect, it } from "vitest";

import {
  CASTING_INK_CUT_SCOPE_ENV,
  CastingInkCutCoverageError,
  CastingInkCutScopeConfigurationError,
  captureCastingInkCutEnabled,
  parseCastingInkCutScope,
  validateCastingInkCutEnvironment,
} from "./castingV2Scope";

/**
 * THE FLAG THAT DECIDES WHETHER AN UPLOADED DESIGN IS CUT BEFORE IT IS STORED.
 *
 * Two controls, and they are not the same control: the BOOT GUARD refuses a
 * configuration that could not work, and the POINT OF USE answers for one
 * account on one request. A boot check nobody invoked is the second way a flag
 * pair goes wrong, and a point-of-use read that trusted the boot check is the
 * first — so both are driven here.
 *
 * # ⚠ THERE IS NO `FAL_KEY` ARM HERE, AND THAT IS THE FINDING RATHER THAN A GAP
 *
 * One was written. The cutter refuses rather than storing a photograph when its
 * two questions go unanswered — fail-closed, and right — so a deployment with no
 * segmenter transport would refuse every upload behind this flag, with a
 * sentence about her picture rather than about our configuration. Refusing to
 * boot looked like the honest posture.
 *
 * **The check could never fire.** The parent chain is
 * `CASTING_INK_CUT_SCOPE` → `CASTING_INK_STUDIO_SCOPE` → `CASTING_REPAINT_SCOPE`
 * → `CASTING_REFERENCE_LIBRARY_SCOPE` → `CASTING_V2_SCOPE`, and the last of
 * those already refuses to boot without the key. It was found by driving the
 * guard through `validateEnv()` and insisting the arm assert ITS OWN REASON —
 * the arm refused, on `CASTING_V2_SCOPE`'s message. A looser regex would have
 * printed PROVEN over a control that does nothing.
 *
 * So the check is gone and the FACT keeps its arm, in
 * `scripts/rehearse-ink-cut-boot-disposable.mts`, where it is asserted end to
 * end through boot rather than against this validator.
 */
describe("the boot guard", () => {
  it("refuses while the studio door is shut — no upload, nothing to cut", () => {
    expect(() => validateCastingInkCutEnvironment({
      scope: "all", studioScope: "off",
    })).toThrow(/cannot be enabled while CASTING_INK_STUDIO_SCOPE is off/);
  });

  it("refuses with the coverage error's own type, not a bare throw", () => {
    expect(() => validateCastingInkCutEnvironment({
      scope: "users:1", studioScope: "off",
    })).toThrow(CastingInkCutCoverageError);
  });

  it("refuses `all` while the studio door is limited to named users", () => {
    expect(() => validateCastingInkCutEnvironment({
      scope: "all", studioScope: "users:1",
    })).toThrow(/cannot be "all"/);
  });

  it("refuses a user the studio door does not cover, and NAMES them", () => {
    expect(() => validateCastingInkCutEnvironment({
      scope: "users:1,7", studioScope: "users:1",
    })).toThrow(/names users outside CASTING_INK_STUDIO_SCOPE: 7/);
  });

  it("admits a covered user", () => {
    expect(validateCastingInkCutEnvironment({
      scope: "users:1", studioScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("admits `all` under an `all` parent", () => {
    expect(validateCastingInkCutEnvironment({
      scope: "all", studioScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, because there is nothing to cover", () => {
    /* THE NEGATIVE CONTROL. A validator that refused everything would pass
       every arm above and be useless. */
    expect(validateCastingInkCutEnvironment({
      scope: undefined, studioScope: undefined,
    })).toEqual({ kind: "off" });
    expect(validateCastingInkCutEnvironment({
      scope: "off", studioScope: "off",
    })).toEqual({ kind: "off" });
  });
});

describe("the grammar, and the point of use", () => {
  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingInkCutScope("everyone"))
      .toThrow(CastingInkCutScopeConfigurationError);
  });

  it("absent means off", () => {
    expect(parseCastingInkCutScope(undefined)).toEqual({ kind: "off" });
  });

  it("is off for every user with nothing set — the state everywhere today", () => {
    const before = process.env[CASTING_INK_CUT_SCOPE_ENV];
    delete process.env[CASTING_INK_CUT_SCOPE_ENV];
    try {
      expect(captureCastingInkCutEnabled(1)).toBe(false);
      expect(captureCastingInkCutEnabled(999)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_CUT_SCOPE_ENV];
      else process.env[CASTING_INK_CUT_SCOPE_ENV] = before;
    }
  });

  it("⚠ stays off for a named user when the PARENT is shut, at the point of use", () => {
    /*
      The AND of the whole chain, answered where it is asked rather than trusted
      from boot. This is the arm that would go red if `captureCastingInkCutEnabled`
      were ever simplified to read its own variable alone — which is how a
      sub-flag comes to be armed over a road its user cannot enter.
    */
    const before = process.env[CASTING_INK_CUT_SCOPE_ENV];
    const beforeStudio = process.env.CASTING_INK_STUDIO_SCOPE;
    process.env[CASTING_INK_CUT_SCOPE_ENV] = "users:1";
    delete process.env.CASTING_INK_STUDIO_SCOPE;
    try {
      expect(captureCastingInkCutEnabled(1)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_CUT_SCOPE_ENV];
      else process.env[CASTING_INK_CUT_SCOPE_ENV] = before;
      if (beforeStudio === undefined) delete process.env.CASTING_INK_STUDIO_SCOPE;
      else process.env.CASTING_INK_STUDIO_SCOPE = beforeStudio;
    }
  });
});
