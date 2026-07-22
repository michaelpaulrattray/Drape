# R7-7A Snapshot and Selection Reader/Writer Inventory

**Date:** 2026-07-22
**Baseline:** `09aed73`
**Status:** implementation inventory; must remain complete before R7-7A runtime adoption
**Authority:** `CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`, D-65

## 1. Purpose

R7-7A introduces immutable identity snapshots, immutable package snapshots, and explicit selected slots without changing current R6 behavior. This inventory names every live path that currently derives Cast truth from mutable model columns, newest-filled asset rows, asset status JSON, or pins.

The schema-only migration may land before these paths move. Snapshot reads cannot become authoritative until every current writer dual-writes and the shadow report proves parity.

## 2. Identity/document writers

| Path | Current durable effect | R7-7A obligation |
|---|---|---|
| `server/routes/models.ts` → `createModel` | Creates a model before a headshot exists | Do not create a headless snapshot. Initial headshot success creates the first paired identity/package head atomically. |
| `server/routes/generation/castingImaging.ts` | Initial headshot asset and anchor revision | Lazy-bootstrap or create the first identity/package snapshot after the owned headshot exists. |
| `server/lib/boardOps.ts` empty-node cast | Creates model and headshot through Canvas | Same initial paired snapshot law; board landing stays in the existing durable boundary. |
| `server/lib/boardOps.ts` fork/recast/variations | Creates a new model/headshot or commits a structured identity recast | New models receive `fork_bootstrap`/`create` heads; structured recast appends paired identity/package snapshots. |
| `server/casting/identity/identityCommit.ts` `commitIdentityEdit` | Replaces identity documents, writes anchor/revision, stales all filled siblings | Append one identity snapshot plus one package snapshot in the same transaction; copy all selected siblings as stale, pinned included. |
| `server/casting/identity/identityCommit.ts` `commitAnchorReRoll` | Writes a new anchor/revision and stales siblings | Same paired append with reason `anchor_reroll`. |
| `server/routes/generation/castingRefinement.ts` `compactPrompt` | Rewrites `models.masterPrompt` after protected-language validation | Append a paired identity/package state with a precise `document_compact` reason; do not mutate snapshot history in place. |
| `server/casting/mintPackage.ts` → `mintModelAtomically` | Draft→active CAS and optional rename | Keep `expectedIdentityRevisionId` CAS during dual-write; append/select the mint package state and set both seal pointers in the same transition. |
| `server/db/models.ts` `updateModel` | Conditional live-row update used by rename and prompt maintenance | Rename is display metadata and does not append identity history. Any identity-document caller must use a snapshot-aware service rather than the generic helper. |
| `server/casting/finalCastDeletion.ts`, `server/db/accountDeletion.ts` | Permanently deletes/tombstones model authority | Delete all snapshot/slot rows and include them in account/model deletion counts; no snapshot content enters tombstone/audit metadata. |

`document_compact` is an evidence-backed addition to the identity-snapshot reason vocabulary: the live compact-prompt writer changes canonical text but is neither a user identity edit nor an anchor reroll.

## 3. Asset/package writers

| Path | Current durable effect | R7-7A obligation |
|---|---|---|
| `server/db/models.ts` `createModelAsset` | Generic asset append | Never dual-write implicitly. Callers must declare the package transition they are performing. |
| `server/routes/generation/castingImaging.ts` | Initial headshot / reroll | Initial paired head or identity-change package append as applicable. |
| `server/routes/generation/castingRefinement.ts` | Image-only iteration or identity iteration | Image-only appends a package snapshot selecting the complete new view; identity iteration uses the paired identity commit. |
| `server/casting/mintPackage.ts` slot generation | Generates add-view/mint slots, including partial outcomes | After durable successful slots are known, append one package snapshot selecting successes and carrying unchanged slots. Failure markers are never selected. |
| `server/casting/mintPackage.ts` failure marker | Inserts storage-url-empty marker rows for current failed-state UI | Keep marker mechanism during R7-7A; it does not create or occupy a package selection. |
| `server/casting/refreshSlots.ts` | Inserts refreshed rows and clears stale state | Append one package snapshot for the settled refresh operation; successful angles become current, unchanged angles carry honestly. |
| `server/casting/mintPackage.ts` `restoreSlotVersion` | Copy-forwards a historical asset row | Append a package snapshot selecting the compatible restored asset; no identity rollback. |
| `server/db/models.ts` `markModelAssetsStale` and direct stale writes in `identityCommit.ts` | Mutates newest asset JSON stale state | Dual-write compatibility only; snapshot compatibility is written by the owning identity/package transaction, never inferred later from mutable JSON. |
| `server/db/models.ts` `setModelAssetPinned` | Mutates the R6 accepted-final pin | R7-7A keeps it for old reads. R7-7B removes it only after explicit-selection parity. It never chooses a different snapshot slot. |
| `server/lib/boardOps.ts` pop-out/library fills | Reads a current asset then persists an independent Canvas representation | Resolve through old reads during A; later consume explicit selected slots. It is not a Cast package writer. |

The package reason vocabulary must include the live distinctions `image_refine` and `document_compact`/identity-paired maintenance where the ratified generic list would otherwise collapse code evidence into a misleading reason.

## 4. Server readers and selectors

| Surface | Current source | Cutover obligation |
|---|---|---|
| `server/db/models.ts` `getModelAssets` | All rows newest-first | Remains ledger/history access; not current-selection authority after R7-7B. |
| `getUserModels`, `getHeadshotsForModels`, library thumbnails | Newest suitable rows | Shadow explicit package selection, then cut over thumbnails. |
| `server/routes/models.ts` `models.get` | Model + all assets | Add effective snapshot DTO behind the read flag; retain ledger assets for history only. |
| `server/routes/registry.ts` | Public model + all assets | Resolve sealed/current explicit package slots before cutover. |
| `server/routes/boards.ts` | Model-backed board asset reads | Resolve explicit current selections before pin retirement. |
| `server/routes/generation/castingExport.ts` | Mint plan, package state, export, pin, versions, restore, refresh plan | Package state and plans shadow explicit selections; history remains ledger-backed; pin route retires in B. |
| `server/casting/mintPackage.ts` | `computePackageSlots`, newest-filled IDs, versions, restore | Split ledger history from selected package truth. |
| `server/casting/refreshSlots.ts` | Current slots and pinned/stale refusal | Shadow package compatibility; old refusal remains until B. |
| `server/casting/composeIdentityPayload.ts` | Newest-filled anchor/intent and pinned stale exemption | Replace with effective-snapshot resolver in B; no newest/pin authority remains. |
| `server/casting/identity/anchorSelector.ts` | Anchor role and newest displayed headshot | Snapshot owns anchor; package owns displayed headshot. Keep compatibility adapter through A. |
| `server/casting/identity/mintIntegrity.ts` | Revision/provenance and slot state | Shadow snapshot identity/package invariants. |
| `server/routes/generation/castingImaging.ts` | Prior assets for reroll and view generation | Resolve effective selection after B. |
| `server/routes/generation/castingRefinement.ts` | Target asset, displayed headshot, authority | Resolve selected target/anchor from snapshot after B; history ids stay server-owned. |
| `server/lib/boardOps.ts` | Library fill, picker, recast, pop-out, current-angle selection | Shadow every newest-filled choice before B. |
| `server/db/generationOperations.ts`, `server/casting/operationRecovery.ts` | Result/landing recovery from assets | Preserve durable recovery; use receipt snapshot expectations once writers adopt them. |
| `server/db/gdprExport.ts` | Exports all model assets | Add snapshot/package history after schema adoption without removing owned asset export. |
| `server/casting/finalCastDeletion.ts`, `server/db/accountDeletion.ts` | Dependency and storage manifests | Include snapshot rows; future evidence keys join in R7-7C. |
| Wardrobe/VTO routes | Client-supplied `modelImageUrl`; tattoo pixel map | Inventoried now, cut over to server-resolved selection in a later flagged consumer batch; pixel map remains presentation-only. |

## 5. Client consumers

Clients do not become snapshot authorities. They consume server projections through:

- `generation.packageState`: Casting strip, Details dialog, Cast Profile, export, Canvas Cast nodes, spawn menu, ModelCardChooser and gate/bridge cache coordination;
- `generation.mintPackagePlan` and `refreshSlotsPlan`: paid confirmation and truthful refusal/cost surfaces;
- `generation.slotVersions` and `restoreSlotVersion`: ledger history and copy-forward restore;
- `models.get`, model lists and registry projections: Studio hydration, library cards and public bundles;
- board item payloads: Canvas model-backed images and comp cards.

No client may send snapshot ids, selection ids, compatibility claims, anchor ids, state versions, or evidence authority. Expected snapshot/state values are captured by the server operation receipt after ownership and lock acquisition.

## 6. R7-7A completion checks

- Every writer above has an explicit dual-write or deliberate-no-write classification.
- Every newest-filled reader has a named shadow comparison before snapshot reads enable.
- Models without a filled headshot remain snapshot-headless and are not misclassified as corrupt.
- Failure markers are not selectable.
- Board-item pins remain untouched; model-asset pins remain only as rollback compatibility until B.
- Deletion/account erasure remove rows from all three A-phase snapshot/selection tables before deleting the model row that owns the snapshot pointers.
- No evidence/candidate/plate schema, storage kind, generation capability, UI control or credit path enters R7-7A.
