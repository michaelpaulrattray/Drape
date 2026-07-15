# Casting-system audit — stabilization wrap state

**Written:** 2026-07-15, by the interrupted implementation terminal, per the bounded stabilization prompt and `CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md` §5 "Wrap — stabilization only".
**This note states the actual post-wrap truth. New work should trust it and the live diff over any historical paragraph.**

## Branch and HEAD

- Branch: `main`
- HEAD: `060880d` — "docs: CASTING_SYSTEM_AUDIT — full state-machine map, 15 divergences classified, repair sequence (report for ratification)"
- The wrap changes are **uncommitted working-tree changes on top of that HEAD**. No commit, push, merge, migration, or deployment was made by this session (see Confirmations).

## Worktree inventory at wrap

**The casting batch (uncommitted, this session's scope):**

| File | State |
|---|---|
| `client/src/features/casting/hooks/useCastingGeneration.ts` | modified |
| `client/src/features/casting/components/ImageViewer/RefinePanel.tsx` | modified |
| `client/src/features/casting/ImageViewerPanel.tsx` | modified |
| `client/src/features/casting/components/ImageViewer/ViewTabs.tsx` | modified |
| `client/src/features/casting/stores/useCastingUIStore.ts` | modified |
| `client/src/features/casting/hooks/useCastingExport.ts` | modified |
| `client/src/features/studio/components/CastingWorkspace.tsx` | modified |
| `client/src/features/studio/hooks/useResumeDraft.ts` | modified |
| `client/src/features/studio/hooks/useSessionPersistence.ts` | modified |
| `server/casting/pdfService.ts` | modified |
| `server/routes/generation/castingExport.ts` | modified |

**NOT part of the batch — user-owned, untouched by this session:** `CLAUDE.md` (modified), `.claude/agents/advisor.md` (modified), `.agents/`, `.codex/`, `AGENTS.md` (untracked), `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md` (untracked — the revised plan; read-only input to this wrap). Plus this file once written.

`shared/modelStatus.ts` (the partial Batch B helper) **no longer exists** — deleted in this wrap, see Deferred.

## What was COMPLETED (kept in the diff, coherent and green)

- **V3 — three-quarter export/PDF, end-to-end:** ZIP `viewFileMap` covers all six canonical slots (`02_Three_Quarter_Head.png`; downstream files renumbered), client `viewTypeMap` + `pdfImages` carry `threeQuarter`, the `generatePdf` zod input accepts it, `PdfModelData.images.threeQuarter` typed, and `pdfService` lays it out (`THREE-QUARTER PORTRAIT`, after the headshot).
- **V2 — stage-lock plumbing fully deleted:** constant-false `isViewLocked`/`hasDownstreamDependencies` and their threading (hook return → CastingWorkspace → ImageViewerPanel → RefinePanel), the unreachable "View locked / Unlock" branch, the "Locked source" pill, and `unlockMode`/`setUnlockMode` in `useCastingUIStore` (incl. `resetUI`). Completes D-46 R7 log item 4 at the UI layer. Also fixed the impossible narrowed comparison this exposed in `ImageViewerPanel`'s status-overlay (TS2367).
- **V3 (labels) —** `VIEW_DISPLAY_NAMES` 3-key map replaced by `VIEW_ANGLE_LABELS` from `shared/boardTypes` (raw ids no longer shown for ¾/walk/back in the viewer status line).
- **V4 — `hasAllViews` is the canonical six** (`CANONICAL_VIEW_ANGLES.every(...)`) in `CastingWorkspace`, `useResumeDraft`, `useSessionPersistence` (era-0 trio derivation removed). Note: this flag is currently written to canvas state but read nowhere — the change is correctness hygiene, not behavior.
- **V15 — observer unification:** `ViewTabs` packageState `staleTime` aligned to the board's 15s, and the environment-only active-view stale suppression removed (the ledger already guarantees a just-edited view isn't stale; a stale view you switch to now says so).
- **Wrap honesty fix (capability-neutral):** the restored iterate gate now states a reason for EVERY gated view — the round-4 "¾ box won't accept typing" silent-disable cannot recur; ¾/Walk get the same refusal-card treatment sideClose always had. Copy says "cannot be edited directly **yet**" — it is a stabilization gate, not law.

## What was RESTORED (deliberately, per the wrap ruling)

- **V1 — the per-view iteration/tool allowlist is BACK** (`useCastingGeneration`: `['frontClose','frontFull','backFull']`; surgical tool follows it; eraser remains ungated, faithful to prior effective behavior). Rationale (from the stabilization prompt + revised addendum): lifting the gate alone exposed unsafe behavior — the server iterate path frames every non-`frontClose` view as `FULL_BODY` (V14, `castingRefinement.ts:133`), and masked tools broadened without the unified classifier boundary. **The real V1+V14 fix (per-view framing + one masked-edit boundary) is explicitly deferred to the revised plan; the allowlist dies there, not here.** Code comments at the gate say exactly this.

## What was DEFERRED / REMOVED

- **Batch B (V10 status unification):** `shared/modelStatus.ts` deleted; `isMintedStatus` imports reverted to the original `model.status === 'active'` literals in `useResumeDraft` / `useSessionPersistence`. No half-adopted status abstraction remains in the worktree.
- **Untouched entirely (never started in this terminal):** V8 (stale-count honesty), V9 (placed-draft name door), R-A (identity document / masterPrompt scoping), R-B (divergence-loop voice), Batch 0 (authority/security), canon architecture, any schema work or migration. `CastModelModal.tsx`, `useSheetController.ts`, `CastNode.tsx`, `castingRefinement.ts`, `editClassifier.ts`, `refreshSlots.ts`, `mintPackage.ts` (beyond nothing), `boardOps.ts` carry **no changes** from this session.

## Validation (exact commands and results, run at wrap)

| Command | Result |
|---|---|
| `pnpm check` | **PASS** — clean, zero errors (the seven handoff-era errors are resolved) |
| `npx vitest run server/casting` | **PASS** — 16 files / 228 tests passed; 1 file / 9 tests skipped (parser gold suite, opt-in by design) |
| `pnpm test` (full unit suite) | **PASS** — 89 files / 1,624 tests passed, 0 failures; 6 files / 50 tests skipped (env-dependent: TEST_DATABASE_URL, Slack, gold suite — the documented out-of-box skips) |

Unrelated pre-existing issues: the account-export test timeout mentioned in the revised addendum's handoff paragraph **did not reproduce** in this run; no unrelated failures observed. Error-looking log lines in test output (Stripe signature, Klaviyo key, health-monitor DB) are expected fixture noise from passing tests.

Not run (out of wrap scope): `pnpm test:integration`, `scripts/verify-canvas.mts` (needs a dev server; no behavior this wrap introduces is drive-asserted yet — the stabilization gate reproduces pre-batch behavior plus honest copy).

## Remaining blockers / cautions for the next terminal

1. The worktree is **uncommitted**. First action in the fresh terminal is a human decision: commit this wrap state as the stabilization baseline (recommended, so the next batch diffs cleanly) or keep working tree-dirty. Nothing here is entangled with the user-owned files — `git add` the 11 batch files + this note explicitly; do NOT blanket-add (`CLAUDE.md`, `.claude/agents/advisor.md`, `.agents/`, `.codex/`, `AGENTS.md` are user-owned; the revised addendum is the founder's plan document).
2. The stabilization allowlist means side/¾/walk still cannot be edited — now with honest copy. This is known, ruled, and temporary (V1+V14 in the revised plan).
3. `verify-canvas.mts` drive legs for the eventual repairs (per-view iterate parity, SD13 name-door, count parity) do not exist yet — they belong to the batches that build those behaviors.
4. Line-ending warnings (LF→CRLF) on several files are environmental noise, not changes.

## Confirmations

- **No commit** was made (working tree changes only; HEAD unchanged at `060880d`).
- **No push, no merge, no branch change** (still `main`; `local-migration` untouched).
- **No migration** was generated or run; no schema files touched.
- **No deployment** and no production contact of any kind.

## Recommended next action (fresh terminal)

Per `CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md` §5: read this note + the live diff, commit the wrap baseline (batch files + this note only), then produce the **conflict report and concrete Batch 0/A/B plan** for founder ratification before changing code — Batch 0 (status-transition authority + security closure) is the first implementation candidate, with V9 explicitly coupled to Batch 0's mint-route closure and V8 as the honesty patch. No canon/propagation implementation until its design gates are ratified.
