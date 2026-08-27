# Fable re-review prompt — R7-5A blocking corrections

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Re-review only the corrections to the currently staged R7-5A diff after your `REQUEST CHANGES` verdict. Read-only review: do not edit, stage, commit, run any database audit, contact production, or call storage.

Verify both original blockers are closed:

1. Public `boards.updateItem` is now explicitly classified as an unsafe JSON Cast-provenance writer even though it cannot write the direct `sourceModelId` column. The inventory must require R7-5C to strip or validate recognized Cast provenance at the durable update, reject foreign/deleted/mismatched ids, and include this door in the completion checklist and behavioral/source contract.
2. `audit_logs` / `logAuditEvent(MODEL_DELETED)` is now inventoried as a semantic durable model reference. The inventory must bind R7-5C to retaining only non-reconstructive security truth while removing/scrubbing `modelName`, `agencyId`, prompts, schemas, preferences, reference/visual evidence. The read-only audit must count matching audit rows and rows containing forbidden identity metadata without outputting metadata values.

Also verify the bounded hardening added while correcting those blockers:

3. The executable audit reports SQL-fetched but unrecognized JSON model-link candidates rather than silently dropping them, and treats them as an attention result.
4. Cross-owner accounting now includes audit logs as well as the already covered dependencies.
5. Nested URL extraction finds a URL embedded in prose but emits only the URL evidence, never the surrounding error/public text.
6. `generation_operation_locks.lockKey = model:<id>` is resolved in the inventory as content-free recovery/lock evidence, not omitted.
7. The writer inventory now has exactly eight `FENCE REQUIRED` attachment surfaces plus one separate `CONTENT CORRECTION REQUIRED` deletion-audit writer. Challenge that count against current production code and report any remaining model link or retained D-64-forbidden field.
8. The audit remains strictly read-only, production-refusing by default, storage-free, and privacy-safe. No correction may have weakened the exact-origin/key law.
9. Verification is honest: `pnpm check`, focused tests (now 17), standalone script typecheck, and `git diff --cached --check` should be clean.
10. Exactly the same four intended R7-5A files are staged; protected/local/prompt files remain unstaged.

Return exactly one verdict:

- `APPROVE — safe to commit R7-5A locally`
- or `REQUEST CHANGES` with a concrete reachable blocker, evidence, consequence, and smallest sound correction.

List non-blocking observations separately. Approval is local-commit only and does not authorize a database audit, migration 0009, deletion/runtime code, R2 cleanup, push, deploy, or feature enablement.
