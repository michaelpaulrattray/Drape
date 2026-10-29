/**
 * THE TAKE-FROM-A-PICTURE FLAG, driven directly — #2736 slice 2.
 *
 * Its siblings' grammar and its siblings' boot guard, proven in both directions
 * for invariant 7's reason: a boot guard nobody drove is a control nobody has
 * seen refuse, and a validator proven only by its refusals could be one that
 * refuses everything.
 *
 * ⚠ **THE RIDE FENCE'S ARM STOOD HERE AND WENT RED EXACTLY AS DESIGNED** — the
 * commit that landed the ride (the clause-keyed `source` on the wardrobe
 * presentation clause, the escalated decision of 2026-10-29) deleted
 * `REFERENCE_TAKE_RIDE_BUILT` and this suite's every-position-refused arm in
 * one act, which is what that arm's own docblock ordered. The coverage arms
 * below now do the work they were written for, asserting the SENTENCES their
 * comments named in advance.
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

  /*
    THE COVERAGE ARMS. Written before the ride landed (while the fence refused
    every non-off position they could only assert the error's TYPE); each now
    asserts the SENTENCE its own comment named in advance, so a refusal passing
    for the wrong reason has nowhere to hide.
  */
  it("refuses while the attach door is shut — the picture could never arrive", () => {
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, attachScope: undefined }))
      .toThrow(/CASTING_REFERENCE_ATTACH_SCOPE is off/);
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, attachScope: "off" }))
      .toThrow(CastingReferenceTakeCoverageError);
  });

  it("refuses to reach past its parent, in both of the ways a scope can", () => {
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, scope: "all" }))
      .toThrow(/cannot be "all"/);
    expect(() => validateCastingReferenceTakeEnvironment({ ...OPEN, scope: "users:1,9" }))
      .toThrow(/names users outside/);
  });

  /**
   * ⚠ THE POSITIVE CONTROLS, and without them every arm above could be passing
   * because the validator refuses everything it is handed.
   *
   * The covered non-off position is the arm the fence's deletion opened: until
   * the ride landed, `users:1` under a covering parent was refused like
   * everything else, and this is the proof the deletion changed the one thing
   * it was meant to change.
   */
  it("⚠ allows a covered position now the ride is built", () => {
    expect(validateCastingReferenceTakeEnvironment(OPEN))
      .toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingReferenceTakeEnvironment({ scope: "all", attachScope: "all" }))
      .toEqual({ kind: "all" });
  });

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
