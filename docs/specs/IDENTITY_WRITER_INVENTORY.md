# Identity-writer inventory — Batch 0 deliverable (R6 execution plan §Batch 0.7)

**Date:** 2026-07-15, revised after the founder's Batch 0 review round (fixes 1–8) AND the final-items round (mint-transition invariant, archived-placement degradation, deletion ruling, UI drive). Input to Batch C's shared guard and the FR-1 policy report. Every writer of model identity (`masterPrompt` / `technicalSchema` / `preferences`), model `status`, model `name`, and asset selection, with its guard state AFTER both rounds. Claims below are backed by `server/batch0-authority.test.ts` (48 behavioral tests), `scripts/drive-batch0-authority.mts` (E6–E10, 15 raw-tRPC legs), and `scripts/drive-batch0-ui.mts` (UI1–UI2, browser) unless marked otherwise.

## A. Identity-document writers (`masterPrompt` / `technicalSchema` / `preferences`)

| # | Writer | Path | Guards after Batch 0 (review round) | Batch C relevance |
|---|---|---|---|---|
| A1 | `generation.iterate` | `server/routes/generation/castingRefinement.ts` | owner · **maskBase64 refused before model load or money (tested)** · archived refused (tested) · A1 seal: identity-classified refused on non-drafts (classifier, fail-open) · stale-writer on draft identity edits | THE central writer. V5 freeze-and-append still fires on every allowed iterate — Batch C item 2 scopes it. Fail-open classifier inverts to fail-closed per FR-1. |
| A2 | `generation.reconcile` | same file | owner · archived → NOT_FOUND (tested) · **drafts only (tested)** · **strict input: takes `{ modelId, assetId }`, legacy `imageUrl` REJECTED (tested)** · asset must belong to the caller's model (tested) · stored URL passes `validateProxyUrl` before the only fetch (tested) · **document write result checked — db failure is an error, never success (tested)** | Reconciles against the asset that actually changed (semantic preserved). Still classifier-free on drafts — Batch C decides whether draft reconcile joins the boundary. |
| A3 | `generation.compactPrompt` | same file | owner · archived refused · **drafts only (tested)** · **write result checked** | V17 compaction bomb — Batch C's no-schema marks interim guards mark language. |
| A4 | `boardOps.applyModelEdit` (update branch) | `server/lib/boardOps.ts` | owner · archived refused · D-43 structural: update refused unless `status==='draft'` | Drafts only; joins the shared guard in Batch C. |
| A5 | Model creation (3 sites) | `routes/models.ts create` · `lib/boardOps.ts` runGeneration · `generateCastCandidate` | owner-scoped inserts, always `status:'draft'` | Initializers, not editors. |

## B. Status writers and money-adjacent asset writers (the mint state machine)

| # | Writer | Path | Guards after Batch 0 (review round) |
|---|---|---|---|
| B1 | `executeMintPackage` (mint branch) | `server/casting/mintPackage.ts` | **MINT-TRANSITION INVARIANT (final round, tested):** a mint request (`mint !== false`) fails CLOSED unless the model is a CLEAN draft (`status==='draft'`, no `agencyId`, no `mintedAt`) — before assets are read, costs computed, credits deducted, or anything generates. Active/locked models and inconsistent draft rows cannot deduct, generate, rename, or reach `mintModel` (tested per state). **Upgrades are `mint:false` requests** (client sends the flag; adding views to a minted model never touches name or status; nicknames apply to drafts only; `minted` reported honestly). Plus: router name guard + internal name guard before spend · name trimmed at boundary · required name write checked — failure aborts before `mintModel` · archived refused · **the ONLY draft→active path**. **`mintModel` is NOT concurrency-atomic** (`db/models.ts:135-152`): one UPDATE sets `status`+`agencyId`+`mintedAt` together (the fields can never be observed split), but the already-minted check is a separate prior SELECT with no compare-and-swap — **simultaneous mint submissions are not protected**: two concurrent requests can both pass the clean-draft check, both generate and charge, and race competing agency ids (last write wins). Not redesigned in Batch 0; **duplicate-submission protection, operation ids with database uniqueness, and compare-and-swap minting are carried into the existing concurrency/idempotency design gate (revised addendum §7, Batch D-design) as a PRE-LAUNCH item.** Stays-draft nickname write is best-effort by design — failure logged, never silent. |
| B2 | `generation.castingImage` | `routes/generation/castingImaging.ts` | **REORDERED (review fix 1):** model load → owner → archived → **draft-only** BEFORE quota and deduction. Previously deducted first and threw outside the refund path (silent credit loss) with NO status check — a raw caller could newest-wins swap a MINTED headshot. Now: foreign/archived/minted/locked callers cannot deduct credits, reach Gemini, or create an asset (all four tested). |
| B3 | ~~`generation.mint` (legacy)~~ | ~~`castingExport.ts`~~ | **REMOVED (tested: procedure absent).** Was: nameless mint, random agencyId, fired implicitly by both export flows. |
| B4 | ~~`models.update` status~~ | ~~`routes/models.ts`~~ | **REMOVED + STRICT (tested):** input is `{ modelId, name }` `.strict()` — a supplied `status` (alone or alongside `name`) is REJECTED, never silently stripped. Name required; write result checked. |
| B5 | `models.delete` | `routes/models.ts` → `db/models.ts deleteModel` | **CURRENT CODE REMAINS DRAFTS-ONLY (tested):** minted/locked → PRECONDITION_FAILED; archived → NOT_FOUND; foreign → FORBIDDEN. Drafts hard-delete model/Wardrobe/assets SQL rows but leave Canvas, generation and R2 residue. **D-64 supersedes the earlier archive plan for R7-5:** the implemented successor will accept draft and minted Casts, permanently remove direct Cast placements/views (never `Source unavailable`), preserve independent downstream outputs, scrub identity content into a non-recoverable replay/accounting tombstone, and queue verified owned-object deletion. It must also fence `wardrobe.sessions.create`, `wardrobe.looks.save`, rename, and every other model-linked writer at the durable write so a racing request cannot repopulate the tombstone. None of that future behavior is claimed as implemented yet. |

No writer sets `locked` or `archived` anywhere after Batch 0 (schema values remain; prod rows audited read-only by `scripts/audit-model-status.ts`).

## C. Name writers

| # | Writer | Behavior after Batch 0 |
|---|---|---|
| C1 | `models.update` | Name-only, strict, trimmed 1–128, archived → NOT_FOUND, write-checked. Minted rename ALLOWED per FR-3(B) — display metadata, `agencyId` is the identity key (tested). |
| C2 | `executeMintPackage` | Stays-draft: optional nickname, best-effort, logged on failure. Mint: name required (two guards), trimmed, write-checked, abort-before-mint (tested). |

## D. Asset-selection / ledger writers

| # | Writer | Guards after Batch 0 |
|---|---|---|
| D1 | `createModelAsset` callers: casting generate (now draft-only), iterate, `mintPackage` slots (+failed markers), `refreshSlots`, `restoreSlotVersion`, `applyModelEdit`, `generateCastCandidate` | All owner-scoped; archived refused at every entry; failed-marker inserts and failed generation-record updates log on failure (D-46 R7 log item 1 closed) |
| D2 | `markModelAssetsStale` (the stale-writer) | Fires only on draft + identity-classified iterate; pinned exempt |
| D3 | `setModelAssetPinned` / `restoreSlotVersion` | owner · archived refused; restore is copy-forward, free |

## E. Read surfaces (leak check, after the review round)

- `getUserModels` excludes archived at the query (library list, picker `listCastableModels`, lobby feeds).
- `models.get`, `packageState`, `slotVersions`, `refreshSlotsPlan/execute`, `mintPackagePlan/execute`, `fillFromLibrary`, `applyModelEdit`, variations, pop-out: archived → NOT_FOUND (`assertNotArchived`, `server/casting/modelGuards.ts`, logged).
- **Current compatibility behavior for pre-R7-5 archived sources:** `boards.getItems` still stamps `sourceArchived: true` and CastNode renders **"Source unavailable"**. D-64 retires that outcome for deliberate deletion: R7-5 must remove direct Cast placements in the deletion transaction, so newly deleted Casts never leave this card. The compatibility renderer remains until historical archived rows are audited; deploying R7-5 does not silently purge them.
- `generatePdf` (review fix 6, tested): archived → NOT_FOUND first; then requires legal minted status (`active` or legacy `locked`) AND `agencyId` — a draft with a stray `agencyId` is refused. Export never mints (FR-2A).
- Public `registry.lookup/verify`: already minted-only — no change needed.
- **Known residue (Batch A-safe, logged, NOT fixed in Batch 0):** `useExportPack.ts` still filters exports to the era-0 trio maps (V3's last copy — silently drops ¾/walk/back from the export-verb packs). Storage-URL-less marker rows still ride raw `models.get` payloads (D-46 R7 log item 3).

## F. Masked-edit surfaces (Batch 0.1 closure — both layers)

- Server: `generation.iterate` refuses `maskBase64` before model load, quota, or deduction (tested + drive E10 proves the balance untouched).
- Casting environment: surgical + eraser tool buttons removed from `ImageViewerPanel`; no call site can arm the tool state; `resetUI` clears `activeTool` between sessions. **Browser-verified (drive UI2): the open environment contains zero surgical/eraser controls while the typed refine bar survives.**
- Board: `ModelEditorOverlay.tsx` and its `useBoardIteration.ts` bridge (the only board masked-edit surface — already orphaned, zero importers) are **DELETED** (file absence tested); the board's remaining double-click surface (`CanvasImageViewer`) is view-only by ruling (D-52).
- Re-enablement is gated on the unified classifier/identity-writer boundary (post-FR-1 policy).

## G. Wardrobe / VTO / admin sweep

- Grep-verified: no `updateModel` / `mintModel` / `update(models)` caller exists outside `routes/models.ts` and `routes/generation/castingRefinement.ts` plus the casting/lib modules listed above. Wardrobe writes its own tables only; admin routers touch user/credit/moderation surfaces only.
