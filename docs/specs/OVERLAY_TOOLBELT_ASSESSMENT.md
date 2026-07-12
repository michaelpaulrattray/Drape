# The image-overlay toolbelt — assessment (VC-R6a A4, expanded terms)

**Status: REPORT ONLY — founder rules.** Commissioned at VC-R6a (2026-07-12, amended same day to the full belt). Question: everything that overlays the work-area image is confirmed legacy archaeology — inventory every overlay tool + shortcut, sort each into keep / relocate / retire / rebuild, price a coherent per-view tool state, and decide whether the rebuild rides C5's refine-surface work or becomes a named post-pass item. C5 must not restyle a condemned belt.

---

## 1. The inventory (verified against code, 2026-07-12)

The belt is everything mounted over `StudioCanvas`'s image in the casting environment (`ImageViewerPanel` + `StudioCanvas` slots):

| # | Tool | Where | Backing | Disposition (recommended) |
|---|---|---|---|---|
| 1 | Undo/redo pill | `StudioCanvas` bottom-left, hover | `useCastingGenerationStore.history` (client snapshot stack) | **RETIRE — already scheduled (C4/D-53)** |
| 2 | `Z` / `⇧Z` keys | `StudioCanvas` keyboard handler | same stack as #1 | **RETIRE with #1** |
| 3 | Hold-to-compare | press the image 150ms | same stack, read-only | **KEEP** (D-53 ratified it: honest preview, no persistence pretense) |
| 4 | Refine/chat edit box | `RefinePanel`, bottom | `generation.iterate` (ledger-append since F1; classifier-sealed) | **KEEP — REBUILD RIDES C5** (already scheduled: fork-guidance inline surface, F5 rotating placeholders) |
| 5 | Surgical mask tool | `ToolButton` right rail + `MaskCanvas` | `useCastingCanvas` local paths → `generation.iterate` masked | **KEEP mechanics, RESTYLE in C5; deeper rethink post-pass** (see §3) |
| 6 | Magic eraser | same stack as #5 (different prompt path) | same | same as #5 |
| 7 | Download | `ImageActionBar` top-right | client download of current image | **KEEP as-is** (an image verb on the image) |
| 8 | Copy to clipboard | `ImageActionBar` | clipboard write | **KEEP as-is** |
| 9 | "Export identity pack" chip | `NextStepChip` bottom-right (the belt's export button — sole in-environment trigger) | opens `ExportModal` → `useCastingExport` | **RELOCATE → the `···` menu; retire the chip + `useCastingViewGeneration`** (see §2b) |
| 10 | `···` menu · Retry | `ImageActionBar` ActionMenu | `handleRetry` → re-fire last generation | **RETIRE** (see §2c) |
| 11 | `···` menu · shortcut list | same menu | static rows | **KEEP, trims itself** (rows for retired keys go) |
| 12 | `/` focus-refine, `F` toggle-ref | `castingKeyHandler` | UI focus / ref visibility | **KEEP** |
| 13 | Ref-image floater | `ImageViewerPanel` floating overlay | prefs.referenceImage | **KEEP** (restyled in C1) |

Not casting-belt: wardrobe's own VTO undo and garment overlays (pass 2, untouched by any of this).

## 2. The convictions, confirmed

**(a) The bleeding undo is ONE stack, not two.** The overlay pill, the `Z`/`⇧Z` keys, and the `···` menu's shortcut rows are three surfaces of the same `useCastingGenerationStore.history` — the A3 client stack of **full cross-view snapshots** (`buildHistoryFromAssets` synthesizes cross-view states; `handleUndo` swaps `currentAssets` wholesale). That is exactly why undo on one view rewinds others: the stack's unit is "the whole session at step N", not "this view at version N". There is no second stack. **C4's scheduled retirement kills all three surfaces at once and resolves the bleed by removal** — the per-view version history it lied about becomes real as the D-53 tile thumb-strip + `restoreSlotVersion`. Hold-to-compare survives as the stack's one honest consumer (it needs only "previous snapshot", never a write).

**(b) The export chip duplicates the chooser verb — and its host hook is the conveyor's last cell.** `NextStepChip` is the only remaining consumer of `useCastingViewGeneration` (already gutted by D-46 to an "Export-only nextStage"). A floating animated CTA is stage-navigation FORM even when its content is a verb. Recommended: **"Export identity pack" becomes a quiet `···` menu row** (`extraItems` — the slot exists), the chip and `useCastingViewGeneration` are deleted, and `StudioCanvas.nextStepOverlay` goes with them. The environment keeps the verb (you meet the model here); it stops being nudged.

**(c) Retry's home moved.** The menu Retry re-fires the last generation from a menu three levels from the failure. Failure retry already lives where the failure is named: the `FailedSlot` tile (R3b gate design, retry-then-refund) and the `error` state's Retry. Deliberate regeneration is governed flow — refresh (plan-priced) or fork (D-43) — not a menu verb. **Retire the menu Retry**; keep the inline error-banner Retry (it is the failure surface for the just-failed run).

**(d) Pre-camera, pre-architecture mechanics.** Fix 1 (this batch) corrected the coordinate space and invariant V guards it. What remains structural: brush size is hardcoded (20px client / 4% of natural width server-side — the on-screen stroke and the sent mask differ in width), stroke colors are off-language (purple/red rgba), masks are drawn against the *displayed* image element rather than an image-space model, and mask state is hook-local (dies on unmount, invisible to the session). Masks do NOT bleed across views (cleared on view switch) — the per-view story here is already sound; the debt is fidelity and form, not coherence.

## 3. The per-view-coherent model, priced

What "coherent" still needs after C4 (undo retirement) and C5 (refine rebuild) land:

| Piece | What it is | Cost |
|---|---|---|
| Belt slimming (9/10: chip→menu row, hook deletion, menu Retry out) | mostly deletion | **~0.25d — recommend riding C5** (it restyles the same corner) |
| Mask visual language (one ink-consistent mask color, stroke preview matching the server's brush width) | visual + one constant | **~0.25d — rides C5's belt restyle** |
| Mask model rebuild (image-space mask store, per-view persistence across tool/view switches, brush control, preview = payload parity) | a real design piece | **~1–1.5d — POST-PASS, named item** (no current workflow is blocked; fidelity debt, not trust debt) |

## 4. Recommendation

**C4** retires the undo stack's write surfaces as planned (pill, keys, menu rows) — conviction (a) resolves by removal. **C5** takes the belt-slimming rider (+~0.5d on its slot): export verb → `···` menu with chip + hook deleted, menu Retry removed, mask strokes brought into the language — so C5 restyles only the belt that survives. **Post-pass** gets one named item: the mask-model rebuild (§3 row 3), designed together with whatever pass 2 needs masks for (garment-region editing is the likely first real consumer).

Drive additions when C5 lands: export row present in the menu, chip absent, menu Retry absent, mask stroke color conformant.
