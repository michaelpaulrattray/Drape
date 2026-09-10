import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FENCED_PRIOR_OPERATION_SCRUB } from "./casting/finalCastDeletion";

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

  it("exposes a free preview and one atomic ceremony behind every door", () => {
    /*
      The door moved, the authority did not. Casting V2 needs the same permanent
      deletion from a different entry point — the roster knows a Cast by her
      public `KI-…` id, never a numeric model id — so the claim/lock/run/seal
      ceremony was extracted to `finalCastDeletionCeremony` and BOTH routes call
      it (D-107: one authority taught the new world, never a second path).

      This assertion follows the extraction rather than pinning the old shape:
      what matters is that no route reaches `executeFinalCastDeletion` on its
      own, which is how a second copy of the claim and seal would start.
    */
    const route = source("server/routes/models.ts");
    expect(route).toContain("deletePlan: protectedProcedure");
    expect(route).toContain("planFinalCastDeletion");

    const deletionDoor = route.slice(route.indexOf("delete: protectedProcedure"));
    expect(deletionDoor).not.toContain('lockedModel.status !== "draft"');
    expect(deletionDoor).toContain("runFinalCastDeletionCeremony");
    // The route must NOT drive the executor itself.
    expect(deletionDoor).not.toContain("executeFinalCastDeletion");

    const ceremony = source("server/casting/finalCastDeletionCeremony.ts");
    expect(ceremony).toContain("executeFinalCastDeletion");
    expect(ceremony).toContain("summarizeFinalCastDeletion");
    expect(ceremony.indexOf("beginDirectOperation"))
      .toBeLessThan(ceremony.indexOf("getModelById"));

    // And the V2 door goes through the same one.
    const v2 = source("server/routes/castingV2.ts");
    expect(v2).toContain("runFinalCastDeletionCeremony");
    expect(v2).not.toContain("executeFinalCastDeletion");
  });

  it("keeps the failure CLASS on a fenced prior operation and still takes every subject field", () => {
    /*
      #532, measured on production: 14 of 60 `model.delete` operations were
      `failed` with no code, no message and no Cast id — the retry that
      succeeded had scrubbed the failed attempt's reason. `errorCode` is a
      class name we chose (`NOT_FOUND`, `TIMEOUT`, …), which is the accounting
      truth the fence's own schema comment permits; the subject-bearing fields
      beside it still go.

      Asserted at the VALUE rather than at the source text, because a substring
      standing in for a contract has read green here before.
    */
    expect(FENCED_PRIOR_OPERATION_SCRUB).not.toHaveProperty("errorCode");

    /* The subject material, each one named — a field silently leaving this
       list is the failure this arm exists to catch. */
    for (const field of [
      "modelId", "result", "publicMessage", "originBoardId", "originItemId",
      "expectedIdentityRevisionId", "expectedStateVersion", "expectedIdentitySnapshotId",
      "expectedPackageSnapshotId", "chargeReferenceId", "phase", "progress",
      "heartbeatAt", "leaseExpiresAt", "landedItemId", "landingAcknowledgedAt",
      "recoveryAttemptedAt",
    ]) {
      expect(FENCED_PRIOR_OPERATION_SCRUB).toHaveProperty(field, null);
    }
    expect(FENCED_PRIOR_OPERATION_SCRUB).toHaveProperty("landingStatus", "not_applicable");

    /* And the stamp is NOT in the constant: it is a fresh Date at the write,
       so a constant carrying it would pin one moment for every deletion. */
    expect(FENCED_PRIOR_OPERATION_SCRUB).not.toHaveProperty("subjectDeletedAt");

    /* ⚠ THE OTHER HALF OF THE CONTRACT, AND IT IS WHY KEEPING THE CODE IS SAFE:
       a fenced row is classified as `deleted_subject` BEFORE the `failed`
       branch that would hand an errorCode back, so nothing serves it. */
    const operationsDb = source("server/db/generationOperations.ts");
    const outcome = operationsDb.slice(operationsDb.indexOf("function outcomeFromExisting"));
    expect(outcome.indexOf("deleted_subject")).toBeLessThan(outcome.indexOf("replay_failure"));
  });

  it("hides tombstones and their old receipts from ordinary reads", () => {
    const modelDb = source("server/db/models.ts");
    const operationsDb = source("server/db/generationOperations.ts");
    expect(modelDb).toContain("availableModelWhere()");
    expect(modelDb).not.toContain('ne(models.status, "archived")');
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
