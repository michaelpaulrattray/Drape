# R7-7D D6 production gate rerun — narrow review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform a fresh, read-only review of the corrected one-shot wrapper in
`docs/specs/CLAUDE_R7_7D_D6_PRODUCTION_GATE_REVIEW_PROMPT.md`.
Use repository and read-only Railway tools as needed in auto mode. Do not edit,
stage, commit, push, deploy, run a migration, contact MySQL/R2, change variables,
or invoke providers/credits.

## What happened

The previously approved wrapper was executed once and stopped in its first
read-only preflight, before the migration, any Railway variable mutation, the
Git push, deployment, database/storage contact, or health/audit stages.

PowerShell 5.1 failed here:

```text
Sort-Object : Cannot convert the "System.Object[]" value of type
"System.Object[]" to type "System.DateTimeOffset".
```

The Railway CLI returned a top-level JSON array. In PowerShell 5.1,
`ConvertFrom-Json` emitted that array as one pipeline object, so the original
inline pipeline handed `Sort-Object` the whole array and
`$_.createdAt` became an array of timestamps.

## Exact correction

Only `Get-AppDeployments` changed:

```diff
 function Get-AppDeployments {
-  @(railway.cmd deployment list `
-      --project $projectId `
-      --environment $environment `
-      --service $appServiceId `
-      --limit 30 `
-      --json | ConvertFrom-Json) |
+  $rawDeployments = railway.cmd deployment list `
+    --project $projectId `
+    --environment $environment `
+    --service $appServiceId `
+    --limit 30 `
+    --json | ConvertFrom-Json
+  @($rawDeployments) |
     Sort-Object { [DateTimeOffset]$_.createdAt } -Descending
 }
```

A separate read-only shape check using the corrected form returned:

```json
{"count":5,"latestId":"3388c6a7-8ae8-4380-85dc-3e8aaa09ae2a","latestStatus":"SUCCESS","latestCommit":"380efb01b51fe86debdc24007ce0622d13b1d7df"}
```

No repository source or reviewed commit changed. Local `main` is still
`2462b33ab14fc6a986a0808b60660aaf1c10780a`; `origin/local-migration` is still
`380efb01b51fe86debdc24007ce0622d13b1d7df`; the long-standing unrelated
`server/routes/emailVerification.ts` edit remains unstaged.

## Review questions

1. Does the correction enumerate and sort both a one-element and multi-element
   Railway JSON array correctly under Windows PowerShell 5.1?
2. Does it preserve every original fail-closed deployment, commit, status, and
   concurrency fence?
3. Is the original failure conclusively pre-mutation?
4. Is one rerun of the complete corrected wrapper safe, or is any further
   correction required?

Return `APPROVE` or `REQUEST CHANGES`, blockers first, and an exact approval
scope. This review may authorize only one execution of the complete corrected
wrapper. It must not authorize an ad hoc retry after any later failure.
