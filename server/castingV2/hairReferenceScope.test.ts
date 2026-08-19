/**
 * THE HAIR-FROM-A-REFERENCE FLAG, driven directly.
 *
 * Its siblings' grammar and its siblings' boot guard, proven in both directions
 * for invariant 7's reason — a boot guard nobody drove is a control nobody has
 * seen refuse, and a validator proven only by its refusals could be one that
 * refuses everything.
 *
 * **The arm carrying the most weight is the chain one.** This flag is what
 * keeps D-180's never-dead-end promise while the road is built in pieces: a
 * question with three chips, two of whose roads are unfinished, is a dead end
 * wearing a tap target. Nothing else in the product would go red if this stopped
 * refusing — the question would simply start being asked.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  CASTING_HAIR_REFERENCE_SCOPE_ENV,
  CastingHairReferenceCoverageError,
  CastingHairReferenceScopeConfigurationError,
  captureCastingHairReferenceEnabled,
  parseCastingHairReferenceScope,
  validateCastingHairReferenceEnvironment,
} from "./castingV2Scope";

const KEYS = [
  CASTING_HAIR_REFERENCE_SCOPE_ENV,
  "CASTING_REFERENCE_ATTACH_SCOPE",
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
  it("reads off, all and a user list — and ABSENT is off", () => {
    expect(parseCastingHairReferenceScope(undefined).kind).toBe("off");
    expect(parseCastingHairReferenceScope("off").kind).toBe("off");
    expect(parseCastingHairReferenceScope("all").kind).toBe("all");
    expect(parseCastingHairReferenceScope("users:1,7")).toEqual({ kind: "users", userIds: [1, 7] });
  });

  it("stops startup on a malformed value rather than half-enabling", () => {
    for (const bad of ["users:", "users:0", "users:1,1", "on", "true", "1"]) {
      expect(() => parseCastingHairReferenceScope(bad), bad)
        .toThrow(CastingHairReferenceScopeConfigurationError);
    }
  });
});

describe("the boot guard refuses", () => {
  const OPEN = { scope: "users:1", attachScope: "users:1" };

  it("admits the configuration that is actually coherent — the carve-out", () => {
    expect(validateCastingHairReferenceEnvironment(OPEN)).toEqual({ kind: "users", userIds: [1] });
  });

  it("refuses while the attach door is shut — the picture could never arrive", () => {
    expect(() => validateCastingHairReferenceEnvironment({ ...OPEN, attachScope: undefined }))
      .toThrow(CastingHairReferenceCoverageError);
    expect(() => validateCastingHairReferenceEnvironment({ ...OPEN, attachScope: "off" }))
      .toThrow(/CASTING_REFERENCE_ATTACH_SCOPE is off/);
  });

  it("refuses to reach past its parent, in both of the ways a scope can", () => {
    expect(() => validateCastingHairReferenceEnvironment({ ...OPEN, scope: "all" }))
      .toThrow(/cannot be "all"/);
    expect(() => validateCastingHairReferenceEnvironment({ ...OPEN, scope: "users:1,9" }))
      .toThrow(/names users outside/);
  });

  it("says nothing about anything while it is off — the whole chain is skipped", () => {
    expect(validateCastingHairReferenceEnvironment({ scope: undefined, attachScope: undefined }).kind)
      .toBe("off");
  });
});

describe("the AND is taken at the point of use, not only at boot", () => {
  it("is closed for everyone while the flag is absent", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REPAINT_SCOPE: "users:1",
      CASTING_REFERENCE_ATTACH_SCOPE: "users:1",
    });
    expect(captureCastingHairReferenceEnabled(1)).toBe(false);
  });

  /*
    AND THE WHOLE CHAIN IS RE-TAKEN HERE, not just this flag. The boot check
    refuses an incoherent pair, but a running process can be configured any way
    at all — and the failure mode of trusting boot alone is silent: the question
    gets asked to somebody whose attach door is shut.
  */
  it("is closed when this flag names her and the attach door does not", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_LIBRARY_SCOPE: "all",
      CASTING_REPAINT_SCOPE: "users:1,2",
      CASTING_REFERENCE_ATTACH_SCOPE: "users:1",
      CASTING_HAIR_REFERENCE_SCOPE: "users:1,2",
    });
    expect(captureCastingHairReferenceEnabled(1)).toBe(true);
    expect(captureCastingHairReferenceEnabled(2)).toBe(false);
  });

  it("is closed for a user this flag does not name", () => {
    setEnv({
      CASTING_V2_SCOPE: "all",
      CASTING_REFERENCE_LIBRARY_SCOPE: "all",
      CASTING_REPAINT_SCOPE: "all",
      CASTING_REFERENCE_ATTACH_SCOPE: "all",
      CASTING_HAIR_REFERENCE_SCOPE: "users:1",
    });
    expect(captureCastingHairReferenceEnabled(1)).toBe(true);
    expect(captureCastingHairReferenceEnabled(2)).toBe(false);
  });
});
