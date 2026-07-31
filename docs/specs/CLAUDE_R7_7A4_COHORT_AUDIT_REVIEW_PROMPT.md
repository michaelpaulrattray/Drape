# Fable review — R7-7A4 bounded shadow cohort audit

Read-only review only. Do not edit, stage, commit, push, deploy, run a production audit, run convergence/backfill, or enable snapshot reads.

## Baseline and scope

- Baseline commit: `3e6a354`
- Review the complete staged diff.
- Expected staged files:
  - `server/casting/snapshotShadow.ts`
  - `server/casting/snapshotShadowAudit.ts`
  - `server/casting/snapshotShadowAudit.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
  - `server/r7-snapshot-transitions-db.test.ts`
  - `scripts/audit-cast-snapshot-parity.ts`
  - `scripts/tsconfig.snapshot-audit.json`
  - `scripts/drive-r7-snapshot-bootstrap-disposable.mts`
- Governing plan:
  - `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`, especially R7-7A4 and §3.
- The already-approved private comparator foundation at baseline remains read-only and R6 remains authoritative.

## Product intent

This slice adds the first operational shadow-parity audit for explicit founder/test cohorts. It does **not** change any live Studio, Library, Canvas, plan, export, or model reader.

The audit must:

- run the existing R6-versus-snapshot comparator over an explicitly bounded cohort;
- use one consistent database transaction for the cohort;
- report only ids, counts, booleans, closed enums, and hashes;
- explain which future reader surfaces could be affected by each mismatch;
- refuse accidental full-database scans;
- remain private operator tooling with no route, client, worker, scheduler, automatic invocation, repair, backfill, or spending;
- leave R6 as the sole read authority.

## Required challenges

Verify each point against reachable production code, not just the tests.

1. **No live adoption.** No route, client, background worker, scheduler, startup hook, or production reader calls the cohort comparator or audit. Snapshot reads remain disabled.
2. **Read-only authority.** The cohort comparator and script perform only database reads. They contain no insert/update/delete, row lock, credit, storage, Gemini/provider, Slack, mutation, convergence, or backfill path.
3. **Mandatory bounded selector.** Both the CLI parser and database primitive refuse when neither `userId` nor at least one `modelId` is supplied. There is no `--all` or implicit whole-database fallback.
4. **Selector semantics.** `userId` selects only that user's live, non-archived, non-tombstoned Casts; `modelIds` are deduped and sorted; supplying both intersects them. Model-id-only mode is trusted operator selection and may include multiple owners without exposing their identity content.
5. **One consistent view.** All selected models are enumerated and compared inside one `withTransaction` call. No model is compared from a later independent database moment.
6. **Comparator parity.** Every model report still derives R6 truth through the already-approved `deriveBootstrapState` path and compares it with the current snapshot head. The cohort wrapper does not duplicate or weaken comparator rules.
7. **Closed output.** Reports and summaries contain only the approved safe fields: ids, counts, booleans, state/head enums, mismatch enums, affected-surface enums, and SHA-256 hashes. No names, prompts, schemas, preferences, URLs, storage keys, raw metadata, user email, or credentials appear.
8. **Safe errors/logging.** CLI startup output prints only app id, database host, and database name—not URL credentials. Review whether the caught database error message could reveal secrets; request a correction if a reachable error can echo credentials, prompts, URLs, or keys.
9. **Determinism.** Model reports are sorted by model id. Model ids are deduped. All mismatch and affected-surface outputs follow closed canonical order. Zero-count enum entries remain present so two audit runs are mechanically comparable.
10. **Surface mapping completeness.** Challenge every mismatch-to-surface mapping against the actual future consumers named by the plan:
    - identity profile;
    - package/view state;
    - mint planning;
    - refresh planning;
    - export;
    - Canvas/library selections;
    - model registry;
    - mint seal.
    Conservative over-inclusion is acceptable; a consumer that could show, plan, charge, export, or select the wrong truth must not be omitted. Pay special attention to `slot_compatibility`, displayed headshot, identity-document drift, and seal mismatches.
11. **No false authority from mapping.** `affectedSurfaces` is diagnostic only. Nothing routes, blocks, repairs, charges, refreshes, or changes UI based on it.
12. **Archived/deleted privacy.** Cohort enumeration excludes archived and tombstoned Casts before comparison. User-scoped selection cannot reveal another user's model existence. The existing single-model comparator's non-leaking behavior is unchanged.
13. **Production fence.** The CLI requires explicit `--database-url` and `--app-id`; an app id containing `production` also requires `--allow-production-read-only`. Decide whether this is a sufficient read-only founder gate for this slice or whether a reachable misconfiguration needs an additional host/database fence.
14. **Process and connection cleanup.** The audit closes the shared DB pool in `finally`. The disposable transition suite reconnects its direct mysql2 connection per test so a long Railway proxy session cannot cascade failures.
15. **Disposable cleanup durability.** The guarded runner still creates/drops only a regex-verified `drape_r7_7a2_disposable_*` database. Cleanup uses a fresh connection and now retries transient Railway proxy failures up to five times. It must never enumerate-and-delete stale databases or broaden its deletion scope.
16. **Failure exit truth.** Audit exit is `0` only for zero mismatched models, `2` when any audited model mismatches, and `1` on validation/runtime failure. An empty but valid explicit cohort returns a zero-count parity report rather than inventing a mismatch.
17. **Standalone type safety.** `scripts/audit-cast-snapshot-parity.ts` is covered by `scripts/tsconfig.snapshot-audit.json`; the documented command must pass under the project's strict settings.
18. **Caller guards.** The contract test pins the only server importer to `snapshotShadowAudit.ts` and the only script importer to `audit-cast-snapshot-parity.ts`, while the pre-existing runtime adopter allowlist for `snapshotTransitions.ts` remains unchanged.
19. **No regression.** Snapshot transition writers, receipt expectations, billing, storage ownership, deletion, evidence composer, Wardrobe, and all live readers are unchanged.
20. **Scope hygiene.** Exactly the eight expected implementation/test files are staged. `.agents/`, `.codex/`, `CLAUDE.local.md`, brand files, this review prompt, and unrelated handoff prompts remain unstaged.

## Verification evidence to reproduce safely

- `pnpm check` — clean.
- `pnpm exec tsc -p scripts/tsconfig.snapshot-audit.json` — clean.
- Focused local suites — 17 passed / 26 environment-gated skipped / 0 failed.
- Guarded disposable Railway-development MySQL gate — 43/43 passed; exact scratch database confirmed dropped.
- Full unit suite — 2,538 passed / 151 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --cached --check` — clean.

Do not rerun the disposable DB gate during this read-only review; inspect its code and recorded evidence instead.

## Required verdict

Return exactly one:

- `APPROVE — safe to commit R7-7A4 bounded cohort audit locally`
- `REQUEST CHANGES` with a concrete reachable blocker, evidence, product impact, and the smallest sound correction.

Approval is local-commit scoped only. It does not authorize running this audit against production, convergence/backfill, snapshot-read cutover, migration, push, deploy, or feature enablement.
