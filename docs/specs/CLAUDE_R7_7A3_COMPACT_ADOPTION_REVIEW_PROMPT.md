# R7-7A3 compact-prompt adoption — bounded Fable review

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the staged diff only. This is a read-only challenge review: do not edit, stage, commit, push, deploy, run production, or contact production services.

Baseline: `42fa6e6` (`R7-7A3: add atomic snapshot transition foundation`).

Expected staged files — exactly these five:

- `server/casting/snapshotTransitions.ts`
- `server/routes/generation/castingRefinement.ts`
- `server/r7-snapshot-selection-contract.test.ts`
- `server/r7-snapshot-transitions-db.test.ts`
- `server/batchC-doors.test.ts`

Purpose: adopt `generation.compactPrompt` as the first live dual-writer for the R7 snapshot-selection system. It is deliberately the lowest-risk adopter: free, draft-only, already protected by a durable operation and `model:<id>` lock, and it changes identity documents without making a paid image call.

Challenge the implementation against the ratified R7-6/R7-7 laws and surrounding production code. Do not trust the executor summary or green tests. Verify each point directly:

1. `castingRefinement.ts` is the only production runtime caller of `snapshotTransitions.ts`. No second writer entered this slice.
2. Lazy bootstrap runs only after the existing free ownership/draft/rate-limit gates and after the durable operation owns `model:<id>`, but before `markGenerationOperationRunning` captures the receipt's expected snapshot head.
3. A snapshot-headless draft refuses with plain-English `PRECONDITION_FAILED` before the compaction LLM, running receipt, credits, provider image work, or transition callback.
4. Bootstrap failure seals the claimed direct operation honestly; it cannot strand the model lock or leave a fake running receipt.
5. The transition service independently verifies the receipt is running, belongs to the authenticated user/model, owns the exact model lock, and has kind `casting.compact`. The caller cannot weaken those checks.
6. A genuinely changed, accepted compacted prompt updates the legacy `models.masterPrompt`, appends a paired `document_compact` identity snapshot and `identity_change` package snapshot, copies the current selections, and advances the model snapshot head atomically in one transaction.
7. The compaction transition preserves the existing identity anchor, displayed headshot, slot compatibility, and current R6 read behavior. It must not generate or select a new image, stale healthy siblings, change lifecycle, seal/mint, or alter pin/restore law.
8. Protected-language rejection returns the original prompt and creates no snapshot transition. A byte-identical rewrite succeeds as unchanged and also creates no invented snapshot state.
9. The operation's expected state/package/identity/revision values are captured from server-owned database truth. No client-supplied snapshot authority was added.
10. A stale head or stale legacy revision refuses before the writer callback; callback writes roll back on any later transition validation failure.
11. A repeated direct transition for an operation that already committed is detected before the callback through `SnapshotTransitionAlreadyCommittedError`, with the committed package id available for future recovery. No string-matching or duplicate append remains.
12. Operation-kind mismatch refuses before the callback. Check that the new generic `expectedKind` requirement does not weaken other future adopter safety.
13. Route error handling preserves typed `TRPCError` refusals and the existing direct-operation recovery boundary. Challenge the crash window after atomic transition commit but before receipt finalization: it must not permit duplicate document/package writes or double work.
14. This slice makes no credit, billing, storage, schema, migration, Wardrobe, evidence/candidate, client UI, snapshot-reader, or production-rollout change.
15. Tests are meaningful rather than merely source pins: the disposable MySQL test must exercise the real high-level compaction adopter, separate anchor/display preservation, replay callback suppression, stale refusals, rollback, and kind mismatch. Route tests must prove headless/protected/unchanged/changed behavior at the real router boundary.
16. Staged scope is exact and protected local files remain unstaged.

Executor evidence to reproduce or challenge:

- `pnpm check` — clean.
- Focused local suites — 81 passed, 8 disposable-DB tests skipped without `TEST_DATABASE_URL`, 0 failed.
- Guarded disposable Railway development-MySQL drive — 24/24 passed (8 transition + 7 bootstrap + 6 contract + 3 pure); scratch database `drape_r7_7a2_disposable_1784713129464_665791` was dropped in `finally`.
- Full unit suite — 2,509 passed, 133 environment-gated skipped, 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.

Return exactly one verdict followed by evidence:

- `APPROVE — safe to commit R7-7A3 compact-prompt adoption locally`
- or `REQUEST CHANGES` with a concrete reachable blocker, exact code evidence, user/product impact, and the smallest sound correction.

Approval is local-commit scoped only. It does not authorize migration, push, deploy, backfill, snapshot read cutover, or further writer adoption.
