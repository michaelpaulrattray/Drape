# Fable review — R7-7B3 iteration/refinement execution authority

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the staged diff read-only against the ratified R7-7B snapshot-reader cutover plan and the surrounding production code. Challenge the implementation rather than trusting the executor summary or test names.

Do not edit, stage, commit, push, deploy, run a database, change Railway variables, enable snapshot reads, or contact production.

## Scope

Baseline HEAD: `4489a78` (`R7-7B3: adopt snapshot headshot authority`).

Exactly these eight files should be staged:

1. `server/routes/generation/castingRefinement.ts`
2. `server/casting/snapshotTransitions.ts`
3. `server/batchC-failureInjection.test.ts`
4. `server/batchC-sourceGuards.test.ts`
5. `server/casting/typedIterationDoors.test.ts`
6. `server/r7-snapshot-selection-contract.test.ts`
7. `server/r7-snapshot-transitions-db.test.ts`
8. `scripts/drive-r7-snapshot-bootstrap-disposable.mts`

The intentional sender/reply-to edit in `server/routes/emailVerification.ts` must remain unstaged and untouched. `.agents/`, `.codex/`, `CLAUDE.local.md`, brand material, plans, and review prompts must remain unstaged.

## Product intent

This is the R7-7B3 snapshot-reader adoption for the paid image-refinement and identity-iteration door:

- R6 mode remains the rollback path and keeps its existing newest-filled/revision authority plus convergence-before-receipt behavior.
- Snapshot mode never bootstraps or silently repairs the package during the paid request.
- A snapshot edit may target only an asset explicitly selected by the current package.
- A selected stale view cannot be edited and then laundered back into the package as current; it must be refreshed first.
- The free shared edit classifier runs against immutable snapshot identity documents and snapshot package authority.
- Provider generation uses immutable snapshot prompt/schema/preferences, the selected target, and the snapshot identity anchor/displayed-headshot truth.
- The running receipt's server-captured snapshot head is asserted before credits or provider work.
- Snapshot mode re-resolves after the receipt-head assertion; a failure seals the running operation with zero charged/refunded credits and marks the already-created generation audit row failed.
- Both atomic transition helpers independently re-read the receipt, operation lock, model, current snapshot head, package selections, and target asset.
- Image-only refinement remains package-only and may still operate on minted Casts without changing the sealed identity.
- Identity iteration remains draft-only, computes the identity edit from immutable snapshot documents, stales every sibling including pinned views, and appends the paired identity/package snapshots atomically.
- `R7_SNAPSHOT_READ_SCOPE` remains unset/off, so this local commit changes no live account.

## Required challenges

Verify every point against reachable production code:

1. `generation.iterate` captures `readMode` exactly once from `ctx.user.id`; the strict public input contains no read-mode, snapshot id, package id, identity id, state version, revision, selection, compatibility, or document authority.
2. Replay returns the saved result before rate limit, quota, model resolution, snapshot resolution/bootstrap, classifier, generation row, running receipt, credits, provider work, storage, or transition work.
3. R6 mode retains the original `getModelAssets` target lookup, legacy anchor/displayed-headshot selection, revision-membership authorization, and `bootstrapModelSnapshot` before receipt capture.
4. Snapshot mode calls `resolveEffectiveCastStateForRead` and never calls `bootstrapModelSnapshot`, `getModelAssets`, or another R6 newest-filled/convergence fallback for authority.
5. Foreign, missing, archived, corrupt, or headless snapshot subjects refuse free through typed/non-leaking behavior; no resolver failure falls back to R6.
6. Snapshot target authority comes only from `state.selectedViews`; a filled historical/unselected ledger asset cannot be iterated merely because the client knows its id.
7. A selected slot whose compatibility is stale refuses before the generation row, receipt, credits, provider, storage, or transition. Confirm this closes the stale-laundering path rather than silently relabeling the result current.
8. The snapshot route truth overlays mutable model documents with `state.identity.masterPrompt`, `technicalSchema`, and `preferences`; identity authorization/classification cannot read drifted mutable documents.
9. Snapshot anchor and displayed-headshot ids come from the effective state, and `targetBelongsToCurrentIdentity` is true only after selected/current package validation.
10. The shared edit authority still completes every refusal/clarification class before bootstrap, generation row, running receipt, credits, or provider work. Masked edits remain closed.
11. Image-only versus identity classification is still entirely server-owned; the client cannot select the cheaper/less restrictive transition class.
12. In R6 mode, behavior and refusal laws remain byte-for-byte equivalent where no snapshot branch is entered.
13. The generation audit row is still created before `markGenerationOperationRunning`, preserving the existing iterate audit law; do not incorrectly claim it moved. Its failure still refuses before money.
14. `markGenerationOperationRunning` captures stateVersion/package/identity/revision authority server-side under the model operation lock.
15. `assertGenerationOperationSnapshotHead` runs after the receipt starts and before `withAtomicCredits`, Gemini, candidate upload, or transition work.
16. Snapshot mode performs a second effective-state resolution after that assertion and before provider work, then rebuilds the selected/current read truth from that state.
17. If the receipt-head assertion or second resolution fails, the generation audit row is marked failed, `completeDirectOperationFailure` seals the operation with charged/refunded zero, and neither credits, provider, storage, nor transition are reached.
18. A failed audit-row completion on that free refusal is logged honestly without changing the zero-credit settlement.
19. The second resolution is not an authority race: the operation continuously owns `model:<id>`, and each transition later re-checks the running receipt, lock, expected head, and final CAS inside its transaction.
20. Provider generation uses immutable `generationModel` prompt/preferences/schema/casting brand/name, the snapshot-selected target URL, and the canonical per-angle framing. Drifted mutable documents cannot substitute.
21. `commitImageRefineSnapshot` receives the captured `readMode`; no service re-reads the environment or accepts client mode authority.
22. The image-only transition independently resolves the target in-transaction and, in snapshot mode, requires it to be a selected slot with compatibility `current`.
23. The image-only asset's identity fingerprint/stamp is built from `context.current.identitySnapshot`, not mutable model columns or route input, in snapshot mode.
24. Image-only refinement remains package-only: no identity snapshot or legacy identity revision change, sealed identity is preserved on minted Casts, only the selected angle changes, other slots carry, and the package/head CAS remains atomic.
25. `commitIteratedIdentitySnapshot` independently requires the target to be the selected current frontClose slot in snapshot mode, in addition to the existing draft/frontClose laws.
26. The identity transition overlays the transaction-owned model with `context.current.identitySnapshot` documents before `computeIdentityCommit`; patch application cannot start from drifted mutable columns.
27. The authorized typed patch remains the only mutable identity input. It is produced by the server classifier/normalizer, not raw feedback or client claims.
28. Identity iteration still writes the new documents, new legacy revision, exact anchor candidate URL/key/cost/engine, typed-edit provenance, and paired `identity_edit`/`identity_change` snapshots in one transaction.
29. All sibling heads are staled after an identity edit, including pinned views; the new frontClose is selected current and the package head advances once.
30. Any selected-target, compatibility, closure, lifecycle, seal, insert, stale-write, snapshot-append, or final-CAS failure rolls back the whole transition.
31. Existing single-charge, deterministic refund, exact owned storage-key cleanup, identity-gate retry, refund-truth, and post-commit audit-gap laws remain unchanged.
32. A durable transition cannot be followed by ordinary cleanup/refund merely because the generation audit completion write fails.
33. `SnapshotTransitionAlreadyCommittedError` remains unreachable through today's claim/replay gate. Record the known future recovery-redrive hazard separately rather than treating it as a current blocker without a reachable path.
34. The original typed-iteration test suite was changed only to mock the newly required receipt-head assertion at the same `server/db` boundary used by production; its 31 legacy door/charging/rollback cases remain meaningful.
35. New router tests drive the real app router and prove selected immutable package truth, unselected refusal, stale-selected refusal, free second-resolution failure, and immutable identity-patch threading.
36. Source/caller guards add only `castingRefinement.ts` to the exact resolver/scope allowlists and pin the new wiring without weakening transition-writer restrictions.
37. The real-MySQL tests genuinely:
    - refuse a filled historical/unselected selected-view candidate without changing assets or head;
    - refuse a selected stale view without changing assets or head;
    - drift mutable documents, run a real running `casting.iterate` receipt/lock and production identity transition, then prove the new snapshot derives from immutable prior documents.
38. The disposable driver's `--focused-iterate` mode is bounded to the transition DB suite and the `snapshot-selected.*iteration` tests, rejects conflicting focus flags, retains every production-app-id/dev-URL/stale-database/name-regex/create/drop guard, and drops its exact scratch database in `finally`.
39. No schema, migration, client, pin, Wardrobe, deletion, storage primitive, billing primitive, feature flag, or unrelated runtime surface changed.
40. The eight-file staged scope is exact and the email/private/prompt files remain outside the index.

## Evidence already produced

- `pnpm check` — clean.
- Focused suites — 115 passed / 31 environment-gated DB skips / 0 failed:
  - `server/batchC-failureInjection.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/casting/typedIterationDoors.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
- Guarded disposable development-MySQL iteration gate — 3/3 passed:
  - historical/unselected target refusal;
  - stale-selected target refusal;
  - immutable-document identity transition.
- The successful disposable run dropped its own scratch database.
- Full unit suite — 2,625 passed / 163 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.

Operational evidence: an earlier broad disposable run exceeded its command timeout. The executor identified and terminated only that exact test process tree, confirmed it was gone, and explicitly dropped only the exact regex-valid scratch database it had left. A first short run had the same guarded cleanup. The final narrowed `--focused-iterate` run completed normally and dropped its own scratch database. No broad disposable run is part of the approval evidence. Challenge this account if workspace process/database evidence contradicts it.

The first full unit run exposed a legacy typed-iteration test-harness omission: that suite did not mock the new receipt-head assertion and therefore stopped at the real DB boundary. The correction added exactly the missing mock to the existing `server/db` module mock. The suite then passed 31/31, and the full suite passed 2,625/2,625 runnable tests.

## Verdict

Return exactly one:

- `APPROVE — safe to commit R7-7B3 iteration/refinement execution authority locally`
- `REQUEST CHANGES` with a concrete reachable blocker, evidence, product impact, and the smallest sound correction.

Keep non-blocking observations separate. Approval can authorize only a local commit. It cannot authorize push, deploy, migration, snapshot-read scope enablement, convergence, production contact, B4 adoption, pin retirement, or any other R7 work.
