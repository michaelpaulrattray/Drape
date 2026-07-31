# Fable review prompt — R7-7A1 snapshot/selection schema

Review the **staged R7-7A1 additive schema diff** against the live Drape codebase and the ratified R7-6 architecture. This is a read-only review. Do not edit, stage, commit, migrate, push, deploy, contact production, or enable any runtime behavior.

Baseline: `09aed73` (`R7-6: ratify evidence composer architecture`).

Governing documents:

- `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`
- `docs/specs/DECISION_LOG.md` — D-65
- `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`
- `docs/specs/CASTING_MODEL_ID_WRITER_INVENTORY.md`

The bounded A1 outcome is deliberately narrow: migration 0010 creates immutable identity/package snapshot schema and nullable operation/model-head fields, while the current R6 runtime remains the only authority. No production reader or writer may use the new schema in this slice.

## Staged scope expected

Exactly these 11 files should be staged:

1. `drizzle/schema.ts`
2. `drizzle/0010_r7_snapshot_selection.sql`
3. `drizzle/meta/0010_snapshot.json`
4. `drizzle/meta/_journal.json`
5. `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
6. `docs/specs/CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`
7. `docs/specs/CASTING_MODEL_ID_WRITER_INVENTORY.md`
8. `server/r7-snapshot-selection-contract.test.ts`
9. `server/r7-snapshot-selection-schema-db.test.ts`
10. `server/r7-cast-deletion-audit.test.ts`
11. `scripts/drive-r7-snapshot-selection-schema-disposable.mts`

Local/private files, brand files, all `CLAUDE_*` prompts (including this prompt), `.agents/`, `.codex/`, and `CLAUDE.local.md` must remain unstaged.

## Verify every point

1. **Migration is additive and mixed-runtime safe.** It creates exactly three tables, adds exactly seven columns and six non-unique indexes, and contains no drop, rename, truncate, delete, backfill, or existing-column alteration. Old 0000–0009 insert shapes must remain valid after 0010.

2. **Schema artifacts agree exactly.** `drizzle/schema.ts`, SQL, `0009_snapshot.json → 0010_snapshot.json`, and the journal must describe the same change. Structurally confirm that the snapshot transition changes nothing else.

3. **Model-head shape matches D-65.** `models.currentPackageSnapshotId`, both seal pointers are nullable; `stateVersion` is non-null with default `0`; only the current package pointer is indexed. Models with no filled headshot may legitimately remain headless.

4. **Operation expectations are rollout-safe.** `expectedStateVersion`, `expectedIdentitySnapshotId`, and `expectedPackageSnapshotId` are nullable so historical receipts and old runtime inserts survive. No existing operation field or idempotency law is weakened.

5. **Identity snapshot contract is complete.** Verify immutable identity-document fields, parent/restore provenance, anchor, hashes, recipe, reason, sequence and operation provenance match §5.2. `createdByOperationId` is nullable only for future bootstrap/backfill; live-user enforcement belongs to A2/A3. `document_compact` is a justified addition because the live compact-prompt writer changes canonical documents and otherwise has no truthful reason.

6. **Package snapshot contract is complete.** One package references one identity snapshot, has model-scoped sequence/parent/reason/operation provenance, and supports package-only history. `image_refine` is a justified addition because live image-only iteration requires an honest package reason.

7. **Explicit slot selection is sound.** There is at most one selected asset per angle and no duplicated selected asset in one package; view angles are the canonical six; compatibility and selection reason are closed vocabularies; missing rows mean missing views; failure markers and future candidate assets cannot be selected merely by this schema.

8. **Constraint boundary is honest.** Database uniqueness/enums enforce what the plan claims. Positive sequence, cross-model ownership, matching view angle, immutable rows, paired identity/package creation, after-mint seal law, and CAS are explicitly deferred to locked A2/A3 services and must not be falsely claimed as DB-enforced. The absence of foreign keys is deliberate for mixed-runtime compatibility and ordered application deletion; challenge whether that creates any reachable A1 hazard while the tables have no runtime writer.

9. **Runtime remains unchanged.** Confirm no production route, DB helper, service, client, shared module, or worker imports or uses the new tables/columns. The source-contract test must genuinely scan runtime TypeScript rather than pinning only one file. No snapshot read flag, evidence feature, paid action, storage path, or UI is enabled.

10. **Deletion/account-erasure inventory is closed before adoption.** The writer inventory must now include both direct `modelId` snapshot tables and the slot dependency. The existing deletion-audit test must intentionally move its direct-model-column count from six to eight. A2/A3 cannot write snapshots until final Cast deletion and account deletion remove slots → package snapshots → identity snapshots before the model row; no snapshot content may enter audit/tombstone metadata.

11. **Inventory is complete against current code.** Challenge every identity/document writer, asset/package writer, newest-filled reader, public/board/export/registry consumer, pin/stale/failure-marker path, operation recovery path, GDPR/deletion path, and the later Wardrobe server-resolution obligation. Look for any writer or reader omitted from the staged inventory.

12. **Disposable proof is genuine and safe.** The runner must accept only the development Railway database named `railway`, refuse production app ids, refuse stale prefixed scratch databases, create/drop only its fresh `drape_r7_7a1_disposable_*` database, apply 0000–0009, seed legacy rows, apply exactly 0010, run real MySQL tests, and drop its database in `finally`. It must never call storage, Gemini, Stripe, or production runtime routes.

13. **Real-DB tests prove the load-bearing behavior.** Confirm they prove pre-0010 rows survive with null pointers/state `0`, old insert shapes work, one valid snapshot/package/slot state works, duplicate identity sequence/slot angle/slot asset and unknown enum values fail at MySQL. Challenge whether an important migration or constraint case remains untested.

14. **No migration-before-runtime reversal.** A2 must remain blocked from deployment until 0010 is separately applied to production. This review must not authorize that migration or any deploy.

15. **No hidden R7-6 feature scope.** There must be no candidate, evidence, tattoo/ink, plate/crop, whole-Cast restore, composer, pin-removal, snapshot-UI, auto-refresh, charge, refund or cleanup-worker implementation in A1.

16. **Verification and hygiene.** Re-run `pnpm check`, the focused tests, `git diff --cached --check`, and inspect staged/untracked scope. You may read the recorded disposable proof, but do not contact any database during this read-only review.

Recorded executor verification on the exact pre-staging content:

- `pnpm check` — clean.
- focused local suites — 23 passed / 4 disposable-DB tests skipped without `TEST_DATABASE_URL`.
- guarded disposable development-MySQL drive — 8/8 passed; scratch database `drape_r7_7a1_disposable_1784699244596_653b49` visibly dropped in `finally`.
- full unit suite — 2,501 passed / 116 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- standalone strict typecheck of the disposable runner — clean.
- `git diff --check` — clean.

## Required verdict

Return exactly one of:

- `APPROVE — safe to commit R7-7A1 locally and proceed to the separate production migration-0010 gate`
- `REQUEST CHANGES` with each concrete, reachable blocker, code evidence, product consequence, and the smallest sound correction.

List non-blocking observations separately. Do not turn polish, later A2/A3 enforcement, or intentionally deferred evidence-composer features into blockers unless the staged A1 diff creates a present reachable safety or migration failure.
