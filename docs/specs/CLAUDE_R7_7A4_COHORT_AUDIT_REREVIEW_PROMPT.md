# Fable re-review — R7-7A4 cohort-audit surface mapping correction

Read-only re-review of the single blocking correction. Do not edit, stage, commit, push, deploy, run a database audit, run convergence/backfill, or enable snapshot reads.

Baseline remains `3e6a354`. The staged set must remain the same eight R7-7A4 cohort-audit files.

## Prior blocker

The first review correctly found that `MISMATCH_SURFACES` omitted `casting_mint_plan` for:

- `displayed_headshot`;
- `slot_compatibility`.

Both mismatches can change `computeMintIntegrity` / `planMintPackage` truth, so the diagnostic audit could have falsely reported mint planning as unaffected before R7-7B cutover.

## Correction to verify

1. `server/casting/snapshotShadow.ts` now includes `casting_mint_plan` in both mappings:
   - `displayed_headshot`;
   - `slot_compatibility`.
2. Canonical output ordering is still controlled by `SNAPSHOT_SHADOW_SURFACES`, not array insertion order.
3. `server/casting/snapshotShadowAudit.test.ts` behaviorally checks each mismatch in isolation and requires its resulting `affectedSurfaces` to contain `casting_mint_plan`.
4. No other mismatch mapping, comparator rule, cohort selector, CLI behavior, reader, writer, billing path, or runtime surface changed.
5. The staged scope remains exactly the original eight files; this prompt and all private/local files remain unstaged.

## Verification evidence

- `pnpm check` — clean.
- `pnpm exec tsc -p scripts/tsconfig.snapshot-audit.json` — clean.
- Focused pure suites after the correction — 19/19 passed.
- `git diff --cached --check` — clean.
- The prior unchanged evidence remains valid:
  - disposable Railway-development MySQL gate — 43/43 passed and scratch database deleted;
  - full unit suite — 2,538 passed / 151 skipped / 0 failed;
  - production build passed.

## Required verdict

Return exactly one:

- `APPROVE — safe to commit R7-7A4 bounded cohort audit locally`
- `REQUEST CHANGES` with a concrete reachable blocker.

Approval is local-commit scoped only. It does not authorize a production audit, convergence/backfill, snapshot-read cutover, migration, push, deploy, or feature enablement.
