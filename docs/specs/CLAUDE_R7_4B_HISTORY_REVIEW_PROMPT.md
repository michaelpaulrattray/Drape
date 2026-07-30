# Fable review — R7-4B shared Cast view history

Review the **currently staged R7-4B diff** read-only against the codebase and the ratified R7 plan. Do not edit files, stage, commit, push, deploy, run paid generation, or contact production.

Baseline: `f3dc310` (`R7 Casting UX: strip-first package care`).

## Product intent

This batch replaces the duplicated and confusing Cast-version interactions with one calm, shared component used in both Canvas and Casting Studio.

The user must understand three truths without being taught internal revision language:

- **In use** — the current image for this view.
- **Earlier** — a compatible earlier image that may be reused.
- **Earlier identity** — retained for reference but unavailable because it belongs to a different cast identity revision.

Choosing an earlier compatible image is **copy-forward reuse**, not identity rollback. It remains free, appends a new current copy, and keeps history. True whole-cast rollback is still deferred to the R7-6 snapshot design.

The user-facing “Package Health” concept is intentionally removed. The strip is the primary routine surface. A quieter **Versions & details** dialog remains temporarily for rare integrity, pin, history, and package-summary exits until their later planned redesign/removal.

## Verify every contract

### 1. One shared Cast history interaction

- `SlotVersionHistory.tsx` is used by both Canvas `CastNode` and Studio `CastingDetailsDialog`.
- There is only one Cast-history client mutation owner for `generation.restoreSlotVersion`.
- `useSheetController` and the former dialog implementation no longer contain duplicate restore/query logic.
- The generic non-Cast `VersionHistoryModal` remains intentionally separate; this batch must not change ordinary image-node history.

### 2. Server authority is preserved

- The client never invents revision compatibility.
- It consumes the server-owned `revisionCompatible` and `isHead` fields from `generation.slotVersions`.
- An earlier-identity asset is disabled and cannot reach the restore mutation.
- The server route remains the final authority even if a client is tampered with.

### 3. The interaction is deliberately two-step

- Clicking a compatible thumbnail only selects it.
- The user must explicitly press **Use this version** before any mutation runs.
- The current version is visibly marked **In use** and cannot be restored into itself.
- Incompatible rows are visibly marked **Earlier identity**, remain viewable, and cannot be selected.
- Copy never calls this rollback/revert or suggests the entire identity is being rewound.

### 4. Successful reuse updates truth cleanly

- The open Studio asset is updated only when its `currentModelId` still matches the mutation result.
- The package-state cache updates the returned angle/url/version and clears stale/pinned for that slot.
- Slot versions, package state, refresh plan, and mint plan are invalidated after settlement.
- No unrelated model/session can be rewritten by a late response.
- Refusals show the server’s honest message.

### 5. Details migration and Escape ownership

- No live client surface still says “Package Health” or uses the old `casting-open-package-health` event.
- The new event is `casting-open-details`; the dialog title is **Versions & details**.
- The shared store uses `detailsOpen`, and takeover Escape defers while the dialog owns Escape.
- Dialog open/close/unmount paths cannot leave `detailsOpen` stuck true.
- Profile, Studio, takeover, and modal hosts all route to the new Details surface consistently.

### 6. Cross-surface refresh race is closed

- `useCastingRefreshStore` now carries a shared local per-model/per-angle pending projection in addition to durable server truth.
- Strip and Details hook instances see the same local pending state, so a second click cannot reopen during the pre-poll settlement window.
- Begin/end operations preserve other pending angles for the same model and other models.
- Local pending state is cleared on every settle/failure path.
- The identity warning clears only after a fresh package fetch proves all slots healthy and there is no other local or durable refresh work.
- This is UI coordination only: the server model lock and operation receipts remain authoritative.

### 7. Failed-view copy is honest

- A failed view says **Retry** only when the shared server plan permits a retry.
- If the plan refuses it (for example a defensive pinned/failed state), it says **Needs attention**, does not display a retry price, and cannot invoke refresh.
- Refund wording continues to derive from recorded ledger truth.

### 8. Boundaries remain intact

- No automatic refresh, restore, generation, or credit spend was added.
- Pin behavior is not removed in this batch; pin retirement remains coupled to the R7-6 selection contract.
- No mint, identity-edit, refund, Wardrobe, billing, or durable-operation semantics changed.
- No migration is required.
- Protected/local files and this review prompt must remain unstaged.

## Expected staged files

Exactly these 17 implementation/test files should be staged:

1. `client/src/features/boards/canvas/nodes/CastNode.tsx`
2. `client/src/features/boards/canvas/nodes/useSheetController.ts`
3. `client/src/features/casting/components/CastProfilePanel.tsx`
4. `client/src/features/casting/components/ImageViewer/LoadingOverlay.tsx`
5. `client/src/features/casting/components/ImageViewer/ViewTabs.tsx`
6. `client/src/features/casting/components/PackageHealthDialog.tsx`
7. `client/src/features/casting/components/SlotVersionHistory.tsx`
8. `client/src/features/casting/hooks/useCastingPackageRefresh.ts`
9. `client/src/features/casting/stores/useCastingRefreshStore.ts`
10. `client/src/features/studio/components/CastModelModal.tsx`
11. `client/src/features/studio/components/CastingWorkspace.tsx`
12. `client/src/features/studio/takeover/CastingTakeover.tsx`
13. `client/src/pages/DrapeStudio.tsx`
14. `server/r7-casting-authoring-modes.test.ts`
15. `server/r7-slot-version-history.test.ts`
16. `server/w3-package-health.test.ts`
17. `server/w6-thumbnail-restore.test.ts`

## Executor verification evidence

- `pnpm check` — clean.
- Focused review suites — 34/34 passed.
- Full unit suite — 147 files passed / 8 env-dependent skipped; 2,460 tests passed / 85 skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean before staging; re-check the staged diff yourself.
- No local dev/verifier process was left running.

Do not trust this summary. Inspect the staged code and surrounding production paths, challenge reachable races and misleading copy, and rerun safe read-only checks if useful.

Return exactly one verdict:

- `APPROVE — safe to commit R7-4B locally`
- `REQUEST CHANGES` with a concrete reachable blocker, exact evidence, and the smallest sound correction.

List non-blocking future polish separately. Do not expand R7-4B for speculative cleanup.
