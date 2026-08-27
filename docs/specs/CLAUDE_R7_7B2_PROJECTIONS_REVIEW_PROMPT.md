# Fable Review Prompt — R7-7B2 Package and Paid-Plan Projections

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform a read-only review of the staged R7-7B2 diff.

Baseline: `204d335`

Read first:

- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`
  (especially R7-7B2 and the B2/B3 boundary)
- `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
- `server/casting/effectiveCastState.ts`
- `server/casting/snapshotReadScope.ts`
- `server/casting/snapshotShadow.ts`
- `server/casting/snapshotConsumerShadow.ts`
- `server/casting/snapshotBootstrap.ts`
- `server/casting/mintPackage.ts`
- `server/casting/refreshSlots.ts`
- `server/routes/generation/castingExport.ts`
- `server/db/generationOperations.ts`
- all 16 staged files in full.

Product boundary:

- This slice adopts snapshot authority only for `generation.packageState`,
  `generation.mintPackagePlan`, `generation.refreshSlotsPlan`, export planning,
  and the pre-spend head check on the mint/refresh paid doors.
- `R7_SNAPSHOT_READ_SCOPE` remains unset/off. R6 remains the live authority for
  every account until a separately authorized Railway variable change.
- Canonical generation/edit readers, `generatePdf` server-side image
  resolution, Wardrobe, lobby/registry/board/Profile readers, pin retirement,
  client ceremony, and global cutover belong to later B3–B7 slices.
- There is no schema or migration, no client change, no pin mutation, no
  convergence run, no production contact, no push and no deploy.

Staged files:

- `scripts/drive-r7-7b1-effective-reader-disposable.mts`
- `server/batchC-doors.test.ts`
- `server/casting/effectiveCastProjections.test.ts`
- `server/casting/effectiveCastRead.test.ts`
- `server/casting/effectiveCastRead.ts`
- `server/casting/effectiveCastState.test.ts`
- `server/casting/effectiveCastState.ts`
- `server/casting/mintPackage.ts`
- `server/casting/refreshSlots.ts`
- `server/db/generationOperations.ts`
- `server/db/index.ts`
- `server/r7-generation-operations-db.test.ts`
- `server/r7-snapshot-bootstrap-db.test.ts`
- `server/r7-snapshot-selection-contract.test.ts`
- `server/r7-strip-first-package-care.test.ts`
- `server/routes/generation/castingExport.ts`

Verify all of the following against reachable production code:

1. Each adopted route captures `SnapshotReadMode` once from the authenticated
   user id. No client field, model field, snapshot id, selection id, state
   version or request payload can choose authority.
2. Unset/empty/`off` remains R6, and every unflagged projection is
   byte-compatible with the previous route output. In particular the optional
   `pinningAvailable` capability is not added to the R6 response.
3. Snapshot `packageState` chooses current assets only from the explicit
   package slots. A newer filled ledger row cannot replace a selected older or
   restored row.
4. The asset ledger contributes only per-angle filled-version counts and
   failed-attempt/refund evidence. It never chooses current presentation,
   anchor, displayed headshot, tier presence, or refresh target.
5. Snapshot `packageState` returns all six canonical slots, truthful
   compatibility-derived stale state, selected-asset pin presentation, and
   `pinningAvailable: false` without granting the client authority.
6. Snapshot `mintPackagePlan` runs all three tiers through the shared
   `computeMintIntegrityForSelection` law using the exact selected assets,
   snapshot identity text, snapshot anchor and selected frontClose. Provenance,
   pinned/stale, missing-view cost and seal-related truth cannot be weakened by
   the adapter.
7. Snapshot `refreshSlotsPlan` runs all six slots through the existing shared
   refresh refusal law. FrontClose, pinned, stale, unfilled, failed-marker and
   requested-angle semantics stay honest.
8. Export planning counts the snapshot-selected filled manifest rather than
   newest-filled ledger rows. Confirm that trusting client image URLs in
   `generatePdf` remains explicitly deferred to B3 and is not accidentally
   widened or presented as fixed here.
9. Headless drafts remain honestly empty and never invent a selection. A
   minted Cast with no head now fails closed as `mint_seal_missing`.
10. Missing/foreign models remain non-leaking `NOT_FOUND`. Any malformed,
    corrupt or incomplete snapshot state becomes a typed
    `PRECONDITION_FAILED` with static copy saying no credits were used.
    Unexpected infrastructure errors are not masked.
11. Plan queries do no bootstrap, convergence, inserts, updates, pins,
    credits, provider/Gemini, storage or automatic generation.
12. For snapshot-enabled mint/refresh execution, the pre-running path resolves
    the existing snapshot head and never calls `bootstrapModelSnapshot`, so a
    corrupt head cannot be silently rewritten from R6 truth before spending.
    The unflagged path keeps its existing bootstrap/convergence behavior.
13. `markGenerationOperationRunning` still captures expected state version,
    package snapshot id and identity snapshot id server-side under the model
    lock, after the chosen preflight authority has been validated.
14. `assertGenerationOperationSnapshotHead` independently verifies the owned
    running receipt, exact model id, `model:<id>` operation lock, owned/live
    model, current package→identity closure, and all three expected receipt
    fields before the paid executor begins.
15. A changed or invalid receipt head seals an honest zero-charge failure
    before `deductPoints`, provider work, asset creation, transition commit, or
    refund logic. It does not strand the operation lock outside the existing
    recovery-required machinery.
16. Replay still returns the stored result before planning, bootstrap,
    assertion, credits, provider work or transition execution. Snapshot replay
    presentation resolves through the same selected package state.
17. Mint and refresh still re-plan under their already-held model operation
    lock. No automatic spend was introduced, and executor selection itself
    remains the explicit B3 boundary.
18. The existing A3 snapshot transition writers, billing/reference scheme,
    failure markers, storage cleanup, deletion/erasure closure, pins, client
    code and public operation projections are unchanged.
19. Tests are behavioral:
    - pure projection tests cover six explicit slots, a newer unselected ledger
      row, restored selection, version counts, failure evidence, all mint tiers,
      pinned/stale state, six-angle refresh and headless state;
    - router tests prove receipt-head refusal before money/provider work and
      pin the order running receipt → head assertion → executor;
    - real MySQL proves the selected snapshot survives a newer ledger row and
      drives package/mint/refresh plans;
    - real MySQL proves a receipt-captured head passes, then refuses after a
      state-version drift.
20. The disposable driver remains development-only, refuses production app
    ids and non-dev URLs, refuses stale prefix databases, creates/drops only
    the exact guarded `drape_r7_7b1_disposable_*` name, applies migrations only
    through 0010, supports a bounded `--focused-b2` mode, and leaves no child
    processes or scratch databases behind.
21. Source/caller guards bound the B2 adoption precisely. No unexpected route,
    worker, client, or writer imports the effective resolver or rollout scope.
22. Exactly the 16 listed files are staged. The intentional two-line
    `server/routes/emailVerification.ts` sender/reply-to edit remains tracked
    but unstaged and must not be modified, staged or discarded. `.agents/`,
    `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand files,
    this prompt, the plan, and all other local/prompt files remain unstaged.

Challenge especially:

- whether any path can mix R6 and snapshot authority inside one request;
- whether a plan can use explicit selections while its pre-spend safety check
  binds to a different head;
- whether the head assertion has a race, ownership, lock, lifecycle or
  package→identity closure hole;
- whether failed-marker/refund evidence can accidentally replace a selected
  filled view;
- whether a newer ledger row can leak back into snapshot mint/refresh/export
  planning;
- whether R6 response shape or behavior changed despite scope being off;
- whether any B3 execution or client-image authority was accidentally claimed
  or adopted early.

Recorded verification evidence:

- `pnpm check` — clean.
- Focused local suites — 87 passed / 46 environment-gated skipped / 0 failed.
- Full unit suite — 2,590 passed / 158 environment-gated skipped / 0 failed.
- Guarded full disposable-MySQL drive — 59/59 effective-reader/projection
  cases and 32/32 durable-operation cases passed; scratch database dropped.
- Guarded focused B2 disposable-MySQL drive — selected-head projection 1/1 and
  receipt-head capture/drift 1/1 passed; scratch database dropped.
- `pnpm build` — passed.
- `git diff --cached --check` — clean.
- Process check — no verification child remains; only the Codex app's existing
  Node process is running.

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B2 locally`
- `REQUEST CHANGES` with a concrete reachable blocker.

Keep non-blocking observations separate. This review can authorize only a
local commit. It cannot authorize push, deploy, a Railway variable, snapshot
read enablement, convergence, pin clearing, production contact, B3 adoption or
any other R7-7 work. Do not edit, stage, commit, push, deploy, run a database,
or change environment variables.
