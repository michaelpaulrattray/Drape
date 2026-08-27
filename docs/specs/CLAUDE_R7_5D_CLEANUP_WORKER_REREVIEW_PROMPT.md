# R7-5D blocker-only re-review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Re-review the currently staged R7-5D diff read-only, focusing on the two blockers from your first review and the small repair-evidence hardening made alongside them.

Baseline remains `36930ad`. Do not edit, stage, commit, push, deploy, contact production, or access/list/delete real R2 objects. Do not rerun the disposable database driver; inspect its guards and the test evidence instead.

## Blocker 1 — account rows and queued storage must agree

Verify:

1. `deleteUserAccount` now deletes the user's complete Canvas tree in the same transaction as manifest creation: `board_edges`, `board_item_versions`, `board_items`, then `boards`.
2. It deletes `wardrobe_looks`, `wardrobe_sessions`, `wardrobe_outfits`, and `wardrobe_garments` in dependency-safe order inside that same transaction.
3. The collector and transaction now tell the same truth: an owned Wardrobe/Canvas key is queued only while its source row is being erased atomically; potentially shared inputs and URL-only Canvas references remain excluded.
4. `DeletionResult.deletedCounts` reports all eight added row classes honestly, including the database-unavailable and rollback shapes.
5. The new real-MySQL regression creates an owned user/model/Wardrobe/Canvas tree, calls the actual `deleteUserAccount`, proves every source row is gone, proves the exact seven owned keys are in the manifest, and proves the shared session input is absent.

Recorded disposable result: **7/7 passed**, fake storage only; scratch database `drape_r7_5d_disposable_1784675643793_ae4fcb` was dropped in `finally`.

## Blocker 2 — no sensitive deletion logging

Verify:

1. `storageDelete` failure logging contains only `errorCode`, `retryable`, and HTTP status classification.
2. It does not log the storage key, URL, raw provider message/error text, prompt, or credentials.
3. The exact key remains available only in the authorized durable cleanup row until success/repair.
4. Existing callers still inspect the structured deletion result correctly.

## Small non-blocking hardening absorbed

Verify these do not create a new blocker:

- Explicit support requeue resets `attempts` to zero so a repaired key receives a fresh bounded retry budget.
- Requeue retains `lastErrorCode` until real success deletes the item row; batch `failedCount` becomes zero because the item is pending again, preserving status/count consistency.
- Cleanup health counts only an expired lease with a non-null lease token as stale; a normal retry waiting until `nextAttemptAt` no longer generates false stale-lease warnings.

## Current verification

- `pnpm check` — clean.
- Focused local tests — 8/8 passed.
- Disposable MySQL/fake-storage suite — 7/7 passed.
- Full unit suite — 2,487 passed / 112 environment-dependent skipped / 0 failed.
- `pnpm build` — passed.
- Standalone strict script typecheck — clean.
- `git diff --cached --check` must be clean after correction staging.

Challenge the correction rather than assuming the test proves it. Check deletion order, empty-list guards, transaction atomicity, manifest/source-row agreement, count shapes, log arguments and string interpolation, and repair-state consistency.

Return exactly one verdict:

- `APPROVE — safe to commit R7-5D locally`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound correction.

List non-blocking observations separately. Approval remains local-commit scoped only.
