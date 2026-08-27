# Fable review — R7-7B3 Add Views/mint execution authority

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Review the staged diff read-only against the ratified R7-7B reader-cutover plan and the surrounding production code. Do not edit, stage, commit, push, deploy, run a database, change Railway variables, or enable snapshot reads.

## Scope

Baseline HEAD: `0db68a1` (`R7-7B3: adopt snapshot refresh execution authority`).

Exactly these five files should be staged:

1. `server/casting/mintPackage.ts`
2. `server/routes/generation/castingExport.ts`
3. `server/casting/mintPackage.test.ts`
4. `server/batchC-doors.test.ts`
5. `server/batchC-sourceGuards.test.ts`

The intentional email sender/reply-to change in `server/routes/emailVerification.ts` must remain unstaged and untouched. All `.agents/`, `.codex/`, `.claude/settings.local.json`, `CLAUDE.local.md`, brand material, plans, and review prompts must remain unstaged.

## Product intent

R7-7B2 made the Add Views/mint plan snapshot-aware, but the paid executor still re-derived current views, missing-angle pricing, identity documents, mint integrity, and the generation anchor from R6 newest-filled asset rows.

This slice closes that plan/execute seam:

- R6 mode remains the unchanged rollback path.
- Snapshot mode re-resolves the effective Cast state inside `executeMintPackage`.
- Explicit package selections, not newest-filled rows, decide which angles exist and therefore which angles may be charged/generated.
- The immutable identity snapshot supplies the generation prompt, schema, preferences, and identity text.
- The identity snapshot anchor supplies the generation reference image; the displayed headshot and newer unselected rows cannot replace it.
- Mint integrity is evaluated over the same snapshot selection used by the plan.
- A third, executor-side snapshot-resolution failure refuses before deduction, provider work, storage creation, or transition commit.
- The existing receipt-head assertion, atomic snapshot transition, exactly-once charge/refund references, failed-slot markers, exact-key cleanup, and R6 behavior are not changed.
- `R7_SNAPSHOT_READ_SCOPE` remains unset/off, so no live account changes behavior from this local commit.

## Required challenges

Verify each point against reachable code, not merely test names:

1. `generation.mintPackage` captures `readMode` exactly once from the authenticated user and never accepts it in the Zod input.
2. Replay returns before planning, snapshot resolution, bootstrap, receipt start, credits, provider work, or transition work.
3. R6 mode is behaviorally unchanged: omitted/`"r6"` still uses `getModelById`, owner/archive checks, `getModelAssets`, `selectIdentityAnchor`, `buildIdentityAnchor`, `computeMintIntegrity`, and newest-filled missing-angle pricing.
4. Snapshot mode inside the executor calls `resolveEffectiveCastStateForRead` and does not call `bootstrapModelSnapshot`, `getModelAssets`, or another R6 selection fallback.
5. `snapshotMintExecutionAuthority` is pure and shared by the snapshot plan and executor so quoted and charged authority cannot drift.
6. Only explicit `selectedViews` populate `existingAngles`; a newer filled but unselected ledger row cannot suppress generation or reduce the charged total.
7. Selected stale compatibility is projected into the selected asset before mint-integrity evaluation; a fresh unselected row cannot launder the selected stale view.
8. Snapshot mint integrity uses the immutable snapshot `identityText`, the identity snapshot anchor, the package-selected displayed headshot, and the package-selected tier views.
9. Snapshot Add Views uses the immutable identity snapshot's `masterPrompt`, `technicalSchema`, and `preferences` for provider generation.
10. Snapshot generation uses `state.anchor.storageUrl`, never the displayed frontClose or a newer ledger headshot.
11. Headless/corrupt/foreign/missing snapshot state refuses through the existing typed adapter and never falls back to R6 truth.
12. The clean draft→active mint lifecycle law is unchanged and still refuses before money.
13. Add Views (`mint:false`) and mint (`mint !== false`) both use the same snapshot authority, while their existing lifecycle/name semantics remain distinct.
14. Plan and executor use the same `tierCosts`/`slotCost` calculation over explicit selected angles, so admitted requests charge exactly the server quote.
15. Snapshot mint refuses a selected stale tier view before money even when the ledger contains a newer unselected fresh row.
16. The router still resolves/validates the current snapshot head, marks the receipt running, then calls `assertGenerationOperationSnapshotHead` before the executor.
17. The executor independently re-resolves after the receipt-head assertion; if that third resolution fails, `deductPoints`, Gemini, storage candidate creation, and `commitGeneratedPackageSnapshot` are not reached.
18. The executor receives the already captured `readMode`; neither service code nor client input re-reads or overrides the environment decision.
19. The single upfront deduction, deterministic per-angle refund references, durable failed markers, refund truth, and exact owned storage-key cleanup remain unchanged.
20. `commitGeneratedPackageSnapshot` remains the only durable successful Add Views/mint writer and continues to independently enforce receipt/lock/head/lifecycle/seal/CAS laws.
21. No post-commit audit failure can trigger cleanup or refund of a committed package; existing audit-gap behavior remains unchanged.
22. No schema, migration, client, pin, deletion, Wardrobe, storage primitive, billing primitive, or transition implementation changed.
23. Source guards meaningfully pin the snapshot selection/identity/anchor wiring and route `readMode` threading without weakening previous guards.
24. Tests are behavioral: the router test drives the real app router and real executor with mocked external boundaries; the pure helper test proves selected-vs-unselected authority; R6 tests remain green.
25. The five-file staged scope is exact and the email change/private files remain outside the index.

## Evidence already produced

- `pnpm check` — clean.
- Focused suites — 95/95:
  - `server/casting/mintPackage.test.ts`
  - `server/batchC-doors.test.ts`
  - `server/batchC-sourceGuards.test.ts`
  - `server/r7-snapshot-selection-contract.test.ts`
- Full unit suite — 2,614 passed / 159 environment-gated skipped / 0 failed.
- `pnpm build` — passed.
- `git diff --check` — clean.

No disposable MySQL gate was run for this slice because it changes no SQL, schema, receipt, lock, CAS, or transition implementation. The already-reviewed resolver, receipt-head assertion, and atomic package transition retain their existing disposable-DB coverage. Challenge whether this is sufficient; request a DB test only if you identify a concrete database behavior newly introduced here.

## Verdict

Return exactly one:

- `APPROVE — safe to commit R7-7B3 Add Views/mint execution authority locally`
- `REQUEST CHANGES` with a concrete reachable blocker, evidence, product impact, and the smallest sound correction.

Keep non-blocking observations separate. Approval can authorize only a local commit. It cannot authorize push, deploy, migration, snapshot-read scope enablement, production contact, B4 adoption, pin retirement, or any other R7 work.
