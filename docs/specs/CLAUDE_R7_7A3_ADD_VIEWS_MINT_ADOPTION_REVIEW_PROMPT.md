# Fable review - R7-7A3 Add Views, late-view, and atomic mint adoption

Read-only review. Do not edit, stage, commit, push, deploy, run migrations,
contact production, enable flags, or run paid generations.

## Baseline and bounded scope

- Baseline HEAD: `a6854df`
- Review the full staged diff and the surrounding production code it relies on.
- Expected staged files (exactly 14):
  - `docs/specs/CLAUDE_R7_7A3_ADD_VIEWS_MINT_ADOPTION_REVIEW_PROMPT.md`
  - `scripts/drive-r7-snapshot-bootstrap-disposable.mts`
  - `server/batch0-authority.test.ts`
  - `server/batchB-status-readmodel.test.ts`
  - `server/batchC-doors.test.ts`
  - `server/batchC-failureInjection.test.ts`
  - `server/casting/mintPackage.ts`
  - `server/casting/snapshotBootstrap.ts`
  - `server/casting/snapshotTransitions.ts`
  - `server/modelLifecycleGuard.test.ts`
  - `server/r7-generation-operations-db.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
  - `server/routes/generation/castingExport.ts`

Protected/local files (`.agents/`, `.codex/`, `.claude/settings.local.json`,
`CLAUDE.local.md`, brand files, and unrelated `CLAUDE_*` prompts) must remain
unstaged.

## Product claim

This slice adopts the paid Add Views and mint package door into the R7 snapshot
system. Successful generated views become durable only through one atomic
asset-plus-package transition. A true mint atomically commits its name, agency
id, draft-to-active lifecycle, generated assets, package head, and both seal
pointers. Adding a late view to a minted Cast preserves its sealed identity.
Failed views retain the existing named marker and ledger-truth refund behavior.
No UI/read cutover occurs.

## Challenge these contracts

1. Runtime adoption is bounded. `mintPackage.ts` was already an allowed
   snapshot-transition importer; no unrelated writer entered the slice.
2. Replay returns its stored result before plan/bootstrap, running-receipt
   capture, deduction, provider work, asset writes, lifecycle writes, or
   snapshot writes.
3. The route owns `model:<id>`, plans while locked, bootstraps before
   `markGenerationOperationRunning`, and the running receipt captures the
   bootstrapped server-owned state/package/identity/revision head.
4. Headless or bootstrap failure is free, plain-English, honestly seals the
   claimed receipt, and releases the operation lock except through the existing
   explicit recovery-required path.
5. No client-supplied state version, snapshot ids, identity revision, lifecycle,
   selection, or seal authority reaches the transition. The wrapper re-reads
   the exact running receipt and model lock in-transaction.
6. Draft Add Views commits every successful generated asset and exactly one
   `add_views` package atomically. Multiple successful angles in one request
   never create one package per angle.
7. A true mint commits the final name, generated agency id, `draft -> active`
   status, `mintedAt`, all generated assets, the `mint` package, current head,
   and sealed identity/package pointers in one transaction.
8. The old identity-revision CAS remains enforced using receipt-owned truth,
   including semantic `genesis` mapping to SQL NULL. A concurrent revision,
   lifecycle, name/agency, tombstone, or head change refuses and rolls back the
   complete mint.
9. A partial provider/gate failure during a mint commits any successful views
   as one `add_views` package under the original `casting.mint` receipt, leaves
   the Cast a draft and unsealed, and returns honest `mintAborted` truth.
10. A zero-view mint retry remains free and can atomically seal the already
    complete draft package without inventing a generated asset or charge.
11. A minted late view uses package reason `late_view`, selection reason
    `late_view`, compatibility `current`, and keeps pointing to the exact sealed
    identity snapshot. The immutable sealed package pointer remains the original
    mint package even as the current package advances.
12. Pre-R7 minted models with a valid snapshot head and no seal pointers are
    lazily sealed before a late view is accepted. Half-present seals or a model
    whose live identity no longer matches its seal fail closed.
13. Generated view rows persist exact storage keys, cost, engine, mint tier,
    authoritative anchor input, display role, and the current legacy identity
    stamp. `frontClose` cannot enter Add Views or late-view settlement.
14. Current-package closure is preserved: changed angles replace their prior
    selections with truthful generated/late-view provenance and all untouched
    angles carry forward. Package-only writes cannot change identity documents,
    legacy revision, anchor, lifecycle (except mint), or seal identity.
15. Provider/gate failures never enter the atomic transition. They keep the
    durable Retry marker and report only the refund actually recorded under the
    deterministic per-angle reference.
16. If atomic settlement fails before commit, every owned successful candidate
    is deleted by its exact storage key and gets one named failure/refund
    settlement. No public URL reverse-parsing, raw provider text, or key leak is
    introduced.
17. Once the atomic transition commits, generation-audit completion is
    best-effort only: an audit-row failure cannot delete selected assets, refund
    credits, undo minting, or report durable success as failure.
18. Challenge the ambiguous database COMMIT-acknowledgement window and
    `SnapshotTransitionAlreadyCommittedError`. Distinguish a reachable
    current-runtime double-refund/key-delete hazard from the already-recorded
    future recovery-redrive caution.
19. The legacy `generatePackageSlot` writer and production
    `mintModelAtomically` call are gone from `mintPackage.ts`; failure-marker
    asset rows remain deliberately separate and are not mistaken for selected
    package assets.
20. The real-MySQL tests genuinely prove:
    - multiple draft views form one package and preserve identity;
    - true mint lifecycle/head/seals are atomic;
    - late views preserve the sealed identity and original seal package;
    - legacy minted lazy sealing works;
    - a mid-batch candidate failure rolls back assets, lifecycle, head, and
      both seal pointers.
21. The foreground landing regression now starts a real `casting.mint`
    operation and uses the atomic service without weakening exactly-once
    placement.
22. The disposable runner's explicit process exit occurs only after awaited
    cleanup, its verbose reporter does not weaken guards, and no test process or
    scratch database can be left behind on its normal success/failure paths.
23. Scope is clean: no schema/migration, client/UI, feature flag, Wardrobe,
    evidence/composer, billing-policy, storage-worker, or read-cutover change.

Also look for important holes not named above, especially partial-mint
accounting, exact-key cleanup after mixed outcomes, lifecycle/agency collisions,
lock release ordering, stale-head races, seal drift, empty-candidate behavior,
and mocks that are stronger than production.

## Verification evidence to independently challenge

- `pnpm check` - clean.
- Focused suites - 183 passed / 54 environment-gated skipped / 0 failed.
- Full sequential unit suite - 2,527 passed / 147 environment-gated skipped /
  0 failed.
- `pnpm build` - passed.
- `git diff --check` - clean.
- Guarded disposable development Railway-MySQL snapshot gate - 38/38 passed.
  The regex-scoped scratch database was dropped and the exact driver process
  tree was confirmed absent afterward.

## Required verdict

Return exactly one of:

- `APPROVE - safe to commit R7-7A3 Add Views/mint adoption locally`
- `REQUEST CHANGES` with each concrete reachable blocker, code evidence,
  product impact, and the smallest sound correction.

Approval is local-commit scoped only. It does not authorize push, deploy,
migration, backfill, read cutover, feature enablement, or further writer
adoption.
