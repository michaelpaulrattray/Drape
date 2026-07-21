# R7-5 — Final Cast deletion and owned-storage cleanup

**Status:** DRAFT FOR FABLE REVIEW — no destructive implementation authorized
**Baseline:** `9e09b01` (`R7 Casting UX: unify view history and details`)
**Founder authority:** D-64 supersedes D-62 ruling 8

## 1. Product outcome

Deleting a Cast must feel as simple as deleting any other deliberate creation:

1. the user confirms once with clear consequences;
2. the Cast disappears immediately from the library and Studio;
3. every direct Cast representation disappears from every Canvas;
4. owned image evidence is durably queued for verified deletion;
5. there is no archive, recovery window, restore flow, or `Source unavailable` placeholder;
6. the action costs no credits and never deletes independent downstream creative outputs.

The internal implementation may retain a scrubbed, non-recoverable receipt to preserve idempotency, credit/accounting integrity, and security. That receipt is not a product archive and cannot reconstruct the Cast.

## 2. Current-code findings

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| F1 | `models.delete` accepts only drafts. | `server/routes/models.ts` rechecks `status === "draft"` under the model operation lock. | Minted users see “can't delete”; R7-5 must deliberately enable both draft and minted deletion. |
| F2 | Current deletion is incomplete SQL hard-delete. | `server/db/models.ts::deleteModel` deletes Wardrobe looks/sessions, model assets, then the model. | It leaves Canvas, generation, operation, audit, bug-report, and R2 references unresolved. |
| F3 | R2 objects are orphaned. | `deleteModel` never calls or queues `storageDelete`; `deleteModelWithAssetKeys` is unused and only knows `model_assets.storageKey`. | A successful UI deletion can leave every generated object publicly addressable. |
| F4 | Current Cast node creation stamps `sourceModelId`, but historical JSON-only rows may still exist. | `executeCreateNode` derives `sourceModelId` from any provenance carrying `modelId`, so current popped-out `cast_view` rows are direct-linked. Older/backfilled rows can still carry only JSON provenance. | Keep the index/backfill/audit, calibrated as historical repair rather than a current writer defect. |
| F5 | `board_items.sourceModelId` has no index. | The table indexes board/type and kind only. | Cross-board dependency discovery would scan the table. |
| F6 | Board versions and edges are not database-cascaded. | No enforced foreign keys; `deleteBoardItem` does not remove `board_item_versions` or `board_edges`. | Removing a node without explicit cleanup strands versions and edges. |
| F7 | Board thumbnails can retain a deleted Cast URL. | `boards.thumbnailUrl` is independently persisted. | The lobby can keep showing an image after the Cast and its nodes are gone. |
| F8 | Generation attempts retain model linkage and potentially reconstructive result/error/metadata content. | Real columns are `generations.modelId`, `resultUrl`, `errorMessage`, and JSON `metadata`; there are no standalone `prompt` or `inputUrl` columns. | Hard-deleting only the model leaves identity material and dangling references; scrub/delete the actual columns and inspect metadata recursively for URLs or prompt/input material. |
| F9 | Durable operation receipts may replay old model results. | `generation_operations` retains `modelId`, payload hash, result, error and origin data; replay can return a saved terminal result before executor work. | Deleting receipts weakens exactly-once guarantees; keeping unsanitized results can expose deleted URLs. |
| F10 | Wardrobe dependencies are already treated as model-owned but their storage is not cleaned. | Current `deleteModel` deletes `wardrobe_looks` and `wardrobe_sessions`; their image/history URLs are not collected. | Preserve current simple product behavior, but queue all provably owned objects before deleting the rows. |
| F11 | Existing `archived` status is already unavailable everywhere. | Shared lifecycle guards, registries, Studio hydration and Canvas read models treat it as deleted. | It can serve temporarily as an internal terminal tombstone state after full content scrubbing; it must not imply recovery. |
| F12 | Account/GDPR deletion has separate incomplete collectors. | `server/db/accountDeletion.ts` parses arbitrary URLs; `server/security/deleteUserData.ts` only collects a subset of explicit keys. | R7-5 should create one exact-owned-key law and later route both account paths through it. |
| F13 | Exact model images can survive in rows that are not formally linked. | Board items/versions may reuse a model asset URL; downstream metadata may retain it as an input. | Dependency discovery must match direct IDs, Cast provenance, and exact owned asset URLs. Independent outputs with different URLs remain. |
| F14 | The R7 model operation lock excludes the Casting/Canvas paid doors that adopted it. | `models.delete` uses `beginDirectOperation`, `modelOperationLockKey`, and `markGenerationOperationRunning`; mint/refresh/iterate/model-backed Canvas operations use the same model resource. | Preserve this foundation, but do not claim it fences every model-linked writer. |
| F15 | Three reachable writers can repopulate a deleted/tombstoned subject after the deletion transaction. | `wardrobe.sessions.create` accepts an optional unvalidated `modelId`; `wardrobe.looks.save` inserts a client-supplied `modelId` without model ownership/availability validation; `models.update` checks status before calling `updateModel`, whose UPDATE has only `WHERE id = ?`. | R7-5C needs a post-deletion write fence: validate owned/alive model references at insert time and make every ordinary model UPDATE conditional on `deletedAt IS NULL`/available status so a racing write affects zero rows. |

## 3. Binding deletion boundary

### 3.1 Delete

- the visible model identity and all reconstructive fields;
- every `model_assets` row and all versions, including failed markers;
- generation attempts and result/input URLs scoped to the model, after monetary truth has been preserved in the parent receipt;
- Cast roots, library placements, popped-out Cast views, and any board item whose current image is exactly one of the model asset URLs;
- versions belonging to removed nodes;
- exact model-asset versions embedded in otherwise independent surviving nodes;
- incident edges for removed nodes;
- model-linked Wardrobe sessions and saved looks;
- owned R2 objects collected from those rows;
- deleted-asset URLs embedded in surviving provenance metadata.

### 3.2 Preserve

- independently generated image/video nodes whose output URL is not a model asset;
- their ordinary history, except an exact deleted model-asset version;
- unrelated Canvas nodes, boards, garments and user uploads;
- credit ledger rows and non-reconstructive monetary totals;
- a minimal tombstone/operation receipt needed for replay safety and audit law.
- temporary reference-image objects that may be shared by another surviving Cast, unless exclusive ownership and zero surviving references are proven. Their URL/reference is scrubbed from the deleted Cast regardless.

### 3.3 Never retain in the tombstone

- display name or agency id;
- master prompt, technical schema, preferences, reference image or identity amendment;
- asset URL, storage key, thumbnail or visual evidence;
- generation prompt/input/result URL;
- recoverable Wardrobe or Canvas snapshot data.

## 4. Recommended internal architecture

### 4.1 Immediate database boundary

Reuse the existing durable `model.delete` operation and model lock. Inside one database transaction:

1. re-read the owned model under the lock and accept `draft`, `active`, or legacy `locked`;
2. refuse already-deleted/unknown rows as NOT_FOUND;
3. discover and lock every affected database row;
4. build and persist a deduplicated cleanup manifest before deleting source rows;
5. delete/scrub dependent rows in referential order;
6. recompute affected board thumbnails from surviving alive items;
7. scrub the model into a non-recoverable internal tombstone (`status="archived"` as the temporary compatibility state, plus `deletedAt`); and
8. complete the `model.delete` receipt with counts only.

The user-visible deletion succeeds at this commit. A rollback leaves the Cast intact and creates no cleanup work.

The model lock is necessary but not sufficient. Every model-linked writer outside that lock must also obey the post-deletion write fence in §4.6 so nothing can repopulate the tombstone after commit.

### 4.2 Minimal tombstone

Do not hard-delete the `models` row in R7-5. Scrub it atomically so every existing lifecycle guard continues returning NOT_FOUND while old request ids remain attached to a subject that is known to be deleted.

Recommended retained fields: `id`, `userId`, `status`, `deletedAt`, `createdAt`, `updatedAt`.

Recommended scrubbed fields: `agencyId = null`, `name = null`, `masterPrompt = "[deleted]"`, `technicalSchema = { deleted: true }`, `preferences = {}`, `identityRevisionId = null`, `mintedAt = null`, plus any future identity/evidence columns.

### 4.3 Replay-safe operation scrubbing

Migration 0009 adds nullable `subjectDeletedAt` to `generation_operations`. For every earlier operation linked to the model:

- set `subjectDeletedAt`;
- clear `result`, `errorMessage`, `expectedIdentityRevisionId`, `originBoardId`, `originItemId`, and any URL-bearing or identity-bearing field;
- retain operation id, user id, client request id, payload hash, kind, terminal status, timestamps, and charged/refunded totals;
- teach replay/adjudication to return a typed deleted-subject refusal before exposing a saved result or invoking an executor.

Exclude the current `model.delete` operation from that scrub until its `{ deleted: true }` result is finalized so an identical deletion retry remains an idempotent success.

### 4.4 Durable owned-storage cleanup

Migration 0009 adds internal tables:

- `storage_cleanup_batches`: id, userId, operationId, kind, status, expected/deleted/failed counts, lease/heartbeat/attempt timestamps, created/updated timestamps;
- `storage_cleanup_items`: batchId, storageKey, status, attempts, nextAttemptAt, lastErrorCode, created/updated timestamps, unique `(batchId, storageKey)`.

Only queue keys from:

1. explicit owned `storageKey` columns; or
2. URLs whose parsed origin exactly equals configured `R2_PUBLIC_URL`, with a normalized non-empty path.

Never derive a deletable key from an arbitrary external URL. Legacy Manus/CDN references are records to scrub, not objects Drape is authorized to delete.

Prefer explicit `storageKey` columns over URL derivation. The R7-5A production audit must inventory every historical Drape-owned public origin; an old origin is not deletion authority merely because it was once trusted. Add an explicitly configured owned-origin allowlist only after bucket ownership is proven, never by accepting arbitrary hosts.

The cleanup worker uses a lease, bounded retries/backoff, idempotent `storageDelete`, and treats already-missing objects as success. It never recreates database content after deletion. Permanent failures alert and remain repairable through an internal sweep command.

Storage keys are transient cleanup authority, not retained audit data. Once every item in a batch is verified deleted/missing, remove the item rows (or irreversibly scrub their key field) and retain only non-sensitive batch counts/timestamps. Partial/failed batches retain only the keys still required for retry.

### 4.5 Canvas dependency law

Before runtime deletion is enabled:

- add `idx_board_items_source_model`;
- backfill `sourceModelId` from recognized `cast_root`, `library_cast`, and `cast_view` provenance when the direct column is null;
- change all future Cast-view creation to stamp `sourceModelId` directly;
- provide a read-only discrepancy audit for JSON model ids that disagree with the direct column.

At deletion time, identify rows matching any of:

- `sourceModelId = modelId`;
- recognized Cast provenance with `modelId`;
- current `imageUrl` exactly equal to a model-asset URL.

Include already-soft-deleted Canvas rows so an undo cannot resurrect a deleted Cast. Every matched board must belong to the same user; an impossible cross-owner reference fails closed and emits a security alert rather than deleting another user's row.

For an ID/provenance-linked Cast node, delete the node. For a non-Cast node matched only by current URL equality, first remove every matching version and promote the newest surviving independent version as current. Delete that node only when no independent version survives. This prevents an exact copied Cast image from destroying the node's unrelated earlier history.

For surviving nodes, delete history rows whose URL exactly matches a deleted model asset and scrub those URLs from metadata inputs. Do not recursively delete their independent output.

### 4.6 Post-deletion write fence

The deletion transaction is not complete as a system invariant until every writer that can attach data to a model id is unable to write after `deletedAt` is set.

- `wardrobe.sessions.create`: when `modelId` is supplied, re-read an owned, available model immediately before insert; deleted/archived/missing is NOT_FOUND. Uploaded-model sessions with `modelId = null` remain valid.
- `wardrobe.looks.save`: require the referenced model to belong to the caller and be available immediately before insert; deleted/archived/missing is NOT_FOUND. Validate any supplied session belongs to the caller and, when model-linked, refers to the same alive model.
- `models.update` and every reusable model-row update helper: make the write itself conditional (`deletedAt IS NULL` and an available status), not merely a prior route check. A racing rename/document write after deletion must affect zero rows and return NOT_FOUND/typed stale-subject refusal.
- Inventory every other `INSERT/UPDATE ... modelId` writer during R7-5A. Either take the model operation lock or perform the same owned/alive predicate at the durable write. No route may rely solely on a check performed before the deletion commit.

## 5. Execution batches

### R7-5A — Policy, dependency inventory and read-only audit

- Amend D-62 through D-64 and reconcile the R7 plan.
- Add `scripts/audit-cast-deletion.ts` with explicit URL/app-id production refusal by default.
- Report per model: lifecycle status, assets/keys, generation attempts, operations, direct/JSON/URL Canvas references, board versions/edges, board thumbnails, Wardrobe rows/URLs, bug reports, temporary reference-image references, historical Drape-owned origins, and mismatches.
- Inventory every database writer that accepts or persists a `modelId`, recording its lock or owned/alive write predicate. R7-5C cannot begin with an unknown writer.
- No writes, schema changes or storage calls.

**Gate:** Fable approves the dependency matrix and the founder approves any correction to the product boundary.

### R7-5B — Additive schema and compatibility

- Generate migration 0009 for `models.deletedAt`, `generation_operations.subjectDeletedAt`, the source-model index, and cleanup batch/item tables.
- Add closed status vocabularies and database helpers without routing production deletion through them.
- Prove 0008 runtime works before/after 0009 and 0009 runtime tolerates historical rows.
- Disposable MySQL tests only.

**Gate:** Fable review, explicit production migration authorization, migration before dependent runtime.

### R7-5C — Atomic deletion service

- Replace the current `deleteModel`/unused `deleteModelWithAssetKeys` split with one transaction-bound deletion planner/executor.
- Preserve model operation locking and idempotent delete replay.
- Accept draft and minted statuses.
- Persist cleanup manifest, remove dependencies, recompute thumbnails, scrub prior receipts and tombstone the model atomically.
- Land the §4.6 write fence in the same batch: Wardrobe model-reference validation plus conditional model-row updates. The deletion service is not complete while a racing writer can repopulate the tombstone.
- Leave the public route drafts-only until this service passes disposable-database drives.

**Gate:** failure injection at every transaction boundary; zero partial database deletion.

### R7-5D — Cleanup worker and repair tooling

- Lease and process pending cleanup items.
- Retry transient failures, seal missing objects as success, and expose internal counts/alerts.
- Add dry-run orphan and manifest-reconciliation commands.
- Route account/GDPR owned-key discovery through the same exact-origin parser and cleanup queue; do not widen the public model-delete surface yet.
- Acknowledge model-less Wardrobe VTO attempt rows: attempts with `generations.modelId = null` are not model-scoped deletion dependencies. Saved session/look URLs are collected through their rows; unsaved model-less residue belongs to the account/GDPR cleanup path.

**Gate:** fake storage plus disposable DB proves crash/restart/replay, no external URL deletion, and conservation of manifest counts.

### R7-5E — Product door and cache propagation

- Add a free `models.deletePlan` returning plain counts: Cast views, Canvas placements, affected boards, Wardrobe sessions/looks; no sensitive URLs/keys.
- Treat the plan as advisory UI truth. The executor re-plans under the model lock and returns authoritative final counts; it never trusts client-supplied counts.
- Enable permanent delete for drafts and minted Casts in the lobby/model library.
- Confirmation copy: “Delete this Cast permanently? Its Cast views and linked Canvas/Wardrobe placements will be removed. Other images and videos you created stay.”
- One deliberate confirmation; no typed phrase, archive choice or recovery upsell.
- On success invalidate model lists, recent work, relevant board items/thumbnails, operations and open Studio state. Cross-tab durable truth removes stale surfaces.
- Keep deleting a Canvas node separate: it removes only that placement and never deletes the library Cast.

**Gate:** founder visual/manual drive on disposable or non-production test data; then separate production runtime/deploy authorization.

### R7-5F — Production audit and controlled enablement

- Run the read-only audit first and save counts without prompts, URLs, keys or identity documents.
- Resolve every direct-vs-JSON mismatch and identify any historical `archived` rows.
- Apply migration 0009 separately.
- Deploy cleanup worker with the public minted-delete door still disabled; verify health/metrics.
- Gate the worker and product door separately (`ENABLE_STORAGE_CLEANUP_WORKER`, then `ENABLE_FINAL_MODEL_DELETE`). Enable the door only after one clearly labelled test Cast proves DB removal, Canvas removal, thumbnail repair, receipt scrubbing and owned-object deletion.

No bulk cleanup or legacy archived-row purge is implied by deploying R7-5. Each requires separate authorization.

## 6. Required verification matrix

### Authority and concurrency

1. Foreign model delete is indistinguishable from not owned and changes nothing.
2. Draft, active and legacy locked use the same final-delete service.
3. Already deleted returns/replays honest success only for the identical delete request; other doors return NOT_FOUND.
4. A busy model lock refuses before database/storage changes.
5. Two concurrent delete requests cannot create two manifests or partially diverge.
6. Delete costs zero credits and cannot mutate the credit ledger.

### Database atomicity

7. Failure before transaction commit leaves all rows and zero cleanup items.
8. Success removes every direct Cast item, version and incident edge across multiple boards.
9. JSON-only historical Cast views are backfilled or fail the audit; none silently survive.
10. Exact model-asset versions are removed from otherwise surviving image-node history.
11. Independent downstream output nodes remain.
12. Wardrobe sessions/looks are removed and their owned URLs join the manifest.
13. Generation attempt content is removed; parent receipts retain only permitted minimal fields.
14. Registry, Studio, library, picker and direct model reads all return absence.

### Canvas truth

15. Affected board thumbnails choose the newest surviving image or become null.
16. Open Canvas queries lose deleted nodes after invalidation; no `Source unavailable` card appears.
17. Deleting one placement still leaves the library Cast and other placements intact.
18. Edges from surviving downstream nodes to a deleted Cast are removed without deleting the downstream node.

### Storage truth

19. Duplicate keys produce one cleanup item.
20. Current-bucket URL parsing yields the exact normalized key.
21. External, malformed, legacy CDN and wrong-bucket URLs are never passed to `storageDelete`.
22. Already-missing object seals successfully.
23. Transient failure retries after restart without repeating successful items.
24. Permanent failure remains visible/repairable and never marks the batch fully succeeded.

### UX

25. Delete plan counts match the actual transaction.
26. Minted delete is enabled with permanent plain-English copy.
27. Success removes the Cast from lobby, Studio and every linked board without refresh.
28. Failure restores optimistic UI and shows one honest message.
29. No archive, restore, recovery-window or `Source unavailable` wording survives on the deliberate-delete path.
30. After deletion, `wardrobe.looks.save` and `wardrobe.sessions.create` with the deleted model id refuse and create no row or owned-object orphan.
31. A rename/document update racing the deletion transaction cannot leave a name, identity field or preference on the tombstone; its conditional update affects zero rows and returns typed absence/stale-subject truth.
32. Re-sending a pre-deletion client request id (for example an old iterate request) returns the typed deleted-subject refusal before exposing its old saved result or invoking an executor.

## 7. Explicit exclusions

- No user-facing archive or recovery system.
- No recursive deletion of independent image/video outputs.
- No pin/effective-snapshot migration; that remains R7-6/R7-7.
- No Batch D reference plates/crops yet; their future schema must adopt this cleanup contract.
- No production purge of existing archived rows.
- No deletion of external CDN objects.
- No billing/refund redesign.
- No Wardrobe product redesign beyond removing model-owned sessions/looks under the existing dependency rule.

## 8. Review and authorization sequence

1. Fable reviews this plan and the current code evidence.
2. Apply any plan corrections and ratify R7-5A.
3. Implement/review one bounded batch at a time.
4. Migration 0009 receives its own production authorization.
5. Runtime deployment and public deletion enablement are separate later authorizations.

No destructive code, database write, R2 deletion, migration, push or deployment is authorized by this planning document.
