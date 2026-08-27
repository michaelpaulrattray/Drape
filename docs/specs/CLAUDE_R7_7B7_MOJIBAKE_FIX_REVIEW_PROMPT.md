# Fable Review Prompt — R7-7B7 Pre-Deploy Copy Correction

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the staged diff read-only against baseline `c2f8135`.

Do not edit, stage, commit, push, deploy, contact Railway, query a database, or
change an environment variable.

## Expected scope

Exactly one staged file:

- `server/lib/boardOps.ts`

The only intended change replaces the double-encoded em dash in the
`prepareCanvasRecastAuthority` minted-Cast refusal:

- before: `This identity is minted and immutable â€” fork it as a new model instead.`
- after: `This identity is minted and immutable — fork it as a new model instead.`

This is the reachable cosmetic issue identified in the approved cumulative
R7-7B7 scope-off deployment review. It must not change the error code,
eligibility law, ordering, read mode, operation claim, credits, provider work,
storage, transition behavior, or any other product copy.

## Required verification

1. Confirm the staged diff is exactly the one string-literal correction.
2. Confirm it is the refusal used by `prepareCanvasRecastAuthority` for a
   non-draft/minted Cast.
3. Confirm the error remains `TRPCError` with code `FORBIDDEN`.
4. Confirm no other file is staged and that the intentional changes in
   `server/routes/emailVerification.ts` and `docs/specs/DECISION_LOG.md` remain
   unstaged.
5. Search the B1–B6 runtime areas for remaining `â` or `Ã` mojibake.
6. Reproduce or inspect the recorded evidence:
   - `pnpm check` clean;
   - `server/lib/boardOps.test.ts`,
     `server/batchC-structured.test.ts`, and
     `server/batchC-doors.test.ts`: 105 passed / 0 failed;
   - staged diff check clean.

Return exactly one verdict:

- `APPROVE — safe to commit the R7-7B7 pre-deploy copy correction locally`
- `REQUEST CHANGES` with a concrete reachable blocker

Approval covers only the local commit of the one staged file. It does not
authorize a push, deployment, Railway variable change, production audit,
snapshot-scope enablement, pin convergence, or any later R7 operation.
