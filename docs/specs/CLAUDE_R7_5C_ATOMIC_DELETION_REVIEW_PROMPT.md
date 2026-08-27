# Fable review — R7-5C atomic final Cast deletion

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform a read-only review of the **complete staged R7-5C diff** against baseline commit `6492bdb`.

This is a high-risk deletion, privacy, concurrency, and data-integrity review. Do not rely on the executor's summary or green tests. Read the staged implementation, the surrounding unchanged production code, and the governing documents directly:

- `docs/specs/CASTING_SYSTEM_R7_5_FINAL_DELETION_EXECUTION_PLAN.md`
- `docs/specs/CASTING_MODEL_ID_WRITER_INVENTORY.md`
- D-64 in `docs/specs/DECISION_LOG.md`
- migration/schema contract already committed in R7-5B (`6492bdb`)

The intended product ruling is simple permanent deletion: no 30-day recovery, no Source-unavailable placeholder nodes, and no storage deletion inside the request transaction. The public R7-5C route remains drafts-only; the shared atomic service must already support draft, active, and legacy locked Casts for the later UI gate.

## Required verification

Verify all of the following against reachable code paths.

1. **Public authority and scope**
   - `models.delete` still accepts only owned draft Casts in R7-5C.
   - The route uses a durable `model.delete` operation and the model operation lock.
   - The shared deletion service itself handles draft, active, and locked Casts without separate destructive implementations.
   - Foreign owners receive non-leaking refusal and no deletion receipt or manifest is created.

2. **Replay and deleted-subject truth**
   - An identical replay of the delete request returns success without repeating work.
   - Any older request id whose subject was deleted returns the typed `deleted_subject` outcome before provider, credit, or mutation work.
   - Old terminal operation results cannot leak deleted model/image/name/prompt data through operation reads.
   - The current delete receipt remains the minimal replay authority and does not get scrubbed into an unusable state.

3. **Locking and concurrency**
   - The delete requires the matching running receipt and owns `model:<id>`.
   - Two concurrent deletes can create at most one cleanup manifest and one successful deletion.
   - A writer that wins first is discovered and scrubbed; a delete that wins first fences the writer.
   - Lock ordering is consistent enough to avoid writer/delete deadlocks, including Canvas landing and model binding.
   - A prior claimed/running/recovery-required operation refuses deletion without scrubbing or stealing its lock.

4. **One atomic database transaction**
   - Cleanup manifest rows are persisted before destructive row mutation.
   - Canvas repair, dependency cleanup/scrub, model tombstone, audit event, and successful delete receipt finalize in one transaction.
   - Failure at each injected boundary (`after_manifest`, `after_canvas`, `after_dependencies`, `before_tombstone`, `before_receipt`) rolls back every database effect, including manifest rows and receipt finalization.
   - Route-level failure finalization releases the delete operation lock honestly.
   - Deletion never writes the credit ledger and reports zero charged/refunded credits.

5. **Canvas product behavior**
   - Direct `sourceModelId` and recognized Cast-provenance placements for the deleted model are removed, including soft-deleted placements, their versions, and incident edges.
   - Downstream independent nodes survive; dangling `parentItemId` links are cleared.
   - URL-only historical matches remove only matching versions, promote the newest independent survivor, and delete the node only when no independent version remains.
   - Cross-owner references fail closed rather than deleting another user's content.
   - Affected board thumbnails are recomputed from surviving board truth or cleared to null.
   - No `Source unavailable` placeholder behavior remains.

6. **Dependency and privacy scrub**
   - Wardrobe sessions/looks/assets, generation attempts, bug reports, audit logs, prior operation receipts/locks, model assets, and relevant Canvas pointers are handled per D-64.
   - Security/audit history may keep non-content identifiers and counts but not name, agency id, prompts, schema, preferences, image URLs/keys, error text, or result payloads.
   - Prior terminal operation accounting/status/timestamps may survive, while content-bearing subject/result/error/landing fields are scrubbed and `subjectDeletedAt` is set.
   - The model tombstone is exact: archived + deleted timestamp, name/agency/revision/minted timestamp cleared, prompt/schema/preferences replaced with non-identifying tombstone values.

7. **Storage manifest ownership law**
   - The request path performs **no R2/storage deletion or external storage call**.
   - Only server-owned, exact, attributable output keys are queued.
   - Arbitrary metadata URLs, error/public-message text, temporary/shared reference inputs, stale board thumbnail keys, external hosts, malformed keys, and uncertain origins are never queued.
   - Cleanup rows are durable before content is scrubbed so R7-5D can later delete only the recorded owned keys.

8. **Every durable model-reference writer is fenced**
   - Generic Board add/add-many/update, direct Board stamp/place/fill, Wardrobe session/look, bug report, generation-operation claim/bind, model updates/mint, and identity commits cannot introduce or mutate references to a deleted/archived/foreign subject.
   - Recognized JSON Cast provenance is validated; malformed recognized provenance and direct-column-versus-JSON disagreement refuse.
   - `bindGenerationOperationModel` closes the newly-created-model-visible-before-bind race.
   - Conditional model-row updates use affected-row truth; they do not trust an earlier read.
   - Upload-only Wardrobe sessions with `modelId = null` remain valid.

9. **Read model**
   - Ordinary model/library/status reads hide tombstones consistently.
   - Deleted models cannot be reopened through an old ID or agency id.
   - Historical linked Canvas nodes are removed rather than degraded into an empty unavailable card.

10. **Tests and verification quality**
    - The real-MySQL suite genuinely exercises the production service, operation claim/lock paths, writer fences, races, replay, credit conservation, Canvas repair, and all rollback boundaries.
    - The disposable runner refuses production, creates only a uniquely prefixed scratch database, applies migrations only there, and drops only that database in `finally`.
    - Older test-double corrections return real affected-row truth or explicitly mock newly fenced domain primitives; they must not weaken production assertions to obtain green tests.
    - No protected/local files, prompts, brand files, unrelated product work, migration, storage worker, push, deploy, or feature enablement are staged.

## Executor verification evidence to independently reproduce or challenge

- `pnpm check` — clean.
- Focused/source suites — green.
- Full unit suite — 2,490 passed, 105 environment-dependent skipped, 0 failed.
- `pnpm build` — passed.
- Guarded disposable MySQL gate — 13/13 passed; scratch database visibly dropped.
- `git diff --cached --check` — must be clean after staging.

## Required response

Return exactly one of:

- `APPROVE — safe to commit R7-5C locally`
- `REQUEST CHANGES` followed by concrete, reachable blocking findings with file/line evidence and the smallest sound correction.

List non-blocking observations separately. Challenge the architecture where warranted; do not approve from test results alone.

Read-only review only. Do not edit, stage, commit, push, deploy, run a production audit, contact production storage, or enable deletion UI.
