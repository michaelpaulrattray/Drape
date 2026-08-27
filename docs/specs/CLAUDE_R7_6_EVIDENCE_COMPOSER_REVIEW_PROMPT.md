# Fable review prompt — R7-6 evidence-composer design

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are reviewing and improving a design document, not implementing production code.

Repository: `C:\Users\Admin\Drape`  
Baseline: `f926848` on `main`  
Primary document: `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`

Governing sources:

- `docs/specs/CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`
- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`
- `docs/specs/DECISION_LOG.md` — especially D-56, D-62 and D-64

## Task

Challenge the complete R7-6 design against the current codebase. Do not assume the document is correct because it is detailed. Find factual errors, missing writers/readers, impossible constraints, unsafe migration sequencing, concurrency holes, billing ambiguity, storage/deletion gaps, or product contradictions.

You may edit **only** `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md` to apply evidence-backed corrections and improvements that do not require a new founder ruling. Do not edit code, schema, migrations, tests, other specs, settings, or protected/local files.

If a correction changes product behavior or requires founder judgment, do not silently choose it. Add it clearly to the plan's founder-decision section with your recommendation and reasoning.

## Required review

Verify each point from live code and cite exact files/lines in your report.

1. **Current-code evidence**
   - mutable model documents and `identityRevisionId`;
   - anchor vs displayed-headshot selectors;
   - newest-filled package selection, stale flags and pins;
   - copy-forward slot restore;
   - current reference/mask/mark restrictions;
   - current gate/composer behavior;
   - R7 durable operation, credit, deletion and cleanup contracts.

2. **Identity/package split**
   - Does an immutable identity snapshot plus immutable package snapshot actually cover image-only edits, identity edits, per-view restore, whole-Cast restore, late views and mint sealing?
   - Can two mutable current pointers diverge? Is resolving identity through the package head sound?
   - Are `stateVersion`, model lock and package/identity IDs sufficient CAS evidence?

3. **Schema completeness and normalization**
   - Challenge every proposed table, key, unique constraint and index.
   - Find missing ownership/model-consistency constraints.
   - Identify redundant tables or authority hidden in JSON.
   - Ensure no `isCurrent` flag or numeric `<` revision logic can become a second authority.
   - Ensure failed attempts/candidates cannot appear as selected package assets.

4. **History and restore**
   - Prove per-view restore remains package-only.
   - Prove whole-Cast restore creates a new immutable current state without destroying history.
   - Challenge the parent + restored-from DAG and simple chronological UI.
   - Define behavior when a historical selected asset is unavailable.

5. **Bootstrap and pin retirement**
   - Verify existing draft/active/locked/deleted behavior.
   - Verify anchor and displayed-headshot bootstrap are not conflated.
   - Challenge newest-filled migration, stale carry-over, legacy unknown provenance and idempotency.
   - Prove mixed R6/R7 deployments and rollback do not corrupt selection truth.
   - Find every pin consumer that must migrate; distinguish board pins.

6. **Identity evidence and marks**
   - Challenge feature vs feature-version vs snapshot-selection authority.
   - Verify category/zone/surface/side are sufficient and not falsely “proven.”
   - Verify pending creation intent cannot leak into master prose as shadow canon.
   - Verify existing marked models are not guessed/backfilled.
   - Challenge the provisional field-to-authoring-view matrix, especially long hair, build, skin and any-view authoring.

7. **Candidate lifecycle**
   - Prove a candidate is never a model asset, identity anchor or package selection before acceptance.
   - Prove Accept/Retry/Cancel survive reload and another tab.
   - Verify no model lock or running lease is held during user deliberation.
   - Verify accept races, stale candidates, delete races and cleanup ownership.
   - Challenge whether initial mark intent needs its own table or can share candidate state.

8. **Composer and reference budget**
   - Verify one server composer can serve Casting, Canvas, Wardrobe, export and future image/video nodes.
   - Challenge the pilot payload of anchor + target + one evidence input.
   - Identify exactly which D-30/D-39/D-53 clauses require supersession.
   - Verify D-12 provenance is reproducible without claiming reproducible pixels.

9. **Visibility/probe/validation**
   - Challenge predict → compose → generate → probe → validate → resolve.
   - Ensure hidden-zone anti-invention, left/right, occlusion and pose corruption are covered.
   - Ensure `unknown` cannot commit canon and infra failure cannot fail open.
   - Identify where the current back/walk gate must be replaced or retained.

10. **Atomicity and recovery**
    - Trace operations outside and inside transactions.
    - Verify asset promotion, snapshots, evidence selection, model-head CAS and terminal operation truth can commit atomically with current helpers or identify required transaction-aware changes.
    - Challenge recovery/adjudication and every lock-order interaction with mint, refresh, fork and permanent delete.

11. **Billing and idempotency**
    - Challenge every row in the billing table.
    - Specifically assess valid-candidate Cancel, user Retry, included internal retry, probe outage, crop failure, CAS conflict, duplicate submit and accept replay.
    - Ensure ledger references fit current uniqueness/length constraints and every refund records committed truth only.

12. **Storage, deletion and privacy**
    - Inventory every proposed owned key and durable row.
    - Ensure R7-5 final Cast deletion, account erasure, cleanup worker, audit metadata and GDPR export all include them.
    - Verify fork survival; challenge copy-on-fork vs shared ownership.
    - Preserve independent downstream image/video outputs.
    - Preserve the founder's future rule: a user-saved asset-library item is independently owned and survives deletion of its source Canvas or Cast.

13. **Downstream consumers**
    - Inventory every consumer/writer: Cast Profile, Studio, view strip, package details/history, mint, add views, refresh, restore, export/PDF, registry/library, Canvas Cast nodes, linked pop-outs, independent outputs, Wardrobe/VTO, fork/recast/variations, thumbnails, reference sheets, deletion and account export.
    - Identify any current code path the plan forgot.

14. **R7-7 sequencing and feature flags**
    - Verify the batches are truly bounded and rollback-safe.
    - Challenge whether pin retirement can safely happen before composer rollout.
    - Ensure old R6 refusal is the server fallback for every disabled capability.
    - No implementation batch may depend on a later unratified schema shape.

15. **Calibration**
    - Challenge dataset size, zone choice, repeat count, human scoring and provisional thresholds.
    - Separate composition fidelity from micro-linework fidelity.
    - Prevent aggregate success from hiding cohort failures.
    - Do not convert empirical hopes into deterministic claims.

16. **Adjacent initial-casting quality issue**
    - Confirm the recorded sickly/gaunt-output observation is scoped correctly.
    - Check whether it exposes an R7-6 dependency or belongs in R7-8.
    - Do not dismiss it as random without proposing repeated-prompt evidence.

## Boundaries

- Design/document review only.
- No production code, schema, migration or test edits.
- No staging, commit, push, deploy, Railway changes, database access, storage access, feature enablement or live generations.
- Do not touch `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand files, or other `CLAUDE_*` handoff documents.
- Do not reopen founder rulings already recorded in D-62/D-64 unless the live code proves a direct contradiction; surface that conflict explicitly.

## Return format

Start with one verdict:

- `APPROVE — safe for founder ratification`, or
- `REQUEST CHANGES — N blocking finding(s)`.

Then provide:

1. blocking findings with exact code evidence and smallest sound document correction;
2. corrections you applied directly to the R7-6 document;
3. remaining founder decisions with your recommended answer and trade-off;
4. non-blocking implementation cautions;
5. exact files changed and confirmation that nothing was staged/committed or externally contacted.

