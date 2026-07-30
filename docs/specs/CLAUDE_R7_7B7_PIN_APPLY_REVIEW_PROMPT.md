# R7-7B7 bounded founder pin-convergence apply review

You are the independent reviewer. Review the exact bounded production write operation below read-only. Do not edit, stage, commit, deploy, change variables, contact the database, run the wrapper, or clear any pin.

Return exactly one verdict:

- `APPROVE — safe to apply bounded founder pin convergence in production`
- `REQUEST CHANGES` with a concrete reachable blocker.

This review can authorize only one execution of the quoted apply wrapper. It cannot authorize a rerun, a changed count, snapshot convergence, scope changes, deployment, cohort expansion, `all`, generation, credits, storage work, browser actions, cleanup/removal of the pin route, or later R7 work.

## Current production state

- Project: `drape-production`
- Project id: `24aa4ff2-4184-4ba6-8ce2-61f79454fdd5`
- Environment id: `a8a8edd9-deae-4aa3-9520-da0eb7534761`
- App service id: `f613b5f2-f0ef-4256-b123-2e47a694c8b3`
- MySQL service id: `72e761be-b1e0-4221-bf22-34bcb37f4249`
- Reviewed deployment id: `4a3694d3-44c9-42a4-8cf3-cd728312b90c`
- Reviewed commit: `5abde1e78d4643a866e8029b7b91fc11002cac3f`
- Scope: `R7_SNAPSHOT_READ_SCOPE=users:1`
- Database proxy host: `hayabusa.proxy.rlwy.net:23768`
- Database name: `railway`
- Cohort: user 1 AND model ids 1–41, 46
- Expected model count: 42
- Expected pinned-row count: 4

## Completed read-only evidence

The separately reviewed count-4 plan completed with `PIN_PLAN_EXIT_CODE=0`:

- `ready: true`
- all 42 expected models present
- no scope, active-operation, or parity blocker
- full hypothetical post-clear parity passed for every model
- exactly four pinned rows:
  - model 4: 1
  - model 24: 1
  - model 26: 1
  - model 27: 1
- all other models: 0

The plan used the production tool itself inside one frozen read-only transaction. It did not use ad hoc SQL, did not take a `FOR UPDATE` lock, and changed nothing. Its process exited cleanly; a process audit found no surviving `pnpm`, `tsx`, Vitest, or convergence runner.

## Exact candidate wrapper

```powershell
$ErrorActionPreference = 'Stop'
$env:RAILWAY_CALLER = 'skill:use-railway@1.3.6'
$env:RAILWAY_AGENT_SESSION = 'railway-skill-r7b7-pin-apply-1784944100'

$projectId = '24aa4ff2-4184-4ba6-8ce2-61f79454fdd5'
$environmentId = 'a8a8edd9-deae-4aa3-9520-da0eb7534761'
$appServiceId = 'f613b5f2-f0ef-4256-b123-2e47a694c8b3'
$mysqlServiceId = '72e761be-b1e0-4221-bf22-34bcb37f4249'
$expectedDeploymentId = '4a3694d3-44c9-42a4-8cf3-cd728312b90c'
$expectedCommit = '5abde1e78d4643a866e8029b7b91fc11002cac3f'
$expectedHost = 'hayabusa.proxy.rlwy.net:23768'
$expectedDatabase = 'railway'
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
    throw 'Founder pin convergence requires scope users:1'
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
    -or $target.Authority -ne $expectedHost `
    -or $target.AbsolutePath.TrimStart('/') -ne $expectedDatabase
  ) {
    throw 'The production MySQL target failed exact validation'
  }

  $applyArgs = @(
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
    $applyArgs += @('--model-id', [string]$modelId)
  }
  $applyArgs += @(
    '--expected-model-count',
    '42',
    '--expected-pinned-row-count',
    '4',
    '--apply',
    '--allow-pin-convergence-write',
    '--allow-production-pin-convergence',
    '--confirm-app-id',
    'drape-production',
    '--confirm-host',
    $expectedHost,
    '--confirm-database',
    $expectedDatabase
  )

  & pnpm.cmd @applyArgs
  $applyExitCode = $LASTEXITCODE
  Write-Output "PIN_APPLY_EXIT_CODE=$applyExitCode"
  if ($applyExitCode -ne 0) {
    throw "The bounded production pin convergence requires attention (exit $applyExitCode)"
  }
} finally {
  Remove-Item Env:R7_SNAPSHOT_READ_SCOPE -ErrorAction SilentlyContinue
  $mysqlPublicUrl = $null
}
```

## Required challenges

1. Confirm the wrapper pins the exact project, environment, app service, MySQL service, deployment, commit, scope, proxy host including port, database, user, 42 model ids, total count 4, and full confirmation ceremony.
2. Confirm the read-only evidence is sufficient to attribute the four rows exactly to models 4, 24, 26, and 27, one each, with every model passing full hypothetical post-clear parity.
3. Confirm the apply path freezes the cohort again and re-runs the exact model-count, pinned-row-count, scope, active-operation, and complete parity preflight before any model write begins.
4. Confirm a blocked preflight performs zero model writes, including on models otherwise ready.
5. Confirm each model transaction locks in the established order, re-checks scope, fences both an existing and absent operation lock, reloads state, re-checks that model's planned pin count and full post-clear parity, and trusts no stale plan state.
6. Confirm the only mutation is `UPDATE model_assets SET pinned=false` scoped to the locked model and currently pinned rows.
7. Confirm it does not change snapshot rows, model pointers, `stateVersion`, identity documents, model status, assets other than the `pinned` boolean, operation receipts/locks, Canvas board-item pins, Wardrobe state, storage, credits, or providers.
8. Confirm the affected-row count must exactly match the locked assessment or that model transaction rolls back.
9. Confirm each updated model is reloaded inside the same transaction and must have zero pins plus complete shadow parity before commit.
10. Confirm per-model atomicity and run-level honesty: a later model failure may leave earlier model transactions committed, but the result is `success:false`, exit 2, and a safe idempotent rerun would still require a new review.
11. Confirm the final postflight audits the frozen 42 model ids and success requires 42 reports, zero mismatches, zero remaining pinned rows, and no failed result.
12. Confirm scope-off rollback remains honest after clearing: R6 readers would see the same selected assets but old pins would not be restored; this irreversible pin loss is the already-ratified product decision.
13. Confirm snapshot-mode Cast-slot pin mutation remains refused and Canvas board-item pins remain a distinct untouched feature.
14. Confirm exact target and command-character fences run before the batch shim, and all write/production/confirmation flags are present and checked by the parser.
15. Confirm the wrapper does not change Railway variables or deployments and cleans its process-local scope and URL references in `finally`.
16. Confirm output contains only ids, counts, closed statuses/error codes, and parity summaries—no identity documents, URLs, keys, credentials, or raw SQL parameters.
17. Challenge concurrency with generation, deletion/archive, a pin change, scope change, database disconnect, and a partial multi-model run. Identify the exact safe failure behavior for each.
18. Confirm `PIN_APPLY_EXIT_CODE=0` is acceptable only if the JSON also reports:
    - `success: true`
    - expected models 42
    - expected pins 4
    - cleared models 4, 24, 26, 27 with one row each
    - every other model clean
    - postflight audited models 42
    - postflight parity models 42
    - postflight mismatched models 0
    - postflight remaining pinned rows 0
19. Confirm any nonzero exit or unexpected JSON requires stopping without a rerun, scope change, repair, or rollout continuation.
20. State any blocker separately from non-blocking cautions.
21. Restate the exact scope: one bounded apply only. A post-apply parity audit, browser verification, scope expansion, `all`, public pin-route cleanup, or later R7 work remains separately unauthorized.

