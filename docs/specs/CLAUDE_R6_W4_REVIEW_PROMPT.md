# R6 W4 final bounded review — staged diff only

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Act as the read-only Fable 5 reviewer for the final R6 founder-walk correction batch, W4. Do not edit files, stage, commit, push, deploy, contact production, or run paid generation.

Repository: `C:\Users\Admin\Drape`

Review authority:

- `C:\Users\Admin\.claude\plans\rosy-jingling-gizmo.md`, especially findings 1–2, rulings R1/R2/R8, W4 in section 5, and the W4 tests in section 6.
- The staged diff only: `git diff --cached`.
- Relevant locked rulings in `docs/specs/DECISION_LOG.md`, particularly D-41 and staged D-59.

The staged set must be exactly these 18 files:

1. `client/src/features/boards/BoardPage.tsx`
2. `client/src/features/casting/ControlPanel.tsx`
3. `client/src/features/casting/MasterPromptPanel.tsx`
4. `client/src/features/casting/castingSessionToken.ts`
5. `client/src/features/casting/creationPayload.ts`
6. `client/src/features/casting/engineChoicePersistence.ts`
7. `client/src/features/casting/hooks/castingBindings.ts`
8. `client/src/features/casting/hooks/useCastingGeneration.ts`
9. `client/src/features/casting/stores/useCastingFormStore.ts`
10. `client/src/features/casting/stores/useCastingGenerationStore.ts`
11. `client/src/features/studio/components/CastingWorkspace.tsx`
12. `client/src/features/studio/takeover/CastingTakeover.tsx`
13. `docs/specs/DECISION_LOG.md`
14. `server/batchC-doors.test.ts`
15. `server/routes/modelCreateInput.ts`
16. `server/routes/modelCreatePayload.test.ts`
17. `server/routes/models.ts`
18. `server/w4-close-open-contract.test.ts`

Protected local-only files (`.agents/`, `.codex/`, `CLAUDE.local.md`, `.claude/settings.local.json`, and every `docs/specs/CLAUDE_*.md`) must remain unstaged. This prompt file is intentionally not staged.

## Intended W4 behavior

### 1. Close and async-session authority

- A monotonically increasing client session token invalidates late async continuations after reset or close.
- Takeover close invalidates immediately, before the 210 ms exit animation.
- A stale continuation cannot write model id, assets, prompt/schema, progress, suggestions, refine state, enhancement state, or errors into a reset or newer session.
- Server work already in flight is allowed to finish and persist.
- Duplicate close calls cannot land or synchronize twice.

### 2. Board-originated landing

- If a board-originated session closes after a real `frontClose` storage URL exists, the saved draft auto-lands into the originating blank node exactly once.
- An already-placed draft does not re-land.
- A standalone Studio session remains library-only.
- If the user exits before the headshot exists, the node remains empty; after persistence completes the user sees `Draft generated and saved to Drafts`, optionally with an `Open Draft` action.
- `Open Draft` must not replace another currently open Casting session.
- No R7 durable/background-node job machinery was added.
- Leave-confirm copy must match each state honestly.

### 3. Durable Open choices

- Explicit Open authority persists as a strict true-only, closed-key `engineChoice` map in creation preferences; no migration.
- False and unknown flags never reach the wire.
- The server stores the flags but strips the metadata before creation-intent scanning and Gemini prompt generation.
- Hydration restores Open flags and clears engine-resolved concrete values from editable preferences.
- Concrete resolutions come from `technicalSchema` and display read-only as `Resolved at casting`.
- Reopened valid drafts remain valid.
- Brand cannot silently fall back to a random choice. An absent brand is valid only when Brand is explicitly Open; the fire-time random resolution must not clear the Open flag or become an editable user selection.
- Minted-edit copy must say that choosing a concrete value becomes part of a fork, not a draft edit.

### 4. Occupied reference replacement

- Dragging a new image over an occupied reference slot replaces it through the same existing `handleFile` MIME/reader validation path as the empty slot.
- The drag overlay covers the image only, not the explanatory copy.
- This remains temporary per-iteration input, not a persistent reference plate.

## Review questions

Challenge the implementation if you disagree. Give exact file/line evidence and reasoning for every problem.

1. Can any async continuation still poison a reset or different live Casting session?
2. Can close/escape double-fire, double-land, miss a ready headshot, or incorrectly land a standalone/already-placed draft?
3. Is the pre-headshot completion toast truthful, and is its Open Draft action safe against active-session replacement?
4. Is any implicit/random field choice still accepted without explicit Open authority?
5. Can generated schema values leak into editable preferences, identity diffs, prompt input, or policy scanning?
6. Does old data without `engineChoice` remain compatible?
7. Are strict schema/version-skew and superjson key-presence behaviors safe?
8. Does the reference drop path truly reuse validation and avoid layout/interaction regressions?
9. Are the tests behaviorally meaningful, or are any source-string assertions masking a real gap?
10. Did W4 accidentally expand into R7 machinery or modify unrelated product behavior?

## Verification already run

- `pnpm check` — pass.
- Focused W4/model-create/Batch C tests — 38/38 pass after the final brand correction.
- Broader focused W3/W4 set — 57/57 pass before the final brand correction; the affected tests were rerun afterward.
- Full unit suite — 2,261 passed / 50 skipped; two `pathB` router-import tests timed out at the 5 s threshold under full parallel load.
- The two timed-out `pathB` files rerun alone — 38/38 pass.
- `pnpm build` — pass; existing bundle-size warning only.
- `git diff --cached --check` — clean.
- Browser drive — **not passed and not claimed**. The local headless Edge/dev-server harness hung without producing an assertion and timed out. The plan's browser legs remain for later manual/fresh-harness verification.

## Required output

Return one of:

- `APPROVE — safe to commit locally`, or
- `REQUEST CHANGES` followed by a prioritized list of blocking findings with exact evidence and the smallest sound correction.

Also list non-blocking/R7 observations separately. Do not approve merely because tests pass; inspect the actual staged behavior and challenge any reasoning that does not hold.
