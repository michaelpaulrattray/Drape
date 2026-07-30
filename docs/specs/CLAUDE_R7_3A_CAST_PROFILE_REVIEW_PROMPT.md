# Fable review — R7-3A minted Cast Profile

Perform a read-only review of the currently staged R7-3A Cast Profile diff against the codebase and the ratified R7 plan.

Baseline: `4940766` on `main`.

Review only. Do not edit, stage, commit, push, deploy, migrate, start a dev server, or contact production. Challenge the implementation rather than assuming the executor's claims are correct. Inspect the full staged diff and the surrounding production code needed to verify reachability.

## Product contract

A minted cast is a locked identity, not an editable draft. Opening one from Canvas or the Model Library must keep the user in the same visual Casting room, but switch to a dedicated Profile posture:

- the portrait and live six-view strip remain central;
- the left casting form is absent;
- the refinement composer and reference-image editing are absent;
- the right side is a dedicated read-only Cast Profile with identity metadata, saved spec, package truth, versions, and clear actions;
- display-name metadata remains editable without changing identity;
- changing identity is only possible through an explicit, confirmed Fork that creates a separate draft and leaves the minted source unchanged;
- adding missing views is explicit, server-priced, and never automatic;
- export remains owned by the Model Library;
- Package Health remains temporarily available as the detailed versions/package surface until the later strip simplification batch.

The design should be restrained, editorial, monochrome, and simpler than the old editor. It must not add another confusing authoring surface.

## Staged scope

Exactly these 12 files should be staged:

1. `client/src/features/boards/BoardPage.tsx`
2. `client/src/features/casting/ImageViewerPanel.tsx`
3. `client/src/features/casting/castingAuthoringMode.ts`
4. `client/src/features/casting/components/CastProfilePanel.tsx`
5. `client/src/features/casting/components/ImageViewer/ViewTabs.tsx`
6. `client/src/features/lobby/ModelCardChooser.tsx`
7. `client/src/features/studio/components/CastingWorkspace.tsx`
8. `client/src/features/studio/takeover/CastingTakeover.tsx`
9. `client/src/features/studio/takeover/IdentityChangeDialog.tsx`
10. `client/src/pages/DrapeStudio.tsx`
11. `server/r7-cast-profile.test.ts`
12. `server/r7-casting-authoring-modes.test.ts`

Protected/local files must remain unstaged, including `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, `FABLE_R7_CASTING_STUDIO_UX_REVIEW.md`, `docs/BRAND.md`, `docs/brand/`, and all `docs/specs/CLAUDE_*` handoff/review prompts.

## Verification checklist

Verify each point against reachable code, not just source-string tests.

1. Both minted entry paths use Profile posture:
   - a minted Canvas placement opened through `CastingTakeover`;
   - a minted model opened from the lobby at `/studio?tool=casting&modelId=...`.
2. Minted sessions never render `ControlPanel`, the draft refinement composer, mask tools, reference upload, or another visual identity writer.
3. Draft creation, draft refinement, and the explicit draft “Change identity” ceremony remain unchanged.
4. `CastProfilePanel` is read-only for visual identity. Its only model mutation is the strict `models.update({ modelId, name })` display-name path; no status or identity field can ride it.
5. Rename invalidation reaches the model, library, and linked Canvas placements, while an invalidation failure cannot falsely report that the server rename failed.
6. Identity/spec content comes from the hydrated server-backed model state and correctly represents Open/resolved fields without inventing editable selectors.
7. Package counts and issue/missing truth come from the existing package authority. The complete-card price comes from `generation.mintPackagePlan`, not a client constant.
8. Completing missing views is user-initiated and cannot charge automatically. Check both hosts dispatch and receive the correct upgrade event and that a minted standalone Profile cannot accidentally open the draft mint path.
9. The Canvas Profile fork uses the existing trusted `boardOps.applyModelEdit` operation with `intent: 'rerun'`, a fresh request id, the existing confirmation dialog, durable charging/refund handling, and placement beside/linkage to the source. The original minted model must remain unchanged.
10. An empty `changes` object with `intent: 'rerun'` is accepted by the real server schema and executor. Confirm this from server code/tests rather than assuming the client type proves it.
11. The standalone Profile does not pretend it can fork without a Canvas placement. Its “Fork from Canvas” route must be truthful and non-spending; flag if it creates a dead end or loses the selected model in a way that violates the plan.
12. The viewer's locked bar cannot expose keyboard shortcuts or hidden refinement routes because `isReadOnly` and `allowIdentityGeneration` are applied consistently.
13. The live view strip still shows all current/stale/refreshing/failed/missing states. Missing-view clicks choose upgrade for minted models in both hosts and mint for drafts.
14. Versions/package details remain reachable. Export routes to the Model Library and no export or upscale generation is reintroduced here.
15. Mobile uses the Profile, not `MasterPromptPanel`, and its close behavior does not close the entire Studio unexpectedly.
16. Escape/dialog ownership remains correct when the fork confirmation or package modal is open; one Escape must not close multiple layers.
17. No automatic generation, retry, charge, fork, refresh, or view creation was added.
18. No auth, billing, ledger, migration, Wardrobe, or unrelated Canvas behavior changed.
19. The new tests meaningfully pin behavior and routing. Call out source-string-only assertions that hide a reachable defect, but do not reject solely for test style if production behavior is sound.
20. Review the UI copy for sex/gender assumptions, false promises, misleading prices, locked/editable contradictions, and first-time-user clarity.

## Executor verification already run

- `pnpm check` — clean
- focused Profile/authoring/regression suites — 109/109 passed
- full unit suite — 2,438 passed / 84 documented environment-dependent skips / 0 failures
- `pnpm build` — passed
- `git diff --cached --check` — clean

Independently rerun the checks you consider necessary.

## Return exactly one verdict

- `APPROVE — safe to commit R7-3A locally`

or

- `REQUEST CHANGES` with each concrete, reachable blocker, its evidence, the failure scenario, and the smallest sound correction.

List non-blocking observations separately. Do not expand this batch into later R7 strip redesign or general visual polish unless a current reachable defect requires it.
