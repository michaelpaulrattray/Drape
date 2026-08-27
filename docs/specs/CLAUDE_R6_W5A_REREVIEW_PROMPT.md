# R6 W5-A — bounded Fable re-review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Re-review the staged W5-A diff after your `REQUEST CHANGES` report. This is a
read-only review. Do not edit, stage, commit, push, deploy, contact production,
or run the paid calibration drive.

Your blocker was valid: a structured recast creates a model-scoped NEW-mode
chat session before upload, but the catch previously cleared the session only
when `uploadedStorageKey` existed. Therefore an upload failure could leave the
unaccepted candidate's identity in chat memory.

The correction is now staged:

- `server/lib/boardOps.ts` clears the exact user/model Casting session on every
  failed `applyModelEdit` recast, independently of whether object upload
  produced a storage key. Exact-key object deletion remains conditional.
- `server/batchC-failureInjection.test.ts` injects an `uploadRawCandidate`
  failure and proves: one raw generation, no keyless object deletion, exact
  `clearCastingSession("1", 7)`, and one truthful refund.

The optional driver-safety improvements were also adopted:

- `scripts/drive-w5-identity.mts` refuses before connecting unless
  `W5_DRIVE_DB_OK=local-development-database` is explicitly supplied after the
  operator confirms `DATABASE_URL` is development-only.
- Legitimate calibration legs 1 and 2 now assert an exact 350-credit net rather
  than only recording it.
- The execution plan and calibration report record these corrections and the
  final verification count.

Verification after correction:

- Focused W5/recast suites: 90/90 passed.
- The four unrelated tests that timed out during an overloaded parallel
  test+typecheck run passed 50/50 in isolation.
- Full suite rerun alone: 123 files passed, 6 environment-dependent files
  skipped; 2,303 tests passed, 50 skipped, zero failures.
- `pnpm check` clean.
- Cached and working-tree whitespace checks clean.
- Exactly 29 W5-A files remain staged; protected local files remain unstaged.

Inspect the actual staged code and test—do not approve from this summary alone.
Confirm specifically that session cleanup cannot be skipped by upload failure,
generation failure, or later atomic-landing failure, and that it cannot clear
another model's session. Also ensure the optional script guard runs before the
database connection.

Return exactly one verdict, with concise reasoning:

- `APPROVE — safe to commit locally`
- `REQUEST CHANGES`

If requesting changes, distinguish blockers from optional/R7 polish and give
the reachable failure plus the smallest sound correction.
