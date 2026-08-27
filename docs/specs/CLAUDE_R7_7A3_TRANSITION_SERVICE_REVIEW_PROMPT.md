# Fable review prompt — R7-7A3 atomic transition foundation

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the **staged diff only** against the live codebase, the ratified R7-6 design, and:

- `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`
- `docs/specs/DECISION_LOG.md` (D-65)

This is a read-only review. Do not edit, stage, commit, migrate, push, deploy, enable snapshot reads, contact production, or invoke provider/storage services.

Baseline: `219ec70` (`R7-7A3: add snapshot receipt and erasure foundations`)

## Bounded purpose

This slice establishes one **private atomic transition wrapper** for later R7-7A3 writer-adoption slices. It does not adopt any live writer yet. R6 remains the only read authority and no client capability changes.

The staged files should be exactly:

- `server/casting/snapshotTransitions.ts` (new)
- `server/r7-snapshot-transitions-db.test.ts` (new)
- `server/r7-snapshot-selection-contract.test.ts`
- `scripts/drive-r7-snapshot-bootstrap-disposable.mts`

Protected/local files and this prompt must remain unstaged.

## Challenge the architecture, not just the tests

Please read the complete staged service, the schema, snapshot bootstrap, durable-operation state machine, deletion closure, and the current writers that will later adopt this boundary. Return `REQUEST CHANGES` for any concrete reachable correctness, atomicity, lifecycle, concurrency, privacy, or adoption blocker. Do not approve merely because the tests are green.

Verify all of the following:

1. The wrapper is server-private and has no production caller. No route/client can invoke it and no snapshot read becomes authoritative.
2. Lock order is coherent with the durable operation contract: owned/live model row, running receipt, then the exact `model:<id>` operation lock. The callback cannot run without all three authorities.
3. Expected `stateVersion`, current package snapshot id, current identity snapshot id, and legacy identity revision come only from the already-running server receipt. The caller cannot provide or weaken them.
4. Stale expectations refuse before the legacy callback, credits/provider work inside that callback, or any snapshot append. SQL `NULL` legacy revision and semantic `genesis` interoperate without accepting a genuinely changed revision.
5. The callback and the legacy model/asset/document writes it performs share the same database transaction as the immutable identity/package/slot append and model-head CAS. Any later validation or CAS failure rolls every callback write back.
6. The callback cannot directly mutate `stateVersion`, current package pointer, or either seal pointer. Package-only transitions cannot alter identity documents or `identityRevisionId`.
7. Lifecycle changes are restricted to the existing draft→active mint transition, paired with package reason `mint` and `seal: true`. Mint cannot be mislabeled or performed without sealing. Other transitions cannot archive, unmint, or otherwise change status.
8. Identity changes are draft-only. They require the correct identity/package reason pair and, except create/fork bootstrap/document compaction, advance the legacy identity revision during dual-write.
9. Identity snapshot creation and its package snapshot are always paired. A first package state cannot exist without an identity snapshot.
10. Every unchanged selected slot is copied explicitly with real `sourceSelectionId`; duplicate angles/assets, unknown enums, cross-model assets, wrong view angles, empty/failure-marker assets, and a missing displayed headshot refuse.
11. Identity edits and anchor rerolls stale **all carried siblings**, pinned included. Document compaction changes documents only: it preserves the existing identity anchor, displayed headshot selection, every slot, and compatibility.
12. Anchor and displayed headshot stay distinct concepts. Non-compaction identity changes select the new anchor as displayed `frontClose`; document compaction may preserve a different displayed headshot.
13. Mint seals the exact newly appended package and its identity. After a seal exists, later package appends cannot reference a different identity; identity change on a minted model refuses.
14. `createdByOperationId`, parent snapshot/package ids, optional restore provenance, sequences, identity text/hash, recipe version, and selection provenance are truthful and server-owned.
15. The service does not finalize the parent operation, charge, refund, generate, call storage, expose content in logs, or invent retry semantics. Those remain the adopting executor's responsibility.
16. A repeated call after a committed transition fails closed rather than invoking the callback again. Challenge whether this interacts safely with the existing lost-response/recovery machinery; request changes if it can cause duplicate work, a stranded lock, or an unrecoverable receipt.
17. The service's treatment of snapshot-headless legacy models does not make safe lazy-bootstrap adoption impossible. This slice may remain private and require an adopter to bootstrap under the durable model lock before operation start, but no production writer is allowed to call it in an unsafe order.
18. The disposable runner serializes the two DB suites (`--fileParallelism=false`) so they cannot truncate each other's fixtures, applies through migration 0010, operates only on its guarded `drape_r7_7a2_disposable_*` database, and drops it in `finally`.
19. The real-MySQL tests genuinely prove package-only carry-forward, paired identity/package append, stale-all siblings, separate anchor/display document compaction, exact mint sealing, callback rollback, stale state receipt refusal, and stale legacy-revision refusal.
20. No evidence/candidate/plate schema, pin retirement, restore UI, composer capability, automatic generation/spending, Wardrobe change, migration, flag, production contact, or reader cutover entered this slice.

## Executor verification evidence

Against the exact staged code before review:

- `pnpm check` — clean.
- Focused local suites — 9 passed; 14 DB cases skipped without `TEST_DATABASE_URL` as designed.
- Guarded disposable MySQL runner — 23/23 passed; scratch database `drape_r7_7a2_disposable_1784710072868_99f44c` dropped in `finally`.
- Full unit suite — 2,507 passed / 132 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.
- No test/build Node, Vitest, Tail, or Grep process remains from this work.

## Required verdict

Return exactly one:

- `APPROVE — safe to commit R7-7A3 transition foundation locally`
- `REQUEST CHANGES` with a concrete reachable blocker, code evidence, product impact, and the smallest sound correction.

Separate non-blocking observations clearly. Approval is local-commit scoped only; it does not authorize writer adoption, migration, push, deploy, backfill, production audit, or snapshot read enablement.
