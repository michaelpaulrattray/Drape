# Fable Review Prompt — R7-7B Snapshot Reader Cutover and Pin Retirement

You are reviewing a planning document, not implementation.

Read:

- `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_EXECUTION_PLAN.md`
- `docs/specs/CASTING_SYSTEM_R7_7A_SNAPSHOT_SELECTION_INVENTORY.md`
- `docs/specs/CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`
- `docs/specs/DECISION_LOG.md`

Baseline is `c35f677`. R7-7A is deployed. The final bounded production audit for the founder cohort reported 42/42 parity, zero mismatched models, zero affected surfaces, 41 current heads and one legitimate headless Cast. R6 is still the only live reader. No snapshot-read flag or pin migration has been enabled.

Inspect the current code rather than trusting the plan's file inventory. At minimum trace:

- `server/casting/snapshotShadow.ts`
- `server/casting/snapshotConsumerShadow.ts`
- `server/casting/snapshotBootstrap.ts`
- `server/casting/snapshotTransitions.ts`
- `server/casting/mintPackage.ts`
- `server/casting/refreshSlots.ts`
- `server/casting/composeIdentityPayload.ts`
- `server/casting/identity/anchorSelector.ts`
- `server/casting/identity/mintIntegrity.ts`
- `server/routes/generation/castingExport.ts`
- `server/routes/generation/castingImaging.ts`
- `server/routes/generation/castingRefinement.ts`
- `server/routes/models.ts`
- `server/routes/registry.ts`
- `server/routes/boards.ts`
- `server/lib/boardOps.ts`
- `server/db/models.ts`
- Wardrobe routes/services and their model-image inputs
- all client consumers of `generation.packageState`, pin mutations, model/library thumbnails, Profile, Canvas Cast nodes, Details/history, export, and Wardrobe.

Challenge the plan against these questions:

1. Is the proposed server scope (`off`, exact user ids, `all`) sufficient to guarantee founder-first rollout with no client authority or mixed mode inside one request?
2. Is fail-closed snapshot behavior correct, or is there any reachable request that needs a narrowly specified fallback without creating paid-decision drift?
3. Does the proposed effective-state resolver validate every closure, ownership, lifecycle, selection, anchor/display, seal, and privacy invariant needed before it can become authority?
4. Does it honestly separate explicit current selection from ledger history, version counts, and storage-URL-empty failure markers?
5. Are all paid plan and execute paths paired so they cannot plan from one authority and charge/generate from another?
6. Does every canonical current-reader appear in B2–B5? Search for missed newest-filled, pin, mutable-status, identity-document, anchor, displayed-headshot, registry, model-list, board, recovery, export, and Wardrobe consumers.
7. Are history restore and ordinary current-target iteration correctly distinguished so historical asset ids do not become client authority?
8. Can a snapshot-enabled operation ever reach credits, Gemini, storage, or a durable generation row before snapshot/head validation?
9. Does the Wardrobe slice correctly remove client-supplied model-image authority while preserving upload-only sessions and the presentation-only tattoo scanner?
10. Does founder pin retirement supersede every model-pin-dependent rule together: selection, stale exemptions, refresh refusal, mint truth, composeIdentityPayload, UI controls, comp cards, history, and tests?
11. Does the bounded pin-clearing tool preserve rollback and avoid racing active model operations? Challenge whether clearing pins is necessary, correctly timed, and safe.
12. Are board-item pins explicitly protected from accidental retirement?
13. Is configuration-level rollback sufficient after pins are cleared, and will the continuously dual-written R6 ledger still render the same current assets?
14. Is any additive schema or durable receipt change actually required before B can work? If so, identify it precisely rather than permitting speculative schema.
15. Are private documents, URLs, keys, raw errors, snapshot authority ids, and cross-owner existence protected in projections, logs, and refusals?
16. Are deletion/account erasure, operation recovery, multi-tab invalidation, and sealed late-view behavior preserved?
17. Are the slices ordered so an intermediate deploy is safe with the scope off and old clients/runtimes?
18. Is the production rollout evidence-based, bounded, replay-safe, and separately gated for flag enablement, pin apply, cohort expansion, and global cutover?
19. Does any slice accidentally add automatic generation/spending, evidence composer behavior, whole-Cast restore, or unrelated UI work?
20. Search for any founder decision the plan silently makes beyond the already ratified R7-6/D-65 direction.

For every blocking finding:

- cite the exact current code evidence;
- describe a concrete reachable product or safety failure;
- propose the smallest sound correction;
- distinguish a missing founder ruling from an implementation detail.

You may directly correct only evidence-backed planning errors that do not require a new founder decision. If you edit, modify only `docs/specs/CASTING_SYSTEM_R7_7B_SNAPSHOT_READER_CUTOVER_PLAN.md`, list every correction, and do not stage or commit anything.

Return exactly one verdict:

- `APPROVE — safe to ratify the R7-7B execution plan`
- `REQUEST CHANGES` with concrete reachable blockers.

Also report:

- any corrections applied;
- remaining founder decisions in plain English with recommended options;
- non-blocking implementation cautions;
- files changed and confirmation that no code, migration, database, storage, Railway variable, push, deploy, or feature enablement occurred.
