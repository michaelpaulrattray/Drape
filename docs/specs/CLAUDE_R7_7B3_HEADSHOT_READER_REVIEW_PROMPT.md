# Fable review — R7-7B3 headshot execution authority

Review the staged diff read-only against the ratified R7-7B snapshot-reader cutover plan and the surrounding production code. Challenge the implementation rather than trusting the executor summary or test names.

Do not edit, stage, commit, push, deploy, run a database, change Railway variables, enable snapshot reads, or contact production.

## Scope

Baseline HEAD: `bda23d8` (`R7-7B3: adopt snapshot mint execution authority`).

Exactly these seven files should be staged:

1. `server/routes/generation/castingImaging.ts`
2. `server/casting/snapshotTransitions.ts`
3. `server/batchC-doors.test.ts`
4. `server/batchC-failureInjection.test.ts`
5. `server/batchC-sourceGuards.test.ts`
6. `server/r7-snapshot-selection-contract.test.ts`
7. `server/r7-snapshot-transitions-db.test.ts`

The intentional sender/reply-to edit in `server/routes/emailVerification.ts` must remain unstaged and untouched. `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand material, plans, and review prompts must remain unstaged.

## Product intent

This is the R7-7B3 snapshot-reader adoption for the paid headshot door:

- R6 mode remains the rollback path and still bootstraps/converges before the receipt captures authority.
- Snapshot mode never bootstraps or silently repairs a current head during the paid request.
- A current snapshot Cast generates from its immutable identity snapshot documents.
- A genuinely headless first Cast remains valid and generates from its draft documents because no prior identity snapshot exists.
- The running receipt's server-captured snapshot head is asserted before credits, generation-row creation, Gemini, storage, or transition work.
- Snapshot mode re-resolves after that assertion so provider generation uses the asserted authority, not an earlier request read.
- The atomic headshot transition independently re-reads the receipt, operation lock, model, current head, and ledger.
- On a snapshot re-roll, the transition uses the current identity snapshot as document authority and synchronizes the legacy model document columns to that immutable truth in the same transaction. This is necessary because the transition wrapper builds the new identity snapshot from the post-mutation model row.
- First-headshot creation and R6 re-roll behavior remain unchanged.
- `R7_SNAPSHOT_READ_SCOPE` remains unset/off, so this local commit changes no live account.

## Required challenges

Verify every point against reachable production code:

1. `generation.castingImage` captures `readMode` exactly once from `ctx.user.id`; the strict Zod input has no read-mode, snapshot-id, package-id, identity-id, state-version, or revision authority.
2. Replay returns the saved receipt asset before rate limits, quota, bootstrap/resolution, running receipt, credits, generation row, provider work, storage, or transition work.
3. Replay resolves the exact saved `assetId` from history and does not reinterpret the current package selection.
4. R6 mode still calls `bootstrapModelSnapshot` before `markGenerationOperationRunning`; the first headshot remains legitimately headless until the atomic transition.
5. Snapshot mode calls `resolveEffectiveCastStateForRead` and never calls `bootstrapModelSnapshot` or another R6 convergence/newest-filled fallback.
6. Foreign, missing, archived, minted, corrupt, or invalid snapshot subjects refuse before money with existing non-leaking/typed behavior; no resolver failure falls back to R6.
7. `markGenerationOperationRunning` captures stateVersion/package/identity/revision authority server-side under the model operation lock.
8. `assertGenerationOperationSnapshotHead` runs after the receipt starts and before `deductPoints`, `createGeneration`, Gemini, storage, or commit.
9. Snapshot mode re-resolves after that assertion and before provider work; failure seals the running receipt with charged/refunded zero and reaches no paid or durable-result boundary.
10. The second snapshot resolution is not a new authority race: the model operation lock is continuously owned and the transition later re-checks the same receipt/head/CAS authority.
11. A current snapshot Cast uses `state.identity.masterPrompt`, `technicalSchema`, and `preferences` for reinforcement, ethnicity hint, casting brand, and Gemini input.
12. Mutable legacy documents cannot substitute for immutable snapshot documents on a current snapshot head, even if the model row has drifted.
13. A genuinely headless snapshot Cast uses the current draft model documents, does not invent a prior identity snapshot, and can create the first identity/package head.
14. Snapshot current/headless handling cannot accidentally use a nullable identity or silently fall back because of truthiness or an unexpected resolver status.
15. `commitHeadshotSnapshot` receives the server-captured `readMode`; no client or service re-reads/overrides rollout scope.
16. The transition still independently requires a running `casting.headshot` receipt and ownership of the exact `model:<id>` lock, then re-reads the live draft, current snapshot head, and asset ledger in one transaction.
17. The transition independently checks `hasHeadshot === !!context.current`; a ledger/snapshot disagreement rolls back rather than being laundered.
18. In snapshot mode with a current head, `identityAuthority` is `context.current.identitySnapshot`, never mutable caller data or a pre-lock route object.
19. Because the wrapper appends identity documents from the post-mutation model row, the snapshot re-roll synchronizes `masterPrompt`, `technicalSchema`, and `preferences` from the immutable identity snapshot inside the same transaction before the append.
20. That synchronization cannot affect R6 re-rolls or first-headshot creation: it is gated by both `readMode === "snapshot"` and `context.current`.
21. The new anchor's identity text/provenance and the new identity snapshot's documents agree with the immutable prior snapshot when mutable legacy columns had drifted.
22. Snapshot re-roll still advances the legacy identity revision, inserts exactly one anchor asset with the exact generated URL/key/cost/engine, stales all filled siblings including pinned ones, appends the paired `anchor_reroll`/`identity_change` snapshots, selects the new frontClose, and advances the head once.
23. First-headshot creation still uses the `create`/`create` pair and does not mint a new revision unnecessarily.
24. Draft-only and minted-identity immutability laws remain enforced independently inside the transaction.
25. The entire legacy-document synchronization, asset insert, stale writes, identity/package appends, and final head CAS are one transaction; any later validation or write failure rolls everything back.
26. The single 350-credit deduction, deterministic refund reference, generation audit row, exact owned storage-key cleanup, refund truth, and post-commit audit-gap law remain unchanged.
27. A transition failure before durable save deletes only the exact returned storage key and refunds once; a durable commit cannot be followed by cleanup/refund through the ordinary post-commit audit path.
28. `SnapshotTransitionAlreadyCommittedError` remains unreachable in today's operation gate/replay flow; record any future recovery-redrive hazard separately rather than treating it as live behavior without evidence.
29. The failure-injection suite was updated only to mock the newly required receipt-head assertion at the same `server/db` import boundary used by production, preserving its original refund/cleanup tests.
30. Caller/source guards add `castingImaging.ts` to the exact resolver/scope allowlists and pin immutable-document/receipt-head wiring without weakening existing transition-writer authority guards.
31. The router tests drive the real app router with mocked external boundaries and meaningfully prove R6 ordering, snapshot ordering, immutable generation documents, honest headless creation, and free second-resolution failure.
32. The real-MySQL test genuinely creates a snapshot head, drifts mutable model documents, runs a real `casting.headshot` receipt/lock and production `commitHeadshotSnapshot`, then proves both the model row and new identity snapshot return to immutable snapshot truth.
33. No schema, migration, client, pin, Wardrobe, deletion, storage primitive, billing primitive, feature flag, or unrelated runtime surface changed.
34. The seven-file staged scope is exact and the email/private/prompt files remain outside the index.

## Evidence already produced

- `pnpm check` — clean.
- Focused authority suites — 83/83:
  - `server/batchC-doors.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
- Failure-injection suite — 40/40.
- Guarded disposable development-MySQL B3 gate — 2 passed / 26 filtered, including:
  - snapshot headshot immutable-document transition;
  - snapshot restore package-selection authority.
- The disposable database was dropped in `finally`.
- Full unit suite — 2,618 passed / 160 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.

The first disposable command was interrupted by a command-wrapper timeout and left one regex-valid scratch database. The driver then correctly refused to continue. The executor explicitly dropped only that exact scratch name under the same production-app-id, development-URL, and name-regex guards, reran the gate with a proper timeout, and the successful run dropped its own scratch database. Challenge this account if the process or cleanup evidence in the workspace contradicts it.

## Verdict

Return exactly one:

- `APPROVE — safe to commit R7-7B3 headshot execution authority locally`
- `REQUEST CHANGES` with a concrete reachable blocker, evidence, product impact, and the smallest sound correction.

Keep non-blocking observations separate. Approval can authorize only a local commit. It cannot authorize push, deploy, migration, snapshot-read scope enablement, convergence, production contact, B4 adoption, pin retirement, or any other R7 work.
