import { describe, expect, it } from "vitest";

import {
  CastingInkCutCoverageError,
  CastingInkCutScopeConfigurationError,
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

/*
  ⚠ THE POINT-OF-USE ARMS ARE GONE, AND THE SUBJECT IS GONE RATHER THAN THE
  COVERAGE — #1158 slice 4b.

  Two arms stood here and drove `captureCastingInkCutEnabled`: one that it is
  off with nothing set, and one that it stays off for a NAMED user when the
  parent is shut. That predicate was deleted in slice 4b, having had no
  production caller since slice 4a moved `CASTING_INK_REGION_CROP_SCOPE` onto
  the reference road, so the arms went with their subject.

  **The fact the second one protected did not die with it**, which is the only
  reason deleting them is honest: the AND-of-the-chain-at-the-point-of-use shape
  is driven for every LIVE sub-flag by its own suite, and
  `server/scopeParentChain.test.ts` holds the whole chain — the fences, their
  boot call sites, and the catalogue bullets — equal across all twenty.

  What remains below is the BOOT GUARD and the grammar, and they remain because
  the variable still stands at `users:1` on the service. Both leave in slice 4c,
  in the same act as the variable itself.
*/

describe("the grammar", () => {
  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingInkCutScope("everyone"))
      .toThrow(CastingInkCutScopeConfigurationError);
  });

  it("absent means off", () => {
    expect(parseCastingInkCutScope(undefined)).toEqual({ kind: "off" });
  });
});
