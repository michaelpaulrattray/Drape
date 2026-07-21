# Casting `modelId` Writer Inventory

**Status:** R7-5A deletion-gate inventory
**Baseline:** `bb0eb67`
**Authority:** `CASTING_SYSTEM_R7_5_FINAL_DELETION_EXECUTION_PLAN.md` §4.6 / R7-5A

This document classifies every production database writer that creates or changes a durable `modelId` reference. R7-5C must not begin until every row is understood, and it cannot finish until every row marked **FENCE REQUIRED** is protected at the durable write boundary.

The model-operation lock is valid only where the named caller actually acquires `model:<id>` and holds it through the write. A prior route read is not a post-deletion fence.

## Verdict

The inventory is complete for the current schema. Eight attachment surfaces need an R7-5C write fence:

1. `models.update` through the reusable `updateModel` helper;
2. `wardrobe.sessions.create`;
3. `wardrobe.looks.save`;
4. legacy `boards.addItem` / `boards.addItems`;
5. `boardOps.createNode` with Cast provenance;
6. public `boards.updateItem` metadata carrying Cast provenance;
7. `bugReports.submit` when `modelId` is present; and
8. a `generation_operations` claim carrying an existing `modelId` before its model lock is acquired.

One deletion-owned writer also violates the retained-data boundary: the current `MODEL_DELETED` audit event stores `modelName` and `agencyId`. R7-5C must keep the non-reconstructive security event while removing those forbidden identity fields.

These are implementation findings, not product-boundary changes. Uploaded Wardrobe sessions with `modelId = null` remain valid, and bug reports without a model pointer remain valid.

## `models.id` and model-row writers

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `createModel` (`INSERT models`) | `models.create`; Canvas cast/fork/variation candidate creation | Creates a new row owned by the authenticated caller; exact insert id via `$returningId()` | Safe as a new-subject writer. Keep creation intake and ownership stamping. |
| `updateModel` (`UPDATE models WHERE id = ?`) | `models.update` rename; stays-draft nickname in `mintPackage`; `generation.compactPrompt` | Routes read ownership/status first; mint/compact run under the model lock, but the helper itself has no alive predicate and rename can race deletion | **FENCE REQUIRED:** conditional user/alive/status write with affected-row truth. Plain `NOT_FOUND` for a deleted subject. |
| `mintModelAtomically` | `generation.mintPackage` | Model lock plus draft/status/owner/revision CAS in the `UPDATE` itself | Safe. Add `deletedAt IS NULL` after migration 0009 for explicit compatibility, while preserving the existing CAS. |
| `commitAnchorReRoll` / `commitIdentityEdit` (`UPDATE models`) | Casting headshot reroll, iterate identity edit, Canvas recast | All production callers hold the same model operation lock through the transaction | Safe under the shared lock. Add the alive predicate as defense in depth when 0009 lands; an affected-row miss must abort the transaction. |

## `model_assets.modelId`

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `createModelAsset` | Initial Casting headshot; image-only iteration; package slot generation/failed marker; slot restore; Canvas cast/candidate | Existing-model callers hold `model:<id>`; new-model callers own a newly inserted row not yet exposed to a delete door | Safe under current callers. Keep `createModelAsset` internal and require lock-or-new-subject proof for any future caller. |
| Direct asset insert in `commitAnchorReRoll` / `commitIdentityEdit` | Identity commits only | Same transaction and model lock as the model document update | Safe. Deletion cannot interleave. |
| Asset pin/status updates | Package pin, refresh/stale bookkeeping, identity sibling staling | Package/Casting routes hold the model lock; identity staling is in the identity transaction | Safe. Asset id alone must never become a public unguarded writer. |

## `generations.modelId`

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `createGeneration` with non-null `modelId` | Casting headshot, iterate, package slots, Canvas model operations | Each existing-model path is inside the durable model operation; new-candidate paths link to a newly created model. Wardrobe generation attempts currently omit `modelId`. | Safe under current callers. Keep partial operation-link validation. R7-5 deletion scrubs/deletes reconstructive attempt content. |
| `updateGeneration` | Settlement by generation id | Cannot change `modelId`; only status/result/error/time/metadata | Not a `modelId` writer. R7-5 still scrubs model-scoped attempt content. |

## `generation_operations.modelId`

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `claimGenerationOperation` with existing `modelId` | Casting, package and model-backed Canvas direct operations | Routes generally perform an owned/available read before the claim, but the receipt insert occurs before model-lock acquisition. A deletion can commit between the read and insert. | **FENCE REQUIRED:** when a claim carries an existing model id, atomically require that the subject is owned/alive at insert time (or claim inside the model lock transaction). Never create a new unsanitized receipt after deletion scrub. |
| `bindGenerationOperationModel` | New model creation and empty-node Canvas cast | CAS binds a running receipt once, to the exact model id returned by the same creation call | Safe new-subject binding. It cannot rebind and the model id is not client-selected. |
| Operation landing/recovery updates | Durable Canvas landing | Do not change receipt `modelId`; they write landing state/result only | Not a `modelId` writer. Deleted-subject replay scrubbing remains required by R7-5C. |

## `board_items.sourceModelId` and JSON Cast provenance

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| Legacy `boards.addItem` / `boards.addItems` | Public protected tRPC procedures | Validates board ownership only. `sourceModelId` and arbitrary `metadata` are client supplied; model ownership/availability is not checked. | **FENCE REQUIRED:** for any supplied Cast id/provenance, require same-user alive model at the durable insert. Reject direct-vs-JSON disagreement. Prefer removing these Cast-link capabilities from the legacy generic API if no live client needs them. |
| `boardOps.createNode` / `executeCreateNode` | Public plan/execute procedure | `provenance` is only `z.record`; any `modelId` is cast to `Provenance` and copied to `sourceModelId` after board ownership alone | **FENCE REQUIRED:** parse recognized provenance server-side and validate same-user alive model immediately at insert. Reject unknown/malformed Cast provenance and direct disagreement. |
| Empty-node fill / library placement | `fillFromLibrary`, durable model-create landing | Server resolves owned/available model, then a board-item CAS writes the server-derived id; model-backed flows use the model lock and new-model flows use operation-owned exact ids | Safe. Preserve conditional empty-node/reconciliation CAS. Add alive proof inside the transaction for existing library placement after 0009. |
| Canvas fork/variation placement | Model-backed Canvas executors | Model id is the exact newly created candidate id, never client supplied | Safe new-subject placement. |
| Cast-view pop-out | `popOutView` | Reads model id from an owned source node and checks model/asset truth; current writer stamps both direct id and recognized provenance | Safe under current route ownership. Add alive check at durable placement after 0009. |
| Generic `updateBoardItem` / public `boards.updateItem` metadata | Internal helper plus public protected tRPC procedure | The public schema does not expose direct `sourceModelId`, but it accepts unconstrained `metadata` and writes it after board ownership only. Recognized JSON Cast provenance can therefore attach any model id after deletion. | **FENCE REQUIRED:** strip Cast provenance from the generic public metadata door or parse it and require a same-user alive model at the durable update. Direct-vs-JSON disagreement must refuse. Keep direct `sourceModelId` internal. |
| Historical backfill | `boardBackfill`/future migration | Repair-only mapping from an existing direct id into recognized JSON provenance | Read/repair gate only. R7-5 audit must report JSON-only and direct/JSON mismatch rows before deletion is enabled. |

## `wardrobe_sessions.modelId`

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `createSession` | `wardrobe.sessions.create` | Optional `modelId` is client supplied and inserted after no model lookup. `null` is a legitimate uploaded-model session. | **FENCE REQUIRED:** when non-null, require same-user alive model at the durable insert. Preserve `null`. |
| `updateSession` | `wardrobe.sessions.update` | Public input cannot change `modelId`; route re-reads session ownership | Not a `modelId` writer. A concurrent deletion removes the session; affected-row truth is useful but it cannot recreate linkage. |

## `wardrobe_looks.modelId`

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `saveLook` | `wardrobe.looks.save` | `modelId` and optional `sessionId` are client supplied; neither model ownership/availability nor session-model consistency is checked | **FENCE REQUIRED:** require same-user alive model in the insert transaction; if a session is supplied, require same user and either the same model id or the explicitly supported model-less rule. |
| `renameLook` | `wardrobe.looks.rename` | Cannot change `modelId`; filters by look id and user id | Not a `modelId` writer. Deletion removes the model-owned look. |

## `bug_reports.modelId`

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `createBugReport` | `bugReports.submit` | Optional `modelId` is client supplied. Auth/rate limiting exist, but no ownership or lifecycle check exists. | **FENCE REQUIRED:** when present, validate same-user alive model at the durable insert, or store `null` if the referenced subject is unavailable. R7-5C scrubs existing pointers while preserving the independent support report text. |

## Semantic model references in `audit_logs`

`audit_logs` has no dedicated integer `modelId` column, but `resourceType = "model"` plus `resourceId = String(modelId)` is a durable model reference and must be inventoried with the typed columns.

| Durable writer | Production entry points | Current authority | R7-5 disposition |
|---|---|---|---|
| `logAuditEvent` for `MODEL_DELETED` | `models.delete`, after the current deletion boundary | The server supplies the model id, but metadata currently retains `modelName`, `agencyId`, and status. The first two fields directly violate D-64/§3.3. | **CONTENT CORRECTION REQUIRED:** retain action, resource id, user id, timestamps, request/security context and non-reconstructive lifecycle/count truth only. Stop persisting (and scrub any retained deletion event of) model name, agency id, prompts, schemas, preferences, references or visual evidence. The R7-5A audit reports affected rows without outputting their metadata. |

## Non-database lookalikes resolved

| Surface | Resolution |
|---|---|
| Wardrobe `seedChat` / Gemini session keys | In-memory/provider chat session identifiers only; no database `modelId` is persisted. |
| Client stores and pending registries | Correlation/UI state only; server receipts and rows remain authoritative. |
| `board_item_versions` / `board_edges` | Do not contain `modelId`; they are deletion dependencies reached through their board item ids. |
| `generation_operation_locks.lockKey = model:<id>` | Durable but content-free exclusivity evidence. R7-5C releases the delete operation's lock through normal operation finalization; historical locks remain operation-recovery evidence and are not identity reconstruction. |
| Account/GDPR collectors | Deletion readers/writers, not new `modelId` attachment doors. R7-5D must route their owned-key discovery through the same exact-origin law. |

## R7-5C completion checklist

- [ ] `updateModel` and direct model document writes include alive/CAS predicates and check affected rows.
- [ ] Wardrobe session/look inserts validate ownership, availability and session consistency inside the durable boundary.
- [ ] Generic Board create and update APIs cannot attach a deleted, foreign or mismatched Cast id/provenance through either a direct column or metadata.
- [ ] Existing-model operation claims cannot land after the deletion scrub.
- [ ] Bug reports cannot create a dangling post-delete model pointer.
- [ ] The retained `MODEL_DELETED` audit event contains no model name, agency id, prompt/schema/preferences, reference or visual evidence; legacy retained deletion events are counted and scrubbed by the deletion service/migration policy.
- [ ] A source scan/test proves every schema `modelId` column and every production writer above remains classified.
- [ ] Disposable-DB races prove a delete winner cannot be repopulated by any fenced writer.

No R7-5A work changes these writers. This is the gate that makes their R7-5C correction mandatory.
