# R7-7B4 account-owned projections — Fable review prompt

You are reviewing the staged R7-7B4 account-owned model/profile/library projection slice in `C:\Users\Admin\Drape`.

This is a read-only, adversarial review. Inspect the staged diff and the surrounding production paths rather than trusting the executor summary or source-string tests. Do not edit, stage, commit, push, deploy, change environment variables, contact production, or run any database. The guarded disposable-MySQL evidence below is recorded evidence; do not rerun it.

Baseline: `5a0272c`

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B4 account-owned projections locally`
- `REQUEST CHANGES` with a concrete, reachable blocker, evidence, product consequence, and the smallest sound correction

Keep non-blocking observations separate. Approval may authorize only a local commit of the staged files. It may not authorize push, deploy, migration, convergence, `R7_SNAPSHOT_READ_SCOPE` enablement, production contact, B5 Wardrobe authority, later B4 work, pin retirement, or any other R7 work.

## Product intent

This is the first bounded B4 projection slice. For accounts later placed in snapshot-read scope:

- `models.get` exposes immutable identity documents and the package-selected presentation separately from the full asset ledger/history.
- Studio/Profile hydration treats the selected package as current while retaining all ledger versions as history.
- the Canvas Cast picker uses the selected `frontClose`.
- draft gallery cards use selected `frontClose`.
- minted lobby/Wardrobe gallery cards preserve their existing visual preference (`frontFull`, then `frontClose`) but resolve that preference over package-selected slots.
- legitimate headless models are omitted from image-card lists; corrupt package heads refuse rather than silently disappearing.

The scope is still off by default. Registry, model-backed Canvas metadata, and durable Wardrobe/VTO model-image authority are deliberately not claimed by this slice.

## Exact staged scope

Exactly these 22 files must be staged:

1. `client/src/features/casting/utils/buildHistoryFromAssets.ts`
2. `client/src/features/studio/components/CastingWorkspace.tsx`
3. `client/src/features/studio/hooks/useLoadWardrobeModel.ts`
4. `client/src/features/studio/hooks/useResumeDraft.ts`
5. `client/src/features/studio/hooks/useSessionPersistence.ts`
6. `scripts/drive-r7-snapshot-bootstrap-disposable.mts`
7. `server/batchB-status-readmodel.test.ts`
8. `server/batchC-sourceGuards.test.ts`
9. `server/casting/effectiveCastRead.test.ts`
10. `server/casting/effectiveCastRead.ts`
11. `server/casting/effectiveCastState.ts`
12. `server/casting/modelReadProjections.ts`
13. `server/db/models.ts`
14. `server/lib/boardOps.ts`
15. `server/modelLifecycleGuard.test.ts`
16. `server/r7-model-read-projections.test.ts`
17. `server/r7-snapshot-bootstrap-db.test.ts`
18. `server/r7-snapshot-selection-contract.test.ts`
19. `server/routes/boardOps.ts`
20. `server/routes/lobby.ts`
21. `server/routes/models.ts`
22. `server/routes/wardrobe.ts`

The staged diff is 920 insertions / 140 deletions.

`server/routes/emailVerification.ts` has an intentional, unrelated two-line sender/reply-to change. It must remain unstaged and untouched. `.agents/`, `.codex/`, `CLAUDE.local.md`, brand files, plans, prompts, and other local files must remain unstaged.

## Required challenges

Challenge every point against reachable production code.

1. **Exact scope.** Confirm the index contains exactly the 22 files above and no unrelated/protected/local file.
2. **Server-owned rollout mode.** Every adopted route captures `captureSnapshotReadMode(ctx.user.id)` exactly once from authenticated user + environment. No public input, client payload, model row, or downstream service can select the mode.
3. **Strict wire schemas.** The touched inputs reject `readMode`, snapshot ids, state versions, selections, and other unknown authority fields.
4. **R6 parity.** With scope unset/off, each surface calls the original R6 query/selector and preserves its return shape, filtering, ordering, angle preference, limits, and cache behavior.
5. **Bounded batch resolver.** `resolveOwnedEffectiveCastStates` validates positive unique ids, executes the cohort read in one transaction, owner/live-filters it, requires the exact requested count, and batches models, ledger assets, package/identity rows, seals, and slots without per-model query loops.
6. **One closure law.** Every returned model is built through the unchanged effective-state closure validator; the batch path must not create a weaker second interpretation.
7. **No corrupt-model omission.** Snapshot thumbnail wrappers enumerate live account-owned model rows before resolving snapshots. They must not use a legacy “has an asset/thumbnail” query to choose the cohort, and a corrupt requested head must fail the batch rather than vanish from results.
8. **Headless honesty.** A legitimate headless model may be omitted from an image-card surface. A pointer/state/hash/selection/seal corruption must refuse and must not be treated as headless.
9. **`models.get` truth split.** Immutable `masterPrompt`, `technicalSchema`, and `preferences` come from the current identity snapshot; `assets` remains the complete ledger/history; `selectedAssets` is a separate package-selected presentation.
10. **Safe public selected DTO.** `selectedAssets` exposes only `id`, `viewType`, and `storageUrl`. It must not expose storage keys, provenance, snapshot ids, stateVersion, seal pointers, mutable revision ids, internal selection ids, or compatibility machinery.
11. **Selection closure.** Selected failure markers, empty URLs, cross-model assets, wrong-angle assets, duplicate angles/assets, missing `frontClose`, invalid compatibility, invalid anchor, pointer mismatch, and seal mismatch refuse before projection.
12. **Picker truth.** Canvas `listCastableModels` uses only the selected `frontClose` in snapshot mode; a newer unselected ledger row cannot become the picker image.
13. **Existing thumbnail design retained.** Draft cards use selected `frontClose`; minted lobby/Wardrobe gallery cards retain the existing `frontFull`-then-`frontClose` preference over selected slots. This slice must not silently turn full-body lobby cards into headshots.
14. **Newest ledger cannot displace selection.** A later filled model-asset row remains history and may affect version counts, but it cannot replace the package-selected current presentation.
15. **Ownership/lifecycle privacy.** Foreign, missing, tombstoned, or archived subjects remain non-leaking and cannot appear through the batch route. Status/name/agency behavior must remain truthful.
16. **Client current-vs-history separation.** Studio/Profile hydration uses `selectedAssets` as current presentation while preserving all ledger assets and version groupings as history.
17. **Restored mix honesty.** If a package restores an older asset for one angle while keeping other selected angles, the exact mixed package becomes current; it is not split into independent fake current states or overwritten by newest-ledger order.
18. **Explicit headless selection.** `selectedAssets: []` is authoritative headless presentation. Client hydration must return no current assets and must never fall back to ledger rows. Omission of the field remains the R6 compatibility path.
19. **Profile/document truth.** Profile/Studio stores and form hydration use immutable snapshot documents plus selected presentation for snapshot responses; mutable drift and newest-ledger rows must not regain authority.
20. **Wardrobe boundary.** The touched Wardrobe routes are gallery display projections only. They do not claim to solve the B5 durable Wardrobe/VTO authority problem, and they must not change generation, tattoo, session, or client-supplied model-image inputs.
21. **Cache/non-regression.** Query keys, invalidation, replay, credits, provider calls, storage, deletion, operation receipts, and snapshot transition writers remain unchanged.
22. **No authority expansion.** This slice adds reads/projections only: no snapshot writes, convergence/bootstrap, schema, migration, Railway variable, feature enablement, billing, Gemini, R2, or automatic repair.
23. **Tests and guards are meaningful.** Behavioral tests must exercise actual projection/hydration laws, and source guards must pin load-bearing caller/wire/privacy boundaries without replacing behavioral proof.
24. **Real-MySQL evidence is relevant.** Read the new disposable case and confirm it drives the production batch resolver and draft projection across two real models, with a newer unselected row present, and proves the selected thumbnail wins.
25. **Driver safety.** `--focused-b4` is mutually exclusive with other focused modes, runs only the bounded test, retains production-app-id/non-dev-URL/stale-database/name guards, and drops only its exact scratch database in `finally`.
26. **Operational cleanup and staging hygiene.** No Vitest/pnpm/tsx/test-driver orphan remains. Do not treat the long-running Codex runtime or the pre-existing Railway helper as dormant test workers.

## Implementation facts to verify, not assume

- `resolveOwnedEffectiveCastState` now delegates to the bounded batch resolver with one id.
- The snapshot model list starts from `getUserMintedModels` / `getUserDraftModels`, not the legacy thumbnail-filtered functions.
- `projectEffectiveModelForClient` explicitly strips current/sealed snapshot pointers, stateVersion, and mutable identityRevisionId, then maps selected assets to the minimal public DTO.
- `buildHistoryFromAssets(allAssets, selectedAssets?)` distinguishes:
  - omitted `selectedAssets` → legacy newest-ledger behavior;
  - explicit selected assets → selected package is current, ledger is history;
  - explicit empty array → headless, no current presentation.
- The gallery route under the Wardrobe namespace is display-only. B5 still owns replacement of browser-supplied model URLs in durable Wardrobe/VTO operations.

## Recorded verification

Safe local evidence:

- `pnpm check` — clean on the final code.
- Directly affected focused behavioral/guard suites — 121 passed, 0 failed across bounded runs (the previous 120 plus the final minimal-DTO privacy assertion).
- Full unit suite on the final code — 2,652 passed / 168 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --cached --check` — clean.
- Guarded Railway-development disposable MySQL B4 gate — 1/1 passed; exact scratch database dropped in `finally`.
- Process audit after verification — only the long-running Codex runtime and pre-existing Railway helper remained; no Vitest, pnpm, tsx, or test-driver worker.

The disposable DB gate ran before the final pure outward DTO narrowing. That narrowing touches no SQL or database behavior; the final typecheck, focused tests, full suite, build, and cached-diff check all ran afterward. Do not rerun the disposable database.

## Judgment points

- The batch resolver intentionally fails the whole requested projection if any subject is corrupt. Decide whether this is the correct fail-closed behavior; do not call it a blocker merely because partial results would be more available.
- Model-row limits are applied before legitimate headless models are filtered from image-card output, matching the legacy limit-before-thumbnail behavior.
- Registry projection and `boards.getItemModelInfo` remain later B4 work. Durable Wardrobe/VTO model-image resolution remains B5.

Report the verdict first, then concise evidence for each challenge group, followed by non-blocking observations.
