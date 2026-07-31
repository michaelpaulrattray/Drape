# Fable review — R7-4A strip-first package care

Perform a read-only review of the staged R7-4A diff against the current codebase and the ratified R7 plan.

Baseline: `a716a05` on `main`.

This is a review task only. Do not edit, stage, commit, push, deploy, run migrations, or contact production. Challenge the implementation rather than assuming the executor's claims are correct. If you disagree, say so and explain the concrete reachable failure.

## Founder product direction

Casting should feel simple, calm, and creative. Routine package care belongs directly on the six-view strip; users should not need to understand or open a separate “Package Health” system.

R7-4A is the safe first step:

- healthy views stay visually quiet;
- stale views expose a small direct refresh action and server-planned price;
- failed views expose direct retry and price while retaining honest failure/refund copy;
- missing views expose an add action and the price of the smallest existing package tier that actually contains that view;
- refreshing/generating views show truthful progress and cannot be clicked again;
- when more than one view is actionable, the strip offers Refresh all with the summed server-plan price;
- no refresh, generation, or charge occurs automatically;
- the existing Package Health dialog is demoted to a temporary **Details/history** surface only because R7-4B has not yet replaced its version-history responsibility. Do not require its premature deletion in this batch.

## Review the following contracts

### 1. One trusted refresh door

- `useCastingPackageRefresh` must be the only Studio owner of `generation.refreshSlots.useMutation`.
- Both ViewTabs and the temporary details dialog must call that shared hook instead of duplicating mutation/accounting logic.
- Each deliberate click must create one fresh `clientRequestId` and one local operation adapter.
- The server route must remain authoritative: it re-plans under its model operation lock before credits or Gemini.
- No `useEffect`, query settlement, render transition, or opening the dialog may automatically call `refreshAngles`.

### 2. Durable progress and session safety

- Refreshing angles must remain the union of durable server projection and the current local mutation, with duplicates removed.
- A refreshed asset may update the open Studio only when the current model id still matches the mutation's model id.
- The client must retain the real returned asset ids.
- The identity-warning banner may clear only after fresh package truth proves every slot is healthy and no durable/local refresh remains.
- Success, partial failure, ordinary failure, cache invalidation failure, and a model switch during settlement must not create false success, stale UI, double toast, or cross-session writes.

### 3. Six truthful strip states

Verify each canonical view renders exactly one honest state:

- current: ordinary selectable image, no repair chrome;
- stale and refreshable: dimmed image plus a direct refresh icon/price;
- stale but structurally refused (headshot/pinned/etc.): no paid action that will only reject; Details remains reachable where necessary;
- refreshing with an existing image: spinner, dimmed image, no refresh action;
- refreshing/generating without an image: named generating tile;
- failed and refreshable: Retry with price, plus accessible hover/ARIA text containing the failure reason and truthful refund outcome;
- missing: Add with the server-planned tier cost.

Confirm there are no nested buttons, inaccessible icon-only controls, stale-dot residue, misleading singular-generation promises, or a permanent “Package health” footer on healthy cards.

### 4. Missing-view tier routing

The existing mint/add-views engine is the only missing-view generation door. Verify:

- `frontClose` maps to draft (defensive/unreachable in a visible strip);
- `sideClose`, `threeQuarter`, and `frontFull` map to Core;
- `sideFull` and `backFull` map to Production;
- the displayed price comes from `mintPackagePlan.tiers[tier].cost`, not a client literal;
- the strip dispatches the tier in the event detail;
- both `CastingTakeover` and `/studio` validate/read that tier, store it, and pass it to `CastModelModal`;
- `CastModelModal` opens on the requested tier without repeatedly resetting a user's later manual selection;
- normal mint doors still default to Core;
- clicking a Production ghost cannot silently open Core when Core is incomplete;
- upgrade auto-selection still behaves correctly when Core is already complete.

### 5. Refresh-all truth

- Only slots that are stale/failed, server-plan refreshable, and not already refreshing enter the aggregate.
- The total equals the sum of those exact server-plan rows.
- One slot does not create a redundant Refresh-all control.
- Duplicate angles cannot enter the request.
- While the mutation is pending, repeat actions cannot start a second request from the same visible surface.

### 6. Temporary Details/history surface

- Healthy packages with no history should have no footer clutter.
- Details should appear only when there is actual version history or a non-directly-actionable pinned stale state.
- Existing pin/restore behavior, Escape ownership, mint-integrity routing, and version compatibility rules must remain unchanged.
- The shared-hook extraction must not break restore's immediate current-asset update or pin invalidation.

### 7. Scope and regressions

- No server billing, identity, generation, archive, pin, or restore semantics may have changed.
- No automatic spending was introduced.
- No Wardrobe behavior changed.
- The staged set must contain only the bounded R7-4A implementation/tests.
- `.agents/`, `.claude/settings.local.json`, `.codex/`, `CLAUDE.local.md`, brand files, this prompt, prior `CLAUDE_*` handoff files, and other local-only files must remain unstaged.

## Verification evidence to independently confirm

- `pnpm check` — clean.
- Focused suites: 39/39 before the final accessibility/refund-text adjustment; rerun the current staged focused suites yourself.
- Full unit suite: 2,453 passed / 85 environment-dependent skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --cached --check` — must be clean.

Do not accept source-string tests as proof of runtime behavior where the surrounding code contradicts them. Trace the real click → plan → mutation → operation adapter → server execute → settlement path.

Return exactly one verdict:

- `APPROVE — safe to commit R7-4A locally`
- or `REQUEST CHANGES` with concrete reachable blockers, file/line evidence, and the smallest sound correction.

List non-blocking R7-4B observations separately; do not expand this batch merely for polish.
