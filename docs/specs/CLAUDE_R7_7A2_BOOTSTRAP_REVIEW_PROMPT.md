# Fable review prompt — R7-7A2 private snapshot bootstrap

Review the staged R7-7A2 diff read-only against:

- `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`
- D-65 in `docs/specs/DECISION_LOG.md`
- baseline commit `c8f8033`

Do not edit, stage, commit, push, deploy, run migrations, contact production, contact storage/providers, or enable any feature.

## Expected staged scope

Exactly these five files should be staged:

1. `server/casting/snapshotBootstrap.ts`
2. `server/casting/snapshotBootstrap.test.ts`
3. `server/r7-snapshot-bootstrap-db.test.ts`
4. `server/r7-snapshot-selection-contract.test.ts`
5. `scripts/drive-r7-snapshot-bootstrap-disposable.mts`

Protected/local files and this review prompt must remain unstaged.

## Important boundary

This slice creates a **private, free constructor only**. It has no route, client caller, worker, scheduled job, public backfill, feature flag, provider call, storage call, credit movement, or production consumer.

Migration 0010 is already present in production. This review does not authorize a runtime deploy or any database work.

R7-7A3 must adopt this service under the durable model-operation lock, close snapshot-row handling in final Cast deletion and account erasure, and dual-write all live R6 writers before any backfill or runtime use. Those are deliberate later gates, not claims made by A2. However, request changes if the staged A2 code itself creates a reachable production path or makes safe A3 adoption impossible.

## Verify the implementation

1. The service is genuinely unreachable from production runtime code except as a private exported module awaiting A3 adoption.
2. Ownership and lifecycle fail closed: foreign, archived, and tombstoned models return a non-leaking `NOT_FOUND` before writes.
3. The model row is locked before reading legacy truth or writing snapshots, serializing two concurrent bootstrap calls for the same model.
4. Pointer/state integrity is fail closed:
   - null package head requires `stateVersion = 0`;
   - non-null package head requires a positive state version;
   - missing/foreign package, identity, anchor, or selected asset makes bootstrap refuse without appending or advancing the model.
5. Headless models create no snapshot rows and do not advance state.
6. Legacy derivation exactly follows current R6 truth:
   - assets are read newest-first;
   - `selectIdentityAnchor` chooses the true identity anchor;
   - displayed `frontClose` may be a different newest filled row;
   - each canonical slot selects its newest filled asset;
   - failure markers/unfilled rows are never selected;
   - stale state is copied honestly as `stale`, otherwise `current`.
7. Initial bootstrap creates exactly one immutable identity snapshot, one package snapshot, explicit slot rows, and atomically CASes the model from null/0 to that head/state 1.
8. Same-state replay returns `current` without duplicate snapshot or slot rows.
9. Package-only R6 drift appends only a package snapshot and reuses the existing identity snapshot.
10. Identity-document or anchor drift appends a paired identity snapshot and package snapshot, with truthful parent links and one state-version increment.
11. Identity equality compares the durable identity truth (master prompt, technical schema, preferences, derived identity text/hash, and anchor), but deliberately does not treat bootstrap recipe version alone as an identity change.
12. Package equality compares the complete explicit angle/asset/compatibility selection, not counts or URLs.
13. Snapshot rows are inserted before the conditional model-head update inside one transaction, so a failed CAS rolls the entire attempted append back.
14. Sequence generation is safe under the model-row lock and respects the unique per-model constraints from A1.
15. Bootstrap-created snapshots use `createdByOperationId = null`; no live user operation is falsely attributed to bootstrap.
16. Logs expose only ids, enums, counts, state version, and a boolean—never prompts, schemas, preferences, names, URLs, or credentials.
17. The A1 source guard is narrowed only enough to permit this one private authority module; no route/client/other runtime file gains direct snapshot-table authority.
18. The disposable runner:
   - accepts only the development Railway database as its source;
   - refuses production app ids;
   - creates/drops only a fresh `drape_r7_7a2_disposable_*` database;
   - applies migrations only through 0010 to that scratch database;
   - uses no provider or storage service;
   - drops its own scratch database in `finally`.
19. The real-MySQL suite genuinely proves:
   - headless no-op;
   - initial creation and idempotent replay;
   - package-only convergence;
   - paired identity convergence;
   - concurrent first bootstrap produces exactly one `created` and one `current` result;
   - foreign selected-asset closure refusal without append;
   - foreign/archive/deleted/corrupt pointer and corrupt state-version refusal without writes.
20. No deletion/account-erasure regression is currently reachable because there is no caller, and the staged code does not overclaim otherwise. Confirm that deletion/account erasure must be extended before A3 runtime adoption.
21. Challenge the future concurrency seam explicitly: old R6 asset/document writers do not all share this model-row lock. Confirm the implementation remains safe only while private, and that A3 must put live dual writers and bootstrap adoption under the durable model-operation lock before convergence/backfill.
22. Challenge for any concrete reachable blocker not covered above, including transaction rollback, cross-model references, stale truth, sequence races, or accidental exposure.

## Verification evidence already produced by the executor

- `pnpm check` — clean.
- Focused local suite — 7 passed, 7 environment-gated DB cases skipped as designed.
- Guarded disposable MySQL drive — 14/14 passed; scratch database dropped.
- Full unit suite, rerun alone — 2,505 passed / 123 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- Standalone strict TypeScript check of the disposable runner — passed.
- `git diff --check` — clean.

Independently inspect the code and rerun safe local checks if useful. Do not rerun the disposable remote-MySQL drive during this read-only review.

## Required verdict

Return exactly one of:

- `APPROVE — safe to commit R7-7A2 locally`
- `REQUEST CHANGES` with a concrete, reachable blocker and the smallest sound correction.

Keep non-blocking observations separate. Approval is local-commit scoped only.
