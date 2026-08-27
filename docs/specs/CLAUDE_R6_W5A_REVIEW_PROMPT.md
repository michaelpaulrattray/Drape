# R6 W5-A — bounded Fable review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


You are Claude Fable 5 acting as the read-only reviewer. Review the complete
staged W5-A diff in `C:\Users\Admin\Drape`. Do not edit files, stage, commit,
push, deploy, contact production, or spend credits.

Start by reading:

1. `docs/specs/CASTING_SYSTEM_R6_W5_EXECUTION_PLAN.md`
2. `docs/specs/CASTING_SYSTEM_R6_W5A_CALIBRATION_REPORT.md`
3. Decision D-60 in `docs/specs/DECISION_LOG.md`
4. The full staged diff: `git diff --cached`

The staged set must contain exactly 29 W5-A files. Local-only `.agents/`,
`.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, and every
`docs/specs/CLAUDE_*.md` file must remain unstaged.

## Binding founder clarification

There are two different post-headshot operations:

- Casting-panel changes followed by **Recast model** intentionally create a
  new draft identity from the chosen settings. The person may change. This is
  not a same-person edit and must not be checked against the former face.
- Free-text LLM, reference-assisted, and surgical edits operate on the
  accepted person. They must preserve every protected identity dimension
  except the exact authorized field and the closed, reviewed physical
  dependents of hair length/style.

Challenge this implementation if the code does not faithfully enforce that
distinction. Do not assume the plan or calibration report is correct merely
because it is documented or tests are green.

## Review questions

1. Does every identity-class iteration require a valid typed patch before
   audit creation, credit movement, generation, upload, or canon mutation?
2. Does the visual identity gate exempt only the explicit authorized field
   plus the closed non-transitive hair-geometry dependency list, while always
   protecting overall facial identity and permanent marks?
3. Does the gate fail closed for malformed, incomplete, uncertain,
   unavailable, or thrown verifier results? Is the retry isolated and based
   on the original accepted source rather than a rejected candidate?
4. Are rejected candidates kept in memory and never uploaded? If a passing
   upload is followed by an atomic commit failure, is its exact object key
   cleaned up and is refund truth preserved?
5. Are casting chat sessions isolated by both user and model, with no
   cross-model bleed and no rejected retry context reused?
6. Does the identity comparison prompt receive the structured technical
   schema as well as the master prompt, without weakening server authority?
7. For hair-length/style dependencies, does canon release only reviewed
   geometry leaves, preserve protected hair color/texture/hairline and all
   face/skin/demographic/mark fields, avoid transitive widening, and record
   provenance/audit truth?
8. Does structured panel recast generate exactly one NEW-mode candidate,
   avoid the same-person verifier, deterministically compute the updated
   document, and atomically commit document + anchor + revision + stale state
   + board landing? Check tracked-upload cleanup, exact credits/refunds, audit
   metadata, and public wording on every failure path.
9. Is the R6 UI copy sufficiently truthful that users understand **Recast
   model** may produce a different person, without pretending the fuller R7
   UX already exists?
10. Are the calibration driver’s local-only/production guards sound, and do
    its assertions actually prove the reported credit, audit, anchor,
    revision, board-version, failure, and retry outcomes rather than merely
    observing HTTP success?
11. Look for regressions outside the happy path: image-only iterations,
    reruns, minted/fork rules, audit-row failures, upload failures, transaction
    rollback, session clearing, schema/prompt consistency, and old rows.
12. Identify any unnecessary scope, brittle tests, misleading documentation,
    or important edge case the executor missed.

You may run read-only inspection commands and local automated tests. Do not
start a paid calibration drive or contact production. The executor reports:

- `pnpm check` clean.
- Full suite: 123 files passed, 6 environment-dependent files skipped;
  2,302 tests passed, 50 skipped, zero failures.
- Corrected local calibration: all eight legs passed under their expected
  accept/refuse outcomes; production was not contacted.

Return one of these verdicts:

- `APPROVE — safe to commit locally`
- `REQUEST CHANGES`

If requesting changes, separate blockers from optional/R7 polish. For every
blocker, provide the concrete reachable failure, relevant file and line,
smallest sound correction, and missing regression test. If you disagree with
the plan or founder contract, say so explicitly and explain the reasoning in
plain English.
