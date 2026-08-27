# Fable Run Review — R7-7B7 Stale-View Copy Deployment

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are the independent, read-only reviewer for the narrowly bounded deployment
that follows the approved R7-7B7 stale-view copy correction.

Review the exact repository and production boundary below and decide whether it
is safe to push and deploy. Do not edit, stage, commit, push, deploy, change a
Railway variable, query a database, control a browser, run convergence, clear
pins, or perform any product action during this review. Read-only Git and
Railway inspection plus local typecheck/test commands are allowed.

## Required verdict

Return exactly one:

- `APPROVE — safe to push and deploy the R7-7B7 stale-view copy correction`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound
  correction

Approval may cover only one push of local `main` to
`origin/local-migration`, the resulting Railway deployment of the exact
reviewed commit, and passive health checks. It must not authorize a scope
change, browser verification, pin planning/apply, cohort expansion, `all`, a
migration, a database query, generation, credits, storage work, or later R7
work.

## Exact repository state

- Local candidate HEAD:
  `5abde1e78d4643a866e8029b7b91fc11002cac3f`
- Current `origin/local-migration`:
  `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`
- Candidate range:
  `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03..5abde1e78d4643a866e8029b7b91fc11002cac3f`
- That range must contain exactly one commit:
  `R7-7B7: correct snapshot stale-view copy`
- That commit must change exactly:
  - `server/casting/identity/refusalCopy.ts`
  - `server/casting/identity/mintIntegrity.test.ts`
- It must be exactly the independently approved copy-only correction:
  remove `(unpin first if pinned)` from the ordinary stale mint refusal and
  add the regression assertion that ordinary stale copy does not contain
  `unpin`.
- The separate pinned-stale copy and behavior must remain unchanged.
- The intentional working-tree changes to
  `server/routes/emailVerification.ts` and
  `docs/specs/DECISION_LOG.md` remain unstaged and outside the commit.
- Private/local files, brand documents, plans, and review prompts remain
  untracked and outside the commit.

Verify these facts independently. Do not rely only on this summary.

## Current production state

- Project: `drape-production`
- Project ID: `24aa4ff2-4184-4ba6-8ce2-61f79454fdd5`
- Environment: `production`
- Environment ID: `a8a8edd9-deae-4aa3-9520-da0eb7534761`
- App service: `Drape`
- App service ID: `f613b5f2-f0ef-4256-b123-2e47a694c8b3`
- Production branch: `local-migration`
- Current successful deployment ID:
  `caa8e78e-a571-4047-844f-7e60d42640f7`
- Current deployed commit:
  `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`
- Current scope must remain exactly:
  `R7_SNAPSHOT_READ_SCOPE=users:1`
- Public URL:
  `https://drape-production-0232.up.railway.app`
- Full R6 rollback build remains: `c35f677`

Production is healthy and snapshot reads are enabled only for founder user 1.
The prior authenticated browser pass stopped on misleading ordinary-stale copy
before Export, Wardrobe, or Canvas. It performed no mutation, generation,
credit, storage, pin, or provider action.

## Local evidence already recorded

Against exact candidate HEAD `5abde1e78d4643a866e8029b7b91fc11002cac3f`:

- `pnpm check` — clean.
- Focused suites — 33 passed / 0 failed:
  - `server/casting/identity/mintIntegrity.test.ts`
  - `server/r7-strip-first-package-care.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
- `git diff --cached --check` was clean before the approved local commit.
- The correction received the independent verdict:
  `APPROVE — safe to commit the R7-7B7 stale-view copy correction locally`.

Treat this as supporting evidence, not a substitute for inspecting the commit.

## Exact operation proposed after approval

1. Recheck that local HEAD is exactly
   `5abde1e78d4643a866e8029b7b91fc11002cac3f`.
2. Recheck that `origin/local-migration` is exactly
   `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`.
3. Recheck that the range contains exactly the reviewed one-commit/two-file
   correction.
4. Recheck Railway's latest Drape deployment is terminal `SUCCESS`, is
   deployment `caa8e78e-a571-4047-844f-7e60d42640f7`, and carries commit
   `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`.
5. Recheck no other production deployment is in a non-terminal state.
6. Recheck the Drape app variable is exactly
   `R7_SNAPSHOT_READ_SCOPE=users:1`.
7. Push exactly:
   `git push origin main:local-migration`
8. Wait for a new Railway Drape deployment not present in the pre-push
   deployment-id set.
9. Require that new deployment to carry exact commit
   `5abde1e78d4643a866e8029b7b91fc11002cac3f`.
10. Wait until it reaches a terminal state; only `SUCCESS` passes.
11. Recheck `R7_SNAPSHOT_READ_SCOPE` remains exactly `users:1`.
12. Require:
    - `GET /api/health` returns HTTP 200;
    - response `status` is `healthy`;
    - `checks.database.status` is `up`;
    - `GET /` returns HTTP 200.
13. Stop. Do not open or control a browser. Restarting the authenticated
    founder browser verification is the next separately reviewed operation.

The executor must not mutate a Railway variable as part of this deployment.
The push itself triggers Railway through the existing GitHub-connected
`local-migration` branch.

## Failure behavior to review

- Any failed precondition stops before the push.
- If Git rejects the push, stop and report it; do not force-push.
- If the new build/deployment fails, times out, carries the wrong commit, or
  health checks fail, stop and report the exact deployment state.
- Do not automatically change `R7_SNAPSHOT_READ_SCOPE`. The prior successful
  deployment remains the serving rollback candidate and its issue is cosmetic,
  not an authority or billing defect.
- Do not automatically redeploy another build. Any manual Railway redeploy or
  scope rollback is a separately authorized operation.
- A failed Railway build should not replace the last successful serving
  deployment; verify this operational assumption and flag it if it does not
  hold for this project.

## Required challenges

1. Verify the Git range is exactly one commit and exactly the two reviewed
   files.
2. Verify no unstaged email, decision-log, private, prompt, brand, or unrelated
   work can enter `git push origin main:local-migration`.
3. Verify the commit is copy/test-only and cannot affect selection, lifecycle,
   credits, billing, provider calls, storage, database writes, read scope,
   pins, or public API shapes.
4. Verify the ordinary-stale copy is correct in snapshot and R6 modes and the
   distinct R6 pinned-stale copy still retains explicit unpin guidance.
5. Verify no migration, build configuration, dependency, or environment
   variable change is required.
6. Verify production is still on the stated successful deployment and commit
   before the push.
7. Verify production scope is exactly `users:1` before the push and that this
   operation has no path to change it.
8. Verify the push target is exactly the production-connected
   `local-migration` branch and no force push is used.
9. Verify deployment identification cannot mistake the pre-existing successful
   deployment for the new one.
10. Challenge concurrent push/deployment races and require the exact candidate
    commit on the new deployment.
11. Verify all terminal Railway states are handled honestly and only
    `SUCCESS` passes.
12. Verify the bounded wait/polling behavior cannot hang indefinitely.
13. Verify the health checks match the real `/api/health` response and are
    passive.
14. Verify the operation emits no credentials, private Cast data, prompts,
    URLs, storage keys, database contents, or raw environment-variable lists.
15. Decide whether a failed deployment should trigger any automatic scope
    rollback. Account for the last successful deployment remaining live and
    the current defect being misleading copy only.
16. Confirm the rollback choices remain:
    - serving deployment
      `caa8e78e-a571-4047-844f-7e60d42640f7` /
      commit `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`;
    - full R6-compatible build `c35f677`;
    - separately authorized variable rollback to `off`.
17. Verify the operation stops after health checks and does not resume browser
    verification automatically.
18. Confirm the next separately authorized action after a clean deployment is
    a fresh passive founder-browser verification from `/app`, with no
    mutation or paid action.

## Required report

1. Verdict.
2. Exact Git range and staged-scope proof.
3. Exact Railway target/current-state proof.
4. Deployment identification, wait, and failure-path proof.
5. Scope-preservation and rollback judgment.
6. Any blocker and the smallest sound correction.
7. Non-blocking cautions.
8. Exact scope of approval and the next unauthorized operation.

