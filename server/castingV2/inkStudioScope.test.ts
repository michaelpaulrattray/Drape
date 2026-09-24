import { afterEach, describe, expect, it } from "vitest";
import {
  CASTING_INK_STUDIO_SCOPE_ENV,
  CastingInkStudioCoverageError,
  CastingInkStudioScopeConfigurationError,
  castingInkStudioArmed,
  parseCastingInkStudioScope,
  validateCastingInkStudioEnvironment,
} from "./castingV2Scope";

const KEYS = [
  CASTING_INK_STUDIO_SCOPE_ENV,
  "CASTING_REPAINT_SCOPE",
  "CASTING_REFERENCE_LIBRARY_SCOPE",
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

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

describe("the grammar is the siblings' grammar", () => {
  it("reads off, all and a user list", () => {
    expect(parseCastingInkStudioScope(undefined).kind).toBe("off");
    expect(parseCastingInkStudioScope("off").kind).toBe("off");
    expect(parseCastingInkStudioScope("all").kind).toBe("all");
    expect(parseCastingInkStudioScope("users:1,7")).toEqual({
      kind: "users",
      userIds: [1, 7],
    });
  });

  it("stops startup on a malformed value rather than half-enabling", () => {
    for (const bad of ["users:", "users:0", "users:1,1", "on", "true", "1"]) {
      expect(() => parseCastingInkStudioScope(bad))
        .toThrow(CastingInkStudioScopeConfigurationError);
    }
  });
});

describe("it cannot be armed past the road that would render it", () => {
  it("asserts nothing while it is off", () => {
    expect(validateCastingInkStudioEnvironment({
      scope: undefined,
      repaintScope: undefined,
      cleanupWorker: undefined,
    }).kind).toBe("off");
  });

  it("refuses while the repaint road is off", () => {
    /*
      An ink design reaches a photograph only through the repaint recipe, which
      paints from cropped references. On the paste road there is nothing that
      would carry a plate into the render, so a user armed here and not there is
      armed for a door that opens onto a wall.
    */
    expect(() => validateCastingInkStudioEnvironment({
      scope: "users:1",
      repaintScope: "off",
      cleanupWorker: "true",
    })).toThrow(CastingInkStudioCoverageError);
  });

  it("refuses a user the repaint road does not cover", () => {
    expect(() => validateCastingInkStudioEnvironment({
      scope: "users:1,7",
      repaintScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(/7/);
  });

  it("refuses all while the repaint road names specific users", () => {
    expect(() => validateCastingInkStudioEnvironment({
      scope: "all",
      repaintScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(CastingInkStudioCoverageError);
  });

  it("refuses without the cleanup worker", () => {
    /*
      An upload writes an object under the candidate's purge path. Without the
      worker running, nothing ever deletes it and the promise that a customer's
      picture goes away with her Cast becomes false silently — invariant 7.
    */
    expect(() => validateCastingInkStudioEnvironment({
      scope: "users:1",
      repaintScope: "users:1",
      cleanupWorker: undefined,
    })).toThrow(/ENABLE_STORAGE_CLEANUP_WORKER/);
  });

  it("admits a user the repaint road covers, with the worker running", () => {
    expect(validateCastingInkStudioEnvironment({
      scope: "users:1",
      repaintScope: "users:1",
      cleanupWorker: "true",
    }).kind).toBe("users");
  });
});

/*
  ⚠ THE POINT-OF-USE ARMS ARE GONE WITH THEIR SUBJECT — #1158 slice 4b, his
  ruling *"It retires with N2"*.

  Three arms stood here driving `captureCastingInkStudioEnabled` — the AND of
  the whole chain answered where it is asked. **The door it answered for was
  retired in slices 1–2**: `uploadInkDesign` does not exist, and after slice 4b
  deleted `captureCastingInkCutEnabled` the studio predicate had no reader of
  any kind. A predicate with no caller cannot be proven to guard anything, and
  an arm that drives one is measuring its own fixture.

  **What survives is the half that is NOT a door**, below: `castingInkStudioArmed`
  is the retention sweep's question, and the sweep does not retire when the
  feature does. Its arms are unchanged and are the reason this file stays.
*/



describe("armed at all — the retention sweep's only question", () => {
  it("is false when absent and when off", () => {
    setEnv({});
    expect(castingInkStudioArmed()).toBe(false);
    setEnv({ CASTING_INK_STUDIO_SCOPE: "off" });
    expect(castingInkStudioArmed()).toBe(false);
  });

  it("is true for ANY named user, including one this machine is not", () => {
    /*
      Deliberately not a per-user question and deliberately not an AND of the
      chain. The sweep asks it to decide whether a MISSING TABLE is tolerable,
      and a table is missing for the whole database or for none of it. Making
      this narrower would tolerate a real fault on the users it did not name.
    */
    setEnv({ CASTING_INK_STUDIO_SCOPE: "users:2" });
    expect(castingInkStudioArmed()).toBe(true);
  });

  it("refuses to answer at all on a scope it cannot parse", () => {
    /* A sweep running against an unreadable flag would tolerate a missing
       table on the strength of a value nobody can read. */
    setEnv({ CASTING_INK_STUDIO_SCOPE: "users:" });
    expect(() => castingInkStudioArmed()).toThrow(CastingInkStudioScopeConfigurationError);
  });
});
