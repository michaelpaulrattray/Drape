import { describe, expect, it } from "vitest";

import {
  CASTING_V2_SCOPE_ENV,
  CastingV2ValidatorConfigurationError,
  CastingV2CleanupWorkerConfigurationError,
  CastingV2ScopeConfigurationError,
  CastingV2TransportConfigurationError,
  castingV2EnabledForUser,
  parseCastingV2Scope,
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
