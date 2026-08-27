/**
 * `CASTING_CONCEPT_UPLOAD_SCOPE` — the door, and the parent that is NOT the one
 * every other sub-flag in this program has (#185).
 *
 * The arm worth reading is `refuses to arm over the REGISTER`: this flag's
 * parent is `CASTING_CREATIVE_REGISTER_SCOPE` rather than `CASTING_V2_SCOPE`,
 * because what the description must not contradict is the locked house block
 * and that block is appended on the author road alone. A copy-paste of the
 * sibling flags' guard would have checked casting and let an account off the
 * author road through — so the coverage arms below drive the register, and one
 * of them holds casting OPEN while the register is shut.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CASTING_CONCEPT_UPLOAD_SCOPE_ENV,
  CastingConceptUploadCoverageError,
  CastingConceptUploadScopeConfigurationError,
  captureCastingConceptUploadEnabled,
  parseCastingConceptUploadScope,
  validateCastingConceptUploadEnvironment,
} from "./castingV2Scope";

const KEYS = [
  CASTING_CONCEPT_UPLOAD_SCOPE_ENV,
  "CASTING_CREATIVE_REGISTER_SCOPE",
  "CASTING_V2_SCOPE",
] as const;

describe("the concept-upload scope", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const key of KEYS) saved[key] = process.env[key]; });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("is off when absent, which is the position the product ships in", () => {
    expect(parseCastingConceptUploadScope(undefined).kind).toBe("off");
    expect(parseCastingConceptUploadScope("off").kind).toBe("off");
  });

  it("refuses a grammar it does not know rather than guessing at one", () => {
    expect(() => parseCastingConceptUploadScope("user:1"))
      .toThrow(CastingConceptUploadScopeConfigurationError);
    expect(() => parseCastingConceptUploadScope("users:0"))
      .toThrow(CastingConceptUploadScopeConfigurationError);
  });

  it("boots happily while it is off, whatever its parent says", () => {
    expect(validateCastingConceptUploadEnvironment({ scope: undefined, registerScope: "off" }).kind)
      .toBe("off");
  });

  /*
    THE ARM THIS FILE EXISTS FOR. Casting is wide open here; the REGISTER is
    shut. A guard copied from a sibling would pass this and it must not.
  */
  it("refuses to arm over the REGISTER — not over casting, which is a different flag", () => {
    expect(() => validateCastingConceptUploadEnvironment({ scope: "users:1", registerScope: undefined }))
      .toThrow(CastingConceptUploadCoverageError);
    expect(() => validateCastingConceptUploadEnvironment({ scope: "users:1", registerScope: "off" }))
      .toThrow(/is off/);
  });

  it("refuses to reach past a narrowed parent, in both shapes", () => {
    expect(() => validateCastingConceptUploadEnvironment({ scope: "all", registerScope: "users:1" }))
      .toThrow(/cannot be "all"/);
    expect(() => validateCastingConceptUploadEnvironment({ scope: "users:1,7", registerScope: "users:1" }))
      .toThrow(/names users outside/);
  });

  it("admits a scope its parent covers", () => {
    expect(validateCastingConceptUploadEnvironment({ scope: "users:1", registerScope: "users:1,2" }).kind)
      .toBe("users");
    expect(validateCastingConceptUploadEnvironment({ scope: "all", registerScope: "all" }).kind)
      .toBe("all");
  });

  describe("the capture at the door", () => {
    it("is false for everyone while the flag is off", () => {
      delete process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV];
      process.env.CASTING_CREATIVE_REGISTER_SCOPE = "all";
      process.env.CASTING_V2_SCOPE = "all";
      expect(captureCastingConceptUploadEnabled(1)).toBe(false);
    });

    it("re-checks the WHOLE chain at the door, not just its own line", () => {
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "all";
      process.env.CASTING_V2_SCOPE = "all";
      /* The register shut: the door is shut, even though this flag says all. */
      process.env.CASTING_CREATIVE_REGISTER_SCOPE = "off";
      expect(captureCastingConceptUploadEnabled(1)).toBe(false);
      /* And casting shut underneath an open register shuts it too. */
      process.env.CASTING_CREATIVE_REGISTER_SCOPE = "all";
      process.env.CASTING_V2_SCOPE = "off";
      expect(captureCastingConceptUploadEnabled(1)).toBe(false);
      /* Both open: admitted. */
      process.env.CASTING_V2_SCOPE = "all";
      expect(captureCastingConceptUploadEnabled(1)).toBe(true);
    });

    it("admits only the users it names", () => {
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "users:1";
      process.env.CASTING_CREATIVE_REGISTER_SCOPE = "all";
      process.env.CASTING_V2_SCOPE = "all";
      expect(captureCastingConceptUploadEnabled(1)).toBe(true);
      expect(captureCastingConceptUploadEnabled(2)).toBe(false);
    });
  });
});
