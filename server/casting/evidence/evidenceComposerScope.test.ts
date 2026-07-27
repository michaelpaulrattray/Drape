import { afterEach, describe, expect, it } from "vitest";
import {
  EVIDENCE_COMPOSER_SCOPE_ENV,
  evidenceComposerSchemaRequired,
  parseEvidenceComposerRecipe,
  parseEvidenceComposerScope,
  validateEvidenceComposerEnvironment,
} from "./evidenceComposerScope";

const previousScope = process.env[EVIDENCE_COMPOSER_SCOPE_ENV];

afterEach(() => {
  if (previousScope === undefined) {
    delete process.env[EVIDENCE_COMPOSER_SCOPE_ENV];
  } else {
    process.env[EVIDENCE_COMPOSER_SCOPE_ENV] = previousScope;
  }
});

function valid(overrides: Partial<Parameters<
  typeof validateEvidenceComposerEnvironment
>[0]> = {}) {
  return validateEvidenceComposerEnvironment({
    scope: "users:1",
    recipe: "ink.add.front_upper_torso.v1",
    candidateWorker: "true",
    cleanupWorker: "true",
    snapshotScope: "users:1,2",
    ingestScope: "all",
    adapterConfigured: true,
    productReady: true,
    ...overrides,
  });
}

describe("R7-7D composer boot scope", () => {
  it("is off by default and accepts only strict closed syntax", () => {
    expect(parseEvidenceComposerScope(undefined)).toEqual({ kind: "off" });
    expect(parseEvidenceComposerScope("users:2,1")).toEqual({
      kind: "users",
      userIds: [1, 2],
    });
    expect(parseEvidenceComposerRecipe(undefined)).toEqual({ kind: "off" });
    expect(parseEvidenceComposerRecipe("ink.add.front_upper_torso.v1"))
      .toEqual({
        kind: "ink_add",
        capabilityKey: "ink.add.front_upper_torso.v1",
      });
    for (const invalid of [
      "OFF", "users:", "users:01", "users:1,1", "users:1, 2", "ink",
    ]) {
      if (invalid === "ink") {
        expect(() => parseEvidenceComposerRecipe(invalid)).toThrow();
      } else {
        expect(() => parseEvidenceComposerScope(invalid)).toThrow();
      }
    }
  });

  it("keeps scope-off inert without requiring workers or dependency cohorts", () => {
    expect(validateEvidenceComposerEnvironment({
      scope: "off",
      recipe: "off",
      candidateWorker: "false",
      cleanupWorker: "false",
      snapshotScope: "off",
      ingestScope: "off",
      adapterConfigured: false,
      productReady: false,
    })).toEqual({
      scope: { kind: "off" },
      recipe: { kind: "off" },
      candidateWorkerEnabled: false,
    });
  });

  it("requires the recipe, private delivery, both workers, and subset scopes", () => {
    expect(valid()).toMatchObject({
      scope: { kind: "users", userIds: [1] },
      recipe: { kind: "ink_add" },
      candidateWorkerEnabled: true,
    });
    for (const override of [
      { recipe: "off" },
      { candidateWorker: "false" },
      { cleanupWorker: "false" },
      { adapterConfigured: false },
      { productReady: false },
      { snapshotScope: "users:2" },
      { ingestScope: "off" },
      { scope: "all", snapshotScope: "users:1,2" },
      { scope: "all", ingestScope: "users:1,2" },
    ]) {
      expect(() => valid(override)).toThrow();
    }
    expect(valid({
      scope: "all",
      snapshotScope: "all",
      ingestScope: "all",
    }).scope).toEqual({ kind: "all" });
  });

  it("refuses malformed worker switches even while scope is off", () => {
    expect(() => valid({ scope: "off", candidateWorker: "TRUE" })).toThrow(
      'must be exactly "true" or "false"',
    );
  });

  it("requests the asynchronous schema proof only for a non-off cohort", () => {
    delete process.env[EVIDENCE_COMPOSER_SCOPE_ENV];
    expect(evidenceComposerSchemaRequired()).toBe(false);
    process.env[EVIDENCE_COMPOSER_SCOPE_ENV] = "off";
    expect(evidenceComposerSchemaRequired()).toBe(false);
    process.env[EVIDENCE_COMPOSER_SCOPE_ENV] = "users:1";
    expect(evidenceComposerSchemaRequired()).toBe(true);
    process.env[EVIDENCE_COMPOSER_SCOPE_ENV] = "all";
    expect(evidenceComposerSchemaRequired()).toBe(true);
  });
});
