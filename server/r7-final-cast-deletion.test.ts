import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("R7-5C final Cast deletion source contracts", () => {
  it("persists cleanup authority before changing dependencies and never calls storage", () => {
    const implementation = source("server/casting/finalCastDeletion.ts");
    const executor = implementation.slice(implementation.indexOf("export async function executeFinalCastDeletion"));
    expect(implementation).toContain("createStorageCleanupManifestIn");
    expect(executor.indexOf("createStorageCleanupManifestIn(tx"))
      .toBeLessThan(executor.indexOf("deleteCanvasDependenciesIn"));
    expect(implementation).not.toMatch(/storage(?:Delete|Put|Get)\s*\(/);
    expect(implementation).not.toMatch(/from ["']\.\.\/storage["']/);
  });

  it("exposes a free preview and one atomic final door for draft and minted Casts", () => {
    const route = source("server/routes/models.ts");
    const deletionDoor = route.slice(route.indexOf("delete: protectedProcedure"));
    expect(route).toContain("deletePlan: protectedProcedure");
    expect(route).toContain("planFinalCastDeletion");
    expect(deletionDoor).not.toContain('lockedModel.status !== "draft"');
    expect(deletionDoor).toContain("executeFinalCastDeletion");
    expect(deletionDoor).toContain("summarizeFinalCastDeletion");
    expect(deletionDoor.indexOf("beginDirectOperation"))
      .toBeLessThan(deletionDoor.indexOf("getModelById"));
  });

  it("hides tombstones and their old receipts from ordinary reads", () => {
    const modelDb = source("server/db/models.ts");
    const operationsDb = source("server/db/generationOperations.ts");
    expect(modelDb).toContain("isNull(models.deletedAt)");
    expect(modelDb).toContain('ne(models.status, "archived")');
    expect(operationsDb).toContain("if (!operation || operation.subjectDeletedAt) return null");
    expect(operationsDb).toContain("isNull(generationOperations.subjectDeletedAt)");
  });

  it("removes the split hard-delete helpers so callers cannot bypass the manifest", () => {
    const modelDb = source("server/db/models.ts");
    const modelIndex = source("server/db/index.ts");
    expect(modelDb).not.toContain("export async function deleteModel(");
    expect(modelDb).not.toContain("deleteModelWithAssetKeys");
    expect(modelIndex).not.toContain("deleteModelWithAssetKeys");
  });
});
