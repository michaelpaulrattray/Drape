# Fable review — R7-7A3 foundation slice

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the staged diff only. This is a bounded foundation slice of R7-7A3, not the complete dual-writer phase.

Baseline: `0ae9fa4` (`R7-7A2: add convergent snapshot bootstrap`)

Governing documents:

- `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`
- `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`
- `docs/specs/DECISION_LOG.md`

## Exact scope of this slice

This slice establishes only two prerequisites before individual Casting writers adopt the immutable snapshot service:

1. A newly-starting, model-backed durable operation captures the server-owned snapshot head it is about to operate against.
2. Permanent Cast deletion and account erasure cannot leave the new immutable snapshot rows or receipt links behind.

It deliberately does **not** yet:

- create live snapshot transition/append services;
- dual-write any Casting mutation;
- read product state from snapshots;
- change any client, route input, UI, generation, billing, credit, mint, refresh, restore or evidence behavior;
- enable a feature flag, push, deploy or contact production.

## Expected staged files

Exactly these eight files should be staged:

- `server/db/generationOperations.ts`
- `server/casting/finalCastDeletion.ts`
- `server/db/accountDeletion.ts`
- `server/r7-generation-operations-db.test.ts`
- `server/r7-final-cast-deletion-db.test.ts`
- `server/r7-storage-cleanup-worker-db.test.ts`
- `server/r7-snapshot-selection-contract.test.ts`
- `scripts/drive-r7-generation-operations-disposable.mts`

Protected/local files and this prompt must remain unstaged.

## Review checklist

### A. Server-owned receipt expectations

1. `markGenerationOperationRunning` captures `expectedStateVersion`, `expectedIdentitySnapshotId`, and `expectedPackageSnapshotId` from database truth, never from the client or caller.
2. Capture happens inside the existing start transaction, after required operation-lock verification and while the owned, live model row is locked `FOR UPDATE`.
3. Archived, tombstoned, foreign, or missing models refuse before the receipt becomes running.
4. A null package pointer is accepted only with `stateVersion === 0`.
5. A non-null package pointer requires a positive state version, a same-model package row, and a same-model identity row referenced by that package. Impossible or cross-model heads refuse.
6. Model-less operations keep all three expected snapshot fields null.
7. An idempotent replay of an already-running operation preserves the expectations captured by the first successful start; it does not recapture a later model head.
8. Existing `expectedIdentityRevisionId`, planned-credit, lock, phase, heartbeat, recovery and replay laws remain intact.
9. The new expectation fields remain server-private in the existing public operation projection.

### B. Permanent Cast deletion

10. Under the existing model/delete-operation locks, deletion enumerates the model's identity snapshots, package snapshots and package slots before mutation.
11. Deletion order is slots → packages → identities → model assets, inside the same transaction as Canvas/Wardrobe cleanup, tombstone and receipt finalization.
12. No snapshot row for the deleted Cast survives a successful deletion; every injected rollback boundary still restores all rows.
13. Prior durable receipts are scrubbed of all three expected snapshot references. The delete receipt is also finalized without a dangling model/snapshot reference.
14. The model tombstone clears current/sealed package and identity pointers and resets `stateVersion` to zero.
15. Snapshot counts may exist in the internal audit/receipt count record, but the existing deliberately small public deletion summary remains unchanged and exposes no ids, documents, URLs or storage keys.
16. Storage-manifest law and actual object cleanup are unchanged: snapshot rows add no new object ownership; the selected model assets remain the storage owners.

### C. Account erasure

17. Account erasure deletes snapshot slots → packages → identities before deleting model assets/models, in the same account transaction.
18. It removes snapshot rows for every model owned by the user, including rows tied to archived/tombstoned models still present before account erasure.
19. Its deletion counts and tests reflect the new rows without weakening the R7-5 owned-storage manifest law.

### D. Tests and runner

20. The real-MySQL tests exercise actual snapshot rows, receipt capture, deletion, receipt scrubbing, tombstone clearing and account erasure—not mocks or source-string claims alone.
21. The operation disposable runner applies all migrations through current `0010`, never stops at the pre-snapshot schema, and uses adequate remote-MySQL test/hook timeouts.
22. The runner still creates/drops only its guarded disposable dev database, refuses production identifiers/URLs as before, and cannot touch production or storage.
23. The source authority guard remains strict: before live dual writers arrive, only bootstrap, operation expectation capture and the two erasure boundaries may import snapshot tables.
24. No unrelated behavior or protected/local file entered the staged set.

## Challenge areas

Do not approve merely because tests are green. Specifically challenge:

- pointer/version mismatch in both directions;
- a package row that belongs to the model but references another model's identity row;
- claim-then-archive/delete before operation start;
- start replay after the model head advances;
- deletion receipt accidentally retaining a deleted snapshot id;
- rollback after snapshot deletion but before tombstone/receipt;
- account erasure deleting assets/models while leaving snapshot documents behind;
- any public projection or audit path leaking identity documents or snapshot ids;
- lock-order changes or a new deadlock relative to the established model-first deletion law.

Return exactly one verdict:

- `APPROVE — safe to commit R7-7A3 foundation locally`
- `REQUEST CHANGES` with a concrete reachable blocker, code evidence, impact, and the smallest sound correction.

Read-only review only. Do not edit, stage, commit, push, deploy, run migrations, contact production/storage, or enable any feature.
