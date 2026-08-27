# Fable review — R7-7A3 slot-version restore snapshot adoption

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform a read-only review of the staged R7-7A3 slot-version restore adoption against baseline `a4ce839`.

Do not edit, stage, commit, push, deploy, run migrations, contact production, enable any feature flag, or run any paid generation. You may run local read-only checks and tests. Do not run the disposable Railway MySQL driver during this review; its exact result is recorded below and the test/runner code is available for inspection.

## Intended staged scope

Exactly these nine files should be staged:

- `scripts/drive-r7-snapshot-bootstrap-disposable.mts`
- `server/batchC-doors.test.ts`
- `server/casting/mintPackage.ts`
- `server/casting/restoreSlotTransition.ts`
- `server/casting/restoreSlotVersion.test.ts`
- `server/casting/snapshotTransitions.ts`
- `server/r7-snapshot-selection-contract.test.ts`
- `server/r7-snapshot-transitions-db.test.ts`
- `server/routes/generation/castingExport.ts`

Protected/local files must remain unstaged, including `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand files, and every `docs/specs/CLAUDE_*` review prompt (including this one).

## Product intent

Adopt the existing free D-53 “Use this version” slot restore as the second live R7 snapshot writer, after compact-prompt adoption.

This remains copy-forward reuse, not rollback:

- the source image must be provably compatible with the current identity revision;
- the source image is copied into a new zero-cost, unpinned legacy asset row;
- even a restored `frontClose` row is display-only and never becomes identity-anchor authority;
- the new row becomes the selected image for that angle in one newly appended immutable package snapshot;
- every unchanged slot is carried forward;
- the identity snapshot/document/revision remains unchanged;
- no credits, provider generation, storage write/delete, automatic retry, or identity mutation occurs.

R6 remains the active read authority during this dual-write phase.

## Required challenges

Verify all of the following against reachable production code, not only test assertions:

1. Runtime adoption is still bounded: only compact-prompt and slot restore import the private snapshot transition writer. No unreviewed writer entered.
2. The restore route preserves its existing durable-operation replay path and acquires the existing `model:<id>` operation lock before bootstrap or transition work.
3. Snapshot bootstrap occurs while that operation owns the model lock and before `markGenerationOperationRunning`, so the running receipt captures the bootstrapped head rather than a pre-bootstrap null/stale head.
4. A headless Cast refuses with plain-English, zero-cost truth before the running receipt or transition. Bootstrap failure honestly seals the claimed operation through the existing claimed-failure path.
5. The transition independently requires the exact running `casting.restore` receipt and the exact operation-owned model lock. Client input cannot assert expected state/package/identity/revision authority.
6. The old restore eligibility law is preserved exactly: ownership, same requested angle, filled source, current revision or the ratified legacy fingerprint proof, current-head refusal, and same-image no-op refusal.
7. Cross-revision and uncertain-provenance sources refuse before any asset or snapshot write. An arbitrary older identity cannot be resurrected.
8. The legacy asset append and package-snapshot append are one database transaction. Any later validation/CAS failure must roll the copied asset back too.
9. The copied asset retains the source image/key/resolution and source inputs, costs zero, is unpinned, records `restoredFromAssetId`, and is stamped as current-revision `display` authority.
10. A restored `frontClose` can become the displayed headshot selection but can never replace/promote the identity snapshot anchor.
11. The package transition uses reason `slot_restore`; the changed slot is `compatibility: current`, `selectionReason: restored`, and its `sourceSelectionId` points to the replaced current package selection.
12. Every unchanged slot is carried forward with its prior selected asset. No identity snapshot is appended, no identity document or legacy identity revision changes, and sealed minted identity remains immutable.
13. A first/headless package transition cannot be invented. Package selection closure still requires a valid selected `frontClose`, unique assets, correct model/angle ownership, and filled URLs.
14. Route replay remains idempotent and returns the saved asset result without a second restore append. Challenge the crash window after the atomic transition but before receipt finalization; it must not permit duplicate legacy/package writes.
15. The route, service, and tests contain no credit movement, Gemini/provider call, storage mutation, automatic refresh, schema/migration change, client/read cutover, Wardrobe change, evidence-composer change, or feature enablement.
16. The extracted pure helper is not a second authority: the atomic service calls that same helper inside the locked transaction using database-owned model/assets, and the old policy tests continue to exercise the real production helper.
17. The real-MySQL regression meaningfully proves: compatible historical asset copied forward; new asset id; zero cost; unpinned/display/current stamp; correct changed-slot selection/provenance; unchanged head carried; no new identity snapshot.
18. The disposable runner cleanup hardening is safe: after a long suite it reconnects only to the already-validated source server, drops only the exact guarded `drape_r7_7a2_disposable_*` database, closes connections, and never suppresses the original test error. No orphan scratch database or process should remain.
19. Tests and source guards were strengthened rather than weakened. Confirm the custom router test really invokes the production restore procedure, not a fake local substitute.
20. Staged scope is exact and protected files are unstaged.

## Executor verification evidence

Against this exact working state:

- `pnpm check` — clean.
- Focused local suites — 43 passed, 9 disposable-DB tests skipped without `TEST_DATABASE_URL`, 0 failed.
- Guarded disposable Railway dev-MySQL drive — 25/25 passed (9 transition DB, 7 bootstrap DB, 6 contract, 3 pure); exact scratch database dropped successfully in `finally`.
- Full unit suite — 2,510 passed, 134 environment-dependent skipped, 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.
- No generation, credit movement, production contact, migration, push, or deploy occurred.

## Required verdict

Return exactly one of:

- `APPROVE — safe to commit R7-7A3 slot-restore adoption locally`
- `REQUEST CHANGES` with a concrete, reachable blocker, its evidence, product consequence, and smallest sound correction.

Keep non-blocking observations separate. This review can authorize only a local commit; it cannot authorize migration, push, deploy, backfill, read cutover, feature enablement, or further writer adoption.
