/**
 * `CASTING_CREATION_RECORD_SCOPE` — dark by default, and ON WITHOUT THE KEY
 * REFUSES (#2311; invariant 7).
 *
 * The boot guard is driven directly here. The WIRE — that `validateEnv()`
 * calls it — was rehearsed end to end through `validateEnv` for the PR that
 * shipped this (flag on, key absent → the process refuses, naming
 * `CREATION_RECORD_PRIVATE_KEY`); this file passes with that call deleted and
 * does not claim otherwise.
 */
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import {
  CASTING_CREATION_RECORD_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  CastingCreationRecordCoverageError,
  CastingCreationRecordScopeConfigurationError,
  captureCastingCreationRecordEnabled,
  validateCastingCreationRecordEnvironment,
} from "./castingV2Scope";
import { CreationRecordKeyError } from "./creationRecordSigning";

const KEY = JSON.stringify(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" }));

describe("the boot guard", () => {
  it("off — and absent — needs nothing, not even the key", () => {
    for (const scope of [undefined, "", "off"]) {
      expect(validateCastingCreationRecordEnvironment({ scope, castingScope: undefined, privateKey: undefined }))
        .toEqual({ kind: "off" });
    }
  });

  it("⚠ ON WITHOUT THE KEY REFUSES, and names the variable", () => {
    expect(() => validateCastingCreationRecordEnvironment({
      scope: "users:1", castingScope: "all", privateKey: undefined,
    })).toThrow(CreationRecordKeyError);
    expect(() => validateCastingCreationRecordEnvironment({
      scope: "all", castingScope: "all", privateKey: "",
    })).toThrow(/^CREATION_RECORD_PRIVATE_KEY is not set/);
  });

  it("CONTROL — on with a real key, inside its parent, boots", () => {
    expect(validateCastingCreationRecordEnvironment({ scope: "users:1", castingScope: "users:1,2", privateKey: KEY }))
      .toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingCreationRecordEnvironment({ scope: "all", castingScope: "all", privateKey: KEY }))
      .toEqual({ kind: "all" });
  });

  it("refuses while casting itself is off — there is no signed cast to record", () => {
    expect(() => validateCastingCreationRecordEnvironment({ scope: "users:1", castingScope: "off", privateKey: KEY }))
      .toThrow(CastingCreationRecordCoverageError);
  });

  it("refuses `all` under a named-user parent, and names a user the parent does not cover", () => {
    expect(() => validateCastingCreationRecordEnvironment({ scope: "all", castingScope: "users:1", privateKey: KEY }))
      .toThrow(/cannot be "all" while CASTING_V2_SCOPE/);
    expect(() => validateCastingCreationRecordEnvironment({ scope: "users:1,7", castingScope: "users:1", privateKey: KEY }))
      .toThrow(/names users outside CASTING_V2_SCOPE: 7/);
  });

  it("refuses a malformed scope with its own error", () => {
    expect(() => validateCastingCreationRecordEnvironment({ scope: "users: 1", castingScope: "all", privateKey: KEY }))
      .toThrow(CastingCreationRecordScopeConfigurationError);
  });
});

describe("at the point of use — the chain is ANDed", () => {
  const saved = { child: process.env[CASTING_CREATION_RECORD_SCOPE_ENV], parent: process.env[CASTING_V2_SCOPE_ENV] };
  afterEach(() => {
    for (const [name, value] of [
      [CASTING_CREATION_RECORD_SCOPE_ENV, saved.child],
      [CASTING_V2_SCOPE_ENV, saved.parent],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("is dark when the child is absent, whatever the parent says", () => {
    delete process.env[CASTING_CREATION_RECORD_SCOPE_ENV];
    process.env[CASTING_V2_SCOPE_ENV] = "all";
    expect(captureCastingCreationRecordEnabled(1)).toBe(false);
  });

  it("admits a named user only while the parent admits them too", () => {
    process.env[CASTING_CREATION_RECORD_SCOPE_ENV] = "users:1";
    process.env[CASTING_V2_SCOPE_ENV] = "all";
    expect(captureCastingCreationRecordEnabled(1)).toBe(true);
    expect(captureCastingCreationRecordEnabled(2)).toBe(false);
    process.env[CASTING_V2_SCOPE_ENV] = "off";
    expect(captureCastingCreationRecordEnabled(1)).toBe(false);
  });
});
