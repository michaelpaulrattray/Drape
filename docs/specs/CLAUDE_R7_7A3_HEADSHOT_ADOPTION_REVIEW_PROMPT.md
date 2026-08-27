# R7-7A3 headshot snapshot-adoption review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are Fable performing a **read-only, adversarial code review** of the currently staged R7-7A3 headshot-adoption slice in `C:\Users\Admin\Drape`.

## Hard boundaries

- Review only. Do not edit files, stage, commit, push, deploy, migrate, backfill, enable flags, contact production, run paid generations, or run the disposable database driver.
- Baseline must be `HEAD 1fbed40`.
- The staged set must be exactly these seven files:
  - `server/batchC-doors.test.ts`
  - `server/batchC-failureInjection.test.ts`
  - `server/casting/aiService.ts`
  - `server/casting/snapshotTransitions.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
  - `server/routes/generation/castingImaging.ts`
- `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand material, and all `CLAUDE_*` handoff/review documents are local/private and must remain unstaged and untouched.
- This approval, if granted, is for a **local commit only**. It does not authorize push, deployment, migration, backfill, read cutover, feature enablement, or any further writer adoption.

## Product intent

Adopt the live `generation.castingImage` headshot writer into the R7 snapshot transition system without changing its user-visible R6 behavior:

- A genuinely headless draft receives its first headshot, its first identity snapshot, and its first package snapshot atomically.
- A draft with an existing headshot receives an identity-changing headshot reroll: a new legacy identity revision, a new anchor, and stale truth on every filled sibling view, pinned included, atomically paired with identity/package history.
- The route cannot tell the transition which mode it is. The transition derives first-headshot versus reroll from transaction-owned model/asset/snapshot truth.
- Existing authorization-before-money, exactly-once operation, charge/refund, replay, and initial Canvas landing behavior remain intact.
- The R2 object key produced by headshot generation is required, persisted exactly, and used for exact-key cleanup if the database transition rolls back.

## Required review challenges

Verify every item against reachable production code and surrounding unchanged modules, not merely test strings.

1. **Bounded adoption.** `castingImaging.ts` becomes the only new runtime importer of `snapshotTransitions.ts`; the full reviewed adopter allowlist remains exactly mint-package restore plus compact/iterate/headshot routes. No unreviewed writer enters.

2. **One atomic writer for both modes.** The route no longer calls `createModelAsset` or `commitAnchorReRoll`. Both initial headshot and reroll cross `commitHeadshotSnapshot`, which in turn crosses `commitModelSnapshotTransition` with expected kind `casting.headshot`.

3. **Server-owned mode.** The caller supplies only user/model/operation plus the generated candidate. `commitHeadshotSnapshot` derives `hasHeadshot` from rows selected inside the transaction and cross-checks it against the current snapshot head; the route cannot label creation as reroll or vice versa.

4. **Ordering and free refusal.** Ownership, archived/minted refusal, rate limit, quota, and operation lock behavior remain before money/provider work. Bootstrap happens while this operation owns `model:<id>` and before `markGenerationOperationRunning`; a bootstrap failure seals the claimed operation and reaches no running receipt, credit movement, generation row, Gemini call, or snapshot commit.

5. **Receipt captures converged truth.** An existing-headshot draft is bootstrapped/converged before the running receipt captures state/package/identity expectations. A genuinely headless draft remains `stateVersion=0` with a null snapshot head until the paid transition succeeds.

6. **Initial headshot atomicity.** On a headless draft, one transaction inserts the exact-key `frontClose` anchor, creates reason=`create` identity/package snapshots, selects the new headshot current/generated, and advances the model head to state version 1. The legacy `identityRevisionId` remains null while snapshot/provenance use the established semantic `genesis` value. No partial asset can survive a later transition validation/CAS failure.

7. **Reroll atomicity.** On an existing draft headshot, one transaction mints a fresh legacy revision, inserts the new `frontClose` anchor with that revision, stales every newest filled non-headshot sibling (pinned included), appends reason=`anchor_reroll` identity plus reason=`identity_change` package history, selects the new headshot current/generated, and carries siblings stale/carried. The old frontClose is historical, not incorrectly classified as a sibling.

8. **Lifecycle and identity laws.** Minted/non-draft subjects still refuse before spending at the route and independently inside the transition. Reroll remains an identity-changing draft operation. First-headshot creation is the only headless path accepted.

9. **Required exact storage key.** `generateCastingImage` now has a persisted-result return type requiring `storageKey`; it obtains URL and exact key from the existing `uploadRawCandidate` call. `commitHeadshotSnapshot` requires and validates a nonblank key, persists it directly, and never reconstructs a key from a URL.

10. **Rollback cleanup and refund truth.** Once upload succeeds, the route retains the exact key before attempting the atomic DB transition. If the transition fails before the durable boundary, it attempts `storageDelete(exactKey)` and then follows the existing one-charge/one-refund truth path. Cleanup failure is logged without hiding the original generation/commit failure or suppressing the refund. No storage deletion happens after durable success.

11. **Durable boundary.** `durableSaved` flips only after the atomic transition returns. An audit-row or receipt-finalization problem after that point must never delete the saved object or refund a durable headshot. Challenge the post-commit crash/recovery behavior and report any reachable duplicate transition or double-refund path.

12. **Replay and landing.** A completed operation replay still reads the saved asset by the receipt's asset id and performs no new provider/credit/write work. Initial headshots with a Canvas origin retain pending landing; rerolls do not create a new initial landing. The landing decision uses the transaction-derived `isReRoll`, not a pre-generation guess.

13. **Public privacy.** `storageKey`, snapshot ids, state version, receipt expectations, provenance internals, and stale-id lists do not leak into the public tRPC result or operation result. The route still returns only its established asset/url/cost truth.

14. **No unrelated behavior movement.** Prompt reinforcement, casting parameters, credit cost (350), generation audit row, operation result shape, rate/quota checks, refund wording, model lock, and R6 reference-image refusal remain intact. No client, schema, migration, billing, Wardrobe, evidence composer, read cutover, or feature-flag change is staged.

15. **Real tests, not only mocks.** Confirm the route tests genuinely call the production router and pin bootstrap -> running receipt -> provider -> atomic commit ordering plus the bootstrap-failure free-refusal path. Confirm failure injection proves exact-key cleanup plus refund when the atomic save fails.

16. **Real-MySQL semantics.** Read the new disposable-DB cases and verify they exercise the production `commitHeadshotSnapshot`: first-headshot paired creation and reroll fresh revision/stale-all/pinned behavior. Challenge cross-model ownership, slot closure, state-version CAS, and rollback using the surrounding transition tests.

17. **Race and recovery challenge.** Examine concurrent first-headshot/reroll requests, snapshot bootstrap races, a stale receipt, a model becoming minted/deleted, lost response after commit, and operation retry. Identify any interleaving that can double charge, duplicate a transition, overwrite a newer head, strand a lock, or misreport a saved image as failed.

18. **Scope/hygiene.** Confirm exactly seven staged files, no partial staging or unstaged drift in them, `git diff --cached --check` clean, and protected/local files unstaged.

## Executor verification evidence (verify independently where safe)

- `pnpm check` — clean on the final staged code.
- Focused local suites — 71 passed / 0 failed (`batchC-doors`, `batchC-failureInjection`, snapshot-selection contract); the DB suite correctly skips without `TEST_DATABASE_URL`.
- Guarded disposable development-MySQL drive — 29/29 passed across selection contract, bootstrap, bootstrap DB, and transition DB suites; the runner explicitly dropped `drape_r7_7a2_disposable_1784764181480_434ce5` afterward.
- Full unit suite — 2,514 passed / 138 environment-gated skipped / 0 failed.
- `pnpm build` — passed after the final required-storage-key tightening.
- `git diff --cached --check` — clean.

Do not rerun the disposable database driver or any paid/external generation during this review. You may rerun safe local typecheck/unit/build commands if useful.

## Required verdict format

Return exactly one of:

- `APPROVE — safe to commit R7-7A3 headshot adoption locally`
- `REQUEST CHANGES` followed by concrete, reachable blocking findings, code evidence, product impact, and the smallest sound correction.

Separate non-blocking later-R7 cautions from blockers. Do not approve based only on green tests; challenge the actual transition, billing, storage-cleanup, replay, and recovery paths.
