# Fable review — R7-7A3 Casting refresh snapshot adoption

Read-only review. Do not edit, stage, commit, push, deploy, run migrations, contact production, enable flags, or run paid generations.

## Baseline and bounded scope

- Baseline HEAD: `7d129ed`
- Review the full staged diff and the surrounding production code it relies on.
- Expected staged files (exactly 11):
  - `server/batchC-doors.test.ts`
  - `server/batchC-failureInjection.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/casting/aiService.ts`
  - `server/casting/mintPackage.ts`
  - `server/casting/refreshSlots.ts`
  - `server/casting/snapshotTransitions.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
  - `server/routes/generation/castingExport.ts`
  - `server/w3-package-health.test.ts`

Protected/local files (`.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand files, and other `CLAUDE_*` prompts) must remain unstaged.

## Product claim

This slice adopts the paid Casting package-refresh door into the R7 snapshot system. Provider/gate work may finish per view, but every successful view in one refresh request must become durable through one atomic asset-plus-package transition. Failed views remain named, refunded according to ledger truth, and absent from the new package snapshot. No UI/read cutover occurs.

## Challenge these contracts

1. Runtime adoption is bounded. `refreshSlots.ts` is the only newly allowed production importer of `snapshotTransitions.ts`; no unrelated writer entered the slice.
2. Replay returns stored results before bootstrap, receipt start, deduction, provider calls, asset writes, or snapshot writes.
3. The route claims `model:<id>`, plans while locked, bootstraps before `markGenerationOperationRunning`, and the running receipt captures the bootstrapped server-owned head.
4. Headless/bootstrap failure is free, plain-English, seals the claimed receipt honestly, and does not strand the operation lock except through the existing explicit recovery-required path.
5. No client-supplied state/package/identity/revision/selection authority reaches the transition. The wrapper re-reads the exact running `casting.refresh` receipt and owned lock in-transaction.
6. Successful generated candidates become model-asset rows and one `slot_refresh` package snapshot atomically. Multiple successes in one request produce one package, not one package per angle.
7. Provider/gate failures are excluded from the package, retain durable Retry markers, and refund exactly once using the existing deterministic per-angle reference.
8. Package-only refresh preserves identity documents and revision. A minted Cast continues pointing at its sealed identity snapshot; no identity snapshot is appended or seal weakened.
9. Changed selections use `compatibility: current`, `selectionReason: refreshed`, and the replaced slot selection as `sourceSelectionId`; untouched angles are carried.
10. The authoritative identity anchor is resolved server-side from the current identity snapshot and used for both generation provenance and identity stamping. `frontClose` remains structurally unrefreshable.
11. Expected head, identity revision, model ownership, operation kind, lock ownership, lifecycle/seal, selection closure, and final CAS all refuse stale/cross-model/racing writes inside the transition transaction.
12. Billing stays exactly once: the plan total and deduction are unchanged; successful views stay charged; failed views report only actually recorded refunds; operation charged/refunded totals remain truthful for partial success and total failure.
13. Storage ownership is exact end to end. The live `generateFullBody` and `generateRemainingViews` helpers return the real upload key (not only a URL or test-only mock key), candidates carry it, asset rows persist it, and no cleanup reverse-parses a public URL.
14. Any pre-commit settlement failure deletes every owned successful candidate by exact key and refunds/marks each one. Storage keys and raw provider messages do not enter public results or sensitive logs.
15. The gated back/walk retry deletes the rejected first upload before generating attempt two. A second rejection deletes attempt two as well, then records one final slot failure/refund.
16. Once the atomic snapshot commit succeeds, generation-audit completion failure is only an audit gap: it cannot delete selected assets, refund credits, or turn durable success into failure.
17. Mint/add-view behavior remains compatible through the wrapper: it still writes one legacy asset per successful slot during dual-write, and an asset-insert failure now also deletes the exact candidate key before refunding.
18. Crash/replay behavior is not weakened. Challenge the window after snapshot commit but before operation finalization, including `SnapshotTransitionAlreadyCommittedError`; identify a reachable current-runtime cleanup/refund hazard if one exists rather than only a future recovery-driver concern.
19. The real-MySQL tests genuinely prove two successful refreshed views form one package, identity stays unchanged, exact storage metadata is saved, and a mid-batch asset-insert failure rolls back the first asset plus all snapshot/head changes.
20. Scope is clean: no schema/migration, client/UI, feature flag, Wardrobe, evidence/composer, billing-policy, storage-worker, or read-cutover change.

Also look for important holes not named above, especially partial-success accounting, exact-key leaks, post-commit cleanup/refund paths, lock ordering, stale-head races, and test mocks that are stronger than production.

## Verification evidence to independently challenge

- `pnpm check` — clean.
- Focused suites — 118/118 passed.
- Full sequential unit suite — 2,525 passed / 143 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.
- Guarded disposable dev-Railway MySQL snapshot gate — 34/34 passed and the regex-scoped scratch database was dropped. The transition/database code is unchanged since that run; later corrections were limited to the live provider storage-key return, gated-retry cleanup, and their non-DB tests.

## Required verdict

Return exactly one of:

- `APPROVE — safe to commit R7-7A3 refresh adoption locally`
- `REQUEST CHANGES` with each concrete reachable blocker, code evidence, product impact, and the smallest sound correction.

Approval is local-commit scoped only. It does not authorize push, deploy, migration, backfill, read cutover, feature enablement, or further writer adoption.
