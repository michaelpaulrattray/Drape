# Fable Run Review — R7-7B7 Production Parity Audit

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are the independent, read-only reviewer for R7-7B7 rollout step 2.

Review the exact bounded production command below and decide whether it is safe
to run. Do not edit, stage, commit, push, deploy, contact Railway, query a
database, change a variable, run the audit, run convergence, or enable snapshot
reads.

## Required verdict

Return exactly one:

- `APPROVE — safe to run the bounded R7-7B7 production parity audit`
- `REQUEST CHANGES` with a concrete reachable blocker and the smallest sound
  correction

Approval covers only this one read-only audit run. It does not authorize
snapshot convergence, a Railway variable change, founder-scope enablement, a
pin plan or apply, generation, credits, storage work, cohort expansion, `all`,
or later R7 work.

## Current production state

Verify these facts from the code and supplied operational evidence:

- Production project: `drape-production`
- Project ID: `24aa4ff2-4184-4ba6-8ce2-61f79454fdd5`
- Environment: `production`
- Environment ID: `a8a8edd9-deae-4aa3-9520-da0eb7534761`
- App service: `Drape`
- App service ID: `f613b5f2-f0ef-4256-b123-2e47a694c8b3`
- MySQL service ID: `72e761be-b1e0-4221-bf22-34bcb37f4249`
- Deployed commit: `8bc1b29aca61490f4ee90da8c04002dc9e3b9d03`
- Deployment:
  `cad3eec2-8f73-440f-a790-063079746a23`, terminal `SUCCESS`
- `R7_SNAPSHOT_READ_SCOPE=off`
- `/api/health`: healthy, database up
- HTTP 5xx after deployment: zero
- R6 remains the only live reader.

The approved rollback build remains `c35f677`.

## Exact frozen founder cohort

The already-audited founder cohort is:

- owner user id: `1`
- exact model ids: `1` through `41`, plus `46`
- exact expected report count: `42`
- prior clean evidence before B6 pin retirement:
  - 42 audited;
  - 42 parity;
  - 0 mismatched;
  - 41 current;
  - 1 legitimate headless;
  - all mismatch and affected-surface counts zero.

Both `--user-id 1` and all 42 `--model-id` flags are supplied, so selection is
their intersection. A report count other than exactly 42 is a failed
operational gate even if the audit process exits 0.

## Intended post-B6 interpretation

B6 deliberately projects snapshot Cast-slot pins as retired while the R6 side
still reports stored `model_assets.pinned` values. Before the separate bounded
pin convergence:

- a currently selected legacy-pinned row may produce
  `consumer_package_state`;
- a stale selected legacy-pinned row may also produce
  `consumer_refresh_plan`;
- those map only to `casting_package_state` and `casting_refresh_plan`.

Pin-only attention is expected and must be recorded, not waved through as full
parity. Every other structural or consumer mismatch is unexplained and stops
the rollout. An invalid head, unexpected headless/current count, missing model,
unexpected affected surface, or any mismatch outside those two pin-attributable
kinds also stops the rollout.

The audit itself cannot prove that a mismatch is caused by pins. The next
separately reviewed operation is the read-only pin-convergence plan, whose exact
pinned-row count and hypothetical post-clear parity are the attribution
evidence. Do not authorize that next operation in this review.

## Exact command wrapper proposed

This is PowerShell. It obtains the production database URL only from the exact
Railway MySQL service, keeps it in a process-local variable, does not print it,
and passes arguments as an array so password metacharacters cannot be
reinterpreted by the shell.

```powershell
$env:RAILWAY_CALLER = 'skill:use-railway@1.3.6'
$env:RAILWAY_AGENT_SESSION = 'railway-skill-r7b7-audit-1784894300'

$projectId = '24aa4ff2-4184-4ba6-8ce2-61f79454fdd5'
$environmentId = 'a8a8edd9-deae-4aa3-9520-da0eb7534761'
$appServiceId = 'f613b5f2-f0ef-4256-b123-2e47a694c8b3'
$mysqlServiceId = '72e761be-b1e0-4221-bf22-34bcb37f4249'
$expectedDeployment = '8bc1b29aca61490f4ee90da8c04002dc9e3b9d03'
$expectedModelIds = @((1..41) + 46)

$deployRaw = & railway.cmd deployment list `
  --project $projectId `
  --environment $environmentId `
  --service $appServiceId `
  --limit 1 `
  --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$latest = ($deployRaw | ConvertFrom-Json) | Select-Object -First 1
if ($latest.status -ne 'SUCCESS') {
  throw "The reviewed production deployment is not healthy"
}
if ($latest.meta.commitHash -ne $expectedDeployment) {
  throw "Production is not running the reviewed commit"
}

$appVariablesRaw = & railway.cmd variable list `
  --project $projectId `
  --environment $environmentId `
  --service $appServiceId `
  --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$appVariables = $appVariablesRaw | ConvertFrom-Json
if ([string]$appVariables.R7_SNAPSHOT_READ_SCOPE -ne 'off') {
  throw "Snapshot read scope must remain exactly off"
}

$mysqlVariablesRaw = & railway.cmd variable list `
  --project $projectId `
  --environment $environmentId `
  --service $mysqlServiceId `
  --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$mysqlVariables = $mysqlVariablesRaw | ConvertFrom-Json
$mysqlPublicUrl = [string]$mysqlVariables.MYSQL_PUBLIC_URL
if (-not $mysqlPublicUrl) {
  throw "The production MySQL public URL is unavailable"
}
$target = [Uri]$mysqlPublicUrl
if ($target.Scheme -ne 'mysql') {
  throw "The audit target must use mysql"
}
if ($target.AbsolutePath.Trim('/') -ne 'railway') {
  throw "The audit target must name the railway database"
}
if ($target.Host -notmatch '\.proxy\.rlwy\.net$') {
  throw "The audit target must be a Railway public MySQL proxy"
}

$auditArgs = @(
  'exec',
  'tsx',
  'scripts/audit-cast-snapshot-parity.ts',
  '--database-url',
  $mysqlPublicUrl,
  '--app-id',
  'drape-production',
  '--allow-production-read-only',
  '--user-id',
  '1'
)
foreach ($modelId in $expectedModelIds) {
  $auditArgs += @('--model-id', [string]$modelId)
}

try {
  & pnpm.cmd @auditArgs
  $auditExitCode = $LASTEXITCODE
} finally {
  $mysqlPublicUrl = $null
  $mysqlVariables = $null
  $mysqlVariablesRaw = $null
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

Write-Output "AUDIT_EXIT_CODE=$auditExitCode"
if ($auditExitCode -notin @(0, 2)) {
  exit $auditExitCode
}
```

Exit 2 is intentionally preserved in the printed evidence but normalized at
the outer shell because it means “audit completed and found attention,” not a
runtime failure. The operator must still treat it as a rollout stop until the
output is interpreted.

## Required code review

Read completely:

- `scripts/audit-cast-snapshot-parity.ts`
- `scripts/tsconfig.snapshot-audit.json`
- `server/casting/snapshotShadowAudit.ts`
- `server/casting/snapshotShadow.ts`
- `server/casting/snapshotConsumerShadow.ts`
- the B6 portions of
  `server/casting/snapshotPinConvergence.ts`
- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`,
  especially B6, B7, and the verification matrix.

## Required challenges

1. Prove the audit dependency chain performs only SELECTs/pure computation and
   cannot lock, write, converge, clear pins, spend credits, call providers,
   access storage, deploy, or change variables.
2. Prove there is no route, worker, scheduler, startup, or package-script
   reachability.
3. Verify user id plus exact model ids intersect and the IDs are deduplicated
   and sorted.
4. Verify archived, deleted, and tombstoned models cannot enter the cohort.
5. Verify all 42 models are compared in one consistent transaction.
6. Verify the comparator still covers every structural and consumer mismatch,
   identity hash, selected slot, anchor/display split, seal law, mint/refresh,
   export, registry, library, and package projection.
7. Verify the output contains only ids, counts, booleans, closed enums, and
   hashes—no prompt, schema, preference, name, email, URL, key, credentials,
   or raw SQL values.
8. Challenge the caught database error path for possible credential or private
   content leakage.
9. Verify the exact Railway target ceremony. No local `.env` database URL is
   used, and the database credential is not printed.
10. Verify the PowerShell array invocation is safe for URL/password
    metacharacters and the secret variables are cleared after execution.
11. Verify the production scope and deployed commit are rechecked immediately
    before the audit.
12. Verify exit-code handling is honest and cannot make an attention result
    look like parity in the report.
13. Challenge the missing built-in expected-count fence. Decide whether the
    explicit model list plus the operator requirement
    `summary.auditedModels === 42` is sufficient for this read-only run, or
    require a wrapper-side mechanical check before approval.
14. Verify the expected pin-only mismatch vocabulary and affected surfaces.
    Identify any other mismatch that pins could legitimately cause.
15. Verify a pin-only mismatch is not silently classified as safe for founder
    enablement; it must lead to the separately reviewed pin-plan attribution
    step.
16. Verify no output or command artifact is written into the repository.
17. Verify the run cannot enable snapshot reads or mutate the deployed
    application.
18. Confirm the run stops after reporting. It must not automatically execute
    pin planning, pin clearing, scope changes, or browser actions.

## Local evidence

Against deployed source commit `8bc1b29`:

- standalone script typecheck:
  `pnpm exec tsc -p scripts/tsconfig.snapshot-audit.json` — clean;
- focused suites:
  `snapshotShadow`, `snapshotShadowAudit`, and the authority contract —
  26 passed / 0 failed;
- the complete candidate previously passed:
  2,700 unit tests / 171 environment-gated skips / 0 failures and production
  build.
- Railway CLI is authenticated; version 5.26.1.
- Railway agent tooling reports skills and MCP healthy/up to date.

Do not rerun any database or Railway operation during this review.

## Required report

1. Verdict.
2. Exact target/cohort confirmation.
3. Read-only and privacy proof.
4. Exit/count/mismatch interpretation.
5. Any blocker and smallest correction.
6. Non-blocking cautions.
7. Exact scope of approval and the next still-unauthorized operation.
