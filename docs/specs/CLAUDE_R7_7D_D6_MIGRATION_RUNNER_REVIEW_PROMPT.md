# R7-7D D6 production migration runner — independent review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the exact staged diff only. This is a read-only review: do not edit,
stage, commit, push, deploy, change Railway, contact any database or storage
service, or run a migration. You may use repository tools, run local
typechecks/tests, and inspect all surrounding source needed to challenge the
implementation.

Baseline:

- local main `HEAD` is `e39f0f5` (`R7-7D D5: add inline ink preview UX`);
- exactly these three files must be staged:
  - `scripts/apply-ink-add-migration.mts`;
  - `server/casting/evidence/evidenceComposerDeploymentCeremony.ts`;
  - `server/r7-ink-add-d6-ceremony.test.ts`;
- `server/routes/emailVerification.ts` must remain unstaged;
- all existing local/private prompt, brand, `.agents/`, `.codex/`, and
  `CLAUDE.local.md` files must remain untracked/unstaged.

Product/operational intent:

R7-7D D1–D5 are complete locally, but migration 0013 is not in production and
the new runtime is not deployed. D6 requires migration-before-runtime with the
evidence composer disabled. This slice adds the exact fail-closed operator
boundary for that migration. It must never become a general migration command
and must not create any routed/runtime authority.

Independently verify every point:

1. Staging and baseline are exact and no unrelated file entered the slice.
2. The parser requires the production app id, exact repeated app/host/database
   confirmations, an explicit MySQL URL with user/password/host/port/database,
   and the dedicated
   `--allow-production-evidence-composer-migration` flag. Unknown, duplicate,
   missing, malformed, non-production, or mismatched values refuse.
3. The runner never reads an ambient `DATABASE_URL`; it accepts the target only
   through the reviewed argv ceremony.
4. Composer scope, recipe, candidate worker, and evidence-ingest scope must all
   be off in the CLI process. Missing/empty is treated as the documented
   fail-closed default only; any enabled value refuses.
5. The local journal must end in exactly 0012 then 0013, adjacent, so a later
   migration or a different range makes this runner unusable until reviewed.
6. Production must be exactly at the 0012 journal hash and timestamp. The
   runner verifies the full 0012 private-evidence schema before applying
   anything.
7. Partial/pre-existing 0013 shape is refused before `migrate`: all six new
   tables and all four added columns must be absent.
8. Drizzle can therefore apply only 0013. Evaluate MySQL DDL/autocommit failure
   behavior honestly: confirm failures never print success, and explain the
   operational recovery boundary if a statement fails mid-migration.
9. Postflight proves the exact full 0013 schema using the production boot
   authority and proves the journal hash/timestamp is exactly 0013.
10. Existing evidence receipt/plate/crop/private-cleanup row counts are captured
    before migration and must be identical afterward. Every new 0013 table
    must remain empty.
11. Output is counts-only and target-only: no credential, URL, storage key,
    prompt, descriptor, hash, image data, SQL value, or provider response can
    print. Unexpected errors collapse to the fixed
    `evidence_composer_migration_failed`.
12. Pool cleanup runs on success and every failure after pool construction.
    The runner performs no storage/provider/credit/feature-flag/deployment
    operation.
13. No runtime route, worker, startup hook, or package script imports the new
    ceremony or runner. This is operator-only and inert until explicitly
    invoked.
14. Tests meaningfully pin the authority ceremony, scope-off law, exact
    migration range, pre/post schema proofs, row-count fences, and output
    hygiene. Re-run `pnpm check` and the relevant focused suites.
15. Assess whether this is the strongest practical production-migration
    construction for this repository. Identify any reachable weakness in
    Railway URL handling, PowerShell/cmd argument re-parsing, migration
    ambiguity, schema drift, mixed-version compatibility, or false success.

Recorded local evidence on this exact staged tree:

- `pnpm check` — clean;
- focused suites
  `server/r7-ink-add-d6-ceremony.test.ts`,
  `server/r7-ink-add-schema-contract.test.ts`,
  `server/casting/evidence/evidenceComposerSchema.test.ts`, and
  `server/r7-private-evidence-ceremony.test.ts` — 14 passed / 0 failed;
- `git diff --cached --check` — clean.

Return:

1. `APPROVE — safe to commit the D6 migration runner locally`, or
   `REQUEST CHANGES`;
2. plain-English operational effect;
3. findings mapped to the 15 checks;
4. blockers;
5. non-blocking observations;
6. exact approval scope.

Approval may cover only a local commit of the three staged files. It must not
authorize migration execution, production contact, push/deploy, Railway
variables, scope enablement, provider/storage/credit work, founder
calibration, or R7-7D D7.
