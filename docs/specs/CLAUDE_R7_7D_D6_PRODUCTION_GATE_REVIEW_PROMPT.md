# R7-7D D6 production migration + disabled deployment gate — review

Perform a read-only, independent cumulative review. Use repository tools in
auto mode and inspect all D1–D6 code needed to challenge the ceremony. Do not
edit, stage, commit, push, deploy, run a migration, contact any database or
storage service, change Railway, or invoke providers/credits.

## Exact local and production baseline

- local `main` HEAD:
  `2462b33ab14fc6a986a0808b60660aaf1c10780a`
  (`R7-7D D6: add guarded migration ceremony`);
- production/deploy branch `origin/local-migration`:
  `380efb01b51fe86debdc24007ce0622d13b1d7df`;
- that baseline is an ancestor of HEAD;
- range `380efb0..2462b33` is exactly 14 commits / 125 files and contains
  the completed R7-7C ceremony close plus R7-7D plan, ratification, D1–D5,
  and the guarded D6 migration runner;
- no package/lockfile change; the only SQL migration is
  `drizzle/0013_r7_ink_add_candidates.sql`;
- unrelated `server/routes/emailVerification.ts` is unstaged and every
  private/brand/prompt file remains untracked.

Live state was read-only rechecked immediately before this review:

- project `drape-production` /
  `24aa4ff2-4184-4ba6-8ce2-61f79454fdd5`;
- environment `production`;
- app service `Drape` /
  `f613b5f2-f0ef-4256-b123-2e47a694c8b3`;
- MySQL service
  `72e761be-b1e0-4221-bf22-34bcb37f4249`;
- current deployment
  `3388c6a7-8ae8-4380-85dc-3e8aaa09ae2a`,
  `SUCCESS`, commit `380efb01...`, branch `local-migration`;
- every other listed deployment is terminal `REMOVED`;
- `R7_SNAPSHOT_READ_SCOPE=all`;
- `R7_EVIDENCE_INGEST_SCOPE=off`;
- `R7_EVIDENCE_COMPOSER_SCOPE` absent;
- `R7_EVIDENCE_COMPOSER_RECIPE` absent;
- `ENABLE_EVIDENCE_CANDIDATE_WORKER` absent;
- `ENABLE_STORAGE_CLEANUP_WORKER=true`;
- production evidence bucket is exactly
  `drape-production-evidence-private`, separately credentialed;
- MySQL public target parses as
  `mysql://...@hayabusa.proxy.rlwy.net:23768/railway`.

Exact-HEAD evidence:

- `pnpm check` clean;
- focused D6/schema suites: 14 passed / 0 failed;
- full suite: 2,943 passed / 228 environment-gated skipped / 0 failed;
- production build passed;
- D5 exact-runtime disposable lifecycle/failure matrix:
  18 passed / 0 failed, scratch database dropped;
- D1 additive migration/mixed-version disposable schema suite passed;
- Fable separately approved the three-file guarded migration runner with no
  blocker before commit `2462b33`.

## Proposed one-shot D6 wrapper

Review this wrapper exactly. The executor will run it from repository root in
Windows PowerShell only if approved. Values read from Railway are captured,
never printed.

```powershell
$ErrorActionPreference = 'Stop'

$projectId = '24aa4ff2-4184-4ba6-8ce2-61f79454fdd5'
$environment = 'production'
$appServiceId = 'f613b5f2-f0ef-4256-b123-2e47a694c8b3'
$mysqlServiceId = '72e761be-b1e0-4221-bf22-34bcb37f4249'
$appId = 'drape-production'
$servingDeploymentId = '3388c6a7-8ae8-4380-85dc-3e8aaa09ae2a'
$servingCommit = '380efb01b51fe86debdc24007ce0622d13b1d7df'
$targetCommit = '2462b33ab14fc6a986a0808b60660aaf1c10780a'
$domain = 'https://drape-production-0232.up.railway.app'
$expectedEvidenceBucket = 'drape-production-evidence-private'
$terminal = @(
  'SUCCESS','FAILED','CRASHED','SKIPPED','REMOVED','REMOVING',
  'SLEEPING','NEEDS_APPROVAL'
)
$nonTerminal = @('QUEUED','INITIALIZING','WAITING','BUILDING','DEPLOYING')
$env:RAILWAY_CALLER = 'skill:use-railway@1.3.6'
$env:RAILWAY_AGENT_SESSION = 'r7-7d-d6-production-20260728'

function Get-AppDeployments {
  $rawDeployments = railway.cmd deployment list `
    --project $projectId `
    --environment $environment `
    --service $appServiceId `
    --limit 30 `
    --json | ConvertFrom-Json
  @($rawDeployments) |
    Sort-Object { [DateTimeOffset]$_.createdAt } -Descending
}

function Get-AppVariables {
  railway.cmd variable list `
    --project $projectId `
    --environment $environment `
    --service $appServiceId `
    --json | ConvertFrom-Json
}

function Assert-OffState($variables, [bool]$requireExplicitComposer) {
  if ([string]$variables.R7_SNAPSHOT_READ_SCOPE -ne 'all') {
    throw 'snapshot scope changed'
  }
  if ([string]$variables.R7_EVIDENCE_INGEST_SCOPE -ne 'off') {
    throw 'evidence ingest scope changed'
  }
  if ([string]$variables.ENABLE_STORAGE_CLEANUP_WORKER -ne 'true') {
    throw 'cleanup worker is not enabled'
  }
  $composerScope = [string]$variables.R7_EVIDENCE_COMPOSER_SCOPE
  $composerRecipe = [string]$variables.R7_EVIDENCE_COMPOSER_RECIPE
  $candidateWorker = [string]$variables.ENABLE_EVIDENCE_CANDIDATE_WORKER
  if ($requireExplicitComposer) {
    if (
      $composerScope -ne 'off' -or
      $composerRecipe -ne 'off' -or
      $candidateWorker -ne 'false'
    ) {
      throw 'explicit composer-off state not installed'
    }
  } elseif (
    ($composerScope -notin @('', 'off')) -or
    ($composerRecipe -notin @('', 'off')) -or
    ($candidateWorker -notin @('', 'false'))
  ) {
    throw 'composer authority is not off'
  }
}

$mysqlPublicUrl = $null
$appVariables = $null
$mysqlVariables = $null
$scopeInstalled = $false
try {
  if ((git rev-parse HEAD).Trim() -ne $targetCommit) {
    throw 'local HEAD changed'
  }
  $remote = (git ls-remote origin refs/heads/local-migration).Split("`t")[0]
  if ($remote -ne $servingCommit) {
    throw 'deploy branch changed'
  }

  $before = @(Get-AppDeployments)
  if (
    $before.Count -eq 0 -or
    [string]$before[0].id -ne $servingDeploymentId -or
    [string]$before[0].status -ne 'SUCCESS' -or
    [string]$before[0].meta.commitHash -ne $servingCommit -or
    @($before | Where-Object { [string]$_.status -in $nonTerminal }).Count -ne 0
  ) {
    throw 'serving deployment precondition changed'
  }
  $knownDeploymentIds = @($before | ForEach-Object { [string]$_.id })

  $appVariables = Get-AppVariables
  Assert-OffState $appVariables $false
  $mysqlVariables = railway.cmd variable list `
    --project $projectId `
    --environment $environment `
    --service $mysqlServiceId `
    --json | ConvertFrom-Json
  $mysqlPublicUrl = [string]$mysqlVariables.MYSQL_PUBLIC_URL
  $databaseUri = [uri]$mysqlPublicUrl
  if (
    $databaseUri.Scheme -ne 'mysql' -or
    $databaseUri.Authority -ne 'hayabusa.proxy.rlwy.net:23768' -or
    $databaseUri.AbsolutePath.TrimStart('/') -ne 'railway'
  ) {
    throw 'production MySQL target mismatch'
  }

  $env:R7_EVIDENCE_COMPOSER_SCOPE = 'off'
  $env:R7_EVIDENCE_COMPOSER_RECIPE = 'off'
  $env:ENABLE_EVIDENCE_CANDIDATE_WORKER = 'false'
  $env:R7_EVIDENCE_INGEST_SCOPE = 'off'
  $node = (Get-Command node.exe).Source
  $tsx = Join-Path (Get-Location) 'node_modules\tsx\dist\cli.mjs'
  $migrationArgs = @(
    $tsx,
    'scripts/apply-ink-add-migration.mts',
    '--database-url', $mysqlPublicUrl,
    '--app-id', $appId,
    '--confirm-app-id', $appId,
    '--confirm-host', $databaseUri.Authority,
    '--confirm-database', 'railway',
    '--allow-production-evidence-composer-migration'
  )
  & $node @migrationArgs
  if ($LASTEXITCODE -ne 0) {
    throw "migration failed with exit $LASTEXITCODE"
  }

  railway.cmd variable set `
    'R7_EVIDENCE_COMPOSER_SCOPE=off' `
    'R7_EVIDENCE_COMPOSER_RECIPE=off' `
    'ENABLE_EVIDENCE_CANDIDATE_WORKER=false' `
    --project $projectId `
    --environment $environment `
    --service $appServiceId `
    --skip-deploys `
    --json | Out-Null
  $scopeInstalled = $true
  $appVariables = Get-AppVariables
  Assert-OffState $appVariables $true

  $afterVariableSet = @(Get-AppDeployments)
  if (
    @($afterVariableSet | Where-Object {
      [string]$_.id -notin $knownDeploymentIds
    }).Count -ne 0
  ) {
    throw 'skip-deploy variable update unexpectedly created a deployment'
  }

  git push origin main:local-migration
  if ($LASTEXITCODE -ne 0) {
    throw "git push failed with exit $LASTEXITCODE"
  }

  $deadline = [DateTimeOffset]::UtcNow.AddMinutes(20)
  $deployed = $null
  while ([DateTimeOffset]::UtcNow -lt $deadline) {
    $deployments = @(Get-AppDeployments)
    $new = @($deployments | Where-Object {
      [string]$_.id -notin $knownDeploymentIds
    })
    $foreign = @($new | Where-Object {
      [string]$_.meta.commitHash -ne $targetCommit
    })
    if ($foreign.Count -gt 0) {
      throw 'a different commit entered production'
    }
    $candidate = @($new | Where-Object {
      [string]$_.meta.commitHash -eq $targetCommit
    } | Select-Object -First 1)
    if ($candidate.Count -eq 1) {
      $status = [string]$candidate[0].status
      if ($status -eq 'SUCCESS') {
        $deployed = $candidate[0]
        break
      }
      if ($status -in $terminal) {
        throw "target deployment ended $status"
      }
      if ($status -notin $nonTerminal) {
        throw "unknown deployment status $status"
      }
    }
    Start-Sleep -Seconds 15
  }
  if ($null -eq $deployed) {
    throw 'target deployment timed out'
  }

  $appVariables = Get-AppVariables
  Assert-OffState $appVariables $true
  $health = Invoke-RestMethod -Uri "$domain/api/health" -Method Get
  if (
    [string]$health.status -ne 'healthy' -or
    [string]$health.checks.database.status -ne 'up'
  ) {
    throw 'health check failed'
  }
  $home = Invoke-WebRequest -Uri $domain -Method Get -UseBasicParsing
  if ([int]$home.StatusCode -ne 200) {
    throw 'home page check failed'
  }

  $env:R2_ENDPOINT = [string]$appVariables.R2_ENDPOINT
  $env:R2_BUCKET = [string]$appVariables.R2_BUCKET
  $env:R2_ACCESS_KEY_ID = [string]$appVariables.R2_ACCESS_KEY_ID
  $env:R2_SECRET_ACCESS_KEY = [string]$appVariables.R2_SECRET_ACCESS_KEY
  $env:R2_EVIDENCE_BUCKET = [string]$appVariables.R2_EVIDENCE_BUCKET
  $env:R2_EVIDENCE_ACCESS_KEY_ID =
    [string]$appVariables.R2_EVIDENCE_ACCESS_KEY_ID
  $env:R2_EVIDENCE_SECRET_ACCESS_KEY =
    [string]$appVariables.R2_EVIDENCE_SECRET_ACCESS_KEY
  if ($env:R2_EVIDENCE_BUCKET -ne $expectedEvidenceBucket) {
    throw 'private evidence bucket changed'
  }
  $auditArgs = @(
    $tsx,
    'scripts/audit-private-evidence-storage.mts',
    '--database-url', $mysqlPublicUrl,
    '--app-id', $appId,
    '--confirm-app-id', $appId,
    '--confirm-host', $databaseUri.Authority,
    '--confirm-database', 'railway',
    '--confirm-evidence-bucket', $expectedEvidenceBucket,
    '--expected-object-count', '0',
    '--expected-receipt-count', '1',
    '--expected-plate-count', '0',
    '--expected-crop-count', '0',
    '--allow-production-private-evidence-audit'
  )
  & $node @auditArgs
  if ($LASTEXITCODE -ne 0) {
    throw "post-deploy evidence audit failed with exit $LASTEXITCODE"
  }

  [pscustomobject]@{
    migration = '0013'
    deploymentId = [string]$deployed.id
    commit = [string]$deployed.meta.commitHash
    scope = 'off'
    health = 'healthy'
    database = 'up'
    evidenceAudit = 'clean'
  } | ConvertTo-Json
} finally {
  foreach ($name in @(
    'R7_EVIDENCE_COMPOSER_SCOPE',
    'R7_EVIDENCE_COMPOSER_RECIPE',
    'ENABLE_EVIDENCE_CANDIDATE_WORKER',
    'R7_EVIDENCE_INGEST_SCOPE',
    'R2_ENDPOINT',
    'R2_BUCKET',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_EVIDENCE_BUCKET',
    'R2_EVIDENCE_ACCESS_KEY_ID',
    'R2_EVIDENCE_SECRET_ACCESS_KEY'
  )) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
  $mysqlPublicUrl = $null
  $mysqlVariables = $null
  $appVariables = $null
}
```

## Required challenge

Independently verify:

1. Exact Git range, fast-forward relation, and exclusion of unstaged/untracked
   files.
2. Migration 0013 shape, 0012→0013 mixed-version safety, defaults/index swap,
   and old runtime compatibility while migration lands first.
3. The reviewed runner's target/scope/range/schema/count/output fences.
4. The wrapper pins the exact Railway project/environment/services, current
   deployment, current remote commit, target local commit, scope state, MySQL
   proxy authority, database, and private bucket before mutation.
5. The wrapper uses direct `node.exe` + tsx JS entry, not a `.cmd` shim, so
   database credentials are one argv element and are not cmd-reparsed.
6. Migration happens before runtime deploy. Any migration failure stops before
   variable or Git mutation. Any partial MySQL DDL failure is reported
   honestly and is never blindly retried.
7. The three new variables are installed explicitly off/false with
   `--skip-deploys`, read back, and proven not to create an intermediate
   deployment.
8. The Git push is a clean fast-forward of exactly the reviewed target commit.
9. Deployment identification cannot confuse an old deployment or concurrent
   foreign commit; only terminal SUCCESS for the exact hash passes, with a
   20-minute bound.
10. Scope/recipe/worker remain off after deployment; snapshot remains all,
    ingest remains off, cleanup worker remains on. Therefore no intent,
    candidate, provider, credit, public/private storage write, or feature
    selection is reachable in D6.
11. Scope-off runtime preserves ordinary R6/snapshot product behavior. Identify
    every scope-independent D1–D5 effect and whether it is safe.
12. Health/home checks are passive, bounded, and sufficient as the automated
    smoke before a separate authenticated founder read pass.
13. The post-deploy audit is read-only/frozen, expected counts are supported by
    the completed R7-7C founder ceremony, storage listing is counts-only, and
    no key/URL/credential/private content can print.
14. Secret handling: Railway variable JSON is captured, never emitted; no
    credential is interpolated into a shell command string; all process env
    values and references are cleared in `finally`.
15. Failure outcomes at every boundary: preflight drift, migration partial,
    variable set/readback, push failure, build failure, timeout, foreign
    deployment, health failure, audit failure, and cleanup failure. State
    exactly what may already have changed and the safe stop/rollback posture.
16. Rollback: before any candidate exists, 380efb remains compatible with
    additive 0013 and explicit off variables; after first D7 candidate object,
    only an adapter/candidate-cleanup-capable build may roll back.
17. Cumulative D1–D5 safety: ownership, strict APIs, private delivery,
    credit/refund idempotency, recovery, exact-key cleanup, atomic Accept,
    feature-blind fences, fork copy, moderator privacy, and D5 no-auto-action
    UX.
18. Evidence sufficiency: exact-HEAD typecheck/full suite/build, recorded
    disposable schema/mixed-version and 18-case lifecycle matrix, plus prior
    per-slice Fable approvals.
19. Whether one combined ceremony is stronger than splitting this disabled
    deployment into multiple separately operated commands.
20. Any reachable blocker or stronger practical correction. Do not downgrade
    a real blocker to a caution merely because the wrapper fails closed.

## Required response

Return:

1. `APPROVE — safe to run the exact R7-7D D6 migration and disabled deployment
   ceremony`, or `REQUEST CHANGES`;
2. plain-English effect;
3. findings mapped to the 20 challenges;
4. blockers;
5. non-blocking cautions;
6. exact approval scope and next unauthorized step.

Approval, if granted, covers one execution of the exact wrapper only:
production migration 0013, explicit composer-off variables, fast-forward push
of `2462b33`, exact Railway deployment, passive health/home checks, and the
counts-only private-evidence audit. It does not authorize a rerun, manual
schema repair, composer/ingest scope enablement, candidate worker enablement,
paid generation, credits/storage writes, founder D7 calibration, cohort
widening, or later R7 work.
