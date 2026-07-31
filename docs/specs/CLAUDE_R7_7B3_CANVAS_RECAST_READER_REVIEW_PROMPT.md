# Fable review — R7-7B3 Canvas recast/reroll execution authority

Review the staged diff read-only against the ratified R7-7B snapshot-reader cutover plan and the surrounding production code. Challenge the implementation rather than trusting the executor summary or test names.

Do not edit, stage, commit, push, deploy, run a database, change Railway variables, enable snapshot reads, or contact production.

## Scope

Baseline HEAD: `6eeccbd` (`R7-7B3: adopt snapshot iteration authority`).

Exactly these eight files should be staged:

1. `server/routes/boardOps.ts`
2. `server/lib/boardOps.ts`
3. `server/casting/snapshotTransitions.ts`
4. `server/batchC-structured.test.ts`
5. `server/batchC-sourceGuards.test.ts`
6. `server/r7-snapshot-selection-contract.test.ts`
7. `server/r7-snapshot-transitions-db.test.ts`
8. `scripts/drive-r7-snapshot-bootstrap-disposable.mts`

The intentional sender/reply-to edit in `server/routes/emailVerification.ts` must remain unstaged and untouched. `.agents/`, `.codex/`, `CLAUDE.local.md`, brand material, plans, and review prompts must remain unstaged.

## Product intent

This is the R7-7B3 snapshot-reader adoption for the paid Canvas `applyModelEdit` update door: structured recast and no-change identity reroll.

- R6 remains the rollback path and retains convergence-before-receipt plus its legacy mutable-document authority.
- Snapshot mode never bootstraps, converges, or silently repairs a bad snapshot head during the paid request.
- Snapshot-mode structured classification, patch computation, generation, and atomic commit derive from the immutable current identity snapshot—not drifted mutable model columns.
- Snapshot-mode reroll generates from the immutable current identity documents and atomically synchronizes those documents back to the mutable compatibility columns.
- Both modes validate the update free before the receipt starts, then the running receipt captures the server-owned package head under the model lock.
- The running receipt's captured head is asserted before the paid executor.
- The executor independently re-resolves authority after that assertion and before credits/provider work.
- The transition independently re-reads the model, receipt, lock, package head, identity snapshot, selections, and legacy revision inside its transaction.
- The generated anchor, mutable compatibility columns, board landing, identity snapshot, package snapshot, stale-all state, and head CAS land atomically or all roll back.
- The Canvas `fork` branch remains creation semantics: no snapshot bootstrap, current-head resolver, receipt-head assertion, or recast transition.
- `R7_SNAPSHOT_READ_SCOPE` remains unset/off, so this local commit changes no live account.

## Required challenges

Verify every point against reachable production code:

1. `boardOps.applyModelEdit` captures `readMode` exactly once from the authenticated `ctx.user.id`. The strict public input contains no read mode, snapshot id, package id, identity id, state version, revision, selection, compatibility, document authority, or patch object.
2. The existing operation gate still owns replay/idempotency. A successful replay returns before preparation, receipt start, assertion, credits, provider, upload, transition, and board landing; in-progress/recovery states cannot re-execute the same operation id.
3. The route's pre-gate ownership/model reads are unchanged and do not grant snapshot authority. Confirm no client-controlled value can influence the captured mode or expected package head.
4. `fork` remains outside this adoption: it does not bootstrap, call `prepareCanvasRecastAuthority`, call `assertGenerationOperationSnapshotHead`, or call `commitCanvasRecastSnapshot`. Passing the captured mode through the common input must not change fork creation behavior.
5. R6 update mode still runs `bootstrapModelSnapshot` while the operation owns `model:<id>`, refuses a genuinely headless Cast free, then validates the structured/reroll request before the receipt starts.
6. Snapshot update mode never calls `bootstrapModelSnapshot`, convergence, newest-filled selection, or another R6 fallback. It uses `resolveEffectiveCastStateForRead` and refuses corrupt, missing, foreign, archived, or headless subjects free.
7. `prepareCanvasRecastAuthority` independently re-resolves the board item/model relationship and applies the shared lifecycle predicate. A non-draft update refuses; unknown/archived states cannot degrade into editable drafts.
8. The reroll decision is server-derived only from `intent === "rerun"` plus an empty validated changes object. A request containing changes cannot be silently treated as a reroll.
9. Structured changes still pass through `buildStructuredPatch`; unknown, presentation, reference-image, previous-prompt, and non-authorizable fields remain refused. The client cannot submit an `AuthorizedIdentityPatch` directly.
10. Snapshot structured validation and `computeIdentityCommit` start from an authority model overlaid with `state.identity.masterPrompt`, `technicalSchema`, and `preferences`. Poisoned mutable columns cannot change classification, authorized values, released dependents, or the generation document.
11. Snapshot reroll generation uses those same immutable identity documents without inventing a patch or changing the documents as part of the reroll intent.
12. Moving structured validation into the free pre-receipt preparation does not weaken rate-limit/quota, ownership, lifecycle, or billing behavior. Challenge any reachable semantic regression in R6 mode rather than assuming the extraction is byte-equivalent.
13. `markGenerationOperationRunning` still verifies the exact operation lock and captures stateVersion/current package/current identity under `FOR UPDATE` from server-owned database truth.
14. The route's `expectedIdentityRevisionId` remains server-derived. Challenge the pre-lock read window: if the legacy revision changes before the operation lock is acquired, prove the later transition refuses/rolls back safely and cannot silently commit or charge incorrectly.
15. `assertGenerationOperationSnapshotHead` runs after the receipt starts and before `executeApplyModelEdit`, deduction, provider generation, storage upload, transition, or board landing.
16. An assertion failure goes through the existing `completeDirectOperationFailure` path with zero charged/refunded credits and releases the operation lock unless the established recovery-required fallback genuinely applies.
17. The executor calls `prepareCanvasRecastAuthority` again after the receipt-head assertion. Snapshot mode therefore performs a second effective-state resolution before deduction/provider work and cannot trust the pre-receipt resolution.
18. A second-resolution failure also seals the running operation with zero charge/refund and reaches no provider, storage upload, transition, or board landing.
19. The two resolutions are not an exploitable authority race: the operation owns `model:<id>` continuously, the receipt pins the head, the assertion checks it, and the transition rechecks receipt/lock/head/revision plus the final CAS.
20. Provider generation uses only the prepared immutable snapshot `masterPrompt`, preferences/casting brand, ethnicity hint, technical schema, canonical headshot frame, and server-owned model id. No drifted mutable document or client prompt can substitute.
21. Structured recast and reroll preserve the existing single 350-credit deduction, deterministic charge/refund references, exact uploaded-storage-key cleanup, public error boundary, and post-commit audit-gap law.
22. A failure before the durable transition deletes only the exact newly uploaded key and refunds according to ledger truth. A committed transition cannot later be cleaned up or refunded merely because generation-audit completion fails.
23. `commitCanvasRecastSnapshot` receives the captured `readMode`; neither the service nor transition re-reads the rollout environment or accepts client authority.
24. The transition wrapper independently requires the running `canvas.recast` receipt, exact user/model, owned `model:<id>` lock, expected state/package/identity/revision, draft lifecycle, valid current head closure, and final state-version/package-pointer CAS.
25. In snapshot mode the transaction-owned `context.current.identitySnapshot` is the document authority. `computeIdentityCommit` runs against a model overlaid with that immutable prompt/schema/preferences, not `context.model`'s drifted columns.
26. Structured recast writes exactly the computed immutable-base-plus-authorized-edit documents to both the mutable model row and the new identity snapshot. Unauthorized mutable drift must disappear, while the authorized field and its schema/preference changes remain.
27. Snapshot reroll writes the prior immutable identity documents back to the mutable compatibility columns before appending the new identity/package head. Reroll must not preserve poisoned mutable drift or modify the immutable document content.
28. Both branches still create a fresh legacy identity revision and exact frontClose anchor candidate with owned URL/key/cost/engine provenance, stale every sibling head including pinned views, select the new anchor current, carry the other slots stale, and append the correct `identity_edit` or `anchor_reroll` paired with `identity_change`.
29. The required Canvas landing callback remains inside the same transaction as the model write, asset insert, stale writes, identity/package appends, and head CAS. Node stamp, version row, downstream stale state, and snapshot truth cannot split.
30. Any lifecycle, receipt, lock, head, revision, selection closure, asset insert, stale write, board landing, snapshot append, or final-CAS failure rolls back the whole database transition. The pre-existing rollback test remains meaningful.
31. `SnapshotTransitionAlreadyCommittedError` remains unreachable through today's claim/replay gate. Record the known future recovery-redrive/ambiguous-commit hazard separately rather than treating it as a current blocker without a reachable path.
32. New route tests drive the real app router and prove:
    - snapshot structured recast captures mode once, bypasses bootstrap, asserts before deduction, generates from immutable documents, and passes the typed patch/read mode to the commit;
    - a second resolver failure after receipt start moves no credits and reaches no provider/commit;
    - snapshot reroll generates from immutable prompt/schema and commits with `patch: null`.
33. Source/caller guards add only the two intended Canvas runtime callers to the read-scope/effective-state allowlists and pin the ordering/document wiring without weakening the existing snapshot-transition writer restrictions.
34. Real-MySQL tests genuinely run the production transition with real claim/lock/running receipt and prove:
    - structured snapshot recast removes mutable drift but preserves the original immutable schema/preferences plus the authorized jawline change;
    - snapshot reroll restores immutable documents exactly;
    - the existing Canvas structured, reroll, atomic-landing, and rollback cases remain green.
35. The disposable driver's `--focused-canvas` mode uses a Windows-safe `snapshot.*Canvas` pattern, rejects conflicting focus flags, remains bounded to the transition DB suite, retains every production-app-id/dev-URL/stale-database/name-regex/create/drop guard, and drops its exact scratch database in `finally`.
36. No schema, migration, client, pin, Wardrobe, deletion, storage primitive, billing primitive, feature flag, or unrelated runtime surface changed.
37. The eight-file staged scope is exact; `server/routes/emailVerification.ts` and all private/local/prompt files remain outside the index.

## Evidence already produced

- `pnpm check` — clean.
- Focused local suites — 123 passed / 33 environment-gated DB skips / 0 failed:
  - `server/batchC-structured.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/batchC-failureInjection.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
- Lifecycle/source/route guard rerun after the final shared-predicate correction — 98/98 passed.
- Guarded disposable Railway development-MySQL Canvas gate — 5/5 matching tests passed / 28 intentionally filtered:
  - existing structured Canvas recast;
  - existing Canvas reroll;
  - snapshot structured recast from immutable documents;
  - snapshot reroll restoring immutable documents;
  - atomic Canvas rollback.
- The successful disposable run dropped its own scratch database, and a final server query found no database with the disposable prefix.
- Full unit suite with file-level parallelism disabled — 2,630 passed / 165 environment-gated skipped / 0 failed.
- Default parallel full-suite runs exposed only known machine-load-sensitive 5-second dynamic-import timeouts in unrelated files; the involved 14 tests passed in isolation. Do not treat the sequential green run as hiding a functional failure, but challenge this account if the diff provides contrary evidence.
- `pnpm build` — passed.
- `git diff --check` — clean.
- Final process audit found no Drape test runner, Vitest, pnpm, `tail.exe`, or `grep.exe` process. The only matched Node process was the Codex app's own kernel and was correctly left running.

Operational note: the first disposable attempt was blocked before Vitest by sandbox filesystem resolution and still dropped its scratch database. A later unrestricted attempt hit the command timeout; no matching process remained and a read-only prefix query found no scratch database. The Windows argument-splitting cause was then removed by changing the focused regex from a literal-space form to `snapshot.*Canvas`. The final two bounded runs completed normally (one exposed and cleaned up a test-expectation error; the last passed 5/5), and both printed their exact database drop. Challenge this account if the runner or workspace evidence contradicts it.

## Verdict

Return exactly one:

- `APPROVE — safe to commit R7-7B3 Canvas recast/reroll execution authority locally`
- `REQUEST CHANGES` with a concrete reachable blocker, evidence, product impact, and the smallest sound correction.

Keep non-blocking observations separate. Approval can authorize only a local commit. It cannot authorize push, deploy, migration, snapshot-read scope enablement, convergence, production contact, B4 adoption, pin retirement, or any other R7 work.
