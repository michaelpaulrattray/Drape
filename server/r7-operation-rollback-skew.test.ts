import { describe, expect, it } from "vitest";

import {
  GENERATION_OPERATION_KINDS,
  assertGenerationOperationKind,
  isGenerationOperationKind,
} from "./casting/operationContract";

/**
 * Rollback-skew hardening (plan §G / M4a).
 *
 * The scenario this prevents: a deploy writes `castingV2.roll` operation rows,
 * something goes wrong, and the image is rolled back. The older image still
 * reads the same database, hits a row whose kind it has never heard of, and —
 * before this change — threw out of the projection, which 500'd the operation
 * bridge for that user until the row settled.
 *
 * A control that is not on the request path does not exist (access-control law
 * 7), so these tests pin the predicate's behaviour *and* that the three public
 * readers actually consult it.
 */
describe("unknown operation kinds", () => {
  const FUTURE_KIND = "castingV2.roll";

  it("is a realistic scenario — the V2 kinds do not exist yet", () => {
    // If this ever fails, M4 has landed and this test needs a kind from a
    // milestone further out; the hardening itself still stands.
    expect(GENERATION_OPERATION_KINDS).not.toContain(FUTURE_KIND);
  });

  it("recognises every currently declared kind", () => {
    for (const kind of GENERATION_OPERATION_KINDS) {
      expect(isGenerationOperationKind(kind)).toBe(true);
    }
  });

  it("rejects an unknown kind without throwing", () => {
    expect(isGenerationOperationKind(FUTURE_KIND)).toBe(false);
    expect(isGenerationOperationKind(undefined)).toBe(false);
    expect(isGenerationOperationKind(null)).toBe(false);
    expect(isGenerationOperationKind("")).toBe(false);
    expect(isGenerationOperationKind(42)).toBe(false);
  });

  it("keeps the throwing assert for write paths", () => {
    // Write paths must stay loud: an unknown kind there is a bug, not skew.
    expect(() => assertGenerationOperationKind(FUTURE_KIND)).toThrow(TypeError);
    for (const kind of GENERATION_OPERATION_KINDS) {
      expect(() => assertGenerationOperationKind(kind)).not.toThrow();
    }
  });

  it("routes all three public readers through the skip-and-log guard", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.join(__dirname, "db", "generationOperations.ts"),
      "utf8",
    );

    for (const reader of [
      "getPublicGenerationOperation",
      "getRecentPublicGenerationOperation",
      "listActivePublicGenerationOperations",
    ]) {
      const body = source.slice(
        source.indexOf(`export async function ${reader}`),
        source.indexOf("export ", source.indexOf(`export async function ${reader}`) + 20),
      );
      expect(
        body,
        `${reader} must consult isProjectableOperation or a rolled-back image will 500 on a newer row`,
      ).toContain("isProjectableOperation");
    }
  });
});
