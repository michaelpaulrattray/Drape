# Fable review — R7-5 permanent Cast deletion plan

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform a read-only architecture and code-evidence review of the proposed R7-5 deletion policy and execution plan.

Read completely:

1. `docs/specs/CASTING_SYSTEM_R7_5_FINAL_DELETION_EXECUTION_PLAN.md`
2. the amended R7-5 and founder-ruling sections in `docs/specs/CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`
3. D-62, D-63 and new D-64 in `docs/specs/DECISION_LOG.md`
4. B5 and read-surface corrections in `docs/specs/IDENTITY_WRITER_INVENTORY.md`

Baseline: `9e09b01`.

This is a plan review, not implementation. Do not edit, stage, commit, migrate, push, deploy, contact production, delete database rows, or call storage deletion.

## Founder product direction

- No user-facing archive, 30-day recovery, restore ceremony or deletion undo.
- A confirmed delete is permanent for drafts and minted Casts.
- Remove the Cast, its complete view package, direct Canvas roots/library placements/popped Cast views, and linked Wardrobe sessions/looks.
- Do not leave `Source unavailable` placeholders for a deliberate deletion.
- Preserve independent downstream images/videos rather than recursively erasing unrelated creative work.
- Keep the interface simple; internal safety must not become user-facing lifecycle bureaucracy.

The plan recommends an immediate atomic database disappearance plus a scrubbed internal tombstone/receipt and durable asynchronous owned-R2 cleanup. The tombstone is non-recoverable and exists only for replay, double-charge, accounting and security integrity.

## Review every claim against current code

### A. Dependency inventory completeness

Confirm or correct every finding F1–F14. Search beyond the named files for all model id, model asset URL/storage key, Canvas provenance, board thumbnail, generation, operation, Wardrobe, export, bug-report, audit, GDPR/account-deletion and public registry dependencies.

Specifically challenge whether the plan misses:

- JSON-only `cast_view` rows created by pop-out;
- soft-deleted Canvas rows that could be undone;
- board-item versions or metadata inputs that retain exact model-asset URLs;
- incident edges and downstream nodes;
- stored board thumbnails;
- operation results that can replay before model lookup;
- generation prompts/input/result URLs;
- Wardrobe history JSON or saved-look URLs;
- any persisted PDF/ZIP/export derivative;
- current and legacy owned-storage URL shapes;
- account/GDPR collectors with contradictory behavior.

### B. Product-boundary coherence

Verify the plan cleanly distinguishes:

- direct Cast representations, which are deleted;
- independent downstream creative outputs, which survive;
- a minimal internal receipt, which is not recoverable content or a product archive.

Flag any reachable case where deleting a Cast would unexpectedly destroy an unrelated paid creation, or where a direct Cast view would survive.

### C. Atomicity and races

Challenge the proposed model-lock + one-transaction boundary:

- Does the existing model operation lock exclude every paid/model-mutating door?
- Can board-node work, generation settlement, Studio rejoin, or cross-tab replay write after deletion?
- Can the cleanup worker observe a manifest before database commit?
- Can a transaction failure leave cleanup items pointing at live content?
- Can two client request ids delete twice or create divergent manifests?
- Is the current delete operation safely excluded from prior-receipt scrubbing and still replayable as success?

### D. Tombstone and operation scrubbing

Determine whether retaining a fully scrubbed `models` row with legacy `status="archived"` plus `deletedAt` is the smallest sound compatibility design, or whether it creates a reachable leak/semantic conflict.

Verify the allowed receipt fields are sufficient for:

- payload collision detection and exactly-once behavior;
- charged/refunded accounting truth;
- refusing stale replays before returning deleted URLs;
- public registry absence;
- GDPR/privacy expectations.

Identify every field that must be scrubbed but the plan omitted. Do not propose a recoverable archive unless unavoidable for a concrete invariant.

### E. Owned-storage authority

Challenge the two-table cleanup architecture and exact-origin rule:

- Only explicit keys or URLs whose origin exactly matches configured `R2_PUBLIC_URL` may authorize deletion.
- Legacy Manus/CDN and wrong-bucket URLs are scrubbed from records but never sent to `storageDelete`.
- Duplicate keys delete once.
- Missing objects count as success.
- transient failures retry safely after crashes;
- failed items stay repairable;
- successful keys are removed/scrubbed from the cleanup tables rather than retained forever.

Flag SSRF, path-normalization, cross-bucket, encoded-path, or shared-object-reference hazards.

### F. Canvas semantics

Verify the source-model index/backfill plus ID/provenance/URL matching is sufficient and does not over-delete. Check that:

- all direct Cast nodes disappear across all boards;
- versions/edges are removed in referential order;
- independent downstream nodes survive;
- exact deleted-input URLs are scrubbed from surviving metadata;
- affected thumbnails are recomputed or cleared atomically;
- impossible cross-owner references fail closed.

### G. Batch order and gates

Confirm R7-5A through R7-5F put schema before runtime, migration before deployment, worker before product enablement, and read-only production audit before any destructive action.

Check that `ENABLE_STORAGE_CLEANUP_WORKER` and `ENABLE_FINAL_MODEL_DELETE` are separate rollout gates and that no batch quietly authorizes legacy archived-row purge.

### H. Verification quality

Review all 29 required tests. Add only missing tests that prove a reachable invariant. Distinguish mock/unit coverage from disposable-MySQL, storage-simulation, headless UI and founder manual gates.

## Required response

Return one:

- `APPROVE — safe to ratify the R7-5 execution plan`
- `REQUEST CHANGES` with concrete reachable blockers, exact code evidence, and the smallest sound plan correction.

List non-blocking polish separately. Do not implement anything and do not expand into R7-6 composer work.
