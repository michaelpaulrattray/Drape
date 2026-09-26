/**
 * `CASTING_CONCEPT_UPLOAD_SCOPE` — the door, and its parent (#185).
 *
 * ⚠ **THE PARENT MOVED ON 2026-09-27 — `CASTING_CREATIVE_REGISTER_SCOPE` →
 * `CASTING_V2_SCOPE` (#1442, slice 1 of the old-lane retirement, on his word on
 * #1398: *"Delete it"*), and the arm this file used to exist for moved with it.**
 * That arm was `refuses to arm over the REGISTER — not over casting`: it held
 * casting wide OPEN while the register was shut, because a guard copy-pasted
 * from a sibling flag would have checked casting and let an account off the
 * author road through.
 *
 * **That arm is now the wrong question and it has been replaced rather than
 * deleted.** The register is being retired with the house road it gated, so the
 * shape it protected — an account inside casting and outside the author road —
 * cannot exist: the author road went to `all` on 2026-09-24. What this file must
 * still prove is that the door has a REAL parent and refuses over it, which is
 * what the two refusal arms below drive; the danger after a re-parent is an arm
 * that passes because nothing refuses any more, so the negative control comes
 * first and is named as such.
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
    expect(validateCastingConceptUploadEnvironment({ scope: undefined, castingScope: "off" }).kind)
      .toBe("off");
  });

  /*
    THE NEGATIVE CONTROL, AND IT IS THE ARM THAT MATTERS AFTER A RE-PARENT: a
    re-parent's failure mode is a gate that no longer gates. An ARMED child over
    a parent that is off or ABSENT must still refuse the boot, and the absent
    shape is the one the retirement itself will produce for the register's row.
  */
  it("refuses to arm over a parent that is off — and over one that is ABSENT", () => {
    expect(() => validateCastingConceptUploadEnvironment({ scope: "users:1", castingScope: undefined }))
      .toThrow(CastingConceptUploadCoverageError);
    expect(() => validateCastingConceptUploadEnvironment({ scope: "users:1", castingScope: "off" }))
      .toThrow(/is off/);
    /* The message names the new parent, so a stale one cannot pass as this one. */
    expect(() => validateCastingConceptUploadEnvironment({ scope: "all", castingScope: "off" }))
      .toThrow(/CASTING_V2_SCOPE/);
  });

  it("refuses to reach past a narrowed parent, in both shapes", () => {
    expect(() => validateCastingConceptUploadEnvironment({ scope: "all", castingScope: "users:1" }))
      .toThrow(/cannot be "all"/);
    expect(() => validateCastingConceptUploadEnvironment({ scope: "users:1,7", castingScope: "users:1" }))
      .toThrow(/names users outside/);
  });

  it("admits a scope its parent covers", () => {
    expect(validateCastingConceptUploadEnvironment({ scope: "users:1", castingScope: "users:1,2" }).kind)
      .toBe("users");
    expect(validateCastingConceptUploadEnvironment({ scope: "all", castingScope: "all" }).kind)
      .toBe("all");
  });

  /*
    ⚠ THE REGISTER IS NOT THIS FLAG'S PARENT ANY MORE, AND THAT IS ASSERTED
    RATHER THAN LEFT AS AN ABSENCE. A re-parent that forgets one of the two
    readers leaves the old parent still gating at the door or still refusing at
    the boot, and either one reads as "the change landed" from the other side.
    The register is held SHUT here in both readers while the child is armed.
  */
  it("no longer consults the register, at the boot OR at the door", () => {
    expect(validateCastingConceptUploadEnvironment({ scope: "all", castingScope: "all" }).kind)
      .toBe("all");

    process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "all";
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_CREATIVE_REGISTER_SCOPE = "off";
    expect(captureCastingConceptUploadEnabled(1)).toBe(true);
    delete process.env.CASTING_CREATIVE_REGISTER_SCOPE;
    expect(captureCastingConceptUploadEnabled(1)).toBe(true);
  });

  describe("the capture at the door", () => {
    it("is false for everyone while the flag is off", () => {
      delete process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV];
      process.env.CASTING_V2_SCOPE = "all";
      expect(captureCastingConceptUploadEnabled(1)).toBe(false);
    });

    it("re-checks its parent at the door, not just its own line", () => {
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "all";
      /* Casting shut: the door is shut, even though this flag says all. */
      process.env.CASTING_V2_SCOPE = "off";
      expect(captureCastingConceptUploadEnabled(1)).toBe(false);
      /* And an absent parent is shut too — the retirement's own shape. */
      delete process.env.CASTING_V2_SCOPE;
      expect(captureCastingConceptUploadEnabled(1)).toBe(false);
      /* Open: admitted. */
      process.env.CASTING_V2_SCOPE = "all";
      expect(captureCastingConceptUploadEnabled(1)).toBe(true);
    });

    it("admits only the users it names", () => {
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "users:1";
      process.env.CASTING_V2_SCOPE = "all";
      expect(captureCastingConceptUploadEnabled(1)).toBe(true);
      expect(captureCastingConceptUploadEnabled(2)).toBe(false);
    });

    /*
      THE POSITION THE PRODUCT ACTUALLY RUNS IN, 2026-09-27, read at the live
      service: casting `all`, the register `all`, this flag `all`. The gate goes
      from `all AND all` to `all`, so the re-parent changes no account's answer —
      and this arm is the one that would redden if the new chain ever disagreed
      with the old one on the shipped position.
    */
    it("answers the same as the old chain did on the shipped position", () => {
      process.env[CASTING_CONCEPT_UPLOAD_SCOPE_ENV] = "all";
      process.env.CASTING_V2_SCOPE = "all";
      process.env.CASTING_CREATIVE_REGISTER_SCOPE = "all";
      expect(captureCastingConceptUploadEnabled(1)).toBe(true);
      expect(captureCastingConceptUploadEnabled(823)).toBe(true);
    });
  });
});
