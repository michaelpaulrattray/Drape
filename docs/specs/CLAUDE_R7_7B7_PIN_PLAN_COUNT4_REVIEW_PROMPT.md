# R7-7B7 founder pin-convergence plan — observed count 4 review

You are the independent reviewer. Review the exact bounded production operation below read-only. Do not edit, stage, commit, deploy, change variables, contact the database, or run the wrapper.

Return exactly one verdict:

- `APPROVE — safe to rerun the bounded founder pin-convergence plan with observed count 4`
- `REQUEST CHANGES` with a concrete reachable blocker.

This review can authorize only one execution of the quoted read-only wrapper. It cannot authorize `--apply`, pin clearing, a count change, another rerun, scope changes, deployment, cohort expansion, `all`, generation, credits, storage work, browser actions, or later R7 work.

## Production state and prior evidence

- Project: `drape-production`
- Project id: `24aa4ff2-4184-4ba6-8ce2-61f79454fdd5`
- Environment id: `a8a8edd9-deae-4aa3-9520-da0eb7534761`
- App service id: `f613b5f2-f0ef-4256-b123-2e47a694c8b3`
- MySQL service id: `72e761be-b1e0-4221-bf22-34bcb37f4249`
- Reviewed deployment id: `4a3694d3-44c9-42a4-8cf3-cd728312b90c`
- Reviewed commit: `5abde1e78d4643a866e8029b7b91fc11002cac3f`
- Scope: `R7_SNAPSHOT_READ_SCOPE=users:1`
- Cohort: user 1 AND model ids 1–41, 46
- Expected model count: 42

The previously reviewed wrapper used `--expected-pinned-row-count 3`. It ran once and stopped before subject inspection with:

```text
[snapshot-pin-convergence] mode=READ ONLY app=drape-production host=hayabusa.proxy.rlwy.net:23768 database=railway expectedModels=42 expectedPinnedRows=3
PIN_PLAN_EXIT_CODE=1
[snapshot-pin-convergence] failed: Snapshot pin convergence pinned-row count mismatch: expected 3, found 4
```

No row was changed, no lock was taken, and no apply/write flag was present. The process-local scope and database URL were cleared in `finally`. A process audit found no surviving `pnpm`, `tsx`, Vitest, or convergence runner.

The only proposed correction is the evidence-backed count fence:

```diff
- --expected-pinned-row-count 3
+ --expected-pinned-row-count 4
```

Everything else is byte-for-byte the previously approved wrapper.

## Exact candidate wrapper

```powershell
$ErrorActionPreference = 'Stop'
$env:RAILWAY_CALLER = 'skill:use-railway@1.3.6'
$env:RAILWAY_AGENT_SESSION = 'railway-skill-r7b7-pin-plan-count4-1784943300'

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
    '4',
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

1. Confirm the wrapper still pins the exact reviewed project, environment, app service, MySQL service, deployment, commit, scope, user, and 42 model ids.
2. Confirm the only operational change from the approved wrapper is the pinned-row fence from 3 to the directly observed value 4. The telemetry session label may differ but has no authority.
3. Confirm exit 1 occurred before any write and that no `--apply` or write-authority flag existed.
4. Confirm count 4 is evidence produced by the production tool's own strict cohort count, not an estimate or ad hoc SQL result.
5. Confirm the candidate remains SELECT-only and takes no `FOR UPDATE` lock in plan mode.
6. Confirm user and model selectors intersect, deleted/archived/tombstoned models cannot silently join, and the exact model-count fence remains 42.
7. Confirm the local scope mirror is set only after production `users:1` is verified and is removed in `finally`.
8. Confirm the URL character, scheme, proxy-host, and database-name fences remain fail-closed before the batch shim receives the URL.
9. Confirm any active operation lock, scope discrepancy, residual mismatch after hypothetical unpinning, unexpected count, runtime error, or nonzero exit stops.
10. Confirm hypothetical post-clear parity still evaluates the complete structural and consumer mismatch vocabulary, without a pin-only waiver.
11. Confirm output remains limited to ids, counts, closed statuses, error codes, and hashes; no names, identity documents, URLs, keys, credentials, or raw SQL parameters.
12. Confirm the wrapper cannot mutate Railway variables, deploy, invoke a browser, write repository files, or clear pins.
13. Confirm exit 0 is the only acceptable result and that exit 1/2 cannot be retried or reinterpreted without another review.
14. State any concrete blocker separately from non-blocking cautions.
15. Restate that a successful read-only plan does not authorize apply. The apply operation must be separately reviewed with the exact per-model counts returned by this plan and the full production write ceremony.

