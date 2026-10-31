/**
 * `CASTING_CONCEPT_RICH_LOOK_SCOPE` — how an uploaded concept is read, and its
 * parent, the upload door (#2911).
 *
 * The boot fence is driven directly here. **This file passes with the
 * `validateEnv()` call deleted and does not claim otherwise**: the wire from
 * `validateEnv()` to this fence, and the parent variable it is handed, are held
 * by `server/scopeParentChain.test.ts`, which derives every fence from the
 * source — the sibling flags' own division of labour (`voiceScope.test.ts`).
 *
 * The negative controls come first, because the failure that matters for a new
 * child is a fence that does not refuse: armed over a door that is shut, it
 * would be a switch with nothing behind it, and the shape a careless unset of
 * the parent produces is the absent one.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV,
  CASTING_CONCEPT_UPLOAD_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  CastingConceptRichLookCoverageError,
  CastingConceptRichLookScopeConfigurationError,
  captureCastingConceptRichLookEnabled,
  parseCastingConceptRichLookScope,
  validateCastingConceptRichLookEnvironment,
} from "./castingV2Scope";

const KEYS = [
  CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV,
  CASTING_CONCEPT_UPLOAD_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
] as const;

describe("the rich-look scope", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const key of KEYS) saved[key] = process.env[key]; });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("is off when absent, which is the position it ships in", () => {
    expect(parseCastingConceptRichLookScope(undefined).kind).toBe("off");
    expect(parseCastingConceptRichLookScope("off").kind).toBe("off");
  });

  it("refuses a grammar it does not know rather than guessing at one", () => {
    expect(() => parseCastingConceptRichLookScope("user:1"))
      .toThrow(CastingConceptRichLookScopeConfigurationError);
    expect(() => parseCastingConceptRichLookScope("users:1,banana"))
      .toThrow(CastingConceptRichLookScopeConfigurationError);
  });

  it("boots happily while it is off, whatever its parent says", () => {
    expect(validateCastingConceptRichLookEnvironment({ scope: undefined, conceptUploadScope: undefined }).kind)
      .toBe("off");
    expect(validateCastingConceptRichLookEnvironment({ scope: "off", conceptUploadScope: "off" }).kind)
      .toBe("off");
  });

  /* THE NEGATIVE CONTROL, and the absent parent is the shape that matters. */
  it("refuses to arm over an upload door that is off — and over one that is ABSENT", () => {
    expect(() => validateCastingConceptRichLookEnvironment({ scope: "users:1", conceptUploadScope: undefined }))
      .toThrow(CastingConceptRichLookCoverageError);
    expect(() => validateCastingConceptRichLookEnvironment({ scope: "users:1", conceptUploadScope: "off" }))
      .toThrow(/is off/);
    /* The message names its own flag and its real parent, so a copy-pasted
       sibling fence naming another parent cannot pass as this one. */
    expect(() => validateCastingConceptRichLookEnvironment({ scope: "all", conceptUploadScope: "off" }))
      .toThrow(/^CASTING_CONCEPT_RICH_LOOK_SCOPE cannot be enabled while CASTING_CONCEPT_UPLOAD_SCOPE is off/);
  });

  it("refuses to reach past a narrowed door, in both shapes", () => {
    expect(() => validateCastingConceptRichLookEnvironment({ scope: "all", conceptUploadScope: "users:1" }))
      .toThrow(/cannot be "all" while CASTING_CONCEPT_UPLOAD_SCOPE/);
    expect(() => validateCastingConceptRichLookEnvironment({ scope: "users:1,7", conceptUploadScope: "users:1" }))
      .toThrow(/names users outside CASTING_CONCEPT_UPLOAD_SCOPE: 7/);
  });

  /* THE POSITIVE CONTROL — the position the relay will set after merge. */
  it("admits a scope its door covers, including users:1 under production's `all`", () => {
    expect(validateCastingConceptRichLookEnvironment({ scope: "users:1", conceptUploadScope: "all" }).kind)
      .toBe("users");
    expect(validateCastingConceptRichLookEnvironment({ scope: "users:1", conceptUploadScope: "users:1,2" }).kind)
      .toBe("users");
    expect(validateCastingConceptRichLookEnvironment({ scope: "all", conceptUploadScope: "all" }).kind)
      .toBe("all");
  });

  describe("the capture at the door", () => {
    it("is false for everyone while the flag is off or absent", () => {
      process.env[CASTING_V2_SCOPE_ENV] = "all";
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "all";
      delete process.env[CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV];
      expect(captureCastingConceptRichLookEnabled(1)).toBe(false);
      process.env[CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV] = "off";
      expect(captureCastingConceptRichLookEnabled(1)).toBe(false);
    });

    it("re-checks the whole chain at the door, not just its own line", () => {
      process.env[CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV] = "all";
      process.env[CASTING_V2_SCOPE_ENV] = "all";
      /* The door shut: shut, though this flag says all. */
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "off";
      expect(captureCastingConceptRichLookEnabled(1)).toBe(false);
      /* The door open and casting shut: still shut — casting rides in through the door. */
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "all";
      process.env[CASTING_V2_SCOPE_ENV] = "off";
      expect(captureCastingConceptRichLookEnabled(1)).toBe(false);
      /* All three open: admitted. */
      process.env[CASTING_V2_SCOPE_ENV] = "all";
      expect(captureCastingConceptRichLookEnabled(1)).toBe(true);
    });

    it("admits only the users it names", () => {
      process.env[CASTING_V2_SCOPE_ENV] = "all";
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "all";
      process.env[CASTING_CONCEPT_RICH_LOOK_SCOPE_ENV] = "users:1";
      expect(captureCastingConceptRichLookEnabled(1)).toBe(true);
      expect(captureCastingConceptRichLookEnabled(2)).toBe(false);
    });
  });
});
