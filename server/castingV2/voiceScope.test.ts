/**
 * `CASTING_VOICE_SCOPE` — dark by default, and ON WITHOUT ITS TRANSPORT
 * REFUSES BOOT (#2469, N4b-1; invariant 7).
 *
 * The boot guard is driven directly here, on `creationRecordScope.test.ts`'s
 * shape. **This file passes with the `validateEnv()` call deleted and does not
 * claim otherwise** — the WIRE is proven by a guard that was already in the
 * tree and needed nothing from this card: `server/scopeParentChain.test.ts`
 * derives every `validate…Environment` fence from the source and asserts both
 * that `validateEnv()` CALLS it (invariant 7's *a control that is not invoked
 * does not exist*) and that the parent variable it is handed is the one the
 * fence refuses on. It also refuses a flag with a boot fence and no entry in
 * `docs/architecture/FEATURE_FLAGS.md`, which is how the missing catalogue
 * entry for this flag was found rather than remembered.
 *
 * Why a boot refusal rather than a graceful degrade, in one sentence: a voice
 * road with no transport would offer *"Make new voices from this text"*, take
 * the press, and fail every single time — and in slice 2 that press carries a
 * price.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  CASTING_V2_SCOPE_ENV,
  CASTING_VOICE_SCOPE_ENV,
  CastingVoiceCoverageError,
  CastingVoiceScopeConfigurationError,
  CastingVoiceTransportConfigurationError,
  captureCastingVoiceEnabled,
  parseCastingVoiceScope,
  validateCastingVoiceEnvironment,
} from "./castingV2Scope";

/** A value of the right SHAPE and no meaning — never a real credential. */
const KEY = "xi-not-a-real-key";
const VARIABLE = "ELEVENLABS_API_KEY";

afterEach(() => {
  delete process.env[CASTING_VOICE_SCOPE_ENV];
  delete process.env[CASTING_V2_SCOPE_ENV];
});

describe("the boot guard", () => {
  it("off — and absent — needs nothing, not even the key", () => {
    for (const scope of [undefined, "", "off"]) {
      expect(
        validateCastingVoiceEnvironment({
          scope,
          castingScope: undefined,
          voiceKey: undefined,
          voiceKeyVariable: VARIABLE,
        }),
      ).toEqual({ kind: "off" });
    }
  });

  it("⚠ ON WITHOUT THE TRANSPORT REFUSES, and names the variable", () => {
    for (const voiceKey of [undefined, ""]) {
      expect(() =>
        validateCastingVoiceEnvironment({
          scope: "users:1",
          castingScope: "all",
          voiceKey,
          voiceKeyVariable: VARIABLE,
        }),
      ).toThrow(CastingVoiceTransportConfigurationError);
    }
    expect(() =>
      validateCastingVoiceEnvironment({
        scope: "all",
        castingScope: "all",
        voiceKey: undefined,
        voiceKeyVariable: VARIABLE,
      }),
    ).toThrow(new RegExp(VARIABLE));
  });

  it("⚠ the refusal carries the variable's NAME and never its VALUE", () => {
    /*
      The arm that matters on a credential: a message is logged, and a boot
      refusal is the single most-read line a deploy produces.
    */
    let message = "";
    try {
      validateCastingVoiceEnvironment({
        scope: "all",
        castingScope: "all",
        voiceKey: KEY,
        voiceKeyVariable: VARIABLE,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("");

    try {
      validateCastingVoiceEnvironment({
        scope: "all",
        castingScope: "off",
        voiceKey: KEY,
        voiceKeyVariable: VARIABLE,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain(KEY);
  });

  it("CONTROL — on with a transport, inside its parent, boots", () => {
    expect(
      validateCastingVoiceEnvironment({
        scope: "users:1",
        castingScope: "users:1,2",
        voiceKey: KEY,
        voiceKeyVariable: VARIABLE,
      }),
    ).toEqual({ kind: "users", userIds: [1] });
  });
});

describe("the parent chain — a voice is OF a signed cast", () => {
  it("refuses while casting itself is off", () => {
    expect(() =>
      validateCastingVoiceEnvironment({
        scope: "all",
        castingScope: undefined,
        voiceKey: KEY,
        voiceKeyVariable: VARIABLE,
      }),
    ).toThrow(CastingVoiceCoverageError);
  });

  it('refuses "all" while casting is limited to named users', () => {
    expect(() =>
      validateCastingVoiceEnvironment({
        scope: "all",
        castingScope: "users:1",
        voiceKey: KEY,
        voiceKeyVariable: VARIABLE,
      }),
    ).toThrow(/cannot be "all"/);
  });

  it("⚠ refuses a user who reaches PAST the parent, and names them", () => {
    expect(() =>
      validateCastingVoiceEnvironment({
        scope: "users:1,7",
        castingScope: "users:1",
        voiceKey: KEY,
        voiceKeyVariable: VARIABLE,
      }),
    ).toThrow(/outside CASTING_V2_SCOPE: 7/);
  });
});

describe("the grammar", () => {
  it("refuses anything that is not off / all / users:<positive ids>", () => {
    for (const raw of ["yes", "users:", "users:0", "users:-1", "users:1,1", "users:a", "ALL "]) {
      expect(() => parseCastingVoiceScope(raw), raw).toThrow(CastingVoiceScopeConfigurationError);
    }
  });

  it("reads the three legal shapes", () => {
    expect(parseCastingVoiceScope(undefined)).toEqual({ kind: "off" });
    expect(parseCastingVoiceScope("all")).toEqual({ kind: "all" });
    expect(parseCastingVoiceScope("users:3,1")).toEqual({ kind: "users", userIds: [1, 3] });
  });
});

describe("the capture, which is what the road actually asks", () => {
  it("⚠ is ANDed with its parent, so a child alone opens nothing", () => {
    process.env[CASTING_VOICE_SCOPE_ENV] = "all";
    delete process.env[CASTING_V2_SCOPE_ENV];
    expect(captureCastingVoiceEnabled(1)).toBe(false);
  });

  it("is off for a user the flag does not name", () => {
    process.env[CASTING_VOICE_SCOPE_ENV] = "users:1";
    process.env[CASTING_V2_SCOPE_ENV] = "all";
    expect(captureCastingVoiceEnabled(2)).toBe(false);
  });

  it("CONTROL — on for a user both flags cover", () => {
    process.env[CASTING_VOICE_SCOPE_ENV] = "users:1";
    process.env[CASTING_V2_SCOPE_ENV] = "all";
    expect(captureCastingVoiceEnabled(1)).toBe(true);
  });

  it("absent means off", () => {
    process.env[CASTING_V2_SCOPE_ENV] = "all";
    expect(captureCastingVoiceEnabled(1)).toBe(false);
  });
});
