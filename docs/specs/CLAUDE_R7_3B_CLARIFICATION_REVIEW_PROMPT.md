# Fable review — R7-3B Casting clarification UX

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Perform a read-only review of the currently staged R7-3B diff against the codebase and the ratified R7 plan.

Baseline: `1487fef` (`R7 Casting UX: dedicated minted cast profile`).

Do not edit, stage, commit, push, deploy, run migrations, or contact production. Challenge the implementation and return either:

- `APPROVE — safe to commit R7-3B locally`
- `REQUEST CHANGES` with a concrete reachable blocker, evidence, and the smallest sound correction.

## Product intent

The ordinary refinement composer must stop treating an ambiguous but potentially valid draft edit as a generic red error. The first supported case is vague hair length, such as “make the hair a bit longer.” The server should ask one clear follow-up beside the composer:

> How long should the hair be?

The five choices are the canonical Casting lengths: Very Short, Short, Medium, Long, and Very Long.

This follow-up is free. Choosing a pill must only prepare a precise instruction in the composer. It must never generate, charge, or automatically submit. The existing visibly priced Apply button remains the only paid door.

## Verify all of the following

1. The clarification is server-owned and derives only from the typed refusal code `hair_length_vague`, never from a client claim or raw client-provided UI payload.
2. The choice list comes from the shared canonical `HAIR_LENGTHS` list, in the same order, with deterministic precise instructions.
3. Only the exact server payload is accepted by the client parser. Missing, reordered, or tampered questions/choices fail closed rather than rendering arbitrary server/client content.
4. The vague request is classified and converted to a clarification before `createGeneration`, `markGenerationOperationRunning`, credit deduction, asset/model writes, or any image-generation call.
5. Ownership, archived-model protection, model locking, rate limiting, daily quota enforcement, and the shared identity authority remain intact. Do not weaken them merely to display a question.
6. The clarification is persisted as a free fulfilled operation receipt while the operation is still `claimed`: zero charged, zero refunded, terminal success, and its resource lock released atomically.
7. A transport retry with the same `clientRequestId` replays the exact saved clarification without reclassification, a second provider call, a generation row, or credit movement.
8. If the claimed-success receipt write loses its response, the direct-operation adapter accepts proven durable replay success. If success cannot be proven, it marks recovery-required and refuses retry instead of risking duplicate work.
9. Existing ordinary refusal paths still use the claimed free-failure finalizer. Existing valid edits still proceed through the normal generation row, running receipt, atomic charge/refund, verifier, commit, and staling paths unchanged.
10. The client no longer blocks the request based on its cached balance before classification. A zero-credit user must still be able to receive this free clarification. A genuinely payable edit with insufficient credits must be refused by the atomic server charge, show the honest error, and open the top-up surface without provider work.
11. The route’s deliberate split is coherent: the HTTP result has `success: false` because no image was produced, while the durable operation receipt is `succeeded` because the classification request was fulfilled. Confirm that no existing operation projection, landing ceremony, or notification incorrectly treats this as a generated asset.
12. The client checks for clarification before the ordinary “no image” failure branch, settles the local operation adapter as fulfilled, shows no generic error toast, and keeps the user’s original text available.
13. Clicking a choice only replaces the composer text with a precise instruction and focuses the field. It never calls `handleRefineSubmit`, never charges, and requires the user to review and click Apply.
14. “I’ll describe it” dismisses the choices and focuses the existing text. Manual typing also dismisses stale clarification. Neither action silently deletes the user’s text.
15. Text, masks, and active tools clear only after an actual completed edit. Clarifications and failures preserve them so the user is not forced to retype.
16. The durable-operation spinner settlement cannot race after the local response and erase the clarification. New active work may replace the old clarification, but terminal spinner cleanup must preserve a newly returned one.
17. The UI is restrained and in context: a flat editorial card beside the composer, no modal, no toast, no automatic spending, no extra Package Health dependency, and no generic dashboard-style decoration.
18. This is an extensible clarification contract, but the shipped vocabulary remains deliberately narrow. Unsupported ambiguity still fails closed; the client must not invent choices for other attributes.
19. No schema migration is required and none is staged. The existing R7 operation schema can represent this free terminal result.
20. Confirm the exact staged file set contains only this clarification slice and no protected/local files (`.agents/`, `.codex/`, `CLAUDE.local.md`, review prompts, brand files, or unrelated work).

## Verification evidence to independently confirm

- `pnpm check` — clean.
- Focused suites — 198 passed; the 30 DB cases skipped without `TEST_DATABASE_URL` as designed.
- Full unit suite — 2,447 passed, 85 environment-dependent skipped, zero failures.
- `pnpm build` — passed.
- Guarded disposable Railway/MySQL suite — 30/30 passed, including the new free-clarification receipt/replay/lock-release test; the uniquely prefixed scratch database was dropped normally.
- `git diff --check` — clean.

Read the complete staged diff and the surrounding production code. Do not approve based only on the new source-contract tests; trace the route, receipt state machine, client operation bridge, session store, composer, and credit boundary end to end.
