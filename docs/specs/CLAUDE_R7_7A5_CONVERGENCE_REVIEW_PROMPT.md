# Fable review — R7-7A bounded snapshot convergence

Read-only review only. Do not edit, stage, commit, push, deploy, run migrations,
run the convergence CLI, contact production, enable snapshot reads, or run the
disposable database driver.

## Baseline and exact scope

- Baseline: `9ecee40` (`R7-7A4: compare snapshot consumer decisions`)
- Expected staged files, exactly six:
  - `server/casting/snapshotConvergence.ts`
  - `server/casting/snapshotConvergence.test.ts`
  - `scripts/converge-cast-snapshots.ts`
  - `scripts/tsconfig.snapshot-convergence.json`
  - `server/r7-snapshot-bootstrap-db.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
- `server/routes/emailVerification.ts` has a separate intentional unstaged
  sender/reply-to change. It must remain outside this review and commit.
- R6 remains the only live read authority.
- Nothing in this slice is routed, scheduled, deployed, or automatically run.

## Product purpose

R7-7A already has the additive schema, lazy bootstrap, dual-write adopters,
structural parity, consumer-decision parity, and a bounded read-only audit.
Quiet Casts that receive no R7-aware write still need a deliberately operated,
convergent backfill before founder-only snapshot reads can be considered.

This slice adds that missing private tool:

1. select an explicit user/model cohort;
2. require the operator's exact expected model count;
3. perform a read-only preflight parity audit;
4. only under a separate apply ceremony, call the already-reviewed
   model-row-locked `bootstrapModelSnapshot` once per fixed subject;
5. perform a postflight audit over the same frozen model ids;
6. report success only when every model completed and every subject is in
   parity.

It deliberately provides no full-database mode and no automatic execution.

## Required challenges

1. **No live reachability.** Confirm there is no route, client, worker,
   scheduler, server startup hook, package script, or production reader that
   invokes convergence. The only script entry point is the explicit CLI.

2. **Read-only default.** With no `--apply`, the CLI may enumerate and compare
   the bounded cohort but must never call bootstrap or perform any write.
   Mismatches should produce attention exit code 2, not silently pass.

3. **No unbounded cohort.** A positive `--user-id`, at least one positive
   `--model-id`, or their intersection is mandatory. There is no `--all`.
   Archived and tombstoned models remain excluded by the shared live-model law.

4. **Exact count fence.** `--expected-model-count` is mandatory and positive.
   A mismatch must refuse before the first bootstrap write. Verify the real
   MySQL test proves zero snapshot rows on this path.

5. **Frozen cohort.** After enumeration, preflight, bootstrap, and postflight
   must use the same sorted model-id cohort. A model created later under the
   selected user must not silently join the active write batch.

6. **Intersection and ownership.** When both user and model selectors are
   supplied, they intersect. Each subject's real server-owned `userId` is read
   from the model row and passed to bootstrap; no caller supplies ownership for
   an individual model.

7. **Apply ceremony for every environment.** Every write run requires all of:
   `--apply`, `--allow-convergence-write`, an exact `--confirm-app-id`, exact
   `--confirm-host` including port, exact `--confirm-database`, and exact
   expected count. Challenge all bypasses and flag-order cases.

8. **Extra production fence.** An app id containing `production` additionally
   requires `--allow-production-convergence`; read-only production planning
   separately requires `--allow-production-read-only`. Production write
   authorization must be invalid without `--apply`.

9. **No direct snapshot writer.** The convergence service itself may enumerate
   models and read shadow parity, but its only write authority must be the
   reviewed `bootstrapModelSnapshot`. It must contain no direct snapshot
   insert/update/delete, credit, storage, provider, or lock implementation.

10. **Bootstrap law retained.** Each model converges in its own existing
    transaction under its model row lock. Headless models remain headless;
    current models replay without appending; missing/stale draft heads converge;
    corrupt heads and sealed-identity violations fail closed.

11. **Cohort atomicity is not overclaimed.** This is intentionally convergent
    per model, not one enormous all-model transaction. A later model may fail
    after earlier models committed. The result must name each bounded model id,
    mark only a closed `bootstrap_failed` code, claim `success: false`, and be
    safely rerunnable.

12. **No raw error leakage.** Per-model bootstrap catches must not expose raw
    database text, prompts, schemas, preferences, URLs, storage keys, names, or
    model identity content. Reports may carry model ids, counts, closed states,
    hashes, and closed error codes only.

13. **Postflight is load-bearing.** Success requires: no failed per-model
    result, the postflight cohort still has the exact expected count, and
    `mismatchedModels === 0`. A completed bootstrap alone is never enough.

14. **Race honesty.** Challenge model deletion/archive, concurrent R7 writer,
    a model appearing after enumeration, a subject disappearing before
    postflight, and database disconnects. The model lock/CAS must arbitrate
    per-model races, while count/parity prevents false whole-cohort success.

15. **Replay/idempotency.** Re-running the same cohort after success must return
    `current`/`headless` and append no identity/package rows. Proven against
    real MySQL.

16. **CLI lifecycle.** `DATABASE_URL` is set only for the bounded process,
    shared DB connections are awaited and closed in `finally`, and the process
    exits 0 only for clean read-only parity or successful apply, 2 for honest
    attention, 1 for invocation/runtime failure.

17. **Caller guards.** The A3 transition-writer allowlist must remain unchanged.
    The private shadow caller list gains only `snapshotConvergence.ts`.
    Exactly one script may import `snapshotConvergence`. Source guards must
    reject direct writes, storage, billing, or provider authority.

18. **Disposable proof.** Verify the three new real-MySQL cases genuinely call
    production `planSnapshotConvergence`/`convergeSnapshotCohort` and prove:
    read-only plan writes nothing; headed+headless apply reaches parity; replay
    appends nothing; count mismatch writes nothing; corrupt-model failure is
    bounded, sanitized, and cannot claim parity.

19. **No behavior/cutover expansion.** No schema, migration, client, route,
    flag, billing, storage, Wardrobe, evidence composer, deletion, reader
    cutover, or production configuration changes are present.

20. **Scope hygiene.** Exactly the six expected files are staged. The
    intentional email sender change and all protected/local/review files remain
    unstaged.

## Verification evidence

- `pnpm check` — clean.
- `pnpm exec tsc -p scripts/tsconfig.snapshot-convergence.json` — clean.
- Focused pure/contract suites — 26/26 passed.
- The three new disposable Railway-development MySQL convergence cases all
  passed against the real production functions:
  - plan → headed/headless converge → parity → replay;
  - expected-count refusal before writes;
  - per-model corrupt-head failure with sanitized result and no false parity.
- The disposable driver was deliberately stopped after those new cases passed
  because it continued into the multi-minute historical transition matrix.
  Its one regex-guarded scratch database was then explicitly dropped, and all
  confirmed driver/Vitest processes were stopped; no scratch database or test
  process remains. Do not overstate this as a complete rerun of every historical
  disposable case.
- Full unit run: 2,544 passed / 154 environment-gated skipped; three unrelated
  five-second dynamic-import timeout flakes
  (`batch3-hardening`, `velocityLimits`, `emailVerification`) failed under full
  parallel load, then all three files passed in isolation, 28/28.
- `pnpm build` — passed.
- `git diff --check` — clean.

## Required verdict

Return exactly one:

- `APPROVE — safe to commit R7-7A bounded convergence locally`
- `REQUEST CHANGES` with concrete reachable blockers, product impact, code
  evidence, and the smallest sound correction.

List non-blocking observations separately. Approval is local-commit scoped
only. It does not authorize running this tool against development or production,
running the production audit, convergence/backfill, snapshot read cutover,
push, deploy, migration, feature flags, or later R7-7 work.
