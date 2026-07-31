# Fable Run Review — R7-7B7 Founder Pin-Convergence Plan

You are the independent, read-only reviewer for R7-7B7 rollout step 5a: one
bounded production **planning** run of the already-reviewed Cast-slot
pin-convergence tool.

Review the exact operation below and decide whether it is safe to run. Do not
edit, stage, commit, push, deploy, change a Railway variable, query the
database outside the proposed tool, control a browser, clear pins, run
`--apply`, generate media, spend credits, or perform any product mutation
during this review.

## Required verdict

Return exactly one:

- `APPROVE — safe to run the bounded founder pin-convergence plan`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound
  correction

Approval may cover only one read-only execution of the exact wrapper below. It
must not authorize `--apply`, pin clearing, snapshot convergence, scope
changes, deployment, cohort expansion, `all`, another database query,
generation, credits, storage work, browser actions, or later R7 work.

## Current production state

- Project: `drape-production`
- Project ID: `24aa4ff2-4184-4ba6-8ce2-61f79454fdd5`
- Environment: `production`
- Environment ID: `a8a8edd9-deae-4aa3-9520-da0eb7534761`
- App service: `Drape`
- App service ID: `f613b5f2-f0ef-4256-b123-2e47a694c8b3`
- MySQL service ID: `72e761be-b1e0-4221-bf22-34bcb37f4249`
- Active deployment:
  `4a3694d3-44c9-42a4-8cf3-cd728312b90c`
- Active commit:
  `5abde1e78d4643a866e8029b7b91fc11002cac3f`
- Deployment status: `SUCCESS`
- Scope: `R7_SNAPSHOT_READ_SCOPE=users:1`
- Health: healthy, database up
- Production database name: `railway`

## Completed rollout evidence

The exact founder cohort remains:

- user id `1`;
- model ids `1..41` and `46`;
- expected live model count `42`.

The bounded production shadow audit reported:

- 42 audited;
- 41 current, 1 legitimate headless, 0 invalid;
- 39 full parity, 3 attention models;
- only `consumer_package_state: 3`;
- only `consumer_refresh_plan: 3`;
- zero structural, identity, selection, anchor/display, seal, mint, export,
  board/library, or registry mismatches.

Those two consumer mismatch kinds are the exact B6 vocabulary produced by
legacy Cast-slot pins after snapshot projections retire pin authority. The
audit cannot itself prove how many pinned ledger rows exist.

Founder-only snapshot reads are enabled and the separately approved passive
browser verification has now passed:

- hard-reloaded authenticated lobby and Models library;
- audited model 4 loaded coherently;
- all five ordinary stale Package Health rows now say only
  `refresh it before minting`;
- no Cast-slot Pin/Unpin controls or pin-first guidance appeared;
- Export plan rendered as free without execution;
- Wardrobe hydrated a server-owned HTTPS model image after a hard navigation,
  with no VTO/session action;
- an existing Canvas Cast sheet rendered without pin controls;
- visible credit balance remained `70,800`;
- no mutation, paid action, provider, storage, pin, or database operation was
  performed.

## Why the expected pinned-row count is proposed as 3

The previous audit found exactly three models with both pin-sensitive consumer
mismatches and no other mismatch kind. The most conservative first hypothesis
is one legacy pinned row on each affected model, for
`--expected-pinned-row-count 3`.

This is a strict fence, not an assertion that may be silently corrected:

- if the real total is not exactly 3, the tool must throw before any action and
  the run stops;
- the counts-only mismatch is evidence for a corrected, separately reviewed
  plan;
- the executor must not rerun with the discovered count without another
  authorization;
- exit 2 or any blocked model also stops the rollout.

Challenge whether using 3 as the first expected count is the safest way to let
the reviewed tool prove or disprove the hypothesis without an ad hoc SQL query.

## Tool contract to inspect

Read completely:

- `server/casting/snapshotPinConvergence.ts`
- `server/casting/snapshotShadow.ts`
- `server/casting/snapshotShadowAudit.ts`
- `scripts/converge-cast-pins.ts`
- the B6/B7 portions of
  `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`
- the pin-convergence tests and source guards.

The tool was independently reviewed and locally committed during B6. Confirm:

- default mode is read-only;
- no `--all` exists;
- user/model selectors intersect;
- expected model and pinned-row counts are mandatory;
- production planning requires `--allow-production-read-only`;
- write flags are rejected without `--apply`;
- the plan uses one frozen transaction;
- every model must be snapshot-enabled;
- any active operation blocks;
- hypothetical `pinned=false` must produce full structural and consumer parity;
- output is ids, counts, statuses, and closed error codes only;
- the plan performs no lock, update, credit, provider, or storage action.

## Exact proposed wrapper

This wrapper:

- uses only exact Railway project/environment/service ids;
- rechecks the exact active deployment and `users:1` scope;
- mirrors that exact verified `users:1` value into the private CLI process so
  its server-owned scope gate evaluates the same mode as production;
- obtains `MYSQL_PUBLIC_URL` only from the exact production MySQL service;
- validates a `mysql:` Railway proxy URL whose database is exactly `railway`;
- rejects any URL spelling outside the conservative character set accepted by
  this Windows wrapper before it crosses the `pnpm.cmd` batch shim;
- passes it only as a process argument to the private CLI;
- runs no `--apply` or write/confirmation flag;
- targets user 1 AND the exact 42 model ids;
- expects exactly 42 models and 3 pinned rows;
- prints the plan's ids/counts/statuses and exact exit code;
- clears both the process-local snapshot scope and its local URL variable in
  `finally`;
- writes no repository file.

```powershell
$ErrorActionPreference = 'Stop'
$env:RAILWAY_CALLER = 'skill:use-railway@1.3.6'
$env:RAILWAY_AGENT_SESSION = 'railway-skill-r7b7-pin-plan-1784943000'

$projectId = '24aa4ff2-4184-4ba6-8ce2-61f79454fdd5'
$environmentId = 'a8a8edd9-deae-4aa3-9520-da0eb7534761'
$appServiceId = 'f613b5f2-f0ef-4256-b123-2e47a694c8b3'
$mysqlServiceId = '72e761be-b1e0-4221-bf22-34bcb37f4249'
$expectedDeploymentId = '4a3694d3-44c9-42a4-8cf3-cd728312b90c'
$expectedCommit = '5abde1e78d4643a866e8029b7b91fc11002cac3f'
$modelIds = @(1..41) + 46
$mysqlPublicUrl = $null

try {
  $deployments = (
    (& railway.cmd deployment list `
      --project $projectId `
      --environment $environmentId `
      --service $appServiceId `
      --limit 10 `
      --json) | ConvertFrom-Json
  )
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to read production deployments'
  }
  $latest = $deployments[0]
  if (
    -not $latest `
    -or [string]$latest.id -ne $expectedDeploymentId `
    -or [string]$latest.status -ne 'SUCCESS' `
    -or [string]$latest.meta.commitHash -ne $expectedCommit
  ) {
    throw 'Production is not on the reviewed deployment'
  }

  $terminal = @(
    'SUCCESS',
    'FAILED',
    'CRASHED',
    'REMOVED',
    'REMOVING',
    'SKIPPED',
    'SLEEPING',
    'NEEDS_APPROVAL'
  )
  if (@($deployments | Where-Object {
    $terminal -notcontains [string]$_.status
  }).Count -ne 0) {
    throw 'Another production deployment is in progress'
  }

  $appVariables = (
    (& railway.cmd variable list `
      --project $projectId `
      --environment $environmentId `
      --service $appServiceId `
      --json) | ConvertFrom-Json
  )
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to read production app variables'
  }
  if ([string]$appVariables.R7_SNAPSHOT_READ_SCOPE -ne 'users:1') {
    throw 'Founder pin planning requires scope users:1'
  }
  $env:R7_SNAPSHOT_READ_SCOPE = 'users:1'

  $mysqlVariables = (
    (& railway.cmd variable list `
      --project $projectId `
      --environment $environmentId `
      --service $mysqlServiceId `
      --json) | ConvertFrom-Json
  )
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to read production MySQL variables'
  }
  $mysqlPublicUrl = [string]$mysqlVariables.MYSQL_PUBLIC_URL
  if ($mysqlPublicUrl -notmatch '^[A-Za-z0-9:@/._\-]+$') {
    throw 'The production MySQL URL contains unsupported command characters'
  }
  $target = [Uri]$mysqlPublicUrl
  if (
    $target.Scheme -ne 'mysql' `
    -or -not $target.Host.EndsWith('.proxy.rlwy.net') `
    -or $target.AbsolutePath.TrimStart('/') -ne 'railway'
  ) {
    throw 'The production MySQL target failed validation'
  }

  $planArgs = @(
    'exec',
    'tsx',
    'scripts/converge-cast-pins.ts',
    '--database-url',
    $mysqlPublicUrl,
    '--app-id',
    'drape-production',
    '--user-id',
    '1'
  )
  foreach ($modelId in $modelIds) {
    $planArgs += @('--model-id', [string]$modelId)
  }
  $planArgs += @(
    '--expected-model-count',
    '42',
    '--expected-pinned-row-count',
    '3',
    '--allow-production-read-only'
  )

  & pnpm.cmd @planArgs
  $planExitCode = $LASTEXITCODE
  Write-Output "PIN_PLAN_EXIT_CODE=$planExitCode"
  if ($planExitCode -ne 0) {
    throw "The read-only pin plan requires attention (exit $planExitCode)"
  }
} finally {
  Remove-Item Env:R7_SNAPSHOT_READ_SCOPE -ErrorAction SilentlyContinue
  $mysqlPublicUrl = $null
}
```

## Required challenges

1. Verify the exact deployment, commit, scope, Railway ids, user id, model ids,
   and two count fences.
2. Verify the selector is the AND intersection of user 1 and models
   `1..41,46`, with no full-database path.
3. Verify archived/deleted/tombstoned models cannot silently join and any
   cohort shrink fails the 42-model fence.
4. Verify default/read-only mode cannot call the pin update, take write locks,
   alter snapshots, or touch any other table.
5. Verify no application route, worker, scheduler, startup hook, or package
   script can invoke the tool.
6. Verify `--allow-production-read-only` grants no write authority and every
   apply/write/confirmation flag is absent.
7. Verify the plan counts every `model_assets.pinned=true` row across the
   bounded cohort, including unselected/history rows.
8. Decide whether expected pinned count 3 is a sound first fail-closed
   hypothesis. If not, provide the smallest safer way to obtain the required
   count without an ad hoc database query or write.
9. Verify a count mismatch occurs before any model action and reveals counts
   only.
10. Verify all 42 subjects are inspected in one frozen transaction.
11. Verify scope is re-derived from the server-owned environment per subject
    and any non-snapshot subject blocks. Confirm the wrapper mirrors only the
    exact production value it has just verified and removes the process-local
    value in `finally`.
12. Verify any active model operation, including an expired lock, blocks the
    affected subject and makes `ready=false`.
13. Verify hypothetical pin clearing must produce full structural and all
    consumer parity—not merely the two expected mismatch kinds.
14. Verify identity, selection, anchor/display, seal, mint, refresh, export,
    library, registry, and failure-marker mismatches cannot be waived.
15. Verify output contains no names, prompts, schemas, preferences, URLs,
    storage keys, credentials, provider messages, or raw SQL values.
16. Review process cleanup: shared DB pool closes in `finally`, process-local
    `DATABASE_URL` is deleted by the CLI, and no child/test process remains.
17. Review Windows argument handling for a Railway MySQL URL. Confirm the
    conservative character allowlist rejects command metacharacters before the
    URL reaches `pnpm.cmd`, and that rejection is fail-closed.
18. Verify exit 0 requires all 42 models to be ready/clean with the exact
    counts; exit 1 or 2 stops and does not authorize a rerun.
19. Verify the wrapper performs no browser action, deployment, variable
    mutation, health-changing action, or file write.
20. Confirm the next operation after an exit-0 plan is a separately reviewed
    `--apply` wrapper with exact target confirmations and expected per-model
    counts; this review cannot authorize it.

## Required report

1. Verdict.
2. Exact target/cohort/count confirmation.
3. Read-only and reachability proof.
4. Full hypothetical-parity proof.
5. Output/privacy/process-cleanup proof.
6. Expected-count judgment.
7. Any blocker and smallest correction.
8. Non-blocking cautions.
9. Exact scope of approval and the next unauthorized operation.
