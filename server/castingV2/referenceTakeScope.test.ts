/**
 * THE TAKE-FROM-A-PICTURE FLAG, driven directly — #2736 slice 2.
 *
 * Its siblings' grammar and its siblings' boot guard, proven in both directions
 * for invariant 7's reason: a boot guard nobody drove is a control nobody has
 * seen refuse, and a validator proven only by its refusals could be one that
 * refuses everything.
 *
 * ⚠ **THE ARM CARRYING THE MOST WEIGHT IS THE RIDE-NOT-BUILT ONE, and it is the
 * only arm in this file about something other than coverage.** The cutter, the
 * mint and the service branch are built; the RIDE into the recipe is not,
 * because clothing has no reference slot (`FACET_SLOTS.wardrobe` is `notASlot`,
 * D-136) and the assembler refuses a source whose slot no ask names. Flipping
 * this flag today would buy a segmenter read and store a cut on every clothing
 * ask and then drop it — **money spent for a picture that reaches no engine.**
 * `REFERENCE_TAKE_RIDE_BUILT` is the fence, the `INK_REFERENCE_TAKE_BUILT`
 * precedent exactly, and the arm below is how anybody knows it fires.
 *
 * ⚠ **THAT ARM IS WRITTEN SO IT GOES RED WHEN THE RIDE LANDS**, not so it has to
 * be remembered: it asserts the refusal AND names the constant to delete, which
 * is the same instruction the fence's own thrown string carries and the same one
 * `refineService.test.ts`'s declared-failing wire arm carries. Three places, one
 * commit, and each of the three fails loudly if that commit forgets it.
 */
import { afterAll, describe, expect, it } from "vitest";

import {
  CASTING_REFERENCE_TAKE_SCOPE_ENV,
  CastingReferenceTakeCoverageError,
  CastingReferenceTakeScopeConfigurationError,
  captureCastingReferenceTakeEnabled,
  parseCastingReferenceTakeScope,
  validateCastingReferenceTakeEnvironment,
} from "./castingV2Scope";

const KEYS = [
  CASTING_REFERENCE_TAKE_SCOPE_ENV,
  "CASTING_REFERENCE_ATTACH_SCOPE",
  "CASTING_V2_SCOPE",
] as const;

const saved = new Map<string, string | undefined>();
function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>): void {
  for (const key of KEYS) {
    if (!saved.has(key)) saved.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
function restoreEnv(): void {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
}

describe("the flag's own grammar", () => {
  it("names the variable the service reads", () => {
    expect(CASTING_REFERENCE_TAKE_SCOPE_ENV).toBe("CASTING_REFERENCE_TAKE_SCOPE");
  });

  it("reads the three shapes its siblings read", () => {
    expect(parseCastingReferenceTakeScope(undefined)).toEqual({ kind: "off" });
    expect(parseCastingReferenceTakeScope("off")).toEqual({ kind: "off" });
    expect(parseCastingReferenceTakeScope("all")).toEqual({ kind: "all" });
    expect(parseCastingReferenceTakeScope("users:1,4")).toEqual({ kind: "users", userIds: [1, 4] });
  });

  it("stops startup on a malformed value rather than half-enabling", () => {
    for (const bad of ["users:", "users:0", "users:1,1", "on", "true", "1"]) {
      expect(() => parseCastingReferenceTakeScope(bad), bad)
        .toThrow(CastingReferenceTakeScopeConfigurationError);
    }
  });
});

describe("the boot guard refuses", () => {
  const OPEN = { scope: "users:1", attachScope: "users:1" };

  /**
   * ⚠ THE FENCE, AND THE ARM THAT MUST GO RED WHEN THE RIDE LANDS.
   *
   * Today every non-off position is refused, whatever its coverage, because the
   * cut has nowhere to ride. When `REFERENCE_TAKE_RIDE_BUILT` is deleted this
   * arm fails on the first line, and the arms below it start doing the work
   * they were written for.
   */
  it("⚠ refuses EVERY non-off position while the ride is not built", () => {
    for (const scope of ["users:1", "all", "users:1,2"]) {
      expect(() => validateCastingReferenceTakeEnvironment({ scope, attachScope: "all" }), scope)
        .toThrow(CastingReferenceTakeCoverageError);
      expect(() => validateCastingReferenceTakeEnvironment({ scope, attachScope: "all" }), scope)
        .toThrow(/the cut is made and the RIDE is not/);
    }
    /* And it says what to delete, so the fence cannot be removed by somebody
       who has not read why it is there. */
    expect(() => validateCastingReferenceTakeEnvironment(OPEN))
      .toThrow(/delete REFERENCE_TAKE_RIDE_BUILT in the commit that lands the ride/);
  });

  /*
    THE COVERAGE ARMS, WRITTEN NOW AND MEANINGFUL LATER.

    They are kept rather than deferred because the chain is what the flag is FOR
    and because a fence added later is a fence nobody drove — but while the ride
    fence stands they can only assert the TYPE of the error, which both refusals
    share. Each names the sentence it will assert once the ride lands, so the
    shift that deletes the constant has the arms already written.
  */
  it("refuses while the attach door is shut — the picture could never arrive", () => {
    /* Once the ride lands: `.toThrow(/CASTING_REFERENCE_ATTACH_SCOPE is off/)`. */
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, attachScope: undefined }))
      .toThrow(CastingReferenceTakeCoverageError);
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, attachScope: "off" }))
      .toThrow(CastingReferenceTakeCoverageError);
  });

  it("refuses to reach past its parent, in both of the ways a scope can", () => {
    /* Once the ride lands: `/cannot be "all"/` and `/names users outside/`. */
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, scope: "all" }))
      .toThrow(CastingReferenceTakeCoverageError);
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, scope: "users:1,9" }))
      .toThrow(CastingReferenceTakeCoverageError);
  });

  /**
   * ⚠ THE POSITIVE CONTROL, and without it every arm above could be passing
   * because the validator refuses everything it is handed.
   *
   * `off` is the position production holds, so this is also the arm that proves
   * the fence above cannot crash a boot that has not opted in.
   */
  it("says nothing about anything while it is off — the whole chain is skipped", () => {
    expect(validateCastingReferenceTakeEnvironment({ scope: undefined, attachScope: undefined }))
      .toEqual({ kind: "off" });
    expect(validateCastingReferenceTakeEnvironment({ scope: "off", attachScope: "off" }))
      .toEqual({ kind: "off" });
    /* And the real production shape: the parent on, this one absent. */
    expect(validateCastingReferenceTakeEnvironment({ scope: undefined, attachScope: "users:1" }))
      .toEqual({ kind: "off" });
  });
});

describe("the AND is taken at the point of use, not only at boot", () => {
  afterAll(restoreEnv);

  it("is closed for everyone while the flag is absent", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_ATTACH_SCOPE: "all",
      CASTING_REFERENCE_TAKE_SCOPE: undefined,
    });
    expect(captureCastingReferenceTakeEnabled(1)).toBe(false);
  });

  it("is closed for a user the parent does not cover, even named here", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_ATTACH_SCOPE: "users:1",
      CASTING_REFERENCE_TAKE_SCOPE: "users:9",
    });
    /* The boot fence would never allow this pair; the point is that the reader
       does not RELY on the boot fence having run — which is the second way a
       flag pair goes wrong (a boot check nobody invoked). */
    expect(captureCastingReferenceTakeEnabled(9)).toBe(false);
  });

  it("⚠ is closed when the chain ROOT is off, however this flag reads", () => {
    setEnv({
      CASTING_V2_SCOPE: undefined,
      CASTING_REFERENCE_ATTACH_SCOPE: "all",
      CASTING_REFERENCE_TAKE_SCOPE: "all",
    });
    expect(captureCastingReferenceTakeEnabled(1)).toBe(false);
  });

  it("⚠ POSITIVE CONTROL — it is open when the whole chain is", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_ATTACH_SCOPE: "all",
      CASTING_REFERENCE_TAKE_SCOPE: "users:1",
    });
    expect(captureCastingReferenceTakeEnabled(1)).toBe(true);
    /* And a user it does not name is still closed, so the arm above is not
       passing because the reader answers true for everybody. */
    expect(captureCastingReferenceTakeEnabled(2)).toBe(false);
  });
});
