# Slot versions vs legacy studio undo — assessment (VC-R5 follow-up A3)

**Status: RATIFIED (founder, 2026-07-12 — D-53, combined with A1).** The §3 governance model is now law verbatim; `restoreSlotVersion` naming, unpinned-restore, the tile-popover thumb-strip, legacy-undo retirement (hold-to-compare kept), and vN unification all ratified as recommended; builds as one rider on R6's environment-restyle slot. Original question: the slot ledger (`Three-quarter · v3`, newest-wins asset rows) and the studio's in-session undo are two version systems unaware of each other — is the right model a REVERT verb on the ledger, with the legacy undo retired or scoped?

---

## 1. What the legacy undo actually controls (verified)

**It is a client-only preview toggle — it never writes, deletes, or reorders anything.**

- The affordance is Cmd+Z/⇧Z + undo/redo buttons in `StudioCanvas` (:202, :379–399), backed by `useCastingGenerationStore.{history, historyIndex, currentAssets}` — an array of full cross-view snapshots. `handleUndo` does exactly two things: move the index, swap `currentAssets` (`useCastingGeneration.ts:504–518`).
- Every iteration writes its `model_assets` row **before** undo is even possible. Undoing then closing/saving: **nothing reverts** — the newer row stays newest-wins, and on the next open `buildHistoryFromAssets` reconstructs the full stack and lands on the newest. The undo is silently forgotten. This is exactly the behavior the founder observed.
- The minted-edit save path never reads it: `unsavedDiff` is a form-preferences diff and `applyModelEdit` regenerates from attributes — the undone image state is invisible to saving.
- Related but honest: the hold-to-compare gesture (press the image → previous snapshot, labeled "Previous") uses the same client history and *is* a genuine preview affordance.

**Verdict on the archaeology:** same class as the stage-lock — a pre-package-architecture surface whose threat/promise no longer matches the system. Worse than dead code, it *performs* version control it doesn't have: the viewer's status line reads `{view} · v{historyIndex+1}`, a **different vN than the comp card's** (client stack position over synthesized cross-view snapshots vs per-angle filled-row count). Two version vocabularies on the same views.

## 2. The proposed direction, assessed: the slot ledger IS the version history

Confirmed sound. The ledger already *is* an append-only per-view version history with a single read rule (newest-wins) consumed consistently by the comp card, the composer, and the studio's own hydration. What's missing is exactly one verb.

### Revert-as-copy-forward ("Use this version")

Mechanics: a new server op — `restoreSlotVersion(modelId, angle, assetId)` — validates ownership + that `assetId` is a filled row of that angle, then **appends** a new `model_assets` row copying the old row's `storageUrl` (and resolution), with provenance `{ restoredFromAssetId, inputs: <original row's inputs>, engine: 'restore' }`. Newest-wins promotes it instantly; every existing consumer (comp card, composer, hydration, vN count) handles it with zero changes.

- **Cost to user: zero generation credits** — it's a pointer copy, no engine call. Free op (like pop-out).
- **Collisions: none at the DB layer.** Today's only asset writers are `createModelAsset` and `setModelAssetPinned` — this would be the first restore verb on assets, and it's just another append.
- **Pins:** recommend the restored row arrives **unpinned** — a pin means "this exact row accepted as final"; it marks a row, not a lineage. The popover's Pin is one click away if the restored version is the keeper. (Carrying the old row's pin forward silently would make pins ambiguous.)
- **Staleness:** a restored row carries no status → clears any stale flag by construction, identical to refresh. Composer stale-input logic unaffected.
- **D-12:** fully satisfied — `restoredFromAssetId` + copied inputs give a complete audit chain; nothing is destroyed (the interim rows remain in the ledger).
- **Naming caution:** boards already have a "revert" (`boards.revertItemVersion`) with *opposite* semantics — it mutates the item's head `imageUrl` backward over an immutable version list. Reusing "revert" for an append-new-head asset op invites confusion. Recommend UI verb **"Use this version"** and API name `restoreSlotVersion`; log a one-line R7 note that the board-side revert keeps its 3f identity-event routing and its name.

### The UI: version rows in the tile popover

The tile popover currently shows `label · vN` as static text. Proposed: tapping it (or a `History` row) expands a small horizontal thumb strip of that angle's filled rows (newest first, `buildHistoryFromAssets`-style filtering already exists) with **Use this version** on any non-head row. This reuses the popover surface D-29 sanctioned as the one per-view surface — no new chrome class.

### Legacy undo disposition

Recommend **retire undo/redo for casting generated views** (buttons + Z/⇧Z binding in the casting context) once the tile strip exists, and fix the viewer's status line to the ledger's vN so there is ONE version vocabulary. **Keep hold-to-compare** — it's an honest, loved preview gesture with no persistence pretense. Note the undo machinery is casting-local (`useCastingGenerationStore`); wardrobe's separate VTO undo is untouched by any of this.

## 3. Relationship to A1 — same question, one governance model

A1 and A3 are two halves of *"what may change a generated view, and what does the package guarantee afterward?"* The combined model, if the founder ratifies both directions:

> **Every change to a slot is a new ledger row** — cosmetic iterate (allowed, D-43.2), refresh (plan-priced), restore (free copy-forward). Identity-level changes are refused on minted (fork is the identity verb; A1 seal already live) and stale-mark siblings on drafts (B-lite). **The ledger is the single version history**; pins mark accepted-final rows; the comp-card popover is the one place all of it is read and acted on. The studio keeps drafting gestures (hold-to-compare) but no parallel version system.

They also share an implementation surface (the tile popover + the classifier) and a home: **fold A3 into A1 stage 2's R6 slot.**

## 4. Costs

| Piece | Cost |
|---|---|
| `restoreSlotVersion` op + route + unit tests | ~0.25d |
| Tile-popover version strip + "Use this version" | ~0.5d |
| Legacy undo retirement (casting scope) + viewer vN unification | ~0.5d |
| **A3 total** | **~1–1.25d** |
| Combined with A1 stage 2 (classifier UI + draft stale-writer, ~1–1.5d) | **~2–2.75d as one R6 rider** |

**Recommendation:** ratify the combined model in §3; build as one R6 rider on the environment-restyle slot (the restyle already reworks `ImageViewerPanel`/`RefinePanel`/the tile popover — three separate touches of the same surface would be waste). Drive additions at that point: restore lands as new head (vN+1, free), pinned rows restore-safe, casting undo buttons absent.
