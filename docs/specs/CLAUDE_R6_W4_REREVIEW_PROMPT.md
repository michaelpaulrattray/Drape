# R6 W4 — final correction re-review

Perform a **read-only review of the complete staged W4 diff**. Do not edit, stage, commit, push, deploy, or contact production.

This is the re-review after your earlier `REQUEST CHANGES`. Inspect the code itself and challenge the correction if its behavior, tests, or scope are unsound. Do not approve merely because the listed gates are green.

## Your two blocking findings

### 1. Durable `engineChoice` metadata broke downstream creation

You found that fork, recast, and variations passed a stored nested `engineChoice` object into `validateCreationIntent` and prompt construction. This caused Open-field models to fail closed with an `invalid_value` error.

The correction adds `server/casting/engineChoiceMetadata.ts` and applies it to:

- `models.create`: strip metadata only; the client has already resolved the initial concrete brand value.
- `generateCastCandidate`: remove metadata before intake and `generateMasterPrompt`, clear the concrete values of untouched Open fields so the candidate genuinely resolves them again, then restore the strict true-only flags on the stored candidate.
- fork/recast: carry parent flags forward, but an explicitly supplied concrete change clears that field's Open flag before candidate creation.
- variations: preserve untouched Open flags for each new candidate, while metadata never reaches intake or Gemini.
- direct structured identity commits: clear only the Open flag corresponding to the explicitly edited canonical identity field.

`server/lib/boardOps.ts` is outside the original W4 file list. This is a deliberate five-file scope expansion required to fix the blocker:

- `server/lib/boardOps.ts`
- `server/casting/engineChoiceMetadata.ts`
- `server/batchC-structured.test.ts`
- `server/casting/identity/identityCommit.ts`
- `server/casting/identity/identityCommit.test.ts`

Please verify all of the following from the implementation:

1. No `engineChoice` metadata reaches `validateCreationIntent` or `generateMasterPrompt` from create, fork/recast, or variations.
2. Untouched Open flags survive on the newly stored candidate.
3. An explicit fork/recast change clears only that field's flag.
4. A direct allowed identity commit clears only its corresponding flag.
5. Open brand is freshly resolved per candidate; other Open values remain truly unspecified for Gemini rather than inheriting the parent's concrete technical resolution.
6. Unknown/false flags cannot become durable authority.
7. No circular dependency, mutation leak, credit-order regression, or schema leak was introduced.

### 2. Leave-confirm copy lied in reachable states

`CastingTakeover.tsx` now distinguishes:

- generation before any headshot, when a board landing is still required: the node remains empty until the headshot exists;
- headshot already available and landing still required, including mid-iteration: the draft will be placed and the in-flight change keeps saving to it;
- an already-landed/placed draft mid-generation: the draft is already saved and the in-flight change keeps saving to it;
- ordinary saved-draft and minted-edit states.

Please walk the actual `startClose`, `draftLanded`, `editContext.originNeedsLanding`, `hasHeadshot`, and `genState.isGenerating` combinations and confirm both the copy and the resulting landing behavior are truthful.

## Verification already run

- `pnpm check` — pass.
- Focused affected suites — **77/77 pass**:
  - `server/batchC-structured.test.ts`
  - `server/casting/identity/identityCommit.test.ts`
  - `server/w4-close-open-contract.test.ts`
  - `server/routes/modelCreatePayload.test.ts`
  - `server/batchC-doors.test.ts`
- `pnpm build` — pass.
- Full unit run — **2,264 passed / 50 skipped**, with only the two known `pathB` import-time tests timing out under full parallel load.
- The two `pathB` files rerun in isolation — **38/38 pass**.
- `git diff --cached --check` — clean.
- Exactly **23 files** are staged. Protected local files and all `docs/specs/CLAUDE_*.md` files remain unstaged.

The prior browser-drive harness still did not complete, so no browser assertion is claimed here.

## Required verdict

Return one of:

- `APPROVE — safe to commit locally`, or
- `REQUEST CHANGES`, with concrete blocking findings and file/line evidence.

Separate genuine blockers from optional R7 polish. If you disagree with the Open-field semantics or the expanded scope, explain why and propose the smallest sound alternative.
