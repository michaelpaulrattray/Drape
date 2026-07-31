# R7-7B3 refresh execution authority — read-only review

Review only the staged R7-7B3 refresh-execution reader slice at baseline
`85e9a32`.

Return exactly one verdict:

- `APPROVE — safe to commit R7-7B3 refresh execution authority locally`
- `REQUEST CHANGES` with a concrete reachable blocker

This review can authorize only a local commit. It cannot authorize push, deploy,
Railway variables, snapshot-read enablement, migration, convergence, production
contact, pin work, any database drive, or later R7 work.

Do not edit, stage, commit, push, deploy, run a database, change environment
variables, or contact storage/provider services. Read the full staged diff and
all surrounding production code. Do not trust the tests or this prompt's claims.

## Intended staged scope

Exactly these six files:

1. `server/casting/refreshSlots.ts`
2. `server/routes/generation/castingExport.ts`
3. `server/casting/refreshSlots.test.ts`
4. `server/batchC-doors.test.ts`
5. `server/batchC-sourceGuards.test.ts`
6. `server/r7-snapshot-selection-contract.test.ts`

The intentional sender/reply-to change in
`server/routes/emailVerification.ts` must remain unstaged and untouched.
`.agents/`, `.codex/`, `CLAUDE.local.md`, brand documents, the R7 plan, and all
`CLAUDE_*` review prompts must remain unstaged.

## Product contract

R7-7B2 moved refresh planning to snapshot authority for enabled accounts, but
the paid `executeRefreshSlots` service still rediscovered current truth through
R6 newest-filled assets. That created a plan-versus-execution seam: the UI could
quote a snapshot-selected stale view while execution used a newer unselected
row's pin/stale state, mutable identity documents, or a rediscovered headshot.

This slice closes only that seam:

- R6 mode keeps its existing model/assets/newest-filled/anchor behavior.
- Snapshot mode independently re-resolves effective state inside the paid
  executor.
- Explicit package selections determine refresh refusal/current slot truth.
- The immutable identity snapshot supplies prompt/schema/preferences.
- The immutable identity anchor supplies the generation reference image.
- Newer unselected ledger rows remain history and cannot become authority.
- Any executor-side snapshot refusal occurs before credit deduction, Gemini, or
  candidate/transition work.
- Billing, refunds, generation, storage cleanup, and atomic snapshot settlement
  are otherwise unchanged.
- `R7_SNAPSHOT_READ_SCOPE` remains off/unset, so this local commit changes no
  live account.

## Required verification

Challenge each point against reachable production code:

1. `generation.refreshSlots` captures read mode once from
   `captureSnapshotReadMode(ctx.user.id)`. Read mode is not present in its Zod
   input and cannot be client-controlled.
2. Replay still returns before rate limits, quota, planning, bootstrap/resolver,
   running receipt, credits, provider work, or transition work.
3. R6 mode still plans from `computePackageSlots(getModelAssets())`, bootstraps
   before the running receipt, and executes from the same R6 model/assets plus
   `selectIdentityAnchor`. Direct service callers that omit `readMode` remain R6.
4. Snapshot mode never calls `bootstrapModelSnapshot` and never converges or
   repairs from R6 truth.
5. The router's snapshot plan still comes from `planRefreshSlots(...,
   readMode: "snapshot")`, and headless/corrupt snapshot state refuses before
   the running receipt.
6. The running receipt still captures the server-owned snapshot head under the
   model operation lock. `assertGenerationOperationSnapshotHead` still runs
   before the paid executor.
7. The router passes its one captured `readMode` into `executeRefreshSlots`.
   Nothing inside the service re-reads the environment or accepts a mode from
   public input.
8. Snapshot execution independently calls
   `resolveEffectiveCastStateForRead({ userId, modelId, readMode })`; it does not
   trust plan DTOs, client slot data, or router-provided snapshot rows.
9. `snapshotRefreshExecutionAuthority` derives slots only through
   `computeEffectivePackageSlots(state)`: explicit selected rows provide URL,
   pin, and compatibility; the ledger contributes only version/failure history.
10. A newer unselected row cannot replace the selected slot or change its
    pin/stale truth. Snapshot execution never calls `getModelAssets`.
11. Generation uses `state.anchor.storageUrl`, not displayed frontClose, newest
    frontClose, or the selected intent slot as its identity reference.
12. Generation uses `state.identity.masterPrompt`, `.technicalSchema`, and
    `.preferences`; mutable `models` identity documents cannot replace them.
    The dual-write `model.identityRevisionId` remains the expected legacy
    revision stamp, unchanged by this slice.
13. Headless snapshot state yields no anchor and cannot reach generation.
    Corrupt/foreign/missing state keeps the resolver's typed, non-leaking
    refusal behavior.
14. Structural refusals for frontClose, pinned, and never-attempted slots remain
    before credits. Failed-marker retry remains refreshable through the existing
    shared `refreshRefusalFor` law.
15. For every admitted requested angle, the executor's `totalCost` remains the
    same shared `slotCost` total quoted by the snapshot plan. A refused angle
    stops before deduction rather than charging a mismatched total.
16. An executor-side resolver failure after the running receipt is sealed through
    the existing operation failure machinery with `chargedCredits: 0` and
    `refundedCredits: 0`; no deduction, provider call, or transition occurs.
17. `generatePackageSlotCandidate` receives the immutable snapshot prompt/schema,
    the authoritative anchor URL, and the existing operation charge reference.
    Back/walk identity-gate behavior and retry rules are unchanged.
18. Successful candidates still settle once through
    `commitRefreshedSlotsSnapshot`. Snapshot selection writes, storage ownership,
    generation audit completion, partial failure, and refund truth are unchanged.
19. The exact per-angle refund-reference and failure-marker laws in
    `failPreparedPackageSlot` are untouched. This slice introduces no second
    charge/refund path.
20. The R6 source guard remains meaningful: R6 still consumes
    `selectIdentityAnchor`; the updated guard additionally pins snapshot
    `state.anchor.storageUrl` → resolved `anchorUrl` → generation context.
21. The effective-state resolver caller allowlist expands by exactly
    `server/casting/refreshSlots.ts`. No route/client/background caller gains
    direct resolver authority.
22. The route-level test drives the real production router and actual
    `executeRefreshSlots`, proving snapshot plan/head/executor resolution,
    bootstrap bypass, no `getModelAssets`, immutable prompt/schema, exact anchor,
    provider ordering, and one atomic commit.
23. The failure test makes only the executor's third re-resolution fail and
    proves the already-running operation moves no credits and reaches neither
    provider nor transition.
24. The pure test proves a newer unselected pinned row cannot override an
    explicitly selected unpinned/stale slot, and that anchor/display separation
    plus immutable identity documents survive projection.
25. No disposable-DB run is required by this bounded slice: it adds no SQL,
    schema, transition, receipt, or lock law. The real resolver, receipt-head
    assertion, and atomic refresh transition already have guarded MySQL coverage.
    Confirm the tests do not claim a new database guarantee.
26. Scope is exactly the six intended server/test files. No schema, migration,
    client, Wardrobe, Canvas, pin mutation, storage API, billing primitive,
    deletion, or snapshot transition code moved.

## Challenge these likely holes explicitly

- Could the router plan one snapshot head and the executor charge against
  another? Trace the held model operation lock, receipt-captured head,
  pre-executor assertion, and executor re-resolution.
- Could a newer unselected ledger asset silently replace the package-selected
  slot, its pinned state, or its stale compatibility?
- Could displayed frontClose replace the identity snapshot's anchor during
  generation?
- Could mutable model prompt/schema/preferences leak back into snapshot-mode
  generation?
- Could a snapshot resolver failure after `markGenerationOperationRunning`
  strand a lock, move credits, or be mislabeled as success?
- Could a failed-marker retry become unrefreshable because it has no selected
  slot? Confirm ledger failure evidence remains part of
  `computeEffectivePackageSlots`.
- Could the widened optional `readMode` change an existing direct R6 service
  caller?
- Could plan cost and executor cost diverge for an admitted multi-angle request?
- Could replay or recovery re-enter provider work under the same operation id?
- Does any new path automatically spend, retry, refresh, or mutate state merely
  because the account is snapshot-enabled?

## Recorded local evidence (verify independently where safe)

- `pnpm check` — clean.
- Focused suites:
  - `server/casting/refreshSlots.test.ts`
  - `server/batchC-doors.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/casting/effectiveCastProjections.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - result: 90/90 passed.
- Full unit suite: 2,609 passed / 159 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.

Keep non-blocking observations separate from the verdict.
