import { describe, expect, it } from "vitest";

import {
  CASTING_SEGMENTS_DELIVERED_SCOPE_ENV,
  CASTING_SEGMENTS_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
  CastingSegmentsCleanupWorkerError,
  CastingSegmentsDeliveredCoverageError,
  CastingSegmentsDeliveredScopeConfigurationError,
  deliveredAnchoredSegmentsEnabled,
  parseCastingSegmentsDeliveredScope,
  validateCastingSegmentsDeliveredEnvironment,
  CastingSegmentsCoverageError,
  CastingSegmentsScopeConfigurationError,
  CastingV2ValidatorConfigurationError,
  CastingV2CleanupWorkerConfigurationError,
  CastingV2ScopeConfigurationError,
  CastingV2TransportConfigurationError,
  captureCastingSegmentsEnabled,
  castingSegmentsArmed,
  castingV2EnabledForUser,
  parseCastingSegmentsScope,
  parseCastingV2Scope,
  validateCastingSegmentsEnvironment,
  validateCastingV2Environment,
} from "./castingV2Scope";

/**
 * The rollout scope (plan §K M4, flag-forward amendment).
 *
 * This flag guards *spendable* surface, which changes what "correct" means for
 * it: an ambiguous value must stop the server rather than resolve to a guess,
 * and a typo must never be the difference between "off" and "everyone".
 */

describe("grammar", () => {
  it("is off by default, and off is the only silent state", () => {
    expect(parseCastingV2Scope(undefined)).toEqual({ kind: "off" });
    expect(parseCastingV2Scope("")).toEqual({ kind: "off" });
    expect(parseCastingV2Scope("off")).toEqual({ kind: "off" });
  });

  it("admits an explicit user list, order-normalised", () => {
    expect(parseCastingV2Scope("users:9,3")).toEqual({ kind: "users", userIds: [3, 9] });
  });

  it("refuses anything it cannot read exactly", () => {
    // Every one of these is a plausible typo, and every one of them would be a
    // silent production behaviour change if it were tolerated.
    for (const raw of ["all ", "ALL", "user:3", "users:", "users:0", "users:3,3", "users: 3", "users:-1", "true"]) {
      expect(() => parseCastingV2Scope(raw), raw).toThrow(CastingV2ScopeConfigurationError);
    }
  });

  it("gates by user, and demands a real user id", () => {
    const scope = parseCastingV2Scope("users:3");
    expect(castingV2EnabledForUser(scope, 3)).toBe(true);
    expect(castingV2EnabledForUser(scope, 4)).toBe(false);
    expect(castingV2EnabledForUser({ kind: "all" }, 4)).toBe(true);
    expect(castingV2EnabledForUser({ kind: "off" }, 3)).toBe(false);
    expect(() => castingV2EnabledForUser(scope, 0)).toThrow(TypeError);
  });
});

describe("boot validation", () => {
  const configured = { cleanupWorker: "true", transportConfigured: true, validatorConfigured: true };

  it("lets the default configuration boot untouched", () => {
    // The whole point of shipping dark: an unset flag imposes no new
    // requirements on an existing deployment.
    expect(validateCastingV2Environment({ scope: undefined, cleanupWorker: undefined })).toEqual({
      kind: "off",
    });
  });

  it("refuses to enable without the cleanup worker", () => {
    // §G.6 promises candidate objects are purged. Without the worker nothing
    // ever deletes them, and the promise quietly becomes false.
    expect(() =>
      validateCastingV2Environment({ scope: "all", cleanupWorker: undefined, transportConfigured: true }),
    ).toThrow(CastingV2CleanupWorkerConfigurationError);
  });

  it("refuses to enable without an image transport", () => {
    // Otherwise the first paid roll charges, fails eight times on a missing
    // credential, and refunds — a configuration fault billed to the user.
    expect(() =>
      validateCastingV2Environment({
        scope: "users:3",
        cleanupWorker: "true",
        transportConfigured: false,
        validatorConfigured: true,
      }),
    ).toThrow(CastingV2TransportConfigurationError);
  });

  it("refuses to enable without the view-conformance validator", () => {
    // Sign (M7) is the other spendable surface, and it cannot land a view
    // without a second opinion (§I fail-closed). Unconfigured, every Sign
    // would charge 500, fail all six views closed, and refund 300 — an empty
    // package every time, with the money technically correct throughout.
    expect(() =>
      validateCastingV2Environment({
        scope: "all",
        cleanupWorker: "true",
        transportConfigured: true,
        validatorConfigured: false,
      }),
    ).toThrow(CastingV2ValidatorConfigurationError);
  });

  it("accepts a fully configured rollout", () => {
    expect(validateCastingV2Environment({ scope: "users:3", ...configured })).toEqual({
      kind: "users",
      userIds: [3],
    });
  });

  it("names the env var the operator actually sets", () => {
    expect(CASTING_V2_SCOPE_ENV).toBe("CASTING_V2_SCOPE");
  });
});

/**
 * The segment sub-flag.
 *
 * It exists because `CASTING_V2_SCOPE` is already open in production for the
 * founder's own dogfooding, so a store shipped under that flag alone would
 * begin writing on the paid path the moment it deployed. These cases are what
 * make "dark from the first commit" a property rather than an intention.
 */
describe("the segment sub-flag", () => {
  it("shares the casting flag's grammar, including its refusals", () => {
    expect(parseCastingSegmentsScope(undefined)).toEqual({ kind: "off" });
    expect(parseCastingSegmentsScope("users:4,2")).toEqual({ kind: "users", userIds: [2, 4] });
    for (const raw of ["ALL", "user:3", "users:", "users:0", "users:3,3", "true"]) {
      expect(() => parseCastingSegmentsScope(raw), raw).toThrow(CastingSegmentsScopeConfigurationError);
    }
  });

  it("is off by default, so landing the code changes nothing", () => {
    expect(validateCastingSegmentsEnvironment({
      scope: undefined,
      castingScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "off" });
  });

  it("refuses to arm without the cleanup worker", () => {
    // A segment writes a mask and a crop of a person's face to the public
    // bucket. Without the worker, the retention this store performs in the same
    // transaction as its writes would be false at the far end.
    expect(() => validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "users:1",
      cleanupWorker: undefined,
    })).toThrow(CastingSegmentsCleanupWorkerError);
  });

  it("refuses a scope reaching past the casting scope, in each way it can", () => {
    // Segments belong to candidates, and only Casting V2 makes candidates.
    expect(() => validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "off",
      cleanupWorker: "true",
    })).toThrow(CastingSegmentsCoverageError);
    expect(() => validateCastingSegmentsEnvironment({
      scope: "all",
      castingScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(CastingSegmentsCoverageError);
    expect(() => validateCastingSegmentsEnvironment({
      scope: "users:1,2",
      castingScope: "users:1",
      cleanupWorker: "true",
    })).toThrow(/names users outside CASTING_V2_SCOPE: 2/);
  });

  it("accepts a subset, and the same list under an open casting scope", () => {
    expect(validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "users:1,2",
      cleanupWorker: "true",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingSegmentsEnvironment({
      scope: "users:1",
      castingScope: "all",
      cleanupWorker: "true",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("reads BOTH flags at the point of use, not just its own", () => {
    const previous = { ...process.env };
    try {
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      process.env[CASTING_V2_SCOPE_ENV] = "users:1";
      expect(captureCastingSegmentsEnabled(1)).toBe(true);
      expect(captureCastingSegmentsEnabled(2)).toBe(false);

      // The boot check refuses this pairing; the point-of-use read refuses it a
      // second time, because the two ways a flag pair goes wrong are a bad
      // value and a boot check nobody invoked.
      process.env[CASTING_V2_SCOPE_ENV] = "users:2";
      expect(captureCastingSegmentsEnabled(1)).toBe(false);

      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "off";
      process.env[CASTING_V2_SCOPE_ENV] = "all";
      expect(captureCastingSegmentsEnabled(1)).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  it("reports armed WITHOUT narrowing to a user — the retention read", () => {
    const previous = { ...process.env };
    try {
      delete process.env[CASTING_SEGMENTS_SCOPE_ENV];
      expect(castingSegmentsArmed()).toBe(false);
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      // Armed is a property of the deployment, not of a user: the sweep must
      // collect segments belonging to anyone who has them, including a user
      // dropped from the list after their rows were written.
      expect(castingSegmentsArmed()).toBe(true);
    } finally {
      process.env = previous;
    }
  });

  it("names the env var the operator actually sets", () => {
    expect(CASTING_SEGMENTS_SCOPE_ENV).toBe("CASTING_SEGMENTS_SCOPE");
  });
});

/**
 * The silhouette sub-sub-flag.
 *
 * It governs HOW a segment is cut, so it is inert without the segment store —
 * and inert is indistinguishable from mistaken from outside, which is why it
 * refuses rather than quietly doing nothing. Same shape as the flag above it,
 * one level deeper, and driven the same way: every refusing direction driven,
 * not described.
 */
describe("the delivered-anchored sub-flag", () => {
  it("is off by default and asserts nothing", () => {
    expect(parseCastingSegmentsDeliveredScope(undefined)).toEqual({ kind: "off" });
    expect(validateCastingSegmentsDeliveredEnvironment({
      scope: undefined,
      segmentsScope: "off",
    })).toEqual({ kind: "off" });
  });

  it("refuses anything it cannot read exactly", () => {
    for (const raw of ["ALL", "user:1", "users:", "users:0", "users:1,1", "true"]) {
      expect(() => parseCastingSegmentsDeliveredScope(raw), raw)
        .toThrow(CastingSegmentsDeliveredScopeConfigurationError);
    }
  });

  it("refuses a scope reaching past the segment scope, in each way it can", () => {
    expect(() => validateCastingSegmentsDeliveredEnvironment({
      scope: "users:1",
      segmentsScope: undefined,
    })).toThrow(CastingSegmentsDeliveredCoverageError);
    expect(() => validateCastingSegmentsDeliveredEnvironment({
      scope: "all",
      segmentsScope: "users:1",
    })).toThrow(CastingSegmentsDeliveredCoverageError);
    expect(() => validateCastingSegmentsDeliveredEnvironment({
      scope: "users:1,2",
      segmentsScope: "users:1",
    })).toThrow(/names users outside CASTING_SEGMENTS_SCOPE: 2/);
  });

  it("accepts the ask — user 1, inside a segment scope that already covers him", () => {
    expect(validateCastingSegmentsDeliveredEnvironment({
      scope: "users:1",
      segmentsScope: "users:1",
    })).toEqual({ kind: "users", userIds: [1] });
  });

  it("reads the WHOLE chain at the point of use, not just its own flag", () => {
    const previous = { ...process.env };
    try {
      process.env[CASTING_V2_SCOPE_ENV] = "users:1";
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      process.env[CASTING_SEGMENTS_DELIVERED_SCOPE_ENV] = "users:1";
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(true);
      expect(deliveredAnchoredSegmentsEnabled(2)).toBe(false);

      /* Each parent turned off on its own must turn this off too — otherwise a
         segment could be cut a way its own store is not even armed for. */
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "off";
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(false);
      process.env[CASTING_SEGMENTS_SCOPE_ENV] = "users:1";
      process.env[CASTING_V2_SCOPE_ENV] = "off";
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(false);

      /* And absent is off, which is the state every deployment is in today. */
      process.env[CASTING_V2_SCOPE_ENV] = "users:1";
      delete process.env[CASTING_SEGMENTS_DELIVERED_SCOPE_ENV];
      expect(deliveredAnchoredSegmentsEnabled(1)).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  it("names the env var the operator actually sets", () => {
    expect(CASTING_SEGMENTS_DELIVERED_SCOPE_ENV).toBe("CASTING_SEGMENTS_DELIVERED_SCOPE");
  });
});
