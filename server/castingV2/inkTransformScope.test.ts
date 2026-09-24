import { describe, expect, it } from "vitest";

import {
  CASTING_INK_TRANSFORM_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  CastingInkTransformCoverageError,
  CastingInkTransformScopeConfigurationError,
  captureCastingInkTransformEnabled,
  parseCastingInkTransformScope,
  validateCastingInkTransformEnvironment,
} from "./castingV2Scope";

/**
 * THE FLAG THAT DECIDES WHETHER SHE MAY CHANGE A TATTOO SHE ALREADY HAS
 * (founder-ordered fable-1269 §2, designed opus-940, countersigned fable-1274).
 *
 * Two controls and they are not the same control: the BOOT GUARD refuses a
 * configuration that could not work, and the POINT OF USE answers for one
 * account on one request. A boot check nobody invoked is the second way a flag
 * pair goes wrong; a point-of-use read that trusted the boot check is the
 * first. Both are driven here.
 *
 * # What OFF has to mean, and it is not "nothing happens"
 *
 * Off, *"make his chest tattoo bigger"* travels the road it travels today —
 * which is the WRONG road: it paints a fresh design invented from his prose,
 * charged, with his own piece never on the wire (driven, opus-948 §1). That is
 * nevertheless what a dark landing means, and the negative control in
 * `refineService.test.ts` is what proves the flag really is a flag.
 *
 * # Why the parent is `CASTING_V2_SCOPE`
 *
 * ⚠ **EVERY ARM BELOW NAMED THE STUDIO DOOR UNTIL 2026-09-24, AND THE DOCBLOCK
 * THEY SAT UNDER ARGUED FOR IT — #1158 slice 3.** It read *"a transform's whole
 * content is a picture of a tattoo this product already delivered, and the
 * studio door is what makes a tattoo deliverable at all."* The first clause is
 * right and the second is the error: **the subject is the delivered CROP**, and
 * `CASTING_INK_WORDS_SCOPE` — at `all` — delivers crops carrying no design row
 * and passing through no studio door. So the studio parent armed this flag over
 * a lane whose subject does not require it, which is the exact failure the
 * words flag's own docblock names one paragraph away.
 *
 * ⚠ **AND THE WRONG PARENT COULD NOT HAVE BEEN CAUGHT BY REWRITING THESE ARMS
 * MORE CAREFULLY, WHICH IS THE POINT WORTH KEEPING.** Every arm here passed on
 * both parents; they test that the fence HOLDS, and a fence can hold perfectly
 * around the wrong field. What settled it was reading what the road consumes
 * (`deliveredInkOnChain`, keyed by slot and valued by crop id) rather than what
 * the flag's prose asserted.
 */
describe("the boot guard", () => {
  it("refuses while casting itself is off — no render, so no delivered crop to change", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "all", castingScope: "off",
    })).toThrow(/cannot be enabled while CASTING_V2_SCOPE is off/);
  });

  it("refuses with the coverage error's own type, not a bare throw", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "users:1", castingScope: "off",
    })).toThrow(CastingInkTransformCoverageError);
  });

  it("refuses `all` while casting is limited to named users", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "all", castingScope: "users:1",
    })).toThrow(/cannot be "all"/);
  });

  it("refuses a user casting does not cover, and NAMES them", () => {
    expect(() => validateCastingInkTransformEnvironment({
      scope: "users:1,7", castingScope: "users:1",
    })).toThrow(/names users outside CASTING_V2_SCOPE: 7/);
  });

  it("admits a covered user, and `all` under an `all` parent", () => {
    expect(validateCastingInkTransformEnvironment({
      scope: "users:1", castingScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingInkTransformEnvironment({
      scope: "all", castingScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, because there is nothing to cover", () => {
    /* THE NEGATIVE CONTROL. A validator that refused everything would pass
       every arm above and be useless. */
    expect(validateCastingInkTransformEnvironment({
      scope: undefined, castingScope: undefined,
    })).toEqual({ kind: "off" });
    expect(validateCastingInkTransformEnvironment({
      scope: "off", castingScope: "off",
    })).toEqual({ kind: "off" });
  });

  it("⚠ ADMITS PRODUCTION'S OWN POSITIONS — the arm that would have gone red on the old parent", () => {
    /*
      THE RE-PARENT'S WHOLE CLAIM, DRIVEN RATHER THAN ARGUED: the same values
      the service carries today (`productionFlagPositions.mts` — casting `all`,
      transform `users:1`) boot clean, and so does the configuration the studio
      parent made IMPOSSIBLE — an account inside casting that was never inside
      the tattoo studio. That second line is the behaviour that actually
      changed, and it is a boot allowance rather than a capability: no account
      names this flag but his, and widening it is still his word.
    */
    expect(validateCastingInkTransformEnvironment({
      scope: "users:1", castingScope: "all",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingInkTransformEnvironment({
      scope: "users:7", castingScope: "all",
    })).toEqual({ kind: "users", userIds: [7] });
  });
});

describe("the grammar, and the point of use", () => {
  it("refuses a scope that is not the grammar", () => {
    expect(() => parseCastingInkTransformScope("everyone"))
      .toThrow(CastingInkTransformScopeConfigurationError);
  });

  it("absent means off", () => {
    expect(parseCastingInkTransformScope(undefined)).toEqual({ kind: "off" });
  });

  it("is off for every user with nothing set — the state everywhere today", () => {
    const before = process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
    delete process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
    try {
      expect(captureCastingInkTransformEnabled(1)).toBe(false);
      expect(captureCastingInkTransformEnabled(999)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
      else process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = before;
    }
  });

  it("⚠ stays off for a named user when the PARENT is shut, at the point of use", () => {
    /*
      The AND of the whole chain, answered where it is asked rather than trusted
      from boot. This is the arm that would go red if the reader were ever
      simplified to consult its own variable alone — which is how a sub-flag
      comes to be armed over a road its user cannot enter.
    */
    const before = process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
    const beforeCasting = process.env[CASTING_V2_SCOPE_ENV];
    process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = "users:1";
    delete process.env[CASTING_V2_SCOPE_ENV];
    try {
      expect(captureCastingInkTransformEnabled(1)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
      else process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = before;
      if (beforeCasting === undefined) delete process.env[CASTING_V2_SCOPE_ENV];
      else process.env[CASTING_V2_SCOPE_ENV] = beforeCasting;
    }
  });

  it("⚠ NO LONGER CONSULTS THE STUDIO DOOR — the re-parent, proven at the point of use", () => {
    /*
      THE ARM THAT IS THE COMMIT. With casting open and the transform naming the
      user, the answer is YES **with the tattoo studio shut** — which is the
      state #1158 slice 4 leaves the service in when it unsets that flag. Under
      the old parent this read `false`, and the transform road would have gone
      dark for his account on a cleanup commit, silently, with no test red
      anywhere: `captureCastingInkTransformEnabled` was the only thing that knew.
    */
    const before = process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
    const beforeCasting = process.env[CASTING_V2_SCOPE_ENV];
    const beforeStudio = process.env.CASTING_INK_STUDIO_SCOPE;
    process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = "users:1";
    process.env[CASTING_V2_SCOPE_ENV] = "all";
    delete process.env.CASTING_INK_STUDIO_SCOPE;
    try {
      expect(captureCastingInkTransformEnabled(1)).toBe(true);
      /* And still nobody else — the flag is the narrowing, as it always was. */
      expect(captureCastingInkTransformEnabled(2)).toBe(false);
    } finally {
      if (before === undefined) delete process.env[CASTING_INK_TRANSFORM_SCOPE_ENV];
      else process.env[CASTING_INK_TRANSFORM_SCOPE_ENV] = before;
      if (beforeCasting === undefined) delete process.env[CASTING_V2_SCOPE_ENV];
      else process.env[CASTING_V2_SCOPE_ENV] = beforeCasting;
      if (beforeStudio === undefined) delete process.env.CASTING_INK_STUDIO_SCOPE;
      else process.env.CASTING_INK_STUDIO_SCOPE = beforeStudio;
    }
  });
});
