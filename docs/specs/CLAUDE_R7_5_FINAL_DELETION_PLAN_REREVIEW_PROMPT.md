# Fable re-review — R7-5 deletion-plan corrections

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Re-review the corrected staged R7-5 planning documents read-only. This is not implementation.

Primary document: `docs/specs/CASTING_SYSTEM_R7_5_FINAL_DELETION_EXECUTION_PLAN.md`

Also inspect the small corresponding amendments in:

- `docs/specs/CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`
- `docs/specs/DECISION_LOG.md` (D-64)
- `docs/specs/IDENTITY_WRITER_INVENTORY.md` (B5)

Baseline remains `9e09b01`. Do not edit, stage, commit, migrate, push, deploy, contact production, delete rows, or call storage deletion.

## Verify the blocking write-fence correction

1. The plan no longer claims the model operation lock covers every model-linked writer.
2. F15 records the three proven holes accurately:
   - `wardrobe.sessions.create` accepts an unvalidated optional model id;
   - `wardrobe.looks.save` accepts an unvalidated model id;
   - `models.update` can race because `updateModel` writes by id without an alive predicate.
3. §4.6 requires the smallest sound fence:
   - supplied Wardrobe model ids must be owned and available at the durable insertion boundary;
   - supplied look sessions must be owned and consistent with the same alive model;
   - model-row updates must include `deletedAt IS NULL`/available-status in their UPDATE predicate, not rely on a previous check;
   - R7-5A inventories every other model-id writer and records either a model lock or owned/alive durable-write predicate.
4. R7-5C makes the fence part of the deletion batch rather than optional later polish.
5. Matrix tests 30 and 31 prove post-delete Wardrobe insertion and racing model update cannot repopulate the tombstone or orphan owned content.

## Verify the missing replay test

6. Matrix test 32 proves replaying a pre-deletion request id returns typed deleted-subject refusal before its saved result is exposed and before any executor/provider/credit work.
7. The delete operation's own identical replay remains idempotent success; the two cases are not conflated.

## Verify factual/non-blocking corrections were incorporated safely

8. F4 now states current `executeCreateNode` stamps `sourceModelId`; backfill/audit is historical repair.
9. F8 names the real `generations` fields: `modelId`, `resultUrl`, `errorMessage`, `metadata`; it does not invent prompt/inputUrl columns.
10. Reference-image URLs are scrubbed from the deleted Cast, but a possibly shared reference object is not queued unless exclusive ownership and zero surviving references are proven.
11. URL-equality-only Canvas matches preserve unrelated history by dropping matching versions and promoting the newest surviving independent version; the node is deleted only if none survives. ID/provenance-linked Cast nodes are still deleted outright.
12. Explicit storage keys remain preferred. Historical public origins must be audited and separately proven/configured rather than accepted implicitly.
13. Model-less Wardrobe generation attempts are explicitly scoped to the account/GDPR path, while saved look/session URLs are collected through their linked rows.
14. Successful cleanup keys are eventually purged/scrubbed from cleanup items rather than retained forever.

## Challenge for remaining blockers

Check whether any reachable model-linked writer can still commit after tombstoning, whether the conditional update law can be implemented consistently without weakening identity commits, and whether any correction introduces over-deletion or shared-object deletion.

Return one:

- `APPROVE — safe to ratify the R7-5 execution plan`
- `REQUEST CHANGES` with one or more concrete reachable blockers, exact evidence, and the smallest sound plan correction.

List non-blocking observations separately. Do not implement anything.
