# R7-7D D6 postflight recovery — read-only review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform a fresh, read-only review of the proposed postflight wrapper below.
Use repository and read-only Railway tools as needed in auto mode. Do not edit,
stage, commit, push, deploy, run a migration, contact MySQL/R2 except through
the exact read-only audit being reviewed, change variables, or invoke
providers/credits.

## Exact completed work and failure

The freshly approved corrected D6 wrapper was executed once. It produced the
guarded migration runner's success JSON:

```json
{"mode":"production-evidence-composer-migration","target":{"appId":"drape-production","host":"hayabusa.proxy.rlwy.net:23768","database":"railway"},"from":"0012_r7_private_evidence_cleanup_backend","to":"0013_r7_ink_add_candidates","preservedRows":{"receipts":1,"referencePlates":0,"crops":0,"privateCleanupItems":0},"newRows":{"intents":0,"candidates":0,"attempts":0,"features":0,"featureVersions":0,"featureSelections":0},"schemaVerified":true}
```

It then installed the three explicit disabled composer variables with
`--skip-deploys`, verified them, verified that this caused no deployment, and
successfully pushed:

```text
380efb0..2462b33  main -> local-migration
```

The wrapper waited about 134 seconds and advanced past its exact deployment
watch and `Assert-OffState`, then failed at:

```powershell
$home = Invoke-WebRequest -Uri $domain -Method Get -UseBasicParsing
```

Windows PowerShell 5.1 treats variable names case-insensitively, so `$home`
collides with the read-only built-in `$HOME`. The health request immediately
before it had already passed. The home request's right-hand side may also have
run, but its status assertion did not. The private-evidence audit and final
success JSON were not reached.

Do not authorize a rerun of the migration/deploy ceremony. Review only the
read-only postflight needed to establish the final state honestly.

## Proposed exact postflight

```powershell
$ErrorActionPreference = 'Stop'

$projectId = '24aa4ff2-4184-4ba6-8ce2-61f79454fdd5'
$environment = 'production'
$appServiceId = 'f613b5f2-f0ef-4256-b123-2e47a694c8b3'
$mysqlServiceId = '72e761be-b1e0-4221-bf22-34bcb37f4249'
$appId = 'drape-production'
$targetCommit = '2462b33ab14fc6a986a0808b60660aaf1c10780a'
$domain = 'https://drape-production-0232.up.railway.app'
$expectedEvidenceBucket = 'drape-production-evidence-private'
$nonTerminal = @('QUEUED','INITIALIZING','WAITING','BUILDING','DEPLOYING')
$env:RAILWAY_CALLER = 'skill:use-railway@1.3.6'
$env:RAILWAY_AGENT_SESSION = 'r7-7d-d6-postflight-20260728'

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

function Assert-OffState($variables) {
  if (
    [string]$variables.R7_SNAPSHOT_READ_SCOPE -ne 'all' -or
    [string]$variables.R7_EVIDENCE_INGEST_SCOPE -ne 'off' -or
    [string]$variables.R7_EVIDENCE_COMPOSER_SCOPE -ne 'off' -or
    [string]$variables.R7_EVIDENCE_COMPOSER_RECIPE -ne 'off' -or
    [string]$variables.ENABLE_EVIDENCE_CANDIDATE_WORKER -ne 'false' -or
    [string]$variables.ENABLE_STORAGE_CLEANUP_WORKER -ne 'true'
  ) {
    throw 'production scope state changed'
  }
}

$mysqlPublicUrl = $null
$mysqlVariables = $null
$appVariables = $null
$databaseUri = $null
$auditArgs = $null
try {
  if ([string](git branch --show-current) -ne 'main') {
    throw 'main is not checked out'
  }
  if ([string](git rev-parse HEAD) -ne $targetCommit) {
    throw 'local HEAD changed'
  }
  if (
    [string](git ls-remote origin refs/heads/local-migration |
      ForEach-Object { ($_ -split '\s+')[0] }) -ne $targetCommit
  ) {
    throw 'remote deployment branch changed'
  }

  $deployments = @(Get-AppDeployments)
  if ($deployments.Count -eq 0) {
    throw 'no deployment found'
  }
  $busy = @($deployments | Where-Object {
    [string]$_.status -in $nonTerminal
  })
  if ($busy.Count -gt 0) {
    throw 'a deployment is still in progress'
  }
  $latest = $deployments[0]
  if (
    [string]$latest.status -ne 'SUCCESS' -or
    [string]$latest.meta.commitHash -ne $targetCommit
  ) {
    throw 'target deployment is not the latest success'
  }

  $appVariables = Get-AppVariables
  Assert-OffState $appVariables

  $health = Invoke-RestMethod `
    -Uri "$domain/api/health" `
    -Method Get `
    -TimeoutSec 30
  if (
    [string]$health.status -ne 'healthy' -or
    [string]$health.checks.database.status -ne 'up'
  ) {
    throw 'health check failed'
  }
  $homeResponse = Invoke-WebRequest `
    -Uri $domain `
    -Method Get `
    -UseBasicParsing `
    -TimeoutSec 30
  if ([int]$homeResponse.StatusCode -ne 200) {
    throw 'home page check failed'
  }

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
    $databaseUri.AbsolutePath.Trim('/') -ne 'railway'
  ) {
    throw 'unexpected production database target'
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

  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $tsx = Join-Path (Get-Location) 'node_modules\tsx\dist\cli.mjs'
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
    deploymentId = [string]$latest.id
    commit = [string]$latest.meta.commitHash
    scope = 'off'
    health = 'healthy'
    database = 'up'
    evidenceAudit = 'clean'
  } | ConvertTo-Json
} finally {
  foreach ($name in @(
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
  $databaseUri = $null
  $auditArgs = $null
}
```

## Required review

1. Prove the failure was after migration, variable installation, push, and a
   successful target deployment, but before the evidence audit.
2. Prove the wrapper above is read-only toward Git, Railway, MySQL, R2, billing,
   providers, and product data.
3. Challenge all commit/deployment/scope/target/count/privacy/cleanup fences.
4. Confirm `$homeResponse` avoids the PowerShell `$HOME` collision.
5. Decide whether one execution of only this postflight is safe.

Return `APPROVE` or `REQUEST CHANGES`, blockers first, and an exact approval
scope. No migration rerun, variable mutation, push, deploy, D7, or later work
may be authorized.
