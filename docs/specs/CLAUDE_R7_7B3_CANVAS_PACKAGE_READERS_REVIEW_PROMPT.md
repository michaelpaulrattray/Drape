# Fable review prompt — R7-7B3 Canvas Library-fill / pop-out authority

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the staged diff read-only at baseline `9a35d1e` (`main`).

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B3 Canvas Library-fill/pop-out authority locally`
- `REQUEST CHANGES` with a concrete, reachable blocker

This review may authorize only a local commit. It cannot authorize push, deploy,
migration, production contact, changing or enabling `R7_SNAPSHOT_READ_SCOPE`,
convergence, B4 work, pin retirement, or any other R7 work.

Do not edit, stage, commit, push, deploy, run a database, change environment
variables, or contact external services. Review the code and the recorded
evidence only.

## Product meaning

Two free Canvas actions now use the explicit selected package when an account
is snapshot-enabled:

1. Filling an empty Cast node from the Library uses the package-selected
   `frontClose`.
2. Popping a view out from a Cast node uses the package-selected asset for that
   exact angle.

A newer ledger row that was not selected must not silently replace either
image. Unflagged accounts remain on the existing R6 newest-ledger rules.
Nothing spends credits, generates an image, touches storage, or changes a
snapshot.

## Governing sources

Read:

- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`
  - §3 authority laws
  - §5 effective-state resolver
  - §6 R7-7B3 canonical operation readers
  - §7 error/rollback behavior
- `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`
  - explicit package selection
  - independent Canvas placement law
- the staged diff and all production code needed to challenge it

## Expected staged scope

Exactly these eight files must be staged:

1. `scripts/drive-r7-snapshot-bootstrap-disposable.mts`
2. `server/batchB-status-readmodel.test.ts`
3. `server/batchC-sourceGuards.test.ts`
4. `server/lib/boardOps.ts`
5. `server/r7-canvas-package-readers.test.ts`
6. `server/r7-generation-operations-db.test.ts`
7. `server/r7-snapshot-transitions-db.test.ts`
8. `server/routes/boardOps.ts`

`server/routes/emailVerification.ts` has an intentional unrelated two-line
sender/reply-to change. It must remain unstaged and untouched. `.agents/`,
`.codex/`, `CLAUDE.local.md`, brand files, plans, and review prompts must remain
unstaged.

## Required challenges

Challenge every point against reachable production code, not merely the test
names or executor summary.

1. **Server-owned mode capture.** `fillFromLibrary` and `popOutView.execute`
   each capture `captureSnapshotReadMode(ctx.user.id)` exactly once at route
   entry. No client field, board metadata, model id, snapshot id, asset id, or
   request value can choose the mode.
2. **Strict wire boundary.** Both mutation schemas are strict and contain only
   their pre-existing product inputs. A raw caller supplying `readMode`,
   snapshot ids, state version, or an authority asset is refused.
3. **Only intended operations moved.** The slice changes Library fill and
   pop-out execution only. `listCastableModels` remains an R6 outward
   projection for the bounded B4 reader slice. Recast/reroll, paid generation,
   collapse, variations, readers, and clients do not move.
4. **No snapshot repair/fallback.** Snapshot mode calls only
   `resolveEffectiveCastStateForRead`. It cannot call
   `bootstrapModelSnapshot`, convergence, `getModelAssets`, or an R6 selector
   after a resolver refusal.
5. **Explicit selected-slot truth.** Snapshot mode resolves only
   `state.selectedViews.find(view.angle === requestedAngle)`. Ledger order and
   `state.ledger.assets` never choose the result.
6. **Library fill semantics.** Snapshot Library fill requires the explicitly
   selected `frontClose`; a newer unselected frontClose cannot displace it.
   Headless/no-selected-frontClose refuses with the existing free
   `PRECONDITION_FAILED` copy.
7. **Pop-out semantics.** Snapshot pop-out requires the explicitly selected
   asset for the requested canonical angle; a newer unselected row cannot
   displace it. Missing selection retains the existing per-angle free refusal.
8. **Failure markers cannot become selected.** The effective-state resolver's
   existing closure rejects storage-empty or failed selected rows before these
   actions can write a Canvas placement.
9. **Compatibility is not rewritten.** This slice does not promote stale or
   unverified selections, modify package slots, or write model assets. Decide
   whether displaying/popping the explicitly selected asset regardless of its
   compatibility is consistent with the existing comp-card/independent
   placement law.
10. **R6 Library-fill parity.** R6 retains its exact historical rule:
    first matching frontClose, otherwise `assets[0]`, followed by the existing
    storage-url refusal. Do not accept a seemingly cleaner behavior change.
11. **R6 pop-out parity.** R6 retains its exact historical rule: newest row for
    the requested angle with a non-empty `storageUrl`; an empty failure marker
    is skipped. The new unit test specifically pins the regression found
    during implementation.
12. **Ownership/lifecycle truth.** Snapshot ownership, tombstone and archive
    refusal come from the owner-scoped resolver. R6 retains `getModelById`,
    owner check and `assertNotArchived`. Foreign snapshot subjects become the
    existing non-leaking `NOT_FOUND` behavior.
13. **Draft/name truth.** Fill provenance continues deriving `draft` from
    `model.status`, and the `Draft Model` sentinel remains stripped. Snapshot
    identity selection must not alter lifecycle/name behavior.
14. **Deletion/write fence retained.** `fillEmptyCastNodeWithVersionIn` still
    locks and validates the owned available model before the board row, so
    permanent deletion cannot race a new durable model reference.
15. **Exactly-once fill retained.** Empty-node conditional fill, exact bridge
    reconciliation, version-1 insertion, source-model agreement and conflict
    behavior remain unchanged.
16. **Independent-placement race honesty.** Resolver reads are transaction
    consistent but the free Canvas write occurs afterward. Challenge the race
    where the package advances between read and placement. The intended law is
    that board placements are independent durable snapshots of the selection
    observed by the request, not live package rows; determine whether that
    makes the behavior honest or whether a head-CAS/lock is required.
17. **Pop-out integrity retained.** One placement per angle per root,
    collision-aware positioning, version row, `generated_from_cast` edge and
    duplicate refusal are unchanged.
18. **Provenance exactness.** The new `cast_view` stores the selected URL in
    both the board row and its provenance input, records the requested angle,
    retains the selected asset's engine metadata, and never exposes a storage
    key.
19. **No accidental live linkage change.** Library roots and popped views
    remain durable Canvas placements under the existing semantics; this slice
    does not implement B4 live display projections or alter deletion rules.
20. **No paid or external side effects.** Neither action can claim a durable
    generation operation, deduct/refund credits, call Gemini, read/write/delete
    R2, or create/advance snapshots.
21. **Behavioral tests are meaningful.** The new unit suite must drive the real
    service and one real app-router call, proving selected-vs-newer-unselected,
    headless refusal, client authority rejection, R6 fill fallback and R6
    failure-marker skipping.
22. **Real-MySQL proof is meaningful.** The two new disposable cases bootstrap
    a real package, insert a newer unselected ledger row, call the production
    Canvas functions, and prove the board row/version/edge contains the
    selected URL. They must not merely mock the resolver.
23. **Disposable safety.** The focused driver still refuses production app
    ids and non-development Railway URLs, creates only a unique
    `drape_r7_7a2_disposable_*` database, applies migrations through 0010,
    runs bounded `snapshot.*Canvas` cases, and drops the exact scratch database
    in `finally`. Its updated success label must not weaken any guard.
24. **Source guards.** The guards pin both route-mode threading and the
    explicit-selected/R6 dual branch without loosening the existing snapshot
    caller allowlists or transition-writer allowlists.
25. **Scope/non-regression.** No schema, migration, client, Wardrobe, pin,
    deletion, billing, storage, transition-writer or feature-flag change is
    staged. `R7_SNAPSHOT_READ_SCOPE` remains off by default.

## Recorded executor evidence

- `pnpm check` — clean.
- Focused local suites:
  - `server/r7-canvas-package-readers.test.ts`
  - `server/batchB-status-readmodel.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
  - result: **83 passed / 35 environment-gated skipped / 0 failed**.
- Guarded disposable development-MySQL drive:
  - `pnpm exec tsx scripts/drive-r7-snapshot-bootstrap-disposable.mts --focused-canvas`
  - result: **7 passed / 28 filtered out / 0 failed**.
  - the scratch database
    `drape_r7_7a2_disposable_1784869555231_7a3938` was dropped in `finally`.
- Full sequential suite:
  - `pnpm exec vitest run --maxWorkers=1 --fileParallelism=false`
  - result: **2,639 passed / 167 environment-gated skipped / 0 failed**.
- A preceding parallel full-suite attempt had one unrelated known
  `server/routes/emailVerification.test.ts` 5-second dynamic-import timeout;
  that file passed alone **2/2 in 1.66s**, and the correct sequential full run
  was green.
- `pnpm build` — passed.
- `git diff --cached --check` — clean.

Do not rerun the disposable-MySQL driver: it creates and drops a remote
development scratch database and is outside this read-only review. You may
rerun local typecheck/tests/build.

Keep non-blocking observations separate from blockers. In particular, do not
turn future B4 live projections, UI work, or cosmetic copy changes into scope
requirements unless the staged behavior is concretely unsafe.
