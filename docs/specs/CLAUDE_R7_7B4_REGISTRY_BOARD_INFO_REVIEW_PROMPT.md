# Fable review prompt — R7-7B4 registry and board-info projections

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are Fable acting as the independent, read-only reviewer for the staged
R7-7B4 registry and board-info projection slice in:

`C:\Users\Admin\Drape`

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B4 registry and board-info projections locally`
- `REQUEST CHANGES` with a concrete, reachable blocker and the smallest sound
  correction.

Approval may authorize a local commit only. Do not edit, stage, commit, push,
deploy, run migrations, change Railway variables, enable
`R7_SNAPSHOT_READ_SCOPE`, contact production, run the disposable database
driver, begin the remaining B4 Canvas/browser slice, or begin B5.

## Baseline and staged scope

Baseline is `1fefa82`.

Exactly these eight files must be staged:

1. `server/batchB-status-readmodel.test.ts`
2. `server/batchC-sourceGuards.test.ts`
3. `server/casting/modelReadProjections.ts`
4. `server/r7-model-read-projections.test.ts`
5. `server/r7-snapshot-bootstrap-db.test.ts`
6. `server/r7-snapshot-selection-contract.test.ts`
7. `server/routes/boards.ts`
8. `server/routes/registry.ts`

Expected staged stat: 8 files changed, 345 insertions, 4 deletions.

The following intentional work must remain unstaged and untouched:

- `server/routes/emailVerification.ts` — the separate two-line Resend
  sender/reply-to correction.
- `docs/specs/DECISION_LOG.md` — the founder's future Asset Library ownership
  note.
- `.agents/`, `.codex/`, `CLAUDE.local.md`, brand files, review prompts, and
  other private/local files.

## Governing design

Read:

- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`,
  especially R7-7B4.
- the staged diff in full;
- the complete post-diff versions of both routes and the projection module;
- the effective-state resolver/adapter and rollout-scope parser;
- the legacy DB readers used by the R6 branches;
- relevant consumers of the registry bundle and
  `boards.getItemModelInfo`.

The rollout scope remains off by default. This slice must not change any live
account until a later, separately authorized Railway variable change.

## Product claim to challenge

For a future snapshot-enabled Cast owner:

- public registry lookup returns the Cast's immutable identity documents and
  exactly the views selected by its current package, never newer unselected
  ledger history or storage-empty failure markers;
- `boards.getItemModelInfo` keeps board ownership and archived-source behavior
  intact, but a live linked Cast reports immutable identity documents,
  selected-slot count, and a selected non-marker compatibility asset id;
- unflagged owners remain on the original R6 paths;
- callers cannot select read mode, snapshot ids, package ids, identity ids, or
  assets.

No writer, billing, provider, storage, schema, client cache, transition,
deletion, pin, or Wardrobe behavior should move.

## Required challenges

1. Confirm the staged set is exactly the eight listed files and baseline is
   `1fefa82`; confirm the email and decision-log edits remain unstaged.
2. Public registry rollout scope must be derived from the Cast owner's
   `model.userId`, not from the unauthenticated caller or request payload.
3. `registry.lookup` must use a strict schema and reject raw authority fields
   such as `readMode`, snapshot ids, or selected asset ids.
4. Registry agency-id lookup and existing minted/locked lifecycle eligibility
   must run before snapshot projection; `registry.verify` and lifecycle
   semantics must remain unchanged.
5. Snapshot registry resolution must be owner-scoped, live-only, sealed and
   closure-validated through the existing effective-state resolver. A corrupt,
   foreign, archived, deleted, or missing subject must refuse without R6
   fallback or repair.
6. Registry identity documents must come from the immutable identity snapshot,
   while name, agency id, and minted timestamp preserve their existing
   lifecycle source.
7. Registry assets must come only from explicit current-package selections.
   Newer unselected ledger rows and storage-empty/failed marker rows must never
   enter the public bundle.
8. Registry asset DTOs must preserve the existing public fields needed by
   consumers (`viewType`, `resolution`, `storageUrl`) while exposing no
   storage key, provenance, snapshot pointer, state version, or internal
   selection metadata.
9. With scope off, registry lookup must retain the original
   `getModelAssets(model.id)` bundle behavior exactly.
10. Challenge registry asset ordering. Determine whether any reachable
    consumer relies on the legacy ledger order and whether package-slot order
    is deterministic or semantically irrelevant. Treat a real order-dependent
    regression as a blocker; otherwise record the judgment.
11. `boards.getItemModelInfo` must capture mode exactly once from the
    authenticated board owner, and its strict schema must reject
    client-supplied authority.
12. Existing item lookup and board ownership checks must remain intact and
    precede any model information response.
13. The unlinked-item response (`sourceModelId == null`) must remain unchanged.
14. Existing archived/hard-deleted source degradation must remain intact:
    archived or absent sources report the old `sourceArchived` shape and do
    not invoke the snapshot resolver.
15. A live linked source in snapshot mode must resolve as the authenticated
    board owner. A foreign or corrupted source link must refuse without
    leaking model data or falling back to the ledger.
16. Board model identity documents must come from the immutable snapshot for a
    current head. A legitimate headless draft may use its mutable draft
    documents, with zero selected views.
17. `assetCount` must count selected slots, not historical ledger rows.
    `latestAssetId` is a retained compatibility field name but must resolve to
    the selected displayed `frontClose` id, never a failure-marker id.
18. With scope off, board info must retain the original
    `getModelAssets(item.sourceModelId)`, count, and `assets[0]?.id` behavior
    exactly—even though that legacy field can be marker-prone.
19. Resolver errors on either surface must propagate fail-closed and must not
    trigger an R6 read, bootstrap, convergence, or other repair.
20. Confirm both projection helpers are pure. No insert/update/delete, locks,
    credits, providers, R2, logging of private contents, schema changes, or
    client/cache changes may be introduced.
21. Confirm the route tests drive the real `appRouter` procedures and prove
    strict-wire rejection, selected-vs-ledger behavior, immutable documents,
    R6 parity, and no fallback—not merely source strings.
22. Confirm source guards and effective-state caller allowlists expand only by
    `server/routes/registry.ts` and `server/routes/boards.ts` as appropriate,
    without weakening existing transition-writer or resolver guards.
23. Inspect the real-MySQL test addition. It must use an actual bootstrapped
    package with a newer unselected ledger row and prove the registry/board
    projections keep the selected row. Do not rerun the database driver.
24. Confirm the recorded disposable run was bounded to the guarded Railway
    development scratch database and that the exact scratch database was
    dropped in `finally`.
25. Confirm `R7_SNAPSHOT_READ_SCOPE` remains unset/off and this commit alone
    grants no live read authority.
26. Audit running Node processes after tests. There must be no dormant Vitest,
    pnpm, tsx, or disposable-test workers; do not kill the Codex runtime or
    Railway helper.

Also challenge these judgment points explicitly:

- The public registry has no authenticated caller. Is owner-scoped rollout
  based on the resolved Cast owner's user id the only sound interpretation?
- `boards.getItemModelInfo` first performs the legacy unscoped model lookup to
  preserve archived-source degradation, then owner-scoped resolution for a
  live source. Does any reachable branch expose foreign live model data before
  that resolver succeeds?
- The historical field name `latestAssetId` is no longer literal in snapshot
  mode. Is selecting `displayedHeadshot.id` the correct B4 compatibility
  projection under the plan's “selected truth, never a marker id” law?
- `projectEffectiveRegistryBundle` is pure and does not itself enforce minted
  lifecycle; the public route does so before calling it, and the resolver
  enforces seals. Is that separation closed against every runtime caller?
- Determine whether `boards.getItemModelInfo.latestAssetId` has a current
  client consumer. An unused compatibility field is fine, but do not infer
  safety solely from apparent non-use.

## Recorded executor evidence

Already completed against this exact working tree:

- `pnpm check` — clean.
- Focused suites — 150/150 passed:
  - `server/batchB-status-readmodel.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/r7-model-read-projections.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/batch0-authority.test.ts`
- Full unit suite — 2,661 passed / 168 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- Guarded Railway-development disposable MySQL B4 gate — passed 1/1
  (`14` other cases filtered/skipped); the exact scratch database
  `drape_r7_7a2_disposable_1784876511684_591c06` was dropped in `finally`.
- `git diff --cached --check` — clean.
- Process audit after all commands — only the Codex runtime and long-lived
  Railway helper remained; no Vitest/pnpm/tsx/test-driver workers.

You may rerun safe local checks such as `pnpm check`, focused unit suites, full
unit suite, build, and cached diff checks. Do not run the disposable DB driver
or contact any external service.

Keep non-blocking observations separate from the verdict. Do not approve on
test names alone: trace the reachable production branches and challenge every
claim above.
