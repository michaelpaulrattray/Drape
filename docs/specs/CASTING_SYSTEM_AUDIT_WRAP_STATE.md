# Casting-system audit — stabilization wrap state

> **FINAL CLOSURE UPDATE — 2026-07-19.** This file is the historical state captured by the interrupted 2026-07-15 stabilization terminal. Its old HEAD, worktree inventory, open items, and “Recommended next action” are evidence of that checkpoint, **not current instructions**. R6 subsequently shipped Batch 0, A-safe, A-coupled, B, C, W1–W6, and the founder-tested post-live corrections. R6 closes at production baseline `e66b8db`; the complete closure record is D-61 in `DECISION_LOG.md`. R7 is founder-ratified in D-62 and `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`. Do not resume any old action from the body below.

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

1. The worktree is **uncommitted**. First action in the fresh terminal is a human decision: commit this wrap state as the stabilization baseline (recommended, so the next batch diffs cleanly) or keep working tree-dirty. Nothing here is entangled with the user-owned files — `git add` the 11 batch files + this note explicitly; do NOT blanket-add (`CLAUDE.md`, `.claude/agents/advisor.md`, `.agents/`, `.codex/`, `.claude/settings.local.json`, `AGENTS.md` are user-owned/local; the revised addendum is the founder's plan document). *(Resolved: committed as `e16fd9a` + `eb60269`.)*
2. The stabilization allowlist means side/¾/walk still cannot be edited — now with honest copy. This is known, ruled, and temporary (V1+V14 in the revised plan).
3. `verify-canvas.mts` drive legs for the eventual repairs (per-view iterate parity, SD13 name-door, count parity) do not exist yet — they belong to the batches that build those behaviors.
4. Line-ending warnings (LF→CRLF) on several files are environmental noise, not changes.

## Confirmations

- **No commit** was made (working tree changes only; HEAD unchanged at `060880d`).
- **No push, no merge, no branch change** (still `main`; `local-migration` untouched).
- **No migration** was generated or run; no schema files touched.
- **No deployment** and no production contact of any kind.

---

# BATCH 0 STATE RECORD (2026-07-15, appended post-implementation + review round)

Batch 0 of `CASTING_SYSTEM_R6_EXECUTION_PLAN.md` is implemented as **uncommitted working-tree changes** on top of commits `e16fd9a` (stabilization baseline) + `eb60269` (docs baseline). The founder's review round (findings 1–9) and the final-items round are both incorporated — including finding 9: **the drafts-only deletion ruling was made and IS IMPLEMENTED** (`models.delete` refuses minted/locked/archived/foreign, result-checked; both UI callers reconciled).

**What Batch 0 closed** (details: `IDENTITY_WRITER_INVENTORY.md`; tests: `server/batch0-authority.test.ts`, **48 behavioral** — the review round's 35 grew to 48 with the final-items matrices; drives: `scripts/drive-batch0-authority.mts` E6–E10, 15 raw-tRPC legs + `scripts/drive-batch0-ui.mts` UI1–UI2, browser):

- Masked edits disabled at both layers (server refuses `maskBase64` pre-money; casting tools removed; the orphaned board surface `ModelEditorOverlay` + `useBoardIteration` deleted).
- `models.update` is strict name-only (status rejected, not stripped); FR-3(B) minted rename allowed; write-checked. D-55 wording amended in the DECISION_LOG.
- Legacy `generation.mint` removed; export refuses unminted and routes to the mint door (FR-2A); `generatePdf` requires legal minted status (`active`/`locked`) + agencyId.
- `executeMintPackage`: internal name guard pre-spend; required name write abort-before-mint; trimmed at boundary.
- `generation.castingImage` reordered: owner/archived/draft-only checks BEFORE quota + deduction (was: deduct first, throw outside the refund path, no status check — a raw caller could newest-wins swap a minted headshot).
- Archived = deleted everywhere (`assertNotArchived` at every model-op entry; `getUserModels` query filter; `getItemModelInfo` hides archived sources while preserving the item snapshot).
- `reconcile` secured: `{ modelId, assetId }` strict (SSRF closed, legacy `imageUrl` rejected), owned-asset check, allowlist-validated server-derived URL, drafts only, write-checked. `compactPrompt`: drafts only, write-checked.
- Observability: pino warns on every refusal class; the two swallowed mintPackage `.catch(() => {})` paths now log.
- Deliverables: `IDENTITY_WRITER_INVENTORY.md`, `scripts/audit-model-status.ts` (read-only prod audit; not yet run against production).

**Final-items round (founder, 2026-07-15, all four addressed):**
1. **Mint-transition invariant:** `executeMintPackage` fails a mint request closed unless the model is a CLEAN draft (no `agencyId`, no `mintedAt`) — before assets/costs/deduction/generation. Upgrades became explicit `mint:false` requests (client + server); nicknames are drafts-only; `minted` reported honestly. Tested per state (active / locked / draft-with-agencyId / draft-with-mintedAt / upgrade path).
2. **Archived placements degrade visibly:** `getItems` stamps `sourceArchived`; the flag survives the client rebuild; the node face renders the D-12 "Source unavailable" state (browser-verified); `getItemModelInfo` distinguishes archived from unlinked; snapshot data retained; no document/ledger exposure.
3. **Deletion ruling applied (drafts-only):** `models.delete` refuses minted/locked (PRECONDITION_FAILED), archived (NOT_FOUND), foreign (FORBIDDEN); db-failure is an error; lobby card disables delete on minted casting rows with honest copy (feed carries `draft`); WardrobeStart's delete affordance removed. Cascade/R2/archive design stays R7.
4. **Verification honesty:** the promised browser-level UI drive now exists and RAN — `scripts/drive-batch0-ui.mts` (UI1 archived-node degrade, UI2 no surgical/eraser in the open environment + refine bar present), both PASS. It caught one real bug before passing: `canvasItems` rebuilt items field-by-field and dropped the `sourceArchived` flag.

**Validation (all green, 2026-07-15, final):** `pnpm check` clean · batch0-authority **48/48** · lobby + casting suites green (283 passed in the combined focused run) · full unit suite **1,672 passed / 50 env-skipped** · drive E6–E10 **15/15** · UI drive **2/2** — all against the local dev server only (free ops; no production contact; no paid generation; the E10 leg proves the credit balance untouched).

**Open items:** staging/commit of the Batch 0 diff (founder-gated); FR-1 policy report (Batch C-prep, next in sequence); R7 deletion/cascade design (incl. dangling placements from hard-deleted source rows — a deleted source does NOT render "Source unavailable" today, unlike an archived one); **PRE-LAUNCH: mint concurrency** — `mintModel` is not concurrency-atomic (read-then-write, no compare-and-swap; simultaneous mints can double-generate/charge and race agency ids) — duplicate-submission protection, operation ids, and CAS minting ride the revised addendum §7 concurrency/idempotency design gate.

## Recommended next action

*(The original wrap-era recommendation — produce the Batch 0/A/B plan for ratification — is superseded: that plan was ratified as `CASTING_SYSTEM_R6_EXECUTION_PLAN.md` and Batch 0 is implemented and verified above.)*

**Now:** stage exactly the 35 Batch 0 paths (per-path `git add`, founder-confirmed manifest) and commit locally as the Batch 0 batch. Then proceed per the execution plan's sequence: **Batch A-safe** next (V9 name door, V8 count honesty, N1 canonical-list fix, V21 naming, + the `useExportPack` trio-map residue), with the **Batch C-prep FR-1 policy report** before any Batch A-coupled implementation. Never stage `.agents/`, `.codex/`, or `.claude/settings.local.json`. No push, no production contact, no paid generation without separate authorization.
