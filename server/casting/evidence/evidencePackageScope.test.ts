import { afterEach, describe, expect, it } from "vitest";
import {
  EVIDENCE_PACKAGE_SCOPE_ENV,
  captureEvidencePackageEnabled,
  evidencePackageEnabledForUser,
  parseEvidencePackageScope,
  validateEvidencePackageEnvironment,
} from "./evidencePackageScope";

const previousScope = process.env[EVIDENCE_PACKAGE_SCOPE_ENV];

afterEach(() => {
  if (previousScope === undefined) {
    delete process.env[EVIDENCE_PACKAGE_SCOPE_ENV];
  } else {
    process.env[EVIDENCE_PACKAGE_SCOPE_ENV] = previousScope;
  }
});

describe("R7-7E package execution scope", () => {
  it("defaults off and accepts only strict closed syntax", () => {
    expect(parseEvidencePackageScope(undefined)).toEqual({ kind: "off" });
    expect(parseEvidencePackageScope("users:2,1")).toEqual({
      kind: "users",
      userIds: [1, 2],
    });
    expect(parseEvidencePackageScope("all")).toEqual({ kind: "all" });
    for (const invalid of [
      "OFF", "users:", "users:01", "users:1,1", "users:1, 2", "users:0",
    ]) {
      expect(() => parseEvidencePackageScope(invalid)).toThrow();
    }
  });

  it("requires the package cohort to remain inside the composer cohort", () => {
    expect(validateEvidencePackageEnvironment({
      scope: "users:1",
      composerScope: "users:1,2",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(() => validateEvidencePackageEnvironment({
      scope: "users:2",
      composerScope: "users:1",
    })).toThrow("must be a subset");
    expect(() => validateEvidencePackageEnvironment({
      scope: "all",
      composerScope: "users:1",
    })).toThrow("must be a subset");
    expect(validateEvidencePackageEnvironment({
      scope: "all",
      composerScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("keeps deployment inert until the separate package gate is enabled", () => {
    delete process.env[EVIDENCE_PACKAGE_SCOPE_ENV];
    expect(captureEvidencePackageEnabled(1)).toBe(false);
    process.env[EVIDENCE_PACKAGE_SCOPE_ENV] = "users:1";
    expect(captureEvidencePackageEnabled(1)).toBe(true);
    expect(captureEvidencePackageEnabled(2)).toBe(false);
    expect(evidencePackageEnabledForUser({ kind: "off" }, 1)).toBe(false);
  });
});
