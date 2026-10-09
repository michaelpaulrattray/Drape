import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { models } from "../drizzle/schema";
import { REFUSING_KEYS } from "../shared/errorEventScrub";
import { FENCED_PRIOR_OPERATION_SCRUB } from "./casting/finalCastDeletion";
import { adjudicateStaleGenerationOperation } from "./casting/operationRecovery";
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/*
  ⚠ #741's class, MEASURED HERE RATHER THAN INHERITED — AND THE TIMEOUT ALONE
  DID NOT FIX IT, WHICH IS THE USEFUL HALF.

  The adjudicator arm pulls `server/casting/operationRecovery` and its module
  graph. As a dynamic `await import(…)` INSIDE the arm that cost 1.1 s alone,
  `Test timed out in 5000ms` beside the rest of `server/casting` — and then
  **30,017 ms against a 30 s ceiling**, so the cost is not slowness that a
  bigger number absorbs. The import is now STATIC, which moves it to the file's
  collect phase where it is paid once and is not governed by `testTimeout` at
  all. The arm itself does no I/O.

  The declaration below stays: this file now loads a real module graph, which
  is exactly the population #741 derived, and it is a live instance of **#743**
  — whose subject is that the contended sweep stopped at `server/castingV2` and
  never measured the other 526 files. This one is outside that directory.

  Declared once per FILE, never per arm — a number typed onto an `it(…)` is not
  inherited by the arm somebody writes beside it tomorrow.
*/
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

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
       branch that would hand an errorCode back, so nothing serves it.

       Anchored on the RETURN STATEMENTS rather than on the bare words (#778's
       review, finding 2): a comment mentioning `deleted_subject` above the
       switch would have kept the looser form green through a real reorder.

       Proven able to fail: deleting the classification so it no longer
       precedes the switch reddens exactly this arm.

       ⚠ Its limit, stated rather than left to be discovered — this reads
       SOURCE ORDER, so a guard neutered IN PLACE (`if (false && …)`) stays
       green. `outcomeFromExisting` is module-private, and the behavioural
       protection is the projection readers' own guards plus the DB arm; this
       is the cheap pointer at the front of them, not the proof. */
    const operationsDb = source("server/db/generationOperations.ts");
    const outcome = operationsDb.slice(operationsDb.indexOf("function outcomeFromExisting"));
    const deletedAt = outcome.indexOf('return { type: "deleted_subject"');
    const failureAt = outcome.indexOf('type: "replay_failure"');
    expect(deletedAt).toBeGreaterThan(-1);
    expect(failureAt).toBeGreaterThan(-1);
    expect(deletedAt).toBeLessThan(failureAt);
  });

  it("refuses to adjudicate a subject-deleted receipt, and lets an identical live one through", async () => {
    /*
      #778's review, finding 1, driven rather than asserted at the source.

      The positive control is the refusal: a fenced Sign carrying the stamp
      returns "skipped" without ever reaching a database. The NEGATIVE control
      is the one that makes it mean anything — the same row without the stamp
      walks past the door and dies at `claimRecoveryAttempt`'s
      `Database not available`, which is exactly how far it should get in a
      suite with no database.
    */
    const fencedSign = {
      id: "11111111-1111-4111-8111-111111111111",
      userId: 1,
      clientRequestId: "22222222-2222-4222-8222-222222222222",
      kind: "castingV2.sign",
      status: "recovery_required",
      errorCode: "RECOVERY_FENCED",
      subjectDeletedAt: new Date(),
    } as unknown as Parameters<typeof adjudicateStaleGenerationOperation>[0];

    await expect(adjudicateStaleGenerationOperation(fencedSign)).resolves.toBe("skipped");

    const live = { ...fencedSign, subjectDeletedAt: null };
    await expect(adjudicateStaleGenerationOperation(live)).rejects.toThrow("Database not available");
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

/**
 * EVERY CREATIVE-CONTENT COLUMN IS IN THE TOMBSTONE, AND THE POPULATION IS
 * DERIVED — the relay's finding 1 on PR #2114 (#1242), generalised.
 *
 * N2b added `personality` and `voice` to `models`, declared them *"the same
 * family as `masterPrompt`"* in the schema, and did not add them to the
 * tombstone. So a permanently deleted Cast kept the two most readable sentences
 * about who the cast was. The fix for the instance is five lines in
 * `finalCastDeletion.ts`; the fix for the CLASS is this arm, because the next
 * creative column will be added by somebody who has never read that function
 * (working law 7).
 *
 * # Why it is derived from the refusal list rather than from a list written here
 *
 * `shared/errorEventScrub.ts`'s `REFUSING_KEYS` already enumerates the fields
 * that may never leave the building, with CLAUDE.md's named field group at the
 * top of it. Intersect that with the columns of `models` and what comes back is
 * exactly *this table's creative content*: five columns today, and the five the
 * tombstone names. Nothing here is a second list to keep in step (working law
 * 4) — a sixth creative column reaches this arm the moment it is added to the
 * refusal list, which it must be anyway, and the arm then demands it be
 * scrubbed.
 *
 * ⚠ **THE SUBJECT IS SLICED OUT, NOT GREPPED FOR WHOLE-FILE.** A
 * `toContain("personality:")` over this file would pass on any line anywhere —
 * including the line that READS the column two statements earlier. The slice is
 * the tombstone's `set({…})` and nothing else, and the first arm proves the
 * anchor it is cut on is unique, because a slice taken on a non-unique anchor is
 * a guard that silently reads the wrong function.
 *
 * ⚠ **AND THE ROW-LEVEL ARM IN `r7-final-cast-deletion-db.test.ts` IS NOT THIS.**
 * That one asserts the real UPDATE against a real row and is the better
 * evidence — and it SKIPS on the gate, because `vitest.setup.ts` strips
 * `DATABASE_URL` on purpose. Both exist: the row arm when a disposable database
 * is configured, this one always.
 */
describe("the permanent-deletion tombstone scrubs every creative-content column", () => {
  const implementation = source("server/casting/finalCastDeletion.ts");
  const anchor = "const tombstoned = await tx.update(models).set({";

  it("is the file's only write to `models`, so the slice below is the whole subject", () => {
    expect(implementation.split("update(models)")).toHaveLength(2);
    expect(implementation.split(anchor)).toHaveLength(2);
  });

  const start = implementation.indexOf(anchor);
  const tombstone = implementation.slice(start, implementation.indexOf("}).where(", start));

  const columns = new Set(Object.keys(getTableColumns(models)));
  const creative = REFUSING_KEYS.filter((key) => columns.has(key));

  it("derives a non-empty population, so a broken intersection cannot read as coverage", () => {
    /* Five today. A floor rather than an equality: adding a creative column is
       allowed, silently losing the whole population to a renamed export is not. */
    expect(creative.length).toBeGreaterThanOrEqual(5);
    expect(creative).toContain("masterPrompt");
    expect(creative).toContain("personality");
    expect(creative).toContain("voice");
  });

  it.each(creative.map((key) => [key] as const))(
    "`%s` is written by the tombstone",
    (key) => {
      expect(tombstone).toMatch(new RegExp(`^\\s{6}${key}:`, "m"));
    },
  );

  /*
    THE THREE STAMPS, NAMED BY HAND — they are not in the refusal list and
    should not be: an error event carrying `personaDraftedAt` leaks nothing. They
    still belong in the tombstone, because the badge is derived as *drafted and
    not since edited*, so a surviving `personalityEditedAt` records that this
    customer rewrote a line on a day we claim to have forgotten their cast.
  */
  it.each([["personaDraftedAt"], ["personalityEditedAt"], ["voiceEditedAt"]])(
    "`%s` is nulled by the tombstone too",
    (key) => {
      expect(tombstone).toMatch(new RegExp(`^\\s{6}${key}: null,$`, "m"));
    },
  );
});
