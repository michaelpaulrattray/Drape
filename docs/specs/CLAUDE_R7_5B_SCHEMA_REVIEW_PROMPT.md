# Fable review prompt — R7-5B additive schema and compatibility

Review the staged R7-5B diff read-only against:

- `docs/specs/CASTING_SYSTEM_R7_5_FINAL_DELETION_EXECUTION_PLAN.md`, especially §§4.1–4.6, R7-5B, and the required verification matrix;
- `docs/specs/CASTING_MODEL_ID_WRITER_INVENTORY.md`;
- D-64 in `docs/specs/DECISION_LOG.md`;
- baseline commit `f924d24`.

Do not edit, stage, commit, migrate production, contact storage, enable deletion, push, or deploy.

This is schema/contract only. No public delete route, runtime tombstoning, receipt scrubbing, Canvas/Wardrobe deletion, cleanup worker, R2 deletion, or feature flag is authorized in this batch.

## Expected staged files

Exactly these nine files should be staged:

1. `drizzle/schema.ts`
2. `drizzle/0009_final_cast_deletion.sql`
3. `drizzle/meta/0009_snapshot.json`
4. `drizzle/meta/_journal.json`
5. `server/casting/storageCleanupContract.ts`
6. `server/db/storageCleanup.ts`
7. `server/r7-storage-cleanup-contract.test.ts`
8. `server/r7-cast-deletion-schema-db.test.ts`
9. `scripts/drive-r7-cast-deletion-schema-disposable.mts`

Protected/local files must remain unstaged, including `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand files, this prompt, and all other `docs/specs/CLAUDE_*` handoff/review prompts.

## Review checklist

Verify all of the following against the actual staged code and surrounding production code:

1. Migration 0009 is additive only. It creates no destructive or public-delete behavior.
2. SQL, `drizzle/schema.ts`, snapshot and journal agree exactly. The 0008→0009 snapshot transition contains only:
   - nullable `models.deletedAt`;
   - nullable `generation_operations.subjectDeletedAt`;
   - non-unique `idx_board_items_source_model(sourceModelId)`;
   - `storage_cleanup_batches`;
   - `storage_cleanup_items`.
3. The migration contains no drop, rename, truncate, data rewrite, backfill, status transition, or implicit deletion.
4. The two new nullable columns preserve the mixed-runtime window: 0008 code can omit them after migration, and historical pre-0009 rows receive `NULL` rather than being reclassified.
5. Cleanup batch/item vocabularies are closed in both TypeScript and MySQL, and the schema consumes the same exported constants rather than duplicating a second list.
6. `storage_cleanup_batches` contains only internal cleanup authority and counts: UUID id/operation id, user, kind, status, expected/deleted/failed counts, lease/heartbeat/attempt timestamps and normal timestamps. It does not retain model identity, prompts, URLs or visual evidence.
7. `storage_cleanup_items` stores only the transient exact storage key plus worker status/retry fields, with unique `(batchId, storageKey)` and the worker lookup index.
8. Batch operation ids are unique so one deletion receipt cannot create two manifests. The item uniqueness constraint cannot leave partial residue when used through the transaction helper.
9. `buildStorageCleanupManifest` accepts only positive owners, UUID ids, closed kinds and normalized exact keys; it deduplicates/sorts keys and derives `expectedCount` from the final key set.
10. Arbitrary external URLs, traversal, backslashes, empty keys and values longer than the actual 512-character column are refused before database insertion. Audit classification is not silently promoted into deletion authority.
11. `assertStorageCleanupCounts` refuses over-settlement and dishonest pending/succeeded/partial states. Do not require the R7-5D worker state machine in this schema batch.
12. `createStorageCleanupManifestIn` requires a caller-owned transaction handle and writes the batch plus every item inside that transaction. It never opens its own transaction, calls storage, deletes an object, or routes itself publicly.
13. A failure after manifest insertion rolls back both batch and items. An invalid key writes nothing. A duplicate operation id cannot create a second batch or orphan its proposed items.
14. Read helpers are internal DB helpers only. There is no tRPC/client reachability and no automatic spending or external side effect.
15. The guarded driver:
   - refuses a production app id;
   - accepts only a MySQL URL whose explicit source database is `railway`;
   - creates only a regex-verified `drape_r7_5b_disposable_*` database;
   - refuses stale databases with that prefix;
   - applies 0000–0008, seeds genuine pre-0009 rows, applies 0009 separately, runs only the focused suites, and drops only its own verified database in `finally`;
   - never writes into the source `railway` database itself.
16. The real-MySQL tests prove, rather than merely source-pin:
   - pre-0009 model/operation/board rows survive 0009;
   - old runtime insert shapes still work after 0009;
   - nullable markers default to null;
   - schema indexes and enum refusals exist in MySQL;
   - manifest counts/defaults/deduplication are honest;
   - rollback and uniqueness are real transactional behavior.
17. No production database audit or migration was run. The only database contacted was the configured development MySQL server to create and drop a disposable prefixed database; the final run dropped it successfully.
18. There is no deletion route, tombstone runtime, write-fence implementation, Canvas/Wardrobe cascade, R2 worker, public UI, push, deploy, or feature enablement in scope.
19. Challenge whether the schema/helper shape would block R7-5C atomic deletion or R7-5D crash-safe cleanup. Report a concrete reachable blocker if it would; do not request later-batch implementation merely because it is intentionally absent here.
20. Confirm the staged file set is exact and protected/local files are unstaged.

## Verification already run by the executor

- `pnpm check` — clean.
- Standalone strict typecheck of `scripts/drive-r7-cast-deletion-schema-disposable.mts` — clean.
- Focused pure suite — 10/10 passed.
- Guarded disposable MySQL drive — 17/17 passed, temporary database dropped.
- Full unit suite — 2,487 passed / 92 environment-dependent skipped / 0 failed. An earlier parallel test+build run caused one unrelated email-token timeout; that test passed alone and the complete suite then passed cleanly when rerun without competing build load.
- `pnpm build` — passed.
- `git diff --cached --check` — expected to be clean after staging; verify independently.

Return exactly one verdict:

- `APPROVE — safe to commit R7-5B locally and proceed to the separate production migration-0009 gate`
- or `REQUEST CHANGES` with a concrete reachable blocker, exact evidence and the smallest sound correction.

List genuinely non-blocking observations separately. This review authorizes at most a local commit. Production migration 0009 requires a separate explicit founder authorization, and dependent R7-5C runtime must not deploy before migration 0009 exists in production.
