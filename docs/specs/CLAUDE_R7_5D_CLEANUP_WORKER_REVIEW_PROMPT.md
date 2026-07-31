# R7-5D cleanup worker — bounded staged-diff review

Review the staged R7-5D diff read-only against the current codebase, the ratified R7-5 execution plan, D-64, the R7-5A writer/storage inventory, and the already committed R7-5B/R7-5C contracts.

Baseline: `36930ad` (`R7-5C: atomic final Cast deletion and writer fences`).

Do not edit files, stage, commit, push, deploy, run production migrations, contact production databases, or call/delete/list real R2 objects. You may run local typechecks and unit tests. Do not run the disposable-database driver during this review; inspect its guards and tests instead.

## Intended scope

R7-5D consumes the cleanup manifests committed atomically by R7-5C. It adds a feature-flagged, leased worker; retry/repair and read-only audit tools; and routes account/GDPR deletion through the same exact-owned-key manifest architecture. It must not enable the public Cast deletion UI yet.

Expected staged files:

- `server/_core/index.ts`
- `server/casting/storageCleanupWorker.ts`
- `server/db/storageCleanup.ts`
- `server/storage.ts`
- `server/db/accountDeletion.ts`
- `server/security/deleteUserData.ts`
- `server/security/deleteUserData.test.ts`
- `server/routes/account.ts`
- `server/routes/profile.ts`
- `server/r7-storage-cleanup-worker.test.ts`
- `server/r7-storage-cleanup-worker-db.test.ts`
- `scripts/run-storage-cleanup.mts`
- `scripts/audit-storage-cleanup.mts`
- `scripts/drive-r7-storage-cleanup-disposable.mts`

The review prompt itself and all existing local/private files must remain unstaged.

## Verify these contracts

1. **Off by default.** Runtime storage cleanup starts only when `ENABLE_STORAGE_CLEANUP_WORKER === "true"`. Startup and interval timers are unref'd, a second start cannot create another interval, and overlapping sweeps are refused. No request path automatically enables it.

2. **Multi-instance lease authority.** Only one worker can own a due batch. Lease claim, renewal, item claim, settlement and finalization use database truth and lease-token/CAS checks. Expired leases recover abandoned `processing` items without allowing an old owner to settle them.

3. **Crash-safe object deletion.** If R2 accepts deletion and the process dies before database settlement, lease recovery may issue the same exact `DeleteObject` again and then settle successfully. This relies only on S3/R2 delete idempotence; it must never discover or invent a wider prefix.

4. **Key privacy and count conservation.** Successful item rows are deleted immediately so successful sensitive keys do not remain in the database. `deletedCount + retained item rows === expectedCount` must always hold. A succeeded batch cannot retain keys. Logs and support output must not print keys, URLs, prompts or credentials.

5. **Failure truth.** Retryable failures return to pending with bounded backoff based on the actual failure time. Permanent failures or exhausted attempts remain as failed support evidence. A batch becomes `partial` or `failed` honestly. Explicit repair can requeue only a terminal failed/partial batch and cannot silently erase its evidence before success.

6. **Storage API semantics.** A normal R2/S3 `DeleteObject` success — including an already-missing object — counts as success. Network/throttling/5xx failures are retryable; authorization/malformed 4xx failures are terminal. Existing non-worker callers correctly inspect the new structured result. In particular, avatar/banner usage is reduced only after confirmed deletion, and Casting rollback cleanup logs a false result.

7. **Exact manifest authority only.** The worker deletes only `storage_cleanup_items.storageKey` values previously validated and persisted by a deletion transaction. No bucket scan, URL inference, shared input, prefix delete, or client-supplied identifier can enter the runtime worker.

8. **Account deletion convergence and ordering.** Both live account-deletion procedures converge on `deleteUserData`. Stripe cancellation happens before irreversible database erasure and a real cancellation failure stops deletion. Database erasure and cleanup-manifest creation are one transaction. Request threads never call storage deletion directly.

9. **Account-owned key law.** Account/GDPR discovery uses the same exact-key/current-origin classifier as Cast deletion. It includes explicitly owned profile/model/garment/board keys and user-owned generated outputs, including `generations.modelId IS NULL` VTO output and generated Wardrobe history. It excludes external URLs and potentially shared reference/input images such as `wardrobe_sessions.modelImageUrl` and URL-only Canvas references.

10. **Audit-log privacy.** Account deletion audit events retain security/accounting truth without persisting the deleted user's name, email, prompts, schemas, agency id, storage keys or URLs.

11. **Read-only audit safety.** `audit-storage-cleanup.mts` requires explicit database/app/public-origin inputs, defaults to read-only, prints aggregate counts only, reconciles manifests, and lists the bucket only with `--include-bucket`. `assets/` and `hero/` are protected static prefixes and never reported as orphan candidates. Listing is not used by product runtime.

12. **Repair-tool safety.** `run-storage-cleanup.mts` defaults to health/reconciliation only. Mutation requires `--execute --requeue-batch <uuid>` plus explicit target arguments and a separate production override. It cannot locally process/delete a batch using mismatched DB/R2 credentials.

13. **Disposable proof.** The guarded driver creates/drops only a fresh `drape_r7_5d_disposable_*` database, refuses production identity and stale scratch databases, applies migrations only there, injects fake storage, and cleans up in `finally`. Tests cover exact deduplicated deletion, crash/restart replay, transient backoff, permanent partial failure plus repair, empty manifests, count conservation, and account-owned model-less output discovery. No test contacts real R2.

14. **Boundaries.** No public Cast deletion UI is enabled, no migration is added, no production data/storage is contacted, and no unrelated behavior is changed. Flag any necessary compatibility file outside the original list rather than treating it as scope creep.

## Challenge, do not rubber-stamp

Specifically look for lease-loss races, a retry due-time computed from stale time, a failed delete being treated as truthy success, successful keys retained in support data, missing-object misclassification, a route that still deletes storage synchronously, shared/reference inputs accidentally claimed as owned, an account-delete transaction that can commit without its manifest, production/audit commands that can print secrets or mutate by default, and timers/processes that can stay alive unexpectedly.

Return exactly one verdict:

- `APPROVE — safe to commit R7-5D locally`
- `REQUEST CHANGES` with each concrete reachable blocker, code evidence, consequence, and the smallest sound correction.

List non-blocking observations separately. Approval is local-commit scoped only; it does not authorize push, deploy, production migration, real storage cleanup, worker enablement, or the public deletion UI.
