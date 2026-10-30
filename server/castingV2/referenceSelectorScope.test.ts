/**
 * THE REFERENCE SELECTOR'S FLAG, driven directly — #14 slice 2.
 *
 * Its siblings' grammar and its siblings' boot guard, proven in BOTH directions
 * for invariant 7's reason: a boot guard nobody drove is a control nobody has
 * seen refuse, and a validator proven only by its refusals could be one that
 * refuses everything it is handed.
 *
 * ⚠ **THE BOOT ARM AT THE BOTTOM IS THE ONE THAT MATTERS.** A flag whose
 * validator is perfect and whose validator is never CALLED is the shape this
 * repository has been bitten by repeatedly — `CLAUDE.md`'s own "currently not
 * enforced" list is three of them. So the last describe block asserts the
 * variable reaches `server/_core/env.ts`'s boot path, with a negative control
 * on a name that is not wired.
 */
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CASTING_REFERENCE_SELECTOR_SCOPE_ENV,
  CastingReferenceSelectorCoverageError,
  CastingReferenceSelectorScopeConfigurationError,
  captureCastingReferenceSelectorEnabled,
  parseCastingReferenceSelectorScope,
  validateCastingReferenceSelectorEnvironment,
} from "./castingV2Scope";

const KEYS = [
  CASTING_REFERENCE_SELECTOR_SCOPE_ENV,
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
    expect(CASTING_REFERENCE_SELECTOR_SCOPE_ENV).toBe("CASTING_REFERENCE_SELECTOR_SCOPE");
  });

  it("reads the three shapes its siblings read", () => {
    expect(parseCastingReferenceSelectorScope(undefined)).toEqual({ kind: "off" });
    expect(parseCastingReferenceSelectorScope("off")).toEqual({ kind: "off" });
    expect(parseCastingReferenceSelectorScope("all")).toEqual({ kind: "all" });
    expect(parseCastingReferenceSelectorScope("users:1,4")).toEqual({ kind: "users", userIds: [1, 4] });
  });

  it("stops startup on a malformed value rather than half-enabling", () => {
    for (const bad of ["users:", "users:0", "users:1,1", "on", "true", "1"]) {
      expect(() => parseCastingReferenceSelectorScope(bad), bad)
        .toThrow(CastingReferenceSelectorScopeConfigurationError);
    }
  });
});

describe("the boot guard refuses", () => {
  const OPEN = { scope: "users:1", attachScope: "users:1" };

  it("refuses while the attach door is shut — the picture could never arrive", () => {
    expect(() => validateCastingReferenceSelectorEnvironment({ ...OPEN, attachScope: undefined }))
      .toThrow(/CASTING_REFERENCE_ATTACH_SCOPE is off/);
    expect(() => validateCastingReferenceSelectorEnvironment({ ...OPEN, attachScope: "off" }))
      .toThrow(CastingReferenceSelectorCoverageError);
  });

  it("refuses to reach past its parent, in both of the ways a scope can", () => {
    expect(() => validateCastingReferenceSelectorEnvironment({ ...OPEN, scope: "all" }))
      .toThrow(/cannot be "all"/);
    expect(() => validateCastingReferenceSelectorEnvironment({ ...OPEN, scope: "users:1,9" }))
      .toThrow(/names users outside/);
  });

  /**
   * ⚠ THE POSITIVE CONTROLS, and without them every arm above could be passing
   * because the validator refuses everything.
   */
  it("⚠ allows a covered position", () => {
    expect(validateCastingReferenceSelectorEnvironment(OPEN))
      .toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingReferenceSelectorEnvironment({ scope: "all", attachScope: "all" }))
      .toEqual({ kind: "all" });
  });

  it("says nothing about anything while it is off — the whole chain is skipped", () => {
    expect(validateCastingReferenceSelectorEnvironment({ scope: undefined, attachScope: undefined }))
      .toEqual({ kind: "off" });
    expect(validateCastingReferenceSelectorEnvironment({ scope: "off", attachScope: "off" }))
      .toEqual({ kind: "off" });
    /* And the real production shape the day this lands: the parent on, this one
       absent. It must boot, because that is every account today. */
    expect(validateCastingReferenceSelectorEnvironment({ scope: undefined, attachScope: "users:1" }))
      .toEqual({ kind: "off" });
  });
});

describe("the AND is taken at the point of use, not only at boot", () => {
  afterAll(restoreEnv);

  it("is closed for everyone while the flag is absent — which is today", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_ATTACH_SCOPE: "all",
      CASTING_REFERENCE_SELECTOR_SCOPE: undefined,
    });
    expect(captureCastingReferenceSelectorEnabled(1)).toBe(false);
  });

  it("is closed for a user the parent does not cover, even named here", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_ATTACH_SCOPE: "users:1",
      CASTING_REFERENCE_SELECTOR_SCOPE: "users:9",
    });
    /* The boot fence would never allow this pair; the point is that the reader
       does not RELY on the boot fence having run. */
    expect(captureCastingReferenceSelectorEnabled(9)).toBe(false);
  });

  it("⚠ is closed when the chain ROOT is off, however this flag reads", () => {
    setEnv({
      CASTING_V2_SCOPE: undefined,
      CASTING_REFERENCE_ATTACH_SCOPE: "all",
      CASTING_REFERENCE_SELECTOR_SCOPE: "all",
    });
    expect(captureCastingReferenceSelectorEnabled(1)).toBe(false);
  });

  it("⚠ POSITIVE CONTROL — it is open when the whole chain is", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_ATTACH_SCOPE: "all",
      CASTING_REFERENCE_SELECTOR_SCOPE: "users:1",
    });
    expect(captureCastingReferenceSelectorEnabled(1)).toBe(true);
    /* And a user it does not name is still closed, so the arm above is not
       passing because the reader answers true for everybody. */
    expect(captureCastingReferenceSelectorEnabled(2)).toBe(false);
  });
});

/**
 * ⚠ THE BOOT CHECK IS INVOKED — invariant 7, driven at the bytes.
 *
 * Read at `server/_core/env.ts` rather than asserted about it: a validator with
 * no call site is exactly the failure mode `CLAUDE.md` enumerates three live
 * instances of. The negative control is a name deliberately NOT wired, so this
 * arm cannot pass by matching anything at all in that file.
 */
describe("the boot path actually calls it", () => {
  const envSource = readFileSync(
    join(import.meta.dirname, "..", "_core", "env.ts"),
    "utf8",
  );

  it("imports the validator and calls it with both scopes", () => {
    expect(envSource).toContain("validateCastingReferenceSelectorEnvironment");
    expect(envSource).toContain("validateCastingReferenceSelectorEnvironment({");
    expect(envSource).toContain(CASTING_REFERENCE_SELECTOR_SCOPE_ENV);
  });

  it("⚠ NEGATIVE CONTROL — a validator that does not exist is not found there", () => {
    expect(envSource).not.toContain("validateCastingReferenceSelectorPretendEnvironment");
  });
});
