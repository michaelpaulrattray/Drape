import { afterEach, describe, expect, it } from "vitest";
import {
  CASTING_INK_STUDIO_SCOPE_ENV,
  CastingInkStudioCoverageError,
  CastingInkStudioScopeConfigurationError,
  captureCastingInkStudioEnabled,
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

describe("the chain is re-checked where it is used, not only at boot", () => {
  it("is off for everyone when the flag is absent", () => {
    setEnv({
      CASTING_REPAINT_SCOPE: "users:1",
      CASTING_REFERENCE_LIBRARY_SCOPE: "users:1",
      CASTING_V2_SCOPE: "users:1",
    });
    expect(captureCastingInkStudioEnabled(1)).toBe(false);
  });

  it("is off for a user the parent chain does not cover, even if this flag names them", () => {
    /*
      A boot check nobody invoked is the second way a flag pair goes wrong, so
      the AND of the chain is enforced at the point of use as well.
    */
    setEnv({
      CASTING_INK_STUDIO_SCOPE: "users:1",
      CASTING_REPAINT_SCOPE: "off",
      CASTING_REFERENCE_LIBRARY_SCOPE: "users:1",
      CASTING_V2_SCOPE: "users:1",
    });
    expect(captureCastingInkStudioEnabled(1)).toBe(false);
  });

  it("is on only for a named user with the whole chain behind them", () => {
    setEnv({
      CASTING_INK_STUDIO_SCOPE: "users:1",
      CASTING_REPAINT_SCOPE: "users:1",
      CASTING_REFERENCE_LIBRARY_SCOPE: "users:1",
      CASTING_V2_SCOPE: "users:1",
    });
    expect(captureCastingInkStudioEnabled(1)).toBe(true);
    expect(captureCastingInkStudioEnabled(2)).toBe(false);
  });
});
