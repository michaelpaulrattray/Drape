# Fable Run Review — R7-7B7 Founder-Only Scope Enablement

You are the independent, read-only reviewer for R7-7B7 rollout step 3.

Review the exact production operation below and decide whether it is safe to
run. Do not edit, stage, commit, push, deploy, contact Railway, query a
database, change a variable, open a browser, run convergence, clear pins, or
enable snapshot reads during this review.

## Required verdict

Return exactly one:

- `APPROVE — safe to enable R7 snapshot reads for founder user 1 only`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound
  correction

Approval covers one change of the production app variable from
`R7_SNAPSHOT_READ_SCOPE=off` to `users:1`, the resulting Railway redeployment
of the already-reviewed commit, passive health checks, and an automatic
fail-closed rollback to `off` if any part fails.

It does not authorize browser verification, paid actions, generation, credits,
storage work, the pin-convergence plan or apply, cohort expansion, `all`, a
code push, a migration, or later R7 work.

## Current production state

- Project: `drape-production`
- Project ID: `24aa4ff2-4184-4ba6-8ce2-61f79454fdd5`
- Environment: `production`
- Environment ID: `a8a8edd9-deae-4aa3-9520-da0eb7534761`
- App service: `Drape`
- App service ID: `f613b5f2-f0ef-4256-b123-2e47a694c8b3`
- Deployed commit:
  `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`
- Current scope: `R7_SNAPSHOT_READ_SCOPE=off`
- Public URL: `https://drape-production-0232.up.railway.app`
- Rollback build: `c35f677`

The B1–B6 code is deployed and healthy with scope off.

## Production audit evidence immediately preceding this operation

The Fable-approved bounded read-only audit ran against the exact intersection
of user id `1` and model ids `1..41,46`.

- exactly 42 models audited;
- 41 current, 1 legitimate headless, 0 invalid;
- 39 full parity, 3 attention results;
- every structural, identity, selected-slot, anchor/display, seal, mint,
  export, board/library, and registry mismatch count was zero;
- the only mismatch kinds were:
  - `consumer_package_state`: 3;
  - `consumer_refresh_plan`: 3;
- the only affected surfaces were:
  - `casting_package_state`: 3;
  - `casting_refresh_plan`: 3.

That is exactly the bounded vocabulary that B6 legacy Cast-slot pins can
produce. It is not yet treated as proven pin causation. After founder-only
enablement and passive browser verification, the separately reviewed read-only
pin-convergence plan will count the pinned rows and prove hypothetical
post-clear full parity. This review does not authorize that plan.

## Why founder enablement precedes the pin plan

The ratified B7 order is:

1. deploy with scope off;
2. audit the exact founder cohort;
3. enable the exact founder user id;
4. verify snapshot-backed read surfaces without automatic paid actions;
5. run the bounded pin plan, separately authorize its apply, then verify.

The pin planner independently calls `captureSnapshotReadMode(subject.userId)`
and returns `scope_not_enabled` while the account is on R6. Therefore the
production pin plan cannot be the next meaningful gate while scope remains
`off`.

## Exact production wrapper proposed

This PowerShell wrapper:

- rechecks the exact healthy deployment and current `off` value;
- refuses if any deployment is already non-terminal;
- changes only `R7_SNAPSHOT_READ_SCOPE` on the exact app service to `users:1`;
- waits for a new deployment of the exact reviewed commit to reach terminal
  `SUCCESS`;
- confirms the variable remained exactly `users:1`;
- checks `/api/health` reports healthy/database up and the home page returns
  HTTP 200;
- on any failure after the mutation, changes the variable back to `off`, waits
  for a new successful rollback deployment of the same commit, verifies the
  value is `off`, then rethrows;
- performs no browser, database, pin, generation, or paid action.

```powershell
$ErrorActionPreference = 'Stop'
$env:RAILWAY_CALLER = 'skill:use-railway@1.3.6'
$env:RAILWAY_AGENT_SESSION = 'railway-skill-r7b7-founder-scope-1784939000'

$projectId = '24aa4ff2-4184-4ba6-8ce2-61f79454fdd5'
$environmentId = 'a8a8edd9-deae-4aa3-9520-da0eb7534761'
$appServiceId = 'f613b5f2-f0ef-4256-b123-2e47a694c8b3'
$expectedCommit = '8bc1b29aca61490f4ee90da8c04002dc9e3b9d03'
$baseUrl = 'https://drape-production-0232.up.railway.app'
$terminalStates = @(
  'SUCCESS',
  'FAILED',
  'CRASHED',
  'REMOVED',
  'REMOVING',
  'SKIPPED',
  'SLEEPING',
  'NEEDS_APPROVAL'
)

function Get-AppVariables {
  $raw = & railway.cmd variable list `
    --project $projectId `
    --environment $environmentId `
    --service $appServiceId `
    --json
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the production app variables"
  }
  return $raw | ConvertFrom-Json
}

function Get-AppDeployments {
  $raw = & railway.cmd deployment list `
    --project $projectId `
    --environment $environmentId `
    --service $appServiceId `
    --limit 10 `
    --json
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the production deployments"
  }
  return @($raw | ConvertFrom-Json)
}

function Set-SnapshotScope([string]$value) {
  & railway.cmd variable set "R7_SNAPSHOT_READ_SCOPE=$value" `
    --project $projectId `
    --environment $environmentId `
    --service $appServiceId
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to set the production snapshot-read scope"
  }
}

function Wait-ForNewSuccessfulDeployment(
  [string[]]$knownDeploymentIds,
  [string]$purpose
) {
  $deadline = (Get-Date).AddMinutes(20)
  while ((Get-Date) -lt $deadline) {
    $deployments = Get-AppDeployments
    $latest = $deployments | Select-Object -First 1
    if ($latest -and $knownDeploymentIds -notcontains [string]$latest.id) {
      if ($latest.meta.commitHash -ne $expectedCommit) {
        throw "A different commit entered production during $purpose"
      }
      if ($terminalStates -contains [string]$latest.status) {
        if ($latest.status -ne 'SUCCESS') {
          throw "The $purpose deployment ended in $($latest.status)"
        }
        return $latest
      }
    }
    Start-Sleep -Seconds 10
  }
  throw "Timed out waiting for the $purpose deployment"
}

$scopeMutationAttempted = $false
$enabledDeployment = $null

try {
  $beforeDeployments = Get-AppDeployments
  $beforeLatest = $beforeDeployments | Select-Object -First 1
  if (-not $beforeLatest) {
    throw "The production app has no deployment"
  }
  if ($beforeLatest.status -ne 'SUCCESS') {
    throw "The current production deployment is not healthy"
  }
  if ($beforeLatest.meta.commitHash -ne $expectedCommit) {
    throw "Production is not running the reviewed commit"
  }
  if ($beforeDeployments | Where-Object {
    $terminalStates -notcontains [string]$_.status
  }) {
    throw "Another production deployment is already in progress"
  }

  $beforeVariables = Get-AppVariables
  if ([string]$beforeVariables.R7_SNAPSHOT_READ_SCOPE -ne 'off') {
    throw "Founder enablement requires the current scope to be exactly off"
  }

  $knownBeforeIds = @($beforeDeployments | ForEach-Object { [string]$_.id })
  $scopeMutationAttempted = $true
  Set-SnapshotScope 'users:1'

  $enabledVariables = Get-AppVariables
  if ([string]$enabledVariables.R7_SNAPSHOT_READ_SCOPE -ne 'users:1') {
    throw "Founder scope did not become exactly users:1"
  }

  $enabledDeployment = Wait-ForNewSuccessfulDeployment `
    -knownDeploymentIds $knownBeforeIds `
    -purpose 'founder-scope'

  $postDeployVariables = Get-AppVariables
  if ([string]$postDeployVariables.R7_SNAPSHOT_READ_SCOPE -ne 'users:1') {
    throw "Founder scope changed unexpectedly after deployment"
  }

  $healthResponse = Invoke-WebRequest `
    -Uri "$baseUrl/api/health" `
    -UseBasicParsing `
    -TimeoutSec 30
  if ($healthResponse.StatusCode -ne 200) {
    throw "Production health endpoint did not return HTTP 200"
  }
  $health = $healthResponse.Content | ConvertFrom-Json
  if (
    [string]$health.status -ne 'healthy' -or
    [string]$health.checks.database.status -ne 'up'
  ) {
    throw "Production health endpoint is not healthy"
  }

  $homeResponse = Invoke-WebRequest `
    -Uri $baseUrl `
    -UseBasicParsing `
    -TimeoutSec 30
  if ($homeResponse.StatusCode -ne 200) {
    throw "Production home page did not return HTTP 200"
  }

  Write-Output "FOUNDER_SCOPE=users:1"
  Write-Output "DEPLOYMENT_ID=$($enabledDeployment.id)"
  Write-Output "DEPLOYMENT_STATUS=$($enabledDeployment.status)"
  Write-Output "DEPLOYED_COMMIT=$($enabledDeployment.meta.commitHash)"
  Write-Output "HEALTH_STATUS=$($health.status)"
  Write-Output "DATABASE_STATUS=$($health.checks.database.status)"
  Write-Output "HOME_HTTP_STATUS=$($homeResponse.StatusCode)"
} catch {
  $originalError = $_
  $currentScope = $null
  try {
    $currentScope = [string](Get-AppVariables).R7_SNAPSHOT_READ_SCOPE
  } catch {
    $currentScope = $null
  }

  if ($scopeMutationAttempted -or $currentScope -ne 'off') {
    $rollbackKnownIds = @(
      (Get-AppDeployments) | ForEach-Object { [string]$_.id }
    )
    Set-SnapshotScope 'off'
    $rollbackVariables = Get-AppVariables
    if ([string]$rollbackVariables.R7_SNAPSHOT_READ_SCOPE -ne 'off') {
      throw "Founder enablement failed and the scope rollback did not become off"
    }
    $rollbackDeployment = Wait-ForNewSuccessfulDeployment `
      -knownDeploymentIds $rollbackKnownIds `
      -purpose 'scope-rollback'
    Write-Output "ROLLBACK_SCOPE=off"
    Write-Output "ROLLBACK_DEPLOYMENT_ID=$($rollbackDeployment.id)"
    Write-Output "ROLLBACK_STATUS=$($rollbackDeployment.status)"
  }

  throw $originalError
}
```

## Required code review

Read completely:

- `server/casting/snapshotReadScope.ts`
- `server/_core/env.ts`
- `server/_core/index.ts`
- `server/casting/effectiveCastRead.ts`
- `server/casting/effectiveCastState.ts`
- `server/casting/snapshotPinConvergence.ts`
- the B7 portion of
  `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`
- the cumulative B7 scope-off deployment review evidence already supplied.

Inspect all runtime callers of `captureSnapshotReadMode` and verify the exact
cohort behavior.

## Required challenges

1. Prove `users:1` enables only authenticated user id 1 and cannot enable
   another user, a model id, anonymous traffic, or `all`.
2. Verify public registry lookup derives scope from the Cast owner's
   server-loaded user id rather than the unauthenticated caller.
3. Verify malformed scope still fails server startup and the exact
   `users:1` syntax is accepted.
4. Verify no client input can select R6/snapshot mode or add itself to scope.
5. Verify snapshot resolution is read-only, fail-closed, and performs no
   automatic bootstrap/convergence/repair for the enabled account.
6. Verify the three pin-only audit mismatches are expected under B6 runtime pin
   retirement and do not indicate structural or paid-authority drift.
7. Challenge whether founder scope may be enabled before the pin plan proves
   pin attribution. Account for the fact that the pin planner deliberately
   blocks with `scope_not_enabled` while scope is off.
8. Verify snapshot-mode pin mutations refuse free and existing stored pins
   cannot silently authorize stale/mint/refresh behavior.
9. Verify board-item Canvas presentation pins remain unrelated and untouched.
10. Verify the wrapper changes exactly one app variable on the exact project,
    environment, and service and cannot touch MySQL, R2, credits, or code.
11. Verify the variable change creates a new deployment and the wrapper does
    not mistake the already-running deployment for the new one.
12. Challenge concurrent deploy/push races and the exact-commit check.
13. Verify all terminal deployment states are handled honestly; only
    `SUCCESS` passes.
14. Verify the 20-minute bounded wait and 10-second polling are operationally
    safe.
15. Verify the health assertions match the real `/api/health` response shape.
16. Verify passive health/home requests cannot trigger paid, generation,
    storage, pin, or database-write behavior.
17. Review the automatic rollback path for every partial-failure point:
    variable command failure-after-apply, read-back failure, deployment
    failure, timeout, health failure, and unexpected commit.
18. Challenge whether rollback can accidentally observe the enablement
    deployment rather than the new `off` deployment.
19. Verify rollback restores exactly `off`, waits for its own new successful
    deployment, and never redeploys a different commit.
20. Verify failure reporting does not falsely claim either enablement or
    rollback success.
21. Verify no secrets are printed or written to the repository.
22. Verify the operation stops after passive health checks. No browser action,
    pin plan/apply, paid action, cohort expansion, or `all`.
23. Decide whether authenticated founder-browser verification must be part of
    this same operation or should remain the next separately reviewed gate.
24. Confirm the rollback build `c35f677` remains available and no migration or
    data rollback is needed.

## Required report

1. Verdict.
2. Exact scope/target confirmation.
3. Founder-only authority proof.
4. Deployment and rollback-path proof.
5. Any blocker and smallest correction.
6. Non-blocking cautions.
7. Exact scope of approval and the next still-unauthorized operation.
