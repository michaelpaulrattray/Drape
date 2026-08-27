# Fable read-only review — R7-7A3 Canvas recast/reroll snapshot adoption

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the **staged diff only** against the current codebase and the ratified R7-6/R7-7 snapshot design. Do not edit, stage, commit, push, deploy, run migrations, contact production, or enable any feature. You may run local read-only/type/test/build commands. Do not run the disposable database driver during this review; the executor has already recorded its guarded dev-MySQL evidence below.

Baseline before this slice: `ac07472 R7-7A3: adopt headshot snapshot writes`.

## Scope and product intent

This is one bounded writer-adoption slice only:

- adopt **structured Canvas recast** (`applyModelEdit`, decision `update`) into the atomic snapshot transition service;
- adopt **Canvas anchor reroll** (the existing `intent: "rerun"` form of the same door) into that service;
- pair legacy model/asset/stale writes, the immutable identity/package snapshots, and the Canvas landing/version/stale-downstream writes in one transaction;
- bootstrap before the running receipt so the receipt captures the converged server-owned snapshot head;
- retain all existing billing/refund/refusal behavior;
- capture the exact uploaded storage key in reroll mode so a failed atomic commit removes only that uncommitted candidate.

Explicitly out of scope: fork, variations, empty-node cast, mint, add/refresh views, reader cutover, composer/evidence candidates, Wardrobe, schema/migrations, billing prices, UI, feature flags, push/deploy/backfill.

Expected staged files are exactly:

1. `server/routes/boardOps.ts`
2. `server/lib/boardOps.ts`
3. `server/casting/snapshotTransitions.ts`
4. `server/batchC-structured.test.ts`
5. `server/batchC-failureInjection.test.ts`
6. `server/batchC-sourceGuards.test.ts`
7. `server/r7-snapshot-selection-contract.test.ts`
8. `server/r7-snapshot-transitions-db.test.ts`
9. `server/r7-snapshot-bootstrap-db.test.ts`

The review prompt itself is intentionally untracked and must not be treated as staged product scope. All `.agents/`, `.codex/`, `CLAUDE.local.md`, other `CLAUDE_*` documents, and founder/brand files must remain unstaged.

## Required verification challenges

Return a point-by-point verdict on every item below. Trace reachable production code; do not rely only on source-string tests.

1. **Only the intended Canvas writer is adopted.** Runtime importers of `snapshotTransitions.ts` must grow only by `server/lib/boardOps.ts`; fork, variations, empty-node cast, mint, refresh, Wardrobe, and read paths must not silently enter this slice.

2. **Replay and model lock remain authoritative.** `beginDirectOperation` must still own replay adjudication and the `model:<id>` operation lock before any bootstrap, receipt, charge, provider call, or transition. A replay must return the stored result without repeating bootstrap, charge, generation, landing, or snapshot writes.

3. **Bootstrap ordering is server-owned and bounded.** Structured update/reroll must bootstrap after operation claim/lock but before `markGenerationOperationRunning`; the receipt must therefore capture the converged `stateVersion`, package head, identity head, and legacy revision from the database. Fork must not bootstrap in this slice.

4. **Headless and bootstrap failure are free and terminally honest.** A headless model must receive plain-English `PRECONDITION_FAILED` before the running receipt, charge, generation row, Gemini, or transition. Any bootstrap error must seal the claimed receipt through `failClaimedDirectOperation`, releasing the operation lock unless existing recovery-required handling legitimately retains it.

5. **No client authority leaks in.** The new transition helper may receive only the server-built typed `AuthorizedIdentityPatch` or the server-selected reroll mode. State version, package/identity head, expected legacy revision, model lifecycle, current selections, and eligibility must all be re-read/verified under the transition transaction and operation receipt/lock.

6. **Structured recast commits one atomic truth.** In a single transaction it must:
   - require an owned, live draft and the exact running `canvas.recast` receipt/lock;
   - recompute the typed identity commit from transaction-owned model truth;
   - persist master prompt, technical schema, preferences, and a fresh legacy identity revision;
   - insert the exact generated frontClose anchor with exact storage key, cost, engine, revision/identity stamp, typed edits, source, and released dependents;
   - stale every prior filled sibling head, pinned included;
   - append paired `identity_edit` + `identity_change` snapshots selecting the new anchor and carrying the remaining package state;
   - stamp the origin Canvas node, append its board-item version, and stale downstream targets inside that same transaction.

7. **Reroll is distinct and document-preserving.** Null patch must be server-only shorthand for anchor reroll, not an ambiguous client claim. It must preserve master prompt/schema/preferences, advance the legacy revision, write a new anchor, stale all siblings, append `anchor_reroll` + `identity_change`, and atomically land the Canvas update. It must not masquerade as `identity_edit`.

8. **Snapshot closure and selection laws remain intact.** The wrapper must independently enforce current-head expectations, revision expectations, lifecycle/seal laws, one frontClose selection, unique selected assets, same-model assets, paired identity/package creation, and CAS head advancement. A Canvas recast must not invent a first snapshot head; bootstrap owns that.

9. **Stale behavior preserves ratified law.** Identity changes and rerolls stale every physically filled sibling, including pinned assets. The new frontClose is current. No pin exemption or affected-only narrowing may enter.

10. **Atomic Canvas rollback is real.** If node stamping, version insertion, downstream stale write, snapshot validation, or final head CAS fails, model documents/revision, new asset, stale flags, snapshots, and Canvas writes must all roll back together. The real-MySQL test must prove at least one landing failure rather than mocking the transaction.

11. **Billing remains exactly once and outside the transaction.** The existing 350-credit charge/reference and one refund path must remain. Validation/refusal ordering must stay free. No second charge/refund path may be introduced by bootstrap or snapshot commit. Receipt accounting callbacks must still report only committed ledger truth.

12. **Storage cleanup is exact and safe.** Both structured raw-upload and ordinary reroll generation must retain the exact returned `storageKey`. If the atomic commit fails, cleanup must delete only that uncommitted key. After a durable commit, no later audit-row failure may delete the now-referenced object or refund the user. Challenge the existing error boundaries specifically; report any reachable post-commit cleanup/refund path as blocking.

13. **Generation audit behavior remains honest.** Failure before durable commit marks the generation failed and refunds according to ledger truth. Failure to update a non-authoritative audit row after durable commit must be logged as an audit gap while the result stands. Raw internal errors/keys must not leak through the public result.

14. **Operation recovery is not weakened.** A lost response after the atomic transition must not permit a duplicate recast, snapshot pair, board version, charge, or provider call. Challenge `SnapshotTransitionAlreadyCommittedError` handling: if it is unreachable today because the direct-operation gate blocks re-entry, record it as a later recovery-driver caution; if a current reachable path could enter the generic refund/cleanup handler after a durable transition, block the commit.

15. **Race/staleness checks happen before the writer callback.** A stale package head or legacy revision must refuse before model/asset/Canvas writes. Cross-model candidates and operation-kind mismatch must refuse. The held model operation lock plus transition CAS must prevent two successful competing recasts.

16. **Existing structured-edit policy is unchanged.** The server still validates `buildStructuredPatch` before charging/provider work; unauthorized/mixed/presentation changes stay free refusals. Prompt generation must use the same computed typed document that the atomic commit later recomputes and persists. The new preparation hook must not move client input validation past the charge/provider boundary.

17. **No false success or stranded lock from preparation.** Check every `prepareBeforeRunning` exit: success, headless, bootstrap throw, failure while sealing the claimed receipt, and mark-running failure. Confirm no newly reachable claimed/running operation can strand its lock without the existing recovery machinery owning it.

18. **Database tests are meaningful.** The new real-MySQL cases must exercise production `commitCanvasRecastSnapshot`, not a hand-built facsimile, and prove:
   - structured document/revision/anchor/stale/package/Canvas truth;
   - reroll document preservation and correct reasons;
   - Canvas landing failure rolls every legacy and snapshot write back.

19. **Test-process cleanup is safe.** The added `$client.end()` teardown in the two disposable DB suites must close only the suite's shared Drizzle pool after all tests and must not change production code. The guarded driver must still create/drop only its regex-checked scratch database.

20. **Scope and non-regression.** No schema, migration, client/UI, feature flag, evidence candidate/composer, Wardrobe, public reader, or quality/export change. No protected/local file staged. `git diff --cached --check` must be clean.

## Executor verification evidence to challenge

Recorded against the exact working diff before staging:

- `pnpm check` — clean.
- Focused local suites — **104/104 passed**:
  - `server/batchC-structured.test.ts`
  - `server/batchC-failureInjection.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
- Full unit suite — **2,516 passed / 141 environment-dependent skipped / 0 failed**.
- `pnpm build` — passed.
- Guarded disposable Railway dev-MySQL drive — **32/32 passed**, including 16 transition tests; explicit success line and scratch database drop were printed.
- `git diff --check` — clean before staging; recheck the staged form yourself.

## Required output

Return exactly one of:

- `APPROVE — safe to commit R7-7A3 Canvas recast/reroll adoption locally`
- `REQUEST CHANGES` with each concrete, reachable blocking defect, its exact code evidence, product consequence, and smallest sound correction.

Keep non-blocking observations separate. Approval is **local-commit scoped only** and does not authorize push, deploy, migration, backfill, read cutover, feature enablement, or another writer adoption.
