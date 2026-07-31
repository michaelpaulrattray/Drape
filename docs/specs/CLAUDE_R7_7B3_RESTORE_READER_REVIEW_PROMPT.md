# Fable review — R7-7B3 snapshot restore reader adoption

Perform a read-only review of the staged R7-7B3 restore-reader slice.

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B3 restore reader adoption locally`
- `REQUEST CHANGES` with a concrete, reachable blocker

This review may authorize a local commit only. It does not authorize push,
deploy, migration, production contact, convergence, a Railway variable change,
snapshot-read enablement, pin migration, B3's remaining generation/Canvas
adopters, B4–B7, or any other R7 work.

Do not edit, stage, commit, push, deploy, run a database, contact storage, or
change environment variables.

## Baseline and scope

- Baseline HEAD: `5e57c50` (`R7-7B2: adopt snapshot package projections`)
- Expected staged files: exactly these nine:
  - `scripts/drive-r7-snapshot-bootstrap-disposable.mts`
  - `server/batchC-doors.test.ts`
  - `server/casting/mintPackage.ts`
  - `server/casting/restoreSlotTransition.ts`
  - `server/casting/restoreSlotVersion.test.ts`
  - `server/casting/snapshotTransitions.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
  - `server/routes/generation/castingExport.ts`
- `server/routes/emailVerification.ts` has an intentional unrelated two-line
  sender/reply-to change. It must remain unstaged and untouched.
- `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`,
  brand material, the ratified plan, and all `CLAUDE_*` review prompts must
  remain unstaged.
- `R7_SNAPSHOT_READ_SCOPE` remains off/unset. No product reader is enabled by
  this commit.

## Product intent

This is the first bounded R7-7B3 execution adoption.

For a snapshot-enabled account, “Use this version” must decide what is
currently selected from the immutable package snapshot, not from the newest
filled ledger row. Historical compatibility must use the immutable identity
snapshot text. The requested historical row is still copied forward as a new,
free, unpinned display asset and selected by one atomic package transition.

For an R6 account, the existing newest-filled and live-document behavior must
remain unchanged.

Example this slice must handle:

1. package snapshot selects side-view asset A;
2. a newer ledger asset B exists but is not selected by the package;
3. snapshot mode may restore B because B is not the current selected version;
4. R6 mode still considers B the current newest-filled row and refuses it as a
   no-op.

## Required review challenges

Verify all of the following against the staged code and surrounding production
code. Do not rely only on test names or this prompt.

1. `restoreSlotVersion` captures `SnapshotReadMode` exactly once at authenticated
   request entry. It is not in Zod input and cannot be supplied by the client.
2. Replay returns the already-saved restore result before snapshot resolution,
   bootstrap, receipt start, or transition execution. It performs no second
   copy or package append.
3. R6 mode still runs the existing bootstrap before
   `markGenerationOperationRunning` and passes explicit `readMode: "r6"` through
   the executor and atomic transition.
4. Snapshot mode calls the fail-closed effective-state resolver and never calls
   `bootstrapModelSnapshot`; it cannot silently converge or repair a bad head.
5. A snapshot headless/corrupt/missing subject refuses through the existing
   claimed-operation failure seal, before the receipt becomes running. The
   operation lock is released unless the existing recovery-required fallback is
   genuinely needed.
6. Snapshot mode preflights the source before receipt start. The selected-current
   version, selected-current image, cross-revision source, uncertain provenance,
   wrong angle, foreign model, or missing source must refuse for free before
   transition execution.
7. The preflight derives all authority from `EffectiveCastState`: model,
   immutable identity text, package-selected view, and ledger/history rows.
   Client input supplies only the requested model/angle/asset identifiers.
8. The expected legacy identity revision passed to the running receipt comes
   from the freshly resolved snapshot model in snapshot mode, not the stale
   pre-lock model read.
9. `readMode` is required (not optional) at both
   `executeRestoreSlotVersion` and `commitRestoredSlotSnapshot`, preventing an
   adopter from silently defaulting to R6.
10. The atomic transition independently repeats authority under the existing
    model → receipt → operation-lock transaction order. It must not trust the
    route preflight.
11. In snapshot mode, the transaction resolves the current slot from
    `context.current.slots`, resolves that selected asset from the same-model
    ledger rows, and uses `context.current.identitySnapshot.identityText`.
12. A selected slot whose asset cannot be resolved refuses and rolls back. A
    missing slot for the angle is treated honestly as no current selection,
    allowing a compatible historical row to fill it.
13. Snapshot mode compares the requested source against the package-selected
    asset for both same-id and same-image no-op checks. It must not fall back to
    newest-filled.
14. R6 mode still compares against the newest filled row and still builds its
    identity fingerprint from the mutable model documents. No R6 product
    behavior changes.
15. Explicit revision membership still uses the guarded current legacy revision;
    legacy no-revision rows use the chosen identity text fingerprint. Snapshot
    mode cannot authorize a source merely because its slot compatibility label
    says `current`.
16. The copied asset remains zero-cost, unpinned, display-only, exact-URL/key
    copy-forward with `restoredFromAssetId`, current revision/fingerprint
    stamping, and truthful version count.
17. The package transition remains `slot_restore`, selects the new copied asset
    as `current/restored`, carries every other slot, records the replaced
    package slot as `sourceSelectionId`, appends no identity snapshot, and
    advances the head exactly once.
18. No credits, Gemini/provider calls, storage reads/writes/deletes, generation
    rows, schema/migration changes, client changes, pin changes, or unrelated
    reader adoption entered this slice.
19. The real-MySQL regression genuinely creates package/ledger divergence:
    bootstrap selects A, a newer unselected B is inserted, snapshot restore of B
    succeeds, a new copied asset is selected, prior selection provenance is
    retained, and identity-snapshot count remains one.
20. The pure tests behaviorally prove:
    - package selection beats newer ledger order in snapshot mode;
    - restoring the selected version refuses;
    - immutable snapshot identity text controls legacy fingerprint
      compatibility.
21. The router tests call the production router and prove R6 ordering, snapshot
    resolver ordering, bootstrap bypass, fresh expected revision, explicit mode
    threading, and refusal before the running receipt.
22. The caller/source guard is tightened rather than weakened. Type-only
    snapshot-scope use by the transition service is explicitly allow-listed; no
    new live resolver caller appears outside the already reviewed B2 surfaces.
23. The disposable driver’s `--focused-b3` mode accepts no unknown arguments,
    preserves every production-app-id/URL/name/stale-database/create/drop guard,
    uses synchronous Vitest, applies migrations only through 0010, runs the
    named real-DB proof, and drops its exact scratch database in `finally`.
24. Scope hygiene is exact: only the nine files above are staged; the intentional
    email sender change and every protected/local/prompt file remain unstaged.

## Verification evidence to reproduce where safe

Recorded against the intended staged state:

- `pnpm check` — clean.
- Focused pure/router/contract suites — 62/62 passed.
- Guarded disposable Railway development-MySQL focused gate — 1/1 passed,
  26 unrelated DB cases skipped by test-name filter, scratch database dropped.
- Full unit suite — 2,595 passed / 159 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --cached --check` — expected clean after staging.

The full historical transition driver was not used as approval evidence for
this bounded slice: one sandbox-blocked attempt created and dropped its scratch
database before tests, and one long full-suite attempt exceeded the desktop
command window. A read-only follow-up confirmed no test process and no
`drape_r7_7a2_disposable_*` database remained. The focused guarded run above
then passed and dropped cleanly.

Keep non-blocking observations separate from the verdict. In particular,
distinguish a real reachable corruption, wrong-current selection, authority
leak, write/refund hazard, or stranded lock from optional naming/test-polish.
